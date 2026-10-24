/* eslint-disable jsx-a11y/media-has-caption */
import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import FocusTrap from 'focus-trap-react';
import {
  Avatar,
  Box,
  Button,
  color,
  config,
  Dialog,
  Icon,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  toRem,
} from 'folds';
import {
  ClientEvent,
  EventTimelineSetHandlerMap,
  EventType,
  KnownMembership,
  MatrixEvent,
  RelationType,
  Room,
  RoomEvent,
} from 'matrix-js-sdk';
import { IRTCNotificationContent, RTCNotificationType } from 'matrix-js-sdk/lib/matrixrtc/types';
import { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { isKeyHotkey } from 'is-hotkey';
import {
  CallEmbedContextProvider,
  CallEmbedRefContextProvider,
  useCallHangupEvent,
  useCallJoined,
  useCallThemeSync,
  useCallMemberSoundSync,
  useCallStart,
} from '../hooks/useCallEmbed';
import { callChatAtom, callEmbedAtom } from '../state/callEmbed';
import { CallEmbed } from '../plugins/call';
import { useSelectedRoom } from '../hooks/router/useSelectedRoom';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';
import { useMatrixClient } from '../hooks/useMatrixClient';
import CallSound from '../../../public/sound/call.ogg';
import { useCallMembersChange, useCallSession } from '../hooks/useCall';
import { useRoomAvatar, useRoomName } from '../hooks/useRoomMeta';
import { mDirectAtom } from '../state/mDirectList';
import { useMediaAuthentication } from '../hooks/useMediaAuthentication';
import { RoomAvatar, RoomIcon } from './room-avatar';
import { useRoomNavigate } from '../hooks/useRoomNavigate';
import { getMemberDisplayName, getStateEvent } from '../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../utils/matrix';
import { StateEvent } from '../../types/matrix/room';
import { getPowersLevelFromMatrixEvent } from '../hooks/usePowerLevels';
import { getRoomCreatorsForRoomId } from '../hooks/useRoomCreators';
import { getRoomPermissionsAPI } from '../hooks/useRoomPermissions';
import { useLivekitSupport } from '../hooks/useLivekitSupport';
import { CallAvatarAnimation } from '../styles/Animations.css';
import { webRTCSupported } from '../utils/rtc';
import { useSetSetting, useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import '../plugins/call/iframeMedia';
import { setNoiseSuppressionEnabled, setVoiceGate } from '../plugins/call/noiseSuppression';
import { CallControlEvent } from '../plugins/call/CallControl';
import { playToggleSound, ToggleSound } from '../plugins/call/toggleSounds';
import { CALL_CUE_EVENT, showCallCue } from '../plugins/call/callCues';
import {
  CALL_MODERATION_EVENT,
  canModerateCall,
  parseCallModeration,
} from '../plugins/call/callModeration';

// A call event cue: the toggle sound and / or a visual caption
// (Settings > Accessibility > Visual call cues).
const useCallCue = () => {
  const [sounds] = useSetting(settingsAtom, 'callToggleSounds');
  const [captions] = useSetting(settingsAtom, 'visualCallCues');
  const cue = useCallback(
    (sound: ToggleSound, caption: string) => {
      if (sounds) playToggleSound(sound);
      if (captions) showCallCue(caption);
    },
    [sounds, captions]
  );
  return { enabled: sounds || captions, cue };
};

function NoiseSuppressionSync() {
  const [noiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const { cue } = useCallCue();
  const prevRef = useRef(noiseSuppression);

  useEffect(() => {
    setNoiseSuppressionEnabled(noiseSuppression);
    // Cue only real changes (call menu or settings), not the initial value.
    if (prevRef.current !== noiseSuppression) {
      cue(
        noiseSuppression ? 'noiseSuppressionOn' : 'noiseSuppressionOff',
        noiseSuppression ? 'Noise suppression on' : 'Noise suppression off'
      );
    }
    prevRef.current = noiseSuppression;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiseSuppression]);

  const [voiceGate] = useSetting(settingsAtom, 'voiceGate');
  useEffect(() => {
    setVoiceGate(voiceGate);
  }, [voiceGate]);

  return null;
}

// Deafen also mutes the mic (and unmuting also undeafens) a moment later via
// the widget API; only cue the action the user actually took.
const LINKED_TOGGLE_WINDOW_MS = 1000;

// Plays a cue on every mute / deafen change, whatever triggered it (call
// controls, voice panel, profile card, keybinds, Element Call itself).
function CallToggleSounds({ embed }: { embed: CallEmbed }) {
  const joined = useCallJoined(embed);
  const { enabled, cue } = useCallCue();

  useEffect(() => {
    if (!joined || !enabled) return undefined;
    const { control } = embed;
    let { microphone, sound } = control;
    let ignoreMicUntil = 0;
    let ignoreSoundUntil = 0;

    const handleUpdate = () => {
      const now = Date.now();
      if (control.sound !== sound) {
        sound = control.sound;
        if (now >= ignoreSoundUntil) {
          cue(sound ? 'undeafen' : 'deafen', sound ? 'Undeafened' : 'Deafened');
          ignoreMicUntil = now + LINKED_TOGGLE_WINDOW_MS;
        }
      }
      if (control.microphone !== microphone) {
        microphone = control.microphone;
        if (now >= ignoreMicUntil) {
          cue(
            microphone ? 'unmute' : 'mute',
            microphone ? 'Microphone unmuted' : 'Microphone muted'
          );
          ignoreSoundUntil = now + LINKED_TOGGLE_WINDOW_MS;
        }
      }
    };

    control.on(CallControlEvent.StateUpdate, handleUpdate);
    return () => {
      control.off(CallControlEvent.StateUpdate, handleUpdate);
    };
  }, [embed, joined, enabled, cue]);

  return null;
}

// Element Call gives every screen share (local or remote) a spotlight item with
// a `data-id` ending in ":screen-share", in both grid and spotlight layouts.
const SCREEN_SHARE_SELECTOR = '[data-id$=":screen-share"]';
// Layout switches remount the spotlight tile; only cue a drop that sticks.
const SCREEN_SHARE_SETTLE_MS = 600;

// Plays a cue when any screen share in the call ends (Element Call already
// plays its own sound when one starts).
function ScreenShareEndedSound({ embed }: { embed: CallEmbed }) {
  const joined = useCallJoined(embed);
  const { enabled, cue } = useCallCue();

  useEffect(() => {
    const doc = embed.document;
    if (!joined || !enabled || !doc?.body) return undefined;

    const count = () => doc.querySelectorAll(SCREEN_SHARE_SELECTOR).length;
    let shares = count();
    let settleTimer: number | undefined;

    const observer = new MutationObserver(() => {
      const current = count();
      if (settleTimer !== undefined || current >= shares) {
        shares = Math.max(shares, current);
        return;
      }
      settleTimer = window.setTimeout(() => {
        settleTimer = undefined;
        const now = count();
        if (now < shares) cue('screenShareEnded', 'Screen share ended');
        shares = now;
      }, SCREEN_SHARE_SETTLE_MS);
    });
    observer.observe(doc.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
    };
  }, [embed, joined, enabled, cue]);

  return null;
}

// Push to talk keeps the mic open briefly after release so the end of a word isn't cut.
export const PTT_RELEASE_DELAY_MS = 200;

function GlobalKeybindsListener() {
  const callEmbed = useAtomValue(callEmbedAtom);
  const [toggleMute] = useSetting(settingsAtom, 'keybindToggleMute');
  const [toggleDeafen] = useSetting(settingsAtom, 'keybindToggleDeafen');
  const [pushToTalk] = useSetting(settingsAtom, 'keybindPushToTalk');
  const [toggleNoiseSuppression] = useSetting(settingsAtom, 'keybindToggleNoiseSuppression');
  const setNoiseSuppression = useSetSetting(settingsAtom, 'noiseSuppression');
  const prevMicRef = useRef<boolean | null>(null);

  useEffect(() => {
    let releaseTimer: number | undefined;
    const releasePtt = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = undefined;
      if (prevMicRef.current === null) return;
      const wasMuted = !prevMicRef.current;
      prevMicRef.current = null;
      if (wasMuted && callEmbed?.control.microphone) {
        callEmbed.control.toggleMicrophone();
      }
    };

    const handleKeyDown = (evt: KeyboardEvent) => {
      const target = evt.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable
      )
        return;

      // Noise suppression is a setting, so its hotkey works outside calls too.
      // The cue sound is played by NoiseSuppressionSync when the setting flips.
      if (toggleNoiseSuppression && isKeyHotkey(toggleNoiseSuppression, evt)) {
        evt.preventDefault();
        evt.stopPropagation();
        if (!evt.repeat) {
          setNoiseSuppression((on) => !on);
        }
      }

      if (!callEmbed) return;

      if (toggleMute && isKeyHotkey(toggleMute, evt)) {
        evt.preventDefault();
        evt.stopPropagation();
        callEmbed.control.toggleMicrophone();
      }
      if (toggleDeafen && isKeyHotkey(toggleDeafen, evt)) {
        evt.preventDefault();
        evt.stopPropagation();
        callEmbed.control.toggleSound();
      }
      if (pushToTalk && isKeyHotkey(pushToTalk, evt)) {
        evt.preventDefault();
        evt.stopPropagation();
        // Pressed again within the release delay: keep talking.
        window.clearTimeout(releaseTimer);
        releaseTimer = undefined;
        if (prevMicRef.current === null) {
          prevMicRef.current = callEmbed.control.microphone;
          if (!callEmbed.control.microphone) {
            callEmbed.control.toggleMicrophone();
          }
        }
      }
    };

    const handleKeyUp = (evt: KeyboardEvent) => {
      if (!callEmbed || !pushToTalk) return;
      if (isKeyHotkey(pushToTalk, evt)) {
        evt.stopPropagation();
        if (prevMicRef.current !== null && releaseTimer === undefined) {
          releaseTimer = window.setTimeout(releasePtt, PTT_RELEASE_DELAY_MS);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Element Call runs in its own browsing context, so keys pressed while the
    // call iframe has focus never reach the parent window. The iframe is
    // same-origin; listeners on its window are lost on navigation, so re-attach
    // on every load. Capture phase + stopPropagation keeps Element Call's own
    // shortcuts (m, space) from double-toggling when bound to the same key.
    const iframe = callEmbed?.iframe;
    let iframeWindow: Window | null = null;
    const detachIframe = () => {
      iframeWindow?.removeEventListener('keydown', handleKeyDown, true);
      iframeWindow?.removeEventListener('keyup', handleKeyUp, true);
      iframeWindow = null;
    };
    const attachIframe = () => {
      detachIframe();
      try {
        const win = iframe?.contentWindow;
        if (!win) return;
        win.addEventListener('keydown', handleKeyDown, true);
        win.addEventListener('keyup', handleKeyUp, true);
        iframeWindow = win;
      } catch {
        // cross-origin iframe: nothing we can listen to
      }
    };
    attachIframe();
    iframe?.addEventListener('load', attachIframe);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      iframe?.removeEventListener('load', attachIframe);
      detachIframe();
      releasePtt();
    };
  }, [
    callEmbed,
    toggleMute,
    toggleDeafen,
    pushToTalk,
    toggleNoiseSuppression,
    setNoiseSuppression,
  ]);

  return null;
}

type IncomingCallInfo = {
  room: Room;
  sender: string;
  senderTs: number;
  lifetime: number;
  intent?: string;
  notificationType: RTCNotificationType;
  refEventId: string;
};
type IncomingCallProps = {
  dm: boolean;
  info: IncomingCallInfo;
  onIgnore: () => void;
  onAnswer: (room: Room, video: boolean) => void;
  onReject: (room: Room, eventId: string) => void;
};
function IncomingCall({ dm, info, onIgnore, onAnswer, onReject }: IncomingCallProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const livekitSupported = useLivekitSupport();
  const rtcSupported = webRTCSupported();
  const canAnswer = livekitSupported && rtcSupported;
  const { room } = info;

  const audioRef = useRef<HTMLAudioElement>(null);

  const roomName = useRoomName(room);
  const roomAvatar = useRoomAvatar(room, dm);
  const avatarUrl = roomAvatar
    ? mxcUrlToHttp(mx, roomAvatar, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const session = useCallSession(room);
  useCallMembersChange(
    session,
    useCallback(
      (members) => {
        if (members.length === 0) {
          onIgnore();
        }
      },
      [onIgnore]
    )
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    if (info.notificationType === 'ring') {
      playSound();
    }
  }, [playSound, info.notificationType]);

  return (
    <>
      <Overlay open backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => onIgnore(),
              clickOutsideDeactivates: false,
              escapeDeactivates: false,
            }}
          >
            <Dialog style={{ maxWidth: toRem(324) }}>
              <Box style={{ padding: config.space.S400 }} direction="Column" gap="700">
                <Text size="T200" align="Center">
                  {info.sender}
                </Text>
                <Box direction="Column" gap="500" alignItems="Center">
                  <Box shrink="No">
                    <Avatar size="500" className={CallAvatarAnimation}>
                      <RoomAvatar
                        roomId={room.roomId}
                        src={avatarUrl}
                        alt={roomName}
                        renderFallback={() => (
                          <RoomIcon
                            roomType={room.getType()}
                            size="400"
                            joinRule={room.getJoinRule()}
                            filled
                          />
                        )}
                      />
                    </Avatar>
                  </Box>
                  <Box grow="Yes" direction="Column" gap="100" alignItems="Center">
                    <Text size="H3" align="Center" truncate>
                      {roomName}
                    </Text>
                    <Text size="T300" align="Center">
                      Incoming Call
                    </Text>
                  </Box>
                </Box>
                {!livekitSupported && (
                  <Text
                    style={{ margin: 'auto', color: color.Critical.Main }}
                    size="L400"
                    align="Center"
                  >
                    Your homeserver does not support calling.
                  </Text>
                )}
                {!webRTCSupported && (
                  <Text
                    style={{ margin: 'auto', color: color.Critical.Main }}
                    size="L400"
                    align="Center"
                  >
                    Your browser does not support WebRTC, which is required for calling.
                  </Text>
                )}
                <Box direction="Column" gap="300">
                  <Button
                    style={{ flexGrow: 1 }}
                    variant="Success"
                    size="400"
                    radii="400"
                    onClick={() => onAnswer(room, info.intent === 'video')}
                    before={
                      <Icon
                        size="200"
                        src={info.intent === 'video' ? Icons.VideoCamera : Icons.Phone}
                        filled
                      />
                    }
                    disabled={!canAnswer}
                  >
                    <Text as="span" size="B400">
                      Answer
                    </Text>
                  </Button>
                  <Button
                    style={{ flexGrow: 1 }}
                    variant={dm ? 'Critical' : 'Secondary'}
                    fill="Soft"
                    size="400"
                    radii="400"
                    onClick={() => (dm ? onReject(room, info.refEventId) : onIgnore())}
                    before={<Icon size="200" src={Icons.Cross} filled />}
                  >
                    <Text as="span" size="B400">
                      {dm ? 'Reject' : 'Ignore'}
                    </Text>
                  </Button>
                </Box>
              </Box>
            </Dialog>
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
      <audio ref={audioRef} loop style={{ display: 'none' }}>
        <source src={CallSound} type="audio/ogg" />
      </audio>
    </>
  );
}

type IncomingCallListenerProps = {
  callEmbed?: CallEmbed;
  joined?: boolean;
};
function IncomingCallListener({ callEmbed, joined }: IncomingCallListenerProps) {
  const mx = useMatrixClient();
  const directs = useAtomValue(mDirectAtom);
  const { navigateRoom } = useRoomNavigate();

  const [callInfo, setCallInfo] = useState<IncomingCallInfo>();
  const dm = callInfo ? directs.has(callInfo.room.roomId) : false;
  const startCall = useCallStart(dm);

  const handleTimelineEvent: EventTimelineSetHandlerMap[RoomEvent.Timeline] = useCallback(
    async (event, room, toStartOfTimeline, removed, data) => {
      // only process rtc notification reference events.
      // we do not want to wait to decrypt all events.
      if (event.getRelation()?.rel_type !== RelationType.Reference) return;
      if (room?.isCallRoom()) return;

      if (event.isEncrypted()) {
        if (!event.isBeingDecrypted()) {
          await event.attemptDecryption(mx.getCrypto() as CryptoBackend);
        }
        await event.getDecryptionPromise();
      }

      if (
        !room ||
        event.getType() !== EventType.RTCNotification ||
        event.getSender() === mx.getSafeUserId() ||
        !data.liveEvent
      ) {
        return;
      }

      const sender = event.getSender();
      const content = event.getContent<IRTCNotificationContent>();
      const senderTs =
        content.sender_ts - event.getTs() > 20000 ? event.getTs() : content.sender_ts;
      const lifetime = Math.min(content.lifetime, 120000);
      const notificationType = content.notification_type;
      const relation =
        event.getRelation()?.rel_type === RelationType.Reference ? event.getRelation() : undefined;
      const refEventId = relation?.event_id;

      const mention =
        content['m.mentions']?.room ||
        content['m.mentions']?.user_ids?.includes(mx.getSafeUserId());
      if (!sender || !refEventId || !mention || Date.now() >= senderTs + lifetime) {
        return;
      }

      const powerLevelsEvent = getStateEvent(room, StateEvent.RoomPowerLevels);
      const powerLevels = getPowersLevelFromMatrixEvent(powerLevelsEvent);
      const creators = getRoomCreatorsForRoomId(mx, room.roomId);
      const permissions = getRoomPermissionsAPI(creators, powerLevels);

      const hasCallPermission = permissions.stateEvent(
        StateEvent.GroupCallMemberPrefix,
        mx.getSafeUserId()
      );
      if (!hasCallPermission) return;

      const info: IncomingCallInfo = {
        room,
        sender,
        senderTs,
        lifetime,
        intent:
          'm.call.intent' in content && typeof content['m.call.intent'] === 'string'
            ? content['m.call.intent']
            : undefined,
        notificationType,
        refEventId,
      };

      setCallInfo(info);
    },
    [mx]
  );

  useEffect(() => {
    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [mx, handleTimelineEvent]);

  const handleIgnore = useCallback(() => {
    setCallInfo(undefined);
  }, []);

  const handleReject = useCallback(
    (room: Room, eventId: string) => {
      mx.sendEvent(room.roomId, EventType.RTCDecline, {
        'm.relates_to': {
          rel_type: RelationType.Reference,
          event_id: eventId,
        },
      });
      setCallInfo(undefined);
    },
    [mx]
  );

  const handleAnswer = useCallback(
    (room: Room, video: boolean) => {
      startCall(room, { microphone: true, video, sound: true });
      setCallInfo(undefined);
      navigateRoom(room.roomId);
    },
    [startCall, navigateRoom]
  );

  if (callInfo && callEmbed?.roomId === callInfo.room.roomId) {
    return null;
  }
  return !joined && callInfo ? (
    <IncomingCall
      dm={dm}
      info={callInfo}
      onIgnore={handleIgnore}
      onAnswer={handleAnswer}
      onReject={handleReject}
    />
  ) : null;
}

// Visual call cue for people joining or leaving the call we are in (Element
// Call plays the sounds itself).
function CallMemberCues({ embed }: { embed: CallEmbed }) {
  const joined = useCallJoined(embed);
  const [captions] = useSetting(settingsAtom, 'visualCallCues');
  const session = useCallSession(embed.room);
  const usersRef = useRef<Set<string>>();

  const active = joined && captions;
  useEffect(() => {
    usersRef.current = active
      ? new Set(session.memberships.map((m) => m.sender).filter((s): s is string => !!s))
      : undefined;
  }, [active, session]);

  useCallMembersChange(
    session,
    useCallback(
      (memberships) => {
        const prev = usersRef.current;
        if (!prev) return;
        const next = new Set(memberships.map((m) => m.sender).filter((s): s is string => !!s));
        usersRef.current = next;
        const myUserId = embed.room.client.getUserId();
        const name = (userId: string) =>
          getMemberDisplayName(embed.room, userId) ?? getMxIdLocalPart(userId) ?? userId;
        next.forEach((userId) => {
          if (!prev.has(userId) && userId !== myUserId) showCallCue(`${name(userId)} joined`);
        });
        prev.forEach((userId) => {
          if (!next.has(userId) && userId !== myUserId) showCallCue(`${name(userId)} left`);
        });
      },
      [embed]
    )
  );

  return null;
}

const CALL_CUE_MS = 2500;
const MAX_CALL_CUES = 3;

// Captions from showCallCue (Settings > Accessibility > Visual call cues).
function CallCueCaptions() {
  const [captions] = useSetting(settingsAtom, 'visualCallCues');
  const [cues, setCues] = useState<Array<{ id: number; text: string }>>([]);

  useEffect(() => {
    if (!captions) {
      setCues([]);
      return undefined;
    }
    let nextId = 0;
    const timers = new Set<number>();
    const handleCue = (evt: Event) => {
      const text = (evt as CustomEvent<string>).detail;
      if (typeof text !== 'string') return;
      nextId += 1;
      const id = nextId;
      setCues((current) => [...current, { id, text }].slice(-MAX_CALL_CUES));
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setCues((current) => current.filter((c) => c.id !== id));
      }, CALL_CUE_MS);
      timers.add(timer);
    };
    window.addEventListener(CALL_CUE_EVENT, handleCue);
    return () => {
      window.removeEventListener(CALL_CUE_EVENT, handleCue);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [captions]);

  if (!captions) return null;
  return (
    <Box
      role="status"
      aria-live="polite"
      direction="Column"
      alignItems="Center"
      gap="100"
      style={{
        position: 'fixed',
        left: '50%',
        top: config.space.S400,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {cues.map((cue) => (
        <Box
          key={cue.id}
          alignItems="Center"
          gap="200"
          style={{
            padding: `${config.space.S200} ${config.space.S400}`,
            borderRadius: config.radii.Pill,
            background: color.Surface.Container,
            color: color.Surface.OnContainer,
            border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          }}
        >
          <Icon size="100" src={Icons.Phone} />
          <Text size="T300">{cue.text}</Text>
        </Box>
      ))}
    </Box>
  );
}

const MODERATION_NOTICE_MS = 6000;

// Obeys moderator disconnect / move commands for the call we are in. Only
// commands for that call, from someone who could kick us there, are acted on;
// anything else is dropped silently.
function CallModerationListener() {
  const mx = useMatrixClient();
  const store = useStore();
  const startCall = useCallStart();
  const { navigateRoom } = useRoomNavigate();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    const handleToDevice = (event: MatrixEvent) => {
      if (event.getType() !== CALL_MODERATION_EVENT) return;
      const command = parseCallModeration(event.getContent());
      const sender = event.getSender();
      const myUserId = mx.getUserId();
      const embed = store.get(callEmbedAtom);
      if (!command || !sender || !myUserId || !embed) return;
      if (embed.roomId !== command.room_id) return;
      const room = mx.getRoom(command.room_id);
      if (!room || !canModerateCall(mx, room, sender, myUserId)) return;

      const by = room.getMember(sender)?.name ?? sender;
      if (command.action === 'move' && command.target_room_id) {
        const target = mx.getRoom(command.target_room_id);
        const canMove =
          target &&
          target.isCallRoom() &&
          target.getMyMembership() === KnownMembership.Join &&
          target.getMember(sender)?.membership === KnownMembership.Join;
        if (target && canMove) {
          startCall(target).catch(() => undefined);
          navigateRoom(target.roomId);
          setNotice(`Moved to ${target.name} by ${by}.`);
          return;
        }
        embed.hangup().catch(() => undefined);
        setNotice(`Disconnected by ${by}. You aren't in the voice channel they moved you to.`);
        return;
      }
      embed.hangup().catch(() => undefined);
      setNotice(`Disconnected by ${by}.`);
    };

    mx.on(ClientEvent.ToDeviceEvent, handleToDevice);
    return () => {
      mx.off(ClientEvent.ToDeviceEvent, handleToDevice);
    };
  }, [mx, store, startCall, navigateRoom]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(undefined), MODERATION_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <Box
      role="status"
      aria-live="polite"
      alignItems="Center"
      gap="200"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: config.space.S400,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: toRem(360),
        padding: `${config.space.S300} ${config.space.S400}`,
        borderRadius: config.radii.R400,
        background: color.Surface.Container,
        color: color.Surface.OnContainer,
        border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      }}
    >
      <Icon size="200" src={Icons.Phone} />
      <Text size="T300">{notice}</Text>
    </Box>
  );
}

function CallUtils({ embed }: { embed: CallEmbed }) {
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const store = useStore();

  useCallMemberSoundSync(embed);
  useCallThemeSync(embed);
  useCallHangupEvent(
    embed,
    useCallback(() => {
      // A channel switch may already have replaced this embed with the next call.
      if (store.get(callEmbedAtom) === embed) setCallEmbed(undefined);
    }, [store, embed, setCallEmbed])
  );

  return null;
}

type CallEmbedProviderProps = {
  children?: ReactNode;
};
export function CallEmbedProvider({ children }: CallEmbedProviderProps) {
  const callEmbed = useAtomValue(callEmbedAtom);
  const callEmbedRef = useRef<HTMLDivElement>(null);
  const joined = useCallJoined(callEmbed);

  const selectedRoom = useSelectedRoom();
  const chat = useAtomValue(callChatAtom);
  const screenSize = useScreenSizeContext();

  const chatOnlyView = chat && screenSize !== ScreenSize.Desktop;

  const callVisible = callEmbed && selectedRoom === callEmbed.roomId && joined && !chatOnlyView;

  return (
    <CallEmbedContextProvider value={callEmbed}>
      {callEmbed && <CallUtils embed={callEmbed} />}
      {callEmbed && <CallToggleSounds embed={callEmbed} />}
      {callEmbed && <ScreenShareEndedSound embed={callEmbed} />}
      {callEmbed && <CallMemberCues embed={callEmbed} />}
      <CallCueCaptions />
      <CallEmbedRefContextProvider value={callEmbedRef}>
        <IncomingCallListener callEmbed={callEmbed} joined={joined} />
        <CallModerationListener />
        <GlobalKeybindsListener />
        <NoiseSuppressionSync />
        {children}
      </CallEmbedRefContextProvider>
      <div
        data-call-embed-container
        style={{
          // The call embed must never spawn a full-screen overlay that blocks
          // navigation. It starts at 0x0 and is sized into the room's call view
          // by `useCallEmbedPlacementSync`; `pointer-events: none` guarantees the
          // embedded iframe never intercepts clicks (all controls are driven by
          // Zennith's own pill bar + status card).
          visibility: callVisible ? undefined : 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        ref={callEmbedRef}
      />
    </CallEmbedContextProvider>
  );
}
