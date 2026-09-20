/* ══════════════════════════════════════════════════════════════════════════
   HBM 해부 — 쌓인 메모리를 손으로 뜯어 보는 화면

   외부 에셋이 없다. 기판·인터포저·GPU 다이·DRAM 적층·TSV·마이크로범프까지
   전부 상자와 원기둥으로 깎고, 표면 무늬는 캔버스에 그려서 입힌다.
   환경광·블룸 같은 공용 재료는 `/assets/scene-kit.js` 에서 가져온다.

   숫자에 대하여: 여기 실린 규격값은 JEDEC 표준 기준이다. 제조사별 출하 제품,
   점유율·가격처럼 움직이는 숫자는 싣지 않는다(확인할 수 없는 건 안 쓴다).
   ══════════════════════════════════════════════════════════════════════════ */

import {
  THREE, TAU, clamp, lerp, smooth, canvas2d,
  makeMetalRoughnessMap, makeSpriteTexture,
  buildEnvTexture, buildBackdrop, buildMotes, Composer,
} from '../../assets/scene-kit.js';

/* ── 세대 (JEDEC 규격 기준) ───────────────────────────────────────────────
   bus  인터페이스 폭(비트) · pin 핀당 속도(Gbps) · bw 스택당 대역폭
   high 최대 적층 단수 · cap 스택당 최대 용량(GB) · dies 화면에 쌓을 단수 */
export const GENS = {
  hbm2:  { label: 'HBM2',  bus: 1024, pin: '2.4',      bw: '약 307GB/s', high: '8단',     cap: '8GB',  dies: 8,  year: '2016' },
  hbm2e: { label: 'HBM2E', bus: 1024, pin: '3.6',      bw: '약 461GB/s', high: '12단',    cap: '16GB', dies: 8,  year: '2018' },
  hbm3:  { label: 'HBM3',  bus: 1024, pin: '6.4',      bw: '약 819GB/s', high: '16단',    cap: '24GB', dies: 12, year: '2022' },
  hbm3e: { label: 'HBM3E', bus: 1024, pin: '9.2~9.6',  bw: '약 1.2TB/s', high: '12~16단', cap: '36GB', dies: 12, year: '2023' },
  hbm4:  { label: 'HBM4',  bus: 2048, pin: '약 8',     bw: '약 2TB/s',   high: '16단',    cap: '64GB', dies: 16, year: '2025' },
};

/* ── 부품 설명 ── */
export const PARTS = {
  substrate: {
    ko: '패키지 기판', en: 'Package substrate',
    desc: '맨 아래 판. 인터포저와 바깥 세상(메인보드)을 잇는다. 아래쪽 공 무더기가 BGA 볼이고, 전원과 느린 신호가 여기로 드나든다.',
    note: 'HBM 의 빠른 신호는 여기까지 내려오지 않는다 — 인터포저 위에서 끝난다.',
  },
  interposer: {
    ko: '실리콘 인터포저', en: 'Silicon interposer',
    desc: 'GPU 와 메모리를 같은 실리콘 판 위에 나란히 올리고, 둘 사이를 아주 가는 선 수천 개로 잇는다. 이 방식을 2.5D 패키징이라 부른다.',
    note: '선이 짧고 촘촘할수록 한 번에 많이 보낼 수 있다. 거리가 곧 대역폭이다.',
  },
  gpu: {
    ko: 'GPU · 가속기 다이', en: 'Logic die',
    desc: '연산을 하는 칩. 메모리를 기다리는 시간이 곧 손해라서, 메모리를 최대한 가까이 붙인다.',
    note: '옆에 붙은 스택마다 1,024(HBM4 는 2,048)개의 데이터 선이 들어온다.',
  },
  base: {
    ko: '베이스 다이', en: 'Base / logic die',
    desc: '적층의 맨 아래. 위에 쌓인 DRAM 을 대신해 바깥과 말을 주고받는 층이다. 신호를 정리하고 테스트 회로도 여기 있다.',
    note: 'HBM4 에서는 이 층을 로직 공정으로 만들어 역할을 더 얹는 방향이 논의된다.',
  },
  dram: {
    ko: 'DRAM 다이 적층', en: 'DRAM dies',
    desc: '기억을 담는 층. 옆으로 넓히는 대신 위로 쌓는다. 다이는 수십 마이크로미터까지 갈아 얇게 만든 뒤 겹친다.',
    note: '쌓을수록 용량은 늘지만 열이 빠져나갈 길은 좁아진다. 적층 수의 한계는 대개 열과 수율에서 온다.',
  },
  tsv: {
    ko: 'TSV · 관통전극', en: 'Through-Silicon Via',
    desc: '다이를 위아래로 뚫은 구멍에 구리를 채운 기둥. 층과 층을 수직으로 잇는다. 옆으로 돌아가지 않으니 길이가 짧다.',
    note: '쌓인 다이를 한 몸처럼 쓰게 해 주는 핵심. 뚫고 메우고 갈아내는 공정이 어렵고, 수율이 값을 정한다.',
  },
  ubump: {
    ko: '마이크로범프', en: 'Microbump',
    desc: '다이와 다이를 붙이는 아주 작은 납·구리 공. 수만 개가 한 번에 눌려 붙는다.',
    note: '더 촘촘히 붙이려고 범프 없이 구리끼리 직접 붙이는 하이브리드 본딩이 다음 세대에서 논의된다.',
  },
  wires: {
    ko: '인터포저 배선', en: 'Interposer wiring',
    desc: '스택 하나당 1,024개(HBM4 는 2,048개)의 데이터 선. 대역폭을 속도가 아니라 폭으로 번다.',
    note: 'DDR5 메모리 한 모듈의 데이터 폭이 64비트다. HBM 한 스택은 그 열여섯 배로 동시에 나른다.',
  },
};

/* ── 표면 무늬 ── */
function dieShotTexture(seed = 1) {           // GPU 다이 윗면 — 블록 배치도처럼
  const [c, x] = canvas2d(512, 512);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  x.fillStyle = '#10141c'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {             // 연산 블록
    const w = 8 + rnd() * 54, h = 8 + rnd() * 54;
    const gx = Math.floor(rnd() * 511), gy = Math.floor(rnd() * 511);
    const v = 26 + Math.floor(rnd() * 46);
    x.fillStyle = `rgb(${v},${v + 6},${v + 14})`;
    x.fillRect(gx, gy, w, h);
    x.strokeStyle = 'rgba(120,150,190,.22)'; x.lineWidth = 1;
    x.strokeRect(gx + .5, gy + .5, w, h);
  }
  x.strokeStyle = 'rgba(150,180,220,.3)'; x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {              // 전원·클록 간선
    const y = rnd() * 512;
    x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function dramTexture() {                      // DRAM 다이 윗면 — 뱅크가 규칙적으로 반복된다
  const [c, x] = canvas2d(512, 512);
  x.fillStyle = '#1b1a24'; x.fillRect(0, 0, 512, 512);
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const px = 12 + gx * 126, py = 12 + gy * 62;
      x.fillStyle = '#242232'; x.fillRect(px, py, 112, 48);
      x.strokeStyle = 'rgba(160,150,200,.25)'; x.lineWidth = 1;
      x.strokeRect(px + .5, py + .5, 112, 48);
      x.fillStyle = 'rgba(180,170,220,.1)';
      for (let i = 0; i < 6; i++) x.fillRect(px + 6 + i * 18, py + 6, 10, 36);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function interposerTexture() {                // 인터포저 윗면 — 가는 선이 촘촘히 지나간다
  const [c, x] = canvas2d(1024, 512);
  x.fillStyle = '#131a26'; x.fillRect(0, 0, 1024, 512);
  x.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const y = (i / 260) * 512 + (i % 3) * 0.6;
    x.strokeStyle = `rgba(110,160,220,${0.06 + (i % 7) * 0.012})`;
    x.beginPath(); x.moveTo(0, y); x.lineTo(1024, y + (i % 5 - 2) * 2); x.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const gx = (i / 40) * 1024;
    x.strokeStyle = 'rgba(90,130,190,.12)';
    x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, 512); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function substrateTexture() {                 // 기판 윗면 — 초록 솔더마스크에 패드
  const [c, x] = canvas2d(512, 512);
  x.fillStyle = '#10261c'; x.fillRect(0, 0, 512, 512);
  x.fillStyle = 'rgba(190,170,90,.5)';
  for (let gy = 0; gy < 22; gy++) {
    for (let gx = 0; gx < 22; gx++) {
      if ((gx + gy) % 3 === 0) continue;
      x.fillRect(12 + gx * 22, 12 + gy * 22, 7, 7);
    }
  }
  x.strokeStyle = 'rgba(120,200,160,.14)'; x.lineWidth = 2;
  for (let i = 0; i < 16; i++) { const y = i * 32 + 8; x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* ══════════════════════════════════════════════════════════════
   치수 (단위는 화면용 — 실물 비례가 아니라 읽히는 비례로 잡았다)
   ══════════════════════════════════════════════════════════════ */
const D = {
  sub: { w: 14.6, h: 0.5, d: 11 },
  inter: { w: 11.4, h: 0.18, d: 6.8 },
  gpu: { w: 3.6, h: 0.55, d: 3.6 },
  base: { w: 2.5, h: 0.26, d: 2.5 },
  die: { w: 2.3, h: 0.1, d: 2.3 },
  gap: 0.05,
  stackX: 4.0,
};
const PALETTE = {
  bgTop: 0x0b1120, bgBot: 0x03060c, halo: 0x123055, mote: 0xaecbf2,
  sky: [0.045, 0.07, 0.125], ground: [0.01, 0.013, 0.02], exposure: 1.16,
  env: [
    { dir: [-0.45, 0.72, 0.52], ang: 0.38, color: [0.95, 0.97, 1.0], power: 9 },
    { dir: [0.78, 0.22, -0.58], ang: 0.3, color: [0.4, 0.72, 1.0], power: 6.5 },
    { dir: [0.2, -0.5, 0.84], ang: 0.55, color: [0.35, 0.4, 0.55], power: 1.5 },
    { dir: [0.05, 0.98, 0.15], ang: 0.16, color: [1.0, 1.0, 1.0], power: 5 },
  ],
};

const WIRE_VERT = /* glsl */`
  attribute float aSeed;
  varying vec2 vUv; varying float vSeed;
  void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WIRE_FRAG = /* glsl */`
  uniform float uTime, uSpeed, uOpacity; uniform vec3 uBase, uHot;
  varying vec2 vUv; varying float vSeed;
  void main(){
    float p = fract(vUv.x - uTime * uSpeed + vSeed);          // 신호 한 덩이가 지나간다
    float pulse = smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.05, 0.3, p));
    float edge = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
    vec3 col = mix(uBase, uHot, pulse);
    gl_FragColor = vec4(col * (0.5 + pulse * 2.2), (0.22 + pulse * 0.85) * edge * uOpacity);
  }`;

export function createHBM(canvas, opts = {}) {
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
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envSrc = buildEnvTexture(PALETTE);
  const envRT = pmrem.fromEquirectangular(envSrc);
  envSrc.dispose();
  scene.environment = envRT.texture;
  scene.add(buildBackdrop(PALETTE).mesh);
  const motes = buildMotes(PALETTE, makeSpriteTexture(), isMobile ? 300 : 600);
  motes.pts.position.y = 3;
  scene.add(motes.pts);
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-7, 11, 7);
  const rim = new THREE.DirectionalLight(0x86c8ff, 1.15); rim.position.set(8, 3, -9);
  scene.add(key, rim);
  const rough = makeMetalRoughnessMap(31);

  /* ── 재질 ── */
  const silicon = (color, r = 0.34, m = 0.5) => new THREE.MeshPhysicalMaterial({
    color, metalness: m, roughness: r, roughnessMap: rough, envMapIntensity: 1.25,
    clearcoat: 0.35, clearcoatRoughness: 0.35, emissive: 0x000000,
  });
  const MAT = {
    sub: silicon(0x1d4a36, 0.65, 0.12),
    subTop: new THREE.MeshPhysicalMaterial({ map: substrateTexture(), roughness: 0.6, metalness: 0.15, envMapIntensity: 1.1 }),
    inter: silicon(0x2b3f5c, 0.3, 0.45),
    interTop: new THREE.MeshPhysicalMaterial({ map: interposerTexture(), roughness: 0.44, metalness: 0.4, envMapIntensity: 0.95 }),
    gpu: silicon(0x161c28, 0.32, 0.55),
    gpuTop: new THREE.MeshPhysicalMaterial({ map: dieShotTexture(7), roughness: 0.46, metalness: 0.4, envMapIntensity: 0.9 }),
    base: silicon(0x2a2438, 0.3, 0.6),
    dram: silicon(0x322c44, 0.36, 0.45),
    dramTop: new THREE.MeshPhysicalMaterial({ map: dramTexture(), roughness: 0.5, metalness: 0.34, envMapIntensity: 0.85 }),
    cu: new THREE.MeshPhysicalMaterial({ color: 0xd98b52, metalness: 1, roughness: 0.28, roughnessMap: rough, envMapIntensity: 1.6, emissive: 0x2a1004, emissiveIntensity: 0.6 }),
    bump: new THREE.MeshPhysicalMaterial({ color: 0xc4ccd8, metalness: 1, roughness: 0.3, roughnessMap: rough, envMapIntensity: 1.5 }),
    ball: new THREE.MeshPhysicalMaterial({ color: 0xb9bfc9, metalness: 1, roughness: 0.34, roughnessMap: rough, envMapIntensity: 1.4 }),
  };
  // 윗면만 무늬를 입힌다(상자 면 순서: +x, −x, +y, −y, +z, −z)
  const boxMats = (side, top) => [side, side, top, side, side, side];

  const root = new THREE.Group();
  scene.add(root);
  const pickables = [];
  const tag = (mesh, part) => { mesh.userData.part = part; pickables.push(mesh); return mesh; };

  /* ── 기판 · BGA ── */
  const subTopY = D.sub.h;
  const substrate = tag(new THREE.Mesh(new THREE.BoxGeometry(D.sub.w, D.sub.h, D.sub.d), boxMats(MAT.sub, MAT.subTop)), 'substrate');
  substrate.position.y = D.sub.h / 2;
  root.add(substrate);
  {
    const g = new THREE.SphereGeometry(0.15, 10, 8);
    const nx = 19, nz = 14, sp = 0.72;
    const im = new THREE.InstancedMesh(g, MAT.ball, nx * nz);
    const d = new THREE.Object3D();
    let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      d.position.set((a - (nx - 1) / 2) * sp, -0.09, (b - (nz - 1) / 2) * sp);
      d.scale.set(1, 0.62, 1); d.updateMatrix();
      im.setMatrixAt(i++, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    root.add(tag(im, 'substrate'));
  }

  /* ── 인터포저 · C4 범프 ── */
  const interGroup = new THREE.Group();
  const interposer = tag(new THREE.Mesh(new THREE.BoxGeometry(D.inter.w, D.inter.h, D.inter.d), boxMats(MAT.inter, MAT.interTop)), 'interposer');
  interposer.position.y = subTopY + 0.12 + D.inter.h / 2;
  interGroup.add(interposer);
  {
    const g = new THREE.SphereGeometry(0.075, 8, 6);
    const nx = 27, nz = 16, sp = 0.4;
    const im = new THREE.InstancedMesh(g, MAT.bump, nx * nz);
    const d = new THREE.Object3D();
    let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      d.position.set((a - (nx - 1) / 2) * sp, subTopY + 0.06, (b - (nz - 1) / 2) * sp);
      d.scale.set(1, 0.7, 1); d.updateMatrix();
      im.setMatrixAt(i++, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    interGroup.add(tag(im, 'ubump'));
  }
  root.add(interGroup);
  const interTopY = subTopY + 0.12 + D.inter.h;

  /* ── GPU 다이 ── */
  const gpuGroup = new THREE.Group();
  const gpu = tag(new THREE.Mesh(new THREE.BoxGeometry(D.gpu.w, D.gpu.h, D.gpu.d), boxMats(MAT.gpu, MAT.gpuTop)), 'gpu');
  gpu.position.y = interTopY + D.gpu.h / 2;
  gpuGroup.add(gpu);
  root.add(gpuGroup);

  /* ── HBM 적층 두 짝 ── */
  const stacks = [];
  const stackRoot = new THREE.Group();
  root.add(stackRoot);
  let dieCount = GENS[opts.gen || 'hbm3e'].dies;

  function buildStacks(n) {
    for (const s of stacks) { stackRoot.remove(s.group); s.dispose(); }
    stacks.length = 0;
    for (let k = pickables.length - 1; k >= 0; k--) if (pickables[k].userData.stackPart) pickables.splice(k, 1);

    for (const side of [-1, 1]) {
      const group = new THREE.Group();
      group.position.x = side * D.stackX;
      const baseMesh = tag(new THREE.Mesh(new THREE.BoxGeometry(D.base.w, D.base.h, D.base.d), MAT.base), 'base');
      baseMesh.userData.stackPart = true;
      baseMesh.position.y = interTopY + D.base.h / 2;
      group.add(baseMesh);

      const dies = [];
      const dieGeo = new THREE.BoxGeometry(D.die.w, D.die.h, D.die.d);
      for (let i = 0; i < n; i++) {
        const m = tag(new THREE.Mesh(dieGeo, boxMats(MAT.dram, MAT.dramTop)), 'dram');
        m.userData.stackPart = true;
        group.add(m);
        dies.push(m);
      }

      // TSV — 층과 층 사이를 잇는 구리 기둥(분해하면 늘어난다)
      const tsvPos = [];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        tsvPos.push([(a - 1.5) * 0.52, (b - 1.5) * 0.52]);
      }
      const tsvGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6).translate(0, 0.5, 0);
      const tsv = new THREE.InstancedMesh(tsvGeo, MAT.cu, tsvPos.length * n);
      tsv.userData.stackPart = true;
      group.add(tag(tsv, 'tsv'));

      // 마이크로범프 — 다이와 다이 사이
      const bumpPos = [];
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) bumpPos.push([(a - 3) * 0.3, (b - 3) * 0.3]);
      const bumpGeo = new THREE.SphereGeometry(0.02, 6, 5);
      const bumps = new THREE.InstancedMesh(bumpGeo, MAT.bump, bumpPos.length * n);
      bumps.userData.stackPart = true;
      group.add(tag(bumps, 'ubump'));

      stackRoot.add(group);
      stacks.push({
        side, group, baseMesh, dies, tsv, tsvPos, bumps, bumpPos,
        dispose() { dieGeo.dispose(); tsvGeo.dispose(); bumpGeo.dispose(); },
      });
    }
  }
  buildStacks(dieCount);

  /* ── 인터포저 배선 — 스택 하나당 1,024(HBM4 는 2,048)개의 길 ── */
  const wireMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSpeed: { value: 0.35 }, uOpacity: { value: 1 },
      uBase: { value: new THREE.Color(0x2b5f9c) }, uHot: { value: new THREE.Color(0x8fe3ff) },
    },
    vertexShader: WIRE_VERT, fragmentShader: WIRE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const wireGroup = new THREE.Group();
  root.add(wireGroup);
  let wireMesh = null;

  function buildWires(bus) {
    if (wireMesh) { wireGroup.remove(wireMesh); wireMesh.geometry.dispose(); }
    const perSide = bus === 2048 ? 56 : 28;          // 32 비트씩 묶어 한 가닥으로 그린다
    const pos = [], uv = [], seed = [], idx = [];
    const w = 0.028, y = interTopY + 0.012;
    let v = 0;
    for (const side of [-1, 1]) {
      const x0 = side * (D.gpu.w / 2 - 0.05), x1 = side * (D.stackX - D.base.w / 2 + 0.05);
      for (let i = 0; i < perSide; i++) {
        const z = lerp(-1.55, 1.55, perSide === 1 ? 0.5 : i / (perSide - 1));
        pos.push(x0, y, z - w, x1, y, z - w, x1, y, z + w, x0, y, z + w);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        const sd = (i * 0.137 + (side > 0 ? 0.41 : 0)) % 1;
        seed.push(sd, sd, sd, sd);
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setIndex(idx);
    wireMesh = new THREE.Mesh(g, wireMat);
    wireMesh.renderOrder = 2;
    wireMesh.userData.part = 'wires';
    wireGroup.add(wireMesh);
    if (!pickables.includes(wireMesh)) pickables.push(wireMesh);
  }
  buildWires(GENS[opts.gen || 'hbm3e'].bus);

  /* ── 분해 ── */
  const dummy = new THREE.Object3D();
  let explode = 0, explodeWant = 0;

  function applyExplode(e) {
    interGroup.position.y = 1.45 * e;
    wireGroup.position.y = 1.45 * e;
    gpuGroup.position.y = 2.85 * e;
    wireMat.uniforms.uOpacity.value = clamp(1 - e * 1.6, 0, 1);

    for (const s of stacks) {
      s.group.position.y = 2.85 * e;
      const baseTop = interTopY + D.base.h;
      const perDie = 5.2 / Math.max(1, s.dies.length);   // 층수가 달라도 총 분해 높이는 같게
      let prevTop = baseTop;
      let ti = 0, bi = 0;
      for (let i = 0; i < s.dies.length; i++) {
        const bottom = baseTop + D.gap + i * (D.die.h + D.gap) + e * (i + 1) * perDie;
        s.dies[i].position.y = bottom + D.die.h / 2;
        for (const [px, pz] of s.tsvPos) {              // 층 사이를 잇는 구리 기둥
          dummy.position.set(px, prevTop, pz);
          dummy.scale.set(1, Math.max(0.001, bottom - prevTop), 1);
          dummy.updateMatrix();
          s.tsv.setMatrixAt(ti++, dummy.matrix);
        }
        for (const [px, pz] of s.bumpPos) {             // 범프는 위쪽 다이 바닥에 붙어 있다
          dummy.position.set(px, bottom - 0.018, pz);
          dummy.scale.set(1, 0.8, 1);
          dummy.updateMatrix();
          s.bumps.setMatrixAt(bi++, dummy.matrix);
        }
        prevTop = bottom + D.die.h;
      }
      s.tsv.instanceMatrix.needsUpdate = true;
      s.bumps.instanceMatrix.needsUpdate = true;
      s.tsv.count = ti; s.bumps.count = bi;
    }
  }

  /* ── 짚기 · 강조 ── */
  const MAT_OF = {
    substrate: [MAT.sub, MAT.subTop, MAT.ball],
    interposer: [MAT.inter, MAT.interTop],
    gpu: [MAT.gpu, MAT.gpuTop],
    base: [MAT.base], dram: [MAT.dram, MAT.dramTop],
    tsv: [MAT.cu], ubump: [MAT.bump], wires: [],
  };
  const GLOW = new THREE.Color(0x3d7fd6);
  let highlight = null, glowT = 0;
  function setHighlight(part) { highlight = part; }

  /* ── 카메라 ── */
  const target = new THREE.Vector3(0, 1.55, 0);
  function fitDist() {
    const vh = (camera.fov * Math.PI / 180) / 2;
    const hh = Math.atan(Math.tan(vh) * camera.aspect);
    return clamp(Math.max(8.4 / Math.tan(hh), 5.0 / Math.tan(vh)), 12, 32);
  }
  const view = { theta: 0.78, phi: 1.02, dist: 18 };
  const want = { ...view };
  let dragging = false, moved = 0, lastX = 0, lastY = 0, pinch = 0, idle = 9, zoomed = false, firstFit = true;
  const pointers = new Map();
  const ndc = new THREE.Vector2(-2, -2);
  const ray = new THREE.Raycaster();

  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; idle = 0;
  };
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) { want.dist = clamp(want.dist * (pinch / d), 6, 46); zoomed = true; }
      pinch = d; return;
    }
    if (!dragging) return;
    moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
    want.theta -= (e.clientX - lastX) * 0.006;
    want.phi = clamp(want.phi - (e.clientY - lastY) * 0.005, 0.06, Math.PI / 2 - 0.02);
    lastX = e.clientX; lastY = e.clientY; idle = 0;
  };
  const onUp = (e) => {
    if (pointers.size === 1 && moved < 6 && opts.onPick) opts.onPick(hovered);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) dragging = false;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', () => ndc.set(-2, -2));
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    want.dist = clamp(want.dist * Math.exp(e.deltaY * 0.0012), 6, 46);
    zoomed = true; idle = 0;
  }, { passive: false });

  /* ── 크기 ── */
  const composer = new Composer(renderer);
  let W = 1, H = 1, scale = 1, samples = isMobile ? 0 : 4;
  const PIXEL_BUDGET = 3.2e6;
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
    camera.updateProjectionMatrix();
    if (!zoomed) { want.dist = fitDist(); if (firstFit) { view.dist = want.dist; firstFit = false; } }
    composer.setSize(W, H, samples);
    motes.mat.uniforms.uScale.value = H * 0.5;
  }
  const ro = new ResizeObserver(() => applySize());
  ro.observe(canvas.parentElement || canvas);
  applyExplode(0);
  applySize();

  /* ── 이름표 ── */
  const host = opts.labelHost;
  const anchors = [
    { part: 'dram', get: () => new THREE.Vector3(-D.stackX, stacks[0].dies[stacks[0].dies.length - 1].position.y + stacks[0].group.position.y + 0.35, 0) },
    { part: 'gpu', get: () => new THREE.Vector3(0, gpu.position.y + gpuGroup.position.y + 0.45, 0) },
    { part: 'interposer', get: () => new THREE.Vector3(D.inter.w / 2 - 0.6, interposer.position.y + interGroup.position.y + 0.2, D.inter.d / 2 + 0.3) },
    { part: 'substrate', get: () => new THREE.Vector3(-D.sub.w / 2 + 1.1, D.sub.h + 0.18, D.sub.d / 2 - 0.2) },
    { part: 'wires', get: () => new THREE.Vector3(D.stackX * 0.55, interTopY + 0.25 + wireGroup.position.y, 1.9) },
  ];
  let labels = [];
  if (host) {
    labels = anchors.map((a) => {
      const el = document.createElement('div');
      el.className = 'lab';
      el.textContent = PARTS[a.part].ko;
      host.appendChild(el);
      return { ...a, el };
    });
  }

  /* ── 해설 순서 ── */
  const TOUR = [
    { part: 'gpu', title: '왜 옆에 붙이나', view: [0.88, 1.1, 17], explode: 0, speed: 0.35,
      body: '연산 칩은 기다리는 시간이 곧 손해다. 메모리를 보드 저편에 두면 선이 길어지고, 길어진 만큼 느려지고 전기를 더 쓴다. 그래서 같은 실리콘 판 위에 나란히 올린다.' },
    { part: 'wires', title: '1,024개의 길', view: [0.15, 0.4, 14], explode: 0, speed: 1.1,
      body: '대역폭을 속도가 아니라 폭으로 번다. DDR5 메모리 한 모듈의 데이터 폭이 64비트인데, HBM 한 스택은 1,024비트가 동시에 오간다. HBM4 는 2,048비트로 넓힌다. 빛줄기 하나가 32비트 묶음이라고 보면 된다.' },
    { part: 'dram', title: '왜 쌓나', view: [1.25, 1.3, 15], explode: 0.55, speed: 0.2,
      body: '옆으로 넓히면 그만큼 선이 길어진다. 그래서 위로 쌓는다. 다이를 수십 마이크로미터까지 갈아 얇게 만든 뒤 겹친다. 용량은 층수로 는다.' },
    { part: 'tsv', title: '층을 잇는 기둥', view: [1.5, 1.24, 11], explode: 0.9, speed: 0.2,
      body: '쌓은 층을 잇는 건 옆으로 도는 선이 아니라, 다이를 수직으로 관통하는 구리 기둥이다. 뚫고 채우고 갈아내는 이 공정이 어렵고, 수율이 값을 정한다.' },
    { part: 'dram', title: '남는 문제는 열', view: [1.05, 1.4, 14], explode: 0.2, speed: 0.2,
      body: '쌓을수록 열이 빠져나갈 길은 좁아진다. 적층 수의 한계는 대개 열과 수율에서 온다. 층을 더 올리는 일이 늘 공정 싸움이 되는 이유다.' },
  ];

  /* ── 강조용 기본값 기억 ── */
  const glowState = new Map();
  for (const list of Object.values(MAT_OF)) {
    for (const m of list) if (!glowState.has(m)) {
      glowState.set(m, { base: m.emissive.clone(), baseI: m.emissiveIntensity ?? 1, t: 0 });
    }
  }

  /* ── 루프 ── */
  let last = performance.now() / 1000, raf = 0, t = 0, hovered = null;
  let fps = 60, frames = 0, acc = 0, autoRotate = !reduceMotion, showLabels = true, wireSpeed = 0.35;
  const proj = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    const rect = canvas.getBoundingClientRect();
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last);
    last = now; t += dt; acc += dt; frames++;
    if (acc >= 1) { fps = frames / acc; frames = 0; acc = 0; }

    target.y = 1.55 + explode * 3.6;                     // 층이 뜨는 만큼 시선도 올린다
    if (!zoomed) want.dist = fitDist() * (1 + explode * 0.72);
    idle = dragging ? 0 : idle + dt;
    if (autoRotate && idle > 2.5) want.theta += dt * 0.085 * smooth(2.5, 4, idle);
    view.theta += (want.theta - view.theta) * Math.min(1, dt * 5);
    view.phi += (want.phi - view.phi) * Math.min(1, dt * 5);
    view.dist += (want.dist - view.dist) * Math.min(1, dt * 4);
    camera.position.set(
      Math.sin(view.phi) * Math.sin(view.theta),
      Math.cos(view.phi),
      Math.sin(view.phi) * Math.cos(view.theta),
    ).multiplyScalar(view.dist).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    if (Math.abs(explodeWant - explode) > 0.0005) {
      explode += (explodeWant - explode) * Math.min(1, dt * 4.5);
      applyExplode(explode);
    }

    ray.setFromCamera(ndc, camera);
    const hit = ndc.x > -1.5 ? ray.intersectObjects(pickables, false)[0] : null;
    const part = hit ? hit.object.userData.part : null;
    if (part !== hovered) { hovered = part; if (opts.onHover) opts.onHover(part); }
    canvas.style.cursor = hovered ? 'pointer' : (dragging ? 'grabbing' : 'grab');

    const lit = highlight || hovered;
    for (const [m, st] of glowState) {
      const on = lit && MAT_OF[lit] && MAT_OF[lit].includes(m) ? 1 : 0;
      if (Math.abs(on - st.t) > 0.002) {
        st.t += (on - st.t) * Math.min(1, dt * 8);
        m.emissive.copy(st.base).lerp(GLOW, st.t);
        m.emissiveIntensity = lerp(st.baseI, Math.max(st.baseI, 0.9), st.t);
      }
    }
    const wireHot = lit === 'wires' ? 1 : 0;
    wireMat.uniforms.uTime.value = t;
    wireMat.uniforms.uSpeed.value += ((wireSpeed + wireHot * 0.5) - wireMat.uniforms.uSpeed.value) * Math.min(1, dt * 3);

    if (host) {
      for (const l of labels) {
        proj.copy(l.get()).project(camera);
        const vis = showLabels && proj.z < 1 && Math.abs(proj.x) < 0.93 && Math.abs(proj.y) < 0.93;
        l.el.style.display = vis ? 'block' : 'none';
        l.el.classList.toggle('on', lit === l.part);
        if (!vis) continue;
        l.el.style.transform = `translate(-50%,-50%) translate(${(proj.x * 0.5 + 0.5) * rect.width}px,${(-proj.y * 0.5 + 0.5) * rect.height}px)`;
      }
    }

    motes.mat.uniforms.uTime.value = t;
    renderer.info.reset();
    composer.render(scene, camera, { bloom: 0.7, threshold: 1.15, exposure: PALETTE.exposure, grain: 0.012, time: t });
  }
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now() / 1000; raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  let genKey = opts.gen || 'hbm3e';
  return {
    parts: PARTS, gens: GENS, tour: TOUR,
    get gen() { return genKey; },
    get explode() { return explodeWant; },
    setExplode(v) { explodeWant = clamp(v, 0, 1); },
    setGen(k) {
      if (!GENS[k]) return;
      genKey = k;
      dieCount = GENS[k].dies;
      buildStacks(dieCount);
      buildWires(GENS[k].bus);
      applyExplode(explode);
    },
    setLabels(on) { showLabels = on; },
    setAutoRotate(on) { autoRotate = on; },
    setHighlight,
    goTour(i) {
      const st = TOUR[i];
      if (!st) return null;
      want.theta = st.view[0]; want.phi = st.view[1]; want.dist = st.view[2] * (fitDist() / 18);
      zoomed = true;
      explodeWant = st.explode;
      wireSpeed = st.speed;
      setHighlight(st.part);
      return st;
    },
    clearTour() { setHighlight(null); wireSpeed = 0.35; },
    resetView() { want.theta = 0.78; want.phi = 1.02; want.dist = fitDist(); zoomed = false; },
    info: () => ({ fps: Math.round(fps), size: `${W}×${H}`, tri: renderer.info.render.triangles, calls: renderer.info.render.calls, dies: dieCount }),
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
