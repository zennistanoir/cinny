import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const Header = style({
  borderBottomColor: 'transparent',
});
export const HeaderShadow = style({
  position: 'relative',
  zIndex: 1,
  boxShadow: `0 1px 2px ${color.Other.Shadow}`,
});
export const HeaderTopic = style({
  ':hover': {
    cursor: 'pointer',
    opacity: config.opacity.P500,
    textDecoration: 'underline',
  },
});
