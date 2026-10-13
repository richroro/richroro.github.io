# 썰쇼핑 · 댓글 반응 쇼츠 자동 생성기

두 가지 쇼츠를 명령 한 줄로 만든다.

| 스크립트 | 형식 |
| --- | --- |
| `make_short.py` | 썰쇼핑 — 썰 나레이션 + 제품 컷 편집 |
| `make_comment_short.py` | 댓글 반응 — SNS 댓글 화면을 스크롤하며 하나씩 읽어주는 뉴스형 |

## 썰쇼핑

편집 툴 없이 **명령 한 줄로 썰쇼핑 쇼츠 완성본(MP4)** 이 나오는 파이프라인.
제품 영상·사진 폴더만 주면 대본 → 음성 → 컷 나누기 → 컷 배치 → 자막 → BGM → 인코딩까지 자동이다.

```bash
pip install -r requirements.txt        # ffmpeg 는 별도 설치 (brew/apt/choco install ffmpeg)

# 1) 제품명만 → 대본까지 자동 (ANTHROPIC_API_KEY 있으면 Claude, 없으면 내장 템플릿)
python make_short.py --product "자동 각도 조절 휴대폰 거치대" --media ./clips --bgm bgm.mp3

# 2) 대본을 직접 쓴 프로젝트 파일
python make_short.py --project example/project.json

# 3) 소재 없이 파이프라인만 시험 (가짜 소재 + 무음)
python make_short.py --demo
```

결과: `out/short.mp4` (1080×1920, 30fps, H.264/AAC) + `out/short.json` (대본·해시태그·길이).

## 결과물 레이아웃

```
┌──────────────┐  0
│ 귀찮음에서 탄생한 │  ← 상단 훅 제목 (흰 줄)
│  천재의 발명품   │  ← 강조 줄 (노란색)
├──────────────┤  560
│              │
│   1:1 영상    │  ← 원본 컷들 (2.2초 이하로 계속 바뀜)
│              │
│  팝업 자막      │  ← 문장을 11자 이하 덩어리로, *강조* 는 노란색
├──────────────┤  1640
│ ▶ 프로필 링크   │  ← CTA 띠
└──────────────┘  1920
```

## 파이프라인

| 단계 | 하는 일 | 구현 |
| --- | --- | --- |
| 1. 대본 | 훅 → 고통 썰 → 반전(제품 등장) → 기능 → 결말 → CTA | Claude(구조화 출력) 또는 내장 템플릿, 직접 작성도 가능 |
| 2. 음성 | 문장마다 TTS, **길이를 재서 그대로 타임라인으로** 사용 | edge-tts(기본, 무료) / gTTS / 무음 |
| 3. 컷 나누기 | 원본 영상을 장면 전환 감지로 샷 단위 분할, 0.6초 미만 버림 | `ffmpeg select='gt(scene,0.3)'` |
| 4. 컷 배치 | 문장 경계에서 컷 전환, 문장 안은 최대 2.2초 조각, 매 컷 다른 소재 | `plan_cuts()` |
| 5. 화면 | 1:1 크롭 + 1.06배 줌(워터마크·테두리 덜기), 사진은 켄번즈 줌인/아웃 교차 | `scale/crop`, `zoompan` |
| 6. 자막 | 상단 제목 고정 + 나레이션 팝업 자막(살짝 튀는 애니메이션) | ASS + libass, Pretendard Black |
| 7. 오디오 | 나레이션이 나오면 BGM 자동 감소(사이드체인 덕킹), 리미터 | `sidechaincompress` |

소재가 하나도 없으면 제품명을 쓴 색 카드(빈칸)로 채워서라도 영상은 나온다.

## 프로젝트 파일

```jsonc
{
  "product": "자동 각도 조절 휴대폰 거치대",
  "title": ["귀찮음에서 탄생한", "천재의 발명품"],   // [흰 줄, 노란 줄]
  "lines": ["누워서 폰 보다가 얼굴에 떨어뜨린 사람?", "바로 이 *자동 각도 조절 거치대*", "..."],
  "media": "../clips",       // 영상·사진 폴더 (파일명 순서대로 사용)
  "bgm": "bgm.mp3",
  "voice": "ko-KR-InJoonNeural",   // 여성: ko-KR-SunHiNeural
  "rate": "+20%",                  // 쇼츠는 살짝 빠르게
  "cta": "▶ 제품 정보는 프로필 링크"
}
```

`lines` 가 없으면 `product` 와 `info`(또는 `pain`/`features`/`benefit`)로 대본을 만든다.

## 옵션

| 옵션 | 설명 |
| --- | --- |
| `--info "..."` | 상세페이지 요약 등, Claude 대본 생성 참고 자료 |
| `--tts edge\|gtts\|none` | 음성 엔진 (기본 edge) |
| `--voice`, `--rate` | 목소리, 말 속도 |
| `--bgm-volume 0.35` | BGM 기본 볼륨 (덕킹 전) |
| `--scene-threshold 0.3` | 장면 전환 감도. 컷이 너무 적으면 0.2, 너무 잘게 나뉘면 0.4 |
| `--no-llm` | Claude 를 쓰지 않고 템플릿 대본 |
| `--keep` | 작업 폴더(컷 조각, subs.ass, voice.wav) 남기기 |

폰트는 첫 실행 때 Pretendard(OFL)를 `fonts/` 로 내려받는다. 막혀 있으면 `fonts/` 에 한글 OTF/TTF 를 직접 넣고
`ensure_fonts()` 의 이름을 맞추면 된다.

## 튜닝 포인트

- 템포: `MAX_CUT`(컷 최대 길이), `CAPTION_CHARS`(자막 덩어리 길이), `GAP`(문장 사이 쉼)
- 레이아웃: `VIDEO_Y`, `VIDEO_SIZE`, `CAPTION_Y`, `build_ass()` 의 스타일 줄
- 대본 톤: `SCRIPT_SYSTEM`(Claude 프롬프트), `HOOKS`/`TITLE_TOPS`/`TITLE_BOTTOMS`(템플릿)

## 댓글 반응 쇼츠 (`make_comment_short.py`)

```bash
# 댓글 파일만 주면 대본까지 자동 (Claude 또는 템플릿)
python make_comment_short.py --headline '"대표팀 안 왔으면"/SNS 사진에 달린 댓글' \
    --context "한 선수의 SNS 사진에 조롱성 댓글이 이어졌습니다." --comments comments.txt --post post.jpg

# 대본까지 직접 쓴 프로젝트 파일
python make_comment_short.py --project example/comments.json

python make_comment_short.py --demo      # 예시 댓글로 시험
```

`comments.txt` 는 한 줄에 댓글 하나: `닉네임|댓글|좋아요|시간|답글수` (댓글만 써도 된다).

| 단계 | 하는 일 |
| --- | --- |
| 댓글 화면 | 인스타그램식 밝은 댓글 목록을 세로로 긴 이미지 한 장으로 그림. 닉네임은 기본 블러, 프로필은 가짜 아바타 |
| 게시물 | `post` 이미지가 있으면 댓글 위에 붙여서 처음엔 사진, 이후 댓글로 내려감 |
| 대본 | 상황 요약 → 댓글을 하나씩 인용 → 마무리 질문. 문장마다 `focus`(읽을 댓글 번호) |
| 카메라 | 문장이 바뀌면 그 문장의 댓글로 0.45초 동안 부드럽게 스크롤, 나머지 댓글은 어둡게 |
| 자막 | 큰 팝업 자막, `*"인용"*` 은 민트색 (뉴스 쇼츠 스타일) |
| 상단 | 라벨 박스(`label`) + 헤드라인 2줄, 하단에 출처(`source`) |

닉네임 블러를 끄려면 `--show-names`. 목소리 기본값은 뉴스 톤 여성 `ko-KR-SunHiNeural` 이다.

## 주의

- 댓글 쇼츠는 실제 댓글을 옮길 때 닉네임·프로필을 가리고(기본값), 원문을 바꾸지 말고, 출처를 표기하자.
  특정인을 겨냥한 모욕성 댓글만 모아 확대하면 명예훼손·모욕 문제가 될 수 있다.

- 남의 제품 영상을 그대로 쓰면 저작권 문제가 생길 수 있다. 판매처가 허락한 소재나 직접 찍은 영상을 쓰자.
- 쿠팡 파트너스 등 제휴 링크를 쓰면 영상·설명란에 광고 표기를 해야 한다.
