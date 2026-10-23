import React, { MouseEventHandler, useCallback, useEffect, useState } from 'react';
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
  Scroll,
  Switch,
  Text,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { stopPropagation } from '../../../utils/keyboard';
import { SequenceCardStyle } from '../styles.css';

type DeviceKind = 'audioinput' | 'audiooutput' | 'videoinput';

// Element Call runs on our origin and keeps its device choice in localStorage
// under these keys, read when a call loads. Writing them here lets users pick
// devices without joining a call first; the choice applies to the next call.
const EC_DEVICE_KEYS: Record<DeviceKind, string> = {
  audioinput: 'matrix-setting-audio-input',
  audiooutput: 'matrix-setting-audio-output',
  videoinput: 'matrix-setting-video-input',
};

const readDevice = (kind: DeviceKind): string | undefined => {
  try {
    const value = localStorage.getItem(EC_DEVICE_KEYS[kind]);
    return value === null ? undefined : JSON.parse(value) ?? undefined;
  } catch {
    return undefined;
  }
};

const writeDevice = (kind: DeviceKind, id: string | undefined) => {
  if (id === undefined) localStorage.removeItem(EC_DEVICE_KEYS[kind]);
  else localStorage.setItem(EC_DEVICE_KEYS[kind], JSON.stringify(id));
};

function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh);
  }, [refresh]);

  return [devices, refresh] as const;
}

// Browsers hide device names until the page has had media access once.
const requestDeviceAccess = async () => {
  const grab = async (constraints: MediaStreamConstraints) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Denied or no such device; the list just stays unnamed.
    }
  };
  await grab({ audio: true });
  await grab({ video: true });
};

type DeviceSelectProps = {
  kind: DeviceKind;
  devices: MediaDeviceInfo[];
};
function DeviceSelect({ kind, devices }: DeviceSelectProps) {
  const [menuCords, setMenuCords] = useState<RectCords>();
  const [selected, setSelected] = useState(() => readDevice(kind));

  // Chrome lists the OS default as a virtual "default" device; it becomes the
  // Default entry (which clears the choice, so Element Call follows the OS).
  const systemDefault = devices.find((d) => d.kind === kind && d.deviceId === 'default');
  const options = devices.filter(
    (d) => d.kind === kind && d.deviceId !== '' && d.deviceId !== 'default'
  );
  const defaultName = systemDefault?.label || 'System Default';
  const current = options.find((d) => d.deviceId === selected);
  const currentName = current ? current.label || 'Unnamed device' : defaultName;

  const handleSelect = (id: string | undefined) => {
    writeDevice(kind, id);
    setSelected(id);
    setMenuCords(undefined);
  };

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
        style={{ maxWidth: '16rem' }}
      >
        <Text size="T300" truncate>
          {currentName}
        </Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu style={{ maxWidth: '22rem' }}>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                <MenuItem
                  size="300"
                  variant={current ? 'Surface' : 'Primary'}
                  radii="300"
                  onClick={() => handleSelect(undefined)}
                >
                  <Text size="T300" truncate>
                    {defaultName}
                  </Text>
                </MenuItem>
                {options.map((device, i) => (
                  <MenuItem
                    key={device.deviceId}
                    size="300"
                    variant={current?.deviceId === device.deviceId ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(device.deviceId)}
                  >
                    <Text size="T300" truncate>
                      {device.label || `Device ${i + 1}`}
                    </Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

function Devices() {
  const [devices, refresh] = useMediaDevices();
  const needsAccess = devices.some((d) => d.kind !== 'audiooutput' && !d.label);
  const hasOutputs = devices.some((d) => d.kind === 'audiooutput');

  const handleAllow = async () => {
    await requestDeviceAccess();
    refresh();
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Devices</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        {needsAccess && (
          <SettingTile
            title="Device Access"
            description="Allow microphone and camera access to see your device names."
            after={
              <Button size="300" variant="Primary" fill="Soft" radii="300" onClick={handleAllow}>
                <Text size="B300">Allow</Text>
              </Button>
            }
          />
        )}
        <SettingTile
          title="Input Device"
          description="Microphone used in calls."
          after={<DeviceSelect kind="audioinput" devices={devices} />}
        />
        {hasOutputs && (
          <SettingTile
            title="Output Device"
            description="Speakers or headset used for call audio."
            after={<DeviceSelect kind="audiooutput" devices={devices} />}
          />
        )}
        <SettingTile
          title="Camera"
          description="Camera used when you turn on video."
          after={<DeviceSelect kind="videoinput" devices={devices} />}
        />
      </SequenceCard>
      <Text size="T200" priority="300">
        Applies the next time you join a call. During a call, use the call&apos;s own settings.
      </Text>
    </Box>
  );
}

function Microphone() {
  const [noiseSuppression, setNoiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Microphone</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Noise Suppression"
          description="Filter background noise from your microphone in calls (RNNoise). Applies immediately, including during a call."
          after={
            <Switch variant="Primary" value={noiseSuppression} onChange={setNoiseSuppression} />
          }
        />
      </SequenceCard>
    </Box>
  );
}

function Sounds() {
  const [callToggleSounds, setCallToggleSounds] = useSetting(settingsAtom, 'callToggleSounds');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Sounds</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Toggle Sounds"
          description="Play a short sound when you mute, deafen or toggle noise suppression (including via keybinds), and when a screen share ends."
          after={
            <Switch variant="Primary" value={callToggleSounds} onChange={setCallToggleSounds} />
          }
        />
      </SequenceCard>
    </Box>
  );
}

type VoiceVideoProps = {
  requestClose: () => void;
};
export function VoiceVideo({ requestClose }: VoiceVideoProps) {
  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Voice & Video
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Devices />
              <Microphone />
              <Sounds />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
