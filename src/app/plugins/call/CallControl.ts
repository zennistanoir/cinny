import { ClientWidgetApi } from 'matrix-widget-api';
import EventEmitter from 'events';
import { CallControlState } from './CallControlState';
import { ElementMediaStateDetail, ElementMediaStatePayload, ElementWidgetActions } from './types';

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

    // Monkey-patch RTCPeerConnection in the iframe to capture
    // all instances so Zennith can poll getStats() for live RTT.
    this.injectPCPatch();

    this.bodyMutationObserver.observe(this.document.body, {
      childList: true,
      subtree: false, // only direct children of body
    });
    this.onBodyMutation();
  }

  /** Inject a script that wraps RTCPeerConnection to store all instances. */
  private injectPCPatch() {
    if (!this.document) return;
    const patchId = 'zennith-pc-patch';
    if (this.document.getElementById(patchId)) return;

    const script = this.document.createElement('script');
    script.id = patchId;
    script.textContent = `
      (function() {
        if (window.__zennithPCs) return;
        window.__zennithPCs = [];
        var OrigPC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!OrigPC) return;
        window.RTCPeerConnection = function() {
          var pc = new OrigPC(arguments[0], arguments[1]);
          try { window.__zennithPCs.push(pc); } catch(e) {}
          pc.addEventListener('connectionstatechange', function() {
            if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
              var idx = window.__zennithPCs.indexOf(pc);
              if (idx > -1) window.__zennithPCs.splice(idx, 1);
            }
          });
          return pc;
        };
        window.RTCPeerConnection.prototype = OrigPC.prototype;
      })();
    `;
    this.document.head.appendChild(script);
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
    return new Promise<typeof data>(resolve => {
      if (this.mediaStatePromiseResolver) {
        this.mediaStatePromiseResolver();
      }
      this.mediaStatePromiseResolver = () => resolve(data);
    });
  }

  private setSound(sound: boolean): void {
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

  public dispose() {
    this.reactionsCloseHandler?.();
    this.settingsCloseHandler?.();
    this.bodyMutationObserver.disconnect();
    this.controlMutationObserver.disconnect();
  }

  private emitStateUpdate() {
    this.emit(CallControlEvent.StateUpdate);
  }
}
