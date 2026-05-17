import type { ChatProvider } from '@xsai-ext/providers/utils'

import { generateText } from '@xsai/generate-text'

/**
 * Result of compressing a conversation block into short-term memory.
 */
export interface MemoryCompressionResult {
  /** 1-2 sentence overview of the conversation */
  summary: string
  /** Concise bullet points capturing important details, preferences, facts */
  keyPoints: string[]
}

/**
 * A fact extracted from conversation with importance scoring.
 */
export interface ExtractedFact {
  /** The factual content */
  content: string
  /** Importance score 1-10 (10 = most important) */
  importance: number
  /** Why this fact was deemed important */
  reasoning: string
}

export interface MemoryServiceOptions {
  chatProvider: ChatProvider
  model: string
}

const COMPRESS_SYSTEM_PROMPT = `You are a conversation memory compression system. Extract key information from the conversation below. Return a JSON object with "summary" (a 1-2 sentence overview) and "keyPoints" (an array of 3-5 concise bullet points capturing important details, preferences, facts, and context). Keep the summary and key points brief and factual.`

const EXTRACT_SYSTEM_PROMPT = `Extract important facts, preferences, personal information, and key details from the conversation. Return a JSON array of objects with "content" (the fact), "importance" (1-10 integer), and "reasoning" (why this is important). Only include truly important information that would be useful to remember across conversations. Return [] if nothing important is found.`

const SCORE_SYSTEM_PROMPT = `Rate the importance of the following memory on a scale of 1-10. Consider: Is this a personal fact? Would it be useful in future conversations? Is it time-sensitive? Return only a number.`

/**
 * Creates an LLM-powered memory service that works with any AI provider.
 *
 * Use when:
 * - Compressing conversation history into short-term memory entries
 * - Extracting important facts for long-term memory storage
 * - Scoring memory importance for pruning decisions
 *
 * Works with any AI provider through the xsAI ChatProvider interface,
 * making the memory system provider-agnostic.
 *
 * Expects:
 * - chatProvider must be a valid xsAI ChatProvider instance
 * - model must be a model identifier the provider supports
 *
 * Returns:
 * - An object with compressConversation, extractImportantFacts, and scoreImportance methods
 */
export function createMemoryService(options: MemoryServiceOptions) {
  const { chatProvider, model } = options

  async function generateJson<T>(systemPrompt: string, userContent: string): Promise<T | null> {
    try {
      const { text } = await generateText({
        ...chatProvider.chat(model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      })

      const cleaned = text.replace(/```(?:json)?\s*/g, '').trim()
      return JSON.parse(cleaned) as T
    }
    catch {
      return null
    }
  }

  async function compressConversation(
    messages: Array<{ role: string, content: string }>,
  ): Promise<MemoryCompressionResult> {
    const conversationText = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n')

    const result = await generateJson<{ summary?: string, keyPoints?: string[] }>(
      COMPRESS_SYSTEM_PROMPT,
      `Compress this conversation:\n\n${conversationText}`,
    )

    if (result && result.summary) {
      return {
        summary: result.summary,
        keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
      }
    }

    return { summary: '', keyPoints: [] }
  }

  async function extractImportantFacts(
    messages: Array<{ role: string, content: string }>,
  ): Promise<ExtractedFact[]> {
    const conversationText = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n')

    const result = await generateJson<ExtractedFact[] | { facts: ExtractedFact[] }>(
      EXTRACT_SYSTEM_PROMPT,
      `Extract important facts:\n\n${conversationText}`,
    )

    if (!result)
      return []

    const facts = Array.isArray(result)
      ? result
      : (result as { facts: ExtractedFact[] }).facts ?? []

    return facts
      .map(f => ({
        content: f.content ?? '',
        importance: Math.max(1, Math.min(10, f.importance ?? 5)),
        reasoning: f.reasoning ?? '',
      }))
      .filter(f => f.content.length > 0)
  }

  async function scoreImportance(content: string): Promise<number> {
    const result = await generateJson<{ score?: number } | number>(
      SCORE_SYSTEM_PROMPT,
      content,
    )

    if (result === null)
      return 5

    const score = typeof result === 'number'
      ? result
      : (result as { score?: number }).score ?? 5

    return Math.max(1, Math.min(10, Number(score)))
  }

  return {
    compressConversation,
    extractImportantFacts,
    scoreImportance,
  }
}

export type MemoryService = ReturnType<typeof createMemoryService>
