import { useElectronEventaInvoke } from '@proj-nova/electron-vueuse'
import { useLlmToolsStore } from '@proj-nova/stage-ui/stores/llm-tools'
import { createMcpTools } from '@proj-nova/stage-ui/tools/mcp'
import { defineStore } from 'pinia'

import { electronMcpCallTool, electronMcpListTools } from '../../shared/eventa'

/**
 * Registers Electron-backed MCP tools into the shared LLM tools store.
 *
 * Use when:
 * - The Tamagotchi renderer needs live MCP tools during chat streaming
 *
 * Expects:
 * - Electron Eventa handlers for MCP listing and invocation are available
 *
 * Returns:
 * - Store actions for refreshing and disposing MCP runtime tools
 */
export const useTamagotchiMcpToolsStore = defineStore('tamagotchi-mcp-tools', () => {
  const llmToolsStore = useLlmToolsStore()
  const listMcpTools = useElectronEventaInvoke(electronMcpListTools)
  const callMcpTool = useElectronEventaInvoke(electronMcpCallTool)

  async function refresh() {
    return llmToolsStore.registerTools('mcp', Promise.all(createMcpTools({
      listTools: () => listMcpTools(),
      callTool: payload => callMcpTool(payload),
    })))
  }

  function dispose() {
    llmToolsStore.clearTools('mcp')
  }

  return {
    dispose,
    refresh,
  }
})
