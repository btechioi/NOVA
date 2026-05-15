<script setup lang="ts">
import { useMemoryShortTermStore } from '@proj-nova/stage-ui/stores/modules/memory-short-term'
import { Button, FieldCheckbox, FieldRange } from '@proj-nova/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useMemoryShortTermStore()

const tokenEstimate = computed(() => {
  const entries = store.maxEntries
  const avgTokensPerEntry = 75
  return entries * avgTokensPerEntry
})
</script>

<template>
  <div :class="['flex flex-col gap-6 p-6']">
    <h1 :class="['text-2xl font-bold']">
      {{ t('settings.pages.modules.memory-short-term.title') }}
    </h1>
    <p :class="['text-sm opacity-60']">
      {{ t('settings.pages.modules.memory-short-term.description') }}
    </p>

    <FieldCheckbox
      v-model="store.enabled"
      :label="t('settings.pages.modules.memory-short-term.enable')"
      :description="t('settings.pages.modules.memory-short-term.enable-description')"
    />

    <FieldCheckbox
      v-model="store.autoExtract"
      :label="t('settings.pages.modules.memory-short-term.auto-extract')"
      :description="t('settings.pages.modules.memory-short-term.auto-extract-description')"
    />

    <FieldRange
      v-model="store.maxEntries"
      :min="1"
      :max="50"
      :step="1"
      :label="t('settings.pages.modules.memory-short-term.max-entries')"
      :description="t('settings.pages.modules.memory-short-term.max-entries-description')"
      :format-value="(v: number) => `${v}`"
    />

    <p :class="['text-xs opacity-40']">
      ~{{ tokenEstimate }} tokens max in context
    </p>

    <div :class="['flex gap-2']">
      <Button
        variant="secondary"
        :label="t('settings.pages.modules.memory-short-term.reset-defaults')"
        @click="store.resetState"
      />
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.memory-short-term.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
