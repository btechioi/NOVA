import { defineInvoke, defineInvokeHandler } from '@moeru/eventa'
import {
  beatSyncBeatSignaledInvokeEventa,
  beatSyncGetInputByteFrequencyDataInvokeEventa,
  beatSyncGetInputByteTimeDomainDataInvokeEventa,
  beatSyncGetStateInvokeEventa,
  beatSyncStateChangedInvokeEventa,
  beatSyncToggleInvokeEventa,
  beatSyncUpdateParametersInvokeEventa,
  createBeatSyncDetector,
  createContext,
} from '@proj-nova/stage-shared/beat-sync'

const context = createContext()

const changeState = defineInvoke(context, beatSyncStateChangedInvokeEventa)
const signalBeat = defineInvoke(context, beatSyncBeatSignaledInvokeEventa)

const detector = createBeatSyncDetector()

detector.on('stateChange', state => changeState(state))
detector.on('beat', (e) => {
  // eslint-disable-next-line no-console
  console.debug('[beat]', e)
  signalBeat(e)
})

defineInvokeHandler(context, beatSyncToggleInvokeEventa, async (enabled) => {
  // eslint-disable-next-line no-console
  console.log('[toggle]', enabled)
  try {
    if (enabled) {
      await detector.startMonitorCapture()
    }
    else {
      detector.stop()
    }
  }
  catch (e) {
    console.error('[toggle] error', e)
  }
})
defineInvokeHandler(context, beatSyncGetStateInvokeEventa, async () => detector.state)
defineInvokeHandler(context, beatSyncUpdateParametersInvokeEventa, async (params) => {
  // eslint-disable-next-line no-console
  console.log('[update-params]', params)
  detector.updateParameters(params)
})
defineInvokeHandler(context, beatSyncGetInputByteFrequencyDataInvokeEventa, async () => {
  // eslint-disable-next-line no-console
  console.debug('[get-input-byte-frequency-data]')
  return detector.getInputByteFrequencyData()
})
defineInvokeHandler(context, beatSyncGetInputByteTimeDomainDataInvokeEventa, async () => {
  // eslint-disable-next-line no-console
  console.debug('[get-input-byte-time-domain-data]')
  return detector.getInputByteTimeDomainData()
})
