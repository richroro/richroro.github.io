"use strict";

/* =========================================================================
   동네 특파원 — 서버 없는 현장 속보 게시판

   두 종류의 정보를 갈라서 다룬다.
     · 속보(웨이팅·사람·주차) — 몇 시간이면 상한다. 시간과 함께 흐려지고 하루면 접힌다.
     · 기록(별점·태그·메모)   — 시간이 지나도 쓸모가 남는다. 흐려지지 않는다.

   리포트는 링크 한 줄(#r=…)에 통째로 실려 오간다. 서버도 계정도 없다.
   ========================================================================= */

/* ---------------------------- 글꼴 ---------------------------- */
/* 글꼴 CSS(Google Fonts, 다른 출처의 300KB)를 index.html 머리에 두면 받을 때까지 화면이 하얗다 — 신호가 약하면 몇 초.
   스크립트가 붙인 스타일시트는 그리기를 막지 않는다. 기기 글꼴로 먼저 뜨고, 글꼴이 오면 바뀐다(display=swap).
   받기를 일찍 시작하려고 맨 먼저 붙인다. crossorigin 은 서비스 워커가 응답을 확인하고 담아 둘 수 있게. */
(function(){
  if (document.querySelector('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]')) return;   // 옛 index.html 사본에는 이미 있다
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.crossOrigin = "anonymous";
  l.href = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
})();

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
const MAX_FILE = 5000;    // 파일(백업)에서 한 번에 불러올 리포트 수 상한 — 링크의 MAX_REPORTS 보다 크다

/** 선 아이콘 한 벌. 화면에 넣는 곳은 모두 aria-hidden 으로 감싼다 — 이름은 글자로 따로 있다. */
const ico = (d) => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
  'stroke-linecap="round" stroke-linejoin="round" focusable="false">' + d + "</svg>";
const CATS = [
  { k:"play", ic:ico('<rect x="3.5" y="12.5" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="12.5" width="7.5" height="7.5" rx="1.2"/><path d="M12 3.5l4.2 6.5H7.8z"/>'), nm:"놀이공간" },
  { k:"food", ic:ico('<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 4.5c-.9 1 .9 2 0 3.2M13.5 4.5c-.9 1 .9 2 0 3.2"/>'), nm:"맛집" },
  { k:"cafe", ic:ico('<path d="M5 8.5h11v5A5.5 5.5 0 0 1 10.5 19 5.5 5.5 0 0 1 5 13.5z"/><path d="M16 10h1.4a2.6 2.6 0 0 1 0 5.2H16"/>'), nm:"카페" },
  { k:"trip", ic:ico('<path d="M2.5 19.5 9 9l4.2 6.4L16 11.5l5.5 8z"/><circle cx="17" cy="5.5" r="1.8"/>'), nm:"나들이" },
  { k:"etc",  ic:ico('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'), nm:"그 밖에" }
];
const WAIT = [
  { v:0,  nm:"바로 입장", s:"대기 없음",   tone:"good" },
  { v:10, nm:"10분",      s:"대기 10분",   tone:"good" },
  { v:30, nm:"30분",      s:"대기 30분",   tone:"mid"  },
  { v:60, nm:"1시간+",    s:"대기 1시간+", tone:"bad"  },
  { v:-1, nm:"모름",      s:"",            tone:"none" }
];
/* s 는 칩·공유글에 홀로 적힌다 — "보통"만으로는 무엇이 보통인지 모르니 "사람"을 붙인다(쓰기 창 단추 nm 은 "사람" 줄 안이라 그대로) */
const CROWD = [
  { v:0,  nm:"한산", s:"한산", tone:"good"  },
  { v:1,  nm:"보통", s:"사람 보통", tone:"mid"   },
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

/** 안 보이는 글자 — 폭 없는 공백·잇기 표시·글 방향 표시. 끼면 똑같아 보이는 이름이 다른 장소가 된다. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
/** 한 줄로 만들고 제어문자를 턴 뒤 길이를 자른다. 풀어 쓴 한글(NFD)은 모아 쓰고 안 보이는 글자는 뺀다. */
function clip(s, n){
  return String(s == null ? "" : s).normalize("NFC").replace(INVISIBLE, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
}
/** "민지" → "민지 특파원". 이름을 안 정한 사람("이름 없는 특파원")처럼 이미 특파원으로 끝나면 한 번 더 붙이지 않는다. */
const byline = (name) => /특파원$/.test(name) ? name : name + " 특파원";
/** 장소 묶음 열쇠 — 공백과 대소문자, 한글 적는 방식(NFC/NFD), 안 보이는 글자를 무시한다. */
const norm = (s) => String(s == null ? "" : s).normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, "").toLowerCase();
/** "안양 안양동" 도 "안양동" 도 같은 동네로 본다 — 마지막 토막만 본다. */
function areaKey(s){
  const parts = String(s == null ? "" : s).trim().split(/\s+/).filter(Boolean);
  return parts.length ? norm(parts[parts.length - 1]) : "";
}

/* 날짜 글자 틀은 한 번만 만든다 — 카드마다 새로 만들면 카드 그리는 시간의 반 넘게를 여기서 쓴다. */
const FMT_DAY  = new Intl.DateTimeFormat("ko-KR", { month:"numeric", day:"numeric" });
const FMT_TIME = new Intl.DateTimeFormat("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" });
/** 오늘 0시. 속보의 오늘·어제 묶음과 "어제"·"N일 전"이 같은 달력을 쓴다. */
function startOfToday(){
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function ago(ms){
  const d = Date.now() - ms;
  if (d < 2 * MIN)  return "방금";
  if (d < HOUR)     return Math.floor(d / MIN) + "분 전";
  if (d < DAY)      return Math.floor(d / HOUR) + "시간 전";
  /* 하루가 넘으면 달력으로 센다 — 지난 시간으로 세면 "그 전" 묶음 밑에 "어제"가 섞인다 */
  const day = new Date(ms); day.setHours(0, 0, 0, 0);
  const n = Math.round((startOfToday() - day.getTime()) / DAY);
  if (n <= 1)  return "어제";
  if (n < 30)  return n + "일 전";
  return FMT_DAY.format(ms);
}
function fmtTime(ms){
  return FMT_TIME.format(ms);
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
  const t = Number(o.t), now = Date.now();
  /* 2020년 이전이면 버린다. 미래 시각은 "방금"으로 보이고 지금 가기 좋은 곳 맨 위에 하루 내내 앉는다 —
     링크·파일·서버로 온 것은 한 시간(보낸 폰 시계가 조금 틀린 것)까지만, 내 저장소는 하루까지 봐주고 지금으로 당긴다. */
  if (!isFinite(t) || t < 1577836800000 || t > now + (local ? DAY : HOUR)) return null;
  const place = clip(o.place, 40);
  if (!place) return null;
  const inSet = (tab, v) => tab.some((x) => x.v === v) ? v : -1;
  let tags = Array.isArray(o.tags) ? o.tags.map((x) => clip(x, 12)).filter(Boolean) : [];
  tags = tags.filter((x, i) => tags.indexOf(x) === i).slice(0, 6);
  return {
    id:    /^[A-Za-z0-9_-]{1,24}$/.test(o.id) ? o.id : newId(),
    t:     Math.min(Math.round(t), now),
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
    sh:    local ? o.sh !== false : false,        // 복사·공유로 내보낸 적 있는 내 글. 이 표시가 생기기 전에 쓴 글은 보낸 것으로 친다
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
          seen: clamp(Number(w.seen) || 0, 0, Date.now()) }   // 미래로 밀린 "본 시각"은 진짜 새 소식을 가린다
      : null)
    .filter((w) => w && !keys.has(w.k) && keys.add(w.k))
    .slice(0, WATCH_MAX);
}

/** 이 기기에 저장된 보드를 읽는다. 처음 열 때와, 다른 탭이 저장했을 때(storage 이벤트) 부른다. */
function readBoard(){
  const raw = store.get(KEY, null);
  const b = { reports: [], me: "", seeded: false, hood: "", pulledAt: 0, gone: [], watch: [], push: null };
  if (raw && typeof raw === "object") {
    /* 내 저장소에서 읽는 것이므로 mine/up 을 살린다. 링크·서버에서 오는 것은 살리지 않는다. */
    if (Array.isArray(raw.reports)) b.reports = raw.reports.map((r) => sane(r, true)).filter(Boolean);
    b.me = clip(raw.me, 20);
    b.seeded = !!raw.seeded;
    b.hood = clip(raw.hood, 12);
    b.pulledAt = Number(raw.pulledAt) || 0;
    if (Array.isArray(raw.gone)) b.gone = raw.gone.filter((x) => typeof x === "string").slice(-500);
    b.watch = saneWatch(raw.watch);
    /* 폰 알림을 켠 기기 — 서버에 걸어 둔 구독 주소. 끄거나 로그아웃하면 지운다. */
    if (raw.push && typeof raw.push.endpoint === "string" && /^https:\/\//.test(raw.push.endpoint))
      b.push = { endpoint: raw.push.endpoint.slice(0, 1000) };
  }
  b.reports.sort((a, c) => c.t - a.t);
  return b;
}
const board = readBoard();

/* 저장. localStorage(5백만 자)는 이 사이트(richroro.github.io)의 다른 앱 스무 개와 나눠 쓴다 — 남이 채워 모자랄 수 있다.
   모자라면 prune() 으로 치울 것을 치우고, 그래도 안 되면 내가 쓰지 않은 리포트를 오래된 것부터 덜어 가며 다시 해 본다
   (내 글은 건드리지 않는다). 끝내 안 되면 화면의 보드는 그대로 두고 속보 맨 위에 경고를 남긴다 —
   토스트 한 번은 곧 다른 알림에 덮이고, 새로 고치면 리포트가 사라진 걸 모른 채 지나간다. */
let unsaved = [];   // 끝내 못 담은 리포트 — 다른 탭의 저장으로 보드를 다시 읽을 때 이것만은 들고 간다(storage 이벤트)
function save(){
  let ok = store.set(KEY, board);
  if (!ok) {
    const keep = board.reports;                // 끝내 못 하면 이 탭에서는 보이던 그대로 둔다
    prune();
    for (let n = 8; !(ok = store.set(KEY, board)); n *= 2) {
      const drop = new Set(board.reports.filter((r) => !r.mine).slice(-n));   // t 내림차순 — 뒤가 오래된 것
      if (!drop.size) break;
      board.reports = board.reports.filter((r) => !drop.has(r));
    }
    if (!ok) {
      board.reports = keep;
      const stored = new Set(((store.get(KEY, null) || {}).reports || []).map((r) => r && r.id));
      unsaved = keep.filter((r) => !stored.has(r.id));
    }
  }
  if (ok) unsaved = [];
  const w = $("#storeWarn");                   // 옛 index.html 사본과 섞여 떠도 멈추지 않게
  if (w) w.hidden = ok;
  return ok;
}

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
/* 속보·장소는 앞에서부터 PAGE 개만 그린다. 2천 건을 한 번에 그리면 폰이 몇 초씩 멈춘다 — 나머지는 "더 보기"로. */
const PAGE = 60;
let feedShown = PAGE, placesShown = PAGE;
/* 1분마다 새로 그리기가 "보이지 않아서" 미뤄 둔 것 — 보이게 되면 그린다(freshen) */
const stale = { ticker:false, feed:false, places:false };
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
/** 현장 정보 칩 줄. 몇 분 전인지는 카드 머리(장소 창에선 바로 위 줄)에 있어서 여기엔 다시 적지 않는다. */
function liveRowHtml(r){
  const chips = statChips(r);
  if (!chips.length) return "";
  const d = Date.now() - r.t;
  const faded = d >= SOFT ? " faded" : "";
  const inner = '<div class="live-row' + faded + '">' +
    chips.map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("") + "</div>";
  if (d < DEAD) return inner;
  /* data-exp — 다시 그려도 펼쳐 둔 것을 도로 펼 수 있게(keepFocus) */
  return '<details class="expired" data-exp="' + esc(r.id) + '"><summary>' + esc(ago(r.t)) + " 현장 정보 — 펼치기</summary>" + inner + "</details>";
}
const starsHtml = (n) => n ? '<span class="stars" role="img" aria-label="별 ' + n + '개" title="별 ' + n + '개">' +
  "★".repeat(n) + "☆".repeat(5 - n) + "</span>" : "";

/** 카드 — 한눈에 읽히는 순서로: 어디(이름)·언제(몇 분 전) → 무슨 곳·어느 동네 → 지금 어떤지(칩) → 한 줄 → 누가·별점.
    o.preview — 링크로 온 걸 받기 전에 미리 보인다. 아직 보드에 없으니 단추를 달지 않고, 예시 보드 위라도 예시가 아니다. */
function cardHtml(r, o){
  o = o || {};
  const cat = CATS.find((c) => c.k === r.cat) || CATS[CATS.length - 1];
  const sample = isSample() && !o.preview;
  const bare = sample || !!o.preview;   // 단추 없는 카드
  return '<article class="card age-' + ageClass(r.t) + '">' +
    '<div class="card-head">' +
      '<h3 class="place">' +
        (o.plain || o.preview ? esc(r.place) : '<button type="button" data-open="' + esc(r.id) + '">' + esc(r.place) + "</button>") +
      "</h3>" +
      '<span class="age" title="' + esc(fmtTime(r.t)) + '">' + esc(ago(r.t)) + "</span>" +
      (bare || o.noDelete ? "" :
        '<button class="del" type="button" data-del="' + esc(r.id) + '" aria-label="이 리포트 지우기" title="지우기">&times;</button>') +
    "</div>" +
    '<div class="card-sub">' +
      '<span class="cat"><span aria-hidden="true">' + cat.ic + "</span> " + esc(cat.nm) + "</span>" +
      (r.area ? '<span class="area">' + esc(r.area) + "</span>" : "") +
      (sample ? '<span class="badge">예시</span>' : "") +
      (r.priv ? '<span class="badge" title="공용 보드에 올리지 않은 글">이 기기에만</span>' : "") +
      (!SY.enabled && r.mine && !r.sh ? '<span class="badge" title="아직 아무에게도 보내지 않은 내 리포트">안 보냄</span>' : "") +
      (r.hid ? '<span class="badge warn" title="세 사람 이상이 신고해서 다른 사람에게는 안 보입니다">신고로 가려짐</span>' : "") +
    "</div>" +
    liveRowHtml(r) +
    (r.note ? '<p class="note-line">' + esc(r.note) + "</p>" : "") +
    '<div class="card-bot">' +
      '<span class="by">' + esc(byline(r.by)) + "</span>" +
      starsHtml(r.rate) +
      (r.tags.length ? '<span class="tags">' + r.tags.map((t) => "#" + esc(t)).join(" ") + "</span>" : "") +
      '<span class="spacer"></span>' +
      (bare ? "" : '<button class="link-btn" type="button" data-again="' + esc(r.id) + '" title="같은 장소의 지금 상황을 알립니다">나도 여기</button>') +
      (bare ? "" : '<button class="link-btn" type="button" data-share="' + esc(r.id) + '">공유</button>') +
      (!bare && SY.enabled && !r.mine ?
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
/* 한 번 그리는 동안(renderAll · 1분마다 새로 그리기 · 속보 다시 그리기)에는 장소 묶음을 한 번만 만든다.
   그리기가 끝나면 버린다 — board.reports 를 고치는 곳이 많아서, 오래 들고 있으면 묵은 묶음을 쓰게 된다. */
let pass = null;
function inPass(fn){
  if (pass) return fn();
  pass = {};
  try { return fn(); } finally { pass = null; }
}
/** 장소 묶음. 한 번 그리는 동안에는 모두가 같은 배열을 받는다 — 제자리에서 정렬하지 말 것. */
function groups(){
  if (!pass) return buildGroups();
  return pass.gs || (pass.gs = buildGroups());
}
function buildGroups(){
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
/* 카톡은 긴 링크를 중간에 자른다. 잘린 링크는 base64·압축·JSON 어디선가 깨지는데, 브라우저는 그걸
   "Failed to fetch" 같은 영어로 말한다 — 우리말로 바꾸고, 잘렸다는 표시(cut)를 달아 받는 쪽이 할 일을 안내한다. */
const cutError = () => Object.assign(new Error("링크가 중간에 잘린 것 같습니다."), { cut: true });
async function unpack(code){
  if (!code) throw new Error("링크를 찾지 못했습니다.");
  if (code.length > MAX_CODE) throw new Error("내용이 너무 깁니다.");
  const v = code.charAt(0), body = code.slice(1);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) throw cutError();
  let bytes;
  try { bytes = b64d(body); } catch (e) { throw cutError(); }            // 길이가 안 맞는 base64
  if (v === "2") {
    if (typeof DecompressionStream !== "function") throw new Error("이 브라우저는 압축된 링크를 풀지 못합니다.");
    const buf = await new Response(new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()
      .catch(() => { throw cutError(); });                                // 압축이 끝나기 전에 끊겼다
    if (buf.byteLength > MAX_BYTES) throw new Error("내용이 너무 큽니다.");
    bytes = new Uint8Array(buf);
  } else if (v !== "1") {
    throw new Error("모르는 형식입니다.");
  }
  let rows;
  try { rows = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw cutError(); }
  if (!Array.isArray(rows)) throw new Error("내용을 읽지 못했습니다.");
  const ids = new Set();   // 한 링크에 같은 리포트가 두 번 실려도 한 건이다
  const out = rows.slice(0, MAX_REPORTS).map((a) => Array.isArray(a) ? fromRow(a) : sane(a))
    .filter((r) => r && !ids.has(r.id) && ids.add(r.id));
  if (!out.length) throw new Error("쓸 만한 리포트가 없습니다.");
  return out;
}

function baseUrl(){
  if (location.protocol === "http:" || location.protocol === "https:")
    return location.origin + location.pathname.replace(/index\.html?$/i, "");
  return "https://richroro.github.io/correspondent/";
}
/** 카톡에 그대로 붙여 넣을 글. 링크를 안 눌러도 읽히게 쓴다.
    끝줄은 이 앱을 모르는 사람도 알아듣게 "눌러서 보기". 예전 글의 "받기 →" 도 #r= 로 찾으니 그대로 받아진다. */
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
    lines.push("— " + byline(r.by));
    lines.push("눌러서 보기 → " + url);
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
  return [head].concat(body, ["눌러서 보기 → " + url]).join("\n");
}

/* =========================================================================
   그리기
   ========================================================================= */
let statHtml = "";   // #statline 에 마지막으로 쓴 것
function renderTicker(){
  /* "지금"은 한 뜻이다 — 속보의 "지금" 칸·빨간 시각 알약과 같은 1시간. 3시간 창은 "최근 3시간"이라고 따로 부른다.
     알약은 단추다 — 누르면 그 소식들이 있는 속보 맨 위로(bind). */
  const live = reports().filter((r) => Date.now() - r.t < LIVE).length;
  const pill = $("#livePill");
  pill.className = "livepill" + (live ? "" : " off");
  pill.innerHTML = '<span class="dot' + (live ? " on" : "") + '"></span>지금 ' + live + "건";
  /* 속보 머리에는 끊겼을 때만 한 줄 띄운다. 리포트·장소·특파원 수는 주고받기의 "보드 정리"에 있다 —
     첫 화면은 소식부터 보이게. "예시입니다"는 처음 안내 카드(#intro)에 있다.
     이 줄은 읽는 프로그램이 알려 주는 칸(aria-live)이라 늘 그려 둔다(비면 높이 0) — 숨겼다가 글과 함께 드러내면
     안 알려 준다. 1분마다 같은 글을 다시 쓰면 또 읽으니, 글이 바뀔 때만 쓴다. */
  const html = navigator.onLine ? "" : '<span class="warn">오프라인 — ' +
    (SY.enabled ? "쓰면 이 기기에 저장되고, 연결되면 올라갑니다" : "이 기기에서 그대로 쓸 수 있습니다") + "</span>";
  if (html !== statHtml) $("#statline").innerHTML = statHtml = html;
}

/** 지금 줄을 서거나 붐빈다는 소식 — 웨이팅·사람 가운데 하나라도 붐빔·1시간+·터짐이면 추천하지 않는다.
    여유도 평균(cond)만 보면 "대기 10분 · 붐빔"이 0.5를 넘어 1위에 오른다. 주차는 덜 결정적이라 여기선 안 본다. */
const busy = (r) => [opt(WAIT, r.wait).tone, opt(CROWD, r.crowd).tone].some((t) => t === "bad" || t === "worst");

/** 속보 거르개에서 분야를 골랐으면 "지금 가기 좋은 곳"도 그 분야만 본다. */
function renderPick(){
  /* 보드가 정말 비었으면(예시도 리포트도 없다) 빈 상자·검색·분야 칩을 거두고, 속보 자리의 안내 카드 하나가 말한다(renderFeed) */
  const bare = !reports().length;
  [$("#view-feed > .filters"), $("#view-feed > .chiprow")].forEach((el) => { if (el) el.hidden = bare; });   // 옛 사본엔 칩 줄이 거르개 안에 있다
  if (bare) { $("#pick").innerHTML = ""; return; }
  const cat = flt.cat ? CATS.find((c) => c.k === flt.cat) : null;
  const tag = cat ? '<span class="tagcat">' + esc(cat.nm) + "만</span>" : "";
  const gs = groups().filter((g) => !cat || g.cat === cat.k);
  /* 장소마다 지금 상황은 가장 최근 현장 정보 하나다(g.now) — 두 시간 전의 "한산"이
     방금 들어온 "붐빔"을 이기면 안 된다. 메모만 남긴 리포트는 지금을 말하지 못하므로 뺀다. */
  const cur = gs.filter((g) => g.now).map((g) => ({ g, r: g.now, s: cond(g.now) * freshness(g.now.t) }));
  /* 빈 상자는 .empty(속보·장소의 점선 빈 칸)와 다른 이름이다 — 섞이면 제목띠 둘레에 점선과 40px 여백이 붙는다 */
  if (!cur.length) {
    $("#pick").innerHTML = '<div class="pick pick-empty"><h2>지금 들어온 소식이 없습니다' + tag + "</h2>" +
      '<p class="sub">밖에 계시면 첫 소식을 보내 주세요.</p>' + usualPickHtml(gs) + "</div>";
    return;
  }
  const top = cur.filter((x) => cond(x.r) >= .5 && !busy(x.r)).sort((a, b) => b.s - a.s).slice(0, 3);
  if (!top.length) {
    $("#pick").innerHTML = '<div class="pick pick-empty"><h2>지금은 다들 붐빈다고 합니다' + tag + "</h2>" +
      '<p class="sub">최근 3시간 안에 소식이 들어온 ' + cur.length + "곳 모두 여유가 없습니다.</p></div>";
    return;
  }
  /* 설명 문장 대신 색 칩으로 — 초록이 많은 곳이 위에 온다. 누가 썼는지는 장소 창에서 본다. */
  $("#pick").innerHTML = '<div class="pick"><h2>지금 가기 좋은 곳<span class="tagnow">최근 3시간</span>' + tag + "</h2><ol>" +
    top.map((x, i) => "<li>" +
        '<span class="rank">' + (i + 1) + "</span>" +
        '<button class="nm" type="button" data-open="' + esc(x.r.id) + '">' + esc(x.g.place) + "</button>" +
        '<span class="why"><span class="why-age">' + esc(ago(x.r.t)) + "</span>" +
          statChips(x.r).map((c) => '<span class="stat sm ' + c.tone + '">' + esc(c.s) + "</span>").join("") +
          (x.g.confirm ? '<span class="why-note">' + x.g.confirm.n + "명 확인</span>" : "") +
          /* 추천하면서 다른 말이 있다는 걸 감추지 않는다 */
          (x.g.conflicts.length ? '<span class="why-note warn">엇갈림 있음</span>' : "") + "</span>" +
      "</li>").join("") + "</ol></div>";
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

/** 속보를 시간대로 나눈다 — 오늘·어제는 달력 기준이라 "5시간 전"이 어제가 되기도 한다.
    mid(오늘 0시)를 주면 카드마다 다시 재지 않는다. */
function timeBand(t, mid){
  const d = Date.now() - t;
  if (d < LIVE) return 0;
  if (mid == null) mid = startOfToday();
  if (t >= mid) return 1;
  if (t >= mid - DAY) return 2;
  return 3;
}
const BANDS = ["지금", "오늘", "어제", "그 전"];
/** 목록 끝의 "N건 더 보기" — 속보(#feedMore)·장소(#placesMore). */
const moreHtml = (id, n) => '<button class="btn" type="button" id="' + id + '">' + n + " 더 보기</button>";

/** 속보. listOnly 면 목록만 — 검색은 목록만 다시 그린다(지켜보는 곳·지금 가기 좋은 곳은 검색과 상관없다). */
function renderFeed(listOnly){
  if (!pass) return inPass(() => renderFeed(listOnly));   // 지켜보는 곳·지금 가기 좋은 곳이 장소 묶음을 함께 쓴다
  const list = filtered();
  $("#nFeed").textContent = list.length ? list.length : "";
  if (!list.length) {
    $("#feed").className = "feed bare";
    /* 거르개에 걸린 것만 없으면 거르개를 풀라고 한다. 보드가 정말 비었으면 안내 카드 하나 —
       공용 보드가 없으면 남의 소식은 링크로만 온다. 그걸 말해 주고 두 길(쓰기·받은 글 붙여넣기)을 바로 연다. */
    $("#feed").innerHTML = reports().length
      ? '<div class="empty"><b>보여 줄 리포트가 없습니다</b><p>거르개를 풀어 보세요.</p></div>'
      : '<div class="guide"><h2>아직 리포트가 없습니다</h2>' +
        "<p>지금 있는 곳을 알리거나, 카톡으로 받은 링크를 눌러 보세요.</p>" +
        '<div class="row"><button class="btn primary" type="button" data-go="write">리포트 보내기</button>' +
        '<button class="btn" type="button" data-go="recv">받은 글 붙여 넣기</button></div></div>';
  } else {
    $("#feed").className = "feed";
    /* 시간대 머리의 건수는 거른 목록 전체로 센다(한 번 훑어서). 카드는 앞의 feedShown 건만 그린다. */
    const mid = startOfToday(), cnt = [0, 0, 0, 0];
    list.forEach((r) => { cnt[timeBand(r.t, mid)]++; });
    let band = -1, html = "";
    list.slice(0, feedShown).forEach((r) => {
      const b = timeBand(r.t, mid);
      if (b !== band) {
        band = b;
        html += '<div class="tgroup"><b>' + BANDS[b] + "</b><i></i><span>" + cnt[b] + "건</span></div>";
      }
      html += cardHtml(r);
    });
    if (list.length > feedShown) html += moreHtml("feedMore", (list.length - feedShown) + "건");
    $("#feed").innerHTML = html;
  }
  if (listOnly) return;
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
  const w = watchEntry(g), t = Math.min(g.last.t, Date.now());   // 본 시각은 지금을 넘지 않는다
  if (!w || t <= w.seen) return false;
  w.seen = t;
  save();
  return true;
}
function toggleWatch(g){
  const w = watchEntry(g);
  if (w) {
    board.watch = board.watch.filter((x) => x !== w);
    save();
    pushSyncPlaces();
    toast("그만 지켜봅니다 — " + g.place);
    return;
  }
  if (board.watch.length >= WATCH_MAX) { toast("지켜보는 곳은 " + WATCH_MAX + "곳까지입니다."); return; }
  board.watch.push({ k: g.key, nm: g.place, ar: g.area, seen: Math.min(g.last.t, Date.now()) });
  save();
  pushSyncPlaces();
  toast("지켜보는 곳에 넣었습니다 — 새 소식이 오면 속보 맨 위에 표시합니다." + (board.push ? " 폰으로도 알립니다." : ""));
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
/** 속보 탭의 빨간 숫자 — 지켜보는 곳에 남이 올린, 아직 안 본 소식 수. 다른 탭에 있을 때 보인다. */
function paintTabBadge(n){
  const tb = $("#tbFeed");
  if (!tb) return;   // 옛 index.html 사본과 섞여 떠도 멈추지 않게
  tb.hidden = !n;
  tb.innerHTML = n ? '<span class="sr">지켜보는 곳 새 소식 </span>' + (n > 99 ? "99+" : n) : "";
}
function renderWatch(){
  const box = $("#watchBox");
  if (!board.watch.length) { box.innerHTML = ""; paintTabBadge(0); return; }
  const items = watchedGroups();
  paintTabBadge(items.reduce((s, x) => s + unseen(x.w, x.g), 0));
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
    }).join("") + "</ul>" + pushRowHtml() + "</div>";
}

/* =========================================================================
   폰 알림 — 지켜보는 곳에 남이 새 소식을 올리면 앱이 꺼져 있어도 알린다 (공용 보드 + 운영자가 켰을 때)
   서버에는 이 기기의 알림 주소와 지켜보는 장소 이름만 간다(server/push.sql). 알림 내용은 암호화되어
   푸시 서비스(구글·애플·모질라)도 못 읽는다. 끄거나 로그아웃하면 서버에서 지운다.
   ========================================================================= */
const CFG = window.TPW_CONFIG || {};
const iosBrowser = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone &&
  !(window.matchMedia && matchMedia("(display-mode: standalone)").matches);
function pushState(){
  if (!SY.enabled || !CFG.vapidPublicKey || isSample()) return "off";          // 운영자가 알림을 안 붙였다
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return iosBrowser() ? "ios" : "none";                                        // 아이폰은 홈 화면에 둬야 된다
  if (!SY.hasSession()) return "login";
  if (Notification.permission === "denied") return "denied";
  return board.push ? "on" : "ready";
}
function pushRowHtml(){
  const s = pushState();
  const row = (inner) => '<div class="w-push">' + inner + "</div>";
  if (s === "off" || s === "none") return "";
  if (s === "ios") return row('<span class="w-push-note">폰 알림은 홈 화면에 추가한 뒤에 켤 수 있습니다 — 공유 → 홈 화면에 추가.</span>');
  if (s === "login") return row('<span class="w-push-note">로그인하면 앱이 꺼져 있어도 폰으로 알려 드립니다.</span>' +
    '<button class="link-btn" type="button" data-push="login">로그인</button>');
  if (s === "denied") return row('<span class="w-push-note">이 브라우저에서 알림이 막혀 있습니다. 브라우저 설정에서 이 사이트의 알림을 허용하세요.</span>');
  if (s === "on") return row('<span class="w-push-note">남이 새 소식을 올리면 폰으로 알립니다 (한 곳에 30분에 한 번).</span>' +
    '<button class="link-btn" type="button" data-push="off" aria-pressed="true">폰 알림 켜짐</button>');
  return row('<span class="w-push-note">앱이 꺼져 있어도 폰으로 알려 드릴까요?</span>' +
    '<button class="btn sm" type="button" data-push="on" aria-pressed="false">폰 알림 켜기</button>');
}
const watchPlaceKeys = () => Array.from(new Set(board.watch.map((w) => w.k.slice(0, w.k.lastIndexOf("|")))));
/* 서비스 워커가 없으면(보안 출처가 아니면) ready 는 영영 안 온다 — 기다리다 멈추지 않게 */
const swReady = () => Promise.race([navigator.serviceWorker.ready,
  new Promise((_, no) => setTimeout(() => no(new Error("서비스 워커가 없습니다")), 5000))]);
async function pushSave(sub){
  const j = sub.toJSON();
  await SY.rpc("save_push", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
                              p_hood: board.hood || null, p_places: watchPlaceKeys() });
  board.push = { endpoint: j.endpoint };
  save();
}
async function pushOn(){
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") {
    toast(perm === "denied" ? "알림이 막혀 있습니다. 브라우저 설정에서 허용해 주세요." : "알림을 켜지 않았습니다.");
    renderWatch();
    return;
  }
  try {
    if (!board.hood) throw new Error("동네를 먼저 고르세요");
    if (!(await ensureProfile())) throw new Error("특파원 등록을 하지 못했습니다");
    const reg = await swReady();
    const sub = (await reg.pushManager.getSubscription()) ||
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64d(CFG.vapidPublicKey) });
    await pushSave(sub);
    toast("폰 알림을 켰습니다 — 지켜보는 곳에 남이 새 소식을 올리면 알립니다.");
  } catch (e) {
    toast("폰 알림을 켜지 못했습니다: " + e.message);
  }
  renderWatch();
}
/** 끈다. server=false 면 서버는 건드리지 않는다(탈퇴로 이미 지워졌을 때). */
async function pushOff(quiet, server){
  const ep = board.push && board.push.endpoint;
  board.push = null;
  save();
  if (ep && server !== false) { try { await SY.rpc("drop_push", { p_endpoint: ep }); } catch (e) {} }
  try { const sub = await (await swReady()).pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
  if (!quiet) toast("폰 알림을 껐습니다.");
  renderWatch();
}
/* 지켜보는 곳·동네가 바뀌면 서버의 목록도 바꾼다 — 잠깐 모았다가 한 번에 */
let pushTimer = null;
function pushSyncPlaces(){
  if (!board.push || !SY.hasSession()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const sub = await (await swReady()).pushManager.getSubscription();
      if (!sub) { board.push = null; save(); renderWatch(); return; }   // 브라우저가 구독을 버렸다
      await pushSave(sub);
    } catch (e) {}
  }, 800);
}
/* 알림을 눌러 들어오면 그 장소 창을 연다. 아직 이 기기에 없는 글이면 받아온 뒤에 다시 본다. */
let pendingPlace = "";
function openPlaceByKey(key){
  if (!key) return false;
  const g = groups().find((x) => norm(x.place) === key);
  if (!g) { pendingPlace = key; return false; }
  pendingPlace = "";
  closeSheets(true);
  openPlaceSheet(g);
  return true;
}

function renderPlaces(){
  const q = pflt.q.trim().toLowerCase();
  /* filter 는 사본을 준다 — groups() 는 한 번 그리는 동안 함께 쓰는 배열이라 제자리에서 정렬하면 남의 순서가 바뀐다 */
  const gs = groups().filter((g) => !q || (g.place + " " + g.area).toLowerCase().indexOf(q) !== -1);
  const by = {
    recent: (a, b) => b.last.t - a.last.t,
    many:   (a, b) => (b.n - a.n) || (b.last.t - a.last.t),
    rate:   (a, b) => (b.rate - a.rate) || (b.last.t - a.last.t),
    people: (a, b) => (b.people.length - a.people.length) || (b.last.t - a.last.t)
  };
  gs.sort(by[pflt.sort] || by.recent);
  $("#nPlaces").textContent = gs.length ? gs.length : "";
  $("#places").innerHTML = gs.length ? gs.slice(0, placesShown).map((g) => {
    const cat = CATS.find((c) => c.k === g.cat) || CATS[CATS.length - 1];
    const st = g.stat, w = isSample() ? null : watchEntry(g), n = w ? unseen(w, g) : 0, u = g.now ? null : usualNow(g);
    /* 카드와 같은 차림 — 이름·마지막 소식 시각, 분야·동네, 가장 최근 현장 정보, 그리고 숫자 한 줄 */
    return '<button class="pl age-' + ageClass(g.last.t) + '" type="button" data-openkey="' + esc(g.key) + '">' +
      '<div class="card-head">' +
        '<span class="pl-name">' + esc(g.place) + "</span>" +
        (w ? '<span class="wmark"><span aria-hidden="true">★</span><span class="sr">지켜보는 곳</span></span>' : "") +
        (n ? '<span class="w-new">새 소식 ' + n + "</span>" : "") +
        '<span class="age">' + esc(ago(g.last.t)) + "</span>" +
      "</div>" +
      '<div class="card-sub">' +
        '<span class="cat"><span aria-hidden="true">' + cat.ic + "</span> " + esc(cat.nm) + "</span>" +
        (g.area ? '<span class="area">' + esc(g.area) + "</span>" : "") +
      "</div>" +
      (st ? '<div class="live-row' + (g.now ? "" : " faded") + '">' +
        /* 가장 최근 리포트가 메모뿐이면 칩은 그 전 리포트 것이다 — 그때만 시점을 따로 적는다 */
        (st !== g.last ? '<span class="live-label">' + esc(liveLabel(st.t)) + " 상황</span>" : "") +
        statChips(st).map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("") + "</div>" : "") +
      (u ? usualHintHtml(u) : "") +
      (g.confirm ? confirmHtml(g.confirm) : "") +
      (g.conflicts.length ? '<div class="conflict">엇갈립니다 · ' + esc(g.conflicts[0]) + "</div>" : "") +
      '<div class="pl-meta">리포트 <b>' + g.n + "</b>건 · 특파원 <b>" + g.people.length + "</b>명" +
        (g.rate ? " · 별점 <b>" + g.rate.toFixed(1) + "</b>" : "") + "</div></button>";
  }).join("") + (gs.length > placesShown ? moreHtml("placesMore", (gs.length - placesShown) + "곳") : "")
    : '<div class="empty"><b>아직 장소가 없습니다</b><p>리포트가 쌓이면 같은 장소끼리 묶어서 보여 줍니다.</p></div>';
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
  /* 장소마다 하나씩, "안양 안양동 · 맛집" 을 붙여서 — 같은 이름이 여러 동네에 있어도 가려 보이게.
     예시(지어낸 곳)는 권하지 않는다 — 진짜 리포트가 지어낸 장소에 붙지 않게 */
  $("#placeList").innerHTML = isSample() ? "" : gs.map((g) => {
    const cat = CATS.find((c) => c.k === g.cat) || CATS[CATS.length - 1];
    return '<option value="' + esc(g.place) + '" label="' + esc((g.area ? g.area + " · " : "") + cat.nm) + '"></option>';
  }).join("");
  $("#areaList").innerHTML = Array.from(new Set(gs.map((g) => g.area).filter(Boolean)))
    .map((a) => '<option value="' + esc(a) + '"></option>').join("");
}

function paintMe(){
  $("#intro").hidden = !isSample();
  const named = !!board.me && !meEditing;
  $("#meSet").hidden = !named;
  $("#meForm").hidden = named;
  if (named) {
    $("#meName").textContent = board.me;
    const suf = $("#meSuffix");   // 옛 index.html 사본과 섞여 떠도 멈추지 않게
    if (suf) suf.hidden = byline(board.me) === board.me;   // "이름 없는 특파원 특파원으로" 가 되지 않게
    $("#meAv").textContent = board.me.slice(0, 2);
  }
  $("#meLbl").textContent = board.me || "이름";
  $("#meBtn").title = board.me ? "특파원: " + board.me : "특파원 이름 정하기";
}
function renderAll(){
  /* 한 번에 그린다 — 장소 묶음은 한 번만 만들고, 초점과 펼쳐 둔 "현장 정보"는 그대로 둔다 */
  if (!pass || !keeping) return redraw(renderAll);
  stale.ticker = stale.feed = stale.places = false;   // 1분마다 새로 그리기가 미뤄 둔 것도 이걸로 그려진다
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
  const old = Date.now() - KEEP_OTHERS;
  const list = [];
  (rows || []).forEach((row) => {
    if (gone.has(row.id)) return;                  // 내가 이 기기에서 치운 남의 글
    if (!row.mine && new Date(row.t).getTime() < old) return;   // prune() 이 치울 것을 도로 들이지 않는다
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

/* ── 받아오기는 가볍게 ──
   앱이 열려 있으면 3분마다 받아온다. 그때마다 최근 200건을 통째로 받으면 쓰는 사람이 늘수록
   서버가 내보내는 양이 그대로 요금이 된다(Supabase 는 내보낸 양에 값을 매긴다). 그래서 둘로 나눈다.
     · 평소 — 서버에 새로 들어온 글만(created_at 이 마지막으로 본 것 뒤). 대개 몇 건, 대개 0건.
     · 전체 대조 — 최근 200건을 받아 서버에서 사라진 글(지움·가림·탈퇴)을 이 기기에서도 뺀다.
       앱을 열 때, 손으로 받아올 때, 30분마다, 그리고 새 글이 한꺼번에 200건 넘게 들어왔을 때.
   그래서 이웃 폰에서 가려진 글이 빠지는 데 길면 30분이 걸린다. 새 글은 3분 안에 온다. */
const FULL_EVERY = 30 * MIN;
const PULL_LIMIT = 200;
const OVERLAP = 2 * MIN;    // 늦게 커밋된 글을 놓치지 않게 조금 겹쳐 묻는다 — 겹친 것은 id 로 걸러진다
let lastFull = 0;           // 이번에 연 뒤 마지막 전체 대조. 처음 받아올 때는 늘 전체
let cursorMs = 0;           // 서버에 들어온 시각(created_at) — 여기까지는 받았다

/* 이 기기에 쌓이는 양을 묶어 둔다. 공용 보드에서 받은 남의 글은 60일이 지나면 치운다
   ("보통은" 표에 여덟 주면 넉넉하다). 그래도 많으면 오래된 것부터 덜어 LOCAL_CAP 건에 맞춘다.
   내가 쓴 글과 링크로 일부러 받은 글은 건드리지 않는다 — 그건 "주고받기 → 30일 넘은 리포트 지우기" 로. */
const KEEP_OTHERS = 60 * DAY;
const LOCAL_CAP = 3000;
function prune(){
  const before = board.reports.length;
  const cut = Date.now() - KEEP_OTHERS;
  const auto = (r) => r.sv && !r.mine;
  board.reports = board.reports.filter((r) => !auto(r) || r.t >= cut);
  let over = board.reports.length - LOCAL_CAP;
  for (let i = board.reports.length - 1; i >= 0 && over > 0; i--) {   // t 내림차순 — 뒤가 오래된 것
    if (auto(board.reports[i])) { board.reports.splice(i, 1); over--; }
  }
  return before - board.reports.length;
}

async function syncPull(quiet, full){
  if (!SY.enabled || !board.hood || syncing) return;
  syncing = true;
  try {
    let whole = !!full || !cursorMs || Date.now() - lastFull > FULL_EVERY;
    let rows = null;
    if (!whole) {
      rows = await SY.pull(board.hood, { after: new Date(cursorMs - OVERLAP).toISOString(), limit: PULL_LIMIT });
      if (rows.length >= PULL_LIMIT) whole = true;   // 한꺼번에 많이 들어왔다 — 빠짐없이 전체로
    }
    if (whole) rows = await SY.pull(board.hood, { limit: PULL_LIMIT });
    const res = mergeRows(rows);
    res.removed = whole ? reconcile(rows, PULL_LIMIT) : 0;
    res.full = whole;
    if (whole) lastFull = Date.now();
    rows.forEach((row) => { const c = Date.parse(row.created_at); if (c > cursorMs) cursorMs = c; });
    res.pruned = prune();
    board.pulledAt = Date.now();
    if (pendingPlace) setTimeout(() => openPlaceByKey(pendingPlace), 0);
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

/** full 이면 전체 대조(손으로 받아올 때). 결과를 돌려준다 — 예전엔 안 돌려줘서 "지금 받아오기" 가
    잘 받아 와도 늘 "받아오지 못했습니다" 라고 했다. */
async function boardRefresh(quiet, full){
  await syncPushPending();
  return syncPull(quiet, full);
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
    $("#signOut").addEventListener("click", async () => {
      /* 알림은 이 계정으로 걸어 둔 것이다 — 로그아웃하면 끈다(서버에서 지우려면 아직 로그인해 있어야 한다) */
      if (board.push) await pushOff(true);
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
        '<a href="terms.html" target="_blank" rel="noopener">이용약관</a>에 동의하고 ' +
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
  if (board.push) pushOff(true, false);   // 서버의 구독은 탈퇴로 이미 지워졌다
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
/** 속보에서 이 리포트 카드의 다음(없으면 앞) 카드 — 그 지우기 단추를 찾는 선택자. */
function nearCardSel(id){
  const del = $('#feed [data-del="' + CSS.escape(id) + '"]'), card = del && del.closest(".card");
  const step = (dir) => { let x = card && card[dir]; while (x && !x.classList.contains("card")) x = x[dir]; return x; };
  const near = step("nextElementSibling") || step("previousElementSibling");
  return near ? focusSel(near.querySelector("[data-del]")) : "";
}
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
  /* 지운 카드의 단추는 카드와 함께 사라진다 — 초점을 옆 카드의 지우기 단추로(없으면 고른 탭) 옮긴다 */
  const near = nearCardSel(r.id);
  board.reports = board.reports.filter((x) => x.id !== r.id);
  save();
  keepFocus(renderAll, () => (near && $(near)) || selectedTab());
  toast(onServer ? "공용 보드에서도 지웠습니다." : "지웠습니다.");
}

/* ─────────────────────────── 신고 ─────────────────────────── */
const FLAG_REASONS = ["거짓", "광고", "욕설", "사생활", "기타"];
let flagTarget = null;

function openFlagSheet(r){
  flagTarget = r;
  $("#flagWhat").innerHTML = "“" + esc(r.place) + "” · " + esc(byline(r.by)) + " · " + esc(ago(r.t));
  $("#flagStatus").textContent = ""; $("#flagStatus").className = "status";
  $("#flagReasons").innerHTML = FLAG_REASONS.map((x) =>
    '<button class="chip" type="button" data-reason="' + esc(x) + '">' + esc(x) + "</button>").join("");
  openSheet("#flagBack");
}

/* =========================================================================
   다시 그려도 초점과 펼친 것을 지킨다
   목록은 innerHTML 로 통째로 다시 그린다. 그러면 초점을 가진 단추가 사라져 초점이 <body> 로 떨어지고
   (키보드·읽는 프로그램으로 쓰는 사람은 읽던 자리를 잃는다), 펼쳐 둔 "현장 정보"도 도로 접힌다.
   그리기 전에 찾을 길을 적어 두었다가, 그린 뒤에 다시 그려진 같은 것을 찾아 돌려놓는다.
   ========================================================================= */
/** 다시 그린 뒤에도 같은 것을 찾는 선택자 — id 가 있으면 그것, 없으면 가장 가까운 id 조상 + 첫 data-* 값.
    펼치기(summary)는 그것을 담은 details 의 data-exp 로 찾는다. 찾을 길이 없으면 "". */
function focusSel(el){
  if (!el || !el.tagName || el === document.body || el === document.documentElement) return "";
  if (el.id) return "#" + CSS.escape(el.id);
  const up = el.parentElement && el.parentElement.closest("[id]:not([id=''])");
  const pre = up ? "#" + CSS.escape(up.id) + " " : "";
  const box = el.parentElement;
  if (el.tagName === "SUMMARY" && box && box.dataset.exp)
    return pre + 'details[data-exp="' + CSS.escape(box.dataset.exp) + '"] > summary';
  const a = Array.prototype.find.call(el.attributes, (x) => x.name.indexOf("data-") === 0);
  return a ? pre + CSS.escape(el.localName) + "[" + CSS.escape(a.name) + '="' + CSS.escape(a.value) + '"]' : "";
}
const shown = (el) => !!el && el.isConnected && el.getClientRects().length > 0;
let keeping = false;
/** fn 이 다시 그리는 동안 초점과 펼쳐 둔 details 를 지킨다. 초점 가진 것이 사라졌으면 다시 그려진 같은 것에,
    그것도 없으면 alt() 가 주는 것에 초점을 준다. 안에서 또 불러도 바깥 한 번만 일한다. */
function keepFocus(fn, alt){
  if (keeping) return fn();
  /* 같은 선택자에 여럿이 걸리면(장소 창 머리와 타임라인의 같은 리포트) 몇 번째였는지로 가린다 */
  const at = (el) => { const s = focusSel(el); return s ? [s, Math.max(0, $$(s).indexOf(el))] : null; };
  const back = (x) => x ? $$(x[0])[x[1]] || null : null;
  const a = document.activeElement, fa = at(a);
  const open = $$("details[data-exp][open]").map(at);
  keeping = true;
  try { return fn(); }
  finally {
    keeping = false;
    open.forEach((x) => { const d = back(x); if (d) d.open = true; });
    if (a && a !== document.body && !a.isConnected) {
      let to = back(fa);
      if (!shown(to) && alt) to = alt();
      if (shown(to)) { try { to.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
}
/** 다시 그리기 한 번 — 장소 묶음은 한 번만 만들고, 초점·펼친 것은 지킨다. */
function redraw(fn, alt){ return inPass(() => keepFocus(fn, alt)); }
const selectedTab = () => $('.tab[aria-selected="true"]');

/* =========================================================================
   시트(모달)
   ========================================================================= */
const BEHIND = () => [$(".bar"), $("main"), $("footer")];
let lastSel = "";   // 시트를 연 단추가 그사이 다시 그려졌을 때 같은 단추를 찾을 길

/* 뒤로 가기(안드로이드의 뒤로 단추·몸짓, 브라우저의 ←) — 시트가 열려 있으면 앱을 떠나지 않고 시트만 닫는다.
   쓰던 리포트가 뒤로 한 번에 날아가지 않게. 시트를 열 때 같은 주소로 기록을 하나 쌓는다.
   닫기·Esc·끌어 내리기로 닫으면 그 기록은 그대로 두고(스스로 history.back() 을 부르면 바로 뒤의 이동과 엉킨다),
   그 뒤에 사람이 뒤로를 누르면 한 번 더 물러나 준다 — 누른 뒤로가 헛돌지 않게.
   폰에선 속보 밖의 탭(장소·특파원·주고받기)도 기록을 한 칸 쌓는다(switchView) — 뒤로는 먼저 속보로, 그다음에 앱을 떠난다.
   탭바 앱이 다 그렇다. 안 그러면 장소를 보다 뒤로를 누른 사람이 카톡으로 튕겨 나간다. */
const onSheetEntry = () => !!(history.state && history.state.tpwSheet);
const onTabEntry = () => !!(history.state && history.state.tpwTab);
let staleSheet = false, sheetUrl = "";
let owe = false;   // 뒤로를 눌렀는데 빈 칸만 걷혔다 — 아직 아무 일도 안 일어났으니 한 번 더 물러난다
/* 읽던 자리는 탭마다 앱이 기억한다(scrollAt). 뒤로 갈 때 브라우저가 그 칸의 옛 자리로 덮어쓰면
   방금 쓴 리포트를 보이려고 맨 위로 올린 속보가 공유 창을 닫는 순간 도로 내려간다. */
try { history.scrollRestoration = "manual"; } catch (e) {}
/* 새로 고침 전에 쌓였던 시트·탭 기록 위에서 열렸으면 그 칸은 빈 칸이다(시트는 닫혀 있고 화면은 속보).
   평범한 기록으로 돌려 두면 첫 뒤로가 헛돈다 — 닫힌 시트처럼 표시해 두고, 뒤로를 누르면 한 번 더 물러난다. */
if (onSheetEntry() || onTabEntry()) { staleSheet = true; sheetUrl = location.href; }
function sheetBack(){
  /* 링크(#r=)가 들어와 주소가 바뀐 것은 뒤로 가기가 아니다 */
  if (location.href !== sheetUrl) { owe = false; return; }
  /* 시트 기록에 올라섰는데 시트는 닫혀 있다(앞으로 가기 등) — 빈 칸이니 다음 뒤로는 한 번 더 물러난다 */
  if (onSheetEntry()) { owe = false; if (!$(".backdrop.open")) staleSheet = true; return; }
  if ($(".backdrop.open")) {
    staleSheet = owe = false;
    closeSheets(false, true);
    /* 다른 탭에서 쓰고 나면 속보로 넘어온다 — 그 밑에 남은 탭 칸은 조용히 걷는다 */
    if (onTabEntry() && view === "feed") history.back();
    return;
  }
  /* 방금 떠난 칸이 빈 칸(닫힌 시트)이었으면 이번 뒤로는 아직 아무것도 안 했다 */
  const skip = owe || staleSheet;
  owe = staleSheet = false;
  /* 탭 칸에 내려앉았는데 시트가 없다 — 그 위의 빈 칸이 걷힌 것이다. 속보 밖이면 한 칸 더 물러나 속보로,
     속보면(앞으로 가기로 올라온 칸이거나 쓰고 나서 남은 칸) 조용히 걷는다. */
  if (onTabEntry()) { owe = skip || view !== "feed"; history.back(); return; }
  if (view !== "feed" && phoneNow()) { switchView("feed"); return; }   // 폰의 탭 — 먼저 속보로
  if (skip) { owe = true; history.back(); }
}

function openSheet(sel){
  if (!lastFocus) { lastFocus = document.activeElement; lastSel = focusSel(lastFocus); }
  $$(".backdrop.open").forEach((b) => b.classList.remove("open"));   // 시트는 한 번에 하나
  BEHIND().forEach((el) => el && (el.inert = true));
  $(sel).classList.add("open");
  document.body.style.overflow = "hidden";
  if (!onSheetEntry()) { try { history.pushState({ tpwSheet: 1 }, ""); } catch (e) {} }
  sheetUrl = location.href;
  staleSheet = false;
  const f = $(sel).querySelector("[data-autofocus]") ||
            $(sel).querySelector("input:not([hidden]),textarea,button:not(.x)");
  if (f) setTimeout(() => f.focus(), 30);
}
/** fromBack: 뒤로 가기로 닫는 중이다(기록은 이미 한 칸 물러났다). */
function closeSheets(keepFocus, fromBack){
  const was = !!$(".backdrop.open");
  if (shareFresh && $("#shareBack.open")) shareClosed();   // 방금 쓴 글을 안 보내고 닫으면 짚어 준다
  $$(".backdrop.open").forEach((b) => b.classList.remove("open"));
  BEHIND().forEach((el) => el && (el.inert = false));
  document.body.style.overflow = "";
  openPlaceKey = null;
  if (was && !fromBack && onSheetEntry()) staleSheet = true;
  if (!keepFocus && was) { freshen(); returnFocus(); }   // 시트 뒤에서 미뤄 둔 것을 먼저 그리고 초점을 돌려준다
  if (!keepFocus) lastFocus = null;
}
/** 시트를 닫은 뒤의 초점 — 연 단추가 그대로 있으면 그것, 그사이 다시 그려졌으면 같은 단추, 둘 다 아니면 고른 탭.
    <body> 나 닫힌 시트 안에 두지 않는다 — 키보드·읽는 프로그램으로 쓰는 사람이 자리를 잃는다. */
function returnFocus(){
  const ok = (el) => shown(el) && el !== document.body && !el.closest(".backdrop");
  const to = [lastFocus, lastSel && $(lastSel), selectedTab()].find(ok);
  lastSel = "";
  if (to) { try { to.focus(); } catch(e){} }
}
let toastTimer = null, toastSrTimer = null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  /* 긴 알림(정지 안내 같은 것)은 읽을 시간만큼 둔다 — 한 글자에 60ms, 적어도 2.6초 */
  toastTimer = setTimeout(() => { t.hidden = true; }, Math.max(2600, String(msg).length * 60));
  /* 읽어 주는 칸(#toastSr)은 비웠다가 조금 뒤에 채운다 — 같은 말이 또 와도 다시 읽게.
     시트(aria-modal)가 떠 있으면 그 밖은 안 읽어 주는 기기가 있어(맥·아이폰) 시트 안으로 옮겨 둔다 */
  const sr = $("#toastSr");
  if (!sr) return;   // 옛 index.html 사본과 섞여 떠도 멈추지 않게
  const host = $(".backdrop.open .sheet") || document.body;
  if (sr.parentNode !== host) host.appendChild(sr);
  sr.textContent = "";
  clearTimeout(toastSrTimer);
  toastSrTimer = setTimeout(() => { sr.textContent = msg; }, 60);
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
/** 웨이팅·사람·주차 칩. "모름" 칩은 두지 않는다 — 아무것도 안 고른 게 모름이고, 고른 칩을 다시 누르면 비워진다. */
function segHtml(table, sel, field){
  return table.filter((o) => o.v !== -1).map((o) => '<button class="chip" type="button" data-f="' + field + '" data-v="' + o.v +
    '" aria-pressed="' + (o.v === sel) + '">' + esc(o.nm) + "</button>").join("");
}
/** 창을 열 때 한 번만 그린다. 누를 때마다 다시 그리면 누른 단추가 새것으로 바뀌어 초점이 <body> 로 떨어지고
    읽는 프로그램은 "눌림"을 못 읽는다 — 누른 뒤에는 syncCompose() 가 있는 단추의 상태만 바꾼다. */
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
    (n === draft.rate) + '">' + (n <= draft.rate ? "★" : "☆") + "</button>").join("");
}
/** 고른 것을 있는 단추에 옮긴다 — aria-pressed·class·별 모양(고른 데까지 ★, 나머지 ☆)만 바꾼다. */
function syncCompose(){
  $$("#composeForm [data-f]").forEach((b) => {
    const f = b.dataset.f;
    b.setAttribute("aria-pressed", String(draft[f] === (f === "cat" ? b.dataset.v : Number(b.dataset.v))));
  });
  $$("#fTags [data-tag]").forEach((b) => b.setAttribute("aria-pressed", String(draft.tags.indexOf(b.dataset.tag) !== -1)));
  $$("#fRate [data-star]").forEach((b) => {
    const n = Number(b.dataset.star);
    b.classList.toggle("on", n <= draft.rate);
    b.textContent = n <= draft.rate ? "★" : "☆";
    b.setAttribute("aria-pressed", String(n === draft.rate));
  });
  syncSame();
}
/** ref 를 주면 "나도 여기" — 같은 장소의 새 리포트.
    장소·동네·분야·태그처럼 오래 가는 것만 채운다. 웨이팅·사람·주차는 채우지 않고
    참고로만 보여 준다. 안 보고 눌러도 옛 정보가 새 시각을 달고 나가지 않게.
    "리포트 보내기"로 열었어도 아는 장소 이름을 치면 같은 차림으로 바뀐다(syncPlace). */
let composeRef = null;
/* refAuto — 이름을 쳐서 아는 곳을 찾아 들어왔다(카드·장소 창에서 연 게 아니다). refKey·refArea — 그 장소 묶음.
   refUndo — 그때 바꾼 분야·동네·태그. 이름을 고쳐 다른 곳이 되면 그사이 손대지 않은 것만 되돌린다.
   byHand — 이 창에서 손으로 고른 것. 아는 곳을 찾아도 덮어쓰지 않는다. */
let refAuto = false, refKey = "", refArea = "", refUndo = null;
let byHand = { cat:false, area:false, tags:false };
let areaPick = "", pickFor = "", placeTimer = null, byInit = "";
const NONAME = "이름 없는 특파원";
/** 이름을 정했나 — 이름 없이 한 번 보내면 board.me 가 "이름 없는 특파원"이 되지만 그건 정한 게 아니다. */
const hasName = () => !!board.me && board.me !== NONAME;
/** 내가 쓴 것, 최근 것부터(board.reports 는 늘 최신순). */
const myReports = () => board.reports.filter((r) => r.mine || (hasName() && r.by === board.me));
/** 링크로 온 태그는 아무 글자나 될 수 있다(전화번호·광고). 쓰기 창에 있는 태그만 옮긴다 —
    안 보이고 뺄 수도 없는 태그가 내 이름을 달고 나가지 않게. */
const knownTags = (a) => (Array.isArray(a) ? a : []).filter((t, i, all) => TAGS.indexOf(t) !== -1 && all.indexOf(t) === i).slice(0, 6);
/** 그 리포트가 든 장소 묶음. all 을 주면 이미 묶어 둔 것에서 찾는다(여는 동안 한 번만 묶게). */
const groupOf = (r, all) => (all || groups()).find((g) => g.rs.some((x) => x.id === r.id)) || null;
const keyArea = (k) => k.slice(k.lastIndexOf("|") + 1);

function openCompose(ref){
  ref = ref && ref.place ? ref : null;
  clearTimeout(placeTimer); placeTimer = null;
  const all = groups(), g0 = ref ? groupOf(ref, all) : null, d = loadDraft();
  /* 쓰던 글은 새로 쓸 때, 또는 같은 장소의 "나도 여기"일 때만 되살린다 — 다른 장소에 옮겨 붙지 않게 */
  keptMine = !!d && (!ref || (!!g0 && d.rk === g0.key));
  const mine = myReports();
  /* 새 장소의 분야·동네는 내가 마지막으로 쓴 것 — 매번 놀이공간이 아니라 */
  draft = { cat: ref ? ref.cat : (mine.length ? mine[0].cat : "play"), wait:-1, crowd:-1, park:-1, rate:0,
            tags: ref ? knownTags(ref.tags) : [] };
  byHand = { cat:false, area:false, tags:false };
  composeRef = null; refAuto = false; refKey = ""; refArea = ""; refUndo = null; areaPick = ""; pickFor = "";
  $("#fPlace").value = ref ? ref.place : "";
  $("#fArea").value = ref ? ref.area : (mine.length ? mine[0].area : "");
  $("#fNote").value = "";
  byInit = hasName() ? board.me : "";
  $("#fBy").value = byInit;
  paintCompose();
  if (ref) enterRef(ref, g0, false);
  if (keptMine) applyDraft(d, ref, all);
  syncPlace(all);
  paintMode();
  paintSug(all);
  const refChips = composeRef && statChips(composeRef).length;
  $("#fPlace").toggleAttribute("data-autofocus", !refChips);
  $("#fRefSame").toggleAttribute("data-autofocus", !!refChips);
  /* 이름을 아직 안 정했으면 눈에 띄게 위에 두고, 정했으면 "더 적기" 안으로 — 매번 물을 것은 아니다.
     "이름 없는 특파원"은 정한 이름이 아니다 — 칸을 비워 두고(예시 글자만) 계속 위에서 묻는다 */
  const byRow = $("#fByRow"), more = $("#fMore");
  if (byRow && more) {
    if (hasName()) more.querySelector(".more-in").appendChild(byRow);
    else more.parentNode.insertBefore(byRow, more);
    more.open = false;
    $("#fMoreHint").textContent = hasName() ? "동네 · 별점 · 태그 · 이름" : "동네 · 별점 · 태그";
  }
  $("#noteCnt").textContent = $("#fNote").value.length + "/200";
  clearErr();
  $("#fPubRow").hidden = !SY.enabled;
  $("#fPub").checked = true;
  openSheet("#composeBack");
}
/** 제목·한 줄 예시·참고 상자·단추 상태를 지금 차림(새 리포트 / 나도 여기)에 맞춘다. */
function paintMode(){
  $("#fNote").placeholder = composeRef ? "달라진 게 있으면 적어 주세요."
    : "예: 2시 넘으니 자리 났어요.";
  $("#composeTitle").textContent = composeRef ? "여기 지금 상황" : "리포트 보내기";
  paintRef();
  syncCompose();
}
/** "나도 여기" 차림으로. auto 면 이름으로 찾아 들어온 것 — 손대지 않은 분야·동네·태그만 그 장소 것으로 채운다.
    웨이팅·사람·주차는 여기서도 채우지 않는다. */
function enterRef(ref, g, auto){
  composeRef = ref; refAuto = auto; refKey = g ? g.key : ""; refArea = g ? g.area : ref.area;
  /* 카드에서 열었으면 채워 준 태그만 적어 둔다(분야·동네는 이름을 고쳐도 그대로 둔다) — 태그는 그곳 이야기다 */
  const u = refUndo = { cat:null, area:null, tags: auto ? [] : draft.tags.slice() };
  if (auto && g) {
    const a = $("#fArea").value;
    if (!byHand.cat && draft.cat !== ref.cat) { u.cat = [draft.cat, ref.cat]; draft.cat = ref.cat; }
    if (!byHand.area && a !== g.area) { u.area = [a, g.area]; $("#fArea").value = g.area; }
    if (!byHand.tags) knownTags(ref.tags).forEach((t) => {
      if (draft.tags.indexOf(t) === -1 && draft.tags.length < 6) { draft.tags.push(t); u.tags.push(t); }
    });
  }
  paintMode();
}
/** "나도 여기" 차림을 푼다 — 이름을 고쳐 다른 곳이 됐다. 채워 줬던 것 가운데 그대로인 것만 원래대로. */
function leaveRef(){
  if (!composeRef) return;
  /* "그대로예요"로 옮긴 값은 그 장소 이야기였다 — 다른 곳으로 바뀌면 비운다 */
  if (statChips(composeRef).length && draft.wait === composeRef.wait && draft.crowd === composeRef.crowd &&
      draft.park === composeRef.park) draft.wait = draft.crowd = draft.park = -1;
  const u = refUndo;
  if (u) {
    if (u.cat && draft.cat === u.cat[1]) draft.cat = u.cat[0];
    if (u.area && $("#fArea").value === u.area[1]) $("#fArea").value = u.area[0];
    draft.tags = draft.tags.filter((t) => u.tags.indexOf(t) === -1);
  }
  composeRef = null; refAuto = false; refKey = ""; refArea = ""; refUndo = null;
  paintMode();
}
/** 적은 이름이 아는 장소면 그 장소로 — 분야·동네를 가져오고 "나도 여기"가 된다. 그러지 않으면 장소 묶음이
    둘로 갈라지고(동네가 지난번 것이라) 엇갈림도 숨는다. 같은 이름이 여러 동네에 있으면 어느 동네인지 묻는다. */
function syncPlace(all){
  clearTimeout(placeTimer); placeTimer = null;
  const n = norm($("#fPlace").value);
  if (n !== pickFor) { pickFor = n; areaPick = ""; }
  const typed = byHand.area ? areaKey($("#fArea").value) : "";
  let ask = [];
  /* 카드·장소 창에서 연 곳은 이미 어디인지 안다 — 이름이나 동네를 바꾸지 않았으면 그대로 */
  if (!(composeRef && !refAuto && norm(composeRef.place) === n && (!typed || keyArea(refKey) === typed))) {
    const gs = n && !isSample() ? (all || groups()).filter((g) => norm(g.place) === n) : [];
    let g = null;
    if (typed) g = gs.find((x) => keyArea(x.key) === typed) || null;   // 손으로 적은 동네가 가려 준다
    else {
      if (gs.length > 1) ask = gs;
      g = areaPick === "other" ? null : gs.find((x) => x.key === areaPick) || (gs.length === 1 ? gs[0] : null);
    }
    if (!g) leaveRef();
    else if (!composeRef || g.key !== refKey) { leaveRef(); enterRef(g.stat || g.last, g, true); }
  }
  paintPick(ask);
}
/** "어느 동네예요?" — 동네마다 칩 하나와 "다른 곳". 고른 것은 눌림으로 보인다. 목록이 같으면 다시 그리지 않는다(초점). */
function paintPick(gs){
  const box = $("#fPick"), sig = gs.map((g) => g.key).join("\n");
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    $$("#fPick [data-pick]").forEach((b) => b.remove());
    box.insertAdjacentHTML("beforeend", gs.map((g) => '<button class="chip" type="button" data-pick="' + esc(g.key) + '">' +
      esc(g.area || "동네 모름") + "</button>").join("") + (gs.length ? '<button class="chip" type="button" data-pick="">다른 곳</button>' : ""));
  }
  box.hidden = !gs.length;
  $$("#fPick [data-pick]").forEach((b) => b.setAttribute("aria-pressed",
    String(b.dataset.pick ? !!composeRef && b.dataset.pick === refKey : areaPick === "other")));
}
/** 빈 장소 칸 밑의 아는 곳 — 지켜보는 곳, 지금 소식이 있는 곳, 내가 최근에 쓴 곳 순으로 넷까지. 누르면 그 이름을 친 것과 같다. */
function paintSug(all){
  const gs = [];
  if (!isSample()) {
    all = all || groups();
    const add = (g) => { if (g && gs.indexOf(g) === -1 && gs.length < 4) gs.push(g); };
    watchedGroups(all).forEach((x) => add(x.g));
    all.filter((g) => g.now).sort((a, b) => b.now.t - a.now.t).forEach(add);
    myReports().some((r) => { add(all.find((g) => g.rs.indexOf(r) !== -1)); return gs.length >= 4; });
  }
  const twice = (g) => gs.filter((x) => norm(x.place) === norm(g.place)).length > 1;
  const box = $("#fSug");
  box.innerHTML = gs.map((g) => '<button class="chip" type="button" data-sug="' + esc(g.key) + '">' + esc(g.place) +
    (twice(g) && g.area ? ' <span class="sug-a">' + esc(g.area.split(" ").pop()) + "</span>" : "") + "</button>").join("");
  box.hidden = !gs.length || !!$("#fPlace").value;
}

function paintRef(){
  const box = $("#fRef");
  box.hidden = !composeRef;
  if (!composeRef) return;
  const r = composeRef, chips = statChips(r);
  /* 어느 동네의 그곳인지도 — 이름으로 찾아 들어오면 동네는 접힌 "더 적기" 안이라 여기서만 보인다 */
  $("#fRefWho").textContent = byline(r.by) + " · " + ago(r.t) + (refArea ? " · " + refArea : "");
  $("#fRefStats").innerHTML = chips.length
    ? chips.map((c) => '<span class="stat ' + c.tone + '">' + esc(c.s) + "</span>").join("")
    : '<span class="note">현장 정보 없이 메모만 남긴 리포트입니다.</span>';
  $("#fRefSame").hidden = !chips.length;
  $("#fRefHint").hidden = !chips.length;   // 옮길 값이 없으면 "똑같으면 그대로예요"도 말하지 않는다
  syncSame();
}
/** "그대로예요" 는 지금 고른 값이 앞 리포트와 같은지를 그대로 보여 준다 — 누른 뒤 칩을 바꾸면 풀린다. */
function syncSame(){
  if (!composeRef) return;
  const same = draft.wait === composeRef.wait && draft.crowd === composeRef.crowd && draft.park === composeRef.park;
  $("#fRefSame").setAttribute("aria-pressed", String(same));
  $("#fRefSame").textContent = same ? "✓ 그대로" : "그대로예요";
}
/** 보내기가 막힌 까닭 — 글은 보내기 바로 위(#composeErr)에, 걸린 칸에는 aria-invalid 와 그 글을 단다. */
let errEl = null;
function showErr(msg, el, to){
  clearErr();
  $("#composeErr").textContent = msg;
  errEl = el;
  el.setAttribute("aria-invalid", "true");
  el.setAttribute("aria-describedby", "composeErr");
  (to || el).focus();
}
function clearErr(){
  $("#composeErr").textContent = "";
  if (!errEl) return;
  errEl.removeAttribute("aria-invalid");
  errEl.removeAttribute("aria-describedby");
  errEl = null;
}
/** 손으로 고친 뒤 — 걸렸던 칸을 고쳤으면 오류를 걷고, 쓰던 글을 붙잡아 둔다. */
function edited(kind){
  if (errEl && (errEl.id === "fPlace" ? kind === "place" : /^(live|note|rate|tags)$/.test(kind))) clearErr();
  keepDraft();
}

/* 쓰던 리포트 — 뒤로 가기·바깥 누르기·끌어 내리기·Esc·새로 고침으로 창이 닫혀도 날아가지 않게, 고칠 때마다 붙잡아 둔다.
   이 탭에만 남고(sessionStorage, 막혀 있으면 메모리에만) 보내면 지운다. */
const DRAFT_KEY = "tpw.draft";
const DRAFT_LIVE = 30 * MIN;   // 이보다 묵은 웨이팅·사람·주차는 되살리지 않는다 — 옛 정보가 새 시각을 달고 나가지 않게
let kept = null, keptMine = false;   // keptMine — 지금 창이 그 글을 이어 쓰는 중이다
function loadDraft(){
  if (!kept) { try { kept = JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch (e) {} }
  return kept && typeof kept === "object" ? kept : null;
}
function dropDraft(){
  kept = null; keptMine = false;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
}
/** 손으로 쓴 게 있나 — 카드에서 채워 준 것뿐이면 붙잡을 것이 없다. */
function drafted(){
  const place = $("#fPlace").value.trim();
  return !!($("#fNote").value.trim() || draft.wait !== -1 || draft.crowd !== -1 || draft.park !== -1 || draft.rate ||
    byHand.cat || byHand.area || byHand.tags || $("#fBy").value !== byInit ||
    (place && !(composeRef && !refAuto && place === composeRef.place)));
}
function keepDraft(){
  if (!$("#composeBack").classList.contains("open")) return;   // 보내고 닫힌 뒤의 늦은 이벤트가 다시 붙잡지 않게
  if (!drafted()) { if (keptMine) dropDraft(); return; }
  /* 이름은 이 창에서 손으로 적었을 때만 — 그사이 특파원 탭에서 바꾼 이름을 옛 이름으로 덮지 않게 */
  kept = { at: Date.now(), place: $("#fPlace").value, area: $("#fArea").value, note: $("#fNote").value,
    by: $("#fBy").value !== byInit ? $("#fBy").value : null,
    cat: draft.cat, wait: draft.wait, crowd: draft.crowd, park: draft.park, rate: draft.rate, tags: draft.tags.slice(),
    ref: composeRef ? composeRef.id : "", rk: composeRef ? refKey : "", auto: refAuto, undo: refUndo,
    hand: Object.assign({}, byHand), pick: areaPick, pickFor };
  keptMine = true;
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(kept)); } catch (e) {}
}
/** 붙잡아 둔 글을 되살린다. 저장소에서 온 것이라 값마다 다시 본다. */
function applyDraft(d, ref, all){
  const s = (v, n) => String(v == null ? "" : v).slice(0, n);
  const isCat = (k) => CATS.some((c) => c.k === k);
  $("#fPlace").value = s(d.place, 40);
  $("#fArea").value = s(d.area, 30);
  $("#fNote").value = s(d.note, 200);
  if (typeof d.by === "string") $("#fBy").value = s(d.by, 20);
  if (isCat(d.cat)) draft.cat = d.cat;
  const fresh = Date.now() - (Number(d.at) || 0) < DRAFT_LIVE;
  [["wait", WAIT], ["crowd", CROWD], ["park", PARK]].forEach((x) => {
    draft[x[0]] = fresh && x[1].some((o) => o.v !== -1 && o.v === d[x[0]]) ? d[x[0]] : -1;
  });
  draft.rate = clamp(Math.round(Number(d.rate) || 0), 0, 5);
  draft.tags = knownTags(d.tags);
  const h = d.hand || {};
  byHand = { cat: !!h.cat, area: !!h.area, tags: !!h.tags };
  /* 새로 쓰던 글이 "나도 여기"였으면 그때 참고하던 리포트를 다시 찾는다(지워졌으면 그 장소의 최근 것) */
  if (!ref && d.ref && !isSample()) {
    const r = reports().find((x) => x.id === d.ref) || null;
    const g = r ? groupOf(r, all) : (all || groups()).find((x) => x.key === d.rk) || null;
    if (g) {
      composeRef = r || g.stat || g.last; refAuto = !!d.auto; refKey = g.key; refArea = g.area;
      const u = d.undo && typeof d.undo === "object" ? d.undo : null;
      refUndo = u ? { cat: Array.isArray(u.cat) && u.cat.every(isCat) ? u.cat.slice(0, 2) : null,
        area: Array.isArray(u.area) ? u.area.slice(0, 2).map((x) => s(x, 30)) : null, tags: knownTags(u.tags) } : null;
    }
  }
  areaPick = typeof d.pick === "string" ? d.pick : "";
  pickFor = typeof d.pickFor === "string" ? d.pickFor : "";
}

let shareCache = "", shareSeq = 0, shareList = [], shareFresh = null;
let bundleList = [];   // 주고받기의 묶음 링크에 담긴 리포트
/** fresh 는 방금 쓴 글이라는 뜻이다. 공용 보드가 없으면 이 글은 아직 아무에게도 안 갔다 —
    저장된 것을 보낸 것으로 알고 닫지 않게, 보내는 게 마지막 단계라고 먼저 말해 둔다. */
async function openShare(list, fresh){
  /* 글은 압축이 끝나야 생긴다. 그 전에 누른 "복사"가 앞서 만든 남의 글을 복사하지 않게 비워 두고,
     그사이 다른 공유 창이 열렸으면 늦게 끝난 이 글로 그 창을 덮지 않는다. */
  const seq = ++shareSeq;
  shareCache = "";
  shareList = list;
  shareFresh = fresh && !SY.enabled && list.length === 1 ? list[0].id : null;
  $("#shareTitle").textContent = shareFresh ? "아직 이 폰에만 있어요" : "보낼 준비가 됐습니다";
  const note = $("#shareNote");   // 옛 index.html 사본과 섞여 떠도 멈추지 않게
  if (note) note.textContent = shareFresh ? "아래 글을 단톡방에 보내면, 링크를 누른 사람의 화면에 이 리포트가 더해집니다."
    : "카톡 단톡방에 보내면, 링크를 누른 사람의 화면에 이 리포트가 더해집니다.";
  $("#shareBox").value = "만드는 중…";
  const st = $("#shareStatus");
  st.textContent = ""; st.className = "status";
  /* 폰에는 공유 창이 있다 — 카톡을 바로 고를 수 있게 그걸 앞에 두고, 복사는 뒤로 */
  const native = !!navigator.share;
  $("#shareNative").hidden = !native;
  $("#shareNative").classList.toggle("primary", native);
  $("#shareCopy").classList.toggle("primary", !native);
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
/** 복사했거나 폰의 공유 창으로 넘긴 내 글에 sh 를 단다. 이 기기에만 두는 표시라 링크 줄(toRow)에도 서버에도 안 실린다.
    카톡에서 취소했을 수도 있지만 거기까진 알 수 없으니, 넘긴 것까지만 센다. */
function markSent(list){
  const ids = new Set(list.map((r) => r.id));
  const newly = board.reports.filter((r) => r.mine && !r.sh && ids.has(r.id));
  newly.forEach((r) => { r.sh = true; });
  if (newly.length) { save(); renderFeed(); }
  homeTip();
}
/** 방금 쓴 글을 안 보내고 공유 창을 닫았다(closeSheets 가 부른다) — 카드에 "안 보냄"이 남아 있다고 한 번 짚어 준다. */
function shareClosed(){
  const r = board.reports.find((x) => x.id === shareFresh);
  shareFresh = null;
  if (r && !r.sh) toast("아직 안 보냈어요. 카드의 ‘공유’로 언제든 보낼 수 있어요.");
}
/** 처음 보낸 뒤 한 번만 — 다음에도 주소창 없이 바로 열리게 홈 화면에 두라고 권한다.
    이미 홈 화면 앱이거나 카톡 같은 앱 안의 브라우저(거기선 추가가 안 된다)면, 또 이 브라우저에 알려 줄 방법이 없으면
    (주고받기의 "홈 화면에 추가"가 숨어 있으면) 권하지 않는다. 띄운 걸 기억하지 못하는 곳에서는 아예 안 띄운다. */
function homeTip(){
  const tip = $("#homeTip"), panel = $("#installPanel");
  if (!tip || !panel || panel.hidden || standalone() || inAppBrowser()) return;
  if (store.get("tpw.homeTip", 0) || !store.set("tpw.homeTip", 1)) return;
  tip.hidden = false;
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
      (g.people.length > 1 ? '<div class="note">' + esc(byline(g.people.join(", "))) + "이 다녀갔습니다.</div>" : "") +
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
  $("#placeShare").hidden = isSample();   // 예시는 보낼 수 없다 — 눌러야 안 된다는 걸 알게 두지 않는다
  if (markSeen(g)) redraw(() => { renderWatch(); renderPlaces(); });   // 연 단추가 다시 그려져도 초점은 그 자리에 — 닫으면 거기로 돌아온다
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
  let saved = true;
  if (added) {
    board.seeded = true;
    board.reports.sort((a, b) => b.t - a.t);
    saved = save();   // 모자라면 save() 가 자리를 만들고, 끝내 못 하면 속보 맨 위에 경고를 남긴다
  }
  return { added, dup, fresh, saved };
}
/** 받은 결과를 한 줄로 — 지켜보는 곳에 새 소식이 있으면 그걸 붙인다. */
function mergeNote(res, head){
  const wn = watchNews(res.fresh);
  return head + (wn ? " " + wn : "");
}
function clearHash(){
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}
/** 예시 보드에 링크가 도착하면, 담을지 정하기 전까지 예시(안내·지금 가기 좋은 곳·속보·쓰기 단추·지금 N건)를 가린다 —
    지어낸 "지금 가기 좋은 곳"이 친구가 보낸 것처럼 읽히지 않고 친구 소식이 첫 화면이 되게. 알림이 닫히면 푼다. */
const inboxHush = () => document.body.toggleAttribute("data-inbox", !!$("#inbox .inbox") && isSample());
/** 알림을 닫는다. 카톡 안 브라우저에서 담았을 때만 주소(#r=)를 남긴다 — "다른 브라우저로 열기"로 나가도 거기서 또 받게. */
function closeInbox(keepHash){
  $("#inbox").innerHTML = "";
  if (!keepHash) clearHash();
  inboxHush();
}
/** 링크에 실린 곳 이름 — 띄어쓰기만 다른 이름은 한 번, 셋까지 적고 나머지는 "외 N곳". */
function placeNames(list){
  const keys = new Set(), ns = list.map((r) => r.place).filter((p) => !keys.has(norm(p)) && keys.add(norm(p)));
  return ns.slice(0, 3).join(", ") + (ns.length > 3 ? " 외 " + (ns.length - 3) + "곳" : "");
}
const INBOX_CUT = "링크가 중간에 잘렸습니다. 카톡 글을 길게 눌러 통째로 복사한 뒤, 주고받기 탭의 ‘받기’ 칸에 붙여 넣어 보세요.";
let inboxSeq = 0;
/** arrived: 앱이 열려 있는 채로 링크가 들어왔다(hashchange — 홈 화면 앱이 링크를 받을 때). */
async function checkHash(arrived){
  /* 끝에 딸려 온 글자(카톡 글에서 같이 긁힌 ")" 같은 것)는 버린다 — 붙여넣기 칸의 findCode 처럼 */
  const m = location.hash.match(/^#r=([A-Za-z0-9_-]+)/);
  if (!m) return;
  if (isSample()) document.body.setAttribute("data-inbox", "");   // 푸는 동안 예시가 먼저 번쩍 보이지 않게
  const box = $("#inbox"), seq = ++inboxSeq;
  let html, held = false;
  try {
    const list = await unpack(m[1]);
    if (seq !== inboxSeq) return;   // 그사이 다른 링크가 들어왔다
    inboxCache = list;
    const have = new Set(board.reports.map((r) => r.id));
    const fresh = list.filter((r) => !have.has(r.id)).sort((a, b) => b.t - a.t);
    if (!fresh.length) {
      held = true;
      html = '<div class="inbox"><h2 tabindex="-1">이미 갖고 있는 리포트입니다</h2>' +
        "<p>" + esc(placeNames(list)) + " · " + list.length + "건 모두 보드에 있습니다.</p>" +
        '<div class="row"><button class="btn sm ghost" id="inboxNo" type="button">닫기</button></div></div>';
    } else {
      /* 받을지 묻기 전에 무엇이 왔는지 먼저 보인다 — 새로 온 것만, 카드 그대로(단추만 빼고) */
      const by = Array.from(new Set(fresh.map((r) => r.by)));
      const skip = list.length - fresh.length;
      html = '<div class="inbox arrive"><h2 tabindex="-1">' +
          (by.length === 1 ? esc(byline(by[0])) + "이 보낸 현장 소식" : "현장 소식 " + fresh.length + "건") + "</h2>" +
        "<p>" + (by.length === 1 ? fresh.length + "건 · " : "") + esc(placeNames(fresh)) +
          (skip ? " · 이미 있는 " + skip + "건은 뺐습니다" : "") + "</p>" +
        '<div class="inbox-cards">' + fresh.slice(0, 3).map((r) => cardHtml(r, { preview: true })).join("") + "</div>" +
        (fresh.length > 3 ? '<p class="inbox-more">외 ' + (fresh.length - 3) + "건</p>" : "") +
        '<div class="row"><button class="btn primary sm" id="inboxYes" type="button">내 보드에 담기</button>' +
        '<button class="btn sm ghost" id="inboxNo" type="button">안 담기</button></div></div>';
    }
  } catch(e) {
    if (seq !== inboxSeq) return;
    html = '<div class="inbox err"><h2 tabindex="-1">링크를 읽지 못했습니다</h2><p>' + (e.cut ? INBOX_CUT : esc(e.message)) + "</p>" +
      '<div class="row">' + (e.cut ? '<button class="btn primary sm" id="inboxPaste" type="button">붙여 넣으러 가기</button>' : "") +
      '<button class="btn sm ghost" id="inboxNo" type="button">닫기</button></div></div>';
  }
  box.innerHTML = html;
  inboxHush();
  if (arrived) {
    /* 내려 읽던 중이거나 다른 탭에 있으면 알림이 화면 밖에 그려진다 — 속보 맨 위로 와서 알림 제목에 초점.
       창이 떠 있으면 뒤가 막혀(inert) 있어 닫는다. 쓰던 리포트는 두고 */
    if ($(".backdrop.open") && !$("#composeBack.open")) closeSheets();
    switchView("feed");
    window.scrollTo(0, 0);
    box.querySelector("h2").focus();
  }
  const yes = $("#inboxYes"), no = $("#inboxNo"), paste = $("#inboxPaste");
  if (yes) yes.addEventListener("click", () => {
    const res = merge(inboxCache || []);
    const msg = mergeNote(res, res.added + "건을 받았습니다." + (res.dup ? " (" + res.dup + "건은 이미 있었음)" : ""));
    closeInbox(inAppBrowser());
    renderAll();
    /* 한 곳 소식이면 그 장소 창을 연다 — 앞뒤 소식과 "지켜보기"가 거기 있다. 닫으면 속보의 그 카드로 */
    const ids = new Set(res.fresh.map((r) => r.id));
    const gs = ids.size ? groups().filter((g) => g.rs.some((r) => ids.has(r.id))) : [];
    if (gs.length === 1) {
      const card = $('#feed [data-open="' + gs[0].rs.find((r) => ids.has(r.id)).id + '"]');
      if (card) card.focus({ preventScroll: true });
      openPlaceSheet(gs[0]);
    }
    toast(msg);
  });
  if (no) no.addEventListener("click", () => closeInbox(held && inAppBrowser()));   // 이미 받은 링크도 다른 브라우저로 들고 나가게
  if (paste) paste.addEventListener("click", () => {
    closeInbox();
    switchView("sync");
    window.scrollTo(0, 0);   // "받기"는 주고받기 맨 위에 있다
    $("#recvBox").focus();
  });
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
const BAR = { light:"#0E1E3D", dark:"#0E1E3D" };   // 머리띠 남색 — 두 테마 같다
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
/* 탭마다 읽던 자리를 기억한다 — 장소를 보다 속보로 돌아와도 보던 카드 그대로. */
const scrollAt = {};
function switchView(name){
  const prev = view, moved = prev !== name;
  if (moved) scrollAt[prev] = window.scrollY;
  view = name;
  document.body.dataset.view = name;        // 폰 차림이 화면마다 보일 것을 고른다(index.html 의 "앱" 묶음)
  $$(".tab").forEach((b) => {
    const on = b.dataset.view === name;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;               // 탭 키로는 고른 탭 하나만, 나머지는 화살표로
  });
  $$(".view").forEach((s) => { s.hidden = s.id !== "view-" + name; });
  freshen();                                // 1분마다 새로 그리기가 미뤄 둔 화면이면 지금 그린다
  if (moved) {
    window.scrollTo(0, scrollAt[name] || 0);
    $("#writeBtn").classList.remove("mini");
    tabEntry(prev, name);
  }
}
const phoneNow = () => !!(window.matchMedia && matchMedia(PHONE).matches);
/* 폰에선 속보 밖의 탭이 기록을 한 칸 쌓는다 — 안드로이드 뒤로가 앱을 떠나지 않고 속보로 온다(sheetBack).
   탭끼리 옮겨 다니면 그 칸을 고쳐 쓰고(몇 번을 옮겨도 한 칸), 속보 탭을 누르면 걷는다 — 기록이 깨끗하게.
   넓은 화면은 그대로다(머리띠 탭은 기록을 안 쌓는다). */
function tabEntry(prev, name){
  if (!phoneNow()) return;
  try {
    if (name === "feed") {
      if (onTabEntry()) { staleSheet = owe = false; history.back(); }
      return;
    }
    if (onTabEntry()) history.replaceState({ tpwTab: name }, "");
    else if (prev !== "feed") return;   // 탭 칸 위의 닫힌 시트 칸(뒤로가 한 칸 더 물러난다)이거나 넓은 화면에서 넘어왔다
    /* 받은 링크(#r=)를 아직 안 받았다 — 받거나 안 받으면 clearHash 가 지금 칸을 갈아 끼워 탭 표시가 지워지고,
       뒤로 내려간 칸의 #r= 가 받은 링크를 도로 띄운다. 그동안은 쌓지 않는다(예전처럼) */
    else if (/^#r=/.test(location.hash)) return;
    else if (onSheetEntry()) history.replaceState({ tpwTab: name }, "");   // 닫힌 시트의 빈 칸을 탭 칸으로 고쳐 쓴다
    else history.pushState({ tpwTab: name }, "");
    staleSheet = owe = false;
    sheetUrl = location.href;
  } catch (e) {}
}
const reducedMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
/** 탭을 손가락으로 눌렀을 때만 아주 짧게 떤다(되는 폰에서만). 마우스·키보드로는 떨지 않는다. */
function tapFeedback(){
  try {
    if (navigator.vibrate && window.matchMedia && matchMedia("(pointer: coarse)").matches) navigator.vibrate(8);
  } catch (e) {}
}

/* 내려 읽는 동안엔 "리포트 보내기"가 아이콘만 남고, 올리면 다시 펼친다. 머리띠는 글이 밑으로 지나가면 그림자를 단다. */
function watchScroll(){
  let lastY = window.scrollY, ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY, fab = $("#writeBtn");
      if (y > lastY + 6 && y > 120) fab.classList.add("mini");
      else if (y < lastY - 6 || y < 60) fab.classList.remove("mini");
      $(".bar").classList.toggle("lifted", y > 2);
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
}

/* 폰의 시트는 머리(손잡이)를 끌어 내리면 닫힌다. 조금만 끌었다 놓으면 제자리로 돌아간다. */
const PHONE = "(max-width: 759px)";
function sheetDrag(){
  $$(".sheet").forEach((sh) => {
    const head = sh.querySelector(".sheet-head");
    if (!head) return;
    let y0 = null, dy = 0, t0 = 0;
    head.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button,a,input,select,textarea,label")) return;
      if (!(window.matchMedia && matchMedia(PHONE).matches)) return;
      y0 = e.clientY; dy = 0; t0 = e.timeStamp;
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
      sh.style.transition = "none";
    });
    head.addEventListener("pointermove", (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      sh.style.transform = dy ? "translateY(" + dy + "px)" : "";
    });
    const end = (e) => {
      if (y0 === null) return;
      const speed = dy / Math.max(1, e.timeStamp - t0);   // px/ms
      y0 = null;
      const close = e.type === "pointerup" && (dy > 110 || (dy > 40 && speed > .5));
      sh.style.transition = reducedMotion() ? "none" : "transform .2s cubic-bezier(.2,.8,.2,1)";
      sh.style.transform = close ? "translateY(100%)" : "";
      setTimeout(() => {
        sh.style.transition = "";
        if (close) { sh.style.transform = ""; closeSheets(); }
      }, reducedMotion() ? 0 : 200);
    };
    head.addEventListener("pointerup", end);
    head.addEventListener("pointercancel", end);
  });
}

/* 홈 화면에 추가 — 안드로이드 크롬은 버튼 하나로, 아이폰은 사파리 공유 단추에서.
   링크는 카톡으로 오가니 카톡 안의 브라우저로 여는 사람이 많다 — 거기선 추가가 안 되니 밖으로 나가라고 한다.
   이미 홈 화면 앱으로 열었으면 숨긴다. */
let installEvt = null;
const standalone = () => !!((window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone);
const inAppBrowser = () => /KAKAOTALK|NAVER\(inapp|DaumApps|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
function paintInstall(){
  const panel = $("#installPanel");
  if (!panel) return;   // 옛 index.html 사본과 섞여 떠도 멈추지 않게
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const note = standalone() ? ""
    : installEvt ? "홈 화면에 아이콘을 두면 주소창 없이 앱처럼 열리고, 인터넷이 끊겨도 열립니다."
    : inAppBrowser() ? "카톡 같은 앱 안의 브라우저로 열었습니다. 메뉴에서 '다른 브라우저로 열기'를 누른 뒤 홈 화면에 추가하세요."
    : ios ? "사파리 아래쪽의 공유 단추를 누르고 '홈 화면에 추가'를 고르면 앱처럼 열립니다."
    : "";
  panel.hidden = !note;
  $("#installRow").hidden = !installEvt || standalone();
  $("#installNote").textContent = note;
}

/* =========================================================================
   이벤트
   ========================================================================= */
/** 검색 칸 — 한글은 한 글자에 input 이 두세 번(자모마다) 온다. 칠 때마다 그리지 않고 멈추면(150ms) 한 번,
    글자가 완성되거나(compositionend) Enter 면 바로 그린다. 값이 그대로면 다시 그리지 않는다. */
function searchBox(box, apply){
  let timer = 0, last = box.value;
  const run = () => {
    clearTimeout(timer);
    if (box.value === last) return;
    last = box.value;
    apply(last);
  };
  box.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 150); });
  box.addEventListener("compositionend", run);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) run(); });
}
function bind(){
  /* 탭 — 이미 보고 있는 탭을 다시 누르면 맨 위로 */
  $$(".tab").forEach((b) => b.addEventListener("click", () => {
    tapFeedback();
    if (b.dataset.view === view) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    else switchView(b.dataset.view);
  }));
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

  /* 처음 안내 카드의 "예시 치우기". 새 단추들은 옛 index.html 사본과 섞여 떠도 멈추지 않게 있을 때만 잇는다 */
  const drop = $("#dropSample");
  if (drop) drop.addEventListener("click", () => { board.seeded = true; save(); renderAll(); toast("예시를 치웠습니다."); });

  /* 홈 화면에 추가. 크롬이 스스로 띄우는 설치 안내는 막지 않는다 — 그걸 놓친 사람을 위한 단추다. */
  window.addEventListener("beforeinstallprompt", (e) => { installEvt = e; paintInstall(); });
  window.addEventListener("appinstalled", () => { installEvt = null; paintInstall(); toast("홈 화면에 추가했습니다."); });
  const inst = $("#installBtn");
  if (inst) inst.addEventListener("click", async () => {
    if (!installEvt) return;
    const ev = installEvt;
    installEvt = null;                      // 한 번 띄운 안내는 다시 못 쓴다
    try { await ev.prompt(); } catch (e) {}
    paintInstall();
  });
  /* 처음 보낸 뒤 한 번 뜨는 권유(homeTip). 방법은 주고받기 끝의 "홈 화면에 추가"에 있다 — 그리로 데려간다 */
  const tipGo = $("#homeTipGo");
  if (tipGo) {
    tipGo.addEventListener("click", () => {
      $("#homeTip").hidden = true;
      switchView("sync");
      const panel = $("#installPanel");
      panel.tabIndex = -1;                  // 읽는 프로그램도 그 자리로
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: "center" });
    });
    $("#homeTipX").addEventListener("click", () => { $("#homeTip").hidden = true; });
  }

  /* 큰 버튼 */
  $("#writeBtn").addEventListener("click", () => openCompose());
  /* 받은 링크 붙여넣기는 주고받기 탭 맨 위("받기")에 있다. 옛 index.html 사본에 남은 단추만 잇는다. */
  const recv = $("#recvBtn");
  if (recv) recv.addEventListener("click", () => {
    switchView("sync");
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });   // "받기"가 주고받기 맨 위에 있다
    setTimeout(() => $("#recvBox").focus(), 250);
  });
  /* 빈 보드의 안내 카드 — 쓰기, 또는 카톡에서 받은 글 붙여넣기(주고받기 맨 위 "받기" 칸).
     초점은 누른 그 자리에서 바로 준다 — 아이폰은 그래야 자판이 올라온다. */
  $("#feed").addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (!go) return;
    if (go.dataset.go === "write") { openCompose(); return; }
    switchView("sync");
    window.scrollTo(0, 0);
    $("#recvBox").focus();
  });
  /* 머리의 "지금 N건" — 1시간 안에 들어온 소식이 모인 속보 맨 위로 */
  $("#livePill").addEventListener("click", () => {
    const moved = view !== "feed";
    if (moved) switchView("feed");
    window.scrollTo({ top: 0, behavior: moved || reducedMotion() ? "auto" : "smooth" });
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
    feedShown = PAGE;                       // 거르개가 바뀌면 다시 앞의 60건부터
    $$("#catFilter [data-cat]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cat === flt.cat)));
    renderFeed();                           // 분야는 "지금 가기 좋은 곳"도 거른다
  });
  searchBox($("#q"), (v) => { flt.q = v; feedShown = PAGE; renderFeed(true); });
  $("#liveOnly").addEventListener("click", (e) => {
    flt.liveOnly = !flt.liveOnly;
    feedShown = PAGE;
    e.currentTarget.setAttribute("aria-pressed", String(flt.liveOnly));
    renderFeed();
  });
  /* 60건 더. 초점은 새로 나온 첫 카드로 — 키보드·읽는 프로그램이 거기서 이어 읽게 */
  $("#feed").addEventListener("click", (e) => {
    if (!e.target.closest("#feedMore")) return;
    const from = $$("#feed .card").length;
    feedShown = from + PAGE;
    keepFocus(() => renderFeed(true));
    const next = $$("#feed .card")[from], f = next && next.querySelector("[data-open]");
    if (f) f.focus({ preventScroll: true });
  });
  /* 속보는 늘 최신순이다(정렬은 장소 탭에). 옛 사본에 남은 정렬 칸만 잇는다. */
  const sortSel = $("#sort");
  if (sortSel) sortSel.addEventListener("change", (e) => { flt.sort = e.target.value; renderFeed(); });
  searchBox($("#pq"), (v) => { pflt.q = v; placesShown = PAGE; renderPlaces(); });
  $("#psort").addEventListener("change", (e) => { pflt.sort = e.target.value; placesShown = PAGE; renderPlaces(); });
  $("#places").addEventListener("click", (e) => {
    if (!e.target.closest("#placesMore")) return;
    const from = $$("#places .pl").length;
    placesShown = from + PAGE;
    keepFocus(renderPlaces);
    const next = $$("#places .pl")[from];
    if (next) next.focus({ preventScroll: true });
  });

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
    toast(board.me ? byline(board.me) + "으로 저장했습니다." : "이름을 비웠습니다.");
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
      pushSyncPlaces();
      renderAll();
      toast("그만 지켜봅니다.");
      return;
    }
    const pb = e.target.closest("[data-push]");
    if (pb) {
      const a = pb.dataset.push;
      if (a === "login") openBoardSheet();
      else if (a === "on") pushOn();
      else pushOff();
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
      /* 메모뿐인 카드면 그 장소의 가장 최근 현장 정보를 참고로 — 장소 창처럼 칩과 "그대로예요"가 보이게 */
      const g = r && !statChips(r).length ? groupOf(r) : null;
      if (r) { closeSheets(true); openCompose(g && g.stat ? g.stat : r); }
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
      const f = seg.dataset.f, v = f === "cat" ? seg.dataset.v : Number(seg.dataset.v);
      /* 분야는 늘 하나. 웨이팅·사람·주차는 고른 걸 다시 누르면 비운다(= 모름) */
      draft[f] = f !== "cat" && draft[f] === v ? -1 : v;
      if (f === "cat") byHand.cat = true;
      syncCompose();
      edited(f === "cat" ? "cat" : "live");
      return;
    }
    const tag = e.target.closest("[data-tag]");
    if (tag) {
      const t = tag.dataset.tag, i = draft.tags.indexOf(t);
      if (i === -1) {
        if (draft.tags.length >= 6) { toast("태그는 6개까지입니다."); return; }
        draft.tags.push(t);
      } else draft.tags.splice(i, 1);
      byHand.tags = true;
      syncCompose();
      edited("tags");
      return;
    }
    const st = e.target.closest("[data-star]");
    if (st) {
      const n = Number(st.dataset.star);
      draft.rate = draft.rate === n ? 0 : n;
      syncCompose();
      edited("rate");
      return;
    }
    /* 빈 칸 밑의 아는 곳 — 그 이름을 친 것과 같다(같은 이름이 여러 동네에 있어도 누른 그곳) */
    const sg = e.target.closest("[data-sug]");
    if (sg) {
      const g = groups().find((x) => x.key === sg.dataset.sug);
      if (!g) return;
      $("#fPlace").value = g.place;
      pickFor = norm(g.place); areaPick = g.key;
      $("#fSug").hidden = true;
      syncPlace();
      /* 누른 칩은 숨었다 — 초점을 다음 할 일로: 그대로예요, 옮길 값이 없으면 웨이팅 */
      (composeRef && statChips(composeRef).length ? $("#fRefSame") : $("#fWait [data-v]")).focus();
      edited("place");
      return;
    }
    /* "어느 동네예요?" — 고른 동네의 그곳으로. "다른 곳"이면 동네를 직접 적게 한다 */
    const pk = e.target.closest("[data-pick]");
    if (pk) {
      areaPick = pk.dataset.pick || "other";
      pickFor = norm($("#fPlace").value);
      syncPlace();
      if (areaPick === "other") { $("#fMore").open = true; $("#fArea").focus(); $("#fArea").select(); }
      edited("place");
    }
  });
  $("#fNote").addEventListener("input", (e) => { $("#noteCnt").textContent = e.target.value.length + "/200"; edited("note"); });
  /* 장소 이름을 치면 아는 곳인지 맞춰 본다 — 치는 동안(한글 조합 중에도)은 잠깐 기다렸다가, 칸을 떠나면 곧바로 */
  const placeSoon = () => { clearTimeout(placeTimer); placeTimer = setTimeout(() => { syncPlace(); keepDraft(); }, 250); };
  $("#fPlace").addEventListener("input", () => {
    const sug = $("#fSug");
    sug.hidden = !!$("#fPlace").value || !sug.childElementCount;   // 치기 시작하면 아는 곳 줄은 숨는다
    placeSoon();
    edited("place");
  });
  $("#fPlace").addEventListener("compositionend", placeSoon);
  $("#fPlace").addEventListener("change", () => { syncPlace(); keepDraft(); });
  /* 동네를 손으로 적으면 그 동네의 그곳만 찾는다 — 같은 이름이라도 다른 동네면 다른 장소다 */
  $("#fArea").addEventListener("input", () => { byHand.area = true; placeSoon(); edited("area"); });
  $("#fBy").addEventListener("input", () => edited("by"));
  $("#composeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (placeTimer) syncPlace();   // 치던 이름을 아직 안 맞춰 봤으면 지금 — 아는 곳이면 그 장소로 간다
    const place = clip($("#fPlace").value, 40);
    if (!place) {
      showErr("어디에 계신지 적어 주세요.", $("#fPlace"));
      return;
    }
    /* 아무것도 안 고르고 한 줄도 없으면 새 시각만 달린 빈 카드가 된다 — 막는다.
       "나도 여기"의 태그는 앞 리포트에서 옮겨 온 것이라 치지 않는다. */
    const said = draft.wait !== -1 || draft.crowd !== -1 || draft.park !== -1 || draft.rate || clip($("#fNote").value, 200);
    if (composeRef && !said) {
      const same = statChips(composeRef).length;
      showErr("지금 상황을 하나라도 고르거나 한 줄 남겨 주세요." + (same ? " 똑같으면 “그대로예요”." : ""),
        $("#fNow"), same ? $("#fRefSame") : $("#fNote"));
      return;
    }
    if (!composeRef && !said && !draft.tags.length) {
      showErr("지금 어떤지 하나라도 고르거나 한 줄 남겨 주세요.", $("#fNow"), $("#fWait [data-v]"));
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
    dropDraft();                   // 보냈다 — 붙잡아 둔 글은 이제 없다
    save();                        // 모자라면 save() 가 자리를 만들고, 끝내 안 되면 속보 맨 위에 경고를 남긴다
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
    window.scrollTo(0, 0);                  // 방금 쓴 리포트는 속보 맨 위에 있다
    renderAll();
    closeSheets(true);
    openShare([r], true);
    if (first) setTimeout(() => toast("예시를 치웠습니다. 이제 내 리포트와 받은 리포트만 보입니다."), 900);
  });

  /* 공유 */
  $("#shareCopy").addEventListener("click", async () => {
    if (!shareCache) return;
    const list = shareList;
    const ok = await copyText(shareCache);
    const st = $("#shareStatus");
    st.textContent = ok ? "복사했습니다. 단톡방에 붙여 넣으세요." : "복사가 막혔습니다. 위 글을 직접 긁어서 복사해 주세요.";
    st.className = "status " + (ok ? "ok" : "err");
    if (ok) markSent(list);
  });
  /* 폰의 공유 창으로 넘기고 나면 이 창은 할 일이 없다 — 닫는다. 카톡에서 취소했을 수도 있으니 "보냈다"고는 하지 않는다 */
  $("#shareNative").addEventListener("click", () => {
    if (!navigator.share || !shareCache) return;
    const list = shareList, seq = shareSeq;
    navigator.share({ text: shareCache }).then(() => {
      markSent(list);
      if (seq === shareSeq && $("#shareBack.open")) closeSheets();
      toast("공유 창으로 넘겼습니다.");
    }).catch(() => {});
  });
  $("#placeAgain").addEventListener("click", () => {
    const g = groups().find((x) => x.key === openPlaceKey);
    if (!g) return;
    closeSheets(true);
    /* 가장 최근 것이 메모뿐이면 그 앞의 현장 정보를 참고로 — 장소 창에 보이던 칩과 같게 */
    openCompose(g.stat || g.last);
  });
  $("#fRefSame").addEventListener("click", () => {
    if (!composeRef) return;
    draft.wait = composeRef.wait; draft.crowd = composeRef.crowd; draft.park = composeRef.park;
    syncCompose();
    edited("live");
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
      st.textContent = "붙여 넣은 내용에서 링크를 찾지 못했습니다. 눌러서 보기 → 로 시작하는 줄이 들어 있어야 합니다.";
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
      inboxHush();   // 링크 알림을 두고 여기서 받았으면 예시가 사라졌다 — 가려 둔 속보를 도로 편다
      st.textContent = res.added + "건을 받았습니다." + (res.dup ? " " + res.dup + "건은 이미 갖고 있어서 건너뛰었습니다." : "");
      st.className = "status ok";
      if (res.added) { $("#recvBox").value = ""; switchView("feed"); }
      if (wn) toast(wn);
    } catch(err) {
      /* unpack 은 우리말로 말한다. 붙여 넣은 글에서도 잘렸으면 글이 덜 복사된 것이다 */
      st.textContent = "받지 못했습니다: " + err.message +
        (err.cut ? " 받은 글을 끝까지 복사했는지 보고, 그래도 안 되면 보낸 사람에게 다시 보내 달라고 하세요." : "");
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
      bundleList = r.used;                  // 복사·공유하면 여기 담긴 내 글도 보낸 것이다
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
    const list = bundleList;
    const ok = await copyText($("#bundleBox").value);
    const st = $("#bundleStatus");
    st.textContent = ok ? "복사했습니다." : "복사가 막혔습니다. 직접 긁어서 복사해 주세요.";
    st.className = "status " + (ok ? "ok" : "err");
    if (ok) markSent(list);
  });
  $("#bundleShare").addEventListener("click", () => {
    const list = bundleList;
    if (navigator.share) navigator.share({ text: $("#bundleBox").value }).then(() => markSent(list)).catch(() => {});
  });

  /* 파일 */
  const warnSave = $("#storeWarnSave");   // 저장 공간이 모자랄 때 속보 맨 위의 경고 — 이 기기에 못 담은 것을 파일로 건진다
  if (warnSave) warnSave.addEventListener("click", () => $("#fileSave").click());
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
         map(sane) 으로 넘기면 배열 번호가 두 번째 인자(local)로 들어가 첫 줄 말고는 전부 믿어 버린다.
         백업은 링크보다 크다 — 링크 상한(MAX_REPORTS)으로 자르면 650건 백업이 400건만 돌아왔다. */
      const list = arr.slice(0, MAX_FILE).map((r) => sane(r)).filter(Boolean);
      const skip = arr.length - list.length;   // 상한을 넘었거나 읽을 수 없는 줄
      const before = board.reports.length;
      const res = merge(list);
      const cut = res.saved ? before + res.added - board.reports.length : 0;   // 자리가 모자라 save() 가 덜어 낸 것
      /* 지켜보는 곳은 내 설정이라 합친다 — 이미 있는 곳은 그대로 두고 없는 곳만 더한다. */
      const addW = raw && !Array.isArray(raw) ? saneWatch(raw.watch).filter((w) => !board.watch.some((x) => x.k === w.k)) : [];
      if (addW.length) { board.watch = board.watch.concat(addW).slice(0, WATCH_MAX); save(); }
      const wn = watchNews(res.fresh);
      renderAll();
      st.textContent = res.added + "건을 불러왔습니다." + (res.dup ? " " + res.dup + "건은 이미 있었습니다." : "") +
        (skip ? " " + skip + "건은 건너뛰었습니다" + (arr.length > MAX_FILE ? "(한 번에 " + MAX_FILE + "건까지)" : "(읽을 수 없는 줄)") + "." : "") +
        (addW.length ? " 지켜보는 곳 " + addW.length + "곳도 더했습니다." : "") +
        (!res.saved ? " 저장 공간이 부족해 이 기기에 저장하지 못했습니다 — 새로 고치면 사라집니다." :
         cut > 0 ? " 저장 공간이 모자라 오래된 리포트 " + cut + "건을 덜어 냈습니다." : "");
      st.className = "status " + (res.saved ? "ok" : "err");
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
    cursorMs = 0;                                    // 다른 동네 — 처음부터 전체로
    save();
    pushSyncPlaces();
    paintBoardBtn(); paintBoardKv();
    if (board.hood) { await boardRefresh(false); paintBoardKv(); }
  });
  $("#pullNow").addEventListener("click", async () => {
    if (!board.hood) { $("#boardStatus").textContent = "동네를 먼저 고르세요."; $("#boardStatus").className = "status err"; return; }
    $("#boardStatus").textContent = "받아오는 중…"; $("#boardStatus").className = "status";
    const res = await boardRefresh(true, true);
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

  window.addEventListener("hashchange", () => checkHash(true));
  window.addEventListener("popstate", sheetBack);
}

/* ---------------------------- 시작 ---------------------------- */
applyTheme(theme);
bind();
watchScroll();
sheetDrag();
paintInstall();
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

/* 폰 알림을 누르고 들어오면(?place=장소열쇠) 그 장소 창을 연다. 앱이 이미 열려 있으면 서비스 워커가 알려 준다. */
{
  const pk = new URLSearchParams(location.search).get("place");
  if (pk) {
    history.replaceState(null, "", location.pathname + location.hash);
    setTimeout(() => openPlaceByKey(norm(pk).slice(0, 40)), 60);
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "open-place") return;
    const key = norm(e.data.key).slice(0, 40);
    if (!openPlaceByKey(key) && SY.enabled) boardRefresh(true).then(() => openPlaceByKey(key));
  });
}

/* 홈 화면 아이콘을 길게 눌러 "리포트 보내기"로 들어오면 바로 쓰기 창을 연다 (manifest 의 shortcuts). */
if (new URLSearchParams(location.search).get("write") === "1") {
  history.replaceState(null, "", location.pathname + location.hash);
  setTimeout(() => openCompose(), 50);
}

window.addEventListener("offline", renderTicker);
window.addEventListener("online", () => { renderTicker(); if (SY.enabled) boardRefresh(true); });

/* 다른 탭(홈 화면 앱과, 카톡 링크로 연 크롬 창 같은)이 보드를 저장하면 이 탭도 다시 읽는다.
   탭마다 보드를 통째로 쥐고 있다가 통째로 쓰므로, 안 그러면 이 탭이 다음에 저장할 때 저쪽에서 쓴 리포트를 지운다.
   합치지 않고 다시 읽기만 한다 — 저쪽에서 지운 리포트가 되살아나면 안 된다. */
window.addEventListener("storage", (e) => {
  if (e.key !== KEY && e.key !== null) return;   // null — 누군가 저장소를 통째로 비웠다
  const hood = board.hood, carry = unsaved;
  Object.assign(board, readBoard());
  /* 저장 공간이 모자라 이 탭에서 끝내 못 담은 리포트는 들고 가서 다시 담아 본다.
     저장소에 간 적이 없으니 저쪽에서 지운 것일 수 없다 */
  if (carry.length) {
    const have = new Set(board.reports.map((r) => r.id));
    board.reports = board.reports.concat(carry.filter((r) => !have.has(r.id))).sort((a, c) => c.t - a.t);
    save();
  }
  if (board.hood !== hood) { cursorMs = 0; paintBoardBtn(); }   // 저쪽에서 동네를 바꿨다 — 처음부터 받아온다
  renderAll();
});

/* 오프라인에서도 열리게. 보안 출처(https·localhost)에서만 등록된다.
   워커 주소에는 index.html 이 이 app.js 를 부른 버전(app.js?v=H)을 그대로 싣는다 — 워커는 H 로 캐시 이름을 짓고
   그 판의 파일만 캐시에서 먼저 꺼낸다. 버전이 없으면(버전 없는 옛 index.html 사본에서 떴다) 등록하지 않는다. */
{
  const v = document.currentScript ? new URL(document.currentScript.src, location.href).searchParams.get("v") : "";
  if (v && "serviceWorker" in navigator &&
      (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js?v=" + encodeURIComponent(v)).catch(() => {});
  }
}

if (SY.enabled) {
  SY.listHoods().then((h) => { hoods = h || []; paintBoardBtn(); }).catch(() => {});
  if (board.hood) boardRefresh(true);   // 올리기 전에 ensureProfile 이 프로필을 챙긴다
  /* 속보는 금방 상한다. 3분마다 조용히 받아온다 — 평소엔 새 글만, 30분마다 전체 대조(syncPull). */
  setInterval(() => { if (!document.hidden) boardRefresh(true); }, 3 * 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) boardRefresh(true); });
}
/* 시간이 흐르면 "몇 분 전"과 신선도가 달라진다 — 1분마다 다시 그린다. 그래도 헛일은 하지 않는다:
   안 보이는 탭(다른 앱·꺼진 화면)에서는 쉬고, 시트가 열려 있으면 그 뒤는 그리지 않고, 보고 있는 화면만 그린다.
   못 그린 것은 묵었다고 적어 두었다가 보이게 되면(탭을 옮기거나 시트를 닫거나 앱으로 돌아오면) 그린다.
   다시 그려도 초점과 펼쳐 둔 "현장 정보"는 그대로다. */
function minuteRefresh(){
  stale.ticker = stale.feed = stale.places = true;
  freshen();
}
/** 묵은 것 가운데 지금 보이는 것만 그린다. */
function freshen(){
  if (document.hidden || $(".backdrop.open")) return;
  redraw(() => {
    if (stale.ticker) { stale.ticker = false; renderTicker(); }
    if (view === "feed" && stale.feed) { stale.feed = false; renderFeed(); }
    if (view === "places" && stale.places) { stale.places = false; renderPlaces(); }
  });
}
setInterval(minuteRefresh, 60e3);
document.addEventListener("visibilitychange", freshen);
