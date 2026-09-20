/* ══════════════════════════════════════════════════════════════════════════
   기계 나비 · Mechanical Butterfly — three.js 장면

   외부 에셋이 하나도 없다. 날개 골격과 막, 몸통, 톱니바퀴, 질감(텍스처),
   환경광(HDR 환경맵), 빛 번짐(블룸)까지 전부 이 파일 안에서 계산해 만든다.
   three.js 는 같은 폴더의 three.min.js 한 개만 쓴다(CDN 없음).

   좌표 약속: 나비는 +Z 를 향해 날고, +Y 가 위, 날개는 ±X 로 뻗는다.
   ══════════════════════════════════════════════════════════════════════════ */

import * as THREE from './three.min.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// 결정적 난수. 씨앗이 같으면 같은 무늬가 나오므로 새로고침해도 나비가 변하지 않는다.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/* ══════════════════════════════════════════════════════════════
   색 프리셋
   금속·막·발광·배경을 한 벌로 묶어 둔다. env 는 환경맵에 박을
   광원 덩어리들(방향, 각반경, 색, 세기)이고 금속의 하이라이트
   모양을 결정한다. 세기가 1을 넘는 HDR 값이라 블룸이 물린다.
   ══════════════════════════════════════════════════════════════ */
export const PRESETS = {
  gold: {
    label: '골드 나이트',
    metal: 0xf6cd83, metalRough: 0.17, frame: 0x8a6a37, frameRough: 0.3,
    membrane: 0xbb9260, iridRange: [130, 940], emissive: 0x6fe9ff, core: 0x7ff2ff,
    bgTop: 0x0a1226, bgBot: 0x02040a, halo: 0x21467f, mote: 0xcfe2ff, eye: 0x9ff4ff,
    exposure: 1.22,
    env: [
      { dir: [-0.55, 0.62, 0.55], ang: 0.42, color: [1.00, 0.93, 0.80], power: 9.7 },
      { dir: [0.75, 0.18, -0.62], ang: 0.30, color: [0.42, 0.78, 1.00], power: 7.6 },
      { dir: [0.25, -0.45, 0.85], ang: 0.55, color: [0.70, 0.52, 0.35], power: 2.1 },
      { dir: [0.05, 0.98, 0.15], ang: 0.16, color: [1.00, 0.98, 0.95], power: 6.3 },
    ],
    sky: [0.055, 0.085, 0.16], ground: [0.012, 0.014, 0.022],
  },
  titan: {
    label: '티타늄 심해',
    metal: 0xd8e4f2, metalRough: 0.13, frame: 0x44546a, frameRough: 0.28,
    membrane: 0x7ba0c2, iridRange: [200, 1010], emissive: 0x7ad8ff, core: 0x8ef0ff,
    bgTop: 0x061426, bgBot: 0x01050b, halo: 0x12527d, mote: 0xbfe6ff, eye: 0xc8f6ff,
    exposure: 1.24,
    env: [
      { dir: [-0.45, 0.70, 0.55], ang: 0.38, color: [0.86, 0.94, 1.00], power: 10.4 },
      { dir: [0.80, 0.10, -0.58], ang: 0.28, color: [0.32, 0.72, 1.00], power: 9.1 },
      { dir: [-0.15, -0.55, -0.82], ang: 0.60, color: [0.22, 0.40, 0.62], power: 2.5 },
      { dir: [0.10, 0.97, -0.20], ang: 0.14, color: [1.00, 1.00, 1.00], power: 6.9 },
    ],
    sky: [0.04, 0.075, 0.14], ground: [0.008, 0.012, 0.02],
  },
  rose: {
    label: '장미금 여명',
    metal: 0xf7b6a4, metalRough: 0.2, frame: 0x7d4a45, frameRough: 0.32,
    membrane: 0xc4899b, iridRange: [110, 880], emissive: 0xffb9d2, core: 0xffd2c0,
    bgTop: 0x1a0c18, bgBot: 0x07030a, halo: 0x6b2347, mote: 0xffd6e4, eye: 0xffd9c8,
    exposure: 1.2,
    env: [
      { dir: [-0.6, 0.55, 0.58], ang: 0.44, color: [1.00, 0.86, 0.74], power: 9.1 },
      { dir: [0.72, 0.28, -0.63], ang: 0.32, color: [1.00, 0.55, 0.70], power: 6.9 },
      { dir: [0.30, -0.40, 0.86], ang: 0.55, color: [0.55, 0.28, 0.35], power: 2.1 },
      { dir: [-0.05, 0.99, 0.10], ang: 0.17, color: [1.00, 0.95, 0.92], power: 5.6 },
    ],
    sky: [0.10, 0.05, 0.09], ground: [0.02, 0.01, 0.016],
  },
  jade: {
    label: '비취 황혼',
    metal: 0xd9c489, metalRough: 0.19, frame: 0x3f5f4d, frameRough: 0.3,
    membrane: 0x77ad93, iridRange: [160, 960], emissive: 0x8affc9, core: 0xa6ffd9,
    bgTop: 0x071a14, bgBot: 0x020806, halo: 0x1d6b4e, mote: 0xc6ffe0, eye: 0xb6ffd8,
    exposure: 1.22,
    env: [
      { dir: [-0.5, 0.66, 0.56], ang: 0.40, color: [1.00, 0.96, 0.84], power: 9.1 },
      { dir: [0.78, 0.14, -0.60], ang: 0.30, color: [0.38, 1.00, 0.76], power: 7.6 },
      { dir: [0.20, -0.48, 0.85], ang: 0.55, color: [0.30, 0.52, 0.42], power: 2.1 },
      { dir: [0.00, 0.99, 0.12], ang: 0.15, color: [0.96, 1.00, 0.98], power: 6.3 },
    ],
    sky: [0.045, 0.09, 0.07], ground: [0.01, 0.018, 0.014],
  },
};

/* ══════════════════════════════════════════════════════════════
   날개 질감 — 캔버스에 직접 그려서 텍스처로 쓴다

   한 장을 여러 갈래로 나눠 쓴다.
   · map            : 막의 바탕색(옅은 세포 무늬)
   · alphaMap       : 뿌리는 짙고 끝으로 갈수록 비치는 투명도
   · iridescenceMap : 두께 지도. 여기 밝기 차이가 보는 각도에 따라
                      달라지는 무지갯빛(박막 간섭)의 색을 갈라 놓는다.
   · emissiveMap    : 스스로 빛나는 잔가지 회로. 블룸이 이걸 물고 번진다.
   ══════════════════════════════════════════════════════════════ */

// 날개를 가로지르는 잔맥(가는 선)을 한 번 계산해 여러 캔버스에서 같은 자리에 그린다.
function veinPaths(seed) {
  const rand = rng(seed);
  const paths = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const a = lerp(-0.42, 0.46, t) + (rand() - 0.5) * 0.04;   // 뿌리에서 뻗는 각도
    const len = lerp(0.72, 1.02, 0.6 + 0.4 * Math.sin(t * Math.PI)) * (0.88 + rand() * 0.2);
    const ex = 0.04 + Math.cos(a) * len;
    const ey = 0.5 + Math.sin(a) * len * 0.62;
    const bow = (rand() - 0.5) * 0.12;
    paths.push({ x0: 0.03, y0: 0.5, cx: 0.03 + (ex - 0.03) * 0.5 - bow * 0.3, cy: 0.5 + (ey - 0.5) * 0.5 + bow, x1: ex, y1: ey, w: lerp(1.0, 0.35, t > 0.5 ? (t - 0.5) * 2 : (0.5 - t) * 2) });
  }
  // 잔맥끼리 잇는 가로 연결선 — 곤충 날개의 '방'을 만든다.
  const links = [];
  for (let i = 0; i < N - 1; i++) {
    for (const u of [0.45, 0.72]) {
      if (rand() < 0.42) continue;
      const a = paths[i], b = paths[i + 1];
      const pa = quadAt(a, u + (rand() - 0.5) * 0.08);
      const pb = quadAt(b, u + (rand() - 0.5) * 0.08);
      links.push([pa, pb]);
    }
  }
  return { paths, links };
}

function quadAt(p, t) {
  const it = 1 - t;
  return [it * it * p.x0 + 2 * it * t * p.cx + t * t * p.x1, it * it * p.y0 + 2 * it * t * p.cy + t * t * p.y1];
}

function strokeVeins(ctx, w, h, data, { color, widthScale = 1, links = true, alpha = 1, studs = 0 }) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (const p of data.paths) {
    ctx.lineWidth = Math.max(0.6, p.w * 3.1 * widthScale);
    ctx.beginPath();
    ctx.moveTo(p.x0 * w, p.y0 * h);
    ctx.quadraticCurveTo(p.cx * w, p.cy * h, p.x1 * w, p.y1 * h);
    ctx.stroke();
  }
  if (links) {
    ctx.lineWidth = Math.max(0.5, 1.5 * widthScale);
    for (const [a, b] of data.links) {
      ctx.beginPath();
      ctx.moveTo(a[0] * w, a[1] * h);
      ctx.lineTo(b[0] * w, b[1] * h);
      ctx.stroke();
    }
  }
  if (studs > 0) {                       // 맥을 따라 박힌 리벳 자국
    ctx.fillStyle = color;
    for (const p of data.paths) {
      for (let k = 1; k <= 6; k++) {
        const [x, y] = quadAt(p, k / 7);
        ctx.globalAlpha = alpha * studs;
        ctx.beginPath();
        ctx.arc(x * w, y * h, 1.6 + p.w * 1.1, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function makeWingMaps(preset, seed) {
  const W = 1024, H = 512;
  const data = veinPaths(seed);
  const rand = rng(seed ^ 0x9e37);

  /* 바탕색 — 흰색에 가깝게. 실제 색은 재질의 color 가 정한다. */
  const [cMap, mx] = canvas2d(W, H);
  const g = mx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#fff6e6'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#e9f4ff');
  mx.fillStyle = g; mx.fillRect(0, 0, W, H);
  strokeVeins(mx, W, H, data, { color: '#a98a58', widthScale: 1.4, alpha: 0.5, studs: 1.3 });
  for (let i = 0; i < 160; i++) {  // 미세한 얼룩
    const x = rand() * W, y = rand() * H, r = 6 + rand() * 46;
    const rg = mx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${0.05 + rand() * 0.07})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    mx.fillStyle = rg; mx.beginPath(); mx.arc(x, y, r, 0, TAU); mx.fill();
  }

  /* 투명도 — alphaMap 은 초록 채널을 본다. 회색으로 그리면 된다. */
  const [cAlpha, ax] = canvas2d(W, H);
  const ag = ax.createLinearGradient(0, 0, W, 0);
  ag.addColorStop(0, '#5a5a5a'); ag.addColorStop(0.45, '#3e3e3e'); ag.addColorStop(1, '#2a2a2a');
  ax.fillStyle = ag; ax.fillRect(0, 0, W, H);
  const vg = ax.createRadialGradient(W * 0.06, H * 0.5, 0, W * 0.06, H * 0.5, W * 0.5);
  vg.addColorStop(0, 'rgba(255,255,255,0.18)'); vg.addColorStop(1, 'rgba(255,255,255,0)');
  ax.fillStyle = vg; ax.fillRect(0, 0, W, H);
  strokeVeins(ax, W, H, data, { color: '#ffffff', widthScale: 1.7, alpha: 0.6, studs: 1.5 });
  for (let i = 0; i < 900; i++) {   // 표면에 앉은 비늘가루
    const x = rand() * W, y = rand() * H;
    ax.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.1})`;
    ax.fillRect(x, y, 1 + rand() * 2.4, 1 + rand() * 2.4);
  }

  /* 박막 두께 — 부드러운 덩어리들. 무지갯빛이 갈리는 지도. */
  const [cIrid, ix] = canvas2d(512, 256);
  ix.fillStyle = '#404040'; ix.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 34; i++) {
    const x = rand() * 512, y = rand() * 256, r = 40 + rand() * 150;
    const rg = ix.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.floor(70 + rand() * 185);
    rg.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ix.fillStyle = rg; ix.beginPath(); ix.arc(x, y, r, 0, TAU); ix.fill();
  }
  const bg = ix.createLinearGradient(0, 0, 512, 90);   // 스팬 방향으로 훑는 띠
  bg.addColorStop(0, 'rgba(255,255,255,0.35)'); bg.addColorStop(0.4, 'rgba(0,0,0,0.25)');
  bg.addColorStop(0.7, 'rgba(255,255,255,0.3)'); bg.addColorStop(1, 'rgba(0,0,0,0.2)');
  ix.fillStyle = bg; ix.fillRect(0, 0, 512, 256);

  /* 발광 회로 — 검은 바탕에 흰 선. 색은 재질의 emissive 가 입힌다. */
  const [cEm, ex] = canvas2d(W, H);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  strokeVeins(ex, W, H, data, { color: '#ffffff', widthScale: 0.62, alpha: 0.9 });
  const eg = ex.createLinearGradient(0, 0, W, 0);   // 뿌리 쪽이 더 밝다
  eg.addColorStop(0, 'rgba(255,255,255,0.5)'); eg.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  ex.globalCompositeOperation = 'lighter';
  ex.fillStyle = eg; ex.fillRect(0, 0, W, H);
  for (const p of data.paths) {   // 잔맥 끝의 불씨
    const [x, y] = [p.x1 * W, p.y1 * H];
    const rg = ex.createRadialGradient(x, y, 0, x, y, 16);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ex.fillStyle = rg; ex.beginPath(); ex.arc(x, y, 16, 0, TAU); ex.fill();
  }
  ex.globalCompositeOperation = 'source-over';

  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(cMap, true), alphaMap: tex(cAlpha, false), iridMap: tex(cIrid, false), emissiveMap: tex(cEm, true) };
}

/* 금속 표면의 결(브러시드 메탈) — 거칠기를 미세하게 흔들어 준다. */
function makeMetalRoughnessMap(seed) {
  const [c, x] = canvas2d(512, 512);
  const rand = rng(seed);
  x.fillStyle = '#808080'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const y = rand() * 512, len = 30 + rand() * 300, v = Math.floor(96 + rand() * 96);
    x.strokeStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.12})`;
    x.lineWidth = 0.6 + rand() * 1.6;
    x.beginPath(); x.moveTo(rand() * 512, y); x.lineTo(rand() * 512 + len, y + (rand() - 0.5) * 6); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* 나비 뒤에 까는 넓은 후광. 중심을 뜨겁게 두지 않는다. */
function makeHaloTexture() {
  const [c, x] = canvas2d(256, 256);
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* 동그란 빛 알갱이 — 먼지와 불티가 같이 쓴다. */
function makeSpriteTexture() {
  const [c, x] = canvas2d(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ══════════════════════════════════════════════════════════════
   환경맵 — 스튜디오 조명을 코드로 만든다

   정방형도법(equirectangular) 픽셀을 직접 채운다. 값이 1을 넘는
   HDR(half-float) 이라 금속에 맺히는 하이라이트가 하얗게 타면서
   블룸으로 번진다. PMREM 으로 거칠기별 흐림까지 미리 구워 둔다.
   ══════════════════════════════════════════════════════════════ */
function buildEnvTexture(preset) {
  const W = 256, H = 128;
  const data = new Uint16Array(W * H * 4);
  const half = THREE.DataUtils.toHalfFloat;
  const lights = preset.env.map((l) => {
    const d = new THREE.Vector3(...l.dir).normalize();
    return { d, cosR: Math.cos(l.ang), color: l.color, power: l.power };
  });
  const dir = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const phi = (y + 0.5) / H * Math.PI;               // 0(위) → π(아래)
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x < W; x++) {
      const theta = (x + 0.5) / W * TAU;
      dir.set(sp * Math.cos(theta), cp, sp * Math.sin(theta));
      // 하늘 ↔ 바닥 그라데이션
      const t = smooth(-0.35, 0.85, dir.y);
      let r = lerp(preset.ground[0], preset.sky[0], t);
      let g = lerp(preset.ground[1], preset.sky[1], t);
      let b = lerp(preset.ground[2], preset.sky[2], t);
      // 수평선 바로 위의 옅은 띠 — 금속에 긴 반사 선을 남긴다.
      const band = Math.exp(-Math.pow((dir.y - 0.06) / 0.05, 2)) * 0.5;
      r += band * 0.18; g += band * 0.22; b += band * 0.3;
      for (const l of lights) {
        const c = dir.dot(l.d);
        if (c <= l.cosR) continue;
        const k = Math.pow((c - l.cosR) / (1 - l.cosR), 1.6) * l.power;
        r += l.color[0] * k; g += l.color[1] * k; b += l.color[2] * k;
      }
      const i = (y * W + x) * 4;
      data[i] = half(r); data[i + 1] = half(g); data[i + 2] = half(b); data[i + 3] = half(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/* ══════════════════════════════════════════════════════════════
   기하 도우미
   ══════════════════════════════════════════════════════════════ */

// 굵기가 변하는 관. 날개맥·더듬이·다리가 전부 이걸로 만들어진다.
// TubeGeometry 는 굵기가 일정해서 직접 고리를 쌓는다.
function taperedTube(curve, r0, r1, seg = 40, radial = 7, taperPow = 1) {
  const pts = curve.getSpacedPoints(seg);
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const r = lerp(r0, r1, Math.pow(t, taperPow));
    const P = pts[i], N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * TAU;
      const sx = Math.cos(v), sy = Math.sin(v);
      const nx = N.x * sx + B.x * sy, ny = N.y * sx + B.y * sy, nz = N.z * sx + B.z * sy;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
      nor.push(nx, ny, nz);
      uv.push(t, j / radial);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * row + j, b = a + row, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// 다각형이 시계 반대 방향을 보게 맞춘다(좌우 날개를 뒤집어 만들 때 필요).
function ensureCCW(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a < 0 ? pts.slice().reverse() : pts;
}

// 다각형을 무게중심 쪽으로 d 만큼 줄인다. 판과 판 사이에 금속 뼈대가 드러날 틈을 만든다.
function insetPolygon(pts, d) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  return pts.map((p) => {
    const dx = cx - p.x, dy = cy - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(d, len * 0.42);
    return new THREE.Vector2(p.x + dx / len * k, p.y + dy / len * k);
  });
}

// 날개 전체를 하나의 천으로 보고 UV 를 다시 입힌다. 판이 나뉘어도 무늬가 이어진다.
function remapUV(geom, box, side) {
  const p = geom.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const sx = 1 / Math.max(1e-4, box.max.x - box.min.x);
  const sy = 1 / Math.max(1e-4, box.max.y - box.min.y);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) * side - box.min.x) * sx;
    uv[i * 2 + 1] = (p.getY(i) - box.min.y) * sy;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// 평평한 날개를 살짝 휘게 만든다. 스팬을 따라 처지고, 끝으로 갈수록 비틀린다.
// (x, y) 는 그대로 두고 두께축 z 만 건드린다.
function camberPoint(x, y, span, side) {
  const u = clamp(Math.abs(x) / span, 0, 1);
  let z = -0.085 * u * u + 0.03 * Math.sin(u * Math.PI) * Math.abs(y) * 1.6;
  const tw = -0.2 * u * u * side;      // 끝으로 갈수록 뒤틀림(워시아웃)
  const cy = Math.cos(tw), sy2 = Math.sin(tw);
  return { y: y * cy - z * sy2, z: y * sy2 + z * cy };
}

function applyCamber(geom, span, side) {
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z0 = p.getZ(i);
    const c = camberPoint(x, y, span, side);
    p.setY(i, c.y);
    p.setZ(i, c.z + z0);     // 원래 두께는 살려 둔다
  }
  p.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
}

// 톱니바퀴. 이빨·축구멍·살창까지 형상으로 깎는다.
function gearGeometry({ r = 0.12, teeth = 14, tooth = 0.028, thick = 0.016, hole = 0.03, spokes = 5, spokeR = 0.5 }) {
  const shape = new THREE.Shape();
  const rOut = r + tooth, rIn = r;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU, step = TAU / teeth;
    const p = [
      [a0 + step * 0.06, rIn], [a0 + step * 0.20, rOut],
      [a0 + step * 0.40, rOut], [a0 + step * 0.54, rIn],
      [a0 + step * 0.96, rIn],
    ];
    for (let k = 0; k < p.length; k++) {
      const [a, rr] = p[k];
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const center = new THREE.Path();
  center.absarc(0, 0, hole, 0, TAU, true);
  shape.holes.push(center);
  if (spokes > 0) {
    const r0 = hole + (r - hole) * 0.22, r1 = hole + (r - hole) * 0.86;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU, w = (TAU / spokes) * 0.31;
      const h = new THREE.Path();
      h.absarc(0, 0, r1, a - w, a + w, false);
      h.absarc(0, 0, r0, a + w, a - w, true);
      h.closePath();
      shape.holes.push(h);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thick, bevelEnabled: true, bevelThickness: thick * 0.22,
    bevelSize: thick * 0.22, bevelSegments: 1, curveSegments: 10,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

/* ══════════════════════════════════════════════════════════════
   날개

   1. 바깥선(닫힌 스플라인)을 뽑고
   2. 뿌리에서 바깥선까지 맥을 부챗살처럼 걸고
   3. 맥과 맥 사이를 판으로 채운 뒤 안쪽으로 조금 줄여 틈을 내고
   4. 바깥선·맥을 금속관으로 덧대고 이음매에 리벳을 박는다.
   ══════════════════════════════════════════════════════════════ */
const WING_OUTLINE = {
  // 앞날개: 앞전이 곧게 뻗다 끝에서 꺾이고, 바깥 가장자리가 뒤로 잘려 들어온다.
  fore: [[0, 0.06], [0.17, 0.35], [0.45, 0.62], [0.73, 0.79], [0.96, 0.79], [1.05, 0.53],
         [0.99, 0.2], [0.83, -0.05], [0.57, -0.22], [0.29, -0.26], [0.07, -0.15]],
  // 뒷날개: 둥글고, 바깥 뒤쪽에 꼬리가 하나 뻗는다.
  hind: [[0, 0.05], [0.23, 0.19], [0.49, 0.17], [0.67, 0.03], [0.8, -0.22], [0.83, -0.5],
         [0.67, -0.67], [0.73, -0.93], [0.51, -0.73], [0.29, -0.65], [0.1, -0.4], [0.02, -0.15]],
};
function buildWing(kind, side, preset, maps, metalRough, seed) {
  const group = new THREE.Group();
  const def = WING_OUTLINE[kind];
  const veinCount = kind === 'fore' ? 7 : 6;
  const rand = rng(seed);

  // 1) 바깥선
  const ctrl = def.map(([x, y]) => new THREE.Vector3(x * side, y, 0));
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'catmullrom', 0.5);
  const M = 240;
  const ring = curve.getSpacedPoints(M);        // M+1 개(마지막 = 처음)
  ring.pop();

  // 뿌리에 가장 가까운 점을 0번으로 돌려 놓는다. 그래야 부챗살이 자연스럽게 퍼진다.
  const root = new THREE.Vector2(0.035 * side, 0.0);
  let iRoot = 0, best = Infinity;
  ring.forEach((p, i) => { const d = (p.x - root.x) ** 2 + (p.y - root.y) ** 2; if (d < best) { best = d; iRoot = i; } });
  const loop = ring.slice(iRoot).concat(ring.slice(0, iRoot)).map((p) => new THREE.Vector2(p.x, p.y));
  const N = loop.length;

  const box = new THREE.Box2();
  loop.forEach((p) => box.expandByPoint(new THREE.Vector2(p.x * side, p.y)));
  const span = Math.max(...loop.map((p) => Math.abs(p.x)));

  // 2) 맥 — 뿌리에서 바깥선의 정해진 점까지
  const cuts = [];
  for (let i = 0; i < veinCount; i++) cuts.push(Math.round(N * lerp(0.1, 0.9, i / (veinCount - 1))));
  const veins = cuts.map((ci, i) => {
    const end = loop[ci];
    const bow = (i / (veinCount - 1) - 0.5) * 0.18 + (rand() - 0.5) * 0.04;
    const mid = new THREE.Vector3(lerp(root.x, end.x, 0.5) - bow * 0.12 * side,
                                  lerp(root.y, end.y, 0.5) + bow * 0.5, 0);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(root.x, root.y, 0), mid, new THREE.Vector3(end.x, end.y, 0));
  });

  // 3) 판 — 맥과 맥 사이(그리고 양 끝과 뿌리 사이)
  const panelGeoms = [];
  const seq = [0, ...cuts, N];
  for (let s = 0; s < seq.length - 1; s++) {
    const a = seq[s], b = seq[s + 1];
    if (b - a < 3) continue;
    const poly = [new THREE.Vector2(root.x, root.y)];
    if (s > 0) veins[s - 1].getSpacedPoints(10).forEach((p, i) => { if (i > 0) poly.push(new THREE.Vector2(p.x, p.y)); });
    for (let i = a; i <= b && i < N; i++) poly.push(loop[i].clone());
    if (s < seq.length - 2) {
      const pts = veins[s].getSpacedPoints(10).reverse();
      pts.forEach((p, i) => { if (i < pts.length - 1) poly.push(new THREE.Vector2(p.x, p.y)); });
    }
    const shape = new THREE.Shape(ensureCCW(insetPolygon(poly, 0.026)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 1, curveSegments: 1,
    });
    g.translate(0, 0, -0.006);
    panelGeoms.push(g);
  }

  const baseMembrane = new THREE.MeshPhysicalMaterial({
    color: preset.membrane, map: maps.map, alphaMap: maps.alphaMap,
    transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
    metalness: 0.26, roughness: 0.085,
    iridescence: 1, iridescenceIOR: 2.4, iridescenceThicknessRange: preset.iridRange.slice(),
    iridescenceThicknessMap: maps.iridMap,
    clearcoat: 1, clearcoatRoughness: 0.06,
    emissive: new THREE.Color(preset.emissive), emissiveMap: maps.emissiveMap, emissiveIntensity: 0.44,
    envMapIntensity: 2.5,
  });

  const MEMBRANE_TINT = [1, 1.42, 0.72, 1.18, 0.86];
  const membraneMats = MEMBRANE_TINT.map((k, i) => {
    if (i === 0) return baseMembrane;
    const m = baseMembrane.clone();
    m.iridescenceThicknessRange = [preset.iridRange[0] * k, preset.iridRange[1] * k];
    m.userData.tint = k;
    return m;
  });
  baseMembrane.userData.tint = 1;

  const panels = new THREE.Group();
  panelGeoms.forEach((g, i) => {
    remapUV(g, box, side);
    applyCamber(g, span, side);
    const m = new THREE.Mesh(g, membraneMats[i % membraneMats.length]);
    m.renderOrder = 2;
    panels.add(m);
  });
  group.add(panels);

  // 4) 금속 뼈대 — 바깥 테두리, 앞전 대들보, 맥
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: preset.metal, metalness: 1, roughness: preset.metalRough,
    roughnessMap: metalRough, envMapIntensity: 1.25, clearcoat: 0.6, clearcoatRoughness: 0.2,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: preset.frame, metalness: 1, roughness: preset.frameRough, roughnessMap: metalRough, envMapIntensity: 0.95,
  });

  const rimCurve = new THREE.CatmullRomCurve3(loop.map((p) => new THREE.Vector3(p.x, p.y, 0)), true, 'catmullrom', 0.5);
  const rim = taperedTube(rimCurve, 0.013, 0.013, 260, 7);
  remapUV(rim, box, side); applyCamber(rim, span, side);
  group.add(new THREE.Mesh(rim, frameMat));

  // 앞전(코스타)은 두껍게 — 날개를 버티는 대들보다.
  const costaIdx = Math.round(N * (kind === 'fore' ? 0.34 : 0.22));
  const costa = new THREE.CatmullRomCurve3(loop.slice(0, costaIdx).map((p) => new THREE.Vector3(p.x, p.y, 0)), false, 'catmullrom', 0.5);
  const costaG = taperedTube(costa, 0.028, 0.013, 60, 8, 0.9);
  remapUV(costaG, box, side); applyCamber(costaG, span, side);
  group.add(new THREE.Mesh(costaG, frameMat));

  veins.forEach((v, i) => {
    const g = taperedTube(v, 0.017, 0.0062, 46, 7, 0.75);
    remapUV(g, box, side); applyCamber(g, span, side);
    group.add(new THREE.Mesh(g, frameMat));
  });

  // 5) 리벳 — 맥이 테두리에 닿는 자리와 뿌리 쪽 이음매
  const rivetGeo = new THREE.CylinderGeometry(0.0135, 0.0135, 0.03, 12);
  rivetGeo.rotateX(Math.PI / 2);
  const rivets = new THREE.InstancedMesh(rivetGeo, frameMat, cuts.length + 2);
  const dummy = new THREE.Object3D();
  cuts.forEach((ci, i) => {
    const p = loop[ci];
    const c = camberPoint(p.x, p.y, span, side);
    dummy.position.set(p.x, c.y, c.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    rivets.setMatrixAt(i, dummy.matrix);
  });
  [[root.x, root.y], [root.x + 0.06 * side, root.y + 0.03]].forEach(([x, y], i) => {
    const c = camberPoint(x, y, span, side);
    dummy.position.set(x, c.y, c.z);
    dummy.scale.setScalar(1.25);
    dummy.updateMatrix();
    rivets.setMatrixAt(cuts.length + i, dummy.matrix);
    dummy.scale.setScalar(1);
  });
  rivets.instanceMatrix.needsUpdate = true;
  group.add(rivets);

  // 뿌리 허브 — 날개가 몸에 물리는 축. 어두운 금속이라 금빛 뼈대와 대비된다.
  const hubGeo = new THREE.CylinderGeometry(0.034, 0.028, 0.046, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, jointMat);
  hub.position.set(root.x, root.y, 0);
  group.add(hub);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 8, 20), frameMat);
  collar.position.copy(hub.position);
  group.add(collar);

  group.userData = { span, membraneMats, frameMat, jointMat, tip: new THREE.Vector3(loop[cuts[Math.floor(veinCount / 2)]].x, 0, 0) };
  return group;
}

/* ══════════════════════════════════════════════════════════════
   나비 한 마리

   몸통(가슴·배·머리) + 네 장의 날개 + 태엽 장치.
   가슴 옆의 크랭크가 한 번 돌 때 날개가 정확히 한 번 친다.
   크랭크 핀과 날개 뿌리를 잇는 연결봉은 매 프레임 두 끝을
   다시 재서 길이와 각도를 맞춘다 — 실제로 물려 도는 것처럼 보인다.
   ══════════════════════════════════════════════════════════════ */
function buildButterfly(preset, maps, metalRough) {
  const root = new THREE.Group();        // 비행 경로가 움직이는 바깥 틀
  const body = new THREE.Group();        // 날갯짓 반동으로 흔들리는 몸
  root.add(body);

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: preset.metal, metalness: 1, roughness: preset.metalRough,
    roughnessMap: metalRough, envMapIntensity: 1.25, clearcoat: 0.7, clearcoatRoughness: 0.18,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: preset.frame, metalness: 1, roughness: preset.frameRough, roughnessMap: metalRough, envMapIntensity: 0.95,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x05070a, emissive: new THREE.Color(preset.core), emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.2,
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0f18, metalness: 0.7, roughness: 0.22, flatShading: true,
    emissive: new THREE.Color(preset.eye), emissiveIntensity: 0.75,
    iridescence: 1, iridescenceIOR: 2.1, iridescenceThicknessRange: [260, 620], envMapIntensity: 1.6,
  });

  /* ── 가슴 ── */
  const thoraxProfile = [
    [0, -0.16], [0.036, -0.155], [0.066, -0.132], [0.086, -0.085], [0.098, -0.02],
    [0.096, 0.05], [0.079, 0.1], [0.05, 0.135], [0.022, 0.155], [0, 0.16],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const thorax = new THREE.Mesh(new THREE.LatheGeometry(thoraxProfile, 40), metalMat);
  thorax.geometry.rotateX(Math.PI / 2);
  body.add(thorax);

  for (const z of [0.075, -0.005, -0.085]) {        // 가슴을 두른 테
    const ringG = new THREE.TorusGeometry(z === -0.005 ? 0.1 : 0.094, 0.008, 8, 44);
    const ringM = new THREE.Mesh(ringG, darkMat);
    ringM.position.z = z;
    body.add(ringM);
  }

  /* ── 배 — 마디 사이로 속의 빛이 샌다 ── */
  const abdomen = new THREE.Group();
  const SEG = 7;
  for (let i = 0; i < SEG; i++) {
    const t = i / (SEG - 1);
    const r = lerp(0.07, 0.019, Math.pow(t, 0.85));
    const prof = [
      [0, -0.026], [r * 0.6, -0.024], [r * 0.95, -0.012], [r, 0.004], [r * 0.82, 0.02], [r * 0.4, 0.026], [0, 0.027],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), i % 2 ? darkMat : metalMat);
    m.geometry.rotateX(Math.PI / 2);
    m.position.z = -0.185 - i * 0.056;
    m.userData.base = m.position.z;
    abdomen.add(m);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.008, 0.4, 12), glowMat);
  core.geometry.rotateX(Math.PI / 2);
  core.position.z = -0.35;
  abdomen.add(core);
  const coreLight = new THREE.PointLight(new THREE.Color(preset.core), 0.22, 1.6, 2);
  coreLight.position.set(0, 0.02, -0.3);
  abdomen.add(coreLight);
  body.add(abdomen);

  /* ── 머리 · 겹눈 · 더듬이 ── */
  const head = new THREE.Group();
  head.position.set(0, 0.012, 0.165);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.055, 28, 20), metalMat);
  skull.scale.set(1, 0.92, 1.05);
  head.add(skull);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.038, 1), eyeMat);
    eye.position.set(s * 0.04, 0.012, 0.022);
    eye.scale.set(0.9, 1.05, 0.9);
    head.add(eye);

    const ant = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.022, 0.042, 0.03),
      new THREE.Vector3(s * 0.1, 0.16, 0.14),
      new THREE.Vector3(s * 0.2, 0.28, 0.24),
      new THREE.Vector3(s * 0.31, 0.35, 0.3),
    ]);
    head.add(new THREE.Mesh(taperedTube(ant, 0.0085, 0.0035, 30, 6), metalMat));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), glowMat);
    bead.position.copy(ant.getPoint(1));
    bead.scale.set(1, 1, 1.7);
    head.add(bead);
    const tipLight = new THREE.PointLight(new THREE.Color(preset.core), 0.12, 0.8, 2);
    tipLight.position.copy(bead.position);
    head.add(tipLight);
  }
  const proboscis = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, 0.05), new THREE.Vector3(0, -0.07, 0.09),
    new THREE.Vector3(0, -0.1, 0.05), new THREE.Vector3(0, -0.085, 0.015),
  ]);
  head.add(new THREE.Mesh(taperedTube(proboscis, 0.007, 0.003, 26, 6), darkMat));
  body.add(head);

  /* ── 다리 세 쌍 ── */
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const z = 0.07 - i * 0.075;
      const femur = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.05, -0.05, z),
        new THREE.Vector3(s * 0.11, -0.1, z + 0.02),
        new THREE.Vector3(s * 0.14, -0.14, z + 0.04),
      ]);
      const tibia = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.14, -0.14, z + 0.04),
        new THREE.Vector3(s * 0.155, -0.19, z + 0.01),
        new THREE.Vector3(s * 0.13, -0.225, z - 0.04),
      ]);
      body.add(new THREE.Mesh(taperedTube(femur, 0.012, 0.008, 16, 6), metalMat));
      body.add(new THREE.Mesh(taperedTube(tibia, 0.008, 0.003, 16, 6), darkMat));
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), darkMat);
      knee.position.copy(femur.getPoint(1));
      body.add(knee);
    }
  }

  /* ── 날개 네 장 ── */
  const wings = [];
  const WING_SCALE = 1.0;
  for (const side of [1, -1]) {
    for (const kind of ['fore', 'hind']) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.062, kind === 'fore' ? 0.038 : -0.006, kind === 'fore' ? 0.048 : -0.03);
      const wing = buildWing(kind, side, preset, maps, metalRough, kind === 'fore' ? 20260920 : 7311);
      wing.scale.setScalar(kind === 'fore' ? 1.06 * WING_SCALE : 0.92 * WING_SCALE);
      pivot.add(wing);
      body.add(pivot);

      const tip = new THREE.Object3D();          // 불티가 태어나는 자리
      tip.position.set(side * wing.userData.span * 0.94, 0.1, 0);
      wing.add(tip);

      wings.push({ side, kind, pivot, wing, tip, sweep: kind === 'fore' ? -0.02 : 0.06 });
    }
  }

  /* ── 태엽 장치 ── */
  const gearMat = new THREE.MeshPhysicalMaterial({
    color: preset.metal, metalness: 1, roughness: preset.metalRough * 1.3,
    roughnessMap: metalRough, envMapIntensity: 1.0,
  });
  const gears = [];
  const rods = [];
  const rodGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 1, 8);
  rodGeo.rotateX(Math.PI / 2);
  rodGeo.translate(0, 0, 0.5);
  const CRANK_R = 0.052;

  for (const s of [1, -1]) {
    const crank = new THREE.Mesh(gearGeometry({ r: 0.078, teeth: 18, tooth: 0.017, thick: 0.015, hole: 0.017, spokes: 4 }), gearMat);
    crank.position.set(s * 0.082, 0.072, 0.016);
    body.add(crank);
    gears.push({ mesh: crank, side: s, ratio: 1, axis: 'x' });

    const idler = new THREE.Mesh(gearGeometry({ r: 0.044, teeth: 10, tooth: 0.014, thick: 0.013, hole: 0.013, spokes: 3 }), darkMat);
    idler.position.set(s * 0.088, 0.162, -0.042);
    body.add(idler);
    gears.push({ mesh: idler, side: s, ratio: -1.72, axis: 'x' });

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 10), darkMat);
    pin.geometry.rotateZ(Math.PI / 2);
    crank.add(pin);
    pin.position.set(0, CRANK_R, 0.014);   // 크랭크 원판 위의 편심 핀
    pin.rotation.y = Math.PI / 2;

    const rod = new THREE.Mesh(rodGeo, darkMat);
    body.add(rod);
    rods.push({ mesh: rod, side: s, pin, wing: wings.find((w) => w.side === s && w.kind === 'fore') });
  }
  // 가슴 위의 왕관 톱니 — 좌우 크랭크를 물려 주는 역할
  const crown = new THREE.Mesh(gearGeometry({ r: 0.052, teeth: 12, tooth: 0.013, thick: 0.012, hole: 0.013, spokes: 3 }), gearMat);
  crown.position.set(0, 0.128, 0.035);
  crown.rotation.x = Math.PI / 2;
  body.add(crown);
  gears.push({ mesh: crown, side: 1, ratio: 1.4, axis: 'y' });

  /* ── 움직임 ── */
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), dir = new THREE.Vector3();
  const ZAXIS = new THREE.Vector3(0, 0, 1);
  const attach = new THREE.Vector3(0.2, 0.06, 0);       // 연결봉이 물리는 날개 위의 점
  let phase = 0;

  function update(dt, t, o) {
    phase += dt * TAU * 2.05 * o.flapSpeed;      // 초당 2.05 번이 기준 속도

    for (const w of wings) {
      const lag = w.kind === 'fore' ? 0 : 0.52;
      const p = phase - lag;
      const s = Math.sin(p);
      const shaped = Math.sign(s) * Math.pow(Math.abs(s), 0.7);     // 내려치는 쪽이 더 매섭다
      const amp = (w.kind === 'fore' ? 0.84 : 0.6) * o.flapAmp;
      const base = w.kind === 'fore' ? 0.13 : 0.05;
      w.pivot.rotation.z = w.side * (base + shaped * amp);
      w.pivot.rotation.y = w.side * w.sweep + w.side * Math.cos(p) * 0.06 * o.flapAmp;
      w.wing.rotation.x = Math.PI / 2 + Math.cos(p) * 0.3 * o.flapAmp;   // 스팬 축을 따라 비트는 피치
    }

    // 날갯짓 반동 — 내려칠 때 몸이 떠오른다.
    body.position.y = Math.cos(phase) * 0.042 * o.flapAmp;
    body.rotation.x = Math.sin(phase) * 0.055 * o.flapAmp + Math.sin(t * 0.6) * 0.02;
    head.rotation.x = Math.sin(t * 0.47) * 0.06 - 0.04;
    head.rotation.y = Math.sin(t * 0.31) * 0.12;
    abdomen.rotation.x = -Math.sin(phase - 0.6) * 0.07 * o.flapAmp + 0.03;
    abdomen.children.forEach((m, i) => {
      if (m.userData.base === undefined) return;
      m.position.z = m.userData.base + Math.sin(phase * 0.5 - i * 0.4) * 0.004 * o.flapAmp;
    });
    glowMat.emissiveIntensity = 0.46 + Math.sin(phase * 0.5) * 0.14 + Math.sin(t * 2.3) * 0.06;

    for (const g of gears) {
      const a = phase * g.ratio * (g.axis === 'x' ? g.side : 1);
      if (g.axis === 'x') g.mesh.rotation.set(0, g.side * Math.PI / 2, a);
      else g.mesh.rotation.set(Math.PI / 2, 0, a);
    }

    // 비행 — 느린 8자 궤적에 기울기를 얹는다.
    const f = o.flight;
    root.position.set(Math.sin(t * 0.31) * 0.62 * f, Math.sin(t * 0.73 + 1.1) * 0.16 * f, Math.sin(t * 0.22 + 2.0) * 0.4 * f);
    root.rotation.set(Math.sin(t * 0.73) * 0.1 * f, Math.sin(t * 0.31 + 0.5) * 0.55 * f, -Math.sin(t * 0.31) * 0.26 * f);

    root.updateMatrixWorld(true);

    // 연결봉 — 핀과 날개 뿌리를 매 프레임 다시 잇는다.
    for (const r of rods) {
      r.pin.getWorldPosition(va); body.worldToLocal(va);
      vb.copy(attach);
      vb.x *= r.side;
      r.wing.wing.localToWorld(vb); body.worldToLocal(vb);
      dir.copy(vb).sub(va);
      const len = dir.length();
      r.mesh.position.copy(va);
      r.mesh.quaternion.setFromUnitVectors(ZAXIS, dir.divideScalar(len || 1));
      r.mesh.scale.set(1, 1, len);
    }
  }

  const materials = { metalMat, darkMat, glowMat, eyeMat, gearMat, wings: wings.map((w) => w.wing.userData) };
  return { root, body, wings, update, materials, coreLight, setPhase(v) { phase = v; } };
}

/* ══════════════════════════════════════════════════════════════
   배경 · 빛가루
   ══════════════════════════════════════════════════════════════ */
function buildBackdrop(preset) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(preset.bgTop) },
      uBot: { value: new THREE.Color(preset.bgBot) },
      uHalo: { value: new THREE.Color(preset.halo) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uBot, uHalo;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = smoothstep(-0.55, 0.85, d.y);
        vec3 c = mix(uBot, uTop, h);
        c += uHalo * pow(max(0.0, 1.0 - length(d.xy * vec2(0.85, 1.25))), 3.2) * 0.35;  // 아득한 후광
        c += uHalo * 0.25 * pow(max(0.0, dot(d, normalize(vec3(-0.5, 0.45, 0.6)))), 8.0);
        float n = fract(sin(dot(d.xy, vec2(12.9898, 78.233))) * 43758.5453);            // 밴딩 제거
        gl_FragColor = vec4(c + (n - 0.5) * 0.004, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// 나비 뒤에 깔리는 넓은 후광. 늘 카메라를 본다.
function buildHalo(preset, sprite) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 6.4),
    new THREE.MeshBasicMaterial({
      map: sprite, color: new THREE.Color(preset.halo), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.5,
    }),
  );
  m.renderOrder = -5;
  m.frustumCulled = false;
  return m;
}

const MOTE_VERT = /* glsl */`
  attribute float aSize, aPhase;
  uniform float uTime, uScale;
  varying float vTw;
  void main(){
    vec3 p = position;
    p.x += sin(uTime * 0.17 + aPhase) * 0.22;
    p.y += sin(uTime * 0.11 + aPhase * 1.7) * 0.3 + sin(uTime * 0.05 + aPhase * 0.4) * 0.5;
    p.z += cos(uTime * 0.13 + aPhase * 2.1) * 0.22;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vTw = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase * 6.2);
    gl_PointSize = clamp(aSize * uScale / max(0.2, -mv.z), 1.0, 90.0);
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */`
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
  varying float vTw;
  void main(){
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor * t.a * vTw * 2.0, t.a * vTw * uOpacity);
  }`;

function buildMotes(preset, sprite, count) {
  const pos = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count);
  const rand = rng(4242);
  for (let i = 0; i < count; i++) {
    const r = 1.2 + Math.pow(rand(), 0.55) * 7;
    const th = rand() * TAU, ph = Math.acos(2 * rand() - 1);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = (rand() - 0.5) * 6.5;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    size[i] = 0.006 + Math.pow(rand(), 2.6) * 0.055;
    phase[i] = rand() * TAU;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sprite }, uTime: { value: 0 }, uScale: { value: 300 },
      uColor: { value: new THREE.Color(preset.mote) }, uOpacity: { value: 0.75 },
    },
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { pts, mat };
}

/* 날개 끝에서 떨어지는 불티. 위치·수명을 CPU 에서 굴린다. */
function buildSparks(preset, sprite, count) {
  const pos = new Float32Array(count * 3), life = new Float32Array(count), size = new Float32Array(count);
  const vel = new Float32Array(count * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: sprite }, uColor: { value: new THREE.Color(preset.core) }, uScale: { value: 300 } },
    vertexShader: /* glsl */`
      attribute float aLife, aSize;
      uniform float uScale;
      varying float vL;
      void main(){
        vL = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uScale * (0.35 + 0.65 * aLife) / max(0.2, -mv.z), 1.0, 64.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uColor;
      varying float vL;
      void main(){
        if (vL <= 0.0) discard;
        vec4 t = texture2D(uMap, gl_PointCoord);
        float a = t.a * smoothstep(0.0, 0.25, vL) * vL;
        gl_FragColor = vec4(uColor * a * 3.0, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  let cursor = 0;
  const rand = rng(8181);

  function emit(p, n) {
    for (let k = 0; k < n; k++) {
      const i = cursor = (cursor + 1) % count;
      pos[i * 3] = p.x + (rand() - 0.5) * 0.05;
      pos[i * 3 + 1] = p.y + (rand() - 0.5) * 0.05;
      pos[i * 3 + 2] = p.z + (rand() - 0.5) * 0.05;
      vel[i * 3] = (rand() - 0.5) * 0.12;
      vel[i * 3 + 1] = -0.05 - rand() * 0.12;
      vel[i * 3 + 2] = (rand() - 0.5) * 0.12;
      life[i] = 1;
      size[i] = 0.012 + rand() * 0.03;
    }
    g.attributes.aSize.needsUpdate = true;
  }
  function step(dt) {
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt * 0.42;
      if (life[i] < 0) life[i] = 0;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      vel[i * 3 + 1] += dt * 0.02;              // 서서히 떠오르며 흩어진다
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.aLife.needsUpdate = true;
  }
  return { pts, mat, emit, step };
}

/* ══════════════════════════════════════════════════════════════
   포스트 프로세싱

   장면을 half-float 버퍼에 그린 뒤 ① 밝은 부분만 뽑아 ② 다섯 단계로
   줄여 가며 흐리고 ③ 원본에 더해 톤매핑(ACES)·비네팅·필름 그레인·
   색수차까지 한 번에 입힌다. three.js 애드온 없이 직접 짰다.
   ══════════════════════════════════════════════════════════════ */
const FS_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class Composer {
  constructor(renderer, levels = 5) {
    this.renderer = renderer;
    this.levels = levels;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const rt = (w, h, samples = 0) => {
      const t = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        depthBuffer: samples > 0, stencilBuffer: false, samples,
      });
      t.texture.generateMipmaps = false;
      return t;
    };
    this._rt = rt;

    this.bright = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform float uThreshold, uKnee;
        varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tSrc, vUv).rgb;
          float l = max(c.r, max(c.g, c.b));
          float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
          soft = soft * soft / (4.0 * uKnee + 1e-4);
          float w = max(soft, l - uThreshold) / max(l, 1e-4);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform vec2 uDir;
        varying vec2 vUv;
        void main(){
          vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
          s += (texture2D(tSrc, vUv + uDir * 1.3846).rgb + texture2D(tSrc, vUv - uDir * 1.3846).rgb) * 0.3162162;
          s += (texture2D(tSrc, vUv + uDir * 3.2308).rgb + texture2D(tSrc, vUv - uDir * 3.2308).rgb) * 0.0702703;
          gl_FragColor = vec4(s, 1.0);
        }`,
    });
    this.composite = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tB0: { value: null }, tB1: { value: null },
        tB2: { value: null }, tB3: { value: null }, tB4: { value: null },
        uBloom: { value: 1.0 }, uExposure: { value: 1.0 }, uTime: { value: 0 },
        uGrain: { value: 0.018 }, uVignette: { value: 0.95 }, uCA: { value: 0.0016 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene, tB0, tB1, tB2, tB3, tB4;
        uniform float uBloom, uExposure, uTime, uGrain, uVignette, uCA;
        uniform vec2 uRes;
        varying vec2 vUv;
        vec3 aces(vec3 x){
          const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c){
          return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055, step(0.0031308, c));
        }
        void main(){
          vec2 d = vUv - 0.5;
          float r2 = dot(d, d);
          vec2 off = d * uCA * (0.35 + r2 * 3.0);
          vec3 col = vec3(
            texture2D(tScene, vUv + off).r,
            texture2D(tScene, vUv).g,
            texture2D(tScene, vUv - off).b);
          vec3 b = texture2D(tB0, vUv).rgb * 0.34 + texture2D(tB1, vUv).rgb * 0.26
                 + texture2D(tB2, vUv).rgb * 0.19 + texture2D(tB3, vUv).rgb * 0.13
                 + texture2D(tB4, vUv).rgb * 0.08;
          col += b * uBloom;
          col = aces(col * uExposure);
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col *= mix(vec3(0.93, 0.975, 1.07), vec3(1.05, 1.0, 0.95), smoothstep(0.12, 0.72, lum));
          col *= 1.0 - uVignette * smoothstep(0.12, 0.78, r2);
          float n = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          col += (n - 0.5) * uGrain;
          gl_FragColor = vec4(toSRGB(col), 1.0);
        }`,
    });
  }

  setSize(w, h, samples) {
    this.dispose();
    this.w = Math.max(2, w); this.h = Math.max(2, h);
    this.rtScene = this._rt(this.w, this.h, samples);
    this.chain = [];
    let cw = this.w, ch = this.h;
    for (let i = 0; i < this.levels; i++) {
      cw = Math.max(2, Math.floor(cw / 2)); ch = Math.max(2, Math.floor(ch / 2));
      this.chain.push({ a: this._rt(cw, ch), b: this._rt(cw, ch), w: cw, h: ch });
    }
    this.composite.uniforms.uRes.value.set(this.w, this.h);
  }

  dispose() {
    if (this.rtScene) this.rtScene.dispose();
    if (this.chain) this.chain.forEach((c) => { c.a.dispose(); c.b.dispose(); });
    this.rtScene = null; this.chain = null;
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.scene, this.cam);
  }

  render(scene, camera, o) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    if (o.bloom > 0.001) {
      this.bright.uniforms.tSrc.value = this.rtScene.texture;
      this.bright.uniforms.uThreshold.value = o.threshold;
      this.pass(this.bright, this.chain[0].a);
      for (let i = 0; i < this.chain.length; i++) {
        const c = this.chain[i];
        if (i > 0) { this.blur.uniforms.tSrc.value = this.chain[i - 1].a.texture; this.blur.uniforms.uDir.value.set(0.7 / c.w, 0); this.pass(this.blur, c.b); }
        else { this.blur.uniforms.tSrc.value = c.a.texture; this.blur.uniforms.uDir.value.set(1 / c.w, 0); this.pass(this.blur, c.b); }
        this.blur.uniforms.tSrc.value = c.b.texture;
        this.blur.uniforms.uDir.value.set(0, 1 / c.h);
        this.pass(this.blur, c.a);
      }
    }
    const u = this.composite.uniforms;
    u.tScene.value = this.rtScene.texture;
    for (let i = 0; i < 5; i++) u['tB' + i].value = this.chain[Math.min(i, this.chain.length - 1)].a.texture;
    u.uBloom.value = o.bloom;
    u.uExposure.value = o.exposure;
    u.uTime.value = o.time;
    u.uGrain.value = o.grain;
    r.setRenderTarget(null);
    this.pass(this.composite, null);
  }
}

/* ══════════════════════════════════════════════════════════════
   장면 조립 · 카메라 조작 · 루프
   ══════════════════════════════════════════════════════════════ */
export function createScene(canvas, opts = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;     // 톤매핑은 합성 패스에서 직접 한다
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;      // 패스가 여러 개라 프레임 단위로 직접 모은다

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);

  /* ── 재료 ── */
  let presetKey = opts.preset && PRESETS[opts.preset] ? opts.preset : 'gold';
  let preset = PRESETS[presetKey];
  const wingMaps = makeWingMaps(preset, 20260920);
  const metalRough = makeMetalRoughnessMap(1234);
  const sprite = makeSpriteTexture();

  /* ── 환경광 ── */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let envRT = null;
  function refreshEnv() {
    const src = buildEnvTexture(preset);
    const next = pmrem.fromEquirectangular(src);
    src.dispose();
    if (envRT) envRT.dispose();
    envRT = next;
    scene.environment = envRT.texture;
  }
  refreshEnv();
  scene.environmentIntensity = 1;

  /* ── 빛 ── */
  const key = new THREE.DirectionalLight(0xfff1dc, 2.0);
  key.position.set(-2.6, 3.0, 2.4);
  const rim = new THREE.DirectionalLight(0x8fd6ff, 2.2);
  rim.position.set(2.6, 0.7, -3.0);
  const fill = new THREE.DirectionalLight(0x6a7ea8, 0.55);
  fill.position.set(0.5, -2.2, 1.2);
  scene.add(key, rim, fill);

  /* ── 구성원 ── */
  const backdrop = buildBackdrop(preset);
  scene.add(backdrop.mesh);
  const halo = buildHalo(preset, makeHaloTexture());
  scene.add(halo);

  const motes = buildMotes(preset, sprite, isMobile ? 700 : 1500);
  scene.add(motes.pts);
  const sparks = buildSparks(preset, sprite, isMobile ? 220 : 420);
  scene.add(sparks.pts);

  const bf = buildButterfly(preset, wingMaps, metalRough);
  scene.add(bf.root);

  const composer = new Composer(renderer);

  /* ── 상태 ── */
  const state = {
    flapSpeed: reduceMotion ? 0.55 : 1,
    flapAmp: 1,
    bloom: 1,
    flight: reduceMotion ? 0.25 : 1,
    autoRotate: !reduceMotion,
    sparks: true,
    paused: false,
    quality: 'auto',
    exposure: preset.exposure,
  };

  /* ── 카메라 조작 (직접 구현: OrbitControls 애드온을 쓰지 않는다) ── */
  // 화면 비율에 맞춰 처음 거리를 잡는다. 날개 폭(2.2)에 비행으로 흔들리는 폭까지
  // 더해 3.3 을 담을 거리로 물러서되, 세로로 긴 화면에서 한없이 멀어지지 않게 묶는다.
  const SPAN_TO_FIT = 3.3;
  function fitDist() {
    const vfov = camera.fov * Math.PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    return clamp((SPAN_TO_FIT / 2) / Math.tan(hfov / 2) + 0.4, 3.3, 6.2);
  }
  const view = { theta: 0.72, phi: 1.16, dist: 3.75 };
  const want = { ...view };
  const target = new THREE.Vector3(0, 0.1, 0);
  let dragging = false, lastX = 0, lastY = 0, pinch = 0, idle = 9, zoomed = false, firstFit = true;
  const pointers = new Map();

  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    dragging = true; lastX = e.clientX; lastY = e.clientY; idle = 0;
  };
  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) { want.dist = clamp(want.dist * (pinch / d), 1.9, 11); zoomed = true; }
      pinch = d;
      return;
    }
    if (!dragging) return;
    want.theta -= (e.clientX - lastX) * 0.0062;
    want.phi = clamp(want.phi - (e.clientY - lastY) * 0.0055, 0.22, Math.PI - 0.22);
    lastX = e.clientX; lastY = e.clientY; idle = 0;
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
    want.dist = clamp(want.dist * Math.exp(e.deltaY * 0.0011), 1.9, 11);
    zoomed = true; idle = 0;
  }, { passive: false });

  /* ── 크기 · 화질 ── */
  let scale = 1, samples = isMobile ? 0 : 4, W = 1, H = 1;
  const PIXEL_BUDGET = 3.2e6;      // 렌더 타깃이 11 장이라 큰 화면에서는 픽셀 수를 묶어 둔다
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
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    if (!zoomed) {                       // 손대지 않았으면 화면 비율에 맞춰 거리 잡기
      want.dist = fitDist();
      if (firstFit) { view.dist = want.dist; firstFit = false; }
    }
    composer.setSize(W, H, samples);
    const ps = H * 0.5;            // three 의 점 크기 감쇠와 같은 기준
    motes.mat.uniforms.uScale.value = ps;
    sparks.mat.uniforms.uScale.value = ps;
  }
  const ro = new ResizeObserver(() => applySize());
  ro.observe(canvas.parentElement || canvas);
  applySize();

  function setQuality(q) {
    state.quality = q;
    if (q === 'low') { scale = 0.68; samples = 0; }
    else if (q === 'high') { scale = 1; samples = isMobile ? 0 : 4; }
    else { scale = 1; samples = isMobile ? 0 : 4; }
    applySize();
  }

  /* ── 프리셋 갈아 끼우기 (형상은 그대로, 색만 바꾼다) ── */
  function applyPreset(k) {
    if (!PRESETS[k]) return;
    presetKey = k; preset = PRESETS[k];
    const m = bf.materials;
    m.metalMat.color.set(preset.metal); m.metalMat.roughness = preset.metalRough;
    m.gearMat.color.set(preset.metal); m.gearMat.roughness = preset.metalRough * 1.3;
    m.darkMat.color.set(preset.frame); m.darkMat.roughness = preset.frameRough;
    m.glowMat.emissive.set(preset.core);
    m.eyeMat.emissive.set(preset.eye);
    for (const w of m.wings) {
      for (const mm of w.membraneMats) {
        const k = mm.userData.tint || 1;
        mm.color.set(preset.membrane);
        mm.emissive.set(preset.emissive);
        mm.iridescenceThicknessRange = [preset.iridRange[0] * k, preset.iridRange[1] * k];
        mm.needsUpdate = true;
      }
      w.frameMat.color.set(preset.metal); w.frameMat.roughness = preset.metalRough;
      w.jointMat.color.set(preset.frame); w.jointMat.roughness = preset.frameRough;
    }
    bf.coreLight.color.set(preset.core);
    backdrop.mat.uniforms.uTop.value.set(preset.bgTop);
    backdrop.mat.uniforms.uBot.value.set(preset.bgBot);
    backdrop.mat.uniforms.uHalo.value.set(preset.halo);
    halo.material.color.set(preset.halo);
    motes.mat.uniforms.uColor.value.set(preset.mote);
    sparks.mat.uniforms.uColor.value.set(preset.core);
    state.exposure = preset.exposure;
    refreshEnv();
  }
  applyPreset(presetKey);

  /* ── 루프 ── */
  let last = performance.now() / 1000;
  const delta = () => { const n = performance.now() / 1000, d = n - last; last = n; return d; };
  let t = 0, raf = 0, frames = 0, acc = 0, realAcc = 0, fps = 60, tri = 0, calls = 0, autoDropped = false;
  let shotWanted = null;
  const camPos = new THREE.Vector3(), tipV = new THREE.Vector3(), camDir = new THREE.Vector3();
  let emitAcc = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const real = delta();
    realAcc += real;
    const dt = Math.min(0.05, real);
    if (state.paused) { render(dt, 0); return; }
    t += dt;
    render(dt, dt);
  }

  function render(dt, step) {
    renderer.info.reset();
    // 카메라 감쇠. 손을 뗀 뒤 잠깐(2.5초)은 자동 회전을 멈춰 둔다.
    idle = dragging ? 0 : idle + dt;
    if (state.autoRotate && idle > 2.5) want.theta += step * 0.1 * smooth(2.5, 4.0, idle);
    view.theta += (want.theta - view.theta) * Math.min(1, dt * 7);
    view.phi += (want.phi - view.phi) * Math.min(1, dt * 7);
    view.dist += (want.dist - view.dist) * Math.min(1, dt * 6);
    camPos.set(
      Math.sin(view.phi) * Math.sin(view.theta),
      Math.cos(view.phi),
      Math.sin(view.phi) * Math.cos(view.theta),
    ).multiplyScalar(view.dist).add(target);
    camera.position.copy(camPos);
    camera.lookAt(target);

    if (step > 0) {
      bf.update(step, t, state);
      motes.mat.uniforms.uTime.value = t;

      // 날개 끝 불티
      if (state.sparks) {
        emitAcc += step * state.flapSpeed;
        if (emitAcc > 0.045) {
          emitAcc = 0;
          for (const w of bf.wings) {
            if (w.kind !== 'fore') continue;
            w.tip.getWorldPosition(tipV);
            sparks.emit(tipV, 1);
          }
        }
      }
      sparks.step(step);
    }

    // 후광은 늘 나비 뒤에 선다.
    camera.getWorldDirection(camDir);
    halo.position.copy(bf.root.position).addScaledVector(camDir, 1.6);
    halo.quaternion.copy(camera.quaternion);
    halo.visible = state.bloom > 0.02;

    composer.render(scene, camera, {
      bloom: state.bloom * 0.78,
      threshold: 1.35,
      exposure: state.exposure,
      grain: 0.016,
      time: t,
    });

    if (shotWanted) { const cb = shotWanted; shotWanted = null; try { cb(canvas.toDataURL('image/png')); } catch (e) { cb(null); } }

    // 화질 자동 조정 — 60프레임 평균이 느리면 한 번 낮춘다.
    tri = renderer.info.render.triangles; calls = renderer.info.render.calls;
    frames++; acc = realAcc;
    if (acc >= 1) { fps = frames / acc; frames = 0; realAcc = 0;
      if (state.quality === 'auto' && !autoDropped && fps < 34) { autoDropped = true; scale = 0.72; samples = 0; applySize(); }
    }
  }

  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { delta(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  /* ── 바깥에서 쓰는 손잡이 ── */
  return {
    state,
    presets: PRESETS,
    get preset() { return presetKey; },
    setPreset: applyPreset,
    setQuality,
    set(k, v) { state[k] = v; },
    resetView() { want.theta = 0.72; want.phi = 1.16; want.dist = fitDist(); zoomed = false; },
    setPhase(v) { bf.setPhase(v); },       // 날갯짓 순간을 고정한다(사진 찍을 때 쓴다)
    setView(theta, phi, dist, instant = false) {
      zoomed = true;
      want.theta = theta; want.phi = clamp(phi, 0.22, Math.PI - 0.22); want.dist = clamp(dist, 1.9, 11);
      if (instant) { view.theta = want.theta; view.phi = want.phi; view.dist = want.dist; }
    },
    snapshot() { return new Promise((res) => { shotWanted = res; }); },
    info() {
      return {
        fps: Math.round(fps),
        triangles: tri,
        calls,
        size: `${W}×${H}`,
        three: THREE.REVISION,
      };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
