import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useAtomValue } from 'jotai';
import { Box, Switch, Text } from 'folds';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import { callEmbedAtom } from '../../state/callEmbed';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { SequenceCard } from '../../components/sequence-card';
import { SettingTile } from '../../components/setting-tile';
import { SequenceCardStyle } from '../../features/settings/styles.css';
import { UpdateToast } from '../../components/update-toast/UpdateToast';
import { PTT_RELEASE_DELAY_MS } from '../../components/CallEmbedProvider';
import {
  getReadyUpdate,
  installOnNextLaunch,
  restartToUpdate,
  subscribeReadyUpdate,
} from '../../../util/updater';

// Desktop (Tauri) integration. The web build has a no-op copy of this module with the
// same exports, so shared code can call into it unconditionally.

// --- Taskbar badge ---------------------------------------------------------------------

export type UnreadBadge = 'none' | 'unread' | 'highlight';

let lastBadge: UnreadBadge | undefined;
export const setUnreadBadge = (badge: UnreadBadge) => {
  if (badge === lastBadge) return;
  lastBadge = badge;
  invoke('set_unread_badge', { state: badge }).catch(() => undefined);
};

// --- Global call hotkeys ---------------------------------------------------------------
// Registered only while the window is unfocused, so they never fire alongside the
// in-window keybinds (GlobalKeybindsListener in CallEmbedProvider).

// A system-wide hotkey is swallowed for every other app, so a plain typing key (a
// letter, space) would stop working everywhere. Those stay in-window only.
const GLOBAL_SAFE_KEY = /^(f\d{1,2}|pause|scrolllock|insert)$/;

const toAccelerator = (hotkey?: string): string | undefined => {
  if (!hotkey) return undefined;
  const parts = hotkey.split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  if (!key) return undefined;
  if (!modifiers.includes('ctrl') && !modifiers.includes('alt') && !GLOBAL_SAFE_KEY.test(key)) {
    return undefined;
  }
  // global-hotkey parses names case-insensitively: "CTRL+SHIFT+SPACE", "ALT+F13".
  return hotkey.toUpperCase();
};

// Register/unregister calls are chained so a quick focus flip can't unregister a
// hotkey the next registration just added.
let shortcutQueue: Promise<void> = Promise.resolve();
const queueShortcuts = (task: () => Promise<void>) => {
  shortcutQueue = shortcutQueue.then(task, task);
};

function GlobalCallHotkeys() {
  const callEmbed = useAtomValue(callEmbedAtom);
  const [enabled] = useSetting(settingsAtom, 'globalCallHotkeys');
  const [toggleMute] = useSetting(settingsAtom, 'keybindToggleMute');
  const [toggleDeafen] = useSetting(settingsAtom, 'keybindToggleDeafen');
  const [pushToTalk] = useSetting(settingsAtom, 'keybindPushToTalk');
  const [focused, setFocused] = useState(() => document.hasFocus());

  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload }) => setFocused(payload));
    return () => {
      unlisten.then((fn) => fn()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !callEmbed || focused) return undefined;
    const { control } = callEmbed;

    let pttPrevMic: boolean | null = null;
    let releaseTimer: number | undefined;
    const releasePtt = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = undefined;
      if (pttPrevMic === false && control.microphone) control.toggleMicrophone();
      pttPrevMic = null;
    };

    const bindings: [string | undefined, (pressed: boolean) => void][] = [
      [toAccelerator(toggleMute), (pressed) => pressed && control.toggleMicrophone()],
      [toAccelerator(toggleDeafen), (pressed) => pressed && control.toggleSound()],
      [
        toAccelerator(pushToTalk),
        (pressed) => {
          if (!pressed) {
            // Same short tail as the in-window keybind, so the last word isn't clipped.
            if (pttPrevMic !== null && releaseTimer === undefined) {
              releaseTimer = window.setTimeout(releasePtt, PTT_RELEASE_DELAY_MS);
            }
          } else if (releaseTimer !== undefined) {
            // Pressed again before the tail ran out: keep talking.
            window.clearTimeout(releaseTimer);
            releaseTimer = undefined;
          } else if (pttPrevMic === null) {
            pttPrevMic = control.microphone;
            if (!pttPrevMic) control.toggleMicrophone();
          }
        },
      ],
    ];

    let disposed = false;
    const registered: string[] = [];
    queueShortcuts(async () => {
      const active = bindings.filter(
        (binding): binding is [string, (pressed: boolean) => void] => !!binding[0]
      );
      // eslint-disable-next-line no-restricted-syntax
      for (const [accelerator, handler] of active) {
        if (disposed) return;
        let held = false;
        try {
          // eslint-disable-next-line no-await-in-loop
          await register(accelerator, ({ state }) => {
            const pressed = state === 'Pressed';
            if (pressed === held) return; // key repeat
            held = pressed;
            handler(pressed);
          });
          registered.push(accelerator);
        } catch (err) {
          // Taken by another app, or a key global-hotkey can't parse.
          console.warn(`[zennith] Global hotkey ${accelerator} unavailable`, err);
        }
      }
    });

    return () => {
      disposed = true;
      releasePtt();
      queueShortcuts(async () => {
        if (registered.length > 0) await unregister(registered).catch(() => undefined);
      });
    };
  }, [enabled, callEmbed, focused, toggleMute, toggleDeafen, pushToTalk]);

  return null;
}

// --- Close to tray ---------------------------------------------------------------------

function CloseToTraySync() {
  const [closeToTray] = useSetting(settingsAtom, 'closeToTray');
  useEffect(() => {
    invoke('set_close_to_tray', { enabled: closeToTray }).catch(() => undefined);
  }, [closeToTray]);
  return null;
}

// --- Restart to update -----------------------------------------------------------------

function DesktopUpdateToast() {
  const update = useSyncExternalStore(subscribeReadyUpdate, getReadyUpdate);
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!update || dismissed) return null;

  const handleRestart = () => {
    setRestarting(true);
    setFailed(false);
    restartToUpdate().catch((err) => {
      console.error('Failed to install update:', err);
      setRestarting(false);
      setFailed(true);
    });
  };

  const handleLater = () => {
    installOnNextLaunch();
    setDismissed(true);
  };

  return (
    <UpdateToast
      title="Update available"
      description={
        failed
          ? `Couldn't install Zennith ${update.version}. Try again, or pick Later to install it next time you open Zennith.`
          : `Zennith ${update.version} is ready. Restart now, or it installs the next time you open Zennith.`
      }
      actionLabel="Restart now"
      busyLabel="Restarting…"
      busy={restarting}
      onLater={handleLater}
      onAction={handleRestart}
    />
  );
}

export function DesktopIntegration() {
  return (
    <>
      <GlobalCallHotkeys />
      <CloseToTraySync />
      <DesktopUpdateToast />
    </>
  );
}

// --- Settings --------------------------------------------------------------------------

export function DesktopHotkeysSetting() {
  const [globalHotkeys, setGlobalHotkeys] = useSetting(settingsAtom, 'globalCallHotkeys');
  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Work Outside Zennith"
        description="Mute, deafen and push to talk work while other apps are focused. Needs Ctrl, Alt or an F-key, so normal typing isn't blocked."
        after={<Switch variant="Primary" value={globalHotkeys} onChange={setGlobalHotkeys} />}
      />
    </SequenceCard>
  );
}

// Windows turns other apps down while a call has the microphone open. That's a per-user
// Windows setting (Sound → Communications), so this switch changes it for every app.
const NO_DUCKING = 3;
const PREV_DUCKING_KEY = 'zennith-prev-ducking';

export function DesktopCallDuckingSetting() {
  const [ducking, setDucking] = useState<boolean>();

  useEffect(() => {
    invoke<number | null>('get_ducking_preference')
      .then((value) => setDucking(value !== NO_DUCKING))
      .catch(() => setDucking(true));
  }, []);

  const handleChange = async (value: boolean) => {
    const prev = ducking;
    setDucking(value);
    try {
      if (value) {
        // Restore what Windows had before it was switched off here; unset is its default.
        const saved = JSON.parse(localStorage.getItem(PREV_DUCKING_KEY) ?? 'null');
        await invoke('set_ducking_preference', {
          value: typeof saved === 'number' && saved !== NO_DUCKING ? saved : null,
        });
        localStorage.removeItem(PREV_DUCKING_KEY);
      } else {
        const current = await invoke<number | null>('get_ducking_preference');
        localStorage.setItem(PREV_DUCKING_KEY, JSON.stringify(current));
        await invoke('set_ducking_preference', { value: NO_DUCKING });
      }
    } catch (err) {
      console.warn('[zennith] Could not change Windows call ducking', err);
      setDucking(prev);
    }
  };

  return (
    <SettingTile
      title="Lower Other Apps During Calls"
      description="Windows quiets music and games during calls. A system setting, so it affects other calling apps too."
      after={
        <Switch
          variant="Primary"
          value={ducking ?? true}
          disabled={ducking === undefined}
          onChange={handleChange}
        />
      }
    />
  );
}

function StartOnLogin() {
  const [enabled, setEnabled] = useState<boolean>();

  useEffect(() => {
    isAutostartEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);

  const handleChange = (value: boolean) => {
    const prev = enabled;
    setEnabled(value);
    (value ? enableAutostart() : disableAutostart()).catch((err) => {
      console.warn('[zennith] Could not change start on login', err);
      setEnabled(prev);
    });
  };

  return (
    <SettingTile
      title="Start on Login"
      description="Open Zennith in the system tray when you sign in to your computer."
      after={
        <Switch
          variant="Primary"
          value={enabled ?? false}
          disabled={enabled === undefined}
          onChange={handleChange}
        />
      }
    />
  );
}

export function DesktopAppSettings() {
  const [closeToTray, setCloseToTray] = useSetting(settingsAtom, 'closeToTray');
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Desktop App</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Close to Tray"
          description="Keep Zennith running in the tray when you close the window. Quit from the tray icon."
          after={<Switch variant="Primary" value={closeToTray} onChange={setCloseToTray} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <StartOnLogin />
      </SequenceCard>
    </Box>
  );
}
