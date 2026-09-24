-- ============================================================================
-- 보관 기한 — 리포트는 쓴 지 1년이 지나면 지운다.
--
-- 개인정보처리방침(privacy.html 4조)이 "1년"이라고 약속한다. 이 파일을 안 돌리면
-- 그 약속이 거짓이 된다. 둘은 함께 가야 한다. 운영자 처리 기록(admin.sql 의 mod_log)도 같은 1년이다.
--
-- 이 앱은 정보가 상한다는 전제로 만들었다. 속보는 몇 시간이면 쓸모가 없고,
-- 별점·메모도 1년이면 가게가 바뀐다. 오래 쥐고 있을 이유가 없다.
-- ============================================================================

create or replace function public.purge_expired() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from reports where t < now() - interval '1 year';
  get diagnostics n = row_count;
  -- 운영자 처리 기록(글 사본 포함)도 1년. admin.sql 을 설치했을 때만 있는 표라 있는지 보고 지운다 —
  -- 없는 표를 부르다 오류가 나면 위의 리포트 지우기까지 함께 취소된다.
  if to_regclass('public.mod_log') is not null then
    execute 'delete from mod_log where at < now() - interval ''1 year''';
  end if;
  return n;
end $$;

-- 사용자는 부르지 못한다. 매일 새벽 스케줄러만 부른다.
revoke execute on function public.purge_expired() from public, anon, authenticated;

-- ── 여기부터는 Supabase 에서만 ─────────────────────────────────────
-- Database → Extensions 에서 pg_cron 을 켠 뒤 실행한다. 매일 04:10(UTC) = 13:10(KST).
create extension if not exists pg_cron;
select cron.schedule('tpw-purge-expired', '10 4 * * *', $$ select public.purge_expired(); $$);
