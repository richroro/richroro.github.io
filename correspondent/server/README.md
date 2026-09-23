# server — 공용 보드

`config.js` 를 비워 두면 앱은 이 폴더를 전혀 안 쓴다. 붙이는 법은 [../SETUP.md](../SETUP.md).

| 파일 | |
| --- | --- |
| `schema.sql` | 표 네 개 — hoods / correspondents / reports / flags |
| `policies.sql` | RLS·트리거·한도. **이걸 빼면 아무나 아무 글이나 지운다** |
| `seed-hoods.sql` | 동네. 한 번에 전국을 열지 않는다 |
| `retention.sql` | 1년 지난 리포트를 매일 지운다(pg_cron). 처리방침 4조가 이걸 약속한다 |
| `test-sql.mjs` | 서버 규칙 공격 48가지 — 판정형, 임시 DB 에서만 돈다 |
| `test-e2e.mjs` | 브라우저 → fetch → 모의 PostgREST → 진짜 RLS, 44가지 |
| `test-mock-rest.mjs` | PostgREST 흉내. 앱이 보낸 값을 **그대로** 넣는다 |
| `test-auth-stub.sql` | 로컬 검증용. Supabase 에 있는 `auth.users`·`auth.uid()`·역할을 흉내 낸다 |

## 돌려 보기

Postgres 16 이 있으면 된다. 두 묶음 모두 **스스로 임시 DB 를 만들고 끝나면 지운다** —
이미 있는 DB 는 건드리지 않는다.

```bash
PGHOST=… PGUSER=postgres node test-sql.mjs    # 사칭·덮어쓰기·도배·정지·탈퇴·보관 기한
PGHOST=… PGUSER=postgres node test-e2e.mjs    # 모의 서버·앱 사본까지 혼자 띄우고 치운다
```

전부 한 번에는 `node correspondent/test/run-all.mjs` (저장소 뿌리에서). CI 도 이 명령을 쓴다.

> 예전엔 `test-attack.sql`·`test-account.sql` 이 있었다. 결과를 출력만 해서 CI 가 실패를 알 수 없었고,
> `test-account.sql` 은 `delete from auth.users;` 로 시작했다 — 실수로 운영 SQL 편집기에 붙이면
> 모든 계정이 날아가는 파일이었다. 판정형 `test-sql.mjs` 로 바꾸면서 지웠다.

## 모의 서버가 가렸던 것

한때 모의 서버가 SQL 을 손으로 짜면서 **앱이 보낸 값 대신 토큰에서 값을 채워 넣었다.**
그래서 두 버그가 숨었다 — 신고의 빈 `reporter` 를 채워 줄 트리거가 없던 것, 그리고 PostgREST
upsert 가 `SET` 에 `id` 까지 넣어 프로필 저장이 권한 거부로 떨어지던 것. 지금 모의 서버는 받은 값을
그대로 넣고, `test-sql.mjs` 는 이 버그를 되살리면 빨갛게 떨어지는 것까지 확인했다.
