import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const ProfileCard = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  padding: config.space.S200,
  margin: `${config.space.S200} ${config.space.S200} ${config.space.S300}`,
  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,

  selectors: {
    '&:hover': {
      backgroundColor: color.SurfaceVariant.ContainerHover,
    },
  },
});

export const ProfileCardAvatarBtn = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'none',
  borderRadius: config.radii.R400,
  cursor: 'pointer',
});

export const ProfileCardIdentity = style({
  flexGrow: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S100,
});

export const ProfileCardActions = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S100,
});

export const ProfileCardStatusDot = style({
  flexShrink: 0,
  display: 'flex',
});
