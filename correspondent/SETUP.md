# 공용 보드 붙이기

기본은 서버 없이 도는 앱이다. 이 문서는 **같은 동네 사람들이 같은 속보를 보게** 할 때만 필요하다.
`config.js` 를 비워 두면 아무것도 안 바뀐다 — 지금처럼 브라우저에만 쌓이고 링크로만 오간다.

| | 서버 없이 | 공용 보드 |
| --- | --- | --- |
| 누가 씁니까 | 이미 아는 사람들(단톡방) | 같은 동네 사람들 |
| 새로 온 사람이 보는 것 | 빈 화면 (묶음 링크를 받아야 함) | 동네 속보가 바로 |
| 필요한 것 | 없음 | 아래 30분 |
| 비용 | 0원 | 무료 티어로 시작, 커지면 월 $25 |

---

## 1. Supabase 프로젝트 (10분)

1. [supabase.com](https://supabase.com) → New project. 지역은 **Northeast Asia (Seoul)** 로.
2. **SQL Editor** 에서 순서대로 붙여 넣고 실행:
   1. `server/schema.sql` — 표 네 개
   2. `server/policies.sql` — 권한. **이걸 빼먹으면 아무나 아무 글이나 지울 수 있다**
   3. `server/seed-hoods.sql` — 동네. 열 동네만 `active = true`
3. **Settings → API** 에서 두 값을 복사해 `config.js` 에 넣는다.

```js
window.TPW_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJhbGciOi...",
  hood: "4117110100"      // 기본 동네. 비우면 사용자가 고른다
};
```

> **anonKey 는 공개해도 되는 값이다.** 정적 사이트라 어차피 브라우저에 그대로 실린다.
> 이 키로 할 수 있는 일은 `policies.sql` 이 정한 것뿐이다 — 읽기는 누구나, 쓰기는 로그인한 사람이 자기 것만.
> **절대 넣으면 안 되는 건 `service_role` 키다.** 그건 모든 정책을 무시한다.

## 2. 로그인 (15분)

읽기는 로그인 없이 된다. **쓰기와 신고에만** 필요하다 — 누가 썼는지 남아야 신고가 뜻을 갖는다.

**카카오** — [developers.kakao.com](https://developers.kakao.com) 에서 앱을 만들고,
Supabase **Authentication → Providers → Kakao** 에 REST API 키와 Client Secret 을 넣는다.
카카오 쪽 Redirect URI 에는 Supabase 가 알려 주는 주소(`https://xxxx.supabase.co/auth/v1/callback`)를 넣는다.

**메일** — 카카오 심사를 기다리는 동안 쓰는 길. Supabase 는 기본으로 켜져 있다.
앱의 `🏘 공용 보드` 시트에서 메일 주소를 넣으면 링크가 온다.

**Authentication → URL Configuration** 의 Redirect URLs 에 배포 주소를 넣어야 로그인하고 돌아온다.

```
https://richroro.github.io/correspondent/
http://127.0.0.1:8080/correspondent/     ← 로컬에서 시험할 때
```

## 3. 배포

깃허브 페이지스는 `main` 에 올라가면 알아서 뜬다. `config.js` 도 같이 올라간다.

---

## 서버가 막는 것 (실제로 돌려서 확인한 것들)

`policies.sql` 은 클라이언트를 믿지 않는다. 아래는 전부 로컬 Postgres 16 에서 공격해 보고 확인했다.

| 해 본 것 | 결과 |
| --- | --- |
| 남의 이름으로 글 쓰기 | `author` 와 `by_name` 을 토큰 주인으로 덮어쓴다 |
| 남의 리포트 id 로 덮어쓰기 | 기본키 충돌로 거부 |
| 남의 글 지우기 | 0건 삭제 |
| 남의 글 고치기 | `update` 권한 자체가 없다 |
| 로그인 없이 쓰기 | 거부 (읽기는 됨) |
| 시각을 미래로 밀어 맨 위 차지하기 | 서버가 `now()` 로 당긴다 |
| 범위 밖 값 (`wait=999`) | check 제약으로 거부 |
| 자기 글 신고해서 가리기 | 거부 |
| 같은 글 두 번 신고 | 기본키로 한 번만 |
| 정지된 사람이 자기 정지 풀기 | `banned_until` 은 컬럼 권한에서 빠져 있다 |
| 도배 (25건 연속) | 시간당 20건에서 끊긴다. 하루 60건 |

> **정책만으로는 못 막는 게 하나 있다.** `WITH CHECK` 안에서 컬럼 이름은 *새 행*을 가리켜서
> `banned_until = banned_until` 같은 비교는 늘 참이다. 정지를 막는 건 정책이 아니라
> `grant update (name, hood_code)` — 컬럼 단위 권한 쪽 일이다.

**세 사람이 신고하면 가려진다.** 지우지는 않는다. 관리자가 보고 판단할 수 있어야 한다.

```sql
-- 신고 쌓인 것 보기
select r.id, r.place, r.by_name, r.flag_count, r.hidden,
       (select array_agg(reason) from flags where report_id = r.id) as 사유
  from reports r where r.flag_count > 0 order by r.flag_count desc;

-- 오해였으면 되살리기
update reports set hidden = false where id = '...';

-- 악성 사용자 일주일 정지
update correspondents set banned_until = now() + interval '7 days' where id = '...';
```

---

## 위치를 받지 않는 이유

동네는 **사람이 고른다.** GPS 를 쓰지 않는다. 기술적으로 못 해서가 아니다.

좌표를 받아서 "내 주변"을 하는 순간 **위치정보법상 위치기반서비스사업 신고** 대상이 된다
(방송통신위원회). 자주 놓치는 항목이고, 1인 개발자에게는 신고 자체보다 그 뒤에 붙는
관리 의무가 부담이다. 동네를 직접 고르게 하면 이 줄을 아예 안 넘는다.

나중에 "내 주변"이 꼭 필요해지면 그때 신고하고 붙이면 된다. **순서가 그쪽이다.**

## 런칭 전에 확인할 것 — 법률 자문이 아니다

공용 보드를 켜는 순간 **남의 개인정보를 서버에 보관하는 서비스**가 된다. 전문가 확인을 권한다.

- **개인정보처리방침** — 계정이 생기면 필요하다. 무엇을 받고(카카오 식별자, 닉네임),
  왜 받고, 얼마나 두고, 어떻게 지우는지. 앱 안에 링크가 있어야 한다.
- **정보통신망법 게시판 의무** — 신고 창구(있음: 신고 단추), 불법정보 삭제,
  운영자 연락처 표시.
- **삭제 요청** — 사용자가 계정과 글을 지울 수 있어야 한다.
  `delete from correspondents where id = ...` 를 하면 그 사람의 리포트도 함께 지워진다
  (`on delete cascade`). 지금 앱에는 **계정 삭제 화면이 없다 — 런칭 전에 붙여야 한다.**
- 수익이 생기면 사업자등록.

---

## 남아 있는 것

정직하게 적는다. 아래는 아직 안 되어 있다.

- **계정 삭제 화면** — 위에 적은 대로, 런칭 전 필수
- **개인정보처리방침 문서** — 틀만 있고 내용은 없다
- **관리자 화면** — 지금은 SQL 로 본다. 신고가 하루 몇 건이면 그걸로 충분하고,
  그보다 많아지면 그때 만드는 게 맞다
- **알림** — "우리 동네에 속보" 웹 푸시. 3분마다 조용히 받아오는 것만 있다
- **동네 인증** — 지금은 고르면 그만이라 아무 동네나 고를 수 있다.
  당근마켓식 인증은 위치를 받아야 해서 위 규제 줄을 넘는다
