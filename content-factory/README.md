# 1인 콘텐츠 공장

『AI로 1인 콘텐츠 공장 만들기』(정민제)의 6단계 파이프라인을 이 사이트에 옮겨 만든 것.
아이디어 메모 한 장 → 블로그·뉴스레터·유튜브·쇼츠·SNS 5채널 원고.

- 대시보드: https://richroro.github.io/content-factory/
- 블로그: https://richroro.github.io/blog/ (RSS: `/blog/feed.xml`)

| 단계 | 누가 | 여기서 하는 일 |
| --- | --- | --- |
| ① 아이디어 | 사람 | `ideas/<이름>.md` 메모 (대시보드의 "GitHub에 메모 올리기"로도 가능) |
| ② 리서치 | Claude Code | 핵심·보조 키워드, 검색 의도, 이 글만의 각도, 제목 후보 → `out/<slug>/research.md` |
| ③ 생성 | Claude Code | 블로그 · 뉴스레터 · 유튜브 대본(장면별 화면 지시) · 쇼츠 3 · SNS 3 |
| ④ 디자인 | 코드 | 1200×630 공유 썸네일 `blog/<slug>/og.png` 자동 생성 + 이미지 도구용 프롬프트 |
| ⑤ 발행 | 코드 | `/blog/<slug>/` 게시, 목록·RSS·사이트맵 갱신. 뉴스레터는 스티비·메일리 RSS 발송에 연결 |
| ⑥ 분석 | 코드 | 채널별 UTM 링크, `FACTORY_GA4_ID` 가 있으면 블로그에 GA4 삽입 |

## 실행 방식 — Claude Code 가 직접 쓴다 (기본)

API 키가 필요 없다. Claude Code(웹·앱·CLI)에서 이 저장소를 열고:

1. 메모를 `content-factory/ideas/` 에 올리거나(대시보드의 "GitHub에 메모 올리기"), 채팅에 아이디어를 바로 말한다.
2. **"콘텐츠 공장 돌려줘"** 라고 한다.
3. Claude 가 `.claude/skills/content-factory/SKILL.md` 절차대로
   `factory.py --brief` 로 지침을 읽고 → 원고 JSON 을 쓰고 → `factory.py --ingest` 로 검증·렌더 → 커밋·푸시한다.

main 에 반영되면 "콘텐츠 공장" 워크플로가 블로그·RSS·썸네일(한글 글꼴)을 다시 렌더해 커밋한다.

```
python content-factory/factory.py --brief                          # 원고가 없는 메모 + 작성 지침
python content-factory/factory.py --ingest x.json --idea <메모이름>  # 원고 검증 → out/ 반영 → 렌더
python content-factory/factory.py --render-only                    # 페이지만 다시 만듦
python content-factory/factory.py --mock                           # 가짜 원고로 파이프라인 점검
```

## (선택) 완전 무인 — API 키

Settings → Secrets and variables → Actions → Secrets 에 `ANTHROPIC_API_KEY` 를 넣으면, 메모를 커밋하기만 해도
워크플로가 API 로 원고까지 만든다(모델 기본 `claude-opus-5`, `FACTORY_MODEL` 로 변경). Variables 에
`FACTORY_GA4_ID`(예: `G-XXXXXXX`) 를 넣으면 블로그에 GA4 가 붙는다.

## 원칙 (코드에 박아 둔 것)

- 채널마다 역할이 다르다. 문장 복붙 금지.
- 메모에 없는 통계·고유명사·인용을 지어내지 않는다. 검색량도 추정하지 않는다.
- 과장된 수익 약속·낚시성 제목 금지.
- 블로그 글마다 **AI 활용 표시** (인공지능기본법 대응). 유튜브 원고에는 합성 콘텐츠 공개 항목 확인 안내.

첫 글(`one-idea-five-channels`)은 이 방식(Claude Code 직접 작성)으로 만들었다.
