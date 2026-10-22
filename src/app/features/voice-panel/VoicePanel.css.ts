import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const VoicePanel = style({
  flexShrink: 0,
  padding: config.space.S200,
  margin: `${config.space.S100} ${config.space.S200} 0`,
  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  borderLeft: '3px solid #23A55A',
});

export const ConnectionDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: '#0ebd7e',
  boxShadow: '0 0 4px rgba(14, 189, 126, 0.6)',
  flexShrink: 0,
});

export const LatencyBadge = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  color: '#23A55A',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
});

export const SignalMeter = style({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '1px',
  height: '12px',
});

export const SignalBar = style({
  width: '3px',
  borderRadius: '1px',
  flexShrink: 0,
});