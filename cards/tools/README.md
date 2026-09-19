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
