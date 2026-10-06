-- ============================================================================
-- 동네 특파원 — 공용 보드 스키마 (PostgreSQL / Supabase)
--
-- 설계 전제 세 가지
--   1. 링크로 받은 리포트는 서버에 올리지 않는다. 내가 쓴 것만 올라간다.
--      남이 쓴 글을 내 계정으로 올리면 작성자가 세탁된다.
--   2. id 는 앱이 만든다(링크와 같은 8자). 그래야 링크로 받은 것과 서버에서
--      받은 것이 같은 리포트로 합쳐진다. 기본키라 남의 id 를 덮어쓸 수 없다.
--   3. 위치(GPS)를 받지 않는다. 동네는 사람이 고른다.
--      좌표를 받는 순간 위치기반서비스사업 신고 대상이 된다 — SETUP.md 참고.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────── 동네 ───────────────────────────
create table if not exists hoods (
  code      text primary key,               -- 법정동코드 10자리
  sido      text not null,                  -- 경기도
  sigungu   text not null,                  -- 안양시 만안구
  dong      text not null,                  -- 안양동
  label     text generated always as (sigungu || ' ' || dong) stored,
  active    boolean not null default true,  -- 아직 안 연 동네는 false
  created_at timestamptz not null default now()
);
create index if not exists hoods_active_idx on hoods (active) where active;

-- ─────────────────────────── 특파원 ───────────────────────────
-- auth.users 를 그대로 쓰지 않고 표시용 프로필을 따로 둔다.
-- 이름은 바뀔 수 있지만 리포트에 박힌 이름은 그때 그대로 남아야 한다.
--
-- 로그인 계정이 지워지면 프로필 → 리포트 → 신고가 줄줄이 지워진다(on delete cascade).
-- 앱의 "계정 삭제"로 지우든 Supabase 관리 화면에서 지우든 결과가 같아야 한다.
create table if not exists correspondents (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 20),
  hood_code   text references hoods (code),
  banned_until timestamptz,                 -- 도배·악성으로 묶인 상태
  created_at  timestamptz not null default now()
);

-- ─────────────────────────── 리포트 ───────────────────────────
create table if not exists reports (
  id        text primary key check (id ~ '^[A-Za-z0-9_-]{1,24}$'),
  author    uuid not null references correspondents (id) on delete cascade,
  by_name   text not null check (length(by_name) between 1 and 20),  -- 쓸 때의 이름(스냅샷)
  t         timestamptz not null,
  hood_code text not null references hoods (code),

  cat   text not null check (cat in ('play','food','cafe','trip','etc')),
  place text not null check (length(place) between 1 and 40),
  area  text not null default '' check (length(area) <= 30),
  wait  smallint not null default -1 check (wait  in (-1, 0, 10, 30, 60)),
  crowd smallint not null default -1 check (crowd in (-1, 0, 1, 2, 3)),
  park  smallint not null default -1 check (park  in (-1, 0, 1, 2, 3)),
  rate  smallint not null default 0  check (rate between 0 and 5),
  tags  text[]  not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 6),
  note  text    not null default '' check (length(note) <= 200),

  -- 앱의 묶음 규칙을 서버에도 그대로 둔다. 장소 목록을 서버에서 만들 수 있어야 한다.
  place_key text generated always as (lower(regexp_replace(place, '\s', '', 'g'))) stored,

  hidden     boolean not null default false,  -- 신고 누적으로 가려짐
  flag_count smallint not null default 0,      -- 기각되지 않은 신고 수
  reviewed_at timestamptz,                     -- 운영자가 마지막으로 보고 정한 때 (admin.sql)
  held_until  timestamptz,                     -- 임시조치(권리침해 신고)가 끝나는 때 — 최대 30일
  created_at timestamptz not null default now()
);

-- 속보 피드: 동네 + 최신순. 가려진 것은 인덱스에서도 뺀다.
create index if not exists reports_feed_idx on reports (hood_code, t desc) where not hidden;
create index if not exists reports_author_idx on reports (author, t desc);
create index if not exists reports_place_idx on reports (hood_code, place_key, t desc) where not hidden;
-- 평소 받아오기: 동네 + 서버에 들어온 시각. 3분마다 "이 뒤로 새로 들어온 것"만 묻는다
create index if not exists reports_new_idx on reports (hood_code, created_at);
-- 운영자 대기열: 신고가 있거나 가려졌거나 임시조치 중인 것만
create index if not exists reports_mod_idx on reports (t desc) where flag_count > 0 or hidden or held_until is not null;

-- ─────────────────────────── 신고 ───────────────────────────
create table if not exists flags (
  report_id  text not null references reports (id) on delete cascade,
  reporter   uuid not null references correspondents (id) on delete cascade,
  reason     text not null check (reason in ('거짓','광고','욕설','사생활','기타')),
  dismissed  boolean not null default false,  -- 운영자가 기각한 신고. 수에는 안 들지만 행은 남아서
                                             -- 같은 사람이 같은 글을 다시 신고하지 못한다 (괴롭힘 되풀이 막기)
  created_at timestamptz not null default now(),
  primary key (report_id, reporter)          -- 한 사람이 한 번만
);
