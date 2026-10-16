# 쿠팡·네이버 제휴 쇼츠 공장

쿠팡 상품 주소(또는 검색어·카테고리)를 넣으면 **쿠팡 파트너스 API 공식 상품 이미지**로, 네이버 쇼핑커넥트 상품은
직접 넣은 상품 정보·사진으로 1080×1920 쇼츠와 업로드용 제목·설명·고정댓글을 만들어 이 브랜치에 커밋한다.
같은 상품이 두 곳에 다 있으면 영상 하나에 링크 두 개(쿠팡·네이버)를 같이 단다. 영상 형식은 `shorts/viral5` 에서 50만+ 벤치마크로 고른
**흰 카드**(흰 바탕 · 굵은 두 줄 제목 · 둥근 사진 · 아래 두 줄 자막 · 음성 없이 음악과 '뽁' 효과음)를 상품용으로 옮긴 것.

남의 쇼츠 영상(틱톡·샤오홍슈·유튜브 원본)은 쓰지 않는다 — 저작권 신고·재사용 콘텐츠 정책으로 채널이 먼저 위험해진다.
해외 인기 상품 쇼츠에서는 **구성**만 가져왔다: 1초 안에 문제·궁금증, 장면당 정보 하나, 사진의 다른 부분 확대, 가격 한 번, 마지막에 행동 유도.

## 처음 한 번

1. 쿠팡 파트너스 → 추가기능 → **Open API** 에서 Access Key / Secret Key 발급
2. 이 저장소 Settings → Secrets and variables → Actions → **New repository secret**
   - `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` (필수)
   - `ANTHROPIC_API_KEY` (선택 — 넣으면 Claude 가 상품 사진을 보고 문구를 쓴다. 없으면 상품명·가격으로 규칙대로)
3. 네이버 쇼핑커넥트: [브랜드커넥트](https://brandconnect.naver.com)에서 크리에이터 신청 → 스페이스 개설 때 유튜브 채널 연동 →
   상품마다 링크 발급 (API 가 없어서 링크·상품명·가격·사진은 요청 파일에 직접 넣는다)
4. 같은 화면 **Variables** 탭 (선택): `CHANNEL_NAME` (영상 왼쪽 위 채널 이름), `COUPANG_SUB_ID` (채널별 실적 구분)
5. 쿠팡 파트너스 활동 페이지에 유튜브 채널 주소 등록

## 한 편 만들기

`requests/<id>.json` 을 만들어 이 브랜치에 올리면 Actions(`쿠팡 파트너스 쇼츠 만들기`)가 돈다.

```jsonc
// 상품 하나 소개 (single) — API 에는 상품 번호 조회가 없어서, 검색어로 찾아 그 안에서 상품 번호를 맞춘다
{"urls": ["https://www.coupang.com/vp/products/9024123826?itemId=26462109251"], "keyword": "상품명 핵심어"}

// 카테고리 베스트 TOP 5 (rank) — 번호는 tools/coupang_api.py 의 CATEGORIES
{"category": 1014, "limit": 5}

// 검색어 TOP 5
{"keyword": "자취 주방용품", "limit": 5, "note": "자취생 대상으로"}

// 쿠팡 상품 + 같은 상품의 네이버 쇼핑커넥트 링크 (영상 하나에 링크 두 개)
{"urls": ["https://www.coupang.com/vp/products/9024123826"], "keyword": "상품명 핵심어",
 "naverLinks": {"9024123826": "https://naver.me/..."}}

// 네이버 쇼핑커넥트 상품 직접 넣기 (쿠팡 키 없어도 됨) — 사진은 coupang-shorts/images/ 에 올리거나 주소로
{"products": [{"name": "접이식 노트북 거치대", "price": 23900, "imageFile": "images/stand.jpg",
               "naver": "https://naver.me/...", "coupang": "https://link.coupang.com/a/..."}]}
```

`products` 에 상품을 여러 개 넣으면 TOP N(넣은 순서가 1위부터), 하나면 상품 소개 영상이 된다.

결과 (몇 분 뒤 같은 브랜치에 커밋됨, Actions 실행 화면 Artifacts 에서도 내려받기 가능)

| 파일 | 내용 |
| --- | --- |
| `data/<id>.json` | 상품명·가격·이미지·**플랫폼별 내 링크**(`links.coupang` / `links.naver`)·로켓배송 여부 |
| `specs/<id>.json` | 장면 문구 (손으로 고쳐 올리면 그 편만 다시 렌더) |
| `out/<id>.mp4` | 1080×1920 · 30fps · −14 LUFS 쇼츠 |
| `out/<id>.txt` | 유튜브 제목 · 설명(대가성 문구·링크·음악 출처·해시태그) · 고정댓글 · 유료 프로모션 체크 안내 |

## spec 고치기

```jsonc
{
 "title": ["설거지 끝나고", "이거 안 쓰면 손해"],   // 영상 내내 위에 고정 (한 줄 14자 안쪽)
 "music": "monkeys_spinning_monkeys",               // hyperfun / sneaky_snitch / scheming_weasel / hustle
 "beats": [
  {"p": "9024123826", "ko": "아직도 손으로 닦아요?", "sub": "(물때 30초 컷)", "zoom": [1.0, 1.1]},
  {"p": "9024123826", "ko": "버튼 한 번이면 끝", "zoom": [1.6, 1.8], "focus": [0.5, 0.3], "ring": [0.5, 0.3, 0.15]},
  {"p": "9024123826", "ko": "가격은 이 정도", "price": true},
  {"p": "9024123826", "ko": "제품 정보는 프로필 링크", "sub": "가격은 수시로 바뀌어요", "dur": 3.2}
 ]
}
```

`dur` 장면 길이(기본 2.7초) · `zoom` 확대 시작→끝 · `focus` 확대 중심(0~1) · `ring` 빨간 동그라미 · `tag` 왼쪽 위 말풍선(순위) · `price` 가격표(+로켓배송).

## 지키는 것

- 화면 오른쪽 위 광고 표시(**"광고 · 쿠팡 파트너스"** / **"광고 · 네이버 쇼핑커넥트"** / 둘 다면 **"광고 · 쿠팡·네이버 제휴"**)와
  아래 대가성 문구가 모든 프레임에 있다. 설명란 맨 위·고정댓글에는 쓴 플랫폼마다 한 줄씩.
  플랫폼은 그 편 상품들에 들어 있는 링크로 자동으로 정해진다 (spec 에 `"platforms": ["naver"]` 로 직접 정할 수도 있다).
- 네이버 쇼핑커넥트 대가성 문구는 공식 지정 문구를 확인하지 못해 쿠팡 문구와 같은 틀로 썼다. 브랜드커넥트 안내에
  정해진 문구가 있으면 `tools/platforms.py` 한 곳만 고치면 된다.
- 직접 넣는 상품 사진은 직접 찍은 사진이나 판매자가 홍보용으로 허락한 사진만 쓴다 (저장소가 공개라 그대로 보인다).
- 같은 상품이라도 쿠팡·네이버 가격이 다를 수 있다 — 화면 가격표는 data 의 `price` 하나만 보여주고, 설명란에 "판매처마다 다름" 을 적는다.
- 업로드할 때 유튜브 **유료 프로모션 포함** 체크.
- 문구는 상품명·사진·가격에서 확인되는 사실만 (효능·최저가·판매 1위·사용 후기 표현 금지). rank 순위는 "쿠팡 베스트/검색 기준" 이라고 밝힌다.
- 쇼츠 설명·댓글 링크는 눌리지 않을 수 있다 → 채널 프로필 링크(링크 모음)에도 같은 링크를 둔다.
- 음악은 Kevin MacLeod (CC BY 4.0) — 설명란 출처 줄을 지우지 않는다. 글꼴 Pretendard (OFL).
- 쿠팡 상품 이미지는 파트너스 API 가 주는 것만 쓴다. 이미지 파일은 저장소에 올리지 않는다(`.cache/`).

## 로컬에서

```bash
coupang-shorts/tools/assets.sh                         # 글꼴·음악 → .assets/
COUPANG_ACCESS_KEY=… COUPANG_SECRET_KEY=… python coupang-shorts/tools/pipeline.py cp001
python coupang-shorts/tools/render.py --sheet cp001 sheet.png   # 장면 미리보기 한 장
```

필요: Python 3.11+, `pillow numpy` (`anthropic` 은 문구 자동 작성할 때만), ffmpeg.

## 구조

| 파일 | 하는 일 |
| --- | --- |
| `tools/platforms.py` | 플랫폼별 이름·광고 표시·대가성 문구 |
| `tools/coupang_api.py` | 파트너스 Open API (HmacSHA256 서명) — 검색·카테고리 베스트·골드박스·딥링크 |
| `tools/fetch.py` | 요청 → data. 쿠팡 주소로 준 상품은 검색 결과에서 상품 번호로 찾고 딥링크 API 로 단축 링크를 받는다. 직접 넣은 상품·네이버 링크를 붙인다 |
| `tools/autospec.py` | data → spec. Claude(사진을 보고) 또는 규칙 |
| `tools/render.py` | spec + data → mp4. Pillow 로 프레임을 그려 ffmpeg 로 인코딩 (크롬·Remotion 없이 Actions 에서 1분 안팎) |
| `tools/make_desc.py` | 업로드 문구 |
| `tools/pipeline.py` | 위 단계를 바뀐 것만 골라 한 번에 (Actions 가 부른다) |
| `.github/workflows/coupang-shorts.yml` | 요청·spec 이 바뀐 푸시마다 실행, 결과 커밋 |

이 개발 환경(클라우드 세션)에서는 쿠팡·유튜브 접속이 네트워크 정책으로 막혀 있어서, 쿠팡 API 호출과 렌더는 Actions 에서 한다.
코드는 가짜 API 서버(서명 검증 포함)와 가짜 상품 사진으로 처음부터 끝까지 돌려 확인했다 — 진짜 키로는 아직 안 돌려 봤다.
