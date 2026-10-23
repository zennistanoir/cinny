import { patchMedia } from './noiseSuppression';
import { patchPeerConnection } from './callStats';
import { installElementCallBridge } from './ecBridge';

// Element Call's index.html is built with an inline script that calls
// `parent.__zennithPatchMedia(window)` before its own bundle runs (see
// vite.config.js). Everything Zennith needs to hook inside the call iframe
// is installed from here.
(window as Window & { __zennithPatchMedia?: (win: Window) => void }).__zennithPatchMedia = (
  win: Window
) => {
  installElementCallBridge(win);
  patchMedia(win);
  patchPeerConnection(win);
};
