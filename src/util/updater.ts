import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForZennithUpdates() {
  try {
    const update = await check({
      headers: {
        Authorization: "Bearer YOUR_GITHUB_TOKEN_HERE"
      }
    });

    if (update?.available) {
      console.log(`Update available: ${update.version}`);
      await update.downloadAndInstall();
      await relaunch();
    } else {
      console.log('Zennith is up to date.');
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}
