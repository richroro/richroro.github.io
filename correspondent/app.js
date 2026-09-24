"use strict";

/* =========================================================================
   동네 특파원 — 서버 없는 현장 속보 게시판

   두 종류의 정보를 갈라서 다룬다.
     · 속보(웨이팅·사람·주차) — 몇 시간이면 상한다. 시간과 함께 흐려지고 하루면 접힌다.
     · 기록(별점·태그·메모)   — 시간이 지나도 쓸모가 남는다. 흐려지지 않는다.

   리포트는 링크 한 줄(#r=…)에 통째로 실려 오간다. 서버도 계정도 없다.
   ========================================================================= */

/* ---------------------------- 상수 ---------------------------- */
const KEY = "tpw.v1";
const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
const LIVE = 1 * HOUR;    // 이 안쪽은 "지금"
const SOFT = 3 * HOUR;    // 이 안쪽까지 현장 정보로 친다
const DIM  = 12 * HOUR;
const DEAD = 24 * HOUR;   // 넘으면 속보 항목을 접는다
const HALF = 3 * HOUR;    // 신선도 반감기
const MAX_CODE = 40000;   // 받아들일 코드 길이 상한
const MAX_BYTES = 500000; // 풀었을 때 크기 상한
const MAX_REPORTS = 400;  // 한 번에 받아들일 리포트 수 상한
const BUNDLE_CAP = 1600;  // 묶음 링크 payload 목표 길이(카톡에서 안 깨지는 선)
const WATCH_MAX = 30;     // 지켜보는 곳 상한

const CATS = [
  { k:"play", ic:"🛝", nm:"놀이공간" },
  { k:"food", ic:"🍚", nm:"맛집" },
  { k:"cafe", ic:"☕", nm:"카페" },
  { k:"trip", ic:"🧺", nm:"나들이" },
  { k:"etc",  ic:"📍", nm:"그 밖에" }
];
const WAIT = [
  { v:0,  nm:"바로 입장", s:"대기 없음",   tone:"good" },
  { v:10, nm:"10분",      s:"대기 10분",   tone:"good" },
  { v:30, nm:"30분",      s:"대기 30분",   tone:"mid"  },
  { v:60, nm:"1시간+",    s:"대기 1시간+", tone:"bad"  },
  { v:-1, nm:"모름",      s:"",            tone:"none" }
];
const CROWD = [
  { v:0,  nm:"한산", s:"한산", tone:"good"  },
  { v:1,  nm:"보통", s:"보통", tone:"mid"   },
  { v:2,  nm:"붐빔", s:"붐빔", tone:"bad"   },
  { v:3,  nm:"터짐", s:"터짐", tone:"worst" },
  { v:-1, nm:"모름", s:"",     tone:"none"  }
];
const PARK = [
  { v:0,  nm:"넉넉",       s:"주차 넉넉", tone:"good"  },
  { v:1,  nm:"보통",       s:"주차 보통", tone:"mid"   },
  { v:2,  nm:"만석",       s:"주차 만석", tone:"bad"   },
  { v:3,  nm:"댈 곳 없음", s:"주차 불가", tone:"worst" },
  { v:-1, nm:"모름",       s:"",          tone:"none"  }
];
const TAGS = ["아이동반","실내","야외","무료","그늘","주차무료","화장실깔끔","유아의자","예약가능","포장가능","반려동물","넓음"];
const TONE_SCORE = { good:1, mid:.55, bad:.2, worst:0 };

/* ---------------------------- 잡기구 ---------------------------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const store = {
  get(k, fb){ try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch(e){ return fb; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
};
const opt = (table, v) => table.find((o) => o.v === v) || table[table.length - 1];
const newId = () => Math.random().toString(36).slice(2, 10);

/** 한 줄로 만들고 제어문자를 턴 뒤 길이를 자른다. */
function clip(s, n){
  return String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
}
/** 장소 묶음 열쇠 — 공백과 대소문자를 무시한다. */
const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, "").toLowerCase();
/** "안양 안양동" 도 "안양동" 도 같은 동네로 본다 — 마지막 토막만 본다. */
function areaKey(s){
  const parts = String(s == null ? "" : s).trim().split(/\s+/).filter(Boolean);
  return parts.length ? norm(parts[parts.length - 1]) : "";
}

function ago(ms){
  const d = Date.now() - ms;
  if (d < 2 * MIN)  return "방금";
  if (d < HOUR)     return Math.floor(d / MIN) + "분 전";
  if (d < DAY)      return Math.floor(d / HOUR) + "시간 전";
  if (d < 2 * DAY)  return "어제";
  if (d < 30 * DAY) return Math.floor(d / DAY) + "일 전";
  return new Date(ms).toLocaleDateString("ko-KR", { month:"numeric", day:"numeric" });
}
function fmtTime(ms){
  return new Date(ms).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" });
}
/** 신선도 0~1 — 3시간 반감기. */
const freshness = (t) => Math.pow(0.5, Math.max(0, Date.now() - t) / HALF);
function ageClass(t){
  const d = Date.now() - t;
  return d < LIVE ? "live" : d < SOFT ? "soft" : d < DIM ? "dim" : "old";
}
/** 현장 정보에 붙일 시점 딱지. */
function liveLabel(t){
  const d = Date.now() - t;
  if (d < 10 * MIN) return "지금";
  if (d < LIVE) return "조금 전";
  if (d < DAY) return Math.floor(d / HOUR) + "시간 전";
  return ago(t);
}

/* ---------------------------- 보드 ---------------------------- */
/** 밖에서 들어온 것은 전부 여기를 지난다. 못 믿을 값은 버리거나 깎는다. */
function sane(o, local){
  if (!o || typeof o !== "object") return null;
  const t = Number(o.t);
  if (!isFinite(t) || t < 1577836800000 || t > Date.now() + DAY) return null;  // 2020년 이전 · 하루 넘게 미래면 버린다
  const place = clip(o.place, 40);
  if (!place) return null;
  const inSet = (tab, v) => tab.some((x) => x.v === v) ? v : -1;
  let tags = Array.isArray(o.tags) ? o.tags.map((x) => clip(x, 12)).filter(Boolean) : [];
  tags = tags.filter((x, i) => tags.indexOf(x) === i).slice(0, 6);
  return {
    id:    /^[A-Za-z0-9_-]{1,24}$/.test(o.id) ? o.id : newId(),
    t:     Math.round(t),
    by:    clip(o.by, 20) || "이름 없는 특파원",
    cat:   CATS.some((c) => c.k === o.cat) ? o.cat : "etc",
    place,
    area:  clip(o.area, 30),
    wait:  inSet(WAIT,  Number(o.wait)),
    crowd: inSet(CROWD, Number(o.crowd)),
    park:  inSet(PARK,  Number(o.park)),
    rate:  clamp(Math.round(Number(o.rate) || 0), 0, 5),
    tags,
    note:  clip(o.note, 200),
    /* mine 은 내가 쓴 것이라는 표시다. 링크나 서버에서 온 것에는 절대 붙지 않는다 —
       붙으면 남의 글을 내 계정으로 올리게 된다. local 은 내 저장소에서 읽을 때만 참이다. */
    mine:  local ? !!o.mine : false,
    up:    local ? !!o.up : false,
    /* 아래 넷도 내 저장소에서 읽을 때만 산다. 링크로 들어온 값은 버린다. */
    priv:  local ? !!o.priv : false,              // 공용 보드에 안 올리기로 한 내 글
    sv:    local ? !!o.sv : false,                // 서버에서 본 적 있는 글 — 서버에서 사라지면 여기서도 뺀다
    hd:    local ? clip(o.hd, 12) : "",           // 그 글을 받아온 동네
    hid:   local ? !!o.hid : false                // 신고로 가려진 내 글 (쓴 사람에게만 보인다)
  };
}

/** 지켜보는 곳 목록. 이 기기에만 있는 내 설정이라 링크에는 실리지 않는다.
    k 는 장소 묶음 열쇠(이름|동네), nm·ar 은 보여 줄 이름, seen 은 마지막으로 본 리포트 시각. */
function saneWatch(list){
  if (!Array.isArray(list)) return [];
  const keys = new Set();
  return list.map((w) => w && typeof w === "object" && typeof w.k === "string" &&
        w.k.length <= 80 && w.k.lastIndexOf("|") > 0
      ? { k: w.k, nm: clip(w.nm, 40) || w.k.slice(0, w.k.lastIndexOf("|")), ar: clip(w.ar, 30),
          seen: Math.max(0, Number(w.seen) || 0) }
      : null)
    .filter((w) => w && !keys.has(w.k) && keys.add(w.k))
    .slice(0, WATCH_MAX);
}

const board = (function load(){
  const raw = store.get(KEY, null);
  const b = { reports: [], me: "", seeded: false, hood: "", pulledAt: 0, gone: [], watch: [] };
  if (raw && typeof raw === "object") {
    /* 내 저장소에서 읽는 것이므로 mine/up 을 살린다. 링크·서버에서 오는 것은 살리지 않는다. */
    if (Array.isArray(raw.reports)) b.reports = raw.reports.map((r) => sane(r, true)).filter(Boolean);
    b.me = clip(raw.me, 20);
    b.seeded = !!raw.seeded;
    b.hood = clip(raw.hood, 12);
    b.pulledAt = Number(raw.pulledAt) || 0;
    if (Array.isArray(raw.gone)) b.gone = raw.gone.filter((x) => typeof x === "string").slice(-500);
    b.watch = saneWatch(raw.watch);
  }
  b.reports.sort((a, c) => c.t - a.t);
  return b;
})();
const save = () => store.set(KEY, board);

/* ---------------------------- 예시 ---------------------------- */
/* 직접 쓴 리포트가 하나라도 생기면 예시는 사라지고 다시 오지 않는다.
   예시는 저장하지 않으므로 공유 링크에도 백업 파일에도 섞이지 않는다. */
const SAMPLE_SEED = [
  { m:14,   by:"민지", cat:"play", place:"별빛 키즈카페",   area:"안양 안양동",
    wait:0,  crowd:0,  park:2,  rate:4, tags:["아이동반","실내"],
    note:"평일 낮이라 텅 비었어요. 주차는 건물 만석이라 골목에 댔습니다." },
  { m:38,   by:"준호", cat:"food", place:"만안 손칼국수",   area:"안양 안양동",
    wait:10, crowd:2,  park:1,  rate:5, tags:["포장가능","유아의자"],
    note:"12시 반인데 열 명쯤 서 있고 회전은 빠릅니다." },
  { m:95,   by:"민지", cat:"trip", place:"안양천 물놀이터", area:"안양 석수동",
    wait:0,  crowd:1,  park:0,  rate:4, tags:["야외","무료","그늘"],
    note:"분수 오후 2시 가동. 그늘막 자리는 벌써 다 찼습니다." },
  { m:170,  by:"서연", cat:"cafe", place:"온기 로스터리",   area:"평촌 범계동",
    wait:0,  crowd:1,  park:-1, rate:4, tags:["넓음","예약가능"],
    note:"2층 창가 두 자리 비어 있습니다. 콘센트는 벽쪽만." },
  { m:260,  by:"준호", cat:"play", place:"별빛 키즈카페",   area:"안양 안양동",
    wait:30, crowd:2,  park:3,  rate:4, tags:["아이동반"],
    note:"주말 오후 들어오니 대기 걸립니다. 아까와 딴판이에요." },
  { m:400,  by:"태오", cat:"food", place:"구산 돈까스",     area:"안양 비산동",
    wait:60, crowd:3,  park:2,  rate:5, tags:["포장가능"],
    note:"웨이팅 앱으로 미리 걸어 두는 게 낫습니다." },
  { m:1500, by:"서연", cat:"trip", place:"수리산 임도길",   area:"안양 안양동",
    wait:-1, crowd:0,  park:1,  rate:5, tags:["야외","무료","반려동물"],
    note:"유모차도 올라갑니다. 입구 주차장은 아침에만 여유." },
  { m:2600, by:"태오", cat:"cafe", place:"들판 베이커리",   area:"평촌 범계동",
    wait:-1, crowd:-1, park:-1, rate:3, tags:["포장가능"],
    note:"소금빵은 오전에 나오고 오후엔 없습니다." }
];
const SAMPLES = SAMPLE_SEED.map((s, i) => sane({
  id: "sample" + i, t: Date.now() - s.m * MIN, by: s.by, cat: s.cat, place: s.place, area: s.area,
  wait: s.wait, crowd: s.crowd, park: s.park, rate: s.rate, tags: s.tags, note: s.note
})).filter(Boolean);

const isSample = () => board.reports.length === 0 && !board.seeded;
const reports = () => isSample() ? SAMPLES : board.reports;

/* ---------------------------- 화면 상태 ---------------------------- */
let view = "feed";
const flt = { cat:"", q:"", liveOnly:false, sort:"new" };
const pflt = { q:"", sort:"recent" };
let draft = { cat:"play", wait:-1, crowd:-1, park:-1, rate:0, tags:[] };
let openPlaceKey = null;
let lastFocus = null;
let inboxCache = null;
let meEditing = false;

/* =========================================================================
   현장 정보 그리기
   ========================================================================= */
function statChips(r){
  const out = [];
  const w = opt(WAIT, r.wait), c = opt(CROWD, r.crowd), p = opt(PARK, r.park);
  if (w.v !== -1) out.push({ s:w.s, tone:w.tone });
  if (c.v !== -1) out.push({ s:c.s, tone:c.tone });
  if (p.v !== -1) out.push({ s:p.s, tone:p.tone });
  return out;
}
function liveRowHtml(r){
  const chips = statChips(r);
  if (!chips.length) return "";
  const d = Date.now() - r.t;
  const faded = d >= SOFT ? " faded" : "";
  const label = d >= LIVE ? '<span class="live-label">' + esc(liveLabel(r.t)) + " 상황</span>" : "";
  const inner = '<div class="live-row' + faded + '">' + label +
    chips.map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("") +
    meterHtml(r) + "</div>";
  if (d < DEAD) return inner;
  return '<details class="expired"><summary>' + esc(ago(r.t)) + " 현장 정보 — 펼치기</summary>" + inner + "</details>";
}
const starsHtml = (n) => n ? '<span class="stars" role="img" aria-label="별 ' + n + '개" title="별 ' + n + '개">' +
  "★".repeat(n) + "☆".repeat(5 - n) + "</span>" : "";

/** 현장 정보가 얼마나 남았는지 — 칩 줄 끝에 붙는 게이지. 기록만 있는 리포트엔 안 붙인다. */
function meterHtml(r){
  const d = Date.now() - r.t;
  if (d >= DEAD || !statChips(r).length) return "";
  const left = Math.max(0, 1 - d / SOFT);
  const pct = Math.max(3, Math.round(left * 100));
  return '<div class="meter' + (left < .15 ? " cold" : "") + '" role="img" aria-label="현장 정보 신선도 ' +
    Math.round(left * 100) + '%" title="3시간을 기준으로 ' + Math.round(left * 100) + '% 남음">' +
    '<i style="width:' + pct + '%"></i></div>';
}

function cardHtml(r, o){
  o = o || {};
  const cat = CATS.find((c) => c.k === r.cat) || CATS[CATS.length - 1];
  const sample = isSample();
  return '<article class="card age-' + ageClass(r.t) + '">' +
    '<div class="card-top">' +
      '<span class="cat"><span aria-hidden="true">' + cat.ic + "</span> " + esc(cat.nm) + "</span>" +
      '<span class="age mono" title="' + esc(fmtTime(r.t)) + '">' + esc(ago(r.t)) + "</span>" +
      (sample ? '<span class="badge">예시</span>' : "") +
      (r.priv ? '<span class="badge" title="공용 보드에 올리지 않은 글">이 기기에만</span>' : "") +
      (r.hid ? '<span class="badge warn" title="세 사람 이상이 신고해서 다른 사람에게는 안 보입니다">신고로 가려짐</span>' : "") +
      (sample || o.noDelete ? "" :
        '<button class="del" type="button" data-del="' + esc(r.id) + '" aria-label="이 리포트 지우기" title="지우기">&times;</button>') +
    "</div>" +
    '<h3 class="place">' +
      (o.plain ? esc(r.place) : '<button type="button" data-open="' + esc(r.id) + '">' + esc(r.place) + "</button>") +
      (r.area ? '<span class="area">' + esc(r.area) + "</span>" : "") +
    "</h3>" +
    liveRowHtml(r) +
    (r.note ? '<p class="note-line">' + esc(r.note) + "</p>" : "") +
    '<div class="card-bot">' +
      starsHtml(r.rate) +
      (r.tags.length ? '<span class="tags">' + r.tags.map((t) => "#" + esc(t)).join(" ") + "</span>" : "") +
      '<span class="by">— ' + esc(r.by) + " 특파원</span>" +
      '<span class="spacer"></span>' +
      (sample ? "" : '<button class="link-btn" type="button" data-again="' + esc(r.id) + '" title="같은 장소의 지금 상황을 알립니다">나도 여기</button>') +
      (sample ? "" : '<button class="link-btn" type="button" data-share="' + esc(r.id) + '">공유</button>') +
      (!sample && SY.enabled && !r.mine ?
        '<button class="link-btn flagbtn" type="button" data-flag="' + esc(r.id) + '">신고</button>' : "") +
    "</div>" +
  "</article>";
}

/* =========================================================================
   거르기 · 정렬
   ========================================================================= */
/** 지금 가기 좋은 정도 0~1 — 아는 항목만 평균. 아무것도 모르면 0.5. */
function cond(r){
  const t = [];
  const w = opt(WAIT, r.wait), c = opt(CROWD, r.crowd), p = opt(PARK, r.park);
  if (w.v !== -1) t.push(TONE_SCORE[w.tone]);
  if (c.v !== -1) t.push(TONE_SCORE[c.tone]);
  if (p.v !== -1) t.push(TONE_SCORE[p.tone] * .8 + .2);   // 주차는 덜 결정적으로
  if (!t.length) return .5;
  return t.reduce((a, b) => a + b, 0) / t.length;
}
function filtered(){
  const q = flt.q.trim().toLowerCase();
  const list = reports().filter((r) => {
    if (flt.cat && r.cat !== flt.cat) return false;
    if (flt.liveOnly && Date.now() - r.t >= SOFT) return false;
    if (q) {
      const hay = (r.place + " " + r.area + " " + r.by + " " + r.note + " " + r.tags.join(" ")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  const by = {
    new:   (a, b) => b.t - a.t,
    fresh: (a, b) => cond(b) * freshness(b.t) - cond(a) * freshness(a.t),
    rate:  (a, b) => (b.rate - a.rate) || (b.t - a.t),
    place: (a, b) => a.place.localeCompare(b.place, "ko") || (b.t - a.t)
  };
  return list.sort(by[flt.sort] || by.new);
}

/* =========================================================================
   장소 묶기
   ========================================================================= */
function groups(){
  const list = reports();
  /* 동네를 안 적은 리포트는, 같은 이름에서 가장 많이 쓰인 동네에 붙인다. */
  const areaOf = {};
  list.forEach((r) => {
    if (!r.area) return;
    const n = norm(r.place), k = areaKey(r.area);
    (areaOf[n] = areaOf[n] || {})[k] = (areaOf[n][k] || 0) + 1;
  });
  const topArea = {};
  Object.keys(areaOf).forEach((n) => {
    topArea[n] = Object.keys(areaOf[n]).sort((a, b) => areaOf[n][b] - areaOf[n][a])[0];
  });

  const map = new Map();
  list.forEach((r) => {
    const n = norm(r.place);
    const a = r.area ? areaKey(r.area) : (topArea[n] || "");
    const key = n + "|" + a;
    let g = map.get(key);
    if (!g) { g = { key, place:r.place, area:r.area, rs:[] }; map.set(key, g); }
    g.rs.push(r);
    if (r.area && r.area.length > g.area.length) g.area = r.area;   // 더 자세히 적힌 쪽을 쓴다
  });

  return Array.from(map.values()).map((g) => {
    g.rs.sort((a, b) => b.t - a.t);
    const rated = g.rs.filter((r) => r.rate > 0);
    g.last = g.rs[0];
    g.n = g.rs.length;
    g.people = Array.from(new Set(g.rs.map((r) => r.by)));
    g.rate = rated.length ? rated.reduce((s, r) => s + r.rate, 0) / rated.length : 0;
    g.tags = Array.from(new Set([].concat.apply([], g.rs.map((r) => r.tags)))).slice(0, 8);
    g.cat = g.last.cat;
    g.conflicts = conflicts(g.rs);
    g.confirm = confirms(g.rs);
    g.usual = usual(g.rs);
    /* 가장 최근 현장 정보(웨이팅·사람·주차가 하나라도 있는 리포트). 메모만 남긴 리포트가
       더 새것이어도 상황판은 이걸로 그린다. 3시간 안쪽이면 그게 지금 상황(g.now)이다. */
    g.stat = g.rs.find((r) => statChips(r).length) || null;
    g.now = g.stat && Date.now() - g.stat.t < SOFT ? g.stat : null;
    return g;
  });
}
/** 최근 3시간 안에 다른 특파원이 다르게 본 항목을 찾는다. */
function conflicts(rs){
  const recent = rs.filter((r) => Date.now() - r.t < SOFT);
  const out = [];
  [["wait", WAIT, "웨이팅"], ["crowd", CROWD, "사람"], ["park", PARK, "주차"]].forEach((f) => {
    const seen = new Map();
    recent.forEach((r) => { if (r[f[0]] !== -1 && !seen.has(r[f[0]])) seen.set(r[f[0]], r); });
    if (seen.size < 2) return;
    const who = new Set(Array.from(seen.values()).map((r) => r.by));
    if (who.size < 2) return;   // 같은 사람이 시간차를 두고 쓴 것은 엇갈림이 아니다
    out.push(f[2] + " — " + Array.from(seen.values())
      .map((r) => opt(f[1], r[f[0]]).nm + "(" + r.by + " · " + ago(r.t) + ")").join(" / "));
  });
  return out;
}
/** 엇갈림의 반대편 — 최근 3시간 안에 서로 다른 특파원이 가장 최근 현장 정보와 같게 봤는지.
    둘 다 아는 칸이 하나 이상 있고 그 칸이 모두 같아야 같게 본 것이다. 모름은 어느 쪽도 아니다.
    같은 사람이 여러 번 쓴 것은 한 사람이다 — 혼자 두 번 말한다고 확인이 되지는 않는다. */
function confirms(rs){
  const recent = rs.filter((r) => Date.now() - r.t < SOFT && statChips(r).length);
  if (recent.length < 2) return null;
  const top = recent[0];
  const same = recent.filter((r) => {
    let shared = 0;
    for (const f of ["wait", "crowd", "park"]) {
      if (r[f] === -1 || top[f] === -1) continue;
      if (r[f] !== top[f]) return false;
      shared++;
    }
    return shared > 0;
  });
  const names = Array.from(new Set(same.map((r) => r.by)));
  return names.length < 2 ? null : { n: names.length, names };
}
const confirmHtml = (c) => '<div class="confirm"><span aria-hidden="true">✓ </span>' + c.n + "명이 같게 봤습니다 · " +
  esc(c.names.slice(0, 3).join(", ") + (c.names.length > 3 ? " 외 " + (c.names.length - 3) + "명" : "")) + "</div>";

/* =========================================================================
   보통은 — 지난 기록
   3시간이 지나면 속보는 "지금"을 말하지 못한다. 대신 쌓이면 "보통 이 시간엔"을 말할 수 있다.
   평일·주말 × 다섯 시간대로 나누고, 서로 다른 날 두 번 이상 본 칸만 말한다 —
   하루에 몰린 여러 건은 그날 사정이지 "보통"이 아니다. 지금 소식과 섞이지 않게 3시간 안쪽은 뺀다.
   ========================================================================= */
const SLOTS = [
  { nm:"아침", from:6,  to:11 },
  { nm:"점심", from:11, to:14 },
  { nm:"오후", from:14, to:17 },
  { nm:"저녁", from:17, to:21 },
  { nm:"밤",   from:21, to:30 }     // 21시 ~ 다음 날 6시
];
const DAYTYPES = ["평일", "주말"];
/** 평균 여유도(cond) → 말. 칩 네 단계의 한가운데로 끊는다. */
const VERDICT = [
  { min:.78, nm:"여유", tone:"good"  },
  { min:.38, nm:"보통", tone:"mid"   },
  { min:.1,  nm:"붐빔", tone:"bad"   },
  { min:-1,  nm:"터짐", tone:"worst" }
];
/** 어느 칸에 드는지. 새벽 0~6시는 전날 밤이다 — 토요일 새벽 1시는 금요일 밤의 끝이다. */
function slotOf(t){
  const d = new Date(t);
  let h = d.getHours();
  if (h < 6) { d.setDate(d.getDate() - 1); h += 24; }
  const day = d.getDay();
  return {
    d: day === 0 || day === 6 ? 1 : 0,
    s: SLOTS.findIndex((x) => h >= x.from && h < x.to),
    date: d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()
  };
}
function usual(rs){
  const cells = {};
  rs.forEach((r) => {
    if (Date.now() - r.t < SOFT || !statChips(r).length) return;
    const k = slotOf(r.t), key = k.d + ":" + k.s;
    const c = cells[key] || (cells[key] = { sum:0, n:0, dates:new Set() });
    c.sum += cond(r); c.n++; c.dates.add(k.date);
  });
  const out = {};
  Object.keys(cells).forEach((key) => {
    const c = cells[key];
    if (c.dates.size < 2) return;
    const avg = c.sum / c.n;
    const v = VERDICT.find((x) => avg >= x.min);
    out[key] = { nm:v.nm, tone:v.tone, days:c.dates.size, n:c.n, avg };
  });
  return out;
}
const slotName = (k) => DAYTYPES[k.d] + " " + SLOTS[k.s].nm;
/** 지금 시간대 칸 — 없으면 null */
function usualNow(g){
  const k = slotOf(Date.now());
  return g.usual[k.d + ":" + k.s] || null;
}
/** "주말 점심엔 보통 붐빔 · 지난 기록 3일" — 속보가 아니라는 걸 늘 붙여서 말한다. tag 는 div 나 span. */
function usualHintHtml(u, tag){
  tag = tag || "div";
  return "<" + tag + ' class="usual-hint"><span class="sw ' + u.tone + '" aria-hidden="true"></span>' +
    "<span>" + esc(slotName(slotOf(Date.now()))) + "엔 보통 <b>" + esc(u.nm) + "</b></span>" +
    '<span class="u-src">지난 기록 ' + u.days + "일</span></" + tag + ">";
}

/* =========================================================================
   링크로 싣고 내리기 — deflate-raw + base64url. 외부 라이브러리 없이 브라우저 내장만 쓴다.
     "1" + base64  : 날것
     "2" + base64  : 압축
   ========================================================================= */
function b64e(bytes){
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64d(str){
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
const toRow = (r) => [r.id, Math.round(r.t / 1000), r.by, r.cat, r.place, r.area, r.wait, r.crowd, r.park, r.rate, r.note, r.tags.join(",")];
const fromRow = (a) => sane({
  id:a[0], t:Number(a[1]) * 1000, by:a[2], cat:a[3], place:a[4], area:a[5],
  wait:a[6], crowd:a[7], park:a[8], rate:a[9], note:a[10],
  tags:String(a[11] == null ? "" : a[11]).split(",").filter(Boolean)
});

async function pack(list){
  const bytes = new TextEncoder().encode(JSON.stringify(list.map(toRow)));
  const plain = "1" + b64e(bytes);
  if (typeof CompressionStream === "function") {
    try {
      const buf = await new Response(new Blob([bytes]).stream()
        .pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
      const zipped = "2" + b64e(new Uint8Array(buf));
      if (zipped.length < plain.length) return zipped;
    } catch(e){ /* 압축이 안 되면 날것으로 */ }
  }
  return plain;
}
async function unpack(code){
  if (!code) throw new Error("링크를 찾지 못했습니다.");
  if (code.length > MAX_CODE) throw new Error("내용이 너무 깁니다.");
  const v = code.charAt(0), body = code.slice(1);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error("링크가 중간에 잘린 것 같습니다.");
  let bytes = b64d(body);
  if (v === "2") {
    if (typeof DecompressionStream !== "function") throw new Error("이 브라우저는 압축된 링크를 풀지 못합니다.");
    const buf = await new Response(new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("내용이 너무 큽니다.");
    bytes = new Uint8Array(buf);
  } else if (v !== "1") {
    throw new Error("모르는 형식입니다.");
  }
  const rows = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(rows)) throw new Error("내용을 읽지 못했습니다.");
  const out = rows.slice(0, MAX_REPORTS).map((a) => Array.isArray(a) ? fromRow(a) : sane(a)).filter(Boolean);
  if (!out.length) throw new Error("쓸 만한 리포트가 없습니다.");
  return out;
}

function baseUrl(){
  if (location.protocol === "http:" || location.protocol === "https:")
    return location.origin + location.pathname.replace(/index\.html?$/i, "");
  return "https://richroro.github.io/correspondent/";
}
/** 카톡에 그대로 붙여 넣을 글. 링크를 안 눌러도 읽히게 쓴다. */
function shareText(list, code){
  const url = baseUrl() + "#r=" + code;
  if (list.length === 1) {
    const r = list[0];
    const cat = CATS.find((c) => c.k === r.cat) || CATS[CATS.length - 1];
    const chips = statChips(r).map((c) => c.s).join(" · ");
    const lines = ["📡 [" + cat.nm + "] " + r.place + (r.area ? " · " + r.area : "")];
    if (chips) lines.push(chips + "  (" + fmtTime(r.t) + " 기준)");
    if (r.note) lines.push("“" + r.note + "”");
    const tail = [];
    if (r.rate) tail.push("★".repeat(r.rate));
    if (r.tags.length) tail.push(r.tags.map((t) => "#" + t).join(" "));
    if (tail.length) lines.push(tail.join("  "));
    lines.push("— " + r.by + " 특파원");
    lines.push("받기 → " + url);
    return lines.join("\n");
  }
  const names = Array.from(new Set(list.map((r) => r.place)));
  const head = "📡 특파원 리포트 " + list.length + "건 (" + names.slice(0, 3).join(", ") +
    (names.length > 3 ? " 외 " + (names.length - 3) + "곳" : "") + ")";
  const body = list.slice(0, 5).map((r) => {
    const chips = statChips(r).map((c) => c.s).join(" · ");
    return "· " + r.place + (chips ? " — " + chips : "") + " (" + ago(r.t) + ", " + r.by + ")";
  });
  if (list.length > 5) body.push("· … 외 " + (list.length - 5) + "건");
  return [head].concat(body, ["받기 → " + url]).join("\n");
}

/* =========================================================================
   그리기
   ========================================================================= */
function renderTicker(){
  const all = reports();
  const live = all.filter((r) => Date.now() - r.t < SOFT).length;
  const last = all.length ? Math.max.apply(null, all.map((r) => r.t)) : 0;
  const people = new Set(all.map((r) => r.by)).size;

  $("#livePill").innerHTML = '<span class="livepill' + (live ? "" : " off") + '">' +
    '<span class="dot' + (live ? " on" : "") + '"></span>지금 ' + live + "건</span>";

  const parts = [
    "리포트 <b>" + all.length + "건</b>",
    "장소 <b>" + groups().length + "곳</b>",
    "특파원 <b>" + people + "명</b>"
  ];
  if (last) parts.push("마지막 <b>" + esc(ago(last)) + "</b>");
  let html = parts.map((x) => "<span>" + x + "</span>").join("");
  if (!navigator.onLine) html = '<span class="warn">오프라인 — ' +
    (SY.enabled ? "쓰면 이 기기에 저장되고, 연결되면 올라갑니다" : "이 기기에서 그대로 쓸 수 있습니다") + "</span>" + html;
  if (isSample()) html += '<span class="warn">지금 보이는 건 예시입니다</span>' +
    '<button class="link-btn" type="button" id="dropSample">예시 치우기</button>';
  $("#statline").innerHTML = html;
  const drop = $("#dropSample");
  if (drop) drop.addEventListener("click", () => { board.seeded = true; save(); renderAll(); toast("예시를 치웠습니다."); });
}

/** 속보 거르개에서 분야를 골랐으면 "지금 갈 만한 곳"도 그 분야만 본다. */
function renderPick(){
  const cat = flt.cat ? CATS.find((c) => c.k === flt.cat) : null;
  const tag = cat ? '<span class="tagcat">' + esc(cat.nm) + "만</span>" : "";
  const gs = groups().filter((g) => !cat || g.cat === cat.k);
  /* 장소마다 지금 상황은 가장 최근 현장 정보 하나다(g.now) — 두 시간 전의 "한산"이
     방금 들어온 "붐빔"을 이기면 안 된다. 메모만 남긴 리포트는 지금을 말하지 못하므로 뺀다. */
  const cur = gs.filter((g) => g.now).map((g) => ({ g, r: g.now, s: cond(g.now) * freshness(g.now.t) }));
  if (!cur.length) {
    $("#pick").innerHTML = '<div class="pick empty"><h2>지금 들어온 소식이 없습니다' + tag + "</h2>" +
      '<p class="sub" style="margin-bottom:0">웨이팅·사람·주차가 담긴 3시간 안쪽 리포트가 있어야 “지금”을 말할 수 있습니다. ' +
      '밖에 계신 분이 첫 소식을 보내 주세요.</p>' + usualPickHtml(gs) + "</div>";
    return;
  }
  const top = cur.filter((x) => cond(x.r) >= .5).sort((a, b) => b.s - a.s).slice(0, 3);
  if (!top.length) {
    $("#pick").innerHTML = '<div class="pick empty"><h2>지금은 다들 붐빈다고 합니다' + tag + "</h2>" +
      '<p class="sub" style="margin-bottom:0">3시간 안쪽 소식이 들어온 ' + cur.length + '곳 가운데 ' +
      '“여유 있다”는 곳이 없습니다.</p></div>';
    return;
  }
  $("#pick").innerHTML = '<div class="pick"><h2>지금 갈 만한 곳<span class="tagnow">3시간 안쪽</span>' + tag + "</h2>" +
    '<p class="sub">장소마다 가장 최근 소식으로 봐서, 대기·혼잡·주차가 여유로운 곳을 신선한 순서로 세웠습니다.</p><ol>' +
    top.map((x, i) => {
      const chips = statChips(x.r).map((c) => c.s).join(" · ");
      return "<li>" +
        '<span class="rank">' + (i + 1) + "</span>" +
        '<button class="nm" type="button" data-open="' + esc(x.r.id) + '">' + esc(x.g.place) + "</button>" +
        '<span class="why">' + esc(ago(x.r.t)) + (chips ? " · " + esc(chips) : "") + " · " + esc(x.r.by) + " 특파원" +
          (x.g.confirm ? " · " + x.g.confirm.n + "명 확인" : "") +
          (x.g.conflicts.length ? " · 엇갈림 있음" : "") + "</span>" +   // 추천하면서 다른 말이 있다는 걸 감추지 않는다
      "</li>";
    }).join("") + "</ol></div>";
}
/** 지금 소식이 하나도 없을 때만 — 지난 기록으로 이 시간대에 보통 여유로웠던 곳. 지금 소식이 아니라고 붙여 말한다. */
function usualPickHtml(gs){
  const k = slotOf(Date.now());
  const good = gs.map((g) => ({ g, u: g.usual[k.d + ":" + k.s] }))
    .filter((x) => x.u && x.u.tone === "good")
    .sort((a, b) => (b.u.avg - a.u.avg) || (b.u.days - a.u.days))
    .slice(0, 3);
  if (!good.length) return "";
  return '<div class="pick-usual"><b>' + esc(slotName(k)) + "엔 보통 여유로운 곳</b>" +
    '<span class="u-src">지난 기록 · 지금 소식이 아닙니다</span><ul>' +
    good.map((x) => '<li><button class="nm" type="button" data-openkey="' + esc(x.g.key) + '">' + esc(x.g.place) + "</button>" +
      "<span>" + (x.g.area ? esc(x.g.area) + " · " : "") + x.u.days + "일 기록</span></li>").join("") +
    "</ul></div>";
}

/** 속보를 시간대로 나눈다 — 오늘·어제는 달력 기준이라 "5시간 전"이 어제가 되기도 한다. */
function timeBand(t){
  const d = Date.now() - t;
  if (d < LIVE) return 0;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  if (t >= midnight.getTime()) return 1;
  if (t >= midnight.getTime() - DAY) return 2;
  return 3;
}
const BANDS = ["지금", "오늘", "어제", "그 전"];

function renderFeed(){
  const list = filtered();
  $("#nFeed").textContent = list.length ? list.length : "";
  if (!list.length) {
    $("#feed").className = "feed bare";
    $("#feed").innerHTML = '<div class="empty"><b>보여 줄 리포트가 없습니다</b>' +
      "<p>" + (reports().length ? "거르개를 풀어 보세요." : "첫 리포트를 남기면 여기에 쌓입니다.") + "</p></div>";
  } else {
    $("#feed").className = "feed";
    let band = -1, html = "";
    list.forEach((r) => {
      const b = timeBand(r.t);
      if (b !== band) {
        band = b;
        const n = list.filter((x) => timeBand(x.t) === b).length;
        html += '<div class="tgroup"><b>' + BANDS[b] + "</b><i></i><span>" + n + "건</span></div>";
      }
      html += cardHtml(r);
    });
    $("#feed").innerHTML = html;
  }
  renderWatch();
  renderPick();
}

/* =========================================================================
   지켜보는 곳 — 자주 가는 곳을 속보 맨 위에 붙여 둔다
   목록은 이 기기에만 있다. 새 소식은 "마지막으로 본 뒤에 남이 쓴 것"이다 — 내가 쓴 건 이미 안다.
   ========================================================================= */
/** 장소 묶음에 해당하는 지켜보기 항목. 동네 없이 담았던 곳에 나중에 동네가 붙으면 이름으로 따라간다. */
function watchEntry(g){
  return board.watch.find((w) => w.k === g.key) ||
         board.watch.find((w) => w.k.charAt(w.k.length - 1) === "|" && g.key.indexOf(w.k) === 0) || null;
}
/** 지켜보는 순서대로 [{w, g}]. 예시 보드일 때는 진짜 장소가 아니므로 g 를 붙이지 않는다. */
function watchedGroups(gs){
  gs = gs || groups();
  let moved = false;
  const out = board.watch.map((w) => {
    if (isSample()) return { w, g:null };
    let g = gs.find((x) => x.key === w.k);
    if (!g && w.k.charAt(w.k.length - 1) === "|") {
      g = gs.find((x) => x.key.indexOf(w.k) === 0) || null;
      if (g) { w.k = g.key; moved = true; }        // 동네가 붙었다 — 열쇠를 옮긴다
    }
    return { w, g: g || null };
  });
  if (moved) save();
  return out;
}
const unseen = (w, g) => g ? g.rs.filter((r) => r.t > w.seen && !r.mine).length : 0;
/** 장소 창을 열었거나 열려 있는 동안 들어온 것은 본 것이다. */
function markSeen(g){
  if (isSample()) return false;
  const w = watchEntry(g);
  if (!w || g.last.t <= w.seen) return false;
  w.seen = g.last.t;
  save();
  return true;
}
function toggleWatch(g){
  const w = watchEntry(g);
  if (w) {
    board.watch = board.watch.filter((x) => x !== w);
    save();
    toast("그만 지켜봅니다 — " + g.place);
    return;
  }
  if (board.watch.length >= WATCH_MAX) { toast("지켜보는 곳은 " + WATCH_MAX + "곳까지입니다."); return; }
  board.watch.push({ k: g.key, nm: g.place, ar: g.area, seen: g.last.t });
  save();
  toast("지켜보는 곳에 넣었습니다 — 새 소식이 오면 속보 맨 위에 표시합니다.");
}
/** 새로 들어온 리포트 가운데 지켜보는 곳 것이 있으면 알릴 말. 내가 쓴 것은 빼고, 이미 본 것보다 옛것도 뺀다. */
function watchNews(fresh){
  if (!fresh || !fresh.length || !board.watch.length) return "";
  const ids = new Set(fresh.filter((r) => !r.mine).map((r) => r.id));
  const hit = watchedGroups()
    .filter((x) => x.g && x.g.rs.some((r) => ids.has(r.id) && r.t > x.w.seen))
    .map((x) => x.g.place);
  if (!hit.length) return "";
  return "지켜보는 곳에 새 소식 — " + hit.slice(0, 2).join(", ") + (hit.length > 2 ? " 외 " + (hit.length - 2) + "곳" : "");
}
function renderWatch(){
  const box = $("#watchBox");
  if (!board.watch.length) { box.innerHTML = ""; return; }
  const items = watchedGroups();
  box.innerHTML = '<div class="watch"><h2><span aria-hidden="true">★</span> 지켜보는 곳<span class="n">' + items.length + "</span></h2><ul>" +
    items.map((x) => {
      const w = x.w, g = x.g;
      if (!g) {
        return '<li class="w-gone"><span class="w-name">' + esc(w.nm) + "</span>" +
          (w.ar ? '<span class="w-area">' + esc(w.ar) + "</span>" : "") +
          '<span class="w-empty">아직 소식이 없습니다</span>' +
          '<button class="link-btn" type="button" data-unwatch="' + esc(w.k) + '">그만 보기</button></li>';
      }
      const n = unseen(w, g), u = usualNow(g);
      const body = g.now
        ? '<span class="w-stat"><span class="w-age">' + esc(ago(g.now.t)) + "</span>" +
            statChips(g.now).map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("") +
            (g.confirm ? '<span class="w-age">' + g.confirm.n + "명 확인</span>" : "") + "</span>"
        : u ? usualHintHtml(u, "span")
        : '<span class="w-empty">지금 소식 없음 · 마지막 ' + esc(ago(g.last.t)) + "</span>";
      return '<li><button class="w-row" type="button" data-openkey="' + esc(g.key) + '">' +
        '<span class="w-head"><span class="w-name">' + esc(g.place) + "</span>" +
          (g.area ? '<span class="w-area">' + esc(g.area) + "</span>" : "") +
          (n ? '<span class="w-new">새 소식 ' + n + "</span>" : "") +
        "</span>" + body + "</button></li>";
    }).join("") + "</ul></div>";
}

function renderPlaces(){
  let gs = groups();
  const q = pflt.q.trim().toLowerCase();
  if (q) gs = gs.filter((g) => (g.place + " " + g.area).toLowerCase().indexOf(q) !== -1);
  const by = {
    recent: (a, b) => b.last.t - a.last.t,
    many:   (a, b) => (b.n - a.n) || (b.last.t - a.last.t),
    rate:   (a, b) => (b.rate - a.rate) || (b.last.t - a.last.t),
    people: (a, b) => (b.people.length - a.people.length) || (b.last.t - a.last.t)
  };
  gs.sort(by[pflt.sort] || by.recent);
  $("#nPlaces").textContent = gs.length ? gs.length : "";
  $("#places").innerHTML = gs.length ? gs.map((g) => {
    const cat = CATS.find((c) => c.k === g.cat) || CATS[CATS.length - 1];
    const st = g.stat, w = isSample() ? null : watchEntry(g), n = w ? unseen(w, g) : 0, u = g.now ? null : usualNow(g);
    return '<button class="pl age-' + ageClass(g.last.t) + '" type="button" data-openkey="' + esc(g.key) + '">' +
      '<div class="pl-top">' +
        '<span class="cat"><span aria-hidden="true">' + cat.ic + "</span> " + esc(cat.nm) + "</span>" +
        '<span class="pl-name">' + esc(g.place) + "</span>" +
        (g.area ? '<span class="age">' + esc(g.area) + "</span>" : "") +
        (w ? '<span class="wmark"><span aria-hidden="true">★</span><span class="sr">지켜보는 곳</span></span>' : "") +
        (n ? '<span class="w-new">새 소식 ' + n + "</span>" : "") +
      "</div>" +
      (st ? '<div class="live-row' + (g.now ? "" : " faded") + '">' +
        '<span class="live-label">' + esc(liveLabel(st.t)) + "</span>" +
        statChips(st).map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("") +
        meterHtml(st) + "</div>" : "") +
      (u ? usualHintHtml(u) : "") +
      (g.confirm ? confirmHtml(g.confirm) : "") +
      (g.conflicts.length ? '<div class="conflict">엇갈립니다 · ' + esc(g.conflicts[0]) + "</div>" : "") +
      '<div class="pl-meta">' +
        avsHtml(g.people) +
        "<span>특파원 <b>" + g.people.length + "명</b></span>" +
        "<span>리포트 <b>" + g.n + "건</b></span>" +
        (g.rate ? "<span>별점 <b>" + g.rate.toFixed(1) + "</b></span>" : "") +
        "<span>마지막 <b>" + esc(ago(g.last.t)) + "</b></span>" +
        (g.tags.length ? '<span class="tags">' + g.tags.map((t) => "#" + esc(t)).join(" ") + "</span>" : "") +
      "</div></button>";
  }).join("") : '<div class="empty"><b>아직 장소가 없습니다</b><p>리포트가 쌓이면 같은 장소끼리 묶어서 보여 줍니다.</p></div>';
}

/** 몇 사람이 봤는지 — 얼굴을 겹쳐서 한눈에. 네 명까지 보이고 나머지는 숫자로. */
function avsHtml(people){
  const show = people.slice(0, 4);
  return '<span class="avs">' + show.map((n) => '<i title="' + esc(n) + '">' + esc(n.slice(0, 1)) + "</i>").join("") +
    (people.length > 4 ? '<i title="외 ' + (people.length - 4) + '명">+' + (people.length - 4) + "</i>" : "") + "</span>";
}

function renderPeople(){
  const all = reports();
  const map = new Map();
  all.forEach((r) => {
    let p = map.get(r.by);
    if (!p) { p = { by:r.by, n:0, last:0, lastR:null, day:0, areas:{}, cats:{} }; map.set(r.by, p); }
    p.n++;
    if (r.t > p.last) { p.last = r.t; p.lastR = r; }
    if (Date.now() - r.t < DAY) p.day++;
    if (r.area) p.areas[r.area] = (p.areas[r.area] || 0) + 1;
    p.cats[r.cat] = (p.cats[r.cat] || 0) + 1;
  });
  /* 많이 쓴 순으로 세우면 오래전에 많이 쓴 사람이 맨 위에 남는다.
     지금 물어볼 수 있는 사람이 위로 와야 쓸모가 있다. */
  const list = Array.from(map.values()).sort((a, b) => b.last - a.last);
  $("#nPeople").textContent = list.length ? list.length : "";

  const out = [];
  let band = -1;
  list.forEach((p) => {
    const b = Date.now() - p.last < SOFT ? 0 : 1;
    if (b !== band) {
      band = b;
      const n = list.filter((x) => (Date.now() - x.last < SOFT ? 0 : 1) === b).length;
      out.push('<div class="tgroup"><b>' + (b === 0 ? "지금 나가 있는 특파원" : "그 밖에") +
        "</b><i></i><span>" + n + "명</span></div>");
    }
    const area = Object.keys(p.areas).sort((x, y) => p.areas[y] - p.areas[x])[0];
    const catK = Object.keys(p.cats).sort((x, y) => p.cats[y] - p.cats[x])[0];
    const cat = CATS.find((c) => c.k === catK);
    const sub = [];
    if (area) sub.push("주로 " + esc(area));
    if (cat) sub.push('<span aria-hidden="true">' + cat.ic + "</span> " + esc(cat.nm));
    if (p.day) sub.push("하루 안 " + p.day + "건");
    out.push('<div class="pr' + (p.by === board.me ? " me" : "") + '">' +
      '<span class="av" aria-hidden="true">' + esc(p.by.slice(0, 2)) + "</span>" +
      '<span class="who"><b>' + esc(p.by) + (p.by === board.me ? " (나)" : "") +
        (b === 0 ? '<span class="dot on" title="3시간 안쪽에 소식을 보냈습니다"></span>' : "") + "</b>" +
        "<small>" + esc(ago(p.last)) + " · " + esc(p.lastR.place) + "</small>" +
        (sub.length ? '<small class="sub">' + sub.join(" · ") + "</small>" : "") +
      "</span>" +
      '<span class="cnt"><b>' + p.n + "</b><small>리포트</small></span></div>");
  });
  $("#people").innerHTML = list.length ? out.join("")
    : '<div class="empty"><b>아직 특파원이 없습니다</b><p>첫 리포트를 남기면 이름이 올라갑니다.</p></div>';
}

function renderSync(){
  const rs = board.reports;
  const bytes = (function(){ try { return (localStorage.getItem(KEY) || "").length; } catch(e){ return 0; } })();
  const oldest = rs.length ? Math.min.apply(null, rs.map((r) => r.t)) : 0;
  $("#boardInfo").innerHTML =
    "<dt>내 보드에 저장된 리포트</dt><dd>" + rs.length + "건" + (isSample() ? " (지금 화면은 예시)" : "") + "</dd>" +
    "<dt>장소</dt><dd>" + (rs.length ? groups().length + "곳" : "—") + "</dd>" +
    "<dt>가장 오래된 리포트</dt><dd>" + (oldest ? esc(fmtTime(oldest)) + " (" + esc(ago(oldest)) + ")" : "—") + "</dd>" +
    "<dt>차지하는 용량</dt><dd>" + (bytes ? (bytes / 1024).toFixed(1) + " KB" : "0 KB") + "</dd>";
}

function renderDatalists(){
  const gs = groups();
  $("#placeList").innerHTML = Array.from(new Set(gs.map((g) => g.place)))
    .map((p) => '<option value="' + esc(p) + '"></option>').join("");
  $("#areaList").innerHTML = Array.from(new Set(gs.map((g) => g.area).filter(Boolean)))
    .map((a) => '<option value="' + esc(a) + '"></option>').join("");
}

function paintMe(){
  $("#intro").hidden = !isSample();
  const named = !!board.me && !meEditing;
  $("#meSet").hidden = !named;
  $("#meForm").hidden = named;
  if (named) { $("#meName").textContent = board.me; $("#meAv").textContent = board.me.slice(0, 2); }
  $("#meLbl").textContent = board.me || "이름";
  $("#meBtn").title = board.me ? "특파원: " + board.me : "특파원 이름 정하기";
}
function renderAll(){
  /* 장소 창이 열려 있는 동안 들어온 새 소식은 본 것이다 — 뒤의 목록보다 먼저 표시해 둔다. */
  const open = openPlaceKey ? groups().find((x) => x.key === openPlaceKey) : null;
  if (open) markSeen(open);
  paintMe();
  renderTicker(); renderFeed(); renderPlaces(); renderPeople(); renderSync(); renderDatalists();
  if (open) fillPlaceSheet(open);
}

/* =========================================================================
   공용 보드

   서버가 없어도 앱은 그대로 돈다. config.js 가 비어 있으면 아래는 전부 잠들어 있고,
   리포트는 이 브라우저에만 쌓이며 링크로만 오간다.

   서버를 쓸 때도 로컬이 먼저다. 쓴 즉시 내 보드에 들어가고, 올리기는 그 다음이다.
   못 올렸으면 up:false 로 남아 있다가 다음 기회에 올라간다 — 지하 주차장에서 쓴 것도 안 날아간다.
   ========================================================================= */
const SY = window.TPW_SYNC || { enabled:false, hasSession:() => false };
let hoods = [];
let syncing = false;

function hoodLabel(code){
  const h = hoods.find((x) => x.code === code);
  return h ? h.label : "";
}

/** 서버에서 내려온 줄을 보드에 합친다. 링크로 받을 때와 똑같은 길목(sane/merge)을 지난다.

    내 글인지는 서버가 알려 준다(mine 계산 컬럼). 브라우저를 비우거나 다른 기기로 들어가도
    내 글이 남의 글로 보이지 않는다 — 그러면 내 글에 신고 단추가 붙는다.
    링크로 받는 쪽은 이 표시가 없으므로 여전히 mine 이 붙지 않는다. */
function mergeRows(rows){
  const gone = new Set(board.gone);
  const list = [];
  (rows || []).forEach((row) => {
    if (gone.has(row.id)) return;                  // 내가 이 기기에서 치운 남의 글
    const r = sane(SY.toReport(row));
    if (!r) return;
    r.sv = true; r.hd = board.hood;
    if (row.mine) { r.mine = true; r.up = true; r.hid = !!row.hidden; }   // 이미 서버에 있는 내 글
    list.push(r);
  });
  return merge(list);
}

/** 서버에서 사라진 글(탈퇴·삭제·신고로 가려짐)을 이 기기에서도 뺀다.
    받아온 범위 안에서만 판단한다 — 200건을 꽉 채워 받았으면 그보다 오래된 건 모르는 것이지 없어진 게 아니다.
    링크로만 받은 글(sv=false)과 아직 안 올린 내 글은 건드리지 않는다. */
function reconcile(rows, limit){
  const ids = new Set((rows || []).map((r) => r.id));
  const complete = (rows || []).length < limit;
  const oldest = rows && rows.length ? Math.min.apply(null, rows.map((r) => new Date(r.t).getTime())) : Infinity;
  /* 로그아웃 상태로 받아오면 가려진 내 글은 응답에 없다(쓴 사람인지 확인할 수 없으니까).
     그걸 "지워졌다"로 읽으면 안 된다 — 내 글은 로그인했을 때만 정리한다. */
  const authed = SY.hasSession();
  const before = board.reports.length;
  board.reports = board.reports.filter((r) =>
    !r.sv || ids.has(r.id) || (r.mine && !authed) || (r.hd && r.hd !== board.hood) || (!complete && r.t < oldest));
  return before - board.reports.length;
}

function rememberGone(id){
  if (board.gone.indexOf(id) === -1) board.gone.push(id);
  if (board.gone.length > 500) board.gone = board.gone.slice(-500);
}

async function syncPull(quiet){
  if (!SY.enabled || !board.hood || syncing) return;
  syncing = true;
  try {
    const LIMIT = 200;
    const rows = await SY.pull(board.hood, null, LIMIT);
    const res = mergeRows(rows);
    res.removed = reconcile(rows, LIMIT);
    board.pulledAt = Date.now();
    const wn = watchNews(res.fresh);   // 조용히 받아올 때도 지켜보는 곳 소식은 알린다
    save();
    renderAll();
    if (!quiet) toast(res.added ? res.added + "건을 받아왔습니다." + (wn ? " " + wn : "") : "새 소식이 없습니다.");
    else if (wn) toast(wn);
    return res;
  } catch (e) {
    if (!quiet) toast("받아오지 못했습니다: " + e.message);
  } finally { syncing = false; }
}

/** 서버는 프로필이 없으면 리포트를 안 받는다("특파원 등록이 먼저입니다").
    로그인만 하고 이름을 한 번도 저장 안 한 사람이 쓰면 첫 업로드가 여기서 걸렸다.
    올리기 전에 한 번 확인하고, 이름이 바뀌거나 로그아웃하면 다시 확인한다. */
let profileOk = false;
async function ensureProfile(){
  if (profileOk) return true;
  if (!SY.hasSession()) return false;
  /* 이름을 안 정했어도 프로필은 있어야 한다 — 신고도 프로필을 물고 들어간다.
     글을 한 번도 안 올린 사람이 신고하면 여기서 걸렸다. */
  try { await SY.saveProfile(board.me || "이름 없는 특파원", board.hood || null); profileOk = true; return true; }
  catch (e) { return false; }
}

/** 운영정책으로 글쓰기가 정지된 상태인가 — 서버가 올리기를 거부하면 안다.
    정지를 모르고 "다음에 다시 올립니다"만 보이면 사용자는 앱이 고장 난 줄 안다. */
let suspended = false;
const SUSPENDED_MSG = "운영정책에 따라 글쓰기가 정지된 상태입니다. 쓴 글은 이 기기에 남고, 정지가 풀리면 올라갑니다. " +
  "이의가 있으면 이용약관의 운영정책 5조로 신청하세요.";

/** 아직 못 올린 내 리포트를 올린다. 남의 글(mine=false)은 절대 올리지 않는다. */
async function syncPushPending(){
  if (!SY.enabled || !board.hood || !SY.hasSession()) return 0;
  const pending = board.reports.filter((r) => r.mine && !r.up && !r.priv);
  if (!pending.length) return 0;
  if (!(await ensureProfile())) return 0;
  let n = 0;
  for (const r of pending) {
    try { await SY.push(r, board.hood); r.up = true; r.sv = true; r.hd = board.hood; n++; suspended = false; }
    catch (e) {
      /* 이미 올라가 있으면(같은 id) 올린 것으로 친다. 그 밖의 실패는 다음 기회에. */
      if (/duplicate|already exists|23505/i.test(e.message)) { r.up = true; r.sv = true; r.hd = board.hood; }
      else { if (/보낼 수 없습니다/.test(e.message)) suspended = true; break; }
    }
  }
  if (n) save();
  return n;
}

async function boardRefresh(quiet){
  await syncPushPending();
  await syncPull(quiet);
}

function paintBoardBtn(){
  $("#boardBtn").hidden = !SY.enabled;
  if (!SY.enabled) return;
  const lbl = board.hood ? (hoodLabel(board.hood).split(" ").pop() || "동네") : "동네 고르기";
  $("#boardLbl").textContent = lbl;
  $("#boardBtn").title = board.hood ? "공용 보드: " + hoodLabel(board.hood) : "동네를 고르세요";
}

function paintAuthBox(){
  const box = $("#authBox");
  if (SY.hasSession()) {
    box.innerHTML = '<div class="row" style="margin-top:0"><span class="note">로그인되어 있습니다.</span>' +
      '<button class="btn sm ghost" id="signOut" type="button">로그아웃</button>' +
      '<button class="btn sm ghost danger-text" id="delOpen" type="button">계정 삭제</button></div>';
    $("#signOut").addEventListener("click", () => {
      SY.signOut();
      profileOk = false;
      paintAuthBox(); paintBoardBtn(); renderAll();
      toast("로그아웃했습니다. 읽기는 그대로 됩니다.");
    });
    $("#delOpen").addEventListener("click", () => { closeSheets(true); openDeleteSheet(); });
  } else {
    /* 만 14세 미만은 법정대리인 동의 없이 개인정보를 받을 수 없다(개인정보보호법 22조의2).
       동의를 받는 절차를 두지 않았으므로 14세 미만은 로그인하지 않게 한다. */
    box.innerHTML =
      '<label class="agree"><input type="checkbox" id="ageOk"> <span>만 14세 이상이며, ' +
        '<a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>을 확인했습니다.</span></label>' +
      '<div class="row"><button class="btn sm primary" id="inKakao" type="button" disabled>카카오로 로그인</button></div>' +
      '<div class="row"><input class="input grow" id="inEmail" type="email" placeholder="메일 주소 (시험용)" autocomplete="email">' +
      '<button class="btn sm" id="inEmailGo" type="button" disabled>링크 받기</button></div>';
    $("#ageOk").addEventListener("change", (e) => {
      $("#inKakao").disabled = !e.target.checked;
      $("#inEmailGo").disabled = !e.target.checked;
    });
    $("#inKakao").addEventListener("click", () => SY.signInKakao());
    $("#inEmailGo").addEventListener("click", async () => {
      const st = $("#boardStatus");
      const mail = $("#inEmail").value.trim();
      if (!mail) { st.textContent = "메일 주소를 적어 주세요."; st.className = "status err"; return; }
      try {
        await SY.signInEmail(mail);
        st.textContent = "메일을 보냈습니다. 링크를 누르면 이 화면으로 돌아옵니다.";
        st.className = "status ok";
      } catch (e) { st.textContent = "보내지 못했습니다: " + e.message; st.className = "status err"; }
    });
  }
}

/* ─────────────────────────── 계정 삭제 ─────────────────────────── */
function openDeleteSheet(){
  const mineHere = board.reports.filter((r) => r.mine).length;
  $("#delMine").textContent = mineHere;
  $("#delConfirm").value = "";
  $("#delGo").disabled = true;
  $("#delStatus").textContent = ""; $("#delStatus").className = "status";
  openSheet("#delBack");
}

async function doDeleteAccount(){
  const st = $("#delStatus");
  st.textContent = "지우는 중…"; st.className = "status";
  $("#delGo").disabled = true;
  try {
    await SY.deleteAccount();
  } catch (e) {
    st.textContent = "지우지 못했습니다: " + e.message + " — 잠시 뒤 다시 해 보세요. 안 되면 개인정보처리방침의 연락처로 요청해 주세요.";
    st.className = "status err";
    $("#delGo").disabled = false;
    return;
  }
  /* 서버에서 지워졌으면 이 기기에서도 내가 쓴 것과 이름을 지운다. 남에게 받은 리포트는 남는다. */
  const before = board.reports.length;
  board.reports = board.reports.filter((r) => !r.mine);
  const gone = before - board.reports.length;
  board.me = "";
  profileOk = false;
  meEditing = false;
  save();
  closeSheets();
  paintBoardBtn(); renderAll();
  toast("계정을 지웠습니다. 이 기기에서도 내 리포트 " + gone + "건을 지웠습니다.");
}

function paintBoardKv(){
  const mine = board.reports.filter((r) => r.mine).length;
  const up = board.reports.filter((r) => r.mine && r.up).length;
  $("#boardKv").innerHTML =
    "<dt>동네</dt><dd>" + (board.hood ? esc(hoodLabel(board.hood)) : "아직 안 골랐습니다") + "</dd>" +
    "<dt>마지막 받아오기</dt><dd>" + (board.pulledAt ? esc(ago(board.pulledAt)) : "—") + "</dd>" +
    "<dt>내가 쓴 리포트</dt><dd>" + mine + "건 (올라간 것 " + up + "건)</dd>" +
    /* 문의·정지 이의 신청 때 운영자가 사람을 찾는 번호. 이름은 겹칠 수 있고 바뀐다. */
    (SY.hasSession() && SY.uid && SY.uid() ? '<dt>계정 번호</dt><dd><span class="mono">' + esc(SY.uid()) +
      '</span><br><span class="note">문의나 이의 신청 때 알려 주세요.</span></dd>' : "");
}

async function openBoardSheet(){
  $("#boardStatus").textContent = ""; $("#boardStatus").className = "status";
  if (!hoods.length) {
    try { hoods = await SY.listHoods() || []; } catch (e) {}
  }
  $("#hoodSel").innerHTML = '<option value="">— 동네를 고르세요 —</option>' +
    hoods.map((h) => '<option value="' + esc(h.code) + '"' + (h.code === board.hood ? " selected" : "") +
      ">" + esc(h.label) + "</option>").join("");
  paintAuthBox();
  if (SY.hasSession()) { try { await SY.whoami(); } catch (e) {} }
  paintBoardKv();
  openSheet("#boardBack");
}

/* ─────────────────────────── 리포트 하나 지우기 ─────────────────────────── */
async function deleteOne(id){
  const r = board.reports.find((x) => x.id === id);
  if (!r) return;
  const onServer = SY.enabled && r.mine && r.up;
  if (onServer && !SY.hasSession()) {
    toast("공용 보드에 올라간 글입니다. 로그인한 뒤에 지워야 서버에서도 지워집니다.");
    return;
  }
  const msg = onServer ? "“" + r.place + "” 리포트를 지울까요? 공용 보드에서도 지워집니다."
    : r.sv ? "“" + r.place + "” 리포트를 이 기기에서 치울까요? 다른 사람에게는 그대로 보입니다."
    : "“" + r.place + "” 리포트를 지울까요? 이 브라우저에서만 지워집니다.";
  if (!confirm(msg)) return;
  if (onServer) {
    try {
      const rows = await SY.removeMine(r.id);
      /* 0건이면: 이미 없거나(괜찮다), 지금 계정의 글이 아니다(지우면 안 된다 — 서버엔 남는다). */
      if ((!rows || !rows.length) && await SY.exists(r.id)) {
        toast("서버에서 지우지 못했습니다. 지금 로그인한 계정이 쓴 글이 아닙니다.");
        return;
      }
    } catch (e) {
      toast("서버에서 지우지 못했습니다: " + e.message);
      return;
    }
  } else if (r.sv) {
    rememberGone(r.id);   // 다음 받아오기 때 도로 들어오지 않게
  }
  board.reports = board.reports.filter((x) => x.id !== r.id);
  save();
  renderAll();
  toast(onServer ? "공용 보드에서도 지웠습니다." : "지웠습니다.");
}

/* ─────────────────────────── 신고 ─────────────────────────── */
const FLAG_REASONS = ["거짓", "광고", "욕설", "사생활", "기타"];
let flagTarget = null;

function openFlagSheet(r){
  flagTarget = r;
  $("#flagWhat").innerHTML = "“" + esc(r.place) + "” · " + esc(r.by) + " 특파원 · " + esc(ago(r.t));
  $("#flagStatus").textContent = ""; $("#flagStatus").className = "status";
  $("#flagReasons").innerHTML = FLAG_REASONS.map((x) =>
    '<button class="chip" type="button" data-reason="' + esc(x) + '">' + esc(x) + "</button>").join("");
  openSheet("#flagBack");
}

/* =========================================================================
   시트(모달)
   ========================================================================= */
const BEHIND = () => [$(".bar"), $("main"), $("footer")];
function openSheet(sel){
  if (!lastFocus) lastFocus = document.activeElement;
  $$(".backdrop.open").forEach((b) => b.classList.remove("open"));   // 시트는 한 번에 하나
  BEHIND().forEach((el) => el && (el.inert = true));
  $(sel).classList.add("open");
  document.body.style.overflow = "hidden";
  const f = $(sel).querySelector("[data-autofocus]") ||
            $(sel).querySelector("input:not([hidden]),textarea,button:not(.x)");
  if (f) setTimeout(() => f.focus(), 30);
}
function closeSheets(keepFocus){
  $$(".backdrop.open").forEach((b) => b.classList.remove("open"));
  BEHIND().forEach((el) => el && (el.inert = false));
  document.body.style.overflow = "";
  openPlaceKey = null;
  if (!keepFocus && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(e){} }
  if (!keepFocus) lastFocus = null;
}
let toastTimer = null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  /* 긴 알림(정지 안내 같은 것)은 읽을 시간만큼 둔다 — 한 글자에 60ms, 적어도 2.6초 */
  toastTimer = setTimeout(() => { t.hidden = true; }, Math.max(2600, String(msg).length * 60));
}
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; } catch(e){}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch(e){ return false; }
}

/* =========================================================================
   리포트 쓰기
   ========================================================================= */
function segHtml(table, sel, field){
  return table.map((o) => '<button class="chip" type="button" data-f="' + field + '" data-v="' + o.v +
    '" aria-pressed="' + (o.v === sel) + '">' + esc(o.nm) + "</button>").join("");
}
function paintCompose(){
  $("#fCat").innerHTML = CATS.map((c) => '<button class="chip" type="button" data-f="cat" data-v="' + c.k +
    '" aria-pressed="' + (c.k === draft.cat) + '"><span aria-hidden="true">' + c.ic + "</span> " + esc(c.nm) + "</button>").join("");
  $("#fWait").innerHTML  = segHtml(WAIT,  draft.wait,  "wait");
  $("#fCrowd").innerHTML = segHtml(CROWD, draft.crowd, "crowd");
  $("#fPark").innerHTML  = segHtml(PARK,  draft.park,  "park");
  $("#fTags").innerHTML  = TAGS.map((t) => '<button class="chip" type="button" data-tag="' + esc(t) +
    '" aria-pressed="' + (draft.tags.indexOf(t) !== -1) + '">#' + esc(t) + "</button>").join("");
  $("#fRate").innerHTML = [1, 2, 3, 4, 5].map((n) => '<button type="button" data-star="' + n +
    '" class="' + (n <= draft.rate ? "on" : "") + '" aria-label="별 ' + n + '개" aria-pressed="' +
    (n === draft.rate) + '">★</button>').join("");
}
/** ref 를 주면 "나도 여기" — 같은 장소의 새 리포트.
    장소·동네·분야·태그처럼 오래 가는 것만 채운다. 웨이팅·사람·주차는 채우지 않고
    참고로만 보여 준다. 안 보고 눌러도 옛 정보가 새 시각을 달고 나가지 않게. */
let composeRef = null;
function openCompose(ref){
  composeRef = ref && ref.place ? ref : null;
  const mine = board.reports.filter((r) => r.by === board.me);
  draft = { cat: composeRef ? composeRef.cat : "play", wait:-1, crowd:-1, park:-1, rate:0,
            tags: composeRef ? composeRef.tags.slice() : [] };
  $("#fPlace").value = composeRef ? composeRef.place : "";
  $("#fArea").value = composeRef ? composeRef.area : (mine.length ? mine[0].area : "");
  $("#fNote").value = "";
  $("#fNote").placeholder = composeRef ? "달라진 게 있으면 적어 주세요."
    : "예: 2시 넘으니 자리 났어요. 주차는 골목 유료로 대는 게 빠릅니다.";
  $("#composeTitle").textContent = composeRef ? "여기 지금 상황" : "리포트 보내기";
  paintRef();
  const refChips = composeRef && statChips(composeRef).length;
  $("#fPlace").toggleAttribute("data-autofocus", !refChips);
  $("#fRefSame").toggleAttribute("data-autofocus", !!refChips);
  $("#fBy").value = board.me;
  $("#noteCnt").textContent = "0/200";
  $("#composeErr").textContent = "";
  $("#fPubRow").hidden = !SY.enabled;
  $("#fPub").checked = true;
  paintCompose();
  openSheet("#composeBack");
}

function paintRef(){
  const box = $("#fRef");
  box.hidden = !composeRef;
  if (!composeRef) return;
  const r = composeRef, chips = statChips(r);
  $("#fRefWho").textContent = r.by + " 특파원 · " + ago(r.t);
  $("#fRefStats").innerHTML = chips.length
    ? chips.map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("")
    : '<span class="note">현장 정보 없이 메모만 남긴 리포트입니다.</span>';
  $("#fRefSame").hidden = !chips.length;
  syncSame();
}
/** "그대로예요" 는 지금 고른 값이 앞 리포트와 같은지를 그대로 보여 준다 — 누른 뒤 칩을 바꾸면 풀린다. */
function syncSame(){
  if (!composeRef) return;
  const same = draft.wait === composeRef.wait && draft.crowd === composeRef.crowd && draft.park === composeRef.park;
  $("#fRefSame").setAttribute("aria-pressed", String(same));
  $("#fRefSame").textContent = same ? "✓ 그대로" : "그대로예요";
}

let shareCache = "", shareSeq = 0;
async function openShare(list){
  /* 글은 압축이 끝나야 생긴다. 그 전에 누른 "복사"가 앞서 만든 남의 글을 복사하지 않게 비워 두고,
     그사이 다른 공유 창이 열렸으면 늦게 끝난 이 글로 그 창을 덮지 않는다. */
  const seq = ++shareSeq;
  shareCache = "";
  $("#shareBox").value = "만드는 중…";
  const st = $("#shareStatus");
  st.textContent = ""; st.className = "status";
  $("#shareNative").hidden = !navigator.share;
  openSheet("#shareBack");
  try {
    const code = await pack(list);
    if (seq !== shareSeq) return;
    shareCache = shareText(list, code);
    const box = $("#shareBox");
    box.value = shareCache;
    box.scrollTop = 0;
    try { box.setSelectionRange(0, 0); } catch(e){}
  } catch(e) {
    if (seq !== shareSeq) return;
    $("#shareBox").value = "";
    st.textContent = "공유글을 만들지 못했습니다: " + e.message;
    st.className = "status err";
  }
}

/* =========================================================================
   장소 상세
   ========================================================================= */
function fillPlaceSheet(g){
  const cat = CATS.find((c) => c.k === g.cat) || CATS[CATS.length - 1];
  const w = watchEntry(g), st = g.stat, u = g.now ? null : usualNow(g);
  $("#placeTitle").textContent = g.place;
  $("#placeBody").innerHTML =
    '<div class="det-head">' +
      '<div class="pl-top"><span class="cat"><span aria-hidden="true">' + cat.ic + "</span> " + esc(cat.nm) + "</span>" +
        (g.area ? '<span class="age mono">' + esc(g.area) + "</span>" : "") +
        /* 이름은 그대로 두고 눌림 상태로 말한다 — 읽는 프로그램에는 "지켜보기, 눌림" */
        (isSample() ? "" : '<button class="chip wbtn" type="button" data-watch="' + esc(g.key) + '" aria-pressed="' + !!w + '">' +
          '<span aria-hidden="true">' + (w ? "★" : "☆") + "</span> 지켜보기</button>") +
      "</div>" +
      '<div class="det-stats">' +
        "<span>리포트 <b>" + g.n + "</b>건</span>" +
        "<span>특파원 <b>" + g.people.length + "</b>명</span>" +
        (g.rate ? "<span>별점 <b>" + g.rate.toFixed(1) + "</b></span>" : "") +
        "<span>마지막 <b>" + esc(ago(g.last.t)) + "</b></span>" +
      "</div>" +
      (g.tags.length ? '<div class="tags">' + g.tags.map((t) => "#" + esc(t)).join(" ") + "</div>" : "") +
      (st ? '<div class="note">가장 최근 현장 정보 — ' + esc(liveLabel(st.t)) + " 기준</div>" + liveRowHtml(st)
          : '<div class="note">현장 정보 없이 메모만 남은 곳입니다.</div>') +
      (u ? usualHintHtml(u) : "") +
      (g.confirm ? confirmHtml(g.confirm) : "") +
      (g.conflicts.length ? g.conflicts.map((c) => '<div class="conflict">엇갈립니다 · ' + esc(c) + "</div>").join("") : "") +
      (g.people.length > 1 ? '<div class="note">' + esc(g.people.join(", ")) + " 특파원이 다녀갔습니다.</div>" : "") +
    "</div>" +
    usualTableHtml(g) +
    '<div class="panel-t">들어온 순서대로</div>' +
    '<div class="tl">' + g.rs.map((r) => cardHtml(r, { plain:true, noDelete:true })).join("") + "</div>";
}
/** 요일·시간대 표. 지금 칸에 테를 두르고, 기록이 모자란 칸은 비워 둔다 — 없는 걸 지어내지 않는다. */
function usualTableHtml(g){
  if (!Object.keys(g.usual).length) {
    const past = g.rs.some((r) => Date.now() - r.t >= SOFT && statChips(r).length);
    return past ? '<p class="note" style="margin:-4px 0 16px">보통 어떤지는 서로 다른 날 두 번 이상 들어온 시간대부터 ' +
      "보여 드립니다. 기록이 더 쌓이면 여기에 요일·시간대별로 나옵니다.</p>" : "";
  }
  const k = slotOf(Date.now());
  return '<div class="panel-t">보통은<span class="note">지난 기록 · 지금 소식이 아닙니다</span></div>' +
    '<table class="usual"><caption class="sr">요일·시간대별로 지난 리포트가 보통 어땠는지</caption>' +
    '<colgroup><col class="rh"><col span="5"></colgroup>' +
    "<thead><tr><td></td>" + SLOTS.map((s) => '<th scope="col">' + s.nm + "</th>").join("") + "</tr></thead><tbody>" +
    DAYTYPES.map((dn, d) => '<tr><th scope="row">' + dn + "</th>" + SLOTS.map((s, i) => {
      const c = g.usual[d + ":" + i], now = d === k.d && i === k.s;
      return '<td class="' + (c ? c.tone : "none") + (now ? " now" : "") + '"' + (now ? ' aria-current="time"' : "") + ">" +
        (now ? '<small class="u-now">지금</small>' : "") +
        (c ? esc(c.nm) + "<small>" + c.days + "일</small>" : '<span aria-hidden="true">·</span><span class="sr">기록 모자람</span>') +
      "</td>";
    }).join("") + "</tr>").join("") + "</tbody></table>" +
    '<p class="note" style="margin-bottom:16px">3시간이 지난 리포트만 셉니다. 서로 다른 날 두 번 이상 본 칸만 채우고, ' +
    "새벽(0~6시)은 전날 밤으로, 공휴일은 평일로 칩니다.</p>";
}
function openPlaceSheet(g){
  openPlaceKey = g.key;
  $("#placeAgain").hidden = isSample();
  if (markSeen(g)) { renderWatch(); renderPlaces(); }
  fillPlaceSheet(g);
  openSheet("#placeBack");
}

/* =========================================================================
   받기
   ========================================================================= */
function findCode(text){
  const s = String(text == null ? "" : text).trim();
  const m = s.match(/[#?&]r=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[12][A-Za-z0-9_-]{8,}$/.test(s)) return s;
  return null;
}
function merge(list){
  const have = new Set(board.reports.map((r) => r.id));
  let added = 0, dup = 0;
  const fresh = [];                                  // 새로 들어온 것 — 지켜보는 곳 알림에 쓴다
  list.forEach((r) => {
    if (have.has(r.id)) {
      dup++;
      /* 이미 갖고 있더라도 "내 글이고 서버에 있다"는 사실은 갱신한다.
         안 그러면 올린 적 없는 것으로 알고 계속 다시 올리려 든다. */
      const cur = board.reports.find((x) => x.id === r.id);
      if (cur && r.sv) { cur.sv = true; cur.hd = r.hd; }
      if (cur && r.mine) { cur.mine = true; cur.up = true; cur.hid = r.hid; }
      return;
    }
    if (!r.sv) board.gone = board.gone.filter((x) => x !== r.id);   // 링크로 일부러 다시 받은 것
    have.add(r.id);
    board.reports.push(r);
    fresh.push(r);
    added++;
  });
  if (added) {
    board.seeded = true;
    board.reports.sort((a, b) => b.t - a.t);
    if (!save()) toast("저장 공간이 부족합니다. 오래된 리포트를 지워 보세요.");
  }
  return { added, dup, fresh };
}
/** 받은 결과를 한 줄로 — 지켜보는 곳에 새 소식이 있으면 그걸 붙인다. */
function mergeNote(res, head){
  const wn = watchNews(res.fresh);
  return head + (wn ? " " + wn : "");
}
function clearHash(){
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}
async function checkHash(){
  const m = location.hash.match(/^#r=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  const box = $("#inbox");
  try {
    const list = await unpack(m[1]);
    inboxCache = list;
    const have = new Set(board.reports.map((r) => r.id));
    const fresh = list.filter((r) => !have.has(r.id));
    const names = Array.from(new Set(list.map((r) => r.place))).slice(0, 4).join(", ");
    if (!fresh.length) {
      box.innerHTML = '<div class="inbox"><h2>이미 갖고 있는 리포트입니다</h2>' +
        "<p>" + esc(names) + " · " + list.length + "건 모두 보드에 있습니다.</p>" +
        '<div class="row"><button class="btn sm ghost" id="inboxNo" type="button">닫기</button></div></div>';
    } else {
      box.innerHTML = '<div class="inbox"><h2>📡 리포트 ' + fresh.length + "건이 도착했습니다</h2>" +
        "<p>" + esc(names) + (list.length > fresh.length ? " · 이미 있는 " + (list.length - fresh.length) + "건은 뺐습니다" : "") + "</p>" +
        '<div class="row"><button class="btn primary sm" id="inboxYes" type="button">보드에 받기</button>' +
        '<button class="btn sm ghost" id="inboxNo" type="button">안 받기</button></div></div>';
    }
  } catch(e) {
    box.innerHTML = '<div class="inbox"><h2>링크를 읽지 못했습니다</h2><p>' + esc(e.message) +
      ' 링크가 잘렸을 수 있으니, 받은 글을 통째로 복사해서 <b>주고받기</b> 칸에 붙여 넣어 보세요.</p>' +
      '<div class="row"><button class="btn sm ghost" id="inboxNo" type="button">닫기</button></div></div>';
  }
  const yes = $("#inboxYes"), no = $("#inboxNo");
  if (yes) yes.addEventListener("click", () => {
    const res = merge(inboxCache || []);
    const msg = mergeNote(res, res.added + "건을 받았습니다." + (res.dup ? " (" + res.dup + "건은 이미 있었음)" : ""));
    box.innerHTML = "";
    clearHash();
    renderAll();
    toast(msg);
  });
  if (no) no.addEventListener("click", () => { box.innerHTML = ""; clearHash(); });
}

/* =========================================================================
   묶음 만들기 — 카톡에서 안 깨지게 길이를 맞춘다
   ========================================================================= */
async function packCapped(list, cap){
  let n = Math.min(list.length, 120);
  let code = await pack(list.slice(0, n));
  while (code.length > cap && n > 1) {
    n = Math.max(1, Math.floor(n * .75));
    code = await pack(list.slice(0, n));
  }
  return { code, used: list.slice(0, n) };
}

/* =========================================================================
   테마
   ========================================================================= */
const TH = { auto:"자동", light:"밝게", dark:"어둡게" };
let theme = store.get("tpw.theme", "auto");
const BAR = { light:"#FFFFFF", dark:"#181B1E" };
function applyTheme(t){
  theme = TH[t] ? t : "auto";
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
  /* 주소창·홈 화면 앱의 윗줄 색. 자동이면 기기 설정을 따르고, 고르면 고른 쪽으로 둘 다 맞춘다. */
  $$('meta[name="theme-color"]').forEach((m) => {
    const scheme = /dark/.test(m.media) ? "dark" : "light";
    m.content = theme === "auto" ? BAR[scheme] : BAR[theme];
  });
  $("#themeBtn").title = "테마: " + TH[theme] + " (눌러서 바꾸기)";
  store.set("tpw.theme", theme);
}

/* =========================================================================
   화면 전환
   ========================================================================= */
function switchView(name){
  view = name;
  $$(".tab").forEach((b) => {
    const on = b.dataset.view === name;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;               // 탭 키로는 고른 탭 하나만, 나머지는 화살표로
  });
  $$(".view").forEach((s) => { s.hidden = s.id !== "view-" + name; });
}

/* =========================================================================
   이벤트
   ========================================================================= */
function bind(){
  /* 탭 */
  $$(".tab").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  $(".tabs").addEventListener("keydown", (e) => {
    const tabs = $$(".tab"), i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
            : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (j === -1) return;
    e.preventDefault();
    switchView(tabs[j].dataset.view);
    tabs[j].focus();
  });

  /* 큰 버튼 */
  $("#writeBtn").addEventListener("click", () => openCompose());
  $("#recvBtn").addEventListener("click", () => {
    switchView("sync");
    $("#view-sync").scrollIntoView({ behavior:"smooth", block:"start" });
    setTimeout(() => $("#recvBox").focus(), 250);
  });
  $("#themeBtn").addEventListener("click", () => {
    applyTheme(theme === "auto" ? "light" : theme === "light" ? "dark" : "auto");
  });
  $("#meBtn").addEventListener("click", () => {
    switchView("people");
    meEditing = true;
    paintMe();
    $("#meInput").value = board.me;
    setTimeout(() => $("#meInput").focus(), 60);
  });

  /* 속보 거르개 */
  $("#catFilter").innerHTML = [{ k:"", ic:"", nm:"전체" }].concat(CATS).map((c) =>
    '<button class="chip" type="button" data-cat="' + c.k + '" aria-pressed="' + (c.k === flt.cat) + '">' +
    (c.ic ? '<span aria-hidden="true">' + c.ic + "</span> " : "") + esc(c.nm) + "</button>").join("");
  $("#catFilter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    flt.cat = b.dataset.cat;
    $$("#catFilter [data-cat]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cat === flt.cat)));
    renderFeed();
  });
  $("#q").addEventListener("input", (e) => { flt.q = e.target.value; renderFeed(); });
  $("#liveOnly").addEventListener("click", (e) => {
    flt.liveOnly = !flt.liveOnly;
    e.currentTarget.setAttribute("aria-pressed", String(flt.liveOnly));
    renderFeed();
  });
  $("#sort").addEventListener("change", (e) => { flt.sort = e.target.value; renderFeed(); });
  $("#pq").addEventListener("input", (e) => { pflt.q = e.target.value; renderPlaces(); });
  $("#psort").addEventListener("change", (e) => { pflt.sort = e.target.value; renderPlaces(); });

  /* 내 이름 */
  $("#meEdit").addEventListener("click", () => {
    meEditing = true;
    paintMe();
    $("#meInput").value = board.me;
    $("#meInput").focus();
  });
  $("#meSave").addEventListener("click", () => {
    board.me = clip($("#meInput").value, 20);
    meEditing = false;
    save();
    paintMe();
    if (SY.enabled && SY.hasSession() && board.me) {
      profileOk = false;
      ensureProfile();
    }
    renderPeople();
    toast(board.me ? board.me + " 특파원으로 저장했습니다." : "이름을 비웠습니다.");
  });
  $("#meInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#meSave").click(); } });

  /* 카드·장소·지금갈만한곳 — 위임 */
  document.addEventListener("click", (e) => {
    const wt = e.target.closest("[data-watch]");
    if (wt) {
      const g = groups().find((x) => x.key === wt.dataset.watch);
      if (!g) return;
      toggleWatch(g);
      renderAll();
      const again = $("#placeBody [data-watch]");   // 다시 그렸으니 초점을 새 단추로 돌려 놓는다
      if (again) again.focus();
      return;
    }
    const uw = e.target.closest("[data-unwatch]");
    if (uw) {
      board.watch = board.watch.filter((w) => w.k !== uw.dataset.unwatch);
      save();
      renderAll();
      toast("그만 지켜봅니다.");
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      const g = groups().find((x) => x.rs.some((r) => r.id === open.dataset.open));
      if (g) openPlaceSheet(g);
      return;
    }
    const key = e.target.closest("[data-openkey]");
    if (key) {
      const g = groups().find((x) => x.key === key.dataset.openkey);
      if (g) openPlaceSheet(g);
      return;
    }
    const ag = e.target.closest("[data-again]");
    if (ag) {
      const r = reports().find((x) => x.id === ag.dataset.again);
      if (r) { closeSheets(true); openCompose(r); }
      return;
    }
    const sh = e.target.closest("[data-share]");
    if (sh) {
      const r = reports().find((x) => x.id === sh.dataset.share);
      if (r) openShare([r]);
      return;
    }
    const fl = e.target.closest("[data-flag]");
    if (fl) {
      const r = reports().find((x) => x.id === fl.dataset.flag);
      if (r) openFlagSheet(r);
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) deleteOne(del.dataset.del);
  });

  /* 시트 닫기 */
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeSheets()));
  $$(".backdrop").forEach((b) => b.addEventListener("click", (e) => { if (e.target === b) closeSheets(); }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $(".backdrop.open")) closeSheets(); });

  /* 리포트 쓰기 */
  $("#composeForm").addEventListener("click", (e) => {
    const seg = e.target.closest("[data-f]");
    if (seg) {
      const f = seg.dataset.f;
      draft[f] = f === "cat" ? seg.dataset.v : Number(seg.dataset.v);
      paintCompose();
      syncSame();
      return;
    }
    const tag = e.target.closest("[data-tag]");
    if (tag) {
      const t = tag.dataset.tag, i = draft.tags.indexOf(t);
      if (i === -1) {
        if (draft.tags.length >= 6) { toast("태그는 6개까지입니다."); return; }
        draft.tags.push(t);
      } else draft.tags.splice(i, 1);
      paintCompose();
      return;
    }
    const st = e.target.closest("[data-star]");
    if (st) {
      const n = Number(st.dataset.star);
      draft.rate = draft.rate === n ? 0 : n;
      paintCompose();
    }
  });
  $("#fNote").addEventListener("input", (e) => { $("#noteCnt").textContent = e.target.value.length + "/200"; });
  $("#composeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const place = clip($("#fPlace").value, 40);
    if (!place) {
      $("#composeErr").textContent = "어디에 계신지 적어 주세요.";
      $("#fPlace").focus();
      return;
    }
    /* "나도 여기" 인데 아무것도 안 골랐으면 새 시각만 달린 빈 카드가 된다 — 막는다. */
    if (composeRef && draft.wait === -1 && draft.crowd === -1 && draft.park === -1 && !draft.rate &&
        !clip($("#fNote").value, 200)) {
      $("#composeErr").textContent = "지금 상황을 하나라도 고르거나 한 줄 남겨 주세요." +
        (statChips(composeRef).length ? " 똑같으면 “그대로예요”." : "");
      (statChips(composeRef).length ? $("#fRefSame") : $("#fNote")).focus();
      return;
    }
    const by = clip($("#fBy").value, 20) || board.me || "이름 없는 특파원";
    const r = sane({
      id:newId(), t:Date.now(), by, cat:draft.cat, place, area:clip($("#fArea").value, 30),
      wait:draft.wait, crowd:draft.crowd, park:draft.park, rate:draft.rate, tags:draft.tags,
      note:clip($("#fNote").value, 200)
    });
    if (!r) { $("#composeErr").textContent = "리포트를 만들지 못했습니다."; return; }
    const first = !board.reports.length;
    r.mine = true;                 // 내가 쓴 것 — 올릴 수 있는 건 이것뿐이다
    r.priv = SY.enabled && !$("#fPub").checked;
    board.reports.unshift(r);
    board.seeded = true;
    board.me = by;
    if (!save()) toast("저장 공간이 부족합니다. 오래된 리포트를 지워 보세요.");
    if (SY.enabled && r.priv) {
      setTimeout(() => toast("이 기기에만 저장했습니다. 공용 보드에는 올리지 않습니다."), 400);
    } else if (SY.enabled && board.hood) {
      syncPushPending().then((n) => {
        if (n) { renderAll(); toast("공용 보드에 올렸습니다."); }
        else if (!SY.hasSession()) toast("내 보드에만 저장했습니다. 로그인하면 동네에 올라갑니다.");
        else if (suspended) toast(SUSPENDED_MSG);
        else toast("아직 못 올렸습니다. 내 보드에는 있고, 다음에 다시 올립니다.");
      });
    }
    switchView("feed");
    renderAll();
    closeSheets(true);
    openShare([r]);
    if (first) setTimeout(() => toast("예시는 치웠습니다. 이제 진짜 보드입니다."), 900);
  });

  /* 공유 */
  $("#shareCopy").addEventListener("click", async () => {
    if (!shareCache) return;
    const ok = await copyText(shareCache);
    const st = $("#shareStatus");
    st.textContent = ok ? "복사했습니다. 단톡방에 붙여 넣으세요." : "복사가 막혔습니다. 위 글을 직접 긁어서 복사해 주세요.";
    st.className = "status " + (ok ? "ok" : "err");
  });
  $("#shareNative").addEventListener("click", () => {
    if (navigator.share && shareCache) navigator.share({ text: shareCache }).catch(() => {});
  });
  $("#placeAgain").addEventListener("click", () => {
    const g = groups().find((x) => x.key === openPlaceKey);
    if (!g) return;
    closeSheets(true);
    openCompose(g.last);
  });
  $("#fRefSame").addEventListener("click", () => {
    if (!composeRef) return;
    draft.wait = composeRef.wait; draft.crowd = composeRef.crowd; draft.park = composeRef.park;
    paintCompose();
    syncSame();
  });
  $("#placeShare").addEventListener("click", async () => {
    const g = groups().find((x) => x.key === openPlaceKey);
    if (!g) return;
    if (isSample()) { toast("예시 리포트는 공유할 수 없습니다."); return; }
    const list = g.rs.slice(0, 10);
    closeSheets(true);
    openShare(list);
  });

  /* 받기 */
  $("#recvGo").addEventListener("click", async () => {
    const st = $("#recvStatus");
    const code = findCode($("#recvBox").value);
    if (!code) {
      st.textContent = "붙여 넣은 내용에서 링크를 찾지 못했습니다. 받기 → 로 시작하는 줄이 들어 있어야 합니다.";
      st.className = "status err";
      return;
    }
    st.textContent = "읽는 중…";
    st.className = "status";
    try {
      const list = await unpack(code);
      const res = merge(list);
      const wn = watchNews(res.fresh);
      renderAll();
      st.textContent = res.added + "건을 받았습니다." + (res.dup ? " " + res.dup + "건은 이미 갖고 있어서 건너뛰었습니다." : "");
      st.className = "status ok";
      if (res.added) { $("#recvBox").value = ""; switchView("feed"); }
      if (wn) toast(wn);
    } catch(err) {
      st.textContent = "받지 못했습니다: " + err.message;
      st.className = "status err";
    }
  });
  $("#recvClear").addEventListener("click", () => {
    $("#recvBox").value = "";
    $("#recvStatus").textContent = "";
    $("#recvStatus").className = "status";
  });

  /* 묶음 */
  $("#bundleBtn").addEventListener("click", async () => {
    const st = $("#bundleStatus");
    if (!board.reports.length) {
      st.textContent = "보드가 비어 있습니다. (예시 리포트는 보내지 않습니다)";
      st.className = "status err";
      return;
    }
    st.textContent = "만드는 중…";
    st.className = "status";
    try {
      const r = await packCapped(board.reports, BUNDLE_CAP);
      const text = shareText(r.used, r.code);
      $("#bundleBox").value = text;
      $("#bundleBox").scrollTop = 0;
      $("#bundleBox").hidden = false;
      $("#bundleRow").hidden = false;
      $("#bundleShare").hidden = !navigator.share;
      st.textContent = board.reports.length + "건 가운데 최근 " + r.used.length + "건을 담았습니다. 링크 길이 " + r.code.length + "자.";
      st.className = "status ok";
    } catch(e) {
      st.textContent = "만들지 못했습니다: " + e.message;
      st.className = "status err";
    }
  });
  $("#bundleCopy").addEventListener("click", async () => {
    const ok = await copyText($("#bundleBox").value);
    const st = $("#bundleStatus");
    st.textContent = ok ? "복사했습니다." : "복사가 막혔습니다. 직접 긁어서 복사해 주세요.";
    st.className = "status " + (ok ? "ok" : "err");
  });
  $("#bundleShare").addEventListener("click", () => {
    if (navigator.share) navigator.share({ text: $("#bundleBox").value }).catch(() => {});
  });

  /* 파일 */
  $("#fileSave").addEventListener("click", () => {
    if (!board.reports.length) { toast("저장할 리포트가 없습니다."); return; }
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    const blob = new Blob([JSON.stringify({ app:"동네 특파원", v:1, savedAt:d.toISOString(), reports:board.reports,
      watch:board.watch }, null, 1)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "teukpawon-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(board.reports.length + "건을 파일로 저장했습니다.");
  });
  $("#fileLoad").addEventListener("click", () => $("#fileInput").click());
  $("#fileInput").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const st = $("#bundleStatus");
    try {
      const raw = JSON.parse(await f.text());
      const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.reports) ? raw.reports : null);
      if (!arr) throw new Error("리포트가 들어 있지 않습니다.");
      /* 파일은 남이 건넨 것일 수도 있다 — 링크와 똑같이 믿지 않는다(mine·up 을 살리지 않는다).
         map(sane) 으로 넘기면 배열 번호가 두 번째 인자(local)로 들어가 첫 줄 말고는 전부 믿어 버린다. */
      const res = merge(arr.slice(0, MAX_REPORTS).map((r) => sane(r)).filter(Boolean));
      /* 지켜보는 곳은 내 설정이라 합친다 — 이미 있는 곳은 그대로 두고 없는 곳만 더한다. */
      const addW = raw && !Array.isArray(raw) ? saneWatch(raw.watch).filter((w) => !board.watch.some((x) => x.k === w.k)) : [];
      if (addW.length) { board.watch = board.watch.concat(addW).slice(0, WATCH_MAX); save(); }
      const wn = watchNews(res.fresh);
      renderAll();
      st.textContent = res.added + "건을 불러왔습니다." + (res.dup ? " " + res.dup + "건은 이미 있었습니다." : "") +
        (addW.length ? " 지켜보는 곳 " + addW.length + "곳도 더했습니다." : "");
      st.className = "status ok";
      if (wn) toast(wn);
    } catch(err) {
      st.textContent = "파일을 읽지 못했습니다: " + err.message;
      st.className = "status err";
    }
    e.target.value = "";
  });

  /* 정리 */
  $("#purgeOld").addEventListener("click", () => {
    const cut = Date.now() - 30 * DAY;
    const before = board.reports.length;
    const gone = before - board.reports.filter((r) => r.t >= cut).length;
    if (!gone) { toast("30일 넘은 리포트가 없습니다."); return; }
    if (!confirm(gone + "건을 지울까요?")) return;
    board.reports = board.reports.filter((r) => r.t >= cut);
    save();
    renderAll();
    toast(gone + "건을 지웠습니다.");
  });
  $("#wipe").addEventListener("click", () => {
    if (!confirm("이 브라우저에 저장된 리포트를 전부 지웁니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    board.reports = [];
    board.seeded = false;
    save();
    renderAll();
    toast("전부 비웠습니다.");
  });

  /* 공용 보드 */
  $("#boardBtn").addEventListener("click", openBoardSheet);
  $("#hoodSel").addEventListener("change", async (e) => {
    board.hood = clip(e.target.value, 12);
    save();
    paintBoardBtn(); paintBoardKv();
    if (board.hood) { await boardRefresh(false); paintBoardKv(); }
  });
  $("#pullNow").addEventListener("click", async () => {
    if (!board.hood) { $("#boardStatus").textContent = "동네를 먼저 고르세요."; $("#boardStatus").className = "status err"; return; }
    $("#boardStatus").textContent = "받아오는 중…"; $("#boardStatus").className = "status";
    const res = await boardRefresh(true);
    paintBoardKv();
    $("#boardStatus").textContent = res ? (res.added + "건 새로 받았습니다." + (res.dup ? " (" + res.dup + "건은 이미 있음)" : ""))
                                        : "받아오지 못했습니다.";
    $("#boardStatus").className = "status " + (res ? "ok" : "err");
  });

  /* 계정 삭제 — "탈퇴" 를 정확히 적어야 단추가 켜진다 */
  $("#delConfirm").addEventListener("input", (e) => { $("#delGo").disabled = e.target.value.trim() !== "탈퇴"; });
  $("#delGo").addEventListener("click", doDeleteAccount);

  /* 신고 */
  $("#flagReasons").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-reason]");
    if (!b || !flagTarget) return;
    const st = $("#flagStatus");
    if (!SY.hasSession()) {
      st.textContent = "신고하려면 로그인이 필요합니다. 누가 신고했는지 남아야 도배 신고를 막을 수 있습니다.";
      st.className = "status err";
      return;
    }
    st.textContent = "보내는 중…"; st.className = "status";
    try {
      await ensureProfile();
      await SY.flag(flagTarget.id, b.dataset.reason);
      st.textContent = "신고했습니다. 세 사람이 신고하면 가려집니다.";
      st.className = "status ok";
      setTimeout(closeSheets, 1200);
    } catch (e2) {
      st.textContent = /duplicate|23505/i.test(e2.message) ? "이미 신고한 리포트입니다." : "보내지 못했습니다: " + e2.message;
      st.className = "status err";
    }
  });

  window.addEventListener("hashchange", checkHash);
}

/* ---------------------------- 시작 ---------------------------- */
applyTheme(theme);
bind();
switchView("feed");
$("#meInput").value = board.me;

/* 로그인하고 돌아오면 토큰이 해시에 실려 온다. #r= 공유 링크와 같은 자리라
   토큰만 먼저 걷어낸 뒤에 checkHash() 를 부른다. */
if (SY.enabled) {
  try { SY.consumeAuthHash(); } catch (e) {}
}
paintBoardBtn();
renderAll();
checkHash();

/* 홈 화면 아이콘을 길게 눌러 "리포트 보내기"로 들어오면 바로 쓰기 창을 연다 (manifest 의 shortcuts). */
if (new URLSearchParams(location.search).get("write") === "1") {
  history.replaceState(null, "", location.pathname + location.hash);
  setTimeout(() => openCompose(), 50);
}

window.addEventListener("offline", renderTicker);
window.addEventListener("online", () => { renderTicker(); if (SY.enabled) boardRefresh(true); });

/* 오프라인에서도 열리게. 보안 출처(https·localhost)에서만 등록된다. */
if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

if (SY.enabled) {
  SY.listHoods().then((h) => { hoods = h || []; paintBoardBtn(); }).catch(() => {});
  if (board.hood) boardRefresh(true);   // 올리기 전에 ensureProfile 이 프로필을 챙긴다
  /* 속보는 금방 상한다. 3분마다 조용히 받아온다. */
  setInterval(() => { if (!document.hidden) boardRefresh(true); }, 3 * 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) boardRefresh(true); });
}
/* 시간이 흐르면 "몇 분 전"과 신선도가 달라진다 — 1분마다 다시 그린다. */
setInterval(() => { renderTicker(); renderFeed(); renderPlaces(); }, 60e3);
