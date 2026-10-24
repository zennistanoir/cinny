import React, { MouseEventHandler, useState } from 'react';
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
import {
  LineSpacing,
  MessageTextSize,
  MotionPreference,
  settingsAtom,
} from '../../../state/settings';
import { stopPropagation } from '../../../utils/keyboard';
import { SequenceCardStyle } from '../styles.css';
import { PageZoomInput } from '../general';

type SelectOption<T extends string> = { value: T; name: string };

type SelectSettingProps<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
};
function SelectSetting<T extends string>({ value, options, onChange }: SelectSettingProps<T>) {
  const [menuCords, setMenuCords] = useState<RectCords>();

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (next: T) => {
    onChange(next);
    setMenuCords(undefined);
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
        <Text size="T300">{options.find((o) => o.value === value)?.name ?? value}</Text>
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
                    variant={value === option.value ? 'Primary' : 'Surface'}
                    radii="300"
                    aria-pressed={value === option.value}
                    onClick={() => handleSelect(option.value)}
                  >
                    <Text size="T300">{option.name}</Text>
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

type SwitchTileProps = {
  title: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};
function SwitchTile({ title, description, value, onChange }: SwitchTileProps) {
  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title={title}
        description={description}
        after={<Switch variant="Primary" value={value} onChange={onChange} />}
      />
    </SequenceCard>
  );
}

const MOTION_OPTIONS: SelectOption<MotionPreference>[] = [
  { value: 'system', name: 'Follow System' },
  { value: 'reduce', name: 'Reduce' },
  { value: 'allow', name: 'Allow' },
];

const TEXT_SIZE_OPTIONS: SelectOption<MessageTextSize>[] = [
  { value: '100', name: 'Default' },
  { value: '115', name: 'Large' },
  { value: '130', name: 'Larger' },
  { value: '150', name: 'Largest' },
];

const LINE_SPACING_OPTIONS: SelectOption<LineSpacing>[] = [
  { value: 'normal', name: 'Normal' },
  { value: 'relaxed', name: 'Relaxed' },
  { value: 'loose', name: 'Loose' },
];

function MotionAndContrast() {
  const [reducedMotion, setReducedMotion] = useSetting(settingsAtom, 'reducedMotion');
  const [highContrast, setHighContrast] = useSetting(settingsAtom, 'highContrast');
  const [focusRings, setFocusRings] = useSetting(settingsAtom, 'focusRings');
  const [underlineLinks, setUnderlineLinks] = useSetting(settingsAtom, 'underlineLinks');
  const [monochromeMode, setMonochromeMode] = useSetting(settingsAtom, 'monochromeMode');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Motion & Contrast</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Reduced Motion"
          description="Turn off animations and transitions. Follow System uses your device's setting."
          after={
            <SelectSetting
              value={reducedMotion}
              options={MOTION_OPTIONS}
              onChange={setReducedMotion}
            />
          }
        />
      </SequenceCard>
      <SwitchTile
        title="High Contrast"
        description="Stronger text and borders on top of the current theme."
        value={highContrast}
        onChange={setHighContrast}
      />
      <SwitchTile
        title="Always Show Focus Rings"
        description="A clear outline around whatever has keyboard focus."
        value={focusRings}
        onChange={setFocusRings}
      />
      <SwitchTile
        title="Underline Links"
        description="Make links stand out without relying on color."
        value={underlineLinks}
        onChange={setUnderlineLinks}
      />
      <SwitchTile title="Monochrome Mode" value={!!monochromeMode} onChange={setMonochromeMode} />
    </Box>
  );
}

function TextAndReadability() {
  const [messageTextSize, setMessageTextSize] = useSetting(settingsAtom, 'messageTextSize');
  const [lineSpacing, setLineSpacing] = useSetting(settingsAtom, 'lineSpacing');
  const [largeEmoji, setLargeEmoji] = useSetting(settingsAtom, 'largeEmoji');
  const [readableFont, setReadableFont] = useSetting(settingsAtom, 'readableFont');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Text & Readability</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Page Zoom"
          description="Scale the whole app (75-150%). Press Enter to apply."
          after={<PageZoomInput />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Message Text Size"
          description="Size of message text only, on top of Page Zoom."
          after={
            <SelectSetting
              value={messageTextSize}
              options={TEXT_SIZE_OPTIONS}
              onChange={setMessageTextSize}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Line Spacing"
          description="Space between lines of message text."
          after={
            <SelectSetting
              value={lineSpacing}
              options={LINE_SPACING_OPTIONS}
              onChange={setLineSpacing}
            />
          }
        />
      </SequenceCard>
      <SwitchTile
        title="Larger Emoji"
        description="Bigger custom emoji inside messages."
        value={largeEmoji}
        onChange={setLargeEmoji}
      />
      <SwitchTile
        title="Readable Font"
        description="Use Atkinson Hyperlegible, a font designed for low-vision readers."
        value={readableFont}
        onChange={setReadableFont}
      />
    </Box>
  );
}

function MediaAndCalls() {
  const [pauseAnimatedMedia, setPauseAnimatedMedia] = useSetting(
    settingsAtom,
    'pauseAnimatedMedia'
  );
  const [visualCallCues, setVisualCallCues] = useSetting(settingsAtom, 'visualCallCues');
  const [alwaysShowHoverControls, setAlwaysShowHoverControls] = useSetting(
    settingsAtom,
    'alwaysShowHoverControls'
  );

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Media & Calls</Text>
      <SwitchTile
        title="Pause Animated Media"
        description="GIFs and animated emoji stay still until you hover or focus them."
        value={pauseAnimatedMedia}
        onChange={setPauseAnimatedMedia}
      />
      <SwitchTile
        title="Visual Call Cues"
        description="Show a caption for call sounds: mute, deafen, people joining or leaving, and more."
        value={visualCallCues}
        onChange={setVisualCallCues}
      />
      <SwitchTile
        title="Always Show Hover Controls"
        description="Keep the volume and moderation buttons next to voice members visible."
        value={alwaysShowHoverControls}
        onChange={setAlwaysShowHoverControls}
      />
    </Box>
  );
}

type AccessibilityProps = {
  requestClose: () => void;
};
export function Accessibility({ requestClose }: AccessibilityProps) {
  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Accessibility
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface" aria-label="Close">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <MotionAndContrast />
              <TextAndReadability />
              <MediaAndCalls />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
