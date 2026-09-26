# 성공 애니 · 맨손에서 시작한 사람들

한국 창업가들의 성장기를 애니메이션으로 보는 페이지. 그림·영상 파일 없이 캐릭터·배경·효과를 전부 SVG/캔버스 코드로 그리고, 소리는 Web Audio로 합성합니다.

- 배포: https://richroro.github.io/success-anime/
- 쇼츠: https://richroro.github.io/success-anime/shorts.html
- 빌드 없음. `engine.js`(캐릭터·배경·효과·사운드) + `index.html`(가로 재생기) + `shorts.html`(세로 쇼츠) + `episodes.js`(대본).

## 에피소드

여덟 편은 모두 이야기를 푸는 방식이 다릅니다. 연도·숫자·사건은 자서전·인터뷰·공시로 공개된 사실만 썼고, 대사와 장면 설정(포장마차의 밤, 전단지의 시점, 가상의 고객 등)은 각색입니다. 실제 발언으로 널리 알려진 말만 `quote: true`로 표시해 화면에 ★실제 발언이 붙습니다.

| 화 | 제목 | 인물 | 이야기 방식 |
| --- | --- | --- | --- |
| 1 | 소 한 마리, 소 천 마리 | 정주영 (현대) | 액자식: 1998년 판문점 → 66년 전 소 판 돈 70원 → 다시 판문점 |
| 2 | 포장마차의 밤 | 서정진 (셀트리온) | 하룻밤: 실직한 대우 사람들의 술자리, 밤 9시 → 새벽 1시 → 13년 뒤 |
| 3 | 1998과 2010 | 김범수 (한게임·카카오) | 교차 편집: 카카오톡 사무실과 PC방을 번갈아 |
| 4 | 나는 전단지다 | 김봉진 (배달의민족) | 사물의 시점: 나레이터가 전단지 |
| 5 | 실패 일지 | 이승건 (토스) | 일지 #1 ~ #8의 실패, #9에서 바뀌는 이야기 |
| 6 | STAGE 4 | 장병규 (네오위즈·첫눈·크래프톤) | 게임 스테이지: STAGE 1 · 2 · 3(보스: 적자) · FINAL |
| 7 | 같은 게임, 두 나라 | 권혁빈 (스마일게이트) | 거울 구조: 같은 게임에 대한 한국과 중국 PC방 |
| 8 | 밤 10시 반부터 아침 7시까지 | 김슬아 (마켓컬리) | 고객의 하룻밤: 주인공은 가상의 고객, 창업자는 조연 |

## 새 에피소드 추가하기

`episodes.js`의 `EPISODES` 배열에 객체 하나를 붙이면 목록·재생·연표에 자동으로 들어갑니다.

```js
{
  id: 'myhero', title: '제목', person: '이름', company: '회사', years: '1970 –',
  color: '#ff4d6d', mood: 'hope',            // brave | hope | bright (배경음 분위기)
  logline: '한 줄 소개',
  cast: {
    me: { name: '이름', hair: '#111', style: 'short', outfit: 'suit', color: '#333', tie: '#c92a2a', eye: '#3b2a1a', age: 'adult', glasses: false }
  },
  scenes: [
    { chapter: '장 제목', kicker: '밤 11시', past: false, bg: 'office', time: 'night', year: '2010 · 서울', cast: ['me'], fx: 'rain', beats: [
      { n: '나레이션' },
      { who: 'me', face: 'determined', t: '대사', fx: 'speed', big: '화면 가운데 큰 글씨' }
    ]}
  ],
  hook: '쇼츠 첫 화면 한 줄',
  narrator: '전단지',                       // 나레이션 이름표 (없으면 생략)
  ending: '마지막 화면에 남는 한 줄',
  lessons: [['교훈', '설명', 0, '보통 사람의 방식']],  // 장면 번호(0부터), VS·착각 깨기용 대비 문장
  timeline: [['2010', '사건']],
  sources: '출처'
}
```

- 배경 `bg`: village, riceshop(`sign`으로 간판 글씨 변경), garage, office, bank, shipyard, city, street, room, pcbang, lab, sea, stage, classroom, cafe, border(판문점), pojang(포장마차), warehouse(물류센터)
- `chapter`/`kicker`: 장면 앞에 뜨는 장 제목 카드, `past: true`: 회상(세피아 톤)
- 시간 `time`: dawn, day, dusk, night
- 머리 `style`: short, spiky, part, bowl, long, bun, gray, bald / 옷 `outfit`: suit, shirt, hanbok, hoodie, apron, coat, gown, jacket
- 표정 `face`: normal, smile, laugh, shock, angry, sad, determined, think, cry
- 효과 `fx`: flash, shake, speed, sparkle, money, fire, rain, paper, petal, zoom

## 대본 편집기

페이지 아래 ‘내 성장기도 애니로’에서 코드 없이 텍스트 대본으로 에피소드를 만들 수 있습니다. 인물 생김새는 이름으로 자동 결정되고, ‘링크 복사’를 누르면 대본이 URL(`#s=...`)에 담겨 그대로 공유됩니다.

```
제목: 나의 첫 창업
@ 원룸 밤 2024 · 서울
퇴근 후 매일 밤 두 시간.
나[결의]: 오늘도 한 줄이라도 쓰자.
!번쩍 첫 매출 12,900원
배움: 작게, 매일 | 하루 두 시간이 3년이면 2,000시간
```

특정 화로 바로 가는 링크: `/success-anime/#ep=chung` (chung, seo, kim, baemin, toss)

## 쇼츠 (9:16)

`shorts.html`은 같은 대본을 세로 1분 영상으로 다시 편집합니다.

편마다 구성이 겹치지 않도록 형식이 여러 가지입니다. 컷은 자동으로 고릅니다. 모든 장면에서 최소 한 컷을 남기고, 남는 시간은 큰 글씨·실제 발언·대사처럼 초당 가치가 높은 컷에 씁니다.

**요약 쇼츠** (40~55초, `format`으로 지정). 교훈 요약 대신 이야기의 마지막 한 줄(`ending`)로 끝나고, 장 제목이 있는 장면 앞에는 장 제목 카드가 들어갑니다.

| 형식 | 흐름 | 편 |
| --- | --- | --- |
| `cold` 결말부터 | 클라이맥스를 영화처럼 위아래 검은 띠로 먼저 → ◀◀ 연도 되감기 → 세피아 톤 회상 → ▶ 현재로 → 결말 | 정주영, 김슬아 |
| `quiz` 누구일까? | 실루엣 → 힌트 3개(이름·회사·제품명 가림, `quizHide`로 추가) → 3·2·1 → 정답 공개 | 김봉진, 장병규 |
| `numbers` 숫자로 보기 | 연표 연도가 굴러가는 카운터와 숫자 큰 글씨(1,001마리, 40억 달러)가 장면 사이에 | 서정진, 이승건 |
| `manga` 만화 컷 | 망점 종이 위에 칸이 하나씩 붙는 만화 페이지, 대사는 말풍선, 효과는 의성어 | 김범수, 권혁빈 |
| `chronicle` 연대기 | 표지 → 장면 순서대로 → 요약 | 기본값 |

**레슨 쇼츠** (20~35초, 교훈마다 1편, 편마다 순서가 돌아감)

| 형식 | 흐름 |
| --- | --- |
| 장면 | 공식 표지 → 그 장면(`lessons[n][2]`) → 교훈 카드 |
| VS | 위 "보통은…"(`lessons[n][3]`) VS 아래 "정주영은…" → 그 장면 |
| 착각 깨기 | ✕ 흔한 착각에 줄 긋기 → 이 사람의 방식 → 그 장면 → 도장 쾅 |
- 긴 나레이션은 문장 단위로 잘라 읽을 수 있는 속도(약 초당 11자)로 자막을 넘깁니다.
- 주소: `shorts.html?ep=chung&k=story`, `shorts.html?ep=chung&k=2`. `&rec=1`은 화면 전체를 9:16으로 채우는 녹화용 모드.

## 쇼츠 MP4

### MP4로 뽑기

```bash
python3 -m http.server 8765                          # 저장소 루트에서
npm i playwright
node success-anime/tools/render-shorts.js out/ all   # 32편 전부
node success-anime/tools/render-shorts.js out/ toss/story kurly/2
```

1080×1920 · 30fps · H.264 + AAC. 화면은 크롬 스크린캐스트로 실제 시간대로 뜨고, 배경음·효과음은 재생 중 남긴 효과 기록을 `OfflineAudioContext`로 다시 합성합니다. ffmpeg가 PATH에 있어야 합니다(`FFMPEG=/경로/ffmpeg`로 지정 가능).
