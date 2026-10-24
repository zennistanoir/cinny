import { useMemo, useSyncExternalStore } from 'react';
import { useAtomValue } from 'jotai';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { StateEvent } from '../../../types/matrix/room';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useStateEvent } from '../../hooks/useStateEvent';
import { downloadMedia, mxcUrlToHttp } from '../../utils/matrix';
import { playIntoMic } from './noiseSuppression';
import { getContext } from './toggleSounds';

// Soundboard: short clips mods add in Space Settings, stored as one
// `zennith.soundboard` state event (state_key "") on the voice room's space.
// A voice room outside any space reads the event from the room itself.
// Playing a clip mixes it into your own mic (see playIntoMic), so everyone in
// the call hears it, Element and other clients included.

export const SOUNDBOARD_MAX_SECONDS = 5;
export const SOUNDBOARD_MAX_BYTES = 1024 * 1024;
export const SOUNDBOARD_MAX_SOUNDS = 48;
const COOLDOWN_MS = 2000;
const MIC_VOLUME = 0.7;
const LOCAL_VOLUME = 0.6;

export type SoundboardSound = {
  id: string;
  name: string;
  emoji?: string;
  url: string;
  mimetype?: string;
  size?: number;
  duration?: number;
};

export type SoundboardContent = {
  sounds: SoundboardSound[];
};

const isSound = (s: unknown): s is SoundboardSound => {
  if (!s || typeof s !== 'object') return false;
  const { id, name, url } = s as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    typeof url === 'string' &&
    url.startsWith('mxc://')
  );
};

export const parseSoundboard = (content: unknown): SoundboardSound[] => {
  const sounds = (content as Partial<SoundboardContent> | undefined)?.sounds;
  if (!Array.isArray(sounds)) return [];
  return sounds.filter(isSound).slice(0, SOUNDBOARD_MAX_SOUNDS);
};

// The room whose soundboard applies to a voice room: the first parent space that
// has one, else the first parent space, else the room itself.
export const useSoundboardRoom = (mx: MatrixClient, room: Room): Room => {
  const roomToParents = useAtomValue(roomToParentsAtom);
  const parents = roomToParents.get(room.roomId);

  return useMemo(() => {
    const spaces = [...(parents ?? [])]
      .map((id) => mx.getRoom(id))
      .filter((r): r is Room => !!r);
    const withBoard = spaces.find(
      (s) => parseSoundboard(s.currentState.getStateEvents(StateEvent.ZennithSoundboard, '')?.getContent()).length > 0
    );
    return withBoard ?? spaces[0] ?? room;
  }, [mx, room, parents]);
};

export const useSoundboard = (room: Room): SoundboardSound[] => {
  const event = useStateEvent(room, StateEvent.ZennithSoundboard);
  return useMemo(() => parseSoundboard(event?.getContent()), [event]);
};

export const saveSoundboard = (mx: MatrixClient, roomId: string, sounds: SoundboardSound[]) => {
  const content: SoundboardContent = { sounds };
  return mx.sendStateEvent(roomId, StateEvent.ZennithSoundboard as any, content as any, '');
};

const clipCache = new Map<string, Promise<ArrayBuffer>>();

export const loadClip = (mx: MatrixClient, mxc: string, useAuthentication: boolean) => {
  let clip = clipCache.get(mxc);
  if (!clip) {
    const http = mxcUrlToHttp(mx, mxc, useAuthentication);
    clip = http
      ? downloadMedia(http).then((blob) => blob.arrayBuffer())
      : Promise.reject(new Error('Bad sound URL'));
    clip.catch(() => clipCache.delete(mxc));
    clipCache.set(mxc, clip);
  }
  return clip;
};

// Length in seconds, rejecting anything the browser can't decode.
export const measureClip = async (data: ArrayBuffer): Promise<number> => {
  const ctx = new OfflineAudioContext(1, 1, 48000);
  const buffer = await ctx.decodeAudioData(data.slice(0));
  return buffer.duration;
};

// Plays on the output device chosen in Voice & Video, like the call cues.
export const playClipLocally = async (data: ArrayBuffer, volume = LOCAL_VOLUME) => {
  const audio = await getContext();
  if (!audio) return;
  const buffer = await audio.decodeAudioData(data.slice(0));
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const gain = audio.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audio.destination);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  source.start();
};

// One clip at a time: busy until it ends, and for at least COOLDOWN_MS.
let busy = false;
const busyListeners = new Set<() => void>();
const setBusy = (value: boolean) => {
  busy = value;
  busyListeners.forEach((l) => l());
};
const subscribeBusy = (onChange: () => void) => {
  busyListeners.add(onChange);
  return () => {
    busyListeners.delete(onChange);
  };
};
export const useSoundboardBusy = (): boolean => useSyncExternalStore(subscribeBusy, () => busy);

// Returns false when nothing was sent (busy, or no processed mic to mix into).
export const playSoundboardClip = async (data: ArrayBuffer, hearLocally: boolean) => {
  if (busy) return false;
  setBusy(true);
  try {
    const duration = await playIntoMic(data, MIC_VOLUME);
    if (duration === undefined) {
      setBusy(false);
      return false;
    }
    if (hearLocally) playClipLocally(data).catch(() => undefined);
    window.setTimeout(() => setBusy(false), Math.max(duration * 1000, COOLDOWN_MS));
    return true;
  } catch (err) {
    setBusy(false);
    throw err;
  }
};
