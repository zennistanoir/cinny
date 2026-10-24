// Index for the search box in Settings. `title` must match the setting's tile title
// (or section heading) exactly: picking a result scrolls to the element with that text.
// Add an entry here when you add a setting.

export enum SettingsSearchPage {
  General = 'General',
  VoiceVideo = 'Voice & Video',
  Accessibility = 'Accessibility',
  Account = 'Account',
  Notifications = 'Notifications',
  Devices = 'Devices',
  EmojisStickers = 'Emojis & Stickers',
  DeveloperTools = 'Developer Tools',
  Keybinds = 'Keybinds',
  About = 'About',
}

export type SettingsSearchEntry = {
  title: string;
  page: SettingsSearchPage;
  // Other words people might search for.
  keywords?: string;
  // Only shown in the desktop app.
  desktop?: boolean;
};

const P = SettingsSearchPage;

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  { title: 'Theme', page: P.General, keywords: 'dark light mode colors appearance' },
  { title: 'System Theme', page: P.General, keywords: 'dark light mode os' },
  { title: 'Monochrome Mode', page: P.General, keywords: 'grayscale colors' },
  { title: 'Twitter Emoji', page: P.General, keywords: 'twemoji emoji font' },
  { title: 'Page Zoom', page: P.General, keywords: 'scale size font bigger smaller' },
  { title: '24-Hour Time Format', page: P.General, keywords: 'clock time' },
  { title: 'Date Format', page: P.General, keywords: 'date day month year' },
  { title: 'ENTER for Newline', page: P.General, keywords: 'enter send shift line break' },
  { title: 'Markdown Formatting', page: P.General, keywords: 'bold italic code editor' },
  { title: 'Message Layout', page: P.General, keywords: 'modern compact bubble' },
  { title: 'Message Spacing', page: P.General, keywords: 'density gap' },
  { title: 'Legacy Username Color', page: P.General, keywords: 'name colour' },
  { title: 'Hide Membership Change', page: P.General, keywords: 'joined left events' },
  { title: 'Hide Profile Change', page: P.General, keywords: 'avatar name events' },
  { title: 'Hide Typing & Read Receipts', page: P.General, keywords: 'privacy typing seen' },
  { title: 'Disable Media Auto Load', page: P.General, keywords: 'images videos data' },
  { title: 'Url Preview', page: P.General, keywords: 'link embed' },
  { title: 'Url Preview in Encrypted Room', page: P.General, keywords: 'link embed e2ee' },
  { title: 'Show Hidden Events', page: P.General, keywords: 'debug state' },
  {
    title: 'Close to Tray',
    page: P.General,
    keywords: 'desktop minimize background quit',
    desktop: true,
  },
  { title: 'Start on Login', page: P.General, keywords: 'autostart boot startup', desktop: true },

  { title: 'Reduced Motion', page: P.Accessibility, keywords: 'animation motion sickness vestibular' },
  { title: 'High Contrast', page: P.Accessibility, keywords: 'contrast low vision text borders' },
  { title: 'Always Show Focus Rings', page: P.Accessibility, keywords: 'keyboard focus outline tab' },
  { title: 'Underline Links', page: P.Accessibility, keywords: 'links color blind' },
  { title: 'Monochrome Mode', page: P.Accessibility, keywords: 'grayscale colors' },
  { title: 'Page Zoom', page: P.Accessibility, keywords: 'scale size font bigger smaller' },
  { title: 'Message Text Size', page: P.Accessibility, keywords: 'font size bigger text' },
  { title: 'Line Spacing', page: P.Accessibility, keywords: 'line height readability dyslexia' },
  { title: 'Larger Emoji', page: P.Accessibility, keywords: 'emoji size bigger' },
  { title: 'Readable Font', page: P.Accessibility, keywords: 'atkinson hyperlegible dyslexia font' },
  { title: 'Pause Animated Media', page: P.Accessibility, keywords: 'gif animation autoplay stop' },
  { title: 'Visual Call Cues', page: P.Accessibility, keywords: 'deaf hearing captions sounds call' },
  {
    title: 'Always Show Hover Controls',
    page: P.Accessibility,
    keywords: 'buttons visible voice volume',
  },

  { title: 'Input Device', page: P.VoiceVideo, keywords: 'microphone mic audio input' },
  { title: 'Output Device', page: P.VoiceVideo, keywords: 'speakers headset headphones audio' },
  { title: 'Camera', page: P.VoiceVideo, keywords: 'webcam video' },
  { title: 'Noise Suppression', page: P.VoiceVideo, keywords: 'rnnoise background noise mic' },
  { title: 'Voice Gate', page: P.VoiceVideo, keywords: 'noise gate threshold keyboard mic' },
  { title: 'Mic Test', page: P.VoiceVideo, keywords: 'microphone level meter test' },
  { title: 'Quality', page: P.VoiceVideo, keywords: 'screen share stream resolution fps' },
  { title: 'Optimize For', page: P.VoiceVideo, keywords: 'screen share motion text' },
  { title: 'Hardware Encoding (H.264)', page: P.VoiceVideo, keywords: 'gpu screen share codec' },
  { title: 'Toggle Sounds', page: P.VoiceVideo, keywords: 'mute deafen cue sound' },
  {
    title: 'Lower Other Apps During Calls',
    page: P.VoiceVideo,
    keywords: 'ducking music volume windows',
    desktop: true,
  },

  { title: 'Profile', page: P.Account, keywords: 'avatar display name picture' },
  { title: 'Matrix ID', page: P.Account, keywords: 'username user id' },
  { title: 'Email Address', page: P.Account, keywords: 'contact mail' },
  { title: 'Blocked Users', page: P.Account, keywords: 'ignore block' },

  { title: 'Desktop Notifications', page: P.Notifications, keywords: 'alerts popup' },
  { title: 'Notification Sound', page: P.Notifications, keywords: 'alert ping' },
  { title: 'Email Notification', page: P.Notifications, keywords: 'mail' },
  { title: '1-to-1 Chats', page: P.Notifications, keywords: 'direct messages dm' },
  { title: 'Rooms', page: P.Notifications, keywords: 'group' },
  { title: 'Mention @room', page: P.Notifications, keywords: 'ping everyone' },
  { title: 'Keyword Messages', page: P.Notifications, keywords: 'highlight words' },

  { title: 'Device Dashboard', page: P.Devices, keywords: 'sessions' },
  { title: 'Device Verification', page: P.Devices, keywords: 'security keys encryption' },
  { title: 'Export Messages Data', page: P.Devices, keywords: 'backup keys encryption' },
  { title: 'Import Messages Data', page: P.Devices, keywords: 'restore keys encryption' },

  { title: 'Default Pack', page: P.EmojisStickers, keywords: 'emoji sticker' },
  { title: 'Favorite Packs', page: P.EmojisStickers, keywords: 'emoji sticker' },

  { title: 'Enable Developer Tools', page: P.DeveloperTools, keywords: 'debug devtools' },
  { title: 'Access Token', page: P.DeveloperTools, keywords: 'token' },

  { title: 'Toggle Mute', page: P.Keybinds, keywords: 'hotkey shortcut keyboard' },
  { title: 'Toggle Deafen', page: P.Keybinds, keywords: 'hotkey shortcut keyboard' },
  { title: 'Push to Talk', page: P.Keybinds, keywords: 'ptt hotkey shortcut keyboard' },
  { title: 'Toggle Noise Suppression', page: P.Keybinds, keywords: 'hotkey shortcut keyboard' },
  {
    title: 'Work Outside Zennith',
    page: P.Keybinds,
    keywords: 'global hotkeys background',
    desktop: true,
  },

  { title: 'Clear Cache & Reload', page: P.About, keywords: 'version reset' },
];

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const searchSettings = (query: string): SettingsSearchEntry[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return SETTINGS_SEARCH_INDEX.filter((entry) => {
    if (entry.desktop && !isDesktop) return false;
    const haystack = `${entry.title} ${entry.page} ${entry.keywords ?? ''}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
};
