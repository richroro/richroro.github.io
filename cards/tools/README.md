# 카드뉴스 렌더러

콘텐츠 JSON 한 장으로 1080×1350 카드 이미지를 만든다.

```bash
node cards/tools/render.mjs cards/tools/content/0006-younger-me.json
# -> cards/0006-younger-me/01_cover.png ... 12_outro.png
```

출력 경로는 JSON의 `slug`를 따른다. 두 번째 인자로 다른 폴더를 넘기면
커밋 전에 미리보기만 뽑아볼 수 있다.

## 준비물

- Node 18+ 와 `playwright` (프로젝트 또는 전역 설치 둘 다 인식한다)
- `pngquant` (선택). 있으면 카드 한 장을 90KB 안팎으로 줄인다.

손글씨 폰트(Gaegu)와 본문 폰트(Noto Sans KR)는 첫 실행 때 Google Fonts에서
`cards/tools/.fonts/`로 내려받는다. 이 폴더는 커밋하지 않는다.

## 콘텐츠 JSON

`lists` 항목 하나가 카드 한 장이다. 제목 길이에 따라 글자 크기가 자동으로
한 단계씩 줄어들기 때문에, 제목은 20자 안쪽으로 쓰는 편이 안전하다.

```json
{
  "slug": "0006-younger-me",
  "brand": "삶의 문장 노트",
  "cover": { "eyebrow": "...", "title": ["1행", "2행"], "sub": ["1행", "2행"],
             "footL": "...", "footR": "..." },
  "lists": [
    { "title": "제목", "items": ["1", "2", "3"], "note": "아래 작은 글씨" }
  ],
  "outro": { "title": ["1행", "2행"], "sub": ["1행", "2행"], "button": "..." }
}
```

## 쇼츠

같은 콘텐츠 JSON으로 유튜브 쇼츠용 영상을 만든다.

```bash
node cards/tools/shorts.mjs cards/tools/content/0006-younger-me.json
# -> cards/0006-younger-me/shorts.mp4  (1080x1920, 30fps, H.264 + AAC)
```

카드를 9:16으로 다시 뽑아서 한 장씩 옆으로 밀어 넘기고(xfade slideleft),
직접 합성한 잔잔한 BGM을 깔아 인코딩한다. 체류 시간은 `shorts.mjs` 위쪽의
`COVER`/`LIST`/`OUTRO`/`SLIDE` 상수로 조절한다.

9:16 프레임은 1080×1350 카드를 그대로 가운데에 놓고 배경만 위아래로 늘린
형태다. 유튜브 UI가 위아래를 가리기 때문에 글자는 안전 영역 안에 머무르고,
페이지 번호(오른쪽 버튼에 가린다)는 이 모드에서만 숨긴다.

- `ffmpeg` (libx264 + aac) 필요. 우분투는 `apt-get install ffmpeg`.
- BGM은 `bgm.py`가 numpy로 그때그때 합성한다(`pip install numpy`).
  느린 피아노 발라드로, C–G/B–Am–Am/G–F–C/E–Dm7–G 하행 베이스 진행에
  8분음표 분산화음 반주와 성긴 멜로디를 얹었다. 템포는 영상 길이에 맞춰
  56~74 BPM 사이에서 정해지고, 마스터는 약 -20 LUFS다.

  샘플도 학습된 모델도 쓰지 않고 파형부터 합성한다. AI 음악 모델을 쓰지
  않은 이유는 라이선스다 — MusicGen 가중치는 CC-BY-NC라 수익화 채널에
  쓸 수 없다. 직접 합성한 소리는 그런 제약이 없다.

  피아노 음색은 현의 강성 때문에 배음이 정수배보다 높게 뜨는 성질
  (`stiffness`)과, 높은 배음이 먼저 사라지는 감쇠 차이를 흉내 낸 것이다.
  이 둘이 없으면 그냥 오실레이터 소리가 난다. 잔향은 감쇠하는 노이즈와의
  컨볼루션이다. 지연 탭 몇 개로 대신하면 피아노에서는 잔향이 아니라
  또렷한 메아리로 들린다.

## 정보형 인포그래픽 (세로로 긴 한 장)

```bash
node cards/tools/infographic.mjs cards/tools/content/0007-100m.json
# -> cards/0007-100m/poster.png  (1080 × 높이 자동)
```

헤더(스티커 + 제목 + 부제) / 행 목록 / 하단 고지 구조다. 행마다 왼쪽 썸네일
슬롯이 있는데, `image`에 로컬 경로를 주면 사진이 들어가고 없으면 순번이
들어간다. **사진 없이도 성립하도록** 만든 것이라, 확보한 이미지가 생기면
그때 경로만 넣으면 된다.

제목은 첫 줄을 Gothic A1 ExtraBold, 둘째 줄을 Black Han Sans로 쓴다.
Black Han Sans는 획이 굵어서 두 줄 다 쓰면 속공간이 메워져 뭉개진다.
강조할 한 줄에만 쓰는 편이 읽힌다.

### 숫자를 다룰 때

`0007-100m.json`의 기간 값은 적립식 복리 공식으로 계산한 뒤
월별 적립 시뮬레이션으로 교차 검증한 것이다(월 50만원 → 154개월,
그 시점 잔고 100,413,855원). 손으로 적은 값이 아니다.

수치가 들어가는 콘텐츠는 하단 고지(`note`)에 **계산 전제**를 반드시 적는다.
위 카드의 경우 목표 금액, 이율과 복리 주기, 빠뜨린 것(세금·수수료·물가)이다.
전제를 숨긴 숫자는 틀린 숫자와 같다.
