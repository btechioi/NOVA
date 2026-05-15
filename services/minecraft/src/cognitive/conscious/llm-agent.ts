import type { Message } from '@xsai/shared-chat'

import { generateText } from '@xsai/generate-text'

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
}

export interface LLMCallOptions {
  messages: Message[]
  responseFormat?: { type: 'json_object' }
  reasoning?: { effort: 'low' | 'medium' | 'high' }
  abortSignal?: AbortSignal
  timeoutMs?: number
}

export interface LLMResult {
  text: string
  reasoning?: string
  // FIXME unsafe type
  usage: any
}

function stripV1(path: string): string {
  return path.replace(/\/v1\/?$/, '')
}

/**
 * Lightweight LLM agent for text generation using xsai
 * Supports OpenAI-compatible APIs (via xsai) and OpenCode session-based API.
 */
export class LLMAgent {
  constructor(private config: LLMConfig) { }

  private isCerebrasBaseURL(baseURL: string): boolean {
    const normalized = baseURL.toLowerCase()
    return normalized.includes('cerebras.ai') || normalized.includes('cerebras.com')
  }

  private isOpencodeBaseURL(baseURL: string): boolean {
    const normalized = baseURL.toLowerCase()
    return normalized.includes('127.0.0.1:4096') || normalized.includes('localhost:4096')
  }

  private opencodeAuthHeaders(): Record<string, string> {
    const encoded = btoa(`opencode:${this.config.apiKey}`)
    return { Authorization: `Basic ${encoded}` }
  }

  private createLinkedAbortController(parentSignal?: AbortSignal): {
    controller: AbortController
    dispose: () => void
  } {
    const controller = new AbortController()
    if (!parentSignal) {
      return {
        controller,
        dispose: () => {},
      }
    }

    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
      return {
        controller,
        dispose: () => {},
      }
    }

    const onAbort = () => {
      controller.abort(parentSignal.reason)
    }
    parentSignal.addEventListener('abort', onAbort, { once: true })
    return {
      controller,
      dispose: () => parentSignal.removeEventListener('abort', onAbort),
    }
  }

  private async callOpencode(
    options: LLMCallOptions,
    signal: AbortSignal,
  ): Promise<LLMResult> {
    const baseURL = stripV1(this.config.baseURL.replace(/\/+$/, ''))
    const authHeaders = this.opencodeAuthHeaders()

    const systemMessages = options.messages.filter(m => m.role === 'system')
    const otherMessages = options.messages.filter(m => m.role !== 'system')
    const system = systemMessages
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .filter(Boolean)
      .join('\n')

    const conversationText = otherMessages
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : ''
        return `${m.role}: ${content}`
      })
      .join('\n\n')

    const sessionRes = await fetch(`${baseURL}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ title: 'Minecraft Bot' }),
      signal,
    })
    if (!sessionRes.ok) {
      throw new Error(`OpenCode create session failed: ${sessionRes.status} ${await sessionRes.text().catch(() => '')}`)
    }
    const session = (await sessionRes.json()) as { id: string }
    const sessionID = session.id

    try {
      const msgRes = await fetch(`${baseURL}/session/${sessionID}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...(system ? { system } : {}),
          parts: [{ type: 'text', text: conversationText || '(empty)' }],
        }),
        signal,
      })
      if (!msgRes.ok) {
        throw new Error(`OpenCode send message failed: ${msgRes.status} ${await msgRes.text().catch(() => '')}`)
      }
      const msg = (await msgRes.json()) as { info: { tokens?: any }, parts: Array<{ type: string, text?: string }> }
      const parts = msg.parts ?? []

      let text = ''
      let reasoning = ''
      for (const part of parts) {
        if (part.type === 'text') {
          text += (text ? '\n' : '') + (part.text ?? '')
        }
        else if (part.type === 'reasoning') {
          reasoning += (reasoning ? '\n' : '') + (part.text ?? '')
        }
      }

      return {
        text,
        reasoning: reasoning || undefined,
        usage: (msg as any).info?.tokens,
      }
    }
    finally {
      fetch(`${baseURL}/session/${sessionID}`, {
        method: 'DELETE',
        headers: authHeaders,
      }).catch(() => {})
    }
  }

  /**
   * Call LLM with the given messages
   */
  async callLLM(options: LLMCallOptions): Promise<LLMResult> {
    const { controller, dispose } = this.createLinkedAbortController(options.abortSignal)
    const timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : null
    const timeoutError = timeoutMs
      ? Object.assign(new Error(`LLM provider call timeout after ${timeoutMs}ms`), { name: 'TimeoutError' })
      : null
    const timeoutHandle = timeoutMs
      ? setTimeout(() => {
          if (!controller.signal.aborted)
            controller.abort(timeoutError)
        }, timeoutMs)
      : undefined

    const isOpencode = this.isOpencodeBaseURL(this.config.baseURL)

    try {
      if (isOpencode) {
        return await this.callOpencode(options, controller.signal)
      }

      const shouldSendReasoning = !this.isCerebrasBaseURL(this.config.baseURL)
      const response = await generateText({
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey,
        model: this.config.model,
        messages: options.messages,
        headers: { 'Accept-Encoding': 'identity' } as Record<string, string>,
        abortSignal: controller.signal,
        ...(options.responseFormat && { responseFormat: options.responseFormat }),
        ...(shouldSendReasoning && {
          reasoning: options.reasoning ?? { effort: 'low' },
        }),
      } as Parameters<typeof generateText>[0])

      return {
        text: response.text ?? '',
        reasoning: (response as any).reasoningText,
        usage: response.usage,
      }
    }
    finally {
      if (timeoutHandle)
        clearTimeout(timeoutHandle)
      dispose()
    }
  }
}
