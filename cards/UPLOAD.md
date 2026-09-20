# 업로드 목록

각 폴더의 `upload.md`에 제목·설명·태그가 들어 있다.
영상은 `shorts-quiet.mp4`, 썸네일 후보는 `poster-quiet.png`.
장식을 얹은 이전 판은 `shorts-fit.mp4` / `poster-fit.png`로 남겨뒀다.

| 폴더 | 제목 | 테마 |
|---|---|---|
| `0007-100m` | 매달 50만원 모으면 1억까지 몇 년? | paper |
| `0008-apt` | 전국에서 가장 비싼 아파트 1위, 325억 | noir |
| `0009-minwage` | 10년 전 최저시급, 기억하세요? | press |
| `0010-kbo` | 프로야구 구단 평균 연봉 1위는? | paper |
| `0011-salary` | 상반기에만 1억 8천만원 받는 회사 | noir |
| `0012-seoul-pyeong` | 서울에서 평당 9천만원 넘는 동네 | noir |
| `0013-loan` | 1억 빌리면 매달 얼마 갚을까 | mint |
| `0014-double` | 내 돈이 2배 되는 데 몇 년 걸릴까 | mint |
| `0015-one-pyeong` | 최저임금으로 서울 한 평 사려면 | press |
| `0016-hourly` | 연봉 5천만원이면 시급 얼마일까 | mint |
| `0017-coffee` | 커피값 아끼면 30년 뒤 얼마 될까 | paper |
| `0018-lotto` | 로또 1등 되려면 몇 년을 사야 할까 | neon |
| `0019-billionaires` | 세계 1위 부자 재산, 1,204조원 | noir |
| `0020-tesla` | 테슬라는 한 분기에 몇 대나 팔까 | neon |


## 다시 만들려면

```bash
# 카드·영상
node cards/tools/infographic.mjs cards/tools/content/<슬러그>.json --quiet
node cards/tools/scrollshorts.mjs cards/tools/content/<슬러그>.json \
  --poster=cards/<슬러그>/poster-quiet.png --dur=20 --style=drive --out=shorts-quiet.mp4
# 업로드 메타데이터
node cards/tools/upload.mjs cards/tools/content/<슬러그>.json
```

제목과 태그는 콘텐츠 JSON의 `youtube` 항목에 있다. 거기만 고치고
`upload.mjs`를 다시 돌리면 설명까지 같이 갱신된다.

설명에는 카드 하단 고지 중 앞의 세 줄이 자동으로 들어간다.
출처와 기준일이 영상 밖에도 남아야 하기 때문이다. 시세처럼 움직이는
숫자는 기준이 빠지면 주장이 된다.
