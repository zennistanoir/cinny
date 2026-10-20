import React, { useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Text } from 'folds';
import { useCallEmbed, useCallJoined } from '../../hooks/useCallEmbed';
import * as css from './VoicePanel.css';

function pingColor(ping: number): string {
  if (ping < 100) return '#0ebd7e';
  if (ping <= 250) return '#ff9f1a';
  return '#ff4d4d';
}

export function VoicePanel() {
  const callEmbed = useCallEmbed();
  const joined = useCallJoined(callEmbed);
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    if (!callEmbed?.joined || !callEmbed.iframe) return;

    const pollRtt = () => {
      try {
        const win = callEmbed.iframe.contentWindow;
        if (!win) return;

        const script = `
          (function() {
            try {
              var pcs = window.__zennithPCs || [];
              if (!pcs.length) return;
              var best = null;
              pcs.forEach(function(pc) {
                if (typeof pc.getStats !== 'function') return;
                pc.getStats(null).then(function(stats) {
                  stats.forEach(function(report) {
                    if (
                      report.type === 'candidate-pair' &&
                      report.state === 'succeeded' &&
                      report.currentRoundTripTime !== undefined
                    ) {
                      var rtt = report.currentRoundTripTime * 1000;
                      if (best === null || rtt < best) best = rtt;
                    } else if (
                      report.type === 'remote-inbound-rtp' &&
                      report.roundTripTime !== undefined
                    ) {
                      var rtt2 = report.roundTripTime * 1000;
                      if (best === null || rtt2 < best) best = rtt2;
                    }
                  });
                  if (best !== null) window.__zennithRtt = best;
                }).catch(function() {});
              });
            } catch(e) {}
          })()
        `;
        (win as any).eval(script);
        setTimeout(() => {
          const rtt = (win as any).__zennithRtt;
          if (typeof rtt === 'number' && rtt > 0 && rtt < 5000) {
            setPing(Math.round(rtt));
          }
        }, 600);
      } catch {
        // iframe cross-origin may block access
      }
    };

    pollRtt();
    const interval = setInterval(pollRtt, 2000);
    return () => clearInterval(interval);
  }, [callEmbed, joined]);

  if (!callEmbed || !joined) return null;

  const roomName = callEmbed.room.name;
  const currentPing = ping;
  const dotColor = currentPing !== null ? pingColor(currentPing) : '#0ebd7e';

  return (
    <Box className={css.VoicePanel} direction="Column" gap="200">
      <Box alignItems="Center" gap="200">
        <Box
          className={css.ConnectionDot}
          shrink="No"
          style={{
            backgroundColor: dotColor,
            boxShadow: `0 0 4px ${dotColor}99`,
          }}
        />
        <Box grow="Yes" direction="Column" gap="100">
          <Text size="T300" priority="300">
            Voice Connected
          </Text>
          <Text size="T300" truncate>
            {roomName}
          </Text>
        </Box>
        <Box className={css.LatencyBadge} shrink="No" style={{ color: dotColor }}>
          <span>{currentPing !== null ? `${currentPing} ms` : '-- ms'}</span>
        </Box>
      </Box>
      <Button
        variant="Critical"
        fill="Solid"
        radii="Pill"
        size="300"
        style={{ backgroundColor: '#DA373C', color: '#FFFFFF' }}
        before={<Icon src={Icons.PhoneDown} size="100" filled />}
        onClick={() => callEmbed.hangup()}
      >
        <Text size="B300">Disconnect</Text>
      </Button>
    </Box>
  );
}