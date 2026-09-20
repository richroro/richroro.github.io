# Cadence

업무 자동화 스튜디오 랜딩과, 직접 만들어 본 도구들. <https://richroro.github.io>

브랜드 이름은 **Cadence** 하나로 씁니다. 새 페이지를 만들 때 제목·OG·푸터를 여기에 맞춰 주세요.
(푸터의 `사업자명 선웨이브(Sunwave)` 는 브랜드가 아니라 사업자등록상의 상호라 그대로 둡니다.)

## 이 저장소에서 혼자 쌓이는 것

`.github/workflows/update-real-estate.yml` 이 매일 06:10 KST 에 국토교통부 실거래가를 받아
`real-estate/data/` 에 커밋합니다. 손대지 않아도 하루에 한 줄씩 늘어나는 유일한 자산이고,
**지난 날짜는 나중에 다시 만들 수 없습니다.**

돌리려면 인증키 하나만 등록하면 됩니다 — `real-estate/README.md` 의 "자동 수집 설정" 참고.

## 측정

`assets/analytics.js` 한 파일을 15개 페이지가 전부 불러 씁니다.
맨 위 `MEASUREMENT_ID` 에 GA4 측정 ID 를 넣는 순간 전부 켜지고, 비어 있으면 아무 요청도 안 나갑니다.

페이지 안에서는 `track('이벤트이름', { 키: 값 })` 으로 씁니다.
랜딩 문의 폼은 `quote_submit` 에 자동화 종류와 예산을 같이 실어 보냅니다 —
같은 종류가 세 번 쌓이면 그건 용역이 아니라 제품이라는 신호입니다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `index.html` | Cadence 랜딩 (문의 폼 → formsubmit.co → 메일) |
| `assets/` | 모든 페이지가 공유하는 스크립트 |
| `m7/` | 매그니피센트 7 지표 노트 |
| `tesla/`, `tesla-metrics/`, `china-ev/`, `salary-rank/` | 주식·급여 참고 페이지 |
| `real-estate/` | 신고가 장부 + 실거래가 수집기 |
| `video-editor/` | 웹컷 — 브라우저 안에서만 도는 영상 편집기 |
| `games/`, `roblox/` | 티끌모아 태산, 티끌 타이쿤 |
| `cards/` | 카드뉴스 이미지 |
