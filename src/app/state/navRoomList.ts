import { atom, useSetAtom } from 'jotai';
import { useEffect } from 'react';

// The rooms the open room list shows, in display order. The lists are virtualized, so the
// navigation keys read this instead of the DOM.
export type NavRoomList = {
  roomIds: string[];
  selectedRoomId?: string;
  toPath: (roomId: string) => string;
};

export const navRoomListAtom = atom<NavRoomList | undefined>(undefined);

export const usePublishNavRoomList = (
  roomIds: string[],
  selectedRoomId: string | undefined,
  toPath: (roomId: string) => string
) => {
  const setList = useSetAtom(navRoomListAtom);

  useEffect(() => {
    const list: NavRoomList = { roomIds, selectedRoomId, toPath };
    setList(list);
    return () => setList((current) => (current === list ? undefined : current));
  }, [setList, roomIds, selectedRoomId, toPath]);
};
