import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const Kbd = style({
  minWidth: toRem(24),
  padding: `${toRem(2)} ${config.space.S100}`,
  borderRadius: config.radii.R300,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  boxShadow: `inset 0 -1px 0 ${color.SurfaceVariant.ContainerLine}`,
  fontFamily: 'inherit',
  fontSize: toRem(12),
  lineHeight: toRem(18),
  textAlign: 'center',
  whiteSpace: 'nowrap',
});
