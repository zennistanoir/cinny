import { keyframes, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const MembersDrawer = style({
  width: toRem(266),
});

export const MembersDrawerHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const MemberDrawerContentBase = style({
  position: 'relative',
  overflow: 'hidden',
});

export const MemberDrawerContent = style({
  padding: `${config.space.S200} 0`,
});

const ScrollBtnAnime = keyframes({
  '0%': {
    transform: `translate(-50%, -100%) scale(0)`,
  },
  '100%': {
    transform: `translate(-50%, 0) scale(1)`,
  },
});

export const DrawerScrollTop = style({
  position: 'absolute',
  top: config.space.S200,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1,
  animation: `${ScrollBtnAnime} 100ms`,
});

export const DrawerGroup = style({
  paddingLeft: config.space.S200,
});

export const MembersGroup = style({
  paddingLeft: config.space.S200,
});
export const MembersGroupLabel = style({
  padding: config.space.S200,
  selectors: {
    '&:not(:first-child)': {
      paddingTop: config.space.S500,
    },
  },
});

export const DrawerVirtualItem = style({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
});

export const MemberSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S100,
});

export const MemberSectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: config.space.S200,
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S100}`,
  color: color.Background.OnContainer,
});

export const MemberSectionHeaderBtn = style({
  flexGrow: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S100,
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
});

export const MemberSectionTitle = style({
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 700,
});

export const MemberSectionCount = style({
  flexShrink: 0,
  opacity: 0.6,
});

export const MemberDimmed = style({
  opacity: 0.5,
});

export const MemberDimmedAvatar = style({
  filter: 'grayscale(1)',
});

