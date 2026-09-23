\set QUIET on
\pset tuples_only on
\pset format unaligned

-- 동네와 특파원 셋 심기 (관리자 권한)
insert into hoods (code, sido, sigungu, dong) values
  ('4117110100','경기도','안양시 만안구','안양동'),
  ('4117310100','경기도','안양시 동안구','비산동') on conflict do nothing;
delete from auth.users;   -- 처음부터. 프로필·리포트·신고가 따라 지워진다
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444')
  on conflict do nothing;
insert into correspondents (id, name, hood_code) values
  ('11111111-1111-1111-1111-111111111111','민지','4117110100'),
  ('22222222-2222-2222-2222-222222222222','준호','4117110100'),
  ('33333333-3333-3333-3333-333333333333','서연','4117110100') on conflict do nothing;

\echo '── 1. 정상: 민지가 리포트를 쓴다'
set role authenticated; set app.uid = '11111111-1111-1111-1111-111111111111';
insert into reports (id, author, by_name, t, hood_code, cat, place, note)
  values ('aaaa0001','11111111-1111-1111-1111-111111111111','민지', now(), '4117110100','play','별빛 키즈카페','텅 비었어요');
select '   들어감: '||id||' / '||by_name from reports where id='aaaa0001';

\echo '── 2. 사칭: author 를 준호로 적어서 보낸다'
insert into reports (id, author, by_name, t, hood_code, cat, place)
  values ('aaaa0002','22222222-2222-2222-2222-222222222222','준호', now(), '4117110100','food','사칭 시도');
select '   실제 기록된 author/이름: '||author||' / '||by_name from reports where id='aaaa0002';

\echo '── 3. 덮어쓰기: 남의 id 를 재사용해 본다'
reset role; set role authenticated; set app.uid = '22222222-2222-2222-2222-222222222222';
insert into reports (id, author, by_name, t, hood_code, cat, place)
  values ('aaaa0001','22222222-2222-2222-2222-222222222222','준호', now(), '4117110100','food','덮어쓰기 시도');
select '   aaaa0001 의 내용: '||place||' ('||by_name||')' from reports where id='aaaa0001';

\echo '── 4. 남의 글 지우기'
delete from reports where id='aaaa0001';
select '   남아 있나: '||count(*)::text from reports where id='aaaa0001';

\echo '── 5. 남의 글 고치기 (update 정책이 아예 없다)'
update reports set note='조작됨' where id='aaaa0001';
select '   내용: '||coalesce(note,'') from reports where id='aaaa0001';

\echo '── 6. 로그인 안 한 사람이 쓰기'
reset role; set role anon; set app.uid = '';
insert into reports (id, author, by_name, t, hood_code, cat, place)
  values ('aaaa0003','11111111-1111-1111-1111-111111111111','민지', now(), '4117110100','cafe','익명 시도');
\echo '── 7. 로그인 안 해도 읽기는 된다'
select '   anon 이 읽은 건수: '||count(*)::text from reports;

\echo '── 8. 미래 시각으로 밀어 올리기 (영원히 맨 위에 있으려고)'
reset role; set role authenticated; set app.uid = '33333333-3333-3333-3333-333333333333';
insert into reports (id, author, by_name, t, hood_code, cat, place)
  values ('aaaa0004','33333333-3333-3333-3333-333333333333','서연', now() + interval '10 years', '4117110100','etc','미래 시각');
select '   기록된 시각이 지금에서 '||round(extract(epoch from (t - now()))/60)::text||'분 차이' from reports where id='aaaa0004';

\echo '── 9. 범위 밖 값 (wait=999)'
insert into reports (id, author, by_name, t, hood_code, cat, place, wait)
  values ('aaaa0005','33333333-3333-3333-3333-333333333333','서연', now(), '4117110100','etc','이상한 값', 999);

\echo '── 10. 자기 글 신고하기'
insert into flags (report_id, reporter, reason)
  values ('aaaa0004','33333333-3333-3333-3333-333333333333','광고');

\echo '── 11. 세 사람이 신고하면 가려진다'
reset role; set role authenticated; set app.uid='11111111-1111-1111-1111-111111111111';
insert into flags (report_id, reporter, reason) values ('aaaa0004','11111111-1111-1111-1111-111111111111','광고');
reset role; set role authenticated; set app.uid='22222222-2222-2222-2222-222222222222';
insert into flags (report_id, reporter, reason) values ('aaaa0004','22222222-2222-2222-2222-222222222222','광고');
select '   신고 2건 — 아직 보이나: '||count(*)::text from reports where id='aaaa0004';
reset role; set role authenticated; set app.uid='11111111-1111-1111-1111-111111111111';
insert into flags (report_id, reporter, reason) values ('aaaa0004','11111111-1111-1111-1111-111111111111','광고');
\echo '   (같은 사람 두 번째 신고는 위에서 막힘)'
reset role; set role postgres;
insert into correspondents (id,name,hood_code) values ('44444444-4444-4444-4444-444444444444','태오','4117110100') on conflict do nothing;  -- 계정은 위에서 만들어 둠
set role authenticated; set app.uid='44444444-4444-4444-4444-444444444444';
insert into flags (report_id, reporter, reason) values ('aaaa0004','44444444-4444-4444-4444-444444444444','광고');
reset role; set role anon; set app.uid='';
select '   신고 3건 — anon 에게 보이나: '||count(*)::text from reports where id='aaaa0004';
reset role; set role postgres;
select '   서버 기록: hidden='||hidden::text||' flag_count='||flag_count::text from reports where id='aaaa0004';
\set QUIET on
\pset tuples_only on
\pset format unaligned
reset role;
update correspondents set banned_until = now() + interval '7 days' where id='22222222-2222-2222-2222-222222222222';

\echo '── 12. 정지된 사람이 자기 정지를 푼다'
set role authenticated; set app.uid='22222222-2222-2222-2222-222222222222';
update correspondents set banned_until = null where id = auth.uid();
reset role;
select '   정지 상태: '||coalesce(banned_until::text,'풀림 ← 구멍!') from correspondents where id='22222222-2222-2222-2222-222222222222';

\echo '── 13. 이름은 바꿀 수 있어야 한다'
set role authenticated; set app.uid='22222222-2222-2222-2222-222222222222';
select public.save_profile('준호2', '4117110100');
reset role;
select '   이름: '||name from correspondents where id='22222222-2222-2222-2222-222222222222';
update correspondents set banned_until=null, name='준호' where id='22222222-2222-2222-2222-222222222222';

\echo '── 16. 도배 — 한 시간에 20건 넘기기'
set role authenticated; set app.uid='11111111-1111-1111-1111-111111111111';
do $$
declare i int; ok int := 0; fail int := 0; lasterr text;
begin
  for i in 1..25 loop
    begin
      insert into reports (id,author,by_name,t,hood_code,cat,place)
        values ('spam'||lpad(i::text,4,'0'), auth.uid(), '민지', now(), '4117110100','etc','도배'||i);
      ok := ok + 1;
    exception when others then fail := fail + 1; lasterr := SQLERRM;
    end;
  end loop;
  raise notice '   25건 시도 → 들어감 %건, 막힘 %건 (막힌 이유: %)', ok, fail, lasterr;
end $$;

\echo '── 17. 하루 한도(60건)'
do $$
declare i int; ok int := 0;
begin
  for i in 26..70 loop
    begin
      insert into reports (id,author,by_name,t,hood_code,cat,place)
        values ('spam'||lpad(i::text,4,'0'), auth.uid(), '민지', now(), '4117110100','etc','도배'||i);
      ok := ok + 1;
    exception when others then null;
    end;
  end loop;
  raise notice '   시간 한도에 걸린 뒤로는 더 못 넣음: 추가로 들어간 건수 %', ok;
end $$;
reset role;
select '   민지의 총 리포트: '||count(*)::text from reports where author='11111111-1111-1111-1111-111111111111';

\echo '── 18. 남의 이름으로 신고하기 (reporter 에 남의 uuid)'
reset role; delete from flags;
set role authenticated; set app.uid='33333333-3333-3333-3333-333333333333';
insert into flags (report_id, reporter, reason) values ('aaaa0001', '44444444-4444-4444-4444-444444444444', '광고');
reset role;
select '   기록된 신고자: '||reporter from flags where report_id='aaaa0001';

\echo '── 19. 신고할 때 reporter 를 비워 보낸다 (앱이 실제로 이렇게 보낸다)'
reset role; set role authenticated; set app.uid='44444444-4444-4444-4444-444444444444';
insert into flags (report_id, reporter, reason) values ('aaaa0001', null, '거짓');
reset role;
select '   들어감: '||count(*)::text||'건, 신고자 태오' from flags where report_id='aaaa0001' and reporter='44444444-4444-4444-4444-444444444444';

\echo '── 20. 프로필 함수로 정지를 풀 수 있나'
reset role;
update correspondents set banned_until = now() + interval '7 days' where id='33333333-3333-3333-3333-333333333333';
set role authenticated; set app.uid='33333333-3333-3333-3333-333333333333';
select public.save_profile('서연', '4117110100');
reset role;
select '   정지 상태: '||coalesce(banned_until::text,'풀림 ← 구멍!') from correspondents where id='33333333-3333-3333-3333-333333333333';

\echo '── 21. 프로필 표에 직접 쓰기'
set role authenticated; set app.uid='33333333-3333-3333-3333-333333333333';
insert into correspondents (id, name) values (auth.uid(), '직접');
update correspondents set name = '직접' where id = auth.uid();
reset role;
