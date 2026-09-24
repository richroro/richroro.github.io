"use strict";
/* =========================================================================
   전 종목 탐색기 — /finder/data/stocks.json 하나를 읽어 그립니다.
     목록 페이지(/finder/)   : 검색 · 오늘 시장 · 업종 흐름 · 스크리너 · 포트폴리오 · 비교
     종목 페이지(/finder/s/X/): 같은 상세 분석을 대화상자 대신 본문에
   외부 라이브러리 없음. 인터랙티브 차트·재무제표만 누를 때 TradingView 위젯을 불러옵니다.
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
const MODE = document.body.dataset.page || "list";   // list | stock
const DATA_URL = "/finder/data/stocks.json";

let ROWS = [], BY_ID = new Map(), META = {}, MED = {}, SECMED = new Map(), DEEP = new Map(), PAGES = new Set();
let FAV = new Set(store.get("finder.fav", []));
let CMP = store.get("finder.cmp", []).slice(0, 4);
let PF = store.get("finder.pf", []);
let RECENT = store.get("finder.recent", []);

/* ---------------------------------------------------------------- 형식 */
function sgn(v) { return v > 0 ? "+" : v < 0 ? "−" : ""; }
function pct(v, d = 1) { return v == null ? "—" : sgn(v) + Math.abs(v).toFixed(d) + "%"; }
function cls(v) { return v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : ""; }
function num(v, d = 1) { return v == null ? "—" : v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function price(r, v = r.p) {
  if (v == null) return "—";
  if (r.g === "KR") return nf.format(Math.round(v)) + "원";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v < 1 ? 4 : 2, maximumFractionDigits: v < 1 ? 4 : 2 });
}
function usdM(v) { // 백만 달러
  if (v == null) return "—";
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "T";
  if (a >= 1e3) return s + "$" + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "B";
  return s + "$" + (a >= 10 ? Math.round(a) : a.toFixed(1)) + "M";
}
function krwM(v) { // 백만 원
  if (v == null) return "—";
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e6) return s + (a >= 1e8 ? nf.format(Math.round(a / 1e6)) : (a / 1e6).toFixed(1)) + "조원";
  if (a >= 100) return s + nf.format(Math.round(a / 100)) + "억원";
  return s + nf.format(Math.round(a)) + "백만원";
}
function krw(v) { // 원 단위 금액(포트폴리오)
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e12) return s + (a / 1e12).toFixed(2) + "조원";
  if (a >= 1e8) return s + (a / 1e8).toFixed(a >= 1e10 ? 1 : 2) + "억원";
  return s + nf.format(Math.round(a)) + "원";
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
  return `<span class="av" aria-hidden="true" style="${s}background:${avColor(r.id)}">${esc(avText(r))}</span>`;
}
function mBadge(r) { return `<span class="mbadge ${r.g}">${r.m}</span>`; }
function stockHref(id) { return PAGES.has(id) ? `/finder/s/${encodeURIComponent(id)}/` : `/finder/#s=${encodeURIComponent(id)}`; }
function toast(msg) {
  const t = $("toast"); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg || "복사했습니다"); }
  catch (e) { prompt("아래 주소를 복사하세요", text); }
}

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
  const [res, pg] = await Promise.all([
    fetch(DATA_URL, { cache: "no-cache" }),
    fetch("/finder/data/pages.json", { cache: "no-cache" }).then((r) => r.ok ? r.json() : []).catch(() => []),
  ]);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const d = await res.json();
  PAGES = new Set(pg);
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
    r._f = (r.id + " " + names.join(" ") + " " + (r.ind || "") + " " + (r.sec || "")).toLowerCase();
    return r;
  });
  ROWS.forEach((r) => BY_ID.set(r.id, r));
  for (const g of ["US", "KR"]) {
    const rs = ROWS.filter((r) => r.g === g);
    const lq = rs.filter(liquid);
    MED[g] = { vol: median(rs.map((r) => r.vol)), d1: median(rs.map((r) => r.d1)), r252: median(lq.map((r) => r.r252)),
               pe: median(lq.map((r) => r.pe)), pb: median(lq.map((r) => r.pb)), n: rs.length,
               scored: rs.filter((r) => r.sm != null).length };
  }
  const bySec = new Map();
  for (const r of ROWS) {
    if (!r.sec || !liquid(r)) continue;
    const k = r.g + "|" + r.sec;
    if (!bySec.has(k)) bySec.set(k, []);
    bySec.get(k).push(r);
  }
  for (const [k, rs] of bySec) {
    SECMED.set(k, { n: rs.length, pe: median(rs.map((r) => r.pe)), pb: median(rs.map((r) => r.pb)),
                    dy: median(rs.map((r) => r.dy)), roe: median(rs.map((r) => r.roe)), r252: median(rs.map((r) => r.r252)) });
  }
  if (typeof REGISTRY !== "undefined") {
    for (const e of REGISTRY) DEEP.set(e.tk, { href: e.href || e.base + e.slug + "/", hint: e.hint });
  }
  CMP = CMP.filter((id) => BY_ID.has(id));
}
function median(a) {
  const v = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function liquid(r) { return r.tv == null ? true : r.g === "KR" ? r.tv >= 100 : r.tv >= 1; }
function secMed(r) { return r.sec ? SECMED.get(r.g + "|" + r.sec) : null; }

/* ---------------------------------------------------------------- 장 운영 상태 */
function zoned(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { wd: p.weekday, min: +p.hour * 60 + +p.minute };
}
function mktStatus(g) {
  const { wd, min } = zoned(g === "KR" ? "Asia/Seoul" : "America/New_York");
  if (wd === "Sat" || wd === "Sun") return { k: "closed", t: "주말 휴장" };
  if (g === "KR") {
    if (min >= 540 && min < 930) return { k: "open", t: "정규장" };
    if (min >= 480 && min < 540) return { k: "pre", t: "장 시작 전" };
    return { k: "closed", t: "장 마감" };
  }
  if (min >= 570 && min < 960) return { k: "open", t: "정규장" };
  if (min >= 240 && min < 570) return { k: "pre", t: "프리마켓" };
  if (min >= 960 && min < 1200) return { k: "pre", t: "애프터마켓" };
  return { k: "closed", t: "장 마감" };
}
function statusPill(g) {
  const s = mktStatus(g);
  return `<span class="pill ${s.k === "open" ? "open" : ""}" title="정규 거래시간 기준 · 공휴일은 반영하지 않습니다"><span class="dot"></span>${s.t}</span>`;
}
function bizDaysSince(iso) {
  if (!iso) return 99;
  const d = new Date(iso + "T00:00:00Z"), now = new Date();
  let n = 0;
  for (let t = new Date(d); t < now; t.setUTCDate(t.getUTCDate() + 1)) { const w = t.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n - 1;
}

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
/* 검색 상자 하나를 붙인다 — 첫 화면·종목 페이지·포트폴리오 입력이 같이 쓴다 */
function attachSearch({ input, box, wrap, onPick, limit = 8 }) {
  let items = [], sel = -1;
  const pre = input.id + "-o";
  const close = () => { box.hidden = true; wrap.setAttribute("aria-expanded", "false"); sel = -1; input.removeAttribute("aria-activedescendant"); };
  const paint = () => {
    const raw = input.value.trim();
    items = search(raw, limit);
    if (!raw) { close(); return; }
    box.hidden = false; wrap.setAttribute("aria-expanded", "true");
    if (!items.length) { box.innerHTML = `<div class="empty">‘${esc(raw)}’에 맞는 종목이 없습니다. 티커(예: AAPL)나 종목코드(예: 005930)로도 찾아보세요.</div>`; return; }
    box.innerHTML = items.map((r, i) => `
      <div class="it" role="option" id="${pre}${i}" data-id="${esc(r.id)}" aria-selected="${i === sel}">
        ${avatar(r)}
        <div class="nm"><b>${hl(r.name, raw)}</b><small>${mBadge(r)} ${hl(r.g === "KR" ? r.id : r.id + (r.sub ? " · " + r.sub : ""), raw)}${r.sec ? " · " + esc(r.sec) : ""}</small></div>
        <div class="px">${price(r)}<small class="${cls(r.d1)}">${pct(r.d1, 2)}</small></div>
      </div>`).join("");
  };
  const pick = (r) => { close(); onPick(r); };
  input.addEventListener("input", () => { sel = -1; paint(); });
  input.addEventListener("focus", paint);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      paint(); input.setAttribute("aria-activedescendant", pre + sel);
      $(pre + sel)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const r = items[sel >= 0 ? sel : 0];
      if (r) { e.preventDefault(); pick(r); }
    } else if (e.key === "Escape") { close(); input.blur(); }
  });
  box.addEventListener("mousedown", (e) => {
    const it = e.target.closest(".it"); if (!it) return;
    e.preventDefault(); pick(BY_ID.get(it.dataset.id));
  });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
  return { paint, close };
}
function goStock(r) {
  if (MODE === "stock") { location.href = stockHref(r.id); return; }
  openDetail(r.id);
}
function initSearch() {
  const q = $("q");
  attachSearch({ input: q, box: $("sres"), wrap: $("sbox"), onPick: (r) => { q.blur(); goStock(r); } });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) {
      e.preventDefault(); q.focus(); if (MODE === "list") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  if (MODE !== "list") return;
  const popular = ["005930", "000660", "NVDA", "TSLA", "AAPL", "PLTR", "IONQ", "005380", "035420", "373220"];
  $("shint").innerHTML = "<span>많이 찾는 종목</span>" + popular.map((id) => BY_ID.get(id)).filter(Boolean)
    .map((r) => `<button class="chip" type="button" data-id="${r.id}">${esc(r.name)}</button>`).join("");
  $("shint").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) openDetail(b.dataset.id); });
  $("recent").addEventListener("click", (e) => {
    if (e.target.closest("[data-clear]")) { RECENT = []; store.set("finder.recent", RECENT); renderRecent(); return; }
    const b = e.target.closest("[data-id]"); if (b) openDetail(b.dataset.id);
  });
  renderRecent();
  const find = new URLSearchParams(location.search).get("find");
  if (find) { q.value = find; q.focus(); }
}
function pushRecent(id) {
  RECENT = [id, ...RECENT.filter((x) => x !== id)].slice(0, 8);
  store.set("finder.recent", RECENT);
  renderRecent();
}
function renderRecent() {
  const el = $("recent"); if (!el) return;
  const rs = RECENT.map((id) => BY_ID.get(id)).filter(Boolean);
  el.hidden = !rs.length;
  el.innerHTML = "<span>최근 본 종목</span>" + rs.map((r) => `<button class="chip" type="button" data-id="${r.id}">${esc(r.name)} <span class="${cls(r.d1)}">${pct(r.d1)}</span></button>`).join("")
    + `<button class="chip ghosty" type="button" data-clear="1" aria-label="최근 본 종목 지우기">지우기</button>`;
}

/* ---------------------------------------------------------------- 머리 · 오늘 시장 */
function renderFresh() {
  const c = META.counts || {};
  const fx = META.fx ? `<span>환율 <b>${nf.format(META.fx)}원/$</b>${/추정/.test(META.fxSrc || "") ? "(추정)" : ""}</span>` : "";
  $("fresh").innerHTML =
    `<span>미국 <b>${nf.format(c.US || 0)}</b> · 한국 <b>${nf.format(c.KR || 0)}</b>종목</span>` +
    `<span>🇰🇷 <b>${META.krAsof || "—"}</b> 종가 ${statusPill("KR")}</span>` +
    `<span>🇺🇸 <b>${META.usAsof || "—"}</b> 종가 ${statusPill("US")}</span>` + fx;
  const lag = Math.max(bizDaysSince(META.krAsof), bizDaysSince(META.usAsof));
  if (lag >= 3) {
    const b = $("stale"); b.hidden = false;
    b.innerHTML = `<b>데이터가 ${lag}거래일 전 기준입니다.</b> 자동 갱신이 멈췄을 수 있습니다. 거래 전에는 증권사 시세를 확인하세요.`;
  }
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
    const mv = (r) => `<a class="mv" href="${stockHref(r.id)}" data-id="${r.id}"><b>${esc(r.name)}</b><span class="${cls(r.d1)}">${pct(r.d1)}</span></a>`;
    return `<div class="card pcard">
      <div class="hd"><b>${g === "KR" ? "🇰🇷 한국" : "🇺🇸 미국"}</b><small>${(g === "KR" ? META.krAsof : META.usAsof) || ""} ${statusPill(g)}</small></div>
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
  box.onclick = (e) => { const m = e.target.closest("[data-id]"); if (m && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openDetail(m.dataset.id); } };
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
function daysTo(iso) { return iso ? Math.round((new Date(iso + "T00:00:00") - new Date(new Date().toDateString())) / 864e5) : null; }
const soon = (r, days) => { const d = daysTo(r.ern); return d != null && d >= 0 && d <= days; };
const PRESETS = [
  { id: "cap", t: "시총 상위", sort: ["mcu", -1] },
  { id: "gain", t: "오늘 급등", sort: ["d1", -1], f: (r) => r.d1 != null },
  { id: "lose", t: "오늘 급락", sort: ["d1", 1], f: (r) => r.d1 != null },
  { id: "high", t: "52주 신고가권", sort: ["fh", -1], f: (r) => r.fh != null && r.fh >= -3 },
  { id: "low", t: "52주 저점권", sort: ["fl", 1], f: (r) => r.fl != null && r.fl <= 5 },
  { id: "value", t: "저PER·고ROE", sort: ["pe", 1], view: "value", f: (r) => r.pe != null && r.pe < 12 && r.roe != null && r.roe >= 12 },
  { id: "div", t: "고배당 4%+", sort: ["dy", -1], view: "value", f: (r) => r.dy != null && r.dy >= 4 && (r.mcu || 0) >= 300 },
  { id: "earn", t: "2주 안 실적 발표", sort: ["ern", 1], view: "value", f: (r) => soon(r, 14) },
  { id: "buy", t: "애널리스트 매수", sort: ["ar", 1], view: "value", f: (r) => r.ar != null && r.ar <= 2 && (r.mcu || 0) >= 2000 },
  { id: "gc", t: "골든크로스", sort: ["mcu", -1], view: "tech", f: (r) => r.x === "G" },
  { id: "dc", t: "데드크로스", sort: ["mcu", -1], view: "tech", f: (r) => r.x === "D" },
  { id: "os", t: "과매도 RSI<30", sort: ["rsi", 1], view: "tech", f: (r) => r.rsi != null && r.rsi < 30 },
  { id: "ob", t: "과열 RSI>70", sort: ["rsi", -1], view: "tech", f: (r) => r.rsi != null && r.rsi > 70 },
  { id: "surge", t: "거래 급증", sort: ["vs", -1], view: "tech", f: (r) => r.vs != null && r.vs >= 2 },
  { id: "trend", t: "정배열 + 강한 모멘텀", sort: ["sm", -1], view: "score", f: (r) => r.up === 1 && r.pm50 > 0 && r.sm >= 70 },
  { id: "calm", t: "덜 흔들린 대형주", sort: ["ss", -1], view: "score", f: (r) => (r.mcu || 0) >= 10000 && r.ss >= 70 },
  { id: "y1", t: "1년 수익률 상위", sort: ["r252", -1], f: (r) => r.r252 != null },
  { id: "dd", t: "고점 대비 반토막", sort: ["mcu", -1], f: (r) => r.fh != null && r.fh <= -50 && (r.mcu || 0) >= 1000 },
];
/* 상세 조건에 쓸 수 있는 지표 */
const METRICS = [
  { k: "pe", t: "PER", u: "배" }, { k: "fpe", t: "선행 PER", u: "배" }, { k: "pb", t: "PBR", u: "배" },
  { k: "dy", t: "배당수익률", u: "%" }, { k: "roe", t: "ROE", u: "%" }, { k: "mcu", t: "시가총액(백만 달러)", u: "$M" },
  { k: "d1", t: "1일 등락", u: "%" }, { k: "r5", t: "1주 수익률", u: "%" }, { k: "r21", t: "1개월 수익률", u: "%" },
  { k: "r63", t: "3개월 수익률", u: "%" }, { k: "r126", t: "6개월 수익률", u: "%" }, { k: "r252", t: "1년 수익률", u: "%" },
  { k: "ytd", t: "연초 이후", u: "%" }, { k: "fh", t: "52주 고점 대비", u: "%" }, { k: "rsi", t: "RSI(14)", u: "" },
  { k: "pm50", t: "50일선 대비", u: "%" }, { k: "pm200", t: "200일선 대비", u: "%" }, { k: "vol", t: "변동성(연환산)", u: "%" },
  { k: "mdd", t: "1년 최대낙폭", u: "%" }, { k: "vs", t: "거래 배수", u: "배" }, { k: "ar", t: "애널리스트 의견(1=강력매수)", u: "" },
  { k: "sm", t: "모멘텀 점수", u: "" }, { k: "st", t: "추세 점수", u: "" }, { k: "ss", t: "안정성 점수", u: "" }, { k: "sl", t: "유동성 점수", u: "" },
];
const MET = Object.fromEntries(METRICS.map((m) => [m.k, m]));
const SIZES = { mega: [2e5, Infinity], large: [1e4, 2e5], mid: [2e3, 1e4], small: [300, 2e3], micro: [0, 300] };
const DEFAULT = { mkt: "ALL", exch: "", sector: "", size: "", preset: null, flt: "", liq: true, view: "basic", sort: ["mcu", -1], rules: [] };
const S = { ...DEFAULT, rules: [], sort: [...DEFAULT.sort], limit: PAGE };

function trendTag(r) {
  if (r.x === "G") return `<span class="xtag G">골든크로스</span>`;
  if (r.x === "D") return `<span class="xtag D">데드크로스</span>`;
  if (r.pm50 == null || r.pm200 == null) return "—";
  if (r.up === 1 && r.pm50 > 0) return `<span class="up">정배열</span>`;
  if (r.up === 0 && r.pm50 < 0) return `<span class="down">역배열</span>`;
  return `<span style="color:var(--ink-3)">혼조</span>`;
}
const ABC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
function decodeSpark(s) { return [...s].map((c) => ABC.indexOf(c) / 63); }
function sparkVals(r) { return r.sp ? decodeSpark(r.sp).map((x) => r.spl + x * (r.sph - r.spl)) : null; }
function spark(r, w = 84, h = 24) {
  if (!r.sp) return "";
  const pts = decodeSpark(r.sp);
  const n = pts.length, dx = w / (n - 1);
  const d = pts.map((v, i) => (i ? "L" : "M") + (i * dx).toFixed(1) + " " + (h - 2 - v * (h - 4)).toFixed(1)).join("");
  const col = pts[n - 1] >= pts[0] ? "var(--up)" : "var(--down)";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
function scoreCell(v) {
  if (v == null) return "—";
  return `${v}<span class="bar100"><i style="width:${v}%;background:${v >= 70 ? "var(--s3)" : v <= 30 ? "var(--s2)" : "var(--s1)"}"></i></span>`;
}
const AR_TXT = (v) => v == null ? "—" : v <= 1.5 ? "강력 매수" : v <= 2.5 ? "매수" : v <= 3.5 ? "보유" : v <= 4.5 ? "매도" : "강력 매도";
function ernTxt(r) {
  const d = daysTo(r.ern);
  if (d == null || d < 0) return "—";
  return `${r.ern.slice(5).replace("-", "/")} <span class="hint">${d === 0 ? "오늘" : "D-" + d}</span>`;
}
function vsMed(v, m) {
  if (v == null || m == null || !m) return "";
  const k = (v / m - 1) * 100;
  if (Math.abs(k) < 5) return "업종 중위 수준";
  return `업종 중위(${num(m)})보다 ${Math.abs(k).toFixed(0)}% ${k < 0 ? "낮음" : "높음"}`;
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
  pe: { t: "PER", k: "pe", r: (r) => r.pe == null ? (r.eps != null && r.eps < 0 ? '<span class="hint">적자</span>' : "—") : num(r.pe) },
  fpe: { t: "선행 PER", k: "fpe", r: (r) => num(r.fpe) },
  pb: { t: "PBR", k: "pb", r: (r) => num(r.pb, 2) },
  dy: { t: "배당", k: "dy", r: (r) => r.dy == null ? "—" : r.dy ? r.dy.toFixed(2) + "%" : '<span class="hint">0</span>' },
  roe: { t: "ROE", k: "roe", r: (r) => r.roe == null ? "—" : `<span class="${r.roe < 0 ? "down" : ""}">${r.roe.toFixed(1)}%</span>` },
  ern: { t: "다음 실적", k: "ern", r: (r) => ernTxt(r) },
  ar: { t: "애널리스트", k: "ar", r: (r) => r.ar == null ? "—" : `${AR_TXT(r.ar)} <span class="hint">${r.ar.toFixed(1)}</span>` },
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
  value: ["name", "p", "d1", "mc", "pe", "fpe", "pb", "dy", "roe", "ern", "ar"],
  tech: ["name", "p", "d1", "rsi", "pm50", "pm200", "tr", "vol", "mdd", "vs"],
  score: ["name", "d1", "r252", "sm", "st", "ss", "sl"],
};
const LOW_FIRST = new Set(["name", "pe", "fpe", "pb", "vol", "ar", "ern", "fl"]);
const SORT_KEYS = new Set([...Object.values(COLS).map((c) => c.k).filter(Boolean), "fl"]);

function ruleOk(r) {
  for (const x of S.rules) {
    if (x.min == null && x.max == null) continue;
    const v = r[x.k];
    if (v == null) return false;
    if (x.min != null && v < x.min) return false;
    if (x.max != null && v > x.max) return false;
  }
  return true;
}
function baseFilter(r) {
  if (S.mkt === "FAV") { if (!FAV.has(r.id)) return false; }
  else if (S.mkt !== "ALL" && r.g !== S.mkt) return false;
  if (S.exch && r.m !== S.exch) return false;
  if (S.sector && r.sec !== S.sector) return false;
  if (S.size) { const [a, b] = SIZES[S.size]; if (r.mcu == null || r.mcu < a || r.mcu >= b) return false; }
  if (S.liq && S.mkt !== "FAV" && !liquid(r)) return false;
  if (S.flt && !r._f.includes(S.flt)) return false;
  return ruleOk(r);
}
function filtered() {
  const pre = PRESETS.find((p) => p.id === S.preset);
  const rs = ROWS.filter((r) => baseFilter(r) && (!pre || !pre.f || pre.f(r)));
  const [k, dir] = S.sort;
  const val = (r) => k === "name" ? r.name : k === "ern" ? (daysTo(r.ern) >= 0 ? r.ern : null) : r[k];
  rs.sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return a.rk - b.rk;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "string") return x.localeCompare(y, "ko") * dir || a.rk - b.rk;
    return (x - y) * dir || a.rk - b.rk;
  });
  return rs;
}
function renderPresets() {
  const base = ROWS.filter(baseFilter);
  $("presets").innerHTML = PRESETS.map((p) => {
    const n = p.f ? base.filter(p.f).length : base.length;
    return `<button class="chip" type="button" data-p="${p.id}" aria-pressed="${S.preset === p.id}"${n ? "" : " disabled"}>${p.t}<span class="c">${nf.format(n)}</span></button>`;
  }).join("");
}
function renderTable(resetLimit) {
  if (resetLimit) S.limit = PAGE;
  const rs = filtered();
  const cols = VIEWS[S.view].map((c) => COLS[c]);
  const thead = $("tbl").tHead, tbody = $("tbl").tBodies[0];
  thead.innerHTML = `<tr><th class="st"><span class="sr">관심</span></th><th class="st" title="비교에 담기">비교</th><th class="rank">#</th>` + cols.map((c) =>
    `<th${c.k ? ` class="sortable" tabindex="0" data-k="${c.k}" aria-sort="${S.sort[0] === c.k ? (S.sort[1] < 0 ? "descending" : "ascending") : "none"}"` : ""}${c.tx ? ' style="text-align:left"' : ""}>${c.t}</th>`).join("") + "</tr>";
  tbody.innerHTML = rs.length ? rs.slice(0, S.limit).map((r, i) => `<tr data-id="${esc(r.id)}">
      <td class="st"><button class="star" type="button" data-fav="${esc(r.id)}" aria-pressed="${FAV.has(r.id)}" aria-label="${esc(r.name)} 관심 종목">${FAV.has(r.id) ? "★" : "☆"}</button></td>
      <td class="st"><input type="checkbox" class="ckb" data-cmp="${esc(r.id)}" ${CMP.includes(r.id) ? "checked" : ""} aria-label="${esc(r.name)} 비교에 담기"></td>
      <td class="rank">${i + 1}</td>` + cols.map((c) => `<td${c.tx ? ` class="tx${c === COLS.name ? " nmc" : ""}" style="text-align:left"` : ""}>${c.r(r)}</td>`).join("") + "</tr>").join("")
    : `<tr><td colspan="${cols.length + 3}" class="empty-t">${S.mkt === "FAV" ? "★를 눌러 관심 종목을 추가하면 여기에 모입니다." : "조건에 맞는 종목이 없습니다. 조건을 줄여 보세요."}</td></tr>`;
  $("count").textContent = `${nf.format(rs.length)}종목` + (rs.length > S.limit ? ` 중 ${nf.format(S.limit)}개 표시` : "");
  $("moreBtn").hidden = rs.length <= S.limit;
  renderPresets();
  writeUrl();
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
    return [...m].sort((a, b) => b[1] - a[1]).map(([s, n]) => `<option value="${esc(s)}">${esc(s)} (${n})</option>`).join("");
  };
  const us = S.mkt !== "KR" ? opt("US") : "", kr = S.mkt !== "US" ? opt("KR") : "";
  sec.innerHTML = `<option value="">업종 전체</option>` +
    (us && kr ? `<optgroup label="미국">${us}</optgroup><optgroup label="한국">${kr}</optgroup>` : us + kr);
  if (S.sector && ![...sec.options].some((o) => o.value === S.sector)) S.sector = "";
  sec.value = S.sector;
}
let rulesOpen = false;
function renderRules() {
  $("rules").hidden = !S.rules.length && !rulesOpen;
  $("rulesBtn").setAttribute("aria-expanded", String(!$("rules").hidden));
  const active = S.rules.filter((x) => x.min != null || x.max != null).length;
  $("rulesBtn").textContent = active ? `상세 조건 ${active}개` : "＋ 상세 조건";
  $("ruleList").innerHTML = S.rules.map((x, i) => {
    const m = MET[x.k];
    return `<div class="rule" data-i="${i}">
      <select class="sel" data-f="k" aria-label="지표">${METRICS.map((o) => `<option value="${o.k}"${o.k === x.k ? " selected" : ""}>${o.t}</option>`).join("")}</select>
      <input class="flt num" data-f="min" type="number" step="any" placeholder="최소" value="${x.min ?? ""}" aria-label="${m.t} 최소">
      <span class="hint">~</span>
      <input class="flt num" data-f="max" type="number" step="any" placeholder="최대" value="${x.max ?? ""}" aria-label="${m.t} 최대">
      <span class="hint unit">${m.u}</span>
      <button class="ghost sm" type="button" data-del="${i}" aria-label="조건 삭제">✕</button></div>`;
  }).join("");
}
function syncControls() {
  setSeg($("mkt"), S.mkt); setSeg($("view"), S.view);
  fillSelects();
  $("size").value = S.size; $("flt").value = S.flt; $("liq").checked = S.liq;
  renderRules();
}
/* 주소에 조건을 담는다: ?m=KR&x=KOSPI&sec=..&size=..&p=gc&q=..&r=pe:0:15,dy:3:&s=pe:1&v=value&liq=0 */
function writeUrl() {
  if (MODE !== "list") return;
  const p = new URLSearchParams();
  if (S.mkt !== "ALL") p.set("m", S.mkt);
  if (S.exch) p.set("x", S.exch);
  if (S.sector) p.set("sec", S.sector);
  if (S.size) p.set("size", S.size);
  if (S.preset) p.set("p", S.preset);
  if (S.flt) p.set("q", S.flt);
  const rr = S.rules.filter((x) => x.min != null || x.max != null).map((x) => `${x.k}:${x.min ?? ""}:${x.max ?? ""}`);
  if (rr.length) p.set("r", rr.join(","));
  if (S.sort[0] !== "mcu" || S.sort[1] !== -1) p.set("s", S.sort[0] + ":" + S.sort[1]);
  if (S.view !== "basic") p.set("v", S.view);
  if (!S.liq) p.set("liq", "0");
  const qs = p.toString();
  const url = location.pathname + (qs ? "?" + qs : "") + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", url);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  const n = (v) => v === "" || v == null || isNaN(+v) ? null : +v;
  if (["US", "KR", "FAV"].includes(p.get("m"))) S.mkt = p.get("m");
  S.exch = p.get("x") || ""; S.sector = p.get("sec") || "";
  S.size = SIZES[p.get("size")] ? p.get("size") : "";
  S.preset = PRESETS.some((x) => x.id === p.get("p")) ? p.get("p") : null;
  S.flt = (p.get("q") || "").toLowerCase();
  S.rules = (p.get("r") || "").split(",").map((s) => s.split(":")).filter(([k]) => MET[k]).map(([k, a, b]) => ({ k, min: n(a), max: n(b) }));
  const s = (p.get("s") || "").split(":");
  if (SORT_KEYS.has(s[0])) S.sort = [s[0], +s[1] === 1 ? 1 : -1];
  if (VIEWS[p.get("v")]) S.view = p.get("v");
  if (p.get("liq") === "0") S.liq = false;
  return ["m", "x", "sec", "size", "p", "q", "r", "s", "v", "liq"].some((k) => p.has(k));
}
function initScreener() {
  const fromUrl = readUrl();
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
    if (S.preset && p.view) S.view = p.view;
    syncControls(); renderTable(true);
  });
  $("rulesBtn").addEventListener("click", () => {
    if (!S.rules.length) { S.rules.push({ k: "pe", min: null, max: null }); rulesOpen = true; }
    else rulesOpen = $("rules").hidden;
    if (!rulesOpen) S.rules = S.rules.filter((x) => x.min != null || x.max != null);
    renderRules();
    if (!$("rules").hidden) $("ruleList").querySelector("input")?.focus();
  });
  $("ruleAdd").addEventListener("click", () => { S.rules.push({ k: "dy", min: null, max: null }); renderRules(); });
  let rt;
  $("ruleList").addEventListener("change", (e) => {
    if (e.target.dataset.f !== "k") return;
    const x = S.rules[+e.target.closest(".rule").dataset.i];
    x.k = e.target.value; renderRules(); renderTable(true);
  });
  $("ruleList").addEventListener("input", (e) => {
    const row = e.target.closest(".rule"), f = e.target.dataset.f; if (!row || f === "k") return;
    S.rules[+row.dataset.i][f] = e.target.value === "" || isNaN(+e.target.value) ? null : +e.target.value;
    const active = S.rules.filter((x) => x.min != null || x.max != null).length;
    $("rulesBtn").textContent = active ? `상세 조건 ${active}개` : "＋ 상세 조건";
    clearTimeout(rt); rt = setTimeout(() => renderTable(true), 180);
  });
  $("ruleList").addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]"); if (!d) return;
    S.rules.splice(+d.dataset.del, 1); rulesOpen = S.rules.length > 0; renderRules(); renderTable(true);
  });
  $("tbl").tHead.addEventListener("click", sortClick);
  $("tbl").tHead.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortClick(e); } });
  $("tbl").tBodies[0].addEventListener("click", (e) => {
    const f = e.target.closest("[data-fav]");
    if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); return; }
    const c = e.target.closest("[data-cmp]");
    if (c) { e.stopPropagation(); toggleCmp(c.dataset.cmp, c.checked); return; }
    const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(tr.dataset.id);
  });
  $("moreBtn").addEventListener("click", () => { S.limit += PAGE; renderTable(); });
  $("reset").addEventListener("click", () => {
    Object.assign(S, { ...DEFAULT, rules: [], sort: [...DEFAULT.sort] }); rulesOpen = false;
    syncControls(); renderTable(true);
  });
  $("share").addEventListener("click", () => copy(location.href.split("#")[0], "지금 조건이 담긴 링크를 복사했습니다"));
  $("csv").addEventListener("click", exportCsv);
  syncControls(); renderTable(true);
  if (fromUrl && !location.hash) requestAnimationFrame(() => $("screener").scrollIntoView());
}
function sortClick(e) {
  const th = e.target.closest("th[data-k]"); if (!th) return;
  const k = th.dataset.k;
  S.sort = S.sort[0] === k ? [k, -S.sort[1]] : [k, LOW_FIRST.has(k) ? 1 : -1];
  renderTable(true);
}
function toggleFav(id) {
  FAV.has(id) ? FAV.delete(id) : FAV.add(id);
  store.set("finder.fav", [...FAV]);
  toast(FAV.has(id) ? "관심 종목에 담았습니다" : "관심 종목에서 뺐습니다");
  if (MODE === "list") renderTable();
  if (CUR && CUR.id === id) paintActions();
}
function exportCsv() {
  const rs = filtered();
  const H = ["시장", "티커/코드", "이름", "영문·한글 병기", "업종", "산업", "통화", "가격", "1일(%)", "시총(백만, 현지통화)", "시총(백만 달러)",
    "1주(%)", "1개월(%)", "3개월(%)", "6개월(%)", "연초이후(%)", "1년(%)", "52주고점대비(%)", "RSI14", "50일선대비(%)", "200일선대비(%)",
    "변동성(%)", "1년최대낙폭(%)", "거래배수", "PER", "선행PER", "PBR", "배당수익률(%)", "ROE(%)", "EPS", "다음실적일", "애널리스트(1~5)",
    "모멘텀", "추세", "안정성", "유동성"];
  const q = (v) => v == null ? "" : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  const lines = [H.join(",")].concat(rs.map((r) => [r.m, r.id, r.name, r.sub, r.sec, r.ind, r.g === "KR" ? "KRW" : "USD", r.p, r.d1, r.mc, r.mcu,
    r.r5, r.r21, r.r63, r.r126, r.ytd, r.r252, r.fh, r.rsi, r.pm50, r.pm200, r.vol, r.mdd, r.vs,
    r.pe, r.fpe, r.pb, r.dy, r.roe, r.eps, r.ern, r.ar, r.sm, r.st, r.ss, r.sl].map(q).join(",")));
  download(`stocks-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + lines.join("\n"), "text/csv;charset=utf-8");
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------------------------------------------------------- 상세 분석 */
let CUR = null, pushed = false;
function insights(r) {
  const L = [];
  const add = (kind, html) => L.push({ kind, html });
  const nm = r.g === "KR" ? "한국" : "미국";
  const sm = secMed(r);
  if (r.warn) add("warn", "<b>관리종목 또는 투자주의환기 종목</b>입니다. 상장폐지 사유와 공시를 먼저 확인하세요.");
  if (!liquid(r)) add("warn", "최근 거래가 거의 없습니다. 표시된 가격이 실제로 사고팔 수 있는 가격과 다를 수 있습니다.");
  if (soon(r, 14)) add("warn", `<b>${r.ern.slice(5).replace("-", "/")} 실적 발표 예정</b>입니다. 발표 전후로 주가 변동이 커지는 경우가 많습니다.`);
  if (r.pm50 != null && r.pm200 != null) {
    if (r.up === 1 && r.pm50 > 0) add("pos", `주가가 50일선(${pct(r.pm50)})과 200일선(${pct(r.pm200)}) 위에 있고 50일선이 200일선보다 높은 <b>정배열</b> — 중기 상승 추세입니다.`);
    else if (r.up === 0 && r.pm50 < 0) add("neg", `주가가 50일선(${pct(r.pm50)}) 아래, 50일선이 200일선 아래인 <b>역배열</b> — 중기 하락 추세입니다.`);
    else add("neu", `50일선 대비 ${pct(r.pm50)}, 200일선 대비 ${pct(r.pm200)} — 단기와 장기 추세가 <b>엇갈립니다</b>.`);
  }
  if (r.x === "G") add("pos", "최근 20거래일 안에 50일선이 200일선을 위로 뚫었습니다(<b>골든크로스</b>).");
  if (r.x === "D") add("neg", "최근 20거래일 안에 50일선이 200일선 아래로 내려갔습니다(<b>데드크로스</b>).");
  if (r.r252 != null && MED[r.g].r252 != null) {
    const gap = r.r252 - MED[r.g].r252;
    add(gap >= 0 ? "pos" : "neg", `1년 수익률 ${pct(r.r252)} — ${nm} 중위 종목(${pct(MED[r.g].r252)})보다 <b>${Math.abs(gap).toFixed(1)}%p ${gap >= 0 ? "높습니다" : "낮습니다"}</b>.`);
  }
  if (r.fh != null) {
    if (r.fh >= -3) add("pos", `52주 최고가에서 ${pct(r.fh)} — <b>신고가권</b>입니다.`);
    else if (r.fl != null && r.fl <= 10) add("neg", `52주 최저가에서 ${pct(r.fl)} 위 — <b>저점권</b>입니다. 최고가 대비 ${pct(r.fh)}.`);
    else if (r.fh <= -50) add("neg", `52주 최고가 대비 <b>${pct(r.fh)}</b> — 고점의 절반 아래에 있습니다.`);
  }
  if (r.pe != null && sm && sm.pe && sm.n >= 5) {
    const k = (r.pe / sm.pe - 1) * 100;
    if (k <= -30) add("pos", `PER ${num(r.pe)}배 — 같은 업종 중위(${num(sm.pe)}배)보다 <b>${Math.abs(k).toFixed(0)}% 낮습니다</b>. 싼 이유(실적 둔화 등)가 있는지 함께 보세요.`);
    else if (k >= 50) add("neu", `PER ${num(r.pe)}배 — 같은 업종 중위(${num(sm.pe)}배)보다 <b>${k.toFixed(0)}% 높습니다</b>. 시장이 높은 성장을 기대하고 있다는 뜻입니다.`);
  } else if (r.pe == null && r.eps != null && r.eps < 0) add("neg", "최근 4분기 순이익이 <b>적자</b>라 PER을 계산할 수 없습니다.");
  if (r.dy != null && r.dy >= 4) add("pos", `배당수익률 <b>${r.dy.toFixed(2)}%</b> — 고배당 종목입니다. 배당이 지속 가능한지(배당성향) 확인하세요.`);
  if (r.roe != null && r.roe >= 20) add("pos", `ROE <b>${r.roe.toFixed(1)}%</b> — 자기자본 대비 이익을 많이 냅니다.`);
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
  if (r.nd != null && r.nd < 252) add("neu", `데이터가 ${r.nd}거래일치라 1년 지표 일부가 비어 있습니다(최근 상장이거나 거래정지 기간이 있었을 수 있습니다).`);
  if (r.nd == null && r.g === "US") add("neu", "이 종목의 1년 일봉은 아직 없습니다. 아래 인터랙티브 차트는 바로 볼 수 있습니다.");
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
  if (label.startsWith("같은 업종")) list = pool.slice(0, 8);
  else { const i = pool.findIndex((x) => x.id === r.id); const c = i < 0 ? 0 : i; list = pool.slice(Math.max(0, c - 4), c + 4); }
  if (!list.includes(r)) list = [...list.slice(0, 7), r].sort((a, b) => (b.mcu || 0) - (a.mcu || 0));
  return { label, list };
}
const cell = (k, v, s, c = "", big = false) => `<div class="st"><div class="k">${k}</div><div class="v ${c}"${big ? "" : ' style="font-size:18px"'}>${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
function kpis(r) {
  const ret = [["1주", r.r5], ["1개월", r.r21], ["3개월", r.r63], ["6개월", r.r126], ["연초 이후", r.ytd], ["1년", r.r252]];
  return `<div class="stats c3 fix3">${ret.map(([k, v]) => cell(k, pct(v), "", cls(v), true)).join("")}</div>`;
}
const FS_TXT = { Y: "Yahoo Finance · 최근 4분기", S: "미국 SEC 공시(EDGAR) · 최근 회계연도", K: "한국거래소 · 최근 결산" };
function valuationBlock(r) {
  const has = ["pe", "fpe", "pb", "dy", "roe", "eps", "ern", "ar"].some((k) => r[k] != null && r[k] !== "");
  if (!has) return `<div class="note"><span class="ic">ⓘ</span><div>이 종목은 재무 지표가 아직 없습니다${r.m === "KONEX" ? "(코넥스는 출처에서 제공하지 않습니다)" : ""}. 다음 자동 갱신 때 채워질 수 있습니다.</div></div>`;
  const sm = secMed(r) || {};
  const eps = r.eps == null ? "—" : r.g === "KR" ? nf.format(Math.round(r.eps)) + "원" : "$" + r.eps.toFixed(2);
  return `<div class="stats c4">
    ${cell("PER", r.pe == null ? (r.eps != null && r.eps < 0 ? "적자" : "—") : num(r.pe) + '<span class="u">배</span>', vsMed(r.pe, sm.pe))}
    ${cell("선행 PER", r.fpe == null ? "—" : num(r.fpe) + '<span class="u">배</span>', r.fpe != null && r.pe != null ? (r.fpe < r.pe ? "이익 증가 예상" : "이익 감소 예상") : "")}
    ${cell("PBR", r.pb == null ? "—" : num(r.pb, 2) + '<span class="u">배</span>', vsMed(r.pb, sm.pb))}
    ${cell("배당수익률", r.dy == null ? "—" : r.dy.toFixed(2) + "%", sm.dy != null ? "업종 중위 " + sm.dy.toFixed(2) + "%" : "")}
    ${cell("ROE", r.roe == null ? "—" : r.roe.toFixed(1) + "%", sm.roe != null ? "업종 중위 " + sm.roe.toFixed(1) + "%" : "", r.roe < 0 ? "down" : "")}
    ${cell("EPS(최근 4분기)", eps, "", r.eps < 0 ? "down" : "")}
    ${cell("다음 실적 발표", ernTxt(r), r.ern && daysTo(r.ern) >= 0 ? "회사·거래소 예정일" : "")}
    ${cell("애널리스트 평균", AR_TXT(r.ar), r.ar == null ? "" : r.ar.toFixed(1) + " / 5 (1=강력 매수)")}
  </div>
  <p class="hint mt8">재무 지표 출처: ${FS_TXT[r.fs] || "—"}(${META.fundAt || "—"} 수집)${r.fs === "S" ? ". 결산 뒤 실적 변화는 반영되지 않습니다" : ""}. 업종 중위는 같은 시장·같은 업종에서 거래가 있는 종목 기준입니다.</p>`;
}
function scoreBlock(r) {
  if (r.sm == null && r.st == null) return "";
  const n = MED[r.g].scored;
  const one = (t, v, d) => v == null ? "" : `<div class="sc"><div class="top"><b>${t}</b><span>${v}</span></div>
    <div class="trk" role="img" aria-label="${t} ${v}점"><i style="width:${v}%;background:${v >= 70 ? "var(--s3)" : v <= 30 ? "var(--s2)" : "var(--s1)"}"></i></div><p>${d}</p></div>`;
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
function weekDates(r, n) {
  const asof = new Date((r.asof || (r.g === "KR" ? META.krAsof : META.usAsof) || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  return (i) => new Date(asof.getTime() - (n - 1 - i) * 7 * 864e5);
}
/* 보기 좋은 눈금(1·2·2.5·5 × 10^k 간격) */
function niceTicks(lo, hi, count = 4) {
  const p = Math.pow(10, Math.floor(Math.log10((hi - lo) / count || 1)));
  const make = (step) => { const o = []; for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) o.push(+t.toPrecision(12)); return o; };
  // 눈금 개수가 목표에 가장 가까운 간격을 고른다(최소 2개)
  let best = null;
  for (const m of [1, 2, 2.5, 5, 10, 20]) {
    const t = make(m * p);
    const score = t.length < 2 ? 99 : Math.abs(t.length - count);
    if (!best || score < best.score) best = { t, score };
  }
  return best.t;
}
/* SVG 를 실제 폭에 맞춰 그린다 — 고정 viewBox 를 줄이면 휴대폰에서 글자가 너무 작아진다 */
function chartW(el) { return Math.max(300, Math.min(900, Math.round(el.clientWidth || 880))); }
function monthTicks(n, dateAt, X, H, every = 2) {
  let s = "", last = -1;
  for (let i = 0; i < n; i++) {
    const m = dateAt(i).getMonth();
    if (m !== last && i > 1 && i < n - 1 && m % every === 0) s += `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="middle">${dateAt(i).getFullYear() % 100}.${String(m + 1).padStart(2, "0")}</text>`;
    last = m;
  }
  return s;
}
function drawChart(r) {
  const el = $("chart"); if (!el || !r.sp) return;
  const W = chartW(el), H = W < 560 ? 210 : 250, P = { l: 4, r: W < 560 ? 52 : 64, t: 12, b: 26 };
  const v = sparkVals(r), n = v.length;
  const lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.08 || hi * 0.05 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const X = (i) => P.l + i * (W - P.l - P.r) / (n - 1), Y = (x) => P.t + (1 - (x - y0) / (y1 - y0)) * (H - P.t - P.b);
  const dateAt = weekDates(r, n);
  const up = v[n - 1] >= v[0], col = up ? "var(--up)" : "var(--down)";
  const line = v.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x).toFixed(1)).join("");
  const area = line + `L${X(n - 1)} ${H - P.b}L${X(0)} ${H - P.b}Z`;
  const ticks = niceTicks(y0, y1, W < 560 ? 3 : 4);
  const fmtAx = (x) => r.g === "KR" ? (x >= 1e6 ? (x / 1e4).toLocaleString("ko-KR") + "만" : nf.format(Math.round(x))) : x >= 100 ? nf.format(Math.round(x)) : x.toFixed(x >= 10 ? 0 : 2);
  el.innerHTML = `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r.name)} 1년 주가 흐름: ${price(r, v[0])}에서 ${price(r, v[n - 1])}">
    <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${up ? "var(--fill-up)" : "var(--fill-down)"}" stop-opacity=".22"/><stop offset="1" stop-color="${up ? "var(--fill-up)" : "var(--fill-down)"}" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line class="gridline" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${W - P.r + 6}" y="${Y(t) + 4}">${fmtAx(t)}</text>`).join("")}
    ${monthTicks(n, dateAt, X, H, W < 560 ? 3 : 2)}
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
function actionsHtml(r) {
  const inPf = PF.some((h) => h.id === r.id);
  return `<div class="acts">
    <button class="ghost sm" type="button" data-act="fav" aria-pressed="${FAV.has(r.id)}">${FAV.has(r.id) ? "★ 관심 종목" : "☆ 관심 종목"}</button>
    <button class="ghost sm" type="button" data-act="cmp" aria-pressed="${CMP.includes(r.id)}">${CMP.includes(r.id) ? "✓ 비교에 담음" : "＋ 비교에 담기"}</button>
    <button class="ghost sm" type="button" data-act="pf">${inPf ? "✓ 포트폴리오에 있음" : "＋ 포트폴리오"}</button>
    <button class="ghost sm" type="button" data-act="share">🔗 링크 복사</button></div>`;
}
function renderDetail(host, r) {
  const ins = insights(r);
  const pr = peers(r);
  const ic = { pos: "↑", neg: "↓", neu: "·", warn: "!" };
  const asof = r.asof || (r.g === "KR" ? META.krAsof : META.usAsof) || "";
  const head = MODE === "stock" ? `<div class="page-head">${avatar(r, 48)}<div><h1 class="page-h1">${esc(r.name)}</h1>
      <div class="sub">${mBadge(r)} <span>${esc(r.id)}</span>${r.sub && r.g === "US" ? ` · ${esc(r.sub)}` : ""}${r.sec ? ` · ${esc(r.sec)}` : ""}</div></div></div>` : "";
  host.innerHTML = head + `
    <div class="pxrow"><span class="big">${price(r)}</span><span class="chg ${cls(r.d1)}">${pct(r.d1, 2)}</span>
      <span class="asof">${asof ? asof + " 종가" : "전 거래일 종가"} ${statusPill(r.g)} · 시가총액 ${cap(r)} ${capOther(r) ? `<span class="hint">(${capOther(r)})</span>` : ""}</span></div>
    <div id="acts">${actionsHtml(r)}</div>
    <div class="dsec">${chartBlock(r)}</div>
    <div class="dsec"><h3>한눈에 보기 <small>규칙에 따라 자동으로 쓴 문장 · 투자 권유 아님</small></h3>
      <ul class="insights">${ins.length ? ins.map((x) => `<li><span class="ic ${x.kind}" aria-hidden="true">${ic[x.kind]}</span><span>${x.html}</span></li>`).join("") : '<li><span class="ic neu">·</span><span>눈에 띄는 신호가 없습니다.</span></li>'}</ul></div>
    <div class="dsec"><h3>기간 수익률</h3>${kpis(r)}</div>
    <div class="dsec">${rangeBlock(r)}</div>
    <div class="dsec"><h3>밸류에이션 · 실적</h3>${valuationBlock(r)}</div>
    ${scoreBlock(r)}
    <div class="dsec"><h3>기술적 지표</h3>${techBlock(r)}</div>
    <div class="dsec"><h3>프로필</h3>${profileBlock(r)}</div>
    <div class="dsec"><h3>${esc(pr.label)} <small>시총 · PER · 1개월 · 1년</small></h3><div class="card pad peers">
      ${pr.list.map((x) => `<a class="peer${x.id === r.id ? " me" : ""}" href="${stockHref(x.id)}" data-id="${esc(x.id)}">${avatar(x, 24)}<span class="pn">${esc(x.name)} <small class="hint">${esc(x.id)}</small></span>
        <span class="pv wide">${cap(x)}</span><span class="pv">${x.pe == null ? "—" : num(x.pe)}</span><span class="pv ${cls(x.r21)}">${pct(x.r21)}</span><span class="pv ${cls(x.r252)}">${pct(x.r252)}</span></a>`).join("")}</div></div>
    <div class="dsec"><h3>더 깊이 보기</h3>
      <div class="links">${extLinks(r)}</div>
      <div class="links mt12">
        <button class="ghost" type="button" id="tvChartBtn">📈 인터랙티브 차트 열기</button>
        ${r.g === "US" ? '<button class="ghost" type="button" id="tvFinBtn">📊 재무제표 보기</button>' : ""}
      </div>
      <div id="tvChart"></div><div id="tvFin"></div>
      <p class="hint mt8">인터랙티브 차트와 재무제표는 TradingView 위젯으로, 누를 때만 불러옵니다.</p></div>
    <div class="note mt24"><span class="ic">ⓘ</span><div>지표는 전 거래일까지의 공개 데이터로 계산했습니다. <b>투자 권유가 아니며</b>, 거래 전 증권사 시세와 공시를 확인하세요.</div></div>`;
  drawChart(r);
  host.querySelectorAll(".peer").forEach((p) => p.addEventListener("click", (e) => {
    if (MODE === "stock" || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); if (p.dataset.id !== r.id) openDetail(p.dataset.id);
  }));
  $("acts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "fav") toggleFav(r.id);
    else if (a === "cmp") toggleCmp(r.id, !CMP.includes(r.id));
    else if (a === "share") copy(location.origin + (PAGES.has(r.id) ? `/finder/s/${encodeURIComponent(r.id)}/` : `/finder/#s=${encodeURIComponent(r.id)}`), "종목 링크를 복사했습니다");
    else if (a === "pf") {
      if (MODE === "stock") { location.href = `/finder/?pf=${encodeURIComponent(r.id)}#portfolio`; return; }
      closeDetail(); pfPrefill(r);
    }
  });
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
function paintActions() {
  if (!CUR) return;
  const a = $("acts"); if (a) a.innerHTML = actionsHtml(CUR);
  const b = $("dtStar");
  if (b) { const on = FAV.has(CUR.id); b.textContent = on ? "★" : "☆"; b.setAttribute("aria-pressed", on); }
  const c = $("dtCmp");
  if (c) { const on = CMP.includes(CUR.id); c.textContent = on ? "✓ 비교" : "＋ 비교"; c.setAttribute("aria-pressed", on); }
}
function openDetail(id, fromHash) {
  const r = BY_ID.get(id); if (!r) return;
  CUR = r;
  pushRecent(r.id);
  if (!fromHash && location.hash !== "#s=" + id) { history.pushState({ s: id }, "", "#s=" + id); pushed = true; }
  document.title = `${r.name} (${r.id}) · 전 종목 탐색기`;
  $("dtAv").outerHTML = `<span class="av" id="dtAv" aria-hidden="true" style="background:${avColor(r.id)}">${esc(avText(r))}</span>`;
  $("dtName").textContent = r.name;
  $("dtSub").innerHTML = `${mBadge(r)}<span>${esc(r.id)}</span>${r.sub && r.g === "US" ? `<span>· ${esc(r.sub)}</span>` : ""}${r.sec ? `<span>· ${esc(r.sec)}</span>` : ""}`;
  const dlg = $("dt");
  if (!dlg.open) dlg.showModal();
  renderDetail($("dtBody"), r);
  paintActions();
  dlg.scrollTop = 0;
}
function closeDetail(fromHash) {
  const dlg = $("dt");
  if (dlg.open) dlg.close();
  CUR = null;
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
  $("dtCmp").addEventListener("click", () => CUR && toggleCmp(CUR.id, !CMP.includes(CUR.id)));
  const route = () => {
    const m = location.hash.match(/^#s=(.+)$/);
    if (m && BY_ID.has(decodeURIComponent(m[1]))) openDetail(decodeURIComponent(m[1]), true);
    else if ($("dt").open) { pushed = false; closeDetail(true); }
  };
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  route();
}

/* ---------------------------------------------------------------- 비교 */
const CMP_COL = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
function toggleCmp(id, on) {
  CMP = CMP.filter((x) => x !== id);
  if (on) {
    if (CMP.length >= 4) { toast("비교는 최대 4종목까지입니다"); if (MODE === "list") renderTable(); paintActions(); return; }
    CMP.push(id);
  }
  store.set("finder.cmp", CMP);
  renderTray(); paintActions();
  if (MODE === "list") document.querySelectorAll(`[data-cmp="${CSS.escape(id)}"]`).forEach((c) => { c.checked = CMP.includes(id); });
}
function renderTray() {
  const t = $("tray"); if (!t) return;
  t.hidden = !CMP.length;
  document.body.classList.toggle("has-tray", CMP.length > 0);
  $("trayChips").innerHTML = `<span class="hint">비교 ${CMP.length}/4</span>` + CMP.map((id, i) => {
    const r = BY_ID.get(id);
    return `<span class="tchip"><i style="background:${CMP_COL[i]}"></i>${esc(r.name)}<button type="button" data-rm="${esc(id)}" aria-label="${esc(r.name)} 빼기">✕</button></span>`;
  }).join("");
}
function renderCompare() {
  const rs = CMP.map((id) => BY_ID.get(id));
  const series = rs.map((r) => { const v = sparkVals(r); return v ? v.map((x) => x / v[0] * 100) : null; });
  const n = Math.max(...series.map((s) => s ? s.length : 0));
  let chart = `<div class="nochart">1년 차트 데이터가 있는 종목이 없습니다.</div>`;
  if (n > 1) {
    const W = Math.max(300, Math.min(900, ($("cmpBody").clientWidth || 880) - 30)), H = W < 560 ? 230 : 280, P = { l: 4, r: 44, t: 14, b: 26 };
    const all = series.flat().filter((x) => x != null);
    const lo = Math.min(...all, 100), hi = Math.max(...all, 100), pad = (hi - lo) * 0.08 || 5;
    const y0 = lo - pad, y1 = hi + pad;
    const X = (i) => P.l + i * (W - P.l - P.r) / (n - 1), Y = (x) => P.t + (1 - (x - y0) / (y1 - y0)) * (H - P.t - P.b);
    const ref = rs.find((r) => r.sp) || rs[0];
    const dateAt = weekDates(ref, n);
    const ticks = niceTicks(y0, y1, W < 560 ? 3 : 5);
    chart = `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="비교 종목 1년 수익률 겹쳐 보기">
      ${ticks.map((t) => `<line class="gridline" x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${W - P.r + 6}" y="${Y(t) + 4}">${t.toFixed(0)}</text>`).join("")}
      <line class="zero" x1="${P.l}" x2="${W - P.r}" y1="${Y(100)}" y2="${Y(100)}" stroke-dasharray="4 4"/>
      ${monthTicks(n, dateAt, X, H, W < 560 ? 3 : 2)}
      ${series.map((s, k) => {
        if (!s) return "";
        const off = n - s.length; // 상장이 늦으면 오른쪽 끝에 맞춘다
        return `<path d="${s.map((x, i) => (i ? "L" : "M") + X(i + off).toFixed(1) + " " + Y(x).toFixed(1)).join("")}" fill="none" stroke="${CMP_COL[k]}" stroke-width="2.2" stroke-linejoin="round"/>`;
      }).join("")}</svg>`;
  }
  const rowsDef = [
    ["가격", (r) => price(r)], ["1일", (r) => pct(r.d1, 2), (r) => r.d1, 1], ["시가총액", (r) => cap(r), (r) => r.mcu, 1],
    ["1개월", (r) => pct(r.r21), (r) => r.r21, 1], ["3개월", (r) => pct(r.r63), (r) => r.r63, 1], ["1년", (r) => pct(r.r252), (r) => r.r252, 1],
    ["52주 고점 대비", (r) => pct(r.fh), (r) => r.fh, 1], ["PER", (r) => num(r.pe), (r) => r.pe, -1], ["PBR", (r) => num(r.pb, 2), (r) => r.pb, -1],
    ["배당수익률", (r) => r.dy == null ? "—" : r.dy.toFixed(2) + "%", (r) => r.dy, 1], ["ROE", (r) => r.roe == null ? "—" : r.roe.toFixed(1) + "%", (r) => r.roe, 1],
    ["RSI", (r) => r.rsi ?? "—"], ["변동성", (r) => r.vol == null ? "—" : r.vol.toFixed(0) + "%", (r) => r.vol, -1],
    ["1년 최대낙폭", (r) => pct(r.mdd), (r) => r.mdd, 1], ["모멘텀", (r) => r.sm ?? "—", (r) => r.sm, 1], ["안정성", (r) => r.ss ?? "—", (r) => r.ss, 1],
    ["애널리스트", (r) => AR_TXT(r.ar), (r) => r.ar, -1],
  ];
  const table = `<div class="tscroll"><table class="cmp-t"><thead><tr><th></th>${rs.map((r, i) => `<th><span class="ktag" style="background:${CMP_COL[i]}"></span><a href="${stockHref(r.id)}" data-id="${esc(r.id)}">${esc(r.name)}</a><small>${r.m} ${esc(r.id)}</small></th>`).join("")}</tr></thead><tbody>
    ${rowsDef.map(([t, f, v, dir]) => {
      let best = null;
      if (v) { const vals = rs.map(v).filter((x) => x != null); if (vals.length > 1) best = dir > 0 ? Math.max(...vals) : Math.min(...vals); }
      return `<tr><td class="tx">${t}</td>${rs.map((r) => `<td class="${best != null && v(r) === best ? "best" : ""}">${f(r)}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table></div>`;
  $("cmpBody").innerHTML = `<div class="chartbox"><div class="cap"><span>시작점 = 100 · 주간 종가</span><span>${rs.map((r, i) => `<span class="lgd"><i style="background:${CMP_COL[i]}"></i>${esc(r.name)}</span>`).join(" ")}</span></div>${chart}</div>
    <div class="dsec"><h3>지표 비교 <small>초록 굵은 값 = 그 줄에서 가장 유리한 값(PER·PBR·변동성은 낮은 쪽)</small></h3>${table}</div>
    <p class="hint mt12">한국·미국 종목을 섞으면 가격과 시총 통화가 다릅니다. 수익률·배수 지표는 통화와 무관하게 비교할 수 있습니다.</p>`;
}
function initCompare() {
  $("trayChips").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) toggleCmp(b.dataset.rm, false); });
  $("trayClear").addEventListener("click", () => { CMP = []; store.set("finder.cmp", CMP); renderTray(); paintActions(); if (MODE === "list") renderTable(); });
  $("trayGo").addEventListener("click", () => {
    if (CMP.length < 2) { toast("두 종목 이상 담아 주세요"); return; }
    $("cmpDlg").showModal(); renderCompare();
  });
  $("cmpClose").addEventListener("click", () => $("cmpDlg").close());
  $("cmpDlg").addEventListener("click", (e) => {
    if (e.target === $("cmpDlg")) { $("cmpDlg").close(); return; }
    const a = e.target.closest("a[data-id]");
    if (a && MODE === "list" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $("cmpDlg").close(); openDetail(a.dataset.id); }
  });
  renderTray();
}

/* ---------------------------------------------------------------- 포트폴리오 */
let pfPick = null;
function savePf() { store.set("finder.pf", PF); }
function pfPrefill(r) {
  pfPick = r; $("pfQ").value = `${r.name} (${r.id})`;
  $("pfHint").textContent = `${r.name} · 현재가 ${price(r)} · 평균 단가는 ${r.g === "KR" ? "원" : "달러"}로 넣습니다.`;
  $("portfolio").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => $("pfQty").focus({ preventScroll: true }), 400);
}
function renderPf() {
  const el = $("pfView");
  const fx = META.fx;
  const rows = PF.map((h) => ({ h, r: BY_ID.get(h.id) })).filter((x) => x.r);
  if (!rows.length) { el.innerHTML = `<div class="cmpempty">아직 담은 종목이 없습니다. 위에서 종목을 고르고 수량과 평균 단가를 넣어 보세요.</div>`; return; }
  const toKrw = (r, v) => r.g === "KR" ? v : fx ? v * fx : null;
  let tv = 0, tc = 0, td = 0;
  const items = rows.map(({ h, r }) => {
    const val = toKrw(r, r.p * h.q), cost = h.c ? toKrw(r, h.c * h.q) : null;
    const prev = r.d1 != null ? r.p / (1 + r.d1 / 100) : null;
    const day = prev != null ? toKrw(r, (r.p - prev) * h.q) : null;
    tv += val || 0; if (cost != null) tc += cost; td += day || 0;
    return { h, r, val, cost, pl: cost != null && val != null ? val - cost : null, plp: h.c ? (r.p / h.c - 1) * 100 : null, day };
  });
  const tcv = items.filter((x) => x.cost != null).reduce((s, x) => s + (x.val || 0), 0); // 원금이 있는 종목의 평가액
  const tpl = tc ? tcv - tc : null;
  const bySec = new Map();
  for (const x of items) { const k = (x.r.g === "KR" ? "🇰🇷 " : "🇺🇸 ") + (x.r.sec || "기타"); bySec.set(k, (bySec.get(k) || 0) + (x.val || 0)); }
  const alloc = [...bySec].sort((a, b) => b[1] - a[1]);
  el.innerHTML = `<div class="stats c4">
      ${cell("평가금액", krw(tv), fx ? `환율 ${nf.format(fx)}원/$ 적용` : "", "", true)}
      ${cell("평가손익", tpl == null ? "—" : (tpl >= 0 ? "+" : "") + krw(tpl), tc ? pct(tpl / tc * 100, 2) + " · 원금 " + krw(tc) : "평균 단가를 넣으면 계산합니다", cls(tpl), true)}
      ${cell("전일 대비", (td >= 0 ? "+" : "") + krw(td), tv - td ? pct(td / (tv - td) * 100, 2) : "", cls(td), true)}
      ${cell("종목 수", rows.length + "개", `한국 ${items.filter((x) => x.r.g === "KR").length} · 미국 ${items.filter((x) => x.r.g === "US").length}`, "", true)}
    </div>
    ${tv ? `<div class="alloc mt12" role="img" aria-label="업종별 비중">${alloc.map(([k, v], i) => `<i style="width:${v / tv * 100}%;background:${PALETTE[i % PALETTE.length]}" title="${esc(k)} ${(v / tv * 100).toFixed(1)}%"></i>`).join("")}</div>
    <div class="alloc-lg">${alloc.slice(0, 8).map(([k, v], i) => `<span><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(k)} ${(v / tv * 100).toFixed(1)}%</span>`).join("")}</div>` : ""}
    <div class="card mt12"><div class="tscroll"><table class="scr pf-t"><thead><tr><th style="text-align:left">종목</th><th>수량</th><th>평균 단가</th><th>현재가</th><th>평가금액</th><th>손익</th><th>오늘</th><th>비중</th><th><span class="sr">삭제</span></th></tr></thead><tbody>
      ${items.sort((a, b) => (b.val || 0) - (a.val || 0)).map((x) => `<tr data-id="${esc(x.r.id)}">
        <td class="tx nmc" style="text-align:left"><div class="co">${avatar(x.r)}<div style="min-width:0"><b>${esc(x.r.name)}</b><small>${mBadge(x.r)}<span>${esc(x.r.id)}</span></small></div></div></td>
        <td><input class="pfin num" data-f="q" type="number" step="any" min="0" value="${x.h.q}" aria-label="${esc(x.r.name)} 수량"></td>
        <td><input class="pfin num" data-f="c" type="number" step="any" min="0" value="${x.h.c ?? ""}" placeholder="—" aria-label="${esc(x.r.name)} 평균 단가"></td>
        <td>${price(x.r)}</td><td>${krw(x.val)}</td>
        <td class="${cls(x.pl)}">${x.pl == null ? "—" : (x.pl >= 0 ? "+" : "") + krw(x.pl) + `<small class="blk">${pct(x.plp, 2)}</small>`}</td>
        <td class="${cls(x.day)}">${x.day == null ? "—" : (x.day >= 0 ? "+" : "") + krw(x.day)}</td>
        <td>${tv && x.val != null ? (x.val / tv * 100).toFixed(1) + "%" : "—"}</td>
        <td><button class="ghost sm" type="button" data-del="${esc(x.r.id)}" aria-label="${esc(x.r.name)} 삭제">✕</button></td></tr>`).join("")}
    </tbody></table></div></div>
    ${!fx && items.some((x) => x.r.g === "US") ? '<p class="hint mt8">환율 정보가 없어 미국 종목은 원화 합계에서 빠졌습니다.</p>' : ""}`;
}
function initPortfolio() {
  attachSearch({ input: $("pfQ"), box: $("pfRes"), wrap: $("pfBox"), limit: 6, onPick: (r) => pfPrefill(r) });
  $("pfQ").addEventListener("input", () => { pfPick = null; });
  $("pfAddBtn").addEventListener("click", () => {
    const q = +$("pfQty").value, c = $("pfCost").value === "" ? null : +$("pfCost").value;
    if (!pfPick) { toast("먼저 종목을 골라 주세요"); $("pfQ").focus(); return; }
    if (!(q > 0)) { toast("수량을 넣어 주세요"); $("pfQty").focus(); return; }
    const ex = PF.find((h) => h.id === pfPick.id);
    if (ex) { // 같은 종목을 더 사면 평균 단가를 가중 평균으로 합친다
      ex.c = ex.c != null && c != null ? (ex.c * ex.q + c * q) / (ex.q + q) : ex.c ?? c;
      ex.q += q;
    } else PF.push({ id: pfPick.id, q, c });
    savePf(); renderPf();
    toast(`${pfPick.name} 담음`);
    pfPick = null; $("pfQ").value = $("pfQty").value = $("pfCost").value = "";
    $("pfHint").textContent = "종목을 고르면 단가 통화(원·달러)가 표시됩니다.";
  });
  $("pfView").addEventListener("change", (e) => {
    const inp = e.target.closest(".pfin"); if (!inp) return;
    const h = PF.find((x) => x.id === inp.closest("tr").dataset.id); if (!h) return;
    const v = inp.value === "" ? null : +inp.value;
    if (inp.dataset.f === "q") { if (v > 0) h.q = v; } else h.c = v;
    savePf(); renderPf();
  });
  $("pfView").addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]");
    if (d) { PF = PF.filter((x) => x.id !== d.dataset.del); savePf(); renderPf(); return; }
    if (e.target.closest("input")) return;
    const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(tr.dataset.id);
  });
  $("pfExport").addEventListener("click", () => download(`portfolio-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ app: "finder", v: 1, holdings: PF, favorites: [...FAV] }, null, 2), "application/json"));
  $("pfImport").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const hs = (j.holdings || []).filter((h) => h && BY_ID.has(h.id) && h.q > 0).map((h) => ({ id: h.id, q: +h.q, c: h.c == null ? null : +h.c }));
      if (!hs.length && !(j.favorites || []).length) throw new Error("empty");
      PF = hs; (j.favorites || []).forEach((id) => BY_ID.has(id) && FAV.add(id));
      savePf(); store.set("finder.fav", [...FAV]); renderPf(); renderTable();
      toast(`종목 ${hs.length}개를 불러왔습니다`);
    } catch (err) { toast("백업 파일을 읽지 못했습니다"); }
    e.target.value = "";
  });
  renderPf();
  const pre = new URLSearchParams(location.search).get("pf");
  if (pre && BY_ID.has(pre)) pfPrefill(BY_ID.get(pre));
}

/* ---------------------------------------------------------------- 테마 · 설치 */
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
function initPwa() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/finder/sw.js", { scope: "/finder/" }).catch(() => {});
  }
  const btn = $("installBtn"); if (!btn) return;
  let ev = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); ev = e; btn.hidden = false; });
  btn.addEventListener("click", async () => { if (!ev) return; ev.prompt(); await ev.userChoice.catch(() => {}); ev = null; btn.hidden = true; });
}

/* ---------------------------------------------------------------- 시작 */
(async function main() {
  initTheme();
  initPwa();
  try { await load(); }
  catch (e) {
    const msg = `<span class="down">데이터를 불러오지 못했습니다(${esc(e.message)}). 잠시 뒤 새로고침해 주세요.</span>`;
    if ($("fresh")) $("fresh").innerHTML = msg; else if ($("page")) $("page").innerHTML = msg;
    return;
  }
  if (MODE === "stock") {
    const r = BY_ID.get(document.body.dataset.id);
    initSearch();
    if (!r) { $("page").innerHTML = `<p class="lead">이 종목은 지금 목록에 없습니다(상장폐지·티커 변경일 수 있습니다). <a href="/finder/">전 종목 탐색기</a>에서 찾아보세요.</p>`; return; }
    CUR = r; pushRecent(r.id);
    renderDetail($("page"), r);
    return;
  }
  const c = META.counts || {};
  $("heroLead").innerHTML = `미국 <b>${nf.format(c.US || 0)}</b>종목과 한국 <b>${nf.format(c.KR || 0)}</b>종목, 전부를 한글·영문·티커·종목코드·초성(ㅅㅅㅈㅈ)으로 찾고
    수익률·추세·밸류에이션을 <b>같은 시장 안의 순위</b>로 읽습니다.`;
  renderFresh();
  initSearch();
  renderPulse();
  if (!ROWS.some((r) => r.g === "KR" && r.sec)) { secState.g = "US"; setSeg($("secMkt"), "US"); }
  initSectors(); renderSectors();
  initScreener();
  initDetail();
  initCompare();
  initPortfolio();
})();
