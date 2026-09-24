/* 공용 보드 설정.
   비워 두면 앱은 지금까지처럼 서버 없이 돈다 — 리포트는 이 브라우저에만 쌓이고 링크로만 오간다.
   채워 넣으면 같은 동네 사람들이 같은 속보를 본다. 설정법은 SETUP.md.

   anonKey 는 공개해도 되는 값이다. 이 키로 할 수 있는 일은 policies.sql 이 정한 것뿐이다
   (읽기는 누구나, 쓰기는 로그인한 사람이 자기 것만). 비밀은 service_role 키 쪽이고,
   그건 절대 이 파일에 넣지 않는다. */
window.TPW_CONFIG = {
  url: "",        // 예: https://abcdefgh.supabase.co
  anonKey: "",    // 예: eyJhbGciOi...
  hood: "",       // 기본 동네 법정동코드. 비우면 처음 열 때 고르게 한다
  /* 폰 알림(선택). VAPID 공개 키 — 공개해도 되는 값이다. 비워 두면 알림 단추가 안 나온다.
     키는 node correspondent/tools/vapid-keys.mjs 로 만들고, 짝이 되는 비공개 키는 Edge Function 비밀에만 둔다(SETUP.md 6단계). */
  vapidPublicKey: ""
};
