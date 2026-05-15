import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import { v4 as uuidv4 } from 'uuid'

export interface EdgeTTSExtraOptions {
  pitch?: string
  rate?: string
  volume?: string
}

export const EDGE_TTS_VOICES = [
  { id: 'en-US-AriaNeural', name: 'Aria (en-US, Female)', gender: 'Female', lang: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy (en-US, Male)', gender: 'Male', lang: 'en-US' },
  { id: 'en-US-JennyNeural', name: 'Jenny (en-US, Female)', gender: 'Female', lang: 'en-US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (en-GB, Female)', gender: 'Female', lang: 'en-GB' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (en-GB, Male)', gender: 'Male', lang: 'en-GB' },
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao (zh-CN, Female)', gender: 'Female', lang: 'zh-CN' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi (zh-CN, Male)', gender: 'Male', lang: 'zh-CN' },
  { id: 'zh-CN-YunjianNeural', name: 'Yunjian (zh-CN, Male)', gender: 'Male', lang: 'zh-CN' },
  { id: 'ja-JP-NanamiNeural', name: 'Nanami (ja-JP, Female)', gender: 'Female', lang: 'ja-JP' },
  { id: 'ja-JP-KeitaNeural', name: 'Keita (ja-JP, Male)', gender: 'Male', lang: 'ja-JP' },
  { id: 'ko-KR-SunHiNeural', name: 'SunHi (ko-KR, Female)', gender: 'Female', lang: 'ko-KR' },
  { id: 'ko-KR-InJoonNeural', name: 'InJoon (ko-KR, Male)', gender: 'Male', lang: 'ko-KR' },
  { id: 'fr-FR-DeniseNeural', name: 'Denise (fr-FR, Female)', gender: 'Female', lang: 'fr-FR' },
  { id: 'fr-FR-HenriNeural', name: 'Henri (fr-FR, Male)', gender: 'Male', lang: 'fr-FR' },
  { id: 'de-DE-KatjaNeural', name: 'Katja (de-DE, Female)', gender: 'Female', lang: 'de-DE' },
  { id: 'de-DE-ConradNeural', name: 'Conrad (de-DE, Male)', gender: 'Male', lang: 'de-DE' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira (es-ES, Female)', gender: 'Female', lang: 'es-ES' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro (es-ES, Male)', gender: 'Male', lang: 'es-ES' },
  { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana (ru-RU, Female)', gender: 'Female', lang: 'ru-RU' },
  { id: 'ru-RU-DmitryNeural', name: 'Dmitry (ru-RU, Male)', gender: 'Male', lang: 'ru-RU' },
]

function createTimestamp(): string {
  const d = new Date()
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const date = String(d.getUTCDate()).padStart(2, '0')
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const minutes = String(d.getUTCMinutes()).padStart(2, '0')
  const seconds = String(d.getUTCSeconds()).padStart(2, '0')
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0')
  return `${year}-${month}-${date}T${hours}:${minutes}:${seconds}.${ms}Z`
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

export function createEdgeTTSProvider(): SpeechProviderWithExtraOptions<string, EdgeTTSExtraOptions> {
  return {
    speech: (model: string, extraOptions?: EdgeTTSExtraOptions) => {
      return {
        baseURL: 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4',
        model,
        fetch: async (_request: RequestInfo | URL, init?: RequestInit) => {
          let text = ''
          if (init?.body) {
            const bodyStr = init.body.toString()
            try {
              const bodyJson = JSON.parse(bodyStr)
              text = bodyJson.input || bodyJson.text || ''
            }
            catch {
              text = bodyStr
            }
          }

          if (!text) {
            throw new Error('No text provided to Edge TTS')
          }

          const pitch = extraOptions?.pitch || '+0Hz'
          const rate = extraOptions?.rate || '+0%'
          const volume = extraOptions?.volume || '+0%'
          const voiceId = model || 'en-US-AriaNeural'
          const voiceEntry = EDGE_TTS_VOICES.find(v => v.id === voiceId)
          const lang = voiceEntry?.lang || 'en-US'

          // NOTICE:
          // In development, we use a local REST proxy endpoint (EdgeTTSProxy)
          // handled by the Vite dev server. This proxy performs the synthesis
          // in Node.js to bypass browser Origin restrictions.
          const isDev = import.meta.env.DEV
          if (isDev) {
            const response = await fetch('/api/edge-tts-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text,
                voiceId,
                pitch,
                rate,
                volume,
                lang,
              }),
            })

            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Edge TTS Proxy failed: ${errorText}`)
            }

            return response
          }

          // Fallback to direct WebSocket (only works in non-browser environments or with specific permissions)
          return new Promise<Response>((resolve, reject) => {
            const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`
            const ws = new WebSocket(wsUrl)
            ws.binaryType = 'arraybuffer'

            let isResolved = false
            const audioChunks: ArrayBuffer[] = []
            const requestId = uuidv4().replace(/-/g, '')

            const cleanup = () => {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close()
              }
            }

            ws.onopen = () => {
              const configMessage = `X-Timestamp:${createTimestamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
              ws.send(configMessage)

              const escapedText = escapeXml(text)
              const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voiceId}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapedText}</prosody></voice></speak>`
              const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${createTimestamp()}\r\nPath:ssml\r\n\r\n${ssml}`
              ws.send(ssmlMessage)
            }

            ws.onmessage = (event) => {
              if (typeof event.data === 'string') {
                if (event.data.includes('Path:turn.end')) {
                  cleanup()
                  if (!isResolved) {
                    isResolved = true
                    const blob = new Blob(audioChunks, { type: 'audio/mpeg' })
                    resolve(new Response(blob, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))
                  }
                }
              }
              else if (event.data instanceof ArrayBuffer) {
                const view = new DataView(event.data)
                if (event.data.byteLength > 2) {
                  const headerLength = view.getUint16(0)
                  if (event.data.byteLength > 2 + headerLength) {
                    const payload = event.data.slice(2 + headerLength)
                    audioChunks.push(payload)
                  }
                }
              }
            }

            ws.onerror = (err) => {
              cleanup()
              if (!isResolved) {
                isResolved = true
                console.error('[Edge TTS] WebSocket error:', err)
                reject(new Error('WebSocket error occurred during Edge TTS synthesis.'))
              }
            }

            ws.onclose = (event) => {
              if (!isResolved) {
                isResolved = true
                if (audioChunks.length > 0) {
                  const blob = new Blob(audioChunks, { type: 'audio/mpeg' })
                  resolve(new Response(blob, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))
                }
                else {
                  reject(new Error(`WebSocket closed unexpectedly (Code: ${event.code}).`))
                }
              }
            }
          })
        },
      }
    },
  }
}
