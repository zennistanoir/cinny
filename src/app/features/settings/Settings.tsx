import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Input,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { General } from './general';
import { PageNav, PageNavContent, PageNavHeader, PageRoot } from '../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { Account } from './account';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import { nameInitials } from '../../utils/common';
import { Notifications } from './notifications';
import { Devices } from './devices';
import { EmojisStickers } from './emojis-stickers';
import { DeveloperTools } from './developer-tools';
import { About } from './about';
import { Keybinds } from './keybinds/Keybinds';
import { VoiceVideo } from './voice-video';
import { UseStateProvider } from '../../components/UseStateProvider';
import { stopPropagation } from '../../utils/keyboard';
import { LogoutDialog } from '../../components/LogoutDialog';
import { searchSettings, SettingsSearchEntry, SettingsSearchPage } from './settingsSearch';

export enum SettingsPages {
  GeneralPage,
  AccountPage,
  NotificationPage,
  DevicesPage,
  EmojisStickersPage,
  DeveloperToolsPage,
  KeybindsPage,
  AboutPage,
  VoiceVideoPage,
}

type SettingsMenuItem = {
  page: SettingsPages;
  name: string;
  icon: IconSrc;
};

const useSettingsMenuItems = (): SettingsMenuItem[] =>
  useMemo(
    () => [
      {
        page: SettingsPages.GeneralPage,
        name: 'General',
        icon: Icons.Setting,
      },
      {
        page: SettingsPages.VoiceVideoPage,
        name: 'Voice & Video',
        icon: Icons.Mic,
      },
      {
        page: SettingsPages.AccountPage,
        name: 'Account',
        icon: Icons.User,
      },
      {
        page: SettingsPages.NotificationPage,
        name: 'Notifications',
        icon: Icons.Bell,
      },
      {
        page: SettingsPages.DevicesPage,
        name: 'Devices',
        icon: Icons.Monitor,
      },
      {
        page: SettingsPages.EmojisStickersPage,
        name: 'Emojis & Stickers',
        icon: Icons.Smile,
      },
      {
        page: SettingsPages.DeveloperToolsPage,
        name: 'Developer Tools',
        icon: Icons.Terminal,
      },
      {
        page: SettingsPages.KeybindsPage,
        name: 'Keybinds',
        icon: Icons.Pencil,
      },
      {
        page: SettingsPages.AboutPage,
        name: 'About',
        icon: Icons.Info,
      },
    ],
    []
  );

const SEARCH_PAGES: Record<SettingsSearchPage, SettingsPages> = {
  [SettingsSearchPage.General]: SettingsPages.GeneralPage,
  [SettingsSearchPage.VoiceVideo]: SettingsPages.VoiceVideoPage,
  [SettingsSearchPage.Account]: SettingsPages.AccountPage,
  [SettingsSearchPage.Notifications]: SettingsPages.NotificationPage,
  [SettingsSearchPage.Devices]: SettingsPages.DevicesPage,
  [SettingsSearchPage.EmojisStickers]: SettingsPages.EmojisStickersPage,
  [SettingsSearchPage.DeveloperTools]: SettingsPages.DeveloperToolsPage,
  [SettingsSearchPage.Keybinds]: SettingsPages.KeybindsPage,
  [SettingsSearchPage.About]: SettingsPages.AboutPage,
};

type SettingsProps = {
  initialPage?: SettingsPages;
  requestClose: () => void;
};
export function Settings({ initialPage, requestClose }: SettingsProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId()!;
  const profile = useUserProfile(userId);
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const screenSize = useScreenSizeContext();
  const [activePage, setActivePage] = useState<SettingsPages | undefined>(() => {
    if (initialPage) return initialPage;
    return screenSize === ScreenSize.Mobile ? undefined : SettingsPages.GeneralPage;
  });
  const menuItems = useSettingsMenuItems();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchSettings(query), [query]);
  const pageRef = useRef<HTMLDivElement>(null);
  const [focusTitle, setFocusTitle] = useState<string>();

  const openResult = (entry: SettingsSearchEntry) => {
    setActivePage(SEARCH_PAGES[entry.page]);
    setFocusTitle(entry.title);
  };

  // Scroll to and flash the setting a search result points at. Some pages render
  // their tiles a moment late (device lists, profile), so it retries briefly.
  useEffect(() => {
    if (!focusTitle) return undefined;
    let tries = 0;
    let timer: number | undefined;
    const find = () => {
      const target = Array.from(pageRef.current?.querySelectorAll('p') ?? []).find(
        (el) => el.textContent?.trim() === focusTitle
      );
      if (!target) {
        tries += 1;
        if (tries < 20) timer = window.setTimeout(find, 100);
        else setFocusTitle(undefined);
        return;
      }
      // The SettingTile row, or the heading itself for a section title.
      const tile = target.parentElement?.parentElement ?? target;
      tile.scrollIntoView({ block: 'center', behavior: 'smooth' });
      tile.animate(
        [
          { boxShadow: `0 0 0 ${toRem(2)} ${color.Primary.Main}` },
          { boxShadow: `0 0 0 ${toRem(2)} transparent` },
        ],
        { duration: 1800, easing: 'ease-in' }
      );
      setFocusTitle(undefined);
    };
    timer = window.setTimeout(find, 50);
    return () => window.clearTimeout(timer);
  }, [focusTitle, activePage]);

  const handlePageRequestClose = () => {
    if (screenSize === ScreenSize.Mobile) {
      setActivePage(undefined);
      return;
    }
    requestClose();
  };

  return (
    <PageRoot
      nav={
        screenSize === ScreenSize.Mobile && activePage !== undefined ? undefined : (
          <PageNav size="300">
            <PageNavHeader outlined={false}>
              <Box grow="Yes" gap="200">
                <Avatar size="200" radii="300">
                  <UserAvatar
                    userId={userId}
                    src={avatarUrl}
                    renderFallback={() => <Text size="H6">{nameInitials(displayName)}</Text>}
                  />
                </Avatar>
                <Text size="H4" truncate>
                  Settings
                </Text>
              </Box>
              <Box shrink="No">
                {screenSize === ScreenSize.Mobile && (
                  <IconButton onClick={requestClose} variant="Background">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                )}
              </Box>
            </PageNavHeader>
            <Box grow="Yes" direction="Column">
              <PageNavContent>
                <Box style={{ padding: `0 ${config.space.S100} ${config.space.S200}` }}>
                  <Input
                    size="300"
                    variant="Background"
                    radii="400"
                    outlined
                    placeholder="Search settings"
                    aria-label="Search settings"
                    value={query}
                    before={<Icon size="50" src={Icons.Search} />}
                    after={
                      query && (
                        <IconButton
                          size="300"
                          radii="300"
                          variant="Background"
                          aria-label="Clear search"
                          onClick={() => setQuery('')}
                        >
                          <Icon size="50" src={Icons.Cross} />
                        </IconButton>
                      )
                    }
                    onChange={(evt) => setQuery(evt.currentTarget.value)}
                    onKeyDown={(evt) => {
                      if (evt.key === 'Enter' && results[0]) openResult(results[0]);
                      if (evt.key === 'Escape' && query) {
                        evt.stopPropagation();
                        setQuery('');
                      }
                    }}
                  />
                </Box>
                <div style={{ flexGrow: 1 }}>
                  {query && results.length === 0 && (
                    <Box style={{ padding: config.space.S300 }}>
                      <Text size="T300" priority="300">
                        No settings match &quot;{query}&quot;.
                      </Text>
                    </Box>
                  )}
                  {results.map((entry) => (
                    <MenuItem
                      key={`${entry.page}:${entry.title}`}
                      variant="Background"
                      radii="400"
                      onClick={() => openResult(entry)}
                    >
                      <Box direction="Column">
                        <Text size="T300" truncate>
                          {entry.title}
                        </Text>
                        <Text size="T200" priority="300" truncate>
                          {entry.page}
                        </Text>
                      </Box>
                    </MenuItem>
                  ))}
                  {!query &&
                    menuItems.map((item) => (
                      <MenuItem
                        key={item.name}
                        variant="Background"
                        radii="400"
                        aria-pressed={activePage === item.page}
                        before={
                          <Icon src={item.icon} size="100" filled={activePage === item.page} />
                        }
                        onClick={() => setActivePage(item.page)}
                      >
                        <Text
                          style={{
                            fontWeight:
                              activePage === item.page ? config.fontWeight.W600 : undefined,
                          }}
                          size="T300"
                          truncate
                        >
                          {item.name}
                        </Text>
                      </MenuItem>
                    ))}
                </div>
              </PageNavContent>
              <Box style={{ padding: config.space.S200 }} shrink="No" direction="Column">
                <UseStateProvider initial={false}>
                  {(logout, setLogout) => (
                    <>
                      <Button
                        size="300"
                        variant="Critical"
                        fill="None"
                        radii="Pill"
                        before={<Icon src={Icons.Power} size="100" />}
                        onClick={() => setLogout(true)}
                      >
                        <Text size="B400">Logout</Text>
                      </Button>
                      {logout && (
                        <Overlay open backdrop={<OverlayBackdrop />}>
                          <OverlayCenter>
                            <FocusTrap
                              focusTrapOptions={{
                                onDeactivate: () => setLogout(false),
                                clickOutsideDeactivates: true,
                                escapeDeactivates: stopPropagation,
                              }}
                            >
                              <LogoutDialog handleClose={() => setLogout(false)} />
                            </FocusTrap>
                          </OverlayCenter>
                        </Overlay>
                      )}
                    </>
                  )}
                </UseStateProvider>
              </Box>
            </Box>
          </PageNav>
        )
      }
    >
      {activePage !== undefined && (
        <Box ref={pageRef} grow="Yes" style={{ minWidth: 0 }}>
          {activePage === SettingsPages.GeneralPage && (
            <General requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.VoiceVideoPage && (
            <VoiceVideo requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.AccountPage && (
            <Account requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.NotificationPage && (
            <Notifications requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.DevicesPage && (
            <Devices requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.EmojisStickersPage && (
            <EmojisStickers requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.DeveloperToolsPage && (
            <DeveloperTools requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.KeybindsPage && (
            <Keybinds requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.AboutPage && (
            <About requestClose={handlePageRequestClose} />
          )}
        </Box>
      )}
    </PageRoot>
  );
}
