// Shown once after an update (see WhatsNew.tsx). Newest first. Keep each item to a
// line: what changed and where to find it.

export type ChangelogEntry = {
  version: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
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
