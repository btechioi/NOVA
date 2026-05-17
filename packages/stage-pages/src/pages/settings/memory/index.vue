<script setup lang="ts">
import type { MemoryEntry } from '@proj-nova/stage-ui/stores/chat/memory-store'

import { useMemoryStore } from '@proj-nova/stage-ui/stores/chat/memory-store'
import { useMemoryLongTermStore } from '@proj-nova/stage-ui/stores/modules/memory-long-term'
import { useMemoryShortTermStore } from '@proj-nova/stage-ui/stores/modules/memory-short-term'
import { Button, FieldCheckbox, FieldRange } from '@proj-nova/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const memoryStore = useMemoryStore()
const shortTermStore = useMemoryShortTermStore()
const longTermStore = useMemoryLongTermStore()
const { shortTermMemories, longTermMemories } = storeToRefs(memoryStore)

const activeTab = ref<'short-term' | 'long-term'>('short-term')

const currentMemories = computed(() => {
  return activeTab.value === 'short-term' ? shortTermMemories.value : longTermMemories.value
})

const shortTermTokens = computed(() => {
  return shortTermStore.maxEntries * 75
})

const longTermTokens = computed(() => {
  return longTermStore.maxEntries * 30
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  <div :class="['flex flex-col gap-6 p-6']">
    <h1 :class="['text-2xl font-bold']">
      {{ t('settings.pages.memory.title') }}
    </h1>
    <p :class="['text-sm opacity-60']">
      {{ t('settings.pages.memory.description') }}
    </p>

    <div :class="['flex gap-4 border-b border-[var(--border-color)]']">
      <button
        :class="[activeTab === 'short-term' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)]', 'px-3 py-2 text-sm font-medium transition-colors']"
        @click="activeTab = 'short-term'"
      >
        {{ t('settings.pages.modules.memory-short-term.title') }}
      </button>
      <button
        :class="[activeTab === 'long-term' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)]', 'px-3 py-2 text-sm font-medium transition-colors']"
        @click="activeTab = 'long-term'"
      >
        {{ t('settings.pages.modules.memory-long-term.title') }}
      </button>
    </div>

    <!-- Configuration -->
    <div :class="['flex flex-col gap-4']">
      <FieldCheckbox
        v-if="activeTab === 'short-term'"
        v-model="shortTermStore.enabled"
        :label="t('settings.pages.modules.memory-short-term.enable')"
        :description="t('settings.pages.modules.memory-short-term.enable-description')"
      />
      <FieldCheckbox
        v-if="activeTab === 'long-term'"
        v-model="longTermStore.enabled"
        :label="t('settings.pages.modules.memory-long-term.enable')"
        :description="t('settings.pages.modules.memory-long-term.enable-description')"
      />

      <FieldCheckbox
        v-if="activeTab === 'short-term'"
        v-model="shortTermStore.autoExtract"
        :label="t('settings.pages.modules.memory-short-term.auto-extract')"
        :description="t('settings.pages.modules.memory-short-term.auto-extract-description')"
      />

      <FieldRange
        v-if="activeTab === 'short-term'"
        v-model="shortTermStore.maxEntries"
        :min="1"
        :max="50"
        :step="1"
        :label="t('settings.pages.modules.memory-short-term.max-entries')"
        :description="t('settings.pages.modules.memory-short-term.max-entries-description')"
        :format-value="(v: number) => `${v}`"
      />

      <FieldRange
        v-if="activeTab === 'long-term'"
        v-model="longTermStore.maxEntries"
        :min="1"
        :max="200"
        :step="1"
        :label="t('settings.pages.modules.memory-long-term.max-entries')"
        :description="t('settings.pages.modules.memory-long-term.max-entries-description')"
        :format-value="(v: number) => `${v}`"
      />

      <FieldRange
        v-if="activeTab === 'long-term'"
        v-model="longTermStore.importanceThreshold"
        :min="1"
        :max="10"
        :step="1"
        :label="t('settings.pages.modules.memory-long-term.importance-threshold')"
        :description="t('settings.pages.modules.memory-long-term.importance-threshold-description')"
        :format-value="(v: number) => `${v}`"
      />

      <p :class="['text-xs opacity-40']">
        ~{{ activeTab === 'short-term' ? shortTermTokens : longTermTokens }} tokens max in context
      </p>
    </div>

    <!-- Memory Entries -->
    <div :class="['flex items-center justify-between']">
      <h2 :class="['text-lg font-semibold']">
        {{ activeTab === 'short-term' ? t('settings.pages.modules.memory-short-term.title') : t('settings.pages.modules.memory-long-term.title') }}
        <span :class="['text-sm opacity-50 font-normal']">({{ currentMemories.length }})</span>
      </h2>
      <div :class="['flex gap-2']">
        <Button
          variant="secondary"
          size="sm"
          :label="t('stage.chat.memory.clear')"
          @click="handleClearAll"
        />
        <Button
          variant="secondary"
          size="sm"
          :label="t('settings.pages.modules.memory-short-term.reset-defaults')"
          @click="activeTab === 'short-term' ? shortTermStore.resetState() : longTermStore.resetState()"
        />
      </div>
    </div>

    <div :class="['flex flex-col gap-2']">
      <div
        v-for="item in currentMemories"
        :key="item.id"
        :class="['rounded-lg border border-[var(--border-color)] p-3 space-y-1']"
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
              @click="handlePromote(item)"
            >
              {{ t('stage.chat.memory.promote') }}
            </button>
            <button
              v-if="item.type === 'long-term'"
              :class="['hover:text-blue-400 transition-colors']"
              @click="handleDemote(item)"
            >
              {{ t('stage.chat.memory.demote') }}
            </button>
            <button
              :class="['hover:text-red-400 transition-colors']"
              @click="handleDelete(item.id)"
            >
              {{ t('stage.chat.memory.delete') }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="!currentMemories.length" :class="['text-sm opacity-40 text-center py-8']">
        {{ activeTab === 'short-term' ? t('stage.chat.memory.noShortTerm') : t('stage.chat.memory.noLongTerm') }}
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.memory.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.memory.description
  icon: i-solar:leaf-bold-duotone
  settingsEntry: true
  order: 5
  stageTransition:
    name: slide
</route>
