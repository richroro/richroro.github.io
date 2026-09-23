/* ══════════════════════════════════════════════════════════════════════════
   키네신 · Kinesin-1

   나비와 해마는 지어낸 기계였다. 키네신은 진짜로 있는 기계다.
   세포 안에서 미세소관(microtubule) 위를 두 다리로 걸어 다니며 짐을 나른다.
   한 걸음이 정확히 8 나노미터고, 그 한 걸음마다 ATP 를 딱 한 개 쓴다.

   ── 이 페이지가 정직하게 밝혀 둘 것 ──
   형상은 원자 좌표(PDB)가 아니라 기구를 보여 주려고 깎은 모식도다.
   반면 아래 FACTS 의 숫자는 전부 실제로 측정된 값이고, 화면의 눈금·걸음
   수·거리·ATP 개수는 모두 이 값들에서 나온다. 코드와 설명이 어긋날 수 없게
   숫자는 여기 한 곳에만 적는다.

   좌표 약속: 미세소관은 +Z 로 뻗고, 키네신은 +Z 로 걷는다. 바깥이 +Y.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  THREE, TAU, clamp, lerp, smooth, rng, canvas2d,
  makeMetalRoughnessMap, makeSpriteTexture, makeHaloTexture,
  buildEnvTexture, buildBackdrop, buildHalo, buildMotes, Composer,
} from '../../assets/scene-kit.js';

/* ── 측정된 값들 (kinesin-1, 시험관 안) ────────────────────────────────────
   단위는 전부 나노미터. 출처는 README 에 적어 둔다. */
export const FACTS = {
  step: 8,              // 한 걸음 — 튜불린 이합체 한 칸만큼
  swing: 16,            // 뒷머리가 앞머리를 지나쳐 가는 거리(걸음의 두 배)
  atpPerStep: 1,        // 걸음당 ATP 한 개
  protofilaments: 13,   // 미세소관을 이루는 원섬유 수
  tubeOuter: 25,        // 미세소관 바깥지름
  tubeInner: 15,        // 안쪽 빈 공간(내강)의 지름
  monomer: 4,           // 튜불린 낱개(α 또는 β) 길이
  latticeRise: 12 / 13, // 이웃 원섬유끼리 어긋난 높이 — 3-start 나선이라 12/13 nm
  stall: 5,             // 멈춰 세우는 데 드는 힘(pN) — 광집게로 잰 값
  speed: 800,           // 초당 가는 거리 — 초당 100걸음쯤
  runLength: 1000,      // 떨어지기 전까지 가는 거리 ≈ 100걸음
  bodyLength: 80,       // 머리부터 꼬리까지
};

const NM = 0.08;                    // 장면 단위 하나 = 12.5 nm
const nm = (v) => v * NM;

export const PRESETS = {
  lab: {
    label: '실험실',
    tubeA: 0x6f8fb0, tubeB: 0x35546f, tubeRough: 0.62,   // α · β 튜불린
    head: 0xf0c07a, head2: 0xdd8a52, headRough: 0.3,      // 운동 머리 둘(색을 달리해 구분)
    coil: 0xd8dee8, coilRough: 0.24,                      // 목·자루의 코일드코일
    cargo: 0x9fd8e0, iridRange: [180, 900],
    atp: 0x8ff4ff, adp: 0xff9a6a,
    bgTop: 0x081827, bgBot: 0x02050a, halo: 0x17466a, mote: 0xbfe6ff,
    exposure: 1.16,
    env: [
      { dir: [-0.5, 0.75, 0.42], ang: 0.4, color: [1.0, 0.96, 0.88], power: 9 },
      { dir: [0.78, 0.18, -0.6], ang: 0.3, color: [0.38, 0.76, 1.0], power: 7 },
      { dir: [0.15, -0.6, 0.78], ang: 0.55, color: [0.4, 0.5, 0.62], power: 2 },
      { dir: [0.05, 0.98, 0.15], ang: 0.16, color: [1.0, 1.0, 1.0], power: 5.5 },
    ],
    sky: [0.05, 0.09, 0.14], ground: [0.008, 0.014, 0.022],
  },
  cell: {
    label: '세포질',
    tubeA: 0xc9a06a, tubeB: 0x7b4f32, tubeRough: 0.66,
    head: 0x6fe3c8, head2: 0x46a8d8, headRough: 0.28,
    coil: 0xe8d6bc, coilRough: 0.26,
    cargo: 0xffc9a8, iridRange: [140, 780],
    atp: 0x9dffe4, adp: 0xffd08a,
    bgTop: 0x1a1008, bgBot: 0x070402, halo: 0x5a3a18, mote: 0xffe0bc,
    exposure: 1.1,
    env: [
      { dir: [-0.52, 0.7, 0.5], ang: 0.42, color: [1.0, 0.9, 0.76], power: 8.5 },
      { dir: [0.74, 0.22, -0.62], ang: 0.32, color: [1.0, 0.72, 0.45], power: 6 },
      { dir: [0.2, -0.5, 0.82], ang: 0.55, color: [0.5, 0.36, 0.24], power: 2 },
      { dir: [-0.05, 0.99, 0.1], ang: 0.16, color: [1.0, 0.97, 0.92], power: 5 },
    ],
    sky: [0.1, 0.07, 0.04], ground: [0.02, 0.013, 0.008],
  },
  mono: {
    label: '단색',
    tubeA: 0xb8c2cc, tubeB: 0x5c666f, tubeRough: 0.56,
    head: 0xe8eef4, head2: 0x9fb8cc, headRough: 0.2,
    coil: 0x9aa4ae, coilRough: 0.3,
    cargo: 0xa8d4ff, iridRange: [220, 1000],
    atp: 0x7fe8ff, adp: 0xa0b4c4,
    bgTop: 0x0b1118, bgBot: 0x020406, halo: 0x1d3a4e, mote: 0xcfe2f0,
    exposure: 1.12,
    env: [
      { dir: [-0.45, 0.76, 0.48], ang: 0.38, color: [0.9, 0.95, 1.0], power: 9.5 },
      { dir: [0.8, 0.14, -0.58], ang: 0.28, color: [0.4, 0.72, 1.0], power: 7 },
      { dir: [-0.12, -0.56, -0.82], ang: 0.6, color: [0.26, 0.36, 0.5], power: 2 },
      { dir: [0.1, 0.97, -0.2], ang: 0.14, color: [1.0, 1.0, 1.0], power: 6 },
    ],
    sky: [0.05, 0.08, 0.12], ground: [0.006, 0.01, 0.016],
  },
};

/* 공을 단백질 덩어리처럼 울퉁불퉁하게 만든다. 혹 몇 개를 정해 두고
   꼭짓점을 그 방향으로 밀거나 당긴다. */
function lumpy(geo, seed, amp, lumps = 7) {
  const rand = rng(seed);
  const dirs = [];
  for (let i = 0; i < lumps; i++) {
    dirs.push({
      d: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
      k: (rand() * 2 - 1) * amp,
    });
  }
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length() || 1;
    let scale = 1;
    for (const l of dirs) {
      const c = (v.x * l.d.x + v.y * l.d.y + v.z * l.d.z) / len;
      if (c > 0) scale += l.k * c * c * c;
    }
    pos.setXYZ(i, v.x * scale, v.y * scale, v.z * scale);
  }
  pos.needsUpdate = true;
  // 법선은 중심에서 꼭짓점으로 향하는 방향으로 준다. 면마다 계산하면 각이 지고,
  // 구면 좌표로 계산하면 이음매에서 밝기가 튄다. 볼록한 덩어리라 이걸로 충분하다.
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
  return geo;
}

/* ── 질감 ── */
function proteinMap(seed) {         // 단백질 표면 — 우둘투둘한 덩어리
  const [c, x] = canvas2d(256, 256);
  const rand = rng(seed);
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const px = rand() * 256, py = rand() * 256, r = 3 + rand() * 16;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const v = Math.floor(70 + rand() * 130);
    g.addColorStop(0, `rgba(${v},${v},${v},0.55)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ══ 미세소관 ══════════════════════════════════════════════════════════════
   원섬유 13 가닥이 관을 이룬다. 가닥마다 α·β 튜불린이 4 nm 씩 번갈아 쌓이고,
   이웃 가닥은 12/13 nm 씩 어긋나 있다(3-start 나선). 한 바퀴 돌면 12 nm,
   즉 낱개 세 칸이 밀리는데 3 은 홀수라 α 가 β 와 만나는 자리가 한 줄 생긴다.
   그 줄이 이음매(seam)다 — 격자를 그대로 깔면 저절로 나온다.
   ═════════════════════════════════════════════════════════════════════════ */

const PF = FACTS.protofilaments;
const R_WALL = (FACTS.tubeOuter + FACTS.tubeInner) / 4;   // 벽 두께의 한가운데 = 10 nm
const MONO = FACTS.monomer;
const MONO_COUNT = 104;                                   // 관의 길이 = 104 × 4 nm ≈ 416 nm
const SITE0_K = 2 * Math.floor(MONO_COUNT / 4) + 1;       // 걷는 자리를 관의 한가운데로(홀수 = β)
const SITE_Z = (n) => (SITE0_K + 2 * n) * MONO;           // n 번째 발판(β)의 z, nm

function buildMicrotubule(preset, roughMap, detail) {
  // α 와 β 는 서로 다른 단백질이다. 덩어리를 따로 깎고 재질도 따로 준다.
  const HALF = MONO_COUNT >> 1;
  const shell = (rough) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.04, roughness: rough,
      roughnessMap: roughMap, envMapIntensity: 0.5,
    });
    m.userData.roughK = 2;                  // 거칠기 지도의 평균이 0.5라 값이 절반으로 준다
    return m;
  };
  const matA = shell(preset.tubeRough), matB = shell(preset.tubeRough * 0.92);
  const geoA = lumpy(new THREE.IcosahedronGeometry(nm(2.58), detail), 11, 0.12);
  geoA.scale(1.02, 0.98, 0.8);
  const geoB = lumpy(new THREE.IcosahedronGeometry(nm(2.66), detail), 31, 0.17);
  geoB.scale(0.98, 1.03, 0.78);

  const group = new THREE.Group();
  const meshA = new THREE.InstancedMesh(geoA, matA, PF * HALF);
  const meshB = new THREE.InstancedMesh(geoB, matB, PF * HALF);
  for (const mm of [meshA, meshB]) {
    mm.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mm.frustumCulled = false;
    group.add(mm);
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
  const rand = rng(515);
  const index = (p, d) => p * HALF + d;
  for (let p = 0; p < PF; p++) {
    const th = p * TAU / PF;                // 0 번 가닥이 관의 꼭대기(+Y)
    for (let d = 0; d < HALF; d++) {
      for (let half = 0; half < 2; half++) {
        const k = d * 2 + half;             // 짝수 = α, 홀수 = β
        pos.set(-Math.sin(th) * nm(R_WALL), Math.cos(th) * nm(R_WALL),
                nm(k * MONO + p * FACTS.latticeRise));
        // 낱개를 바깥으로 세우고, 조금씩 비틀어 자로 잰 듯한 느낌을 없앤다
        e.set((rand() - 0.5) * 0.22, (rand() - 0.5) * 0.22, -th + (rand() - 0.5) * 0.18);
        q.setFromEuler(e);
        m4.compose(pos, q, scl);
        (half ? meshB : meshA).setMatrixAt(index(p, d), m4);
      }
    }
  }
  meshA.instanceMatrix.needsUpdate = true;
  meshB.instanceMatrix.needsUpdate = true;
  group.userData = { index, meshA, meshB, matA, matB, HALF, z0: 0 };
  return group;
}

/* 색칠은 따로 — α·β 구분과 '발판 표시' 를 껐다 켤 수 있게 한다.
   발판은 0 번 가닥의 β 낱개들, 즉 키네신이 실제로 딛는 자리다. */
function paintMicrotubule(group, preset, showSites) {
  const { index, meshA, meshB, HALF } = group.userData;
  const a = new THREE.Color(preset.tubeA), b = new THREE.Color(preset.tubeB);
  const lit = new THREE.Color(preset.tubeA).lerp(new THREE.Color(0xffffff), 0.62);
  const c = new THREE.Color();
  const rand = rng(303);
  for (let p = 0; p < PF; p++) {
    for (let d = 0; d < HALF; d++) {
      const j = index(p, d), jitter = 0.9 + rand() * 0.2;
      c.copy(a).multiplyScalar(jitter);
      meshA.setColorAt(j, c);
      c.copy(showSites && p === 0 ? lit : b).multiplyScalar(jitter);
      meshB.setColorAt(j, c);
    }
  }
  meshA.instanceColor.needsUpdate = true;
  meshB.instanceColor.needsUpdate = true;
}

/* ── 눈금 — 발판 두 칸 사이가 곧 한 걸음이라는 걸 화면에 대 놓고 보인다 ── */
function makeLabel(text, color) {
  const [c, x] = canvas2d(256, 96);
  x.clearRect(0, 0, 256, 96);
  x.font = '700 54px "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.85)'; x.shadowBlur = 14;
  x.fillStyle = color;
  x.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildScaleBar(preset) {
  const g = new THREE.Group();
  g.rotation.z = -1.02;                     // 키네신이 걷는 꼭대기를 비켜 관의 옆구리에 댄다
  const line = new THREE.MeshBasicMaterial({ color: new THREE.Color(preset.mote), transparent: true, opacity: 1, fog: false });
  const y = FACTS.tubeOuter / 2 + 2.4;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(nm(0.4), nm(0.4), nm(FACTS.step)), line);
  bar.position.y = nm(y);
  g.add(bar);
  for (const sgn of [-0.5, 0.5]) {          // 양 끝을 관 표면까지 내려 긋는다
    const post = new THREE.Mesh(new THREE.BoxGeometry(nm(0.4), nm(3.6), nm(0.4)), line);
    post.position.set(0, nm(y - 1.8), nm(sgn * FACTS.step));
    g.add(post);
  }
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLabel('8 nm', '#ffffff'), transparent: true, opacity: 0.88, depthTest: false, fog: false,
  }));
  label.scale.set(nm(9.5), nm(3.56), 1);
  label.position.y = nm(y + 3.1);
  label.renderOrder = 6;
  g.add(label);
  return { g, line, label };
}

/* 머리 밑에 까는 옅은 그림자 — 붙어 있다는 게 보이게 한다 */
function contactShadow() {
  const [c, x] = canvas2d(128, 128);
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(nm(11), nm(15)).rotateX(-Math.PI / 2), mat);
  mesh.renderOrder = 1;
  return mesh;
}

/* ══ 키네신 ════════════════════════════════════════════════════════════════
   머리 둘 · 목줄(neck linker) 둘 · 코일드코일 자루 하나 · 짐 하나.
   머리는 미세소관에 붙고, 목줄은 머리와 자루를 잇는 짧고 무른 끈이고,
   자루는 두 가닥이 서로 꼬인 밧줄이다. 짐은 자루 끝에 매달려 끌려간다.
   ═════════════════════════════════════════════════════════════════════════ */

const Y_BIND = FACTS.tubeOuter / 2 + 1.35;      // 머리 중심이 앉는 높이(관 축에서, nm)
const STALK_LEN = 45;                           // 자루 길이
const TAIL_LEN = 12;                            // 짐에 붙는 꼬리
const COIL_PITCH = 14;                          // 코일드코일이 한 바퀴 꼬이는 길이
const CARGO_R = 20;                             // 짐(소포)의 반지름

/* 축(+Y)을 따라 올라가며 꼬이는 한 가닥 */
function helixTube(len, coilR, phase, tubeR) {
  const pts = [];
  const n = Math.max(12, Math.round(len * 1.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = t * len, a = phase + (y / COIL_PITCH) * TAU;
    pts.push(new THREE.Vector3(nm(Math.cos(a) * coilR), nm(y), nm(Math.sin(a) * coilR)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, nm(tubeR), 6, false);
}

function buildHead(mats, which, dark, lampMat, footKey) {
  const g = new THREE.Group();
  // 몸통 — 앞이 두껍고 뒤로 좁아지는 쐐기
  const core = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(nm(2.62), 4), 23, 0.26, 11), mats[which]);
  core.scale.set(0.95, 0.86, 1.42);              // 4.9 × 4.5 × 7.4 nm 쯤
  g.add(core);
  // 옆으로 솟은 덩어리 — 좌우 대칭을 깨야 어느 쪽이 앞인지 보인다
  const lobe = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(nm(1.45), 3), 47, 0.22), mats[which]);
  lobe.position.set(nm(1.45), nm(0.45), nm(-1.1));
  lobe.scale.set(1, 0.85, 1.25);
  g.add(lobe);
  // 관에 닿는 바닥은 따로 붙이지 않는다. 어두운 판을 얹으면 입처럼 보인다.
  // 붙어 있다는 느낌은 밑에 까는 그림자가 낸다.
  // 뉴클레오타이드 주머니 — 윗면에 팬 자리와 그 안에 든 불. 불빛이 곧 이 머리의 상태다.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(nm(0.95), nm(0.26), 6, 16), mats[dark]);
  rim.position.set(nm(0.95), nm(1.95), nm(0.9));
  rim.rotation.set(1.25, 0.5, 0);
  g.add(rim);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(nm(0.62), 12, 9), lampMat);
  lamp.position.copy(rim.position);
  g.add(lamp);
  const slot = new THREE.Object3D();             // ATP 가 도착할 자리
  slot.position.copy(rim.position);
  g.add(slot);
  // 목줄이 나오는 뒤쪽 꼭지, 그리고 목줄이 달라붙는 앞쪽 골
  const neck = new THREE.Object3D();
  neck.position.set(0, nm(1.15), nm(-3.05));
  g.add(neck);
  const dockPt = new THREE.Object3D();
  dockPt.position.set(nm(-0.5), nm(2.15), nm(2.1));
  g.add(dockPt);
  return { g, slot, neck, dockPt, lamp };
}

export function buildKinesin(preset, roughMap) {
  const headMat = (c) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0.18, roughness: preset.headRough * 2, roughnessMap: roughMap,
    clearcoat: 0.55, clearcoatRoughness: 0.35, envMapIntensity: 1.2,
  });
  const darkMat = (c) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(c).multiplyScalar(0.4), metalness: 0.3, roughness: 0.5, envMapIntensity: 0.9,
  });
  const footMat = (c) => new THREE.MeshStandardMaterial({   // 관에 닿는 바닥 — 구멍이 아니라 그늘로 보이게
    color: new THREE.Color(c).multiplyScalar(0.62), metalness: 0.2, roughness: 0.62, envMapIntensity: 0.8,
  });
  const lampMat = () => new THREE.MeshStandardMaterial({   // 주머니 안의 불 — 상태에 따라 색이 바뀐다
    color: 0x05080c, emissive: new THREE.Color(0x000000), emissiveIntensity: 1, roughness: 0.32, metalness: 0.1,
  });
  const mats = {
    head: headMat(preset.head), head2: headMat(preset.head2),
    headDark: darkMat(preset.head), head2Dark: darkMat(preset.head2),
    headFoot: footMat(preset.head), head2Foot: footMat(preset.head2),
    lamp: [lampMat(), lampMat()],
    coil: new THREE.MeshPhysicalMaterial({
      color: preset.coil, metalness: 0.55, roughness: preset.coilRough * 2, roughnessMap: roughMap,
      clearcoat: 0.4, envMapIntensity: 1.25,
    }),
    cargo: new THREE.MeshPhysicalMaterial({
      color: preset.cargo, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false,
      metalness: 0.2, roughness: 0.16,
      iridescence: 1, iridescenceIOR: 2.2, iridescenceThicknessRange: preset.iridRange.slice(),
      clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.8,
    }),
    atp: new THREE.MeshStandardMaterial({
      color: 0x060a0e, emissive: new THREE.Color(preset.atp), emissiveIntensity: 1.5,
      roughness: 0.4, metalness: 0.1,
    }),
    adp: new THREE.MeshStandardMaterial({
      color: 0x0a0806, emissive: new THREE.Color(preset.adp), emissiveIntensity: 1.1,
      roughness: 0.4, metalness: 0.1,
    }),
  };
  mats.head.userData.roughK = 2;
  mats.head2.userData.roughK = 2;
  mats.coil.userData.roughK = 2;

  const root = new THREE.Group();
  const heads = [buildHead(mats, 'head', 'headDark', mats.lamp[0], 'headFoot'),
                 buildHead(mats, 'head2', 'head2Dark', mats.lamp[1], 'head2Foot')];
  for (const h of heads) root.add(h.g);

  /* 자루 — 코일드코일 두 가닥이 서로 꼬인다 */
  const stalk = new THREE.Group();
  root.add(stalk);
  const strandGeo = [helixTube(STALK_LEN, 0.85, 0, 0.42), helixTube(STALK_LEN, 0.85, Math.PI, 0.42)];
  for (const sg of strandGeo) stalk.add(new THREE.Mesh(sg, mats.coil));
  const neckKnob = new THREE.Mesh(new THREE.SphereGeometry(nm(1.5), 12, 9), mats.coil);
  neckKnob.scale.set(1.3, 0.8, 1.3);
  stalk.add(neckKnob);                           // 두 목줄이 모이는 자리

  /* 꼬리와 짐 */
  const tail = new THREE.Group();
  tail.position.y = nm(STALK_LEN);
  stalk.add(tail);
  const tailGeo = helixTube(TAIL_LEN, 0.5, 0.6, 0.55);
  tail.add(new THREE.Mesh(tailGeo, mats.coil));
  const cargo = new THREE.Group();
  cargo.position.y = nm(TAIL_LEN + CARGO_R * 0.82);
  tail.add(cargo);
  const vesicle = new THREE.Mesh(new THREE.SphereGeometry(nm(CARGO_R), 40, 28), mats.cargo);
  vesicle.renderOrder = 2;
  cargo.add(vesicle);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(nm(CARGO_R * 0.94), 32, 22), mats.cargo);
  inner.renderOrder = 2;                         // 두 겹이라 실루엣에서 막 두께가 보인다
  cargo.add(inner);
  const rand = rng(51);
  for (let i = 0; i < 14; i++) {                 // 막에 박힌 단백질 혹
    const a = rand() * TAU, b = Math.acos(2 * rand() - 1);
    const bump = new THREE.Mesh(new THREE.SphereGeometry(nm(1.4 + rand() * 1.2), 10, 7), mats.coil);
    bump.position.set(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(nm(CARGO_R));
    cargo.add(bump);
  }

  /* 목줄 — 머리와 자루를 잇는 짧고 무른 끈. 매 프레임 다시 놓는다. */
  const BEADS = 7;
  const links = heads.map(() => {
    const beads = [];
    for (let i = 0; i < BEADS; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(nm(0.62 - i * 0.03), 8, 6), mats.coil);
      root.add(b);
      beads.push(b);
    }
    return beads;
  });

  /* ATP 알갱이 — 몇 개만 만들어 돌려 쓴다 */
  const atpGeo = new THREE.TetrahedronGeometry(nm(1.15), 0);
  const pool = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(atpGeo, mats.atp);
    m.visible = false;
    root.add(m);
    pool.push({ mesh: m, live: false, t: 0, kind: 'atp' });
  }

  const shadows = [contactShadow(), contactShadow()];
  for (const sh of shadows) root.add(sh);
  const scale = buildScaleBar(preset);
  root.add(scale.g);

  const nucColors = {
    atp: new THREE.Color(preset.atp), adp: new THREE.Color(preset.adp), empty: new THREE.Color(0x0a1018),
  };
  return { root, heads, stalk, tail, cargo, vesicle, links, pool, mats, BEADS, shadows, scale, nucColors };
}

/* ══ 걸음 ══════════════════════════════════════════════════════════════════
   손잡이 넘기기(hand-over-hand). 뒤에 있던 머리가 떨어져 앞머리를 옆으로
   지나쳐 두 칸(16 nm) 앞에 내려앉는다. 두 머리의 한가운데는 그동안 한 칸
   (8 nm) 나아간다 — 이게 한 걸음이고, 여기에 ATP 한 개가 든다.
   머리는 한 걸음마다 180° 돌아간다. 자벌레처럼 기는 게 아니라는 증거였다.
   ═════════════════════════════════════════════════════════════════════════ */

export const NUC = { EMPTY: 0, ATP: 1, ADP: 2 };

/* 머리가 무엇을 들고 있는지는 걸음의 진행도에서 그대로 나온다.
   사건을 받아 적지 않고 매번 계산하면 프레임을 건너뛰어도 어긋나지 않는다.
     앞머리(붙어 있는 쪽) : 빈 자리 → ATP 가 붙음 → 걸음 끝에 쪼개져 ADP
     뒷머리(움직이는 쪽)  : ADP 를 들고 떠났다가 내려앉으며 버린다
   걸음이 끝나 역할이 바뀌면 그대로 이어진다 — 앞머리의 ADP 가 다음 걸음의 뒷머리다. */
export function nucOf(g, i) {
  if (i === g.moving) return g.u < 0.9 ? NUC.ADP : NUC.EMPTY;
  return g.u < 0.05 ? NUC.EMPTY : (g.u < 0.97 ? NUC.ATP : NUC.ADP);
}

export function phaseOf(g) {
  if (g.u < 0.05) return '두 머리가 다 붙어 있다';
  if (g.u < 0.3) return '앞머리에 ATP 가 붙고, 목줄이 달라붙는다';
  if (g.u < 0.88) return '뒷머리가 떨어져 앞으로 날아간다';
  return '새 발판에 내려앉고 ADP 를 버린다';
}

export function createGait() {
  return { site: [0, 1], moving: 0, u: 0, lastU: 0, steps: 0, side: 1, yaw0: [0, 0], rate: 1 };
}

export function advanceGait(g, du, rand) {
  g.lastU = g.u;
  g.u += du * g.rate;
  while (g.u >= 1) {
    g.u -= 1;
    g.lastU = 0;
    g.site[g.moving] += 2;                 // 두 칸 앞으로 내려앉고
    g.site[0] -= 1; g.site[1] -= 1;        // 눈금을 한 칸 당겨 숫자를 작게 유지한다
    g.yaw0[g.moving] += Math.PI;
    g.moving = 1 - g.moving;               // 다음엔 반대쪽 머리가 움직인다
    g.side = -g.side;
    g.steps++;
    g.rate = 0.84 + (rand ? rand() : 0.5) * 0.32;   // 걸음마다 속도가 조금씩 다르다
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

function bezier(out, p0, p1, p2, t) {
  const s = 1 - t;
  return out.set(
    s * s * p0.x + 2 * s * t * p1.x + t * t * p2.x,
    s * s * p0.y + 2 * s * t * p1.y + t * t * p2.y,
    s * s * p0.z + 2 * s * t * p1.z + t * t * p2.z);
}

/* 한 프레임의 자세를 잡는다. 돌려주는 comZ 는 두 머리의 한가운데(nm, 관 좌표). */
export function poseKinesin(k, g, z0, t) {
  const u = g.u;
  const ez = smooth(0.2, 0.93, u);                        // 목줄이 달라붙은 뒤에 날아간다
  const lift = Math.sin(Math.PI * clamp((u - 0.17) / 0.8, 0, 1));
  const dock = smooth(0.07, 0.28, u);                     // 앞머리 목줄이 달라붙는 정도
  const mv = g.moving, fx = 1 - mv;
  const zFix = SITE_Z(g.site[fx]);
  const zFrom = SITE_Z(g.site[mv]), zMov = zFrom + FACTS.swing * ez;

  const bound = k.heads[fx].g;
  bound.position.set(0, nm(Y_BIND), nm(z0 + zFix));
  bound.rotation.set(0.04 * Math.sin(t * 2.1) - 0.06 * dock, g.yaw0[fx], 0);

  const free = k.heads[mv].g;
  free.position.set(nm(g.side * 6.8 * lift), nm(Y_BIND + 7.8 * lift), nm(z0 + zMov));
  free.rotation.set(-0.55 * lift, g.yaw0[mv] + Math.PI * ez, g.side * 0.5 * lift);

  const comZ = (zMov + zFix) / 2;
  const comX = g.side * 2.1 * lift;

  /* 자루는 두 머리의 한가운데에서 뒤로 누워 짐을 끌고 간다.
     목줄이 달라붙는 순간 앞으로 한 번 끌린다 — 걸음을 만드는 건 이 당김이다. */
  k.stalk.position.set(nm(comX), nm(Y_BIND + 4.2), nm(z0 + comZ + 1.7 * dock));
  k.stalk.rotation.set(-0.55 + 0.05 * Math.sin(t * 1.3) + 0.1 * dock,
                       g.side * 0.12 * lift + 0.08 * Math.sin(t * 0.7), 0);
  k.cargo.rotation.set(0.12 * Math.sin(t * 0.5), t * 0.06, 0.1 * Math.sin(t * 0.43 + 1.1));
  k.cargo.position.set(                          // 붐비는 세포질에 밀려 조금씩 떨린다
    nm(1.2 * Math.sin(t * 1.7) + 0.7 * Math.sin(t * 4.3 + 2.1)),
    nm(TAIL_LEN + CARGO_R * 0.82 + 0.9 * Math.sin(t * 1.3 + 0.7)),
    nm(1.1 * Math.cos(t * 1.9 + 1.4)));

  /* 주머니의 불 — 이 머리가 무엇을 들고 있는지 */
  for (let i = 0; i < 2; i++) {
    const st = nucOf(g, i), m = k.mats.lamp[i];
    if (st === NUC.ATP) {
      m.emissive.copy(k.nucColors.atp);
      m.emissiveIntensity = 0.85 + 0.25 * Math.sin(t * 7);
    } else if (st === NUC.ADP) {
      m.emissive.copy(k.nucColors.adp);
      m.emissiveIntensity = 0.32;
    } else {
      m.emissive.copy(k.nucColors.empty);
      m.emissiveIntensity = 0.05;
    }
  }

  /* 목줄 — 붙어 있는 쪽은 ATP 가 붙으면 머리 앞쪽 골에 달라붙고, 뜬 쪽은 늘어진다 */
  k.root.updateMatrixWorld(true);
  const knob = _c.set(0, 0, 0);
  k.stalk.localToWorld(knob); k.root.worldToLocal(knob);
  for (let i = 0; i < 2; i++) {
    const beads = k.links[i];
    k.heads[i].neck.getWorldPosition(_a); k.root.worldToLocal(_a);
    k.heads[i].dockPt.getWorldPosition(_d); k.root.worldToLocal(_d);
    const dk = i === fx ? dock : 0;
    _b.lerpVectors(_a, knob, 0.5);
    _b.y += nm(2.9); _b.z -= nm(1.7);                     // 느슨할 때는 위로 불룩하다
    _b.lerp(_d, dk);                                      // 달라붙으면 골을 따라 앞으로 눕는다
    for (let j = 0; j < beads.length; j++) {
      bezier(beads[j].position, _a, _b, knob, j / (beads.length - 1));
    }
  }

  /* 머리 밑 그림자 — 붙어 있을 때만 짙다 */
  for (let i = 0; i < 2; i++) {
    const h = k.heads[i].g, sh = k.shadows[i];
    const up = clamp(1 - (h.position.y / NM - Y_BIND) / 5.5, 0, 1);
    sh.position.set(h.position.x, nm(FACTS.tubeOuter / 2 + 0.5), h.position.z);
    sh.material.opacity = 0.5 * up * up;
    sh.visible = up > 0.03;
  }

  /* 눈금은 지나온 발판 두 칸에 댄다 */
  if (k.scale) k.scale.g.position.z = nm(z0 + SITE_Z(g.site[fx]) - FACTS.step * 1.8);
  return comZ;
}

/* ── ATP 알갱이 ── */
function spawn(k, kind, from, to, dur, rand) {
  const slot = k.pool.find((p) => !p.live);
  if (!slot) return;
  slot.live = true; slot.t = 0; slot.dur = dur; slot.kind = kind;
  slot.p0 = from.clone(); slot.p1 = to.clone();
  slot.arc = (rand() - 0.5) * nm(7);
  slot.spin = (rand() - 0.5) * 6;
  slot.mesh.material = kind === 'atp' ? k.mats.atp : k.mats.adp;
  slot.mesh.scale.setScalar(kind === 'atp' ? 1 : 0.62);
  slot.mesh.visible = true;
}

export function updateParticles(k, dt) {
  for (const p of k.pool) {
    if (!p.live) continue;
    p.t += dt / p.dur;
    if (p.t >= 1) { p.live = false; p.mesh.visible = false; continue; }
    const e = p.t * p.t * (3 - 2 * p.t);
    p.mesh.position.lerpVectors(p.p0, p.p1, e);
    p.mesh.position.x += p.arc * Math.sin(Math.PI * p.t);
    p.mesh.position.y += nm(3) * Math.sin(Math.PI * p.t);
    p.mesh.rotation.set(p.spin * p.t, p.spin * 1.4 * p.t, 0);
    // ATP 는 주머니에 들어가며 사라지고, ADP 는 멀어지며 사라진다
    const s = (p.kind === 'atp' ? 1 - e * 0.85 : 0.62 * (1 - e * 0.8));
    p.mesh.scale.setScalar(Math.max(0.02, s));
  }
}

/* 걸음의 어느 대목에서 무엇이 오가는지 — 한 걸음에 ATP 하나가 들어가고
   ADP 와 인산이 하나씩 나온다. */
export function stepChemistry(k, g, rand) {
  const crossed = (x) => g.lastU < x && g.u >= x;
  const away = (head) => {
    head.slot.getWorldPosition(_a); k.root.worldToLocal(_a);
    _b.copy(_a).add(_d.set(nm(18 * (rand() - 0.5)), nm(15 + rand() * 11), nm(15 * (rand() - 0.5))));
  };
  if (crossed(0.05)) {                               // 앞머리에 ATP 가 붙는다
    away(k.heads[1 - g.moving]);
    spawn(k, 'atp', _b, _a, 0.4, rand);
  }
  if (crossed(0.9)) {                                // 내려앉으며 ADP 를 버린다
    away(k.heads[g.moving]);
    spawn(k, 'adp', _a, _b, 0.65 + rand() * 0.3, rand);
  }
  if (crossed(0.97)) {                               // 앞머리가 ATP 를 쪼개고 인산을 뱉는다
    away(k.heads[1 - g.moving]);
    spawn(k, 'adp', _a, _b, 0.6 + rand() * 0.3, rand);
  }
}

/* ══ 장면 ══════════════════════════════════════════════════════════════════ */

export function createKinesin(canvas, opts = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;

  let presetKey = PRESETS[opts.preset] ? opts.preset : 'lab';
  let preset = PRESETS[presetKey];
  renderer.setClearColor(preset.bgBot, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(preset.bgBot), 0.03);   // 관의 먼 끝이 어둠에 잠기게
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 200);

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
  halo.material.opacity = 0.3;
  scene.add(halo);
  const motes = buildMotes(preset, makeSpriteTexture(), isMobile ? 220 : 420);
  scene.add(motes.pts);

  const key = new THREE.DirectionalLight(0xffeedd, 2.0); key.position.set(-2.2, 4.6, 2.6);
  const rim = new THREE.DirectionalLight(0x8fd6ff, 1.7); rim.position.set(3.2, 1.2, -3.4);
  const fill = new THREE.DirectionalLight(0x5b76a0, 0.7); fill.position.set(0.8, -2.6, 1.6);
  scene.add(key, rim, fill);

  const rough = makeMetalRoughnessMap(37);
  const protein = proteinMap(88);
  const world = new THREE.Group();          // 관과 키네신이 함께 들어간다
  scene.add(world);
  const tube = buildMicrotubule(preset, protein, isMobile ? 2 : 3);
  world.add(tube);
  const k = buildKinesin(preset, rough);
  world.add(k.root);
  const z0 = tube.userData.z0;

  const state = {
    stepsPerSec: 1.5, bloom: 1, sites: true, atp: true, cargo: true, ruler: true,
    paused: reduceMotion, spin: false, quality: 'auto',
  };
  Object.assign(state, opts.state || {});
  paintMicrotubule(tube, preset, state.sites);
  k.cargo.visible = state.cargo;
  k.tail.visible = state.cargo;
  k.scale.g.visible = state.ruler;

  const gait = createGait();
  const rand = rng(2026);
  let stepOnce = false;

  /* ── 시점 ── */
  const VIEWS = {
    walk: { theta: 1.34, phi: 1.38, dist: 5.8, focus: 5.5 },   // 기본 — 걸음과 자루가 함께
    feet: { theta: 1.22, phi: 1.42, dist: 3.7, focus: 2.4 },   // 발만 크게
    all:  { theta: 1.40, phi: 1.33, dist: 15.5, focus: 20 },   // 짐까지 분자 전체
  };
  let viewKey = VIEWS[opts.view] ? opts.view : 'walk';
  const focus = new THREE.Vector3();
  const view = { theta: 1.34, phi: 1.38, dist: 5.8, focus: 5.5 };
  const want = { ...view };
  function applyView(name, instant = false) {
    const v = VIEWS[name] || VIEWS.walk;
    viewKey = name;
    want.theta = v.theta; want.phi = v.phi; want.dist = v.dist; want.focus = v.focus;
    if (instant) Object.assign(view, want);
    if (opts.onView) opts.onView(name);
  }
  applyView(viewKey, true);

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
      if (pinch) want.dist = clamp(want.dist * (pinch / d), 1.6, 40);
      pinch = d; return;
    }
    if (!dragging) return;
    want.theta -= (e.clientX - lastX) * 0.006;
    want.phi = clamp(want.phi - (e.clientY - lastY) * 0.005, 0.25, Math.PI - 0.25);
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
  const onWheel = (e) => { e.preventDefault(); want.dist = clamp(want.dist * Math.exp(e.deltaY * 0.0011), 1.6, 40); };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  /* ── 크기 ── */
  const composer = new Composer(renderer);
  let W = 1, H = 1, samples = isMobile ? 0 : 4, scale = 1;
  const PIXEL_BUDGET = 3.0e6;
  function applySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    let s = dpr * scale;
    const px = rect.width * rect.height * s * s;
    if (px > PIXEL_BUDGET) s *= Math.sqrt(PIXEL_BUDGET / px);
    W = Math.max(2, Math.round(rect.width * s));
    H = Math.max(2, Math.round(rect.height * s));
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.fov = camera.aspect < 1 ? 58 : 46;
    camera.updateProjectionMatrix();
    composer.setSize(W, H, samples);
    motes.mat.uniforms.uScale.value = H * 0.5;
  }
  const ro = new ResizeObserver(() => applySize());
  ro.observe(canvas.parentElement || canvas);
  applySize();

  /* ── 색 바꾸기 ── */
  function paint(mat, base) { mat.roughness = clamp(base * (mat.userData.roughK ?? 1), 0.03, 0.92); }
  function applyPreset(nextKey) {
    if (!PRESETS[nextKey]) return;
    presetKey = nextKey; preset = PRESETS[nextKey];
    paint(tube.userData.matA, preset.tubeRough);
    paint(tube.userData.matB, preset.tubeRough * 0.92);
    paintMicrotubule(tube, preset, state.sites);
    const m = k.mats;
    m.head.color.set(preset.head); paint(m.head, preset.headRough);
    m.head2.color.set(preset.head2); paint(m.head2, preset.headRough);
    m.headDark.color.set(preset.head).multiplyScalar(0.4);
    m.head2Dark.color.set(preset.head2).multiplyScalar(0.4);
    m.headFoot.color.set(preset.head).multiplyScalar(0.62);
    m.head2Foot.color.set(preset.head2).multiplyScalar(0.62);
    m.coil.color.set(preset.coil); paint(m.coil, preset.coilRough);
    m.cargo.color.set(preset.cargo);
    m.cargo.iridescenceThicknessRange = preset.iridRange.slice();
    m.cargo.needsUpdate = true;
    m.atp.emissive.set(preset.atp);
    m.adp.emissive.set(preset.adp);
    k.nucColors.atp.set(preset.atp);
    k.nucColors.adp.set(preset.adp);
    k.scale.line.color.set(preset.mote);
    backdrop.mat.uniforms.uTop.value.set(preset.bgTop);
    backdrop.mat.uniforms.uBot.value.set(preset.bgBot);
    backdrop.mat.uniforms.uHalo.value.set(preset.halo);
    halo.material.color.set(preset.halo);
    motes.mat.uniforms.uColor.value.set(preset.mote);
    scene.fog.color.set(preset.bgBot);
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
    if (state.spin && !dragging) want.theta += real * 0.1;
    const kk = Math.min(1, real * 8);
    view.theta += (want.theta - view.theta) * kk;
    view.phi += (want.phi - view.phi) * kk;
    view.dist += (want.dist - view.dist) * kk;
    view.focus += (want.focus - view.focus) * kk;
    focus.set(0, nm(Y_BIND + view.focus), 0);
    const sp = Math.sin(view.phi);
    camera.position.set(
      focus.x + view.dist * sp * Math.sin(view.theta),
      focus.y + view.dist * Math.cos(view.phi),
      focus.z + view.dist * sp * Math.cos(view.theta));
    camera.lookAt(focus);
    camera.getWorldDirection(camDir);

    const comZ = poseKinesin(k, gait, z0, t);
    world.position.z = -nm(z0 + comZ);        // 걷는 자리를 화면 가운데 붙들어 둔다

    halo.position.copy(focus).addScaledVector(camDir, 2.2);
    halo.quaternion.copy(camera.quaternion);
    halo.visible = state.bloom > 0.02;
    motes.mat.uniforms.uTime.value = t;

    composer.render(scene, camera, {
      bloom: 0.85 * state.bloom, threshold: 1.1, exposure: preset.exposure, grain: 0.011, time: t,
    });
    if (shotWanted) { const cb = shotWanted; shotWanted = null; try { cb(canvas.toDataURL('image/png')); } catch (e) { cb(null); } }
    tri = renderer.info.render.triangles; calls = renderer.info.render.calls;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    const elapsed = now - last;                  // 진짜 경과 시간
    const real = Math.min(0.05, elapsed);        // 애니메이션에 먹이는 값(탭을 다시 열 때 튀지 않게)
    last = now; acc += elapsed; frames++;        // fps 는 진짜 시간으로 재야 한다
    t += real;
    if (!state.paused || stepOnce) {
      const before = gait.steps;
      advanceGait(gait, real * state.stepsPerSec, rand);
      if (state.atp) stepChemistry(k, gait, rand);
      if (stepOnce && gait.steps !== before) { stepOnce = false; state.paused = true; gait.u = 0; }
    }
    updateParticles(k, real);
    draw(real);
    if (acc >= 1) {
      fps = frames / acc; frames = 0; acc = 0;
      if (state.quality === 'auto' && !autoDropped && fps < 34) { autoDropped = true; scale = 0.72; samples = 0; applySize(); }
    }
    if (opts.onTick) opts.onTick(readout());
  }
  const onVis = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now() / 1000; raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  function readout() {
    return {
      steps: gait.steps,
      nm: (gait.steps + gait.u) * FACTS.step,
      atp: gait.steps + (gait.u >= 0.05 ? 1 : 0),   // 걸음마다 하나, 붙는 순간부터 센다
      phase: phaseOf(gait),
      slow: Math.max(1, Math.round((FACTS.speed / FACTS.step) / Math.max(0.01, state.stepsPerSec))),
    };
  }

  return {
    state, presets: PRESETS, facts: FACTS, views: VIEWS,
    get preset() { return presetKey; },
    get view() { return viewKey; },
    setPreset: applyPreset,
    setView: applyView,
    setQuality,
    set(kk, v) {
      state[kk] = v;
      if (kk === 'sites') paintMicrotubule(tube, preset, v);
      if (kk === 'cargo') { k.cargo.visible = v; k.tail.visible = v; }
      if (kk === 'ruler') k.scale.g.visible = v;
      if (kk === 'atp' && !v) for (const p of k.pool) { p.live = false; p.mesh.visible = false; }
    },
    stepOnce() { stepOnce = true; state.paused = false; },
    setPhase(v) { gait.lastU = gait.u = clamp(v, 0, 0.999); },   // 걸음의 한 대목을 고정한다
    reset() { Object.assign(gait, createGait()); },
    readout,
    setTime(v) { t = v; },
    snapshot() { return new Promise((res) => { shotWanted = res; }); },
    info() {
      return { fps: Math.round(fps), triangles: tri, calls, size: `${W}×${H}`, three: THREE.REVISION, preset: presetKey, ...readout() };
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
