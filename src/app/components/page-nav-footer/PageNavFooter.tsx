import React from 'react';
import { ProfileCard } from '../profile-card';
import { VoicePanel } from '../../features/voice-panel/VoicePanel';

export function PageNavFooter() {
  return (
    <>
      <VoicePanel />
      <ProfileCard />
    </>
  );
}