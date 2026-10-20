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
    '.zennith-voice-avatar.speaking {',
    '  border: 2px solid #23a55a !important;',
    '  box-shadow: 0 0 6px rgba(35, 165, 90, 0.6) !important;',
    '}',
    '.zennith-voice-avatar img {',
    '  width: 100% !important;',
    '  height: 100% !important;',
    '  object-fit: cover !important;',
    '}',
    '.zennith-voice-username {',
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
import { UserAvatar } from '../../components/user-avatar';

function CallMemberSubItem({ userId }: { userId: string }) {
  const mx = useMatrixClient();
  const profile = useUserProfile(userId);
  const useAuthentication = useMediaAuthentication();
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 48, 48, 'crop') ?? undefined
    : undefined;

  const avatarEl = avatarUrl ? (
    <img className="zennith-voice-avatar" src={avatarUrl} alt={displayName} />
  ) : (
    <div className="zennith-voice-avatar">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.1)',
          color: '#dbdee1',
          fontSize: '9px',
          fontWeight: 600,
          borderRadius: '50%',
        }}
      >
        {nameInitials(displayName)}
      </div>
    </div>
  );

  return (
    <div className="zennith-voice-user-item">
      {avatarEl}
      <span className="zennith-voice-username">{displayName}</span>
    </div>
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
        {/* 1. Channel Header Row — STRICTLY for channel name & badges */}
        <div className="zennith-channel-header-row">
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
        </div>

        {/* 2. Connected Users Tree — STRICTLY OUTSIDE AND BELOW THE HEADER */}
        {callMembers.length > 0 && selected && (
          <div className="zennith-voice-user-tree">
            {callMembers.slice(0, 10).map((member) => (
              <CallMemberSubItem key={member.deviceId || member.memberId} userId={member.userId} />
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

        {/* 3. Channel link for click-to-navigate */}
        <NavLink to={linkPath} onClick={room.isCallRoom() ? handleStartCall : undefined}
          style={{ display: 'none' }} />
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
