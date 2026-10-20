-- ============================================================================
-- 운영자 — 신고를 사람이 보고 정한다. (schema.sql · policies.sql 다음에 실행)
--
-- 신고 셋이면 글은 저절로 가려진다(policies.sql). 되살릴지, 가린 채 둘지, 지울지,
-- 쓴 사람을 묶을지는 사람이 정할 일이다. 이 파일이 그 일을 하는 함수와 기록을 둔다.
--
--   · 운영자는 admins 표 하나로 정한다. 넣고 빼는 건 SQL 편집기에서만 한다 — API 로는 길이 없다.
--       insert into admins (id, note) values ('<계정 번호>', '운영자 이름');
--     계정 번호는 운영 화면(admin.html)에 로그인하면 보인다.
--   · 운영자의 일은 전부 아래 함수로만 한다. 함수마다 처리 기록(mod_log)을 남긴다.
--     표를 직접 고치는 길을 열어 두면 기록 없이 고칠 수 있다.
--   · 기록에는 처리할 때의 글 사본이 남는다(분쟁이 생기면 무엇을 왜 치웠는지 보여야 한다).
--     1년 뒤 retention.sql 이 지운다 — 처리방침 4조.
--
-- 임시조치: 권리침해 신고(명예훼손·사생활 침해)가 들어오면 판단이 설 때까지 최대 30일
-- 가린다(정보통신망법 44조의2). 30일이 지나면 대기열에 다시 올라와 사람이 정한다.
-- ============================================================================

-- 이미 설치한 DB 를 올릴 때 (새로 설치하면 schema.sql 에 이미 있다)
alter table reports add column if not exists reviewed_at timestamptz;
alter table reports add column if not exists held_until  timestamptz;
alter table flags   add column if not exists dismissed   boolean not null default false;
create index if not exists reports_mod_idx on reports (t desc) where flag_count > 0 or hidden or held_until is not null;

create table if not exists admins (
  id       uuid primary key references auth.users (id) on delete cascade,
  note     text not null default '',
  added_at timestamptz not null default now()
);

create table if not exists mod_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  admin     uuid references auth.users (id) on delete set null,   -- 운영자가 떠나도 기록은 남는다
  action    text not null check (action in ('restore', 'hide', 'hold', 'delete', 'ban', 'unban')),
  report_id text,          -- 외래키를 걸지 않는다: 글을 지운 뒤에도 기록은 남아야 한다
  target    uuid,          -- 대상 특파원. 같은 까닭으로 외래키 없음
  note      text not null default '' check (length(note) <= 500),
  snapshot  jsonb          -- 처리할 때의 글(또는 정지 기간)
);
create index if not exists mod_log_at_idx     on mod_log (at desc);
create index if not exists mod_log_target_idx on mod_log (target, at desc);
create index if not exists mod_log_report_idx on mod_log (report_id, at desc);

-- 정책을 하나도 두지 않는다 → anon·authenticated 는 두 표를 전혀 못 본다. 읽기·쓰기는 함수로만.
alter table admins  enable row level security;
alter table mod_log enable row level security;
revoke all on admins, mod_log from anon, authenticated;
revoke all on sequence mod_log_id_seq from anon, authenticated;

-- ─────────────────── 누가 운영자인가 ───────────────────
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public, auth as $$
  select exists (select 1 from admins where id = auth.uid())
$$;

create or replace function public.admin_guard() returns uuid
language plpgsql security definer stable set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from admins where id = me) then
    raise exception '운영자만 할 수 있습니다' using errcode = '42501';
  end if;
  return me;
end $$;

-- ─────────────────── 대기열에 올라오는 것 ───────────────────
--   · 아직 아무도 안 본 것 중 신고가 있거나 가려진 것
--   · 보고 정한 뒤에 새 신고가 들어온 것
--   · 임시조치 30일이 끝나서 결정이 필요한 것
create or replace function public.in_queue(r reports) returns boolean
language sql stable set search_path = public as $$
  select (r.reviewed_at is null and (r.flag_count > 0 or r.hidden))
      or (r.held_until is not null and r.held_until <= now())
      or (r.reviewed_at is not null and exists (
            select 1 from flags f where f.report_id = r.id and not f.dismissed and f.created_at > r.reviewed_at))
$$;

-- 운영자가 보는 글 한 건. 신고한 사람(reporter)도 보인다 — 늘 같은 사람들이 함께 신고하면 떼 신고다.
create or replace function public.admin_report_json(r reports) returns jsonb
language sql stable security definer set search_path = public as $$
  select (to_jsonb(r) - 'place_key') || jsonb_build_object(
    'hood', (select label from hoods where code = r.hood_code),
    'flags', coalesce((select jsonb_agg(jsonb_build_object(
                 'reason', f.reason, 'at', f.created_at, 'dismissed', f.dismissed, 'reporter', f.reporter)
                 order by f.created_at)
               from flags f where f.report_id = r.id), '[]'::jsonb))
$$;

create or replace function public.admin_queue(p_limit int default 50) returns jsonb
language plpgsql security definer stable set search_path = public, auth as $$
begin
  perform public.admin_guard();
  return coalesce((
    select jsonb_agg(public.admin_report_json(x.rep) || jsonb_build_object(
             'why', case when (x.rep).held_until is not null and (x.rep).held_until <= now() then 'hold_over'
                         when (x.rep).reviewed_at is not null then 'new_flags'
                         when (x.rep).hidden then 'hidden'
                         else 'flagged' end,
             'author_reports', (select count(*) from reports a where a.author = (x.rep).author),
             'author_hidden',  (select count(*) from reports a where a.author = (x.rep).author and a.hidden),
             'author_banned_until', (select c.banned_until from correspondents c where c.id = (x.rep).author))
           order by x.ord)
      from (select q as rep, row_number() over (
                     order by (q.held_until is not null and q.held_until <= now()) desc,
                              q.hidden desc, q.flag_count desc, q.t desc) as ord
              from reports q
             where (q.flag_count > 0 or q.hidden or q.held_until is not null)   -- reports_mod_idx
               and public.in_queue(q)
             order by ord
             limit greatest(1, least(coalesce(p_limit, 50), 200))) x
  ), '[]'::jsonb);
end $$;

-- ─────────────────── 글 한 건 처리 ───────────────────
--   restore  문제없음 — 되살리고 지금까지의 신고를 기각한다
--   hide     가린 채 둔다
--   hold     임시조치 — 30일 가리고, 끝나면 대기열로 돌아온다. 메모(누가 무엇 때문에)가 있어야 한다
--   delete   지운다. 되돌릴 수 없다. 기록의 사본만 1년 남는다. 사유가 있어야 한다
create or replace function public.admin_act(p_report text, p_action text, p_note text default '') returns jsonb
language plpgsql security definer volatile set search_path = public, auth as $$
declare
  me uuid := public.admin_guard();
  r reports%rowtype;
  note text := left(btrim(coalesce(p_note, '')), 500);
begin
  if p_action is null or p_action not in ('restore', 'hide', 'hold', 'delete') then
    raise exception '모르는 처리입니다: %', p_action using errcode = '22023';
  end if;
  if p_action = 'hold' and note = '' then
    raise exception '임시조치는 누가 무엇 때문에 요청했는지 메모로 남겨야 합니다' using errcode = '22023';
  end if;
  if p_action = 'delete' and note = '' then
    raise exception '지우기는 사유를 남겨야 합니다 — 이의 신청이 오면 이 사유로 답합니다' using errcode = '22023';
  end if;
  select * into r from reports where id = p_report for update;
  if not found then
    raise exception '없는 리포트입니다' using errcode = 'P0002';
  end if;

  insert into mod_log (admin, action, report_id, target, note, snapshot)
    values (me, p_action, r.id, r.author, note, public.admin_report_json(r));

  if p_action = 'restore' then
    update flags set dismissed = true where report_id = r.id and not dismissed;
    update reports set hidden = false, flag_count = 0, held_until = null, reviewed_at = now() where id = r.id;
  elsif p_action = 'hide' then
    update reports set hidden = true, held_until = null, reviewed_at = now() where id = r.id;
  elsif p_action = 'hold' then
    update reports set hidden = true, held_until = now() + interval '30 days', reviewed_at = now() where id = r.id;
  else
    delete from reports where id = r.id;
    return jsonb_build_object('id', r.id, 'deleted', true);
  end if;

  select * into r from reports where id = p_report;
  return public.admin_report_json(r);
end $$;

-- ─────────────────── 쓴 사람 묶기 ───────────────────
-- p_days = 0 이면 푼다. 36500 은 사실상 영구. 묶을 때는 사유가 있어야 한다.
-- 운영자는 묶을 수 없다(실수로 서로를 잠그지 않게).
create or replace function public.admin_ban(p_user uuid, p_days int, p_note text default '') returns jsonb
language plpgsql security definer volatile set search_path = public, auth as $$
declare
  me uuid := public.admin_guard();
  until timestamptz;
begin
  if p_days is null or p_days < 0 or p_days > 36500 then
    raise exception '정지 기간은 0(풀기)부터 36500일까지입니다' using errcode = '22023';
  end if;
  if exists (select 1 from admins where id = p_user) then
    raise exception '운영자는 정지할 수 없습니다' using errcode = '42501';
  end if;
  if p_days > 0 and btrim(coalesce(p_note, '')) = '' then
    raise exception '정지는 사유를 남겨야 합니다 — 이의 신청이 오면 이 사유로 답합니다' using errcode = '22023';
  end if;
  until := case when p_days = 0 then null else now() + make_interval(days => p_days) end;
  update correspondents set banned_until = until where id = p_user;
  if not found then
    raise exception '없는 특파원입니다' using errcode = 'P0002';
  end if;
  insert into mod_log (admin, action, target, note, snapshot)
    values (me, case when p_days = 0 then 'unban' else 'ban' end, p_user, left(btrim(coalesce(p_note, '')), 500),
            jsonb_build_object('days', p_days, 'until', until));
  return jsonb_build_object('id', p_user, 'banned_until', until);
end $$;

-- ─────────────────── 보기 ───────────────────
create or replace function public.admin_user(p_user uuid) returns jsonb
language plpgsql security definer stable set search_path = public, auth as $$
declare c correspondents%rowtype;
begin
  perform public.admin_guard();
  select * into c from correspondents where id = p_user;
  if not found then
    raise exception '없는 특파원입니다' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', c.id, 'name', c.name, 'hood', (select label from hoods where code = c.hood_code),
    'banned_until', c.banned_until, 'created_at', c.created_at,
    'is_admin', exists (select 1 from admins where id = c.id),
    'report_count', (select count(*) from reports where author = c.id),
    'hidden_count', (select count(*) from reports where author = c.id and hidden),
    'flags_made', (select count(*) from flags where reporter = c.id),
    'flags_made_dismissed', (select count(*) from flags where reporter = c.id and dismissed),
    'reports', coalesce((select jsonb_agg(public.admin_report_json(r) order by r.t desc)
                           from (select * from reports where author = c.id order by t desc limit 50) r), '[]'::jsonb),
    'log', coalesce((select jsonb_agg((to_jsonb(l) - 'snapshot') order by l.at desc)
                       from (select * from mod_log where target = c.id order by at desc limit 50) l), '[]'::jsonb));
end $$;

-- 권리침해 신고는 대개 "어느 가게에 대해 언제쯤 쓴 글" 로 온다. 장소·이름·메모·id·특파원 번호로 찾는다.
create or replace function public.admin_find(p_q text, p_limit int default 50) returns jsonb
language plpgsql security definer stable set search_path = public, auth as $$
declare
  q text := btrim(coalesce(p_q, ''));
  pat text;
begin
  perform public.admin_guard();
  if q = '' then return '[]'::jsonb; end if;
  pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(public.admin_report_json(r) order by r.t desc) from (
    select * from reports r
     where r.id = q or r.author::text = q or r.by_name = q
        or r.place ilike pat or r.note ilike pat
     order by r.t desc
     limit greatest(1, least(coalesce(p_limit, 50), 200))) r), '[]'::jsonb);
end $$;

create or replace function public.admin_log(p_limit int default 100) returns jsonb
language plpgsql security definer stable set search_path = public, auth as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg((to_jsonb(l) - 'snapshot') || jsonb_build_object(
             'place', l.snapshot ->> 'place', 'by_name', l.snapshot ->> 'by_name',
             'target_name', (select name from correspondents c where c.id = l.target))
           order by l.at desc)
      from (select * from mod_log order by at desc limit greatest(1, least(coalesce(p_limit, 100), 500))) l), '[]'::jsonb);
end $$;

-- ─────────────────── 숫자 ───────────────────
-- 하루는 서울 기준으로 자른다. 따로 모으는 건 없다 — 이미 있는 표를 셀 뿐이다.
create or replace function public.admin_stats(p_days int default 14) returns jsonb
language plpgsql security definer stable set search_path = public, auth as $$
declare n int := greatest(1, least(coalesce(p_days, 14), 90));
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'people',    (select count(*) from correspondents),
      'active_7d', (select count(distinct author) from reports where created_at > now() - interval '7 days'),
      'reports',   (select count(*) from reports),
      'hidden',    (select count(*) from reports where hidden),
      'queue',     (select count(*) from reports q where (q.flag_count > 0 or q.hidden or q.held_until is not null) and public.in_queue(q)),
      'banned',    (select count(*) from correspondents where banned_until > now())),
    'days', (select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'reports',    (select count(*) from reports r where r.created_at >= d.a and r.created_at < d.b),
               'authors',    (select count(distinct r.author) from reports r where r.created_at >= d.a and r.created_at < d.b),
               'new_people', (select count(*) from correspondents c where c.created_at >= d.a and c.created_at < d.b),
               'flags',      (select count(*) from flags f where f.created_at >= d.a and f.created_at < d.b),
               'actions',    (select count(*) from mod_log l where l.at >= d.a and l.at < d.b))
             order by d.day desc)
             from (select g::date as day, (g at time zone 'Asia/Seoul') as a, ((g + interval '1 day') at time zone 'Asia/Seoul') as b
                     from generate_series(date_trunc('day', now() at time zone 'Asia/Seoul') - make_interval(days => n - 1),
                                          date_trunc('day', now() at time zone 'Asia/Seoul'), interval '1 day') g) d),
    'hoods', (select jsonb_agg(jsonb_build_object('code', h.code, 'label', h.label, 'active', h.active,
                'reports_7d', (select count(*) from reports r where r.hood_code = h.code and r.created_at > now() - interval '7 days'),
                'authors_7d', (select count(distinct r.author) from reports r where r.hood_code = h.code and r.created_at > now() - interval '7 days'))
              order by h.active desc, h.label)
              from hoods h));
end $$;

-- ─────────────────── 권한 ───────────────────
-- 함수는 기본으로 누구나 실행할 수 있다. 전부 걷고, 운영 화면이 부르는 것만 로그인한 사람에게 연다.
-- 연다고 아무나 쓰는 게 아니다 — 함수 첫 줄의 admin_guard() 가 운영자가 아니면 거부한다.
revoke execute on function public.is_admin(), public.admin_guard(), public.in_queue(reports),
  public.admin_report_json(reports), public.admin_queue(int), public.admin_act(text, text, text),
  public.admin_ban(uuid, int, text), public.admin_user(uuid), public.admin_find(text, int),
  public.admin_log(int), public.admin_stats(int)
  from public, anon, authenticated;
grant execute on function public.is_admin(), public.admin_queue(int), public.admin_act(text, text, text),
  public.admin_ban(uuid, int, text), public.admin_user(uuid), public.admin_find(text, int),
  public.admin_log(int), public.admin_stats(int)
  to authenticated;
