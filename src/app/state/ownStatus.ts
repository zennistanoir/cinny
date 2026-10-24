import { atom } from 'jotai';
import { OwnStatus } from '../utils/ownStatus';

// The status picked in the profile card. OwnStatusSync seeds it and follows other devices.
export const ownStatusAtom = atom<OwnStatus>('online');
