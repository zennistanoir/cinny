import { useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { ownStatusAtom } from '../state/ownStatus';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { isInQuietHours } from '../utils/ownStatus';

/**
 * Returns a check for whether toasts and sounds should be skipped right now: Do Not
 * Disturb is on, or the current time is inside quiet hours. Badges are not affected.
 */
export const useNotificationsSilenced = (): (() => boolean) => {
  const status = useAtomValue(ownStatusAtom);
  const [quietHours] = useSetting(settingsAtom, 'quietHoursEnabled');
  const [start] = useSetting(settingsAtom, 'quietHoursStart');
  const [end] = useSetting(settingsAtom, 'quietHoursEnd');

  return useCallback(
    () => status === 'dnd' || (quietHours && isInQuietHours(new Date(), start, end)),
    [status, quietHours, start, end]
  );
};
