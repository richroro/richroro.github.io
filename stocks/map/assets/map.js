/* ══════════════════════════════════════════════════════════════════════════
   종목 3D 지도 — 표 대신 공간에 세워 보는 종목 노트

   데이터는 새로 만들지 않는다. 스크리너가 읽는 `/stocks/assets/registry.js`
   그대로를 읽어서, 고른 지표 세 개를 좌우(X)·높이(Y)·앞뒤(Z)에 배치한다.
   레지스트리에 종목이 늘면 이 화면도 같이 는다.

   숫자가 없는 회사를 조용히 빼지 않는다. 고른 지표 중 하나라도 미공시면
   왼쪽 '미공시' 선반에 흐리게 세워 둔다 — 없는 것도 보여야 한다.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  THREE, TAU, clamp, lerp, smooth, canvas2d,
  makeMetalRoughnessMap, makeSpriteTexture,
  buildEnvTexture, buildBackdrop, buildMotes, Composer,
} from '../../../assets/scene-kit.js';

const YEAR = new Date().getFullYear();
const NF = new Intl.NumberFormat('ko-KR');
const nf = (v) => NF.format(v);

/* ── 색 ── */
const PALETTE = {
  bgTop: 0x0c1526, bgBot: 0x03060d, halo: 0x17335c, mote: 0xbcd4f5,
  grid: 0x2a4066, gridHot: 0x4d7ab8, metal: 0xc9d6e8, exposure: 1.18,
  sky: [0.05, 0.08, 0.14], ground: [0.01, 0.014, 0.022],
  env: [
    { dir: [-0.5, 0.68, 0.53], ang: 0.4, color: [0.92, 0.95, 1.0], power: 8.5 },
    { dir: [0.76, 0.2, -0.61], ang: 0.3, color: [0.35, 0.7, 1.0], power: 6.5 },
    { dir: [0.2, -0.5, 0.84], ang: 0.55, color: [0.4, 0.45, 0.6], power: 1.6 },
    { dir: [0.05, 0.98, 0.15], ang: 0.16, color: [1.0, 1.0, 1.0], power: 5 },
  ],
};

// 한국 기업과의 관계 — 이 사이트에만 있는 축이다. 기본 색칠 기준으로 쓴다.
const KR_COLORS = { 공급: 0x4ade80, 고객: 0x60a5fa, 경쟁: 0xf87171, 간접: 0x94a3b8 };
const KR_NOTE = { 공급: '한국 기업이 납품한다', 고객: '한국 기업이 사 온다', 경쟁: '같은 시장에서 겨룬다', 간접: '직접 거래는 옅다' };
const GROUP_COLORS = {
  m7: 0x60a5fa, semi: 0x4ade80, soft: 0xa78bfa, fin: 0xfbbf24,
  consumer: 0xf472b6, health: 0x22d3ee, frontier: 0xfb923c,
};

/* ── 지표 ── */
const pct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%';
const pctPlain = (v) => v.toFixed(1) + '%';
const bil = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : (v * 1000).toFixed(0) + 'M$');

export const METRICS = {
  rev: { label: '매출', short: '매출', unit: 'B$', log: true, fmt: (v) => (v >= 1 ? bil(v) + 'B$' : bil(v)) },
  growth: { label: '매출 성장률', short: '성장률', unit: '%', log: false, fmt: pct, signed: true },
  om: { label: '영업이익률', short: '영업이익률', unit: '%', log: false, fmt: pctPlain, signed: true },
  nm: { label: '순이익률', short: '순이익률', unit: '%', log: false, fmt: pctPlain, signed: true },
  gm: { label: '총마진', short: '총마진', unit: '%', log: false, fmt: pctPlain },
  emp: { label: '임직원', short: '임직원', unit: '명', log: true, fmt: (v) => nf(Math.round(v)) + '명' },
  revPer: { label: '1인당 매출', short: '1인당 매출', unit: '$', log: true, fmt: (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M$' : Math.round(v / 1e3) + 'K$' },
  age: { label: '업력', short: '업력', unit: '년', log: false, fmt: (v) => Math.round(v) + '년' },
  topShare: { label: '최대 부문 비중', short: '최대 부문', unit: '%', log: false, fmt: pctPlain },
};

/* 레지스트리 한 줄 → 지도가 쓰는 한 줄. 파생 지표 정의는 스크리너와 같게 맞춘다. */
export function toRows(registry) {
  return registry.filter((r) => r.data).map((r) => {
    const d = r.data, p = r.p || {};
    return {
      slug: r.slug, tk: r.tk, ko: r.ko, ab: r.ab, c: r.c, sector: r.sector, group: r.group,
      kr: r.kr, hint: r.hint, fy: d.fy, cur: d.cur || '$',
      href: (r.base || '/m7/') + r.slug + '/',
      rev: d.rev, growth: d.growth == null ? null : d.growth, gm: d.gm == null ? null : d.gm,
      om: d.oi == null ? null : (d.oi / d.rev) * 100,
      nm: d.ni == null ? null : (d.ni / d.rev) * 100,
      emp: d.emp || null,
      revPer: d.emp ? (d.rev * 1e9) / d.emp : null,
      age: p.est ? YEAR - p.est : null,
      topShare: d.top ? (d.top.v / d.top.of) * 100 : null,
      topK: d.top ? d.top.k : null,
      ex: p.ex || null, hq: p.hq || null, ceo: p.ceo || null,
    };
  });
}

/* ── 축 눈금: 사람이 읽을 만한 값으로 끊는다 ── */
function niceTicks(min, max, log, want = 5) {
  if (log) {
    const decades = Math.log10(max / Math.max(min, 1e-6));
    const mult = decades > 3.2 ? [1] : [1, 3];
    const out = [];
    for (let e = Math.floor(Math.log10(Math.max(min, 1e-6))); e <= Math.ceil(Math.log10(max)); e++) {
      for (const m of mult) {
        const v = m * Math.pow(10, e);
        if (v >= min * 0.95 && v <= max * 1.05) out.push(v);
      }
    }
    return out.length > 1 ? out : [min, max];
  }
  const span = max - min || 1;
  const raw = span / (want - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= raw * 0.999) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.01; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/* 값 → 축 위의 자리(-span/2 ~ span/2).

   이익률 같은 축은 한두 곳(적자 폭이 매출의 30배인 회사 같은)이 범위를 통째로
   끌고 간다. 그러면 나머지가 한 줄에 뭉쳐 아무것도 안 보인다. 그래서 범위는
   분위수(8~92%)로 잡고, 그 바깥값은 가장자리에 붙인 뒤 '붙었다'고 표시한다.
   카드에는 언제나 진짜 숫자를 보여 준다. */
function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function makeScale(rows, key, span) {
  const m = METRICS[key];
  const vals = rows.map((r) => r[key]).filter((v) => v != null && (!m.log || v > 0)).sort((a, b) => a - b);
  const min = vals[0], max = vals[vals.length - 1];
  let lo = min, hi = max;
  if (!m.log) {
    const q1 = quantile(vals, 0.08), q2 = quantile(vals, 0.92);
    const pad = (q2 - q1) * 0.18 || Math.abs(q2 || 1) * 0.2;
    lo = q1 - pad; hi = q2 + pad;
    if (m.signed && lo > 0) lo = 0;                       // % 축은 0 을 담아 둔다
    if (min > lo - (hi - lo) * 0.6) lo = Math.min(lo, min);   // 꼬리가 짧으면 그냥 다 담는다
    if (max < hi + (hi - lo) * 0.6) hi = Math.max(hi, max);
  } else {
    const k = (hi / lo) ** 0.04;
    lo /= k; hi *= k;
  }
  if (lo === hi) { lo -= 1; hi += 1; }
  const t = (v) => (m.log ? Math.log10(Math.max(v, 1e-6)) : v);
  const [tl, th] = [t(lo), t(hi)];
  const raw = (v) => ((t(v) - tl) / (th - tl || 1)) * span - span / 2;
  return {
    key, metric: m, lo, hi, min, max,
    at: (v) => clamp(raw(v), -span / 2, span / 2),
    outside: (v) => v < lo || v > hi,
    ticks: niceTicks(lo, hi, m.log).filter((v) => v >= lo * 0.999 && v <= hi * 1.001),
  };
}

/* ── 회사 칩: 티커를 캔버스에 그려 텍스처로 쓴다(폰트 파일 없이) ── */
function chipTexture(row) {
  const W = 256, H = 128;
  const [c, x] = canvas2d(W, H);
  const r = 22;
  x.fillStyle = 'rgba(8,12,20,0.88)';
  x.beginPath();
  x.moveTo(r, 2); x.arcTo(W - 2, 2, W - 2, H - 2, r); x.arcTo(W - 2, H - 2, 2, H - 2, r);
  x.arcTo(2, H - 2, 2, 2, r); x.arcTo(2, 2, W - 2, 2, r); x.closePath();
  x.fill();
  x.strokeStyle = row.c; x.lineWidth = 5; x.stroke();
  x.fillStyle = row.c;
  x.fillRect(16, 26, 8, H - 52);
  x.fillStyle = '#ffffff';
  x.font = '700 52px "IBM Plex Mono", "SF Mono", ui-monospace, monospace';
  x.textBaseline = 'middle';
  x.fillText(row.tk, 38, 52);
  x.fillStyle = 'rgba(210,225,245,0.72)';
  x.font = '500 30px "IBM Plex Sans KR", "Pretendard", "Apple SD Gothic Neo", sans-serif';
  x.fillText(row.ko.length > 8 ? row.ko.slice(0, 7) + '…' : row.ko, 38, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ══════════════════════════════════════════════════════════════
   장면
   ══════════════════════════════════════════════════════════════ */
const HALF = 4.5;          // 바닥 한 변의 절반
const YBASE = 0.55;        // 바닥에서 띄우는 높이
const YSPAN = 4.4;         // 높이 축이 쓰는 범위
const PARK_X = -HALF - 1.7;

export function createMap(canvas, rows, opts = {}) {
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
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);

  /* 환경광 · 배경 · 먼지 */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envSrc = buildEnvTexture(PALETTE);
  const envRT = pmrem.fromEquirectangular(envSrc);
  envSrc.dispose();
  scene.environment = envRT.texture;
  scene.add(buildBackdrop(PALETTE).mesh);
  const sprite = makeSpriteTexture();
  const motes = buildMotes(PALETTE, sprite, isMobile ? 350 : 700);
  motes.pts.position.y = 2;
  scene.add(motes.pts);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-6, 9, 6);
  const rim = new THREE.DirectionalLight(0x7fc4ff, 1.2); rim.position.set(7, 2, -8);
  scene.add(key, rim);
  const metalRough = makeMetalRoughnessMap(77);

  /* ── 격자 ── */
  const gridMat = new THREE.LineBasicMaterial({ color: PALETTE.grid, transparent: true, opacity: 0.34 });
  const gridHotMat = new THREE.LineBasicMaterial({ color: PALETTE.gridHot, transparent: true, opacity: 0.7 });
  const gridGroup = new THREE.Group();
  scene.add(gridGroup);

  function rebuildGrid(sx, sy, sz) {
    gridGroup.clear();
    const soft = [], hot = [];
    const line = (a, b, arr) => arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const yAt = (v) => sy.at(v) + YBASE + YSPAN / 2;

    for (const t of sx.ticks) {                       // 바닥: X 눈금 선
      const x = sx.at(t);
      line(V(x, 0, -HALF), V(x, 0, HALF), Math.abs(t) < 1e-9 ? hot : soft);
      line(V(x, 0, -HALF), V(x, YBASE + YSPAN, -HALF), soft);   // 뒷벽 세로선
    }
    for (const t of sz.ticks) {                       // 바닥: Z 눈금 선
      const z = sz.at(t);
      line(V(-HALF, 0, z), V(HALF, 0, z), Math.abs(t) < 1e-9 ? hot : soft);
      line(V(-HALF, 0, z), V(-HALF, YBASE + YSPAN, z), soft);   // 왼벽 세로선
    }
    for (const t of sy.ticks) {                       // 높이 눈금: 두 벽에 가로선
      const y = yAt(t);
      const arr = Math.abs(t) < 1e-9 ? hot : soft;
      line(V(-HALF, y, -HALF), V(HALF, y, -HALF), arr);
      line(V(-HALF, y, -HALF), V(-HALF, y, HALF), arr);
    }
    const mk = (arr, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      gridGroup.add(new THREE.LineSegments(g, mat));
    };
    mk(soft, gridMat); mk(hot, gridHotMat);

    // 미공시 선반
    const shelf = [];
    line(V(PARK_X - 0.75, 0.02, -HALF * 0.75), V(PARK_X - 0.75, 0.02, HALF * 0.75), shelf);
    line(V(PARK_X + 0.75, 0.02, -HALF * 0.75), V(PARK_X + 0.75, 0.02, HALF * 0.75), shelf);
    mk(shelf, gridMat);
  }

  /* ── 회사 하나 ── */
  const dotGeo = new THREE.CircleGeometry(0.075, 18).rotateX(-Math.PI / 2);
  const pillarGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, 0.5, 0);
  const chipGeo = new THREE.PlaneGeometry(0.72, 0.36);
  const nodes = [];
  const pickables = [];
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);

  for (const row of rows) {
    const col = new THREE.Color(row.c);
    const r = 0.1 + 0.115 * clamp(Math.log10(Math.max(row.rev, 0.1)) / 2.7, 0, 1.4);
    const node = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 2),
      new THREE.MeshPhysicalMaterial({
        color: col, metalness: 0.95, roughness: 0.22, roughnessMap: metalRough,
        envMapIntensity: 1.5, clearcoat: 0.6, clearcoatRoughness: 0.2,
        emissive: col, emissiveIntensity: 0.18,
      }),
    );
    const tex = chipTexture(row);
    const chip = new THREE.Mesh(chipGeo, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 1,
    }));
    chip.renderOrder = 3;
    const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.28, depthWrite: false,
    }));
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.45, depthWrite: false,
    }));
    nodeGroup.add(node, chip, pillar, dot);
    const rec = {
      row, node, chip, pillar, dot, tex, radius: r,
      pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
      t: 1, parked: false, clamped: false, dim: 0, dimTarget: 0, hot: 0,
    };
    node.userData.rec = rec;
    chip.userData.rec = rec;
    nodes.push(rec);
    pickables.push(node, chip);
  }

  /* ── 배치 ── */
  let scales = null;
  const state = {
    x: opts.x || 'growth', y: opts.y || 'nm', z: opts.z || 'rev',
    colorBy: opts.colorBy || 'kr', filter: '전체',
    autoRotate: !reduceMotion, labels: true,
  };
  let parkedCount = 0;

  function colorFor(row) {
    if (state.colorBy === 'kr') return KR_COLORS[row.kr] ?? 0x94a3b8;
    if (state.colorBy === 'group') return GROUP_COLORS[row.group] ?? 0x94a3b8;
    return row.c;                                   // 회사 고유색
  }

  function relayout(animate = true) {
    scales = {
      x: makeScale(rows, state.x, HALF * 2),
      y: makeScale(rows, state.y, YSPAN),
      z: makeScale(rows, state.z, HALF * 2),
    };
    rebuildGrid(scales.x, scales.y, scales.z);
    const park = new Set(nodes.filter((n) => [state.x, state.y, state.z].some((k) => n.row[k] == null)));
    parkedCount = park.size;
    [...park].forEach((n, i) => {
      const per = Math.max(1, Math.ceil(park.size / 2));
      const col = i % per, rowi = Math.floor(i / per);
      n.parked = true;
      n.to.set(PARK_X + rowi * 0.9, YBASE + 0.1, lerp(-HALF * 0.66, HALF * 0.66, per === 1 ? 0.5 : col / (per - 1)));
    });
    for (const n of nodes) {
      if (park.has(n)) continue;
      n.parked = false;
      n.to.set(scales.x.at(n.row[state.x]), scales.y.at(n.row[state.y]) + YBASE + YSPAN / 2, scales.z.at(n.row[state.z]));
      n.clamped = ['x', 'y', 'z'].some((a) => scales[a].outside(n.row[state[a]]));
    }
    for (const n of nodes) {
      n.from.copy(n.pos);
      n.t = animate ? 0 : 1;
      if (!animate) n.pos.copy(n.to);
    }
    if (opts.onLayout) opts.onLayout({ scales, parked: parkedCount, park: [...park].map((n) => n.row) });
  }

  function recolor() {
    for (const n of nodes) {
      const c = new THREE.Color(colorFor(n.row));
      n.node.material.color.copy(c);
      n.node.material.emissive.copy(c);
      n.pillar.material.color.copy(c);
      n.dot.material.color.copy(c);
      n.tex.dispose();
      n.tex = chipTexture({ ...n.row, c: '#' + c.getHexString() });
      n.chip.material.map = n.tex;
      n.chip.material.needsUpdate = true;
    }
  }

  function applyFilter() {
    for (const n of nodes) {
      const on = state.filter === '전체' || n.row.sector === state.filter || n.row.group === state.filter;
      n.dimTarget = on ? 0 : 1;
    }
  }

  /* ── 눈금 글씨는 HTML 로 얹는다. 3D 폰트를 싣지 않아도 또렷하다. ── */
  const host = opts.labelHost;
  let labels = [];
  function rebuildLabels() {
    labels.forEach((l) => l.el.remove());
    labels = [];
    if (!host) return;
    const add = (text, v, cls) => {
      const el = document.createElement('div');
      el.className = 'lab ' + (cls || '');
      el.textContent = text;
      host.appendChild(el);
      labels.push({ el, v });
    };
    const yAt = (t) => scales.y.at(t) + YBASE + YSPAN / 2;
    for (const t of scales.x.ticks) add(scales.x.metric.fmt(t), new THREE.Vector3(scales.x.at(t), 0, HALF + 0.35), 'tick');
    for (const t of scales.z.ticks) add(scales.z.metric.fmt(t), new THREE.Vector3(HALF + 0.35, 0, scales.z.at(t)), 'tick');
    for (const t of scales.y.ticks) add(scales.y.metric.fmt(t), new THREE.Vector3(-HALF - 0.3, yAt(t), -HALF), 'tick');
    add(METRICS[state.x].label + ' →', new THREE.Vector3(0, -0.45, HALF + 1.15), 'axis');
    add(METRICS[state.z].label + ' →', new THREE.Vector3(HALF + 1.15, -0.45, 0), 'axis');
    add('↑ ' + METRICS[state.y].label, new THREE.Vector3(-HALF - 0.3, YBASE + YSPAN + 0.55, -HALF), 'axis');
    if (parkedCount) add('미공시 ' + parkedCount + '곳', new THREE.Vector3(PARK_X, YBASE + 1.55, 0), 'axis park');
  }

  /* ── 카메라 ── */
  // 격자와 미공시 선반이 같이 들어오도록 화면 비율에 맞춰 물러선다.
  const target = new THREE.Vector3(-0.7, YBASE + YSPAN / 2 - 0.35, 0);
  function fitDist() {
    const vh = (camera.fov * Math.PI / 180) / 2;
    const hh = Math.atan(Math.tan(vh) * camera.aspect);
    return clamp(Math.max(6.3 / Math.tan(hh), 4.7 / Math.tan(vh)), 11, 22);
  }
  const view = { theta: 0.72, phi: 1.14, dist: 15 };
  const want = { ...view };
  let zoomed = false, firstFit = true;
  let dragging = false, moved = 0, lastX = 0, lastY = 0, pinch = 0, idle = 9;
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
      if (pinch) { want.dist = clamp(want.dist * (pinch / d), 5, 34); zoomed = true; }
      pinch = d; return;
    }
    if (!dragging) return;
    moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
    want.theta -= (e.clientX - lastX) * 0.006;
    want.phi = clamp(want.phi - (e.clientY - lastY) * 0.005, 0.12, Math.PI / 2 - 0.02);
    lastX = e.clientX; lastY = e.clientY; idle = 0;
  };
  const onUp = (e) => {
    if (pointers.size === 1 && moved < 6 && hovered && opts.onPick) opts.onPick(hovered.row);
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
    want.dist = clamp(want.dist * Math.exp(e.deltaY * 0.0012), 5, 34);
    zoomed = true; idle = 0;
  }, { passive: false });

  /* ── 크기 ── */
  const composer = new Composer(renderer);
  let W = 1, H = 1;
  const PIXEL_BUDGET = 3.2e6;
  let scale = 1, samples = isMobile ? 0 : 4;
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
    if (!zoomed) {
      want.dist = fitDist();
      if (firstFit) { view.dist = want.dist; firstFit = false; }
    }
    composer.setSize(W, H, samples);
    motes.mat.uniforms.uScale.value = H * 0.5;
  }
  const ro = new ResizeObserver(() => applySize());
  ro.observe(canvas.parentElement || canvas);

  relayout(false);
  rebuildLabels();
  recolor();
  applySize();

  /* ── 루프 ── */
  let last = performance.now() / 1000, raf = 0, t = 0, hovered = null, fps = 60, frames = 0, acc = 0;
  const up = new THREE.Vector3(0, 1, 0), proj = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    const rect = canvas.getBoundingClientRect();
    const now = performance.now() / 1000;
    const elapsed = now - last;                  // 진짜 경과 시간
    const dt = Math.min(0.05, elapsed);          // 애니메이션에 먹이는 값
    last = now; t += dt; acc += elapsed; frames++;   // fps 는 진짜 시간으로 재야 한다
    if (acc >= 1) { fps = frames / acc; frames = 0; acc = 0; }

    idle += dragging ? -idle : dt;
    if (state.autoRotate && idle > 2.5) want.theta += dt * 0.09 * smooth(2.5, 4, idle);
    view.theta += (want.theta - view.theta) * Math.min(1, dt * 7);
    view.phi += (want.phi - view.phi) * Math.min(1, dt * 7);
    view.dist += (want.dist - view.dist) * Math.min(1, dt * 6);
    camera.position.set(
      Math.sin(view.phi) * Math.sin(view.theta),
      Math.cos(view.phi),
      Math.sin(view.phi) * Math.cos(view.theta),
    ).multiplyScalar(view.dist).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    // 짚어 보기
    ray.setFromCamera(ndc, camera);
    const hit = ndc.x > -1.5 ? ray.intersectObjects(pickables, false)[0] : null;
    const next = hit ? hit.object.userData.rec : null;
    if (next !== hovered) { hovered = next; if (opts.onHover) opts.onHover(hovered ? hovered.row : null); }
    canvas.style.cursor = hovered ? 'pointer' : (dragging ? 'grabbing' : 'grab');

    for (const n of nodes) {
      if (n.t < 1) {
        n.t = Math.min(1, n.t + dt / 0.85);
        n.pos.lerpVectors(n.from, n.to, smooth(0, 1, n.t));
      } else n.pos.copy(n.to);

      n.dim += (n.dimTarget - n.dim) * Math.min(1, dt * 6);
      n.hot += ((hovered === n ? 1 : 0) - n.hot) * Math.min(1, dt * 12);

      const s = (1 + n.hot * 0.45) * (1 - n.dim * 0.35);
      n.node.position.copy(n.pos);
      n.node.scale.setScalar(s);
      n.node.material.emissiveIntensity = 0.18 + n.hot * 0.9;
      n.node.material.opacity = 1;
      n.node.material.wireframe = n.clamped && !n.parked;   // 범위 밖이라 가장자리에 붙은 회사

      n.pillar.position.set(n.pos.x, 0, n.pos.z);
      n.pillar.scale.set(1, Math.max(0.01, n.pos.y), 1);
      n.pillar.material.opacity = (n.parked ? 0.08 : 0.26) * (1 - n.dim * 0.8) + n.hot * 0.4;
      n.dot.position.set(n.pos.x, 0.015, n.pos.z);
      n.dot.material.opacity = 0.42 * (1 - n.dim * 0.8) + n.hot * 0.4;

      n.chip.position.copy(n.pos).addScaledVector(up, n.radius + 0.3);
      n.chip.quaternion.copy(camera.quaternion);
      const far = clamp((camera.position.distanceTo(n.pos) - 9) / 16, 0, 1);
      n.chip.visible = state.labels && (n.hot > 0.5 || n.dim < 0.7);
      n.chip.material.opacity = clamp((1 - far * 0.6) * (1 - n.dim * 0.85) + n.hot, 0, 1);
      n.chip.scale.setScalar((1 + n.hot * 0.25) * (0.92 + far * 0.5));
    }

    // 이름표 자리 다툼 — 지도에 지명 얹듯, 카메라에 가까운 것부터 자리를 잡고
    // 이미 놓인 이름표와 겹치면 접는다. 짚고 있는 회사는 언제나 남긴다.
    if (state.labels) {
      const fovK = rect.height / (2 * Math.tan((camera.fov * Math.PI / 180) / 2));
      const cand = [];
      for (const n of nodes) {
        if (!n.chip.visible) continue;
        proj.copy(n.chip.position).project(camera);
        if (proj.z > 1) { n.chip.visible = false; continue; }
        const d = camera.position.distanceTo(n.chip.position);
        const sc = fovK / Math.max(0.1, d);
        cand.push({
          n, d,
          x: (proj.x * 0.5 + 0.5) * rect.width, y: (-proj.y * 0.5 + 0.5) * rect.height,
          w: 0.72 * n.chip.scale.x * sc * 0.5 + 3, h: 0.36 * n.chip.scale.y * sc * 0.5 + 2,
        });
      }
      cand.sort((a, b) => a.d - b.d);
      const placed = [];
      for (const c of cand) {
        const keep = c.n.hot > 0.5 || !placed.some((p) =>
          Math.abs(p.x - c.x) < p.w + c.w && Math.abs(p.y - c.y) < p.h + c.h);
        c.n.chip.visible = keep;
        if (keep) placed.push(c);
      }
    }

    // 눈금 글씨 얹기
    if (host) {
      for (const l of labels) {
        proj.copy(l.v).project(camera);
        const vis = proj.z < 1 && Math.abs(proj.x) < 0.95 && Math.abs(proj.y) < 0.95 && state.labels;
        l.el.style.display = vis ? 'block' : 'none';
        if (!vis) continue;
        l.el.style.transform = `translate(-50%,-50%) translate(${(proj.x * 0.5 + 0.5) * rect.width}px,${(-proj.y * 0.5 + 0.5) * rect.height}px)`;
      }
    }

    motes.mat.uniforms.uTime.value = t;
    renderer.info.reset();
    composer.render(scene, camera, { bloom: 0.62, threshold: 1.2, exposure: PALETTE.exposure, grain: 0.012, time: t });
  }
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now() / 1000; raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  return {
    state, metrics: METRICS,
    setAxis(which, keyName) {
      if (!METRICS[keyName] || !'xyz'.includes(which)) return;
      state[which] = keyName;
      relayout(true); rebuildLabels();
    },
    setColorBy(mode) { state.colorBy = mode; recolor(); },
    setFilter(f) { state.filter = f; applyFilter(); },
    setLabels(on) { state.labels = on; },
    setAutoRotate(on) { state.autoRotate = on; },
    resetView() { want.theta = 0.72; want.phi = 1.14; want.dist = fitDist(); zoomed = false; },
    focus(slug) {                                   // 표에서 넘어온 회사로 시선을 옮긴다
      const n = nodes.find((x) => x.row.slug === slug);
      if (!n) return;
      want.theta = Math.atan2(n.pos.x, n.pos.z) + 0.6;
      want.dist = Math.max(8.5, fitDist() * 0.62);
      zoomed = true;
      hovered = n;
      if (opts.onHover) opts.onHover(n.row);
    },
    info: () => ({ fps: Math.round(fps), size: `${W}×${H}`, parked: parkedCount, tri: renderer.info.render.triangles }),
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
