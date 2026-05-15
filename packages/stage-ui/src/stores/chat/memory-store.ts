import type { UserMessage } from '@xsai/shared-chat'

import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import { storage } from '../../database/storage'

const STORAGE_KEY = 'local:memories'

const DEFAULT_MAX_SHORT_TERM = 10
const DEFAULT_MAX_LONG_TERM = 50
const DEFAULT_TOKEN_BUDGET = 1500
const AVG_TOKENS_PER_CHAR = 0.25

export interface MemoryEntry {
  id: string
  content: string
  type: 'short-term' | 'long-term'
  importance: number
  createdAt: number
  sourceMessageId?: string
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length * AVG_TOKENS_PER_CHAR)
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useMemoryStore = defineStore('memory', () => {
  const entries = ref<MemoryEntry[]>([])
  const loaded = ref(false)

  const shortTermMemories = computed(() =>
    entries.value.filter(e => e.type === 'short-term').sort((a, b) => b.createdAt - a.createdAt),
  )
  const longTermMemories = computed(() =>
    entries.value.filter(e => e.type === 'long-term').sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt),
  )

  const shortTermCount = computed(() => shortTermMemories.value.length)
  const longTermCount = computed(() => longTermMemories.value.length)

  const totalTokenEstimate = computed(() => {
    return entries.value.reduce((sum, e) => sum + estimateTokens(e.content), 0)
  })

  async function load() {
    if (loaded.value)
      return

    const raw = await storage.getItem<string>(STORAGE_KEY)
    if (raw) {
      try {
        entries.value = JSON.parse(raw)
      }
      catch {
        entries.value = []
      }
    }
    loaded.value = true
  }

  async function persist() {
    await storage.setItem(STORAGE_KEY, JSON.stringify(toRaw(entries.value)))
  }

  watch(entries, persist, { deep: true })

  function addMemory(
    content: string,
    type: 'short-term' | 'long-term',
    importance = 5,
    sourceMessageId?: string,
  ) {
    const entry: MemoryEntry = {
      id: generateId(),
      content,
      type,
      importance,
      createdAt: Date.now(),
      sourceMessageId,
    }
    entries.value.push(entry)
    prune(type)
  }

  function removeMemory(id: string) {
    entries.value = entries.value.filter(e => e.id !== id)
  }

  function clearMemories(type?: 'short-term' | 'long-term') {
    if (type) {
      entries.value = entries.value.filter(e => e.type !== type)
    }
    else {
      entries.value = []
    }
  }

  function prune(type: 'short-term' | 'long-term') {
    const max = type === 'short-term' ? DEFAULT_MAX_SHORT_TERM : DEFAULT_MAX_LONG_TERM
    const sameType = entries.value.filter(e => e.type === type)
    if (sameType.length <= max)
      return

    sameType.sort((a, b) => {
      if (a.type === 'long-term') {
        return a.importance - b.importance || a.createdAt - b.createdAt
      }
      return a.createdAt - b.createdAt
    })

    const toRemove = sameType.slice(0, sameType.length - max)
    const removeIds = new Set(toRemove.map(e => e.id))
    entries.value = entries.value.filter(e => !removeIds.has(e.id))
  }

  function formatMemoryContext(tokenBudget = DEFAULT_TOKEN_BUDGET): string {
    let budget = tokenBudget
    const parts: string[] = []

    const shortTerm = shortTermMemories.value
    const shortTermBlock: string[] = []
    for (const mem of shortTerm) {
      const tokens = estimateTokens(mem.content)
      if (tokens > budget)
        break

      shortTermBlock.push(mem.content)
      budget -= tokens
    }
    if (shortTermBlock.length > 0) {
      parts.push('[Recent Memory]', ...shortTermBlock.map(l => `- ${l}`))
    }

    const longTerm = longTermMemories.value
    const longTermBlock: string[] = []
    for (const mem of longTerm) {
      const tokens = estimateTokens(mem.content)
      if (tokens > budget)
        break
      longTermBlock.push(mem.content)
      budget -= tokens
    }
    if (longTermBlock.length > 0) {
      parts.push('[Facts]', ...longTermBlock.map(l => `- ${l}`))
    }

    return parts.join('\n')
  }

  function buildMemoryContextMessage(tokenBudget?: number): UserMessage | null {
    const text = formatMemoryContext(tokenBudget)
    if (!text)
      return null
    return {
      role: 'user',
      content: [{ type: 'text', text }],
    }
  }

  async function extractFromMessages(messages: Array<{ role: string, content: string }>) {
    const recent = messages.slice(-4)
    const userMessages = recent.filter(m => m.role === 'user').map(m => m.content).join(' ')
    const assistantMessages = recent.filter(m => m.role === 'assistant').map(m => m.content).join(' ')

    if (!userMessages.trim() && !assistantMessages.trim())
      return

    const summary = `User: ${userMessages.slice(0, 200)} | Assistant: ${assistantMessages.slice(0, 200)}`
    if (summary.length > 20) {
      addMemory(summary, 'short-term', 5)
    }
  }

  return {
    entries,
    loaded,
    shortTermMemories,
    longTermMemories,
    shortTermCount,
    longTermCount,
    totalTokenEstimate,
    load,
    addMemory,
    removeMemory,
    clearMemories,
    formatMemoryContext,
    buildMemoryContextMessage,
    extractFromMessages,
  }
})
