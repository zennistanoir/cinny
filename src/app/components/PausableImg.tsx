/* eslint-disable no-param-reassign */
import React, { forwardRef, ImgHTMLAttributes, useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

// Paints the image's current frame (the first one, on load) onto the canvas.
// Drawing works even for cross-origin media; only reading pixels back is blocked.
export const paintFreezeFrame = (img: HTMLImageElement | null, canvas: HTMLCanvasElement | null) => {
  if (!img || !canvas || !img.complete || !img.naturalWidth) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  canvas.dataset.ready = 'true';
};

// "Pause animated media" (Settings > Accessibility): returns the canvas to render
// after the image. Some ancestor needs the `zennith-freeze-host` class; hovering
// or focusing it plays the animation (CSS in styles/accessibility.css.ts).
export const useFreezeFrame = (getImg: () => HTMLImageElement | null | undefined, enabled = true) => {
  const [pauseSetting] = useSetting(settingsAtom, 'pauseAnimatedMedia');
  const pause = pauseSetting && enabled;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paint = useCallback(() => {
    if (pause) paintFreezeFrame(getImg() ?? null, canvasRef.current);
  }, [pause, getImg]);

  // Already-loaded images when the setting is turned on.
  useEffect(paint, [paint]);

  return { pause, paint, canvasRef };
};

type PausableImgProps = ImgHTMLAttributes<HTMLImageElement>;

export const PausableImg = forwardRef<HTMLImageElement, PausableImgProps>(
  ({ className, onLoad, alt, ...props }, ref) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const { pause, paint, canvasRef } = useFreezeFrame(useCallback(() => imgRef.current, []));

    const setRef = (el: HTMLImageElement | null) => {
      imgRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    };

    return (
      <>
        <img
          {...props}
          alt={alt}
          className={className}
          ref={setRef}
          onLoad={(evt) => {
            paint();
            onLoad?.(evt);
          }}
        />
        {pause && (
          <canvas
            ref={canvasRef}
            className={classNames(className, 'zennith-freeze')}
            title={props.title ?? alt}
            aria-hidden
          />
        )}
      </>
    );
  }
);
