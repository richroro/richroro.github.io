"use strict";
/* =========================================================================
   전 종목 탐색기 — data/stocks.json 하나를 읽어 검색·스크리너·상세 분석을 그립니다.
   외부 라이브러리 없음. 인터랙티브 차트만 누를 때 TradingView 위젯을 불러옵니다.
   ========================================================================= */

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("ko-KR");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const KR_MKTS = new Set(["KOSPI", "KOSDAQ", "KONEX"]);
const PAGE = 50;

let ROWS = [], BY_ID = new Map(), META = {}, MED = {}, DEEP = new Map();
let FAV = new Set(store.get("finder.fav", []));

/* ---------------------------------------------------------------- 형식 */
function sgn(v) { return v > 0 ? "+" : v < 0 ? "−" : ""; }
function pct(v, d = 1) { return v == null ? "—" : sgn(v) + Math.abs(v).toFixed(d) + "%"; }
function cls(v) { return v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : ""; }
function price(r, v = r.p) {
  if (v == null) return "—";
  if (r.g === "KR") return nf.format(Math.round(v)) + "원";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v < 1 ? 4 : 2, maximumFractionDigits: v < 1 ? 4 : 2 });
}
function usdM(v) { // 백만 달러
  if (v == null) return "—";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + "T";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + "B";
  return "$" + Math.round(v) + "M";
}
function krwM(v) { // 백만 원
  if (v == null) return "—";
  if (v >= 1e6) return (v >= 1e8 ? nf.format(Math.round(v / 1e6)) : (v / 1e6).toFixed(1)) + "조원";
  if (v >= 100) return nf.format(Math.round(v / 100)) + "억원";
  return nf.format(Math.round(v)) + "백만원";
}
function cap(r) { return r.mc == null ? "—" : r.g === "KR" ? krwM(r.mc) : usdM(r.mc); }
function money(r, vM) { return r.g === "KR" ? krwM(vM) : usdM(vM); }
function capOther(r) {
  if (!META.fx || r.mc == null) return "";
  return r.g === "KR" ? "≈ " + usdM(r.mc / META.fx) : "≈ " + krwM(r.mc * META.fx);
}
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#c98500", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#475569", "#b45309"];
function avColor(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
function avText(r) { return r.g === "KR" ? r.name.replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 2) : r.id.replace(".", "").slice(0, 4); }
function avatar(r, size) {
  const s = size ? `width:${size}px;height:${size}px;font-size:${Math.round(size / 3)}px;` : "";
  return `<span class="av" style="${s}background:${avColor(r.id)}">${esc(avText(r))}</span>`;
}
function mBadge(r) { return `<span class="mbadge ${r.g}">${r.m}</span>`; }

/* ---------------------------------------------------------------- 한글 초성 */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
function chosung(s) {
  let o = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xAC00;
    o += c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : /[ㄱ-ㅎ]/.test(ch) ? ch : "";
  }
  return o;
}
const norm = (s) => String(s).toLowerCase().replace(/[\s.\-·,&'()]/g, "");

/* ---------------------------------------------------------------- 데이터 */
async function load() {
  const res = await fetch("data/stocks.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const d = await res.json();
  META = d.meta;
  const C = META.cols;
  ROWS = d.rows.map((a, i) => {
    const r = {};
    C.forEach((k, j) => { r[k] = a[j]; });
    r.g = KR_MKTS.has(r.m) ? "KR" : "US";
    const kos = r.ko ? r.ko.split("|") : [];
    r.name = r.g === "KR" ? r.n : (kos[0] || r.n);
    r.sub = r.g === "KR" ? r.id : (kos[0] ? r.n : "");
    r.rk = i; // 시총 순위(파일이 시총 순으로 정렬돼 있다)
    const names = [r.n, ...kos];
    r._k = names.map(norm);
    r._id = r.id.toLowerCase();
    r._cho = names.map(chosung).filter((x) => x.length > 1);
    r._f = (r.id + " " + names.join(" ") + " " + r.ind + " " + r.sec).toLowerCase();
    return r;
  });
  ROWS.forEach((r) => BY_ID.set(r.id, r));
  for (const g of ["US", "KR"]) {
    const rs = ROWS.filter((r) => r.g === g);
    MED[g] = { vol: median(rs.map((r) => r.vol)), d1: median(rs.map((r) => r.d1)), n: rs.length,
               scored: rs.filter((r) => r.sm != null).length };
  }
  if (typeof REGISTRY !== "undefined") {
    for (const e of REGISTRY) DEEP.set(e.tk, { href: e.href || e.base + e.slug + "/", hint: e.hint });
  }
}
function median(a) {
  const v = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function liquid(r) { return r.tv == null ? true : r.g === "KR" ? r.tv >= 100 : r.tv >= 1; }

/* ---------------------------------------------------------------- 검색 */
function search(q, limit = 8) {
  const raw = q.trim();
  if (!raw) return [];
  const qn = norm(raw), ql = raw.toLowerCase();
  const isCho = /^[ㄱ-ㅎ]+$/.test(raw.replace(/\s/g, ""));
  const qc = raw.replace(/\s/g, "");
  const out = [];
  for (const r of ROWS) {
    let s = 0;
    if (isCho) {
      for (const c of r._cho) { if (c.startsWith(qc)) s = Math.max(s, 260); else if (c.includes(qc)) s = Math.max(s, 120); }
    } else {
      if (r._id === ql) s = 1000;
      else if (r._id.startsWith(ql)) s = 520 - r._id.length;
      for (const k of r._k) {
        if (!qn) break;
        if (k === qn) s = Math.max(s, 900);
        else if (k.startsWith(qn)) s = Math.max(s, 400);
        else if (k.includes(qn)) s = Math.max(s, 150);
      }
    }
    if (s) out.push([s + Math.log10((r.mcu || 1) + 1) * 12, r]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, limit).map((x) => x[1]);
}
function hl(text, q) {
  const t = String(text), i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0 || !q) return esc(t);
  return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
}

function initSearch() {
  const q = $("q"), box = $("sres"), wrap = $("sbox");
  let items = [], sel = -1;
  const close = () => { box.hidden = true; wrap.setAttribute("aria-expanded", "false"); sel = -1; };
  const paint = () => {
    const raw = q.value.trim();
    items = search(raw);
    if (!raw) { close(); return; }
    box.hidden = false; wrap.setAttribute("aria-expanded", "true");
    if (!items.length) { box.innerHTML = `<div class="empty">‘${esc(raw)}’에 맞는 종목이 없습니다. 티커(예: AAPL)나 종목코드(예: 005930)로도 찾아보세요.</div>`; return; }
    box.innerHTML = items.map((r, i) => `
      <div class="it" role="option" id="opt${i}" data-id="${esc(r.id)}" aria-selected="${i === sel}">
        ${avatar(r)}
        <div class="nm"><b>${hl(r.name, raw)}</b><small>${mBadge(r)} ${hl(r.g === "KR" ? r.id : r.id + (r.sub ? " · " + r.sub : ""), raw)}${r.sec ? " · " + esc(r.sec) : ""}</small></div>
        <div class="px">${price(r)}<small class="${cls(r.d1)}">${pct(r.d1, 2)}</small></div>
      </div>`).join("");
  };
  q.addEventListener("input", () => { sel = -1; paint(); });
  q.addEventListener("focus", paint);
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      paint(); q.setAttribute("aria-activedescendant", "opt" + sel);
      $("opt" + sel)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const r = items[sel >= 0 ? sel : 0];
      if (r) { close(); q.blur(); openDetail(r.id); }
    } else if (e.key === "Escape") { close(); q.blur(); }
  });
  box.addEventListener("mousedown", (e) => {
    const it = e.target.closest(".it"); if (!it) return;
    e.preventDefault(); close(); q.blur(); openDetail(it.dataset.id);
  });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$("dt").open) {
      e.preventDefault(); q.focus(); window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  const popular = ["005930", "000660", "NVDA", "TSLA", "AAPL", "PLTR", "IONQ", "005380", "035420", "373220"];
  $("shint").innerHTML = "<span>많이 찾는 종목</span>" + popular.map((id) => BY_ID.get(id)).filter(Boolean)
    .map((r) => `<button class="chip" type="button" data-id="${r.id}">${esc(r.name)}</button>`).join("");
  $("shint").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) openDetail(b.dataset.id); });
}

/* ---------------------------------------------------------------- 머리 · 오늘 시장 */
function renderFresh() {
  const c = META.counts || {};
  const fx = META.fx ? `<span>환율 <b>${nf.format(META.fx)}원/$</b>${/추정/.test(META.fxSrc || "") ? "(ADR 비율로 추정)" : ""}</span>` : "";
  $("fresh").innerHTML =
    `<span>미국 <b>${nf.format(c.US || 0)}</b> · 한국 <b>${nf.format(c.KR || 0)}</b>종목</span>` +
    `<span>한국 기준일 <b>${META.krAsof || "—"}</b></span>` +
    `<span>미국 기준일 <b>${META.usAsof || "최근 거래일(스냅샷)"}</b></span>` + fx;
}
function renderPulse() {
  const box = $("pulseBox");
  box.innerHTML = ["KR", "US"].map((g) => {
    const rs = ROWS.filter((r) => r.g === g && r.d1 != null);
    const up = rs.filter((r) => r.d1 > 0).length, dn = rs.filter((r) => r.d1 < 0).length, fl = rs.length - up - dn;
    const hi = ROWS.filter((r) => r.g === g && r.fh != null && r.fh >= -3 && liquid(r)).length;
    const hasHist = ROWS.some((r) => r.g === g && r.fh != null);
    const half = rs.filter(liquid).sort((a, b) => (b.mcu || 0) - (a.mcu || 0)).slice(0, Math.max(50, Math.floor(rs.length / 2)));
    const top = [...half].sort((a, b) => b.d1 - a.d1).slice(0, 5), bot = [...half].sort((a, b) => a.d1 - b.d1).slice(0, 5);
    const tot = rs.length || 1;
    const mv = (r) => `<div class="mv" data-id="${r.id}"><b>${esc(r.name)}</b><span class="${cls(r.d1)}">${pct(r.d1)}</span></div>`;
    return `<div class="card pcard">
      <div class="hd"><b>${g === "KR" ? "🇰🇷 한국" : "🇺🇸 미국"}</b><small>${g === "KR" ? META.krAsof || "" : META.usAsof || "스냅샷"}</small></div>
      <div class="breadth" role="img" aria-label="상승 ${up} 보합 ${fl} 하락 ${dn}">
        <i style="width:${up / tot * 100}%;background:var(--fill-up)"></i><i style="width:${fl / tot * 100}%;background:var(--surface-3)"></i><i style="width:${dn / tot * 100}%;background:var(--fill-down)"></i></div>
      <div class="bleg"><span class="up">상승 ${nf.format(up)}</span><span>보합 ${nf.format(fl)}</span><span class="down">하락 ${nf.format(dn)}</span></div>
      <div class="pstats">
        <div><div class="k">중위 등락률</div><div class="v ${cls(MED[g].d1)}">${pct(MED[g].d1, 2)}</div></div>
        <div><div class="k">상승 비율</div><div class="v">${Math.round(up / tot * 100)}%</div></div>
        <div><div class="k">52주 신고가권</div><div class="v">${hasHist ? nf.format(hi) : "—"}</div></div>
      </div>
      <div class="movers"><div><h4>많이 오른 종목</h4>${top.map(mv).join("")}</div><div><h4>많이 내린 종목</h4>${bot.map(mv).join("")}</div></div>
    </div>`;
  }).join("");
  box.onclick = (e) => { const m = e.target.closest("[data-id]"); if (m) openDetail(m.dataset.id); };
}

/* ---------------------------------------------------------------- 업종 흐름 */
const secState = { g: "KR", k: "d1" };
function heat(v, span) {
  if (v == null || Math.abs(v) < 0.005) return "var(--surface-2)";
  const t = Math.min(1, Math.abs(v) / span);
  const c = v >= 0 ? "var(--fill-up)" : "var(--fill-down)";
  return `color-mix(in srgb, ${c} ${Math.round(8 + t * 52)}%, var(--surface))`;
}
function renderSectors() {
  const { g, k } = secState;
  const groups = new Map();
  for (const r of ROWS) {
    if (r.g !== g || !r.sec || !liquid(r)) continue;
    if (!groups.has(r.sec)) groups.set(r.sec, []);
    groups.get(r.sec).push(r);
  }
  let list = [...groups].map(([sec, rs]) => ({ sec, n: rs.length, v: median(rs.map((r) => r[k])) }))
    .filter((x) => x.n >= (g === "KR" ? 5 : 3) && x.v != null);
  const note = $("secNote");
  if (!list.length) {
    $("secGrid").innerHTML = "";
    note.textContent = !groups.size
      ? (g === "KR" ? "한국 종목의 업종 정보(KIND)는 다음 자동 갱신 때 채워집니다." : "업종 정보가 없습니다.")
      : "이 기간의 수익률은 일봉 데이터가 채워진 뒤 계산됩니다. 지금은 1일 등락만 볼 수 있습니다.";
    return;
  }
  // 한국은 업종이 잘게 나뉘어 있어 종목 수가 많은 40개만 고른 뒤 등락 순으로 놓는다
  if (g === "KR" && list.length > 40) list = list.filter((x) => x.n >= 8).sort((a, b) => b.n - a.n).slice(0, 40);
  list.sort((a, b) => b.v - a.v);
  const span = Math.max(...list.map((x) => Math.abs(x.v)), k === "d1" ? 2 : 8);
  $("secGrid").innerHTML = list.map((x) => `<button class="sec" type="button" data-sec="${esc(x.sec)}" style="background:${heat(x.v, span)}">
      <b title="${esc(x.sec)}">${esc(x.sec)}</b><div class="v">${pct(x.v, k === "d1" ? 2 : 1)}</div><small>${x.n}종목</small></button>`).join("");
  note.textContent = g === "KR" && groups.size > list.length ? "한국은 업종이 잘게 나뉘어 있어 종목 수가 많은 40개 업종만 보여줍니다. 나머지는 스크리너의 업종 목록에 있습니다." : "";
}
function initSectors() {
  seg($("secMkt"), (v) => { secState.g = v; renderSectors(); });
  seg($("secPer"), (v) => { secState.k = v; renderSectors(); });
  $("secGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sec]"); if (!b) return;
    S.mkt = secState.g; S.sector = b.dataset.sec; S.preset = null; S.exch = "";
    syncControls(); renderTable(true);
    $("screener").scrollIntoView({ behavior: "smooth" });
  });
}
function seg(el, fn) {
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    fn(b.dataset.v);
  });
}
function setSeg(el, v) { el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === v ? "true" : "false")); }

/* ---------------------------------------------------------------- 스크리너 */
const PRESETS = [
  { id: "cap", t: "시총 상위", sort: ["mcu", -1] },
  { id: "gain", t: "오늘 급등", sort: ["d1", -1], f: (r) => r.d1 != null },
  { id: "lose", t: "오늘 급락", sort: ["d1", 1], f: (r) => r.d1 != null },
  { id: "high", t: "52주 신고가권", sort: ["fh", -1], f: (r) => r.fh != null && r.fh >= -3 },
  { id: "low", t: "52주 저점권", sort: ["fl", 1], f: (r) => r.fl != null && r.fl <= 5 },
  { id: "gc", t: "골든크로스", sort: ["mcu", -1], f: (r) => r.x === "G" },
  { id: "dc", t: "데드크로스", sort: ["mcu", -1], f: (r) => r.x === "D" },
  { id: "os", t: "과매도 RSI<30", sort: ["rsi", 1], f: (r) => r.rsi != null && r.rsi < 30 },
  { id: "ob", t: "과열 RSI>70", sort: ["rsi", -1], f: (r) => r.rsi != null && r.rsi > 70 },
  { id: "surge", t: "거래 급증", sort: ["vs", -1], f: (r) => r.vs != null && r.vs >= 2 },
  { id: "trend", t: "정배열 + 강한 모멘텀", sort: ["sm", -1], f: (r) => r.up === 1 && r.pm50 > 0 && r.sm >= 70 },
  { id: "calm", t: "덜 흔들린 대형주", sort: ["ss", -1], f: (r) => (r.mcu || 0) >= 10000 && r.ss >= 70 },
  { id: "y1", t: "1년 수익률 상위", sort: ["r252", -1], f: (r) => r.r252 != null },
  { id: "dd", t: "고점 대비 반토막", sort: ["mcu", -1], f: (r) => r.fh != null && r.fh <= -50 && (r.mcu || 0) >= 1000 },
];
const SIZES = { mega: [2e5, Infinity], large: [1e4, 2e5], mid: [2e3, 1e4], small: [300, 2e3], micro: [0, 300] };
const S = { mkt: "ALL", exch: "", sector: "", size: "", preset: null, flt: "", liq: true, view: "basic", sort: ["mcu", -1], limit: PAGE };

function trendTag(r) {
  if (r.x === "G") return `<span class="xtag G">골든크로스</span>`;
  if (r.x === "D") return `<span class="xtag D">데드크로스</span>`;
  if (r.pm50 == null || r.pm200 == null) return "—";
  if (r.up === 1 && r.pm50 > 0) return `<span class="up">정배열</span>`;
  if (r.up === 0 && r.pm50 < 0) return `<span class="down">역배열</span>`;
  return `<span style="color:var(--ink-3)">혼조</span>`;
}
function spark(r, w = 84, h = 24) {
  if (!r.sp) return "";
  const pts = decodeSpark(r.sp);
  const n = pts.length, dx = w / (n - 1);
  const d = pts.map((v, i) => (i ? "L" : "M") + (i * dx).toFixed(1) + " " + (h - 2 - v * (h - 4)).toFixed(1)).join("");
  const col = pts[n - 1] >= pts[0] ? "var(--up)" : "var(--down)";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
const ABC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
function decodeSpark(s) { return [...s].map((c) => ABC.indexOf(c) / 63); }
function scoreCell(v) {
  if (v == null) return "—";
  return `${v}<span class="bar100"><i style="width:${v}%;background:${v >= 70 ? "var(--s3)" : v <= 30 ? "var(--s2)" : "var(--s1)"}"></i></span>`;
}
const COLS = {
  name: { t: "종목", k: "name", tx: true, r: (r) => `<div class="co">${avatar(r)}<div style="min-width:0"><b>${esc(r.name)}</b><small>${mBadge(r)}<span>${esc(r.id)}</span>${r.warn ? '<span class="wtag">관리·주의</span>' : ""}</small></div></div>` },
  p: { t: "가격", k: "p", r: (r) => price(r) },
  d1: { t: "1일", k: "d1", r: (r) => `<span class="${cls(r.d1)}">${pct(r.d1, 2)}</span>` },
  mc: { t: "시가총액", k: "mcu", r: (r) => cap(r) },
  r21: { t: "1개월", k: "r21", r: (r) => `<span class="${cls(r.r21)}">${pct(r.r21)}</span>` },
  r252: { t: "1년", k: "r252", r: (r) => `<span class="${cls(r.r252)}">${pct(r.r252)}</span>` },
  fh: { t: "52주 고점 대비", k: "fh", r: (r) => pct(r.fh) },
  sp: { t: "1년 추이", k: null, r: (r) => spark(r) },
  rsi: { t: "RSI", k: "rsi", r: (r) => r.rsi == null ? "—" : `<span class="${r.rsi >= 70 ? "up" : r.rsi <= 30 ? "down" : ""}">${r.rsi}</span>` },
  pm50: { t: "50일선 대비", k: "pm50", r: (r) => `<span class="${cls(r.pm50)}">${pct(r.pm50)}</span>` },
  pm200: { t: "200일선 대비", k: "pm200", r: (r) => `<span class="${cls(r.pm200)}">${pct(r.pm200)}</span>` },
  tr: { t: "추세", k: "st", r: (r) => trendTag(r), tx: true },
  vol: { t: "변동성", k: "vol", r: (r) => r.vol == null ? "—" : r.vol.toFixed(0) + "%" },
  mdd: { t: "1년 최대낙폭", k: "mdd", r: (r) => pct(r.mdd) },
  vs: { t: "거래 배수", k: "vs", r: (r) => r.vs == null ? "—" : `<span class="${r.vs >= 2 ? "up" : ""}">${r.vs.toFixed(1)}×</span>` },
  sm: { t: "모멘텀", k: "sm", r: (r) => scoreCell(r.sm) },
  st: { t: "추세", k: "st", r: (r) => scoreCell(r.st) },
  ss: { t: "안정성", k: "ss", r: (r) => scoreCell(r.ss) },
  sl: { t: "유동성", k: "sl", r: (r) => scoreCell(r.sl) },
};
const VIEWS = {
  basic: ["name", "p", "d1", "mc", "r21", "r252", "fh", "sp"],
  tech: ["name", "p", "d1", "rsi", "pm50", "pm200", "tr", "vol", "mdd", "vs"],
  score: ["name", "d1", "r252", "sm", "st", "ss", "sl"],
};

function baseFilter(r) {
  if (S.mkt === "FAV") { if (!FAV.has(r.id)) return false; }
  else if (S.mkt !== "ALL" && r.g !== S.mkt) return false;
  if (S.exch && r.m !== S.exch) return false;
  if (S.sector && r.sec !== S.sector) return false;
  if (S.size) { const [a, b] = SIZES[S.size]; if (r.mcu == null || r.mcu < a || r.mcu >= b) return false; }
  if (S.liq && S.mkt !== "FAV" && !liquid(r)) return false;
  if (S.flt && !r._f.includes(S.flt)) return false;
  return true;
}
function filtered() {
  const pre = PRESETS.find((p) => p.id === S.preset);
  const rs = ROWS.filter((r) => baseFilter(r) && (!pre || !pre.f || pre.f(r)));
  const [k, dir] = S.sort;
  const val = (r) => k === "name" ? r.name : r[k];
  rs.sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return a.rk - b.rk;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "string") return x.localeCompare(y, "ko") * dir;
    return (x - y) * dir || a.rk - b.rk;
  });
  return rs;
}
function renderPresets() {
  const base = ROWS.filter(baseFilter);
  $("presets").innerHTML = PRESETS.map((p) => {
    const n = p.f ? base.filter(p.f).length : base.length;
    return `<button class="chip" type="button" data-p="${p.id}" aria-pressed="${S.preset === p.id}"${n ? "" : " disabled style=\"opacity:.45\""}>${p.t}<span class="c">${nf.format(n)}</span></button>`;
  }).join("");
}
function renderTable(resetLimit) {
  if (resetLimit) S.limit = PAGE;
  const rs = filtered();
  const cols = VIEWS[S.view].map((c) => COLS[c]);
  const thead = $("tbl").tHead, tbody = $("tbl").tBodies[0];
  thead.innerHTML = `<tr><th class="st" aria-label="관심"></th><th class="rank">#</th>` + cols.map((c) =>
    `<th${c.k ? ` class="sortable" tabindex="0" data-k="${c.k}" aria-sort="${S.sort[0] === c.k ? (S.sort[1] < 0 ? "descending" : "ascending") : "none"}"` : ""}${c.tx ? ' style="text-align:left"' : ""}>${c.t}</th>`).join("") + "</tr>";
  tbody.innerHTML = rs.length ? rs.slice(0, S.limit).map((r, i) => `<tr data-id="${esc(r.id)}">
      <td class="st"><button class="star" type="button" data-fav="${esc(r.id)}" aria-pressed="${FAV.has(r.id)}" aria-label="관심 종목">${FAV.has(r.id) ? "★" : "☆"}</button></td>
      <td class="rank">${i + 1}</td>` + cols.map((c) => `<td${c.tx ? ` class="tx${c === COLS.name ? " nmc" : ""}" style="text-align:left"` : ""}>${c.r(r)}</td>`).join("") + "</tr>").join("")
    : `<tr><td colspan="${cols.length + 2}" class="empty-t">${S.mkt === "FAV" ? "★를 눌러 관심 종목을 추가하면 여기에 모입니다." : "조건에 맞는 종목이 없습니다. 조건을 줄여 보세요."}</td></tr>`;
  $("count").textContent = `${nf.format(rs.length)}종목` + (rs.length > S.limit ? ` 중 ${nf.format(S.limit)}개 표시` : "");
  $("moreBtn").hidden = rs.length <= S.limit;
  renderPresets();
}
function fillSelects() {
  const ex = $("exch");
  const exs = S.mkt === "US" ? ["NASDAQ", "NYSE", "AMEX"] : S.mkt === "KR" ? ["KOSPI", "KOSDAQ", "KONEX"] : ["NASDAQ", "NYSE", "AMEX", "KOSPI", "KOSDAQ", "KONEX"];
  if (S.exch && !exs.includes(S.exch)) S.exch = "";
  ex.innerHTML = `<option value="">거래소 전체</option>` + exs.map((x) => `<option${x === S.exch ? " selected" : ""}>${x}</option>`).join("");
  const sec = $("sector");
  const opt = (g) => {
    const m = new Map();
    for (const r of ROWS) if (r.g === g && r.sec) m.set(r.sec, (m.get(r.sec) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([s, n]) => `<option value="${esc(s)}"${s === S.sector ? " selected" : ""}>${esc(s)} (${n})</option>`).join("");
  };
  const us = S.mkt !== "KR" ? opt("US") : "", kr = S.mkt !== "US" ? opt("KR") : "";
  sec.innerHTML = `<option value="">업종 전체</option>` +
    (us && kr ? `<optgroup label="미국">${us}</optgroup><optgroup label="한국">${kr}</optgroup>` : us + kr);
  if (S.sector && !sec.querySelector(`option[value="${CSS.escape(S.sector)}"]`)) S.sector = "";
  sec.value = S.sector;
}
function syncControls() {
  setSeg($("mkt"), S.mkt); setSeg($("view"), S.view);
  fillSelects();
  $("size").value = S.size; $("flt").value = S.flt; $("liq").checked = S.liq;
}
function initScreener() {
  seg($("mkt"), (v) => { S.mkt = v; fillSelects(); renderTable(true); });
  seg($("view"), (v) => { S.view = v; renderTable(); });
  $("exch").addEventListener("change", (e) => { S.exch = e.target.value; renderTable(true); });
  $("sector").addEventListener("change", (e) => { S.sector = e.target.value; renderTable(true); });
  $("size").addEventListener("change", (e) => { S.size = e.target.value; renderTable(true); });
  $("liq").addEventListener("change", (e) => { S.liq = e.target.checked; renderTable(true); });
  let t; $("flt").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { S.flt = e.target.value.trim().toLowerCase(); renderTable(true); }, 120); });
  $("presets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-p]"); if (!b) return;
    const p = PRESETS.find((x) => x.id === b.dataset.p);
    S.preset = S.preset === p.id ? null : p.id;
    S.sort = S.preset ? [...p.sort] : ["mcu", -1];
    // RSI·교차·거래 급증은 기술적 열 묶음에서 봐야 의미가 보인다
    if (S.preset && ["os", "ob", "gc", "dc", "surge"].includes(p.id) && S.view === "basic") S.view = "tech";
    syncControls(); renderTable(true);
  });
  $("tbl").tHead.addEventListener("click", sortClick);
  $("tbl").tHead.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortClick(e); } });
  $("tbl").tBodies[0].addEventListener("click", (e) => {
    const f = e.target.closest("[data-fav]");
    if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); return; }
    const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(tr.dataset.id);
  });
  $("moreBtn").addEventListener("click", () => { S.limit += PAGE; renderTable(); });
  $("reset").addEventListener("click", () => {
    Object.assign(S, { mkt: "ALL", exch: "", sector: "", size: "", preset: null, flt: "", liq: true, sort: ["mcu", -1] });
    syncControls(); renderTable(true);
  });
  $("csv").addEventListener("click", exportCsv);
  syncControls(); renderTable(true);
}
function sortClick(e) {
  const th = e.target.closest("th[data-k]"); if (!th) return;
  const k = th.dataset.k;
  S.sort = S.sort[0] === k ? [k, -S.sort[1]] : [k, k === "name" || k === "fl" ? 1 : -1];
  renderTable(true);
}
function toggleFav(id) {
  FAV.has(id) ? FAV.delete(id) : FAV.add(id);
  store.set("finder.fav", [...FAV]);
  renderTable();
  if ($("dt").open && CUR && CUR.id === id) paintStar();
}
function exportCsv() {
  const rs = filtered();
  const H = ["시장", "티커/코드", "이름", "영문·한글 병기", "업종", "산업", "통화", "가격", "1일(%)", "시총(백만, 현지통화)", "시총(백만 달러)",
    "1주(%)", "1개월(%)", "3개월(%)", "6개월(%)", "연초이후(%)", "1년(%)", "52주고점대비(%)", "RSI14", "50일선대비(%)", "200일선대비(%)",
    "변동성(%)", "1년최대낙폭(%)", "거래배수", "모멘텀", "추세", "안정성", "유동성"];
  const q = (v) => v == null ? "" : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  const lines = [H.join(",")].concat(rs.map((r) => [r.m, r.id, r.name, r.sub, r.sec, r.ind, r.g === "KR" ? "KRW" : "USD", r.p, r.d1, r.mc, r.mcu,
    r.r5, r.r21, r.r63, r.r126, r.ytd, r.r252, r.fh, r.rsi, r.pm50, r.pm200, r.vol, r.mdd, r.vs, r.sm, r.st, r.ss, r.sl].map(q).join(",")));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `stocks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------------------------------------------------------- 상세 분석 */
let CUR = null, pushed = false;
function insights(r) {
  const L = [];
  const add = (kind, html) => L.push({ kind, html });
  const nm = r.g === "KR" ? "한국" : "미국";
  if (r.warn) add("warn", "<b>관리종목 또는 투자주의환기 종목</b>입니다. 상장폐지 사유와 공시를 먼저 확인하세요.");
  if (!liquid(r)) add("warn", "최근 거래가 거의 없습니다. 표시된 가격이 실제로 사고팔 수 있는 가격과 다를 수 있습니다.");
  if (r.pm50 != null && r.pm200 != null) {
    if (r.up === 1 && r.pm50 > 0) add("pos", `주가가 50일선(${pct(r.pm50)})과 200일선(${pct(r.pm200)}) 위에 있고 50일선이 200일선보다 높은 <b>정배열</b> — 중기 상승 추세입니다.`);
    else if (r.up === 0 && r.pm50 < 0) add("neg", `주가가 50일선(${pct(r.pm50)}) 아래, 50일선이 200일선 아래인 <b>역배열</b> — 중기 하락 추세입니다.`);
    else add("neu", `50일선 대비 ${pct(r.pm50)}, 200일선 대비 ${pct(r.pm200)} — 단기와 장기 추세가 <b>엇갈립니다</b>.`);
  }
  if (r.x === "G") add("pos", "최근 20거래일 안에 50일선이 200일선을 위로 뚫었습니다(<b>골든크로스</b>).");
  if (r.x === "D") add("neg", "최근 20거래일 안에 50일선이 200일선 아래로 내려갔습니다(<b>데드크로스</b>).");
  if (r.fh != null) {
    if (r.fh >= -3) add("pos", `52주 최고가에서 ${pct(r.fh)} — <b>신고가권</b>입니다.`);
    else if (r.fl != null && r.fl <= 10) add("neg", `52주 최저가에서 ${pct(r.fl)} 위 — <b>저점권</b>입니다. 최고가 대비 ${pct(r.fh)}.`);
    else if (r.fh <= -50) add("neg", `52주 최고가 대비 <b>${pct(r.fh)}</b> — 고점의 절반 아래에 있습니다.`);
    else add("neu", `52주 범위에서 최고가 대비 ${pct(r.fh)}, 최저가 대비 ${pct(r.fl)}에 있습니다.`);
  }
  if (r.rsi != null) {
    if (r.rsi >= 70) add("warn", `RSI ${r.rsi} — 단기 <b>과열</b> 구간입니다. 짧은 기간에 많이 올랐다는 뜻입니다.`);
    else if (r.rsi <= 30) add("neu", `RSI ${r.rsi} — 단기 <b>과매도</b> 구간입니다. 짧은 기간에 많이 내렸다는 뜻입니다.`);
  }
  if (r.vs != null) {
    if (r.vs >= 2) add("warn", `최근 5일 거래량이 60일 평균의 <b>${r.vs.toFixed(1)}배</b> — 평소보다 관심이 크게 몰렸습니다.`);
    else if (r.vs <= 0.5) add("neu", `최근 5일 거래량이 60일 평균의 ${r.vs.toFixed(1)}배로 줄었습니다.`);
  }
  if (r.vol != null && MED[r.g].vol) {
    const k = r.vol / MED[r.g].vol;
    add(k >= 1.5 ? "warn" : "neu", `연환산 변동성 <b>${r.vol.toFixed(0)}%</b> — ${nm} 중위(${MED[r.g].vol.toFixed(0)}%)의 ${k.toFixed(1)}배입니다.` + (r.mdd != null ? ` 지난 1년 최대 낙폭은 ${pct(r.mdd)}.` : ""));
  }
  if (r.sm != null) {
    if (r.sm >= 80) add("pos", `3개월·6개월·1년 수익률이 ${nm} 종목 중 <b>상위 ${Math.max(1, 100 - r.sm)}%</b> 안쪽입니다.`);
    else if (r.sm <= 20) add("neg", `3개월·6개월·1년 수익률이 ${nm} 종목 중 <b>하위 ${Math.max(1, r.sm)}%</b> 안쪽입니다.`);
  }
  if (r.nd != null && r.nd < 252) add("neu", `데이터가 ${r.nd}거래일치라 1년 지표 일부가 비어 있습니다(최근 상장이거나 거래정지 기간이 있었을 수 있습니다).`);
  if (r.nd == null && r.g === "US") add("neu", "이 종목의 1년 일봉은 다음 자동 갱신 때 채워집니다. 지금은 전 거래일 가격·등락·시가총액만 있습니다. 아래 인터랙티브 차트는 바로 볼 수 있습니다.");
  return L;
}
function tvSymbol(r) { return r.g === "KR" ? "KRX:" + r.id : r.m + ":" + r.id; }
function extLinks(r) {
  const L = [];
  const deep = DEEP.get(r.id);
  if (deep) L.push(`<a class="deep" href="${deep.href}">📘 종목 노트 심층 분석</a>`);
  if (r.g === "KR") {
    L.push(`<a href="https://finance.naver.com/item/main.naver?code=${r.id}" target="_blank" rel="noopener">네이버 증권 ↗</a>`);
    L.push(`<a href="https://finance.daum.net/quotes/A${r.id}" target="_blank" rel="noopener">다음 금융 ↗</a>`);
    L.push(`<a href="https://dart.fss.or.kr/dsab007/main.do?option=corp&textCrpNm=${encodeURIComponent(r.n)}" target="_blank" rel="noopener">DART 공시 ↗</a>`);
  } else {
    L.push(`<a href="https://finance.yahoo.com/quote/${r.id.replace(".", "-")}" target="_blank" rel="noopener">Yahoo Finance ↗</a>`);
    L.push(`<a href="https://finviz.com/quote.ashx?t=${r.id.replace(".", "-")}" target="_blank" rel="noopener">Finviz ↗</a>`);
    L.push(`<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(r.id.replace(".", "-"))}&type=10-K" target="_blank" rel="noopener">SEC 공시 ↗</a>`);
  }
  L.push(`<a href="https://www.tradingview.com/symbols/${tvSymbol(r).replace(":", "-")}/" target="_blank" rel="noopener">TradingView ↗</a>`);
  return L.join("");
}
function peers(r) {
  let pool, label;
  if (r.sec) { pool = ROWS.filter((x) => x.g === r.g && x.sec === r.sec && liquid(x)); label = `같은 업종 · ${r.sec}`; }
  if (!pool || pool.length < 3) { pool = ROWS.filter((x) => x.m === r.m && liquid(x)); label = `같은 시장(${r.m})에서 시가총액이 비슷한 종목`; }
  pool = [...pool].sort((a, b) => (b.mcu || 0) - (a.mcu || 0));
  let list;
  if (r.sec && label.startsWith("같은 업종")) list = pool.slice(0, 8);
  else { const i = pool.findIndex((x) => x.id === r.id); const c = i < 0 ? 0 : i; list = pool.slice(Math.max(0, c - 4), c + 4); }
  if (!list.includes(r)) list = [...list.slice(0, 7), r].sort((a, b) => (b.mcu || 0) - (a.mcu || 0));
  return { label, list };
}
function kpis(r) {
  const cell = (k, v, s, c = "") => `<div class="st"><div class="k">${k}</div><div class="v ${c}">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  const ret = [["1주", r.r5], ["1개월", r.r21], ["3개월", r.r63], ["6개월", r.r126], ["연초 이후", r.ytd], ["1년", r.r252]];
  return `<div class="stats c3" style="grid-template-columns:repeat(3,1fr)">${ret.map(([k, v]) => cell(k, pct(v), "", cls(v))).join("")}</div>`;
}
function scoreBlock(r) {
  if (r.sm == null && r.st == null) return "";
  const n = MED[r.g].scored;
  const one = (t, v, d) => v == null ? "" : `<div class="sc"><div class="top"><b>${t}</b><span>${v}</span></div>
    <div class="trk"><i style="width:${v}%;background:${v >= 70 ? "var(--s3)" : v <= 30 ? "var(--s2)" : "var(--s1)"}"></i></div><p>${d}</p></div>`;
  return `<div class="dsec"><h3>시장 안 위치 <small>${r.g === "KR" ? "한국" : "미국"} ${nf.format(n)}종목 중 백분위 · 높을수록 해당 성격이 강함</small></h3><div class="scores">
    ${one("모멘텀", r.sm, "3·6·12개월 수익률 순위")}${one("추세", r.st, "50·200일선 위에 있는 정도")}
    ${one("안정성", r.ss, "변동성이 낮고 낙폭이 얕은 정도")}${one("유동성", r.sl, "20일 평균 거래대금 순위")}</div></div>`;
}
function rangeBlock(r) {
  if (r.h52 == null || r.l52 == null || r.h52 <= r.l52) return "";
  const pos = Math.max(0, Math.min(100, (r.p - r.l52) / (r.h52 - r.l52) * 100));
  return `<div class="card pad" style="padding:14px 16px"><div class="rowsplit"><b style="font-size:13.5px">52주 범위</b><span class="hint">범위의 ${pos.toFixed(0)}% 지점</span></div>
    <div class="range"><div class="tr"><i style="left:${pos}%"></i></div><div class="lb"><span>최저 ${price(r, r.l52)}</span><span>최고 ${price(r, r.h52)}</span></div></div></div>`;
}
function techBlock(r) {
  const cell = (k, v, s, c = "") => `<div class="st"><div class="k">${k}</div><div class="v ${c}" style="font-size:18px">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  const rsiS = r.rsi == null ? "" : r.rsi >= 70 ? "과열" : r.rsi <= 30 ? "과매도" : "중립";
  return `<div class="stats c4">
    ${cell("RSI(14)", r.rsi ?? "—", rsiS, r.rsi >= 70 ? "up" : r.rsi <= 30 ? "down" : "")}
    ${cell("50일선 대비", pct(r.pm50), "", cls(r.pm50))}
    ${cell("200일선 대비", pct(r.pm200), "", cls(r.pm200))}
    ${cell("변동성(연환산)", r.vol == null ? "—" : r.vol.toFixed(0) + "%", MED[r.g].vol ? "시장 중위 " + MED[r.g].vol.toFixed(0) + "%" : "")}
    ${cell("1년 최대낙폭", pct(r.mdd), "", "down")}
    ${cell("20일 평균 거래대금", r.tv == null ? "—" : money(r, r.tv), "하루 평균")}
    ${cell("거래량 배수", r.vs == null ? "—" : r.vs.toFixed(2) + "×", "5일 ÷ 60일 평균")}
    ${cell("시가총액", cap(r), capOther(r))}
  </div>`;
}
function profileBlock(r) {
  const f = (k, v) => v ? `<div class="pf"><div class="k">${k}</div><div class="v" style="font-size:14px">${esc(v)}</div></div>` : "";
  const exName = { NASDAQ: "나스닥", NYSE: "뉴욕증권거래소", AMEX: "NYSE 아메리칸", KOSPI: "유가증권시장(코스피)", KOSDAQ: "코스닥", KONEX: "코넥스" }[r.m];
  return `<div class="prof">${f("거래소", exName)}${f(r.g === "KR" ? "종목코드" : "티커", r.id)}${f("업종", r.sec)}${f("산업", r.ind)}${f("국가", r.cty)}${f(r.g === "KR" ? "상장연도" : "상장(IPO)연도", r.ipo ? String(r.ipo) : "")}${f("주요 제품", r.prod)}</div>`;
}
function chartBlock(r) {
  if (!r.sp) return `<div class="chartbox"><div class="nochart">1년 차트 데이터가 아직 없습니다. 아래 <b>인터랙티브 차트 열기</b>로 바로 볼 수 있습니다.</div></div>`;
  return `<div class="chartbox"><div class="cap"><span>1년 주간 종가(5거래일 간격)</span><span id="chTip">&nbsp;</span></div><div id="chart"></div></div>`;
}
function drawChart(r) {
  const el = $("chart"); if (!el || !r.sp) return;
  const W = 880, H = 250, P = { l: 8, r: 64, t: 12, b: 26 };
  const v = decodeSpark(r.sp).map((x) => r.spl + x * (r.sph - r.spl));
  const n = v.length;
  const lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.08 || hi * 0.05 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const X = (i) => P.l + i * (W - P.l - P.r) / (n - 1), Y = (x) => P.t + (1 - (x - y0) / (y1 - y0)) * (H - P.t - P.b);
  const asof = new Date((r.asof || META.krAsof || META.usAsof || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  const dateAt = (i) => new Date(asof.getTime() - (n - 1 - i) * 7 * 864e5);
  const up = v[n - 1] >= v[0], col = up ? "var(--up)" : "var(--down)";
  const line = v.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x).toFixed(1)).join("");
  const area = line + `L${X(n - 1)} ${H - P.b}L${X(0)} ${H - P.b}Z`;
  const ticks = [0, 1, 2, 3].map((i) => y0 + (y1 - y0) * (i + 0.5) / 4);
  let months = "", last = -1;
  for (let i = 0; i < n; i++) {
    const d = dateAt(i);
    if (d.getMonth() !== last && i > 1 && i < n - 1) { last = d.getMonth(); if (last % 2 === 0) months += `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="middle">${d.getFullYear() % 100}.${String(last + 1).padStart(2, "0")}</text>`; }
    else last = d.getMonth();
  }
  const fmtAx = (x) => r.g === "KR" ? nf.format(Math.round(x)) : x >= 100 ? x.toFixed(0) : x.toFixed(2);
  el.innerHTML = `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r.name)} 1년 주가 흐름">
    <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${up ? "var(--fill-up)" : "var(--fill-down)"}" stop-opacity=".22"/><stop offset="1" stop-color="${up ? "var(--fill-up)" : "var(--fill-down)"}" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line class="gridline" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${W - P.r + 6}" y="${Y(t) + 4}">${fmtAx(t)}</text>`).join("")}
    ${months}
    <path d="${area}" fill="url(#ga)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
    <line id="chX" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--ink-3)" stroke-dasharray="3 3" opacity="0"/>
    <circle id="chD" r="4.5" fill="${col}" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    <rect class="hit" x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}"/></svg>`;
  const svg = el.firstElementChild, tip = $("chTip"), cx = $("chX"), cd = $("chD");
  const move = (e) => {
    const b = svg.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width * W;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - P.l) / ((W - P.l - P.r) / (n - 1)))));
    cx.setAttribute("x1", X(i)); cx.setAttribute("x2", X(i)); cx.setAttribute("opacity", 1);
    cd.setAttribute("cx", X(i)); cd.setAttribute("cy", Y(v[i])); cd.setAttribute("opacity", 1);
    const d = dateAt(i), chg = (v[n - 1] / v[i] - 1) * 100;
    tip.innerHTML = `${i === n - 1 ? "최근" : `약 ${n - 1 - i}주 전(${d.getMonth() + 1}/${d.getDate()}경)`} · <b>${price(r, v[i])}</b>` + (i < n - 1 ? ` · 지금까지 <span class="${cls(chg)}">${pct(chg)}</span>` : "");
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerleave", () => { cx.setAttribute("opacity", 0); cd.setAttribute("opacity", 0); tip.innerHTML = "&nbsp;"; });
}
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
}
function tvEmbed(box, widget, cfg) {
  box.innerHTML = `<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>`;
  const s = document.createElement("script");
  s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
  s.async = true;
  s.textContent = JSON.stringify(cfg);
  box.firstElementChild.appendChild(s);
}
function paintStar() {
  const b = $("dtStar"), on = FAV.has(CUR.id);
  b.textContent = on ? "★" : "☆"; b.setAttribute("aria-pressed", on);
}
function openDetail(id, fromHash) {
  const r = BY_ID.get(id); if (!r) return;
  CUR = r;
  if (!fromHash) {
    if (location.hash !== "#s=" + id) { history.pushState({ s: id }, "", "#s=" + id); pushed = true; }
  }
  document.title = `${r.name} (${r.id}) · 전 종목 탐색기`;
  $("dtAv").outerHTML = `<span class="av" id="dtAv" style="background:${avColor(r.id)}">${esc(avText(r))}</span>`;
  $("dtName").textContent = r.name;
  $("dtSub").innerHTML = `${mBadge(r)}<span>${esc(r.id)}</span>${r.sub && r.g === "US" ? `<span>· ${esc(r.sub)}</span>` : ""}${r.sec ? `<span>· ${esc(r.sec)}</span>` : ""}`;
  paintStar();
  const ins = insights(r);
  const pr = peers(r);
  const ic = { pos: "↑", neg: "↓", neu: "·", warn: "!" };
  const asof = r.asof || (r.g === "KR" ? META.krAsof : META.usAsof) || "";
  $("dtBody").innerHTML = `
    <div class="pxrow"><span class="big">${price(r)}</span><span class="chg ${cls(r.d1)}">${pct(r.d1, 2)}</span>
      <span class="asof">${asof ? asof + " 종가" : "전 거래일 종가"} · 시가총액 ${cap(r)} ${capOther(r) ? `<span class="hint">(${capOther(r)})</span>` : ""}</span></div>
    <div class="dsec">${chartBlock(r)}</div>
    <div class="dsec"><h3>한눈에 보기 <small>규칙에 따라 자동으로 쓴 문장 · 투자 권유 아님</small></h3>
      <ul class="insights">${ins.length ? ins.map((x) => `<li><span class="ic ${x.kind}">${ic[x.kind]}</span><span>${x.html}</span></li>`).join("") : '<li><span class="ic neu">·</span><span>눈에 띄는 신호가 없습니다.</span></li>'}</ul></div>
    <div class="dsec"><h3>기간 수익률</h3>${kpis(r)}</div>
    <div class="dsec">${rangeBlock(r)}</div>
    ${scoreBlock(r)}
    <div class="dsec"><h3>기술적 지표</h3>${techBlock(r)}</div>
    <div class="dsec"><h3>프로필</h3>${profileBlock(r)}</div>
    <div class="dsec"><h3>${esc(pr.label)} <small>1개월 · 1년 수익률</small></h3><div class="card pad" style="padding:6px 14px">
      ${pr.list.map((x) => `<div class="peer${x.id === r.id ? " me" : ""}" data-id="${esc(x.id)}">${avatar(x, 24)}<span class="pn">${esc(x.name)} <small class="hint">${esc(x.id)}</small></span>
        <span class="pv" style="width:auto;color:var(--ink-3)">${cap(x)}</span><span class="pv ${cls(x.r21)}">${pct(x.r21)}</span><span class="pv ${cls(x.r252)}">${pct(x.r252)}</span></div>`).join("")}</div></div>
    <div class="dsec"><h3>더 깊이 보기</h3>
      <div class="links">${extLinks(r)}</div>
      <div class="links mt12">
        <button class="ghost" type="button" id="tvChartBtn">📈 인터랙티브 차트 열기</button>
        ${r.g === "US" ? '<button class="ghost" type="button" id="tvFinBtn">📊 재무제표 보기</button>' : ""}
      </div>
      <div id="tvChart"></div><div id="tvFin"></div>
      <p class="hint mt8">인터랙티브 차트와 재무제표는 TradingView 위젯으로, 누를 때만 불러옵니다.</p></div>
    <div class="note mt24"><span class="ic">ⓘ</span><div>지표는 전 거래일까지의 공개 데이터로 계산했습니다. <b>투자 권유가 아니며</b>, 거래 전 증권사 시세와 공시를 확인하세요.</div></div>`;
  const dlg = $("dt");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0; $("dtBody").scrollTop = 0;
  drawChart(r);
  $("dtBody").querySelectorAll(".peer").forEach((p) => p.addEventListener("click", () => { if (p.dataset.id !== r.id) openDetail(p.dataset.id); }));
  $("tvChartBtn").addEventListener("click", (e) => {
    const box = $("tvChart"); box.className = "tvbox";
    tvEmbed(box, "advanced-chart", { autosize: true, symbol: tvSymbol(r), interval: "D", timezone: "Asia/Seoul", theme: isDark() ? "dark" : "light",
      style: "1", locale: "kr", allow_symbol_change: false, hide_side_toolbar: true, withdateranges: true, range: "12M",
      studies: ["STD;SMA"], support_host: "https://www.tradingview.com" });
    e.currentTarget.disabled = true;
  });
  $("tvFinBtn")?.addEventListener("click", (e) => {
    const box = $("tvFin"); box.className = "tvbox fin";
    tvEmbed(box, "financials", { isTransparent: false, largeChartUrl: "", displayMode: "regular", width: "100%", height: "100%",
      colorTheme: isDark() ? "dark" : "light", symbol: tvSymbol(r), locale: "kr" });
    e.currentTarget.disabled = true;
  });
}
function closeDetail(fromHash) {
  const dlg = $("dt");
  if (dlg.open) dlg.close();
  document.title = "전 종목 탐색기 · 미국·한국 주식 검색과 분석";
  if (!fromHash && location.hash.startsWith("#s=")) {
    if (pushed) { pushed = false; history.back(); }
    else history.replaceState(null, "", location.pathname + location.search);
  }
}
function initDetail() {
  $("dtClose").addEventListener("click", () => closeDetail());
  $("dt").addEventListener("cancel", (e) => { e.preventDefault(); closeDetail(); });
  $("dt").addEventListener("click", (e) => { if (e.target === $("dt")) closeDetail(); });
  $("dtStar").addEventListener("click", () => CUR && toggleFav(CUR.id));
  const route = () => {
    const m = location.hash.match(/^#s=(.+)$/);
    if (m && BY_ID.has(decodeURIComponent(m[1]))) openDetail(decodeURIComponent(m[1]), true);
    else if ($("dt").open) { pushed = false; closeDetail(true); }
  };
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  route();
}

/* ---------------------------------------------------------------- 테마 */
function initTheme() {
  const paint = () => { $("themeIco").textContent = isDark() ? "☾" : "☀"; $("themeTxt").textContent = isDark() ? "어둡게" : "밝게"; };
  $("themeBtn").addEventListener("click", () => {
    document.documentElement.dataset.theme = isDark() ? "light" : "dark";
    store.set("m7.theme", document.documentElement.dataset.theme);
    paint();
  });
  matchMedia("(prefers-color-scheme:dark)").addEventListener("change", paint);
  paint();
}

/* ---------------------------------------------------------------- 시작 */
(async function main() {
  initTheme();
  try { await load(); }
  catch (e) {
    $("fresh").innerHTML = `<span class="down">데이터를 불러오지 못했습니다(${esc(e.message)}). 잠시 뒤 새로고침해 주세요.</span>`;
    return;
  }
  const c = META.counts || {};
  $("heroLead").innerHTML = `미국 <b>${nf.format(c.US || 0)}</b>종목과 한국 <b>${nf.format(c.KR || 0)}</b>종목, 전부를 한글·영문·티커·종목코드·초성(ㅅㅅㅈㅈ)으로 찾고
    수익률·추세·과열·변동성을 <b>같은 시장 안의 순위</b>로 읽습니다.`;
  renderFresh();
  initSearch();
  renderPulse();
  if (!ROWS.some((r) => r.g === "KR" && r.sec)) { secState.g = "US"; setSeg($("secMkt"), "US"); }
  initSectors(); renderSectors();
  initScreener();
  initDetail();
})();
