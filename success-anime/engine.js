/* ================================================================
   성공 애니 · 엔진
   캐릭터(SVG) · 배경(SVG) · 파티클(캔버스) · 사운드(Web Audio)
   index.html(재생기)와 shorts.html(쇼츠)이 함께 씁니다.
   ================================================================ */
(() => {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let uidN = 0; const uid = p => p + (++uidN);

/* =====================================================================
   1. CHARACTER RENDERER  — 240×360 SVG, anime proportions
   ===================================================================== */
const SKIN = '#f8d9c2', SKIN_SH = '#eab99b';
function shade(hex, amt) {
  let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  const f = v => clamp(Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt)), 0, 255);
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hairBack(c) {
  const h = c.style === 'gray' ? '#d9d6cf' : c.hair;
  if (c.style === 'long') return `<path d="M62 110 Q52 40 120 32 Q188 40 178 110 L186 230 Q150 244 120 238 Q90 244 54 230Z" fill="${shade(h,-.15)}"/>`;
  if (c.style === 'bun') return `<circle cx="120" cy="30" r="22" fill="${h}"/><path d="M104 22 Q120 14 136 22" stroke="${shade(h,.25)}" stroke-width="3" fill="none"/>`;
  return '';
}
function hairFront(c) {
  const h = c.style === 'gray' ? '#d9d6cf' : c.hair, hl = shade(h, .28), sh = shade(h, -.2);
  const shine = `<path d="M96 52 Q112 44 132 48" stroke="${hl}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`;
  switch (c.style) {
    case 'spiky': return `<path d="M64 118 L58 76 L74 84 L70 48 L92 62 L98 30 L116 52 L128 24 L138 54 L160 34 L158 66 L182 60 L170 88 L184 100 L176 118 Q170 86 150 78 L142 94 L130 76 L118 96 L108 76 L96 92 L88 78 Q70 90 64 118Z" fill="${h}"/>` + shine;
    case 'part': return `<path d="M64 120 Q54 42 122 36 Q186 40 178 118 Q172 84 158 72 Q150 70 146 60 Q118 82 78 84 Q70 96 64 120Z" fill="${h}"/><path d="M146 60 Q138 76 128 86" stroke="${sh}" stroke-width="2" fill="none"/>` + shine;
    case 'bowl': return `<path d="M62 124 Q50 36 120 34 Q190 36 178 124 Q176 96 168 88 L72 88 Q64 98 62 124Z" fill="${h}"/><path d="M78 88 L90 100 L100 88 L112 100 L124 88 L136 100 L148 88 L160 100 L168 88" fill="${h}"/>` + shine;
    case 'long': return `<path d="M62 132 Q50 38 120 34 Q190 38 178 132 Q174 92 160 80 Q134 94 104 82 Q86 92 76 84 Q66 100 62 132Z" fill="${h}"/>` + shine;
    case 'bun': return `<path d="M66 116 Q60 44 120 42 Q180 44 174 116 Q168 80 120 74 Q72 80 66 116Z" fill="${h}"/><path d="M120 44 L120 74" stroke="${sh}" stroke-width="2"/>`;
    case 'gray': return `<path d="M64 118 Q56 44 120 38 Q184 44 176 118 Q170 84 150 76 Q124 90 90 80 Q72 92 64 118Z" fill="${h}"/><path d="M92 52 Q114 44 138 50" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>`;
    case 'bald': return `<path d="M66 120 Q62 92 72 80 Q70 100 76 112Z M174 120 Q178 92 168 80 Q170 100 164 112Z" fill="${h}"/><path d="M86 62 Q120 44 154 62" stroke="${shade(SKIN,.45)}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    default: return `<path d="M64 118 Q58 40 120 36 Q182 40 176 118 Q170 82 152 74 Q134 90 100 80 Q80 90 64 118Z" fill="${h}"/>` + shine;
  }
}
function outfit(c) {
  const col = c.color || '#556', d = shade(col, -.22), l = shade(col, .2);
  const torso = `<path d="M14 360 L24 282 Q34 238 88 228 L152 228 Q206 238 216 282 L226 360Z" fill="${col}"/>`;
  const shadeL = `<path d="M24 282 Q34 238 88 228 L96 360 L14 360Z" fill="${d}" opacity=".35"/>`;
  const tie = c.tie ? `<path d="M113 238 L127 238 L131 300 L120 314 L109 300Z" fill="${c.tie}"/><path d="M113 238 L127 238 L124 250 L116 250Z" fill="${shade(c.tie,-.25)}"/>` : '';
  switch (c.outfit) {
    case 'suit': return torso + shadeL + `<path d="M92 228 L120 300 L148 228Z" fill="#fff"/>` + tie +
      `<path d="M88 228 L120 318 L100 360 L70 360 L62 262Z" fill="${d}"/><path d="M152 228 L120 318 L140 360 L170 360 L178 262Z" fill="${d}"/>` +
      `<path d="M88 228 L104 262 L94 268Z" fill="${l}"/><path d="M152 228 L136 262 L146 268Z" fill="${l}"/>`;
    case 'hanbok': return torso + shadeL + `<path d="M92 228 L148 300 L136 306 L86 240Z" fill="#fff"/><path d="M148 228 L96 310 L108 316 L154 240Z" fill="${shade(col,-.08)}"/>` +
      `<path d="M120 300 Q140 312 132 336 M120 300 Q104 318 110 342" stroke="${shade(col,-.4)}" stroke-width="4" fill="none"/>`;
    case 'hoodie': return torso + shadeL + `<path d="M78 232 Q120 270 162 232 Q160 256 120 262 Q80 256 78 232Z" fill="${d}"/>` +
      `<path d="M108 260 L106 300 M132 260 L134 300" stroke="${l}" stroke-width="3" stroke-linecap="round"/><rect x="84" y="318" width="72" height="30" rx="8" fill="${d}" opacity=".5"/>`;
    case 'apron': return `<path d="M14 360 L24 282 Q34 238 88 228 L152 228 Q206 238 216 282 L226 360Z" fill="#f1ece0"/>` +
      `<path d="M84 250 L156 250 L166 360 L74 360Z" fill="${col}"/><path d="M84 250 L92 228 M156 250 L148 228" stroke="${col}" stroke-width="6"/><rect x="100" y="286" width="40" height="22" rx="4" fill="${d}"/>`;
    case 'coat': return torso + shadeL + `<path d="M84 226 L120 280 L156 226 L150 222 L120 262 L90 222Z" fill="${l}"/><path d="M120 280 L120 360" stroke="${d}" stroke-width="3"/>` +
      `<circle cx="130" cy="300" r="4" fill="${d}"/><circle cx="130" cy="330" r="4" fill="${d}"/>` + (c.tie ? tie : '');
    case 'gown': return `<path d="M14 360 L24 282 Q34 238 88 228 L152 228 Q206 238 216 282 L226 360Z" fill="#fbfbff"/>` +
      `<path d="M24 282 Q34 238 88 228 L96 360 L14 360Z" fill="#dfe3ee" opacity=".6"/><path d="M92 228 L120 290 L148 228Z" fill="${c.color === '#ffffff' ? '#74c0fc' : col}"/>` +
      `<path d="M88 228 L120 318 L106 360 M152 228 L120 318 L134 360" stroke="#cfd4e0" stroke-width="3" fill="none"/><rect x="146" y="286" width="26" height="6" rx="2" fill="#4dabf7"/>`;
    case 'jacket': return torso + shadeL + `<path d="M96 228 L120 250 L144 228Z" fill="#fff"/><path d="M120 250 L120 360" stroke="${d}" stroke-width="4"/>` +
      `<path d="M88 228 L112 262 L96 272 L76 244Z M152 228 L128 262 L144 272 L164 244Z" fill="${l}"/>`;
    default: /* shirt */ return torso + shadeL + `<path d="M96 226 L120 252 L144 226 L150 236 L132 260 L120 250 L108 260 L90 236Z" fill="${l}"/>` + tie +
      `<circle cx="120" cy="280" r="3" fill="${d}"/><circle cx="120" cy="310" r="3" fill="${d}"/>`;
  }
}
function eyes(c, face) {
  const iris = c.eye || '#3b2a1a', ih = shade(iris, .35);
  const one = (x, flip) => {
    const id = uid('ig');
    const grad = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(iris,-.35)}"/><stop offset="1" stop-color="${ih}"/></linearGradient>`;
    const s = flip ? -1 : 1;
    if (face === 'smile' || face === 'laugh') return `<path d="M${x-12} 122 Q${x} 106 ${x+12} 122" stroke="#2a1d16" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    if (face === 'cry') return `<path d="M${x-12} 118 Q${x} 128 ${x+12} 118" stroke="#2a1d16" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    if (face === 'shock') return `<ellipse cx="${x}" cy="120" rx="12" ry="14" fill="#fff" stroke="#2a1d16" stroke-width="2.5"/><circle cx="${x}" cy="121" r="3.2" fill="#2a1d16"/>`;
    const lid = face === 'angry' || face === 'determined' ? `<path d="M${x-14} ${109 + (s>0?-2:4)} L${x+14} ${109 + (s>0?4:-2)} L${x+14} 100 L${x-14} 100Z" fill="${SKIN}"/>` :
                face === 'sad' ? `<path d="M${x-14} ${110 + (s>0?4:-2)} L${x+14} ${110 + (s>0?-2:4)} L${x+14} 100 L${x-14} 100Z" fill="${SKIN}"/>` :
                face === 'think' ? `<rect x="${x-15}" y="100" width="30" height="13" fill="${SKIN}"/>` : '';
    const look = face === 'think' ? (flip ? -3 : 3) : 0;
    return `<defs>${grad}</defs><ellipse cx="${x}" cy="121" rx="12" ry="14.5" fill="#fff"/>` +
      `<ellipse cx="${x + look}" cy="123" rx="9" ry="12" fill="url(#${id})"/><ellipse cx="${x + look}" cy="124" rx="4.2" ry="6" fill="#140d0a"/>` +
      `<circle cx="${x + look - 3.5}" cy="117" r="3.6" fill="#fff"/><circle cx="${x + look + 3.5}" cy="129" r="1.8" fill="#fff" opacity=".9"/>` + lid +
      `<path d="M${x-15} ${face==='think'?113:108} Q${x} ${face==='think'?108:102} ${x+15} ${face==='think'?113:108}" stroke="#1d1410" stroke-width="4.2" fill="none" stroke-linecap="round"/>` +
      `<path d="M${x + (flip?-15:15)} 108 l${flip?-4:4} -3" stroke="#1d1410" stroke-width="3" stroke-linecap="round"/>`;
  };
  return one(98, false) + one(142, true);
}
function brows(c, face) {
  const h = c.style === 'gray' ? '#9c9890' : c.style === 'bald' ? '#6d6660' : shade(c.hair, -.1);
  const b = { normal: [96, 96], smile: [93, 93], laugh: [91, 91], shock: [86, 86], angry: [100, 90], determined: [99, 92], sad: [90, 99], think: [94, 90], cry: [90, 100] }[face] || [96, 96];
  return `<path d="M86 ${b[1]} Q97 ${b[0] - 6} 110 ${b[0]}" stroke="${h}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
         `<path d="M154 ${b[1]} Q143 ${b[0] - 6} 130 ${b[0]}" stroke="${h}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
}
function mouth(face) {
  const closed = {
    normal: `<path d="M112 164 Q120 168 128 164" stroke="#8a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    smile: `<path d="M108 160 Q120 172 132 160" stroke="#8a4a3a" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    laugh: `<path d="M106 158 Q120 180 134 158Z" fill="#7a2f2a"/><path d="M112 170 Q120 176 128 170" fill="#ff8b8b"/>`,
    shock: `<ellipse cx="120" cy="166" rx="6" ry="8" fill="#7a2f2a"/>`,
    angry: `<path d="M108 168 Q120 158 132 168" stroke="#8a4a3a" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    determined: `<path d="M110 165 L130 163" stroke="#8a4a3a" stroke-width="3.4" stroke-linecap="round"/>`,
    sad: `<path d="M110 168 Q120 161 130 168" stroke="#8a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    think: `<path d="M114 165 Q122 163 128 166" stroke="#8a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    cry: `<path d="M108 170 Q120 158 132 170 Q120 166 108 170Z" fill="#7a2f2a"/>`
  }[face] || '';
  const open = face === 'shock' ? `<ellipse cx="120" cy="166" rx="9" ry="12" fill="#7a2f2a"/>` :
               face === 'laugh' ? `<path d="M104 156 Q120 186 136 156Z" fill="#7a2f2a"/><path d="M110 172 Q120 180 130 172" fill="#ff8b8b"/>` :
               face === 'angry' || face === 'determined' ? `<path d="M106 160 Q120 154 134 160 L130 172 Q120 176 110 172Z" fill="#7a2f2a"/><rect x="110" y="159" width="20" height="4" fill="#fff"/>` :
               `<path d="M110 160 Q120 158 130 160 Q128 174 120 174 Q112 174 110 160Z" fill="#7a2f2a"/><path d="M114 169 Q120 173 126 169" fill="#ff8b8b"/>`;
  return `<g class="m1">${closed}</g><g class="m2">${open}</g>`;
}
function extras(c, face) {
  let s = '';
  if (c.age === 'old') s += `<path d="M80 136 q6 4 12 2 M160 136 q-6 4 -12 2 M108 78 q12 -3 24 0" stroke="${SKIN_SH}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (face === 'smile' || face === 'laugh' || face === 'shock' || c.age === 'young')
    s += `<ellipse cx="88" cy="146" rx="11" ry="5" fill="#ff8fa3" opacity="${face === 'smile' || face === 'laugh' ? .55 : .3}"/><ellipse cx="152" cy="146" rx="11" ry="5" fill="#ff8fa3" opacity="${face === 'smile' || face === 'laugh' ? .55 : .3}"/>`;
  if (face === 'shock' || face === 'sad') s += `<path class="sweat" d="M170 92 q7 12 0 16 q-7 -4 0 -16Z" fill="#8fd3ff" stroke="#fff" stroke-width="1.5"/>`;
  if (face === 'cry') s += `<path class="tear" d="M92 128 q5 10 0 14 q-5 -4 0 -14Z" fill="#8fd3ff"/><path class="tear" style="animation-delay:.5s" d="M148 128 q5 10 0 14 q-5 -4 0 -14Z" fill="#8fd3ff"/>`;
  if (face === 'angry') s += `<path d="M160 64 l10 -4 m-6 -6 l4 10 m4 -8 l-8 6" stroke="#ff4d4d" stroke-width="3.4" stroke-linecap="round"/>`;
  if (face === 'think') s += `<circle cx="186" cy="70" r="4" fill="#fff" opacity=".8"/><circle cx="196" cy="54" r="6" fill="#fff" opacity=".8"/><circle cx="212" cy="34" r="10" fill="#fff" opacity=".85"/>`;
  if (c.glasses) s += `<g fill="none" stroke="#2b2b33" stroke-width="3"><rect x="82" y="106" width="32" height="28" rx="9"/><rect x="126" y="106" width="32" height="28" rx="9"/><path d="M114 118 Q120 114 126 118 M82 116 L70 112 M158 116 L170 112"/></g>` +
                    `<path d="M88 112 l10 -3" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/>`;
  return s;
}
function charSVG(c, face = 'normal') {
  return `<svg viewBox="0 0 240 360" xmlns="http://www.w3.org/2000/svg"><g class="bob">
    ${hairBack(c)}
    ${outfit(c)}
    <path d="M102 186 L102 234 Q120 246 138 234 L138 186Z" fill="${SKIN}"/><path d="M102 200 Q120 214 138 200 L138 186 L102 186Z" fill="${SKIN_SH}"/>
    <ellipse cx="68" cy="126" rx="9" ry="14" fill="${SKIN}"/><ellipse cx="172" cy="126" rx="9" ry="14" fill="${SKIN}"/>
    <path d="M68 108 Q66 48 120 46 Q174 48 172 108 Q172 160 120 198 Q68 160 68 108Z" fill="${SKIN}"/>
    <path d="M70 128 Q78 168 120 198 Q96 170 92 140Z" fill="${SKIN_SH}" opacity=".45"/>
    <g class="eyes">${eyes(c, face)}</g>
    ${brows(c, face)}
    <path d="M119 138 l-3 10 l5 1" stroke="${SKIN_SH}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${mouth(face)}
    ${extras(c, face)}
    ${hairFront(c)}
  </g></svg>`;
}

/* =====================================================================
   2. BACKGROUNDS — 1600×900, slice-fit
   ===================================================================== */
const SKY = {
  dawn:  ['#ff9e7a', '#ffc99a', '#fff0d2', '#fff6e0', .9],
  day:   ['#4aa8ff', '#9dd6ff', '#e6f6ff', '#fffbe6', 1],
  dusk:  ['#2c2566', '#c84f7d', '#ffae6b', '#ffd49a', .75],
  night: ['#05081f', '#111a4a', '#2a2f6b', '#c9d4ff', .45]
};
const BG_KO = { 시골:'village', 쌀가게:'riceshop', 가게:'riceshop', 공장:'garage', 정비소:'garage', 은행:'bank', 회의실:'bank', 조선소:'shipyard',
  사무실:'office', 회사:'office', 도시:'city', 거리:'street', 골목:'street', 원룸:'room', 방:'room', 집:'room', 피시방:'pcbang', PC방:'pcbang',
  연구소:'lab', 병원:'lab', 바다:'sea', 섬:'sea', 무대:'stage', 성공:'stage', 교실:'classroom', 학교:'classroom', 카페:'cafe' };
const TIME_KO = { 새벽:'dawn', 아침:'dawn', 낮:'day', 오후:'day', 노을:'dusk', 저녁:'dusk', 밤:'night', 새벽녘:'dawn' };

function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function skyDefs(t, id) {
  const k = SKY[t] || SKY.day;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k[0]}"/><stop offset=".45" stop-color="${k[1]}"/><stop offset="1" stop-color="${k[2]}"/></linearGradient>`;
}
function stars(t, r) {
  if (t !== 'night' && t !== 'dusk') return '';
  let s = ''; const n = t === 'night' ? 90 : 26;
  for (let i = 0; i < n; i++) s += `<circle cx="${r() * 1600}" cy="${r() * 420}" r="${r() * 1.8 + .4}" fill="#fff" opacity="${.3 + r() * .7}"/>`;
  return s;
}
function sun(t) {
  if (t === 'night') return `<circle cx="1280" cy="150" r="56" fill="#fff8dc"/><circle cx="1302" cy="138" r="52" fill="#111a4a" opacity=".92"/>`;
  if (t === 'dusk') return `<circle cx="1180" cy="470" r="120" fill="#ffd27a" opacity=".9"/><circle cx="1180" cy="470" r="200" fill="#ffd27a" opacity=".18"/>`;
  if (t === 'dawn') return `<circle cx="360" cy="440" r="110" fill="#fff3c4"/><circle cx="360" cy="440" r="190" fill="#fff3c4" opacity=".25"/>`;
  return `<circle cx="1300" cy="140" r="70" fill="#fffbe0"/><circle cx="1300" cy="140" r="130" fill="#fffbe0" opacity=".25"/>`;
}
function clouds(t, r) {
  const c = t === 'night' ? '#1c2458' : t === 'dusk' ? '#f7a1a8' : '#ffffff', o = t === 'night' ? .7 : .85;
  let s = '';
  for (let i = 0; i < 5; i++) { const x = r() * 1600, y = 80 + r() * 220, w = 120 + r() * 160;
    s += `<g opacity="${o}" fill="${c}"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * .22}"/><ellipse cx="${x - w * .35}" cy="${y - 14}" rx="${w * .45}" ry="${w * .2}"/><ellipse cx="${x + w * .3}" cy="${y - 22}" rx="${w * .4}" ry="${w * .24}"/></g>`; }
  return s;
}
function mountains(t) {
  const n = t === 'night', d = t === 'dusk';
  const c1 = n ? '#1a2250' : d ? '#6b3f7a' : t === 'dawn' ? '#b98aa8' : '#8fb9d9';
  const c2 = n ? '#121838' : d ? '#4a2c5e' : t === 'dawn' ? '#8e6a8f' : '#5d9a7e';
  return `<path d="M0 520 L140 380 L260 460 L420 300 L560 430 L700 340 L880 470 L1040 320 L1200 450 L1360 350 L1600 480 L1600 900 L0 900Z" fill="${c1}"/>` +
         `<path d="M0 600 L180 470 L340 560 L520 450 L700 560 L900 470 L1100 580 L1300 480 L1600 590 L1600 900 L0 900Z" fill="${c2}"/>`;
}
function windowGrid(x, y, w, h, cols, rows, lit, r, dark) {
  let s = ''; const gw = w / cols, gh = h / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
    s += `<rect x="${x + i * gw + gw * .2}" y="${y + j * gh + gh * .2}" width="${gw * .6}" height="${gh * .55}" fill="${r() < lit ? '#ffd873' : dark}"/>`;
  return s;
}
function skyline(t, r, base = 600) {
  const n = t === 'night' || t === 'dusk';
  let s = '';
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < 1620) {
      const w = 70 + r() * 110, h = (layer ? 160 : 260) + r() * (layer ? 180 : 260);
      const col = layer ? (n ? '#161a3a' : '#5d7fa6') : (n ? '#232a5a' : '#88a9cc');
      s += `<rect x="${x}" y="${base - h + layer * 60}" width="${w}" height="${h + 400}" fill="${col}"/>`;
      if (n) s += windowGrid(x, base - h + layer * 60 + 12, w, Math.min(h - 20, 300), Math.max(2, Math.round(w / 26)), Math.round(Math.min(h - 20, 300) / 30), layer ? .45 : .25, r, layer ? '#1e2348' : '#2c3468');
      x += w + (layer ? 4 : 20);
    }
  }
  return s;
}

const BG = {
  village(t, r) {
    return sun(t) + clouds(t, r) + mountains(t) +
      `<path d="M0 640 Q400 610 800 640 T1600 630 L1600 900 L0 900Z" fill="${t === 'night' ? '#1d3325' : '#a4c46b'}"/>` +
      [0, 1, 2, 3].map(i => `<path d="M${-40 + i * 420} 700 L${340 + i * 420} 690 L${380 + i * 420} 900 L${-80 + i * 420} 900Z" fill="${t === 'night' ? '#20402c' : '#8cb356'}" stroke="${t === 'night' ? '#2c5238' : '#b9d68a'}" stroke-width="6"/>`).join('') +
      `<g transform="translate(1040 470)"><rect x="20" y="90" width="300" height="130" fill="#c9a77a"/><rect x="60" y="130" width="70" height="90" fill="#6e4b2e"/><rect x="190" y="130" width="80" height="50" fill="#e8d7b0"/>` +
      `<path d="M-30 100 Q170 -10 370 100 Q360 70 340 60 Q170 -40 0 60 Q-20 70 -30 100Z" fill="#d8b25a"/><path d="M-30 100 Q170 30 370 100" stroke="#b58c3b" stroke-width="6" fill="none"/></g>` +
      `<path d="M700 900 Q760 760 820 700 Q900 640 1040 690" stroke="#e6cf9c" stroke-width="60" fill="none" opacity=".8"/>`;
  },
  riceshop(t, r, o = {}) {
    const n = t === 'night' || t === 'dusk', sign = o.sign || '쌀 · 잡 곡', rice = !o.sign;
    return `<rect y="560" width="1600" height="340" fill="${n ? '#3a2c28' : '#cdb89b'}"/><rect y="0" width="1600" height="600" fill="${n ? '#4a3a44' : '#e9dcc3'}" opacity=".55"/>` +
      `<rect x="180" y="120" width="1240" height="520" fill="${n ? '#5a3e2e' : '#8b5a3c'}"/><rect x="220" y="230" width="1160" height="410" fill="${n ? '#2a1c16' : '#3e2a1e'}"/>` +
      `<rect x="420" y="130" width="760" height="92" rx="8" fill="#f4ecd8" stroke="#6b3f24" stroke-width="8"/><text x="800" y="202" font-size="72" text-anchor="middle" font-family="Black Han Sans,sans-serif" fill="#b02a1a">${esc(sign)}</text>` +
      (rice ? [0, 1, 2, 3, 4].map(i => `<g transform="translate(${280 + i * 120} ${520 - (i % 2) * 40})"><path d="M0 120 Q-6 40 20 10 L90 10 Q116 40 110 120Z" fill="#efe4c6" stroke="#b39a6a" stroke-width="4"/><text x="55" y="80" font-size="30" text-anchor="middle" fill="#8a2a1a" font-family="Black Han Sans">米</text></g>`).join('') :
       [0, 1, 2].map(i => `<g transform="translate(${280 + i * 190} 470)"><rect x="0" y="60" width="130" height="18" fill="#d9a066"/><rect x="8" y="78" width="12" height="92" fill="#a86b3c"/><rect x="110" y="78" width="12" height="92" fill="#a86b3c"/><rect x="0" y="-10" width="18" height="72" fill="#d9a066"/><rect x="34" y="20" width="60" height="40" rx="4" fill="${['#63e6be', '#ffd43b', '#ff8787'][i]}"/></g>`).join('')) +
      `<g transform="translate(1060 540)" stroke="#222" stroke-width="10" fill="none"><circle cx="0" cy="80" r="70"/><circle cx="210" cy="80" r="70"/><path d="M0 80 L70 0 L160 0 L210 80 M70 0 L110 80 L160 0 M60 -30 L90 -30"/></g>` +
      `<path d="M140 110 L1460 110 L1400 60 L200 60Z" fill="${n ? '#6b2f2f' : '#c0392b'}"/>` + [...Array(12)].map((_, i) => `<rect x="${200 + i * 105}" y="60" width="52" height="50" fill="#f1e6d0" opacity=".85"/>`).join('');
  },
  garage(t, r) {
    return `<rect width="1600" height="900" fill="#241c1a"/><rect y="620" width="1600" height="280" fill="#3a2e28"/>` +
      [0, 1, 2, 3].map(i => `<rect x="${60 + i * 400}" y="80" width="300" height="220" fill="#43342c" stroke="#5b463b" stroke-width="10"/><path d="M${60 + i * 400} 190 h300 M${210 + i * 400} 80 v220" stroke="#5b463b" stroke-width="8"/>`).join('') +
      `<g transform="translate(420 440)"><path d="M0 200 L40 110 Q80 60 220 50 L470 50 Q560 60 640 120 L760 140 Q800 150 800 200 L800 240 L0 240Z" fill="#20252e"/>` +
      `<path d="M140 110 Q170 70 250 66 L380 66 L380 116Z M400 66 L480 66 Q540 72 590 116 L400 116Z" fill="#5c7a99" opacity=".7"/><circle cx="170" cy="245" r="62" fill="#0e0e10"/><circle cx="170" cy="245" r="28" fill="#6b6b73"/><circle cx="640" cy="245" r="62" fill="#0e0e10"/><circle cx="640" cy="245" r="28" fill="#6b6b73"/></g>` +
      `<g stroke="#8a7a70" stroke-width="8" stroke-linecap="round"><path d="M1320 420 l80 -80 M1420 430 l40 -110 M1260 460 l0 -120"/></g><rect x="1240" y="460" width="260" height="160" fill="#5b463b"/>`;
  },
  office(t, r) {
    const id = uid('s');
    return `<defs>${skyDefs(t, id)}</defs><rect width="1600" height="900" fill="#e9e6f2"/>` +
      `<clipPath id="${id}c"><rect x="160" y="80" width="1280" height="560"/></clipPath>` +
      `<rect x="160" y="80" width="1280" height="560" fill="url(#${id})"/><g clip-path="url(#${id}c)">${sun(t)}${clouds(t, r)}${skyline(t, r, 700)}</g>` +
      `<rect x="160" y="80" width="1280" height="560" fill="none" stroke="#b9b4c9" stroke-width="18"/><path d="M587 80 v560 M1013 80 v560" stroke="#b9b4c9" stroke-width="14"/>` +
      [...Array(9)].map((_, i) => `<rect x="160" y="${90 + i * 22}" width="1280" height="8" fill="#d6d2e3" opacity=".75"/>`).join('') +
      `<rect y="640" width="1600" height="260" fill="#c8bda9"/><rect x="280" y="600" width="1040" height="46" rx="6" fill="#7a5a44"/><rect x="300" y="646" width="30" height="254" fill="#5b4332"/><rect x="1270" y="646" width="30" height="254" fill="#5b4332"/>` +
      `<rect x="900" y="470" width="220" height="140" rx="10" fill="#2b2f3a"/><rect x="912" y="482" width="196" height="112" rx="4" fill="${t === 'night' ? '#6fb6ff' : '#9fd0ff'}"/><rect x="990" y="596" width="40" height="14" fill="#2b2f3a"/>` +
      `<path d="M930 560 l30 -30 l30 18 l40 -46 l40 20" stroke="#fff" stroke-width="6" fill="none"/>` +
      `<g transform="translate(420 520)"><rect width="120" height="80" fill="#f8f5ee"/><rect x="10" y="-10" width="120" height="80" fill="#fff" stroke="#ddd"/></g><circle cx="1420" cy="560" r="44" fill="#2f9e44"/><rect x="1400" y="590" width="40" height="56" fill="#b0643c"/>`;
  },
  bank(t, r) {
    return `<rect width="1600" height="900" fill="#e7dfcf"/><rect y="0" width="1600" height="110" fill="#cfc2a8"/>` +
      [0, 1, 2, 3, 4].map(i => `<g transform="translate(${60 + i * 360} 110)"><rect x="0" width="90" height="560" fill="#f3ecdd"/><rect x="-14" y="0" width="118" height="30" fill="#d9ccb0"/><rect x="-14" y="530" width="118" height="30" fill="#d9ccb0"/>` +
        [0, 1, 2].map(k => `<path d="M${22 + k * 24} 34 v490" stroke="#ddd2bb" stroke-width="5"/>`).join('') + `</g>`).join('') +
      [0, 1, 2, 3].map(i => `<g transform="translate(${190 + i * 360} 170)"><rect width="200" height="330" rx="100" fill="${t === 'night' ? '#1c2248' : '#8ea3b8'}"/><path d="M100 0 v330 M0 170 h200" stroke="#cfc2a8" stroke-width="10"/></g>`).join('') +
      `<rect y="670" width="1600" height="230" fill="#5a3b2a"/><rect x="200" y="640" width="1200" height="60" rx="10" fill="#6b4632"/><rect x="200" y="630" width="1200" height="20" rx="8" fill="#80563d"/>` +
      `<g transform="translate(700 590)"><rect width="200" height="44" fill="#fff" transform="rotate(-4)"/><rect x="18" y="8" width="50" height="28" fill="#c9a44a" transform="rotate(-4)"/></g>`;
  },
  shipyard(t, r) {
    const id = uid('s');
    return `<defs>${skyDefs(t, id)}</defs><rect width="1600" height="900" fill="url(#${id})"/>` + stars(t, r) + sun(t) + clouds(t, r) +
      `<rect y="560" width="1600" height="340" fill="${t === 'night' ? '#0d1638' : t === 'dusk' ? '#5a3f7a' : '#3a7dc0'}"/>` +
      [...Array(14)].map(() => `<path d="M${r() * 1600} ${590 + r() * 280} h${40 + r() * 90}" stroke="#fff" stroke-width="3" opacity=".35"/>`).join('') +
      `<g fill="${t === 'dusk' || t === 'night' ? '#20183a' : '#e03131'}"><rect x="160" y="140" width="40" height="440"/><rect x="1260" y="140" width="40" height="440"/><rect x="120" y="120" width="1220" height="60"/></g>` +
      `<g stroke="${t === 'dusk' || t === 'night' ? '#20183a' : '#c92a2a'}" stroke-width="8">${[...Array(12)].map((_, i) => `<path d="M${140 + i * 100} 180 l50 -60"/>`).join('')}</g>` +
      `<rect x="640" y="180" width="60" height="40" fill="#ffd43b"/><path d="M670 220 v150" stroke="#333" stroke-width="4"/>` +
      `<g transform="translate(260 420)"><path d="M0 60 L1000 60 L940 190 L60 190Z" fill="${t === 'dusk' ? '#2c2240' : '#2d3440'}"/><rect x="0" y="40" width="1000" height="24" fill="#c92a2a"/><rect x="760" y="-40" width="170" height="100" fill="#e9ecef"/><rect x="780" y="-20" width="130" height="18" fill="#5c7cfa"/><rect x="840" y="-90" width="30" height="50" fill="#e9ecef"/></g>` +
      `<rect y="610" width="1600" height="30" fill="#6c757d"/>`;
  },
  city(t, r) {
    const id = uid('s');
    return `<defs>${skyDefs(t, id)}</defs><rect width="1600" height="900" fill="url(#${id})"/>` + stars(t, r) + (t === 'night' ? sun(t) : clouds(t, r)) + skyline(t, r, 700) +
      `<rect y="700" width="1600" height="200" fill="${t === 'night' ? '#15182e' : '#6b6f7e'}"/><path d="M0 800 H1600" stroke="#ffd43b" stroke-width="8" stroke-dasharray="70 60" opacity=".7"/>` +
      [0, 1, 2, 3].map(i => `<g transform="translate(${140 + i * 420} 520)"><rect x="-5" width="10" height="190" fill="#3b3f55"/><path d="M0 0 q30 -10 50 6" stroke="#3b3f55" stroke-width="10" fill="none"/>${t === 'night' ? `<ellipse cx="52" cy="14" rx="70" ry="120" fill="#ffe8a3" opacity=".13"/><circle cx="52" cy="10" r="10" fill="#fff4c2"/>` : ''}</g>`).join('');
  },
  street(t, r) {
    const n = t === 'night' || t === 'dusk';
    return `<rect width="1600" height="900" fill="${n ? '#1a1830' : '#bcc3d0'}"/>` +
      `<rect x="0" y="80" width="560" height="620" fill="${n ? '#2a2744' : '#d5c7b3'}"/><rect x="1040" y="40" width="560" height="660" fill="${n ? '#262340' : '#c9bfae'}"/>` +
      windowGrid(30, 120, 500, 380, 5, 5, n ? .5 : 0, r, n ? '#1c1a33' : '#a9b7c8') + windowGrid(1070, 80, 500, 420, 5, 6, n ? .45 : 0, r, n ? '#1c1a33' : '#a9b7c8') +
      `<rect x="600" y="340" width="400" height="360" fill="${n ? '#2f2b4c' : '#ddd3c2'}"/><rect x="700" y="470" width="200" height="230" fill="${n ? '#4a4470' : '#8b6d4f'}"/><rect x="706" y="476" width="188" height="218" fill="${n ? '#ffd873' : '#e3d8c6'}" opacity="${n ? .25 : 1}"/>` +
      [...Array(9)].map(() => `<rect x="${710 + r() * 150}" y="${490 + r() * 150}" width="34" height="44" fill="${['#fff3bf', '#ffc9c9', '#d0ebff', '#ffffff'][Math.floor(r() * 4)]}" transform="rotate(${(r() - .5) * 26} 800 560)"/>`).join('') +
      `<rect y="700" width="1600" height="200" fill="${n ? '#12111f' : '#8d8f99'}"/>` +
      [...Array(14)].map(() => `<rect x="${r() * 1600}" y="${720 + r() * 160}" width="44" height="30" fill="${['#fff3bf', '#ffc9c9', '#d0ebff', '#fff'][Math.floor(r() * 4)]}" opacity=".9" transform="rotate(${(r() - .5) * 60} 800 800)"/>`).join('') +
      (n ? `<ellipse cx="800" cy="720" rx="420" ry="80" fill="#ffd873" opacity=".1"/>` : '');
  },
  room(t, r) {
    const id = uid('s'), n = t === 'night';
    return `<defs>${skyDefs(t, id)}</defs><rect width="1600" height="900" fill="${n ? '#2b2540' : '#efe3cf'}"/>` +
      `<rect x="980" y="120" width="440" height="360" fill="url(#${id})"/>` + (n ? `<circle cx="1320" cy="200" r="30" fill="#fff8dc"/>` : '') +
      `<path d="M1200 120 v360 M980 300 h440" stroke="${n ? '#4a4068' : '#d9c3a0'}" stroke-width="14"/><rect x="980" y="120" width="440" height="360" fill="none" stroke="${n ? '#4a4068' : '#d9c3a0'}" stroke-width="20"/>` +
      `<rect y="660" width="1600" height="240" fill="${n ? '#3a2c24' : '#c49a6c'}"/>` + [...Array(8)].map((_, i) => `<path d="M0 ${680 + i * 30} H1600" stroke="${n ? '#2e231d' : '#b08a5c'}" stroke-width="3"/>`).join('') +
      `<g transform="translate(140 220)"><rect width="300" height="440" fill="${n ? '#3e3350' : '#a8784c'}"/>` + [0, 1, 2, 3].map(k => `<rect x="10" y="${20 + k * 105}" width="280" height="8" fill="${n ? '#2c2440' : '#8a5f3a'}"/>` +
        [...Array(7)].map((_, j) => `<rect x="${20 + j * 38}" y="${36 + k * 105}" width="${24 + r() * 10}" height="${60 + r() * 20}" fill="${['#e64980', '#4dabf7', '#ffd43b', '#51cf66', '#845ef7', '#ff922b'][Math.floor(r() * 6)]}" opacity="${n ? .6 : .9}"/>`).join('')).join('') + `</g>` +
      `<g transform="translate(560 560)"><rect width="340" height="30" rx="6" fill="${n ? '#5a4535' : '#8b5a3c'}"/><rect x="20" y="30" width="16" height="70" fill="#6b4632"/><rect x="304" y="30" width="16" height="70" fill="#6b4632"/>` +
      `<rect x="110" y="-80" width="130" height="84" rx="6" fill="#2b2f3a"/><rect x="118" y="-72" width="114" height="66" fill="${n ? '#8fd3ff' : '#cfe8ff'}"/>${n ? `<ellipse cx="175" cy="-40" rx="160" ry="90" fill="#8fd3ff" opacity=".12"/>` : ''}</g>` +
      (n ? `<rect width="1600" height="900" fill="#0a0620" opacity=".25"/>` : '');
  },
  pcbang(t, r) {
    let s = `<rect width="1600" height="900" fill="#0d0b1e"/><rect y="600" width="1600" height="300" fill="#16132c"/>` +
      `<text x="800" y="150" font-size="120" text-anchor="middle" font-family="Black Han Sans" fill="#ff4dd2" style="filter:drop-shadow(0 0 14px #ff4dd2)">PC 방</text>` +
      `<rect x="520" y="44" width="560" height="140" rx="20" fill="none" stroke="#40c4ff" stroke-width="6" opacity=".85"/>`;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
      const sc = 1 - row * .18, x = 110 + i * 210 + row * 30, y = 330 + row * 150;
      s += `<g transform="translate(${x} ${y}) scale(${sc})"><rect width="170" height="110" rx="8" fill="#23203d"/><rect x="8" y="8" width="154" height="92" fill="${['#40c4ff', '#7cff9e', '#ffd43b', '#ff6b9e'][(i + row) % 4]}" opacity=".85"/>` +
        `<rect x="70" y="110" width="30" height="24" fill="#23203d"/><ellipse cx="85" cy="60" rx="140" ry="80" fill="${['#40c4ff', '#7cff9e', '#ffd43b', '#ff6b9e'][(i + row) % 4]}" opacity=".08"/></g>`;
    }
    return s + `<rect y="770" width="1600" height="40" fill="#2a2548"/>`;
  },
  lab(t, r) {
    return `<rect width="1600" height="900" fill="#eef4fb"/><rect y="0" width="1600" height="70" fill="#dbe6f3"/>` +
      [0, 1, 2, 3, 4, 5].map(i => `<rect x="${40 + i * 270}" y="10" width="200" height="40" rx="6" fill="#fff"/>`).join('') +
      [0, 1, 2].map(i => `<g transform="translate(${140 + i * 260} 180)"><rect width="170" height="420" rx="80" fill="#cfd8e3"/><rect x="18" y="40" width="134" height="340" rx="66" fill="#e9f0f7"/>` +
        `<rect x="30" y="${160 + i * 20}" width="110" height="${200 - i * 20}" rx="50" fill="#9be7c4" opacity=".75"/><circle cx="85" cy="110" r="20" fill="#adb5bd"/><rect x="70" y="-40" width="30" height="46" fill="#adb5bd"/></g>`).join('') +
      `<rect x="960" y="480" width="560" height="40" fill="#adb5bd"/><rect x="980" y="520" width="520" height="160" fill="#ced4da"/>` +
      [0, 1, 2, 3].map(i => `<g transform="translate(${1000 + i * 120} 380)"><path d="M20 0 h30 v40 l30 60 h-90 l30 -60Z" fill="${['#74c0fc', '#ffa8a8', '#b2f2bb', '#ffe066'][i]}" opacity=".85" stroke="#fff" stroke-width="3"/></g>`).join('') +
      `<rect y="680" width="1600" height="220" fill="#d7e1ec"/>`;
  },
  sea(t, r) {
    const id = uid('s');
    return `<defs>${skyDefs(t, id)}</defs><rect width="1600" height="900" fill="url(#${id})"/>` + stars(t, r) + sun(t) + clouds(t, r) +
      `<rect y="520" width="1600" height="380" fill="${t === 'night' ? '#0d1638' : t === 'dusk' ? '#6d4a8a' : '#2f8ee0'}"/>` +
      `<path d="M900 540 Q1080 400 1300 520 Z" fill="${t === 'night' ? '#15253a' : '#4e8f5a'}"/><path d="M1180 540 Q1340 440 1560 530Z" fill="${t === 'night' ? '#122033' : '#3f7a4c'}"/>` +
      [...Array(18)].map(() => `<path d="M${r() * 1600} ${560 + r() * 300} q30 -12 60 0 t60 0" stroke="#fff" stroke-width="3" fill="none" opacity=".45"/>`).join('') +
      `<path d="M0 780 Q300 730 700 760 T1600 800 L1600 900 L0 900Z" fill="#f2e2b8"/><g transform="translate(260 640)"><path d="M0 60 L220 60 L190 100 L30 100Z" fill="#7a4b2a"/><path d="M110 60 V-80 L200 40Z" fill="#fff"/></g>`;
  },
  stage(t, r) {
    const id = uid('s'), rays = uid('r');
    return `<defs>${skyDefs(t, id)}<radialGradient id="${rays}" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="1600" height="900" fill="url(#${id})"/>` + stars(t, r) +
      `<g opacity=".45">${[...Array(16)].map((_, i) => `<path d="M800 700 L${800 + Math.cos(i / 16 * Math.PI * 2) * 1400} ${700 + Math.sin(i / 16 * Math.PI * 2) * 1400} L${800 + Math.cos((i + .45) / 16 * Math.PI * 2) * 1400} ${700 + Math.sin((i + .45) / 16 * Math.PI * 2) * 1400}Z" fill="#fff4c2"/>`).join('')}</g>` +
      `<ellipse cx="800" cy="700" rx="900" ry="520" fill="url(#${rays})"/>` + skyline(t, r, 760) +
      `<rect y="760" width="1600" height="140" fill="${t === 'night' ? '#10132a' : '#3b2a55'}"/>`;
  },
  classroom(t, r) {
    return `<rect width="1600" height="900" fill="#f1ead8"/><rect x="260" y="110" width="1080" height="420" rx="8" fill="#2f5d3a" stroke="#8b5a3c" stroke-width="20"/>` +
      `<text x="800" y="330" font-size="70" text-anchor="middle" fill="#fff" opacity=".85" font-family="Gowun Dodum">꿈 = 계획 + 반복</text>` +
      `<rect y="650" width="1600" height="250" fill="#b8905f"/>` + [0, 1, 2].map(i => `<rect x="${220 + i * 440}" y="620" width="280" height="30" fill="#8b5a3c"/>`).join('');
  },
  cafe(t, r) {
    const n = t === 'night';
    return `<rect width="1600" height="900" fill="${n ? '#2a1f1b' : '#efe0cc'}"/><rect x="100" y="100" width="700" height="420" fill="${n ? '#15183a' : '#bfe3ff'}" stroke="#6b4632" stroke-width="18"/>` +
      `<path d="M450 100 v420" stroke="#6b4632" stroke-width="12"/>` + [0, 1, 2].map(i => `<g transform="translate(${1000 + i * 180} 140)"><path d="M0 0 v80" stroke="#333" stroke-width="3"/><path d="M-40 80 h80 l-20 50 h-40Z" fill="#ffd43b"/><ellipse cx="0" cy="170" rx="80" ry="70" fill="#ffd43b" opacity="${n ? .18 : .06}"/></g>`).join('') +
      `<rect y="640" width="1600" height="260" fill="${n ? '#3a2a22' : '#a9744c'}"/><rect x="900" y="560" width="600" height="90" fill="#6b4632"/><g transform="translate(1100 520)"><rect width="50" height="44" rx="6" fill="#fff"/><path d="M50 10 q18 0 18 14 q0 14 -18 14" stroke="#fff" stroke-width="6" fill="none"/></g>`;
  },
  black() { return `<rect width="1600" height="900" fill="#0b0816"/>`; }
};
function bgSVG(name, time, o = {}) {
  const fn = BG[name] || BG.room;
  const r = rnd([...(name + time)].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const id = uid('sk');
  const needsSky = ['village'].includes(name);
  const tint = time === 'night' && !['pcbang', 'garage', 'black', 'city', 'shipyard', 'sea', 'stage', 'room', 'street'].includes(name) ? `<rect width="1600" height="900" fill="#0b0a2a" opacity=".42"/>` :
               time === 'dusk' && ['office', 'lab', 'bank', 'riceshop', 'classroom', 'cafe'].includes(name) ? `<rect width="1600" height="900" fill="#ff8a5c" opacity=".14"/>` : '';
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">` +
    (needsSky ? `<defs>${skyDefs(time, id)}</defs><rect width="1600" height="900" fill="url(#${id})"/>` + stars(time, r) : '') +
    fn(time, r, o) + tint + `</svg>`;
}
function speedSVG() {
  let s = '';
  for (let i = 0; i < 70; i++) {
    const a = i / 70 * Math.PI * 2 + Math.random() * .05, w = .006 + Math.random() * .012, r0 = 260 + Math.random() * 180;
    s += `<path d="M${800 + Math.cos(a) * r0} ${450 + Math.sin(a) * r0 * .7} L${800 + Math.cos(a - w) * 1500} ${450 + Math.sin(a - w) * 1500} L${800 + Math.cos(a + w) * 1500} ${450 + Math.sin(a + w) * 1500}Z" fill="#fff"/>`;
  }
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${s}</svg>`;
}


/* =====================================================================
   3. PARTICLES — rain, petals, sparkles, money, flyers, embers
   ===================================================================== */
function particles(cv) {
  const ctx = cv.getContext('2d');
  let parts = [], W = 0, H = 0, DPR = 1, ambAcc = 0;
  const AMB = { rain: ['rain', 6], petal: ['petal', .35], fire: ['ember', 1.4], sparkle: ['sparkle', .45], paper: ['paper', .3], money: ['money', .4] };
  const api = { ambient: null, scale: 1 };
  api.resize = () => {
    const r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    api.scale = clamp(W / 1000, .55, 1.6);
  };
  api.clear = () => { parts = []; };
  api.spawn = (type, n) => {
    const k = api.scale;
    for (let i = 0; i < n; i++) {
      const p = { type, x: Math.random() * W, y: -20 - Math.random() * H * .6, life: 1, rot: Math.random() * 6, vr: (Math.random() - .5) * .1, k };
      if (type === 'rain') { p.vy = (14 + Math.random() * 8) * k; p.vx = -2; p.len = (14 + Math.random() * 16) * k; }
      if (type === 'petal') { p.vy = .8 + Math.random(); p.vx = .6 + Math.random(); p.s = (5 + Math.random() * 5) * k; }
      if (type === 'money') { p.vy = (1.6 + Math.random() * 2) * k; p.vx = (Math.random() - .5) * 1.5; }
      if (type === 'paper') { p.vy = (1 + Math.random() * 1.6) * k; p.vx = (1.5 + Math.random() * 2) * k; p.c = ['#fff3bf', '#ffc9c9', '#d0ebff', '#fff'][i % 4]; }
      if (type === 'sparkle') { p.x = Math.random() * W; p.y = Math.random() * H * .8; p.vy = -.2; p.vx = 0; p.life = 1; p.decay = .012 + Math.random() * .015; p.s = (4 + Math.random() * 9) * k; }
      if (type === 'ember') { p.y = H + 10; p.vy = -(1.5 + Math.random() * 3) * k; p.vx = (Math.random() - .5) * 1.2; p.decay = .006 + Math.random() * .01; p.s = (1.5 + Math.random() * 3) * k; }
      parts.push(p);
    }
  };
  function tick() {
    ctx.clearRect(0, 0, W, H);
    const a = api.ambient;
    if (a && AMB[a]) { ambAcc += AMB[a][1]; while (ambAcc >= 1) { api.spawn(AMB[a][0], 1); ambAcc--; } }
    const out = [];
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.type === 'petal' || p.type === 'paper' || p.type === 'money') p.x += Math.sin(p.y / 40 + p.rot) * .8;
      if (p.decay) p.life -= p.decay;
      if (p.y > H + 40 || p.x > W + 60 || p.life <= 0 || p.y < -H) continue;
      out.push(p);
      ctx.save(); ctx.translate(p.x, p.y);
      switch (p.type) {
        case 'rain': ctx.strokeStyle = 'rgba(190,210,255,.55)'; ctx.lineWidth = 1.4 * p.k; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, -p.len); ctx.stroke(); break;
        case 'petal': ctx.rotate(p.rot); ctx.fillStyle = 'rgba(255,183,205,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .55, 0, 0, 7); ctx.fill(); break;
        case 'sparkle': { ctx.globalAlpha = Math.sin(p.life * Math.PI); ctx.fillStyle = '#fff6c8'; const s = p.s;
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); break; }
        case 'money': ctx.rotate(p.rot); ctx.scale(p.k, (Math.abs(Math.cos(p.rot * 2)) * .8 + .2) * p.k); ctx.fillStyle = '#69db7c'; ctx.fillRect(-18, -9, 36, 18);
          ctx.strokeStyle = '#2b8a3e'; ctx.lineWidth = 2; ctx.strokeRect(-15, -6, 30, 12); ctx.fillStyle = '#2b8a3e'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('₩', 0, 4); break;
        case 'paper': ctx.rotate(p.rot); ctx.scale(p.k, p.k); ctx.fillStyle = p.c; ctx.fillRect(-14, -18, 28, 36); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-9, -12, 18, 3); ctx.fillRect(-9, -5, 14, 2); ctx.fillRect(-9, 0, 16, 2); break;
        case 'ember': ctx.globalAlpha = p.life; ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); break;
      }
      ctx.restore();
    }
    parts = out;
    requestAnimationFrame(tick);
  }
  api.start = () => { api.resize(); window.addEventListener('resize', api.resize); requestAnimationFrame(tick); };
  return api;
}

/* =====================================================================
   4. SOUND — synthesized. Live (AudioContext) or offline (render a WAV
   from a logged event list, used to put sound into exported shorts).
   ===================================================================== */
const Snd = {
  on: false, ac: null, bgm: null, mood: 'hope', offT: null, log: null, logT0: 0,
  init() { if (!this.ac) { this.ac = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ac.createGain(); this.master.gain.value = .5; this.master.connect(this.ac.destination); } },
  now() { return this.offT != null ? this.offT : this.ac.currentTime; },
  record(k, a) { if (this.log) this.log.push({ t: performance.now() / 1000 - this.logT0, k, a }); },
  startLog() { this.log = []; this.logT0 = performance.now() / 1000; },
  tone(f, d = .08, type = 'square', v = .04, when = 0, slide = 0) {
    if (!this.on || !this.ac) return; const a = this.ac, t = this.now() + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + .02);
  },
  noise(d = .4, v = .2, lp = 1800) {
    if (!this.on || !this.ac) return; const a = this.ac, b = a.createBuffer(1, Math.floor(a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 2;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = v;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(this.master); s.start(this.now());
  },
  blip(ch, who) { this.record('blip', [ch, who]); if (/\s/.test(ch)) return; const base = who ? 420 + (who.charCodeAt(0) % 7) * 40 : 330; this.tone(base + Math.random() * 40, .035, 'square', .018); },
  fx(k) {
    this.record('fx', [k]);
    if (!this.on) return;
    if (k === 'flash') { this.tone(1400, .5, 'sawtooth', .05, 0, 200); this.noise(.3, .12, 4000); }
    if (k === 'shake') { this.tone(90, .35, 'sine', .25, 0, 40); this.noise(.35, .25, 500); }
    if (k === 'speed') this.tone(200, .5, 'sawtooth', .04, 0, 1600);
    if (k === 'sparkle') [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, .25, 'sine', .04, i * .07));
    if (k === 'money') [988, 1319].forEach((f, i) => this.tone(f, .2, 'square', .035, i * .08));
    if (k === 'zoom') this.tone(300, .25, 'triangle', .06, 0, 900);
    if (k === 'big') { this.tone(110, .6, 'sawtooth', .07, 0, 55); this.noise(.5, .18, 900); }
    if (k === 'pop') { this.tone(660, .12, 'triangle', .07, 0, 1320); }
    if (k === 'whoosh') { this.noise(.45, .16, 2400); this.tone(180, .4, 'sine', .05, 0, 720); }
    if (k === 'ding') [1319, 1760].forEach((f, i) => this.tone(f, .5, 'sine', .07, i * .12));
  },
  bgmPrep(mood) {
    const root = { brave: 196, hope: 220, bright: 261.6 }[mood] || 220;
    const pad = this.ac.createGain(); pad.gain.value = .045; pad.connect(this.master);
    return { root, pad, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]] };
  },
  bgmStep(b, step, t) {
    const a = this.ac, chord = b.prog[Math.floor(step / 8) % 4];
    if (step % 8 === 0) chord.forEach(s => { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = b.root / 2 * 2 ** (s / 12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .4); g.gain.linearRampToValueAtTime(0, t + 3.1); o.connect(g); g.connect(b.pad); o.start(t); o.stop(t + 3.2); });
    if (step % 2 === 0) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + .18);
      g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.connect(g); g.connect(b.pad); o.start(t); o.stop(t + .22); }
    const n = chord[step % 3] + (step % 4 === 3 ? 12 : 0), keep = this.offT;
    this.offT = t; this.tone(b.root * 2 ** ((n + 12) / 12), .28, 'sine', .03); this.offT = keep;
  },
  startBgm(mood) {
    this.record('bgm', [mood]);
    this.stopBgm(true); if (!this.on) return; this.mood = mood || 'hope';
    const b = this.bgmPrep(this.mood); let step = 0;
    const f = () => this.bgmStep(b, step++, this.ac.currentTime);
    f(); this.bgm = setInterval(f, 400);
  },
  stopBgm(inner) { if (!inner) this.record('bgmStop', []); if (this.bgm) clearInterval(this.bgm); this.bgm = null; },
  /* replay a logged session into an OfflineAudioContext → WAV (base64) */
  async renderWav(log, dur, sr = 44100) {
    const saved = { ac: this.ac, master: this.master, on: this.on, log: this.log };
    const oac = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
    this.ac = oac; this.master = oac.createGain(); this.master.gain.value = .5; this.master.connect(oac.destination); this.on = true; this.log = null;
    let bgm = null;
    const endBgm = t => { if (!bgm) return; for (let s = 0, tt = bgm.t; tt < Math.min(t, dur); s++, tt += .4) this.bgmStep(bgm.b, s, tt); bgm = null; };
    for (const e of log) {
      if (e.t >= dur) break;
      this.offT = Math.max(0, e.t);
      if (e.k === 'fx') this.fx(...e.a);
      else if (e.k === 'blip') this.blip(...e.a);
      else if (e.k === 'bgm') { endBgm(e.t); bgm = { t: e.t, b: this.bgmPrep(e.a[0] || 'hope') }; }
      else if (e.k === 'bgmStop') endBgm(e.t);
    }
    this.offT = null; endBgm(dur);
    const buf = await oac.startRendering();
    Object.assign(this, saved);
    return wavBase64(buf);
  }
};
function wavBase64(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, ch, true); data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i)); let o = 44;
  let peak = 1e-4; chans.forEach(c => { for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i])); });
  const gain = Math.min(8, .89 / peak);
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { data.setInt16(o, clamp(chans[c][i] * gain, -1, 1) * 32767, true); o += 2; }
  const bytes = new Uint8Array(data.buffer); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* =====================================================================
   5. AUTO CHARACTERS — same name, same face
   ===================================================================== */
const FACE_KO = { 보통:'normal', 기쁨:'smile', 미소:'smile', 웃음:'laugh', 놀람:'shock', 당황:'shock', 분노:'angry', 화남:'angry', 슬픔:'sad', 결의:'determined', 다짐:'determined', 생각:'think', 고민:'think', 눈물:'cry', 울음:'cry' };
const FX_KO = { 번쩍:'flash', 흔들:'shake', 집중선:'speed', 반짝:'sparkle', 돈비:'money', 돈:'money', 불:'fire', 비:'rain', 전단지:'paper', 종이:'paper', 꽃잎:'petal', 줌:'zoom' };
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function autoChar(name) {
  const r = rnd(hash(name));
  const pick = a => a[Math.floor(r() * a.length)];
  const style = pick(['short', 'spiky', 'part', 'bowl', 'long', 'long', 'bun']);
  const outfit = pick(['suit', 'shirt', 'hoodie', 'jacket', 'coat', 'apron']);
  const old = /할머니|할아버지|회장|아버지|어머니|엄마|아빠|사장|교수/.test(name);
  return { name, style: old && r() < .5 ? 'gray' : style, outfit: /엄마|어머니/.test(name) ? 'apron' : /회장|사장|투자자|부장|팀장/.test(name) ? 'suit' : outfit,
    hair: pick(['#161616', '#2b1d14', '#4a2f1f', '#1c1f2e', '#6b3e26', '#23150f']), color: pick(['#4dabf7', '#ff6b9e', '#51cf66', '#fcc419', '#845ef7', '#ff922b', '#343a40', '#e9ecef', '#20c997']),
    tie: r() < .4 ? pick(['#c92a2a', '#1c7ed6', '#f59f00']) : undefined, eye: pick(['#3b2a1a', '#2d1f14', '#355c8a', '#3d6b47']),
    glasses: r() < .3, age: old ? 'old' : pick(['young', 'adult']), sex: /엄마|어머니|할머니|누나|언니|딸|아내/.test(name) || (!/아버지|할아버지|아빠|형|오빠|아들/.test(name) && (style === 'long' || style === 'bun') && r() < .75) ? 'f' : 'm' };
}
/* =====================================================================
   6. VOICE — who sounds like what, and live playback via Web Speech
   The same casting drives the exported shorts (Edge neural voices) and
   the in-browser player (the viewer's own Korean system voices).
   ===================================================================== */
const NARRATOR = { name: '나레이션', narrator: true };
function isFemale(c) {
  if (!c || c.narrator) return true;
  if (c.sex) return c.sex === 'f';
  return /엄마|어머니|할머니|누나|언니|딸|아내|여자|여성/.test(c.name || '');
}
// edge-tts voice + pitch/rate offsets; each character gets a stable, distinct offset
function castVoice(c) {
  if (!c || c.narrator) return { voice: 'ko-KR-SunHiNeural', rate: '+6%', pitch: '-2Hz', female: true, pitchN: 0, rateN: 0 };
  const f = isFemale(c), r = rnd(hash(c.name || 'x')), old = c.age === 'old', young = c.age === 'young';
  const pitchN = Math.round((old ? -9 : young ? 5 : 0) + (r() - .5) * 8);
  const rateN = Math.round((old ? -8 : young ? 8 : 3) + (r() - .5) * 6);
  const voice = f ? 'ko-KR-SunHiNeural' : (c.age === 'adult' || old) && r() < .5 ? 'ko-KR-HyunsuMultilingualNeural' : 'ko-KR-InJoonNeural';
  return { voice, rate: (rateN >= 0 ? '+' : '') + rateN + '%', pitch: (pitchN >= 0 ? '+' : '') + pitchN + 'Hz', female: f, pitchN, rateN };
}
// what a voice should actually read
function speechText(t) {
  return String(t || '')
    .replace(/^\((.*)\)$/, '$1')
    .replace(/→/g, ', ').replace(/[·•]/g, ', ').replace(/~/g, '에서 ').replace(/…+/g, '… ')
    .replace(/[‘’“”"]/g, '').replace(/#(\d)/g, '$1번 ').replace(/\s+/g, ' ').trim();
}
const FEM_RE = /female|여성|yuna|sunhi|heami|seoyeon|jimin|sora|narae|google 한국의/i, MALE_RE = /(?<!fe)male|남성|injoon|hyunsu|minsang|bong|gook/i;
const Voice = {
  on: false, list: [],
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  load() {
    if (!this.supported) return;
    const get = () => { this.list = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang)); };
    get(); speechSynthesis.addEventListener?.('voiceschanged', get);
  },
  // best-effort gender match among the device's Korean voices
  pick(c) {
    if (!this.list.length) return null;
    const want = this.list.filter(v => (isFemale(c) ? FEM_RE : MALE_RE).test(v.name));
    const pool = want.length ? want : this.list;
    // neural/premium voices first, then Google's online voice, then whatever the device has
    const rank = v => (/natural|neural|premium|enhanced/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : v.localService ? 1 : 0);
    return [...pool].sort((a, b) => rank(b) - rank(a))[0];
  },
  cancel() { if (this.supported) speechSynthesis.cancel(); },
  // resolves when the line finishes (or at once if voice is off/unsupported)
  speak(text, c) {
    if (!this.on || !this.supported) return Promise.resolve();
    const t = speechText(text); if (!t) return Promise.resolve();
    this.cancel();
    c = c || NARRATOR;
    const cv = castVoice(c), u = new SpeechSynthesisUtterance(t), v = this.pick(c);
    u.lang = 'ko-KR'; if (v) u.voice = v;
    // same-voice devices still get distinct characters from pitch/rate; a wrong-gender voice is pushed toward the right range
    const fem = isFemale(c), vFem = v ? FEM_RE.test(v.name) : fem;
    u.pitch = clamp(1 + cv.pitchN / 22 + (vFem === fem ? 0 : fem ? .3 : -.3), .6, 1.6);
    u.rate = clamp(1.05 + cv.rateN / 100, .7, 1.4);
    return new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin; setTimeout(fin, 1500 + [...t].length * 260); speechSynthesis.speak(u); });
  }
};
Voice.load();

window.AnimeEngine = { Voice, castVoice, speechText, NARRATOR, isFemale, clamp, esc, uid, shade, rnd, hash, charSVG, bgSVG, speedSVG, particles, Snd, autoChar,
  BG, BG_KO, SKY, TIME_KO, FACE_KO, FX_KO };
})();
