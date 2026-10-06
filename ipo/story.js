/* 공모주 캘린더 — 즐거움 담당: 이번 주 브리핑(스토리), 나의 공모주 결산, 이익 축하 꽃가루, 숫자 올라가기.
   app.js · extra.js · journey.js 의 전역(ITEMS, scoreOf, ring, keyTiles, timeline, RECS, recPnl …)을 그대로 쓴다. */
"use strict";

(function () {
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vib = (ms) => { try { navigator.vibrate?.(ms); } catch (e) { /* 진동 없는 기기 */ } };

  /* -------------------------------------------------------------- 숫자 올라가기 */
  /** el 안의 첫 숫자를 0부터 그 값까지 올린다(쉼표·부호 유지) */
  function countUp(el, ms = 700) {
    if (!el || reduced()) return;
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!node) return;
    const m = node.textContent.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/s);
    if (!m) return;
    const to = parseFloat(m[2].replace(/,/g, "")), dec = (m[2].split(".")[1] || "").length;
    if (!isFinite(to) || to === 0) return;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3, v = to * e;
      node.textContent = m[1] + (dec ? v.toFixed(dec) : nf.format(Math.round(v))) + m[3];
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* -------------------------------------------------------------- 꽃가루 */
  function celebrate() {
    vib([10, 40, 18]);
    if (reduced()) return;
    const c = document.createElement("canvas");
    c.className = "confetti";
    const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
    document.body.appendChild(c);
    const x = c.getContext("2d"), cols = ["#FFD43B", "#111111", "#E0313B", "#1098AD", "#F08C00", "#D6336C"];
    const ps = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.55, vx: (Math.random() - 0.5) * 26 * devicePixelRatio,
      vy: -(14 + Math.random() * 20) * devicePixelRatio, r: (4 + Math.random() * 6) * devicePixelRatio, a: Math.random() * 6,
      va: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0], s: Math.random() < 0.5,
    }));
    const t0 = performance.now();
    const step = (t) => {
      const k = (t - t0) / 1800;
      x.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += 0.9 * devicePixelRatio; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.a += p.va;
        x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.globalAlpha = Math.max(0, 1 - k * k); x.fillStyle = p.c;
        if (p.s) x.fillRect(-p.r, -p.r / 2.4, p.r * 2, p.r / 1.2); else { x.beginPath(); x.arc(0, 0, p.r / 1.6, 0, 7); x.fill(); }
        x.restore();
      }
      if (k < 1) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }

  /* -------------------------------------------------------------- 이번 주 브리핑(스토리) */
  const seen = store.get("ipo.seen", {}) || {};
  const sig = (it) => `${it.price || ""}|${it.inst_comp || ""}|${it.sub_comp || ""}|${it.open || ""}`; // 숫자가 바뀌면 다시 '새 소식'
  const isSeen = (it) => seen[it.id] === sig(it);

  function storyItems() {
    const wk = addDays(TODAY, 7);
    const xs = ITEMS.filter((it) => !it.spac && (
      (it.sub_start && it.sub_start <= wk && (it.sub_end || it.sub_start) >= TODAY) ||
      (it.list_date && it.list_date >= TODAY && it.list_date <= wk) ||
      (it.fc_end && it.fc_end <= TODAY && it.fc_end >= addDays(TODAY, -3) && it.sub_start > TODAY)));
    const rank = (it) => {
      const s = stage(it).key;
      if (s === "sub") return `0${it.sub_end || it.sub_start}`;
      if (it.list_date === TODAY) return `1`;
      if (s === "pre" || s === "fc") return `2${it.sub_start}`;
      return `3${it.list_date || ""}`;
    };
    return xs.sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, 14);
  }
  const tagOf = (it) => {
    const s = stage(it).key, end = it.sub_end || it.sub_start;
    if (s === "sub") return end === TODAY ? "오늘 마감" : "청약 중";
    if (it.list_date === TODAY) return "오늘 상장";
    if (s === "wait" && it.list_date) return `상장 D-${diffDays(TODAY, it.list_date)}`;
    if (it.sub_start) return `청약 D-${diffDays(TODAY, it.sub_start)}`;
    return stage(it).label;
  };

  const rail = document.createElement("div");
  rail.className = "stories";
  rail.id = "stories";
  rail.setAttribute("role", "list");
  rail.setAttribute("aria-label", "이번 주 공모주 브리핑");
  document.querySelector(".home .hello")?.after(rail);
  let LIST = [];

  function renderRail() {
    LIST = storyItems();
    rail.hidden = !LIST.length;
    rail.innerHTML = LIST.map((it, i) => {
      const r = scoreOf(it);
      return `<button type="button" role="listitem" class="sb v-${r.verdict.key}${isSeen(it) ? " seen" : ""}" data-i="${i}" aria-label="${esc(`${it.name} ${tagOf(it)} 브리핑 보기`)}">
        <span class="sb-ring"><span class="sb-in">${esc([...it.name].slice(0, 2).join(""))}</span></span>
        <b>${esc(it.name)}</b><small>${esc(tagOf(it))}</small></button>`;
    }).join("");
  }
  rail.addEventListener("click", (e) => { const b = e.target.closest(".sb"); if (b) openStory(+b.dataset.i); });

  const dlg = document.createElement("dialog");
  dlg.id = "stDlg";
  dlg.setAttribute("aria-label", "이번 주 공모주 브리핑");
  document.body.appendChild(dlg);
  const DUR = 7000;
  let cur = 0, t0 = 0, held = 0, paused = false, raf = 0;

  function insight(it) {
    const r = scoreOf(it), e = expectOf(it), u = uwRecord(it), out = [];
    if (it.inst_comp) out.push(`기관경쟁률 <b>${comp(it.inst_comp)}</b>${it.lockup != null ? ` · 확약 <b>${pct(it.lockup, 1).replace("+", "")}</b>` : ""}`);
    if (e) out.push(`균등 1주 기대 <b class="${cls(e.won)}">${e.won >= 0 ? "+" : "−"}${won(Math.abs(e.won))}원</b>`);
    else if (u) out.push(`${esc(u.name)} 1년 시초가 평균 <b class="${cls(u.avg)}">${pct(u.avg, 0)}</b>`);
    if (it.open && it.price) out.push(`시초가 <b class="${cls(it.open - it.price)}">${pct((it.open / it.price - 1) * 100, 0)}</b>`);
    if (r.flags.length) out.push(`<span class="warn">${ico("alert", "sm")}${esc(r.flags[0])}</span>`);
    return out;
  }

  function slide(i) {
    const it = LIST[i], r = scoreOf(it), s = stage(it);
    const rec = self.JOURNEY && JOURNEY.recOf(it);
    const canApply = s.key === "sub" || s.key === "pre" || s.key === "fc";
    seen[it.id] = sig(it); store.set("ipo.seen", seen);
    dlg.className = `v-${r.verdict.key}`;
    dlg.innerHTML = `<div class="st-in">
      <div class="st-bars">${LIST.map((_, k) => `<i class="${k < i ? "done" : ""}"><b style="width:${k < i ? 100 : 0}%"></b></i>`).join("")}</div>
      <div class="st-top"><span class="st-av">${esc([...it.name].slice(0, 2).join(""))}</span><div><b>${esc(it.name)}</b><small>${esc(tagOf(it))} · ${i + 1}/${LIST.length}</small></div>
        <button class="ghost icon" type="button" data-x aria-label="닫기">${ico("close")}</button></div>
      <div class="st-body">
        <div class="st-hero">${ring(r, 150, it)}<div class="st-v">${verdictChip(r, true)}<p>${esc(r.pending ? "수요예측 결과가 나오면 점수를 매깁니다" : r.verdict.tip)}</p></div></div>
        <ul class="st-ins">${insight(it).map((x) => `<li>${x}</li>`).join("")}</ul>
        ${timeline(it)}
        <div class="kv kv4">${keyTiles(it).map(([k, v]) => `<div><i>${k}</i><b>${v}</b></div>`).join("")}</div>
      </div>
      <div class="st-foot">
        <button class="ghost" type="button" data-star aria-pressed="${stars.has(it.id)}">${ico("star")}관심</button>
        ${canApply && self.JOURNEY ? `<button class="ghost" type="button" data-apply>${ico("check")}${rec ? "기록됨" : "청약했어요"}</button>` : ""}
        <button class="btn" type="button" data-more>자세히 보기${ico("right", "sm")}</button></div>
      <button class="st-nav prev" type="button" data-nav="-1" aria-label="이전"></button><button class="st-nav next" type="button" data-nav="1" aria-label="다음"></button>
    </div>`;
    cur = i; t0 = performance.now(); held = 0; paused = false;
  }
  function tick(t) {
    if (!dlg.open) return;
    const bar = dlg.querySelector(`.st-bars i:nth-child(${cur + 1}) b`);
    if (!paused) {
      const k = Math.min(1, (t - t0 - held) / DUR);
      if (bar) bar.style.width = `${k * 100}%`;
      if (k >= 1) { go(1); }
    }
    raf = requestAnimationFrame(tick);
  }
  let pausedAt = 0;
  const pause = (on) => {
    if (on === paused) return;
    paused = on;
    if (on) pausedAt = performance.now(); else held += performance.now() - pausedAt;
  };
  function go(d) {
    const n = cur + d;
    if (n < 0) { t0 = performance.now(); held = 0; return; }
    if (n >= LIST.length) { dlg.close(); return; }
    dlg.dataset.dir = d > 0 ? "next" : "prev";
    slide(n); vib(4);
  }
  function openStory(i) {
    if (!LIST.length) return;
    slide(i);
    dlg.showModal();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  dlg.addEventListener("close", () => { cancelAnimationFrame(raf); renderRail(); });
  dlg.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-x]") || t === dlg) { dlg.close(); return; }
    const it = LIST[cur];
    if (t.closest("[data-more]")) { dlg.close(); openDetail(it.id); return; }
    if (t.closest("[data-star]")) { toggleStar(it.id); t.closest("[data-star]").setAttribute("aria-pressed", stars.has(it.id)); toast(stars.has(it.id) ? "관심 종목에 담았어요" : "관심 종목에서 뺐어요"); return; }
    if (t.closest("[data-apply]")) { pause(true); JOURNEY.sheet("apply", it, JOURNEY.recOf(it) || null); return; }
    const nav = t.closest("[data-nav]");
    if (nav && !nav.dataset.held) go(+nav.dataset.nav);
    if (nav) delete nav.dataset.held;
  });
  // 누르고 있으면 멈춤, 아래로 밀면 닫힘
  let py = 0, pt = 0, px = 0;
  dlg.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button:not(.st-nav), a")) return;
    py = e.clientY; px = e.clientX; pt = performance.now();
    pause(true);
  });
  dlg.addEventListener("pointerup", (e) => {
    const long = performance.now() - pt > 260, dy = e.clientY - py, dx = e.clientX - px;
    const nav = e.target.closest(".st-nav");
    if (nav && long) nav.dataset.held = "1";
    pause(false);
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) dlg.close();
    else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) && !nav) go(dx < 0 ? 1 : -1);
  });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === " ") { e.preventDefault(); pause(!paused); }
  });
  // 청약 기록 시트가 닫히면 다시 흐른다
  document.addEventListener("close", (e) => { if (e.target.id === "qDlg" && dlg.open) { pause(false); slide(cur); } }, true);

  /* -------------------------------------------------------------- 나의 공모주 결산 */
  const wrapBox = document.createElement("div");
  wrapBox.id = "wrapped";
  wrapBox.hidden = true;
  $("mySum")?.before(wrapBox);

  function wrapped() {
    const yr = TODAY.slice(0, 4);
    const xs = RECS.filter((r) => (r.date || "").startsWith(yr));
    if (!xs.length) return null;
    const done = xs.filter((r) => r.sell && (r.alloc || 0) > 0).map((r) => ({ r, p: recPnl(r).pnl })).filter((y) => y.p != null);
    const total = done.reduce((a, y) => a + y.p, 0);
    const got = xs.filter((r) => (r.alloc || 0) > 0);
    const known = xs.filter((r) => r.alloc != null);
    const best = done.reduce((a, y) => (!a || y.p > a.p ? y : a), null);
    const wins = done.filter((y) => y.p > 0).length;
    const shares = got.reduce((a, r) => a + (r.alloc || 0), 0);
    const brokers = new Map();
    for (const r of xs) if (r.broker) brokers.set(r.broker, (brokers.get(r.broker) || 0) + 1);
    const fav = [...brokers.entries()].sort((a, b) => b[1] - a[1])[0];
    return { yr, n: xs.length, total, done: done.length, wins, got: got.length, known: known.length, best, shares, fav };
  }

  function renderWrapped() {
    const w = wrapped();
    wrapBox.hidden = !w;
    if (!w) return;
    wrapBox.className = "wrapped";
    wrapBox.innerHTML = `<div class="wr-top"><span class="wr-tk">${esc(w.yr)} 나의 공모주</span><button class="ghost sm" type="button" data-wshare>${ico("image", "sm")}결산 카드</button></div>
      <div class="wr-big"><small>${w.done ? "실현 손익" : "아직 판 종목이 없어요"}</small><b class="num ${cls(w.total)}" id="wrTotal">${w.total >= 0 ? "+" : "−"}${won(Math.abs(w.total))}</b><span>원</span></div>
      <div class="wr-grid">
        <div><i>청약</i><b class="num">${w.n}</b><small>번</small></div>
        <div><i>배정</i><b class="num">${w.got}</b><small>${w.known ? `/${w.known} · ${Math.round(w.got / w.known * 100)}%` : "번"}</small></div>
        <div><i>승률</i><b class="num">${w.done ? Math.round(w.wins / w.done * 100) : "–"}</b><small>${w.done ? `% · ${w.wins}/${w.done}` : ""}</small></div>
        <div><i>받은 주식</i><b class="num">${nf.format(w.shares)}</b><small>주</small></div>
      </div>
      ${w.best && w.best.p > 0 ? `<p class="wr-best">${ico("star", "sm")}<span>최고의 한 방 <b>${esc(w.best.r.name)}</b> <b class="up">+${won(w.best.p)}원</b></span></p>` : ""}
      ${w.fav ? `<p class="wr-fav">가장 많이 쓴 증권사 <b>${esc(w.fav[0])}</b> · ${w.fav[1]}번</p>` : ""}`;
    if (!renderWrapped.done && !$("my").closest(".screen").hidden) { renderWrapped.done = true; countUp($("wrTotal"), 900); }
  }
  wrapBox.addEventListener("click", (e) => { if (e.target.closest("[data-wshare]")) wrappedCard(); });

  async function wrappedCard() {
    const w = wrapped();
    if (!w) return;
    try { await document.fonts.ready; } catch (e) { /* 글꼴 없이도 */ }
    const W = 1080, H = 1350, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d"), F = '"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    x.fillStyle = "#111111"; x.fillRect(0, 0, W, H);
    ticketHead(x, W, `${w.yr} 나의 공모주 결산`);
    x.fillStyle = "#BDBDB8"; x.font = `600 40px ${F}`; x.fillText(w.done ? "올해 공모주로 번 돈" : "올해의 공모주 기록", 80, 400);
    const big = `${w.total >= 0 ? "+" : "−"}${won(Math.abs(w.total))}`;
    x.fillStyle = w.total >= 0 ? "#FF6B72" : "#6FA8FF"; x.font = `800 ${big.length > 9 ? 120 : 150}px ${F}`;
    x.fillText(big, 72, 560);
    const bw = x.measureText(big).width;
    x.fillStyle = "#F4F4F2"; x.font = `700 60px ${F}`; x.fillText("원", 72 + bw + 14, 560);
    const tiles = [["청약", `${w.n}번`], ["배정", w.known ? `${w.got}번 · ${Math.round(w.got / w.known * 100)}%` : `${w.got}번`],
      ["승률", w.done ? `${Math.round(w.wins / w.done * 100)}%` : "–"], ["받은 주식", `${nf.format(w.shares)}주`]];
    tiles.forEach(([k, v], i) => {
      const tx = 72 + (i % 2) * 476, ty = 660 + Math.floor(i / 2) * 200;
      x.fillStyle = "#1D1D1F"; roundRect(x, tx, ty, 460, 176, 28); x.fill();
      x.fillStyle = "#8F8F89"; x.font = `600 34px ${F}`; x.fillText(k, tx + 36, ty + 62);
      x.fillStyle = "#F4F4F2"; x.font = `800 58px ${F}`; x.fillText(v, tx + 36, ty + 138);
    });
    if (w.best && w.best.p > 0) {
      x.fillStyle = "#FFD43B"; x.font = `700 40px ${F}`; x.fillText(`★ 최고의 한 방  ${w.best.r.name}  +${won(w.best.p)}원`.slice(0, 40), 80, 1120);
    }
    x.fillStyle = "#8F8F89"; x.font = `500 30px ${F}`; x.fillText("richroro.github.io/ipo · 공모주 캘린더", 80, H - 72);
    await shareCanvas(c, `${w.yr}-나의-공모주.png`, `${w.yr} 나의 공모주 결산`);
  }

  /* 공유 카드 공통: 노란 티켓 머리 */
  function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function ticketHead(x, W, title) {
    const F = '"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    x.fillStyle = "#FFD43B"; roundRect(x, 56, 56, W - 112, 200, 36); x.fill();
    x.fillStyle = "#111111";
    for (const cx of [56, W - 56]) { x.beginPath(); x.arc(cx, 156, 26, 0, 7); x.fill(); }
    x.setLineDash([12, 14]); x.strokeStyle = "rgba(17,17,17,.35)"; x.lineWidth = 4; x.beginPath(); x.moveTo(W - 300, 84); x.lineTo(W - 300, 228); x.stroke(); x.setLineDash([]);
    x.fillStyle = "#111111"; x.font = `900 34px ${F}`; x.fillText("IPO", 110, 130);
    x.font = `800 54px ${F}`; x.fillText(title, 110, 200);
    x.textAlign = "center"; x.font = `700 30px ${F}`; x.fillText(TODAY.replace(/-/g, "."), W - 178, 168); x.textAlign = "left";
  }
  async function shareCanvas(c, name, title) {
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    download(blob, name);
    toast("이미지를 저장했어요");
  }

  /* -------------------------------------------------------------- 연결 */
  document.addEventListener("ipo:ready", () => {
    renderRail();
    renderWrapped();
    if (shown("top") && !renderRail.counted) {
      renderRail.counted = true;
      document.querySelectorAll("#summary .v").forEach((el) => countUp(el));
    }
  });
  document.addEventListener("ipo:records", renderWrapped);
  document.addEventListener("ipo:celebrate", celebrate);
  // 내 청약 화면을 열 때 결산 숫자를 한 번 올린다
  document.addEventListener("click", (e) => { if (e.target.closest('[data-go="my"]')) setTimeout(() => { renderWrapped.done = true; countUp($("wrTotal"), 900); }, 60); });
  self.STORY = { open: openStory, celebrate, countUp, ticketHead, roundRect, shareCanvas };
})();
