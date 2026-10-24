// Visual call cues (Settings > Accessibility): short captions for call events
// that are otherwise only heard (mute/deafen cues, people joining or leaving).
// Senders fire the event; CallCueCaptions in CallEmbedProvider shows them.

export const CALL_CUE_EVENT = 'zennith:call-cue';

export const showCallCue = (text: string) => {
  window.dispatchEvent(new CustomEvent<string>(CALL_CUE_EVENT, { detail: text }));
};
