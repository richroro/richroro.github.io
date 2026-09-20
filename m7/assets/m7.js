"use strict";
/* =========================================================================
   M7 공유 엔진 — 페이지마다 CO(회사 데이터) 하나만 두고 나머지는 여기서 그립니다.
   외부 라이브러리 없음. 각 회사 페이지는 이 파일과 m7.css 만 불러옵니다.
   ========================================================================= */

const M7 = [
  { slug: "nvda", tk: "NVDA", ko: "엔비디아", ab: "NV", c: "#3987e5", hint: "데이터센터 한 곳에 몰린 매출" },
  { slug: "aapl", tk: "AAPL", ko: "애플", ab: "AA", c: "#6E7683", hint: "아이폰 절반, 서비스가 이익" },
  { slug: "msft", tk: "MSFT", ko: "마이크로소프트", ab: "MS", c: "#1baf7a", hint: "세 부문이 고르게" },
  { slug: "googl", tk: "GOOGL", ko: "알파벳", ab: "GO", c: "#eb6834", hint: "광고가 버는 돈으로 다 한다" },
  { slug: "amzn", tk: "AMZN", ko: "아마존", ab: "AM", c: "#c98500", hint: "매출 18%가 이익 57%" },
  { slug: "meta", tk: "META", ko: "메타", ab: "ME", c: "#4a3aa7", hint: "광고 이익의 19%를 태운다" },
  { slug: "tesla", tk: "TSLA", ko: "테슬라", ab: "TS", c: "#E82127", hint: "매출 최대, 최근 분기 이익률 1.4%", href: "/tesla-metrics/" }
];

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("ko-KR");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function pctTxt(v) { return v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; }
function cls(v) { return v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : ""; }
/* 조사 — 마지막 글자에 받침이 있는지로 고릅니다. 회사 이름이 알파벳이면
   한국어로 읽을 때의 끝소리를 적어 둡니다(ASML=에스엠엘 → 받침 ㄹ). */
const READS = { AMD: "디", TSMC: "씨", ASML: "엘", NVDA: "에이", MU: "유", TSM: "엠", AVGO: "오" };
function josa(word, withJong, without) {
  const s = String(word).trim();
  const last = READS[s.split(/[\s·,]+/).pop()] || s.slice(-1);
  const c = last.charCodeAt(0) - 0xAC00;
  if (c < 0 || c > 11171) return withJong + "(" + without + ")";
  return (c % 28) ? withJong : without;
}

const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------------------------- theme ---------------------------- */
function initTheme() {
  const saved = store.get("m7.theme", null);
  if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  const isDark = () => document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme:dark)").matches;
  const paint = () => {
    const b = $("themeBtn"); if (!b) return;
    $("themeIco").textContent = isDark() ? "☾" : "☀";
    $("themeTxt").textContent = isDark() ? "어둡게" : "밝게";
  };
  const b = $("themeBtn");
  if (b) b.addEventListener("click", () => {
    document.documentElement.dataset.theme = isDark() ? "light" : "dark";
    store.set("m7.theme", document.documentElement.dataset.theme);
    paint(); drawAll();
  });
  matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => { paint(); drawAll(); });
  paint();
}

/* ---------------------------- svg helpers ---------------------------- */
const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs, style) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (style) n.setAttribute("style", style);
  return n;
}
function txt(n, s) { n.textContent = s; return n; }
function niceScale(v, want) {
  if (!(v > 0)) return { max: 1, step: 1, ticks: 1 };
  const raw = v / (want || 4);
  const p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  const max = Math.ceil(v / step - 1e-9) * step;
  return { max: max, step: step, ticks: Math.round(max / step) };
}
function showTip(tip, wrap, html, x, y) {
  tip.innerHTML = html; tip.classList.add("on");
  const maxL = wrap.clientWidth - 8, half = tip.offsetWidth / 2;
  tip.style.left = Math.max(half + 4, Math.min(x, maxL - half)) + "px";
  tip.style.top = y + "px";
}
let CUR = "$";
function fmtB(v) { return CUR + (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) + "B"; }

/* ---------------------------- 매출 구성 가로막대 ---------------------------- */
function drawMix() {
  const svg = $("figMix"); if (!svg || !CO.mix) return;
  const wrap = svg.parentElement, tip = $("tipMix");
  const rows = CO.mix.rows, total = CO.mix.total;
  const W = Math.max(280, wrap.clientWidth || 320);
  const small = W < 560;
  const L = small ? 92 : 132, R = small ? 74 : 116, T = 6, B = 24;
  const rowH = small ? 28 : 32, gap = small ? 10 : 12;
  const H = T + rows.length * (rowH + gap) - gap + B;
  const pw = Math.max(40, W - L - R);
  const sc = niceScale(Math.max.apply(null, rows.map((r) => r.v)), small ? 3 : 4);

  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  for (let i = 0; i <= sc.ticks; i++) {
    const x = L + (sc.step * i / sc.max) * pw;
    svg.appendChild(el("line", { x1: x, x2: x, y1: T, y2: H - B + 3, class: i === 0 ? "baseline" : "gridline" }));
    svg.appendChild(txt(el("text", { x: x, y: H - B + 16, "text-anchor": "middle", class: "axis" }),
      sc.step * i === 0 ? "0" : sc.step * i));
  }
  rows.forEach((r, i) => {
    const y = T + i * (rowH + gap), w = Math.max(2, (r.v / sc.max) * pw);
    svg.appendChild(txt(el("text", { x: L - 8, y: y + rowH / 2 + 4, "text-anchor": "end", class: "name" }), r.k));
    svg.appendChild(el("rect", { x: L, y: y, width: w, height: rowH, rx: 4 }, "fill:var(" + (r.color || "--s1") + ")"));
    const lab = fmtB(r.v) + (r.yoy == null ? "" : " (" + pctTxt(r.yoy) + ")");
    svg.appendChild(txt(el("text", { x: L + w + 7, y: y + rowH / 2 + 4, class: "dlabel" }), lab));
    const hit = el("rect", { x: L, y: y - gap / 2, width: pw + R - 8, height: rowH + gap, class: "hit" });
    hit.addEventListener("mouseenter", () => showTip(tip, wrap,
      '<div class="th">' + esc(r.k) + " · " + esc(CO.mix.period) + "</div>" +
      '<div class="tr"><span class="nm">매출</span><b>' + fmtB(r.v) + "</b></div>" +
      (r.yoy == null ? "" : '<div class="tr"><span class="nm">전년 대비</span><b class="' + cls(r.yoy) + '">' + pctTxt(r.yoy) + "</b></div>") +
      '<div class="tr"><span class="nm">비중</span><b>' + ((r.v / total) * 100).toFixed(1) + "%</b></div>", L + w / 2, y));
    hit.addEventListener("mouseleave", () => tip.classList.remove("on"));
    svg.appendChild(hit);
  });
}

function drawAll() { drawMix(); }


/* ---------------------------- 회사 프로필 · 요약 지표 ---------------------------- */
function regEntry() {
  if (typeof REGISTRY === "undefined") return null;
  return REGISTRY.find((r) => r.slug === CO.slug) || null;
}
const YEAR = new Date().getFullYear();
function pfTile(k, v, sub) {
  return '<div class="pf"><div class="k">' + k + '</div><div class="v">' + v + '</div>' +
    (sub ? '<div class="s">' + sub + "</div>" : "") + "</div>";
}
function profileHtml() {
  const e = regEntry();
  if (!e || !e.p) return "";
  const p = e.p, age = YEAR - p.est, tenure = YEAR - p.since;
  return '<div class="card pad mt16"><div class="rowsplit"><h3>회사 프로필</h3>' +
    '<span class="fybadge">설립 ' + p.est + '년 · 올해로 ' + age + '년차</span></div>' +
    '<div class="prof mt12" role="group" aria-label="회사 기본 정보">' +
      pfTile("설립", p.est + "년", p.estNote ? esc(p.estNote) : "올해로 " + age + "년차") +
      pfTile("본사", esc(p.hq), "") +
      pfTile("상장 거래소", esc(p.ex), "티커 " + esc(e.tk) + (p.ex2 ? " · " + esc(p.ex2) : "")) +
      pfTile("CEO", esc(p.ceo) + ' <small>' + esc(p.ceoEn) + "</small>",
             p.sinceNote ? esc(p.sinceNote)
               : p.since + "년 취임 · " + (tenure >= 1 ? tenure + "년째" : "취임 첫해")) +
      pfTile("회계연도 종료", esc(p.fye),
             e.data ? "표에는 " + esc(e.data.fy) + " 로 적습니다" : "") +
      pfTile("배당", p.div ? "지급" : "없음",
             p.divNote ? esc(p.divNote)
               : p.div ? "배당률은 주가에 따라 바뀌어 싣지 않았습니다" : "이익을 전액 재투자·자사주에 씁니다") +
    "</div>" +
    '<div class="note mt12"><span class="ic">🪪</span><div>자주 바뀌지 않는 값만 모았습니다. ' +
      '<b>설립 ' + age + '년차</b>와 <b>CEO 재임 기간</b>은 올해 연도에서 빼서 자동으로 계산합니다. ' +
      '시가총액·배당률처럼 매일 움직이는 값은 정적 페이지에 싣지 않습니다 — 금방 틀린 값이 됩니다.</div></div></div>';
}

function peopleHtml() {
  const e = regEntry();
  if (!e || !e.data) return "";
  const d = e.data, cur = d.cur || "$";
  const money = (v) => cur + (v / 1e6).toFixed(v / 1e6 >= 1 ? 2 : 3) + "M";
  const per = (v) => (d.emp && v != null) ? (v * 1e9) / d.emp : null;
  const revPer = per(d.rev), oiPer = per(d.oi), niPer = per(d.ni);
  const om = d.oi == null ? null : (d.oi / d.rev) * 100;
  const nm = d.ni == null ? null : (d.ni / d.rev) * 100;
  const tile = (k, v, sub, cl) =>
    '<div class="st"><div class="k">' + k + '</div><div class="v num' + (cl ? " " + cl : "") +
    '">' + v + '</div><div class="s">' + sub + "</div></div>";
  // 영업이익률과 순이익률의 차이는 세금·영업 외 손익이 만듭니다 — 방향을 문장으로 짚어 둡니다.
  let gapNote = "";
  if (om != null && nm != null) {
    const gap = nm - om;
    gapNote = Math.abs(gap) < 1
      ? "영업이익률과 순이익률이 거의 같습니다 — 세금과 영업 외 손익이 서로 상쇄된 해입니다. "
      : gap > 0
        ? "<b>순이익률이 영업이익률보다 " + gap.toFixed(1) + "%p 높습니다</b> — 지분·이자 같은 영업 외 수익이 세금보다 컸다는 뜻입니다. "
        : "<b>영업이익의 " + ((1 - d.ni / d.oi) * 100).toFixed(0) + "%가 세금·영업 외 비용으로 빠졌습니다</b>(" +
          Math.abs(gap).toFixed(1) + "%p 차이). ";
  }
  return '<div class="card pad mt16"><div class="rowsplit"><h3>요약 지표</h3>' +
    '<span class="fybadge">' + esc(d.fy) + ' 실적 · 임직원 ' + esc(d.empAsOf || "—") + ' 기준</span></div>' +
    '<div class="stats c4 mt12" role="group" aria-label="재무 요약">' +
      tile("매출", cur + d.rev.toFixed(1) + "B", esc(d.fy)) +
      tile("전년 대비", d.growth == null ? "—" : pctTxt(d.growth), "매출 증감",
           d.growth == null ? "" : cls(d.growth)) +
      tile("총마진", d.gm == null ? "—" : d.gm.toFixed(1) + "%", "매출총이익 ÷ 매출") +
      tile("영업이익률", om == null ? "—" : om.toFixed(1) + "%",
           om == null ? "영업이익 미공개" : "영업이익 " + cur + d.oi.toFixed(1) + "B") +
    '</div>' +
    '<div class="stats c4 mt12" role="group" aria-label="순이익과 인력">' +
      tile("순이익", d.ni == null ? "—" : cur + d.ni.toFixed(1) + "B", esc(d.fy) + " 당기순이익") +
      tile("순이익률", nm == null ? "—" : nm.toFixed(1) + "%", "순이익 ÷ 매출") +
      tile("임직원 수", d.emp ? nf.format(d.emp) : "—", esc(d.empAsOf || "—")) +
      tile("한국과의 관계", esc(e.kr || "—"), "공급 · 경쟁 · 고객 · 간접") +
    '</div>' +
    '<div class="stats c3 mt12" role="group" aria-label="1인당 지표">' +
      tile("1인당 매출", revPer == null ? "—" : money(revPer), "매출 ÷ 임직원") +
      tile("1인당 영업이익", oiPer == null ? "—" : money(oiPer),
           oiPer == null ? "영업이익 미공개" : "영업이익 ÷ 임직원") +
      tile("1인당 순이익", niPer == null ? "—" : money(niPer),
           niPer == null ? "순이익 미공개" : "순이익 ÷ 임직원") +
    '</div>' +
    '<div class="note mt12"><span class="ic">📐</span><div>' + gapNote +
      (CO.peopleNote || "이 블록은 매출·영업이익·순이익·임직원 수에서 <b>계산한 값</b>입니다. 같은 숫자를 두 군데 적지 않으려고 파생시킵니다. " +
       "1인당 지표는 업종이 다르면 그대로 비교하면 안 됩니다 — 제조·물류 인력이 많은 회사는 구조적으로 낮게 나옵니다.") +
      ' <a href="/stocks/#people" style="border-bottom:1px solid var(--line)">다른 회사와 비교</a></div></div></div>';
}

/* ---------------------------- 페이지 렌더 ---------------------------- */
function navList() {
  // 종목 페이지는 registry.js 를 먼저 불러 같은 그룹의 동료를 내비에 띄웁니다.
  if (typeof REGISTRY !== "undefined" && typeof CO !== "undefined" && CO.group) {
    const peers = REGISTRY.filter((x) => x.group === CO.group);
    if (peers.length) return peers;
  }
  return M7;
}
function navHtml(cur) {
  return navList().map((c) => {
    const href = c.href || ((c.base || "/m7/") + c.slug + "/");
    const on = c.slug === cur ? ' aria-current="page"' : "";
    return '<a class="m7card" href="' + href + '"' + on + '><div class="tp"><span class="dot" style="background:' +
      c.c + '">' + c.ab + '</span><span><b>' + c.ko + "</b><small>" + c.tk + "</small></span></div>" +
      '<div class="mt">' + esc(c.hint) + "</div></a>";
  }).join("");
}

function statsHtml(list) {
  return list.map((s) =>
    '<div class="st"><div class="k">' + esc(s.k) + '</div><div class="v' + (s.tone ? " " + s.tone : "") + '">' +
    esc(s.v) + (s.u ? '<span class="u">' + esc(s.u) + "</span>" : "") + "</div>" +
    '<div class="s' + (s.stone ? " " + s.stone : "") + '">' + esc(s.s || "") + "</div></div>").join("");
}

function notesHtml(cards) {
  return cards.map((c) =>
    '<div class="card pad"><h3>' + esc(c.h) + "</h3>" +
    '<ul class="hint mt8" style="list-style:none;display:flex;flex-direction:column;gap:8px">' +
    c.items.map((t) => "<li>· " + t + "</li>").join("") + "</ul></div>").join("");
}

function lanesHtml(lanes) {
  return lanes.map((ln) =>
    '<div class="lane"><div class="lane-hd"><b>' + esc(ln.t) + "</b><span>" + esc(ln.d) + "</span></div>" +
    '<div class="flow"><div class="nodes">' +
    ln.nodes.map((n) =>
      '<div class="node' + (n.kr ? " kr" : "") + '"><div class="nh"><span class="nn">' + esc(n.n) +
      '</span><span class="cc">' + esc(n.c) + '</span></div><div class="nd">' + esc(n.d) + "</div></div>").join("") +
    '</div><div class="arrow" aria-hidden="true">→</div>' +
    '<div class="dest"><b>' + esc(ln.dest) + "</b><small>" + esc(CO.ko) + "</small></div></div></div>").join("");
}

function splitHtml(sp) {
  const total = sp.parts.reduce((a, p) => a + Math.abs(p.v), 0);
  return '<div class="splitbar" role="img" aria-label="' + esc(sp.title) + '">' +
    sp.parts.map((p) => {
      const share = Math.abs(p.v) / total;
      return '<div class="sg" style="flex:' + share + ';background:var(' + p.color + ')">' +
        (share > 0.12 ? esc(p.k) + "<br>" + Math.round(share * 100) + "%" : "") + "</div>";
    }).join("") + "</div>";
}

function sourcesHtml(rows) {
  return "<table class='narrow'><thead><tr><th>항목</th><th>기간</th><th>출처</th></tr></thead><tbody>" +
    rows.map((r) => "<tr><td class='tx'>" + esc(r.i) + "</td><td>" + esc(r.p) + "</td><td class='tx'>" +
      esc(r.s) + "</td></tr>").join("") + "</tbody></table>";
}

function mixTableHtml() {
  const m = CO.mix;
  return "<table class='narrow'><thead><tr><th>부문</th><th>매출(B$)</th><th>비중</th><th>전년 대비</th></tr></thead><tbody>" +
    m.rows.map((r) => "<tr><td class='tx'>" + esc(r.k) + "</td><td>" + r.v.toFixed(2) + "</td><td>" +
      ((r.v / m.total) * 100).toFixed(1) + "%</td><td class='" + cls(r.yoy) + "'>" + pctTxt(r.yoy) + "</td></tr>").join("") +
    "<tr class='tfoot'><td>합계</td><td>" + m.rows.reduce((a, r) => a + r.v, 0).toFixed(2) +
    "</td><td colspan='2'>회사 발표 총매출 " + m.total.toFixed(2) + "</td></tr></tbody></table>" +
    (m.tnote ? "<p class='hint mt8'>" + m.tnote + "</p>" : "");
}

function render() {
  document.title = CO.ko + " 지표 · 매출 구성과 한국 공급망 | M7";
  document.body.innerHTML =
'<header><div class="wrap hbar">' +
  '<a class="brand" href="' + (CO.hubHref || "/m7/") + '"><span class="mk">' + esc(CO.hubMark || "M7") + '</span><span><b>' + esc(CO.ko) + ' 지표</b>' +
  '<small>매출 구성 · 마진 · 한국 공급망</small></span></a>' +
  '<div class="hactions"><button class="ghost" id="themeBtn" type="button" aria-label="화면 테마 전환">' +
  '<span id="themeIco">◐</span><span id="themeTxt">테마</span></button></div>' +
'</div></header>' +

'<nav class="snav" aria-label="섹션 바로가기"><div class="wrap snav-in">' +
  '<a href="#top">개요 · 최근 분기</a>' + (CO.mix ? '<a href="#mix">' + esc(CO.mix.nav || "매출 구성") + '</a>' : '') +
  '<a href="#signature">' + esc(CO.signature.nav) + '</a>' +
  '<a href="#korea">한국 공급망</a><a href="#watch">체크포인트</a><a href="#sources">출처</a>' +
  '<a href="' + (CO.hubHref || "/m7/") + '">← ' + (CO.hubName || "M7 전체") + '</a>' +
'</div></nav>' +

'<main><section id="top" style="padding-top:24px"><div class="wrap">' +
  '<div class="co-hd"><span class="logo" style="background:' + CO.color + '">' + esc(CO.ab) + '</span>' +
  '<div><div class="tk">' + esc(CO.tk) + ' · ' + esc(CO.en) + '</div><h1>' + esc(CO.ko) + '</h1></div>' +
  '<span class="fybadge">' + esc(CO.fy.label) + '</span></div>' +
  '<h2 class="title mt16">' + CO.headline + '</h2><p class="lead">' + CO.lead + '</p>' +
  '<div class="stats c4 mt16" role="group" aria-label="핵심 지표">' + statsHtml(CO.stats) + '</div>' +
  (CO.fy.note ? '<div class="note mt12"><span class="ic">📅</span><div>' + CO.fy.note + '</div></div>' : '') +
  profileHtml() +
  peopleHtml() +
  (CO.recent ? '<div class="card pad mt16"><div class="rowsplit"><h3>' + esc(CO.recent.title) +
    '</h3><span class="fybadge">' + esc(CO.recent.period) + ' · 가장 최근 발표</span></div>' +
    '<div class="stats c4 mt12" role="group" aria-label="최근 분기 지표">' + statsHtml(CO.recent.stats) + '</div>' +
    '<div class="note mt12"><span class="ic">🆕</span><div>' + CO.recent.note + '</div></div></div>' : '') +
'</div></section>' +

(CO.mix ? '<section id="mix"><div class="wrap">' +
  '<p class="eyebrow">01 · Revenue mix</p><h2 class="title">' + CO.mix.title + '</h2>' +
  '<p class="lead">' + CO.mix.lead + '</p>' +
  '<div class="card pad mt16"><div class="chart-head"><div><div class="ct">' + esc(CO.mix.chartTitle) +
    '</div><div class="cs">' + esc(CO.mix.unit || "단위: 10억 달러 · 괄호는 전년 대비") + '</div></div>' +
    '<div class="seg" role="group" aria-label="보기 전환">' +
    '<button type="button" data-view="chart" aria-pressed="true">차트</button>' +
    '<button type="button" data-view="table" aria-pressed="false">표</button></div></div>' +
    '<div class="figwrap" id="wrapMix"><svg class="fig" id="figMix" role="img" aria-label="' +
      esc(CO.ko) + ' 부문별 매출 막대그래프"></svg><div class="tip" id="tipMix"></div></div>' +
    '<div class="tscroll mt12" id="tblMix" hidden>' + mixTableHtml() + '</div>' +
    '<div class="note mt12"><span class="ic">🔎</span><div>' + CO.mix.note + '</div></div>' +
  '</div>' +
'</div></section>' : '') +

'<section id="signature"><div class="wrap">' +
  '<p class="eyebrow">02 · ' + esc(CO.signature.eyebrow) + '</p>' +
  '<h2 class="title">' + CO.signature.title + '</h2><p class="lead">' + CO.signature.lead + '</p>' +
  '<div class="card pad mt16"><h3>' + esc(CO.signature.split.title) + '</h3>' +
    '<p class="hint mt8">' + CO.signature.split.sub + '</p>' + splitHtml(CO.signature.split) +
    '<div class="legend">' + CO.signature.split.parts.map((p) =>
      '<span class="lg"><span class="sw" style="background:var(' + p.color + ')"></span>' + esc(p.k) +
      ' ' + p.label + '</span>').join("") + '</div>' +
    '<div class="note mt16"><span class="ic">💡</span><div>' + CO.signature.split.note + '</div></div>' +
  '</div>' +
  (CO.signature.stats ? '<div class="stats c3 mt16" role="group" aria-label="보조 지표">' +
    statsHtml(CO.signature.stats) + '</div>' : '') +
'</div></section>' +

'<section id="korea"><div class="wrap">' +
  '<p class="eyebrow">03 · Korea</p><h2 class="title">' + CO.korea.title + '</h2>' +
  '<p class="lead">' + CO.korea.lead + '</p>' +
  (CO.korea.kind ? '<span class="fybadge mt12" style="margin-top:12px">한국 기업과의 관계 · ' + esc(CO.korea.kind) + '</span>' : '') +
  '<div class="krlegend mt12"><span class="sw"></span>표시된 곳이 한국 기업입니다</div>' +
  '<div class="mt16">' + lanesHtml(CO.korea.lanes) + '</div>' +
  '<div class="note mt12"><span class="ic">⚠️</span><div>공급 관계는 바뀌고, 비중이 공개되지 않는 경우도 많습니다. ' +
    '투자 판단 전에 각 사 공시로 확인하세요.</div></div>' +
'</div></section>' +

'<section id="watch"><div class="wrap">' +
  '<p class="eyebrow">04 · Checkpoints</p><h2 class="title">볼 때 조심할 것</h2>' +
  '<div class="grid2 mt16">' + notesHtml(CO.notes) + '</div>' +
'</div></section>' +

'<section id="sources" style="padding-bottom:10px"><div class="wrap">' +
  '<p class="eyebrow">05 · Sources</p><h2 class="title">데이터 출처</h2>' +
  '<div class="card pad mt16"><div class="tscroll">' + sourcesHtml(CO.sources) + '</div>' +
  '<div class="note mt12"><span class="ic">✅</span><div>' + CO.checksum + '</div></div>' +
  '<div class="note mt12"><span class="ic">🗓️</span><div>지표 기준일 <b>' + esc(CO.asOf) +
    '</b>. 수치는 페이지 소스의 <b>CO</b> 블록 한 곳에 모여 있습니다.</div></div></div>' +
'</div></section>' +

'<section style="padding-top:8px"><div class="wrap"><p class="eyebrow">M7</p>' +
  '<h2 class="title">' + esc(CO.peersTitle || "다른 회사") + '</h2><div class="m7nav mt16">' + navHtml(CO.slug) + '</div></div></section>' +
'</main>' +

'<footer><div class="wrap"><div class="fgrid">' +
  '<div><h4>이 페이지에 대해</h4><p>매그니피센트 7을 같은 틀로 정리한 지표 노트입니다. ' +
  '회사마다 회계연도와 부문 구분이 달라서, 비교할 때 기준을 맞추는 데 필요한 것들을 함께 적었습니다. ' +
  '외부 라이브러리 없이 돌아갑니다.</p></div>' +
  '<div><h4>같이 만든 것</h4><ul>' +
  '<li><a href="/m7/">M7 전체 비교</a></li>' +
  '<li><a href="/tesla-metrics/">테슬라 지표</a></li>' +
  '<li><a href="/china-ev/">중국 전기차 주식 노트</a></li>' +
  '<li><a href="/">Cadence · 업무 자동화 스튜디오</a></li></ul></div>' +
'</div><p class="disc">이 페이지는 투자 권유가 아닙니다. 실적과 공급 관계는 바뀌고 오류가 있을 수 있으니 ' +
  '투자 전에 각 사 공시를 확인하세요. 판단과 책임은 이용자 본인에게 있습니다.</p></div></footer>';

  CUR = CO.cur || "$";
  initTheme();
  drawAll();
  document.querySelectorAll(".seg button").forEach((b) => {
    b.addEventListener("click", () => {
      const view = b.dataset.view;
      b.parentElement.querySelectorAll("button").forEach((x) =>
        x.setAttribute("aria-pressed", String(x.dataset.view === view)));
      $("wrapMix").hidden = view === "table";
      $("tblMix").hidden = view !== "table";
      if (view === "chart") drawAll();
    });
  });
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawAll, 140); });
}

if (typeof CO !== "undefined") render();
