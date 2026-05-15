import type { ChatProvider } from '@xsai-ext/providers/utils'

import { useLocalStorageManualReset } from '@proj-nova/stage-shared/composables'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useChatOrchestratorStore } from '../chat'
import { useConfiguratorByModsChannelServer } from '../configurator'
import { useProvidersStore } from '../providers'
import { useConsciousnessStore } from './consciousness'

export interface TwitchChatMessage {
  id: string
  username: string
  displayName: string
  message: string
  badges: string[]
  bits: number
  isSubscriber: boolean
  isMod: boolean
  isVip: boolean
  color: string
}

export const useTwitchStore = defineStore('twitch', () => {
  const configurator = useConfiguratorByModsChannelServer()
  const enabled = useLocalStorageManualReset<boolean>('settings/twitch/enabled', false)
  const channel = useLocalStorageManualReset<string>('settings/twitch/channel', '')
  const filterSubsOnly = useLocalStorageManualReset<boolean>('settings/twitch/filter-subs-only', false)
  const filterBitsOnly = useLocalStorageManualReset<boolean>('settings/twitch/filter-bits-only', false)
  const minBits = useLocalStorageManualReset<number>('settings/twitch/min-bits', 0)

  const chatOrchestrator = useChatOrchestratorStore()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)

  const MAX_MESSAGES = 500
  const ws = shallowRef<WebSocket | null>(null)
  const connected = ref(false)
  const messages = shallowRef<TwitchChatMessage[]>([])

  let initialized = false

  function parseIrcMessage(line: string) {
    const msg: Partial<TwitchChatMessage> = {
      id: crypto.randomUUID(),
      username: 'unknown',
      displayName: 'unknown',
      message: '',
      badges: [],
      bits: 0,
      isSubscriber: false,
      isMod: false,
      isVip: false,
      color: '',
    }

    let rest = line

    // Tags (IRCv3)
    if (rest.startsWith('@')) {
      const tagsEnd = rest.indexOf(' ')
      if (tagsEnd === -1)
        return null

      const tagsStr = rest.slice(1, tagsEnd)
      rest = rest.slice(tagsEnd + 1)

      const tags: Record<string, string> = {}
      for (const tag of tagsStr.split(';')) {
        const eqIdx = tag.indexOf('=')
        if (eqIdx !== -1)
          tags[tag.slice(0, eqIdx)] = tag.slice(eqIdx + 1)
      }

      const displayName = tags['display-name']
      msg.displayName = displayName || msg.username
      msg.color = tags.color || ''
      msg.bits = tags.bits ? Number(tags.bits) : 0

      if (tags.badges) {
        msg.badges = tags.badges.split(',').map(b => b.split('/')[0])
        msg.isSubscriber = msg.badges.includes('subscriber') || msg.badges.includes('founder')
        msg.isMod = msg.badges.includes('moderator')
        msg.isVip = msg.badges.includes('vip')
      }
    }

    // PRIVMSG
    const privmsgMatch = rest.match(/^:[^!]+!([^@]+)@[^ ]+ PRIVMSG #[^ ]+ :(.+)$/)
    if (!privmsgMatch)
      return null

    msg.username = privmsgMatch[1]
    msg.message = privmsgMatch[2]

    if (!msg.displayName)
      msg.displayName = msg.username

    return msg as TwitchChatMessage
  }

  async function ingestTwitchMessage(msg: TwitchChatMessage) {
    if (!enabled.value || !activeProvider.value || !activeModel.value)
      return

    // Apply filters
    if (filterSubsOnly.value && !msg.isSubscriber)
      return
    if (filterBitsOnly.value && msg.bits === 0)
      return
    if (minBits.value > 0 && msg.bits < minBits.value)
      return

    let chatProvider: ChatProvider
    try {
      chatProvider = await providersStore.getProviderInstance<ChatProvider>(activeProvider.value)
    }
    catch {
      return
    }

    void chatOrchestrator.ingest(
      `(From Twitch user ${msg.displayName}): ${msg.message}`,
      {
        model: activeModel.value,
        chatProvider,
      },
    )
  }

  function connect() {
    disconnect()
    const channelName = channel.value.trim().toLowerCase()
    if (!channelName || !enabled.value)
      return

    const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
    ws.value = socket

    socket.onopen = () => {
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      socket.send('NICK justinfan12345')
      socket.send(`JOIN #${channelName}`)
      connected.value = true
    }

    socket.onmessage = (event) => {
      const lines = event.data.split('\r\n').filter(Boolean)
      for (const line of lines) {
        // Handle PING
        if (line === 'PING :tmi.twitch.tv') {
          socket.send('PONG :tmi.twitch.tv')
          continue
        }

        if (line.includes('PRIVMSG')) {
          const parsed = parseIrcMessage(line)
          if (parsed) {
            messages.value = [...messages.value.slice(-(MAX_MESSAGES - 1)), parsed]
            void ingestTwitchMessage(parsed)
          }
        }
      }
    }

    socket.onclose = () => {
      connected.value = false
      ws.value = null
    }

    socket.onerror = () => {
      connected.value = false
      ws.value = null
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    connected.value = false
  }

  function saveSettings() {
    configurator.updateFor('twitch', {
      channel: channel.value,
      enabled: enabled.value,
    })
    // Reconnect if enabled/channel changed
    if (initialized) {
      connect()
    }
  }

  const configured = computed(() => {
    return !!channel.value.trim()
  })

  function resetState() {
    enabled.reset()
    channel.reset()
    filterSubsOnly.reset()
    filterBitsOnly.reset()
    minBits.reset()
    saveSettings()
  }

  async function initialize() {
    if (initialized)
      return
    initialized = true

    // Use Web Locks API to ensure only one window/instance is the active Twitch listener.
    // This prevents duplicated connections and message ingestion when multiple windows/tabs are open.
    if (typeof navigator !== 'undefined' && 'locks' in navigator && typeof navigator.locks.request === 'function') {
      void navigator.locks.request('airi:twitch:listener-lock', async () => {
        const setup = () => {
          if (enabled.value && channel.value) {
            connect()
          }
          else {
            disconnect()
          }
        }

        setup()

        void watch([enabled, channel], setup)

        // Keep the lock held as long as the window/process is alive.
        // When the window is closed, the lock is automatically released.
        return new Promise<void>(() => {
          // No-op, just keep the promise pending
        })
      })
    }
    else {
      // Fallback for environments without Web Locks (shouldn't happen in modern browsers/Electron)
      if (enabled.value && channel.value) {
        connect()
      }

      watch([enabled, channel], () => {
        if (enabled.value && channel.value) {
          connect()
        }
        else {
          disconnect()
        }
      })
    }
  }

  return {
    enabled,
    channel,
    filterSubsOnly,
    filterBitsOnly,
    minBits,
    configured,
    connected,
    messages,
    saveSettings,
    resetState,
    initialize,
    connect,
    disconnect,
  }
})
