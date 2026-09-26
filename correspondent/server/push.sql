-- ============================================================================
-- 폰 알림 — 지켜보는 곳에 남이 새 소식을 올리면 앱이 꺼져 있어도 폰으로 알린다. (선택, admin.sql 다음)
--
-- 흐름: 리포트가 들어온다 → 데이터베이스 웹훅이 Edge Function(functions/notify)을 부른다
--       → push_targets() 가 받을 기기를 고른다 → 함수가 암호화해서 푸시 서비스로 보낸다.
--
-- 서버가 새로 갖게 되는 것: 알림을 켠 사람의 알림 주소(브라우저가 만든 구독)와, 그 기기가 지켜보는
-- 장소 이름(띄어쓰기를 뺀 열쇠). 알림을 끄거나, 로그아웃하거나, 탈퇴하거나, 푸시 서비스가 "없는 구독"
-- 이라고 답하면 지운다. 처리방침 2조·4조·8조.
-- ============================================================================

create table if not exists push_subs (
  endpoint   text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  owner      uuid not null references correspondents (id) on delete cascade,   -- 탈퇴하면 함께 지워진다
  p256dh     text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth       text not null check (auth ~ '^[A-Za-z0-9_-]{16,30}$'),
  hood_code  text not null references hoods (code),
  places     text[] not null default '{}' check (coalesce(array_length(places, 1), 0) <= 30),
  fails      smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_places_idx on push_subs using gin (places);   -- "이 장소를 지켜보는 기기"
create index if not exists push_subs_owner_idx on push_subs (owner, created_at desc);

-- 같은 기기·같은 장소로는 30분에 한 번만 — 한 가게에 리포트가 몰려도 폰이 울려 대지 않게
create table if not exists push_sent (
  endpoint  text not null references push_subs (endpoint) on delete cascade,
  place_key text not null,
  at        timestamptz not null default now(),
  primary key (endpoint, place_key)
);

alter table push_subs enable row level security;
alter table push_sent enable row level security;
revoke all on push_subs, push_sent from anon, authenticated;   -- 정책 없음 → 함수로만

-- ─────────────────── 앱이 부르는 것 (로그인한 사람) ───────────────────
-- 장소 열쇠는 서버가 리포트에서 만드는 place_key 와 같은 규칙으로 다시 만든다(띄어쓰기 빼고 소문자).
create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_hood text, p_places text[])
returns jsonb
language plpgsql security definer volatile set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  keys text[];
begin
  if me is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if not exists (select 1 from correspondents where id = me) then
    raise exception '특파원 등록이 먼저입니다' using errcode = '42501';
  end if;
  -- 순서는 바이트 순(collate "C")으로 못 박는다. 데이터베이스 기본 정렬을 따르면 설치마다 달라진다 —
  -- CI 의 Postgres(en_US.utf8)는 "중앙…" 을 "깔아…" 앞에 두었고, 로컬(C)은 뒤에 두었다.
  select coalesce(array_agg(k order by k collate "C"), '{}') into keys
    from (select distinct lower(regexp_replace(left(btrim(x), 40), '\s', '', 'g')) as k
            from unnest(coalesce(p_places, '{}')) x) q
   where k <> '';
  if coalesce(array_length(keys, 1), 0) > 30 then
    raise exception '지켜보는 곳은 30곳까지입니다' using errcode = '22023';
  end if;
  insert into push_subs (endpoint, owner, p256dh, auth, hood_code, places)
    values (p_endpoint, me, p_p256dh, p_auth, p_hood, keys)
  on conflict (endpoint) do update
    set owner = me, p256dh = excluded.p256dh, auth = excluded.auth,
        hood_code = excluded.hood_code, places = excluded.places, fails = 0;
  -- 한 사람이 기기를 끝없이 걸어 두지 못하게 — 최근 10대까지만
  delete from push_subs s
   where s.owner = me
     and s.endpoint not in (select endpoint from push_subs where owner = me order by created_at desc limit 10);
  return jsonb_build_object('places', to_jsonb(keys));
end $$;

create or replace function public.drop_push(p_endpoint text) returns void
language sql security definer volatile set search_path = public, auth as $$
  delete from push_subs where endpoint = p_endpoint and owner = auth.uid();
$$;

-- ─────────────────── 보내는 함수가 부르는 것 (service_role 만) ───────────────────
-- 받을 기기: 같은 동네, 그 장소를 지켜보는, 쓴 사람 자신이 아닌, 30분 안에 같은 장소로 안 받은.
-- 가려진 글과, 쓴 지 세 시간이 넘은 글(오프라인에서 쓰고 늦게 올린 것)은 알리지 않는다 — 상한 소식이다.
create or replace function public.push_targets(p_report text) returns jsonb
language plpgsql security definer volatile set search_path = public as $$
declare
  r reports%rowtype;
  out jsonb;
begin
  select * into r from reports where id = p_report;
  if not found or r.hidden or r.t < now() - interval '3 hours' then
    return jsonb_build_object('targets', '[]'::jsonb);
  end if;
  with t as (
    select s.endpoint, s.p256dh, s.auth
      from push_subs s
     where s.hood_code = r.hood_code
       and s.places @> array[r.place_key]
       and s.owner <> r.author
       and not exists (select 1 from push_sent x
                        where x.endpoint = s.endpoint and x.place_key = r.place_key
                          and x.at > now() - interval '30 minutes')
  ), mark as (
    insert into push_sent (endpoint, place_key, at)
    select endpoint, r.place_key, now() from t
    on conflict (endpoint, place_key) do update set at = excluded.at
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into out from t;
  return jsonb_build_object(
    'report', jsonb_build_object('id', r.id, 'place', r.place, 'place_key', r.place_key, 'by_name', r.by_name,
                                 'wait', r.wait, 'crowd', r.crowd, 'park', r.park, 'note', r.note, 't', r.t),
    'targets', out);
end $$;

-- 보낸 결과. 푸시 서비스가 404·410(없는 구독)이면 지우고, 다섯 번 연달아 실패해도 지운다.
create or replace function public.push_result(p_endpoint text, p_ok boolean, p_gone boolean) returns void
language plpgsql security definer volatile set search_path = public as $$
begin
  if p_gone then
    delete from push_subs where endpoint = p_endpoint;
  elsif p_ok then
    update push_subs set fails = 0 where endpoint = p_endpoint;
  else
    update push_subs set fails = fails + 1 where endpoint = p_endpoint;
    delete from push_subs where endpoint = p_endpoint and fails >= 5;
  end if;
end $$;

-- ─────────────────── 권한 ───────────────────
revoke execute on function public.save_push(text, text, text, text, text[]), public.drop_push(text),
  public.push_targets(text), public.push_result(text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.save_push(text, text, text, text, text[]), public.drop_push(text) to authenticated;
grant execute on function public.push_targets(text), public.push_result(text, boolean, boolean) to service_role;
