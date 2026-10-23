import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// Updates download in the background; the app then offers "Restart to update"
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
