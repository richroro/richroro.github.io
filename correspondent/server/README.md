# server — 공용 보드

`config.js` 를 비워 두면 앱은 이 폴더를 전혀 안 쓴다. 붙이는 법은 [../SETUP.md](../SETUP.md).

| 파일 | |
| --- | --- |
| `schema.sql` | 표 네 개 — hoods / correspondents / reports / flags |
| `policies.sql` | RLS·트리거·한도. **이걸 빼면 아무나 아무 글이나 지운다** |
| `seed-hoods.sql` | 동네. 한 번에 전국을 열지 않는다 |
| `retention.sql` | 1년 지난 리포트를 매일 지운다(pg_cron). 처리방침 4조가 이걸 약속한다 |
| `test-auth-stub.sql` | 로컬 검증용. Supabase 에 있는 `auth.users`·`auth.uid()`·역할을 흉내 낸다 |
| `test-attack.sql` | 공격 21가지 — 사칭, 덮어쓰기, 도배, 정지 풀기, 남의 이름으로 신고 … |
| `test-account.sql` | 계정 삭제·보관 기한 10가지 |
| `test-mock-rest.mjs` | PostgREST 흉내. 질의는 진짜 Postgres 로 보낸다 |
| `test-e2e.mjs` | 브라우저 → fetch → 모의 서버 → 진짜 RLS |

## 돌려 보기

로컬 Postgres 16 이 있으면 정책을 실제로 공격해 볼 수 있다. Supabase 에는 있고
로컬에는 없는 것(`auth.uid()`, `anon`/`authenticated` 역할)만 먼저 심는다.

```bash
createdb tpw
psql -d tpw -f test-auth-stub.sql -f schema.sql -f policies.sql -f seed-hoods.sql
sed -n '1,/여기부터는 Supabase 에서만/p' retention.sql | psql -d tpw   # pg_cron 줄은 로컬에 없어서 뺀다

psql -d tpw -f test-attack.sql     # 사칭·덮어쓰기·도배가 전부 막히는지
psql -d tpw -f test-account.sql    # 탈퇴하면 무엇이 지워지고 무엇이 남는지
```

`test-e2e.mjs` 는 모의 서버(54330)와, `config.js` 에 모의 서버를 넣은 앱 사본을 띄운 정적 서버(8197)가
함께 떠 있어야 돈다. 44가지 — 비공개 글, 내 글 서버 삭제, 남의 글 치우기, 가려진 내 글 지우기,
계정 삭제와 그 삭제가 이웃 기기까지 번지는지.
