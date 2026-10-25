import {
  KnownMembership,
  MatrixClient,
  MsgType,
  Room,
  RoomMember,
  RoomMemberEvent,
} from 'matrix-js-sdk';
import { getRoomCreatorsForRoomId } from '../../hooks/useRoomCreators';
import { getPowersLevelFromMatrixEvent, readPowerLevel } from '../../hooks/usePowerLevels';
import { getRoomPermissionsAPI } from '../../hooks/useRoomPermissions';
import { getSpaceChildren, getStateEvent } from '../../utils/room';
import { StateEvent } from '../../../types/matrix/room';

// Moderator call controls (disconnect / move to another voice channel).
//
// A call membership is owned by the member's own client: matrix-js-sdk re-sends
// it if anyone else removes it, so the server can't take someone out of a call.
// Instead the moderator's client sends a to-device command to the member's call
// devices, and Zennith clients obey it after checking the sender's power in that
// room. Other clients (Element etc.) ignore the unknown event type.

export const CALL_MODERATION_EVENT = 'zennith.call.control';

// Commands older than this are ignored (e.g. delivered after being offline).
const MAX_AGE_MS = 60_000;

export type CallModerationContent = {
  action: 'disconnect' | 'move';
  room_id: string;
  target_room_id?: string;
  ts: number;
};

// Same rule as kicking: the kick power level, and strictly more power than the target.
export const canModerateCall = (
  mx: MatrixClient,
  room: Room,
  actorId: string,
  targetId: string
): boolean => {
  if (actorId === targetId) return false;
  const powerLevels = getPowersLevelFromMatrixEvent(
    getStateEvent(room, StateEvent.RoomPowerLevels)
  );
  const creators = getRoomCreatorsForRoomId(mx, room.roomId);
  if (!getRoomPermissionsAPI(creators, powerLevels).action('kick', actorId)) return false;

  if (creators.has(targetId)) return false;
  if (creators.has(actorId)) return true;
  return readPowerLevel.user(powerLevels, actorId) > readPowerLevel.user(powerLevels, targetId);
};

export const sendCallModeration = (
  mx: MatrixClient,
  userId: string,
  deviceIds: string[],
  content: Omit<CallModerationContent, 'ts'>
) => {
  const payload: CallModerationContent = { ...content, ts: Date.now() };
  const devices = new Map(deviceIds.map((deviceId) => [deviceId, payload]));
  return mx.sendToDevice(CALL_MODERATION_EVENT, new Map([[userId, devices]]));
};

export const parseCallModeration = (content: unknown): CallModerationContent | undefined => {
  if (typeof content !== 'object' || content === null) return undefined;
  const c = content as Partial<CallModerationContent>;
  if (c.action !== 'disconnect' && c.action !== 'move') return undefined;
  if (typeof c.room_id !== 'string' || typeof c.ts !== 'number') return undefined;
  if (Math.abs(Date.now() - c.ts) > MAX_AGE_MS) return undefined;
  if (c.action === 'move' && typeof c.target_room_id !== 'string') return undefined;
  return c as CallModerationContent;
};

// Voice channels a member can be moved to: joined call rooms in the same space,
// or every joined call room when the channel isn't viewed inside a space.
export const getMoveTargets = (mx: MatrixClient, space: Room | null, fromRoomId: string): Room[] =>
  (space ? getSpaceChildren(space).map((roomId) => mx.getRoom(roomId)) : mx.getRooms()).filter(
    (r): r is Room =>
      !!r && r.roomId !== fromRoomId && r.getMyMembership() === 'join' && r.isCallRoom()
  );

// Music bots join calls without running Zennith, so they never see the to-device
// command above. They take chat commands in the call room instead (!leave, !join).
const CALL_BOT_USER_IDS = new Set(['@zennify:zennandfriends.com']);

export const isCallBot = (userId: string): boolean => CALL_BOT_USER_IDS.has(userId);

const BOT_JOIN_TIMEOUT_MS = 15_000;
// Give the bot a moment to hang up before asking it to join the next call.
const BOT_REJOIN_DELAY_MS = 1500;

const sendBotCommand = (mx: MatrixClient, roomId: string, command: string) =>
  mx.sendMessage(roomId, { msgtype: MsgType.Text, body: command });

const waitForJoin = (mx: MatrixClient, room: Room, userId: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (room.getMember(userId)?.membership === KnownMembership.Join) {
      resolve(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMembership = (_event: unknown, member: RoomMember) => {
      if (member.roomId !== room.roomId || member.userId !== userId) return;
      if (member.membership !== KnownMembership.Join) return;
      clearTimeout(timer);
      mx.off(RoomMemberEvent.Membership, onMembership);
      resolve(true);
    };
    timer = setTimeout(() => {
      mx.off(RoomMemberEvent.Membership, onMembership);
      resolve(false);
    }, BOT_JOIN_TIMEOUT_MS);
    mx.on(RoomMemberEvent.Membership, onMembership);
  });

export const sendBotCallModeration = async (
  mx: MatrixClient,
  botId: string,
  content: Omit<CallModerationContent, 'ts'>
) => {
  await sendBotCommand(mx, content.room_id, '!leave');
  if (content.action !== 'move' || !content.target_room_id) return;

  const target = mx.getRoom(content.target_room_id);
  if (!target) throw new Error('Target voice channel not found');
  // The bot auto-accepts invites, so invite it to channels it isn't in yet.
  if (target.getMember(botId)?.membership !== KnownMembership.Join) {
    if (target.getMember(botId)?.membership !== KnownMembership.Invite) {
      await mx.invite(target.roomId, botId);
    }
    if (!(await waitForJoin(mx, target, botId))) {
      throw new Error('Bot did not join the target voice channel');
    }
  }
  await new Promise((resolve) => {
    setTimeout(resolve, BOT_REJOIN_DELAY_MS);
  });
  await sendBotCommand(mx, target.roomId, '!join');
};
