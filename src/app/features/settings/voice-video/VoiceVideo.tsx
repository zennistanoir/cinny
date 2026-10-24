import React, { MouseEventHandler, useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  color,
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
  toRem,
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
import { GATE_LEVELS } from '../../../plugins/call/noiseSuppression';
import { playToggleSound } from '../../../plugins/call/toggleSounds';
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
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
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
            after={
              <Box gap="200" alignItems="Center">
                <Button
                  size="300"
                  variant="Secondary"
                  fill="Soft"
                  radii="300"
                  onClick={() => playToggleSound('speakerTest')}
                >
                  <Text size="B300">Test</Text>
                </Button>
                <DeviceSelect kind="audiooutput" devices={devices} />
              </Box>
            }
          />
        )}
        <SettingTile
          title="Camera"
          description="Camera used when you turn on video."
          after={<DeviceSelect kind="videoinput" devices={devices} />}
        />
      </SequenceCard>
      <Text size="T200" priority="300">
        Applies from your next call. Mid-call, change devices in the call itself.
      </Text>
    </Box>
  );
}

// Meter range in dBFS. Speech usually sits between -40 and -15.
const METER_FLOOR_DB = -80;
const toMeterPercent = (db: number) =>
  Math.min(100, Math.max(0, ((db - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100));

// Live level of the selected mic, with a marker where Voice Gate opens. It reads
// the raw mic, before noise suppression, so background noise shows a little higher
// here than the gate sees it.
function MicTest({ voiceGate }: { voiceGate: VoiceGateLevel }) {
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'failed'>('idle');
  const fillRef = useRef<HTMLDivElement>(null);
  const running = state === 'running' || state === 'starting';

  useEffect(() => {
    if (!running) return undefined;
    let disposed = false;
    let stream: MediaStream | undefined;
    let audio: AudioContext | undefined;
    let frame = 0;

    const start = async () => {
      const deviceId = readDevice('audioinput');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
      } catch {
        // The saved device may be gone; try the default before giving up.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      audio = new AudioContext();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let level = METER_FLOOR_DB;
      setState('running');

      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
        const db = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-8);
        // Rise instantly, fall smoothly, like a VU meter.
        level = db > level ? db : level + (db - level) * 0.15;
        if (fillRef.current) fillRef.current.style.width = `${toMeterPercent(level)}%`;
        frame = requestAnimationFrame(tick);
      };
      tick();
    };

    start().catch(() => {
      if (!disposed) setState('failed');
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      audio?.close().catch(() => undefined);
    };
  }, [running]);

  const gateOpen = voiceGate === 'off' ? undefined : GATE_LEVELS[voiceGate].open;

  return (
    <Box direction="Column" gap="300">
      <SettingTile
        title="Mic Test"
        description={
          state === 'failed'
            ? "Couldn't open your microphone. Check that Zennith has permission to use it."
            : 'Speak to check your input level.'
        }
        after={
          <Button
            size="300"
            variant={running ? 'Critical' : 'Secondary'}
            fill="Soft"
            radii="300"
            onClick={() => setState(running ? 'idle' : 'starting')}
          >
            <Text size="B300">{running ? 'Stop' : 'Test'}</Text>
          </Button>
        }
      />
      {state === 'running' && (
        <Box direction="Column" gap="100">
          <div
            aria-hidden
            style={{
              position: 'relative',
              height: toRem(8),
              borderRadius: config.radii.Pill,
              background: color.SurfaceVariant.ContainerLine,
              overflow: 'hidden',
            }}
          >
            <div
              ref={fillRef}
              style={{
                width: 0,
                height: '100%',
                borderRadius: config.radii.Pill,
                background: color.Success.Main,
              }}
            />
            {gateOpen !== undefined && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${toMeterPercent(gateOpen)}%`,
                  width: toRem(2),
                  background: color.Warning.Main,
                }}
              />
            )}
          </div>
          {gateOpen !== undefined && (
            <Text size="T200" priority="300">
              The yellow marker is where Voice Gate lets your mic through. When you&apos;re quiet,
              the bar should stay left of it.
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function Microphone() {
  const [noiseSuppression, setNoiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [voiceGate, setVoiceGate] = useSetting(settingsAtom, 'voiceGate');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Microphone</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Noise Suppression"
          description="Filters background noise from your mic. Works mid-call."
          after={
            <Switch variant="Primary" value={noiseSuppression} onChange={setNoiseSuppression} />
          }
        />
        <SettingTile
          title="Voice Gate"
          description="Mutes your mic between words to cut keyboard clicks and hum. Higher levels need louder speech."
          after={
            <OptionSelect value={voiceGate} options={VOICE_GATE_OPTIONS} onChange={setVoiceGate} />
          }
        />
        <MicTest voiceGate={voiceGate} />
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
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Quality"
          description="Higher settings need more upload bandwidth."
          after={
            <OptionSelect value={quality} options={SHARE_QUALITY_OPTIONS} onChange={setQuality} />
          }
        />
        <SettingTile
          title="Optimize For"
          description="Smooth motion for games and video, sharp text for code and documents."
          after={
            <OptionSelect value={content} options={SHARE_CONTENT_OPTIONS} onChange={setContent} />
          }
        />
        <SettingTile
          title="Hardware Encoding (H.264)"
          description="Uses your GPU to lower CPU load. Turn off if viewers see a black or frozen screen."
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
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Toggle Sounds"
          description="Play a sound when you mute, deafen or toggle noise suppression, and when a share ends."
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
