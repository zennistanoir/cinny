import React, { KeyboardEventHandler, useState } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Switch, Text, color, toRem } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SequenceCardStyle } from '../styles.css';
import { DesktopHotkeysSetting } from '../../../plugins/desktop';

type KeybindsProps = {
  requestClose: () => void;
};

function eventToHotkeyString(evt: React.KeyboardEvent): string | null {
  const key = evt.key;
  // Ignore standalone modifier key presses
  if (key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift') {
    return null;
  }

  const parts: string[] = [];
  if (evt.ctrlKey || evt.metaKey) parts.push('ctrl');
  if (evt.shiftKey) parts.push('shift');
  if (evt.altKey) parts.push('alt');
  parts.push(key === ' ' ? 'space' : key.toLowerCase());

  return parts.join('+');
}

function hotkeyStorageToDisplay(raw: string): string {
  if (!raw) return '';
  return raw
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'meta') return 'Meta';
      if (part === 'shift') return 'Shift';
      if (part === 'alt') return 'Alt';
      if (part === 'space') return 'Space';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(' + ');
}

function KeybindInput({
  settingKey,
  label,
  description,
}: {
  settingKey:
    | 'keybindToggleMute'
    | 'keybindToggleDeafen'
    | 'keybindPushToTalk'
    | 'keybindToggleNoiseSuppression';
  label: string;
  description: string;
}) {
  const [value, setValue] = useSetting(settingsAtom, settingKey);
  const [currentValue, setCurrentValue] = useState(value ?? '');
  const [enabled, setEnabled] = useState(!!value);
  const [recording, setRecording] = useState(false);
  const capturedRef = React.useRef<string>('');

  const handleToggle = (v: boolean) => {
    setEnabled(v);
    if (!v) {
      setValue('');
      setCurrentValue('');
    } else {
      const defaults: Record<typeof settingKey, string> = {
        keybindToggleMute: 'ctrl+shift+m',
        keybindToggleDeafen: 'ctrl+shift+d',
        keybindPushToTalk: 'ctrl+shift+space',
        keybindToggleNoiseSuppression: 'ctrl+shift+x',
      };
      const defaultVal = defaults[settingKey];
      setValue(defaultVal);
      setCurrentValue(defaultVal);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (evt) => {
    if (!recording) return;
    evt.preventDefault();
    evt.stopPropagation();

    if (evt.key === 'Escape') {
      setRecording(false);
      return;
    }

    if (evt.key === 'Enter') {
      setValue(currentValue);
      setRecording(false);
      return;
    }

    const hotkey = eventToHotkeyString(evt);
    if (hotkey) {
      capturedRef.current = hotkey;
      setCurrentValue(hotkey);
      setValue(hotkey);
      setRecording(false);
      // Blur to exit recording mode visually.
      (evt.currentTarget as HTMLElement).blur();
    }
  };

  const startRecording = () => {
    if (!enabled) return;
    capturedRef.current = currentValue;
    setRecording(true);
  };

  const stopRecording = () => {
    if (capturedRef.current) {
      setValue(capturedRef.current);
      setCurrentValue(capturedRef.current);
      capturedRef.current = '';
    }
    setRecording(false);
  };

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title={label}
        description={description}
        after={
          <Box alignItems="Center" gap="200">
            <Switch
              variant="Primary"
              value={enabled}
              onChange={handleToggle}
              aria-label={`Enable ${label} shortcut`}
            />
            <Box
              role="button"
              aria-label={`Record shortcut for ${label}`}
              aria-pressed={recording}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onFocus={startRecording}
              onBlur={stopRecording}
              onClick={startRecording}
              alignItems="Center"
              justifyContent="Center"
              style={{
                width: toRem(160),
                height: toRem(36),
                borderRadius: toRem(8),
                cursor: enabled ? 'pointer' : 'not-allowed',
                backgroundColor: recording ? color.Primary.Container : 'transparent',
                border: `1px solid ${
                  recording ? color.Primary.ContainerLine : color.SurfaceVariant.ContainerLine
                }`,
                opacity: enabled ? 1 : 0.4,
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <Text size="T300" priority={recording ? '400' : '300'}>
                {recording ? 'Press keys...' : hotkeyStorageToDisplay(currentValue) || 'Click to record...'}
              </Text>
            </Box>
          </Box>
        }
      />
    </SequenceCard>
  );
}

export function Keybinds({ requestClose }: KeybindsProps) {
  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Keybinds
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
              <Box direction="Column" gap="100">
                <Text size="L400">Call Keybinds</Text>
                <Text size="T300" priority="300">
                  Click a keybind box, then press your desired key combination to record it. Press Escape to cancel, Enter to save.
                </Text>
                <Box direction="Column" gap="200">
                  <KeybindInput
                    settingKey="keybindToggleMute"
                    label="Toggle Mute"
                    description="Hotkey to toggle microphone mute on/off."
                  />
                  <KeybindInput
                    settingKey="keybindToggleDeafen"
                    label="Toggle Deafen"
                    description="Hotkey to toggle sound/headphones on/off."
                  />
                  <KeybindInput
                    settingKey="keybindPushToTalk"
                    label="Push to Talk"
                    description="Hold key to temporarily unmute. Release to restore previous mute state."
                  />
                  <KeybindInput
                    settingKey="keybindToggleNoiseSuppression"
                    label="Toggle Noise Suppression"
                    description="Hotkey to turn microphone noise suppression on/off. Works in and out of calls."
                  />
                  <DesktopHotkeysSetting />
                </Box>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}