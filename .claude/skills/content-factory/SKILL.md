---
name: content-factory
description: 1인 콘텐츠 공장 실행 — content-factory/ideas/ 의 아이디어 메모를 리서치·블로그·뉴스레터·유튜브·쇼츠·SNS 원고로 직접 작성하고 렌더·커밋한다. "콘텐츠 공장 돌려줘", "원고 만들어줘", "새 아이디어 처리해줘", 아이디어 메모를 주며 글을 만들어 달라고 할 때 사용.
---

# 콘텐츠 공장 실행 (Claude Code 가 직접 작성)

API 키 없이, 이 세션의 Claude 가 원고를 쓴다. 스크립트는 지침 출력·검증·렌더만 한다.

## 순서

1. **메모 확보** — 사용자가 채팅으로 아이디어를 주면 `content-factory/ideas/<영문-소문자-하이픈>.md` 로 먼저 저장한다.
   형식: 맨 위 `---` 사이에 `title:`, `audience:`, (선택) `tone:` / 그 아래 자유 메모.
   사용자가 준 내용만 옮긴다. 메모를 부풀리지 않는다.
2. **대기 목록과 지침 보기**
   ```
   python3 content-factory/factory.py --brief
   ```
   특정 메모를 다시 쓸 때는 `--brief --only <이름>`.
   출력의 "작성 지침"과 JSON 형식을 그대로 따른다. 이 지침이 원고 규칙의 기준이다(`factory.py` 의 `SYSTEM`, `SCHEMA_HINT`).
3. **원고 작성** — 아이디어마다 JSON 한 개를 스크래치 경로에 쓴다(저장소 밖).
   - 리서치 → 생성 → 디자인 순서로 생각한다. 웹 검색 도구가 있으면 경쟁 글·용어 확인에 써도 되지만,
     **검색량·통계 수치는 확인한 출처가 없으면 쓰지 않는다.**
   - 채널마다 문장을 새로 쓴다(복붙 금지). 블로그 1,800~3,000자, 뉴스레터 800~1,500자, 유튜브 8~10분, 쇼츠 3개, SNS 3개(threads·instagram·linkedin).
   - 뉴스레터 본문에 `{{BLOG_URL}}` 을 한 번 넣는다. 유튜브 설명란·링크드인 글의 블로그 링크는 `https://richroro.github.io/blog/<slug>/` 그대로 쓴다(UTM 은 스크립트가 붙인다).
4. **검증·반영·렌더**
   ```
   python3 content-factory/factory.py --ingest <json 경로> --idea <메모 이름>
   ```
   검증 실패 메시지가 나오면 JSON 을 고쳐 다시 넣는다. 썸네일 PNG 는 Pillow 와 한글 글꼴이 있을 때 생성된다
   (`pip install pillow`; 없으면 사이트 기본 og.png 로 대체되며 GitHub Actions 가 머지 후 다시 그린다).
5. **자가 검토** — `content-factory/out/<slug>/` 의 파일과 `blog/<slug>/index.html` 을 훑어 사실 오류·과장·빈 칸이 없는지 본다.
6. **커밋·푸시** — 세션의 개발 브랜치 규칙을 따른다. 커밋 메시지: `콘텐츠 공장: <블로그 제목>`.
   바뀌는 경로: `content-factory/ideas`, `content-factory/out`, `blog`, `sitemap.xml`.
7. **보고** — 사용자에게 블로그 제목·URL, 뉴스레터 제목, 유튜브 제목을 짧게 알리고
   대시보드 `https://richroro.github.io/content-factory/` 에서 복사할 수 있다고 안내한다.

## 하지 말 것

- 메모에 없는 경험담·사례·인용을 사실처럼 쓰기
- 과장된 수익 약속, 낚시 제목
- 블로그 하단 AI 활용 표시 제거 (렌더러가 자동으로 붙인다)
