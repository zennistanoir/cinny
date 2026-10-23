import React from 'react';
import {
  Box,
  Button,
  Chip,
  config,
  Icon,
  Icons,
  Menu,
  PopOut,
  RectCords,
  Switch,
  Text,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom, ScreenShareContent, ScreenShareQuality } from '../../state/settings';
import { stopPropagation } from '../../utils/keyboard';
import { applyShareSettingsLive } from '../../plugins/call/ecBridge';

type Option<T extends string> = { value: T; label: string };

export const SHARE_QUALITY_OPTIONS: Option<ScreenShareQuality>[] = [
  { value: '720p30', label: '720p · 30 fps' },
  { value: '1080p30', label: '1080p · 30 fps' },
  { value: '1080p60', label: '1080p · 60 fps' },
  { value: '1440p60', label: '1440p · 60 fps' },
];

export const SHARE_CONTENT_OPTIONS: Option<ScreenShareContent>[] = [
  { value: 'motion', label: 'Smooth motion' },
  { value: 'detail', label: 'Sharp text' },
];

type ChipGroupProps<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};
function ChipGroup<T extends string>({ label, value, options, onChange }: ChipGroupProps<T>) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{label}</Text>
      <Box wrap="Wrap" gap="100">
        {options.map((option) => (
          <Chip
            key={option.value}
            type="button"
            variant={option.value === value ? 'Primary' : 'SurfaceVariant'}
            aria-pressed={option.value === value}
            outlined={option.value === value}
            radii="300"
            onClick={() => onChange(option.value)}
          >
            <Text size="T300">{option.label}</Text>
          </Chip>
        ))}
      </Box>
    </Box>
  );
}

type ScreenSharePanelProps = {
  sharing: boolean;
  onToggle: () => void;
};
function ScreenSharePanel({ sharing, onToggle }: ScreenSharePanelProps) {
  const [quality, setQuality] = useSetting(settingsAtom, 'screenShareQuality');
  const [content, setContent] = useSetting(settingsAtom, 'screenShareContent');
  const [h264, setH264] = useSetting(settingsAtom, 'screenShareH264');

  // Settings are written synchronously, so the live share picks up the new value.
  const handleQuality = (value: ScreenShareQuality) => {
    setQuality(value);
    if (sharing) applyShareSettingsLive();
  };
  const handleContent = (value: ScreenShareContent) => {
    setContent(value);
    if (sharing) applyShareSettingsLive();
  };

  return (
    <Box direction="Column" gap="400" style={{ padding: config.space.S400, width: toRem(300) }}>
      <Box direction="Column" gap="100">
        <Text size="H5">{sharing ? 'Stream Settings' : 'Share Your Screen'}</Text>
        <Text size="T200" priority="300">
          {sharing
            ? 'Changes apply to your stream right away.'
            : 'Higher quality needs more upload bandwidth.'}
        </Text>
      </Box>
      <ChipGroup
        label="Quality"
        value={quality}
        options={SHARE_QUALITY_OPTIONS}
        onChange={handleQuality}
      />
      <ChipGroup
        label="Optimize For"
        value={content}
        options={SHARE_CONTENT_OPTIONS}
        onChange={handleContent}
      />
      <Box alignItems="Center" gap="300">
        <Box grow="Yes" direction="Column">
          <Text size="T300">Hardware Encoding (H.264)</Text>
          <Text size="T200" priority="300">
            {sharing ? 'Applies the next time you go live.' : 'Lowers CPU use.'}
          </Text>
        </Box>
        <Switch variant="Primary" value={h264} onChange={setH264} />
      </Box>
      {sharing ? (
        <Button
          variant="Critical"
          fill="Soft"
          radii="300"
          before={<Icon size="100" src={Icons.ScreenShare} />}
          onClick={onToggle}
        >
          <Text size="B400">Stop Streaming</Text>
        </Button>
      ) : (
        <Button
          variant="Primary"
          radii="300"
          before={<Icon size="100" src={Icons.ScreenShare} filled />}
          onClick={onToggle}
        >
          <Text size="B400">Go Live</Text>
        </Button>
      )}
    </Box>
  );
}

type ScreenSharePopOutProps = {
  anchor?: RectCords;
  sharing: boolean;
  /** Starts or stops the share. */
  onToggle: () => void;
  onClose: () => void;
  align?: 'Start' | 'Center' | 'End';
};
/** Asks for stream settings before going live, and adjusts them while live. */
export function ScreenSharePopOut({
  anchor,
  sharing,
  onToggle,
  onClose,
  align = 'Center',
}: ScreenSharePopOutProps) {
  const handleToggle = () => {
    onClose();
    onToggle();
  };

  return (
    <PopOut
      anchor={anchor}
      offset={8}
      position="Top"
      align={align}
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu>
            <ScreenSharePanel sharing={sharing} onToggle={handleToggle} />
          </Menu>
        </FocusTrap>
      }
    />
  );
}
