import React, { useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Text } from 'folds';
import { useCallEmbed, useCallJoined } from '../../hooks/useCallEmbed';
import * as css from './VoicePanel.css';

export function VoicePanel() {
  const callEmbed = useCallEmbed();
  const joined = useCallJoined(callEmbed);
  const [ping, setPing] = useState<number>(5);

  useEffect(() => {
    if (!callEmbed?.joined || !callEmbed.iframe) return;

    const pollRtt = () => {
      try {
        const win = callEmbed.iframe.contentWindow;
        if (!win) return;

        const script = `
          (function() {
            try {
              var pcs = [];
              if (window.RTCPeerConnection && window.RTCPeerConnection.prototype.getStats) {
                pcs = [].slice.call(document.querySelectorAll('video, audio'))
                  .map(function(el) { return el.srcObject; })
                  .filter(function(s) { return s && typeof s.getStats === 'function'; });
              }
              if (!pcs.length) return;
              pcs.forEach(function(pc) {
                pc.getStats(null).then(function(stats) {
                  stats.forEach(function(report) {
                    if (
                      (report.type === 'candidate-pair' || report.type === 'remote-candidate-pair') &&
                      report.state === 'succeeded' &&
                      report.currentRoundTripTime !== undefined
                    ) {
                      window.__zennithRtt = report.currentRoundTripTime * 1000;
                    }
                  });
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
        }, 500);
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

  return (
    <Box className={css.VoicePanel} direction="Column" gap="200">
      <Box alignItems="Center" gap="200">
        <Box className={css.ConnectionDot} shrink="No" />
        <Box grow="Yes" direction="Column" gap="100">
          <Text size="T300" priority="300">
            Voice Connected
          </Text>
          <Text size="T300" truncate>
            {roomName}
          </Text>
        </Box>
        <Box className={css.LatencyBadge} shrink="No">
          <Icon src={Icons.VolumeHigh} size="100" />
          <span>{ping} ms</span>
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