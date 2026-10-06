// Rocketbox 모션캡처 FBX → anims.glb (뼈대 + 애니메이션만). window.CLIPS = [[파일, 이름], …] 을 먼저 정의하고 브라우저에서 돌린다.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const CLIPS = (window.CLIPS || []);
const loader = new FBXLoader();
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));

(async () => {
  const avatar = await load('/f03/Female_Adult_03_facial.fbx');
  const meshes = []; avatar.traverse(o => { if (o.isMesh) meshes.push(o); }); meshes.forEach(m => m.parent.remove(m));
  const bones = {}; avatar.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const head = bones['Bip01_Head'];
  // 얼굴 뼈(머리 아래 자식들)는 모프와 절차 애니메이션이 맡는다
  const faceBones = new Set(); head.traverse(o => { if (o !== head) faceBones.add(o.name); });
  const root = bones['Bip01'];
  const log = { rootRest: root.position.toArray(), rootQ: root.quaternion.toArray(), faceBones: faceBones.size, clips: [] };
  const clips = [];
  for (const [file, name] of CLIPS) {
    const g = await load('/anims/' + file);
    const src = g.animations[0];
    const tracks = [];
    let rootPos = null;
    for (const t of src.tracks) {
      const [node, prop] = t.name.split('.');
      if (!bones[node] || faceBones.has(node) || node === 'Bip01_Footsteps') continue;
      if (prop === 'quaternion') {
        // 변화가 거의 없는 트랙은 버린다
        const v = t.values; let moving = false;
        for (let i = 4; i < v.length && !moving; i++) if (Math.abs(v[i] - v[i % 4]) > 2e-4) moving = true;
        if (!moving) {
          // 정지 트랙이라도 자세가 쉬는 자세와 다르면 키 하나로 남긴다
          tracks.push(new THREE.QuaternionKeyframeTrack(t.name, [0], Array.from(v.slice(0, 4))));
        } else tracks.push(t);
      } else if (prop === 'position' && node === 'Bip01') rootPos = t;
    }
    if (rootPos) {
      // 골반 이동은 클립 평균을 아바타 쉬는 위치에 맞춘 상대값으로
      const v = rootPos.values.slice(); const n = v.length / 3; const mean = [0, 0, 0];
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) mean[j] += v[3 * i + j] / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) v[3 * i + j] = v[3 * i + j] - mean[j] + root.position.getComponent(j);
      tracks.push(new THREE.VectorKeyframeTrack('Bip01.position', rootPos.times, v));
      log.rootMean = log.rootMean || mean;
    }
    const clip = new THREE.AnimationClip(name, src.duration, tracks);
    clips.push(clip);
    log.clips.push([name, +src.duration.toFixed(2), tracks.length]);
  }
  // 첫 클립 첫 프레임의 몸통 회전(쉬는 자세와 비교용)
  log.clipRootQ0 = clips[0] && clips[0].tracks.find(t => t.name === 'Bip01.quaternion')?.values.slice(0, 4);
  new GLTFExporter().parse(avatar, buf => { window.GLB = buf; window.LOG = log; window.DONE = 1; },
    e => { window.LOG = { err: String(e) }; window.DONE = 1; }, { binary: true, animations: clips, onlyVisible: false });
})().catch(e => { window.LOG = { err: String(e) }; window.DONE = 1; });
