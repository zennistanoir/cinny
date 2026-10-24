import React from 'react';
import { Box, Button, color, config, Spinner, Text, toRem } from 'folds';

// Bottom-right prompt for a new version: the web build offers a reload, the desktop
// build a restart. Neither acts on its own, so nobody gets dropped from a call.
type UpdateToastProps = {
  title: string;
  description: string;
  actionLabel: string;
  busyLabel: string;
  busy?: boolean;
  onLater: () => void;
  onAction: () => void;
};
export function UpdateToast({
  title,
  description,
  actionLabel,
  busyLabel,
  busy,
  onLater,
  onAction,
}: UpdateToastProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      direction="Column"
      gap="300"
      style={{
        position: 'fixed',
        right: config.space.S400,
        bottom: config.space.S400,
        zIndex: 9999,
        width: toRem(320),
        padding: config.space.S400,
        borderRadius: config.radii.R400,
        background: color.Surface.Container,
        color: color.Surface.OnContainer,
        border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      }}
    >
      <Box direction="Column" gap="100">
        <Text size="H6">{title}</Text>
        <Text size="T300" priority="300">
          {description}
        </Text>
      </Box>
      <Box gap="200" justifyContent="End">
        <Button
          size="300"
          variant="Secondary"
          fill="None"
          radii="300"
          disabled={busy}
          onClick={onLater}
        >
          <Text size="B300">Later</Text>
        </Button>
        <Button
          size="300"
          variant="Primary"
          radii="300"
          disabled={busy}
          before={busy ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined}
          onClick={onAction}
        >
          <Text size="B300">{busy ? busyLabel : actionLabel}</Text>
        </Button>
      </Box>
    </Box>
  );
}
