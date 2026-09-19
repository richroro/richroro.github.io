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
  샘플을 쓰지 않고 직접 만든 소리라 저작권 문제 없이 업로드할 수 있다.
  Am–F–C–G 패드에 펜타토닉 벨음을 띄엄띄엄 얹은 구성이고, 영상 길이에 맞춰
  길이가 정해진다.
