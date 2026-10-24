import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { Descendant } from 'slate';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { IEventRelation } from 'matrix-js-sdk';
import { createUploadAtomFamily } from '../upload';
import { TUploadContent } from '../../utils/matrix';
import { createListAtom } from '../list';

export type TUploadMetadata = {
  markedAsSpoiler: boolean;
};

export type TUploadItem = {
  file: TUploadContent;
  originalFile: TUploadContent;
  metadata: TUploadMetadata;
  encInfo: EncryptedAttachmentInfo | undefined;
};

export type TUploadListAtom = ReturnType<typeof createListAtom<TUploadItem>>;

export const roomIdToUploadItemsAtomFamily = atomFamily<string, TUploadListAtom>(
  createListAtom
);

export const roomUploadAtomFamily = createUploadAtomFamily();

export type RoomIdToMsgAction =
  | {
      type: 'PUT';
      roomId: string;
      msg: Descendant[];
    }
  | {
      type: 'DELETE';
      roomId: string;
    };

// Drafts are mirrored to localStorage so they survive reloads and app restarts.
const MSG_DRAFT_KEY_PREFIX = 'zennith.draft.';

const loadStoredMsgDraft = (roomId: string): Descendant[] => {
  try {
    const raw = localStorage.getItem(MSG_DRAFT_KEY_PREFIX + roomId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const storeMsgDraft = (roomId: string, msg: Descendant[]) => {
  try {
    if (msg.length === 0) localStorage.removeItem(MSG_DRAFT_KEY_PREFIX + roomId);
    else localStorage.setItem(MSG_DRAFT_KEY_PREFIX + roomId, JSON.stringify(msg));
  } catch {
    // Storage full or unavailable: the in-memory draft still works.
  }
};

const createMsgDraftAtom = (roomId: string) => {
  const baseAtom = atom<Descendant[]>(loadStoredMsgDraft(roomId));
  return atom(
    (get) => get(baseAtom),
    (get, set, msg: Descendant[]) => {
      set(baseAtom, msg);
      storeMsgDraft(roomId, msg);
    }
  );
};
export type TMsgDraftAtom = ReturnType<typeof createMsgDraftAtom>;
export const roomIdToMsgDraftAtomFamily = atomFamily<string, TMsgDraftAtom>(createMsgDraftAtom);

export type IReplyDraft = {
  userId: string;
  eventId: string;
  body: string;
  formattedBody?: string | undefined;
  relation?: IEventRelation | undefined;
};
const createReplyDraftAtom = () => atom<IReplyDraft | undefined>(undefined);
export type TReplyDraftAtom = ReturnType<typeof createReplyDraftAtom>;
export const roomIdToReplyDraftAtomFamily = atomFamily<string, TReplyDraftAtom>(() =>
  createReplyDraftAtom()
);
