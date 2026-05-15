import type { Plugin } from 'vite'

import { exec } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

function escapeShellArg(arg: string) {
  return `'${arg.replace(/'/g, '\'\\\'\'')}'`
}

/**
 * A Vite plugin that adds a local proxy endpoint for Edge TTS synthesis.
 * This uses npx node-edge-tts in Node.js to bypass browser Origin restrictions.
 */
export function EdgeTTSProxy(): Plugin {
  return {
    name: 'proj-nova:edge-tts-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/edge-tts-proxy')) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }

          // Read body
          const body = await new Promise<string>((resolve) => {
            let data = ''
            req.on('data', chunk => data += chunk)
            req.on('end', () => resolve(data))
          })

          try {
            const { text, voiceId, pitch, rate, volume, lang } = JSON.parse(body)

            console.info('[Edge TTS Proxy] Synthesizing with npx node-edge-tts:', { voiceId, text: `${text.substring(0, 20)}...` })

            const tempFile = join(tmpdir(), `edge-tts-${randomUUID()}.mp3`)

            try {
              // Construct command
              // npx node-edge-tts -t 'text' -f 'file' -v 'voice' -l 'lang' --pitch 'pitch' -r 'rate' --volume 'volume'
              const cmd = `npx node-edge-tts -t ${escapeShellArg(text)} -f ${escapeShellArg(tempFile)} -v ${escapeShellArg(voiceId)} -l ${escapeShellArg(lang)} --pitch ${escapeShellArg(pitch)} -r ${escapeShellArg(rate)} --volume ${escapeShellArg(volume)}`

              await execAsync(cmd)
              const buffer = await readFile(tempFile)

              res.setHeader('Content-Type', 'audio/mpeg')
              res.end(buffer)
            }
            finally {
              // Clean up temp file
              await unlink(tempFile).catch(() => {})
            }
          }
          catch (err) {
            console.error('[Edge TTS Proxy] Error:', err)
            res.statusCode = 500
            res.end(err instanceof Error ? err.message : 'Internal Server Error')
          }
          return
        }
        next()
      })
    },
  }
}
