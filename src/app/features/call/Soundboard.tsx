import React, { MouseEvent, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import {
  Box,
  Button,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Menu,
  PopOut,
  RectCords,
  Spinner,
  Text,
  toRem,
  Tooltip,
  TooltipProvider,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { stopPropagation } from '../../utils/keyboard';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useMicPipelineReady } from '../../plugins/call/noiseSuppression';
import {
  loadClip,
  playSoundboardClip,
  SoundboardSound,
  useSoundboard,
  useSoundboardBusy,
  useSoundboardRoom,
} from '../../plugins/call/soundboard';

type SoundboardPanelProps = {
  room: Room;
  micEnabled: boolean;
  soundEnabled: boolean;
};
function SoundboardPanel({ room, micEnabled, soundEnabled }: SoundboardPanelProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const boardRoom = useSoundboardRoom(mx, room);
  const sounds = useSoundboard(boardRoom);
  const busy = useSoundboardBusy();
  const pipelineReady = useMicPipelineReady();
  const [loadingId, setLoadingId] = useState<string>();
  const [error, setError] = useState<string>();

  const blocked = !pipelineReady
    ? "The soundboard isn't available because your microphone couldn't be processed."
    : !micEnabled && 'Unmute to use the soundboard.';

  const handlePlay = async (sound: SoundboardSound) => {
    setError(undefined);
    setLoadingId(sound.id);
    try {
      const data = await loadClip(mx, sound.url, useAuthentication);
      await playSoundboardClip(data, soundEnabled);
    } catch {
      setError(`Couldn't play "${sound.name}".`);
    } finally {
      setLoadingId(undefined);
    }
  };

  return (
    <Box
      direction="Column"
      gap="200"
      style={{ padding: config.space.S300, width: toRem(312), maxWidth: '90vw' }}
    >
      <Text size="L400">Soundboard</Text>
      {blocked && (
        <Text size="T200" priority="300">
          {blocked}
        </Text>
      )}
      {sounds.length === 0 ? (
        <Text size="T200" priority="300">
          No sounds yet. Moderators can add them in Space Settings, under Soundboard.
        </Text>
      ) : (
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: config.space.S100,
            maxHeight: toRem(260),
            overflowY: 'auto',
          }}
        >
          {sounds.map((sound) => (
            <Button
              key={sound.id}
              size="300"
              variant="Secondary"
              fill="Soft"
              radii="300"
              disabled={!!blocked || busy}
              onClick={() => handlePlay(sound)}
              title={sound.name}
              style={{ justifyContent: 'flex-start', minWidth: 0 }}
              before={
                loadingId === sound.id ? (
                  <Spinner size="100" variant="Secondary" />
                ) : (
                  <Text as="span" size="T300" aria-hidden>
                    {sound.emoji || '🔊'}
                  </Text>
                )
              }
            >
              <Text as="span" size="T200" truncate>
                {sound.name}
              </Text>
            </Button>
          ))}
        </Box>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </Box>
  );
}

type SoundboardButtonProps = SoundboardPanelProps & {
  // The sidebar call bar uses smaller buttons than the call view.
  small?: boolean;
  disabled?: boolean;
};
export function SoundboardButton({ small, disabled, ...panel }: SoundboardButtonProps) {
  const [cords, setCords] = useState<RectCords>();

  return (
    <>
      <TooltipProvider
        position="Top"
        delay={500}
        tooltip={
          <Tooltip>
            <Text size="T200">Soundboard</Text>
          </Tooltip>
        }
      >
        {(anchorRef) => (
          <IconButton
            ref={anchorRef}
            variant={cords ? 'Primary' : 'Surface'}
            fill="Soft"
            radii={small ? '300' : '400'}
            size={small ? '300' : '400'}
            outlined
            disabled={disabled}
            onClick={(evt: MouseEvent<HTMLButtonElement>) =>
              setCords(evt.currentTarget.getBoundingClientRect())
            }
            aria-label="Soundboard"
            aria-haspopup="dialog"
            aria-pressed={!!cords}
          >
            <Icon size={small ? '100' : '400'} src={Icons.VolumeHigh} filled={!!cords} />
          </IconButton>
        )}
      </TooltipProvider>
      <PopOut
        anchor={disabled ? undefined : cords}
        offset={8}
        position="Top"
        align={small ? 'Start' : 'Center'}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setCords(undefined),
              clickOutsideDeactivates: true,
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <SoundboardPanel {...panel} />
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}
