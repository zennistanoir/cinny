import { globalStyle } from '@vanilla-extract/css';
import { color, config } from 'folds';
import { EmoticonBase } from './CustomHtml.css';

// Accessibility settings. AccessibilityFeature (ClientNonUIFeatures) sets the
// data attributes on <html>; the theme and folds vars live on <body>, so each
// override targets `:root[...] body` to beat the theme class.

const REDUCED_MOTION = {
  animationDuration: '0.01ms !important',
  animationIterationCount: '1 !important',
  transitionDuration: '0.01ms !important',
  scrollBehavior: 'auto',
} as const;

const MOTION_TARGETS = ['*', '*::before', '*::after'];

globalStyle(MOTION_TARGETS.map((t) => `:root[data-motion='reduce'] ${t}`).join(', '), REDUCED_MOTION);
globalStyle(MOTION_TARGETS.map((t) => `:root:not([data-motion='allow']) ${t}`).join(', '), {
  '@media': {
    '(prefers-reduced-motion: reduce)': REDUCED_MOTION,
  },
});

// Stronger text and borders. Muted text (folds opacity levels) is lifted too.
const highContrast = (onContainer: string, line: string) => ({
  vars: {
    [color.Background.OnContainer]: onContainer,
    [color.Background.ContainerLine]: line,
    [color.Surface.OnContainer]: onContainer,
    [color.Surface.ContainerLine]: line,
    [color.SurfaceVariant.OnContainer]: onContainer,
    [color.SurfaceVariant.ContainerLine]: line,
    [config.opacity.P300]: '0.95',
    [config.opacity.P400]: '1',
    [config.opacity.Placeholder]: '0.75',
  },
});
globalStyle(`:root[data-high-contrast='dark'] body`, highContrast('#FFFFFF', '#9A9A9A'));
globalStyle(`:root[data-high-contrast='light'] body`, highContrast('#000000', '#5E5E5E'));

globalStyle(`:root[data-focus-rings] *:focus-visible`, {
  outline: `${config.borderWidth.B600} solid ${color.Primary.Main} !important`,
  outlineOffset: '2px',
});

globalStyle(`:root[data-underline-links] a[href]`, {
  textDecoration: 'underline',
});

globalStyle(`:root[data-readable-font] body`, {
  vars: {
    [config.font.Inter]: `'Atkinson Hyperlegible', var(--font-emoji), sans-serif`,
    '--font-secondary': `'Atkinson Hyperlegible', var(--font-emoji), sans-serif`,
  },
});

// Message body text only, so it stacks with Page Zoom instead of replacing it.
// Jumbo-emoji messages keep their own size.
globalStyle(`:root[data-message-text] .zennith-msg-body:not(.zennith-msg-jumbo)`, {
  fontSize: `calc(${config.fontSize.T400} * var(--zennith-msg-scale, 1))`,
  lineHeight: `calc(${config.lineHeight.T400} * var(--zennith-msg-scale, 1) * var(--zennith-msg-spacing, 1))`,
});

globalStyle(`:root[data-large-emoji] ${EmoticonBase} > *`, {
  fontSize: '1.75em',
});

globalStyle(`:root[data-hover-controls] .zennith-voice-volume-btn`, {
  opacity: 1,
});

// Paused animated media: a still frame is painted onto a canvas next to the
// image (see PausableImg); it covers the image until hovered or focused.
globalStyle(`.zennith-freeze:not([data-ready])`, {
  display: 'none',
});
globalStyle(`.zennith-freeze-host:hover .zennith-freeze, .zennith-freeze-host:focus-within .zennith-freeze`, {
  display: 'none',
});
globalStyle(
  `.zennith-freeze-host:not(:hover):not(:focus-within) img:has(~ .zennith-freeze[data-ready])`,
  {
    display: 'none',
  }
);
