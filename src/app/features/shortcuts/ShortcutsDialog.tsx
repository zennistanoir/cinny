import React, { useCallback } from 'react';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue } from 'jotai';
import { isKeyHotkey } from 'is-hotkey';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Text,
  config,
  toRem,
} from 'folds';
import { shortcutsModalAtom } from '../../state/shortcutsModal';
import { navRoomListAtom } from '../../state/navRoomList';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { useKeyDown } from '../../hooks/useKeyDown';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { factoryRoomIdByActivity } from '../../utils/sort';
import { markAllAsRead } from '../../utils/markAllAsRead';
import { stopPropagation } from '../../utils/keyboard';
import { hotkeyStorageToDisplay } from '../settings/keybinds/Keybinds';
import * as css from './ShortcutsDialog.css';

type Shortcut = { keys: string[]; label: string };

const NAVIGATION: Shortcut[] = [
  { keys: ['Ctrl', 'K'], label: 'Search rooms' },
  { keys: ['Alt', '↑'], label: 'Previous room' },
  { keys: ['Alt', '↓'], label: 'Next room' },
  { keys: ['Alt', 'Shift', '↑'], label: 'Previous unread room' },
  { keys: ['Alt', 'Shift', '↓'], label: 'Next unread room' },
  { keys: ['Ctrl', '/'], label: 'Show keyboard shortcuts' },
];

const MESSAGES: Shortcut[] = [
  { keys: ['Esc'], label: 'Mark room as read' },
  { keys: ['Shift', 'Esc'], label: 'Mark all rooms as read' },
  { keys: ['Enter'], label: 'Send message' },
  { keys: ['Shift', 'Enter'], label: 'New line' },
  { keys: ['↑'], label: 'Edit your last message (empty composer)' },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <Box shrink="No" gap="100" alignItems="Center">
      {keys.map((key) => (
        <kbd key={key} className={css.Kbd}>
          {key}
        </kbd>
      ))}
    </Box>
  );
}

function ShortcutSection({ title, items }: { title: string; items: Shortcut[] }) {
  return (
    <Box direction="Column" gap="200">
      <Text size="L400" priority="400">
        {title}
      </Text>
      {items.map((item) => (
        <Box key={item.label} alignItems="Center" justifyContent="SpaceBetween" gap="300">
          <Text size="T300">{item.label}</Text>
          <Keys keys={item.keys} />
        </Box>
      ))}
    </Box>
  );
}

export function ShortcutsDialog({ requestClose }: { requestClose: () => void }) {
  const [mute] = useSetting(settingsAtom, 'keybindToggleMute');
  const [deafen] = useSetting(settingsAtom, 'keybindToggleDeafen');
  const [pushToTalk] = useSetting(settingsAtom, 'keybindPushToTalk');
  const [noiseSuppression] = useSetting(settingsAtom, 'keybindToggleNoiseSuppression');

  const voice: Shortcut[] = [
    { label: 'Toggle mute', raw: mute },
    { label: 'Toggle deafen', raw: deafen },
    { label: 'Push to talk', raw: pushToTalk },
    { label: 'Toggle noise suppression', raw: noiseSuppression },
  ]
    .filter((item): item is { label: string; raw: string } => !!item.raw)
    .map(({ label, raw }) => ({ label, keys: hotkeyStorageToDisplay(raw).split(' + ') }));

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: requestClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface" style={{ maxWidth: toRem(440) }}>
            <Header
              style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">Keyboard Shortcuts</Text>
              </Box>
              <IconButton size="300" onClick={requestClose} radii="300" aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Scroll size="300" hideTrack style={{ maxHeight: '70vh' }}>
              <Box style={{ padding: config.space.S400 }} direction="Column" gap="600">
                <ShortcutSection title="Navigation" items={NAVIGATION} />
                <ShortcutSection title="Messages" items={MESSAGES} />
                {voice.length > 0 ? (
                  <ShortcutSection title="Voice" items={voice} />
                ) : (
                  <Box direction="Column" gap="200">
                    <Text size="L400" priority="400">
                      Voice
                    </Text>
                    <Text size="T300" priority="300">
                      No voice keybinds set. Add them in Settings, Keybinds.
                    </Text>
                  </Box>
                )}
              </Box>
            </Scroll>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

const isShortcutsHotkey = (evt: KeyboardEvent) =>
  isKeyHotkey('mod+/', evt) || ((evt.ctrlKey || evt.metaKey) && evt.code === 'Slash');

export function ShortcutsDialogRenderer() {
  const [opened, setOpen] = useAtom(shortcutsModalAtom);

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (!isShortcutsHotkey(evt)) return;
        evt.preventDefault();
        if (opened) {
          setOpen(false);
          return;
        }
        const portalContainer = document.getElementById('portalContainer');
        if (portalContainer && portalContainer.children.length > 0) return;
        setOpen(true);
      },
      [opened, setOpen]
    )
  );

  return opened ? <ShortcutsDialog requestClose={() => setOpen(false)} /> : null;
}

/**
 * Alt+↑/↓ moves through the open room list, Alt+Shift+↑/↓ jumps between unread rooms and
 * Shift+Esc marks every room as read. These work while typing.
 */
export function NavigationKeybinds() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const { navigateRoom } = useRoomNavigate();
  const navList = useAtomValue(navRoomListAtom);
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  const step = useCallback(
    (roomIds: string[], current: string | undefined, dir: 1 | -1): string | undefined => {
      if (roomIds.length === 0) return undefined;
      const index = current ? roomIds.indexOf(current) : -1;
      if (index === -1) return dir === 1 ? roomIds[0] : roomIds[roomIds.length - 1];
      return roomIds[(index + dir + roomIds.length) % roomIds.length];
    },
    []
  );

  const goUnread = useCallback(
    (dir: 1 | -1) => {
      const isUnreadRoom = (roomId: string) =>
        roomToUnread.has(roomId) && mx.getRoom(roomId)?.isSpaceRoom() === false;
      const current = navList?.selectedRoomId;

      const listUnread = navList?.roomIds.filter(
        (roomId) => isUnreadRoom(roomId) || roomId === current
      );
      if (navList && listUnread && listUnread.some((roomId) => roomId !== current)) {
        const target = step(listUnread, current, dir);
        if (target && target !== current) navigate(navList.toPath(target));
        return;
      }

      // Nothing unread in this list: look across every room, most recent first.
      const allUnread = Array.from(roomToUnread.keys())
        .filter((roomId) => isUnreadRoom(roomId) || roomId === current)
        .sort(factoryRoomIdByActivity(mx));
      const target = step(allUnread, current, dir);
      if (target && target !== current) navigateRoom(target);
    },
    [mx, navList, roomToUnread, step, navigate, navigateRoom]
  );

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isKeyHotkey('alt+arrowup', evt) || isKeyHotkey('alt+arrowdown', evt)) {
          if (!navList) return;
          evt.preventDefault();
          const target = step(
            navList.roomIds,
            navList.selectedRoomId,
            evt.key === 'ArrowDown' ? 1 : -1
          );
          if (target) navigate(navList.toPath(target));
          return;
        }
        if (isKeyHotkey('alt+shift+arrowup', evt) || isKeyHotkey('alt+shift+arrowdown', evt)) {
          evt.preventDefault();
          goUnread(evt.key === 'ArrowDown' ? 1 : -1);
          return;
        }
        if (isKeyHotkey('shift+escape', evt)) {
          evt.preventDefault();
          markAllAsRead(mx, roomToUnread, hideActivity);
        }
      },
      [mx, navList, roomToUnread, hideActivity, step, navigate, goUnread]
    )
  );

  return null;
}
