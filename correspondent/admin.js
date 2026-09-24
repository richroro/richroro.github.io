"use strict";

/* =========================================================================
   운영 화면 — 신고 대기열, 찾기, 숫자, 처리 기록.

   이 화면은 권한을 스스로 판단하지 않는다. 운영자인지는 서버 함수가 토큰으로 가리고
   (admin.sql 의 admin_guard), 여기서는 그 답을 보여 줄 뿐이다. 운영자가 아닌 사람이
   이 파일을 고쳐 써도 할 수 있는 일은 늘지 않는다.

   로그인은 앱과 같은 출처라 앱의 세션(tpw.session)을 그대로 쓴다.
   ========================================================================= */
const SY = window.TPW_SYNC || { enabled: false, hasSession: () => false };

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* 앱(app.js)의 표와 같은 값. 운영자는 앱이 보여 주는 말로 읽어야 한다. */
const CAT = { play: "놀이공간", food: "맛집", cafe: "카페", trip: "나들이", etc: "그 밖에" };
const WAIT = { 0: "대기 없음", 10: "대기 10분", 30: "대기 30분", 60: "대기 1시간+" };
const CROWD = { 0: "한산", 1: "보통", 2: "붐빔", 3: "터짐" };
const PARK = { 0: "주차 넉넉", 1: "주차 보통", 2: "주차 만석", 3: "주차 불가" };

const WHY = {
  hidden: "신고로 가려짐",
  flagged: "신고됨 · 아직 보임",
  new_flags: "처리 뒤 새 신고",
  hold_over: "임시조치 30일 끝남 — 결정 필요"
};
const ACT = { restore: "되살림", hide: "가린 채 둠", hold: "임시조치", delete: "지움", ban: "정지", unban: "정지 풀림" };
const DONE = {
  restore: "되살렸습니다. 신고는 기각으로 남습니다.",
  hide: "가린 채 두었습니다.",
  hold: "임시조치했습니다. 30일 뒤 대기열로 돌아옵니다.",
  delete: "지웠습니다."
};

const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
function ago(v){
  const d = Date.now() - new Date(v).getTime();
  if (d < 2 * MIN) return "방금";
  if (d < HOUR) return Math.floor(d / MIN) + "분 전";
  if (d < DAY) return Math.floor(d / HOUR) + "시간 전";
  return Math.floor(d / DAY) + "일 전";
}
const pad = (n) => String(n).padStart(2, "0");
/* 운영자는 시각을 대조해야 한다(권리침해 신고의 "몇 시쯤 쓴 글"). 짧게, 24시간제로. */
function when(v){
  const d = new Date(v);
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
const day = (v) => { const d = new Date(v); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); };
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
/* "2026-09-24" → "9/24 목". 이 앱은 요일을 탄다 — 주말에 리포트가 몰린다. */
function dayLabel(s){
  const [y, m, d] = String(s).split("-").map(Number);
  return m + "/" + d + " " + WEEK[new Date(y, m - 1, d).getDay()];
}
const shortId = (u) => String(u || "").slice(0, 8);

let toastTimer = null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
function status(el, msg, kind){
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

/* ─────────────────────────── 문 앞 ─────────────────────────── */
async function gate(kind, detail){
  const g = $("#gate");
  if (kind === "off") {
    g.innerHTML = "<h2>공용 보드가 꺼져 있습니다</h2>" +
      "<p><span class=\"mono\">config.js</span> 에 Supabase 주소가 없어서, 이 앱은 지금 서버 없이 돕니다. " +
      "서버가 없으면 신고도 운영자가 볼 것도 없습니다.</p><p>공용 보드를 켜는 법은 SETUP.md 1단계에 있습니다.</p>";
  } else if (kind === "login") {
    g.innerHTML = "<h2>로그인이 필요합니다</h2>" +
      "<p>앱에서 <b>🏘 공용 보드 → 로그인</b>한 뒤 이 주소로 다시 오세요. 같은 로그인을 씁니다.</p>" +
      '<p><a href="./">앱으로 가기</a></p>';
  } else if (kind === "notadmin") {
    let uid = "";
    try { uid = await SY.whoami(); } catch (e) {}
    g.innerHTML = "<h2>이 계정은 운영자가 아닙니다</h2>" +
      "<p>운영자는 Supabase SQL 편집기에서만 정합니다. 이 계정을 운영자로 넣으려면:</p>" +
      '<code class="code" id="grant">insert into admins (id, note) values (\'' + esc(uid || "계정 번호") + "', '운영자 이름');</code>" +
      '<p><button class="btn" type="button" id="copyGrant">복사</button> <span class="status" id="copyStatus" aria-live="polite"></span></p>';
    $("#copyGrant").addEventListener("click", async () => {
      let ok = false;
      try { await navigator.clipboard.writeText($("#grant").textContent); ok = true; } catch (e) {}
      status($("#copyStatus"), ok ? "복사했습니다." : "복사가 막혔습니다. 위 글을 직접 긁어 주세요.", ok ? "ok" : "err");
    });
  } else {
    g.innerHTML = "<h2>서버에 닿지 못했습니다</h2><p>" + esc(detail || "") + "</p><p>잠시 뒤 새로고침해 보세요.</p>";
  }
}

/* ─────────────────────────── 글 한 건 ─────────────────────────── */
function chipsHtml(r){
  const c = [];
  if (WAIT[r.wait]) c.push(WAIT[r.wait]);
  if (CROWD[r.crowd]) c.push(CROWD[r.crowd]);
  if (PARK[r.park]) c.push(PARK[r.park]);
  if (r.rate) c.push("★" + r.rate);
  (r.tags || []).forEach((t) => c.push("#" + t));
  return c.length ? '<div class="chips">' + c.map((x) => '<span class="stat">' + esc(x) + "</span>").join("") + "</div>" : "";
}
function flagsHtml(r){
  const live = (r.flags || []).filter((f) => !f.dismissed);
  const gone = (r.flags || []).length - live.length;
  if (!live.length) return '<div class="flags none">지금 걸린 신고 없음' + (gone ? " · 기각된 신고 " + gone + "건" : "") + "</div>";
  const by = {};
  live.forEach((f) => { by[f.reason] = (by[f.reason] || 0) + 1; });
  const why = Object.keys(by).map((k) => esc(k) + " " + by[k]).join(" · ");
  return '<div class="flags">신고 ' + live.length + "건 — " + why +
    " · 처음 " + esc(ago(live[0].at)) + (gone ? " · 기각된 신고 " + gone + "건" : "") + "</div>";
}
function itemHtml(r){
  const id = esc(r.id);
  const banned = r.author_banned_until && new Date(r.author_banned_until) > new Date();
  return '<article class="item why-' + esc(r.why || (r.hidden ? "hidden" : "none")) + '" data-id="' + id + '" tabindex="-1" aria-labelledby="pl-' + id + '">' +
    '<div class="item-top">' +
      (r.why ? '<span class="why ' + esc(r.why) + '">' + esc(WHY[r.why] || r.why) + "</span>"
             : r.hidden ? '<span class="why hidden">가려짐</span>' : "") +
      (r.held_until && new Date(r.held_until) > new Date() ? '<span class="badge">임시조치 ~' + esc(when(r.held_until)) + "</span>" : "") +
      '<span>' + esc(CAT[r.cat] || "그 밖에") + " · " + esc(r.hood || r.hood_code) + " · " + esc(ago(r.t)) +
        ' <span class="mono">' + esc(when(r.t)) + "</span></span>" +
    "</div>" +
    '<h2 class="place" id="pl-' + id + '">' + esc(r.place) + (r.area ? "<small>" + esc(r.area) + "</small>" : "") + "</h2>" +
    chipsHtml(r) +
    (r.note ? '<p class="note-line">' + esc(r.note) + "</p>" : "") +
    '<div class="author">— <b>' + esc(r.by_name) + "</b> 특파원" +
      (r.author_reports != null ? " · 글 " + r.author_reports + " · 가려진 글 " + r.author_hidden : "") +
      (banned ? ' · <span class="warn">정지 ' + esc(day(r.author_banned_until)) + "까지</span>" : "") +
      ' <button class="link-btn" type="button" data-user="' + esc(r.author) + '">작성자 보기</button></div>' +
    flagsHtml(r) +
    '<div class="acts" role="group" aria-label="' + esc(r.place) + ' 처리">' +
      '<label class="sr" for="note-' + id + '">처리 메모</label>' +
      '<input class="input" id="note-' + id + '" maxlength="500" autocomplete="off" ' +
        'placeholder="처리 메모 (임시조치·지우기는 필수)">' +
      '<div class="btns">' +
        '<button class="btn" type="button" data-act="restore">문제없음 · 되살리기</button>' +
        '<button class="btn" type="button" data-act="hide">가린 채 두기</button>' +
        '<button class="btn warn-text" type="button" data-act="hold">임시조치 30일</button>' +
        '<button class="btn warn-text" type="button" data-act="delete">지우기…</button>' +
      "</div>" +
      '<div class="confirm" hidden><span>되돌릴 수 없습니다. 처리 기록에 사본만 1년 남습니다.</span>' +
        '<button class="btn danger" type="button" data-act="delete-yes">지우기</button>' +
        '<button class="btn ghost" type="button" data-act="delete-no">그만두기</button></div>' +
      '<div class="status" aria-live="polite"></div>' +
    "</div>" +
  "</article>";
}

/* ─────────────────────────── 대기열 ─────────────────────────── */
let queueTimer = null;
async function loadQueue(){
  const box = $("#queue");
  try {
    const list = await SY.rpc("admin_queue", { p_limit: 200 });
    box.innerHTML = list.length ? list.map(itemHtml).join("")
      : '<p class="done">대기열이 비었습니다. 새 신고가 오면 여기 올라옵니다.</p>';
    $("#nQueue").textContent = list.length >= 200 ? "200+" : list.length ? String(list.length) : "";
  } catch (e) {
    box.innerHTML = '<p class="status err">대기열을 불러오지 못했습니다: ' + esc(e.message) + "</p>";
  }
}

async function act(item, action){
  const note = $("input", item).value.trim();
  const st = $(".status", item);
  const confirmBox = $(".confirm", item);
  if (action === "delete") {
    if (!note) {
      status(st, "지우기는 사유를 남겨야 합니다. 이의 신청이 오면 이 사유로 답합니다.", "err");
      $("input", item).focus();
      return;
    }
    status(st, "");
    confirmBox.hidden = false;
    $('[data-act="delete-yes"]', item).focus();
    return;
  }
  if (action === "delete-no") {
    confirmBox.hidden = true;
    $('[data-act="delete"]', item).focus();
    return;
  }
  if (action === "hold" && !note) {
    status(st, "임시조치는 누가 무엇 때문에 요청했는지 메모로 남겨야 합니다.", "err");
    $("input", item).focus();
    return;
  }
  const a = action === "delete-yes" ? "delete" : action;
  const buttons = $$("button", item);
  buttons.forEach((b) => { b.disabled = true; });
  status(st, "처리하는 중…");
  try {
    await SY.rpc("admin_act", { p_report: item.dataset.id, p_action: a, p_note: note });
  } catch (e) {
    buttons.forEach((b) => { b.disabled = false; });
    status(st, "처리하지 못했습니다: " + e.message, "err");
    return;
  }
  const place = $(".place", item).firstChild.textContent;
  toast(DONE[a] + " — " + place);
  if (item.closest("#queue")) {
    /* 처리한 건은 빠진다. 초점은 다음 건으로 — 없으면 목록 위 설명으로. */
    const next = item.nextElementSibling || item.previousElementSibling;
    item.remove();
    const left = $$("#queue .item").length;
    $("#nQueue").textContent = left ? String(left) : "";
    if (!left) $("#queue").innerHTML = '<p class="done" tabindex="-1">대기열이 비었습니다. 새 신고가 오면 여기 올라옵니다.</p>';
    const f = next && next.classList.contains("item") ? next : $("#queue .done");
    if (f) f.focus();
  } else {
    await runFind(true);
  }
}

/* ─────────────────────────── 찾기 ─────────────────────────── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function runFind(keepFocus){
  const q = $("#q").value.trim();
  const box = $("#found");
  if (!q) { box.innerHTML = ""; return; }
  box.innerHTML = '<p class="done">찾는 중…</p>';
  /* 계정 번호로 찾으면 그 사람부터 보인다 — 정지 이의 신청은 글 없이 번호만 들고 오기도 한다
     (앱의 공용 보드 창에 번호가 보인다). */
  let who = "";
  if (UUID.test(q)) {
    try {
      const u = await SY.rpc("admin_user", { p_user: q.toLowerCase() });
      const banned = u.banned_until && new Date(u.banned_until) > new Date();
      who = '<article class="item" tabindex="-1" aria-labelledby="who-' + esc(u.id) + '">' +
        '<div class="item-top"><span class="badge">특파원</span>' +
          (banned ? '<span class="warn">정지 ' + esc(day(u.banned_until)) + "까지</span>" : "") + "</div>" +
        '<h2 class="place" id="who-' + esc(u.id) + '">' + esc(u.name) + "<small>" + esc(u.hood || "") + "</small></h2>" +
        '<div class="author">글 ' + u.report_count + " · 가려진 글 " + u.hidden_count +
          ' <button class="link-btn" type="button" data-user="' + esc(u.id) + '">작성자 보기</button></div></article>';
    } catch (e) { /* 그런 특파원이 없으면 글만 찾는다 */ }
  }
  try {
    const list = await SY.rpc("admin_find", { p_q: q, p_limit: 50 });
    box.innerHTML = who + (list.length ? '<p class="note">글 ' + list.length + "건" + (list.length >= 50 ? " (최근 50건까지)" : "") + "</p>" +
      list.map(itemHtml).join("") : who ? "" : '<p class="done">맞는 글이 없습니다.</p>');
  } catch (e) {
    box.innerHTML = '<p class="status err">찾지 못했습니다: ' + esc(e.message) + "</p>";
  }
  if (!keepFocus) { const first = $("#found .item"); if (first) first.focus(); }
}

/* ─────────────────────────── 숫자 ─────────────────────────── */
async function loadStats(){
  const box = $("#stats");
  box.innerHTML = '<p class="done">세는 중…</p>';
  let s;
  try { s = await SY.rpc("admin_stats", { p_days: 14 }); }
  catch (e) { box.innerHTML = '<p class="status err">불러오지 못했습니다: ' + esc(e.message) + "</p>"; return; }
  const t = s.totals || {};
  const tile = (n, label, hot) => '<div class="tile' + (hot ? " hot" : "") + '"><b>' + Number(n || 0).toLocaleString("ko-KR") + "</b><span>" + esc(label) + "</span></div>";
  const days = s.days || [];
  const max = Math.max(1, ...days.map((d) => d.reports));
  box.innerHTML =
    '<div class="tiles">' +
      tile(t.people, "특파원") + tile(t.active_7d, "7일 동안 쓴 사람") + tile(t.reports, "리포트 (1년치)") +
      tile(t.hidden, "가려진 글") + tile(t.queue, "대기열", t.queue > 0) + tile(t.banned, "정지 중") +
    "</div>" +
    '<div class="tbl-wrap" tabindex="0" role="region" aria-label="날마다 표"><table class="tbl"><caption>날마다 (서울 기준, 최근 14일)</caption>' +
      '<thead><tr><th scope="col">날짜</th><th scope="col">리포트</th><th scope="col">쓴 사람</th><th scope="col">새 사람</th><th scope="col">신고</th><th scope="col">처리</th></tr></thead><tbody>' +
      days.map((d) => '<tr><th scope="row">' + esc(dayLabel(d.day)) + "</th>" +
        '<td><span class="bar-cell"><i style="width:' + Math.round(d.reports / max * 36) + 'px" aria-hidden="true"></i>' + d.reports + "</span></td>" +
        "<td>" + d.authors + "</td><td>" + d.new_people + "</td><td>" + d.flags + "</td><td>" + d.actions + "</td></tr>").join("") +
    "</tbody></table></div>" +
    '<div class="tbl-wrap" tabindex="0" role="region" aria-label="동네 표"><table class="tbl"><caption>동네 (최근 7일)</caption>' +
      '<thead><tr><th scope="col">동네</th><th scope="col">리포트</th><th scope="col">쓴 사람</th><th scope="col">목록에</th></tr></thead><tbody>' +
      (s.hoods || []).map((h) => '<tr><th scope="row">' + esc(h.label) + "</th><td>" + h.reports_7d + "</td><td>" + h.authors_7d +
        "</td><td>" + (h.active ? "열림" : "닫힘") + "</td></tr>").join("") +
    "</tbody></table></div>" +
    '<p class="note">쓴 사람이 적은 동네는 새로 온 사람이 빈 화면을 봅니다. 한 동네가 차기 전에 다음 동네를 열지 마세요 — ' +
      "동네는 <span class=\"mono\">update hoods set active = true where code = '…'</span> 로 엽니다.</p>";
}

/* ─────────────────────────── 처리 기록 ─────────────────────────── */
async function loadLog(){
  const box = $("#log");
  box.innerHTML = '<p class="done">불러오는 중…</p>';
  let list;
  try { list = await SY.rpc("admin_log", { p_limit: 200 }); }
  catch (e) { box.innerHTML = '<p class="status err">불러오지 못했습니다: ' + esc(e.message) + "</p>"; return; }
  if (!list.length) { box.innerHTML = '<p class="done">아직 처리한 것이 없습니다.</p>'; return; }
  /* 표로 두면 폰에서 메모가 잘린다. 운영자가 읽어야 하는 건 메모라 한 줄씩 쌓는다. */
  box.innerHTML = '<p class="note" style="margin-bottom:8px">최근 ' + list.length + "건</p>" +
    '<ol class="loglist">' + list.map((l) =>
      '<li><span class="act act-' + esc(l.action) + '">' + esc(ACT[l.action] || l.action) + "</span> " +
        (l.place ? "<b>" + esc(l.place) + "</b>" + (l.by_name ? " · " + esc(l.by_name) : "")
                 : "<b>" + esc(l.target_name || "탈퇴한 특파원") + '</b> <span class="mono t">' + esc(shortId(l.target)) + "</span>") +
        ' <span class="t"><span class="mono">' + esc(when(l.at)) + "</span> · 운영자 " +
          '<span class="mono">' + esc(shortId(l.admin) || "—") + "</span></span>" +
        (l.note ? '<div class="lnote">' + esc(l.note) + "</div>" : "") +
      "</li>").join("") + "</ol>";
}

/* ─────────────────────────── 작성자 ─────────────────────────── */
let lastFocus = null;
let userOpen = null;
async function openUser(uid){
  let u;
  try { u = await SY.rpc("admin_user", { p_user: uid }); }
  catch (e) { toast("불러오지 못했습니다: " + e.message); return; }
  userOpen = uid;
  $("#userTitle").textContent = u.name + " 특파원";
  const banned = u.banned_until && new Date(u.banned_until) > new Date();
  $("#userBody").innerHTML =
    '<dl class="kv">' +
      '<dt>번호</dt><dd class="mono">' + esc(u.id) + "</dd>" +
      "<dt>동네</dt><dd>" + esc(u.hood || "—") + "</dd>" +
      "<dt>가입</dt><dd>" + esc(day(u.created_at)) + "</dd>" +
      "<dt>쓴 글</dt><dd>" + u.report_count + "건 (가려진 글 " + u.hidden_count + ")</dd>" +
      "<dt>한 신고</dt><dd>" + u.flags_made + "건 (기각된 것 " + u.flags_made_dismissed + ")</dd>" +
      "<dt>상태</dt><dd>" + (banned ? '<span class="warn">정지 — ' + esc(day(u.banned_until)) + "까지</span>" : "정상") +
        (u.is_admin ? " · 운영자" : "") + "</dd>" +
    "</dl>" +
    (u.is_admin ? '<p class="note">운영자는 정지할 수 없습니다.</p>' :
      '<fieldset id="banBox"><legend>정지</legend>' +
        '<label class="sr" for="banNote">정지 사유</label>' +
        '<input class="input" id="banNote" maxlength="500" autocomplete="off" placeholder="사유 — 운영정책 4조의 어느 줄인지">' +
        '<div class="btns">' +
          '<button class="btn" type="button" data-ban="7">7일</button>' +
          '<button class="btn" type="button" data-ban="30">30일</button>' +
          '<button class="btn warn-text" type="button" data-ban="36500">영구</button>' +
          (banned ? '<button class="btn primary" type="button" data-ban="0">정지 풀기</button>' : "") +
        "</div>" +
        '<p class="note">정지되면 글쓰기와 신고가 막히고, 읽기는 그대로 됩니다. 이미 쓴 글은 따로 처리하세요.</p>' +
        '<div class="status" id="banStatus" aria-live="polite"></div>' +
      "</fieldset>") +
    '<section class="mini"><h3>최근 글 ' + Math.min(u.reports.length, 50) + "건</h3>" +
      (u.reports.length ? "<ul>" + u.reports.map((r) => "<li><b>" + esc(r.place) + "</b>" +
        '<span class="t">' + esc(when(r.t)) + "</span>" +
        (r.hidden ? '<span class="badge">가려짐</span>' : "") +
        (r.flag_count ? '<span class="badge">신고 ' + r.flag_count + "</span>" : "") +
        (r.note ? '<span class="t">' + esc(r.note.slice(0, 60)) + "</span>" : "") + "</li>").join("") + "</ul>"
        : '<p class="note">남은 글이 없습니다.</p>') +
    "</section>" +
    '<section class="mini"><h3>이 사람에 대한 처리 기록</h3>' +
      (u.log.length ? "<ul>" + u.log.map((l) => "<li><b>" + esc(ACT[l.action] || l.action) + "</b>" +
        '<span class="t">' + esc(when(l.at)) + "</span><span>" + esc(l.note || "") + "</span></li>").join("") + "</ul>"
        : '<p class="note">없습니다.</p>') +
    "</section>";
  if (!$("#userBack").classList.contains("open")) {
    lastFocus = document.activeElement;
    $("#userBack").classList.add("open");
    $("header").inert = true; $("main").inert = true;
    $("#userBack .x").focus();
  }
}
function closeUser(){
  $("#userBack").classList.remove("open");
  $("header").inert = false; $("main").inert = false;
  userOpen = null;
  if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  lastFocus = null;
}
async function ban(days){
  const st = $("#banStatus");
  const note = $("#banNote").value.trim();
  if (days > 0 && !note) { status(st, "정지는 사유를 남겨야 합니다. 이의 신청이 오면 이 사유로 답합니다.", "err"); $("#banNote").focus(); return; }
  $$("#banBox button").forEach((b) => { b.disabled = true; });
  try {
    await SY.rpc("admin_ban", { p_user: userOpen, p_days: days, p_note: note });
  } catch (e) {
    $$("#banBox button").forEach((b) => { b.disabled = false; });
    status(st, "처리하지 못했습니다: " + e.message, "err");
    return;
  }
  toast(days === 0 ? "정지를 풀었습니다." : days >= 36500 ? "영구 정지했습니다." : days + "일 정지했습니다.");
  await openUser(userOpen);
  loadQueue();
}

/* ─────────────────────────── 탭 ─────────────────────────── */
let view = "queue";
function switchView(name){
  view = name;
  $$(".tab").forEach((b) => {
    const on = b.dataset.view === name;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  $$(".view").forEach((s) => { s.hidden = s.id !== "v-" + name; });
  if (name === "queue") loadQueue();
  if (name === "stats") loadStats();
  if (name === "log") loadLog();
  if (name === "find") setTimeout(() => $("#q").focus(), 30);
}

function bind(){
  $$(".tab").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  $("#tabs").addEventListener("keydown", (e) => {
    const tabs = $$(".tab"), i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
            : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (j === -1) return;
    e.preventDefault();
    switchView(tabs[j].dataset.view);
    tabs[j].focus();
  });
  $("#findForm").addEventListener("submit", (e) => { e.preventDefault(); runFind(); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a) { act(a.closest(".item"), a.dataset.act); return; }
    const u = e.target.closest("[data-user]");
    if (u) { openUser(u.dataset.user); return; }
    const b = e.target.closest("[data-ban]");
    if (b) { ban(Number(b.dataset.ban)); return; }
    if (e.target.closest("[data-close]") || e.target === $("#userBack")) closeUser();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#userBack").classList.contains("open")) closeUser();
  });
  /* 대기열은 2분마다 조용히 새로 본다 — 창을 열어 둔 채 다른 일을 하는 운영자를 위해.
     메모를 쓰는 중이면 건너뛴다(다시 그리면 쓰던 글이 날아간다). */
  queueTimer = setInterval(() => {
    const typing = document.activeElement && document.activeElement.matches("#queue input");
    if (view === "queue" && !document.hidden && !typing && !$("#userBack").classList.contains("open")) loadQueue();
  }, 120e3);
}

async function start(){
  if (!SY.enabled) return gate("off");
  if (!SY.hasSession()) return gate("login");
  let ok = false;
  try { ok = await SY.rpc("is_admin"); }
  catch (e) { return gate("error", e.message); }
  if (ok !== true) return gate("notadmin");
  $("#gate").innerHTML = "";
  let uid = "";
  try { uid = await SY.whoami(); } catch (e) {}
  $("#who").textContent = "운영자 " + shortId(uid);
  $("#tabs").hidden = false;
  bind();
  switchView("queue");
}
start();
