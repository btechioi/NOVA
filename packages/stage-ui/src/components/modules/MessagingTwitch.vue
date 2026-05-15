<script setup lang="ts">
import { Button, FieldCheckbox, FieldInput, FieldRange } from '@proj-nova/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTwitchStore } from '../../stores/modules/twitch'

const { t } = useI18n()
const twitchStore = useTwitchStore()
const {
  enabled,
  channel,
  filterSubsOnly,
  filterBitsOnly,
  minBits,
  configured,
  connected,
  messages,
} = storeToRefs(twitchStore)

const filteredMsgList = computed(() => {
  let msgs = messages.value

  if (filterSubsOnly.value)
    msgs = msgs.filter(m => m.isSubscriber)

  if (filterBitsOnly.value)
    msgs = msgs.filter(m => m.bits > 0)

  if (minBits.value > 0)
    msgs = msgs.filter(m => m.bits >= minBits.value)

  return msgs
})

function connect() {
  twitchStore.connect()
}

function disconnect() {
  twitchStore.disconnect()
}
</script>

<template>
  <div flex="~ col gap-6">
    <FieldCheckbox
      v-model="enabled"
      :label="t('settings.pages.modules.messaging-twitch.enable')"
      :description="t('settings.pages.modules.messaging-twitch.enable-description')"
    />

    <FieldInput
      v-model="channel"
      :label="t('settings.pages.modules.messaging-twitch.channel')"
      :description="t('settings.pages.modules.messaging-twitch.channel-description')"
      :placeholder="t('settings.pages.modules.messaging-twitch.channel-placeholder')"
    />

    <div flex="~ row gap-2">
      <template v-if="!connected">
        <Button :disabled="!channel.trim()" @click="connect">
          {{ t('settings.pages.modules.messaging-twitch.connect') }}
        </Button>
      </template>
      <template v-else>
        <Button @click="disconnect">
          {{ t('settings.pages.modules.messaging-twitch.disconnect') }}
        </Button>
        <span self-center text-sm text-green-500>
          {{ t('settings.pages.modules.messaging-twitch.connected') }}
        </span>
      </template>
    </div>

    <Button :label="t('settings.common.save')" variant="primary" @click="twitchStore.saveSettings" />

    <div v-if="configured && connected" flex="~ col gap-4">
      <h3 class="text-lg text-neutral-500 font-medium dark:text-neutral-400">
        {{ t('settings.pages.modules.messaging-twitch.filters.title') }}
      </h3>

      <div flex="~ col gap-3">
        <FieldCheckbox
          v-model="filterSubsOnly"
          :label="t('settings.pages.modules.messaging-twitch.filters.subs-only')"
          :description="t('settings.pages.modules.messaging-twitch.filters.subs-only-description')"
        />

        <FieldCheckbox
          v-model="filterBitsOnly"
          :label="t('settings.pages.modules.messaging-twitch.filters.bits-only')"
          :description="t('settings.pages.modules.messaging-twitch.filters.bits-only-description')"
        />

        <FieldRange
          v-model="minBits"
          :label="t('settings.pages.modules.messaging-twitch.filters.min-bits')"
          :description="t('settings.pages.modules.messaging-twitch.filters.min-bits-description')"
          :min="0"
          :max="10000"
          :step="1"
          :format-value="v => String(v)"
        />
      </div>
    </div>

    <div v-if="configured" class="mt-4 rounded-lg bg-green-100 p-4 text-green-800">
      {{ t('settings.pages.modules.messaging-twitch.configured') }}
    </div>

    <template v-if="connected">
      <h3 class="text-lg text-neutral-500 font-medium dark:text-neutral-400">
        {{ t('settings.pages.modules.messaging-twitch.chat-messages') }}
        <span text-sm font-normal>({{ filteredMsgList.length }} / {{ messages.length }})</span>
      </h3>

      <div
        class="max-h-96 overflow-y-auto border border-neutral-200 rounded-xl bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div v-if="filteredMsgList.length === 0" text-sm text-neutral-400>
          {{ t('settings.pages.modules.messaging-twitch.no-messages') }}
        </div>

        <div v-for="msg in filteredMsgList" :key="msg.id" class="mb-2 text-sm leading-relaxed">
          <span
            v-for="badge in msg.badges" :key="badge"
            class="mr-1 inline-block h-4 w-4 rounded bg-neutral-300 text-center align-middle text-[10px] leading-4 dark:bg-neutral-600"
          >{{ badge[0] }}</span>
          <span
            :style="msg.color ? { color: msg.color } : {}"
            class="mr-1 font-semibold"
          >{{ msg.displayName }}</span>
          <span v-if="msg.bits > 0" class="mr-1 text-amber-500">{{ msg.bits }} bits</span>
          <span>{{ msg.message }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
