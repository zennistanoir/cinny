// Short synthesized cues for call toggles (no audio assets needed).
// Rising = on, falling = off. Mute is a mid pair, deafen a lower pair, and
// noise suppression a brighter three-note triangle-wave run. A screen share
// ending gets a slower falling run (Element Call already cues the start).

export type ToggleSound =
  | 'mute'
  | 'unmute'
  | 'deafen'
  | 'undeafen'
  | 'noiseSuppressionOn'
  | 'noiseSuppressionOff'
  | 'screenShareEnded';

type Cue = { notes: number[]; wave: OscillatorType; length?: number };

const CUES: Record<ToggleSound, Cue> = {
  unmute: { notes: [523.25, 783.99], wave: 'sine' },
  mute: { notes: [783.99, 523.25], wave: 'sine' },
  undeafen: { notes: [392, 587.33], wave: 'sine' },
  deafen: { notes: [587.33, 392], wave: 'sine' },
  noiseSuppressionOn: { notes: [659.25, 880, 1318.51], wave: 'triangle' },
  noiseSuppressionOff: { notes: [1318.51, 880, 659.25], wave: 'triangle' },
  screenShareEnded: { notes: [987.77, 739.99, 493.88], wave: 'sine', length: 0.11 },
};

const TONE_LENGTH = 0.07;
const TONE_GAP = 0.015;
const VOLUME = 0.12;

let ctx: AudioContext | undefined;

const getContext = (): AudioContext | undefined => {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return undefined;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
};

export const playToggleSound = (sound: ToggleSound) => {
  const audio = getContext();
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
