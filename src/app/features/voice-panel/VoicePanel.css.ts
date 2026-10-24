import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const VoicePanel = style({
  flexShrink: 0,
  padding: config.space.S200,
  margin: `${config.space.S100} ${config.space.S200} 0`,
  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const ConnectionDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: '#23A55A',
});

export const LatencyBadge = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  color: '#23A55A',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
});

export const TowerIcon = style({
  width: '14px',
  height: '14px',
  flexShrink: 0,
});

export const HangupButton = style({
  flexShrink: 0,
});
export const Actions = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: config.space.S200,
});

export const ActionButton = style({
  width: '100%',
});

export const ActionSvgIcon = style({
  width: toRem(16),
  height: toRem(16),
  flexShrink: 0,
});
