# YouTube API 키 만들기 (Google Cloud Console)

유튜브 API 는 "구글 클라우드 콘솔에서 프로젝트를 만들고 → YouTube Data API v3 를
켜고 → 키를 발급받아 제한을 거는" 세 단계다. 콘솔 클릭으로 5분,
`scripts/setup-youtube-api.sh` 로 하면 1분이다.

## 0. 어떤 자격증명이 필요한지 먼저 고른다

여기서 갈린다. 잘못 고르면 다 만들고 나서 403 을 본다.

| 하려는 일 | 필요한 것 | 난이도 |
| --- | --- | --- |
| 공개 데이터 조회 (검색, 영상 정보, 조회수, 채널 통계, 댓글 읽기) | **API 키** | 5분 |
| 내 채널에 영상 업로드, 댓글 달기, 재생목록 수정 | OAuth 2.0 클라이언트 ID | 반나절~ |
| 내 채널의 비공개 지표 (시청 시간, 수익, 시청자 분석) | OAuth 2.0 + YouTube Analytics API | 반나절~ |

이 문서는 **API 키** 기준이다. 대부분의 용도(영상 목록 가져오기, 조회수 표시,
채널 구독자 수 표시)는 API 키면 끝난다. OAuth 가 필요한 경우는 맨 아래 참고.

## 1. 콘솔에서 만들기

**① 프로젝트 생성** — https://console.cloud.google.com/projectcreate

이름은 아무거나(`youtube-api` 등). 조직이 없으면 위치는 "조직 없음" 그대로 둔다.
이미 쓰는 프로젝트가 있으면 건너뛴다. 결제 카드 등록은 필요 없다.

**② YouTube Data API v3 사용 설정** — https://console.cloud.google.com/apis/library/youtube.googleapis.com

우측 상단에서 ①의 프로젝트가 선택됐는지 확인하고 **사용** 버튼을 누른다.
이 단계를 빼먹으면 나중에 `SERVICE_DISABLED` / `accessNotConfigured` 가 뜬다.

**③ 키 발급** — https://console.cloud.google.com/apis/credentials

**+ 사용자 인증 정보 만들기 → API 키**. 팝업에 `AIza...` 로 시작하는 문자열이
뜬다. 이게 키다. 팝업을 닫아도 같은 화면에서 다시 볼 수 있다.

**④ 제한 걸기 (건너뛰지 말 것)**

방금 만든 키의 연필 아이콘 → 편집.

- **API 제한사항**: "키 제한" 선택 → 목록에서 **YouTube Data API v3** 만 체크
- **애플리케이션 제한사항**: 키를 쓸 위치에 따라 아래 표대로

| 키를 쓰는 곳 | 고를 것 | 넣을 값 |
| --- | --- | --- |
| 웹 페이지 (브라우저 JS) | 웹사이트 | `https://richroro.github.io/*`, 로컬 테스트용 `http://localhost:*` |
| 서버 / 크론 / 배치 | IP 주소 | 서버 공인 IP (`curl ifconfig.me` 로 확인) |
| 내 PC 에서만 수동 실행 | IP 주소 | 내 공인 IP |

제한 없는 키는 유출되는 순간 남이 내 하루 할당량을 태운다. 저장 후 반영까지
최대 5분 걸린다.

**⑤ 확인**

```bash
echo 'YOUTUBE_API_KEY=AIza...' >> .env
node scripts/youtube-api-check.mjs
```

`[성공] 키가 정상 동작한다.` 가 나오면 끝이다.
웹사이트(리퍼러) 제한을 건 키는 터미널에서 그냥 부르면 막히는 게 정상이다.
그때는 `--referer` 로 테스트한다.

```bash
node scripts/youtube-api-check.mjs --referer https://richroro.github.io/
```

## 2. gcloud 로 한 번에

콘솔 클릭 대신 스크립트로 같은 걸 한다. [gcloud 설치](https://cloud.google.com/sdk/docs/install) 후:

```bash
gcloud auth login
gcloud config set project 내프로젝트ID

# 브라우저에서 쓸 키
REFERRERS="https://richroro.github.io/*,http://localhost:*" ./scripts/setup-youtube-api.sh

# 서버에서 쓸 키
IPS="1.2.3.4" KEY_NAME=youtube-server ./scripts/setup-youtube-api.sh
```

API 사용 설정 → 키 생성 → 제한 적용 → 키 문자열 출력까지 한 번에 한다.
같은 `KEY_NAME` 의 키가 이미 있으면 새로 만들지 않고 기존 것을 보여준다.

## 3. 할당량

| 항목 | 값 |
| --- | --- |
| 기본 한도 | **하루 10,000 유닛** (프로젝트당) |
| 리셋 | 태평양시 자정 = 한국시간 오후 4시(서머타임) / 5시 |
| `search.list` | **100 유닛** — 이것 때문에 할당량이 녹는다 |
| `videos.list`, `channels.list`, `playlistItems.list` | 각 1 유닛 |
| `videos.insert` (업로드) | 1,600 유닛 |

하루 100번만 검색하면 할당량이 끝난다. 실무에서 거의 항상 이렇게 우회한다:

- 검색 대신 **채널의 업로드 재생목록**을 훑는다.
  `channels.list(part=contentDetails)` 로 `uploads` 재생목록 ID 를 얻고
  `playlistItems.list` 로 페이징 — 50개당 1유닛이라 `search.list` 의 1/100 이다.
- 결과를 캐싱한다. 조회수처럼 자주 안 변하는 값은 10분~1시간 캐시로 충분하다.
- 페이지네이션도 페이지마다 비용이 붙는다. `maxResults=50` 으로 페이지 수를 줄인다.
- 잘못된 요청, 키가 틀린 요청, 에러 응답도 최소 1유닛씩 먹는다.

현재 사용량: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
상향은 [감사·할당량 확대 신청 폼](https://support.google.com/youtube/contact/yt_api_form)
으로만 가능하고, 심사에 몇 주에서 몇 달 걸린다. 돈으로 살 수 없다.

## 4. 자주 걸리는 에러

`scripts/youtube-api-check.mjs` 가 아래를 자동으로 해석해 준다.

| 에러 | 원인 | 해결 |
| --- | --- | --- |
| `API_KEY_INVALID` | 키 문자열이 틀림 | 복사 중 잘렸는지 확인, 지운 키인지 확인 |
| `SERVICE_DISABLED` / `accessNotConfigured` | ②번을 안 함 | 라이브러리에서 YouTube Data API v3 사용 설정 |
| `API_KEY_SERVICE_BLOCKED` | "API 제한사항" 에 YouTube 가 빠짐 | ④에서 YouTube Data API v3 체크 |
| `API_KEY_HTTP_REFERRER_BLOCKED` / `ipRefererBlocked` | 리퍼러 제한 키를 서버·터미널에서 호출 | 브라우저에서 쓰거나, 서버용은 IP 제한 키를 따로 발급 |
| `API_KEY_IP_ADDRESS_BLOCKED` | 호출 IP 가 허용 목록에 없음 | `curl ifconfig.me` 값을 추가 |
| `quotaExceeded` | 10,000 유닛 소진 | 태평양시 자정까지 대기, 위의 우회 적용 |

## 5. 키 관리

- **정적 사이트(GitHub Pages)에 키를 넣으면 브라우저 소스에 그대로 노출된다.**
  이건 못 막는다. 그래서 리퍼러 제한 + API 제한이 실질적인 유일한 방어선이고,
  제한을 건다는 전제에서 공개돼도 되는 구조다.
  숨겨야 하는 키라면 정적 페이지가 아니라 서버(또는 서버리스 함수)를 거쳐야 한다.
- `.env` 는 `.gitignore` 에 있다. 키를 커밋하지 않는다.
- 실수로 커밋했으면 히스토리에서 지우는 것보다 **콘솔에서 키를 삭제하고 새로
  만드는 게 먼저다.** 깃에 한 번 올라간 키는 이미 유출된 키다.
- 용도마다 키를 나눈다(웹용/서버용). 하나가 새도 그것만 폐기하면 된다.

## 6. OAuth 가 필요한 경우 (업로드·비공개 지표)

API 키로는 안 된다. 순서만 적어 둔다.

1. [Google Auth Platform](https://console.cloud.google.com/auth/overview)
   (구 "OAuth 동의 화면") 에서 앱 등록. 외부(External) 선택.
2. 필요한 스코프 추가 — 업로드는 `youtube.upload`, 분석은 `yt-analytics.readonly`.
3. 사용자 인증 정보 → OAuth 클라이언트 ID 생성 (데스크톱 앱 / 웹 앱).
4. 테스트 모드에서는 등록한 테스트 사용자만 쓸 수 있고 **리프레시 토큰이 7일마다
   만료된다.** 내 채널만 다룰 거면 그냥 테스트 모드로 두고 7일마다 재인증하거나,
   앱을 게시(프로덕션)한다.
5. 민감한 스코프를 쓰는 앱을 게시하면 구글 검증(수 주)이 붙는다. 본인 채널 용도면
   테스트 모드가 현실적이다.

업로드는 1회 1,600 유닛이라 기본 할당량으로 하루 6개가 한계다.
