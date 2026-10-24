import { getWindowClientInsets, WindowInsets } from '../desktop';

// A window share captures the whole window: title bar and borders too. Games in
// "borderless" mode often keep their title bar just off-screen, and it shows up in the
// share. On desktop the shared window's client area is measured natively and each frame
// is cropped to it. The web build can't see the native window, so shares pass through.

type Rect = { x: number; y: number; width: number; height: number };

// WebCodecs types aren't in this TypeScript's DOM lib; only what's used here.
type VideoFrame = {
  readonly visibleRect: DOMRectReadOnly | null;
  readonly displayWidth: number;
  readonly displayHeight: number;
  close(): void;
};
type VideoFrameInit = { visibleRect: Rect; displayWidth: number; displayHeight: number };
type TrackProcessor = { readable: ReadableStream<VideoFrame> };
type TrackGenerator = MediaStreamTrack & { writable: WritableStream<VideoFrame> };
type CropWindow = Window & {
  __zennithCropPatched?: boolean;
  MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => TrackProcessor;
  MediaStreamTrackGenerator?: new (init: { kind: 'video' }) => TrackGenerator;
  VideoFrame?: new (frame: VideoFrame, init: VideoFrameInit) => VideoFrame;
  MediaStream: typeof MediaStream;
};

// How often the window is re-measured while sharing (it can be resized or restyled).
const REMEASURE_MS = 2000;

// Chromium names a window capture source `window:<HWND>:<id>`.
const windowHandle = (track: MediaStreamTrack): number | undefined => {
  const match = /^window:(\d+):/.exec(track.getSettings().deviceId ?? '');
  return match ? Number(match[1]) : undefined;
};

const hasInsets = (i: WindowInsets) => i.left + i.top + i.right + i.bottom > 0;

// 4:2:0 frames can only be cropped on even pixels.
const even = (n: number) => Math.max(0, Math.floor(n / 2) * 2);

const cropRect = (frame: VideoFrame, insets: WindowInsets): Rect | undefined => {
  const box = frame.visibleRect;
  if (!box || !hasInsets(insets)) return undefined;
  const sx = box.width / insets.width;
  const sy = box.height / insets.height;
  const left = even(insets.left * sx);
  const top = even(insets.top * sy);
  const width = even(box.width - left - insets.right * sx);
  const height = even(box.height - top - insets.bottom * sy);
  if (width < 16 || height < 16) return undefined;
  return { x: box.x + left, y: box.y + top, width, height };
};

const cropTrack = (
  win: CropWindow,
  source: MediaStreamTrack,
  measure: () => Promise<WindowInsets | undefined>,
  initial: WindowInsets
): MediaStreamTrack | undefined => {
  const Processor = win.MediaStreamTrackProcessor;
  const Generator = win.MediaStreamTrackGenerator;
  const Frame = win.VideoFrame;
  if (!Processor || !Generator || !Frame) return undefined;

  const reader = new Processor({ track: source }).readable.getReader();
  const output = new Generator({ kind: 'video' });
  const writer = output.writable.getWriter();
  output.contentHint = source.contentHint;

  let insets = initial;
  let size = { width: 0, height: 0 };
  let measuring = false;
  let measuredAt = Date.now();
  let lastFrameSize = '';
  const remeasure = () => {
    if (measuring) return;
    measuring = true;
    measuredAt = Date.now();
    measure()
      .then((next) => {
        if (next) insets = next;
      })
      .finally(() => {
        measuring = false;
      });
  };

  const pump = async () => {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { value: frame, done } = await reader.read();
      if (done || !frame) return;
      const frameSize = `${frame.displayWidth}x${frame.displayHeight}`;
      if (frameSize !== lastFrameSize || Date.now() - measuredAt > REMEASURE_MS) {
        lastFrameSize = frameSize;
        remeasure();
      }
      const rect = cropRect(frame, insets);
      let out = frame;
      if (rect) {
        try {
          out = new Frame(frame, {
            visibleRect: rect,
            displayWidth: rect.width,
            displayHeight: rect.height,
          });
          frame.close();
        } catch {
          out = frame;
        }
      }
      size = { width: out.displayWidth, height: out.displayHeight };
      // eslint-disable-next-line no-await-in-loop
      await writer.write(out);
    }
  };

  pump()
    .catch(() => undefined)
    .finally(() => {
      writer.close().catch(() => undefined);
      // The share ended outside the call (the window closed): pass that on like the
      // native track would, so the call stops the share.
      if (output.readyState !== 'ended') {
        output.stop();
        output.dispatchEvent(new Event('ended'));
      }
    });

  // LiveKit and the share quality settings talk to the track it was given; size and
  // constraint changes belong to the capture itself.
  const stopOutput = output.stop.bind(output);
  output.stop = () => {
    source.stop();
    reader.cancel().catch(() => undefined);
    stopOutput();
  };
  output.getSettings = () => ({
    ...source.getSettings(),
    ...(size.width > 0 ? size : {}),
  });
  output.getConstraints = () => source.getConstraints();
  output.getCapabilities = () => source.getCapabilities();
  output.applyConstraints = (constraints) => source.applyConstraints(constraints);
  return output;
};

const cropWindowShare = async (win: CropWindow, stream: MediaStream): Promise<MediaStream> => {
  const [video] = stream.getVideoTracks();
  const settings = video?.getSettings() as (MediaTrackSettings & { displaySurface?: string }) | undefined;
  if (!video || settings?.displaySurface !== 'window') return stream;

  const hwnd = windowHandle(video);
  const measure = () => getWindowClientInsets(hwnd, video.label || undefined);
  const insets = await measure();
  // Already borderless (or not on desktop): nothing to crop.
  if (!insets || !hasInsets(insets)) return stream;

  const cropped = cropTrack(win, video, measure, insets);
  if (!cropped) return stream;
  return new win.MediaStream([cropped, ...stream.getAudioTracks()]);
};

export const patchWindowShareCrop = (target: Window) => {
  const win = target as CropWindow;
  const mediaDevices = win.navigator?.mediaDevices;
  if (!mediaDevices?.getDisplayMedia || win.__zennithCropPatched) return;
  win.__zennithCropPatched = true;

  const nativeGetDisplayMedia = mediaDevices.getDisplayMedia.bind(mediaDevices);
  mediaDevices.getDisplayMedia = async (options?: DisplayMediaStreamOptions) => {
    const stream = await nativeGetDisplayMedia(options);
    try {
      return await cropWindowShare(win, stream);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[zennith] Could not crop the shared window', err);
      return stream;
    }
  };
};
