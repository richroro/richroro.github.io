/* 공모주 캘린더 — data/ipo.json 하나를 읽어 일정·달력·계산기·내 기록을 그립니다.
   날짜는 전부 한국 시간 기준 'YYYY-MM-DD' 문자열로 다룹니다(문자열 비교 = 날짜 비교). */
"use strict";

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("ko-KR");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 사생활 보호 모드 */ } },
};
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
};

/** 다른 스크립트(extra.js)에 알리는 작은 이벤트 버스 */
const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
const CMP = new Set(); // 비교에 담은 종목 id (최대 3)

/* ---------------------------------------------------------------- 날짜 */
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
let TODAY = kstToday();
const toD = (s) => new Date(s + "T00:00:00Z");
const fromD = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return fromD(d); };
const diffDays = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dow = (s) => DOW[toD(s).getUTCDay()];
const md = (s) => (s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}` : "–");
const mdw = (s) => (s ? `${md(s)}(${dow(s)})` : "–");
const weekStart = (s) => addDays(s, -((toD(s).getUTCDay() + 6) % 7)); // 월요일

/* ---------------------------------------------------------------- 숫자 */
const won = (v) => (v == null || !isFinite(v) ? "–" : nf.format(Math.round(v)));
const pct = (v, d = 1) => (v == null || !isFinite(v) ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);
const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
const comp = (v) => (v == null ? "–" : `${nf.format(v >= 100 ? Math.round(v) : +v.toFixed(2))}:1`);
const eok = (v) => (v == null ? "–" : v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}조` : `${nf.format(Math.round(v))}억`);
const MARKET = { KOSPI: "코스피", KOSDAQ: "코스닥", KONEX: "코넥스" };

/* ---------------------------------------------------------------- 데이터 */
let DATA = { items: [] };
let ITEMS = [];
const BY_ID = new Map();

async function load() {
  const res = await fetch("/ipo/data/ipo.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  DATA = await res.json();
  ITEMS = (DATA.items || []).map((it) => ({ ...it, uw: it.uw || [] }));
  for (const it of ITEMS) BY_ID.set(it.id, it);
}

/** 확정가가 없으면 밴드 상단으로 계산하고, 그 사실을 표시합니다. */
const offerPrice = (it) => it.price || it.band_hi || null;

/** 지금 어느 단계인지. key: fc 수요예측 · pre 청약 예정 · sub 청약 중 · wait 상장 예정 · listed 상장 · past 지난 일정 */
function stage(it, t = TODAY) {
  if (it.sub_start && t < it.sub_start) {
    if (it.fc_start && t >= it.fc_start && t <= (it.fc_end || it.fc_start)) return { key: "fc", label: "수요예측 중", d: diffDays(t, it.sub_start) };
    return { key: "pre", label: `청약 D-${diffDays(t, it.sub_start)}`, d: diffDays(t, it.sub_start) };
  }
  if (it.sub_start && t <= (it.sub_end || it.sub_start)) {
    return { key: "sub", label: t === (it.sub_end || it.sub_start) ? "오늘 청약 마감" : "청약 중", d: 0 };
  }
  if (!it.sub_start && it.fc_start && t <= (it.fc_end || it.fc_start)) return { key: "fc", label: t >= it.fc_start ? "수요예측 중" : `수요예측 D-${diffDays(t, it.fc_start)}`, d: diffDays(t, it.fc_start) };
  if (it.list_date && t < it.list_date) return { key: "wait", label: `상장 D-${diffDays(t, it.list_date)}`, d: diffDays(t, it.list_date) };
  if (it.list_date) return { key: "listed", label: t === it.list_date ? "오늘 상장" : "상장", d: diffDays(it.list_date, t) };
  if (it.sub_end && diffDays(it.sub_end, t) <= 21) return { key: "wait", label: "상장일 미정", d: 99 };
  return { key: "past", label: "지난 일정", d: 999 };
}

/** 상장 뒤 수익률 — 시초가·첫날 종가·현재가를 공모가 대비로 */
function perf(it) {
  const p = it.price;
  if (!p) return {};
  const r = (x) => (x ? (x / p - 1) * 100 : null);
  return { open: r(it.open), close1: r(it.close1), cur: r(it.cur) };
}

/* ---------------------------------------------------------------- 점수 */
const SC = window.IPOScore;
let OVER = store.get("ipo.over", {}); // 종목별 직접 입력 {id: {inst, lock, float, size, old}}
const scoreCache = new Map();
const asOfDate = (it) => it.sub_start || it.fc_start || it.list_date;
const tempAt = (it) => SC.temperature(ITEMS, asOfDate(it));
function scoreOf(it) {
  if (!scoreCache.has(it.id)) scoreCache.set(it.id, SC.score(it, OVER[it.id], { temp: tempAt }));
  return scoreCache.get(it.id);
}
function setOver(id, key, val) {
  const o = { ...(OVER[id] || {}) };
  if (val === "" || val == null) delete o[key]; else o[key] = +val;
  if (Object.keys(o).length) OVER[id] = o; else delete OVER[id];
  store.set("ipo.over", OVER);
  scoreCache.delete(id);
  PAST = null;
}

function verdictChip(r, big = false) {
  const k = r.verdict.key;
  const n = r.total != null && !r.pending && k !== "spac" ? `<b class="num">${r.total}</b>` : "";
  return `<span class="vd v-${k}${big ? " big" : ""}" title="${esc(r.verdict.tip)}">${esc(r.verdict.label)}${n}</span>`;
}

/** 점수 고리. 판정 색으로 채우고 가운데에 점수. 판단 보류·스팩이면 빈 고리. */
function ring(r, size = 116) {
  const k = r.verdict.key, show = r.total != null && !r.pending && k !== "spac";
  const R = 44, C = 2 * Math.PI * R, v = show ? Math.max(0, Math.min(100, r.total)) : 0;
  return `<svg class="ring v-${k}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="점수 ${show ? r.total : "없음"}, 판정 ${esc(r.verdict.label)}">
    <circle cx="50" cy="50" r="${R}" class="track"/>
    <circle cx="50" cy="50" r="${R}" class="bar" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="${show ? 52 : 55}" class="big">${show ? r.total : k === "spac" ? "SPAC" : "?"}</text>
    ${show ? `<text x="50" y="68" class="sm">/ 100</text>` : ""}</svg>`;
}

/* ---------------------------------------------------------------- 관심 종목 */
const stars = new Set(store.get("ipo.stars", []));
function toggleStar(id) {
  if (stars.has(id)) stars.delete(id); else stars.add(id);
  store.set("ipo.stars", [...stars]);
  document.querySelectorAll(`.star[data-id="${CSS.escape(id)}"]`).forEach((b) => b.setAttribute("aria-pressed", stars.has(id)));
  $("icsStars").hidden = !stars.size;
  if (listState.v === "star") renderList();
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------------------------------------------------------------- 요약 · 신선도 */
function renderFresh() {
  const up = DATA.updated;
  const bits = [];
  if (up) bits.push(`<span>갱신 <b>${esc(up.slice(0, 10))} ${esc(up.slice(11, 16))}</b> KST</span>`);
  else bits.push(`<span>아직 수집된 데이터가 없습니다</span>`);
  bits.push(`<span>종목 <b>${nf.format(ITEMS.length)}</b></span>`);
  bits.push(`<span>출처 <b>${esc(DATA.source || "38커뮤니케이션")}</b></span>`);
  $("fresh").innerHTML = bits.join("");
  const banner = $("stale");
  if (!up) {
    banner.innerHTML = "<b>데이터 준비 중</b> — 청약 일정은 매일 자동으로 모읍니다. 첫 수집 전이라 목록이 비어 있지만, 계산기·내 청약 기록·가이드는 지금 쓸 수 있습니다.";
    banner.hidden = false;
  } else {
    const age = diffDays(up.slice(0, 10), TODAY);
    const notes = (DATA.notes || []).filter(Boolean);
    if (age > 3 || notes.length) {
      banner.innerHTML = [age > 3 ? `데이터가 <b>${age}일</b> 전 것입니다. 최신 일정은 증권사에서 확인하세요.` : "", ...notes.map(esc)].filter(Boolean).join(" · ");
      banner.hidden = false;
    }
  }
}

function renderSummary() {
  const ws = weekStart(TODAY), we = addDays(ws, 6);
  const live = ITEMS.filter((it) => !it.spac);
  const subNow = live.filter((it) => stage(it).key === "sub");
  const thisWeek = live.filter((it) => it.sub_start && it.sub_start <= we && (it.sub_end || it.sub_start) >= ws);
  const soon = live.filter((it) => it.list_date && it.list_date >= TODAY && it.list_date <= addDays(TODAY, 14));
  const temp = SC.temperature(ITEMS, addDays(TODAY, 1));
  const names = (xs) => xs.slice(0, 3).map((x) => esc(x.name)).join(", ") + (xs.length > 3 ? ` 외 ${xs.length - 3}` : "");
  const tl = temp == null ? "표본 부족" : temp >= 100 ? "뜨거움" : temp >= 50 ? "따뜻함" : temp >= 20 ? "보통" : temp >= 0 ? "미지근" : "차가움";
  $("summary").innerHTML = `
    <div class="st link" data-go="now"><div class="k">지금 청약 중</div><div class="v">${subNow.length}<span class="u">곳</span></div>
      <div class="s">${subNow.length ? names(subNow) : "없음"}</div></div>
    <div class="st link" data-go="now"><div class="k">이번 주 청약 (${md(ws)}~${md(we)})</div><div class="v">${thisWeek.length}<span class="u">곳</span></div>
      <div class="s">${thisWeek.length ? names(thisWeek) : "없음"}</div></div>
    <div class="st link" data-go="wait"><div class="k">2주 안 상장</div><div class="v">${soon.length}<span class="u">곳</span></div>
      <div class="s">${soon.length ? names(soon) : "없음"}</div></div>
    <div class="st link" data-href="#market"><div class="k">시장 온도 · 90일 평균 시초가</div>
      <div class="v ${cls(temp)}">${temp == null ? "–" : pct(temp, 0)}</div><div class="s">${tl}</div></div>`;
  $("summary").querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => {
    setTab(el.dataset.go); $("schedule").scrollIntoView({ behavior: "smooth" });
  }));
  $("summary").querySelector("[data-href]").addEventListener("click", () => $("market").scrollIntoView({ behavior: "smooth" }));
}

/* ---------------------------------------------------------------- 오늘 할 일 */
function nextBizDay(s) { let d = addDays(s, 1); while ([0, 6].includes(toD(d).getUTCDay())) d = addDays(d, 1); return d; }

function dayEvents(d) {
  const ev = [];
  for (const it of ITEMS) {
    if (it.spac && listState.hideSpac) continue;
    if (it.sub_start === d && it.sub_end !== d) ev.push({ it, k: "sub", t: "청약 시작", w: "10:00~16:00" });
    if ((it.sub_end || it.sub_start) === d && it.sub_start) ev.push({ it, k: "sub", t: "청약 마감", w: "16:00까지", hot: true });
    if (it.refund === d) ev.push({ it, k: "refund", t: "환불·배정 확인", w: "증거금 돌아옴" });
    if (it.list_date === d) ev.push({ it, k: "list", t: "상장", w: "09:00 시초가" });
    if (it.fc_end === d && !it.price) ev.push({ it, k: "fc", t: "수요예측 마감", w: "곧 공모가 확정" });
  }
  return ev;
}

function renderToday() {
  const box = $("today");
  if (!ITEMS.length) { box.innerHTML = ""; return; }
  const nb = nextBizDay(TODAY);
  const a = dayEvents(TODAY), b = dayEvents(nb);
  const row = (e) => `<li data-id="${esc(e.it.id)}" class="${e.hot ? "hot" : ""}"><span class="k ${e.k}">${e.t}</span><b>${esc(e.it.name)}</b><small>${e.w}</small></li>`;
  let html = `<div class="tday"><h4>오늘 ${mdw(TODAY)}</h4>${a.length ? `<ul>${a.map(row).join("")}</ul>` : `<p class="hint">오늘은 공모주 일정이 없습니다.</p>`}</div>`;
  html += `<div class="tday"><h4>${diffDays(TODAY, nb) === 1 ? "내일" : "다음 영업일"} ${mdw(nb)}</h4>${b.length ? `<ul>${b.map(row).join("")}</ul>` : `<p class="hint">일정 없음</p>`}</div>`;
  box.innerHTML = html;
  box.onclick = (e) => { const li = e.target.closest("li[data-id]"); if (li) openDetail(li.dataset.id); };
}

/* ---------------------------------------------------------------- 이번 주 주목 */
function pickFeature() {
  const live = ITEMS.filter((it) => !it.spac);
  const act = live.filter((it) => ["sub", "pre", "fc"].includes(stage(it).key));
  const scored = act.filter((it) => !scoreOf(it).pending).sort((x, y) => scoreOf(y).total - scoreOf(x).total);
  if (scored.length) return { it: scored[0], why: "청약 중·예정 종목 중 점수 1위" };
  if (act.length) return { it: act.sort((x, y) => (asOfDate(x) || "").localeCompare(asOfDate(y) || ""))[0], why: "가장 가까운 청약" };
  const wait = live.filter((it) => stage(it).key === "wait").sort((x, y) => (x.list_date || "9").localeCompare(y.list_date || "9"));
  if (wait.length) return { it: wait[0], why: "다음 상장" };
  const listed = live.filter((it) => it.list_date && it.list_date <= TODAY).sort((x, y) => y.list_date.localeCompare(x.list_date));
  return listed.length ? { it: listed[0], why: "가장 최근 상장" } : null;
}

function renderFeature() {
  const box = $("feature");
  const f = pickFeature();
  if (!f) {
    box.innerHTML = `<div class="feat empty-feat"><p class="eyebrow">This week</p><h3>공모주 점수카드</h3>
      <p class="hint mt8">데이터가 모이면 이번 주 가장 점수가 높은 공모주가 여기에 뜹니다. 그동안 아래 <a class="ul" href="#method">분석법</a>과
      <a class="ul" href="#guide">공모주린이 가이드</a>를 먼저 둘러보세요.</p></div>`;
    return;
  }
  const it = f.it, r = scoreOf(it), s = stage(it), p = perf(it);
  const m = (k, v) => `<div><i>${k}</i><b>${v}</b></div>`;
  box.innerHTML = `<article class="feat" data-id="${esc(it.id)}">
    <div class="feat-top"><span class="eyebrow">${esc(f.why)}</span><span class="stat ${s.key}"><span class="dot"></span>${esc(s.label)}</span></div>
    <div class="feat-main">${ring(r)}
      <div class="feat-nm"><h3>${esc(it.name)}</h3>${verdictChip(r, true)}
        <p class="hint mt8">${esc(r.verdict.tip)}</p></div></div>
    <div class="kv kv4 mt12">
      ${m("기관경쟁률", comp(it.inst_comp))}${m("확약", it.lockup != null ? `${it.lockup.toFixed(1)}%` : "–")}
      ${m("유통물량", it.float_pct != null ? `${it.float_pct.toFixed(1)}%` : "–")}
      ${s.key === "listed" ? m("시초가", `<span class="${cls(p.open)}">${pct(p.open, 0)}</span>`) : m(it.price ? "확정가" : "밴드 상단", won(offerPrice(it)))}
    </div>
    ${hintLine(it).replace('class="exp', 'class="exp mt12')}
    <div class="when num mt12">${it.sub_start ? `<span><i>청약</i>${mdw(it.sub_start)}~${mdw(it.sub_end || it.sub_start)}</span>` : ""}<span><i>상장</i>${it.list_date ? mdw(it.list_date) : "미정"}</span></div>
    <div class="btnrow mt12"><button class="ghost primary sm" type="button" data-act="open">채점표 보기</button>
      <button class="ghost sm" type="button" data-act="calc">계산기로</button></div>
  </article>`;
  box.querySelector("[data-act=open]").onclick = () => openDetail(it.id);
  box.querySelector("[data-act=calc]").onclick = () => { fillCalc(it); $("calc").scrollIntoView({ behavior: "smooth" }); };
}

/* ---------------------------------------------------------------- 일정 카드 */
const listState = { v: store.get("ipo.tab", "now"), q: "", hideSpac: store.get("ipo.hideSpac", true), sort: store.get("ipo.sort", "date") };

function setTab(v) {
  listState.v = v; listState.more = false; store.set("ipo.tab", v);
  $("tabs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
  renderList();
}

function filtered() {
  const q = listState.q.trim().toLowerCase().replace(/\s+/g, "");
  let xs = ITEMS.filter((it) => {
    if (listState.hideSpac && it.spac && listState.v !== "star") return false;
    if (q && !(it.name.toLowerCase().replace(/\s+/g, "").includes(q) || it.uw.some((u) => u.toLowerCase().includes(q)))) return false;
    const k = stage(it).key;
    switch (listState.v) {
      case "now": return k === "sub" || k === "pre" || k === "fc";
      case "wait": return k === "wait";
      case "listed": return k === "listed" && diffDays(it.list_date, TODAY) <= 120;
      case "star": return stars.has(it.id);
      default: return true;
    }
  });
  const order = { sub: 0, fc: 1, pre: 1, wait: 2, listed: 3, past: 4 };
  const key = (it) => it.sub_start || it.fc_start || it.list_date || "";
  const sc = (it) => { const r = scoreOf(it); return r.pending || r.total == null || it.spac ? -1 : r.total; };
  if (listState.sort === "score") xs.sort((a, b) => sc(b) - sc(a) || key(a).localeCompare(key(b)));
  else if (listState.v === "listed") xs.sort((a, b) => (b.list_date || "").localeCompare(a.list_date || ""));
  else if (listState.v === "all") xs.sort((a, b) => key(b).localeCompare(key(a)));
  else xs.sort((a, b) => order[stage(a).key] - order[stage(b).key] || key(a).localeCompare(key(b)));
  return xs;
}

function priceCell(it) {
  if (it.price) {
    const vs = it.band_hi ? (it.price / it.band_hi - 1) * 100 : null;
    return `<b>${won(it.price)}${vs != null && Math.abs(vs) >= 0.5 ? ` <small class="${cls(vs)}">${pct(vs, 0)}</small>` : ""}</b>`;
  }
  if (it.band_lo) return `<b>${it.band_lo === it.band_hi ? won(it.band_lo) : `${won(it.band_lo)}~`}<small>${it.band_lo === it.band_hi ? "" : "밴드"}</small></b>`;
  return "<b>–</b>";
}

function card(it) {
  const s = stage(it), p = perf(it), r = scoreOf(it);
  const tags = [it.market ? `<span class="tag">${MARKET[it.market] || esc(it.market)}</span>` : "",
    it.sector ? `<span class="tag">${esc(it.sector)}</span>` : ""].join("");
  const when = [];
  if (it.fc_start && (s.key === "fc" || s.key === "pre")) when.push(`<span><i>수요예측</i>${md(it.fc_start)}${it.fc_end && it.fc_end !== it.fc_start ? `~${md(it.fc_end)}` : ""}</span>`);
  if (it.sub_start) when.push(`<span><i>청약</i>${mdw(it.sub_start)}${it.sub_end && it.sub_end !== it.sub_start ? `~${mdw(it.sub_end)}` : ""}</span>`);
  if (it.refund && s.key !== "listed") when.push(`<span><i>환불</i>${mdw(it.refund)}</span>`);
  when.push(`<span><i>상장</i>${it.list_date ? mdw(it.list_date) : "미정"}</span>`);
  let kv;
  if (s.key === "listed") {
    kv = `<div><i>공모가</i>${priceCell(it)}</div>
      <div><i>시초가</i><b class="${cls(p.open)}">${pct(p.open, 0)}</b></div>
      <div><i>${it.cur ? "현재가" : "첫날 종가"}</i><b class="${cls(it.cur ? p.cur : p.close1)}">${pct(it.cur ? p.cur : p.close1, 0)}</b></div>`;
  } else {
    kv = `<div><i>${it.price ? "확정 공모가" : "희망 공모가"}</i>${priceCell(it)}</div>
      <div><i>기관경쟁률</i><b>${comp(it.inst_comp)}</b></div>
      <div><i>${it.sub_comp ? "청약경쟁률" : "확약 비율"}</i><b>${it.sub_comp ? comp(it.sub_comp) : it.lockup != null ? `${it.lockup.toFixed(1)}%` : "–"}</b></div>`;
  }
  // 점수 막대: 아는 항목만, 항목별 득점 비율로 칸을 채웁니다
  const bars = r.rows.map((x) => `<i class="${x.pts == null ? "na" : ""}" title="${esc(x.f.label)} ${x.pts == null ? "모름" : `${x.pts}/${x.f.w}`}"><em style="width:${x.pts == null ? 0 : Math.round(x.pts / x.f.w * 100)}%"></em></i>`).join("");
  return `<article class="ipo ${s.key}" data-id="${esc(it.id)}" tabindex="0" aria-label="${esc(it.name)} 상세 보기">
    <div class="top">
      <button class="star" type="button" data-id="${esc(it.id)}" aria-pressed="${stars.has(it.id)}" aria-label="관심 종목">★</button>
      <div class="nm"><b>${esc(it.name)}</b><small>${tags}</small></div>
      <span class="stat ${s.key}"><span class="dot"></span>${esc(s.label)}</span>
      <button class="cmp" type="button" data-id="${esc(it.id)}" aria-pressed="${CMP.has(it.id)}" aria-label="비교에 담기" title="비교에 담기">⇄</button>
    </div>
    <div class="vrow">${verdictChip(r)}${it.spac ? "" : `<span class="bars" aria-hidden="true">${bars}</span>`}${r.flags.length ? `<span class="flag" title="${esc(r.flags.join(" · "))}">⚠ ${r.flags.length}</span>` : ""}</div>
    <div class="when num">${when.join("")}</div>
    <div class="kv">${kv}</div>
    ${hintLine(it)}
    ${it.uw.length ? `<div class="uw">${it.uw.map((u) => `<span>${esc(u)}</span>`).join("")}</div>` : ""}
  </article>`;
}

function renderList() {
  const xs = filtered();
  const box = $("list");
  if (!ITEMS.length) {
    box.innerHTML = `<p class="empty">아직 수집된 일정이 없습니다. 자동 갱신이 한 번 돌면 여기에 채워집니다.</p>`;
    $("listNote").textContent = "";
    return;
  }
  const emptyMsg = { now: "지금 청약 중이거나 예정된 공모주가 없습니다.", wait: "상장을 기다리는 종목이 없습니다.",
    listed: "최근 4개월 안에 상장한 종목이 없습니다.", star: "관심 종목이 없습니다. 카드의 ★ 를 눌러 담으세요.", all: "조건에 맞는 종목이 없습니다." };
  // 휴대폰에서는 6장까지 먼저 보여 줘 페이지가 끝없이 길어지지 않게
  const cut = !listState.more && matchMedia("(max-width:719px)").matches && xs.length > 7 ? 6 : xs.length;
  box.innerHTML = xs.length ? xs.slice(0, cut).map(card).join("") + (cut < xs.length ? `<button type="button" class="ghost more" id="listMore">${xs.length - cut}곳 더 보기</button>` : "")
    : `<p class="empty">${listState.q ? "검색 결과가 없습니다." : emptyMsg[listState.v]}</p>`;
  if (cut < xs.length) $("listMore").onclick = () => { listState.more = true; renderList(); };
  const hidden = listState.hideSpac ? ITEMS.filter((it) => it.spac).length : 0;
  $("listNote").textContent = `${xs.length}곳${hidden && listState.v !== "star" ? ` · 스팩 ${hidden}곳 숨김` : ""} · 점수 옆 막대는 7개 기준별 득점(회색은 모르는 값) · 확정 공모가 옆 %는 희망 밴드 상단 대비`;
}

function initList() {
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setTab(b.dataset.v); });
  $("sortSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === listState.sort));
  $("sortSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    listState.sort = b.dataset.v; store.set("ipo.sort", listState.sort);
    $("sortSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderList();
  });
  $("q").addEventListener("input", (e) => { listState.q = e.target.value; renderList(); });
  $("hideSpac").checked = listState.hideSpac;
  $("hideSpac").addEventListener("change", (e) => { listState.hideSpac = e.target.checked; store.set("ipo.hideSpac", listState.hideSpac); renderList(); renderCal(); renderToday(); });
  $("icsStars").hidden = !stars.size;
  $("icsStars").onclick = () => downloadIcs(ITEMS.filter((it) => stars.has(it.id)), "공모주-관심종목.ics");
  const open = (e) => {
    const star = e.target.closest(".star");
    if (star) { e.stopPropagation(); toggleStar(star.dataset.id); return; }
    const cmp = e.target.closest(".cmp");
    if (cmp) { e.stopPropagation(); emit("ipo:cmp", cmp.dataset.id); return; }
    const c = e.target.closest(".ipo");
    if (c) openDetail(c.dataset.id);
  };
  $("list").addEventListener("click", open);
  $("list").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("ipo")) { e.preventDefault(); openDetail(e.target.dataset.id); } });
  // 첫 화면에 청약 중·예정이 하나도 없으면 상장 예정 → 최근 상장 순으로 보여 줍니다
  if (listState.v === "now" && ITEMS.length) {
    const has = (v) => { const old = listState.v; listState.v = v; const n = filtered().length; listState.v = old; return n > 0; };
    if (!has("now")) listState.v = has("wait") ? "wait" : "listed";
  }
  setTab(listState.v);
}

/* ---------------------------------------------------------------- 상세 */
function timeline(it) {
  const steps = [["수요예측", it.fc_start, it.fc_end], ["청약", it.sub_start, it.sub_end], ["환불", it.refund, it.refund], ["상장", it.list_date, it.list_date]];
  return `<div class="tl">${steps.map(([k, a, b]) => {
    const st = !a ? "" : TODAY > (b || a) ? "done" : TODAY >= a ? "now" : "";
    const txt = !a ? "미정" : b && b !== a ? `${md(a)}~${md(b)}` : mdw(a);
    return `<div class="s ${st}"><i>${k}</i><b>${txt}</b></div>`;
  }).join("")}</div>`;
}

function fmtVal(row, it) {
  if (row.v == null) return "–";
  if (row.f.fmt) return row.f.fmt(row.v, it);
  if (row.f.unit === ":1") return comp(row.v);
  if (row.f.unit === "억") return eok(row.v);
  return `${(+row.v).toFixed(1)}${row.f.unit}`;
}

const AUTO_KEYS = new Set(["inst", "lock", "pos", "size"]);
const MANUAL_WHY = { float: "38에 없는 값 · 투자설명서 '유통가능 주식수'", old: "38에 없는 값 · 투자설명서 '공모 방법'" };
/** 수요예측이 끝나고 사흘이 지났는데도 결과가 없으면 자동 수집이 놓친 것 — 그때만 직접 입력을 연다 */
const forecastLate = (it) => !!it.fc_end && diffDays(it.fc_end, TODAY) > 3;
function autoWhen(it) {
  if (it.fc_start && TODAY < it.fc_start) return `수요예측 ${md(it.fc_start)}${it.fc_end && it.fc_end !== it.fc_start ? `~${md(it.fc_end)}` : ""} 뒤 발표`;
  if (it.fc_start) return "수요예측 결과 발표 대기 · 하루 세 번 확인";
  return "수요예측 결과가 나오면 · 하루 세 번 확인";
}

function scorecard(it) {
  const r = scoreOf(it);
  const known = r.rows.filter((x) => x.pts != null).length;
  const rows = r.rows.map((x) => {
    const pctW = x.pts == null ? 0 : Math.round(x.pts / x.f.w * 100);
    // 수요예측 결과(기관경쟁률·확약·확정가·공모금액)는 자동 수집을 기다리고, 38 에 없는 값(유통물량·구주매출)만 직접 입력
    const auto = AUTO_KEYS.has(x.f.key) && x.v == null && !x.manual && !forecastLate(it);
    const input = !auto && x.f.input && (x.v == null || x.manual)
      ? `<input class="ovr" type="number" inputmode="decimal" step="any" data-k="${x.f.key}" value="${x.manual ? x.v : ""}" placeholder="직접 입력" aria-label="${esc(x.f.label)} 직접 입력 (${x.f.unit})"><span class="u">${x.f.unit}</span>` : "";
    const cell = auto ? `<span class="auto">자동으로 채워짐</span><small>${esc(autoWhen(it))}</small>`
      : input || `<span class="num">${esc(fmtVal(x, it))}</span>`;
    return `<tr class="${x.pts == null ? "na" : ""}"><td class="tx"><b>${esc(x.f.label)}</b><small>${esc(x.f.crit)}</small></td>
      <td class="val">${cell}${x.manual ? `<small class="hint">직접 입력</small>` : ""}${x.note ? `<small>${esc(x.note)}</small>` : ""}${!auto && !x.manual && x.v == null && MANUAL_WHY[x.f.key] ? `<small>${MANUAL_WHY[x.f.key]}</small>` : ""}</td>
      <td class="pts"><span class="pbar"><em style="width:${pctW}%"></em></span><span class="num">${x.pts == null ? "–" : x.pts}<small>/${x.f.w}</small></span></td></tr>`;
  }).join("");
  return `<div class="sc">
    <div class="sc-head">${ring(r, 96)}<div>${verdictChip(r, true)}<p class="hint mt8">${esc(r.pending ? `${r.verdict.tip} — ${autoWhen(it)}` : r.verdict.tip)}</p>
      <p class="hint">7개 기준 중 <b>${known}개</b>로 계산${known < 7 ? " — 빈칸을 채우면 더 정확해집니다" : ""}</p></div></div>
    ${(() => { const h = hintLine(it), u = uwRecord(it); return h || u ? `<div class="sc-past mt12">${h}${u && !h.includes("주관사") ? `<div class="exp mut">주관사 <b>${esc(u.name)}</b> 1년 시초가 평균 <b class="${cls(u.avg)}">${pct(u.avg, 0)}</b><small>${u.n}곳 · 따블 이상 ${u.dbl.toFixed(0)}%</small></div>` : ""}</div>` : ""; })()}
    ${r.flags.length ? `<ul class="sig flags mt12">${r.flags.map((f) => `<li class="weak">${esc(f)}</li>`).join("")}</ul>` : ""}
    <div class="tscroll mt12"><table class="narrow sc-t"><thead><tr><th>기준</th><th>값</th><th>점수</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint mt8">유통가능물량·구주매출은 DART 증권신고서(투자설명서)의 '유통가능 주식수'·'공모 방법' 표에 나옵니다. 입력값은 이 브라우저에만 저장됩니다.</p>
  </div>`;
}

/** 증권사 고르기: 증권사별 일반 청약 물량과 청약 건수로 균등 예상 주수 */
function brokerPicker(it) {
  if (!it.uw.length) return "";
  const alloc = new Map((it.uw_alloc || []).map(([k, v]) => [k.replace(/\s+/g, ""), v]));
  const saved = store.get("ipo.brk", {})[it.id] || {};
  const rows = it.uw.map((u, i) => {
    const a = alloc.get(u.replace(/\s+/g, ""));
    const gen = saved[u]?.gen ?? (a ? Math.round(a * 0.25) : "");
    return `<tr data-u="${esc(u)}"><td class="tx"><b>${esc(u)}</b>${a ? `<small>인수 ${nf.format(a)}주</small>` : ""}</td>
      <td><input class="bk" data-f="gen" type="number" inputmode="numeric" value="${gen}" placeholder="일반 물량" aria-label="${esc(u)} 일반 청약 물량"></td>
      <td><input class="bk" data-f="app" type="number" inputmode="numeric" value="${saved[u]?.app ?? ""}" placeholder="청약 건수" aria-label="${esc(u)} 청약 건수"></td>
      <td class="eq num" data-i="${i}">–</td></tr>`;
  }).join("");
  return `<div class="bp"><h3 class="hint">증권사 고르기 — 균등 1인당 예상 주수</h3>
    <div class="tscroll mt8"><table class="narrow bp-t"><thead><tr><th>증권사</th><th>일반 물량(주)</th><th>청약 건수</th><th>균등 예상</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint mt8">청약 마지막 날 오후, 증권사 앱이나 공시에 뜨는 <b>청약 건수</b>를 넣으면 균등 물량(일반 물량의 절반) ÷ 건수로 계산합니다.
      숫자가 큰 곳이 유리합니다. 일반 물량 기본값은 인수 물량의 25%로 잡았으니, 투자설명서의 증권사별 일반 청약 물량으로 고치면 더 정확합니다.</p></div>`;
}
function updateBroker(it, root) {
  const all = store.get("ipo.brk", {});
  const mine = {};
  let best = null;
  root.querySelectorAll(".bp-t tbody tr").forEach((tr) => {
    const u = tr.dataset.u;
    const gen = parseFloat(tr.querySelector('[data-f=gen]').value), app = parseFloat(tr.querySelector('[data-f=app]').value);
    mine[u] = { gen: isFinite(gen) ? gen : null, app: isFinite(app) ? app : null };
    const eq = SC.equalShares(gen, app);
    tr.querySelector(".eq").textContent = eq == null ? "–" : `${eq >= 10 ? Math.round(eq) : eq.toFixed(2)}주`;
    tr.classList.remove("best");
    if (eq != null && (!best || eq > best.eq)) best = { tr, eq };
  });
  if (best && root.querySelectorAll(".bp-t .eq").length > 1) best.tr.classList.add("best");
  all[it.id] = mine; store.set("ipo.brk", all);
}

function lockupSchedule(it) {
  if (!it.list_date) return "";
  const addM = (s, m) => { const d = toD(s); d.setUTCMonth(d.getUTCMonth() + m); return fromD(d); };
  const xs = [["15일", addDays(it.list_date, 15)], ["1개월", addM(it.list_date, 1)], ["3개월", addM(it.list_date, 3)], ["6개월", addM(it.list_date, 6)]];
  return `<div><h3 class="hint">확약 해제 일정 — 이날 전후로 기관 매도 물량이 나올 수 있습니다</h3>
    <div class="tl lk mt8">${xs.map(([k, d]) => `<div class="s ${TODAY > d ? "done" : ""}"><i>${k} 확약</i><b>${mdw(d)}</b></div>`).join("")}</div></div>`;
}

function openDetail(id) {
  const it = BY_ID.get(id);
  if (!it) return;
  const s = stage(it), p = perf(it);
  const st = (k, v, sub = "", c = "") => `<div class="st"><div class="k">${k}</div><div class="v ${c}">${v}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
  const band = it.band_lo ? (it.band_lo === it.band_hi ? won(it.band_lo) : `${won(it.band_lo)}~${won(it.band_hi)}`) : "–";
  const q = encodeURIComponent(it.name);
  const mcap = it.post_shares && offerPrice(it) ? it.post_shares * offerPrice(it) / 1e8 : null;
  const links = [
    it.no ? `<a class="ghost sm" href="https://www.38.co.kr/html/fund/?o=v&no=${encodeURIComponent(it.no)}&l=&page=1" target="_blank" rel="noopener">38 상세</a>` : "",
    `<a class="ghost sm" href="https://dart.fss.or.kr/dsab007/main.do?option=corp&textCrpNm=${q}" target="_blank" rel="noopener">DART 투자설명서</a>`,
    `<a class="ghost sm" href="https://search.naver.com/search.naver?where=blog&query=${q}%20%EA%B3%B5%EB%AA%A8%EC%A3%BC" target="_blank" rel="noopener">블로그 분석 검색</a>`,
    `<a class="ghost sm" href="https://search.naver.com/search.naver?where=news&query=${q}%20%EA%B3%B5%EB%AA%A8%EC%A3%BC" target="_blank" rel="noopener">뉴스</a>`,
    it.code && s.key === "listed" ? `<a class="ghost sm" href="/finder/#s=${encodeURIComponent(it.code)}">종목 분석</a>` : "",
  ].join("");
  $("dBody").innerHTML = `
    <div class="dlg-top">
      <button class="star" type="button" data-id="${esc(it.id)}" aria-pressed="${stars.has(it.id)}" aria-label="관심 종목">★</button>
      <div class="ttl"><b id="dTitle">${esc(it.name)}</b><small>
        <span class="stat ${s.key}"><span class="dot"></span>${esc(s.label)}</span>
        ${it.market ? `<span class="tag">${MARKET[it.market] || esc(it.market)}</span>` : ""}
        ${it.spac ? `<span class="tag spac">스팩</span>` : ""}
        ${it.code ? `<span class="tag num">${esc(it.code)}</span>` : ""}
        ${it.sector ? `<span class="tag">${esc(it.sector)}</span>` : ""}</small></div>
      <button class="ghost" type="button" id="dClose" aria-label="닫기">✕</button>
    </div>
    <div class="dlg-body">
      ${timeline(it)}
      <div id="dScore">${scorecard(it)}</div>
      <div class="stats c3">
        ${st("희망 공모가", band, "원")}
        ${st("확정 공모가", won(it.price), it.price && it.band_hi ? `밴드 상단 대비 ${pct((it.price / it.band_hi - 1) * 100, 0)}` : "원")}
        ${st("공모 금액", eok(it.amount), it.shares ? `${nf.format(it.shares)}주` : "")}
        ${st("공모가 기준 시가총액", eok(mcap), it.post_shares ? `상장 후 ${nf.format(it.post_shares)}주` : "")}
        ${st("청약경쟁률", comp(it.sub_comp), it.sub_comp ? `비례 1주 ≈ ${nf.format(Math.round(it.sub_comp * 2))}주 청약` : "일반 청약 통합")}
        ${st("수요예측", it.fc_start ? `${md(it.fc_start)}${it.fc_end && it.fc_end !== it.fc_start ? `~${md(it.fc_end)}` : ""}` : "–", "기관 대상")}
        ${it.list_date && TODAY >= it.list_date ? `
          ${st("시초가", won(it.open), pct(p.open, 1), cls(p.open))}
          ${st("첫날 종가", won(it.close1), pct(p.close1, 1), cls(p.close1))}
          ${st("현재가", won(it.cur), pct(p.cur, 1), cls(p.cur))}` : ""}
      </div>
      ${["sub", "pre", "fc"].includes(s.key) ? brokerPicker(it) : it.uw.length ? `<div><h3 class="hint">주간사</h3><div class="uw mt8">${it.uw.map((u) => `<span>${esc(u)}</span>`).join("")}</div></div>` : ""}
      ${lockupSchedule(it)}
      <div class="btnrow">
        <button class="ghost primary sm" type="button" data-act="calc">계산기로</button>
        <button class="ghost sm" type="button" data-act="ics">달력에 추가 (.ics)</button>
        <button class="ghost sm" type="button" data-act="rec">기록 추가</button>
        <button class="ghost sm" type="button" data-act="share">링크 복사</button>
        <button class="ghost sm" type="button" data-act="card">공유 카드 이미지</button>
        <button class="ghost sm" type="button" data-act="cmp">${CMP.has(it.id) ? "비교에서 빼기" : "비교에 담기"}</button>
      </div>
      <div class="btnrow">${links}</div>
      <p class="hint">점수와 판정은 참고용입니다. 일정과 숫자는 늦거나 바뀔 수 있으니 청약 전 증권사 공지와 투자설명서를 확인하세요.</p>
    </div>`;
  const dlg = $("dlg"), body = $("dBody");
  $("dClose").onclick = () => dlg.close();
  body.querySelector(".star").onclick = (e) => toggleStar(e.currentTarget.dataset.id);
  // 직접 입력 → 점수만 다시 그리고, 목록·주목 카드도 갱신
  body.onchange = (e) => {
    if (e.target.classList.contains("ovr")) {
      setOver(it.id, e.target.dataset.k, e.target.value.trim());
      // 입력칸이 포커스를 잃는 중에 칸을 갈아 끼우면 브라우저가 change 를 한 번 더 쏜다 — 한 박자 늦춰 한 번만 그립니다
      clearTimeout(openDetail.t);
      openDetail.t = setTimeout(() => {
        const next = document.activeElement?.dataset?.k;
        $("dScore").innerHTML = scorecard(it);
        if (next) $("dScore").querySelector(`input[data-k="${next}"]`)?.focus();
        renderList(); renderFeature();
        toast("점수를 다시 계산했습니다");
      }, 0);
    }
  };
  body.oninput = (e) => { if (e.target.classList.contains("bk")) updateBroker(it, body); };
  if (body.querySelector(".bp-t")) updateBroker(it, body);
  body.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
    const act = b.dataset.act;
    if (act === "calc") { dlg.close(); fillCalc(it); $("calc").scrollIntoView({ behavior: "smooth" }); }
    else if (act === "ics") downloadIcs([it], `${it.name}-공모주.ics`);
    else if (act === "rec") { dlg.close(); fillRecord(it); $("my").scrollIntoView({ behavior: "smooth" }); }
    else if (act === "card") emit("ipo:sharecard", it.id);
    else if (act === "cmp") { emit("ipo:cmp", it.id); b.textContent = CMP.has(it.id) ? "비교에서 빼기" : "비교에 담기"; }
    else if (act === "share") {
      const url = `${location.origin}/ipo/#i=${encodeURIComponent(it.id)}`;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("링크를 복사했습니다"), () => prompt("링크", url));
    }
  }));
  if (!dlg.open) dlg.showModal();
  body.scrollTop = 0; dlg.scrollTop = 0;
  history.replaceState(null, "", `#i=${encodeURIComponent(it.id)}`);
}

function initDetail() {
  const dlg = $("dlg");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => { if (location.hash.startsWith("#i=")) history.replaceState(null, "", location.pathname + location.search); });
  const m = location.hash.match(/^#i=(.+)$/);
  if (m) openDetail(decodeURIComponent(m[1]));
}

/* ---------------------------------------------------------------- 시장 온도 */
/* ---------------------------------------------------------------- 과거 성적(주관사·판정·매도 시점) */
/** '유진증권'·'유진투자증권'처럼 같은 증권사를 다르게 적은 것을 하나로 묶는 열쇠 */
const uwKey = (u) => u.replace(/\s+/g, "").replace(/(금융)?투자증권$|증권$|투자$/, "");
let PAST = null; // 날짜가 바뀌면 다시 계산
function past() {
  if (PAST) return PAST;
  const xs = listedSample(365);
  const ret = (it) => (it.open / it.price - 1) * 100;
  const uw = new Map();
  for (const it of xs) for (const u of it.uw) {
    const k = uwKey(u), o = uw.get(k) || { name: u, rs: [] };
    if (u.length > o.name.length) o.name = u;
    o.rs.push(ret(it)); uw.set(k, o);
  }
  const vd = new Map();
  for (const it of xs) { const k = scoreOf(it).verdict.key; if (!vd.has(k)) vd.set(k, []); vd.get(k).push(ret(it)); }
  PAST = { xs, uw, vd };
  return PAST;
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** 대표 주관사(첫 번째)의 1년 성적. 표본이 2곳 미만이면 공동 주관사 중 표본이 많은 쪽 */
function uwRecord(it) {
  const cands = it.uw.map((u) => past().uw.get(uwKey(u))).filter(Boolean);
  const o = cands.find((c) => c.rs.length >= 2) || cands[0];
  return o ? { name: o.name, n: o.rs.length, avg: mean(o.rs), med: median(o.rs), dbl: o.rs.filter((r) => r >= 100).length / o.rs.length * 100 } : null;
}
/** 같은 판정을 받은 지난 종목들의 시초가 중앙값으로 본 '균등 1주 기대 수익'. 표본 5곳 미만이면 없음 */
function expectOf(it) {
  const r = scoreOf(it), s = stage(it).key;
  if (r.pending || it.spac || s === "listed" || s === "past" || !offerPrice(it)) return null;
  const rs = past().vd.get(r.verdict.key) || [];
  if (rs.length < 5) return null;
  const med = median(rs);
  return { med, n: rs.length, won: offerPrice(it) * med / 100, label: r.verdict.label };
}
function hintLine(it) {
  const e = expectOf(it);
  if (e) return `<div class="exp">균등 1주 기대 <b class="${cls(e.won)}">${e.won >= 0 ? "+" : "−"}${won(Math.abs(e.won))}원</b><small>지난 1년 '${esc(e.label)}' ${e.n}곳 시초가 중앙값 ${pct(e.med, 0)}</small></div>`;
  const s = stage(it).key;
  if (it.spac || !["pre", "fc", "sub"].includes(s)) return "";
  const u = uwRecord(it);
  if (!u) return "";
  return `<div class="exp mut">주관사 <b>${esc(u.name)}</b> 1년 시초가 평균 <b class="${cls(u.avg)}">${pct(u.avg, 0)}</b><small>${u.n}곳${u.n < 3 ? " · 표본 적음" : ""}</small></div>`;
}

function renderPastBlocks() {
  const { xs, uw } = past();
  // 언제 팔았으면?
  const r = (k) => xs.filter((it) => it[k]).map((it) => (it[k] / it.price - 1) * 100);
  const paths = [["시초가에 팔았으면", r("open")], ["첫날 종가에 팔았으면", r("close1")], ["지금까지 들고 있었으면", r("cur")]];
  const both = xs.filter((it) => it.close1), held = xs.filter((it) => it.cur);
  const avgs = paths.map(([, a]) => mean(a));
  const mx = Math.max(1, ...avgs.filter((v) => v != null).map(Math.abs));
  const best = avgs.indexOf(Math.max(...avgs.filter((v) => v != null)));
  $("sellBox").innerHTML = xs.length < 5 ? `<p class="empty">상장 기록이 쌓이면 계산합니다.</p>` : `
    <div class="sellrows">${paths.map(([k, a], i) => `<div class="sellrow ${i === best ? "best" : ""}"><span class="k">${k}</span>
      <span class="bar"><em class="${avgs[i] < 0 ? "neg" : ""}" style="width:${avgs[i] == null ? 0 : Math.round(Math.abs(avgs[i]) / mx * 100)}%"></em></span>
      <b class="num ${cls(avgs[i])}">${pct(avgs[i], 0)}</b><small class="num">중앙값 ${pct(median(a), 0)}</small></div>`).join("")}</div>
    <p class="lead mt12">지난 1년 스팩 뺀 ${xs.length}곳 기준, <b>${paths[best][0].replace("팔았으면", "파는 쪽").replace("들고 있었으면", "보유하는 쪽")}</b>이 평균적으로 가장 나았습니다.
      첫날 종가가 시초가보다 높았던 곳은 <b>${both.length ? Math.round(both.filter((it) => it.close1 > it.open).length / both.length * 100) : 0}%</b>,
      지금 가격이 시초가보다 높은 곳은 <b>${held.length ? Math.round(held.filter((it) => it.cur > it.open).length / held.length * 100) : 0}%</b>입니다.</p>
    <p class="hint">'지금까지'는 종목마다 상장 뒤 지난 기간이 다릅니다. 평균이 그렇다는 것이고, 종목마다 다를 수 있습니다.</p>`;
  // 주관사 성적표
  const up = ITEMS.filter((it) => !it.spac && ["pre", "fc", "sub"].includes(stage(it).key));
  const rows = [...uw.entries()].filter(([, o]) => o.rs.length >= 2).sort((a, b) => b[1].rs.length - a[1].rs.length || mean(b[1].rs) - mean(a[1].rs));
  const mxu = Math.max(1, ...rows.map(([, o]) => Math.abs(mean(o.rs))));
  $("uwTable").innerHTML = rows.length ? `<thead><tr><th>주관사</th><th>상장</th><th>평균 시초가</th><th></th><th>중앙값</th><th>따블 이상</th><th>공모가 아래</th><th>청약 예정</th></tr></thead><tbody>${rows.map(([k, o]) => {
    const a = mean(o.rs), nxt = up.filter((it) => it.uw.some((u) => uwKey(u) === k));
    return `<tr><td class="tx"><b>${esc(o.name)}</b></td><td>${o.rs.length}</td><td class="${cls(a)}">${pct(a, 0)}</td>
      <td class="barcell"><span class="btbar ${a < 0 ? "neg" : ""}" style="width:${Math.round(Math.abs(a) / mxu * 100)}%"></span></td>
      <td class="${cls(median(o.rs))}">${pct(median(o.rs), 0)}</td><td>${Math.round(o.rs.filter((x) => x >= 100).length / o.rs.length * 100)}%</td>
      <td>${Math.round(o.rs.filter((x) => x < 0).length / o.rs.length * 100)}%</td>
      <td class="tx">${nxt.length ? nxt.slice(0, 3).map((it) => `<button type="button" class="linkish" data-open="${esc(it.id)}">${esc(it.name)}</button>`).join(", ") + (nxt.length > 3 ? ` 외 ${nxt.length - 3}` : "") : "–"}</td></tr>`;
  }).join("")}</tbody>` : `<tbody><tr><td class="empty">상장 기록이 쌓이면 계산합니다.</td></tr></tbody>`;
  $("uwTable").onclick = (e) => { const b = e.target.closest("[data-open]"); if (b) openDetail(b.dataset.open); };
}

function listedSample(days = 365) {
  const from = addDays(TODAY, -days);
  return ITEMS.filter((it) => !it.spac && it.list_date && it.list_date <= TODAY && it.list_date >= from && it.price && it.open)
    .sort((a, b) => a.list_date.localeCompare(b.list_date));
}

function renderMarket() {
  const all = listedSample(365);
  const r90 = all.filter((it) => it.list_date >= addDays(TODAY, -90));
  const ret = (it) => (it.open / it.price - 1) * 100;
  const avg = (xs, f) => (xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : null);
  const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length * 100 : null);
  const inst = r90.filter((x) => x.inst_comp != null);
  $("tempStats").innerHTML = `
    <div class="st"><div class="k">90일 평균 시초가</div><div class="v ${cls(avg(r90, ret))}">${pct(avg(r90, ret), 0)}</div><div class="s">${r90.length}곳 · 공모가 대비</div></div>
    <div class="st"><div class="k">따블(+100%) 이상 시작</div><div class="v">${share(r90, (x) => ret(x) >= 100) == null ? "–" : `${share(r90, (x) => ret(x) >= 100).toFixed(0)}%`}</div><div class="s">90일 상장 중</div></div>
    <div class="st"><div class="k">공모가 아래로 시작</div><div class="v ${share(r90, (x) => ret(x) < 0) ? "down" : ""}">${share(r90, (x) => ret(x) < 0) == null ? "–" : `${share(r90, (x) => ret(x) < 0).toFixed(0)}%`}</div><div class="s">90일 상장 중</div></div>
    <div class="st"><div class="k">평균 기관경쟁률</div><div class="v">${comp(avg(inst, (x) => x.inst_comp))}</div><div class="s">90일 상장 ${inst.length}곳</div></div>`;
  drawTempChart(all.slice(-30));
  renderBacktest(all);
  renderPastBlocks();
}

function drawTempChart(xs) {
  const box = $("tempFig");
  if (xs.length < 2) { box.innerHTML = `<p class="empty">상장 기록이 쌓이면 여기에 그립니다.</p>`; return; }
  const W = 720, H = 240, L = 44, Rm = 10, T = 14, B = 26;
  const vals = xs.map((it) => (it.open / it.price - 1) * 100);
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const stepv = [10, 20, 25, 50, 100, 200].find((s) => (hi - lo) / s <= 5) || 100;
  lo = Math.floor(lo / stepv) * stepv; hi = Math.ceil(hi / stepv) * stepv || stepv;
  const y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
  const bw = (W - L - Rm) / xs.length, gap = Math.min(4, bw * 0.3);
  let g = "";
  for (let v = lo; v <= hi + 1e-9; v += stepv) g += `<line class="${v === 0 ? "zero" : "gridline"}" x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v > 0 ? "+" : ""}${v}%</text>`;
  const iMax = vals.indexOf(Math.max(...vals)), iMin = vals.indexOf(Math.min(...vals));
  const bars = xs.map((it, i) => {
    const v = vals[i], x0 = L + i * bw + gap / 2, w = Math.max(1, bw - gap), y0 = y(0), y1 = y(v);
    const h = Math.abs(y1 - y0), r = Math.min(4, w / 2, h);
    const up = v >= 0;
    // 기준선 쪽은 각지고 끝만 둥글게
    const d = up
      ? `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + w - r}Q${x0 + w},${y1} ${x0 + w},${y1 + r}V${y0}Z`
      : `M${x0},${y0}V${y1 - r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + w - r}Q${x0 + w},${y1} ${x0 + w},${y1 - r}V${y0}Z`;
    const lab = (i === iMax || i === iMin) && Math.abs(v) > 0.5
      ? `<text class="dlabel ${up ? "up" : "down"}" x="${x0 + w / 2}" y="${up ? y1 - 5 : y1 + 12}" text-anchor="middle">${pct(v, 0)}</text>` : "";
    return `<path d="${d}" fill="var(${up ? "--fill-up" : "--fill-down"})"/>${lab}
      <rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}"/>`;
  }).join("");
  const xl = `<text class="axis" x="${L}" y="${H - 8}">${md(xs[0].list_date)}</text><text class="axis" x="${W - Rm}" y="${H - 8}" text-anchor="end">${md(xs[xs.length - 1].list_date)}</text>`;
  box.innerHTML = `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 ${xs.length}개 상장 종목의 시초가 수익률 막대그래프">${g}${bars}${xl}</svg><div class="tip" id="tempTip"></div>
    <details class="mt8"><summary class="hint">표로 보기</summary><div class="tscroll"><table class="narrow"><thead><tr><th>종목</th><th>상장일</th><th>공모가</th><th>시초가</th><th>수익률</th></tr></thead><tbody>
    ${xs.slice().reverse().map((it) => `<tr><td class="tx">${esc(it.name)}</td><td>${md(it.list_date)}</td><td>${won(it.price)}</td><td>${won(it.open)}</td><td class="${cls(it.open - it.price)}">${pct((it.open / it.price - 1) * 100, 1)}</td></tr>`).join("")}
    </tbody></table></div></details>`;
  const tip = $("tempTip"), svg = box.querySelector("svg");
  const show = (el) => {
    const it = xs[+el.dataset.i], v = vals[+el.dataset.i], r = scoreOf(it);
    const bb = el.getBoundingClientRect(), wb = box.getBoundingClientRect();
    tip.innerHTML = `<div class="th">${esc(it.name)} · ${mdw(it.list_date)}</div>
      <div class="tr"><span class="nm">시초가</span><b class="${cls(v)}">${pct(v, 1)}</b></div>
      <div class="tr"><span class="nm">공모가 → 시초가</span><b>${won(it.price)} → ${won(it.open)}</b></div>
      <div class="tr"><span class="nm">당시 판정</span><b>${esc(r.verdict.label)}${r.total != null && !r.pending ? ` ${r.total}` : ""}</b></div>`;
    tip.style.left = `${Math.min(Math.max(bb.left - wb.left + bb.width / 2, 90), wb.width - 90)}px`;
    tip.style.top = `${Math.max(y(Math.max(0, v)) / H * svg.getBoundingClientRect().height - 8, 60)}px`;
    tip.classList.add("on");
  };
  svg.addEventListener("pointermove", (e) => { const h = e.target.closest(".hit"); if (h) show(h); else tip.classList.remove("on"); });
  svg.addEventListener("pointerleave", () => tip.classList.remove("on"));
  svg.addEventListener("click", (e) => { const h = e.target.closest(".hit"); if (h) openDetail(xs[+h.dataset.i].id); });
}

function renderBacktest(all) {
  const groups = [...SC.VERDICTS.map((v) => ({ key: v.key, label: v.label })), { key: "wait", label: "판단 보류(숫자 부족)" }];
  const by = new Map(groups.map((g) => [g.key, []]));
  for (const it of all) { const k = scoreOf(it).verdict.key; if (by.has(k)) by.get(k).push((it.open / it.price - 1) * 100); }
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const rows = groups.map((g) => ({ ...g, xs: by.get(g.key) })).filter((g) => g.xs.length || g.key !== "wait");
  const mx = Math.max(1, ...rows.map((g) => Math.abs(g.xs.length ? g.xs.reduce((a, b) => a + b, 0) / g.xs.length : 0)));
  $("backtest").innerHTML = `<thead><tr><th>판정</th><th>종목 수</th><th>평균 시초가</th><th></th><th>중앙값</th><th>공모가 아래</th><th>따블 이상</th></tr></thead><tbody>${rows.map((g) => {
    const n = g.xs.length, a = n ? g.xs.reduce((x, y) => x + y, 0) / n : null;
    return `<tr><td class="tx"><span class="vd v-${g.key}">${esc(g.label)}</span></td><td>${n}</td><td class="${cls(a)}">${pct(a, 0)}</td>
      <td class="barcell"><span class="btbar ${a < 0 ? "neg" : ""}" style="width:${a == null ? 0 : Math.round(Math.abs(a) / mx * 100)}%"></span></td>
      <td class="${cls(med(g.xs))}">${pct(med(g.xs), 0)}</td>
      <td>${n ? `${(g.xs.filter((x) => x < 0).length / n * 100).toFixed(0)}%` : "–"}</td><td>${n ? `${(g.xs.filter((x) => x >= 100).length / n * 100).toFixed(0)}%` : "–"}</td></tr>`;
  }).join("")}</tbody>`;
}

/* ---------------------------------------------------------------- 분석법 · 용어 */
function renderMethod() {
  $("methodTable").innerHTML = `<thead><tr><th>기준</th><th>배점</th><th>점수 구간</th><th>왜 보나</th></tr></thead><tbody>${SC.FACTORS.map((f) =>
    `<tr><td class="tx"><b>${esc(f.label)}</b></td><td>${f.w}</td><td class="tx">${esc(f.crit)}</td><td class="tx why">${esc(WHY[f.key])}</td></tr>`).join("")}</tbody>`;
  $("verdictBox").innerHTML = SC.VERDICTS.map((v) => `<div class="vcard"><span class="vd v-${v.key} big">${esc(v.label)}</span>
    <b class="num">${v.min < 0 ? "42점 미만" : `${v.min}점 이상`}</b><p>${esc(v.tip)}</p></div>`).join("");
}
const WHY = {
  inst: "기관이 수요예측에서 얼마나 몰렸는지. 전문가들의 사전 평가라 가장 먼저 보는 숫자입니다.",
  lock: "상장 뒤 일정 기간 팔지 않겠다고 약속한 기관 물량 비율. 높을수록 첫날 쏟아지는 물량이 적습니다.",
  pos: "희망 밴드 상단을 넘겨 확정됐다면 기관이 더 비싸게라도 사겠다고 한 것입니다.",
  float: "상장일 바로 팔 수 있는 주식의 비율. 공급이 적을수록 가격이 오르기 쉽습니다(30% 미만을 좋게 봅니다).",
  size: "공모 금액이 작을수록 적은 매수세로도 가격이 움직입니다. 대형 공모는 첫날 수익률이 낮은 경향.",
  old: "구주매출은 기존 주주가 파는 물량. 비중이 크면 회사가 아니라 주주가 돈을 가져갑니다.",
  temp: "최근 상장 종목들의 첫날 성적. 시장 분위기가 좋을 때는 평범한 종목도 잘 오릅니다.",
};
const GLOSS = [
  ["수요예측", "청약 전에 기관투자자들이 원하는 가격과 수량을 써 내는 절차. 이 결과로 공모가가 정해집니다."],
  ["희망 공모가(밴드)", "회사가 제시한 공모가 범위. 예: 18,000~21,000원."],
  ["확정 공모가", "수요예측 뒤 최종으로 정해진 1주 가격. 청약은 이 가격으로 합니다."],
  ["기관경쟁률", "수요예측에 들어온 주문 수량 ÷ 기관 배정 물량. 1,000:1 이상이면 흥행."],
  ["의무보유확약", "기관이 상장 뒤 15일~6개월 동안 팔지 않겠다는 약속. 비율이 높을수록 좋게 봅니다."],
  ["유통가능물량", "상장일에 바로 팔 수 있는 주식의 비율. 낮을수록 좋게 봅니다."],
  ["구주매출", "새로 찍는 주식(신주)이 아니라 기존 주주가 가진 주식을 파는 것."],
  ["주간사(주관사)", "공모를 맡은 증권사. 이 증권사 계좌로만 청약할 수 있습니다."],
  ["균등 배정", "최소 주수 이상 청약한 모두에게 똑같이 나누는 방식. 소액 투자자에게 유리."],
  ["비례 배정", "넣은 증거금에 비례해 나누는 방식. 큰돈이 필요합니다."],
  ["증거금", "청약할 때 미리 넣는 돈. 보통 청약 금액의 50%."],
  ["환불일", "배정받지 못한 증거금이 돌아오는 날. 배정 결과도 이날 확인합니다."],
  ["시초가", "상장 첫날 오전 9시에 정해지는 첫 가격. 공모가의 60%~400% 사이."],
  ["따블 · 따따블", "상장일에 공모가의 2배(따블), 4배(따따블)까지 오르는 것을 부르는 말."],
  ["오버행", "언제든 시장에 나올 수 있는 대기 매도 물량. 확약 해제일에 커집니다."],
  ["스팩(SPAC)", "다른 회사와 합병하려고 만든 서류상 회사. 공모가가 보통 2,000원."],
  ["청약 수수료", "배정받으면 증권사에 내는 수수료. 보통 1,500~2,000원, 등급에 따라 면제."],
  ["기술특례 상장", "적자여도 기술력을 인정받아 상장하는 방식. 실적 확인이 더 중요합니다."],
];
function renderGloss() {
  $("gloss").innerHTML = GLOSS.map(([k, v]) => `<div><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join("");
}

/* ---------------------------------------------------------------- .ics 내보내기 */
function icsEvents(it) {
  const ev = [];
  const day = (s) => s.replace(/-/g, "");
  const price = offerPrice(it) ? ` · 공모가 ${won(offerPrice(it))}원${it.price ? "" : "(밴드 상단)"}` : "";
  const uw = it.uw.length ? ` · 주간사 ${it.uw.join(", ")}` : "";
  const r = scoreOf(it);
  const verdict = r.pending || it.spac ? "" : ` · 판정 ${r.verdict.label} ${r.total}점`;
  // alarm: 그날 0시부터의 시간 — 종일 일정은 기기 시간대의 자정 기준이라 한국에서 쓰면 그대로 맞습니다
  if (it.sub_start) ev.push({ uid: `sub-${it.id}`, s: it.sub_start, e: addDays(it.sub_end || it.sub_start, 1), t: `[청약] ${it.name}`,
    d: `청약 ${it.sub_start}~${it.sub_end || it.sub_start} (10:00~16:00)${uw}${price}${verdict}`, alarm: ["PT9H30M", "청약 시작 30분 전"] });
  if (it.sub_end && it.sub_end !== it.sub_start) ev.push({ uid: `subend-${it.id}`, s: it.sub_end, e: addDays(it.sub_end, 1), t: `[청약 마감] ${it.name} 16시까지`,
    d: `오늘 16시 청약 마감${uw} — 증권사별 청약 건수를 보고 고르세요`, alarm: ["PT13H", "마감 3시간 전"] });
  if (it.refund) ev.push({ uid: `refund-${it.id}`, s: it.refund, e: addDays(it.refund, 1), t: `[환불] ${it.name}`, d: "증거금 환불 · 배정 결과 확인" });
  if (it.list_date) ev.push({ uid: `list-${it.id}`, s: it.list_date, e: addDays(it.list_date, 1), t: `[상장] ${it.name}`,
    d: `09:00 시초가${it.price ? ` · 공모가 ${won(it.price)}원` : ""} · 매도 전략을 미리 정해 두세요`, alarm: ["PT8H20M", "장전 주문 10분 전"] });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const txt = (s) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  return ev.map((e) => ["BEGIN:VEVENT", `UID:${e.uid}@richroro.github.io`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(e.s)}`,
    `DTEND;VALUE=DATE:${day(e.e)}`, `SUMMARY:${txt(e.t)}`, `DESCRIPTION:${txt(e.d)}`,
    ...(e.alarm ? ["BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER;RELATED=START:${e.alarm[0]}`, `DESCRIPTION:${txt(`${e.t} · ${e.alarm[1]}`)}`, "END:VALARM"] : []),
    "END:VEVENT"].join("\r\n"));
}
function downloadIcs(items, filename) {
  const body = items.flatMap(icsEvents);
  if (!body.length) { toast("달력에 넣을 날짜가 아직 없습니다"); return; }
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//richroro//ipo//KO", "CALSCALE:GREGORIAN", ...body, "END:VCALENDAR"].join("\r\n");
  download(new Blob([ics], { type: "text/calendar;charset=utf-8" }), filename);
}
function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------------------------------------------------------- 달력 */
const calState = { ym: TODAY.slice(0, 7), sel: TODAY };

function eventsByDay() {
  const map = new Map();
  const add = (d, e) => { if (!map.has(d)) map.set(d, []); map.get(d).push(e); };
  for (const it of ITEMS) {
    if (listState.hideSpac && it.spac) continue;
    if (it.sub_start) {
      for (let d = it.sub_start, n = 0; d <= (it.sub_end || it.sub_start) && n < 10; d = addDays(d, 1), n++) {
        const w = toD(d).getUTCDay();
        if (w !== 0 && w !== 6) add(d, { k: "sub", it, last: d === (it.sub_end || it.sub_start) });
      }
    }
    if (it.refund) add(it.refund, { k: "refund", it });
    if (it.list_date) add(it.list_date, { k: "list", it });
  }
  return map;
}

function renderCal() {
  const [y, m] = calState.ym.split("-").map(Number);
  $("calTitle").textContent = `${y}.${String(m).padStart(2, "0")}`;
  const first = `${calState.ym}-01`;
  const start = addDays(first, -toD(first).getUTCDay()); // 일요일부터
  const ev = eventsByDay();
  const order = { list: 0, sub: 1, refund: 2 };
  let html = DOW.map((d, i) => `<div class="dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${d}</div>`).join("");
  const lastOfMonth = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
  const weeks = Math.ceil((diffDays(start, lastOfMonth) + 1) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const w = i % 7;
    const es = (ev.get(d) || []).sort((a, b) => order[a.k] - order[b.k]);
    const shown = es.slice(0, 3).map((e) => `<span class="ev ${e.k}" title="${esc(e.it.name)}">${esc(e.it.name)}</span>`).join("");
    const more = es.length > 3 ? `<span class="ev more">+${es.length - 3}</span>` : "";
    html += `<button type="button" class="d ${d.slice(0, 7) !== calState.ym ? "out" : ""} ${d === TODAY ? "today" : ""} ${d === calState.sel ? "sel" : ""} ${w === 0 ? "sun" : w === 6 ? "sat" : ""}"
      data-d="${d}" aria-label="${md(d)} 일정 ${es.length}건"><span class="n">${+d.slice(8)}</span>${shown}${more}</button>`;
  }
  $("cal").innerHTML = html;
  renderAgenda(ev);
}

function renderAgenda(ev = eventsByDay()) {
  const d = calState.sel;
  const es = ev.get(d) || [];
  const K = { sub: "청약", refund: "환불", list: "상장" };
  $("agenda").innerHTML = `<h4>${mdw(d)} ${d === TODAY ? "· 오늘" : ""}</h4>` + (es.length
    ? `<ul>${es.map((e) => `<li data-id="${esc(e.it.id)}"><span class="k ${e.k}">${K[e.k]}</span>${esc(e.it.name)}
        <small>${e.k === "sub" ? (e.last ? "마감일" : "청약 중") + (offerPrice(e.it) ? ` · ${won(offerPrice(e.it))}원` : "") : e.k === "list" && e.it.price ? `공모가 ${won(e.it.price)}원` : ""}</small></li>`).join("")}</ul>`
    : `<p class="hint mt8">이날 일정이 없습니다.</p>`);
}

function initCal() {
  const shift = (n) => {
    const [y, m] = calState.ym.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    calState.ym = fromD(t).slice(0, 7);
    renderCal();
  };
  $("calPrev").onclick = () => shift(-1);
  $("calNext").onclick = () => shift(1);
  $("calToday").onclick = () => { calState.ym = TODAY.slice(0, 7); calState.sel = TODAY; renderCal(); };
  $("cal").addEventListener("click", (e) => {
    const b = e.target.closest(".d"); if (!b) return;
    calState.sel = b.dataset.d;
    if (b.dataset.d.slice(0, 7) !== calState.ym) calState.ym = b.dataset.d.slice(0, 7);
    renderCal();
  });
  $("agenda").addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) openDetail(li.dataset.id); });
  renderCal();
}

/* ---------------------------------------------------------------- 계산기 */
const CALC_DEFAULT = { price: 20000, qty: 10, margin: 50, fee: 2000, eq: 1, comp: "", sell: 0.2, min: 10 };
const CALC_IDS = { price: "cPrice", qty: "cQty", margin: "cMargin", fee: "cFee", eq: "cEq", comp: "cComp", sell: "cSell", min: "cMin" };
let calcFor = null;

const numOf = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };

function calc() {
  const price = numOf("cPrice") || 0, qty = numOf("cQty") || 0;
  const margin = (numOf("cMargin") ?? 50) / 100, fee = numOf("cFee") || 0;
  const eq = Math.max(0, numOf("cEq") ?? 0), c = numOf("cComp"), sellRate = (numOf("cSell") || 0) / 100;
  const min = numOf("cMin") || 1;
  const deposit = price * qty * margin;
  const eligible = qty >= min;
  const eqShares = eligible ? eq : 0;
  const propShares = c && c > 0 ? qty / (c * 2) : 0;
  const alloc = Math.min(qty, eqShares + Math.floor(propShares));
  const cost = price * alloc;
  const refund = Math.max(0, deposit - cost);
  const lack = Math.max(0, cost - deposit);
  store.set("ipo.calc", Object.fromEntries(Object.entries(CALC_IDS).map(([k, id]) => [k, $(id).value])));

  $("calcOut").innerHTML = `
    <div class="st"><div class="k">필요 증거금</div><div class="v">${won(deposit)}<span class="u">원</span></div>
      <div class="s">${won(price)}원 × ${nf.format(qty)}주 × ${Math.round(margin * 100)}%</div></div>
    <div class="st"><div class="k">예상 배정</div><div class="v">${nf.format(alloc)}<span class="u">주</span></div>
      <div class="s">${eligible ? `균등 ${eqShares} + 비례 ${c ? propShares.toFixed(2) : "–"}` : `최소 ${nf.format(min)}주 미만 — 균등 제외`}</div></div>
    <div class="st"><div class="k">배정 금액</div><div class="v">${won(cost)}<span class="u">원</span></div>
      <div class="s">${lack > 0 ? `<span class="up">증거금보다 ${won(lack)}원 많음 — 추가 납입</span>` : `환불 예상 ${won(refund)}원`}</div></div>
    <div class="st"><div class="k">청약 수수료</div><div class="v">${won(alloc > 0 ? fee : 0)}<span class="u">원</span></div>
      <div class="s">${alloc > 0 ? "배정받을 때 냄(증권사마다 다름)" : "배정 0주면 대개 면제"}</div></div>`;

  const rows = [-40, -20, 0, 30, 60, 100, 160, 200, 300];
  const body = rows.map((r) => {
    const sp = Math.round(price * (1 + r / 100));
    const gross = (sp - price) * alloc;
    const sellCost = Math.round(sp * alloc * sellRate);
    const net = gross - (alloc > 0 ? fee : 0) - sellCost;
    const onDep = deposit > 0 ? (net / deposit) * 100 : null;
    const tag = r === -40 ? "하한" : r === 0 ? "공모가" : r === 100 ? "따블" : r === 300 ? "상한(따따블)" : "";
    return `<tr><td class="tx">${pct(r, 0)} ${tag ? `<small class="hint">${tag}</small>` : ""}</td><td>${won(sp)}</td>
      <td class="${cls(net)}">${net > 0 ? "+" : ""}${won(net)}</td><td class="${cls(onDep)}">${onDep == null ? "–" : pct(onDep, 1)}</td></tr>`;
  }).join("");
  $("calcTable").innerHTML = `<thead><tr><th>상장일 가격</th><th>매도가</th><th>순손익(원)</th><th>증거금 대비</th></tr></thead><tbody>${body}</tbody>`;
}

function fillCalc(it) {
  calcFor = it;
  const p = offerPrice(it);
  if (p) $("cPrice").value = p;
  if (it.sub_comp) $("cComp").value = +it.sub_comp.toFixed(2);
  if (it.spac) $("cMin").value = 10;
  $("calcFor").innerHTML = `${esc(it.name)} <small class="hint">${it.price ? "확정 공모가" : p ? "밴드 상단으로 계산" : ""}</small>`;
  calc();
}

function initCalc() {
  const saved = store.get("ipo.calc", null);
  if (saved) for (const [k, id] of Object.entries(CALC_IDS)) if (saved[k] != null) $(id).value = saved[k];
  Object.values(CALC_IDS).forEach((id) => $(id).addEventListener("input", calc));
  $("cMinBtn").onclick = () => { $("cQty").value = $("cMin").value || 10; $("cComp").value = ""; calc(); };
  $("cReset").onclick = () => {
    for (const [k, id] of Object.entries(CALC_IDS)) $(id).value = CALC_DEFAULT[k];
    calcFor = null; $("calcFor").textContent = "직접 입력"; calc();
  };
  calc();
}

/* ---------------------------------------------------------------- 내 청약 기록 */
let RECS = store.get("ipo.records", []);
const REC_F = { name: "mName", broker: "mBroker", date: "mDate", applied: "mApplied", alloc: "mAlloc", price: "mPrice", sell: "mSell", fee: "mFee" };
const NUMF = new Set(["applied", "alloc", "price", "sell", "fee"]);

function curPrice(rec) {
  const n = rec.name.replace(/\s+/g, "");
  const it = ITEMS.find((x) => x.name.replace(/\s+/g, "") === n);
  return it && it.cur ? it.cur : null;
}
function recPnl(r) {
  const alloc = r.alloc || 0;
  const rate = (numOf("cSell") || 0) / 100;
  const fee = alloc > 0 ? r.fee || 0 : 0;
  if (r.sell) return { pnl: (r.sell - r.price) * alloc - fee - Math.round(r.sell * alloc * rate), held: false };
  const cur = curPrice(r);
  if (cur && r.price) return { pnl: (cur - r.price) * alloc - fee, held: true, cur };
  return { pnl: alloc > 0 ? null : 0, held: alloc > 0 };
}

function renderMy() {
  queueMicrotask(() => emit("ipo:records"));
  const yr = TODAY.slice(0, 4);
  let real = 0, realYr = 0, evalP = 0, got = 0;
  for (const r of RECS) {
    const { pnl, held } = recPnl(r);
    if ((r.alloc || 0) > 0) got++;
    if (pnl == null) continue;
    if (held) evalP += pnl; else { real += pnl; if ((r.date || "").startsWith(yr)) realYr += pnl; }
  }
  $("mySum").innerHTML = `
    <div class="st"><div class="k">청약 건수</div><div class="v">${RECS.length}<span class="u">건</span></div><div class="s">배정 ${got}건</div></div>
    <div class="st"><div class="k">실현 손익 (전체)</div><div class="v ${cls(real)}">${real > 0 ? "+" : ""}${won(real)}<span class="u">원</span></div><div class="s">매도가를 적은 건</div></div>
    <div class="st"><div class="k">${yr}년 실현 손익</div><div class="v ${cls(realYr)}">${realYr > 0 ? "+" : ""}${won(realYr)}<span class="u">원</span></div><div class="s">청약일 기준</div></div>
    <div class="st"><div class="k">보유 평가 손익</div><div class="v ${cls(evalP)}">${evalP > 0 ? "+" : ""}${won(evalP)}<span class="u">원</span></div><div class="s">현재가를 아는 종목만</div></div>`;
  $("myEmpty").hidden = RECS.length > 0;
  if (!RECS.length) { $("myTable").innerHTML = ""; return; }
  const xs = [...RECS].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  $("myTable").innerHTML = `<thead><tr><th>종목</th><th>증권사</th><th>청약일</th><th>청약</th><th>배정</th><th>공모가</th><th>매도가</th><th>손익</th><th>수익률</th><th></th></tr></thead>
    <tbody>${xs.map((r) => {
      const { pnl, held, cur } = recPnl(r);
      const base = (r.price || 0) * (r.alloc || 0);
      const rr = pnl != null && base > 0 ? (pnl / base) * 100 : null;
      return `<tr><td class="tx"><b>${esc(r.name)}</b></td><td class="tx">${esc(r.broker || "–")}</td><td>${r.date ? esc(r.date.slice(2).replace(/-/g, ".")) : "–"}</td>
        <td>${r.applied ? nf.format(r.applied) : "–"}</td><td>${nf.format(r.alloc || 0)}</td><td>${won(r.price)}</td>
        <td>${r.sell ? won(r.sell) : held ? `<small class="hint">${cur ? `현재 ${won(cur)}` : "보유"}</small>` : "–"}</td>
        <td class="${cls(pnl)}">${pnl == null ? "–" : `${pnl > 0 ? "+" : ""}${won(pnl)}`}${held && pnl != null ? " <small class=\"hint\">평가</small>" : ""}</td>
        <td class="${cls(rr)}">${pct(rr, 1)}</td>
        <td><span class="act"><button class="ghost sm" type="button" data-edit="${esc(r.id)}">수정</button><button class="ghost sm" type="button" data-del="${esc(r.id)}" aria-label="삭제">✕</button></span></td></tr>`;
    }).join("")}</tbody>`;
}

function saveRecs() { store.set("ipo.records", RECS); renderMy(); }

function resetForm() {
  $("myForm").reset(); $("mId").value = ""; $("mFee").value = 2000;
  $("mSave").textContent = "기록 추가"; $("mCancel").hidden = true;
}

function fillRecord(it) {
  resetForm();
  $("mName").value = it.name;
  if (it.uw.length) $("mBroker").value = it.uw[0];
  if (it.sub_end || it.sub_start) $("mDate").value = it.sub_end || it.sub_start;
  if (offerPrice(it)) $("mPrice").value = offerPrice(it);
  $("mApplied").focus();
}

function initMy() {
  $("nameList").innerHTML = ITEMS.map((it) => `<option value="${esc(it.name)}">`).join("");
  const brokers = [...new Set(ITEMS.flatMap((it) => it.uw))].sort((a, b) => a.localeCompare(b, "ko"));
  $("brokerList").innerHTML = brokers.map((b) => `<option value="${esc(b)}">`).join("");
  // 종목을 목록에서 고르면 공모가·청약일·주간사를 채웁니다(비어 있을 때만)
  $("mName").addEventListener("change", () => {
    const n = $("mName").value.replace(/\s+/g, "");
    const it = ITEMS.find((x) => x.name.replace(/\s+/g, "") === n);
    if (!it) return;
    if (!$("mPrice").value && offerPrice(it)) $("mPrice").value = offerPrice(it);
    if (!$("mDate").value && (it.sub_end || it.sub_start)) $("mDate").value = it.sub_end || it.sub_start;
    if (!$("mBroker").value && it.uw.length) $("mBroker").value = it.uw[0];
  });
  $("myForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const rec = { id: $("mId").value || `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    for (const [k, id] of Object.entries(REC_F)) {
      const v = $(id).value.trim();
      rec[k] = NUMF.has(k) ? (v === "" ? null : Math.max(0, Number(v))) : v;
    }
    if (!rec.name) return;
    const i = RECS.findIndex((r) => r.id === rec.id);
    if (i >= 0) RECS[i] = rec; else RECS.push(rec);
    saveRecs(); resetForm();
    toast(i >= 0 ? "기록을 고쳤습니다" : "기록을 추가했습니다");
  });
  $("mCancel").onclick = resetForm;
  $("myTable").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) {
      const r = RECS.find((x) => x.id === ed.dataset.edit); if (!r) return;
      $("mId").value = r.id;
      for (const [k, id] of Object.entries(REC_F)) $(id).value = r[k] ?? "";
      $("mSave").textContent = "고친 내용 저장"; $("mCancel").hidden = false;
      $("myForm").scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (del) {
      const r = RECS.find((x) => x.id === del.dataset.del);
      if (r && confirm(`${r.name} 기록을 지울까요?`)) { RECS = RECS.filter((x) => x !== r); saveRecs(); }
    }
  });
  $("myCsv").onclick = () => {
    if (!RECS.length) { toast("내보낼 기록이 없습니다"); return; }
    const head = ["종목", "증권사", "청약일", "청약주수", "배정주수", "공모가", "매도가", "청약수수료", "손익"];
    const q = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = RECS.map((r) => [r.name, r.broker, r.date, r.applied, r.alloc, r.price, r.sell, r.fee, recPnl(r).pnl].map(q).join(","));
    download(new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }), `공모주-청약기록-${TODAY}.csv`);
  };
  $("myBackup").onclick = () => download(new Blob([JSON.stringify({ v: 1, records: RECS, stars: [...stars] }, null, 1)], { type: "application/json" }), `공모주-백업-${TODAY}.json`);
  $("myRestore").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const recs = Array.isArray(d) ? d : d.records;
      if (!Array.isArray(recs)) throw new Error("형식");
      const clean = recs.filter((r) => r && typeof r.name === "string").map((r) => {
        const o = { id: String(r.id || `r${Math.random().toString(36).slice(2, 10)}`) };
        for (const k of Object.keys(REC_F)) o[k] = NUMF.has(k) ? (r[k] == null || r[k] === "" ? null : Number(r[k]) || 0) : String(r[k] ?? "");
        return o;
      });
      const ids = new Set(RECS.map((r) => r.id));
      let added = 0;
      for (const r of clean) if (!ids.has(r.id)) { RECS.push(r); added++; }
      if (Array.isArray(d.stars)) { d.stars.forEach((s) => stars.add(String(s))); store.set("ipo.stars", [...stars]); renderList(); }
      saveRecs(); toast(`${added}건을 복원했습니다`);
    } catch (err) { toast("백업 파일을 읽지 못했습니다"); }
    e.target.value = "";
  });
  // 매도 비용 % 가 바뀌면 손익도 다시
  $("cSell").addEventListener("input", renderMy);
  renderMy();
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
    navigator.serviceWorker.register("/ipo/sw.js", { scope: "/ipo/" }).catch(() => {});
  }
  const btn = $("installBtn");
  let ev = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); ev = e; btn.hidden = false; });
  btn.addEventListener("click", async () => { if (!ev) return; ev.prompt(); await ev.userChoice.catch(() => {}); ev = null; btn.hidden = true; });
}

/* ---------------------------------------------------------------- 시작 */
(async function main() {
  initTheme();
  initPwa();
  initCalc(); // 데이터 없이도 쓰게 먼저
  renderMethod();
  renderGloss();
  try { await load(); }
  catch (e) {
    $("fresh").innerHTML = `<span class="down">데이터를 불러오지 못했습니다(${esc(e.message)}). 계산기와 내 기록은 그대로 쓸 수 있습니다.</span>`;
  }
  renderFresh();
  renderSummary();
  renderToday();
  renderFeature();
  initList();
  renderMarket();
  initCal();
  initMy();
  initDetail();
  emit("ipo:ready");
  // 자정을 넘겨 열어 둔 탭에서도 D-day 가 맞게
  setInterval(() => {
    const t = kstToday();
    if (t !== TODAY) { TODAY = t; scoreCache.clear(); PAST = null; renderSummary(); renderToday(); renderFeature(); renderList(); renderMarket(); renderCal(); emit("ipo:ready"); }
  }, 60e3);
})();
