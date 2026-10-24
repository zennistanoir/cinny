import { useSyncExternalStore } from 'react';
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
//
// Everything reaches the destination through a pass-through `out` node, which also
// feeds an analyser for the local speaking indicator. LiveKit's server-side speaker
// detection samples every few hundred ms, so our own ring would lag behind our voice.

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

// Local speaking indicator: RMS of the processed mic, checked every SPEAK_POLL_MS.
const SPEAK_OPEN_DB = -50;
const SPEAK_CLOSE_DB = -56;
const SPEAK_HOLD_MS = 250;
const SPEAK_POLL_MS = 40;

type Pipeline = {
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  out: GainNode;
  destination: MediaStreamAudioDestinationNode;
  makeGate: (level: VoiceGateLevel) => AudioWorkletNode | undefined;
  gate?: AudioWorkletNode;
  speaking: boolean;
};

const pipelines = new Set<Pipeline>();

// undefined = no processed mic (not in a call, or RNNoise fell back to the raw mic).
let localSpeaking: boolean | undefined;
const speakingListeners = new Set<() => void>();
const updateLocalSpeaking = () => {
  const next = pipelines.size === 0 ? undefined : [...pipelines].some((p) => p.speaking);
  if (next === localSpeaking) return;
  localSpeaking = next;
  speakingListeners.forEach((l) => l());
};
const subscribeLocalSpeaking = (onChange: () => void) => {
  speakingListeners.add(onChange);
  return () => {
    speakingListeners.delete(onChange);
  };
};
export const useLocalSpeaking = (): boolean | undefined =>
  useSyncExternalStore(subscribeLocalSpeaking, () => localSpeaking);
// localSpeaking turns undefined exactly when the last pipeline goes away, so the
// same listeners cover this.
export const useMicPipelineReady = (): boolean =>
  useSyncExternalStore(subscribeLocalSpeaking, () => pipelines.size > 0);
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
  const tail = p.gate ?? p.out;
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
    gate.connect(p.out);
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

// Soundboard: mixes a clip into every live mic pipeline. It joins at the
// destination, after RNNoise and the gate so it isn't filtered, and past `out` so
// it doesn't light our own speaking ring. Resolves to the clip length in seconds,
// or undefined when there is no processed mic to mix into.
export const playIntoMic = async (data: ArrayBuffer, volume: number): Promise<number | undefined> => {
  const targets = [...pipelines];
  if (targets.length === 0) return undefined;
  const durations = await Promise.all(
    targets.map(async ({ destination }) => {
      const ctx = destination.context;
      // decodeAudioData detaches its input, and every context needs its own copy.
      const buffer = await ctx.decodeAudioData(data.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      return buffer.duration;
    })
  );
  return Math.max(...durations);
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
    const out = ctx.createGain();
    out.connect(destination);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    out.connect(analyser);
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
    const pipeline: Pipeline = { source, node, out, destination, makeGate, speaking: false };
    rebuildGate(pipeline);
    pipelines.add(pipeline);
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

    const [processed] = destination.stream.getAudioTracks();
    mirrorTrack(processed, src);

    // LiveKit mutes by disabling the track it holds, so a muted mic never "speaks".
    const samples = new Float32Array(analyser.fftSize);
    let lastLoud = 0;
    const poll = w.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
      const db = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-8);
      const now = performance.now();
      if (db >= (pipeline.speaking ? SPEAK_CLOSE_DB : SPEAK_OPEN_DB)) lastLoud = now;
      pipeline.speaking = processed.enabled && now - lastLoud < SPEAK_HOLD_MS;
      updateLocalSpeaking();
    }, SPEAK_POLL_MS);
    updateLocalSpeaking();

    let stopped = false;
    const teardown = () => {
      if (stopped) return;
      stopped = true;
      w.clearInterval(poll);
      pipelines.delete(pipeline);
      updateLocalSpeaking();
      src.stop();
      node.port.postMessage('destroy');
      destroyGate(pipeline);
      source.disconnect();
      node.disconnect();
      out.disconnect();
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
