import React, { useState } from 'react';
import {
  Box,
  Button,
  config,
  Header,
  Icon,
  IconButton,
  Icons,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Text,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { version } from '../../../../package.json';
import { stopPropagation } from '../../utils/keyboard';
import { CHANGELOG } from './changelog';

// The last version whose notes were shown (or skipped). Notes show once per update.
const LAST_SEEN_KEY = 'zennith-last-seen-version';

const readLastSeen = (): string | null => {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
};

const markSeen = () => {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // Storage full or blocked: the notes show again next time, which is harmless.
  }
};

const entry = CHANGELOG.find((e) => e.version === version);

export function WhatsNew() {
  const [open, setOpen] = useState(() => {
    if (readLastSeen() === version) return false;
    // A version without notes still counts as seen.
    if (!entry) markSeen();
    return !!entry;
  });

  const close = () => {
    markSeen();
    setOpen(false);
  };

  if (!open || !entry) return null;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: close,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal size="400" flexHeight>
            <Box direction="Column">
              <Header
                size="500"
                style={{ padding: config.space.S200, paddingLeft: config.space.S400 }}
              >
                <Box grow="Yes">
                  <Text size="H4">What&apos;s new in Zennith {version}</Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={close} aria-label="Close">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>
              <Scroll size="300" hideTrack>
                <Box
                  as="ul"
                  direction="Column"
                  gap="300"
                  style={{
                    margin: 0,
                    padding: config.space.S400,
                    paddingLeft: config.space.S700,
                    paddingTop: 0,
                  }}
                >
                  {entry.items.map((item) => (
                    <li key={item}>
                      <Text size="T300">{item}</Text>
                    </li>
                  ))}
                </Box>
              </Scroll>
              <Box
                justifyContent="End"
                style={{ padding: config.space.S400, paddingTop: config.space.S200 }}
              >
                <Button size="400" variant="Primary" radii="300" onClick={close}>
                  <Text size="B400">Got it</Text>
                </Button>
              </Box>
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
