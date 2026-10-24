import React, { MouseEventHandler, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Icon, Icons, Menu, MenuItem, PopOut, RectCords, Text, config, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import FocusTrap from 'focus-trap-react';
import {
  SidebarAvatar,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemTooltip,
} from '../../../components/sidebar';
import { allInvitesAtom } from '../../../state/room-list/inviteList';
import {
  getInboxInvitesPath,
  getInboxNotificationsPath,
  getInboxPath,
  joinPathComponent,
} from '../../pathUtils';
import { useInboxSelected } from '../../../hooks/router/useInbox';
import { UnreadBadge } from '../../../components/unread-badge';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useNavToActivePathAtom } from '../../../state/hooks/navToActivePath';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { markAllAsRead } from '../../../utils/markAllAsRead';
import { stopPropagation } from '../../../utils/keyboard';

type InboxMenuProps = {
  requestClose: () => void;
};
const InboxMenu = forwardRef<HTMLDivElement, InboxMenuProps>(({ requestClose }, ref) => {
  const mx = useMatrixClient();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const hasUnread = roomToUnread.size > 0;

  const handleMarkAllAsRead = () => {
    if (!hasUnread) return;
    markAllAsRead(mx, roomToUnread, hideActivity);
    requestClose();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(200), width: '100vw' }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAllAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          aria-disabled={!hasUnread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark All as Read
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

export function InboxTab() {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const navToActivePath = useAtomValue(useNavToActivePathAtom());
  const inboxSelected = useInboxSelected();
  const allInvites = useAtomValue(allInvitesAtom);
  const inviteCount = allInvites.length;
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleContextMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    evt.preventDefault();
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  const handleInboxClick = () => {
    if (screenSize === ScreenSize.Mobile) {
      navigate(getInboxPath());
      return;
    }
    const activePath = navToActivePath.get('inbox');
    if (activePath) {
      navigate(joinPathComponent(activePath));
      return;
    }

    const path = inviteCount > 0 ? getInboxInvitesPath() : getInboxNotificationsPath();
    navigate(path);
  };

  return (
    <SidebarItem active={inboxSelected}>
      <SidebarItemTooltip tooltip="Inbox">
        {(triggerRef) => (
          <SidebarAvatar
            as="button"
            ref={triggerRef}
            outlined
            onClick={handleInboxClick}
            onContextMenu={handleContextMenu}
          >
            <Icon src={Icons.Inbox} filled={inboxSelected} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
      {inviteCount > 0 && (
        <SidebarItemBadge hasCount>
          <UnreadBadge highlight count={inviteCount} />
        </SidebarItemBadge>
      )}
      {menuAnchor && (
        <PopOut
          anchor={menuAnchor}
          position="Right"
          align="Start"
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: () => setMenuAnchor(undefined),
                clickOutsideDeactivates: true,
                isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                escapeDeactivates: stopPropagation,
              }}
            >
              <InboxMenu requestClose={() => setMenuAnchor(undefined)} />
            </FocusTrap>
          }
        />
      )}
    </SidebarItem>
  );
}
