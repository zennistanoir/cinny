import React, { useEffect, useState } from 'react';
import { UpdateToast } from './UpdateToast';

// The web build notices a new deploy by fetching index.html and comparing its
// entry script (Vite hashes it per build) with the one this page loaded. The
// desktop build bundles its own files and updates through Tauri instead.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const entryScript = (doc: Document): string | undefined =>
  doc.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src') ??
  undefined;

const hasNewDeploy = async (current: string): Promise<boolean> => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return false;
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const latest = entryScript(doc);
  return latest !== undefined && latest !== current;
};

export function WebUpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isDesktop || !import.meta.env.PROD || available) return undefined;
    const current = entryScript(document);
    if (!current) return undefined;

    const check = () => {
      hasNewDeploy(current)
        .then((found) => found && setAvailable(true))
        .catch(() => undefined);
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [available]);

  if (!available || dismissed) return null;

  return (
    <UpdateToast
      title="New version available"
      description="Reload to get the latest Zennith. Later keeps this version until you next open it."
      actionLabel="Reload now"
      busyLabel="Reloading…"
      onLater={() => setDismissed(true)}
      onAction={() => window.location.reload()}
    />
  );
}
