import React from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  config,
} from 'folds';
import { stopPropagation } from '../../utils/keyboard';

type SwitchVoiceChannelPromptProps = {
  fromName: string;
  toName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Asked before leaving one voice channel for another, so a stray click while
// browsing channels doesn't pull you out of the call you're in.
export function SwitchVoiceChannelPrompt({
  fromName,
  toName,
  onConfirm,
  onCancel,
}: SwitchVoiceChannelPromptProps) {
  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: '#zennith-switch-voice-confirm',
            onDeactivate: onCancel,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">Switch voice channel?</Text>
              </Box>
              <IconButton size="300" onClick={onCancel} radii="300" aria-label="Cancel">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
              <Text priority="400">
                You&apos;re connected to <b>{fromName}</b>. Leave it and join <b>{toName}</b>?
              </Text>
              <Box gap="200" justifyContent="End">
                <Button variant="Secondary" fill="Soft" onClick={onCancel}>
                  <Text size="B400">Stay</Text>
                </Button>
                <Button id="zennith-switch-voice-confirm" variant="Primary" onClick={onConfirm}>
                  <Text size="B400">Switch</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
