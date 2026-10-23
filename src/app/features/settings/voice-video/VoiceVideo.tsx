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
import { settingsAtom, VoiceGateLevel } from '../../../state/settings';
import { stopPropagation } from '../../../utils/keyboard';
import { DesktopCallDuckingSetting } from '../../../plugins/desktop';
import { SHARE_CONTENT_OPTIONS, SHARE_QUALITY_OPTIONS } from '../../call/ScreenSharePanel';
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
    const id = value === null ? undefined : JSON.parse(value) ?? undefined;
    // An old "communications" choice would keep ducking other apps; fall back to Default.
    if (id === 'communications') {
      localStorage.removeItem(EC_DEVICE_KEYS[kind]);
      return undefined;
    }
    return id;
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
  // Its virtual "communications" device is hidden: playing a call through it makes
  // Windows turn other apps down. Brave shuffles the list, so it is sorted by name.
  const systemDefault = devices.find((d) => d.kind === kind && d.deviceId === 'default');
  const options = devices
    .filter((d) => d.kind === kind && !['', 'default', 'communications'].includes(d.deviceId))
    .sort((a, b) => a.label.localeCompare(b.label));
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

type Option<T extends string> = { value: T; label: string };
type OptionSelectProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};
function OptionSelect<T extends string>({ value, options, onChange }: OptionSelectProps<T>) {
  const [menuCords, setMenuCords] = useState<RectCords>();
  const current = options.find((o) => o.value === value) ?? options[0];

  const handleSelect = (v: T) => {
    onChange(v);
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
      >
        <Text size="T300" truncate>
          {current.label}
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
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {options.map((option) => (
                  <MenuItem
                    key={option.value}
                    size="300"
                    variant={option.value === current.value ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(option.value)}
                  >
                    <Text size="T300">{option.label}</Text>
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

const VOICE_GATE_OPTIONS: Option<VoiceGateLevel>[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

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
  const [voiceGate, setVoiceGate] = useSetting(settingsAtom, 'voiceGate');

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
        <SettingTile
          title="Voice Gate"
          description="Silence your microphone between words, cutting keyboard clicks and hum that noise suppression lets through. Higher levels need you to speak louder. Applies immediately."
          after={
            <OptionSelect value={voiceGate} options={VOICE_GATE_OPTIONS} onChange={setVoiceGate} />
          }
        />
      </SequenceCard>
    </Box>
  );
}

function ScreenShare() {
  const [quality, setQuality] = useSetting(settingsAtom, 'screenShareQuality');
  const [content, setContent] = useSetting(settingsAtom, 'screenShareContent');
  const [h264, setH264] = useSetting(settingsAtom, 'screenShareH264');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Screen Share</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Quality"
          description="Resolution and frame rate of your screen share. Higher settings need more upload bandwidth."
          after={
            <OptionSelect value={quality} options={SHARE_QUALITY_OPTIONS} onChange={setQuality} />
          }
        />
        <SettingTile
          title="Optimize For"
          description="Smooth motion keeps the frame rate up on a slow connection (games, video). Sharp text keeps the picture crisp instead (code, documents)."
          after={
            <OptionSelect value={content} options={SHARE_CONTENT_OPTIONS} onChange={setContent} />
          }
        />
        <SettingTile
          title="Hardware Encoding (H.264)"
          description="Encode your screen share with H.264, which most GPUs encode in hardware. Lowers CPU use; turn off if viewers see a black or frozen share."
          after={<Switch variant="Primary" value={h264} onChange={setH264} />}
        />
      </SequenceCard>
      <Text size="T200" priority="300">
        Applies the next time you start sharing.
      </Text>
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
        <DesktopCallDuckingSetting />
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
              <ScreenShare />
              <Sounds />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
