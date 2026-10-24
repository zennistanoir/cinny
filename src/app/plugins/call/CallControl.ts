import { ClientWidgetApi } from 'matrix-widget-api';
import EventEmitter from 'events';
import { CallControlState } from './CallControlState';
import { ElementMediaStateDetail, ElementMediaStatePayload, ElementWidgetActions } from './types';
import { setLocalDeafened } from './ecBridge';

// Set on the call iframe's <html> while a stream is maximized.
const MAXIMIZED_ATTR = 'data-zennith-maximized';

// Polls until `get` returns a value or the timeout passes.
const waitFor = async <T>(get: () => T | undefined, timeoutMs = 1500): Promise<T | undefined> => {
  const start = Date.now();
  let value = get();
  while (value === undefined && Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    value = get();
  }
  return value;
};

export enum CallControlEvent {
  StateUpdate = 'state_update',
}

export class CallControl extends EventEmitter implements CallControlState {
  private state: CallControlState;

  private call: ClientWidgetApi;

  private iframe: HTMLIFrameElement;

  private bodyMutationObserver: MutationObserver;

  private controlMutationObserver: MutationObserver;

  private mediaStatePromiseResolver: undefined | (() => void);

  private reactionsOpen = false;

  private reactionsCloseHandler: (() => void) | undefined;

  private get document(): Document | undefined {
    return this.iframe.contentDocument ?? this.iframe.contentWindow?.document;
  }

  private get screenshareButton(): HTMLElement | undefined {
    const screenshareBtn = this.document?.querySelector(
      '[data-testid="incall_screenshare"]'
    ) as HTMLElement | null;

    return screenshareBtn ?? undefined;
  }

  private get leaveButton(): Element | undefined {
    const leaveBtn = this.document?.querySelector('[data-testid="incall_leave"]');

    return leaveBtn ?? undefined;
  }

  private get settingsButton(): HTMLElement | undefined {
    const settingsButtonLeft = this.document?.querySelector(
      '[data-testid="settings-bottom-left"]'
    ) as HTMLButtonElement | undefined;
    const settingsButtonCenter = this.document?.querySelector(
      '[data-testid="settings-bottom-center"]'
    ) as HTMLButtonElement | undefined;

    return settingsButtonLeft ?? settingsButtonCenter ?? undefined;
  }

  private get reactionsButton(): HTMLElement | undefined {
    const reactionsButton = this.leaveButton?.previousElementSibling as HTMLElement | null;

    return reactionsButton ?? undefined;
  }

  private get spotlightButton(): HTMLInputElement | undefined {
    const spotlightButton = this.document?.querySelector(
      'input[value="spotlight"]'
    ) as HTMLInputElement | null;

    return spotlightButton ?? undefined;
  }

  /**
   * Element Call's own expand/collapse toggle on the spotlight tile. It shares the
   * `expand` class with the screen share volume trigger and EC's own "maximise"
   * (fullscreen) button, and only exists in spotlight view, where it is always
   * the last button in the tile's bottom-right row.
   */
  private get spotlightExpandButton(): HTMLButtonElement | undefined {
    const row = this.document?.querySelector('[class*="_bottomRightButtons_"]');
    const last = row?.querySelector<HTMLButtonElement>(':scope > button:last-child');
    if (!last) return undefined;
    if (last.getAttribute('aria-label') === 'maximise' || last.hasAttribute('aria-haspopup')) {
      return undefined;
    }
    return last;
  }

  private get gridButton(): HTMLInputElement | undefined {
    const gridButton = this.document?.querySelector(
      'input[value="grid"]'
    ) as HTMLInputElement | null;

    return gridButton ?? undefined;
  }

  constructor(state: CallControlState, call: ClientWidgetApi, iframe: HTMLIFrameElement) {
    super();

    this.state = state;
    this.call = call;
    this.iframe = iframe;

    this.bodyMutationObserver = new MutationObserver(this.onBodyMutation.bind(this));
    this.controlMutationObserver = new MutationObserver(this.onControlMutation.bind(this));
  }

  public getState(): CallControlState {
    return this.state;
  }

  public get microphone(): boolean {
    return this.state.microphone;
  }

  public get video(): boolean {
    return this.state.video;
  }

  public get sound(): boolean {
    return this.state.sound;
  }

  public get screenshare(): boolean {
    return this.state.screenshare;
  }

  public get spotlight(): boolean {
    return this.state.spotlight;
  }

  public async applyState() {
    await this.setMediaState({
      audio_enabled: this.microphone,
      video_enabled: this.video,
    });
    this.setSound(this.sound);
    this.emitStateUpdate();
  }

  public startObserving() {
    if (!this.document) return;

    this.bodyMutationObserver.observe(this.document.body, {
      childList: true,
      subtree: false, // only direct children of body
    });
    this.onBodyMutation();
  }

  private onBodyMutation() {
    if (!this.document) return;

    this.document.body.style.setProperty('background', 'none', 'important');

    const controls = this.leaveButton?.parentElement?.parentElement;
    if (controls) {
      controls.style.setProperty('position', 'absolute');
      controls.style.setProperty('visibility', 'hidden');
    }

    this.injectTileStyles();
    this.observeControls();
  }

  /**
   * Inject Zennith call-tile styling into the element-call iframe document.
   * Element Call hashes its CSS class names (e.g. `_speaking_ghafa_28`), so we
   * match on the stable readable segment of each class instead of the hash.
   */
  private injectTileStyles() {
    if (!this.document) return;

    const styleId = 'zennith-call-tiles';
    if (this.document.getElementById(styleId)) return;

    const style = this.document.createElement('style');
    style.id = styleId;
    style.textContent = [
      // Green glowing ring around the whole tile while its participant speaks.
      '[class*="tile"][class*="speaking"]{',
      '  box-shadow: 0 0 8px rgba(35, 165, 90, 0.6) !important;',
      '}',
      // Semi-transparent dark name pills in the bottom-left of each tile.
      '[class*="nameTag"]{',
      '  background-color: rgba(0, 0, 0, 0.5) !important;',
      '  color: #ffffff !important;',
      '  box-shadow: none !important;',
      '}',
      // Bot / audio-only tile avatar: centered circle with initial fallback.
      '[class*="tile"]:not([class*="videoMuted"]) [class*="avatar"],',
      '[data-video-fit="cover"] [class*="avatar"]{',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  width: 120px !important;',
      '  height: 120px !important;',
      '  border-radius: 50% !important;',
      '  font-size: 48px !important;',
      '  font-weight: 700 !important;',
      '  color: #fff !important;',
      '  overflow: hidden !important;',
      '}',
      '[class*="tile"]:not([class*="videoMuted"]) [class*="avatar"] img,',
      '[data-video-fit="cover"] [class*="avatar"] img{',
      '  width: 100% !important;',
      '  height: 100% !important;',
      '  object-fit: cover !important;',
      '  border-radius: 50% !important;',
      '}',
      // Maximized stream (see maximizeStream): only the spotlight tile stays.
      // Other tiles are hidden with visibility, not display, so Element Call's
      // layout measurement keeps working underneath.
      `html[${MAXIMIZED_ATTR}] [class*="_grid_"] > [class*="_tile_"]:not(:has([class*="_bottomRightButtons_"])){`,
      '  visibility: hidden !important;',
      '  pointer-events: none !important;',
      '}',
      `html[${MAXIMIZED_ATTR}] [class*="_nameTag_"],`,
      `html[${MAXIMIZED_ATTR}] [class*="_indicators_"],`,
      `html[${MAXIMIZED_ATTR}] [class*="_advance_"],`,
      `html[${MAXIMIZED_ATTR}] [class*="_bottomRightButtons_"] > button[aria-label="maximise"],`,
      `html[${MAXIMIZED_ATTR}] [class*="_bottomRightButtons_"] > button:last-child:not([aria-haspopup]){`,
      '  display: none !important;',
      '}',
      `html[${MAXIMIZED_ATTR}], html[${MAXIMIZED_ATTR}] body{`,
      '  background: #000 !important;',
      '}',
      `html[${MAXIMIZED_ATTR}] [class*="_tile_"]:has([class*="_bottomRightButtons_"]),`,
      `html[${MAXIMIZED_ATTR}] [class*="_tile_"]:has([class*="_bottomRightButtons_"]) [class*="_contents_"]{`,
      '  border-radius: 0 !important;',
      '  box-shadow: none !important;',
      '  outline: none !important;',
      '}',
    ].join('\n');
    this.document.head.appendChild(style);
  }

  private observeControls() {
    this.controlMutationObserver.disconnect();

    const screenshareBtn = this.screenshareButton;
    if (screenshareBtn) {
      this.controlMutationObserver.observe(screenshareBtn, {
        attributes: true,
        attributeFilter: ['data-kind'],
      });
    }
    const spotlightBtn = this.spotlightButton;
    if (spotlightBtn) {
      this.controlMutationObserver.observe(spotlightBtn, {
        attributes: true,
      });
    }

    this.onControlMutation();
  }

  public applySound() {
    this.setSound(this.sound);
  }

  private async setMediaState(state: ElementMediaStatePayload) {
    const data = await this.call.transport.send(ElementWidgetActions.DeviceMute, state);
    return new Promise<typeof data>((resolve) => {
      if (this.mediaStatePromiseResolver) {
        this.mediaStatePromiseResolver();
      }
      this.mediaStatePromiseResolver = () => resolve(data);
    });
  }

  private setSound(sound: boolean): void {
    setLocalDeafened(!sound);
    const callDocument = this.iframe.contentDocument ?? this.iframe.contentWindow?.document;
    if (callDocument) {
      callDocument.querySelectorAll('audio').forEach((el) => {
        // eslint-disable-next-line no-param-reassign
        el.muted = !sound;
      });
    }
  }

  public onMediaState(evt: CustomEvent<ElementMediaStateDetail>) {
    const { data } = evt.detail;
    if (!data) return;

    const state = new CallControlState(
      data.audio_enabled ?? this.microphone,
      data.video_enabled ?? this.video,
      this.sound,
      this.screenshare,
      this.spotlight
    );

    this.state = state;
    this.emitStateUpdate();

    if (this.microphone && !this.sound) {
      this.toggleSound();
    }

    if (this.mediaStatePromiseResolver) {
      this.mediaStatePromiseResolver();
      this.mediaStatePromiseResolver = undefined;
    }
  }

  private onControlMutation() {
    const screenshare: boolean = this.screenshareButton?.getAttribute('data-kind') === 'primary';
    const spotlight: boolean = this.spotlightButton?.checked ?? false;

    this.state = new CallControlState(
      this.microphone,
      this.video,
      this.sound,
      screenshare,
      spotlight
    );
    this.emitStateUpdate();
  }

  public toggleMicrophone() {
    const payload: ElementMediaStatePayload = {
      audio_enabled: !this.microphone,
      video_enabled: this.video,
    };
    return this.setMediaState(payload);
  }

  public toggleVideo() {
    const payload: ElementMediaStatePayload = {
      audio_enabled: this.microphone,
      video_enabled: !this.video,
    };
    return this.setMediaState(payload);
  }

  public toggleSound() {
    const sound = !this.sound;

    this.setSound(sound);

    const state = new CallControlState(
      this.microphone,
      this.video,
      sound,
      this.screenshare,
      this.spotlight
    );
    this.state = state;
    this.emitStateUpdate();

    if (!this.sound && this.microphone) {
      this.toggleMicrophone();
    }
  }

  public toggleScreenshare() {
    this.screenshareButton?.click();
  }

  public toggleSpotlight() {
    if (this.spotlight) {
      this.gridButton?.click();
      return;
    }
    this.spotlightButton?.click();
  }

  public toggleReactions() {
    this.reactionsButton?.click();
    this.reactionsOpen = !this.reactionsOpen;

    if (this.reactionsOpen) {
      const handler = (evt: MouseEvent | KeyboardEvent) => {
        if (evt instanceof KeyboardEvent && evt.key === 'Escape') {
          this.toggleReactions();
          return;
        }
        if (evt instanceof MouseEvent) {
          const target = evt.target as HTMLElement;
          if (!this.iframe.contains(target)) {
            this.toggleReactions();
          }
        }
      };
      this.reactionsCloseHandler = () => {
        window.removeEventListener('click', handler, true);
        window.removeEventListener('keydown', handler, true);
      };
      window.addEventListener('click', handler, true);
      window.addEventListener('keydown', handler, true);
    } else {
      this.reactionsCloseHandler?.();
      this.reactionsCloseHandler = undefined;
    }
  }

  private settingsOpen = false;

  private settingsCloseHandler: (() => void) | undefined;

  public toggleSettings() {
    this.settingsButton?.click();
    this.settingsOpen = !this.settingsOpen;

    if (this.settingsOpen) {
      const handler = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
          this.toggleSettings();
        }
      };
      this.settingsCloseHandler = () => {
        window.removeEventListener('keydown', handler, true);
      };
      window.addEventListener('keydown', handler, true);
    } else {
      this.settingsCloseHandler?.();
      this.settingsCloseHandler = undefined;
    }
  }

  private maximizeCloseHandler: (() => void) | undefined;

  /**
   * Show the spotlight (screen share) tile as large as possible: switch to
   * spotlight view (the expand toggle only exists there), expand the tile inside
   * Element Call, put the call iframe into browser fullscreen and hide every
   * other tile and overlay. Leaving fullscreen (Esc) restores the previous view.
   */
  public async maximizeStream() {
    if (this.maximizeCloseHandler) return;

    const wasGrid = !this.spotlight;
    if (wasGrid) this.spotlightButton?.click();

    const expandBtn = await waitFor(() => this.spotlightExpandButton);
    const wasExpanded = expandBtn?.getAttribute('aria-label') === 'Collapse';
    if (expandBtn && !wasExpanded) expandBtn.click();

    const root = this.document?.documentElement;

    const restore = () => {
      root?.removeAttribute(MAXIMIZED_ATTR);
      if (!wasExpanded) {
        const btn = this.spotlightExpandButton;
        if (btn && btn.getAttribute('aria-label') === 'Collapse') btn.click();
      }
      if (wasGrid && this.spotlight) this.gridButton?.click();
    };

    const onFullscreenChange = () => {
      if (document.fullscreenElement === this.iframe) return;
      this.maximizeCloseHandler?.();
    };
    this.maximizeCloseHandler = () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      this.maximizeCloseHandler = undefined;
      restore();
    };

    try {
      await this.iframe.requestFullscreen();
      root?.setAttribute(MAXIMIZED_ATTR, '');
      document.addEventListener('fullscreenchange', onFullscreenChange);
    } catch {
      // Fullscreen refused (no user gesture / unsupported webview): keep the
      // in-call expand only, with EC's own buttons left visible so the user can
      // collapse it again.
      this.maximizeCloseHandler = undefined;
    }
  }

  public dispose() {
    this.maximizeCloseHandler?.();
    if (document.fullscreenElement === this.iframe) {
      document.exitFullscreen().catch(() => undefined);
    }
    this.reactionsCloseHandler?.();
    this.settingsCloseHandler?.();
    this.bodyMutationObserver.disconnect();
    this.controlMutationObserver.disconnect();
  }

  private emitStateUpdate() {
    this.emit(CallControlEvent.StateUpdate);
  }
}
