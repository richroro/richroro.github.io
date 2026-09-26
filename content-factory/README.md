# 1인 콘텐츠 공장

『AI로 1인 콘텐츠 공장 만들기』(정민제)의 6단계 파이프라인을 이 사이트에 옮겨 만든 것.
아이디어 메모 한 장 → 블로그·뉴스레터·유튜브·쇼츠·SNS 5채널 원고.

- 대시보드: https://richroro.github.io/content-factory/
- 블로그: https://richroro.github.io/blog/ (RSS: `/blog/feed.xml`)

| 단계 | 누가 | 여기서 하는 일 |
| --- | --- | --- |
| ① 아이디어 | 사람 | `ideas/<이름>.md` 메모 (대시보드의 "GitHub에 메모 올리기"로도 가능) |
| ② 리서치 | Claude | 핵심·보조 키워드, 검색 의도, 이 글만의 각도, 제목 후보 → `out/<slug>/research.md` |
| ③ 생성 | Claude | 블로그 · 뉴스레터 · 유튜브 대본(장면별 화면 지시) · 쇼츠 3 · SNS 3 |
| ④ 디자인 | 코드 | 1200×630 공유 썸네일 `blog/<slug>/og.png` 자동 생성 + 이미지 도구용 프롬프트 |
| ⑤ 발행 | 코드 | `/blog/<slug>/` 게시, 목록·RSS·사이트맵 갱신. 뉴스레터는 스티비·메일리 RSS 발송에 연결 |
| ⑥ 분석 | 코드 | 채널별 UTM 링크, `FACTORY_GA4_ID` 가 있으면 블로그에 GA4 삽입 |

## 켜는 법

1. 저장소 Settings → Secrets and variables → Actions → **Secrets** 에 `ANTHROPIC_API_KEY`
2. (선택) 같은 화면 **Variables** 에 `FACTORY_GA4_ID` (예: `G-XXXXXXX`)
3. `content-factory/ideas/` 에 메모를 커밋하면 "콘텐츠 공장" 워크플로가 돌아 원고를 커밋한다.
   Actions 탭에서 수동 실행(특정 아이디어 재생성: `only`)도 된다.

키가 없으면 생성은 건너뛰고 렌더만 한다.

## 로컬 실행

```
pip install anthropic pillow
python content-factory/factory.py                # 새 아이디어 생성 + 렌더
python content-factory/factory.py --only <이름>  # 다시 생성
python content-factory/factory.py --render-only  # API 없이 페이지만
python content-factory/factory.py --mock         # 가짜 원고로 파이프라인 점검
```

모델은 기본 `claude-opus-5` (`FACTORY_MODEL` 로 변경). 원고 규칙은 `factory.py` 의 `SYSTEM` 에 있다.

## 원칙 (코드에 박아 둔 것)

- 채널마다 역할이 다르다. 문장 복붙 금지.
- 메모에 없는 통계·고유명사·인용을 지어내지 않는다. 검색량도 추정하지 않는다.
- 과장된 수익 약속·낚시성 제목 금지.
- 블로그 글마다 **AI 활용 표시** (인공지능기본법 대응). 유튜브 원고에는 합성 콘텐츠 공개 항목 확인 안내.

첫 글(`one-idea-five-channels`)은 API 키 연결 전이라 세션에서 같은 스키마로 직접 작성해 넣었다.
