import React, { FormEventHandler, useCallback, useState } from 'react';
import {
  Box,
  Button,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { SequenceCardStyle } from '../styles.css';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { usePowerLevels } from '../../../hooks/usePowerLevels';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import { useFilePicker } from '../../../hooks/useFilePicker';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { StateEvent } from '../../../../types/matrix/room';
import {
  loadClip,
  measureClip,
  playClipLocally,
  saveSoundboard,
  SOUNDBOARD_MAX_BYTES,
  SOUNDBOARD_MAX_SECONDS,
  SOUNDBOARD_MAX_SOUNDS,
  SoundboardSound,
  useSoundboard,
} from '../../../plugins/call/soundboard';

const MAX_NAME = 32;
const MAX_EMOJI = 8;

const fileBaseName = (name: string) => name.replace(/\.[^.]+$/, '').slice(0, MAX_NAME);

type PickedClip = { file: File; duration: number };

type AddSoundTileProps = {
  roomId: string;
  sounds: SoundboardSound[];
};
function AddSoundTile({ roomId, sounds }: AddSoundTileProps) {
  const mx = useMatrixClient();
  const [clip, setClip] = useState<PickedClip>();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [pickError, setPickError] = useState<string>();

  const full = sounds.length >= SOUNDBOARD_MAX_SOUNDS;

  const pickFile = useFilePicker(
    useCallback(async (file: File) => {
      setPickError(undefined);
      setClip(undefined);
      if (file.size > SOUNDBOARD_MAX_BYTES) {
        setPickError('That file is over 1 MB.');
        return;
      }
      try {
        const duration = await measureClip(await file.arrayBuffer());
        if (duration > SOUNDBOARD_MAX_SECONDS + 0.05) {
          setPickError(`That clip is ${duration.toFixed(1)} s long. The limit is 5 s.`);
          return;
        }
        setClip({ file, duration });
        setName((current) => current || fileBaseName(file.name));
      } catch {
        setPickError("That file isn't audio this app can play.");
      }
    }, []),
    false
  );

  const [addState, addSound] = useAsyncCallback(
    useCallback(
      async (picked: PickedClip, soundName: string, soundEmoji: string) => {
        const { content_uri: url } = await mx.uploadContent(picked.file, {
          name: picked.file.name,
          type: picked.file.type,
          includeFilename: false,
        });
        const sound: SoundboardSound = {
          id: crypto.randomUUID(),
          name: soundName,
          emoji: soundEmoji || undefined,
          url,
          mimetype: picked.file.type || undefined,
          size: picked.file.size,
          duration: Math.round(picked.duration * 100) / 100,
        };
        await saveSoundboard(mx, roomId, [...sounds, sound]);
      },
      [mx, roomId, sounds]
    )
  );
  const adding = addState.status === AsyncStatus.Loading;

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const soundName = name.trim();
    if (!clip || !soundName || adding || full) return;
    addSound(clip, soundName, emoji.trim()).then(() => {
      setClip(undefined);
      setName('');
      setEmoji('');
    });
  };

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="New Sound"
        description={
          full
            ? `This space has the maximum of ${SOUNDBOARD_MAX_SOUNDS} sounds. Delete one to add another.`
            : 'Audio up to 5 seconds and 1 MB.'
        }
      >
        {!full && (
          <Box
            as="form"
            onSubmit={handleSubmit}
            direction="Column"
            gap="200"
            style={{ marginTop: config.space.S200 }}
          >
            <Box gap="200" alignItems="End" wrap="Wrap">
              <Box direction="Column" gap="100" shrink="No">
                <Text size="L400">File</Text>
                <Button
                  type="button"
                  size="400"
                  variant="Secondary"
                  fill="Soft"
                  radii="300"
                  outlined
                  disabled={adding}
                  before={<Icon size="100" src={Icons.Attachment} />}
                  onClick={() => pickFile('audio/*')}
                >
                  <Text size="B400" truncate style={{ maxWidth: toRem(160) }}>
                    {clip ? clip.file.name : 'Choose File'}
                  </Text>
                </Button>
              </Box>
              <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: toRem(140) }}>
                <Text size="L400">Name</Text>
                <Input
                  value={name}
                  onChange={(evt) => setName(evt.currentTarget.value)}
                  maxLength={MAX_NAME}
                  required
                  size="400"
                  variant="Secondary"
                  radii="300"
                  readOnly={adding}
                />
              </Box>
              <Box direction="Column" gap="100" shrink="No" style={{ width: toRem(80) }}>
                <Text size="L400">Emoji</Text>
                <Input
                  value={emoji}
                  onChange={(evt) => setEmoji(evt.currentTarget.value)}
                  maxLength={MAX_EMOJI}
                  placeholder="🔔"
                  size="400"
                  variant="Secondary"
                  radii="300"
                  readOnly={adding}
                />
              </Box>
              <Button
                type="submit"
                variant="Success"
                radii="300"
                disabled={!clip || !name.trim() || adding}
                before={adding && <Spinner size="200" variant="Success" fill="Solid" />}
              >
                <Text size="B400">Add</Text>
              </Button>
            </Box>
            {clip && (
              <Text size="T200" priority="300">
                {clip.duration.toFixed(1)} s, {Math.ceil(clip.file.size / 1024)} KB
              </Text>
            )}
            {pickError && (
              <Text size="T200" style={{ color: color.Critical.Main }}>
                {pickError}
              </Text>
            )}
            {addState.status === AsyncStatus.Error && (
              <Text size="T200" style={{ color: color.Critical.Main }}>
                {addState.error instanceof Error ? addState.error.message : 'Upload failed.'}
              </Text>
            )}
          </Box>
        )}
      </SettingTile>
    </SequenceCard>
  );
}

type SoundTileProps = {
  sound: SoundboardSound;
  canEdit: boolean;
  onRename: (name: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
};
function SoundTile({ sound, canEdit, onRename, onDelete }: SoundTileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sound.name);

  const [previewState, preview] = useAsyncCallback(
    useCallback(
      async () => playClipLocally(await loadClip(mx, sound.url, useAuthentication)),
      [mx, sound.url, useAuthentication]
    )
  );
  const [renameState, rename] = useAsyncCallback(onRename);
  const [deleteState, remove] = useAsyncCallback(onDelete);
  const busy =
    renameState.status === AsyncStatus.Loading || deleteState.status === AsyncStatus.Loading;

  const handleRename: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const next = draft.trim();
    if (!next || next === sound.name) {
      setEditing(false);
      return;
    }
    rename(next).then(() => setEditing(false));
  };

  const failed =
    previewState.status === AsyncStatus.Error
      ? "Couldn't play this sound."
      : (renameState.status === AsyncStatus.Error || deleteState.status === AsyncStatus.Error) &&
        'Saving failed. Please try again.';

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        before={
          <Text size="H4" style={{ width: toRem(28), textAlign: 'center' }} aria-hidden>
            {sound.emoji || '🔊'}
          </Text>
        }
        title={
          editing ? (
            <Box as="form" onSubmit={handleRename} gap="200" alignItems="Center">
              <Input
                autoFocus
                value={draft}
                onChange={(evt) => setDraft(evt.currentTarget.value)}
                onKeyDown={(evt) => {
                  if (evt.key === 'Escape') {
                    evt.stopPropagation();
                    setDraft(sound.name);
                    setEditing(false);
                  }
                }}
                maxLength={MAX_NAME}
                size="300"
                variant="Secondary"
                radii="300"
                readOnly={busy}
                aria-label="Sound name"
              />
              <Button type="submit" size="300" variant="Success" radii="300" disabled={busy}>
                <Text size="B300">Save</Text>
              </Button>
            </Box>
          ) : (
            sound.name
          )
        }
        description={
          failed ? (
            <span style={{ color: color.Critical.Main }}>{failed}</span>
          ) : (
            sound.duration !== undefined && `${sound.duration.toFixed(1)} s`
          )
        }
        after={
          <Box gap="100" alignItems="Center">
            <IconButton
              size="300"
              radii="300"
              variant="Secondary"
              fill="Soft"
              onClick={preview}
              aria-label={`Preview ${sound.name}`}
            >
              <Icon size="100" src={Icons.Play} filled />
            </IconButton>
            {canEdit && !editing && (
              <IconButton
                size="300"
                radii="300"
                variant="Secondary"
                fill="Soft"
                disabled={busy}
                onClick={() => {
                  setDraft(sound.name);
                  setEditing(true);
                }}
                aria-label={`Rename ${sound.name}`}
              >
                <Icon size="100" src={Icons.Pencil} />
              </IconButton>
            )}
            {canEdit && (
              <IconButton
                size="300"
                radii="300"
                variant="Critical"
                fill="Soft"
                disabled={busy}
                onClick={remove}
                aria-label={`Delete ${sound.name}`}
              >
                {deleteState.status === AsyncStatus.Loading ? (
                  <Spinner size="100" variant="Critical" />
                ) : (
                  <Icon size="100" src={Icons.Delete} />
                )}
              </IconButton>
            )}
          </Box>
        }
      />
    </SequenceCard>
  );
}

type SoundboardProps = {
  requestClose: () => void;
};
export function Soundboard({ requestClose }: SoundboardProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canEdit = permissions.stateEvent(StateEvent.ZennithSoundboard, mx.getSafeUserId());

  const sounds = useSoundboard(room);

  const handleRename = (id: string) => (name: string) =>
    saveSoundboard(
      mx,
      room.roomId,
      sounds.map((s) => (s.id === id ? { ...s, name } : s))
    );
  const handleDelete = (id: string) => () =>
    saveSoundboard(
      mx,
      room.roomId,
      sounds.filter((s) => s.id !== id)
    );

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Soundboard
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
            <Box direction="Column" gap="100">
              <Text size="L400">Sounds</Text>
              <Text size="T200" priority="300">
                Anyone in a voice channel of this space can play these from the call controls.
                Everyone in the call hears them.
              </Text>
              {canEdit && <AddSoundTile roomId={room.roomId} sounds={sounds} />}
              {sounds.map((sound) => (
                <SoundTile
                  key={sound.id}
                  sound={sound}
                  canEdit={canEdit}
                  onRename={handleRename(sound.id)}
                  onDelete={handleDelete(sound.id)}
                />
              ))}
              {sounds.length === 0 && (
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <Box
                    direction="Column"
                    gap="200"
                    style={{
                      padding: `${config.space.S700} ${config.space.S400}`,
                      maxWidth: toRem(300),
                      margin: 'auto',
                    }}
                  >
                    <Text size="H5" align="Center">
                      No Sounds
                    </Text>
                    <Text size="T200" align="Center">
                      {canEdit
                        ? 'Add a sound above to start this space’s soundboard.'
                        : 'A moderator can add sounds for this space.'}
                    </Text>
                  </Box>
                </SequenceCard>
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
