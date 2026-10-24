import { useMemo } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { useCallPresence } from '../plugins/call/ecBridge';
import { useLocalSpeaking } from '../plugins/call/noiseSuppression';

// Who is speaking in the call we are in. Others come from LiveKit's speaker
// detection (via Element Call); our own state comes from the local mic analyser,
// which reacts without the server's sampling delay.
export const useCallSpeakers = (): ReadonlySet<string> => {
  const mx = useMatrixClient();
  const myUserId = mx.getUserId();
  const { speaking } = useCallPresence();
  const localSpeaking = useLocalSpeaking();

  return useMemo(() => {
    if (localSpeaking === undefined || !myUserId) return speaking;
    if (speaking.has(myUserId) === localSpeaking) return speaking;
    const next = new Set(speaking);
    if (localSpeaking) next.add(myUserId);
    else next.delete(myUserId);
    return next;
  }, [speaking, localSpeaking, myUserId]);
};
