import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  Tooltip,
  TooltipProvider,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { UserAvatar } from '../user-avatar';
import { AvatarPresence, PresenceBadge } from '../presence';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { Presence } from '../../hooks/useUserPresence';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { stopPropagation } from '../../utils/keyboard';
import { Settings } from '../../features/settings';
import { Modal500 } from '../Modal500';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallControlState } from '../../plugins/call';
import {
  applyOwnStatus,
  DND_STATUS_MSG,
  getOwnStatus,
  getSharedStatus,
  OwnStatus,
  shareOwnStatus,
} from '../../utils/ownStatus';
import { useAccountDataCallback } from '../../hooks/useAccountDataCallback';
import { AccountDataEvent } from '../../../types/matrix/accountData';
import * as css from './ProfileCard.css';

const STATUS_OPTIONS: Array<{
  status: OwnStatus;
  label: string;
  icon: 'User' | 'Clock' | 'Prohibited' | 'Power';
}> = [
  { status: 'online', label: 'Online', icon: 'User' },
  { status: 'idle', label: 'Idle', icon: 'Clock' },
  { status: 'dnd', label: 'Do Not Disturb', icon: 'Prohibited' },
  { status: 'invisible', label: 'Invisible', icon: 'Power' },
];

const StatusToPresence: Record<OwnStatus, Presence> = {
  online: Presence.Online,
  idle: Presence.Unavailable,
  dnd: Presence.Unavailable,
  invisible: Presence.Offline,
};

export function ProfileCard() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId()!;
  const profile = useUserProfile(userId);
  // The badge follows the picked status rather than the server's echo, which lags.
  const [status, setStatus] = useState<OwnStatus>(() => getOwnStatus(userId));

  const [statusAnchor, setStatusAnchor] = useState<RectCords>();
  const [settings, setSettings] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const callEmbed = useCallEmbed();
  // Always call the hook to avoid React error #310 (hooks must be consistent across renders).
  const controlState = useCallControlState(callEmbed?.control ?? null);
  const microphone = !callEmbed || controlState?.microphone !== false;
  const sound = !callEmbed || controlState?.sound !== false;

  const handleMute = () => {
    callEmbed?.control.toggleMicrophone();
  };

  const handleDeafen = () => {
    callEmbed?.control.toggleSound();
  };

  const openStatus = () => {
    const btn = statusBtnRef.current;
    if (!btn) return;
    setStatusAnchor(btn.getBoundingClientRect());
  };

  const handleSetStatus = async (next: OwnStatus) => {
    setStatusAnchor(undefined);
    setStatus(next);
    shareOwnStatus(mx, next).catch(() => undefined);
    try {
      await applyOwnStatus(mx, next);
    } catch {
      // The pick is stored and sent with every sync, so a failed update catches up.
    }
  };

  // Follow a status picked on another Zennith client.
  const followShared = useCallback(() => {
    const shared = getSharedStatus(mx);
    if (!shared || shared === getOwnStatus(userId)) return;
    setStatus(shared);
    applyOwnStatus(mx, shared).catch(() => undefined);
  }, [mx, userId]);
  useEffect(followShared, [followShared]);
  useAccountDataCallback(
    mx,
    useCallback(
      (evt) => {
        if (evt.getType() === AccountDataEvent.ZennithStatus) followShared();
      },
      [followShared]
    )
  );

  return (
    <div className={css.ProfileCard}>
      <button
        ref={statusBtnRef}
        type="button"
        className={css.ProfileCardAvatarBtn}
        onClick={openStatus}
        aria-label="Set status"
        aria-haspopup="menu"
        aria-expanded={!!statusAnchor}
      >
        <AvatarPresence
          variant="SurfaceVariant"
          badge={
            <PresenceBadge
              presence={StatusToPresence[status]}
              status={status === 'dnd' ? DND_STATUS_MSG : undefined}
            />
          }
        >
          <Avatar size="300">
            <UserAvatar
              userId={userId}
              src={avatarUrl}
              renderFallback={() => <Text size="H5">{nameInitials(displayName)}</Text>}
            />
          </Avatar>
        </AvatarPresence>
      </button>

      <Box className={css.ProfileCardIdentity} direction="Column">
        <Text size="T300" truncate title={displayName}>
          {displayName}
        </Text>
        <Text size="T200" truncate priority="300">
          {getMxIdLocalPart(userId) ?? userId}
        </Text>
      </Box>

      <Box className={css.ProfileCardActions} alignItems="Center">
        <TooltipProvider
          position="Top"
          tooltip={
            <Tooltip>
              <Text size="T200">Mute</Text>
            </Tooltip>
          }
        >
          {(ref) => (
            <IconButton
              ref={ref}
              variant="SurfaceVariant"
              fill={!callEmbed ? 'None' : microphone ? 'None' : 'Solid'}
              size="300"
              radii="300"
              aria-label="Mute"
              aria-pressed={!microphone}
              onClick={handleMute}
            >
              <Icon size="100" src={microphone ? Icons.Mic : Icons.MicMute} filled={!microphone} />
            </IconButton>
          )}
        </TooltipProvider>
        <TooltipProvider
          position="Top"
          tooltip={
            <Tooltip>
              <Text size="T200">Deafen</Text>
            </Tooltip>
          }
        >
          {(ref) => (
            <IconButton
              ref={ref}
              variant="SurfaceVariant"
              fill={!callEmbed ? 'None' : sound ? 'None' : 'Solid'}
              size="300"
              radii="300"
              aria-label="Deafen"
              aria-pressed={!sound}
              onClick={handleDeafen}
            >
              <Icon
                size="100"
                src={sound ? Icons.Headphone : Icons.HeadphoneMute}
                filled={!sound}
              />
            </IconButton>
          )}
        </TooltipProvider>
        <TooltipProvider
          position="Top"
          tooltip={
            <Tooltip>
              <Text size="T200">Settings</Text>
            </Tooltip>
          }
        >
          {(ref) => (
            <IconButton
              ref={ref}
              variant="SurfaceVariant"
              fill="None"
              size="300"
              radii="300"
              aria-label="Settings"
              onClick={() => setSettings(true)}
            >
              <Icon size="100" src={Icons.Setting} />
            </IconButton>
          )}
        </TooltipProvider>
      </Box>

      <PopOut
        anchor={statusAnchor}
        position="Top"
        align="Start"
        offset={8}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setStatusAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu style={{ maxWidth: toRem(220), width: '100vw' }}>
              <Box direction="Column" style={{ padding: '4px' }}>
                {STATUS_OPTIONS.map((option) => {
                  const selected = status === option.status;
                  return (
                    <MenuItem
                      key={option.status}
                      variant="Surface"
                      size="300"
                      radii="300"
                      aria-pressed={selected}
                      onClick={() => handleSetStatus(option.status)}
                      before={<Icon size="100" src={Icons[option.icon]} filled={selected} />}
                    >
                      <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                        {option.label}
                      </Text>
                    </MenuItem>
                  );
                })}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />

      {settings && (
        <Modal500 requestClose={() => setSettings(false)}>
          <Settings requestClose={() => setSettings(false)} />
        </Modal500>
      )}
    </div>
  );
}
