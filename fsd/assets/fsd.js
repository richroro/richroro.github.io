/* ══════════════════════════════════════════════════════════════════════════
   차가 보는 것 — 자율주행 시각화를 코드로 다시 그린 장면

   실제 주행 소프트웨어의 출력이 아니다. 자율주행 화면이 보여 주는 층들
   (차선 · 물체 · 주행 가능 영역 · 계획 경로 · 점유 격자)이 각각 무엇이고
   어떻게 겹쳐 보이는지를, 에셋 없이 코드로만 다시 그린 그림이다.

   길은 +Z 로 뻗고 차는 제자리에 있다. 대신 세상이 -Z 로 흘러간다.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  THREE, TAU, clamp, lerp, smooth, rng, canvas2d,
  makeMetalRoughnessMap, makeSpriteTexture,
  buildEnvTexture, buildBackdrop, buildMotes, Composer,
} from '../../assets/scene-kit.js';

const PALETTE = {
  bgTop: 0x0a1424, bgBot: 0x02050b, halo: 0x10304f, mote: 0x9dc4ee,
  sky: [0.04, 0.065, 0.115], ground: [0.008, 0.012, 0.018], exposure: 1.14,
  env: [
    { dir: [-0.4, 0.75, 0.5], ang: 0.42, color: [0.9, 0.95, 1.0], power: 8 },
    { dir: [0.75, 0.25, -0.6], ang: 0.32, color: [0.35, 0.68, 1.0], power: 5.5 },
    { dir: [0.2, -0.5, 0.84], ang: 0.55, color: [0.3, 0.36, 0.5], power: 1.4 },
    { dir: [0.05, 0.98, 0.15], ang: 0.16, color: [1.0, 1.0, 1.0], power: 4.5 },
  ],
};

/* 인식 층 — 켜고 끌 수 있는 단위 */
export const LAYERS = {
  lane: { ko: '차선', desc: '카메라가 본 차선을 이어 붙인 선. 지도가 아니라 지금 보이는 것으로 그린다.', color: 0x5fd0f0 },
  object: { ko: '물체', desc: '차·사람·표지처럼 움직이거나 부딪힐 수 있는 것. 상자로 감싸고 무엇인지, 얼마나 확신하는지를 붙인다.', color: 0x63dfa0 },
  drivable: { ko: '주행 가능 영역', desc: '갈 수 있다고 판단한 바닥. 차선 안쪽만이 아니라 갓길·교차로까지 포함한다.', color: 0x2f6bb8 },
  path: { ko: '계획 경로', desc: '앞으로 몇 초 동안 갈 길. 끼어드는 차가 생기면 이 리본이 먼저 휜다.', color: 0xffc86b },
  occupancy: { ko: '점유 격자', desc: '공간을 작은 칸으로 쪼개고 칸마다 무언가 있는지를 표시한다. 상자로 못 감싸는 것(난간·연석·잔해)까지 담는다.', color: 0x8b6ad0 },
};

/* ── 질감 ── */
function roadTexture() {                     // 아스팔트 + 차선 (세로로 반복)
  const [c, x] = canvas2d(512, 1024);
  const rand = rng(99);
  x.fillStyle = '#15171c'; x.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 14000; i++) {          // 노면 거칠기
    const v = 18 + Math.floor(rand() * 26);
    x.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.25 + rand() * 0.5})`;
    x.fillRect(rand() * 512, rand() * 1024, 2, 2);
  }
  const lane = (px, dash) => {
    x.fillStyle = '#a7b0bd';
    if (!dash) { x.fillRect(px - 3, 0, 6, 1024); return; }
    for (let y = 0; y < 1024; y += 128) x.fillRect(px - 3, y, 6, 72);
  };
  for (let i = 0; i < 3; i++) {             // 타이어가 닦아 반들해진 띠
    const cx = 85 + i * 171;
    for (const off of [-38, 38]) {
      const g2 = x.createLinearGradient(cx + off - 26, 0, cx + off + 26, 0);
      g2.addColorStop(0, 'rgba(120,130,145,0)');
      g2.addColorStop(0.5, 'rgba(120,130,145,0.12)');
      g2.addColorStop(1, 'rgba(120,130,145,0)');
      x.fillStyle = g2; x.fillRect(cx + off - 26, 0, 52, 1024);
    }
  }
  x.fillStyle = 'rgba(80,86,96,0.5)';       // 포장 이음매
  for (const y of [180, 640]) x.fillRect(0, y, 512, 3);
  lane(26, false); lane(486, false);         // 바깥 실선
  lane(512 / 3, true); lane((512 / 3) * 2, true);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function chipTexture(text, sub, color) {     // 물체에 붙는 이름표
  const W = 256, H = 96;
  const [c, x] = canvas2d(W, H);
  x.fillStyle = 'rgba(6,12,20,0.82)';
  x.beginPath();
  const r = 14;
  x.moveTo(r, 2); x.arcTo(W - 2, 2, W - 2, H - 2, r); x.arcTo(W - 2, H - 2, 2, H - 2, r);
  x.arcTo(2, H - 2, 2, 2, r); x.arcTo(2, 2, W - 2, 2, r); x.closePath(); x.fill();
  x.strokeStyle = color; x.lineWidth = 4; x.stroke();
  x.fillStyle = color; x.fillRect(16, 22, 6, H - 44);
  x.fillStyle = '#eaf2ff';
  x.font = '700 38px "IBM Plex Sans KR","Pretendard",sans-serif';
  x.textBaseline = 'middle';
  x.fillText(text, 34, 38);
  x.fillStyle = 'rgba(190,210,235,.7)';
  x.font = '500 26px "IBM Plex Mono",ui-monospace,monospace';
  x.fillText(sub, 34, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 바닥에 떨어지는 빛 웅덩이. 진짜 광원을 여럿 켜는 대신 가산 합성 판으로 그린다
   — 비용이 0 에 가깝고, 어디에 얼마나 밝게 떨어질지 손으로 정할 수 있다. */
function poolTexture() {
  const [c, x] = canvas2d(128, 256);
  const g = x.createRadialGradient(64, 128, 0, 64, 128, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ── 차 한 대 — 옆모습 실루엣을 뽑아 옆으로 밀어낸다 ── */
const CAR_PROFILE = [
  [2.30, 0.26], [2.36, 0.58], [1.72, 0.76], [0.86, 0.80], [0.38, 1.28],
  [-0.62, 1.34], [-1.24, 0.96], [-2.02, 0.86], [-2.36, 0.66], [-2.30, 0.26],
];
const CABIN_PROFILE = [
  [0.86, 0.80], [0.38, 1.26], [-0.62, 1.32], [-1.24, 0.95], [-0.2, 0.86],
];

/* 밀어낸 판은 지붕도 앞뒤도 폭이 같아서 상자처럼 보인다.
   위로 갈수록, 앞뒤 끝으로 갈수록 폭을 줄여 어깨와 코를 둥글린다. */
function roundBody(geom, yMin, yMax, halfL, halfW = 0.96) {
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ty = clamp((y - yMin) / (yMax - yMin), 0, 1);
    const tz = clamp(Math.abs(z) / halfL, 0, 1);
    p.setX(i, x * (1 - 0.38 * ty * ty) * (1 - 0.22 * Math.pow(tz, 3)));
    const tx = clamp(Math.abs(x) / halfW, 0, 1);          // 바깥쪽 모서리일수록
    if (tz > 0.72) p.setZ(i, z - Math.sign(z) * tx * tx * 0.42 * (tz - 0.72) / 0.28);
  }
  p.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function extrudeSide(profile, width, bevel = 0.07) {
  const s = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2,
  });
  g.translate(0, 0, -width / 2);
  g.rotateY(Math.PI / 2);                    // 옆모습을 세워 길 방향(+Z)으로 눕힌다
  return g;
}

let shadowTex = null;
function carShadow(w, l) {
  if (!shadowTex) {
    const [c, x] = canvas2d(128, 256);
    const g = x.createRadialGradient(64, 128, 0, 64, 128, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 256);
    shadowTex = new THREE.CanvasTexture(c);
    shadowTex.colorSpace = THREE.NoColorSpace;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  m.position.y = 0.012;
  return m;
}

function buildCar(bodyMat, glassMat, wheelMat, scale = 1) {
  const g = new THREE.Group();
  g.add(carShadow(2.9, 6.4));
  const body = new THREE.Mesh(roundBody(extrudeSide(CAR_PROFILE, 1.92), 0.26, 1.34, 2.36), bodyMat);
  g.add(body);
  const cabin = new THREE.Mesh(roundBody(extrudeSide(CABIN_PROFILE, 1.8, 0.04), 0.8, 1.32, 1.3), glassMat);
  cabin.position.y = 0.012;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 18).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 14).rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    for (const sz of [1.42, -1.48]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(sx * 0.87, 0.35, sz);
      g.add(w);
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wheelMat);
      arch.position.set(sx * 0.8, 0.36, sz);
      g.add(arch);
      const rim = new THREE.Mesh(rimGeo, bodyMat);       // 휠은 차체색으로 한 점
      rim.position.set(sx * 0.885, 0.35, sz);
      g.add(rim);
    }
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.13), bodyMat);
    mirror.position.set(sx * 0.98, 1.0, 0.62);
    mirror.rotation.z = sx * 0.2;
    g.add(mirror);
  }
  g.scale.setScalar(scale);
  g.userData.size = { w: 1.95 * scale, h: 1.45 * scale, l: 4.75 * scale };
  return g;
}

/* ══════════════════════════════════════════════════════════════
   장면
   ══════════════════════════════════════════════════════════════ */
const LANE_X = [-3.5, 0, 3.5];
const ROAD_W = 11.4, ROAD_LEN = 200, ROAD_AHEAD = 150;
const EGO_V = 22;                    // m/s — 시속 80km 언저리

export function createFSD(canvas, opts = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envSrc = buildEnvTexture(PALETTE);
  const envRT = pmrem.fromEquirectangular(envSrc);
  envSrc.dispose();
  scene.environment = envRT.texture;
  scene.add(buildBackdrop(PALETTE).mesh);
  const motes = buildMotes(PALETTE, makeSpriteTexture(), isMobile ? 250 : 500);
  motes.pts.position.y = 6;
  scene.add(motes.pts);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(-8, 14, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd6ff, 1.9); rim.position.set(9, 3.5, -12);
  const rim2 = new THREE.DirectionalLight(0xffd9a8, 1.1); rim2.position.set(-10, 2.5, -9);
  scene.add(rim, rim2);
  const rough = makeMetalRoughnessMap(13);

  const stage = new THREE.Group();         // 무대(길) — 두 화면에 다 남는다
  const real = new THREE.Group();          // 눈에 보이는 세상
  const seen = new THREE.Group();          // 차가 보는 세상
  scene.add(stage, real, seen);
  scene.fog = new THREE.Fog(0x060a14, 45, 210);     // 멀리는 밤에 잠긴다

  /* ── 길 ── */
  const roadTex = roadTexture();
  roadTex.repeat.set(1, ROAD_LEN / 16);
  const roadMat = new THREE.MeshPhysicalMaterial({
    map: roadTex, roughness: 0.42, metalness: 0.2, roughnessMap: rough,
    envMapIntensity: 1.05, clearcoat: 0.55, clearcoatRoughness: 0.35,
    transparent: true, opacity: 1,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN).rotateX(-Math.PI / 2), roadMat);
  road.position.z = ROAD_LEN / 2 - 50;
  stage.add(road);
  const shoulderMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2430, roughness: 0.95, metalness: 0, transparent: true });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(24, ROAD_LEN).rotateX(-Math.PI / 2), shoulderMat);
    m.position.set(s * (ROAD_W / 2 + 12), -0.04, ROAD_LEN / 2 - 50);
    stage.add(m);
  }

  /* ── 재질 ── */
  const paint = (c) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0.6, roughness: 0.28, roughnessMap: rough,
    clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.3, transparent: true,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05090f, metalness: 0.25, roughness: 0.06, opacity: 1,
    transparent: true, envMapIntensity: 1.15, clearcoat: 1,
  });
  const wheelMat = new THREE.MeshPhysicalMaterial({ color: 0x14161b, metalness: 0.3, roughness: 0.75, transparent: true });
  const egoMat = paint(0xbcc6d4);
  const stageMats = [roadMat, shoulderMat];
  const realMats = [glassMat, wheelMat, egoMat];

  /* ── 내 차 ── */
  const ego = buildCar(egoMat, glassMat, wheelMat, 1);
  const egoGroup = new THREE.Group();
  egoGroup.add(ego);
  real.add(egoGroup);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true });
  realMats.push(lampMat, tailMat);
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.06), lampMat);
    head.position.set(sx * 0.6, 0.72, 2.34);
    ego.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.06), tailMat);
    tail.position.set(sx * 0.62, 0.8, -2.36);
    ego.add(tail);
  }

  /* ── 빛 ── */
  const poolTex = poolTexture();
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pool = (w, l, color, opacity) => new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
    map: poolTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const poolMats = [];
  const addPool = (parent, w, l, color, opacity, x, z) => {
    const m = pool(w, l, color, opacity);
    m.scale.set(w, 1, l);
    m.position.set(x, 0.015, z);
    parent.add(m);
    poolMats.push(m.material);
    return m;
  };
  // 헤드라이트가 길에 떨어진다
  addPool(egoGroup, 6.4, 42, 0xffefcf, 0.38, 0, 20);
  addPool(egoGroup, 3.6, 16, 0xfff6e2, 0.2, 0, 8.5);
  addPool(egoGroup, 3.2, 5.5, 0xff5a4a, 0.3, 0, -4.2);      // 테일라이트 반사
  for (const sx of [-1, 1]) {                                // 공기 중의 빛다발
    const beamGeo = new THREE.ConeGeometry(1.9, 24, 18, 1, true).rotateX(Math.PI / 2).translate(0, 0, 12);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffe9c4, transparent: true, opacity: 0.018, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.set(sx * 0.62, 0.72, 2.3);
    beam.scale.set(1, 0.5, 1);
    egoGroup.add(beam);
    poolMats.push(beam.material);
  }

  /* ── 다른 차들 ── */
  const CLASSES = [
    { ko: '승용차', color: 0x7cf2b0, scale: 1, paints: [0x2f6fd0, 0x9aa4b2, 0x1f2d3d, 0xc84a4a] },
    { ko: '트럭', color: 0xffc86b, scale: 1.35, paints: [0x7a8494, 0x3c4654] },
  ];
  const rand = rng(2026);
  const traffic = [];
  const boxFillMat = new THREE.MeshBasicMaterial({ color: 0x7cf2b0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending });

  function spawnCar(z) {
    const cls = CLASSES[rand() < 0.22 ? 1 : 0];
    const mat = paint(cls.paints[Math.floor(rand() * cls.paints.length)]);
    realMats.push(mat);
    const group = buildCar(mat, glassMat, wheelMat, cls.scale);
    for (const sx of [-1, 1]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), tailMat);
      tl.position.set(sx * 0.6, 0.82, -2.36);
      group.add(tl);
    }
    const glow = pool(1, 1, 0xff4436, 0.34);
    glow.scale.set(2.6, 1, 5);
    glow.position.set(0, 0.02, -3.4);
    group.add(glow); poolMats.push(glow.material);
    const lane = Math.floor(rand() * 3);
    group.position.set(LANE_X[lane], 0, z);
    real.add(group);

    const size = group.userData.size;
    const boxGeo = new THREE.BoxGeometry(size.w * 1.05, size.h, size.l * 1.02);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: cls.color, transparent: true, opacity: 0 }),
    );
    const fill = new THREE.Mesh(boxGeo, boxFillMat);
    const holder = new THREE.Group();
    holder.add(wire, fill);
    holder.position.y = size.h / 2;
    const chip = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.56),
      new THREE.MeshBasicMaterial({ map: chipTexture(cls.ko, (0.9 + rand() * 0.098).toFixed(2), '#' + new THREE.Color(cls.color).getHexString()), transparent: true, depthWrite: false, opacity: 0 }),
    );
    chip.position.y = size.h / 2 + 0.75;
    const per = new THREE.Group();
    per.add(holder, chip);
    seen.add(per);

    const t = {
      group, per, wire, chip, lane, cls, size,
      z, speed: EGO_V + (rand() - 0.5) * 9 - (cls.scale > 1 ? 4 : 0),
    };
    traffic.push(t);
    return t;
  }
  for (let i = 0; i < (isMobile ? 7 : 10); i++) spawnCar(-30 + i * 19 + rand() * 8);

  /* ── 길가 ── */
  let railPosts = null, railZ = 0;
  const postMat = new THREE.MeshPhysicalMaterial({ color: 0x8a94a4, metalness: 0.8, roughness: 0.45, roughnessMap: rough, transparent: true });
  const treeMat = new THREE.MeshPhysicalMaterial({ color: 0x1d3b2e, roughness: 0.9, metalness: 0, transparent: true });
  realMats.push(postMat, treeMat);
  {
    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0x9aa4b4, metalness: 0.95, roughness: 0.38, roughnessMap: rough, envMapIntensity: 1.4, transparent: true,
    });
    realMats.push(railMat);
    for (const s2 of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, ROAD_LEN), railMat);
      beam.position.set(s2 * (ROAD_W / 2 + 1.1), 0.68, ROAD_LEN / 2 - 50);
      real.add(beam);
      const beam2 = beam.clone();
      beam2.position.y = 0.3;
      beam2.scale.y = 0.55;
      real.add(beam2);
    }
    const postGeo2 = new THREE.BoxGeometry(0.12, 0.85, 0.12).translate(0, 0.42, 0);
    railPosts = new THREE.InstancedMesh(postGeo2, railMat, 2 * 34);
    railPosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    railPosts.frustumCulled = false;
    real.add(railPosts);
  }
  const roadside = [];
  {
    const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 3.2, 8).translate(0, 1.6, 0);
    const armGeo = new THREE.BoxGeometry(1.1, 0.09, 0.09);
    const treeGeo = new THREE.ConeGeometry(1.1, 3.4, 7).translate(0, 1.7, 0);
    for (let i = 0; i < 26; i++) {
      const s = i % 2 ? 1 : -1;
      const g = new THREE.Group();
      if (i % 3) {
        const p = new THREE.Mesh(postGeo, postMat);
        const a = new THREE.Mesh(armGeo, postMat);
        a.position.set(-s * 0.55, 3.15, 0);
        g.add(p, a);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat);
        lamp.position.set(-s * 1.05, 3.1, 0);
        g.add(lamp);
        const p1 = pool(1, 1, 0xffe3b0, 0.55);            // 아래로 떨어지는 빛
        p1.scale.set(7.5, 1, 11);
        p1.position.set(-s * 2.6, 0.02, 0);
        g.add(p1); poolMats.push(p1.material);
        const p2 = pool(1, 1, 0xffd9a0, 0.3);             // 젖은 노면에 길게 끌리는 반사
        p2.scale.set(1.5, 1, 26);
        p2.position.set(-s * 3.2, 0.03, -6);
        g.add(p2); poolMats.push(p2.material);
      } else {
        g.add(new THREE.Mesh(treeGeo, treeMat));
      }
      g.position.set(s * (ROAD_W / 2 + 1.9 + (i % 3 ? 0 : 1.6)), 0, -40 + i * 12);
      real.add(g);
      roadside.push(g);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     차가 보는 것 — 층마다 셰이더 하나씩
     ══════════════════════════════════════════════════════════════ */
  const FADE = /* glsl */`
    float far = 1.0 - smoothstep(0.42, 1.0, vUv.y);
    float edge = smoothstep(0.0, 0.3, vUv.x) * (1.0 - smoothstep(0.7, 1.0, vUv.x));`;
  const VERT = /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

  const laneMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(LAYERS.lane.color) }, uDash: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha, uDash; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        ${FADE}
        float d = uDash > 0.5 ? step(0.45, fract(vUv.y * 26.0 - uTime * 0.55)) : 1.0;
        gl_FragColor = vec4(uColor * 1.6, uAlpha * far * edge * (0.35 + d * 0.65));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const laneDashMat = laneMat.clone();
  laneDashMat.uniforms.uDash.value = 1;
  {
    const geo = new THREE.PlaneGeometry(0.34, ROAD_AHEAD).rotateX(-Math.PI / 2).translate(0, 0, ROAD_AHEAD / 2 - 20);
    for (const [x, dash] of [[-5.25, 0], [-1.75, 1], [1.75, 1], [5.25, 0]]) {
      const m = new THREE.Mesh(geo, dash ? laneDashMat : laneMat);
      m.position.set(x, 0.03, 0);
      seen.add(m);
    }
  }

  const driveMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(LAYERS.drivable.color) } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        ${FADE}
        float gz = smoothstep(0.92, 1.0, fract(vUv.y * 42.0 - uTime * 0.35));   // 흘러가는 가로줄
        float gx = smoothstep(0.9, 1.0, fract(vUv.x * 12.0));
        float rim = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
        float a = (0.1 + gz * 0.35 + gx * 0.12 + (1.0 - rim) * 0.5) * far * uAlpha;
        gl_FragColor = vec4(uColor * (1.0 + gz * 1.5), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W - 0.6, ROAD_AHEAD).rotateX(-Math.PI / 2), driveMat);
    m.position.set(0, 0.02, ROAD_AHEAD / 2 - 20);
    seen.add(m);
  }

  /* 계획 경로 — 매 프레임 다시 뽑는다(차선을 바꾸면 이 리본이 먼저 휜다) */
  const PATH_SEG = 44, PATH_LEN = 46, PATH_W = 1.5;
  const pathMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(LAYERS.path.color) } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        ${FADE}
        float ch = fract(vUv.y * 9.0 - uTime * 0.85);
        float m = smoothstep(0.0, 0.08, ch) * (1.0 - smoothstep(0.08, 0.46, ch));
        gl_FragColor = vec4(uColor * (1.1 + m * 1.9), (0.22 + m * 0.8) * far * edge * uAlpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pathGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array((PATH_SEG + 1) * 2 * 3);
    const uv = new Float32Array((PATH_SEG + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= PATH_SEG; i++) {
      uv[i * 4] = 0; uv[i * 4 + 1] = i / PATH_SEG;
      uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / PATH_SEG;
      if (i < PATH_SEG) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    pathGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    pathGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    pathGeo.setIndex(idx);
  }
  const pathMesh = new THREE.Mesh(pathGeo, pathMat);
  pathMesh.frustumCulled = false;
  seen.add(pathMesh);

  /* 점유 격자 — 상자로 못 감싸는 것까지 칸으로 담는다 */
  const OCC = { nx: 13, nz: 30, sx: 1.15, sz: 1.7, z0: -6 };
  // 세기는 칸 색에 담는다. 재질 알파는 1 로 두어야 가산 합성이 실제로 더해진다.
  const occMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const occ = new THREE.InstancedMesh(
    new THREE.BoxGeometry(OCC.sx * 0.82, 0.5, OCC.sz * 0.82), occMat, OCC.nx * OCC.nz);
  occ.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  occ.frustumCulled = false;
  seen.add(occ);
  {
    const d = new THREE.Object3D();
    let i = 0;
    for (let a = 0; a < OCC.nx; a++) for (let b = 0; b < OCC.nz; b++) {
      d.position.set((a - (OCC.nx - 1) / 2) * OCC.sx, 0.3, OCC.z0 + b * OCC.sz);
      d.updateMatrix();
      occ.setMatrixAt(i, d.matrix);
      occ.setColorAt(i, new THREE.Color(0, 0, 0));
      i++;
    }
    occ.instanceMatrix.needsUpdate = true;
  }

  /* 내 차도 인식 화면에서는 상자로 */
  const egoWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.95, 1.45, 4.75)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  egoWire.position.y = 0.72;
  seen.add(egoWire);

  /* ══════════════════════════════════════════════════════════════
     주행 · 시야 · 카메라
     ══════════════════════════════════════════════════════════════ */
  const state = {
    vision: 1, speed: 1,
    layers: { lane: true, object: true, drivable: true, path: true, occupancy: true },
    cam: 'chase',
  };
  let egoLane = 1, egoX = 0, targetX = 0, laneTimer = 2, lateral = 0;

  function think(dt) {
    laneTimer -= dt;
    const ahead = traffic
      .filter((t) => t.lane === egoLane && t.z > 4 && t.z < 36)
      .sort((a, b) => a.z - b.z)[0];
    if (laneTimer <= 0 && ahead && ahead.speed < EGO_V - 1.5) {
      for (const cand of (egoLane === 1 ? [0, 2] : [1])) {
        if (cand < 0 || cand > 2) continue;
        const busy = traffic.some((t) => t.lane === cand && t.z > -16 && t.z < 44);
        if (!busy) { egoLane = cand; laneTimer = 7; break; }
      }
    }
    targetX = LANE_X[egoLane];
    const nx = egoX + (targetX - egoX) * Math.min(1, dt * 1.15);
    lateral = (nx - egoX) / Math.max(dt, 1e-3);
    egoX = nx;
  }

  const pathPos = pathGeo.attributes.position.array;
  function updatePath() {
    for (let i = 0; i <= PATH_SEG; i++) {
      const z = (i / PATH_SEG) * PATH_LEN;
      const x = lerp(egoX, targetX, smooth(0, 1, clamp(z / 28, 0, 1)));
      const o = i * 6;
      pathPos[o] = x - PATH_W / 2; pathPos[o + 1] = 0.07; pathPos[o + 2] = z + 2.4;
      pathPos[o + 3] = x + PATH_W / 2; pathPos[o + 4] = 0.07; pathPos[o + 5] = z + 2.4;
    }
    pathGeo.attributes.position.needsUpdate = true;
  }

  const occCol = new THREE.Color();
  let occAlpha = 1;
  function updateOcc(time) {
    if (occAlpha < 0.01) { if (occ.visible) occ.visible = false; return; }
    occ.visible = true;
    const base = new THREE.Color(LAYERS.occupancy.color);
    let i = 0;
    for (let a = 0; a < OCC.nx; a++) {
      const cx = (a - (OCC.nx - 1) / 2) * OCC.sx;
      for (let b = 0; b < OCC.nz; b++, i++) {
        const cz = OCC.z0 + b * OCC.sz;
        let hit = 0;
        for (const t of traffic) {
          if (Math.abs(t.z - cz) < t.size.l / 2 + 0.4 && Math.abs(LANE_X[t.lane] - cx) < t.size.w / 2 + 0.35) { hit = 1; break; }
        }
        if (!hit && Math.abs(cx) > ROAD_W / 2 - 0.5) hit = 0.42;        // 길 바깥은 못 가는 곳
        if (!hit) { occCol.setRGB(0, 0, 0); } else {
          const flick = 0.72 + 0.28 * Math.sin(time * 6 + a * 1.7 + b * 0.9);
          const far = 1 - clamp((cz - 4) / 44, 0, 1) * 0.75;
          occCol.copy(base).multiplyScalar(hit * flick * far * occAlpha * 1.4);
        }
        occ.setColorAt(i, occCol);
      }
    }
    occ.instanceColor.needsUpdate = true;
  }

  function applyVision() {
    for (const m of poolMats) if (m.userData.base === undefined) m.userData.base = m.opacity;
    const v = state.vision;
    real.visible = v < 0.99;
    seen.visible = v > 0.01;
    for (const m of realMats) m.opacity = 1 - v;
    for (const m of poolMats) m.opacity = m.userData.base * (1 - v * 0.82);
    for (const m of stageMats) m.opacity = lerp(1, 0.28, v);
    const A = (k) => v * (state.layers[k] ? 1 : 0);
    laneMat.uniforms.uAlpha.value = A('lane');
    laneDashMat.uniforms.uAlpha.value = A('lane');
    driveMat.uniforms.uAlpha.value = A('drivable');
    pathMat.uniforms.uAlpha.value = A('path');
    pathMesh.visible = A('path') > 0.01;
    occAlpha = A('occupancy');
    const objA = A('object');
    for (const t of traffic) {
      t.wire.material.opacity = objA;
      t.chip.material.opacity = objA;
      t.per.visible = objA > 0.01;
    }
    boxFillMat.opacity = 0.075 * objA;
    egoWire.material.opacity = objA * 0.85;
  }
  applyVision();

  /* ── 카메라 ── */
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const RIGS = {
    chase: { pos: (x) => V3(x * 0.35, 2.95, -8.4), look: (x) => V3(x * 0.85, 1.05, 22) },
    hood: { pos: (x) => V3(x, 1.5, 1.6), look: (x) => V3(x * 0.92, 1.1, 36) },
    top: { pos: (x) => V3(x * 0.5, 31, -10), look: (x) => V3(x * 0.6, 0, 13) },
  };
  const camPos = new THREE.Vector3(0, 4.5, -10.8), camLook = new THREE.Vector3(0, 1.2, 17);
  const orbit = { theta: 0.4, phi: 1.15, dist: 16, target: new THREE.Vector3(0, 1.2, 8) };
  let dragging = false, lastX = 0, lastY = 0, pinch = 0;
  const pointers = new Map();

  function toFree() {
    if (state.cam === 'free') return;
    const d = camPos.clone().sub(orbit.target);
    orbit.dist = clamp(d.length(), 6, 60);
    orbit.phi = clamp(Math.acos(clamp(d.y / orbit.dist, -1, 1)), 0.12, Math.PI / 2 - 0.05);
    orbit.theta = Math.atan2(d.x, d.z);
    state.cam = 'free';
    if (opts.onCamera) opts.onCamera('free');
  }
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
      if (pinch) { toFree(); orbit.dist = clamp(orbit.dist * (pinch / d), 6, 60); }
      pinch = d; return;
    }
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) toFree();
    orbit.theta -= dx * 0.006;
    orbit.phi = clamp(orbit.phi - dy * 0.005, 0.12, Math.PI / 2 - 0.05);
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
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    toFree();
    orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0012), 6, 60);
  }, { passive: false });

  /* ── 크기 ── */
  const composer = new Composer(renderer);
  let W = 1, H = 1, samples = isMobile ? 0 : 4;
  const PIXEL_BUDGET = 3.2e6;
  function applySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    let k = dpr;
    const px = rect.width * rect.height * k * k;
    if (px > PIXEL_BUDGET) k *= Math.sqrt(PIXEL_BUDGET / px);
    W = Math.max(2, Math.round(rect.width * k));
    H = Math.max(2, Math.round(rect.height * k));
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.fov = camera.aspect < 1 ? 62 : 50;
    camera.updateProjectionMatrix();
    composer.setSize(W, H, samples);
    motes.mat.uniforms.uScale.value = H * 0.5;
  }
  const ro = new ResizeObserver(() => applySize());
  ro.observe(canvas.parentElement || canvas);
  applySize();

  /* ── 해설 ── */
  const TOUR = [
    { layer: 'lane', cam: 'chase', title: '차선', body: '카메라가 본 차선을 이어 붙인 선입니다. 미리 저장한 지도가 아니라 지금 보이는 것으로 매 순간 다시 그립니다. 선이 지워졌거나 공사로 옮겨졌으면 그대로 따라 휩니다.' },
    { layer: 'object', cam: 'chase', title: '물체', body: '움직이거나 부딪힐 수 있는 것을 상자로 감쌉니다. 무엇인지(승용차·트럭)와 얼마나 확신하는지가 함께 붙습니다. 상자는 가려져도 잠깐은 남습니다 — 안 보인다고 사라진 게 아니니까요.' },
    { layer: 'drivable', cam: 'top', title: '주행 가능 영역', body: '갈 수 있다고 판단한 바닥입니다. 차선 안쪽만이 아니라 갓길과 교차로까지 포함합니다. 피해야 할 일이 생기면 차는 이 영역 안에서 길을 찾습니다.' },
    { layer: 'path', cam: 'chase', title: '계획 경로', body: '앞으로 몇 초 동안 갈 길입니다. 앞차가 느리면 이 리본이 먼저 옆 차선으로 휘고, 차체는 그 뒤를 따라갑니다. 화면에서 가장 먼저 반응하는 층입니다.' },
    { layer: 'occupancy', cam: 'top', title: '점유 격자', body: '공간을 칸으로 쪼개고 칸마다 무언가 있는지를 표시합니다. 상자로 감싸기 어려운 것 — 난간, 연석, 떨어진 짐 — 까지 담기 위한 층입니다.' },
  ];

  /* ── 루프 ── */
  let last = performance.now() / 1000, raf = 0, t = 0, fps = 60, frames = 0, acc = 0;
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    const elapsed = now - last;                  // 진짜 경과 시간
    const dt = Math.min(0.05, elapsed);          // 애니메이션에 먹이는 값
    last = now; acc += elapsed; frames++;        // fps 는 진짜 시간으로 재야 한다
    if (acc >= 1) { fps = frames / acc; frames = 0; acc = 0; }
    const sdt = dt * state.speed;
    t += sdt;

    // 세상이 흘러간다
    roadTex.offset.y -= (EGO_V * sdt) / 16;
    for (const g of roadside) {
      g.position.z -= EGO_V * sdt;
      if (g.position.z < -50) g.position.z += 26 * 12;
    }
    railZ = (railZ - EGO_V * sdt) % 6;                 // 가드레일 기둥은 6m 간격
    {
      const d = new THREE.Object3D();
      let i = 0;
      for (const s2 of [-1, 1]) for (let k = 0; k < 34; k++) {
        d.position.set(s2 * (ROAD_W / 2 + 1.1), 0, railZ - 30 + k * 6);
        d.updateMatrix();
        railPosts.setMatrixAt(i++, d.matrix);
      }
      railPosts.instanceMatrix.needsUpdate = true;
    }
    for (const c of traffic) {
      c.z += (c.speed - EGO_V) * sdt;
      if (c.z < -55) { c.z = 120 + rand() * 40; c.lane = Math.floor(rand() * 3); c.speed = EGO_V + (rand() - 0.5) * 9 - (c.cls.scale > 1 ? 4 : 0); }
      else if (c.z > 165) { c.z = -50 - rand() * 20; }
      c.group.position.set(LANE_X[c.lane], 0, c.z);
      c.per.position.set(LANE_X[c.lane], 0, c.z);
      c.chip.quaternion.copy(camera.quaternion);
    }

    think(sdt);
    egoGroup.position.x = egoX;
    ego.rotation.z = -lateral * 0.05;
    ego.rotation.y = lateral * 0.035;
    egoWire.position.x = egoX;
    updatePath();
    updateOcc(t);

    laneMat.uniforms.uTime.value = t;
    laneDashMat.uniforms.uTime.value = t;
    driveMat.uniforms.uTime.value = t;
    pathMat.uniforms.uTime.value = t;
    motes.mat.uniforms.uTime.value = t;

    // 카메라
    if (state.cam === 'free') {
      orbit.target.set(egoX * 0.6, 1.2, 8);
      tmpPos.set(
        Math.sin(orbit.phi) * Math.sin(orbit.theta),
        Math.cos(orbit.phi),
        Math.sin(orbit.phi) * Math.cos(orbit.theta),
      ).multiplyScalar(orbit.dist).add(orbit.target);
      tmpLook.copy(orbit.target);
    } else {
      const rig = RIGS[state.cam] || RIGS.chase;
      tmpPos.copy(rig.pos(egoX));
      tmpLook.copy(rig.look(egoX));
    }
    const k = Math.min(1, dt * (state.cam === 'hood' ? 9 : 3.2));
    camPos.lerp(tmpPos, k);
    camLook.lerp(tmpLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.info.reset();
    composer.render(scene, camera, { bloom: 0.92, threshold: 0.92, exposure: PALETTE.exposure, grain: 0.013, time: t });
  }
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now() / 1000; raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);
  if (reduceMotion) state.speed = 0.45;
  raf = requestAnimationFrame(frame);

  return {
    state, layers: LAYERS, tour: TOUR,
    setVision(v) { state.vision = clamp(v, 0, 1); applyVision(); },
    setLayer(k, on) { if (k in state.layers) { state.layers[k] = on; applyVision(); } },
    setSpeed(v) { state.speed = clamp(v, 0, 2.5); },
    setCamera(mode) {
      if (mode === 'free') { toFree(); return; }
      if (!RIGS[mode]) return;
      state.cam = mode;
      if (opts.onCamera) opts.onCamera(mode);
    },
    goTour(i) {
      const st = TOUR[i];
      if (!st) return null;
      state.vision = 1;
      for (const k of Object.keys(state.layers)) state.layers[k] = k === st.layer;
      applyVision();
      this.setCamera(st.cam);
      return st;
    },
    clearTour() {
      for (const k of Object.keys(state.layers)) state.layers[k] = true;
      applyVision();
      this.setCamera('chase');
    },
    info: () => ({ fps: Math.round(fps), size: `${W}×${H}`, tri: renderer.info.render.triangles, calls: renderer.info.render.calls, cars: traffic.length }),
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      composer.dispose(); pmrem.dispose(); envRT.dispose(); renderer.dispose();
    },
  };
}
