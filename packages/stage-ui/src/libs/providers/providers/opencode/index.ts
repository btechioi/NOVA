import type { ModelInfo } from '../../types'

import { errorMessageFrom } from '@moeru/std'
import { createModelProvider, merge } from '@xsai-ext/providers/utils'
import { z } from 'zod'

import { defineProvider } from '../registry'

const opencodeConfigSchema = z.object({
  apiKey: z
    .string('Password')
    .optional()
    .default(''),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('http://localhost:4096'),
})

type OpenCodeConfig = z.input<typeof opencodeConfigSchema>

function createOpenCodeChatProvider(apiKey: string, baseURL: string) {
  let sessionId: string | null = null
  let currentModelKey: string | null = null
  const encoder = new TextEncoder()

  const authHeaders = (): Record<string, string> => {
    if (!apiKey)
      return {}
    const encoded = btoa(`opencode:${apiKey}`)
    return { Authorization: `Basic ${encoded}` }
  }

  const createSession = async (agent?: string, model?: { id: string, providerID: string }): Promise<string> => {
    const res = await globalThis.fetch(`${baseURL}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        title: 'NOVA Chat',
        agent,
        model,
      }),
    })
    if (!res.ok) {
      throw new Error(`OpenCode session creation failed: ${res.status} ${res.statusText}`)
    }
    const data = await res.json() as { id: string }
    return data.id
  }

  const getOrCreateSession = async (agent?: string, model?: { id: string, providerID: string }): Promise<string> => {
    const modelKey = JSON.stringify({ agent, model })
    if (sessionId && currentModelKey === modelKey)
      return sessionId

    sessionId = await createSession(agent, model)
    currentModelKey = modelKey
    return sessionId
  }

  return {
    chat: (model: string) => ({
      apiKey,
      baseURL,
      model,
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse((init?.body as string) || '{}') as any
        const messages: any[] = body.messages || []
        const modelId: string = body.model || model

        let agent: string | undefined
        let opencodeModel: { id: string, providerID: string } | undefined

        // Parse modelId: agent:name or providerID/modelID
        if (modelId.startsWith('agent:')) {
          agent = modelId.replace('agent:', '')
        }
        else if (modelId.includes('/')) {
          const [providerID, id] = modelId.split('/')
          opencodeModel = { providerID, id }
        }
        else if (modelId !== 'opencode') {
          // Fallback if it's not the default opencode ID
          opencodeModel = { id: modelId, providerID: 'openai' } // Default provider
        }

        const sid = await getOrCreateSession(agent, opencodeModel)

        const systemMsg = messages.find(m => m.role === 'system')
        const systemPrompt = typeof systemMsg?.content === 'string'
          ? systemMsg.content
          : (Array.isArray(systemMsg?.content)
              ? systemMsg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
              : '')

        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
        const text = typeof lastUserMsg?.content === 'string'
          ? lastUserMsg.content
          : (Array.isArray(lastUserMsg?.content)
              ? lastUserMsg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
              : '')

        const res = await globalThis.fetch(`${baseURL}/session/${sid}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          signal: init?.signal,
          body: JSON.stringify({
            parts: [{ type: 'text', text }],
            system: systemPrompt || undefined,
            agent,
            model: opencodeModel?.id,
          }),
        })

        if (!res.ok) {
          return new Response(null, { status: res.status, statusText: res.statusText })
        }

        const data = await res.json() as any
        // V1 message returns { info, parts }
        let responseText = ''

        if (data && Array.isArray(data.parts)) {
          responseText = data.parts
            .filter((p: any) => p.type === 'text' && p.text)
            .map((p: any) => p.text)
            .join('\n')
        }

        const id = `opencode-${Date.now()}`

        const stream = new ReadableStream({
          start(controller) {
            const enqueue = (chunk: object) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))

            enqueue({
              id,
              object: 'chat.completion.chunk',
              choices: [{ delta: { role: 'assistant' }, index: 0, finish_reason: null }],
            })
            if (responseText) {
              enqueue({
                id,
                object: 'chat.completion.chunk',
                choices: [{ delta: { content: responseText }, index: 0, finish_reason: null }],
              })
            }
            enqueue({
              id,
              object: 'chat.completion.chunk',
              choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
            })
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
          },
        })
      },
    }),
  }
}

function openCodeStaticModels(): ModelInfo[] {
  return [
    { id: 'opencode', name: 'OpenCode (default)', provider: 'opencode', description: 'Use the default model configured in your opencode server' },
  ]
}

async function fetchOpenCodeModels(config: OpenCodeConfig): Promise<ModelInfo[]> {
  const baseURL = config.baseUrl || 'http://localhost:4096'
  const apiKey = config.apiKey || ''

  const authHeaders = (): Record<string, string> => {
    if (!apiKey)
      return {}
    const encoded = btoa(`opencode:${apiKey}`)
    return { Authorization: `Basic ${encoded}` }
  }

  const models: ModelInfo[] = [...openCodeStaticModels()]

  try {
    // 1. Fetch Providers and their models
    const providerRes = await globalThis.fetch(`${baseURL}/provider`, {
      headers: authHeaders(),
    })
    if (providerRes.ok) {
      const data = await providerRes.json() as { all: Array<{ id: string, name: string, models: Array<{ id: string, name: string }> }> }
      for (const provider of data.all || []) {
        for (const model of provider.models || []) {
          models.push({
            id: `${provider.id}/${model.id}`,
            name: `${model.name} (${provider.name})`,
            provider: 'opencode',
            description: `Model ${model.id} from provider ${provider.id}`,
          })
        }
      }
    }

    // 2. Fetch Agents
    const agentRes = await globalThis.fetch(`${baseURL}/agent`, {
      headers: authHeaders(),
    })
    if (agentRes.ok) {
      const agents = await agentRes.json() as Array<{ name: string, description?: string }>
      for (const agent of agents) {
        models.push({
          id: `agent:${agent.name}`,
          name: `${agent.name} (Agent)`,
          provider: 'opencode',
          description: agent.description || `OpenCode Agent: ${agent.name}`,
        })
      }
    }
  }
  catch (e) {
    console.error('Failed to fetch OpenCode models/agents:', e)
  }

  return models
}

export const providerOpenCode = defineProvider<OpenCodeConfig>({
  id: 'opencode',
  order: 3,
  name: 'OpenCode',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.opencode.title'),
  description: 'opencode.ai',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.opencode.description'),
  tasks: ['chat'],
  icon: 'i-lobe-icons:opencode',
  disableChatPingCheckUI: true,

  createProviderConfig: ({ t }) => opencodeConfigSchema.extend({
    apiKey: opencodeConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: 'OPENCODE_SERVER_PASSWORD. Leave empty if no password is set.',
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: opencodeConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: 'OpenCode server URL (e.g. http://localhost:4096)',
      placeholderLocalized: 'http://localhost:4096',
    }),
  }),
  createProvider(config) {
    return merge(
      createOpenCodeChatProvider(config.apiKey ?? '', config.baseUrl ?? 'http://localhost:4096'),
      createModelProvider({ apiKey: config.apiKey, baseURL: config.baseUrl ?? 'http://localhost:4096' }),
    )
  },
  extraMethods: {
    listModels: async config => fetchOpenCodeModels(config),
  },
  validationRequiredWhen() {
    return true
  },
  validators: {
    validateConfig: [
      ({ t }) => ({
        id: 'opencode:check-config',
        name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-config.title'),
        validator: async (config) => {
          const errors: Array<{ error: unknown }> = []
          const baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

          if (!baseUrl) {
            errors.push({ error: new Error('Base URL is required.') })
          }
          else {
            try {
              const parsed = new URL(baseUrl)
              if (!parsed.host)
                errors.push({ error: new Error('Base URL is not absolute.') })
            }
            catch {
              errors.push({ error: new Error('Base URL is invalid. It must be an absolute URL.') })
            }
          }

          return {
            errors,
            reason: errors.length > 0 ? errors.map(item => (item.error as Error).message).join(', ') : '',
            reasonKey: '',
            valid: errors.length === 0,
          }
        },
      }),
    ],
    validateProvider: [
      ({ t }) => ({
        id: 'opencode:check-connectivity',
        name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-connectivity.title'),
        validator: async (config) => {
          const errors: Array<{ error: unknown }> = []
          const baseUrl = String(config.baseUrl ?? '')
          const apiKey = String(config.apiKey ?? '')

          try {
            const headers: Record<string, string> = {}
            if (apiKey) {
              headers.Authorization = `Basic ${btoa(`opencode:${apiKey}`)}`
            }
            const res = await globalThis.fetch(`${baseUrl}/global/health`, { headers })
            if (!res.ok) {
              errors.push({ error: new Error(`OpenCode server returned HTTP ${res.status}: ${res.statusText}`) })
            }
          }
          catch (e) {
            errors.push({ error: new Error(`Failed to reach OpenCode server: ${errorMessageFrom(e) || 'Unknown error'}`) })
          }

          return {
            errors,
            reason: errors.length > 0 ? errors.map(item => (item.error as Error).message).join(', ') : '',
            reasonKey: '',
            valid: errors.length === 0,
          }
        },
      }),
    ],
  },
})
