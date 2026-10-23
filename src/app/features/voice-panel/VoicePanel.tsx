import React, { useEffect, useState } from 'react';
import { Box, Icon, IconButton, Icons, Text, Tooltip, TooltipProvider } from 'folds';
import { useCallEmbed, useCallJoined } from '../../hooks/useCallEmbed';
import { getCallRtt } from '../../plugins/call/callStats';
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
    <Box className={css.VoicePanel} alignItems="Center" gap="200">
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
  );
}
