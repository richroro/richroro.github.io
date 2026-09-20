/* ══════════════════════════════════════════════════════════════════════════
   기계 해마 · Clockwork Seahorse

   나비와 같은 재료(금속·유리·HDR 환경광·블룸)를 쓰되 기구가 다르다.
   몸은 마디 서른 개가 이어진 사슬이고, 관절 각도만 바꾸면 꼬리가 말린다.
   등지느러미는 갈비 열네 개가 시차를 두고 흔들리고, 그 끝을 잇는 막은
   매 프레임 다시 뽑는다.

   좌표 약속: 머리가 위(+Y), 배가 앞(+Z), 꼬리는 아래로 내려가며 말린다.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  THREE, TAU, clamp, lerp, smooth, rng, canvas2d,
  makeMetalRoughnessMap, makeSpriteTexture, makeHaloTexture,
  buildEnvTexture, buildBackdrop, buildHalo, buildMotes, Composer,
} from '../../assets/scene-kit.js';

export const PRESETS = {
  brass: {
    label: '황동 심해',
    metal: 0xf0c884, metalRough: 0.19, frame: 0x7a5a30, frameRough: 0.34,
    glass: 0x9fd8e0, iridRange: [150, 880], emissive: 0x7fe8ff, core: 0x8ff4ff,
    bgTop: 0x07192b, bgBot: 0x020609, halo: 0x1b4e72, mote: 0xbfe6ff, eye: 0xa8f2ff,
    exposure: 1.2,
    env: [
      { dir: [-0.5, 0.7, 0.5], ang: 0.4, color: [1.0, 0.95, 0.85], power: 10 },
      { dir: [0.75, 0.2, -0.6], ang: 0.3, color: [0.4, 0.8, 1.0], power: 8 },
      { dir: [0.2, -0.55, 0.8], ang: 0.55, color: [0.5, 0.6, 0.7], power: 2.2 },
      { dir: [0.05, 0.98, 0.15], ang: 0.15, color: [1.0, 1.0, 1.0], power: 6.5 },
    ],
    sky: [0.05, 0.09, 0.14], ground: [0.008, 0.016, 0.024],
  },
  steel: {
    label: '강철 빙하',
    metal: 0xb6c6da, metalRough: 0.2, frame: 0x3c4c60, frameRough: 0.32,
    glass: 0xa8d4ff, iridRange: [220, 1000], emissive: 0x86dcff, core: 0x9cefff,
    bgTop: 0x06172a, bgBot: 0x01040a, halo: 0x145a86, mote: 0xcfeaff, eye: 0xd2f6ff,
    exposure: 1.1,
    env: [
      { dir: [-0.45, 0.72, 0.52], ang: 0.38, color: [0.88, 0.95, 1.0], power: 8 },
      { dir: [0.8, 0.12, -0.58], ang: 0.28, color: [0.32, 0.74, 1.0], power: 6.5 },
      { dir: [-0.15, -0.55, -0.8], ang: 0.6, color: [0.24, 0.42, 0.62], power: 2.2 },
      { dir: [0.1, 0.97, -0.2], ang: 0.14, color: [1.0, 1.0, 1.0], power: 5 },
    ],
    sky: [0.04, 0.08, 0.15], ground: [0.006, 0.012, 0.02],
  },
  copper: {
    label: '적동 산호',
    metal: 0xe89a6a, metalRough: 0.22, frame: 0x6f3a2a, frameRough: 0.36,
    glass: 0xffc2a8, iridRange: [120, 760], emissive: 0xff9f6a, core: 0xffb478,
    bgTop: 0x150c14, bgBot: 0x050308, halo: 0x4c2438, mote: 0xffd9c4, eye: 0xffc79a,
    exposure: 1.08,
    env: [
      { dir: [-0.55, 0.64, 0.54], ang: 0.42, color: [1.0, 0.88, 0.76], power: 8 },
      { dir: [0.72, 0.26, -0.62], ang: 0.32, color: [1.0, 0.6, 0.45], power: 5.5 },
      { dir: [0.28, -0.44, 0.85], ang: 0.55, color: [0.55, 0.32, 0.26], power: 2 },
      { dir: [-0.05, 0.99, 0.1], ang: 0.16, color: [1.0, 0.96, 0.92], power: 6 },
    ],
    sky: [0.1, 0.05, 0.05], ground: [0.02, 0.01, 0.012],
  },
};

/* ── 몸의 뼈대 값 ── */
const N = 30;                       // 마디 수(머리 아래 첫 마디 → 꼬리 끝)
const SEG_LEN = (i) => 0.2 * (1 - 0.55 * (i / N));
const RING_R = (i) => 0.27 * Math.pow(1 - 0.8 * (i / N), 0.9) + 0.02;
const FIN_FROM = 4, FIN_TO = 14;    // 등지느러미가 붙는 마디 구간

/* 쉬고 있을 때의 굽은 정도(라디안, +는 뒤로).
   목은 뒤로 젖혀 배가 앞으로 나오고, 배 아래부터는 앞으로 돌기 시작한다. */
function restAngle(i) {
  if (i < 2) return 0.2;
  if (i < 7) return 0.07;
  if (i < 11) return -0.06;
  return -0.05;
}

/* ── 질감 ── */
function ringTexture() {            // 마디 표면 — 가로로 난 결과 미세한 흠
  const [c, x] = canvas2d(512, 256);
  const rand = rng(77);
  x.fillStyle = '#8c8c8c'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 1800; i++) {
    const y = rand() * 256, v = Math.floor(96 + rand() * 110);
    x.strokeStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.12})`;
    x.lineWidth = 0.6 + rand() * 1.4;
    x.beginPath(); x.moveTo(rand() * 512, y); x.lineTo(rand() * 512 + 40 + rand() * 160, y + (rand() - 0.5) * 3); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* 지느러미 막.
   u 는 갈비 번호, v 는 밑동(0)에서 갈비 끝(1). 갈비 사이마다 바깥선이 패이게
   알파를 깎아 두면 막은 부챗살 사이에서 오목해지고 갈비 끝만 밖으로 나온다. */
function finAlpha(lobes) {
  const W = 512, H = 256;
  const [c, x] = canvas2d(W, H);
  const img = x.createImageData(W, H);
  for (let py = 0; py < H; py++) {
    const v = py / (H - 1);
    for (let px = 0; px < W; px++) {
      const u = px / (W - 1);
      const rib = Math.abs(Math.cos(Math.PI * u * lobes));   // 갈비 자리에서 1
      const edge = 0.7 + 0.28 * rib;                          // 갈비 사이가 패인 바깥선
      let a = clamp((edge - v) / 0.13, 0, 1);
      a *= smooth(0.04, 0.34, v);                             // 뿌리는 비워 둔다 — 몸에 겹치지 않게
      a *= 0.45 + 0.55 * Math.pow(1 - v, 0.6);
      a *= 0.72 + 0.28 * rib;                                 // 갈비를 따라 난 결
      const i = (py * W + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255);
      img.data[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function finMaps() {
  const [cI, ix] = canvas2d(256, 128);                        // 박막 두께 지도
  const rand = rng(404);
  ix.fillStyle = '#505050'; ix.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 24; i++) {
    const px = rand() * 256, py = rand() * 128, r = 24 + rand() * 70;
    const g = ix.createRadialGradient(px, py, 0, px, py, r);
    const v = Math.floor(60 + rand() * 190);
    g.addColorStop(0, `rgba(${v},${v},${v},0.6)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ix.fillStyle = g; ix.beginPath(); ix.arc(px, py, r, 0, TAU); ix.fill();
  }
  const iridMap = new THREE.CanvasTexture(cI);
  iridMap.colorSpace = THREE.NoColorSpace;
  return { dorsalAlpha: finAlpha(FIN_TO - FIN_FROM), pecAlpha: finAlpha(4), iridMap };
}

/* ── 갈비 사이를 잇는 막. 매 프레임 갈비 끝을 다시 재서 다시 뽑는다. ── */
function ribbonGeometry(n) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const idx = [];
  for (let i = 0; i < n; i++) {
    uv[i * 4] = i / (n - 1); uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = i / (n - 1); uv[i * 4 + 3] = 1;
    if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function buildSeahorse(preset, maps, roughMap) {
  const root = new THREE.Group();      // 물에 뜬 전체 움직임
  const body = new THREE.Group();      // 몸통
  root.add(body);

  const metal = new THREE.MeshPhysicalMaterial({
    color: preset.metal, metalness: 1, roughness: preset.metalRough * 2,
    roughnessMap: ringTexture(), envMapIntensity: 1.35, clearcoat: 0.7, clearcoatRoughness: 0.2,
  });
  metal.userData.roughK = 2;        // roughnessMap 의 평균이 0.5라 재질 값이 절반으로 줄어든다
  const dark = new THREE.MeshStandardMaterial({
    color: preset.frame, metalness: 1, roughness: preset.frameRough * 2, roughnessMap: roughMap, envMapIntensity: 1.05,
  });
  dark.userData.roughK = 2;
  const glow = new THREE.MeshStandardMaterial({
    color: 0x05080c, emissive: new THREE.Color(preset.core), emissiveIntensity: 0.85, roughness: 0.6, metalness: 0.2,
  });
  const band = new THREE.MeshStandardMaterial({      // 배를 따라 켜진 작은 불 — 기계라는 표시
    color: 0x05080c, emissive: new THREE.Color(preset.core), emissiveIntensity: 0.55, roughness: 0.5, metalness: 0.2,
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0f18, metalness: 0.6, roughness: 0.16,
    emissive: new THREE.Color(preset.eye), emissiveIntensity: 0.22,
    iridescence: 1, iridescenceIOR: 2.2, iridescenceThicknessRange: [220, 700], envMapIntensity: 1.7,
  });
  const membrane = (alphaMap) => new THREE.MeshPhysicalMaterial({   // 나비 날개와 같은 처방
    color: preset.glass, alphaMap, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    metalness: 0.28, roughness: 0.17,
    iridescence: 1, iridescenceIOR: 2.3, iridescenceThicknessRange: preset.iridRange.slice(),
    iridescenceThicknessMap: maps.iridMap,
    emissive: new THREE.Color(preset.emissive), emissiveIntensity: 0.12,
    clearcoat: 0.65, clearcoatRoughness: 0.1, envMapIntensity: 1.5,
  });
  const finMat = membrane(maps.dorsalAlpha);
  const pecMat = membrane(maps.pecAlpha);

  /* ── 마디 사슬 ── */
  const joints = [];
  const ringGeoCache = new Map();
  let parent = body;
  for (let i = 0; i < N; i++) {
    const j = new THREE.Group();
    if (i > 0) j.position.y = -SEG_LEN(i - 1);
    parent.add(j);
    parent = j;

    const r = RING_R(i), len = SEG_LEN(i);
    const key = r.toFixed(3);
    if (!ringGeoCache.has(key)) {
      ringGeoCache.set(key, new THREE.TorusGeometry(r, r * 0.16 + 0.012, 5, 6).rotateX(Math.PI / 2));
    }
    const ring = new THREE.Mesh(ringGeoCache.get(key), i % 3 === 1 ? dark : metal);
    ring.position.y = -len * 0.5;
    j.add(ring);

    const core = new THREE.Mesh(                     // 마디 사이를 잇는 속대
      new THREE.CylinderGeometry(r * 0.52, RING_R(i + 1) * 0.52, len * 1.08, 7), dark);
    core.position.y = -len * 0.5;
    j.add(core);
    if (i < 14) {                                    // 배 쪽에 하나씩 켜진 불
      const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), band);
      pilot.position.set(0, -len * 0.5, r * 0.92);
      j.add(pilot);
    }

    for (const a of [0, 2.2, -2.2]) {                // 등·옆으로 솟은 돌기
      const sp = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, r * 0.55, 5), metal);
      sp.position.set(Math.sin(a) * r, -len * 0.5, Math.cos(a) * r);
      sp.rotation.x = Math.PI / 2 - 0.3;
      sp.rotation.y = a;
      j.add(sp);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, r * 2.1, 8).rotateZ(Math.PI / 2), dark);
    j.add(pin);                                      // 관절 핀 — 여기서 꺾인다

    joints.push({ g: j, len, r });
  }

  /* ── 등지느러미 ── */
  const dorsalRibs = [];
  const dorsalCount = FIN_TO - FIN_FROM + 1;
  for (let k = 0; k < dorsalCount; k++) {
    const i = FIN_FROM + k;
    const holder = new THREE.Group();
    holder.position.set(0, -joints[i].len * 0.5, -joints[i].r * 1.08);
    joints[i].g.add(holder);
    const t = k / (dorsalCount - 1);
    const L = 0.14 + 0.3 * Math.sin(Math.PI * t);    // 가운데가 길다
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.008, L, 6).translate(0, -L / 2, 0), metal);
    rib.rotation.x = 1.22;                           // 등 쪽(-Z)으로 눕힌다
    holder.add(rib);
    const tip = new THREE.Object3D();
    tip.position.y = -L;
    rib.add(tip);
    dorsalRibs.push({ base: holder, holder, rib, tip, L });
  }
  const dorsalGeo = ribbonGeometry(dorsalCount);
  const dorsal = new THREE.Mesh(dorsalGeo, finMat);
  dorsal.frustumCulled = false;
  dorsal.renderOrder = 2;
  body.add(dorsal);

  /* ── 가슴지느러미 한 쌍 ── */
  const pecs = [];
  for (const side of [-1, 1]) {
    const ribs = [];
    const holderRoot = new THREE.Group();
    holderRoot.position.set(side * RING_R(2) * 0.95, -0.1, 0.0);
    holderRoot.rotation.z = side * -0.95;            // 귀처럼 옆으로 눕는다
    joints[2].g.add(holderRoot);
    for (let k = 0; k < 5; k++) {
      const h = new THREE.Group();
      h.rotation.z = side * (k - 2) * 0.3;
      holderRoot.add(h);
      const L = 0.34 - Math.abs(k - 2) * 0.05;
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.007, L, 5).translate(0, -L / 2, 0), metal);
      rib.rotation.x = 0.3;                          // 뒤로 살짝 눕힌다
      h.add(rib);
      const tip = new THREE.Object3D();
      tip.position.y = -L;
      rib.add(tip);
      ribs.push({ base: h, h, rib, tip });
    }
    const geo = ribbonGeometry(5);
    const mesh = new THREE.Mesh(geo, pecMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    body.add(mesh);
    pecs.push({ side, ribs, geo, mesh });
  }

  /* ── 머리 ── */
  const head = new THREE.Group();
  head.position.y = 0.16;
  head.rotation.x = 0.55;                            // 고개를 숙인 자세
  body.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 2), metal);
  skull.scale.set(0.85, 0.92, 1.05);
  head.add(skull);
  const snout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.044, 0.48, 9).rotateX(Math.PI / 2).translate(0, 0, 0.24), metal);
  snout.position.set(0, -0.03, 0.2);
  snout.rotation.x = 0.35;
  head.add(snout);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.016, 6, 12).rotateX(Math.PI / 2), dark);
  mouth.position.set(0, -0.185, 0.63);
  mouth.rotation.x = 0.35;
  head.add(mouth);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.017, 5, 20).rotateX(Math.PI / 2), dark);
  seam.position.y = 0.02;
  seam.scale.set(0.98, 1, 1.2);                      // 머리통을 두 쪽으로 가르는 이음선
  head.add(seam);
  for (const side of [-1, 1]) {                      // 눈 — 렌즈 경통에 물린 알
    const px = side * 0.185;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.072, 0.1, 12).rotateZ(Math.PI / 2), dark);
    barrel.position.set(px, 0.05, 0.12);
    head.add(barrel);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), eyeMat);
    eye.position.set(px + side * 0.035, 0.05, 0.12);
    head.add(eye);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.013, 5, 14).rotateY(Math.PI / 2), metal);
    bezel.position.set(px + side * 0.07, 0.05, 0.12);
    head.add(bezel);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), band);
    pupil.position.set(px + side * 0.082, 0.05, 0.12);
    head.add(pupil);
  }
  for (let k = 0; k < 5; k++) {                      // 머리 위 관(冠)
    const t = k / 4;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1 + 0.1 * Math.sin(Math.PI * t), 5), metal);
    sp.position.set((t - 0.5) * 0.24, 0.26, -0.06 - Math.abs(t - 0.5) * 0.06);
    sp.rotation.z = (t - 0.5) * 0.7;
    sp.rotation.x = -0.35;
    head.add(sp);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 9), glow);
  lamp.position.set(0, 0.12, 0.22);
  head.add(lamp);
  const headLight = new THREE.PointLight(new THREE.Color(preset.core), 0.5, 2.2, 2);
  headLight.position.copy(lamp.position);
  head.add(headLight);

  /* ── 배의 태엽 — 꼬리가 말리는 만큼 감긴다 ── */
  const gears = [];
  for (const [i, r, teeth, side] of [[4, 0.12, 14, 1], [5, 0.075, 9, -1]]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, teeth * 2).rotateZ(Math.PI / 2), metal);
    g.position.set(side * RING_R(i) * 0.75, -joints[i].len * 0.5, 0.02);
    joints[i].g.add(g);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.07, 8).rotateZ(Math.PI / 2), dark);
    hub.position.copy(g.position);
    joints[i].g.add(hub);
    gears.push({ mesh: g, ratio: side * (0.12 / r) });
  }

  return { root, body, joints, dorsalRibs, dorsalGeo, pecs, head, gears, glow, headLight,
           mats: { metal, dark, glow, band, eyeMat, finMat, pecMat } };
}

/* ══ 물속 ══════════════════════════════════════════════════════════════════ */

/* 수면에서 내려오는 빛기둥. 카메라 쪽으로만 돌려 세우는 납작한 판이다. */
function shaftTexture() {
  const [c, x] = canvas2d(64, 256);
  const img = x.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    const v = y / 255;
    const fade = Math.pow(1 - v, 1.7) * smooth(0, 0.1, v);
    for (let px = 0; px < 64; px++) {
      const u = (px / 63 - 0.5) * 2;
      const i = (y * 64 + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(clamp(Math.exp(-u * u * 4.5) * fade, 0, 1) * 255);
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildShafts(preset) {
  const map = shaftTexture();
  const group = new THREE.Group();
  const mats = [];
  const rand = rng(909);
  for (let i = 0; i < 7; i++) {
    const w = 0.35 + rand() * 0.95;
    const mat = new THREE.MeshBasicMaterial({
      map, color: new THREE.Color(preset.halo).lerp(new THREE.Color(0xffffff), 0.35), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.16 + rand() * 0.2, fog: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 9.5), mat);
    const off = 1.7 + rand() * 2.9;
    m.position.set(rand() < 0.5 ? -off : off, 2.4, -2.6 - rand() * 4.2);
    m.rotation.z = (rand() - 0.5) * 0.32;
    m.renderOrder = -4;
    m.userData.phase = rand() * TAU;
    m.userData.x0 = m.position.x;
    m.userData.op = mat.opacity;
    group.add(m);
    mats.push(mat);
  }
  group.renderOrder = -4;
  return { group, mats };
}

/* 거품 — 아래에서 올라와 위에서 사라지고 다시 아래로 돌아온다. */
function buildBubbles(preset, count) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count), phase = new Float32Array(count), speed = new Float32Array(count);
  const rand = rng(1313);
  for (let i = 0; i < count; i++) {
    const r = 0.8 + Math.pow(rand(), 0.6) * 4.6, th = rand() * TAU;
    pos[i * 3] = Math.cos(th) * r;
    pos[i * 3 + 1] = rand() * 9;
    pos[i * 3 + 2] = Math.sin(th) * r;
    size[i] = 0.012 + Math.pow(rand(), 2.0) * 0.075;
    phase[i] = rand() * TAU;
    speed[i] = 0.16 + rand() * 0.5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uScale: { value: 300 },
      uColor: { value: new THREE.Color(preset.mote) }, uOpacity: { value: 0.95 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSize, aPhase, aSpeed;
      uniform float uTime, uScale;
      varying float vFade;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * aSpeed, 9.0) - 4.6;               // 위로 오르다 아래로 되돌아온다
        p.x += sin(uTime * (0.6 + aSpeed) + aPhase) * 0.09;       // 흔들리며 오른다
        p.z += cos(uTime * (0.5 + aSpeed) + aPhase * 1.7) * 0.09;
        vFade = smoothstep(-4.6, -3.2, p.y) * (1.0 - smoothstep(2.6, 4.4, p.y));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * uScale / max(0.2, -mv.z), 1.0, 70.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity;
      varying float vFade;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        if (r > 1.0) discard;
        float rim  = smoothstep(1.0, 0.82, r) * smoothstep(0.5, 0.92, r);   // 테두리가 밝은 공
        float body = (1.0 - smoothstep(0.0, 1.0, r)) * 0.1;
        float spec = smoothstep(0.26, 0.0, length(q - vec2(-0.15, 0.15))) * 0.55;
        float a = (rim * 0.9 + body + spec) * vFade * uOpacity;
        gl_FragColor = vec4(uColor * (rim + spec * 1.8 + body) * 1.7, a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { pts, mat };
}

/* ══ 자세 ══════════════════════════════════════════════════════════════════
   관절 각도만 정하면 나머지는 따라온다. 막은 갈비 끝을 다시 재서 다시 뽑는다.
   ═════════════════════════════════════════════════════════════════════════ */

const _v = new THREE.Vector3();

function fillMembrane(geo, ribs, body) {
  const arr = geo.attributes.position.array;
  for (let k = 0; k < ribs.length; k++) {
    ribs[k].base.getWorldPosition(_v); body.worldToLocal(_v);
    arr[k * 6] = _v.x; arr[k * 6 + 1] = _v.y; arr[k * 6 + 2] = _v.z;
    ribs[k].tip.getWorldPosition(_v); body.worldToLocal(_v);
    arr[k * 6 + 3] = _v.x; arr[k * 6 + 4] = _v.y; arr[k * 6 + 5] = _v.z;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

export function poseSeahorse(sh, t, s) {
  const live = s.swim ? 1 : 0;
  const curl = clamp(s.curl + 0.11 * (0.5 + 0.5 * Math.sin(t * 0.52)) * live, 0, 0.62);

  /* 꼬리 — 아래로 갈수록 더 감기고, 그 위로 잔물결이 훑고 내려간다 */
  for (let i = 0; i < N; i++) {
    const j = sh.joints[i].g;
    const w = smooth(9, 24, i);
    j.rotation.x = restAngle(i) - curl * w
      + live * Math.sin(t * 1.55 - i * 0.42) * (0.004 + 0.018 * w);
    j.rotation.z = live * Math.sin(t * 0.92 - i * 0.3) * (0.002 + 0.013 * smooth(3, 26, i));
  }

  /* 등지느러미 — 갈비마다 한 박자씩 늦게 흔들려 물결이 뒤로 흘러간다 */
  const ft = t * s.fin;
  for (let k = 0; k < sh.dorsalRibs.length; k++) {
    const d = sh.dorsalRibs[k];
    const ph = ft * 8.6 - k * 0.95;
    d.holder.rotation.y = Math.sin(ph) * 0.36 * live;
    d.rib.rotation.x = 1.22 + Math.cos(ph) * 0.12 * live;
  }

  /* 가슴지느러미 — 귀처럼 파닥인다 */
  for (const p of sh.pecs) {
    for (let k = 0; k < p.ribs.length; k++) {
      const r = p.ribs[k];
      const ph = ft * 7.4 - k * 0.55 + (p.side > 0 ? 0 : 0.4);
      r.h.rotation.x = Math.sin(ph) * 0.44 * live;
    }
  }

  /* 머리 · 태엽 · 불빛 */
  sh.head.rotation.x = 0.55 + Math.sin(t * 0.63) * 0.07 * live;
  sh.head.rotation.y = Math.sin(t * 0.31) * 0.2 * live;
  for (const g of sh.gears) g.mesh.rotation.x = curl * g.ratio * 11;
  const pulse = 0.7 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3));
  sh.mats.glow.emissiveIntensity = pulse;
  sh.mats.band.emissiveIntensity = 0.35 + 0.3 * pulse;   // 배를 따라 켜진 불
  sh.headLight.intensity = 0.3 + 0.4 * pulse;

  /* 물에 뜬 몸 전체 */
  sh.root.position.y = Math.sin(t * 0.55) * 0.075 * live;
  sh.root.rotation.z = Math.sin(t * 0.41) * 0.05 * live;
  sh.root.rotation.x = Math.sin(t * 0.33 + 1.1) * 0.035 * live;

  sh.root.updateMatrixWorld(true);
  fillMembrane(sh.dorsalGeo, sh.dorsalRibs, sh.body);
  for (const p of sh.pecs) fillMembrane(p.geo, p.ribs, sh.body);
}

/* ══ 장면 ══════════════════════════════════════════════════════════════════ */

export function createSeahorse(canvas, opts = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // 색조는 합성 단계에서 직접 한다
  renderer.info.autoReset = false;

  let presetKey = PRESETS[opts.preset] ? opts.preset : 'brass';
  let preset = PRESETS[presetKey];
  renderer.setClearColor(preset.bgBot, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 120);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let envRT = null;
  function loadEnv(p) {
    const src = buildEnvTexture(p);
    const rt = pmrem.fromEquirectangular(src);
    src.dispose();
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  }
  loadEnv(preset);

  const backdrop = buildBackdrop(preset);
  scene.add(backdrop.mesh);
  const halo = buildHalo(preset, makeHaloTexture());
  halo.material.opacity = 0.34;
  scene.add(halo);
  const shafts = buildShafts(preset);
  scene.add(shafts.group);
  const bubbles = buildBubbles(preset, isMobile ? 220 : 440);
  scene.add(bubbles.pts);

  const key = new THREE.DirectionalLight(0xffeccd, 2.2); key.position.set(-1.6, 4.4, 2.0);
  const rim = new THREE.DirectionalLight(0x8fd6ff, 1.6); rim.position.set(2.9, 1.0, -3.2);
  const fill = new THREE.DirectionalLight(0x5b76a0, 0.8); fill.position.set(0.6, -2.4, 1.4);
  scene.add(key, rim, fill);

  const rough = makeMetalRoughnessMap(29);
  const maps = finMaps();
  const pivot = new THREE.Group();
  scene.add(pivot);
  const sh = buildSeahorse(preset, maps, rough);
  pivot.add(sh.root);

  const state = {
    curl: 0.16, fin: 1, speed: 1, bloom: 1,
    swim: !reduceMotion, spin: !reduceMotion, bubbles: true, shafts: true, paused: false, quality: 'auto',
  };
  Object.assign(state, opts.state || {});

  /* ── 카메라가 잡을 크기 — 쉬는 자세의 실제 부피를 재서 쓴다 ── */
  const focus = new THREE.Vector3(0, -1.4, 0);
  let spanY = 3.2, spanR = 1.4;
  {
    poseSeahorse(sh, 0, { curl: state.curl + 0.055, fin: 1, swim: false });   // 숨쉬는 중간쯤의 자세
    const box = new THREE.Box3().setFromObject(sh.root);
    const size = box.getSize(new THREE.Vector3());
    focus.set(0, box.getCenter(new THREE.Vector3()).y, 0);
    spanY = size.y; spanR = Math.max(size.x, size.z);
    bubbles.pts.position.y = focus.y;
    shafts.group.position.y = focus.y + 0.6;
  }
  function fitDist() {
    const vfov = camera.fov * Math.PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    return clamp(Math.max((spanY * 0.57) / Math.tan(vfov / 2), (spanR * 0.62) / Math.tan(hfov / 2)) + 0.3, 2.4, 14);
  }

  const view = { theta: 1.12, phi: 1.3, dist: 5 };
  const want = { theta: 1.12, phi: 1.3, dist: 5 };

  /* ── 조작 ── */
  let dragging = false, lastX = 0, lastY = 0, pinch = 0;
  const pointers = new Map();
  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  };
  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) want.dist = clamp(want.dist * (pinch / d), 2.2, 13);
      pinch = d; return;
    }
    if (!dragging) return;
    want.theta -= (e.clientX - lastX) * 0.006;
    want.phi = clamp(want.phi - (e.clientY - lastY) * 0.005, 0.3, Math.PI - 0.3);
    lastX = e.clientX; lastY = e.clientY;
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) dragging = false;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  const onWheel = (e) => { e.preventDefault(); want.dist = clamp(want.dist * Math.exp(e.deltaY * 0.0011), 2.2, 13); };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  /* ── 크기 ── */
  const composer = new Composer(renderer);
  let W = 1, H = 1, samples = isMobile ? 0 : 4, scale = 1;
  const PIXEL_BUDGET = 3.0e6;
  function applySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    let k = dpr * scale;
    const px = rect.width * rect.height * k * k;
    if (px > PIXEL_BUDGET) k *= Math.sqrt(PIXEL_BUDGET / px);
    W = Math.max(2, Math.round(rect.width * k));
    H = Math.max(2, Math.round(rect.height * k));
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.fov = camera.aspect < 1 ? 58 : 48;
    camera.updateProjectionMatrix();
    composer.setSize(W, H, samples);
    bubbles.mat.uniforms.uScale.value = H * 0.5;
    want.dist = clamp(want.dist, 2.2, 13);
  }
  const ro = new ResizeObserver(() => applySize());
  ro.observe(canvas.parentElement || canvas);
  applySize();
  want.dist = view.dist = fitDist();

  /* ── 색 바꾸기 ── */
  function paint(mat, base) { mat.roughness = clamp(base * (mat.userData.roughK ?? 1), 0.03, 0.92); }
  function applyPreset(nextKey) {
    if (!PRESETS[nextKey]) return;
    presetKey = nextKey; preset = PRESETS[nextKey];
    const m = sh.mats;
    m.metal.color.set(preset.metal); paint(m.metal, preset.metalRough);
    m.dark.color.set(preset.frame);  paint(m.dark, preset.frameRough);
    m.glow.emissive.set(preset.core);
    m.band.emissive.set(preset.core);
    m.eyeMat.emissive.set(preset.eye);
    for (const f of [m.finMat, m.pecMat]) {
      f.color.set(preset.glass);
      f.emissive.set(preset.emissive);
      f.iridescenceThicknessRange = preset.iridRange.slice();
      f.needsUpdate = true;
    }
    sh.headLight.color.set(preset.core);
    backdrop.mat.uniforms.uTop.value.set(preset.bgTop);
    backdrop.mat.uniforms.uBot.value.set(preset.bgBot);
    backdrop.mat.uniforms.uHalo.value.set(preset.halo);
    halo.material.color.set(preset.halo);
    for (const s of shafts.mats) s.color.set(preset.halo).lerp(new THREE.Color(0xffffff), 0.35);
    bubbles.mat.uniforms.uColor.value.set(preset.mote);
    renderer.setClearColor(preset.bgBot, 1);
    loadEnv(preset);
    if (opts.onPreset) opts.onPreset(presetKey);
  }

  function setQuality(q) {
    state.quality = q;
    scale = q === 'low' ? 0.68 : q === 'high' ? 1 : scale;
    samples = q === 'low' ? 0 : (isMobile ? 0 : 4);
    applySize();
  }

  /* ── 루프 ── */
  let last = performance.now() / 1000, raf = 0, t = 0;
  let fps = 60, frames = 0, acc = 0, tri = 0, calls = 0, autoDropped = false, shotWanted = null;
  const camDir = new THREE.Vector3();

  function draw(real) {
    renderer.info.reset();

    if (state.spin && !dragging && !state.paused) want.theta += real * 0.11;
    const k = Math.min(1, real * 8);
    view.theta += (want.theta - view.theta) * k;
    view.phi += (want.phi - view.phi) * k;
    view.dist += (want.dist - view.dist) * k;
    const sp = Math.sin(view.phi);
    camera.position.set(
      focus.x + view.dist * sp * Math.sin(view.theta),
      focus.y + view.dist * Math.cos(view.phi),
      focus.z + view.dist * sp * Math.cos(view.theta));
    camera.lookAt(focus);
    camera.getWorldDirection(camDir);

    poseSeahorse(sh, t, state);

    halo.position.copy(focus).addScaledVector(camDir, 1.8);
    halo.quaternion.copy(camera.quaternion);
    halo.visible = state.bloom > 0.02;

    shafts.group.visible = state.shafts;
    shafts.group.rotation.y = Math.atan2(camera.position.x - focus.x, camera.position.z - focus.z);
    if (state.shafts) {
      for (const m of shafts.group.children) {
        m.position.x = m.userData.x0 + Math.sin(t * 0.18 + m.userData.phase) * 0.28;
        m.material.opacity = m.userData.op * (0.72 + 0.28 * Math.sin(t * 0.5 + m.userData.phase * 1.7));
      }
    }
    bubbles.pts.visible = state.bubbles;
    bubbles.mat.uniforms.uTime.value = t;

    composer.render(scene, camera, {
      bloom: 0.92 * state.bloom, threshold: 1.16, exposure: preset.exposure, grain: 0.012, time: t,
    });

    if (shotWanted) { const cb = shotWanted; shotWanted = null; try { cb(canvas.toDataURL('image/png')); } catch (e) { cb(null); } }
    tri = renderer.info.render.triangles; calls = renderer.info.render.calls;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    const real = Math.min(0.05, now - last);
    last = now; acc += real; frames++;
    if (!state.paused) t += real * state.speed;
    draw(real);
    if (acc >= 1) {
      fps = frames / acc; frames = 0; acc = 0;
      if (state.quality === 'auto' && !autoDropped && fps < 34) { autoDropped = true; scale = 0.72; samples = 0; applySize(); }
    }
  }
  const onVis = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now() / 1000; raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  return {
    state,
    presets: PRESETS,
    get preset() { return presetKey; },
    setPreset: applyPreset,
    setQuality,
    set(k, v) { state[k] = v; },
    resetView() { want.theta = 1.12; want.phi = 1.3; want.dist = fitDist(); },
    setView(theta, phi, dist, instant = false) {
      want.theta = theta;
      want.phi = clamp(phi, 0.3, Math.PI - 0.3);
      want.dist = clamp(dist ?? fitDist(), 2.2, 13);
      if (instant) { view.theta = want.theta; view.phi = want.phi; view.dist = want.dist; }
    },
    setTime(v) { t = v; },                     // 사진 찍을 때 순간을 고정한다
    snapshot() { return new Promise((res) => { shotWanted = res; }); },
    info() {
      return { fps: Math.round(fps), triangles: tri, calls, size: `${W}×${H}`, three: THREE.REVISION, preset: presetKey };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      composer.dispose();
      if (envRT) envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
