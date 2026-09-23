-- ============================================================================
-- 로컬 검증 전용 — Supabase 에 이미 있는 것들을 흉내 낸다. 배포에는 쓰지 않는다.
--   auth.users   로그인 계정 표 (진짜는 컬럼이 수십 개다. 여기선 id 만 있으면 된다)
--   auth.uid()   요청을 보낸 사람. 진짜는 JWT 의 sub, 여기선 세션 변수 app.uid
--   anon / authenticated   PostgREST 가 요청마다 갈아 끼우는 역할
-- ============================================================================
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.uid', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
