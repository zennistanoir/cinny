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
// Instead the moderator's client sends a command, and Zennith clients obey it
// after checking the sender's power in that room. The command goes out twice:
// as a to-device message to the member's call devices, and as a hidden event in
// the call room. Other clients (Element etc.) ignore the unknown event type.
//
// Stale commands (e.g. delivered after the member rejoined) are rejected by
// naming the call memberships being ended, not by comparing the two PCs'
// clocks: a PC clock a couple of minutes off made every command look stale.

export const CALL_MODERATION_EVENT = 'zennith.call.control';

// Commands from older clients (no memberships) older than this are ignored.
const MAX_AGE_MS = 60_000;

export type CallModerationContent = {
  action: 'disconnect' | 'move';
  room_id: string;
  target_room_id?: string;
  // Who the command is for. Needed on the room event, which every member sees.
  target_user_id?: string;
  // The member's call memberships being ended: device id -> membership created ts.
  memberships?: Record<string, number>;
  ts: number;
};

export type CallMemberDevice = { deviceId: string; createdTs: number };

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

export const sendCallModeration = async (
  mx: MatrixClient,
  userId: string,
  memberDevices: CallMemberDevice[],
  content: Pick<CallModerationContent, 'action' | 'room_id' | 'target_room_id'>
) => {
  const payload: CallModerationContent = {
    ...content,
    target_user_id: userId,
    memberships: Object.fromEntries(memberDevices.map((d) => [d.deviceId, d.createdTs])),
    ts: Date.now(),
  };
  const devices = new Map(memberDevices.map(({ deviceId }) => [deviceId, payload]));
  const results = await Promise.allSettled([
    mx.sendToDevice(CALL_MODERATION_EVENT, new Map([[userId, devices]])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.sendEvent(content.room_id, CALL_MODERATION_EVENT as any, payload),
  ]);
  // Fine as long as one route got through.
  if (results.every((r) => r.status === 'rejected')) {
    throw (results[0] as PromiseRejectedResult).reason;
  }
};

export const parseCallModeration = (content: unknown): CallModerationContent | undefined => {
  if (typeof content !== 'object' || content === null) return undefined;
  const c = content as Partial<CallModerationContent>;
  if (c.action !== 'disconnect' && c.action !== 'move') return undefined;
  if (typeof c.room_id !== 'string' || typeof c.ts !== 'number') return undefined;
  if (c.action === 'move' && typeof c.target_room_id !== 'string') return undefined;
  if (c.memberships !== undefined && (typeof c.memberships !== 'object' || !c.memberships)) {
    return undefined;
  }
  return c as CallModerationContent;
};

// Whether a command still applies to our current membership in its call.
// myMembershipTs: created ts of this device's membership there. ageMs: how old
// the command is when known without trusting clocks (a room event's age is
// measured by the server); only used for commands from clients that don't send
// memberships yet, which fall back to the sender's ts.
export const isCurrentCallModeration = (
  command: CallModerationContent,
  deviceId: string,
  myMembershipTs: number | undefined,
  ageMs?: number
): boolean => {
  if (command.memberships) {
    return myMembershipTs !== undefined && command.memberships[deviceId] === myMembershipTs;
  }
  return (ageMs ?? Math.abs(Date.now() - command.ts)) <= MAX_AGE_MS;
};

// Voice channels a member can be moved to: joined call rooms anywhere in the
// space, including categories (sub-spaces), or every joined call room when the
// channel isn't viewed inside a space.
const getSpaceRoomsDeep = (mx: MatrixClient, space: Room): Room[] => {
  const seen = new Set<string>([space.roomId]);
  const rooms: Room[] = [];
  const walk = (parent: Room) => {
    getSpaceChildren(parent).forEach((roomId) => {
      if (seen.has(roomId)) return;
      seen.add(roomId);
      const child = mx.getRoom(roomId);
      if (!child) return;
      if (child.isSpaceRoom()) walk(child);
      else rooms.push(child);
    });
  };
  walk(space);
  return rooms;
};

export const getMoveTargets = (mx: MatrixClient, space: Room | null, fromRoomId: string): Room[] =>
  (space ? getSpaceRoomsDeep(mx, space) : mx.getRooms()).filter(
    (r) => r.roomId !== fromRoomId && r.getMyMembership() === 'join' && r.isCallRoom()
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
  content: Pick<CallModerationContent, 'action' | 'room_id' | 'target_room_id'>
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
