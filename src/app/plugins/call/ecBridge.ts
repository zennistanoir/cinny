import { useSyncExternalStore } from 'react';
import { getSettings, ScreenShareContent, ScreenShareQuality } from '../../state/settings';

// Host side of the Element Call bundle patches (scripts/patchElementCall.js). The
// patched view models call into `window.__zennithEC` inside the call iframe, which
// `installElementCallBridge` points back at this module.

// --- Per-user playback volume -------------------------------------------------------
// Element Call starts every participant at 100% on each join. Volumes are stored here,
// keyed by user id (and `${userId}|share` for screen-share audio), so a change made in
// the call or in the voice member list sticks across calls and reloads.

type VolumeState = { volume: number; committedVolume: number };

const VOLUME_KEY = 'zennith-user-volumes';
const SHARE_SUFFIX = '|share';

const readVolumes = (): Record<string, VolumeState> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const volumes = readVolumes();
let volumeWriteTimer: number | undefined;
const persistVolumes = () => {
  window.clearTimeout(volumeWriteTimer);
  volumeWriteTimer = window.setTimeout(() => {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes));
  }, 250);
};

const clampVolume = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 1);

// Live view models that accept a volume pushed from outside the call UI.
const volumeWatchers = new Map<string, Set<(volume: number) => void>>();
const volumeListeners = new Set<() => void>();
const emitVolumes = () => volumeListeners.forEach((l) => l());

const saveVolume = (key: string, state: VolumeState) => {
  const prev = volumes[key];
  if (prev && prev.volume === state.volume && prev.committedVolume === state.committedVolume) {
    return;
  }
  const volume = clampVolume(state.volume);
  const committedVolume = clampVolume(state.committedVolume);
  if (volume === 1 && committedVolume === 1) delete volumes[key];
  else volumes[key] = { volume, committedVolume };
  persistVolumes();
  emitVolumes();
};

export const getUserVolume = (userId: string): number => volumes[userId]?.volume ?? 1;

export const setUserVolume = (userId: string, volume: number) => {
  const v = clampVolume(volume);
  const watchers = volumeWatchers.get(userId);
  if (watchers && watchers.size > 0) {
    // The view model saves the resulting state itself.
    watchers.forEach((adjust) => adjust(v));
  } else {
    const committedVolume = v === 0 ? volumes[userId]?.committedVolume ?? 1 : v;
    saveVolume(userId, { volume: v, committedVolume });
  }
};

export const useUserVolume = (userId: string): number =>
  useSyncExternalStore(
    (onChange) => {
      volumeListeners.add(onChange);
      return () => {
        volumeListeners.delete(onChange);
      };
    },
    () => getUserVolume(userId)
  );

// --- Speaking / screen-share presence -------------------------------------------------
// Keyed by Element Call's media id (one per tile), so a user with two devices is
// speaking while either one is.

type Scope = { onEnd: (cb: () => void) => void };
type Behavior<T> = { subscribe: (cb: (v: T) => void) => { unsubscribe: () => void } };

const speakingMedia = new Map<string, string>(); // media id -> user id, while speaking
const sharingMedia = new Map<string, string>(); // media id -> user id
const presenceListeners = new Set<() => void>();

export type CallPresence = { speaking: ReadonlySet<string>; sharing: ReadonlySet<string> };
let presence: CallPresence = { speaking: new Set(), sharing: new Set() };

const emitPresence = () => {
  presence = {
    speaking: new Set(speakingMedia.values()),
    sharing: new Set(sharingMedia.values()),
  };
  presenceListeners.forEach((l) => l());
};

const subscribePresence = (onChange: () => void) => {
  presenceListeners.add(onChange);
  return () => {
    presenceListeners.delete(onChange);
  };
};

export const useCallPresence = (): CallPresence =>
  useSyncExternalStore(subscribePresence, () => presence);

const clearPresence = () => {
  if (speakingMedia.size === 0 && sharingMedia.size === 0) return;
  speakingMedia.clear();
  sharingMedia.clear();
  emitPresence();
};

// --- Screen-share quality --------------------------------------------------------------

const SHARE_PRESETS: Record<
  ScreenShareQuality,
  { width: number; height: number; frameRate: number; maxBitrate: number }
> = {
  '720p30': { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  '1080p30': { width: 1920, height: 1080, frameRate: 30, maxBitrate: 5_000_000 },
  '1080p60': { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000 },
  '1440p60': { width: 2560, height: 1440, frameRate: 60, maxBitrate: 12_000_000 },
};

const sharePreset = () => SHARE_PRESETS[getSettings().screenShareQuality] ?? SHARE_PRESETS['1080p30'];
const shareContent = (): ScreenShareContent => getSettings().screenShareContent ?? 'motion';

// LiveKit ScreenShareCaptureOptions (merged over Element Call's own).
const shareCapture = () => {
  const { width, height, frameRate } = sharePreset();
  return { resolution: { width, height, frameRate }, contentHint: shareContent() };
};

// LiveKit TrackPublishOptions for the screen-share track. LiveKit defaults screen shares
// to `maintain-resolution`, which drops frames under load; motion content (games,
// video) keeps the frame rate instead.
const sharePublish = () => {
  const { frameRate, maxBitrate } = sharePreset();
  const motion = shareContent() === 'motion';
  return {
    screenShareEncoding: { maxBitrate, maxFramerate: frameRate },
    degradationPreference: motion ? 'maintain-framerate' : 'maintain-resolution',
    ...(getSettings().screenShareH264 ? { videoCodec: 'h264' } : {}),
  };
};

// The LiveKit LocalParticipant that last started a share, so quality and content
// changes can be applied to a share that is already live.
type ShareTrack = {
  mediaStreamTrack?: MediaStreamTrack;
  sender?: RTCRtpSender;
  encodings?: RTCRtpEncodingParameters[];
};
type ShareOwner = {
  getTrackPublication(source: string): { track?: ShareTrack } | undefined;
};
let shareOwner: ShareOwner | undefined;

// Re-applies quality and content to the live screen share. The codec (H.264) is fixed
// once the track is published, so that one only takes effect on the next share.
export const applyShareSettingsLive = async (): Promise<void> => {
  const track = shareOwner?.getTrackPublication('screen_share')?.track;
  const mst = track?.mediaStreamTrack;
  if (!track || !mst || mst.readyState === 'ended') return;

  const { width, height, frameRate, maxBitrate } = sharePreset();
  const motion = shareContent() === 'motion';
  mst.contentHint = shareContent();
  await mst
    .applyConstraints({ width: { ideal: width }, height: { ideal: height }, frameRate })
    .catch((err) => console.warn('[zennith] Could not resize screen share', err));

  const { sender } = track;
  if (!sender) return;
  const params = sender.getParameters();
  const { encodings } = params;
  if (!encodings?.length) return;
  // Simulcast sends several layers; the full-resolution one carries the preset.
  let top = 0;
  encodings.forEach((enc, i) => {
    if ((enc.scaleResolutionDownBy ?? 1) < (encodings[top].scaleResolutionDownBy ?? 1)) top = i;
  });
  encodings[top].maxBitrate = maxBitrate;
  encodings[top].maxFramerate = frameRate;
  (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
    motion ? 'maintain-framerate' : 'maintain-resolution';
  try {
    await sender.setParameters(params);
  } catch (err) {
    console.warn('[zennith] Could not update screen share encoding', err);
    return;
  }
  // LiveKit re-applies its own copy of the encodings when the track restarts.
  const own = track.encodings?.[top];
  if (own && track.encodings?.length === encodings.length) {
    own.maxBitrate = maxBitrate;
    own.maxFramerate = frameRate;
  }
};

// --- Bridge ----------------------------------------------------------------------------

type BridgeWindow = Window & { __zennithEC?: unknown };

export const installElementCallBridge = (win: BridgeWindow) => {
  // eslint-disable-next-line no-param-reassign
  win.__zennithEC = {
    volGet: (key: string): VolumeState => {
      const saved = volumes[key];
      return saved ? { ...saved } : { volume: 1, committedVolume: 1 };
    },
    volSave: saveVolume,
    volWatch: (scope: Scope, key: string, adjust: (volume: number) => void) => {
      if (key.endsWith(SHARE_SUFFIX)) return;
      let watchers = volumeWatchers.get(key);
      if (!watchers) {
        watchers = new Set();
        volumeWatchers.set(key, watchers);
      }
      watchers.add(adjust);
      scope.onEnd(() => {
        watchers?.delete(adjust);
        if (watchers?.size === 0) volumeWatchers.delete(key);
      });
    },
    speaking: (scope: Scope, userId: string, mediaId: string, speaking$: Behavior<boolean>) => {
      const sub = speaking$.subscribe((speaking) => {
        if (speaking === speakingMedia.has(mediaId)) return;
        if (speaking) speakingMedia.set(mediaId, userId);
        else speakingMedia.delete(mediaId);
        emitPresence();
      });
      scope.onEnd(() => {
        sub.unsubscribe();
        if (speakingMedia.delete(mediaId)) emitPresence();
      });
    },
    share: (scope: Scope, userId: string, mediaId: string) => {
      sharingMedia.set(mediaId, userId);
      emitPresence();
      scope.onEnd(() => {
        if (sharingMedia.delete(mediaId)) emitPresence();
      });
    },
    shareCapture,
    sharePublish,
    shareOwner: (owner: ShareOwner | undefined) => {
      shareOwner = owner;
    },
  };
  // Leaving or reloading the call tears the iframe down without ending its scopes.
  win.addEventListener('pagehide', () => {
    shareOwner = undefined;
    volumeWatchers.clear();
    clearPresence();
  });
};
