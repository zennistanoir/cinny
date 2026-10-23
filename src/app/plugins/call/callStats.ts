// Live round-trip time for the voice panel's ping indicator.
//
// Element Call / LiveKit own their RTCPeerConnections inside the call iframe, so
// the iframe's constructor is wrapped (via the same pre-bundle hook as RNNoise,
// see iframeMedia.ts) to keep a reference to every connection it creates.

const connections = new Set<RTCPeerConnection>();

type PatchableWindow = Window & {
  RTCPeerConnection?: typeof RTCPeerConnection;
  __zennithPCPatched?: boolean;
};

export const patchPeerConnection = (win: PatchableWindow) => {
  const NativePC = win.RTCPeerConnection;
  if (!NativePC || win.__zennithPCPatched) return;
  // eslint-disable-next-line no-param-reassign
  win.__zennithPCPatched = true;

  // A Proxy keeps prototype, statics and `instanceof` intact for Element Call.
  // eslint-disable-next-line no-param-reassign
  win.RTCPeerConnection = new Proxy(NativePC, {
    construct(target, args, newTarget) {
      const pc: RTCPeerConnection = Reflect.construct(target, args, newTarget);
      connections.add(pc);
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          connections.delete(pc);
        }
      });
      return pc;
    },
  });
};

/** Lowest current RTT across the call's connections, in ms; null if unknown. */
export const getCallRtt = async (): Promise<number | null> => {
  let best: number | null = null;
  const consider = (seconds: unknown) => {
    if (typeof seconds !== 'number' || seconds <= 0) return;
    const ms = seconds * 1000;
    if (best === null || ms < best) best = ms;
  };

  await Promise.all(
    [...connections].map(async (pc) => {
      if (pc.connectionState === 'closed') {
        connections.delete(pc);
        return;
      }
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            consider(report.currentRoundTripTime);
          } else if (report.type === 'remote-inbound-rtp') {
            consider(report.roundTripTime);
          }
        });
      } catch {
        // connection torn down mid-poll
      }
    })
  );

  return best === null ? null : Math.round(best);
};
