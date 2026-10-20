import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const CallViewContent = style({
  padding: config.space.S400,
  paddingRight: 0,
  minHeight: '100%',
});

export const ControlCard = style({
  padding: config.space.S300,
});

export const ControlDivider = style({
  height: toRem(24),
});

export const CallMemberCard = style({
  padding: config.space.S300,
});

export const CallTileContainer = style({
  position: 'relative',
});

export const CallControlContainer = style({
  position: 'absolute',
  left: '50%',
  bottom: config.space.S400,
  transform: 'translateX(-50%)',
  zIndex: 1,
});

export const PrescreenMessage = style({
  padding: config.space.S200,
});
