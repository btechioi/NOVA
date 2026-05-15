import type { AnalyserWorkletParameters, BeatSyncSpectrumScale } from '@proj-nova/stage-shared/beat-sync'

import { DEFAULT_BEAT_SYNC_PARAMETERS } from '@proj-nova/stage-shared/beat-sync'
import { useLocalStorageManualReset } from '@proj-nova/stage-shared/composables'
import { defineStore } from 'pinia'

export const useSettingsBeatSync = defineStore('settings-beat-sync', () => {
  const parameters = useLocalStorageManualReset<AnalyserWorkletParameters>(
    'settings/beat-sync/parameters',
    { ...DEFAULT_BEAT_SYNC_PARAMETERS },
  )
  const spectrumScale = useLocalStorageManualReset<BeatSyncSpectrumScale>(
    'settings/beat-sync/spectrum-scale',
    'logarithm',
  )

  function resetState() {
    parameters.value = { ...DEFAULT_BEAT_SYNC_PARAMETERS }
    spectrumScale.value = 'logarithm'
  }

  return {
    parameters,
    spectrumScale,
    resetState,
  }
})
