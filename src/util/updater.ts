import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// Updates download in the background; the app then asks "Restart now" or "Later"
// (UpdateToast in src/app/plugins/desktop) instead of restarting mid-call. Zennith can
// sit in the tray for days, so it keeps checking until an update is ready.
const RECHECK_MS = 6 * 60 * 60 * 1000;

let readyUpdate: Update | undefined;
const listeners = new Set<() => void>();

export const getReadyUpdate = (): Update | undefined => readyUpdate;

export const subscribeReadyUpdate = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const downloadUpdate = async (): Promise<boolean> => {
  try {
    const update = await check();
    if (!update) {
      console.log('Zennith is up to date.');
      return false;
    }
    console.log(`Update available: ${update.version}, downloading.`);
    await update.download();
    readyUpdate = update;
    listeners.forEach((l) => l());
    return true;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return false;
  }
};

export function checkForZennithUpdates() {
  const run = async () => {
    if (!(await downloadUpdate())) window.setTimeout(run, RECHECK_MS);
  };
  run();
}

export async function restartToUpdate() {
  if (!readyUpdate) return;
  // On Windows the installer closes Zennith itself and starts the new version.
  await readyUpdate.install();
  await relaunch();
}

// "Later" in the update prompt: install on the next fresh launch, before the app
// loads, so nothing (like a call) is interrupted.
const INSTALL_ON_LAUNCH_KEY = 'zennith-install-on-launch';
const LAUNCH_CHECK_TIMEOUT_MS = 15000;

export function installOnNextLaunch() {
  if (readyUpdate) localStorage.setItem(INSTALL_ON_LAUNCH_KEY, readyUpdate.version);
}

// Returns true when an install has started (the installer closes and relaunches
// Zennith). Any failure falls through to a normal start.
export async function installDeferredUpdate(onInstalling: () => void): Promise<boolean> {
  if (!localStorage.getItem(INSTALL_ON_LAUNCH_KEY)) return false;
  // Cleared first, so an installer that keeps failing can't block every launch.
  localStorage.removeItem(INSTALL_ON_LAUNCH_KEY);
  try {
    onInstalling();
    const timeout = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), LAUNCH_CHECK_TIMEOUT_MS);
    });
    const update = await Promise.race([check(), timeout]);
    if (!update) return false;
    await update.downloadAndInstall();
    await relaunch();
    return true;
  } catch (error) {
    console.error('Failed to install update on launch:', error);
    return false;
  }
}
