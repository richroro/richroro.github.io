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
-- 운영자가 기각한 신고(dismissed)는 세지 않는다. 그리고 신고로는 가리기만 하고 **풀지는 않는다** —
-- 운영자가 신고 하나짜리 글을 가려 두었는데 새 신고가 들어오며 (n >= 3) 이 거짓이 되어 되살아나면 안 된다.
create or replace function public.apply_flag() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from flags where report_id = new.report_id and not dismissed;
  update reports set flag_count = n, hidden = (hidden or n >= 3) where id = new.report_id;
  return new;
end $$;

drop trigger if exists apply_flag on flags;
create trigger apply_flag after insert on flags
  for each row execute function public.apply_flag();

-- 신고가 사라질 때(신고한 사람이 탈퇴하거나 취소할 때) 수를 다시 센다.
-- 가림은 풀지 않는다. 한 번 가려진 글을 되살리는 건 사람이 보고 정할 일이다 —
-- 안 그러면 신고 셋이 모였다가 하나가 빠지는 순간 글이 다시 뜬다.
create or replace function public.recount_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from flags where report_id = old.report_id and not dismissed;
  update reports set flag_count = n where id = old.report_id;
  return old;
end $$;

drop trigger if exists recount_flags on flags;
create trigger recount_flags after delete on flags
  for each row execute function public.recount_flags();

-- ─────────────────── 프로필 저장 ───────────────────
-- 프로필은 이 함수로만 쓴다. 표에 직접 insert/update 권한을 주지 않는다.
--
-- PostgREST 의 upsert(resolution=merge-duplicates)는 ON CONFLICT DO UPDATE SET 에
-- 보낸 컬럼을 전부 넣는다 — id 까지. 정지를 못 풀게 하려고 name·hood_code 만 update 를
-- 허용해 두면 upsert 가 id 때문에 권한 거부로 떨어진다. 함수로 빼면 둘 다 해결된다:
-- 누가 부르든 자기 행만, 이름과 동네만 바꾼다. banned_until 은 손댈 길이 없다.
create or replace function public.save_profile(p_name text, p_hood text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  insert into correspondents (id, name, hood_code) values (me, p_name, nullif(p_hood, ''))
  on conflict (id) do update set name = excluded.name, hood_code = excluded.hood_code;
end $$;

-- ─────────────────── 계정 삭제 ───────────────────
-- 로그인 계정(auth.users)은 anon 키로는 못 지운다. definer 함수가 토큰 주인의 것만 지운다.
-- 계정이 지워지면 외래키를 따라 프로필 → 리포트 → 신고가 함께 사라진다.
-- 남의 글에 한 신고도 함께 지워지고, 그 글의 신고 수는 위 트리거가 다시 센다.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end $$;

-- 신고한 사람도 서버가 채운다. 앱은 reporter 를 비워서(null) 보낸다 —
-- 리포트의 author 와 같은 원리다. 이게 없으면 NOT NULL 에 걸려 신고가 아예 안 되고,
-- 남의 uuid 를 적어 보내 그 사람이 신고한 것처럼 꾸밀 수도 있다.
create or replace function public.stamp_flag() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  -- 정지된 사람은 신고도 못 한다. 글쓰기만 막으면 신고로 남의 글을 가리는 쪽으로 옮겨 간다.
  if exists (select 1 from correspondents where id = auth.uid() and banned_until > now()) then
    raise exception '지금은 신고할 수 없습니다' using errcode = '42501';
  end if;
  new.reporter := auth.uid();
  return new;
end $$;

drop trigger if exists stamp_flag on flags;
create trigger stamp_flag before insert on flags
  for each row execute function public.stamp_flag();

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
create policy me_read on correspondents for select to authenticated using (id = auth.uid());
-- 쓰기 정책은 두지 않는다. 쓰기는 save_profile() 로만 한다(위 설명).
-- 참고로 정책으로는 정지 풀기를 못 막는다 — WITH CHECK 안의 컬럼 이름은 새 행을 가리켜서
-- "banned_until = banned_until" 같은 비교는 늘 참이다. 처음에 그렇게 짰다가 구멍이었다.

-- 속보는 누구나 읽는다. 가려진 것은 안 보인다.
drop policy if exists reports_read     on reports;
drop policy if exists reports_read_own on reports;
drop policy if exists reports_write    on reports;
drop policy if exists reports_delete   on reports;
create policy reports_read on reports for select to anon, authenticated using (not hidden);
-- 가려진 글도 쓴 사람에게는 보인다. 이게 없으면 자기 글을 못 지운다 —
-- DELETE ... WHERE 는 읽기 정책도 함께 통과해야 해서, 안 보이는 행은 0건 삭제로 조용히 끝난다.
-- 잘못 신고당한 사람이 자기 글을 치울 길이 막히고, 처리방침의 "작성자가 지울 때까지"도 거짓이 된다.
create policy reports_read_own on reports for select to authenticated using (author = auth.uid());
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
grant select on correspondents to authenticated;
revoke insert, update, delete on correspondents from authenticated;  -- 쓰기는 save_profile() 로만
grant select, insert, delete on flags to authenticated;
-- 함수는 기본으로 PUBLIC 이 실행할 수 있고, Supabase 는 anon·authenticated 에도 기본으로 준다.
-- 전부 걷은 뒤 필요한 곳에만 다시 준다. 특히 delete_my_account 는 로그인한 사람만.
revoke execute on function public.under_report_limit(), public.under_flag_limit(),
  public.not_own_report(text), public.delete_my_account(), public.save_profile(text, text)
  from public, anon, authenticated;
grant execute on function public.under_report_limit(), public.under_flag_limit(),
  public.not_own_report(text), public.delete_my_account(), public.save_profile(text, text)
  to authenticated;
grant execute on function public.mine(reports) to anon, authenticated;
