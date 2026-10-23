import React, { MouseEventHandler, useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  config,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Spinner,
  Text,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { SequenceCard } from '../../components/sequence-card';
import * as css from './styles.css';
import {
  ChatButton,
  MicrophoneButton,
  ScreenShareButton,
  SoundButton,
  VideoButton,
} from './Controls';
import { ScreenSharePopOut } from './ScreenSharePanel';
import { CallEmbed, useCallControlState } from '../../plugins/call';
import { stopPropagation } from '../../utils/keyboard';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

type CallControlsProps = {
  callEmbed: CallEmbed;
};
export function CallControls({ callEmbed }: CallControlsProps) {
  const controlRef = useRef<HTMLDivElement>(null);

  const { microphone, video, sound, screenshare, spotlight } = useCallControlState(
    callEmbed.control
  );

  const [cords, setCords] = useState<RectCords>();
  const [shareCords, setShareCords] = useState<RectCords>();
  const [noiseSuppression, setNoiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hoveringRef = useRef(false);

  // Auto-hide after 3 seconds of no mouse movement
  useEffect(() => {
    const resetTimer = () => {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!hoveringRef.current) setVisible(false);
      }, 3000);
    };

    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSpotlightClick = () => {
    callEmbed.control.toggleSpotlight();
    setCords(undefined);
  };

  const handleReactionsClick = () => {
    callEmbed.control.toggleReactions();
    setCords(undefined);
  };

  const handleMaximizeClick = () => {
    callEmbed.control.maximizeStream();
    setCords(undefined);
  };

  const handleNoiseSuppressionClick = () => {
    setNoiseSuppression(!noiseSuppression);
    setCords(undefined);
  };

  const handleSettingsClick = () => {
    callEmbed.control.toggleSettings();
    setCords(undefined);
  };

  const handleMicrophoneToggle = useCallback(() => callEmbed.control.toggleMicrophone(), [callEmbed]);
  const handleVideoToggle = useCallback(() => callEmbed.control.toggleVideo(), [callEmbed]);

  const [hangupState, hangup] = useAsyncCallback(
    useCallback(() => callEmbed.hangup(), [callEmbed])
  );
  const exiting =
    hangupState.status === AsyncStatus.Loading || hangupState.status === AsyncStatus.Success;

  return (
    <Box
      ref={controlRef}
      className={css.CallControlContainer}
      justifyContent="Center"
      alignItems="Center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onMouseEnter={() => { hoveringRef.current = true; }}
      onMouseLeave={() => { hoveringRef.current = false; }}
    >
      <SequenceCard
        className={css.ControlCard}
        variant="SurfaceVariant"
        gap="300"
        radii="500"
        alignItems="Center"
      >
        <MicrophoneButton enabled={microphone} onToggle={handleMicrophoneToggle} />
        <SoundButton enabled={sound} onToggle={() => callEmbed.control.toggleSound()} />
        <VideoButton enabled={video} onToggle={handleVideoToggle} />
        <ScreenShareButton
          enabled={screenshare}
          open={!!shareCords}
          onClick={(evt) => setShareCords(evt.currentTarget.getBoundingClientRect())}
        />
        <ScreenSharePopOut
          anchor={shareCords}
          sharing={screenshare}
          onToggle={() => callEmbed.control.toggleScreenshare()}
          onClose={() => setShareCords(undefined)}
        />
        <ChatButton />
        <Button
          variant="Critical"
          fill="Solid"
          radii="Pill"
          style={{ backgroundColor: '#f23f43', color: '#ffffff' }}
          onClick={hangup}
          before={
            exiting ? (
              <Spinner variant="Critical" fill="Solid" size="200" />
            ) : (
              <Icon src={Icons.PhoneDown} size="200" filled />
            )
          }
          disabled={exiting}
        >
          <Text size="B400">End</Text>
        </Button>
        <PopOut
          anchor={cords}
          position="Top"
          align="Center"
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                onDeactivate: () => setCords(undefined),
                clickOutsideDeactivates: true,
                isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                escapeDeactivates: stopPropagation,
              }}
            >
              <Menu>
                <Box direction="Column" style={{ padding: config.space.S100 }}>
                  <MenuItem
                    size="300"
                    variant="Surface"
                    radii="300"
                    onClick={handleSpotlightClick}
                  >
                    <Text size="B300" truncate>
                      {spotlight ? 'Grid View' : 'Spotlight View'}
                    </Text>
                  </MenuItem>
                  <MenuItem
                    size="300"
                    variant="Surface"
                    radii="300"
                    onClick={handleMaximizeClick}
                  >
                    <Text size="B300" truncate>
                      Maximize Stream
                    </Text>
                  </MenuItem>
                  <MenuItem
                    size="300"
                    variant="Surface"
                    radii="300"
                    onClick={handleReactionsClick}
                  >
                    <Text size="B300" truncate>
                      Reactions
                    </Text>
                  </MenuItem>
                  <MenuItem
                    size="300"
                    variant="Surface"
                    radii="300"
                    onClick={handleNoiseSuppressionClick}
                    aria-pressed={noiseSuppression}
                  >
                    <Text size="B300" truncate>
                      {noiseSuppression ? 'Noise Suppression: On' : 'Noise Suppression: Off'}
                    </Text>
                  </MenuItem>
                  <MenuItem
                    size="300"
                    variant="Surface"
                    radii="300"
                    onClick={handleSettingsClick}
                  >
                    <Text size="B300" truncate>
                      Settings
                    </Text>
                  </MenuItem>
                </Box>
              </Menu>
            </FocusTrap>
          }
        >
          <IconButton
            variant="Surface"
            fill="Soft"
            radii="400"
            size="400"
            onClick={handleOpenMenu}
            outlined
            aria-pressed={!!cords}
          >
            <Icon size="400" src={Icons.VerticalDots} />
          </IconButton>
        </PopOut>
      </SequenceCard>
    </Box>
  );
}
