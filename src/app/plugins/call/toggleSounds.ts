// Short synthesized cues for call toggles (no audio assets needed).
// Rising = on, falling = off. Mute is a mid pair, deafen a lower pair, and
// noise suppression a brighter three-note triangle-wave run. A screen share
// ending gets a slower falling run (Element Call already cues the start).
// Cues play on the output device chosen in Voice & Video settings.

export type ToggleSound =
  | 'mute'
  | 'unmute'
  | 'deafen'
  | 'undeafen'
  | 'noiseSuppressionOn'
  | 'noiseSuppressionOff'
  | 'screenShareEnded'
  | 'speakerTest';

type Cue = { notes: number[]; wave: OscillatorType; length?: number };

const CUES: Record<ToggleSound, Cue> = {
  unmute: { notes: [523.25, 783.99], wave: 'sine' },
  mute: { notes: [783.99, 523.25], wave: 'sine' },
  undeafen: { notes: [392, 587.33], wave: 'sine' },
  deafen: { notes: [587.33, 392], wave: 'sine' },
  noiseSuppressionOn: { notes: [659.25, 880, 1318.51], wave: 'triangle' },
  noiseSuppressionOff: { notes: [1318.51, 880, 659.25], wave: 'triangle' },
  screenShareEnded: { notes: [987.77, 739.99, 493.88], wave: 'sine', length: 0.11 },
  speakerTest: { notes: [523.25, 659.25, 783.99, 1046.5], wave: 'sine', length: 0.14 },
};

const TONE_LENGTH = 0.07;
const TONE_GAP = 0.015;
const VOLUME = 0.12;

// Element Call's output device choice (see VoiceVideo settings). Cues follow it so
// they play in the same headset as the call.
const OUTPUT_DEVICE_KEY = 'matrix-setting-audio-output';

type SinkAudioContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };

let ctx: SinkAudioContext | undefined;
let sinkId = '';

const readOutputDevice = (): string => {
  try {
    const id = JSON.parse(localStorage.getItem(OUTPUT_DEVICE_KEY) ?? '""');
    return typeof id === 'string' ? id : '';
  } catch {
    return '';
  }
};

const getContext = async (): Promise<SinkAudioContext | undefined> => {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return undefined;
    }
  }
  const wanted = readOutputDevice();
  if (wanted !== sinkId && ctx.setSinkId) {
    sinkId = wanted;
    // An unplugged device falls back to the system default.
    await ctx.setSinkId(wanted).catch(() => ctx?.setSinkId?.('').catch(() => undefined));
  }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  return ctx;
};

const play = async (sound: ToggleSound) => {
  const audio = await getContext();
  if (!audio) return;

  const { notes, wave, length = TONE_LENGTH } = CUES[sound];
  notes.forEach((frequency, i) => {
    const start = audio.currentTime + i * (length + TONE_GAP);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = wave;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(VOLUME, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + length + 0.01);
  });
};

export const playToggleSound = (sound: ToggleSound) => {
  play(sound).catch(() => undefined);
};
