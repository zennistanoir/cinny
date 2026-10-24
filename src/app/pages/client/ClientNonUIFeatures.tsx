import { useAtomValue, useSetAtom } from 'jotai';
import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatrixEvent, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { roomToUnreadAtom, unreadEqual, unreadInfoToUnread } from '../../state/room/roomToUnread';
import LogoPNG from '../../../../public/res/png/zennith.png';
import LogoUnreadPNG from '../../../../public/res/png/zennith-unread.png';
import LogoHighlightPNG from '../../../../public/res/png/zennith-highlight.png';
import NotificationSound from '../../../../public/sound/notification.ogg';
import InviteSound from '../../../../public/sound/invite.ogg';
import { notificationPermission, setFavicon } from '../../utils/dom';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { usePreviousValue } from '../../hooks/usePreviousValue';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getInboxInvitesPath, getInboxNotificationsPath } from '../pathUtils';
import {
  getMemberDisplayName,
  getNotificationType,
  getUnreadInfo,
  isNotificationEvent,
} from '../../utils/room';
import { NotificationType, UnreadInfo } from '../../../types/matrix/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import { useInboxNotificationsSelected } from '../../hooks/router/useInbox';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { DesktopIntegration, setUnreadBadge } from '../../plugins/desktop';
import { WebUpdatePrompt } from '../../components/update-toast/WebUpdatePrompt';
import { WhatsNew } from '../../features/whats-new/WhatsNew';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import '../../styles/accessibility.css';
import { useNotificationsSilenced } from '../../hooks/useNotificationsSilenced';
import { ownStatusAtom } from '../../state/ownStatus';
import { applyOwnStatus, getOwnStatus, getSharedStatus } from '../../utils/ownStatus';
import { useAccountDataCallback } from '../../hooks/useAccountDataCallback';
import { AccountDataEvent } from '../../../types/matrix/accountData';

function SystemEmojiFeature() {
  const [twitterEmoji] = useSetting(settingsAtom, 'twitterEmoji');

  if (twitterEmoji) {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji');
  } else {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji_DISABLED');
  }

  return null;
}

function PageZoomFeature() {
  const [pageZoom] = useSetting(settingsAtom, 'pageZoom');

  if (pageZoom === 100) {
    document.documentElement.style.removeProperty('font-size');
  } else {
    document.documentElement.style.setProperty('font-size', `calc(1em * ${pageZoom / 100})`);
  }

  return null;
}

const LINE_SPACING = { normal: 1, relaxed: 1.2, loose: 1.45 } as const;

// Settings > Accessibility: data attributes on <html> read by styles/accessibility.css.ts.
function AccessibilityFeature() {
  const theme = useTheme();
  const [reducedMotion] = useSetting(settingsAtom, 'reducedMotion');
  const [highContrast] = useSetting(settingsAtom, 'highContrast');
  const [focusRings] = useSetting(settingsAtom, 'focusRings');
  const [underlineLinks] = useSetting(settingsAtom, 'underlineLinks');
  const [messageTextSize] = useSetting(settingsAtom, 'messageTextSize');
  const [lineSpacing] = useSetting(settingsAtom, 'lineSpacing');
  const [largeEmoji] = useSetting(settingsAtom, 'largeEmoji');
  const [readableFont] = useSetting(settingsAtom, 'readableFont');
  const [alwaysShowHoverControls] = useSetting(settingsAtom, 'alwaysShowHoverControls');

  useEffect(() => {
    const root = document.documentElement;
    const setAttr = (name: string, value: string | false) => {
      if (value === false) root.removeAttribute(name);
      else root.setAttribute(name, value);
    };

    setAttr('data-motion', reducedMotion !== 'system' && reducedMotion);
    setAttr(
      'data-high-contrast',
      highContrast && (theme.kind === ThemeKind.Dark ? 'dark' : 'light')
    );
    setAttr('data-focus-rings', focusRings && '');
    setAttr('data-underline-links', underlineLinks && '');
    setAttr('data-large-emoji', largeEmoji && '');
    setAttr('data-readable-font', readableFont && '');
    setAttr('data-hover-controls', alwaysShowHoverControls && '');

    const customText = messageTextSize !== '100' || lineSpacing !== 'normal';
    setAttr('data-message-text', customText && '');
    if (customText) {
      root.style.setProperty('--zennith-msg-scale', `${Number(messageTextSize) / 100}`);
      root.style.setProperty('--zennith-msg-spacing', `${LINE_SPACING[lineSpacing]}`);
    } else {
      root.style.removeProperty('--zennith-msg-scale');
      root.style.removeProperty('--zennith-msg-spacing');
    }
  }, [
    theme.kind,
    reducedMotion,
    highContrast,
    focusRings,
    underlineLinks,
    messageTextSize,
    lineSpacing,
    largeEmoji,
    readableFont,
    alwaysShowHoverControls,
  ]);

  return null;
}

function FaviconUpdater() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    let notification = false;
    let highlight = false;
    roomToUnread.forEach((unread) => {
      if (unread.total > 0) {
        notification = true;
      }
      if (unread.highlight > 0) {
        highlight = true;
      }
    });

    // setUnreadBadge: taskbar badge in the desktop app.
    if (notification) {
      setFavicon(highlight ? LogoHighlightPNG : LogoUnreadPNG);
      setUnreadBadge(highlight ? 'highlight' : 'unread');
    } else {
      setFavicon(LogoPNG);
      setUnreadBadge('none');
    }
  }, [roomToUnread]);

  return null;
}

// Keeps ownStatusAtom in step with this device's pick and with picks made on other devices.
function OwnStatusSync() {
  const mx = useMatrixClient();
  const setStatus = useSetAtom(ownStatusAtom);

  const followShared = useCallback(() => {
    const userId = mx.getSafeUserId();
    const shared = getSharedStatus(mx);
    if (!shared || shared === getOwnStatus(userId)) {
      setStatus(getOwnStatus(userId));
      return;
    }
    setStatus(shared);
    applyOwnStatus(mx, shared).catch(() => undefined);
  }, [mx, setStatus]);
  useEffect(followShared, [followShared]);
  useAccountDataCallback(
    mx,
    useCallback(
      (evt: MatrixEvent) => {
        if (evt.getType() === AccountDataEvent.ZennithStatus) followShared();
      },
      [followShared]
    )
  );

  return null;
}

function InviteNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const invites = useAtomValue(allInvitesAtom);
  const perviousInviteLen = usePreviousValue(invites.length, 0);
  const mx = useMatrixClient();

  const navigate = useNavigate();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');
  const isSilenced = useNotificationsSilenced();

  const notify = useCallback(
    (count: number) => {
      const noti = new window.Notification('Invitation', {
        icon: LogoPNG,
        badge: LogoPNG,
        body: `You have ${count} new invitation request.`,
        silent: true,
      });

      noti.onclick = () => {
        if (!window.closed) navigate(getInboxInvitesPath());
        noti.close();
      };
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    if (invites.length > perviousInviteLen && mx.getSyncState() === 'SYNCING') {
      if (isSilenced()) return;
      if (showNotifications && notificationPermission('granted')) {
        notify(invites.length - perviousInviteLen);
      }

      if (notificationSound) {
        playSound();
      }
    }
  }, [
    mx,
    invites,
    perviousInviteLen,
    showNotifications,
    notificationSound,
    notify,
    playSound,
    isSilenced,
  ]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={InviteSound} type="audio/ogg" />
    </audio>
  );
}

function MessageNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const notifRef = useRef<Notification>();
  const unreadCacheRef = useRef<Map<string, UnreadInfo>>(new Map());
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');
  const isSilenced = useNotificationsSilenced();

  const navigate = useNavigate();
  const notificationSelected = useInboxNotificationsSelected();
  const selectedRoomId = useSelectedRoom();

  const notify = useCallback(
    ({
      roomName,
      roomAvatar,
      username,
    }: {
      roomName: string;
      roomAvatar?: string;
      username: string;
      roomId: string;
      eventId: string;
    }) => {
      const noti = new window.Notification(roomName, {
        icon: roomAvatar,
        badge: roomAvatar,
        body: `New inbox notification from ${username}`,
        silent: true,
      });

      noti.onclick = () => {
        if (!window.closed) navigate(getInboxNotificationsPath());
        noti.close();
        notifRef.current = undefined;
      };

      notifRef.current?.close();
      notifRef.current = noti;
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      room,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (mx.getSyncState() !== 'SYNCING') return;
      if (document.hasFocus() && (selectedRoomId === room?.roomId || notificationSelected)) return;
      if (
        !room ||
        !data.liveEvent ||
        room.isSpaceRoom() ||
        !isNotificationEvent(mEvent) ||
        getNotificationType(mx, room.roomId) === NotificationType.Mute
      ) {
        return;
      }

      const sender = mEvent.getSender();
      const eventId = mEvent.getId();
      if (!sender || !eventId || mEvent.getSender() === mx.getUserId()) return;
      const unreadInfo = getUnreadInfo(room);
      const cachedUnreadInfo = unreadCacheRef.current.get(room.roomId);
      unreadCacheRef.current.set(room.roomId, unreadInfo);

      if (unreadInfo.total === 0) return;
      if (
        cachedUnreadInfo &&
        unreadEqual(unreadInfoToUnread(cachedUnreadInfo), unreadInfoToUnread(unreadInfo))
      ) {
        return;
      }
      // Checked after the unread cache update so the next event still compares correctly.
      if (isSilenced()) return;

      if (showNotifications && notificationPermission('granted')) {
        const avatarMxc =
          room.getAvatarFallbackMember()?.getMxcAvatarUrl() ?? room.getMxcAvatarUrl();
        notify({
          roomName: room.name ?? 'Unknown',
          roomAvatar: avatarMxc
            ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
            : undefined,
          username: getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender) ?? sender,
          roomId: room.roomId,
          eventId,
        });
      }

      if (notificationSound) {
        playSound();
      }
    };
    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [
    mx,
    notificationSound,
    notificationSelected,
    showNotifications,
    playSound,
    notify,
    selectedRoomId,
    useAuthentication,
    isSilenced,
  ]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={NotificationSound} type="audio/ogg" />
    </audio>
  );
}

type ClientNonUIFeaturesProps = {
  children: ReactNode;
};

export function ClientNonUIFeatures({ children }: ClientNonUIFeaturesProps) {
  return (
    <>
      <SystemEmojiFeature />
      <PageZoomFeature />
      <AccessibilityFeature />
      <FaviconUpdater />
      <OwnStatusSync />
      <InviteNotifications />
      <MessageNotifications />
      <DesktopIntegration />
      <WebUpdatePrompt />
      <WhatsNew />
      {children}
    </>
  );
}
