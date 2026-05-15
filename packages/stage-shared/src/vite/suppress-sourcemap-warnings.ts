import type { Plugin } from 'vite'

/**
 * Suppresses Vite sourcemap warnings about files pointing outside their
 * package boundary, which are emitted by packages with broken sourcemap
 * references (e.g. @duckdb/duckdb-wasm).
 *
 * These warnings are harmless and cannot be fixed at the project level.
 */
export function SuppressSourcemapWarnings(): Plugin {
  return {
    name: 'suppress-sourcemap-warnings',
    configResolved(config) {
      const logger = config.logger
      const originalWarnOnce = logger.warnOnce.bind(logger)

      logger.warnOnce = (msg, options) => {
        if (
          typeof msg === 'string'
          && msg.includes('points to a source file outside its package')
        ) {
          return
        }
        originalWarnOnce(msg, options)
      }
    },
  }
}
