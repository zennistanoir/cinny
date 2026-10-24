// Shown once after an update (see WhatsNew.tsx). Newest first. Keep each item to a
// line: what changed and where to find it.

export type ChangelogEntry = {
  version: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
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
