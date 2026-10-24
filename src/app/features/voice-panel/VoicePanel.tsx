import React, { MouseEventHandler, ReactNode, useEffect, useState } from 'react';
import { Box, Icon, IconButton, Icons, RectCords, Text, Tooltip, TooltipProvider } from 'folds';
import { useCallEmbed, useCallJoined } from '../../hooks/useCallEmbed';
import { getCallRtt } from '../../plugins/call/callStats';
import { CallEmbed, useCallControlState } from '../../plugins/call';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { ScreenSharePopOut } from '../call/ScreenSharePanel';
import { SoundboardButton } from '../call/Soundboard';
import * as css from './VoicePanel.css';

const PING_POLL_MS = 2000;

function pingColor(ping: number | null): string {
  if (ping === null || ping < 100) return '#23A55A';
  if (ping <= 250) return '#F0B232';
  return '#F23F43';
}

function SignalTowerIcon() {
  return (
    <svg
      className={css.TowerIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 1.5 3.5 14.5M8 1.5l4.5 13M6.4 6h3.2M5.3 9.5h5.4M4.3 12.5h7.4" />
    </svg>
  );
}

function NoiseSuppressionIcon() {
  return (
    <svg
      className={css.ActionSvgIcon}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 6.5v3M5 4v8M8 2v12M11 4v8M14 6.5v3" />
    </svg>
  );
}

type ActionButtonProps = {
  label: string;
  active: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
};
function ActionButton({ label, active, onClick, children }: ActionButtonProps) {
  return (
    <TooltipProvider
      position="Top"
      tooltip={
        <Tooltip>
          <Text size="T200">{label}</Text>
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <IconButton
          ref={triggerRef}
          className={css.ActionButton}
          variant={active ? 'Success' : 'Surface'}
          fill="Soft"
          size="300"
          radii="300"
          outlined
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
        >
          {children}
        </IconButton>
      )}
    </TooltipProvider>
  );
}

// Discord-style row under "Voice Connected": camera, screen share, soundboard and noise
// suppression.
function VoiceActions({ callEmbed }: { callEmbed: CallEmbed }) {
  const controlState = useCallControlState(callEmbed.control);
  const [noiseSuppression, setNoiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [shareCords, setShareCords] = useState<RectCords>();

  const video = controlState?.video ?? false;
  const screenshare = controlState?.screenshare ?? false;

  return (
    <Box className={css.Actions}>
      <ActionButton
        label={video ? 'Turn Off Camera' : 'Turn On Camera'}
        active={video}
        onClick={() => callEmbed.control.toggleVideo()}
      >
        <Icon size="100" src={video ? Icons.VideoCamera : Icons.VideoCameraMute} filled={video} />
      </ActionButton>
      <ActionButton
        label={screenshare ? 'Stream Settings' : 'Share Your Screen'}
        active={screenshare}
        onClick={(evt) => setShareCords(evt.currentTarget.getBoundingClientRect())}
      >
        <Icon size="100" src={Icons.ScreenShare} filled={screenshare} />
      </ActionButton>
      <SoundboardButton
        small
        className={css.ActionButton}
        room={callEmbed.room}
        micEnabled={controlState?.microphone ?? false}
        soundEnabled={controlState?.sound ?? false}
      />
      <ActionButton
        label={noiseSuppression ? 'Turn Off Noise Suppression' : 'Turn On Noise Suppression'}
        active={noiseSuppression}
        onClick={() => setNoiseSuppression(!noiseSuppression)}
      >
        <NoiseSuppressionIcon />
      </ActionButton>
      <ScreenSharePopOut
        anchor={shareCords}
        sharing={screenshare}
        onToggle={() => callEmbed.control.toggleScreenshare()}
        onClose={() => setShareCords(undefined)}
      />
    </Box>
  );
}

export function VoicePanel() {
  const callEmbed = useCallEmbed();
  const joined = useCallJoined(callEmbed);
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    setPing(null);
    if (!callEmbed || !joined) return undefined;

    let active = true;
    const poll = async () => {
      const rtt = await getCallRtt();
      if (active && rtt !== null) setPing(rtt);
    };
    poll();
    const interval = setInterval(poll, PING_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [callEmbed, joined]);

  if (!callEmbed || !joined) return null;

  const roomName = callEmbed.room.name;

  return (
    <Box className={css.VoicePanel} direction="Column" gap="200">
      <Box alignItems="Center" gap="200">
        <Box className={css.ConnectionDot} shrink="No" />
        <Box grow="Yes" direction="Column">
          <Text size="T200" priority="300" truncate>
            Voice Connected
          </Text>
          <Text size="H6" truncate>
            {roomName}
          </Text>
        </Box>
        <Box
          className={css.LatencyBadge}
          shrink="No"
          style={{ color: pingColor(ping) }}
          title="Round-trip latency to the call server"
        >
          <SignalTowerIcon />
          <span>{ping !== null ? `${ping} ms` : '-- ms'}</span>
        </Box>
        <TooltipProvider
          position="Top"
          tooltip={
            <Tooltip>
              <Text size="T200">Disconnect</Text>
            </Tooltip>
          }
        >
          {(triggerRef) => (
            <IconButton
              ref={triggerRef}
              className={css.HangupButton}
              variant="Critical"
              fill="Soft"
              size="300"
              radii="300"
              aria-label="Disconnect"
              onClick={() => callEmbed.hangup()}
            >
              <Icon src={Icons.PhoneDown} size="100" filled />
            </IconButton>
          )}
        </TooltipProvider>
      </Box>
      <VoiceActions callEmbed={callEmbed} />
    </Box>
  );
}
