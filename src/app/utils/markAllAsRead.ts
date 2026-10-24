import { MatrixClient } from 'matrix-js-sdk';
import { RoomToUnread } from '../../types/matrix/room';
import { markAsRead } from './notifications';

const BATCH_SIZE = 5;

/**
 * Sends a read receipt for every room with unread messages. Space entries in the unread
 * map only sum up their children, so they are skipped. Receipts go out a few at a time
 * to stay clear of rate limits.
 */
export const markAllAsRead = async (
  mx: MatrixClient,
  roomToUnread: RoomToUnread,
  privateReceipt: boolean
): Promise<void> => {
  const roomIds = Array.from(roomToUnread.keys()).filter(
    (roomId) => mx.getRoom(roomId)?.isSpaceRoom() === false
  );
  for (let i = 0; i < roomIds.length; i += BATCH_SIZE) {
    const batch = roomIds.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      batch.map((roomId) => markAsRead(mx, roomId, privateReceipt).catch(() => undefined))
    );
  }
};
