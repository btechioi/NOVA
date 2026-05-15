<script setup lang="ts">
import type { EdgeTTSExtraOptions } from '@proj-nova/stage-ui/stores/providers/edge-tts'
import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-nova/stage-ui/components'
import { useSpeechStore } from '@proj-nova/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-nova/stage-ui/stores/providers'
import { FieldInput } from '@proj-nova/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const providerId = 'edge-tts'
const defaultModel = 'edge-tts'

const defaultVoiceSettings = {
  pitch: '+0Hz',
  rate: '+0%',
  volume: '+0%',
}

const pitch = ref<string>('+0Hz')
const rate = ref<string>('+0%')
const volume = ref<string>('+0%')

const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)
const { t } = useI18n()

// Edge TTS does not require an API key
const apiKeyConfigured = computed(() => true)

const availableVoices = computed(() => {
  return speechStore.availableVoices[providerId] || []
})

async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  const provider = await providersStore.getProviderInstance(providerId) as SpeechProviderWithExtraOptions<string, EdgeTTSExtraOptions>
  if (!provider) {
    throw new Error('Failed to initialize speech provider')
  }

  const providerConfig = providersStore.getProviderConfig(providerId)
  const model = voiceId || 'en-US-AriaNeural'

  return await speechStore.speech(
    provider,
    model,
    input,
    voiceId,
    {
      ...defaultVoiceSettings,
      ...providerConfig,
    },
  )
}

onMounted(async () => {
  const providerConfig = providersStore.getProviderConfig(providerId)
  const providerMetadata = providersStore.getProviderMetadata(providerId)
  if (await providerMetadata.validators.validateProviderConfig(providerConfig)) {
    await speechStore.loadVoicesForProvider(providerId)
  }
})

watch(pitch, async () => {
  const providerConfig = providersStore.getProviderConfig(providerId)
  providerConfig.pitch = pitch.value
})

watch(rate, async () => {
  const providerConfig = providersStore.getProviderConfig(providerId)
  providerConfig.rate = rate.value
})

watch(volume, async () => {
  const providerConfig = providersStore.getProviderConfig(providerId)
  providerConfig.volume = volume.value
})

watch(providers, async () => {
  const providerConfig = providersStore.getProviderConfig(providerId)
  const providerMetadata = providersStore.getProviderMetadata(providerId)
  if (await providerMetadata.validators.validateProviderConfig(providerConfig)) {
    await speechStore.loadVoicesForProvider(providerId)
  }
}, {
  immediate: true,
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
  >
    <template #voice-settings>
      <div flex="~ col gap-4">
        <FieldInput
          v-model="pitch"
          :label="t('settings.pages.providers.provider.edge-tts.fields.field.pitch.label', 'Pitch')"
          :description="t('settings.pages.providers.provider.edge-tts.fields.field.pitch.description', 'Voice pitch adjustment (e.g., +0Hz, +10Hz, -10Hz)')"
          placeholder="+0Hz"
        />

        <FieldInput
          v-model="rate"
          :label="t('settings.pages.providers.provider.edge-tts.fields.field.rate.label', 'Rate')"
          :description="t('settings.pages.providers.provider.edge-tts.fields.field.rate.description', 'Speech speed (e.g., +0%, +20%, -20%)')"
          placeholder="+0%"
        />

        <FieldInput
          v-model="volume"
          :label="t('settings.pages.providers.provider.edge-tts.fields.field.volume.label', 'Volume')"
          :description="t('settings.pages.providers.provider.edge-tts.fields.field.volume.description', 'Volume (e.g., +0%, +50%, -50%)')"
          placeholder="+0%"
        />
      </div>
    </template>

    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="apiKeyConfigured"
        default-text="Hello! This is a test of the Microsoft Edge TTS provider."
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
