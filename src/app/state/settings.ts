import { atom } from 'jotai';

const STORAGE_KEY = 'settings';
export type DateFormat =
  | 'D MMM YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'YYYY-MM-DD'
  | '';
export type MessageSpacing = '0' | '100' | '200' | '300' | '400' | '500';
export type VoiceGateLevel = 'off' | 'low' | 'medium' | 'high';
export type ScreenShareQuality = '720p30' | '1080p30' | '1080p60' | '1440p60';
export type ScreenShareContent = 'motion' | 'detail';
export type MotionPreference = 'system' | 'reduce' | 'allow';
export type MessageTextSize = '100' | '115' | '130' | '150';
export type LineSpacing = 'normal' | 'relaxed' | 'loose';
export enum MessageLayout {
  Modern = 0,
  Compact = 1,
  Bubble = 2,
}

export interface Settings {
  themeId?: string;
  useSystemTheme: boolean;
  lightThemeId?: string;
  darkThemeId?: string;
  monochromeMode?: boolean;
  isMarkdown: boolean;
  editorToolbar: boolean;
  twitterEmoji: boolean;
  pageZoom: number;
  hideActivity: boolean;

  isPeopleDrawer: boolean;
  memberSortFilterIndex: number;
  enterForNewline: boolean;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
  mediaAutoLoad: boolean;
  urlPreview: boolean;
  encUrlPreview: boolean;
  showHiddenEvents: boolean;
  legacyUsernameColor: boolean;

  showNotifications: boolean;
  isNotificationSounds: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  hour24Clock: boolean;
  dateFormatString: string;

  developerTools: boolean;

  keybindToggleMute?: string;
  keybindToggleDeafen?: string;
  keybindPushToTalk?: string;
  keybindToggleNoiseSuppression?: string;

  noiseSuppression: boolean;
  voiceGate: VoiceGateLevel;
  callToggleSounds: boolean;

  screenShareQuality: ScreenShareQuality;
  screenShareContent: ScreenShareContent;
  screenShareH264: boolean;

  // Accessibility.
  reducedMotion: MotionPreference;
  highContrast: boolean;
  focusRings: boolean;
  underlineLinks: boolean;
  messageTextSize: MessageTextSize;
  lineSpacing: LineSpacing;
  largeEmoji: boolean;
  readableFont: boolean;
  pauseAnimatedMedia: boolean;
  visualCallCues: boolean;
  alwaysShowHoverControls: boolean;

  // Desktop app only.
  globalCallHotkeys: boolean;
  closeToTray: boolean;
}

const defaultSettings: Settings = {
  themeId: undefined,
  useSystemTheme: true,
  lightThemeId: undefined,
  darkThemeId: undefined,
  monochromeMode: false,
  isMarkdown: true,
  editorToolbar: false,
  twitterEmoji: false,
  pageZoom: 100,
  hideActivity: false,

  isPeopleDrawer: true,
  memberSortFilterIndex: 0,
  enterForNewline: false,
  messageLayout: 0,
  messageSpacing: '400',
  hideMembershipEvents: false,
  hideNickAvatarEvents: true,
  mediaAutoLoad: true,
  urlPreview: true,
  encUrlPreview: false,
  showHiddenEvents: false,
  legacyUsernameColor: false,

  showNotifications: true,
  isNotificationSounds: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',

  hour24Clock: false,
  dateFormatString: 'D MMM YYYY',

  developerTools: false,

  keybindToggleMute: 'ctrl+shift+m',
  keybindToggleDeafen: 'ctrl+shift+d',
  keybindPushToTalk: 'ctrl+shift+space',
  keybindToggleNoiseSuppression: 'ctrl+shift+x',

  noiseSuppression: true,
  voiceGate: 'off',
  callToggleSounds: true,

  screenShareQuality: '1080p30',
  screenShareContent: 'motion',
  screenShareH264: false,

  reducedMotion: 'system',
  highContrast: false,
  focusRings: false,
  underlineLinks: false,
  messageTextSize: '100',
  lineSpacing: 'normal',
  largeEmoji: false,
  readableFont: false,
  pauseAnimatedMedia: false,
  visualCallCues: false,
  alwaysShowHoverControls: false,

  globalCallHotkeys: true,
  closeToTray: true,
};

export const getSettings = () => {
  const settings = localStorage.getItem(STORAGE_KEY);
  if (settings === null) return defaultSettings;
  return {
    ...defaultSettings,
    ...(JSON.parse(settings) as Settings),
  };
};

export const setSettings = (settings: Settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const baseSettings = atom<Settings>(getSettings());
export const settingsAtom = atom<Settings, [Settings], undefined>(
  (get) => get(baseSettings),
  (get, set, update) => {
    set(baseSettings, update);
    setSettings(update);
  }
);
