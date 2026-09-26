# 성공 애니 · 맨손에서 시작한 사람들

한국 창업가들의 성장기를 애니메이션으로 보는 페이지. 그림·영상 파일 없이 캐릭터·배경·효과를 전부 SVG/캔버스 코드로 그리고, 소리는 Web Audio로 합성합니다.

- 배포: https://richroro.github.io/success-anime/
- 빌드 없음. `index.html`(재생기) + `episodes.js`(대본) 두 파일.

## 에피소드

| 화 | 제목 | 인물 |
| --- | --- | --- |
| 1 | 이봐, 해봤어? | 정주영 (현대) |
| 2 | 마흔셋, 실업자의 바이오 | 서정진 (셀트리온) |
| 3 | PC방 사장의 국민 메신저 | 김범수 (한게임·카카오) |
| 4 | 전단지를 줍던 디자이너 | 김봉진 (배달의민족) |
| 5 | 여덟 번 실패한 치과의사 | 이승건 (토스) |

연도·숫자·사건은 자서전·인터뷰·공시로 공개된 사실만 썼고, 대사는 각색입니다. 실제 발언으로 널리 알려진 말만 `quote: true`로 표시해 화면에 ★실제 발언이 붙습니다.

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
    { bg: 'office', time: 'night', year: '2010 · 서울', cast: ['me'], fx: 'rain', beats: [
      { n: '나레이션' },
      { who: 'me', face: 'determined', t: '대사', fx: 'speed', big: '화면 가운데 큰 글씨' }
    ]}
  ],
  lessons: [['교훈', '설명']],
  timeline: [['2010', '사건']],
  sources: '출처'
}
```

- 배경 `bg`: village, riceshop(`sign`으로 간판 글씨 변경), garage, office, bank, shipyard, city, street, room, pcbang, lab, sea, stage, classroom, cafe
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
