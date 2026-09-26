/* 공모주 캘린더 — 앱처럼 쓰게 하는 기능들: 자금 플래너, 나란히 비교, 공유 카드 이미지, 내 기록 대시보드, 휴대폰 아래 탭.
   app.js 의 전역(ITEMS, scoreOf, offerPrice, won, …)을 그대로 씁니다. app.js 가 보내는 이벤트
   ipo:ready(데이터 준비) · ipo:records(기록 바뀜) · ipo:cmp(비교 토글) · ipo:sharecard(공유 카드) 에 맞춰 그립니다. */
"use strict";

/* ---------------------------------------------------------------- 공통: 막대·계단 그래프 툴팁 */
function attachTip(box, svg, W, H, getHtml, onClick) {
  const tip = document.createElement("div");
  tip.className = "tip";
  box.appendChild(tip);
  const show = (el) => {
    const bb = el.getBoundingClientRect(), wb = box.getBoundingClientRect();
    tip.innerHTML = getHtml(+el.dataset.i);
    tip.style.left = `${Math.min(Math.max(bb.left - wb.left + bb.width / 2, 90), wb.width - 90)}px`;
    tip.style.top = `${Math.max(bb.top - wb.top + 40, 70)}px`;
    tip.classList.add("on");
    svg.querySelectorAll(".xh").forEach((x) => x.remove());
    if (el.dataset.x) {
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("class", "xh"); l.setAttribute("x1", el.dataset.x); l.setAttribute("x2", el.dataset.x);
      l.setAttribute("y1", 10); l.setAttribute("y2", H - 24);
      svg.insertBefore(l, svg.firstChild);
    }
  };
  const hide = () => { tip.classList.remove("on"); svg.querySelectorAll(".xh").forEach((x) => x.remove()); };
  svg.addEventListener("pointermove", (e) => { const h = e.target.closest(".hit"); if (h) show(h); else hide(); });
  svg.addEventListener("pointerleave", hide);
  if (onClick) svg.addEventListener("click", (e) => { const h = e.target.closest(".hit"); if (h) onClick(+h.dataset.i); });
}
const niceStep = (span, n = 4) => {
  const raw = span / n, p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10;
};
const manwon = (v) => (Math.abs(v) >= 1e8 ? `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억` : `${nf.format(Math.round(v / 1e4))}만`);
const bizAdd = (s, n) => { let d = s; while (n > 0) { d = addDays(d, 1); if (isBizDay(d)) n--; } return d; };

/* ---------------------------------------------------------------- 자금 플래너 */
let PLAN = store.get("ipo.plan", {}); // {id: {mode: "skip"|"min"|"custom", qty}}
const planState = { acc: store.get("ipo.planAcc", 1), day: store.get("ipo.planDay", "end") };

function planRows() {
  const minQ = numOf("cMin") || 10, margin = (numOf("cMargin") ?? 50) / 100, eq = Math.max(0, numOf("cEq") ?? 1);
  const n = Math.max(1, Math.min(10, planState.acc | 0 || 1));
  return ITEMS.filter((it) => !it.spac && it.sub_start && (it.sub_end || it.sub_start) >= TODAY && offerPrice(it))
    .sort((a, b) => a.sub_start.localeCompare(b.sub_start))
    .map((it) => {
      const r = scoreOf(it);
      const saved = PLAN[it.id] || {};
      const mode = saved.mode || (r.verdict.key === "pass" ? "skip" : "min");
      const qty = mode === "custom" ? Math.max(minQ, saved.qty || minQ) : minQ;
      const amt = Math.max(0, saved.amt ?? 1000); // 비례에 더 넣을 돈(만원)
      const price = offerPrice(it);
      const out = planState.day === "start" ? it.sub_start : (it.sub_end || it.sub_start);
      const back = it.refund || bizAdd(it.sub_end || it.sub_start, 2);
      // 증거금: 계좌마다 최소 주수(균등) + 비례 금액 또는 지정 주수
      const dep = mode === "skip" ? 0 : mode === "prop" ? price * minQ * margin * n + amt * 1e4 : price * qty * margin * n;
      const qTot = Math.floor(dep / (price * margin));
      const est = estComp(it), ret = estRet(it);
      const propS = est && qTot ? qTot / (est.c * 2) : 0; // 비례 기대 주수(추첨 포함 평균)
      const shares = mode === "skip" ? 0 : Math.min(qTot, eq * n + propS);
      const cost = shares * price;
      const fee = numOf("cFee") ?? 2000;
      const pnl = ret ? shares * price * ret.r / 100 - (shares > 0 ? fee * n : 0) : null;
      return { it, r, mode, qty, amt, price, out, back, list: it.list_date, dep, cost, refundAmt: Math.max(0, dep - cost), extra: Math.max(0, cost - dep),
        shares, pnl, c: est && est.c, cEst: est && est.how !== "actual", ret: ret && ret.r };
    });
}

function renderPlan() {
  const rows = planRows();
  const act = rows.filter((x) => x.mode !== "skip");
  // 날짜별 돈의 흐름: 청약일 −증거금, 환불일 +환불금(배정분은 주식으로 남음), 상장일 +배정 원금(공모가에 판다고 보고)
  const flow = new Map();
  const add = (d, v, label) => { if (!d) return; const f = flow.get(d) || { v: 0, ev: [] }; f.v += v; f.ev.push(label); flow.set(d, f); };
  for (const x of act) {
    add(x.out, -(x.dep), `${x.it.name} 청약 −${manwon(x.dep)}`);
    if (x.extra) add(x.back, -x.extra, `${x.it.name} 추가 납입 −${manwon(x.extra)}`);
    add(x.back, x.refundAmt, `${x.it.name} 환불 +${manwon(x.refundAmt)}`);
    if (x.cost) add(x.list || addDays(x.back, 7), x.cost, `${x.it.name} 상장·매도 +${manwon(x.cost)}`);
  }
  const days = [...flow.keys()].sort();
  let locked = 0, peak = 0, peakDay = null;
  const series = [];
  if (days.length) {
    const end = days[days.length - 1];
    for (let d = TODAY < days[0] ? TODAY : days[0], i = 0; d <= end && i < 120; d = addDays(d, 1), i++) {
      const f = flow.get(d);
      if (f) locked -= f.v;
      if (locked > peak + 0.5) { peak = locked; peakDay = d; }
      series.push({ d, v: Math.max(0, locked), ev: f ? f.ev : [] });
    }
  }
  const total = act.reduce((a, x) => a + x.dep, 0);
  const shares = act.reduce((a, x) => a + x.cost, 0);
  const pnlSum = act.reduce((a, x) => a + (x.pnl || 0), 0);
  $("pStats").innerHTML = `
    <div class="st"><div class="k">청약할 종목</div><div class="v">${act.length}<span class="u">곳</span></div><div class="s">${rows.length - act.length ? `건너뛰기 ${rows.length - act.length}곳` : "다가오는 청약 전부"}</div></div>
    <div class="st"><div class="k">한 번에 필요한 최대 자금</div><div class="v">${peak ? manwon(peak) : "–"}<span class="u">${peak ? "원" : ""}</span></div><div class="s">${peakDay ? `${mdw(peakDay)} 기준` : "–"}</div></div>
    <div class="st"><div class="k">넣는 증거금 합계</div><div class="v">${total ? manwon(total) : "–"}<span class="u">${total ? "원" : ""}</span></div><div class="s">계좌 ${planState.acc}개 · 돌려 쓰면 위 최대 자금만 있으면 됨</div></div>
    <div class="st"><div class="k">기대 손익 (시초가 매도)</div><div class="v ${cls(pnlSum)}">${pnlSum ? `${pnlSum >= 0 ? "+" : "−"}${manwon(Math.abs(pnlSum))}` : "–"}<span class="u">${pnlSum ? "원" : ""}</span></div><div class="s">배정 원금 ${shares ? manwon(shares) : "–"} · 과거 중앙값 기준</div></div>`;
  drawPlan(series);
  const mOpt = (x, v, t) => `<option value="${v}" ${x.mode === v ? "selected" : ""}>${t}</option>`;
  $("pTable").innerHTML = rows.length ? `<thead><tr><th>종목</th><th>전략</th><th>주수·금액</th><th>청약일</th><th>증거금</th><th>기대 손익</th><th>환불</th></tr></thead><tbody>${rows.map((x) => `
    <tr class="${x.mode === "skip" ? "skip" : ""}" data-id="${esc(x.it.id)}"><td class="tx nm"><b>${esc(x.it.name)}</b>${verdictChip(x.r)}</td>
      <td data-l="전략"><select class="pm" aria-label="${esc(x.it.name)} 전략">${mOpt(x, "min", "균등(최소)")}${mOpt(x, "prop", "균등+비례(금액)")}${mOpt(x, "custom", "주수 지정")}${mOpt(x, "skip", "건너뛰기")}</select></td>
      <td data-l="${x.mode === "prop" ? "비례에 넣을 돈(만원)" : "주수"}">${x.mode === "custom" ? `<input class="pq" type="number" inputmode="numeric" min="1" step="10" value="${x.qty}" aria-label="청약 주수">`
        : x.mode === "prop" ? `<input class="pa" type="number" inputmode="numeric" min="0" step="100" value="${x.amt}" aria-label="비례에 넣을 금액(만원)">`
        : x.mode === "skip" ? "–" : nf.format(x.qty)}</td>
      <td data-l="청약일">${mdw(x.out)}</td><td data-l="증거금">${x.dep ? manwon(x.dep) : "–"}</td>
      <td data-l="기대 손익">${x.mode === "skip" || x.pnl == null ? "–" : `<span><span class="${cls(x.pnl)}">${x.pnl >= 0 ? "+" : "−"}${manwon(Math.abs(x.pnl))}</span><small class="hint"> ${x.shares.toFixed(x.shares < 10 ? 2 : 0)}주${x.mode === "prop" && x.cEst ? " · 경쟁률 추정" : ""}</small></span>`}</td>
      <td data-l="환불">${mdw(x.back)}${x.it.refund ? "" : '<small class="hint">추정</small>'}<br><small class="hint">${x.refundAmt ? `+${manwon(x.refundAmt)}` : ""}</small></td></tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="empty">다가오는 청약이 없습니다. 일정이 잡히면 여기에 채워집니다.</td></tr></tbody>`;
}

function drawPlan(series) {
  const box = $("pFig");
  if (!series.length || !series.some((p) => p.v > 0)) { box.innerHTML = `<p class="empty">청약할 종목을 고르면 그래프가 그려집니다.</p>`; return; }
  // 상자 너비대로 그려 글자 크기를 화면과 맞춥니다
  const W = Math.max(320, Math.round(box.clientWidth || 560)), H = 230, L = 50, R = 10, T = 14, B = 26;
  const mx = Math.max(...series.map((p) => p.v));
  const st = niceStep(mx), top = Math.ceil(mx / st) * st;
  const x = (i) => L + (i + 0.5) * (W - L - R) / series.length, y = (v) => T + (1 - v / top) * (H - T - B);
  const bw = (W - L - R) / series.length;
  let grid = "";
  for (let v = 0; v <= top + 1e-6; v += st) grid += `<line class="${v ? "gridline" : "baseline"}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v ? manwon(v) : 0}</text>`;
  // 계단: 하루 동안 같은 값
  let d = `M${L},${y(0)}`;
  series.forEach((p, i) => { const x0 = L + i * bw; d += `L${x0},${y(p.v)}L${x0 + bw},${y(p.v)}`; });
  const line = d.slice(d.indexOf("L")).replace(/^L/, "M");
  d += `L${W - R},${y(0)}Z`;
  const pk = series.reduce((a, p, i) => (p.v > series[a].v ? i : a), 0);
  const ticks = series.map((p, i) => (i === 0 || i === series.length - 1 || p.ev.length ? i : -1)).filter((i) => i >= 0);
  const xl = [0, series.length - 1].map((i, k) => `<text class="axis" x="${k ? W - R : L}" y="${H - 8}" text-anchor="${k ? "end" : "start"}">${md(series[i].d)}</text>`).join("");
  box.innerHTML = `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 묶인 증거금 계단 그래프, 최대 ${manwon(series[pk].v)}원">
    ${grid}<path d="${d}" class="parea"/><path d="${line}" class="pline"/>
    ${ticks.filter((i) => series[i].ev.length).map((i) => `<circle cx="${x(i) - bw / 2}" cy="${y(series[i].v)}" r="3.5" class="pdot"/>`).join("")}
    <text class="dlabel" x="${Math.min(Math.max(x(pk), L + 40), W - R - 40)}" y="${y(series[pk].v) - 7}" text-anchor="middle">최대 ${manwon(series[pk].v)}</text>
    ${xl}
    ${series.map((p, i) => `<rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}" data-x="${x(i)}"/>`).join("")}</svg>`;
  attachTip(box, box.querySelector("svg"), W, H, (i) => `<div class="th">${mdw(series[i].d)}</div>
    <div class="tr"><span class="nm">묶인 돈</span><b>${manwon(series[i].v)}원</b></div>
    ${series[i].ev.map((e) => `<div class="tr"><span class="nm">${esc(e)}</span></div>`).join("")}`);
}

function initPlan() {
  $("pAcc").value = planState.acc;
  $("pDay").value = planState.day;
  $("pAcc").addEventListener("input", () => { planState.acc = Math.max(1, Math.min(10, +$("pAcc").value || 1)); store.set("ipo.planAcc", planState.acc); renderPlan(); });
  $("pDay").addEventListener("change", () => { planState.day = $("pDay").value; store.set("ipo.planDay", planState.day); renderPlan(); });
  $("pTable").addEventListener("change", (e) => {
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    const id = tr.dataset.id, cur = PLAN[id] || {};
    if (e.target.classList.contains("pm")) PLAN[id] = { ...cur, mode: e.target.value };
    if (e.target.classList.contains("pq")) PLAN[id] = { ...cur, mode: "custom", qty: +e.target.value || 10 };
    if (e.target.classList.contains("pa")) PLAN[id] = { ...cur, mode: "prop", amt: Math.max(0, +e.target.value || 0) };
    store.set("ipo.plan", PLAN); renderPlan();
  });
  $("pIcs").onclick = () => {
    const xs = planRows().filter((x) => x.mode !== "skip").map((x) => x.it);
    if (!xs.length) { toast("청약할 종목이 없습니다"); return; }
    downloadIcs(xs, "공모주-청약플랜.ics");
  };
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (CUR_SCREEN === "tools") renderPlan(); }, 200); });
  // 계산기의 최소 주수·증거금률·균등 예상이 바뀌면 플래너도 다시
  ["cMin", "cMargin", "cEq"].forEach((id) => $(id).addEventListener("input", renderPlan));
}

/* ---------------------------------------------------------------- 나란히 비교 */
function toggleCmp(id) {
  if (CMP.has(id)) CMP.delete(id);
  else { if (CMP.size >= 3) { toast("비교는 3곳까지 담을 수 있습니다"); return; } CMP.add(id); }
  document.querySelectorAll(`.cmp[data-id="${CSS.escape(id)}"]`).forEach((b) => b.setAttribute("aria-pressed", CMP.has(id)));
  renderTray();
}
function renderTray() {
  const tray = $("cmpTray");
  tray.hidden = !CMP.size;
  document.body.classList.toggle("has-tray", CMP.size > 0);
  $("cmpChips").innerHTML = `<span class="hint">비교 ${CMP.size}/3</span>` + [...CMP].map((id) => {
    const it = BY_ID.get(id); if (!it) return "";
    return `<span class="tchip">${esc(it.name)}<button type="button" data-rm="${esc(id)}" aria-label="${esc(it.name)} 빼기">✕</button></span>`;
  }).join("");
  $("cmpGo").disabled = CMP.size < 2;
}
function openCompare() {
  const xs = [...CMP].map((id) => BY_ID.get(id)).filter(Boolean);
  if (xs.length < 2) return;
  const rs = xs.map(scoreOf);
  const best = (vals) => { const ok = vals.filter((v) => v != null); if (ok.length < 2) return -1; const m = Math.max(...ok); return vals.filter((v) => v === m).length === ok.length ? -1 : m; };
  const row = (label, cells, vals) => {
    const b = vals ? best(vals) : -1;
    return `<tr><th scope="row">${label}</th>${cells.map((c, i) => `<td class="${vals && vals[i] === b ? "best" : ""}">${c}</td>`).join("")}</tr>`;
  };
  const totals = rs.map((r) => (r.pending || r.total == null ? null : r.total));
  let body = row("판정", rs.map((r, i) => `${ring(r, isPhone() ? 44 : 64, xs[i])}${verdictChip(r)}`), totals);
  SC.FACTORS.forEach((f, k) => {
    const pts = rs.map((r) => r.rows[k].pts);
    body += row(`${esc(f.label)}<small>${f.w}점</small>`, rs.map((r, i) => {
      const x = r.rows[k];
      return x.pts == null ? `<span class="hint">모름</span>` : `<span class="num">${esc(fmtVal(x, xs[i]))}</span><small>${x.pts}/${f.w}</small>`;
    }), pts);
  });
  body += row("공모가", xs.map((it) => `<span class="num">${won(offerPrice(it))}</span><small>${it.price ? "확정" : "밴드 상단"}</small>`));
  body += row("청약", xs.map((it) => (it.sub_start ? `${mdw(it.sub_start)}~${md(it.sub_end || it.sub_start)}` : "–")));
  body += row("상장", xs.map((it) => (it.list_date ? mdw(it.list_date) : "미정")));
  body += row("최소 증거금", xs.map((it) => (offerPrice(it) ? `<span class="num">${won(offerPrice(it) * (numOf("cMin") || 10) * (numOf("cMargin") ?? 50) / 100)}</span>` : "–")));
  body += row("주간사", xs.map((it) => esc(it.uw.join(", ") || "–")));
  body += row("주의", rs.map((r) => (r.flags.length ? r.flags.map((f) => `<small class="warnl">${esc(f)}</small>`).join("") : `<span class="hint">없음</span>`)));
  const win = totals.some((t) => t != null) ? xs[totals.indexOf(Math.max(...totals.filter((t) => t != null)))] : null;
  $("cmpBody").innerHTML = `<div class="grab" aria-hidden="true"></div><div class="dlg-top"><div class="ttl"><b id="cmpTitle">나란히 비교</b><small>${win ? `점수로는 <b>${esc(win.name)}</b> 우세 · 칸마다 더 좋은 쪽을 색칠했습니다` : "숫자가 모이면 더 좋은 쪽을 색칠합니다"}</small></div>
    <button class="ghost" type="button" id="cmpClose" aria-label="닫기">✕</button></div>
    <div class="dlg-body"><div class="tscroll"><table class="cmp-t">
      <thead><tr><th></th>${xs.map((it) => `<th scope="col"><button type="button" class="linkish" data-open="${esc(it.id)}">${esc(it.name)}</button><small>${esc(stage(it).label)}</small></th>`).join("")}</tr></thead>
      <tbody>${body}</tbody></table></div>
      <p class="hint">점수는 블로거들이 흔히 보는 기준을 옮긴 참고용입니다.</p></div>`;
  const dlg = $("cmpDlg");
  $("cmpClose").onclick = () => dlg.close();
  $("cmpBody").querySelectorAll("[data-open]").forEach((b) => b.onclick = () => { dlg.close(); openDetail(b.dataset.open); });
  if (!dlg.open) dlg.showModal();
}
function initCompare() {
  document.addEventListener("ipo:cmp", (e) => toggleCmp(e.detail));
  $("cmpChips").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) toggleCmp(b.dataset.rm); });
  $("cmpClear").onclick = () => { [...CMP].forEach(toggleCmp); };
  $("cmpGo").onclick = openCompare;
  $("cmpDlg").addEventListener("click", (e) => { if (e.target === $("cmpDlg")) $("cmpDlg").close(); });
  renderTray();
}

/* ---------------------------------------------------------------- 공유 카드 이미지 */
const VCOL = { strong: "#FF5A6A", go: "#F2894A", light: "#E7B416", pass: "#8B95A3", wait: "#8B95A3", spac: "#8B95A3" };

function wrapText(ctx, text, maxW) {
  const out = []; let line = "";
  for (const ch of text) { if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch; }
  if (line) out.push(line);
  return out;
}

async function shareCard(id) {
  const it = BY_ID.get(id); if (!it) return;
  try { await document.fonts.ready; } catch (e) { /* 글꼴 없이도 그립니다 */ }
  const r = scoreOf(it), s = stage(it);
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const F = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif', M = '"IBM Plex Mono",ui-monospace,monospace';
  const col = VCOL[r.verdict.key] || "#8B95A3";
  // 바탕
  x.fillStyle = "#0F1218"; x.fillRect(0, 0, W, H);
  const g1 = x.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, 700); g1.addColorStop(0, "rgba(232,33,39,.35)"); g1.addColorStop(1, "rgba(232,33,39,0)");
  x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const g2 = x.createRadialGradient(0, H, 0, 0, H, 700); g2.addColorStop(0, "rgba(57,135,229,.25)"); g2.addColorStop(1, "rgba(57,135,229,0)");
  x.fillStyle = g2; x.fillRect(0, 0, W, H);
  const bar = x.createLinearGradient(0, 0, W, 0); bar.addColorStop(0, "#E82127"); bar.addColorStop(0.5, "#F2894A"); bar.addColorStop(1, "#E7B416");
  x.fillStyle = bar; x.fillRect(0, 0, W, 12);
  // 머리
  x.fillStyle = "#AEB7C4"; x.font = `500 30px ${F}`; x.textBaseline = "alphabetic";
  x.fillText("공모주 캘린더 · 블로거식 점수", 72, 100);
  x.textAlign = "right"; x.font = `500 28px ${M}`; x.fillText(TODAY.replace(/-/g, "."), W - 72, 100); x.textAlign = "left";
  // 이름
  x.fillStyle = "#E9EDF3"; x.font = `700 84px ${F}`;
  const lines = wrapText(x, it.name, W - 144).slice(0, 2);
  lines.forEach((l, i) => x.fillText(l, 72, 210 + i * 96));
  let yy = 210 + (lines.length - 1) * 96 + 60;
  x.fillStyle = "#8B95A3"; x.font = `500 32px ${F}`;
  const sub = [s.label, it.sub_start ? `청약 ${md(it.sub_start)}~${md(it.sub_end || it.sub_start)}` : "", it.list_date ? `상장 ${md(it.list_date)}` : "", it.uw[0] || ""].filter(Boolean).join("  ·  ");
  x.fillText(sub, 72, yy);
  // 점수 고리
  const cx = 250, cy = yy + 250, R = 150, show = r.total != null && !r.pending && r.verdict.key !== "spac";
  x.lineWidth = 30; x.lineCap = "round";
  x.strokeStyle = "#242A33"; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
  if (show) { x.strokeStyle = col; x.beginPath(); x.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * r.total / 100); x.stroke(); }
  x.fillStyle = "#E9EDF3"; x.textAlign = "center"; x.font = `600 ${show ? 110 : 64}px ${M}`;
  x.fillText(show ? String(r.total) : r.verdict.key === "spac" ? "SPAC" : "?", cx, cy + (show ? 30 : 20));
  if (show) { x.fillStyle = "#8B95A3"; x.font = `500 30px ${M}`; x.fillText("/ 100", cx, cy + 78); }
  x.textAlign = "left";
  // 판정
  const vx = 470;
  x.font = `700 64px ${F}`; x.fillStyle = col; x.fillText(r.verdict.label, vx, cy - 40);
  x.font = `400 30px ${F}`; x.fillStyle = "#AEB7C4";
  wrapText(x, r.verdict.tip, W - vx - 72).slice(0, 3).forEach((l, i) => x.fillText(l, vx, cy + 10 + i * 42));
  // 기준별 막대
  let by = cy + R + 110;
  x.font = `500 30px ${F}`;
  r.rows.forEach((row) => {
    x.fillStyle = row.pts == null ? "#6E7683" : "#E9EDF3"; x.fillText(row.f.label, 72, by);
    x.fillStyle = "#AEB7C4"; x.font = `500 28px ${M}`; x.textAlign = "right";
    x.fillText(row.pts == null ? "모름" : fmtVal(row, it), 660, by); x.textAlign = "left"; x.font = `500 30px ${F}`;
    const bx = 690, bw = 200, bh = 14;
    x.fillStyle = "#242A33"; x.fillRect(bx, by - 18, bw, bh);
    if (row.pts != null) { x.fillStyle = col; x.fillRect(bx, by - 18, bw * row.pts / row.f.w, bh); }
    x.fillStyle = "#8B95A3"; x.font = `500 24px ${M}`; x.textAlign = "right"; x.fillText(row.pts == null ? "–" : `${row.pts}/${row.f.w}`, W - 72, by); x.textAlign = "left"; x.font = `500 30px ${F}`;
    by += 62;
  });
  if (r.flags.length) { x.fillStyle = "#FF6B7A"; x.font = `500 28px ${F}`; x.fillText(`⚠ ${r.flags[0]}`, 72, by + 6); }
  // 바닥글
  x.fillStyle = "#6E7683"; x.font = `400 26px ${F}`;
  x.fillText("richroro.github.io/ipo  ·  참고용 점수, 투자 권유가 아닙니다", 72, H - 60);
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const file = new File([blob], `${it.name}-공모주점수.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${it.name} 공모주 점수`, text: `${it.name} — ${r.verdict.label}${show ? ` ${r.total}점` : ""}` }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  download(blob, file.name);
  toast("공유 카드 이미지를 저장했습니다");
}

/* ---------------------------------------------------------------- 내 기록 대시보드 */
function renderMyDash() {
  const dash = $("myDash");
  const done = RECS.filter((r) => r.sell && (r.alloc || 0) > 0);
  dash.hidden = !RECS.length;
  if (!RECS.length) return;
  // 월별 실현 손익 (최근 12개월)
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = toD(TODAY.slice(0, 7) + "-01"); d.setUTCMonth(d.getUTCMonth() - i); months.push(fromD(d).slice(0, 7)); }
  const val = months.map((m) => done.filter((r) => (r.date || "").startsWith(m)).reduce((a, r) => a + (recPnl(r).pnl || 0), 0));
  const box = $("myFig");
  if (!val.some((v) => v)) box.innerHTML = `<p class="empty">매도가를 적은 기록이 생기면 월별 손익을 그립니다.</p>`;
  else {
    const W = Math.max(320, Math.round(box.clientWidth || 560)), H = 200, L = 50, R = 8, T = 16, B = 24;
    const lo = Math.min(0, ...val), hi = Math.max(0, ...val), st = niceStep(hi - lo || 1);
    const a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st || st;
    const y = (v) => T + (b - v) / (b - a) * (H - T - B), bw = (W - L - R) / 12, gap = 6;
    let g = "";
    for (let v = a; v <= b + 1e-6; v += st) g += `<line class="${v === 0 ? "zero" : "gridline"}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v ? manwon(v) : 0}</text>`;
    const bars = val.map((v, i) => {
      const x0 = L + i * bw + gap / 2, w = bw - gap, y0 = y(0), y1 = y(v), h = Math.abs(y1 - y0), r = Math.min(4, w / 2, h), up = v >= 0;
      const d = !v ? "" : up ? `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + w - r}Q${x0 + w},${y1} ${x0 + w},${y1 + r}V${y0}Z`
        : `M${x0},${y0}V${y1 - r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + w - r}Q${x0 + w},${y1} ${x0 + w},${y1 - r}V${y0}Z`;
      return `${d ? `<path d="${d}" fill="var(${up ? "--fill-up" : "--fill-down"})"/>` : ""}
        <text class="axis" x="${x0 + w / 2}" y="${H - 8}" text-anchor="middle">${+months[i].slice(5)}월</text>
        <rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}"/>`;
    }).join("");
    box.innerHTML = `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 12개월 월별 실현 손익 막대그래프">${g}${bars}</svg>`;
    attachTip(box, box.querySelector("svg"), W, H, (i) => {
      const xs = done.filter((r) => (r.date || "").startsWith(months[i]));
      return `<div class="th">${months[i].replace("-", "년 ")}월</div><div class="tr"><span class="nm">실현 손익</span><b class="${cls(val[i])}">${val[i] > 0 ? "+" : ""}${won(val[i])}원</b></div>
        ${xs.slice(0, 4).map((r) => `<div class="tr"><span class="nm">${esc(r.name)}</span><b>${won(recPnl(r).pnl)}</b></div>`).join("")}`;
    });
  }
  // 증권사별
  const by = new Map();
  for (const r of RECS) {
    const k = r.broker || "(미기재)";
    const o = by.get(k) || { n: 0, got: 0, sh: 0, pnl: 0 };
    o.n++; if ((r.alloc || 0) > 0) o.got++; o.sh += r.alloc || 0;
    const p = recPnl(r); if (p.pnl != null && !p.held) o.pnl += p.pnl;
    by.set(k, o);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].pnl - a[1].pnl);
  const wins = done.filter((r) => recPnl(r).pnl > 0).length;
  $("myBroker").innerHTML = `<thead><tr><th>증권사</th><th>청약</th><th>배정</th><th>배정 주수</th><th>실현 손익</th></tr></thead><tbody>${rows.map(([k, o]) =>
    `<tr><td class="tx">${esc(k)}</td><td>${o.n}</td><td>${o.got}<small class="hint"> (${Math.round(o.got / o.n * 100)}%)</small></td><td>${nf.format(o.sh)}</td>
      <td class="${cls(o.pnl)}">${o.pnl > 0 ? "+" : ""}${won(o.pnl)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td class="tx">승률</td><td colspan="4" class="num">${done.length ? `${wins}/${done.length} (${Math.round(wins / done.length * 100)}%) 가 이익으로 끝남` : "매도 기록 없음"}</td></tr></tfoot>`;
}

/* ---------------------------------------------------------------- 휴대폰 아래 탭 · 단축키 */
/* 화면 전환: 홈·일정·분석·도구·내 청약·가이드를 한 번에 하나씩 보여 준다. 주소 끝(#schedule, #calc …)으로 바로 열린다 */
const SCREENS = { home: ["top"], schedule: ["schedule", "calendar"], analysis: ["market", "method"], tools: ["plan", "calc"], my: ["my"], guide: ["guide"] };
const screenOf = (id) => Object.keys(SCREENS).find((k) => k === id || SCREENS[k].includes(id)) || null;
let CUR_SCREEN = "home";
const SCROLL = {};
function showScreen(name, target) {
  if (!SCREENS[name]) name = "home";
  const changed = name !== CUR_SCREEN;
  if (changed) SCROLL[CUR_SCREEN] = window.scrollY;
  CUR_SCREEN = name;
  document.querySelectorAll(".screen").forEach((el) => { el.hidden = el.dataset.screen !== name; });
  const tab = name === "guide" && isPhone() ? "home" : name; // 아래 탭엔 가이드가 없다 — 홈을 켜 둔다
  document.querySelectorAll("[data-go]").forEach((a) => {
    const on = a.dataset.go === name || (a.closest("#tabbar") && a.dataset.go === tab);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.body.dataset.screen = name;
  // 숨어 있을 때 잰 너비로 그린 그래프를 화면 너비로 다시
  const stamp = `${Math.round(innerWidth)}|${scoreCache.size}|${TODAY}|${ITEMS.length}`;
  if (name === "tools" && showScreen.plan !== stamp) { showScreen.plan = stamp; renderPlan(); }
  if (name === "analysis" && ITEMS.length && showScreen.market !== stamp) { showScreen.market = stamp; renderMarket(); }
  if (name === "my") renderMyDash();
  const el = target && target !== name ? document.getElementById(target) : null;
  if (el) nativeScroll.call(el, { block: "start" });
  else if (changed) window.scrollTo(0, SCROLL[name] || 0); // 앱처럼 탭마다 보던 자리로
  if (changed && showScreen.byUser && navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* 진동 없는 기기 */ }
  showScreen.byUser = false;
}
// 다른 코드가 숨은 화면의 섹션으로 scrollIntoView 하면, 그 화면을 먼저 연다
const nativeScroll = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (opt) {
  const scr = this.closest && this.closest(".screen");
  if (scr && scr.hidden) showScreen(scr.dataset.screen);
  return nativeScroll.call(this, opt);
};
function initScreens() {
  const fromHash = () => {
    const h = dec(location.hash.slice(1));
    if (!h) return showScreen("home");  // 뒤로 가기로 맨 처음 주소에 오면 홈
    if (h.startsWith("i=")) return showScreen(CUR_SCREEN);
    const s = screenOf(h);
    if (s) showScreen(s, h);
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const s = screenOf(id);
    if (!s) return;
    e.preventDefault();
    if (a.dataset.go && a.dataset.go === CUR_SCREEN) { window.scrollTo({ top: 0, behavior: motion() }); return; }
    showScreen.byUser = true;
    history.pushState(null, "", `#${s === id ? s : id}`);
    showScreen(s, id);
  });
  window.addEventListener("popstate", fromHash);
  fromHash();
  initScreens.fromHash = fromHash;
}

/* 홈: 다가오는 청약을 옆으로 넘겨 보는 줄 */
function renderRail() {
  const box = $("rail");
  const xs = ITEMS.filter((it) => !it.spac && it.sub_start && (it.sub_end || it.sub_start) >= TODAY)
    .sort((a, b) => a.sub_start.localeCompare(b.sub_start)).slice(0, 10);
  if (!xs.length) { box.innerHTML = `<p class="empty">예정된 청약이 없습니다.</p>`; return; }
  box.innerHTML = xs.map((it) => {
    const s = stage(it), r = scoreOf(it), u = uwRecord(it), e = expectOf(it);
    const d = diffDays(TODAY, it.sub_start);
    const sub = e ? `균등 1주 기대 <b class="${cls(e.won)}">${e.won >= 0 ? "+" : "−"}${won(Math.abs(e.won))}원</b>`
      : u ? `${esc(u.name.replace(/증권$/, ""))} 1년 평균 <b class="${cls(u.avg)}">${pct(u.avg, 0)}</b>` : esc(it.uw.join(", "));
    return `<button type="button" class="rc" data-id="${esc(it.id)}">
      <span class="rc-top"><span class="dd ${s.key === "sub" ? "on" : ""}">${s.key === "sub" ? "청약 중" : `D-${d}`}</span>${verdictChip(r)}</span>
      <b class="rc-nm">${esc(it.name)}</b>
      <span class="rc-dt">${mdw(it.sub_start)} 청약 · ${it.price ? `${won(it.price)}원` : it.band_hi ? `~${won(it.band_hi)}원` : ""}</span>
      <span class="rc-sub">${sub}</span></button>`;
  }).join("");
  box.onclick = (ev) => { const b = ev.target.closest(".rc"); if (b) openDetail(b.dataset.id); };
}

function initKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault(); showScreen("schedule", "schedule"); $("q").focus({ preventScroll: true });
    }
  });
}

/* 휴대폰 바텀 시트: 맨 위에서 아래로 끌면 닫힌다 */
function sheetDrag(dlg) {
  let y0 = null, dy = 0;
  const panel = () => dlg.firstElementChild;
  dlg.addEventListener("pointerdown", (e) => {
    if (!isPhone() || !e.target.closest(".grab, .dlg-top") || e.target.closest("button, a, input")) return;
    if (dlg.scrollTop > 0) return;
    y0 = e.clientY; dy = 0; panel().style.transition = "none";
  });
  window.addEventListener("pointermove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    panel().style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    const p = panel();
    p.style.transition = "";
    if (dy > 110) { p.style.transform = "translateY(100%)"; setTimeout(() => { dlg.close(); p.style.transform = ""; }, 180); }
    else p.style.transform = "";
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}
function initSteppers() {
  document.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
    const inp = document.getElementById(b.dataset.for);
    const v = Math.max(+inp.min || 0, (parseFloat(inp.value) || 0) + +b.dataset.step);
    inp.value = v;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }));
}

/* ---------------------------------------------------------------- 시작 */
document.addEventListener("ipo:ready", () => {
  if (CUR_SCREEN === "tools") renderPlan(); else showScreen.plan = null;
  renderTray(); renderRail();
  // 첫 로드: 목록·그래프가 그려진 뒤에야 #calendar 같은 섹션 위치가 맞다
  if (!initScreens.done) { initScreens.done = true; if (!location.hash.startsWith("#i=")) initScreens.fromHash?.(); }
});
// role="button" 인 줄·타일도 키보드(Enter·Space)로 누를 수 있게
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[role="button"]:not(button)')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener("ipo:records", renderMyDash);
document.addEventListener("ipo:sharecard", (e) => shareCard(e.detail));
initPlan();
initCompare();
initScreens();
sheetDrag($("dlg"));
sheetDrag($("cmpDlg"));
initSteppers();
initKeys();
