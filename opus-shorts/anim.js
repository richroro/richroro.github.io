/* 한 줄의 프롬프트 — Opus 5.5 팬메이드 애니메이션 쇼츠
 * 1080×1920 캔버스에 시간 t(초)를 넣으면 그 순간의 프레임을 그린다.
 * 같은 t 에는 항상 같은 그림이 나오도록(결정적) 난수도 시드로만 쓴다.
 * 브라우저 재생(index.html)과 MP4 렌더(tools/render.mjs)가 이 파일 하나를 같이 쓴다. */
(function (root) {
  'use strict';

  const W = 1080, H = 1920, DUR = 31, FPS = 30;
  const G = 1400;           // 땅 높이
  const R0 = 110;           // 캐릭터 반지름
  const C = {
    ink: '#0b0d1a', cream: '#fff4e0', orange: '#ff8a3d', orange2: '#ffc08a',
    teal: '#3ee6c1', pink: '#ff4f8b', red: '#ff3b4f', yellow: '#ffd84d',
    green: '#5be37d', purple: '#8b6cff', mute: '#8e93b8'
  };
  const FH = '"Black Han Sans","Noto Sans KR",sans-serif';
  const FK = '"Noto Sans KR",sans-serif';
  const FM = '"JetBrains Mono",ui-monospace,monospace';

  /* ---------- 유틸 ---------- */
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const inv = (a, b, t) => clamp((t - a) / (b - a));
  const eOut = p => 1 - Math.pow(1 - p, 3);
  const eIn = p => p * p * p;
  const eIO = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const eBack = p => { if (p <= 0) return 0; if (p >= 1) return 1; const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const eEl = p => p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI) / 3) + 1;
  function rng(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let r = Math.imul(seed ^ seed >>> 15, 1 | seed);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, p) {
    const x = hex(a), y = hex(b);
    return `rgb(${Math.round(lerp(x[0], y[0], p))},${Math.round(lerp(x[1], y[1], p))},${Math.round(lerp(x[2], y[2], p))})`;
  }
  // 도약 궤적: s 에 떠서 d 초 뒤 착지, 높이 h
  function hop(t, s, d, h) { if (t < s || t > s + d) return 0; const p = (t - s) / d; return -4 * h * p * (1 - p); }

  /* ---------- 미리 만들어 두는 무작위 요소 ---------- */
  const STARS = (() => { const r = rng(7), a = []; for (let i = 0; i < 140; i++) a.push({ x: r() * W, y: r() * 1300, s: .8 + r() * 2.6, ph: r() * 6.28, sp: 1 + r() * 3 }); return a; })();
  const CONFETTI = (() => { const r = rng(42), a = [], cols = [C.orange, C.teal, C.pink, C.yellow, C.purple, C.cream]; for (let i = 0; i < 90; i++) a.push({ vx: (r() - .5) * 1500, vy: -900 - r() * 900, c: cols[i % cols.length], w: 14 + r() * 16, h: 8 + r() * 10, rot: r() * 6, vr: (r() - .5) * 14 }); return a; })();
  const GLYPHS = ['</>', '{ }', 'fn()', '=>', ';', '[ ]', '::', '( )', '#', '++', '&&', '<>'];

  // 캐릭터가 톡톡 튈 때마다 하나씩 세워지는 구조물
  const HOP0 = 9.2, HOPD = .5, HOPGAP = .8;
  const BUILDS = [
    { type: 'tree', x: 150, s: 1.15, fore: true },
    { type: 'house', x: 330, s: 1.05, fore: true, col: '#ff6b8b' },
    { type: 'house', x: 780, s: .95, fore: true, col: '#8b6cff' },
    { type: 'tower', x: 950, s: 1, fore: true },
    { type: 'tree', x: 250, s: .7, fore: false },
    { type: 'mill', x: 660, s: .8, fore: false },
    { type: 'tower', x: 440, s: .62, fore: false },
    { type: 'balloon', x: 820, s: 1, fore: false }
  ].map((b, k) => Object.assign(b, { launch: HOP0 + k * HOPGAP + HOPD, pop: HOP0 + k * HOPGAP + HOPD + .32 }));

  const TYPED = '작은 세계 하나 만들어줘';
  const TEXTS = [
    TYPED, '> ', '생각 중…', '좋아요, 시작할게요', 'opus-5.5 — zsh',
    '프롬프트 딱 한 줄', '넣어봤더니…', 'Opus 5.5가', '깨어났다', '코드 한 줄이', '세계 하나로',
    'BUILD', '완성', '앗, 버그다!', 'ERROR', 'TypeError', 'undefined', '쾅!', '해결', '에러도', '알아서 수습',
    '그리고 왜인지', '자전거 타는 펠리컨', 'Claude Opus 5.5', '한 줄의 프롬프트, 하나의 세계',
    '토큰 단가 20%↓', '출력 속도 30%↑', 'fan-made · richroro.github.io', '0123456789%!?✓✻', GLYPHS.join('')
  ];

  /* ---------- 공통 그리기 ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function fitFont(ctx, text, size, family, weight, maxW) {
    ctx.font = `${weight} ${size}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w > maxW) { size = size * maxW / w; ctx.font = `${weight} ${size}px ${family}`; }
    return size;
  }

  // 상단 자막: 줄마다 튀어나오고 끝날 때 줄어든다
  function caption(ctx, t, t0, t1, lines) {
    if (t < t0 || t > t1) return;
    const out = eIn(inv(t1 - .28, t1, t));
    lines.forEach((ln, i) => {
      if (typeof ln === 'string') ln = { text: ln };
      const p = eBack(inv(t0 + i * .14, t0 + i * .14 + .38, t));
      if (p <= 0) return;
      ctx.save();
      ctx.translate(W / 2, 250 + i * 150);
      const s = Math.max(0, p * (1 - out));
      ctx.scale(s, s);
      ctx.rotate((ln.tilt || 0) * Math.PI / 180);
      const size = fitFont(ctx, ln.text, 112, FH, 400, 900);
      const w = ctx.measureText(ln.text).width;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (ln.bg) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, -w / 2 - 34, -size * .66 + 10, w + 68, size * 1.32, 26); ctx.fill();
        ctx.fillStyle = ln.bg; rr(ctx, -w / 2 - 34, -size * .66, w + 68, size * 1.32, 26); ctx.fill();
      } else {
        ctx.lineJoin = 'round'; ctx.lineWidth = 20; ctx.strokeStyle = C.ink; ctx.strokeText(ln.text, 0, 6);
      }
      ctx.fillStyle = ln.color || '#fff';
      ctx.fillText(ln.text, 0, 6);
      ctx.restore();
    });
  }

  function sparkle(ctx, x, y, r, rot, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rad = i % 2 ? r * .28 : r;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------- 배경 ---------- */
  function sky(ctx, t) {
    const d = eIO(inv(21.6, 23.6, t));   // 밤 → 새벽
    const e = eIO(inv(26.8, 27.6, t));   // → 엔딩
    const top = mix(mix('#05060d', '#2a1b58', d), '#0b0d1a', e);
    const mid = mix(mix('#0d1030', '#ff6f91', d), '#1a1236', e);
    const bot = mix(mix('#1a1745', '#ffc46b', d), '#3a1a3a', e);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(.62, mid); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const sa = inv(4.4, 6.2, t) * (1 - d) + e * .8;
    if (sa > 0) {
      for (const s of STARS) {
        const tw = .45 + .55 * Math.sin(t * s.sp + s.ph);
        ctx.globalAlpha = sa * tw; ctx.fillStyle = '#fff';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }
    // 해
    if (d > 0 && e < 1) {
      const sy = lerp(1560, 1060, eOut(inv(21.8, 24.6, t)));
      const glow = ctx.createRadialGradient(540, sy, 60, 540, sy, 560);
      glow.addColorStop(0, 'rgba(255,220,140,.75)'); glow.addColorStop(1, 'rgba(255,160,120,0)');
      ctx.globalAlpha = d * (1 - e);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe3a1'; ctx.beginPath(); ctx.arc(540, sy, 200, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function hills(ctx, t) {
    const p = eOut(inv(8.8, 9.8, t));
    if (p <= 0) return;
    const d = eIO(inv(21.6, 23.6, t));
    const layers = [
      { amp: 70, base: G - 150, col: mix('#1c1a4a', '#b0587f', d), f: .006, ph: 1 },
      { amp: 50, base: G - 60, col: mix('#241f55', '#d9707d', d), f: .009, ph: 4 }
    ];
    layers.forEach((L, i) => {
      const off = (1 - p) * (300 + i * 100);
      ctx.fillStyle = L.col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) {
        const y = L.base + off - L.amp * (.6 + .4 * Math.sin(x * L.f + L.ph) + .25 * Math.sin(x * L.f * 2.7 + L.ph * 2));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    });
  }

  function ground(ctx, t) {
    // 2장: 허공 위의 빛나는 선
    const lineP = eOut(inv(4.9, 5.4, t)) * (1 - inv(9.4, 10.2, t));
    if (lineP > 0) {
      ctx.save();
      ctx.shadowColor = C.teal; ctx.shadowBlur = 30;
      ctx.strokeStyle = C.teal; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(540 - 450 * lineP, G); ctx.lineTo(540 + 450 * lineP, G); ctx.stroke();
      ctx.restore();
    }
    // 3장부터: 가운데서 바깥으로 깔리는 타일
    const TW = 90;
    const d = eIO(inv(21.6, 23.6, t));
    for (let c = 0; c < 12; c++) {
      const st = 9.0 + Math.abs(c - 5.5) * .07;
      const p = eBack(inv(st, st + .4, t));
      if (p <= 0) continue;
      const x = c * TW, y = G + (1 - p) * 500;
      ctx.fillStyle = mix('#2b1f4a', '#6b3f5e', d); ctx.fillRect(x, y, TW + 1, H - G + 10);
      ctx.fillStyle = mix('#2fbf9b', '#4fd89a', d); ctx.fillRect(x, y, TW + 1, 22);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, TW + 1, 6);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + ((c * 37 + k * 23) % 70) + 6, y + 60 + k * 90 + (c % 3) * 20, 16, 16);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + TW - 3, y, 3, H - G);
    }
  }

  /* ---------- 구조물 ---------- */
  function drawBuild(ctx, b, t) {
    const p = eBack(inv(b.pop, b.pop + .45, t));
    if (p <= 0) return;
    const d = eIO(inv(21.6, 23.6, t));
    ctx.save();
    // 버그 구간에 가장 오른쪽 탑이 지직거린다
    let gx = 0;
    if (b.type === 'tower' && b.fore) {
      const gl = glitchAmt(t);
      if (gl > 0) { const r = rng(Math.floor(t * 30) + 11); gx = (r() - .5) * 40 * gl; }
    }
    if (b.type === 'balloon') {
      const by = lerp(G - 100, 640, eOut(inv(b.pop, b.pop + 2.2, t))) + Math.sin(t * 1.5) * 14;
      ctx.translate(b.x, by); ctx.scale(clamp(p, 0, 1.3), clamp(p, 0, 1.3));
      balloon(ctx);
      ctx.restore(); return;
    }
    ctx.translate(b.x + gx, G);
    ctx.scale(b.s * (0.7 + 0.3 * p), b.s * p);
    if (!b.fore) ctx.globalAlpha = .9;
    const dim = b.fore ? 0 : .35;
    if (b.type === 'tree') tree(ctx, dim, d);
    if (b.type === 'house') house(ctx, b.col, dim, d, t);
    if (b.type === 'tower') tower(ctx, dim, d, t);
    if (b.type === 'mill') mill(ctx, dim, t);
    ctx.restore();
    if (b.type === 'tower' && b.fore && glitchAmt(t) > .2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * glitchAmt(t);
      ctx.translate(b.x + gx + 14, G); ctx.scale(b.s, b.s); ctx.filter = 'none';
      ctx.fillStyle = C.red; ctx.fillRect(-60, -420, 120, 420);
      ctx.restore();
    }
  }
  function shade(col, dim) { return dim ? mix(col.length === 7 ? col : '#ffffff', '#1a1745', dim) : col; }
  function tree(ctx, dim) {
    ctx.fillStyle = shade('#7a4a2a', dim); ctx.fillRect(-14, -120, 28, 120);
    const leaves = [[0, -170, 80, '#2fbf7a'], [-40, -230, 62, '#3ee6a0'], [38, -225, 58, '#3ee6c1'], [0, -290, 52, '#7af0b8']];
    for (const [x, y, r, c] of leaves) { ctx.fillStyle = shade(c, dim); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(-18, -300, 16, 0, 7); ctx.fill();
  }
  function house(ctx, col, dim, d, t) {
    ctx.fillStyle = shade('#fff1dc', dim); ctx.fillRect(-100, -180, 200, 180);
    ctx.fillStyle = shade(col, dim);
    ctx.beginPath(); ctx.moveTo(-125, -175); ctx.lineTo(0, -290); ctx.lineTo(125, -175); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade('#6b3f2a', dim); rr(ctx, -28, -100, 56, 100, [28, 28, 0, 0]); ctx.fill();
    const lit = 1 - d * .6;
    ctx.fillStyle = `rgba(255,216,77,${lit})`; ctx.fillRect(-80, -150, 40, 40); ctx.fillRect(40, -150, 40, 40);
    ctx.strokeStyle = shade('#6b3f2a', dim); ctx.lineWidth = 6; ctx.strokeRect(-80, -150, 40, 40); ctx.strokeRect(40, -150, 40, 40);
    ctx.fillStyle = shade('#c9b8a6', dim); ctx.fillRect(50, -280, 30, 70);
  }
  function tower(ctx, dim, d, t) {
    ctx.fillStyle = shade('#3a3f7a', dim); ctx.fillRect(-60, -420, 120, 420);
    ctx.fillStyle = shade('#4b52a0', dim); ctx.fillRect(-60, -420, 20, 420);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {
      const on = ((r * 3 + c) * 7) % 5 !== 0;
      ctx.fillStyle = on ? `rgba(255,216,77,${.95 - d * .5})` : 'rgba(0,0,0,.3)';
      ctx.fillRect(-42 + c * 32, -390 + r * 54, 20, 30);
    }
    ctx.strokeStyle = shade('#aab', dim); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -420); ctx.lineTo(0, -500); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 6) > 0 ? C.red : '#661a24'; ctx.beginPath(); ctx.arc(0, -505, 12, 0, 7); ctx.fill();
  }
  function mill(ctx, dim, t) {
    ctx.fillStyle = shade('#e8d9c4', dim);
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-30, -300); ctx.lineTo(30, -300); ctx.lineTo(50, 0); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(0, -300); ctx.rotate(t * 1.6);
    ctx.fillStyle = shade('#ff8a3d', dim);
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-14, -180, 28, 170); }
    ctx.fillStyle = shade('#5a3a2a', dim); ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
    ctx.restore();
  }
  function balloon(ctx) {
    ctx.strokeStyle = '#d8c3a0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-22, 80); ctx.moveTo(40, 0); ctx.lineTo(22, 80); ctx.stroke();
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(-26, 78, 52, 40);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -90, 100, 115, 0, 0, 7); ctx.clip();
    const cols = [C.pink, C.cream, C.orange, C.cream, C.teal];
    for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(-100 + i * 40, -210, 40, 260); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-45, -140, 18, 34, -.3, 0, 7); ctx.fill();
  }

  /* ---------- 코드 조각 비행 ---------- */
  function glyphs(ctx, t) {
    BUILDS.forEach((b, k) => {
      for (let j = 0; j < 3; j++) {
        const s = b.launch + j * .05, p = inv(s, b.pop - .02, t);
        if (t < s || t > b.pop + .02) continue;
        const tx = b.type === 'balloon' ? b.x : b.x, ty = b.type === 'balloon' ? G - 160 : G - 160 * b.s;
        const sx = 540, sy = G - R0 - 20;
        const mx = (sx + tx) / 2, my = Math.min(sy, ty) - 380 - j * 40;
        const q = eIO(p);
        const x = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * tx;
        const y = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * ty;
        ctx.save(); ctx.translate(x, y); ctx.rotate((q - .5) * 1.2);
        ctx.font = `700 ${46 - j * 6}px ${FM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = C.teal; ctx.shadowBlur = 24;
        ctx.fillStyle = j === 1 ? C.yellow : C.teal;
        ctx.fillText(GLYPHS[(k * 3 + j) % GLYPHS.length], 0, 0);
        ctx.restore();
      }
      // 도착 순간 반짝
      const fp = inv(b.pop, b.pop + .35, t);
      if (fp > 0 && fp < 1) {
        const ty = b.type === 'balloon' ? G - 160 : G - 160 * b.s;
        ctx.globalAlpha = 1 - fp;
        sparkle(ctx, b.x, ty, 40 + 90 * fp, fp * 2, C.cream);
        ctx.globalAlpha = 1;
      }
    });
  }

  /* ---------- 캐릭터 ---------- */
  const BLINKS = [7.55, 11.9, 14.6, 20.9, 23.1, 28.7];
  function faceAt(t) {
    let mood = 'normal';
    if ((t > 7.8 && t < 8.5) || (t > 16.3 && t < 17.4) || (t > 22.7 && t < 23.9)) mood = 'surprised';
    if (t >= 17.4 && t < 18.6) mood = 'determined';
    if ((t >= 19.1 && t < 21) || t >= 24.9) mood = 'happy';
    // 시선
    let lx = 0, ly = 0;
    if (t > 6.4 && t < 6.9) lx = -eOut(inv(6.4, 6.55, t));
    if (t >= 6.9 && t < 7.35) lx = lerp(-1, 1, eIO(inv(6.9, 7.1, t)));
    if (t >= 7.35 && t < 7.6) lx = lerp(1, 0, eIO(inv(7.35, 7.5, t)));
    if (t >= 9 && t < 16) { const k = Math.floor((t - HOP0) / HOPGAP); const b = BUILDS[clamp(k, 0, 7)]; lx = clamp((b.x - 540) / 400, -1, 1) * .8; ly = b.type === 'balloon' ? -1 : .1; }
    if (t >= 16.2 && t < 19) { lx = 1; ly = 0; }
    if (t >= 22.4 && t < 26.6) { const px = pelX(t); lx = clamp((px - 540) / 300, -1, 1); ly = .2; }
    if (t >= 26.6) { lx = 0; ly = 0; }
    let blink = 1;
    for (const b of BLINKS) { const q = inv(b, b + .16, t); if (q > 0 && q < 1) blink = Math.abs(1 - 2 * q); }
    return { mood, lx, ly, blink };
  }

  function charState(t) {
    let x = 540, y = G - R0, r = R0, sx = 1, sy = 1, rot = 0;
    // 3장 톡톡
    for (let k = 0; k < 8; k++) {
      const s = HOP0 + k * HOPGAP;
      y += hop(t, s, HOPD, 150);
      const pre = inv(s - .1, s, t) * (1 - inv(s, s + .04, t));
      const land = inv(s + HOPD, s + HOPD + .06, t) * (1 - inv(s + HOPD + .06, s + HOPD + .2, t));
      sx += .16 * (pre + land); sy -= .18 * (pre + land);
      if (t > s && t < s + HOPD) { sx -= .08; sy += .1; }
    }
    // 4장 버그 퇴치
    if (t >= 17.8 && t < 18.2) { const q = inv(17.8, 18.2, t); sx += .18 * q; sy -= .2 * q; x -= 30 * q; }
    if (t >= 18.2 && t < 18.5) { const q = eIn(inv(18.2, 18.5, t)); x = lerp(510, 650, q); sx = 1.25; sy = .82; }
    if (t >= 18.5 && t < 19.6) { const q = eOut(inv(18.5, 18.9, t)); x = lerp(650, 600, q); y += hop(t, 18.5, .4, 60); }
    if (t >= 19.6 && t < 20.4) { x = lerp(600, 540, eIO(inv(19.6, 20.2, t))); y += hop(t, 19.6, .45, 70); }
    // 5장 펠리컨 뛰어넘기 + 환호
    y += hop(t, 24.05, .9, 480);
    y += hop(t, 25.5, .45, 120) + hop(t, 26.0, .45, 120);
    if (t > 24.05 && t < 24.95) rot = Math.PI * 2 * eIO(inv(24.05, 24.95, t));
    const l2 = inv(24.95, 25.02, t) * (1 - inv(25.02, 25.2, t));
    sx += .2 * l2; sy -= .22 * l2;
    // 6장 엔딩: 가운데로 떠오름
    const e = eIO(inv(27.0, 27.9, t));
    if (e > 0) { y = lerp(y, 860 + Math.sin(t * 2.4) * 16, e); r = lerp(R0, 150, e); }
    return { x, y, r, sx, sy, rot };
  }

  function drawShadow(ctx, x, y, r) {
    const hgt = clamp((G - r - y) / 400);
    ctx.fillStyle = `rgba(0,0,0,${.35 * (1 - hgt * .7)})`;
    ctx.beginPath(); ctx.ellipse(x, G + 6, r * (1 - hgt * .5), 18 * (1 - hgt * .5), 0, 0, 7); ctx.fill();
  }

  function drawBody(ctx, r) {
    const g = ctx.createRadialGradient(-r * .35, -r * .45, r * .1, 0, 0, r);
    g.addColorStop(0, C.orange2); g.addColorStop(.7, C.orange); g.addColorStop(1, '#e8611f');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,138,61,.8)'; ctx.shadowBlur = 50;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(-r * .42, -r * .5, r * .2, r * .12, -.6, 0, 7); ctx.fill();
  }

  function drawFace(ctx, r, f, open) {
    const k = r / R0;
    const ex = 38 * k, ey = -12 * k, ox = f.lx * 16 * k, oy = f.ly * 10 * k;
    ctx.fillStyle = 'rgba(255,79,139,.45)';
    ctx.beginPath(); ctx.ellipse(-62 * k + ox * .5, 26 * k, 18 * k, 11 * k, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(62 * k + ox * .5, 26 * k, 18 * k, 11 * k, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1030'; ctx.strokeStyle = '#1b1030'; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const cx = s * ex + ox, cy = ey + oy;
      if (f.mood === 'happy') {
        ctx.lineWidth = 10 * k; ctx.beginPath(); ctx.arc(cx, cy + 10 * k, 18 * k, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        continue;
      }
      const big = f.mood === 'surprised' ? 1.3 : 1;
      const h = 24 * k * big * f.blink * open, w = 13 * k * big;
      ctx.beginPath(); ctx.ellipse(cx, cy, w, Math.max(h, 2), 0, 0, 7); ctx.fill();
      if (h > 8) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 4 * k, cy - 9 * k * big, 5 * k, 0, 7); ctx.fill(); ctx.fillStyle = '#1b1030'; }
      if (f.mood === 'determined') {
        ctx.lineWidth = 9 * k; ctx.beginPath();
        ctx.moveTo(cx - s * 22 * k, cy - 42 * k); ctx.lineTo(cx + s * 12 * k, cy - 30 * k); ctx.stroke();
      }
    }
    // 입
    ctx.lineWidth = 8 * k;
    const mx = ox * .6, my = 30 * k + oy * .5;
    ctx.beginPath();
    if (f.mood === 'surprised') { ctx.ellipse(mx, my + 6 * k, 10 * k, 13 * k, 0, 0, 7); ctx.fill(); }
    else if (f.mood === 'happy') { ctx.arc(mx, my - 4 * k, 22 * k, .1 * Math.PI, .9 * Math.PI); ctx.closePath(); ctx.fill(); }
    else if (f.mood === 'determined') { ctx.moveTo(mx - 14 * k, my + 4 * k); ctx.lineTo(mx + 14 * k, my + 4 * k); ctx.stroke(); }
    else { ctx.arc(mx, my - 6 * k, 12 * k, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
  }

  function drawChar(ctx, t) {
    if (t < 4.3) return;
    // 2장: 커서 블록이 떨어져서 동그랗게 변한다
    if (t < 5.95) {
      const st = cursorStart(ctx);
      const fall = eIn(inv(4.35, 4.95, t));
      const morph = eIO(inv(5.2, 5.9, t));
      let w = 34, h = 64;
      let cx = st.x, bottom = lerp(st.y + 32, G, fall);
      const squash = inv(4.95, 5.02, t) * (1 - inv(5.02, 5.2, t));
      w *= 1 + .5 * squash; h *= 1 - .4 * squash;
      w = lerp(w, R0 * 2, morph); h = lerp(h, R0 * 2, morph);
      cx = lerp(st.x, 540, eIO(inv(5.05, 5.7, t)));
      const rad = lerp(4, R0, morph);
      drawShadow(ctx, cx, bottom - h / 2, w / 2);
      ctx.save();
      ctx.translate(cx, bottom - h / 2);
      if (fall < 1) ctx.rotate(fall * .5);
      ctx.shadowColor = 'rgba(255,138,61,.9)'; ctx.shadowBlur = 40;
      ctx.fillStyle = C.orange; rr(ctx, -w / 2, -h / 2, w, h, Math.min(rad, w / 2, h / 2)); ctx.fill();
      ctx.restore();
      if (morph > 0 && morph < 1) {
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 + t * 3;
          ctx.globalAlpha = Math.sin(morph * Math.PI);
          sparkle(ctx, cx + Math.cos(a) * (140 + morph * 60), bottom - h / 2 + Math.sin(a) * (140 + morph * 60), 22, t * 4, C.cream);
        }
        ctx.globalAlpha = 1;
      }
      return;
    }
    const s = charState(t), f = faceAt(t);
    const e = inv(27.0, 27.9, t);
    if (e < 1) { ctx.globalAlpha = 1 - e; drawShadow(ctx, s.x, s.y, s.r); ctx.globalAlpha = 1; }
    ctx.save();
    ctx.translate(s.x, s.y + s.r); // 발밑 기준으로 찌그러뜨린다
    ctx.scale(s.sx, s.sy);
    ctx.translate(0, -s.r);
    ctx.rotate(s.rot);
    // 머리 위 반짝이 안테나
    const ap = eBack(inv(5.95, 6.35, t));
    if (ap > 0) {
      ctx.strokeStyle = '#e8611f'; ctx.lineWidth = 8 * s.r / R0; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -s.r + 4); ctx.quadraticCurveTo(10, -s.r - 30 * ap, 0, -s.r - 46 * ap * s.r / R0); ctx.stroke();
      ctx.save(); ctx.shadowColor = C.yellow; ctx.shadowBlur = 30;
      sparkle(ctx, 0, -s.r - 58 * ap * s.r / R0, 26 * ap * s.r / R0, t * 1.5, C.yellow);
      ctx.restore();
    }
    drawBody(ctx, s.r);
    const open = eBack(inv(5.95, 6.2, t));
    drawFace(ctx, s.r, f, open);
    ctx.restore();
    // 느낌표
    const ex = inv(7.8, 8.6, t);
    if (ex > 0 && ex < 1) {
      const p = eBack(inv(7.8, 8.0, t)) * (1 - inv(8.45, 8.6, t));
      ctx.save(); ctx.translate(s.x + 120, s.y - 170); ctx.scale(p, p); ctx.rotate(.15);
      ctx.font = `400 130px ${FH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 16; ctx.strokeStyle = C.ink; ctx.strokeText('!', 0, 0);
      ctx.fillStyle = C.yellow; ctx.fillText('!', 0, 0); ctx.restore();
    }
  }

  /* ---------- 1장: 터미널 ---------- */
  function termText(t) { const n = Math.floor(inv(.6, 2.6, t) * TYPED.length + .0001); return TYPED.slice(0, n); }
  function cursorStart(ctx) {
    ctx.font = `900 56px ${FK}`;
    return { x: 196 + ctx.measureText(TYPED).width + 26, y: 880 };
  }
  function terminal(ctx, t) {
    if (t > 4.9) return;
    const out = eIn(inv(4.3, 4.85, t));
    const inP = eOut(inv(0, .5, t));
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(540, 930); const sc = (.92 + .08 * inP) * (1 - .15 * out); ctx.scale(sc, sc); ctx.translate(-540, -930);
    ctx.shadowColor = 'rgba(62,230,193,.25)'; ctx.shadowBlur = 60;
    ctx.fillStyle = '#10132a'; rr(ctx, 80, 720, 920, 420, 34); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2a2f5f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#171b3a'; rr(ctx, 80, 720, 920, 78, [34, 34, 0, 0]); ctx.fill();
    [['#ff5f57', 136], ['#febc2e', 176], ['#28c840', 216]].forEach(([c, x]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 759, 11, 0, 7); ctx.fill(); });
    ctx.font = `700 28px ${FM}`; ctx.fillStyle = C.mute; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('opus-5.5 — zsh', 560, 760);
    ctx.textAlign = 'left';
    ctx.font = `700 56px ${FM}`; ctx.fillStyle = C.orange; ctx.fillText('>', 130, 880);
    const txt = termText(t);
    ctx.font = `900 56px ${FK}`; ctx.fillStyle = C.cream; ctx.fillText(txt, 196, 882);
    const w = ctx.measureText(txt).width;
    const typing = t > .6 && t < 2.7;
    const on = typing || Math.floor(t * 2.4) % 2 === 0;
    if (on && t < 4.3) { ctx.fillStyle = C.orange; ctx.fillRect(196 + w + 10, 848, 34, 64); }
    // 엔터 후 생각 줄
    if (t > 3.0) {
      const p = eOut(inv(3.0, 3.25, t));
      ctx.globalAlpha = (1 - out) * p;
      ctx.save(); ctx.shadowColor = C.orange; ctx.shadowBlur = 20;
      sparkle(ctx, 150, 1000, 22, t * 5, C.orange); ctx.restore();
      ctx.font = `900 44px ${FK}`; ctx.fillStyle = C.teal;
      const dots = '.'.repeat(1 + Math.floor(t * 4) % 3);
      ctx.fillText(t < 3.8 ? '생각 중' + dots : '좋아요, 시작할게요', 190, 1002);
    }
    ctx.restore();
    // 엔터 치는 순간 번쩍
    const fl = inv(3.0, 3.25, t);
    if (fl > 0 && fl < 1) { ctx.fillStyle = `rgba(255,244,224,${.18 * (1 - fl)})`; ctx.fillRect(0, 0, W, H); }
  }

  /* ---------- 진행 바 ---------- */
  function buildHud(ctx, t) {
    const p = eBack(inv(9.3, 9.7, t)) * (1 - eIn(inv(15.9, 16.2, t)));
    if (p <= 0) return;
    let done = 0; BUILDS.forEach(b => { done += eOut(inv(b.pop, b.pop + .3, t)); });
    const pct = Math.round(done / BUILDS.length * 100);
    ctx.save(); ctx.translate(540, 560); ctx.scale(p, p);
    ctx.fillStyle = 'rgba(16,19,42,.85)'; rr(ctx, -300, -44, 600, 88, 44); ctx.fill();
    ctx.strokeStyle = 'rgba(62,230,193,.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = `700 30px ${FM}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = C.teal; ctx.fillText('BUILD', -266, 2);
    ctx.fillStyle = '#262a55'; rr(ctx, -150, -12, 300, 24, 12); ctx.fill();
    ctx.fillStyle = pct >= 100 ? C.green : C.teal; rr(ctx, -150, -12, Math.max(24, 300 * pct / 100), 24, 12); ctx.fill();
    ctx.textAlign = 'right'; ctx.fillStyle = C.cream;
    ctx.font = `${pct >= 100 ? 900 : 700} 30px ${pct >= 100 ? FK : FM}`;
    ctx.fillText(pct >= 100 ? '✓ 완성' : pct + '%', 272, 2);
    ctx.restore();
  }

  /* ---------- 4장: 버그 ---------- */
  function glitchAmt(t) {
    if (t < 16.25 || t > 19.0) return 0;
    const base = inv(16.25, 16.5, t) * (1 - inv(18.5, 19.0, t));
    const r = rng(Math.floor(t * 12) + 99)();
    return base * (r > .45 ? 1 : .25);
  }
  function bugPos(t) { return { x: lerp(1220, 830, eOut(inv(16.0, 17.3, t))), y: G - 52 }; }
  function drawBug(ctx, t) {
    if (t < 16 || t > 18.55) return;
    const b = bugPos(t);
    const walking = t < 17.3;
    ctx.save(); ctx.translate(b.x, b.y + Math.sin(t * 30) * (walking ? 3 : 0));
    if (t > 18.45) { const q = inv(18.45, 18.55, t); ctx.scale(1 + q * .5, 1 - q * .6); }
    ctx.strokeStyle = '#2a0a12'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const lx = -40 + i * 40, sw = walking ? Math.sin(t * 22 + i * 2) * 14 : 0;
      ctx.beginPath(); ctx.moveTo(lx, 20); ctx.lineTo(lx - 16 + sw, 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx + 6, 20); ctx.lineTo(lx + 22 - sw, 52); ctx.stroke();
    }
    ctx.fillStyle = C.red; ctx.shadowColor = C.red; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.ellipse(0, 0, 78, 52, 0, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2a0a12'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(10, -52); ctx.lineTo(10, 50); ctx.stroke();
    ctx.fillStyle = '#2a0a12';
    [[-30, -18, 12], [40, -14, 10], [-10, 22, 10], [44, 24, 8]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    // 머리
    ctx.beginPath(); ctx.arc(-76, -6, 34, 0, 7); ctx.fill();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-90, -36); ctx.quadraticCurveTo(-110, -80, -130, -76); ctx.moveTo(-72, -38); ctx.quadraticCurveTo(-80, -86, -60, -92); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-86, -10, 9, 0, 7); ctx.arc(-66, -10, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-98, -30); ctx.lineTo(-80, -22); ctx.moveTo(-54, -30); ctx.lineTo(-72, -22); ctx.stroke();
    ctx.restore();
  }
  function errorChips(ctx, t) {
    const labels = ['ERROR', 'TypeError', 'undefined'];
    const pos = [[870, 900], [700, 1040], [930, 1150]];
    labels.forEach((l, i) => {
      const s = 16.5 + i * .35;
      const p = eBack(inv(s, s + .3, t)) * (1 - eIn(inv(18.5, 18.75, t)));
      if (p <= 0) return;
      const jit = rng(Math.floor(t * 20) + i)();
      ctx.save(); ctx.translate(pos[i][0] + (jit - .5) * 10, pos[i][1]); ctx.scale(p, p); ctx.rotate((i - 1) * .08);
      ctx.font = `700 34px ${FM}`; const w = ctx.measureText(l).width;
      ctx.fillStyle = C.red; rr(ctx, -w / 2 - 22, -30, w + 44, 60, 14); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, 0, 2);
      ctx.restore();
    });
  }
  function bonk(ctx, t) {
    const p = inv(18.5, 19.15, t);
    if (p <= 0 || p >= 1) return;
    const cx = 745, cy = G - 110;
    ctx.save(); ctx.globalAlpha = 1 - eIn(p);
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 12; ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, r1 = 60 + 200 * eOut(p), r2 = r1 + 60 * (1 - p);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    }
    // 연기
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 1;
      ctx.fillStyle = 'rgba(255,244,224,.8)';
      ctx.beginPath(); ctx.arc(830 + Math.cos(a) * 90 * eOut(p), G - 60 + Math.sin(a) * 60 * eOut(p), 46 * (1 - p) + 10, 0, 7); ctx.fill();
    }
    ctx.restore();
    const tp = eBack(inv(18.5, 18.7, t)) * (1 - eIn(inv(19.0, 19.15, t)));
    ctx.save(); ctx.translate(720, G - 380); ctx.rotate(-.14); ctx.scale(tp, tp);
    ctx.font = `400 190px ${FH}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 26; ctx.strokeStyle = C.ink; ctx.strokeText('쾅!', 0, 0);
    ctx.fillStyle = C.yellow; ctx.fillText('쾅!', 0, 0);
    ctx.restore();
  }
  function butterfly(ctx, t) {
    if (t < 18.6 || t > 22.4) return;
    const p = inv(18.6, 22.4, t);
    const x = lerp(830, 1000, p) + Math.sin(t * 3) * 90, y = lerp(G - 80, 380, eOut(p)) + Math.sin(t * 5) * 30;
    const flap = Math.abs(Math.sin(t * 16));
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 1 - inv(21.8, 22.4, t);
    ctx.scale(eBack(inv(18.6, 18.9, t)), eBack(inv(18.6, 18.9, t)));
    ctx.shadowColor = C.teal; ctx.shadowBlur = 30; ctx.fillStyle = C.teal;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * 26 * (.3 + .7 * flap), -14, 30 * (.3 + .7 * flap), 38, s * .4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 20 * (.3 + .7 * flap), 22, 20 * (.3 + .7 * flap), 24, -s * .4, 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.fillStyle = C.ink; rr(ctx, -6, -30, 12, 64, 6); ctx.fill();
    ctx.restore();
  }
  function fixedStamp(ctx, t) {
    const p = inv(19.0, 21.0, t);
    if (p <= 0 || p >= 1) return;
    const s = lerp(2.4, 1, eOut(inv(19.0, 19.2, t))) * (1 - eIn(inv(20.7, 21.0, t)));
    ctx.save(); ctx.translate(540, 620); ctx.rotate(-.12); ctx.scale(s, s);
    ctx.globalAlpha = clamp(inv(19.0, 19.1, t));
    ctx.strokeStyle = C.green; ctx.lineWidth = 12;
    rr(ctx, -210, -80, 420, 160, 30); ctx.stroke();
    ctx.fillStyle = 'rgba(91,227,125,.15)'; ctx.fill();
    ctx.font = `400 104px ${FH}`; ctx.fillStyle = C.green; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✓ 해결', 0, 6);
    ctx.restore();
  }
  function glitchPost(ctx, t) {
    const g = glitchAmt(t);
    if (g <= 0) return;
    const r = rng(Math.floor(t * 30) + 5);
    const cv = ctx.canvas;
    for (let i = 0; i < 9 * g; i++) {
      const y = r() * H, h = 20 + r() * 110, dx = (r() - .5) * 120 * g;
      ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);
    }
    ctx.fillStyle = `rgba(255,40,70,${.16 * g})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${.2 * g})`;
    for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3);
  }

  /* ---------- 5장: 자전거 타는 펠리컨 ---------- */
  function pelX(t) { return lerp(-280, 1360, inv(22.4, 26.6, t)); }
  function drawPelican(ctx, t) {
    if (t < 22.4 || t > 26.7) return;
    const x = pelX(t), wy = G - 72, wr = 70;
    const ang = (x + 280) / wr;
    ctx.save(); ctx.translate(x, Math.abs(Math.sin(ang * 1.5)) * -4);
    // 목도리 (펄럭)
    ctx.strokeStyle = C.red; ctx.lineWidth = 18; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, G - 285);
    for (let i = 1; i <= 6; i++) ctx.lineTo(30 - i * 30, G - 285 + Math.sin(t * 14 - i * .9) * 12 + i * 6);
    ctx.stroke();
    // 바퀴
    for (const wx of [-100, 100]) {
      ctx.strokeStyle = '#1b1030'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(wx, wy, wr, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(27,16,48,.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const a = ang + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); ctx.stroke(); }
    }
    // 프레임
    const crank = { x: 0, y: wy - 4 };
    ctx.strokeStyle = C.teal; ctx.lineWidth = 12; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-100, wy); ctx.lineTo(crank.x, crank.y); ctx.lineTo(80, wy - 120); ctx.lineTo(-40, wy - 120); ctx.lineTo(-100, wy);
    ctx.moveTo(-40, wy - 120); ctx.lineTo(crank.x, crank.y); ctx.moveTo(80, wy - 120); ctx.lineTo(100, wy); ctx.moveTo(80, wy - 120); ctx.lineTo(70, wy - 170); ctx.lineTo(105, wy - 175); ctx.stroke();
    ctx.fillStyle = '#1b1030'; rr(ctx, -80, wy - 138, 70, 18, 9); ctx.fill();
    // 다리 (페달)
    const hip = { x: -30, y: wy - 150 };
    for (const ph of [0, Math.PI]) {
      const pa = ang + ph, px = crank.x + Math.cos(pa) * 32, py = crank.y + Math.sin(pa) * 32;
      const mx = (hip.x + px) / 2 + 34, my = (hip.y + py) / 2 - 10;
      ctx.strokeStyle = ph ? '#e8911f' : '#ffab3d'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(mx, my); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = ph ? '#e8911f' : '#ffab3d'; ctx.beginPath(); ctx.ellipse(px + 8, py, 18, 7, 0, 0, 7); ctx.fill();
    }
    // 몸통
    ctx.fillStyle = '#f7f3ee';
    ctx.beginPath(); ctx.ellipse(-30, wy - 200, 95, 62, -.25, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9d2cc'; ctx.beginPath(); ctx.ellipse(-55, wy - 200, 62, 34, -.35, 0, 7); ctx.fill();
    // 날개 끝으로 핸들 잡기
    ctx.strokeStyle = '#d9d2cc'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-10, wy - 205); ctx.quadraticCurveTo(60, wy - 210, 100, wy - 176); ctx.stroke();
    // 목과 머리
    ctx.strokeStyle = '#f7f3ee'; ctx.lineWidth = 34; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(20, wy - 230); ctx.quadraticCurveTo(70, wy - 260, 40, wy - 320); ctx.stroke();
    ctx.fillStyle = '#f7f3ee'; ctx.beginPath(); ctx.arc(46, wy - 332, 34, 0, 7); ctx.fill();
    // 부리 + 주머니
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.moveTo(66, wy - 345); ctx.lineTo(210, wy - 322); ctx.lineTo(70, wy - 318); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.moveTo(70, wy - 320); ctx.quadraticCurveTo(140, wy - 250 + Math.sin(t * 10) * 6, 205, wy - 322); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(52, wy - 342, 7, 0, 7); ctx.fill();
    // 헬멧
    ctx.fillStyle = C.purple; ctx.beginPath(); ctx.arc(40, wy - 350, 34, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.restore();
    // 흙먼지
    for (let i = 0; i < 5; i++) {
      const age = (t * 3 + i / 5) % 1;
      ctx.fillStyle = `rgba(255,244,224,${.35 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(x - 150 - age * 120, G - 10 - age * 30, 10 + age * 18, 0, 7); ctx.fill();
    }
  }
  function confetti(ctx, t) {
    const s = 24.95;
    if (t < s || t > s + 3) return;
    const dt = t - s;
    ctx.save(); ctx.globalAlpha = 1 - inv(s + 2.2, s + 3, t);
    for (const c of CONFETTI) {
      const x = 540 + c.vx * dt * .6, y = G - 200 + c.vy * dt + 900 * dt * dt;
      ctx.save(); ctx.translate(x, y); ctx.rotate(c.rot + c.vr * dt); ctx.scale(1, Math.abs(Math.cos(c.vr * dt * 1.3)) + .15);
      ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- 6장: 엔딩 ---------- */
  function ending(ctx, t) {
    const e = eIO(inv(27.0, 27.7, t));
    if (e <= 0) return;
    ctx.fillStyle = `rgba(11,13,26,${.9 * e})`; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(540, 860, 40, 540, 860, 520);
    g.addColorStop(0, `rgba(255,138,61,${.5 * e})`); g.addColorStop(1, 'rgba(255,138,61,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 궤도를 도는 반짝이
    for (let i = 0; i < 8; i++) {
      const a = t * .8 + i * Math.PI / 4, rr_ = 290 + Math.sin(t * 2 + i) * 20;
      ctx.globalAlpha = e * (.5 + .5 * Math.sin(t * 3 + i));
      sparkle(ctx, 540 + Math.cos(a) * rr_, 860 + Math.sin(a) * rr_ * .55, 14 + (i % 3) * 6, t * 2 + i, i % 2 ? C.teal : C.yellow);
    }
    ctx.globalAlpha = 1;
  }
  function endText(ctx, t) {
    const a = eBack(inv(27.7, 28.2, t));
    if (a <= 0) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(540, 1200); ctx.scale(a, a);
    fitFont(ctx, 'Claude Opus 5.5', 150, FH, 400, 960);
    const full = ctx.measureText('Claude Opus 5.5').width, tail = ctx.measureText('5.5').width;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.cream; ctx.fillText('Claude Opus ', -full / 2, 0);
    ctx.fillStyle = C.orange; ctx.fillText('5.5', full / 2 - tail, 0);
    ctx.restore();
    const b = eOut(inv(28.1, 28.6, t));
    ctx.globalAlpha = b; ctx.textAlign = 'center';
    fitFont(ctx, '한 줄의 프롬프트, 하나의 세계', 58, FK, 900, 900);
    ctx.fillStyle = C.cream; ctx.fillText('한 줄의 프롬프트, 하나의 세계', 540, 1340 + (1 - b) * 30);
    const pills = [['토큰 단가 20%↓', C.orange, C.ink], ['출력 속도 30%↑', C.teal, C.ink]];
    pills.forEach(([txt, bg, fg], i) => {
      const p = eBack(inv(28.5 + i * .18, 28.9 + i * .18, t));
      if (p <= 0) return;
      ctx.save(); ctx.translate(i ? 760 : 320, 1480); ctx.scale(p, p);
      ctx.font = `900 42px ${FK}`; const w = ctx.measureText(txt).width;
      ctx.globalAlpha = 1; ctx.fillStyle = bg; rr(ctx, -w / 2 - 30, -40, w + 60, 80, 40); ctx.fill();
      ctx.fillStyle = fg; ctx.fillText(txt, 0, 3);
      ctx.restore();
    });
    ctx.globalAlpha = b * .55;
    ctx.font = `700 30px ${FM}`; ctx.fillStyle = C.mute;
    ctx.fillText('fan-made · richroro.github.io', 540, 1640);
    ctx.restore();
  }

  /* ---------- 한 프레임 ---------- */
  function draw(ctx, t) {
    t = clamp(t, 0, DUR);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // 쾅 흔들림
    const sh = 1 - inv(18.5, 18.85, t);
    if (t > 18.5 && sh > 0) { const r = rng(Math.floor(t * 60)); ctx.translate((r() - .5) * 36 * sh, (r() - .5) * 36 * sh); }
    sky(ctx, t);
    hills(ctx, t);
    BUILDS.filter(b => !b.fore).forEach(b => drawBuild(ctx, b, t));
    ground(ctx, t);
    BUILDS.filter(b => b.fore).forEach(b => drawBuild(ctx, b, t));
    glyphs(ctx, t);
    butterfly(ctx, t);
    drawBug(ctx, t);
    ending(ctx, t);
    drawChar(ctx, t);
    drawPelican(ctx, t);
    confetti(ctx, t);
    bonk(ctx, t);
    terminal(ctx, t);
    errorChips(ctx, t);
    buildHud(ctx, t);
    fixedStamp(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    glitchPost(ctx, t);
    // 자막
    caption(ctx, t, .25, 4.3, ['프롬프트 딱 한 줄', { text: '넣어봤더니…', bg: C.orange, color: C.ink }]);
    caption(ctx, t, 5.0, 8.9, [{ text: 'Opus 5.5가', color: C.orange }, { text: '깨어났다', bg: C.cream, color: C.ink }]);
    caption(ctx, t, 9.2, 15.95, ['코드 한 줄이', { text: '세계 하나로', bg: C.teal, color: C.ink }]);
    caption(ctx, t, 16.3, 18.9, [{ text: '앗, 버그다!', bg: C.red, color: '#fff', tilt: -3 }]);
    caption(ctx, t, 19.1, 21.9, ['에러도', { text: '알아서 수습', bg: C.green, color: C.ink }]);
    caption(ctx, t, 22.5, 26.8, ['그리고 왜인지', { text: '자전거 타는 펠리컨', bg: C.pink, color: '#fff' }]);
    endText(ctx, t);
    // 시작·끝 페이드 (쇼츠 반복 재생이 자연스럽게)
    const fade = Math.max(1 - inv(0, .25, t), inv(30.4, 31, t));
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  // 자막·효과음 타이밍을 한곳에서 보이도록 내보낸다
  const SCENES = [
    { t: 0, label: '프롬프트 한 줄' },
    { t: 4.3, label: '커서가 깨어난다' },
    { t: 9.0, label: '세계를 짓는다' },
    { t: 16.0, label: '버그 등장' },
    { t: 22.4, label: '자전거 타는 펠리컨' },
    { t: 27.0, label: '엔딩' }
  ];

  root.OpusShort = { W, H, DUR, FPS, draw, TEXTS, SCENES, FONTS: [[FH, 400], [FK, 900], [FM, 700]] };
})(typeof window !== 'undefined' ? window : globalThis);
