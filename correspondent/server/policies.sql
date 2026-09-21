-- ============================================================================
-- 권한 — 읽기는 누구나, 쓰기는 로그인한 사람이 자기 것만.
--
-- 클라이언트가 보낸 값을 믿지 않는 곳이 두 군데다.
--   · author  — 토큰의 주인으로 덮어쓴다. 남의 이름으로 못 쓴다.
--   · by_name — 프로필에서 가져온다. 사칭을 막는다.
-- ============================================================================

-- ─────────────────── 쓸 때 서버가 다시 채우는 값 ───────────────────
create or replace function public.stamp_report() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  prof correspondents%rowtype;
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select * into prof from correspondents where id = me;
  if not found then
    raise exception '특파원 등록이 먼저입니다' using errcode = '42501';
  end if;
  if prof.banned_until is not null and prof.banned_until > now() then
    raise exception '지금은 리포트를 보낼 수 없습니다' using errcode = '42501';
  end if;

  new.author  := me;           -- 클라이언트가 뭘 보냈든 토큰의 주인으로
  new.by_name := prof.name;    -- 이름도 프로필에서. 사칭 불가
  new.hidden  := false;        -- 가림 상태는 신고로만 바뀐다
  new.flag_count := 0;

  -- 시각은 앱이 보내지만(오프라인에서 쓴 것이 나중에 올라온다) 범위는 서버가 잡는다
  if new.t > now() + interval '10 minutes' then
    new.t := now();
  elsif new.t < now() - interval '7 days' then
    raise exception '너무 오래된 리포트입니다' using errcode = '22007';
  end if;

  return new;
end $$;

drop trigger if exists stamp_report on reports;
create trigger stamp_report before insert on reports
  for each row execute function public.stamp_report();

-- ─────────────────── 도배 막기 ───────────────────
-- RLS 정책 안에서 같은 표를 세면 정책이 자기를 다시 부른다. definer 함수로 뺀다.
create or replace function public.under_report_limit() returns boolean
language sql security definer stable set search_path = public, auth as $$
  select count(*) filter (where created_at > now() - interval '1 hour') < 20
     and count(*) filter (where created_at > now() - interval '1 day')  < 60
    from reports where author = auth.uid()
$$;

create or replace function public.under_flag_limit() returns boolean
language sql security definer stable set search_path = public, auth as $$
  select count(*) < 20 from flags
   where reporter = auth.uid() and created_at > now() - interval '1 day'
$$;

-- ─────────────────── 신고가 쌓이면 가린다 ───────────────────
create or replace function public.apply_flag() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from flags where report_id = new.report_id;
  update reports set flag_count = n, hidden = (n >= 3) where id = new.report_id;
  return new;
end $$;

drop trigger if exists apply_flag on flags;
create trigger apply_flag after insert on flags
  for each row execute function public.apply_flag();

-- 자기 글은 신고 못 한다
create or replace function public.not_own_report(rid text) returns boolean
language sql security definer stable set search_path = public, auth as $$
  select exists (select 1 from reports where id = rid and author <> auth.uid())
$$;

-- ─────────────────── 이 리포트가 내 것인가 ───────────────────
-- PostgREST 의 계산 컬럼. ?select=...,mine 으로 딸려 온다.
-- author(uuid) 를 그대로 내보내지 않는 이유: 그러면 이름을 바꿔도 같은 사람이라는 게 드러난다.
-- 필요한 건 "이게 내 글인가" 한 가지뿐이라 참/거짓만 내보낸다.
create or replace function public.mine(reports) returns boolean
language sql stable set search_path = public, auth as $$
  select $1.author = auth.uid()
$$;

-- ─────────────────── RLS ───────────────────
alter table hoods          enable row level security;
alter table correspondents enable row level security;
alter table reports        enable row level security;
alter table flags          enable row level security;

drop policy if exists hoods_read on hoods;
create policy hoods_read on hoods for select to anon, authenticated using (active);

-- 프로필은 본인만 본다. 화면에 뜨는 이름은 reports.by_name 에 박혀 있다.
drop policy if exists me_read   on correspondents;
drop policy if exists me_write  on correspondents;
drop policy if exists me_update on correspondents;
create policy me_read   on correspondents for select to authenticated using (id = auth.uid());
create policy me_write  on correspondents for insert to authenticated with check (id = auth.uid());
create policy me_update on correspondents for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- banned_until 은 정책으로 못 막는다. WITH CHECK 안의 컬럼 이름은 새 행을 가리켜서
-- "banned_until = banned_until" 같은 비교는 늘 참이 된다. 그래서 컬럼 권한으로 뺀다 —
-- 정지된 사람이 자기 정지를 푸는 길을 막는 건 grant 쪽 일이다.

-- 속보는 누구나 읽는다. 가려진 것은 안 보인다.
drop policy if exists reports_read   on reports;
drop policy if exists reports_write  on reports;
drop policy if exists reports_delete on reports;
create policy reports_read on reports for select to anon, authenticated using (not hidden);
create policy reports_write on reports for insert to authenticated
  with check (author = auth.uid() and public.under_report_limit());
-- 고치기(update)는 정책을 두지 않는다. 리포트는 고치는 게 아니라 다시 쓰는 것이다.
create policy reports_delete on reports for delete to authenticated using (author = auth.uid());

drop policy if exists flags_read   on flags;
drop policy if exists flags_write  on flags;
drop policy if exists flags_delete on flags;
create policy flags_read  on flags for select to authenticated using (reporter = auth.uid());
create policy flags_write on flags for insert to authenticated
  with check (reporter = auth.uid() and public.under_flag_limit() and public.not_own_report(report_id));
create policy flags_delete on flags for delete to authenticated using (reporter = auth.uid());

-- ─────────────────── PostgREST 가 쓸 권한 ───────────────────
grant usage on schema public to anon, authenticated;
grant select on hoods to anon, authenticated;
grant select on reports to anon, authenticated;
grant insert, delete on reports to authenticated;
grant select, insert on correspondents to authenticated;
grant update (name, hood_code) on correspondents to authenticated;   -- banned_until 은 뺀다
grant select, insert, delete on flags to authenticated;
grant execute on function public.under_report_limit, public.under_flag_limit, public.not_own_report to authenticated;
grant execute on function public.mine(reports) to anon, authenticated;
