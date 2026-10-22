import React, { MouseEventHandler, useRef, useState } from 'react';
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
import classNames from 'classnames';
import FocusTrap from 'focus-trap-react';
import { UserAvatar } from '../user-avatar';
import { AvatarPresence, PresenceBadge } from '../presence';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useUserPresence, Presence } from '../../hooks/useUserPresence';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { stopPropagation } from '../../utils/keyboard';
import { Settings } from '../../features/settings';
import { Modal500 } from '../Modal500';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallControlState } from '../../plugins/call';
import * as css from './ProfileCard.css';

const PRESENCE_OPTIONS: Array<{ presence: Presence; label: string; icon: 'User' | 'Clock' | 'Prohibited' | 'Power' }> = [
  { presence: Presence.Online, label: 'Online', icon: 'User' },
  { presence: Presence.Unavailable, label: 'Idle', icon: 'Clock' },
  { presence: Presence.Offline, label: 'Do Not Disturb', icon: 'Prohibited' },
  { presence: Presence.Offline, label: 'Invisible', icon: 'Power' },
];

const PresenceToStatus: Record<Presence, string> = {
  [Presence.Online]: 'online',
  [Presence.Unavailable]: 'unavailable',
  [Presence.Offline]: 'offline',
};

export function ProfileCard() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId()!;
  const profile = useUserProfile(userId);
  const presence = useUserPresence(userId);

  const [statusAnchor, setStatusAnchor] = useState<RectCords>();
  const [settings, setSettings] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const currentPresence: Presence = presence?.presence ?? Presence.Offline;

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

  const handleSetPresence = async (next: Presence) => {
    setStatusAnchor(undefined);
    // Map Discord-style picker options to Matrix presence states.
    // Invisible is represented as `offline` locally.
    try {
      await mx.setPresence({ presence: PresenceToStatus[next] });
    } catch {
      // Presence update may fail silently — the local dot updates immediately regardless.
    }
  };

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
          badge={<PresenceBadge presence={currentPresence} />}
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
        <TooltipProvider position="Top" tooltip={<Tooltip><Text size="T200">Mute</Text></Tooltip>}>
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
        <TooltipProvider position="Top" tooltip={<Tooltip><Text size="T200">Deafen</Text></Tooltip>}>
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
              <Icon size="100" src={sound ? Icons.Headphone : Icons.HeadphoneMute} filled={!sound} />
            </IconButton>
          )}
        </TooltipProvider>
        <TooltipProvider position="Top" tooltip={<Tooltip><Text size="T200">Settings</Text></Tooltip>}>
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
                {PRESENCE_OPTIONS.map((option) => {
                  const selected = currentPresence === option.presence && option.label !== 'Invisible';
                  return (
                    <MenuItem
                      key={option.label}
                      variant="Surface"
                      size="300"
                      radii="300"
                      aria-pressed={selected}
                      onClick={() => handleSetPresence(option.presence)}
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
