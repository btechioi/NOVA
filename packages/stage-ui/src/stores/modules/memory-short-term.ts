import { useLocalStorageManualReset } from '@proj-nova/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useMemoryShortTermStore = defineStore('memory-short-term', () => {
  const maxEntries = useLocalStorageManualReset<number>('settings/memory-short-term/max-entries', 10)
  const enabled = useLocalStorageManualReset<boolean>('settings/memory-short-term/enabled', true)
  const autoExtract = useLocalStorageManualReset<boolean>('settings/memory-short-term/auto-extract', true)

  const configured = computed(() => true)

  function resetState() {
    maxEntries.reset()
    enabled.reset()
    autoExtract.reset()
  }

  return {
    configured,
    maxEntries,
    enabled,
    autoExtract,
    resetState,
  }
})
