-- ============================================================================
-- 계정 삭제·보관 기한 검증.  psql -d tpw -f test-account.sql
-- 앞에 test-auth-stub → schema → policies → seed-hoods → retention(함수 부분) 이 깔려 있어야 한다.
-- ============================================================================
\set QUIET on
\pset tuples_only on
\pset format unaligned

reset role;
delete from auth.users;                -- 처음부터
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444');
insert into correspondents (id, name, hood_code) values
  ('11111111-1111-1111-1111-111111111111','민지','4117110100'),
  ('22222222-2222-2222-2222-222222222222','준호','4117110100'),
  ('33333333-3333-3333-3333-333333333333','서연','4117110100'),
  ('44444444-4444-4444-4444-444444444444','태오','4117110100');

-- 민지 2건, 준호 1건
set role authenticated; set app.uid = '11111111-1111-1111-1111-111111111111';
insert into reports (id,author,by_name,t,hood_code,cat,place) values
  ('mj000001', auth.uid(), '', now(), '4117110100', 'play', '민지의 놀이터'),
  ('mj000002', auth.uid(), '', now(), '4117110100', 'food', '민지의 국밥');
insert into flags (report_id, reporter, reason) values ('jh000001', auth.uid(), '광고');  -- 아직 없는 글: 막힘
reset role; set role authenticated; set app.uid = '22222222-2222-2222-2222-222222222222';
insert into reports (id,author,by_name,t,hood_code,cat,place) values
  ('jh000001', auth.uid(), '', now(), '4117110100', 'cafe', '준호의 카페');
\echo '── 0. 권한을 걷고 다시 준 뒤에도 쓰기가 되나'
reset role;
select '   리포트 '||count(*)::text||'건' from reports;

-- 준호·서연·태오가 민지의 첫 글을 신고 → 가려짐. 민지는 준호의 글을 신고.
set role authenticated; set app.uid = '22222222-2222-2222-2222-222222222222';
insert into flags (report_id, reporter, reason) values ('mj000001', auth.uid(), '거짓');
reset role; set role authenticated; set app.uid = '33333333-3333-3333-3333-333333333333';
insert into flags (report_id, reporter, reason) values ('mj000001', auth.uid(), '거짓');
reset role; set role authenticated; set app.uid = '44444444-4444-4444-4444-444444444444';
insert into flags (report_id, reporter, reason) values ('mj000001', auth.uid(), '거짓');
reset role; set role authenticated; set app.uid = '11111111-1111-1111-1111-111111111111';
insert into flags (report_id, reporter, reason) values ('jh000001', auth.uid(), '광고');
reset role;
select '   민지 첫 글: 신고 '||flag_count||' · 가림 '||hidden from reports where id = 'mj000001';

\echo '── 1. 로그인 안 한 사람이 탈퇴 함수를 부른다'
set role anon; set app.uid = '';
select public.delete_my_account();
reset role;

\echo '── 2. 준호가 탈퇴한다'
set role authenticated; set app.uid = '22222222-2222-2222-2222-222222222222';
select public.delete_my_account();
reset role;
select '   로그인 계정   : '||count(*)::text from auth.users      where id = '22222222-2222-2222-2222-222222222222';
select '   프로필         : '||count(*)::text from correspondents  where id = '22222222-2222-2222-2222-222222222222';
select '   준호의 리포트  : '||count(*)::text from reports         where author = '22222222-2222-2222-2222-222222222222';
select '   준호가 한 신고 : '||count(*)::text from flags           where reporter = '22222222-2222-2222-2222-222222222222';
select '   준호 글에 달린 민지의 신고 : '||count(*)::text from flags where report_id = 'jh000001';

\echo '── 3. 남은 사람들은 그대로인가'
select '   계정 '||(select count(*) from auth.users)||' · 프로필 '||(select count(*) from correspondents)
       ||' · 리포트 '||(select count(*) from reports)||' · 신고 '||(select count(*) from flags);

\echo '── 4. 신고한 사람이 빠지면 수는 다시 세지만 가림은 그대로'
select '   민지 첫 글: 신고 '||flag_count||' · 가림 '||hidden from reports where id = 'mj000001';

\echo '── 5. 탈퇴한 준호의 토큰이 아직 살아 있다 — 쓰기'
set role authenticated; set app.uid = '22222222-2222-2222-2222-222222222222';
insert into reports (id,author,by_name,t,hood_code,cat,place) values
  ('jh000002', auth.uid(), '', now(), '4117110100', 'etc', '유령 글');
\echo '── 6. 탈퇴한 준호가 프로필을 다시 만든다'
insert into correspondents (id, name) values (auth.uid(), '준호 귀환');
reset role;

\echo '── 7. 서연이 민지를 지울 수 있나 (함수는 자기 것만 지운다)'
set role authenticated; set app.uid = '33333333-3333-3333-3333-333333333333';
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
reset role;
select '   민지 계정: '||count(*)::text from auth.users where id = '11111111-1111-1111-1111-111111111111';

\echo '── 8. 1년 지난 리포트 지우기 — 사용자가 직접 부른다'
set role authenticated; set app.uid = '11111111-1111-1111-1111-111111111111';
select public.purge_expired();
reset role;

\echo '── 9. 1년 지난 리포트 지우기 — 스케줄러(관리자)가 부른다'
update reports set t = now() - interval '400 days' where id = 'mj000002';
select '   지운 건수: '||public.purge_expired()::text;
select '   남은 리포트: '||string_agg(id, ', ') from reports;

\echo '── 10. 신고로 가려진 내 글을 내가 지운다'
reset role;
insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555');
insert into correspondents (id, name, hood_code) values ('55555555-5555-5555-5555-555555555555', '하린', '4117110100');
set role authenticated; set app.uid = '55555555-5555-5555-5555-555555555555';
insert into reports (id,author,by_name,t,hood_code,cat,place) values ('hr000001', auth.uid(), '', now(), '4117110100', 'etc', '가려질 글');
reset role;
update reports set hidden = true, flag_count = 3 where id = 'hr000001';
set role anon; set app.uid = '';
select '   남에게 보이나: '||count(*)::text from reports where id = 'hr000001';
reset role; set role authenticated; set app.uid = '55555555-5555-5555-5555-555555555555';
select '   쓴 사람에게 보이나: '||count(*)::text from reports where id = 'hr000001';
with d as (delete from reports where id = 'hr000001' returning id) select '   지운 행: '||count(*)::text from d;
reset role;
select '   서버에 남았나: '||count(*)::text from reports where id = 'hr000001';
