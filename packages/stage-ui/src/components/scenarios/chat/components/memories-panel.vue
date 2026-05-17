<script setup lang="ts">
import type { MemoryEntry } from '../../../../stores/chat/memory-store'

import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMemoryStore } from '../../../../stores/chat/memory-store'
import { useMemoryLongTermStore } from '../../../../stores/modules/memory-long-term'
import { useMemoryShortTermStore } from '../../../../stores/modules/memory-short-term'

const showDialog = defineModel({ type: Boolean, default: false, required: false })

const { t } = useI18n()

const memoryStore = useMemoryStore()
useMemoryShortTermStore()
useMemoryLongTermStore()
const { shortTermMemories, longTermMemories, extracting } = storeToRefs(memoryStore)

const activeTab = ref<'short-term' | 'long-term'>('short-term')
const searchQuery = ref('')

const filteredShortTerm = computed(() => {
  if (!searchQuery.value)
    return shortTermMemories.value
  const q = searchQuery.value.toLowerCase()
  return shortTermMemories.value.filter((m: MemoryEntry) => m.content.toLowerCase().includes(q))
})

const filteredLongTerm = computed(() => {
  if (!searchQuery.value)
    return longTermMemories.value
  const q = searchQuery.value.toLowerCase()
  return longTermMemories.value.filter((m: MemoryEntry) => m.content.toLowerCase().includes(q))
})

const currentItems = computed(() => {
  return activeTab.value === 'short-term' ? filteredShortTerm.value : filteredLongTerm.value
})

function handleDelete(id: string) {
  memoryStore.removeMemory(id)
}

function handlePromote(memory: MemoryEntry) {
  memoryStore.addMemory(memory.content, 'long-term', memory.importance, memory.sourceMessageId)
  memoryStore.removeMemory(memory.id)
}

function handleDemote(memory: MemoryEntry) {
  memoryStore.addMemory(memory.content, 'short-term', memory.importance, memory.sourceMessageId)
  memoryStore.removeMemory(memory.id)
}

function handleClearAll() {
  memoryStore.clearMemories(activeTab.value)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000)
    return t('stage.chat.memory.justNow')
  if (diff < 3600000)
    return t('stage.chat.memory.minutesAgo', { n: Math.floor(diff / 60000) })
  if (diff < 86400000)
    return t('stage.chat.memory.hoursAgo', { n: Math.floor(diff / 3600000) })
  return d.toLocaleDateString()
}

function importanceColor(n: number) {
  if (n >= 8)
    return 'text-red-400'
  if (n >= 5)
    return 'text-yellow-400'
  return 'text-gray-400'
}
</script>

<template>
  <div v-if="showDialog" :class="['fixed inset-0 z-50 flex']" @click.self="showDialog = false">
    <div :class="['absolute inset-0 bg-black/50']" @click="showDialog = false" />
    <div
      :class="['ml-auto h-full w-96 max-w-[90vw] bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-xl flex flex-col overflow-hidden']"
    >
      <div :class="['flex items-center justify-between p-4 border-b border-[var(--border-color)]']">
        <div :class="['flex gap-2 items-center']">
          <button
            :class="[activeTab === 'short-term' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)]', 'px-2 py-1 text-sm font-medium transition-colors']"
            @click="activeTab = 'short-term'"
          >
            {{ t('settings.pages.modules.memory-short-term.title') }}
          </button>
          <button
            :class="[activeTab === 'long-term' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)]', 'px-2 py-1 text-sm font-medium transition-colors']"
            @click="activeTab = 'long-term'"
          >
            {{ t('settings.pages.modules.memory-long-term.title') }}
          </button>
        </div>
        <div :class="['flex gap-2 items-center']">
          <span
            v-if="extracting"
            :class="['text-xs opacity-50 animate-pulse']"
          >
            {{ t('stage.chat.memory.extracting') }}
          </span>
          <button
            :class="['text-xs opacity-40 hover:opacity-80 transition-opacity']"
            @click="handleClearAll"
          >
            {{ t('stage.chat.memory.clear') }}
          </button>
          <button
            :class="['text-lg leading-none opacity-40 hover:opacity-80 transition-opacity']"
            @click="showDialog = false"
          >
            x
          </button>
        </div>
      </div>

      <div :class="['p-3 border-b border-[var(--border-color)]']">
        <input
          v-model="searchQuery"
          :class="['w-full px-3 py-1.5 text-sm rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] outline-none focus:border-[var(--accent)] transition-colors']"
          :placeholder="t('stage.chat.memory.searchPlaceholder')"
        >
      </div>

      <div :class="['flex-1 overflow-y-auto p-3 space-y-2']">
        <div
          v-for="item in currentItems"
          :key="item.id"
          :class="['rounded-lg border border-[var(--border-color)] p-3 space-y-1.5 hover:bg-[var(--bg-secondary)] transition-colors']"
        >
          <div :class="['flex items-start justify-between gap-2']">
            <p :class="['text-sm flex-1 leading-relaxed whitespace-pre-wrap']">
              {{ item.content }}
            </p>
            <span :class="[importanceColor(item.importance), 'text-xs font-bold shrink-0']">{{ item.importance }}</span>
          </div>
          <div :class="['flex items-center justify-between text-xs opacity-50']">
            <span>{{ formatDate(item.createdAt) }}</span>
            <div :class="['flex gap-2']">
              <button
                v-if="item.type === 'short-term'"
                :class="['hover:text-yellow-400 transition-colors']"
                :title="t('stage.chat.memory.promote')"
                @click="handlePromote(item)"
              >
                {{ t('stage.chat.memory.promote') }}
              </button>
              <button
                v-if="item.type === 'long-term'"
                :class="['hover:text-blue-400 transition-colors']"
                :title="t('stage.chat.memory.demote')"
                @click="handleDemote(item)"
              >
                {{ t('stage.chat.memory.demote') }}
              </button>
              <button
                :class="['hover:text-red-400 transition-colors']"
                :title="t('stage.chat.memory.delete')"
                @click="handleDelete(item.id)"
              >
                {{ t('stage.chat.memory.delete') }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="!currentItems.length && !extracting" :class="['text-sm opacity-40 text-center py-8']">
          {{ activeTab === 'short-term' ? t('stage.chat.memory.noShortTerm') : t('stage.chat.memory.noLongTerm') }}
        </div>
      </div>
    </div>
  </div>
</template>
