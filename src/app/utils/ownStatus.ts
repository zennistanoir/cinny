import { MatrixClient, SetPresence } from 'matrix-js-sdk';
import { AccountDataEvent } from '../../types/matrix/accountData';

// The status picked in the profile card. Matrix only has online, unavailable and
// offline, so Do Not Disturb is sent as unavailable with a fixed status message.
export type OwnStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export const DND_STATUS_MSG = 'Do Not Disturb';

const StatusToPresence: Record<OwnStatus, SetPresence> = {
  online: SetPresence.Online,
  idle: SetPresence.Unavailable,
  dnd: SetPresence.Unavailable,
  invisible: SetPresence.Offline,
};

const storageKey = (userId: string) => `zennith.status.${userId}`;

const toOwnStatus = (value: unknown): OwnStatus | undefined =>
  value === 'online' || value === 'idle' || value === 'dnd' || value === 'invisible'
    ? value
    : undefined;

export const getOwnStatus = (userId: string): OwnStatus =>
  toOwnStatus(localStorage.getItem(storageKey(userId))) ?? 'online';

// The pick is also kept in account data: the server shows the most-online of the user's
// devices, so every Zennith client has to send the same status.
export const getSharedStatus = (mx: MatrixClient): OwnStatus | undefined =>
  toOwnStatus(mx.getAccountData(AccountDataEvent.ZennithStatus as any)?.getContent().status);

export const shareOwnStatus = (mx: MatrixClient, status: OwnStatus): Promise<unknown> =>
  mx.setAccountData(AccountDataEvent.ZennithStatus as any, { status } as any);

/**
 * Sets the presence sent with every /sync as well as the stored one. Without the
 * sync presence, the server marks the user online again on the next sync.
 */
export const applyOwnStatus = async (mx: MatrixClient, status: OwnStatus): Promise<void> => {
  const userId = mx.getSafeUserId();
  localStorage.setItem(storageKey(userId), status);

  const presence = StatusToPresence[status];
  await mx.setSyncPresence(presence);

  const currentMsg = mx.getUser(userId)?.presenceStatusMsg;
  // Only clear the status message if it's ours, so a message set elsewhere survives.
  let statusMsg: string | undefined;
  if (status === 'dnd') statusMsg = DND_STATUS_MSG;
  else if (currentMsg === DND_STATUS_MSG) statusMsg = '';

  await mx.setPresence({
    presence,
    ...(statusMsg !== undefined ? { status_msg: statusMsg } : {}),
  });
};
