import { useLocalStorageManualReset } from '@proj-nova/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useMemoryLongTermStore = defineStore('memory-long-term', () => {
  const maxEntries = useLocalStorageManualReset<number>('settings/memory-long-term/max-entries', 50)
  const importanceThreshold = useLocalStorageManualReset<number>('settings/memory-long-term/importance-threshold', 3)
  const enabled = useLocalStorageManualReset<boolean>('settings/memory-long-term/enabled', true)

  const configured = computed(() => true)

  function resetState() {
    maxEntries.reset()
    importanceThreshold.reset()
    enabled.reset()
  }

  return {
    configured,
    maxEntries,
    importanceThreshold,
    enabled,
    resetState,
  }
})
