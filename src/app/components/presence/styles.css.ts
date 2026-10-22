import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const AvatarPresence = style({
  display: 'flex',
  position: 'relative',
  flexShrink: 0,
});

export const AvatarPresenceBadge = style({
  position: 'absolute',
  bottom: '-2px',
  right: '-2px',
  zIndex: 1,

  display: 'flex',
  padding: config.borderWidth.B500,
  backgroundColor: 'inherit',
  borderRadius: config.radii.Pill,
  overflow: 'hidden',
});
