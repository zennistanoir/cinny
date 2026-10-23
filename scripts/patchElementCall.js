/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

// Build-time patches to Element Call's minified bundle (@element-hq/element-call-embedded
// 0.20.1). They hand a few view-model hooks to `window.__zennithEC`, which the host
// installs into the iframe (src/app/plugins/call/ecBridge.ts):
//   - per-user playback volume is read from / saved to Zennith's store, so it survives
//     rejoining (Element Call hardcodes 100% on every join)
//   - speaking and screen-share state is reported for the voice member list
//   - screen-share capture/publish options come from Zennith's quality settings, and the
//     sharing participant is handed over so changes can be applied mid-stream
//   - with no device chosen, the system default device is used instead of the first one
//     listed. Brave shuffles the device list, so "first" could be Windows' virtual
//     "communications" output, which makes Windows turn other apps down by 80%.
//
// The match strings depend on Element Call's minified names and break on upgrade; every
// miss is reported loudly and the bundle is left otherwise intact.
const PATCHES = [
  {
    name: 'volume: initial state from store',
    find: 'function rot(e,{pretendToBeDisconnected$:t,sink$:n}){let r=new cJ,i=new cJ,a=new cJ,o=e.behavior(VJ(r,i,a).pipe(M0e({volume:1,committedVolume:1},',
    replace:
      'function rot(e,{pretendToBeDisconnected$:t,sink$:n,zk:zk}){let r=new cJ,i=new cJ,a=new cJ,zb=window.__zennithEC,o=e.behavior(VJ(r,i,a).pipe(M0e(zb&&zk?zb.volGet(zk):{volume:1,committedVolume:1},',
  },
  {
    name: 'volume: save changes, accept host adjustments',
    find: 'default:return{...e,volume:t}}}),W(({volume:e})=>e)));',
    replace:
      'default:return{...e,volume:t}}}),W(s=>(zb&&zk&&zb.volSave(zk,s),s.volume))));zb&&zk&&zb.volWatch(e,zk,v=>{i.next(v);a.next(`commit`)});',
  },
  {
    name: 'volume: key user media by user id',
    find: 'sink$:e.behavior(n.participant$.pipe(W(e=>t=>e?.setVolume(t))))',
    replace: 'zk:n.userId,sink$:e.behavior(n.participant$.pipe(W(e=>t=>e?.setVolume(t))))',
  },
  {
    name: 'volume: key screen-share audio by user id',
    find: 'sink$:e.behavior(n.participant$.pipe(W(e=>t=>e?.setVolume(t,Q.Source.ScreenShareAudio))))',
    replace:
      'zk:n.userId+"|share",sink$:e.behavior(n.participant$.pipe(W(e=>t=>e?.setVolume(t,Q.Source.ScreenShareAudio))))',
  },
  {
    name: 'speaking state',
    find: 'speaking$:e.behavior(o.pipe(ZJ(e=>e?m1(e,Y.IsSpeakingChanged).pipe(W(e=>e.isSpeaking)):PJ(!1))))',
    replace:
      'speaking$:(zs=>(window.__zennithEC?.speaking(e,a.userId,a.id,zs),zs))(e.behavior(o.pipe(ZJ(e=>e?m1(e,Y.IsSpeakingChanged).pipe(W(e=>e.isSpeaking)):PJ(!1)))))',
  },
  {
    name: 'screen-share state',
    find: 'function aot(e,t){return{...Qat(',
    replace: 'function aot(e,t){window.__zennithEC?.share(e,t.userId,t.id);return{...Qat(',
  },
  {
    name: 'screen-share quality',
    find: 'j.value?.setScreenShareEnabled(t,e).catch(u.error)',
    replace:
      '(window.__zennithEC?.shareOwner?.(j.value),j.value)?.setScreenShareEnabled(t,{...e,...window.__zennithEC?.shareCapture?.()},window.__zennithEC?.sharePublish?.()).catch(u.error)',
  },
  {
    name: 'devices: default to the system default',
    find: 'function k1(e,t){return IJ([e,t],(e,t)=>{if(e.size)return t!==void 0&&e.has(t)||e.size===1&&e.has(``)?t:e.keys().next().value})}',
    replace:
      'function k1(e,t){return IJ([e,t],(e,t)=>{if(e.size)return t!==void 0&&e.has(t)||e.size===1&&e.has(``)?t:e.has(`default`)?`default`:[...e.keys()].find(k=>k!==`communications`)??e.keys().next().value})}',
  },
];

export const patchElementCallSource = (source) => {
  let out = source;
  const missed = [];
  PATCHES.forEach(({ name, find, replace }) => {
    const count = out.split(find).length - 1;
    if (count !== 1) {
      missed.push(`${name} (${count} matches)`);
      return;
    }
    out = out.replace(find, () => replace);
  });
  return { source: out, missed };
};

// Vite plugin: patch the copied bundle in the build output.
export const patchElementCall = (outDir) => ({
  name: 'zennith-patch-element-call',
  apply: 'build',
  closeBundle() {
    const assets = path.resolve(outDir, 'public/element-call/assets');
    const files = fs.existsSync(assets)
      ? fs.readdirSync(assets).filter((f) => /^index-.*\.js$/.test(f))
      : [];
    if (files.length !== 1) {
      console.warn(
        `\n[zennith] Element Call bundle not found in ${assets} (${files.length} candidates); not patched.\n`
      );
      return;
    }
    const file = path.join(assets, files[0]);
    const { source, missed } = patchElementCallSource(fs.readFileSync(file, 'utf8'));
    // The source map no longer lines up; drop it rather than ship a wrong one.
    fs.writeFileSync(file, source.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n'));
    if (fs.existsSync(`${file}.map`)) fs.rmSync(`${file}.map`);
    if (missed.length > 0) {
      console.warn(
        `\n[zennith] WARNING: ${missed.length} Element Call patch(es) did not apply (Element Call upgraded?):\n  - ${missed.join(
          '\n  - '
        )}\nPersistent volume / speaking ring / LIVE badge / share quality / default device may not work.\n`
      );
    } else {
      console.log(`[zennith] Patched Element Call bundle (${PATCHES.length} patches).`);
    }
  },
});
