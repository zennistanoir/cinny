/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getFallbackSession } from './app/state/sessions';
import { checkForZennithUpdates, installDeferredUpdate } from './util/updater';

document.body.classList.add(configClass, varsClass);

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  const sendSessionToSW = () => {
    const session = getFallbackSession();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  navigator.serviceWorker.register(swUrl).then(sendSessionToSW);
  navigator.serviceWorker.ready.then(sendSessionToSW);

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { type } = ev.data ?? {};

    if (type === 'requestSession') {
      sendSessionToSW();
    }
  });
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  // Trigger the private GitHub updater check on app launch
  checkForZennithUpdates();

  const root = createRoot(rootContainer);
  root.render(<App />);
};

const showInstallingScreen = () => {
  const status = document.createElement('div');
  status.textContent = 'Updating Zennith…';
  status.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'font:500 16px Inter, sans-serif;color:#d0d0d0;background:#101010;z-index:10000';
  document.body.appendChild(status);
  return status;
};

// An update postponed with "Later" installs here, before the app loads.
let installingScreen: HTMLElement | undefined;
installDeferredUpdate(() => {
  installingScreen = showInstallingScreen();
}).then((installing) => {
  if (installing) return;
  installingScreen?.remove();
  mountApp();
});
