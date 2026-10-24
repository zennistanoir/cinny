import { createContext, RefObject, useCallback, useContext, useEffect, useState } from 'react';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { useSetAtom, useStore } from 'jotai';
import {
  CallEmbed,
  ElementCallThemeKind,
  ElementWidgetActions,
  useClientWidgetApiEvent,
} from '../plugins/call';
import { useMatrixClient } from './useMatrixClient';
import { ThemeKind, useTheme } from './useTheme';
import { callEmbedAtom } from '../state/callEmbed';
import { useResizeObserver } from './useResizeObserver';
import { CallControlState } from '../plugins/call/CallControlState';
import { useCallMembersChange, useCallSession } from './useCall';
import { CallPreferences } from '../state/callPreferences';

const CallEmbedContext = createContext<CallEmbed | undefined>(undefined);

export const CallEmbedContextProvider = CallEmbedContext.Provider;

export const useCallEmbed = (): CallEmbed | undefined => {
  const callEmbed = useContext(CallEmbedContext);

  return callEmbed;
};

const CallEmbedRefContext = createContext<RefObject<HTMLDivElement> | undefined>(undefined);
export const CallEmbedRefContextProvider = CallEmbedRefContext.Provider;
export const useCallEmbedRef = (): RefObject<HTMLDivElement> => {
  const ref = useContext(CallEmbedRefContext);
  if (!ref) {
    throw new Error('CallEmbedRef is not provided!');
  }
  return ref;
};

export const createCallEmbed = (
  mx: MatrixClient,
  room: Room,
  dm: boolean,
  themeKind: ElementCallThemeKind,
  container: HTMLElement,
  pref?: CallPreferences
): CallEmbed => {
  const rtcSession = mx.matrixRTC.getRoomSession(room);
  const ongoing = rtcSession.memberships.length > 0;

  const intent = CallEmbed.getIntent(dm, ongoing, pref?.video);
  const widget = CallEmbed.getWidget(mx, room, intent, themeKind);
  const controlState = pref && new CallControlState(pref.microphone, pref.video, pref.sound);

  const embed = new CallEmbed(mx, room, widget, container, controlState);

  return embed;
};

// Resolves once Element Call reports the call ended, or after the timeout.
const waitForCallEnd = (embed: CallEmbed, timeoutMs = 3000): Promise<void> =>
  new Promise((resolve) => {
    const offs: Array<() => void> = [];
    let timer: number | undefined;
    const done = () => {
      window.clearTimeout(timer);
      offs.forEach((off) => off());
      resolve();
    };
    timer = window.setTimeout(done, timeoutMs);
    offs.push(embed.listenAction(ElementWidgetActions.HangupCall, done));
    offs.push(embed.listenAction(ElementWidgetActions.Close, done));
  });

// Bumped on every start so a slower switch can't override a newer one.
let startSeq = 0;

export const useCallStart = (dm = false) => {
  const mx = useMatrixClient();
  const theme = useTheme();
  const store = useStore();
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const callEmbedRef = useCallEmbedRef();

  const startCall = useCallback(
    async (room: Room, pref?: CallPreferences) => {
      const container = callEmbedRef.current;
      if (!container) {
        throw new Error('Failed to start call, No embed container element found!');
      }
      startSeq += 1;
      const seq = startSeq;

      // Already in a call elsewhere: leave it properly first, so our membership is
      // removed from that room instead of lingering as a ghost, and keep the
      // current mute/deafen state for the new channel. Video follows the request.
      let nextPref = pref;
      const current = store.get(callEmbedAtom);
      if (current && current.roomId !== room.roomId && current.joined) {
        const { microphone, video, sound } = current.control;
        nextPref = { microphone, sound, video: pref?.video ?? video };
        const ended = waitForCallEnd(current);
        current.hangup().catch(() => undefined);
        await ended;
        if (seq !== startSeq) return;
      }

      setCallEmbed(createCallEmbed(mx, room, dm, theme.kind, container, nextPref));
    },
    [mx, dm, theme, store, setCallEmbed, callEmbedRef]
  );

  return startCall;
};

export const useCallJoined = (embed?: CallEmbed): boolean => {
  const [joined, setJoined] = useState(embed?.joined ?? false);

  useClientWidgetApiEvent(
    embed?.call,
    ElementWidgetActions.JoinCall,
    useCallback(() => {
      setJoined(true);
    }, [])
  );

  useEffect(() => {
    if (!embed) {
      setJoined(false);
    }
  }, [embed]);

  return joined;
};

export const useCallHangupEvent = (embed: CallEmbed, callback: () => void) => {
  useClientWidgetApiEvent(embed.call, ElementWidgetActions.HangupCall, callback);
  useClientWidgetApiEvent(embed.call, ElementWidgetActions.Close, callback);
};

export const useCallMemberSoundSync = (embed: CallEmbed) => {
  const callSession = useCallSession(embed.room);
  useCallMembersChange(
    callSession,
    useCallback(() => embed.control.applySound(), [embed])
  );
};

export const useCallThemeSync = (embed: CallEmbed) => {
  const theme = useTheme();

  useEffect(() => {
    const name: ElementCallThemeKind = theme.kind === ThemeKind.Dark ? 'dark' : 'light';

    embed.setTheme(name);
  }, [theme.kind, embed]);
};

export const useCallEmbedPlacementSync = (containerViewRef: RefObject<HTMLDivElement>): void => {
  const callEmbedRef = useCallEmbedRef();

  const syncCallEmbedPlacement = useCallback(() => {
    const embedEl = callEmbedRef.current;
    const container = containerViewRef.current;
    if (!embedEl || !container) return;

    embedEl.style.top = `${container.offsetTop}px`;
    embedEl.style.left = `${container.offsetLeft}px`;
    embedEl.style.width = `${container.clientWidth}px`;
    embedEl.style.height = `${container.clientHeight}px`;
  }, [callEmbedRef, containerViewRef]);

  useResizeObserver(
    syncCallEmbedPlacement,
    useCallback(() => containerViewRef.current, [containerViewRef])
  );
};
