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

/* ---------------------------------------------------------------- 관심 종목 */
const stars = new Set(store.get("ipo.stars", []));
function toggleStar(id) {
  if (stars.has(id)) stars.delete(id); else stars.add(id);
  store.set("ipo.stars", [...stars]);
  document.querySelectorAll(`.star[data-id="${CSS.escape(id)}"]`).forEach((b) => b.setAttribute("aria-pressed", stars.has(id)));
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
  if (up) {
    const d = up.slice(0, 10), hm = up.slice(11, 16);
    bits.push(`<span>갱신 <b>${esc(d)} ${esc(hm)}</b> KST</span>`);
  } else bits.push(`<span>아직 수집된 데이터가 없습니다</span>`);
  bits.push(`<span>종목 <b>${nf.format(ITEMS.length)}</b></span>`);
  bits.push(`<span>출처 <b>${esc(DATA.source || "38커뮤니케이션")}</b></span>`);
  $("fresh").innerHTML = bits.join("");
  const banner = $("stale");
  if (!up) {
    banner.innerHTML = "<b>데이터 준비 중</b> — 청약 일정은 매일 자동으로 모읍니다. 첫 수집 전이라 목록이 비어 있지만, 계산기와 내 청약 기록은 지금 쓸 수 있습니다.";
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
  const recent = live.filter((it) => it.list_date && it.list_date <= TODAY && it.list_date >= addDays(TODAY, -90) && it.price && it.open);
  const avgOpen = recent.length ? recent.reduce((a, it) => a + (it.open / it.price - 1) * 100, 0) / recent.length : null;
  const names = (xs) => xs.slice(0, 3).map((x) => esc(x.name)).join(", ") + (xs.length > 3 ? ` 외 ${xs.length - 3}` : "");
  $("summary").innerHTML = `
    <div class="st link" data-go="now"><div class="k">지금 청약 중</div><div class="v">${subNow.length}<span class="u">곳</span></div>
      <div class="s">${subNow.length ? names(subNow) : "없음"}</div></div>
    <div class="st link" data-go="now"><div class="k">이번 주 청약 (${md(ws)}~${md(we)})</div><div class="v">${thisWeek.length}<span class="u">곳</span></div>
      <div class="s">${thisWeek.length ? names(thisWeek) : "없음"}</div></div>
    <div class="st link" data-go="wait"><div class="k">2주 안 상장</div><div class="v">${soon.length}<span class="u">곳</span></div>
      <div class="s">${soon.length ? names(soon) : "없음"}</div></div>
    <div class="st link" data-go="listed"><div class="k">최근 3개월 평균 시초가 수익률</div>
      <div class="v ${cls(avgOpen)}">${avgOpen == null ? "–" : pct(avgOpen, 0)}</div>
      <div class="s">${recent.length ? `스팩 뺀 ${recent.length}곳, 공모가 대비` : "상장 기록 없음"}</div></div>`;
  $("summary").querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => {
    setTab(el.dataset.go); $("schedule").scrollIntoView({ behavior: "smooth" });
  }));
}

/* ---------------------------------------------------------------- 일정 카드 */
const listState = { v: store.get("ipo.tab", "now"), q: "", hideSpac: store.get("ipo.hideSpac", true) };

function setTab(v) {
  listState.v = v; store.set("ipo.tab", v);
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
  if (listState.v === "listed") xs.sort((a, b) => (b.list_date || "").localeCompare(a.list_date || ""));
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
  const s = stage(it);
  const p = perf(it);
  const tags = [it.market ? `<span class="tag">${MARKET[it.market] || esc(it.market)}</span>` : "",
    it.spac ? `<span class="tag spac">스팩</span>` : "",
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
  return `<article class="ipo ${s.key}" data-id="${esc(it.id)}" tabindex="0" aria-label="${esc(it.name)} 상세 보기">
    <div class="top">
      <button class="star" type="button" data-id="${esc(it.id)}" aria-pressed="${stars.has(it.id)}" aria-label="관심 종목">★</button>
      <div class="nm"><b>${esc(it.name)}</b><small>${tags}</small></div>
      <span class="stat ${s.key}"><span class="dot"></span>${esc(s.label)}</span>
    </div>
    <div class="when num">${when.join("")}</div>
    <div class="kv">${kv}</div>
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
  box.innerHTML = xs.length ? xs.map(card).join("") : `<p class="empty">${listState.q ? "검색 결과가 없습니다." : emptyMsg[listState.v]}</p>`;
  const hidden = listState.hideSpac ? ITEMS.filter((it) => it.spac).length : 0;
  $("listNote").textContent = `${xs.length}곳${hidden && listState.v !== "star" ? ` · 스팩 ${hidden}곳 숨김` : ""} · 확정 공모가 옆 %는 희망 밴드 상단 대비입니다.`;
}

function initList() {
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setTab(b.dataset.v); });
  $("q").addEventListener("input", (e) => { listState.q = e.target.value; renderList(); });
  $("hideSpac").checked = listState.hideSpac;
  $("hideSpac").addEventListener("change", (e) => { listState.hideSpac = e.target.checked; store.set("ipo.hideSpac", listState.hideSpac); renderList(); });
  const open = (e) => {
    const star = e.target.closest(".star");
    if (star) { e.stopPropagation(); toggleStar(star.dataset.id); return; }
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
function signals(it) {
  const out = [];
  if (it.price && it.band_hi) {
    if (it.price > it.band_hi) out.push(["good", `공모가가 희망 밴드 상단(${won(it.band_hi)}원)보다 ${pct((it.price / it.band_hi - 1) * 100, 0)} 높게 정해졌습니다.`]);
    else if (it.price === it.band_hi) out.push(["good", "공모가가 희망 밴드 상단에서 정해졌습니다."]);
    else if (it.band_lo && it.price < it.band_lo) out.push(["weak", `공모가가 희망 밴드 하단(${won(it.band_lo)}원)보다 낮게 정해졌습니다.`]);
    else out.push(["", "공모가가 희망 밴드 안에서 정해졌습니다."]);
  }
  if (it.inst_comp != null) {
    if (it.inst_comp >= 1000) out.push(["good", `기관경쟁률 ${comp(it.inst_comp)} — 기관 수요가 많았습니다.`]);
    else if (it.inst_comp < 100) out.push(["weak", `기관경쟁률 ${comp(it.inst_comp)} — 기관 수요가 적은 편입니다.`]);
    else out.push(["", `기관경쟁률 ${comp(it.inst_comp)}.`]);
  }
  if (it.lockup != null) {
    if (it.lockup >= 30) out.push(["good", `의무보유확약 ${it.lockup.toFixed(1)}% — 상장 직후 팔 수 없는 기관 물량이 많습니다.`]);
    else if (it.lockup < 5) out.push(["weak", `의무보유확약 ${it.lockup.toFixed(1)}% — 상장 직후 매도 물량이 나올 수 있습니다.`]);
    else out.push(["", `의무보유확약 ${it.lockup.toFixed(1)}%.`]);
  }
  if (it.sub_comp != null) out.push(["", `일반 청약경쟁률 ${comp(it.sub_comp)} — 비례로 대략 ${nf.format(Math.round(it.sub_comp * 2))}주 넣으면 1주입니다.`]);
  return out;
}

function timeline(it) {
  const steps = [["수요예측", it.fc_start, it.fc_end], ["청약", it.sub_start, it.sub_end], ["환불", it.refund, it.refund], ["상장", it.list_date, it.list_date]];
  return `<div class="tl">${steps.map(([k, a, b]) => {
    const st = !a ? "" : TODAY > (b || a) ? "done" : TODAY >= a ? "now" : "";
    const txt = !a ? "미정" : b && b !== a ? `${md(a)}~${md(b)}` : mdw(a);
    return `<div class="s ${st}"><i>${k}</i><b>${txt}</b></div>`;
  }).join("")}</div>`;
}

function openDetail(id) {
  const it = BY_ID.get(id);
  if (!it) return;
  const s = stage(it), p = perf(it);
  const st = (k, v, sub = "", c = "") => `<div class="st"><div class="k">${k}</div><div class="v ${c}">${v}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
  const band = it.band_lo ? (it.band_lo === it.band_hi ? won(it.band_lo) : `${won(it.band_lo)}~${won(it.band_hi)}`) : "–";
  const sig = signals(it);
  const q = encodeURIComponent(it.name);
  const links = [
    it.no ? `<a class="ghost sm" href="https://www.38.co.kr/html/fund/?o=v&no=${encodeURIComponent(it.no)}&l=&page=1" target="_blank" rel="noopener">38 상세</a>` : "",
    `<a class="ghost sm" href="https://dart.fss.or.kr/dsab007/main.do?option=corp&textCrpNm=${q}" target="_blank" rel="noopener">DART 공시</a>`,
    `<a class="ghost sm" href="https://search.naver.com/search.naver?query=${q}%20%EA%B3%B5%EB%AA%A8%EC%A3%BC" target="_blank" rel="noopener">뉴스 검색</a>`,
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
      <div class="stats c3">
        ${st("희망 공모가", band, "원")}
        ${st("확정 공모가", won(it.price), it.price && it.band_hi ? `밴드 상단 대비 ${pct((it.price / it.band_hi - 1) * 100, 0)}` : "원")}
        ${st("공모 금액", eok(it.amount), it.shares ? `${nf.format(it.shares)}주` : "")}
        ${st("기관경쟁률", comp(it.inst_comp), it.fc_start ? `수요예측 ${md(it.fc_start)}${it.fc_end && it.fc_end !== it.fc_start ? `~${md(it.fc_end)}` : ""}` : "")}
        ${st("의무보유확약", it.lockup != null ? `${it.lockup.toFixed(1)}%` : "–", "기관 배정 물량 중")}
        ${st("청약경쟁률", comp(it.sub_comp), "일반 청약 통합")}
        ${it.list_date && TODAY >= it.list_date ? `
          ${st("시초가", won(it.open), pct(p.open, 1), cls(p.open))}
          ${st("첫날 종가", won(it.close1), pct(p.close1, 1), cls(p.close1))}
          ${st("현재가", won(it.cur), pct(p.cur, 1), cls(p.cur))}` : ""}
      </div>
      ${it.uw.length ? `<div><h3 class="hint">주간사 — 이 증권사 계좌로 청약합니다(한 종목은 한 곳에서만)</h3><div class="uw mt8">${it.uw.map((u) => `<span>${esc(u)}</span>`).join("")}</div></div>` : ""}
      ${sig.length ? `<div><h3 class="hint">숫자로 본 수요 — 참고용</h3><ul class="sig mt8">${sig.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("")}</ul></div>` : ""}
      <div class="btnrow">
        <button class="ghost primary sm" type="button" data-act="calc">계산기로</button>
        <button class="ghost sm" type="button" data-act="ics">달력에 추가 (.ics)</button>
        <button class="ghost sm" type="button" data-act="rec">기록 추가</button>
        <button class="ghost sm" type="button" data-act="share">링크 복사</button>
      </div>
      <div class="btnrow">${links}</div>
      <p class="hint">일정과 숫자는 늦거나 바뀔 수 있습니다. 청약 전 증권사 공지와 투자설명서를 확인하세요.</p>
    </div>`;
  const dlg = $("dlg");
  $("dClose").onclick = () => dlg.close();
  $("dBody").querySelector(".star").onclick = (e) => toggleStar(e.currentTarget.dataset.id);
  $("dBody").querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
    const act = b.dataset.act;
    if (act === "calc") { dlg.close(); fillCalc(it); $("calc").scrollIntoView({ behavior: "smooth" }); }
    else if (act === "ics") downloadIcs([it], `${it.name}-공모주.ics`);
    else if (act === "rec") { dlg.close(); fillRecord(it); $("my").scrollIntoView({ behavior: "smooth" }); }
    else if (act === "share") {
      const url = `${location.origin}/ipo/#i=${encodeURIComponent(it.id)}`;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("링크를 복사했습니다"), () => prompt("링크", url));
    }
  }));
  if (!dlg.open) dlg.showModal();
  history.replaceState(null, "", `#i=${encodeURIComponent(it.id)}`);
}

function initDetail() {
  const dlg = $("dlg");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => { if (location.hash.startsWith("#i=")) history.replaceState(null, "", location.pathname + location.search); });
  const m = location.hash.match(/^#i=(.+)$/);
  if (m) openDetail(decodeURIComponent(m[1]));
}

/* ---------------------------------------------------------------- .ics 내보내기 */
function icsEvents(it) {
  const ev = [];
  const day = (s) => s.replace(/-/g, "");
  if (it.sub_start) ev.push({ uid: `sub-${it.id}`, s: it.sub_start, e: addDays(it.sub_end || it.sub_start, 1), t: `[청약] ${it.name}`,
    d: `청약 ${it.sub_start}~${it.sub_end || it.sub_start}${it.uw.length ? ` · 주간사 ${it.uw.join(", ")}` : ""}${offerPrice(it) ? ` · 공모가 ${won(offerPrice(it))}원${it.price ? "" : "(밴드 상단)"}` : ""}` });
  if (it.refund) ev.push({ uid: `refund-${it.id}`, s: it.refund, e: addDays(it.refund, 1), t: `[환불] ${it.name}`, d: "청약 증거금 환불일" });
  if (it.list_date) ev.push({ uid: `list-${it.id}`, s: it.list_date, e: addDays(it.list_date, 1), t: `[상장] ${it.name}`, d: "신규 상장일" });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const txt = (s) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  return ev.map((e) => ["BEGIN:VEVENT", `UID:${e.uid}@richroro.github.io`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(e.s)}`,
    `DTEND;VALUE=DATE:${day(e.e)}`, `SUMMARY:${txt(e.t)}`, `DESCRIPTION:${txt(e.d)}`, "END:VEVENT"].join("\r\n"));
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
  try { await load(); }
  catch (e) {
    $("fresh").innerHTML = `<span class="down">데이터를 불러오지 못했습니다(${esc(e.message)}). 계산기와 내 기록은 그대로 쓸 수 있습니다.</span>`;
  }
  renderFresh();
  renderSummary();
  initList();
  initCal();
  initMy();
  initDetail();
  // 자정을 넘겨 열어 둔 탭에서도 D-day 가 맞게
  setInterval(() => { const t = kstToday(); if (t !== TODAY) { TODAY = t; renderSummary(); renderList(); renderCal(); } }, 60e3);
})();
