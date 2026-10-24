// Shown once after an update (see WhatsNew.tsx). Newest first. Keep each item to a
// line: what changed and where to find it.

export type ChangelogEntry = {
  version: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.13',
    items: [
      'Press Ctrl + / anywhere to see every keyboard shortcut, with a quick link from Settings → Keybinds.',
      'Move between rooms without the mouse: Alt + ↑/↓ to step through, Alt + Shift + ↑/↓ to jump to unread, Esc to mark the current room read, Shift + Esc to clear every unread.',
      'Right-click the Inbox icon in the sidebar for Mark All as Read, and there is a matching button next to the Inbox header.',
      'Do Not Disturb now silences notification sounds and desktop popups while it is on, not only in the status badge.',
    ],
  },
  {
    version: '0.1.12',
    items: [
      'While you’re in a voice channel, the panel above your profile has camera, screen share, soundboard and noise suppression buttons.',
      'Your status now sticks: pick Online, Idle, Do Not Disturb or Invisible from your avatar. Do Not Disturb shows a red dot, and your pick carries over to Zennith on your other devices.',
      'Desktop app: links open in your web browser when you click them.',
    ],
  },
  {
    version: '0.1.11',
    items: [
      'Fixed a crash when opening the soundboard in a space with no sounds, or while every sound was unavailable.',
    ],
  },
  {
    version: '0.1.10',
    items: [
      'Voice channels show a muted or deafened icon next to people, in the room list and on their call tile.',
      'Desktop app: the “sharing a window” bar no longer pops up at the bottom of the screen when you share.',
      'Desktop app: window shares show only what the app displays, without its title bar or border.',
      'Desktop app: the red notification dot on the taskbar icon is smaller.',
    ],
  },
  {
    version: '0.1.9',
    items: [
      'Soundboard: play short sounds into the call from the call controls. Moderators add them in Space Settings → Soundboard.',
      'Switch voice channels without hanging up first: just click another one.',
      'Moderators can right-click someone in a voice channel to disconnect them or move them to another channel.',
      'New Accessibility page in Settings: reduced motion, high contrast, focus rings, text size, line spacing, a readable font, paused GIFs and visual call cues.',
      'Your own speaking ring lights up as soon as you talk, and everyone else’s reacts faster.',
      'About page credits that Zennith was forked and developed with the help of AI.',
    ],
  },
  {
    version: '0.1.8',
    items: [
      "Message drafts are kept per room, so a half-written message is still there when you come back.",
      'Room list shows unread counts, mentions, typing and muted icons again, plus DM avatars.',
      'Hover a voice channel member to get a volume button (right-click still works).',
      'Violet theme has a deeper accent and clearer contrast between panels.',
      'Hang up and Reject buttons are red, and call controls work better with screen readers.',
      'Animations are reduced when your system asks for reduced motion.',
    ],
  },
  {
    version: '0.1.7',
    items: [
      'Mic test in Settings → Voice & Video, with a level meter that shows where Voice Gate opens.',
      'Test button next to Output Device, to check which speakers or headset you picked.',
      "Push to talk keeps your mic open for a moment after you let go, so your last word isn't cut off.",
      'Search box in Settings to jump straight to any option.',
      'When a new version is ready, choose to update now or wait until you next open Zennith.',
      'Call sounds play on the output device you picked, not always the system default.',
      'zennandfriends.com is in the homeserver list on the login screen.',
    ],
  },
];
