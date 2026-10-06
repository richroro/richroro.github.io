/* 공모주 캘린더 — 내 청약 여정: 청약했어요 → 배정 결과 → 매도까지 한 번씩 눌러 기록하고, 홈에 '내 할 일'로 띄운다.
   기록은 app.js 의 RECS(내 청약 기록)에 그대로 쌓는다. 종목과는 iid(38 번호)로, 없으면 이름으로 잇는다. */
"use strict";

(function () {
  const norm = (s) => String(s || "").replace(/\s+/g, "");
  const recOf = (it) => RECS.find((r) => r.iid === it.id) || RECS.find((r) => !r.iid && norm(r.name) === norm(it.name));
  const itemOf = (r) => (r.iid && BY_ID.get(r.iid)) || ITEMS.find((x) => norm(x.name) === norm(r.name)) || null;
  const minQty = () => numOf("cMin") || 10;
  const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  /** 내 증권사(계좌 준비에서 표시) 가운데 이 종목 주관사가 있으면 그것, 없으면 첫 주관사 */
  const myBroker = (it) => {
    const own = new Set(Array.isArray(store.get("ipo.myBrokers", null)) ? store.get("ipo.myBrokers", []) : []);
    return it.uw.find((u) => own.has(uwKey(u))) || it.uw[0] || "";
  };

  /* -------------------------------------------------------------- 청약 기록 시트 */
  const dlg = document.createElement("dialog");
  dlg.id = "qDlg";
  dlg.setAttribute("aria-labelledby", "qTitle");
  document.body.appendChild(dlg);
  let ctx = null; // { mode: "apply" | "alloc" | "sell", it, rec }

  function sheet(mode, it, rec) {
    ctx = { mode, it, rec };
    const p = offerPrice(it) || rec?.price || 0;
    const mg = (numOf("cMargin") ?? 50) / 100;
    let body = "";
    if (mode === "apply") {
      const q = rec?.applied || minQty(), bk = rec?.broker || myBroker(it);
      body = `<p class="hint">${it.sub_start ? `청약 ${mdw(it.sub_start)}${it.sub_end && it.sub_end !== it.sub_start ? `~${mdw(it.sub_end)}` : ""} · ` : ""}${p ? `공모가 ${won(p)}원${it.price ? "" : "(밴드 상단)"}` : ""}</p>
        ${it.uw.length ? `<div class="q-l">어느 증권사로 했나요?</div><div class="chips q-bk" role="radiogroup" aria-label="증권사">${it.uw.map((u) =>
          `<button type="button" class="chip" role="radio" data-bk="${esc(u)}" aria-checked="${u === bk}">${esc(u)}</button>`).join("")}</div>` : ""}
        <div class="q-l">몇 주 청약했나요?</div>
        <div class="q-qty"><span class="stepper"><button type="button" data-d="-10" aria-label="10주 빼기">−</button><input id="qQty" type="number" inputmode="numeric" min="1" step="10" value="${q}" aria-label="청약 주수"><button type="button" data-d="10" aria-label="10주 더하기">+</button></span>
          <div class="q-dep"><small>증거금</small><b id="qDep" class="num">${p ? `${won(p * q * mg)}원` : "–"}</b></div></div>
        <div class="chips q-pre">${[minQty(), minQty() * 2, minQty() * 5, minQty() * 10, minQty() * 50].map((n) => `<button type="button" class="chip" data-q="${n}">${nf.format(n)}주</button>`).join("")}</div>`;
    } else if (mode === "alloc") {
      body = `<p class="hint">${it.refund ? `${mdw(it.refund)} 환불일에 ` : ""}증권사 앱에서 배정 주수를 확인해 적어 주세요. 0주도 기록해 두면 배정률 통계에 쓰입니다.</p>
        <div class="q-l">배정받은 주수</div>
        <div class="chips q-pre">${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip" data-a="${n}">${n}주</button>`).join("")}</div>
        <div class="q-qty"><span class="stepper"><button type="button" data-d="-1" aria-label="1주 빼기">−</button><input id="qQty" type="number" inputmode="numeric" min="0" step="1" value="${rec?.alloc ?? 1}" aria-label="배정 주수"><button type="button" data-d="1" aria-label="1주 더하기">+</button></span></div>`;
    } else {
      const opts = [["시초가", it.open], ["첫날 종가", it.close1], ["현재가", it.cur]].filter(([, v]) => v);
      body = `<p class="hint">${nf.format(rec.alloc)}주 · 공모가 ${won(rec.price || p)}원</p>
        ${opts.length ? `<div class="q-l">얼마에 팔았나요?</div><div class="q-sells">${opts.map(([k, v]) => {
          const pl = (v - (rec.price || p)) * rec.alloc;
          return `<button type="button" class="q-sell" data-s="${v}"><span>${k}</span><b class="num">${won(v)}원</b><small class="${cls(pl)}">${pl >= 0 ? "+" : "−"}${won(Math.abs(pl))}원</small></button>`;
        }).join("")}</div>` : ""}
        <div class="q-l">직접 입력</div>
        <div class="q-qty"><input id="qQty" type="number" inputmode="numeric" min="0" step="10" placeholder="매도가(원)" aria-label="매도가" value="${rec.sell || ""}"></div>`;
    }
    const title = mode === "apply" ? (rec ? "청약 기록 고치기" : "청약했어요") : mode === "alloc" ? "배정 결과" : "매도 기록";
    dlg.innerHTML = `<div class="q-in"><div class="grab" aria-hidden="true"></div>
      <div class="q-top"><div><b id="qTitle">${title}</b><small>${esc(it.name)}</small></div>
        <button class="ghost icon" type="button" data-x aria-label="닫기">${ico("close")}</button></div>
      <div class="q-body">${body}</div>
      <div class="q-foot">${mode === "sell" ? `<button class="ghost" type="button" data-hold>아직 보유 중</button>` : rec && mode === "apply" ? `<button class="ghost" type="button" data-del>기록 지우기</button>` : ""}
        <button class="btn" type="button" data-save>${mode === "apply" ? "기록하기" : "저장"}</button></div></div>`;
    dlg.showModal();
    if (!isPhone()) dlg.querySelector("#qQty")?.focus();
  }

  const recalc = () => {
    if (ctx?.mode !== "apply") return;
    const p = offerPrice(ctx.it), q = +$("qQty").value || 0;
    $("qDep").textContent = p ? `${won(p * q * (numOf("cMargin") ?? 50) / 100)}원` : "–";
  };
  dlg.addEventListener("input", recalc);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-x]")) { dlg.close(); return; }
    const t = e.target;
    const d = t.closest("[data-d]");
    if (d) { const inp = $("qQty"); inp.value = Math.max(+inp.min || 0, (+inp.value || 0) + +d.dataset.d); recalc(); return; }
    const bk = t.closest("[data-bk]");
    if (bk) { dlg.querySelectorAll("[data-bk]").forEach((b) => b.setAttribute("aria-checked", b === bk)); return; }
    const q = t.closest("[data-q]");
    if (q) { $("qQty").value = q.dataset.q; recalc(); return; }
    const a = t.closest("[data-a]");
    if (a) { setAlloc(ctx.rec, +a.dataset.a); dlg.close(); return; }
    const s = t.closest("[data-s]");
    if (s) { setSell(ctx.rec, +s.dataset.s); dlg.close(); return; }
    if (t.closest("[data-hold]")) { ctx.rec.hold = true; commit("보유 중으로 두었어요"); dlg.close(); return; }
    if (t.closest("[data-del]")) { RECS = RECS.filter((r) => r !== ctx.rec); commit("기록을 지웠어요"); dlg.close(); return; }
    if (t.closest("[data-save]")) save();
  });
  dlg.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "qQty") { e.preventDefault(); save(); } });

  function save() {
    const { mode, it } = ctx;
    const v = $("qQty").value.trim();
    if (mode === "apply") {
      const applied = Math.max(1, Math.round(+v || minQty()));
      const broker = dlg.querySelector('[data-bk][aria-checked="true"]')?.dataset.bk || myBroker(it);
      const rec = ctx.rec || { id: newId(), alloc: null, sell: null, fee: numOf("cFee") ?? 2000 };
      Object.assign(rec, { iid: it.id, name: it.name, broker, date: it.sub_end || it.sub_start || TODAY, applied, price: offerPrice(it) });
      if (!ctx.rec) RECS.push(rec);
      commit(ctx.rec ? "청약 기록을 고쳤어요" : `기록했어요${it.refund ? ` · ${md(it.refund)}에 배정 확인` : ""}`);
    } else if (mode === "alloc") {
      if (v === "") return;
      setAlloc(ctx.rec, Math.max(0, Math.round(+v)));
    } else {
      if (!(+v > 0)) return;
      setSell(ctx.rec, Math.round(+v));
    }
    dlg.close();
  }
  function setAlloc(rec, n) {
    rec.alloc = n;
    // 확정 공모가가 기록 뒤에 정해졌으면 맞춰 둔다
    const it = itemOf(rec);
    if (it && it.price) rec.price = it.price;
    commit(n ? `${n}주 배정 기록` : "0주 — 다음 청약에서 만나요");
  }
  function setSell(rec, price) {
    rec.sell = price; delete rec.hold;
    const { pnl } = recPnl(rec);
    if (pnl > 0) emit("ipo:celebrate", pnl);
    commit(pnl == null ? "매도가를 기록했어요" : `실현 손익 ${pnl >= 0 ? "+" : "−"}${won(Math.abs(pnl))}원`);
  }
  function commit(msg) {
    saveRecs();
    renderTodo();
    // 열린 상세가 있으면 버튼 상태를 맞춘다
    const d = $("dlg");
    if (d.open && openDetail.cur) openDetail(openDetail.cur, openDetail.tab);
    if (msg) toast(msg);
  }

  /* -------------------------------------------------------------- 홈: 내 할 일 */
  const box = document.createElement("section");
  box.className = "todo";
  box.id = "todo";
  box.setAttribute("aria-label", "내 할 일");
  box.hidden = true;
  $("today")?.after(box);

  /** 지금 해야 할 일 — 급한 순 */
  function tasks() {
    const out = [];
    for (const r of RECS) {
      const it = itemOf(r);
      if (!it) continue;
      if (r.alloc == null && it.refund && it.refund <= TODAY && it.refund >= addDays(TODAY, -60)) out.push({ k: "alloc", it, r, w: 1 });
      else if ((r.alloc || 0) > 0 && r.sell == null && !r.hold && it.list_date && it.list_date <= TODAY && it.list_date >= addDays(TODAY, -30))
        out.push({ k: "sell", it, r, w: it.list_date === TODAY ? 0 : 2 });
      else if ((r.alloc || 0) > 0 && r.sell == null && it.list_date && it.list_date > TODAY && diffDays(TODAY, it.list_date) <= 7)
        out.push({ k: "list", it, r, w: 4 });
      else if (r.alloc == null && it.refund && it.refund > TODAY && diffDays(TODAY, it.refund) <= 3) out.push({ k: "wait", it, r, w: 5 });
    }
    // 오늘·내일 마감인 청약 가운데 판정이 괜찮거나 관심 표시한 곳인데 아직 기록이 없으면
    for (const it of ITEMS) {
      if (it.spac || !it.sub_start || recOf(it)) continue;
      const end = it.sub_end || it.sub_start;
      if (it.sub_start > TODAY || end < TODAY) continue;
      const v = scoreOf(it).verdict.key;
      if (!["strong", "go", "light"].includes(v) && !stars.has(it.id)) continue;
      out.push({ k: "apply", it, w: end === TODAY ? 0.5 : 3 });
    }
    return out.sort((a, b) => a.w - b.w);
  }

  function renderTodo() {
    if (!ITEMS.length) { box.hidden = true; return; }
    const xs = tasks();
    box.hidden = !xs.length;
    if (!xs.length) { box.innerHTML = ""; return; }
    const li = (t) => {
      const { it, r } = t, nm = `<b class="t-nm">${esc(it.name)}</b>`;
      if (t.k === "apply") {
        const end = it.sub_end || it.sub_start;
        return `<li class="t-apply"><div class="t-h">${nm}${verdictChip(scoreOf(it))}</div>
          <p>${end === TODAY ? "<b>오늘 16시</b> 청약 마감" : `${mdw(end)} 16시 마감`} · ${esc(myBroker(it))}${it.uw.length > 1 ? ` 외 ${it.uw.length - 1}곳` : ""}</p>
          <div class="t-acts"><button class="btn sm" type="button" data-t="apply" data-id="${esc(it.id)}">${ico("check", "sm")}청약했어요</button>
            <button class="ghost sm" type="button" data-open="${esc(it.id)}" data-tab="sub">증권사 고르기</button></div></li>`;
      }
      if (t.k === "alloc") return `<li><div class="t-h">${nm}<span class="t-tag">배정 결과</span></div>
          <p>${mdw(it.refund)} 환불 · ${esc(r.broker || "")} ${r.applied ? `${nf.format(r.applied)}주 청약` : ""}. 몇 주 받았나요?</p>
          <div class="t-acts chips">${[0, 1, 2, 3].map((n) => `<button class="chip" type="button" data-t="a" data-r="${esc(r.id)}" data-n="${n}">${n}주</button>`).join("")}
            <button class="chip" type="button" data-t="alloc" data-r="${esc(r.id)}">직접</button></div></li>`;
      if (t.k === "sell") {
        const pl = it.open ? (it.open - (r.price || it.price)) * r.alloc : null;
        return `<li><div class="t-h">${nm}<span class="t-tag up">${it.list_date === TODAY ? "오늘 상장" : "상장"}</span></div>
          <p>${nf.format(r.alloc)}주 보유 · ${it.open ? `시초가 <b class="num">${won(it.open)}원</b> <span class="${cls(pl)}">(${pct((it.open / (r.price || it.price) - 1) * 100, 0)})</span>` : "시초가가 나오면 알려 드려요"}</p>
          <div class="t-acts">${it.open ? `<button class="btn sm" type="button" data-t="s" data-r="${esc(r.id)}" data-v="${it.open}">시초가에 팔았어요</button>` : ""}
            <button class="ghost sm" type="button" data-t="sell" data-r="${esc(r.id)}">다른 가격</button>
            <button class="ghost sm" type="button" data-t="hold" data-r="${esc(r.id)}">보유 중</button></div></li>`;
      }
      if (t.k === "list") return `<li class="t-info" role="button" tabindex="0" data-open="${esc(it.id)}" data-tab="list"><div class="t-h">${nm}<span class="t-tag">상장 D-${diffDays(TODAY, it.list_date)}</span></div>
          <p>${nf.format(r.alloc)}주 배정 · ${mdw(it.list_date)} 09:00 시초가 — 매도 계획 세우기${ico("right", "sm")}</p></li>`;
      return `<li class="t-info"><div class="t-h">${nm}<span class="t-tag">배정 대기</span></div><p>${mdw(it.refund)} 환불일에 배정 결과를 물어볼게요</p></li>`;
    };
    box.innerHTML = `<h3 class="todo-h">${ico("check", "sm")}내 할 일<small>${xs.filter((t) => !["list", "wait"].includes(t.k)).length || ""}</small></h3><ul>${xs.slice(0, 5).map(li).join("")}</ul>
      ${xs.length > 5 ? `<a class="more-link" href="#my">나머지 ${xs.length - 5}개는 내 청약에서${ico("right", "sm")}</a>` : ""}`;
  }

  box.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o && !e.target.closest("[data-t]")) { openDetail(o.dataset.open, o.dataset.tab); return; }
    const b = e.target.closest("[data-t]");
    if (!b) return;
    const r = b.dataset.r && RECS.find((x) => x.id === b.dataset.r), it = r ? itemOf(r) : BY_ID.get(b.dataset.id);
    if (!it) return;
    const k = b.dataset.t;
    if (k === "apply") sheet("apply", it, null);
    else if (k === "a") setAlloc(r, +b.dataset.n);
    else if (k === "alloc") sheet("alloc", it, r);
    else if (k === "s") setSell(r, +b.dataset.v);
    else if (k === "sell") sheet("sell", it, r);
    else if (k === "hold") { r.hold = true; commit("보유 중으로 두었어요"); }
  });

  /* 상세의 '청약했어요' · '내 청약에 기록' 버튼 */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#dlg [data-act=applied]");
    if (!b) return;
    const it = BY_ID.get(openDetail.cur);
    if (!it) return;
    const r = recOf(it);
    const s = stage(it).key;
    if (r && (s === "wait" || s === "listed" || s === "past") && r.alloc == null && it.refund && it.refund <= TODAY) sheet("alloc", it, r);
    else if (r && (r.alloc || 0) > 0 && it.list_date && it.list_date <= TODAY && r.sell == null) sheet("sell", it, r);
    else sheet("apply", it, r || null);
  });

  /** 상세에 넣을 상태 한 줄(app.js 가 부른다) */
  function detailState(it) {
    const r = recOf(it);
    if (!r) return "";
    const done = (r.alloc || 0) > 0 && r.sell ? `${won(r.sell)}원에 매도 · ${(() => { const p = recPnl(r).pnl; return p == null ? "" : `${p >= 0 ? "+" : "−"}${won(Math.abs(p))}원`; })()}`
      : (r.alloc || 0) > 0 ? `${nf.format(r.alloc)}주 배정${r.hold ? " · 보유 중" : ""}`
      : r.alloc === 0 ? "미배정(0주)" : `${esc(r.broker || "")} ${r.applied ? `${nf.format(r.applied)}주` : ""} 청약함 · 배정 결과 대기`;
    return `<div class="mystate">${ico("check", "sm")}<span><b>내 청약</b> ${done}</span></div>`;
  }
  const applyLabel = (it) => {
    const r = recOf(it);
    if (!r) return "청약했어요";
    if (r.alloc == null && it.refund && it.refund <= TODAY) return "배정 결과 적기";
    if ((r.alloc || 0) > 0 && it.list_date && it.list_date <= TODAY && r.sell == null) return "매도가 적기";
    return "청약 기록 고치기";
  };

  document.addEventListener("ipo:ready", renderTodo);
  document.addEventListener("ipo:records", () => { if (!dlg.open) renderTodo(); });
  if (typeof sheetDrag === "function") sheetDrag(dlg);
  self.JOURNEY = { recOf, detailState, applyLabel, renderTodo, sheet };
})();
