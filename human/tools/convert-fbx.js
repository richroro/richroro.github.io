// Rocketbox FBX → avatar.glb 변환기. 브라우저(three.js)에서 돌린다. README 의 '에셋 다시 만들기' 참고.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const camel = s => s.charAt(0).toLowerCase() + s.slice(1);
function cleanName(n) {
  n = n.replace(/^blendShape1\./, '');
  let m = n.match(/^AK_\d+_(.+)$/); if (m) return camel(m[1]);
  m = n.match(/^AA_VI_\d+_(.+)$/); if (m) return 'viseme_' + m[1];
  return null;
}

new FBXLoader().load('/f03/Female_Adult_03_facial.fbx', fbx => {
  fbx.updateMatrixWorld(true);
  const src = fbx.getObjectByProperty('type', 'SkinnedMesh');
  const g0 = src.geometry;
  const log = { relative: g0.morphTargetsRelative, morphNormals: !!g0.morphAttributes.normal, attrs: Object.keys(g0.attributes), indexed: !!g0.index, verts: g0.attributes.position.count };
  // materials per group
  log.groups = g0.groups.map(gr => [gr.start, gr.count, gr.materialIndex]);
  const dict = src.morphTargetDictionary;
  const keep = []; // [newName, oldIndex]
  for (const [name, idx] of Object.entries(dict)) { const c = cleanName(name); if (c) keep.push([c, idx]); }
  log.kept = keep.length;
  const P = g0.attributes.position, N = g0.attributes.normal;
  const n = P.count;

  // relative morph deltas
  const deltas = keep.map(([, idx]) => {
    const a = g0.morphAttributes.position[idx]; const d = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) d[i] = g0.morphTargetsRelative ? a.array[i] : a.array[i] - P.array[i];
    return d;
  });

  // smooth normals by position (for morph normal deltas)
  const key = (x, y, z) => `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
  const posKey = new Array(n); const keyId = new Map(); let nk = 0;
  for (let i = 0; i < n; i++) { const k = key(P.getX(i), P.getY(i), P.getZ(i)); let id = keyId.get(k); if (id === undefined) { id = nk++; keyId.set(k, id); } posKey[i] = id; }
  const idxArr = g0.index ? g0.index.array : null; const triCount = (idxArr ? idxArr.length : n) / 3;
  const vi = t => idxArr ? idxArr[t] : t;
  function smoothNormals(pos) {
    const acc = new Float32Array(nk * 3); const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let t = 0; t < triCount; t++) {
      const i0 = vi(3 * t), i1 = vi(3 * t + 1), i2 = vi(3 * t + 2);
      a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
      e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); // area weighted
      for (const i of [i0, i1, i2]) { const k = posKey[i] * 3; acc[k] += e1.x; acc[k + 1] += e1.y; acc[k + 2] += e1.z; }
    }
    for (let k = 0; k < nk; k++) { const l = Math.hypot(acc[3 * k], acc[3 * k + 1], acc[3 * k + 2]) || 1; acc[3 * k] /= l; acc[3 * k + 1] /= l; acc[3 * k + 2] /= l; }
    return acc;
  }
  const base = smoothNormals(P.array);
  const moved = new Uint8Array(n);
  const ndeltas = deltas.map(d => {
    const pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = P.array[i] + d[i];
    const sm = smoothNormals(pos); const nd = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      if (Math.abs(d[3 * i]) + Math.abs(d[3 * i + 1]) + Math.abs(d[3 * i + 2]) > 1e-3) moved[i] = 1;
      const k = posKey[i] * 3;
      for (let j = 0; j < 3; j++) { const v = sm[k + j] - base[k + j]; nd[3 * i + j] = Math.abs(v) < 1e-4 ? 0 : v; }
    }
    return nd;
  });

  // bones
  const bones = src.skeleton.bones; const bi = name => bones.findIndex(b => b.name === name);
  const eyeBones = new Set([bi('Bip01_LEye'), bi('Bip01_REye')]);
  const SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight;
  const domBone = i => { let best = -1, bw = -1; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } } return best; };

  // material per triangle
  const triMat = new Int32Array(triCount);
  for (const gr of g0.groups) for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) triMat[t] = gr.materialIndex;
  const mats = Array.isArray(src.material) ? src.material : [src.material];
  log.mats = mats.map(m => m.name);

  // classify triangles: 0 body, 1 head(skin), 2 eyes, 3 opacity-head (lashes), 4 opacity-body(hair)
  const headTris = [[], [], []]; // skin, eyes, lashes
  const bodyTris = [[], []]; // body materials: body, opacity
  const matName = mi => mats[mi].name;
  for (let t = 0; t < triCount; t++) {
    const v = [vi(3 * t), vi(3 * t + 1), vi(3 * t + 2)];
    const mn = matName(triMat[t]);
    const isEye = v.every(i => eyeBones.has(domBone(i)));
    const isMoved = v.some(i => moved[i]);
    if (isEye) headTris[1].push(t);
    else if (isMoved && mn.includes('head')) headTris[0].push(t);
    else if (isMoved && mn.includes('opacity')) headTris[2].push(t);
    else if (mn.includes('opacity')) bodyTris[1].push(t);
    else bodyTris[0].push(t, triMat[t]);
  }
  // body: split into body-mat and head-mat (unmoved head skin like back of head / ears)
  const bodySkin = [], bodyHeadSkin = [];
  for (let i = 0; i < bodyTris[0].length; i += 2) (matName(bodyTris[0][i + 1]).includes('head') ? bodyHeadSkin : bodySkin).push(bodyTris[0][i]);

  function build(groups, withMorph) {
    const tris = groups.flat(); const m = tris.length * 3;
    const g = new THREE.BufferGeometry();
    const copy = (attr, size) => { const out = new attr.array.constructor(m * size); let o = 0; for (const t of tris) for (let k = 0; k < 3; k++) { const i = vi(3 * t + k); for (let j = 0; j < size; j++) out[o++] = attr.array[i * size + j]; } return out; };
    g.setAttribute('position', new THREE.BufferAttribute(copy(P, 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(copy(N, 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(copy(g0.attributes.uv, 2), 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(copy(SI, 4), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(copy(SW, 4), 4));
    if (withMorph) {
      g.morphTargetsRelative = true;
      g.morphAttributes.position = deltas.map(d => new THREE.BufferAttribute(copy({ array: d }, 3), 3));
      g.morphAttributes.normal = ndeltas.map(d => new THREE.BufferAttribute(copy({ array: d }, 3), 3));
    }
    let s = 0; groups.forEach((gr, mi) => { g.addGroup(s, gr.length * 3, mi); s += gr.length * 3; });
    return mergeVertices(g, 1e-5);
  }
  const mk = (name, color) => new THREE.MeshStandardMaterial({ name, color });
  const headGeo = build(headTris, true);
  const bodyGeo = build([bodySkin, bodyHeadSkin, bodyTris[1]], false);
  const root = fbx; // keep bone hierarchy
  const headMesh = new THREE.SkinnedMesh(headGeo, [mk('face'), mk('eyes'), mk('lashes')]); headMesh.name = 'Face';
  const bodyMesh = new THREE.SkinnedMesh(bodyGeo, [mk('body'), mk('headskin'), mk('hair')]); bodyMesh.name = 'Body';
  headMesh.morphTargetDictionary = {}; headMesh.morphTargetInfluences = [];
  keep.forEach(([nm], i) => { headMesh.morphTargetDictionary[nm] = i; headMesh.morphTargetInfluences.push(0); });
  for (const m of [headMesh, bodyMesh]) { m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale); src.parent.add(m); m.bind(src.skeleton, src.bindMatrix); }
  src.parent.remove(src);
  log.head = { verts: headGeo.attributes.position.count, groups: headTris.map(a => a.length) };
  log.body = { verts: bodyGeo.attributes.position.count, groups: [bodySkin.length, bodyHeadSkin.length, bodyTris[1].length] };
  log.morphNames = keep.map(k => k[0]);
  // remove any non-bone, non-mesh junk
  fbx.animations = [];
  new GLTFExporter().parse(fbx, buf => {
    window.GLB = buf; window.LOG = log; window.DONE = 1;
  }, e => { window.LOG = { err: String(e) }; window.DONE = 1; }, { binary: true, onlyVisible: false });
});
