/* 계좌 준비 — 다가오는 청약의 주관사 중 계좌가 없는 증권사를, 언제 어떤 순서로 만들면 되는지 짭니다.
   계좌를 새로 만들면 20영업일 동안 다른 계좌를 만들 수 없어서(단기간 다수 계좌 개설 제한) 한 번에 한 곳씩,
   놓치면 아까운 청약이 먼저 오도록 고릅니다.
   계산 부분(plan)은 화면 없이 도는 순수 함수라 tests/acct.test.js 가 같이 씁니다. */
(function (root) {
  "use strict";

  /** s 다음부터 영업일을 n개 센 날 */
  function addBiz(s, n, isBiz, addDays) {
    let d = s;
    for (let k = 0; k < n;) { d = addDays(d, 1); if (isBiz(d)) k++; }
    return d;
  }
  const nextBiz = (s, isBiz, addDays) => { let d = s; while (!isBiz(d)) d = addDays(d, 1); return d; };
  const prevBiz = (s, isBiz, addDays) => { let d = addDays(s, -1); while (!isBiz(d)) d = addDays(d, -1); return d; };

  /**
   * items: 종목들 {id, sub_start, sub_end, uw[]} · own: 가진 증권사 열쇠들 · lastOpen: 마지막으로 계좌를 만든 날(없으면 null)
   * key(u): 증권사 이름 → 열쇠 · weight(it): 놓치면 아까운 정도(판정 기준) · gap: 개설 제한 영업일(20)
   * 돌려주는 것: rows(다가오는 청약마다 상태), steps(만들 순서), first(다음에 만들 수 있는 날)
   */
  function plan({ items, own, lastOpen, today, isBiz, addDays, key, weight, gap = 20, maxSteps = 8 }) {
    const ownSet = new Set(own);
    const rows = items
      .filter((it) => it.sub_start && (it.sub_end || it.sub_start) >= today && (it.uw || []).length)
      .sort((a, b) => a.sub_start.localeCompare(b.sub_start))
      .map((it) => {
        const uws = [];
        for (const u of it.uw) { const k = key(u); if (!uws.some((x) => x.k === k)) uws.push({ u, k }); }
        // 청약 첫날 전 영업일까지 만들어 두면 안전하다. 이미 청약 중이면 마감일(당일 개설·청약이 되는 증권사만)
        const due = it.sub_start > today ? prevBiz(it.sub_start, isBiz, addDays) : it.sub_end || it.sub_start;
        return { it, uws, has: uws.filter((x) => ownSet.has(x.k)), due, w: weight(it), via: null };
      });
    // 다음에 계좌를 만들 수 있는 날: 오늘(영업일 기준) 또는 마지막 개설 뒤 20영업일이 지난 다음 영업일
    let slot = nextBiz(today, isBiz, addDays);
    if (lastOpen) { const free = addBiz(lastOpen, gap + 1, isBiz, addDays); if (free > slot) slot = free; }
    const first = slot;
    const covered = new Set(rows.filter((r) => r.has.length).map((r) => r.it.id));
    const cands = new Map();
    for (const r of rows) for (const x of r.uws) {
      if (ownSet.has(x.k)) continue;
      const c = cands.get(x.k) || { k: x.k, name: x.u, rows: [] };
      if (x.u.length > c.name.length) c.name = x.u;
      c.rows.push(r);
      cands.set(x.k, c);
    }
    const steps = [];
    while (cands.size && steps.length < maxSteps) {
      const after = addBiz(slot, gap + 1, isBiz, addDays); // 이번에 못 만들면 다음 기회
      let best = null;
      for (const c of cands.values()) {
        const reach = c.rows.filter((r) => r.due >= slot && !covered.has(r.it.id));
        if (!reach.length) continue;
        // 지금 안 만들면 놓치는 청약을 두 배로 친다 — 급한 곳부터
        const score = reach.reduce((a, r) => a + r.w * (r.due < after ? 2 : 1), 0);
        const firstDue = reach[0].due;
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && firstDue < best.firstDue)) best = { c, score, reach, firstDue };
      }
      if (!best) break;
      const by = best.reach[0].due; // 이 날까지는 만들어야 첫 청약에 들어간다
      steps.push({ date: slot, by, k: best.c.k, name: best.c.name, gets: best.reach.map((r) => r.it),
        late: best.c.rows.filter((r) => r.due < slot && !covered.has(r.it.id)).map((r) => r.it) });
      for (const r of best.reach) { covered.add(r.it.id); r.via = { k: best.c.k, name: best.c.name, date: slot }; }
      cands.delete(best.c.k);
      slot = after;
    }
    for (const r of rows) r.state = r.has.length ? "ok" : r.via ? "plan" : "late";
    return { rows, steps, first };
  }

  const api = { plan, addBiz };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.IPOAcct = api;
  if (typeof document === "undefined") return;

  /* ---------------------------------------------------------------- 화면 */
  const W = { strong: 3, go: 2, light: 1, pass: 0.2, wait: 1.5, spac: 0.3 };
  const weightOf = (it) => (it.spac ? W.spac : W[scoreOf(it).verdict.key] ?? 1);
  const ownKeys = () => {
    const saved = store.get("ipo.myBrokers", null);
    if (Array.isArray(saved)) return saved;
    // 처음이면 내 청약 기록에 적힌 증권사를 가진 것으로 본다
    return [...new Set(RECS.map((r) => r.broker).filter(Boolean).map(uwKey))];
  };
  const setOwn = (keys) => { store.set("ipo.myBrokers", [...new Set(keys)]); renderAcct(); };
  const lastOpen = () => { const v = store.get("ipo.lastOpen", ""); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };

  function current() {
    return plan({ items: ITEMS, own: ownKeys(), lastOpen: lastOpen(), today: TODAY, isBiz: isBizDay, addDays, key: uwKey, weight: weightOf });
  }

  /** 증권사 목록: 다가오는 청약 주관사 + 지난 1년 주관사. 다가오는 곳이 많은 순, 그다음 지난 1년 횟수 순 */
  function brokerList(rows) {
    const m = new Map();
    const add = (u, f) => { const k = uwKey(u), o = m.get(k) || { k, name: u, up: 0, year: 0 }; if (u.length > o.name.length) o.name = u; o[f]++; m.set(k, o); };
    for (const r of rows) for (const x of r.uws) add(x.u, "up");
    const from = addDays(TODAY, -365);
    for (const it of ITEMS) if (it.list_date && it.list_date >= from && it.list_date <= TODAY) for (const u of it.uw) add(u, "year");
    for (const k of ownKeys()) if (!m.has(k)) m.set(k, { k, name: k, up: 0, year: 0 });
    return [...m.values()].sort((a, b) => b.up - a.up || b.year - a.year || a.name.localeCompare(b.name));
  }

  const vchip = (it) => (it.spac ? `<span class="vd v-pass">스팩</span>` : verdictChip(scoreOf(it)));
  const itLink = (it) => `<button type="button" class="linkish" data-open="${esc(it.id)}">${esc(it.name)}</button>`;

  function renderAcct() {
    const box = $("acctBody");
    if (!box) return;
    if (!ITEMS.length) { box.innerHTML = `<p class="empty">일정을 불러오면 채워집니다.</p>`; return; }
    const own = new Set(ownKeys());
    const { rows, steps, first } = current();
    const list = brokerList(rows);
    const okN = rows.filter((r) => r.state === "ok").length, lateN = rows.filter((r) => r.state === "late").length;
    const chips = list.map((b) => `<button type="button" class="chip ac" data-k="${esc(b.k)}" aria-pressed="${own.has(b.k)}">
      <b>${esc(b.name)}</b><small>${b.up ? `예정 ${b.up}` : ""}${b.up && b.year ? " · " : ""}${b.year ? `1년 ${b.year}회` : ""}</small></button>`).join("");
    const stepHtml = steps.length ? `<ol class="asteps">${steps.map((s, i) => {
      const today = s.date <= TODAY;
      return `<li><div class="ah"><span class="an">${i + 1}</span><div><b>${esc(s.name)}</b>
          <small>${today ? "오늘 만들 수 있어요" : `${mdw(s.date)}부터 만들 수 있어요`} · 늦어도 <b>${mdw(s.by)}</b>까지</small></div>
          ${today ? `<button type="button" class="ghost sm" data-made="${esc(s.k)}">만들었어요</button>` : ""}</div>
        <p class="ag">이 계좌로 청약할 수 있게 되는 곳 ${s.gets.length}곳: ${s.gets.map((it) => `${itLink(it)} <small>${md(it.sub_start)}</small> ${vchip(it)}`).join(" · ")}</p>
        ${s.late.length ? `<p class="hint">이번엔 늦는 곳: ${s.late.map((it) => esc(it.name)).join(", ")}</p>` : ""}</li>`;
    }).join("")}</ol>` : `<p class="empty">${rows.length ? "지금 가진 계좌로 다가오는 청약을 모두 할 수 있어요." : "다가오는 청약이 없습니다."}</p>`;
    const stateTxt = (r) => (r.state === "ok" ? `<span class="aok">청약 가능</span>`
      : r.state === "plan" ? `<span class="aplan">${esc(r.via.name)} 만들면 (${md(r.via.date)})</span>` : `<span class="alate">계좌가 늦음</span>`);
    const table = rows.length ? `<div class="tscroll mt12"><table class="narrow" id="acctTable"><thead><tr><th>종목</th><th>청약</th><th>주관사</th><th>상태</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="tx nm">${itLink(r.it)} ${vchip(r.it)}</td><td data-l="청약">${mdw(r.it.sub_start)}</td>
        <td class="tx" data-l="주관사">${r.uws.map((x) => (own.has(x.k) ? `<b class="own">✓ ${esc(x.u)}</b>` : `<span class="miss">${esc(x.u)}</span>`)).join(" ")}</td>
        <td data-l="상태">${stateTxt(r)}</td></tr>`).join("")}</tbody></table></div>` : "";
    const top = list.filter((b) => b.year).sort((a, b) => b.year - a.year).slice(0, 8);
    box.innerHTML = `
      <div class="card pad"><h3>가진 증권사 계좌</h3><p class="hint mt8">누르면 '있음'으로 표시됩니다(이 기기에만 저장). 가족 계좌는 따로 세지 않습니다.</p>
        <div class="chips achips mt12" role="group" aria-label="가진 증권사">${chips}</div>
        <div class="form mt12"><label class="field"><span>마지막으로 계좌를 만든 날 (은행 포함, 모르면 비움)</span>
          <input id="acctLast" type="date" value="${esc(lastOpen() || "")}" max="${TODAY}"></label></div></div>
      <div class="stats c4 mt16">
        <div class="st"><div class="k">지금 계좌로 청약 가능</div><div class="v">${okN}<span class="u">/${rows.length}곳</span></div><div class="s">다가오는 청약 중</div></div>
        <div class="st"><div class="k">만들 증권사</div><div class="v">${steps.length}<span class="u">곳</span></div><div class="s">${steps.length ? `먼저 ${esc(steps[0].name)}` : "없음"}</div></div>
        <div class="st"><div class="k">다음에 만들 수 있는 날</div><div class="v">${first <= TODAY ? "오늘" : md(first)}</div><div class="s">${lastOpen() ? `${md(lastOpen())} 개설 뒤 20영업일` : "마지막 개설일을 넣으면 정확해요"}</div></div>
        <div class="st"><div class="k">계좌 때문에 놓치는 곳</div><div class="v ${lateN ? "down" : ""}">${lateN}<span class="u">곳</span></div><div class="s">${lateN ? "20영업일 제한으로 시간이 모자람" : "없음"}</div></div>
      </div>
      <div class="card pad mt16"><h3>만들 순서</h3><p class="hint mt8">놓치면 아까운 청약(판정이 좋은 곳, 곧 청약하는 곳)이 먼저 오도록 골랐습니다. 한 곳을 만든 뒤 20영업일이 지나야 다음 곳을 만들 수 있어요.</p>
        ${stepHtml}</div>
      ${table ? `<div class="card mt16">${table}</div>` : ""}
      ${top.length ? `<div class="card pad mt16"><h3>자주 주관한 증권사 — 지난 1년</h3><p class="hint mt8">당장 청약이 없어도 이런 곳은 미리 만들어 두면 기회가 많습니다.</p>
        <ul class="afreq mt12">${top.map((b) => `<li><b>${esc(b.name)}</b><span class="mb"><i style="width:${Math.round(b.year / top[0].year * 100)}%"></i></span><small>${b.year}회</small>${own.has(b.k) ? `<em class="aok">있음</em>` : `<em>없음</em>`}</li>`).join("")}</ul></div>` : ""}
      <p class="hint mt12">20영업일 제한은 은행·증권사 입출금 계좌를 합쳐 셉니다(대포통장 방지). 증권사마다 비대면 개설 뒤 바로 청약되는지, 청약 전날까지 만들어야 하는지 달라서
        '늦어도' 날짜는 청약 첫날 전 영업일로 잡았습니다. 한 종목은 한 증권사에서만 청약할 수 있습니다(중복 청약 금지).</p>`;
  }

  /** 홈: 다음 청약에 필요한 계좌 한 줄 */
  function renderAcctHint() {
    const box = $("acctHint");
    if (!box) return;
    if (!ITEMS.length) { box.innerHTML = ""; return; }
    const set = Array.isArray(store.get("ipo.myBrokers", null));
    const { steps } = current();
    const s = steps[0];
    const soon = s && diffDays(TODAY, s.by) <= 21;
    if (set && !soon) { box.innerHTML = ""; return; }
    box.innerHTML = `<a class="cta acta" href="#acct"><span><b>${set ? `${esc(s.name)} 계좌를 ${s.by <= TODAY ? "오늘" : `${mdw(s.by)}까지`} 만드세요` : "가진 증권사를 표시해 두세요"}</b>
      <small>${set ? `${s.gets.slice(0, 2).map((it) => esc(it.name)).join(", ")}${s.gets.length > 2 ? ` 외 ${s.gets.length - 2}곳` : ""} 청약용 · 20영업일 제한 고려` : "미리 만들어야 할 증권사와 날짜를 알려 드려요"}</small></span><i aria-hidden="true">›</i></a>`;
  }

  function initAcct() {
    const box = $("acctBody");
    if (!box) return;
    box.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip.ac");
      if (chip) { const own = new Set(ownKeys()); own.has(chip.dataset.k) ? own.delete(chip.dataset.k) : own.add(chip.dataset.k); setOwn([...own]); renderAcctHint(); return; }
      const made = e.target.closest("[data-made]");
      if (made) { store.set("ipo.lastOpen", TODAY); setOwn([...ownKeys(), made.dataset.made]); renderAcctHint(); toast?.(`계좌를 표시했어요. 다음 계좌는 20영업일 뒤부터`); return; }
      const open = e.target.closest("[data-open]");
      if (open) openDetail(open.dataset.open);
    });
    box.addEventListener("change", (e) => {
      if (e.target.id === "acctLast") { store.set("ipo.lastOpen", e.target.value || ""); renderAcct(); renderAcctHint(); }
    });
  }

  document.addEventListener("ipo:ready", () => { renderAcct(); renderAcctHint(); });
  document.addEventListener("ipo:records", () => { if (!Array.isArray(store.get("ipo.myBrokers", null))) { renderAcct(); renderAcctHint(); } });
  initAcct();
  root.renderAcct = renderAcct;
})(typeof self !== "undefined" ? self : this);
