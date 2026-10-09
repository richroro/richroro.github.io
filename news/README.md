# 해외 경제 브리핑 — 영어 경제뉴스를 한국어로

해외 주요 매체의 영어 경제뉴스를 모아 한국어로 옮겨 보여 주는 정적 사이트.

- **수집 매체**: CNBC, MarketWatch, WSJ, Financial Times, Bloomberg, BBC, The Guardian, New York Times,
  The Economist, Nikkei Asia, CoinDesk, 미 연준 보도자료, Google News(로이터 등 모음) — `feeds.json`
- **한국어 번역**: 기사 제목을 무료 기계 번역으로 옮긴다(키 필요 없음). Claude API 키를 넣으면 제목·요약을 Claude 로 옮긴다. 화면에서 한국어 ↔ 영어 원문을 바꿔 볼 수 있고,
  한국어로 볼 때도 영어 원문 제목을 작게 함께 보여 준다.
- **같은 사건은 하나로 묶는다.** 매체마다 제목이 달라도("Fed holds rates steady…" / "Federal Reserve keeps interest
  rates unchanged…") 한 줄로 모으고, 다른 매체 기사는 그 아래 관련 기사로 단다.
- **주요 뉴스**는 여러 매체가 함께 다룬 순서로 고른다.
- 분야 탭(증시·금리·물가·기업·테크·무역·국제·원자재·부동산·가상자산), **한국 관련** 탭(한국·삼성·SK하이닉스·현대차·
  코스피·원화가 나오는 기사), 한국어·영어 검색, 매체·날짜 고르기, 최근 30일 지난 뉴스.
- 많이 나온 말(같은 사건은 한 번만 센다), 분야·매체별 기사 수, 피드 수집 상태.
- 시장 지표 띠: S&P 500·나스닥·다우·미 국채 10년·달러 인덱스·원/달러·유로/달러·달러/엔·WTI·금·닛케이·코스피·비트코인.
- 기사 저장(☆), 읽은 기사 흐리게, 주소로 화면 공유(#cat=macro&q=Fed), 새 기사 알림 단추, 다크 모드.

배포: https://richroro.github.io/news/

## 어떻게 돌아가나

서버가 없다. 깃허브 액션(`.github/workflows/update-news.yml`)이 06~23시(한국 시각) 매시 17분에
`fetch_news.py` 를 돌려 결과를 `news/data/` 에 커밋하고, GitHub Pages 가 그대로 내보낸다. 바뀐 게 없으면 커밋하지 않는다.

```
news/feeds.json              수집할 RSS 와 시장 지표 목록 — 여기만 고치면 된다
news/fetch_news.py           수집기 (번역을 빼면 파이썬 표준 라이브러리만 사용)
news/free_translate.py       한국어 번역 — 기본, 제목만, 키 없이 (표준 라이브러리)
news/translate.py            한국어 번역 — ANTHROPIC_API_KEY 가 있을 때, 제목·요약 (anthropic 패키지)
news/data/index.json         갱신 시각, 날짜 목록, 피드 상태, 24시간 키워드
news/data/days/2026-10-06.json  그날(한국 시각) 기사 — 최신순, 최대 900건
news/data/markets.json       시장 지표 (Yahoo Finance)
news/index.html, app.js      페이지
```

## 한국어 번역

**기본: 무료 기계 번역, 제목만.** 키가 필요 없다. Google 번역 웹이 쓰는 공개 주소(translate.googleapis.com,
`client=gtx`)로 제목을 줄바꿈으로 이어 한 번에 보내고, 돌아온 번역을 줄 단위로 나눈다(줄 수가 어긋나면 하나씩 다시).
공식 API 가 아니라 막히거나(429) 바뀔 수 있다. 막히면 그 실행은 멈추고, 영어로 남은 제목은 다음 실행에서 다시 옮긴다.
요약은 영어 원문 그대로 둔다. 묶는 범위(최근 3일) 안의 안 옮긴 제목을 한 번에 최대 900개까지 옮긴다.

**선택: Claude 로 제목·요약.** 아래처럼 키를 넣으면 무료 번역 대신 Claude 를 쓴다.

1. [Claude Console](https://platform.claude.com) 에서 API 키를 만든다.
2. 저장소 **Settings → Secrets and variables → Actions → New repository secret** 에
   이름 `ANTHROPIC_API_KEY`, 값은 1번의 키.
3. Actions 탭에서 "해외 경제뉴스 자동 수집" 을 Run workflow 로 한 번 돌려 확인한다.

- 모델은 기본 `claude-opus-5-5` (effort `low`). 바꾸려면 같은 화면 **Variables** 탭에 `NEWS_TRANSLATE_MODEL` 을 넣는다.
- 한 번 실행에 최근 36시간 안의 새 기사만, 최대 240건까지 옮긴다(`TRANSLATE_LIMIT`). 25건씩 묶어 한 번에 보낸다.
- 번역이 실패한 기사는 영어로 두고 다음 실행에서 다시 옮긴다. 거절(refusal)되면 서버가 다른 모델로 다시 돌린다(`fallbacks: "default"`).
- 화면에 "AI 가 자동으로 옮긴 것" 이라는 안내가 뜬다.

## 수집기가 하는 일

1. `feeds.json` 의 피드를 차례로 받는다. 실패한 피드는 건너뛰고(상태에 기록), 이미 모은 기사는 그대로 둔다.
   인코딩이 다른 피드, `&` 가 이스케이프 안 된 깨진 XML 도 읽는다.
2. 제목·요약을 손질하고(HTML 제거, 요약 240자), 링크의 추적 변수(utm_ 등)를 떼어 같은 기사를 알아본다.
   Google News 는 "제목 - 매체" 에서 매체를 떼어 내고, 직접 받은 기사와 겹치면 버린다.
3. 분야는 제목·요약의 영어 낱말로 정한다(`CATEGORIES`). 못 정하면 피드의 `hint`.
4. 최근 3일치 기사를 다시 묶는다. 제목 낱말·낱말 쌍을 흔한 정도로 가중한 유사도를 보되(rise/jump/surge,
   Federal Reserve/Fed 같은 말은 하나로), **숫자가 엇갈리거나**(3% vs 5%) **주인공 이름이 하나도 겹치지 않으면**
   (Apple vs Tesla) 비슷해도 떼어 놓는다. 테스트에 실제 헤드라인 쌍 19개가 있다.
5. 키가 있으면 아직 안 옮긴 기사를 한국어로 옮긴다.

## 로컬에서

```
python news/fetch_news.py --no-translate     # 받기만 (news/data 에 씀)
python -m unittest discover -s news/tests    # 테스트 (네트워크 없이 tests/fixtures 사용, 번역 테스트는 anthropic 필요)
python -m http.server -d .                   # http://localhost:8000/news/
```

## 저작권

제목과 짧은 요약, 원문 링크만 보여 준다. 기사 저작권은 각 매체에 있고, 기사를 누르면 매체 원문으로 간다.
