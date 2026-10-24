import {
  as,
  Badge,
  Box,
  color,
  ContainerColor,
  MainColor,
  Text,
  Tooltip,
  TooltipProvider,
  toRem,
} from 'folds';
import React, { ReactNode, useId } from 'react';
import * as css from './styles.css';
import { Presence, usePresenceLabel } from '../../hooks/useUserPresence';
import { DND_STATUS_MSG } from '../../utils/ownStatus';

const PresenceToColor: Record<Presence, MainColor> = {
  [Presence.Online]: 'Success',
  [Presence.Unavailable]: 'Warning',
  [Presence.Offline]: 'Secondary',
};

type PresenceBadgeProps = {
  presence: Presence;
  status?: string;
  size?: '200' | '300' | '400' | '500';
};
export function PresenceBadge({ presence, status, size = '300' }: PresenceBadgeProps) {
  const label = usePresenceLabel();
  const badgeLabelId = useId();
  // Do Not Disturb travels as unavailable plus a fixed status message.
  const dnd = presence === Presence.Unavailable && status === DND_STATUS_MSG;
  const statusText = dnd ? undefined : status;

  return (
    <TooltipProvider
      position="Right"
      align="Center"
      offset={4}
      delay={200}
      tooltip={
        <Tooltip id={badgeLabelId}>
          <Box style={{ maxWidth: toRem(250) }} alignItems="Baseline" gap="100">
            <Text size="L400">{dnd ? DND_STATUS_MSG : label[presence]}</Text>
            {statusText && <Text size="T200">•</Text>}
            {statusText && <Text size="T200">{statusText}</Text>}
          </Box>
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <Badge
          aria-labelledby={badgeLabelId}
          ref={triggerRef}
          size={size}
          variant={dnd ? 'Critical' : PresenceToColor[presence]}
          fill={presence === Presence.Offline ? 'Soft' : 'Solid'}
          radii="Pill"
        />
      )}
    </TooltipProvider>
  );
}

type AvatarPresenceProps = {
  badge: ReactNode;
  variant?: ContainerColor;
};
export const AvatarPresence = as<'div', AvatarPresenceProps>(
  ({ as: AsAvatarPresence, badge, variant = 'Surface', children, ...props }, ref) => (
    <Box as={AsAvatarPresence} className={css.AvatarPresence} {...props} ref={ref}>
      {badge && (
        <div
          className={css.AvatarPresenceBadge}
          style={{ backgroundColor: color[variant].Container }}
        >
          {badge}
        </div>
      )}
      {children}
    </Box>
  )
);
