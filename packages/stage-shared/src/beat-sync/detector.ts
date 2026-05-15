import type { EventContext } from '@moeru/eventa'
import type { Analyser, AnalyserBeatEvent, AnalyserWorkletParameters } from '@nekopaw/tempora'

import type { BeatSyncDetectorEventMap, BeatSyncDetectorState } from './types'

import analyserWorklet from '@nekopaw/tempora/worklet?url'

import { defineInvoke, defineInvokeHandler } from '@moeru/eventa'
import { startAnalyser as startTemporaAnalyser } from '@nekopaw/tempora'

import { isStageTamagotchi, isStageWeb } from '../environment'
import {
  beatSyncBeatSignaledInvokeEventa,
  beatSyncGetInputByteFrequencyDataInvokeEventa,
  beatSyncGetInputByteTimeDomainDataInvokeEventa,
  beatSyncGetStateInvokeEventa,
  beatSyncStateChangedInvokeEventa,
  beatSyncToggleInvokeEventa,
  beatSyncUpdateParametersInvokeEventa,
  createContext,
} from './eventa'

export const inputAnalyserFFTSize = 1024

export interface BeatSyncDetector {
  start: (createSource: (context: AudioContext) => Promise<AudioNode>) => Promise<void>
  updateParameters: (params: Partial<AnalyserWorkletParameters>) => void
  startMonitorCapture: () => Promise<void>
  stop: () => void
  on: <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => () => void
  off: <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => void
  getInputByteFrequencyData: () => Uint8Array<ArrayBuffer>
  getInputByteTimeDomainData: () => Uint8Array<ArrayBuffer>
  readonly state: BeatSyncDetectorState
  readonly context: AudioContext | undefined
  readonly analyser: Analyser | undefined
  readonly source: AudioNode | undefined
}

export function createBeatSyncDetector(): BeatSyncDetector {
  let context: AudioContext | undefined
  let analyser: Analyser | undefined
  let source: AudioNode | undefined
  const state: BeatSyncDetectorState = {
    isActive: false,
  }

  let stopSource: (() => void) | undefined

  let inputAnalyserNode: AnalyserNode | undefined
  let inputAnalyserBuffer: Uint8Array<ArrayBuffer> | undefined
  let timeDomainBuffer: Uint8Array<ArrayBuffer> | undefined

  const listeners: { [K in keyof BeatSyncDetectorEventMap]: Array<(...args: any) => void> } = {
    stateChange: [],
    beat: [],
  }

  const emit = <E extends keyof BeatSyncDetectorEventMap>(event: E, ...args: Parameters<BeatSyncDetectorEventMap[E]>) => {
    listeners[event].forEach(listener => listener(...args))
  }

  const stop = () => {
    if (!state.isActive)
      return

    state.isActive = false
    emit('stateChange', state)
    stopSource?.()
    stopSource = undefined

    if (inputAnalyserNode) {
      inputAnalyserNode.disconnect()
      inputAnalyserNode = undefined
      inputAnalyserBuffer = undefined
      timeDomainBuffer = undefined
    }

    source?.disconnect()
    source = undefined

    analyser?.stop()
    analyser = undefined

    context?.close()
    context = undefined
  }

  const start = async (createSource: (context: AudioContext) => Promise<AudioNode>) => {
    stop()

    context = new AudioContext()
    analyser = await startTemporaAnalyser({
      context,
      worklet: analyserWorklet,
      listeners: {
        onBeat: e => emit('beat', e),
      },
    })

    const node = await createSource(context)

    inputAnalyserNode = context.createAnalyser()
    inputAnalyserNode.fftSize = inputAnalyserFFTSize
    inputAnalyserNode.smoothingTimeConstant = 0.8
    inputAnalyserBuffer = new Uint8Array(inputAnalyserNode.frequencyBinCount)
    timeDomainBuffer = new Uint8Array(inputAnalyserNode.frequencyBinCount)

    node.connect(inputAnalyserNode)
    inputAnalyserNode.connect(analyser?.workletNode)

    source = node

    state.isActive = true
    emit('stateChange', state)
  }

  const updateParameters = (params: Partial<AnalyserWorkletParameters>) => {
    analyser?.updateParameters(params)
  }

  const startMonitorCapture = async () => start(async (ctx) => {
    // Get permission first so enumerateDevices returns populated labels
    let devices: MediaDeviceInfo[]
    try {
      const permStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      permStream.getTracks().forEach(t => t.stop())
      devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput')
    }
    catch {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput')
    }

    let monitorDevice = devices.find(d =>
      d.label.toLowerCase().includes('monitor') || d.label.toLowerCase().includes('output'),
    )

    if (!monitorDevice) {
      monitorDevice = devices[0]
    }

    if (!monitorDevice) {
      throw new Error('No audio input device found. Check microphone permissions.')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: monitorDevice.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    const node = ctx.createMediaStreamSource(stream)
    stopSource = () => {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    }

    state.sourceName = monitorDevice.label || monitorDevice.deviceId
    return node
  })

  const off = <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => {
    const listenerFns = listeners[event]
    if (!listenerFns) {
      throw new Error(`Unknown event: ${event}`)
    }

    const index = listenerFns.indexOf(listener)
    if (index !== -1)
      listenerFns.splice(index, 1)
  }

  const on = <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => {
    const listenerFns = listeners[event]
    if (!listenerFns) {
      throw new Error(`Unknown event: ${event}`)
    }
    listenerFns.push(listener)
    return () => off(event, listener)
  }

  const getInputByteFrequencyData = () => {
    inputAnalyserNode?.getByteFrequencyData(inputAnalyserBuffer!)
    return inputAnalyserBuffer!
  }

  const getInputByteTimeDomainData = () => {
    inputAnalyserNode?.getByteTimeDomainData(timeDomainBuffer!)
    return timeDomainBuffer!
  }

  return {
    start,
    updateParameters,
    startMonitorCapture,
    stop,
    on,
    off,
    getInputByteFrequencyData,
    getInputByteTimeDomainData,

    get state() { return state },
    get context() { return context },
    get analyser() { return analyser },
    get source() { return source },
  }
}

let detector: BeatSyncDetector | undefined
function getDetector() {
  if (!isStageWeb())
    throw new Error('getDetector() is only available in Stage Web environment')

  if (!detector)
    detector = createBeatSyncDetector()

  return detector
}

let context: EventContext<any, any> | undefined
function getContext() {
  if (!context)
    context = createContext()

  return context
}

export function toggleBeatSync(enabled: boolean) {
  if (isStageWeb()) {
    throw new Error('toggleBeatSync is only available in Tamagotchi environment')
  }

  if (isStageTamagotchi()) {
    const toggleFn = defineInvoke(getContext(), beatSyncToggleInvokeEventa)
    return toggleFn(enabled)
  }

  throw new Error('Unknown environment for beatSyncToggle()')
}

export async function getBeatSyncState() {
  if (isStageWeb()) {
    return getDetector().state
  }

  if (isStageTamagotchi()) {
    return defineInvoke(getContext(), beatSyncGetStateInvokeEventa)()
  }

  throw new Error('Unknown environment for getBeatSyncState()')
}

export function updateBeatSyncParameters(params: Partial<AnalyserWorkletParameters>) {
  if (isStageWeb()) {
    return getDetector().updateParameters(params)
  }

  if (isStageTamagotchi()) {
    return defineInvoke(getContext(), beatSyncUpdateParametersInvokeEventa)(params)
  }

  throw new Error('Unknown environment for updateBeatSyncParameters()')
}

export function listenBeatSyncStateChange(listener: (state: BeatSyncDetectorState) => void) {
  if (isStageWeb()) {
    return getDetector().on('stateChange', listener)
  }

  if (isStageTamagotchi()) {
    return defineInvokeHandler(getContext(), beatSyncStateChangedInvokeEventa, listener)
  }

  throw new Error('Unknown environment for listenBeatSyncStateChange()')
}

export function listenBeatSyncBeatSignal(listener: (e: AnalyserBeatEvent) => void) {
  if (isStageWeb()) {
    return getDetector().on('beat', listener)
  }

  if (isStageTamagotchi()) {
    return defineInvokeHandler(getContext(), beatSyncBeatSignaledInvokeEventa, listener)
  }

  throw new Error('Unknown environment for listenBeatSyncBeatSignal()')
}

export async function getBeatSyncInputByteFrequencyData() {
  if (isStageWeb()) {
    return getDetector().getInputByteFrequencyData()
  }

  if (isStageTamagotchi()) {
    return defineInvoke(getContext(), beatSyncGetInputByteFrequencyDataInvokeEventa)()
  }

  throw new Error('Unknown environment for getBeatSyncInputByteFrequencyData()')
}

export async function getBeatSyncInputByteTimeDomainData() {
  if (isStageWeb()) {
    return getDetector().getInputByteTimeDomainData()
  }

  if (isStageTamagotchi()) {
    return defineInvoke(getContext(), beatSyncGetInputByteTimeDomainDataInvokeEventa)()
  }

  throw new Error('Unknown environment for getBeatSyncInputByteTimeDomainData()')
}
