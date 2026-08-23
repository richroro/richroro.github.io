# 티끌모아 태산

10원부터 금괴까지, 같은 금액끼리 합쳐 태산을 쌓는 한 손 세로형 병합 게임.
앱인토스(App in Toss) 미니앱 게임 출시 가이드에 맞춰 만든 정적 웹 게임이다.

- 배포: https://richroro.github.io/games/tikkeul-moa/
- 소스: `index.html` 한 파일 (외부 스크립트·에셋·빌드 없음)

## 게임 규칙

동전을 떨어뜨려 같은 금액끼리 닿으면 한 단계 위 금액으로 합쳐진다.

`10원 → 50원 → 100원 → 500원 → 1천원 → 5천원 → 1만원 → 5만원 → 금괴`

금괴 두 개가 만나면 사라지면서 8,000점 보너스. 점선 위로 동전이 쌓인 채
0.6초 이상 멈춰 있으면 게임이 끝난다.

## 난이도

투입 횟수가 쌓일수록 큰 동전 비중이 올라간다(`RAMP_DROPS = 70`).
후반에는 1천원까지 떨어져서 한 번에 먹는 면적이 약 두 배가 된다.
이 램프가 없으면 금괴가 터질 때마다 자리가 크게 비어서 판이 사실상 끝나지 않았다.

| 동전 | 0회차 | 35회차 | 70회차 이후 |
| --- | --- | --- | --- |
| 10원 | 44% | 26% | 5% |
| 50원 | 31% | 24% | 20% |
| 100원 | 18% | 24% | 30% |
| 500원 | 7% | 18% | 30% |
| 1천원 | – | 7% | 16% |

랜덤 투입 봇으로 측정한 판당 투입 수(필드 높이 781 기준, 각 18회):

| 설정 | 중앙값 | 사분위 | 범위 |
| --- | --- | --- | --- |
| 위험선 100 · 유예 1.2초 | 285 | 212~357 | 189~459 |
| **위험선 250 · 유예 0.6초** | **181** | 155~245 | 131~491 |

드롭 풀 확장분까지 합치면 최초 버전(중앙값 419) 대비 절반 이하다.
편차가 큰 건 금괴가 터지면 자리가 한꺼번에 비기 때문이고, 측정 배치마다
중앙값이 160~320 사이에서 흔들린다. 정밀한 값이 아니라 대략의 구간으로 봐야 한다.

## 구현 메모

물리는 Verlet 적분 + 위치 기반 겹침 보정(PBD)을 직접 구현했다. 만들면서
실제로 터졌던 문제 세 가지와 대응:

| 증상 | 원인 | 대응 |
| --- | --- | --- |
| 동전이 화면 위로 700px 넘게 솟구침 | 병합으로 큰 동전이 이웃 안에 갑자기 생겨 겹침이 깊어지고, 그 보정량이 그대로 속도가 됨 | 병합 동전은 부모 반지름에서 시작해 서서히 커지게(`rt`), 한 번에 밀어내는 양 상한, 위쪽 속도 상한 `MAXUP` |
| 스택이 영원히 진동해서 게임 오버가 안 걸림 | 겹침 보정을 속도에 반영하지 않아(LEAK<1) 접촉한 동전의 속도가 죽지 않음 | `LEAK = 1` (표준 PBD). 접촉 시 속도가 0으로 수렴 |
| 동전이 벽을 뚫고 나감 | 반복 루프에서 벽 보정을 먼저 하고 동전끼리 보정을 나중에 해서, 마지막 보정이 벽 밖으로 밀어냄 | `walls()`를 각 반복의 **마지막**에 호출 |

검증은 브라우저에서 물리 루프를 직접 돌려서 했다. 실제 플레이 조건(0~3티어
투입)으로 400회 투입 × 3회 반복 시 좌/우/바닥 이탈 0, NaN 0, 게임 오버 정상 발생.

## 앱인토스 출시 가이드 대응 현황

[게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-game.html)
기준으로 정적 웹에서 만족시킬 수 있는 항목은 모두 반영했다.

**충족**

- 최초 화면 10초 이내 진입 — 단일 HTML, 외부 요청 0건
- 사운드/햅틱 적용, 사용자가 직접 On/Off (설정 유지)
- 백그라운드 전환 시 사운드 즉시 종료(`AudioContext.suspend`) + 일시정지, 복귀 시 정상 재생
- Safe Area 미침범 (`env(safe-area-inset-*)`, Dynamic Island 포함)
- 진입 직후 바텀시트 자동 노출 없음
- 모든 화면에서 종료 가능(헤더 X 상시 노출) + **종료 시 확인 모달**
- 인게임 풀스크린, 세로 모드 고정
- 브라우저 히스토리 조작 없음, OS 뒤로가기 제스처 미사용
- `eval` / `new Function` / 외부 스크립트 로드 없음
- SSR 없음(정적 파일), 통신은 HTTPS(GitHub Pages)만
- 플레이 기록(최고 점수·도달 티어) 재접속 후에도 유지
- 인터랙션 지연 2초 미만, 광고·결제 미사용

**콘솔 등록 후에 연결해야 하는 것**

- 리더보드 점수 제출 → `Game.setLeaderboardScore`
- 리더보드 열기 → `Game.openLeaderboard`
- 미니앱 종료 → `Screen.close`
- 사용자 식별키 → **미해결.** 아래 참고

세 가지는 `index.html` 상단의 **`Toss` 어댑터** 한 곳에 모여 있다.
토스 웹뷰가 브릿지를 주입하면 자동으로 그걸 쓰고, 없으면 일반 웹으로 동작한다.

사용자 식별키는 아직 붙일 데가 없다. `Game.getUserProfile()` 이 돌려주는 건
`{ statusCode, nickname, profileImageUri }` 뿐이라 고유 ID 가 없어서 기록을
묶는 키로 쓸 수 없다. 콘솔 등록 후 로그인/유저 API 를 확인해 교체해야 한다.
그전까지는 로컬 익명 ID 를 쓴다.

## 앱인토스에 실제로 올리려면

**중요: 배포된 웹 URL 을 그대로 가리키는 방식이 아니다.** 앱인토스는 SDK 를
프로젝트에 설치해 번들을 만들고, 그 번들을 콘솔에 업로드하는 구조다. 지금의
GitHub Pages 주소를 미니앱으로 감싸는 건 안 된다.

1. [사업자 등록](https://developers-apps-in-toss.toss.im/guide/operation/register-business.md)
   — **개인사업자 등록증 필요. 사업자만 미니앱을 등록할 수 있다.**
2. 콘솔에서 미니앱 등록 (앱 로고, 앱 이름, `appName`, 사용 연령, 고객센터 연락처, 게임 카테고리)
3. 프로젝트 생성 후 이 `index.html` 의 게임 로직을 옮긴다

   ```bash
   npm install @apps-in-toss/web-framework
   npx ait init
   ```

4. `apps-in-toss.config.ts` (SDK 3.x. 2.x 의 `granite.config.ts` 에서 이름이 바뀌었다)

   ```ts
   import { defineConfig } from '@apps-in-toss/web-framework/config';

   export default defineConfig({
     appName: 'tikkeul-moa',
     brand: { primaryColor: '#3182F6' },
     webView: {
       // 출시 가이드가 OS 뒤로가기 제스처를 금지한다
       allowsBackForwardNavigationGestures: false,
       pullToRefreshEnabled: false,
       bounces: false,
     },
     permissions: [],
     webBundleDir: 'dist',
   });
   ```

5. `Toss` 어댑터 세 함수를 실제 SDK 호출로 교체 (전부 Promise 를 돌려준다)

   ```js
   import { Game, Screen } from '@apps-in-toss/web-framework';

   await Game.setLeaderboardScore({ score: String(score) });  // 점수는 '문자열'
   await Game.openLeaderboard();
   await Screen.close();
   ```

   점수를 숫자로 넘기면 `statusCode` 가 `UNPARSABLE_SCORE` 로 떨어진다.

6. CORS 허용 도메인 등록
   - 실제: `https://tikkeul-moa.web.tossmini.com`
   - 테스트: `https://tikkeul-moa.private-web.tossmini.com`

7. `npm run build` 로 나온 번들을 콘솔에 업로드 → 실기기 테스트 → 심사 제출

## 라이선스

개인 프로젝트. 화폐 디자인은 실제 지폐/동전 이미지를 쓰지 않고 색과 숫자로만 표현했다.
