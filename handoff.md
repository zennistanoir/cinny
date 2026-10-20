# Zennith Handoff

> Last updated: 2026-10-20 — Session: Bug fixes, voice tree reconstruction, keybind recorder

---

## 1. Goal

Fork Cinny (Matrix client) into **Zennith** — a minimalistic/futuristic Discord-replica UI with:
- Discord-style sidebar voice channel tree with speaking indicators
- Bottom-left voice connected panel with live latency
- Non-blocking call overlay with centered control pill bar
- Custom Zennith Black & Violet theme
- Configurable global keybinds for mute/deafen/push-to-talk
- Full presence status control with live dot indicators

Primary working directory: `E:\cinny-fork`
Deploy target: `E:\Matrix-Claude\data\cinny\`

---

## 2. Current State

**Build:** `npm run build` passes with zero errors (Vite + PWA service worker). The `typecheck` script has pre-existing matrix-js-sdk type errors (not caused by our work).

**Working features:**
- All 6 original master-spec tasks (sidebar flex, status badges, profile card, member list, call overlay, branding rename)
- Zennith Black & Violet theme in Settings → Appearance
- Bottom minibar removed
- Voice connected panel with green dot + room name + red Disconnect button + live RTT latency polling (every 2s via iframe getStats injection)
- Discord-style sidebar voice tree: channel header row with speaker icon + channel name + "N Live" badge, participant rows below with 20px circle avatars + names
- Emoji picker dismisses on click-outside/Escape (capture-phase window listeners in CallControl.ts)
- Reaction/settings iframe pointer-events fix (`iframe.style.pointerEvents = 'auto'` in CallEmbed.ts)
- ProfileCard mute/deafen buttons wired to `callEmbed.control.toggleMicrophone()`/`toggleSound()` with reactive icon state
- Settings crash fixed (`Icons.Keyboard` → `Icons.Pencil`)
- Keybind recorder: interactive click-to-record with modifier detection, saves `ctrl+shift+m` format, displays `Ctrl + Shift + M`
- Global keybind listener in CallEmbedProvider.tsx (Ctrl+Shift+M mute, Ctrl+Shift+D deafen, push-to-talk)
- Presence status picker wired to `mx.setPresence()` with async/await

**Known limitations:**
- Matrix has no "Invisible" or "Do Not Disturb" presence states — both map to `offline`
- WebRTC RTT polling accesses iframe `RTCPeerConnection` via injected JS — works same-origin only, but Element Call is served from `/public/element-call/` (same origin)
- Push-to-talk requires Ctrl/Shift modifier (is-hotkey limitation) — pure key hold not supported
- Avatar image rendering uses raw `<img>` tags to enforce strict 20px sizing (folds `UserAvatar` wraps in flexible containers)

---

## 3. Active Files

| File | Role |
|---|---|
| `src/app/pages/Router.tsx` | Route tree, CallEmbedProvider mount, minibar removed |
| `src/app/pages/client/home/Home.tsx` | Home page with PageNavFooter |
| `src/app/pages/client/direct/Direct.tsx` | Direct messages with PageNavFooter |
| `src/app/pages/client/space/Space.tsx` | Space view with PageNavFooter |
| `src/app/pages/client/explore/Explore.tsx` | Explore with PageNavFooter |
| `src/app/pages/client/inbox/Inbox.tsx` | Inbox with PageNavFooter |
| `src/app/components/page-nav-footer/PageNavFooter.tsx` | Wraps VoicePanel + ProfileCard |
| `src/app/components/page-nav-footer/index.ts` | Re-export |
| `src/app/components/profile-card/ProfileCard.tsx` | Bottom-left user card: mute/deafen/presence/settings |
| `src/app/components/profile-card/ProfileCard.css.ts` | ProfileCard styles |
| `src/app/features/voice-panel/VoicePanel.tsx` | Voice connected panel + RTT polling |
| `src/app/features/voice-panel/VoicePanel.css.ts` | Voice panel + latency badge styles |
| `src/app/features/call/CallView.tsx` | Call view: prescreen + CallJoined + CallControls |
| `src/app/features/call/CallControls.tsx` | Bottom-center control pill bar |
| `src/app/features/call/styles.css.ts` | Call control positioning |
| `src/app/plugins/call/CallControl.ts` | Iframe DOM control: toggleReactions/toggleSettings/Escape + pointerEvents |
| `src/app/plugins/call/CallEmbed.ts` | Iframe creation with `pointerEvents: 'auto'` |
| `src/app/plugins/call/hooks.ts` | `useCallControlState` (null-safe) |
| `src/app/hooks/useCall.ts` | `useCallSession`, `useCallMembers` |
| `src/app/components/CallEmbedProvider.tsx` | Provider + GlobalKeybindsListener |
| `src/app/features/room-nav/RoomNavItem.tsx` | Voice tree: `.zennith-voice-channel-block` + `CallMemberSubItem` + CSS injection |
| `src/app/features/settings/Settings.tsx` | Settings tabs: KeybindsPage added |
| `src/app/features/settings/keybinds/Keybinds.tsx` | Interactive keybind recorder |
| `src/app/features/settings/general/General.tsx` | Theme selector (auto-picks up new themes) |
| `src/app/hooks/useTheme.ts` | Theme registry: VioletTheme + theme names |
| `src/app/state/settings.ts` | Settings interface: keybind fields + defaults |
| `src/colors.css.ts` | Color tokens: violetTheme |
| `src/app/pages/CallStatusRenderer.tsx` | **Unused** — minibar renderer (kept for reference) |
| `src/app/features/call-status/` | **Unused** — old bottom bar components (kept for reference) |

---

## 4. Changes Made

### Original Master Spec (Session 1)
1. Sidebar width: `240px; min-width: 240px; flex-shrink: 0`
2. Status indicator badges: 10-12px on 32px avatars, absolute bottom-right with 2px mask border
3. Bottom-left ProfileCard: avatar + status dot + display name + Mute/Deafen/Settings + presence picker
4. Member list: collapsible role-based sections with uppercase titles + counts
5. Call overlay: non-blocking iframe placement + bottom-center pill bar
6. Zennith branding rename (user-facing strings only, not functional identifiers)
7. Build & deploy

### Round 2 — Discord QOL + Settings + Theme
- Added Zennith Black & Violet theme (`violetTheme` in colors.css.ts)
- Removed bottom minibar (`<CallStatusRenderer />` from Router.tsx)
- Fixed emoji picker modal lock (capture-phase window listeners in CallControl.ts)
- Created VoicePanel showing voice connected state + RTT latency
- Created PageNavFooter wrapping VoicePanel + ProfileCard
- Added Keybinds settings tab with 3 configurable shortcuts
- Added CallMemberSubItem for nested sidebar voice participants
- Added GlobalKeybindsListener in CallEmbedProvider

### Round 3 — Bug Fixes
- Fixed Settings crash: `Icons.Keyboard` → `Icons.Pencil` (Keyboard doesn't exist in folds)
- Fixed reactions unclickable: `iframe.style.pointerEvents = 'auto'` in CallEmbed.getIframe()
- Fixed settings modal trap: Escape handler in toggleSettings() + pointer-events fix
- Fixed CallMemberSubItem property names: `device_id` → `deviceId`, `sender` → `userId`

### Round 4 — ProfileCard + Keybind Recorder
- Wired Mute/Deafen buttons to `callEmbed.control.toggleMicrophone()`/`toggleSound()`
- Added reactive icon state: Mic↔MicMute, Headphone↔HeadphoneMute, fill changes on active
- Made `useCallControlState` null-safe (accepts `CallControl | null`)
- Made presence update `async/await`
- Replaced keybind text inputs with interactive recorder (focus to record, keydown to capture)
- Added `hotkeyStorageToDisplay()` converter for human-readable format

### Round 5 — Sidebar Voice Tree Reconstruction
- **Critical fix:** Voice channel DOM completely restructured
- `.zennith-voice-channel-block` — parent wrapper with `flex-direction: column !important`
- `.zennith-channel-header-row` — 34px header: channel icon + name + "N Live" badge ONLY
- `.zennith-voice-user-tree` — below header, 28px indent, vertical list
- `.zennith-voice-user-item` — 28px rows with 20×20 circle avatars (`min/max-width: 20px !important`)
- `.zennith-voice-avatar.speaking` — green border + glow

### Round 6 — Voice Latency
- 2-second interval polling actual `RTCPeerConnection.getStats()` via iframe contentWindow injection
- Finds RTCPeerConnection from `<video>/<audio>` elements' `srcObject`
- Reads `currentRoundTripTime * 1000` → live ping display

---

## 5. Failed Attempts

### ❌ RTT from new RTCPeerConnection()
Created an empty `new RTCPeerConnection()` inside the iframe to get stats. This never works — a fresh idle PC has no candidate-pairs in succeeded state. **Lesson:** Must find the iframe's *existing* PC instances via DOM traversal of media elements.

### ❌ `Icons.Keyboard` / `Icons.Command`
Neither exists in the installed `folds` library. **Lesson:** Always verify icon names against `node_modules/folds/dist/index.js` before using them. Use `Icons.Pencil` or grep for available names first.

### ❌ `Avatar size="100"` in folds
The folds Avatar recipe only accepts `"200"`, `"300"`, `"400"`, `"500"`. Passing `"100"` silently falls back to the default (42px). **Lesson:** Check folds component recipes before using non-standard size values.

### ❌ Conditional hook calls
`callEmbed ? useCallControlState(callEmbed.control) : null` — this is a React hooks violation. The number of hooks must be consistent across renders. **Lesson:** Always call hooks unconditionally. Make the hook itself null-safe instead.

### ❌ Voice tree inside NavItem's flex container
Placing `<div className="voice-channel-participants">` as a sibling of `<NavLink>` inside `NavItem` (which has `display: flex`) caused participants to render as horizontal siblings. **Lesson:** Wrap channel header + participants in a `flex-direction: column` container inside NavItem.

### ❌ Avatar image stretching into channel header
Even with the column wrapper, if avatars share a flex container with the channel header row, folds' Avatar component wraps images in flexible containers that stretch. **Lesson:** Use raw `<img>` tags with explicit `min-width`/`max-width`/`width`/`height` constraints and `!important` to prevent folds' flexible containers from stretching them.

---

## 6. Next Steps

### Immediate (if building more features)
- [ ] Speaking indicator green ring on sidebar avatars (needs `useCallSpeakers` hook integration)
- [ ] Join/leave voice channel button in sidebar
- [ ] Screen share indicator in voice tree
- [ ] Call timer in voice panel
- [ ] Unread message badges in voice tree

### Polish
- [ ] Test cross-browser (Firefox, Safari) for pointer-events and iframe access
- [ ] Clean up unused `call-status/` folder and `CallStatusRenderer.tsx` if confirmed unnecessary
- [ ] Add `keybindReset` button in Keybinds to restore defaults
- [ ] Verify RTT polling works after Element Call updates (class name changes could break DOM traversal)

### Known Issues
- The hidden `<NavLink>` (display:none) handles click-to-navigate but may need testing with keyboard navigation
- Push-to-talk currently only works with modifier keys (is-hotkey limitation) — consider alternative key detection library for single-key hold
- DND vs Invisible distinction is lost in Matrix (both map to `offline`) — could store preference in account data