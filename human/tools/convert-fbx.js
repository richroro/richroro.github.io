// Rocketbox FBX → avatar.glb 변환기(Loop 세분화 포함). 브라우저(three.js)에서 돌린다. README 의 '에셋 다시 만들기' 참고.
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

// Loop 세분화 한 단계. 위치는 좌표로 붙인(용접한) 위상에서 매끈하게, UV 는 모서리별로 선형 보간한다.
// 모프 변위·뼈 가중치도 같은 선형 스텐실을 그대로 적용한다(세분화는 위치에 대해 선형이라 정확하다).
function loopSubdivide(P, UV, SI, SW, deltas, triMat, N, skip) {
  // skip(t) 인 삼각형(머리카락 카드)은 위상에 넣지 않고 원래 모양·노멀 그대로 내보낸다
  const nC = P.length / 3, nT = nC / 3;
  const key = i => `${Math.round(P[3 * i] * 1000)},${Math.round(P[3 * i + 1] * 1000)},${Math.round(P[3 * i + 2] * 1000)}`;
  const wid = new Int32Array(nC), wmap = new Map(); let nW = 0; const wrep = [];
  for (let i = 0; i < nC; i++) { const k = key(i); let id = wmap.get(k); if (id === undefined) { id = nW++; wmap.set(k, id); wrep.push(i); } wid[i] = id; }
  const nD = deltas.length;
  const val = (arr, size) => { const o = new Float32Array(nW * size); for (let w = 0; w < nW; w++) for (let j = 0; j < size; j++) o[w * size + j] = arr[wrep[w] * size + j]; return o; };
  const WP = val(P, 3); const WD = deltas.map(d => val(d, 3));
  const WB = []; for (let w = 0; w < nW; w++) { const m = new Map(), c = wrep[w]; for (let j = 0; j < 4; j++) { const wt = SW[c * 4 + j]; if (wt > 0) m.set(SI[c * 4 + j], (m.get(SI[c * 4 + j]) || 0) + wt); } WB.push(m); }
  const edges = new Map(); const ek = (a, b) => a < b ? a * 1048576 + b : b * 1048576 + a;
  for (let t = 0; t < nT; t++) if (!skip(t)) for (let k = 0; k < 3; k++) {
    const a = wid[3 * t + k], b = wid[3 * t + (k + 1) % 3], c = wid[3 * t + (k + 2) % 3];
    if (a === b) continue;
    const id = ek(a, b); let e = edges.get(id);
    if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), opp: [] }; edges.set(id, e); }
    e.opp.push(c);
  }
  const nbr = Array.from({ length: nW }, () => new Set()), bnd = Array.from({ length: nW }, () => []);
  for (const e of edges.values()) { nbr[e.a].add(e.b); nbr[e.b].add(e.a); if (e.opp.length !== 2) { bnd[e.a].push(e.b); bnd[e.b].push(e.a); } }
  const vStencil = w => {
    if (bnd[w].length) return bnd[w].length === 2 ? [[w, 0.75], [bnd[w][0], 0.125], [bnd[w][1], 0.125]] : [[w, 1]];
    const n = nbr[w].size; if (n < 3) return [[w, 1]];
    const beta = n > 3 ? 3 / (8 * n) : 3 / 16; const s = [[w, 1 - n * beta]];
    for (const j of nbr[w]) s.push([j, beta]); return s;
  };
  const eStencil = e => e.opp.length === 2 ? [[e.a, 0.375], [e.b, 0.375], [e.opp[0], 0.125], [e.opp[1], 0.125]] : [[e.a, 0.5], [e.b, 0.5]];
  const apply = (st, arr) => { let x = 0, y = 0, z = 0; for (const [i, w] of st) { x += arr[3 * i] * w; y += arr[3 * i + 1] * w; z += arr[3 * i + 2] * w; } return [x, y, z]; };
  const applyB = st => { const m = new Map(); for (const [i, w] of st) for (const [b, wt] of WB[i]) m.set(b, (m.get(b) || 0) + wt * w); return m; };
  const pack = m => { const top = [...m.entries()].filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4); const s = top.reduce((a, e) => a + e[1], 0) || 1; const idx = [0, 0, 0, 0], wt = [0, 0, 0, 0]; top.forEach(([b, v], i) => { idx[i] = b; wt[i] = v / s; }); return [idx, wt]; };
  const cacheV = new Map(), cacheE = new Map();
  const vPoint = w => { let r = cacheV.get(w); if (!r) { const st = vStencil(w); r = { p: apply(st, WP), d: WD.map(d => apply(st, d)), b: pack(applyB(st)) }; cacheV.set(w, r); } return r; };
  const ePoint = (a, b) => { const id = ek(a, b); let r = cacheE.get(id); if (!r) { const st = eStencil(edges.get(id)); r = { p: apply(st, WP), d: WD.map(d => apply(st, d)), b: pack(applyB(st)) }; cacheE.set(id, r); } return r; };
  let nSkip = 0; for (let t = 0; t < nT; t++) if (skip(t)) nSkip++;
  const outN = (nT - nSkip) * 12 + nSkip * 3;
  const oP = new Float32Array(outN * 3), oUV = new Float32Array(outN * 2), oSI = new Float32Array(outN * 4), oSW = new Float32Array(outN * 4);
  const oD = deltas.map(() => new Float32Array(outN * 3)); const oMat = new Int32Array(outN / 3);
  const oN = new Float32Array(outN * 3), keepN = new Uint8Array(outN); let ot = 0;
  let o = 0;
  const emit = (pt, u, v) => {
    oP.set(pt.p, 3 * o); oUV[2 * o] = u; oUV[2 * o + 1] = v; oSI.set(pt.b[0], 4 * o); oSW.set(pt.b[1], 4 * o);
    for (let k = 0; k < nD; k++) oD[k].set(pt.d[k], 3 * o); o++;
  };
  for (let t = 0; t < nT; t++) {
    if (skip(t)) {
      for (let k = 0; k < 3; k++) {
        const i = 3 * t + k;
        oP.set(P.subarray(3 * i, 3 * i + 3), 3 * o); oN.set(N.subarray(3 * i, 3 * i + 3), 3 * o); keepN[o] = 1;
        oUV[2 * o] = UV[2 * i]; oUV[2 * o + 1] = UV[2 * i + 1];
        oSI.set(SI.subarray(4 * i, 4 * i + 4), 4 * o); oSW.set(SW.subarray(4 * i, 4 * i + 4), 4 * o);
        for (let d = 0; d < nD; d++) oD[d].set(deltas[d].subarray(3 * i, 3 * i + 3), 3 * o);
        o++;
      }
      oMat[ot++] = triMat[t];
      continue;
    }
    const c = [3 * t, 3 * t + 1, 3 * t + 2], w = c.map(i => wid[i]);
    const uv = c.map(i => [UV[2 * i], UV[2 * i + 1]]);
    const degenerate = w[0] === w[1] || w[1] === w[2] || w[2] === w[0];
    const V = w.map(vPoint);
    const E = degenerate ? null : [ePoint(w[0], w[1]), ePoint(w[1], w[2]), ePoint(w[2], w[0])];
    const muv = (i, j) => [(uv[i][0] + uv[j][0]) / 2, (uv[i][1] + uv[j][1]) / 2];
    const m01 = muv(0, 1), m12 = muv(1, 2), m20 = muv(2, 0);
    const E01 = E ? E[0] : V[0], E12 = E ? E[1] : V[1], E20 = E ? E[2] : V[2];
    const tris = [[V[0], uv[0], E01, m01, E20, m20], [V[1], uv[1], E12, m12, E01, m01], [V[2], uv[2], E20, m20, E12, m12], [E01, m01, E12, m12, E20, m20]];
    for (const [a, ua, b, ub, cc, uc] of tris) { emit(a, ua[0], ua[1]); emit(b, ub[0], ub[1]); emit(cc, uc[0], uc[1]); }
    for (let k = 0; k < 4; k++) oMat[ot++] = triMat[t];
  }
  return { P: oP, UV: oUV, SI: oSI, SW: oSW, deltas: oD, triMat: oMat, N: oN, keepN };
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
  const P0 = g0.attributes.position.array, n0 = P0.length / 3;
  const deltas0 = keep.map(([, idx]) => {
    const a = g0.morphAttributes.position[idx].array; const d = new Float32Array(n0 * 3);
    for (let i = 0; i < n0 * 3; i++) d[i] = g0.morphTargetsRelative ? a[i] : a[i] - P0[i];
    return d;
  });
  const triMat0 = new Int32Array(n0 / 3);
  for (const gr of g0.groups) for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) triMat0[t] = gr.materialIndex;
  const SUBDIV = !location.hash.includes('nosub');
  const opIdx = (Array.isArray(src.material) ? src.material : [src.material]).findIndex(m => m.name.includes('opacity'));
  const sd = SUBDIV ? loopSubdivide(P0, g0.attributes.uv.array, g0.attributes.skinIndex.array, g0.attributes.skinWeight.array, deltas0, triMat0, g0.attributes.normal.array, t => triMat0[t] === opIdx)
    : { P: P0, UV: g0.attributes.uv.array, SI: g0.attributes.skinIndex.array, SW: g0.attributes.skinWeight.array, deltas: deltas0, triMat: triMat0 };
  const P = new THREE.BufferAttribute(sd.P, 3);
  const n = P.count;
  const deltas = sd.deltas;
  log.subdiv = SUBDIV; log.vertsAfter = n;

  // smooth normals by position (for morph normal deltas)
  const key = (x, y, z) => `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
  const posKey = new Array(n); const keyId = new Map(); let nk = 0;
  for (let i = 0; i < n; i++) { const k = key(P.getX(i), P.getY(i), P.getZ(i)); let id = keyId.get(k); if (id === undefined) { id = nk++; keyId.set(k, id); } posKey[i] = id; }
  const idxArr = null; const triCount = (idxArr ? idxArr.length : n) / 3;
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
  const Nsm = new Float32Array(n * 3); for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) Nsm[3 * i + j] = sd.keepN && sd.keepN[i] ? sd.N[3 * i + j] : base[posKey[i] * 3 + j];
  const N = new THREE.BufferAttribute(Nsm, 3);
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
  const SI = new THREE.BufferAttribute(sd.SI, 4), SW = new THREE.BufferAttribute(sd.SW, 4);
  const domBone = i => { let best = -1, bw = -1; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j); if (w > bw) { bw = w; best = SI.getComponent(i, j); } } return best; };

  // material per triangle
  const triMat = sd.triMat;
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
    g.setAttribute('uv', new THREE.BufferAttribute(copy({ array: sd.UV }, 2), 2));
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
