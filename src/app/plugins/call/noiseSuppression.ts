import { loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import { getSettings, VoiceGateLevel } from '../../state/settings';

// RNNoise for Element Call.
//
// Element Call runs in a same-origin iframe and captures the microphone itself,
// so we can't hand it a processed track. Instead, an inline script injected into
// its index.html (see vite.config.js and iframeMedia.ts) calls
// `parent.__zennithPatchMedia(window)` before Element Call's bundle runs, and we
// wrap the iframe's getUserMedia.
//
// Every audio capture is routed source -> RNNoise -> MediaStreamDestination, with
// a bypass path so the toggle works mid-call without renegotiating. All audio
// objects are created from the iframe's realm: Element Call / LiveKit check
// `instanceof MediaStreamTrack`, which fails for host-realm objects.
//
// An optional voice gate sits after RNNoise and silences the mic between speech
// (keyboard clacks, fans RNNoise lets through). It is rebuilt rather than bypassed
// when its level changes: the gate worklet stops processing for good if it ever
// sees a disconnected input.

const ASSET_BASE = `${import.meta.env.BASE_URL}public/rnnoise/`;
// Processor name registered by rnnoiseWorklet.js (@sapphi-red/web-noise-suppressor 0.4.1).
const PROCESSOR_ID = '@sapphi-red/web-noise-suppressor/rnnoise';
const GATE_PROCESSOR_ID = '@sapphi-red/web-noise-suppressor/noise-gate';
const SAMPLE_RATE = 48000;

// Gate thresholds in dBFS (RMS per render quantum, measured after RNNoise).
export const GATE_LEVELS: Record<
  Exclude<VoiceGateLevel, 'off'>,
  { open: number; close: number }
> = {
  low: { open: -60, close: -66 },
  medium: { open: -50, close: -56 },
  high: { open: -42, close: -48 },
};
const GATE_HOLD_MS = 300;

type Pipeline = {
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  destination: MediaStreamAudioDestinationNode;
  makeGate: (level: VoiceGateLevel) => AudioWorkletNode | undefined;
  gate?: AudioWorkletNode;
};

const pipelines = new Set<Pipeline>();
let enabled = getSettings().noiseSuppression ?? true;
let gateLevel: VoiceGateLevel = getSettings().voiceGate ?? 'off';
let wasmBinary: Promise<ArrayBuffer> | undefined;

const assetUrl = (file: string) => new URL(`${ASSET_BASE}${file}`, window.location.href).href;

const getWasmBinary = (): Promise<ArrayBuffer> => {
  if (!wasmBinary) {
    wasmBinary = loadRnnoise({
      url: assetUrl('rnnoise.wasm'),
      simdUrl: assetUrl('rnnoise_simd.wasm'),
    });
    wasmBinary.catch(() => {
      wasmBinary = undefined;
    });
  }
  return wasmBinary;
};

const route = (p: Pipeline) => {
  p.source.disconnect();
  p.node.disconnect();
  const tail = p.gate ?? p.destination;
  if (enabled) {
    p.source.connect(p.node);
    p.node.connect(tail);
  } else {
    p.source.connect(tail);
  }
};

const destroyGate = (p: Pipeline) => {
  if (!p.gate) return;
  p.gate.disconnect();
  p.gate.port.close();
  // eslint-disable-next-line no-param-reassign
  p.gate = undefined;
};

const rebuildGate = (p: Pipeline) => {
  destroyGate(p);
  const gate = p.makeGate(gateLevel);
  if (gate) {
    gate.connect(p.destination);
    // eslint-disable-next-line no-param-reassign
    p.gate = gate;
  }
  route(p);
};

export const setNoiseSuppressionEnabled = (value: boolean) => {
  if (enabled === value) return;
  enabled = value;
  pipelines.forEach(route);
};

export const setVoiceGate = (level: VoiceGateLevel) => {
  if (gateLevel === level) return;
  gateLevel = level;
  pipelines.forEach(rebuildGate);
};

// Make the processed track look like the captured one to Element Call / LiveKit,
// which read deviceId from getSettings() for device selection.
/* eslint-disable no-param-reassign -- patching the track is the point */
const mirrorTrack = (processed: MediaStreamTrack, src: MediaStreamTrack) => {
  Object.defineProperty(processed, 'label', { get: () => src.label });
  processed.getSettings = () => src.getSettings();
  processed.getConstraints = () => src.getConstraints();
  processed.getCapabilities = () => src.getCapabilities();
  processed.applyConstraints = (c) => src.applyConstraints(c);
};
/* eslint-enable no-param-reassign */

const processStream = async (win: Window, stream: MediaStream): Promise<MediaStream> => {
  const [src] = stream.getAudioTracks();
  if (!src) return stream;

  const binary = await getWasmBinary();
  const w = win as Window & typeof globalThis;
  const ctx = new w.AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    await ctx.audioWorklet.addModule(assetUrl('rnnoiseWorklet.js'));
    // The gate is optional: a missing worklet only disables it.
    const gateReady = await ctx.audioWorklet
      .addModule(assetUrl('noiseGateWorklet.js'))
      .then(() => true)
      .catch(() => false);
    const source = ctx.createMediaStreamSource(new w.MediaStream([src]));
    const node = new w.AudioWorkletNode(ctx, PROCESSOR_ID, {
      processorOptions: { maxChannels: 1, wasmBinary: binary },
    });
    const destination = ctx.createMediaStreamDestination();
    const makeGate = (level: VoiceGateLevel) => {
      if (level === 'off' || !gateReady) return undefined;
      const { open, close } = GATE_LEVELS[level];
      return new w.AudioWorkletNode(ctx, GATE_PROCESSOR_ID, {
        processorOptions: {
          openThreshold: open,
          closeThreshold: close,
          holdMs: GATE_HOLD_MS,
          maxChannels: 1,
        },
      });
    };
    const pipeline: Pipeline = { source, node, destination, makeGate };
    rebuildGate(pipeline);
    pipelines.add(pipeline);
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

    const [processed] = destination.stream.getAudioTracks();
    mirrorTrack(processed, src);

    let stopped = false;
    const teardown = () => {
      if (stopped) return;
      stopped = true;
      pipelines.delete(pipeline);
      src.stop();
      node.port.postMessage('destroy');
      destroyGate(pipeline);
      source.disconnect();
      node.disconnect();
      ctx.close().catch(() => undefined);
    };
    const nativeStop = processed.stop.bind(processed);
    processed.stop = () => {
      nativeStop();
      teardown();
    };
    // Device unplugged etc.: surface the source's end on the track LiveKit holds.
    src.addEventListener('ended', () => {
      nativeStop();
      teardown();
      processed.dispatchEvent(new w.Event('ended'));
    });

    return new w.MediaStream([processed, ...stream.getVideoTracks()]);
  } catch (err) {
    ctx.close().catch(() => undefined);
    throw err;
  }
};

type PatchableWindow = Window & { __zennithMediaPatched?: boolean };

export const patchMedia = (win: PatchableWindow) => {
  const mediaDevices = win.navigator?.mediaDevices;
  if (!mediaDevices || win.__zennithMediaPatched) return;
  // eslint-disable-next-line no-param-reassign
  win.__zennithMediaPatched = true;

  const nativeGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    const stream = await nativeGetUserMedia(constraints);
    if (!constraints?.audio) return stream;
    try {
      return await processStream(win, stream);
    } catch (err) {
      // Never break the call over noise suppression: fall back to the raw mic.
      // eslint-disable-next-line no-console
      console.warn('[zennith] RNNoise unavailable, using unprocessed microphone', err);
      return stream;
    }
  };
};
