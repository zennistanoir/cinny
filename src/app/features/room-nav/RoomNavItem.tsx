import React, { MouseEventHandler, forwardRef, useEffect, useState } from 'react';

// Inject voice-channel participant tree styles once globally.
// Uses !important to override folds NavItem display:flex.
let voiceTreeStylesInjected = false;
function injectVoiceTreeStyles() {
  if (voiceTreeStylesInjected || typeof document === 'undefined') return;
  voiceTreeStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'zennith-voice-tree';
  style.textContent = [
    '.zennith-voice-channel-block {',
    '  display: flex !important;',
    '  flex-direction: column !important;',
    '  width: 100% !important;',
    '  margin-bottom: 2px !important;',
    '}',
    '.zennith-channel-header-row {',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  justify-content: space-between !important;',
    '  height: 34px !important;',
    '  padding: 0 8px !important;',
    '  border-radius: 4px !important;',
    '  width: 100% !important;',
    '  background: transparent;',
    '  cursor: pointer;',
    '  overflow: hidden !important;',
    '}',
    '.channel-title-group {',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  gap: 8px !important;',
    '  min-width: 0 !important;',
    '  flex: 1;',
    '}',
    '.channel-name {',
    '  font-size: 14px !important;',
    '  color: #949ba4 !important;',
    '  white-space: nowrap !important;',
    '  overflow: hidden !important;',
    '  text-overflow: ellipsis !important;',
    '}',
    '.zennith-voice-user-tree {',
    '  display: flex !important;',
    '  flex-direction: column !important;',
    '  width: 100% !important;',
    '  padding-left: 28px !important;',
    '  margin-top: 2px !important;',
    '  gap: 2px !important;',
    '}',
    '.zennith-voice-user-item {',
    '  display: flex !important;',
    '  align-items: center !important;',
    '  gap: 8px !important;',
    '  height: 28px !important;',
    '  width: 100% !important;',
    '  border-radius: 4px !important;',
    '  padding: 0 6px !important;',
    '}',
    '.zennith-voice-user-item:hover {',
    '  background: rgba(255, 255, 255, 0.05) !important;',
    '}',
    '.zennith-voice-avatar {',
    '  width: 20px !important;',
    '  height: 20px !important;',
    '  min-width: 20px !important;',
    '  min-height: 20px !important;',
    '  max-width: 20px !important;',
    '  max-height: 20px !important;',
    '  border-radius: 50% !important;',
    '  object-fit: cover !important;',
    '  flex-shrink: 0 !important;',
    '  overflow: hidden !important;',
    '}',
    // Ring drawn with box-shadow so it never shifts the row's layout.
    '.zennith-voice-avatar {',
    '  transition: box-shadow 120ms ease-out;',
    '}',
    '.zennith-voice-avatar.speaking {',
    '  box-shadow: 0 0 0 2px #23a55a, 0 0 6px 1px rgba(35, 165, 90, 0.6) !important;',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  .zennith-voice-avatar { transition: none; }',
    '}',
    '.zennith-voice-live {',
    '  flex-shrink: 0;',
    '  margin-left: auto;',
    '  background: #f23f43;',
    '  color: #fff;',
    '  border-radius: 4px;',
    '  padding: 0 4px;',
    '  font-size: 10px;',
    '  font-weight: 700;',
    '  letter-spacing: 0.04em;',
    '  line-height: 15px;',
    '}',
    '.zennith-voice-volume-row {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '}',
    '.zennith-voice-volume-row input[type=range] {',
    '  flex: 1;',
    '  min-width: 0;',
    '  accent-color: #23a55a;',
    '  cursor: pointer;',
    '}',
    '.zennith-voice-avatar img {',
    '  width: 100% !important;',
    '  height: 100% !important;',
    '  object-fit: cover !important;',
    '}',
    '.zennith-voice-username {',
    '  flex: 1;',
    '  min-width: 0;',
    '  font-size: 13px !important;',
    '  color: #dbdee1 !important;',
    '  white-space: nowrap !important;',
    '  overflow: hidden !important;',
    '  text-overflow: ellipsis !important;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}
import { Room } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Text,
  Menu,
  MenuItem,
  config,
  PopOut,
  toRem,
  Line,
  RectCords,
  Badge,
  Spinner,
} from 'folds';
import { useFocusWithin, useHover } from 'react-aria';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue } from 'jotai';
import { NavItem, NavItemContent, NavItemOptions, NavLink } from '../../components/nav';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { getDirectRoomAvatarUrl, getRoomAvatarUrl, getStateEvent } from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { getPowersLevelFromMatrixEvent, usePowerLevels } from '../../hooks/usePowerLevels';
import { copyToClipboard } from '../../utils/dom';
import { markAsRead } from '../../utils/notifications';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { TypingIndicator } from '../../components/typing-indicator';
import { stopPropagation } from '../../utils/keyboard';
import { getMatrixToRoom } from '../../plugins/matrix-to';
import { getCanonicalAliasOrRoomId, getMxIdLocalPart, isRoomAlias, mxcUrlToHttp } from '../../utils/matrix';
import { getViaServers } from '../../plugins/via-servers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import {
  getRoomNotificationModeIcon,
  RoomNotificationMode,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import { getRoomCreatorsForRoomId, useRoomCreators } from '../../hooks/useRoomCreators';
import { getRoomPermissionsAPI, useRoomPermissions } from '../../hooks/useRoomPermissions';
import { InviteUserPrompt } from '../../components/invite-user-prompt';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { useCallEmbed, useCallStart } from '../../hooks/useCallEmbed';
import { callChatAtom } from '../../state/callEmbed';
import { useCallPreferencesAtom } from '../../state/hooks/callPreferences';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import { livekitSupport } from '../../hooks/useLivekitSupport';
import { StateEvent } from '../../../types/matrix/room';
import { webRTCSupported } from '../../utils/rtc';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { setUserVolume, useCallPresence, useUserVolume } from '../../plugins/call/ecBridge';
import { UserAvatar } from '../../components/user-avatar';

function CallMemberVolume({ userId, displayName }: { userId: string; displayName: string }) {
  const volume = useUserVolume(userId);
  const percent = Math.round(volume * 100);

  return (
    <Menu style={{ width: toRem(220) }}>
      <Box direction="Column" gap="200" style={{ padding: config.space.S300 }}>
        <Text size="L400" truncate>
          {displayName}
        </Text>
        <div className="zennith-voice-volume-row">
          <IconButton
            size="300"
            radii="300"
            variant="Surface"
            fill="None"
            aria-label={percent === 0 ? 'Unmute user' : 'Mute user'}
            aria-pressed={percent === 0}
            onClick={() => setUserVolume(userId, percent === 0 ? 1 : 0)}
          >
            <Icon size="100" src={percent === 0 ? Icons.VolumeMute : Icons.VolumeHigh} />
          </IconButton>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            aria-label={`Volume for ${displayName}`}
            aria-valuetext={`${percent}%`}
            onChange={(evt) => setUserVolume(userId, Number(evt.currentTarget.value) / 100)}
          />
          <Text size="T200" style={{ minWidth: toRem(34), textAlign: 'right' }}>
            {percent}%
          </Text>
        </div>
        <Text size="T200" priority="300">
          Saved for every call.
        </Text>
      </Box>
    </Menu>
  );
}

function CallMemberSubItem({
  userId,
  roomId,
  spaceId,
  inCall,
}: {
  userId: string;
  roomId: string;
  spaceId?: string;
  // Speaking / sharing state only comes from the call we are in.
  inCall?: boolean;
}) {
  const mx = useMatrixClient();
  const profile = useUserProfile(userId);
  const useAuthentication = useMediaAuthentication();
  const openUserProfile = useOpenUserRoomProfile();
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? (mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 48, 48, 'crop') ?? undefined)
    : undefined;
  const isSelf = userId === mx.getUserId();
  const volume = useUserVolume(userId);
  const presence = useCallPresence();
  const isSpeaking = inCall && presence.speaking.has(userId);
  const isSharing = inCall && presence.sharing.has(userId);

  const [imgError, setImgError] = useState(false);
  const [volumeAnchor, setVolumeAnchor] = useState<RectCords>();

  // Discord-style colored avatar fallback — deterministic hue from userId.
  const hue = userId
    ? [...userId].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
    : 0;
  const initial = (displayName || 'U').charAt(0).toUpperCase();
  const showFallback = !avatarUrl || imgError;
  const avatarClass = `zennith-voice-avatar${isSpeaking ? ' speaking' : ''}`;

  const fallbackEl = (
    <div
      className={avatarClass}
      style={{
        backgroundColor: `hsl(${hue}, 50%, 45%)`,
        color: '#fff',
        fontSize: '11px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {initial}
    </div>
  );

  const handleOpenProfile = (evt: React.MouseEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
    openUserProfile(roomId, spaceId, userId, {
      x: rect.right,
      y: rect.top,
      width: 0,
      height: 0,
    }, 'Left');
  };

  // Right-click: per-user volume instead of the room menu.
  const handleContextMenu = (evt: React.MouseEvent) => {
    if (isSelf) return;
    evt.preventDefault();
    evt.stopPropagation();
    setVolumeAnchor({ x: evt.clientX, y: evt.clientY, width: 0, height: 0 });
  };

  const avatarEl = showFallback ? fallbackEl : (
    <img
      className={avatarClass}
      src={avatarUrl}
      alt={displayName}
      onError={() => setImgError(true)}
    />
  );

  return (
    <PopOut
      anchor={volumeAnchor}
      position="Right"
      align="Start"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            returnFocusOnDeactivate: false,
            onDeactivate: () => setVolumeAnchor(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <CallMemberVolume userId={userId} displayName={displayName} />
        </FocusTrap>
      }
    >
      <div
        className="zennith-voice-user-item"
        onClick={handleOpenProfile}
        onContextMenu={handleContextMenu}
        style={{ cursor: 'pointer' }}
        title={isSelf ? undefined : 'Right-click to change volume'}
      >
        {avatarEl}
        <span className="zennith-voice-username">{displayName}</span>
        {!isSelf && volume < 1 && (
          <Icon
            size="50"
            src={volume === 0 ? Icons.VolumeMute : Icons.VolumeHigh}
            style={{ opacity: config.opacity.P300, flexShrink: 0 }}
            aria-label={volume === 0 ? 'Muted by you' : `Volume ${Math.round(volume * 100)}%`}
          />
        )}
        {isSharing && <span className="zennith-voice-live">LIVE</span>}
      </div>
    </PopOut>
  );
}

type RoomNavItemMenuProps = {
  room: Room;
  requestClose: () => void;
  notificationMode?: RoomNotificationMode;
};
const RoomNavItemMenu = forwardRef<HTMLDivElement, RoomNavItemMenuProps>(
  ({ room, requestClose, notificationMode }, ref) => {
    const mx = useMatrixClient();
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
    const powerLevels = usePowerLevels(room);
    const creators = useRoomCreators(room);

    const permissions = useRoomPermissions(creators, powerLevels);
    const canInvite = permissions.action('invite', mx.getSafeUserId());
    const openRoomSettings = useOpenRoomSettings();
    const space = useSpaceOptionally();

    const [invitePrompt, setInvitePrompt] = useState(false);

    const handleMarkAsRead = () => {
      markAsRead(mx, room.roomId, hideActivity);
      requestClose();
    };

    const handleInvite = () => {
      setInvitePrompt(true);
    };

    const handleCopyLink = () => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
      const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
      copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
      requestClose();
    };

    const handleRoomSettings = () => {
      openRoomSettings(room.roomId, space?.roomId);
      requestClose();
    };

    return (
      <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
        {invitePrompt && room && (
          <InviteUserPrompt
            room={room}
            requestClose={() => {
              setInvitePrompt(false);
              requestClose();
            }}
          />
        )}
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleMarkAsRead}
            size="300"
            after={<Icon size="100" src={Icons.CheckTwice} />}
            radii="300"
            disabled={!unread}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Mark as Read
            </Text>
          </MenuItem>
          <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
            {(handleOpen, opened, changing) => (
              <MenuItem
                size="300"
                after={
                  changing ? (
                    <Spinner size="100" variant="Secondary" />
                  ) : (
                    <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                  )
                }
                radii="300"
                aria-pressed={opened}
                onClick={handleOpen}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Notifications
                </Text>
              </MenuItem>
            )}
          </RoomNotificationModeSwitcher>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleInvite}
            variant="Primary"
            fill="None"
            size="300"
            after={<Icon size="100" src={Icons.UserPlus} />}
            radii="300"
            aria-pressed={invitePrompt}
            disabled={!canInvite}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Invite
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleCopyLink}
            size="300"
            after={<Icon size="100" src={Icons.Link} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Copy Link
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleRoomSettings}
            size="300"
            after={<Icon size="100" src={Icons.Setting} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Room Settings
            </Text>
          </MenuItem>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <UseStateProvider initial={false}>
            {(promptLeave, setPromptLeave) => (
              <>
                <MenuItem
                  onClick={() => setPromptLeave(true)}
                  variant="Critical"
                  fill="None"
                  size="300"
                  after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                  radii="300"
                  aria-pressed={promptLeave}
                >
                  <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                    Leave Room
                  </Text>
                </MenuItem>
                {promptLeave && (
                  <LeaveRoomPrompt
                    roomId={room.roomId}
                    onDone={requestClose}
                    onCancel={() => setPromptLeave(false)}
                  />
                )}
              </>
            )}
          </UseStateProvider>
        </Box>
      </Menu>
    );
  }
);

function CallChatToggle() {
  const [chat, setChat] = useAtom(callChatAtom);

  return (
    <IconButton
      onClick={() => setChat(!chat)}
      aria-pressed={chat}
      aria-label="Toggle Chat"
      variant="Background"
      fill="None"
      size="300"
      radii="300"
    >
      <Icon size="50" src={Icons.Message} filled={chat} />
    </IconButton>
  );
}

type RoomNavItemProps = {
  room: Room;
  selected: boolean;
  linkPath: string;
  notificationMode?: RoomNotificationMode;
  showAvatar?: boolean;
  direct?: boolean;
};
export function RoomNavItem({
  room,
  selected,
  showAvatar,
  direct,
  notificationMode,
  linkPath,
}: RoomNavItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  useEffect(() => {
    injectVoiceTreeStyles();
  }, []);
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const typingMember = useRoomTypingMember(room.roomId).filter(
    (receipt) => receipt.userId !== mx.getUserId()
  );

  const roomName = useRoomName(room);

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const optionsVisible = hover || !!menuAnchor;
  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const startCall = useCallStart(direct);
  const callEmbed = useCallEmbed();
  const space = useSpaceOptionally();
  const callPref = useAtomValue(useCallPreferencesAtom());
  const autoDiscoveryInfo = useAutoDiscoveryInfo();

  const handleStartCall: MouseEventHandler<HTMLAnchorElement> = (evt) => {
    const powerLevelsEvent = getStateEvent(room, StateEvent.RoomPowerLevels);
    const powerLevels = getPowersLevelFromMatrixEvent(powerLevelsEvent);
    const creators = getRoomCreatorsForRoomId(mx, room.roomId);
    const permissions = getRoomPermissionsAPI(creators, powerLevels);

    const hasCallPermission = permissions.stateEvent(
      StateEvent.GroupCallMemberPrefix,
      mx.getSafeUserId()
    );

    // Do not join if missing permissions or no livekit support or no webRTC support
    if (!hasCallPermission || !livekitSupport(autoDiscoveryInfo) || !webRTCSupported()) {
      return;
    }

    // Do not join if already in call
    if (callEmbed) {
      return;
    }
    // Start call in second click
    if (selected) {
      evt.preventDefault();
      startCall(room, callPref);
    }
  };

  return (
    <NavItem
      variant="Background"
      radii="400"
      highlight={unread !== undefined}
      aria-selected={selected}
      data-hover={!!menuAnchor}
      onContextMenu={handleContextMenu}
      {...hoverProps}
      {...focusWithinProps}
    >
      <div className="zennith-voice-channel-block">
        {/* 1. Channel Header Row — clickable link for navigation */}
        <NavLink
          to={linkPath}
          onClick={room.isCallRoom() ? handleStartCall : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '34px',
            padding: '0 8px',
            borderRadius: '4px',
            width: '100%',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <div className="channel-title-group">
            <RoomIcon
              style={{
                opacity: unread ? config.opacity.P500 : config.opacity.P300,
                width: '24px',
                height: '24px',
                flexShrink: 0,
              }}
              filled={selected}
              size="100"
              joinRule={room.getJoinRule()}
              roomType={room.getType()}
            />
            <span className="channel-name">{roomName}</span>
          </div>
          {callMembers.length > 0 && (
            <span
              style={{
                backgroundColor: '#f23f43',
                color: '#fff',
                borderRadius: '8px',
                padding: '0 6px',
                fontSize: '12px',
                fontWeight: 600,
                lineHeight: '18px',
                flexShrink: 0,
              }}
            >
              {callMembers.length} Live
            </span>
          )}
        </NavLink>

        {/* 2. Connected Users Tree — STRICTLY OUTSIDE AND BELOW THE HEADER */}
        {callMembers.length > 0 && (
          <div className="zennith-voice-user-tree">
            {callMembers.slice(0, 10).map((member) => (
              <CallMemberSubItem
                key={member.deviceId || member.memberId}
                userId={member.userId}
                roomId={room.roomId}
                spaceId={space?.roomId}
                inCall={callEmbed?.roomId === room.roomId}
              />
            ))}
            {callMembers.length > 10 && (
              <div style={{ paddingLeft: '28px' }}>
                <Text priority="300" size="T200">
                  +{callMembers.length - 10} more
                </Text>
              </div>
            )}
          </div>
        )}

        </div>

      {optionsVisible && (
        <NavItemOptions>
          {selected && (callEmbed?.roomId === room.roomId || room.isCallRoom()) && (
            <CallChatToggle />
          )}
          <PopOut
            id={`menu-${room.roomId}`}
            aria-expanded={!!menuAnchor}
            anchor={menuAnchor}
            offset={menuAnchor?.width === 0 ? 0 : undefined}
            alignOffset={menuAnchor?.width === 0 ? 0 : -5}
            position="Bottom"
            align={menuAnchor?.width === 0 ? 'Start' : 'End'}
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  returnFocusOnDeactivate: false,
                  onDeactivate: () => setMenuAnchor(undefined),
                  clickOutsideDeactivates: true,
                  isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                  isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                  escapeDeactivates: stopPropagation,
                }}
              >
                <RoomNavItemMenu
                  room={room}
                  requestClose={() => setMenuAnchor(undefined)}
                  notificationMode={notificationMode}
                />
              </FocusTrap>
            }
          >
            <IconButton
              onClick={handleOpenMenu}
              aria-pressed={!!menuAnchor}
              aria-controls={`menu-${room.roomId}`}
              aria-label="More Options"
              variant="Background"
              fill="None"
              size="300"
              radii="300"
            >
              <Icon size="50" src={Icons.VerticalDots} />
            </IconButton>
          </PopOut>
        </NavItemOptions>
      )}
    </NavItem>
  );
}
