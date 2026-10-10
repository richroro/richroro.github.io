## 정보 쇼츠 v2 (벤치마크: life·issue·hanban·why)

`research/benchmark-footage.md` 4절과 `research/benchmark-targets-footage.json`의 `info_reason` 레시피에 맞춰 정보 쇼츠 16편(`life1`~`life8`, `issue1`~`issue4`, `hanban1`~`hanban4`)을 다시 만들고, 동물 + 한국 연결 새 편 4개(`why1`~`why4`)를 더했습니다. 속도·컷·길이는 원래도 괜찮았고, 결정적 차이는 **첫 프레임과 생김새**였습니다. 그래서 바꾼 것은 다음 다섯 가지입니다.

1. **0–0.5초 표지(썸네일 프레임).** 가장 강한 사진·프레임을 화면 전체에, 굵은 2줄 제목(흰색 + 노랑 핵심어)을 크게, 필요하면 빨간 화살표나 원. 0.5초에 본편으로 컷.
2. **아래 빈 공간 없앰.** 그림이 제목 띠 아래 전체(1080×1520)를 채웁니다. 예전 1:1 박스 + 흐린 아래 23%가 없어졌습니다.
3. **자막은 최대 2줄, 강조색은 노랑 하나.** 초록 '지금 읽는 단어' 강조와 빨강을 없앴습니다. 자막 한 장은 12음절 이하(qa_review 기준), 한 줄 13자 이하.
4. **화면의 출처 배지·각주 스티커 없앰.** 크레딧과 근거는 모두 설명란으로 옮겼습니다. 사실이 틀려 보일 수 있는 곳(자료화면, 다른 나라·다른 화산 영상)만 왼쪽 위에 작은 회색 글씨 태그로 남겼습니다.
5. **첫 문장을 결과·숫자로.** 질문으로 시작하던 첫 줄을 2초 안에 끝나는 결과형 문장으로 다시 녹음했습니다(예: life5 "노란불 3초 밟는 시간 아닙니다."). 첫 줄은 목소리를 +35~52%로 빠르게, 나머지는 +20~38%(벤치마크 6.3–6.6음절/초)로 맞췄습니다.

그 밖에 규칙 점검에서 걸린 것도 고쳤습니다.
- **상표·회사 이름.** issue2의 주유소 사진(정유사 상표가 보임)을 상표 없는 Pexels 주유·유조선·정유 공장 영상으로 바꿨습니다. issue1의 발사대 사진(운반차 제조사 로고)은 같은 KARI 발사 영상으로 바꿨습니다. life7의 볼펜 사진(펜 상표)은 직접 그린 뚜껑 그림(`media/info2/draw_cap.py`)과 상표 없는 Pexels 사진으로, life6의 비상구 사진은 표지판에 찍힌 제조사 이름을 칠해 지웠습니다(`media/info2/clean_sign.py`). life4 내레이션의 항공사 이름은 "국내 한 항공사"로 바꾸고 출처는 설명란에 둡니다.
- **훅 문장 정확도.** hanban2 "태풍 길은, 고기압이 정합니다", why3 "두루미 떼"(1만여 마리는 재두루미 포함 두루미류 합계라 본문에서 종별 숫자를 따로 말함), why4 제목은 조사 결과 중국에서도 까치가 길조라서 "한국에서만"이 아니라 "한국에선 길조 / 영국에선 흉조"로 정했습니다.

### 새 템플릿 옵션 (`edit.json`, 모두 선택 사항)

| 키 | 값 | 하는 일 | 코드 |
|---|---|---|---|
| `"frame": "capTall"` | – | 그림이 제목 띠 아래 전체(1080×1520)를 채움. 낙서 짤툰 v2가 먼저 넣은 공용 프레임(`src/lib/CapBox.tsx` `CAP_TALL`)을 그대로 씀. `crop: [cx, cy, zoom]`은 그대로 동작 | (새 코드 없음) |
| `"cover"` | `{"src", "in", "title": [줄1, 줄2], "dur": 0.5, "focus", "zoom", "arrow": {"x","y","rot","len"}, "ring": {"x","y","r"}, "at": "top"\|"bottom", "note"}` | 0–`dur`초 표지. `src`가 사진이면 그대로, 영상이면 `in`초 프레임을 `prep.py`가 `public/<id>/cover.jpg`로 뽑음. 제목의 `[단어]`는 노랑(없으면 2줄 전체 노랑). `note`는 사진이 제목과 다른 대상일 때 아래 작은 글씨(hanban4: "사진: 같은 폭풍 때 미국 아이다호") | `src/lib/Info2.tsx` `CoverView`, `info2_prep.py` |
| `"capStyle": "info2"` | – | 자막 한 장을 한 줄(크게) 또는 균형 맞춘 2줄로, 흰 글씨 + `[노랑]`만. `{빨강}`도 노랑으로. 초록 단어 강조 없음 | `src/lib/Info2.tsx` `InfoCaps` |
| `"hideCredit": true` | – | 화면 오른쪽 위 출처 배지를 끔 | `ClipShort.tsx` `Credit` 앞 조건 한 줄 |
| `"tags"` | `[{"text", "from", "to", "y"}]` | 그림 왼쪽 위 작은 회색 글씨(사실 표시만: "자료화면", "참고: 1991 필리핀 피나투보") | `src/lib/Info2.tsx` `Tags` |

공유 파일에 들어간 것은 훅뿐입니다.
- `src/ClipShort.tsx`: import 1줄, `ShortData`에 선택 필드 1줄, `Credit` 앞 조건, 자막 선택에 `capStyle === "info2"` 한 갈래, `Tags`, 맨 위에 `CoverView`. (처음엔 `FRAME.tall`을 따로 넣었지만, origin을 합치면서 같은 크기의 공용 `capTall`로 바꾸고 뺐습니다. 이미 렌더한 편도 픽셀 위치가 같습니다.)
- `prep.py`: 위 키가 있을 때만 `info2_prep.extend()`를 부르는 2줄.
- 나머지는 새 파일입니다: `src/lib/Info2.tsx`, `info2_prep.py`, `media/info2/*`.

**다른 쇼츠는 그대로인지 확인했습니다.** origin을 합치기 전, 손대지 않은 v1 `issue1`을 훅이 없는 원래 `ClipShort.tsx`와 훅을 넣은 `ClipShort.tsx`로 각각 렌더해 비교했더니, 두 mp4가 바이트까지 같았습니다(`cmp` 동일, 프레임별 md5 동일). origin을 두 번 합친 뒤에도 같은 v1 `issue1`을 합친 `ClipShort.tsx`와 origin의 `ClipShort.tsx`로 렌더해 비교했고, 역시 바이트까지 같았습니다. `tsc`는 데이터 파일 외 오류가 없습니다. `qa_review.py`는 고치지 않았습니다.

### 만드는 순서

```bash
cd shorts/viral5 && npm i && ./fetch.sh
python3 media/info2/fetch_src.py issue1 ...      # 원본 → public/<id>/src/ (Wikimedia는 느리게 재시도, 1080p로 다시 인코딩)
build/pxget.sh <id> <pexels id>...                # (작업용) Pexels 영상 받기 + 미리보기 시트
python3 media/info2/remake.py issue1 ...          # 기존 16편: v1(커밋 1dcdd42)의 script/edit + media/info2/specs/<id>.json → v2
python3 media/info2/new_why.py                    # 새 4편 script/edit
python3 media/info2/draw_cap.py public/life7/src/cap_drawn.png
python3 media/info2/clean_sign.py public/life6/src/ph37643871.jpg public/life6/src/ph37643871_clean.jpg
python3 voice_edge.py <id> && python3 prep.py <id> && ./render.sh <id> final/<id>.mp4
# 30MB를 넘으면 CRF 23으로 다시 인코딩
ffmpeg -i final/<id>.mp4 -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/<id>.mp4
python3 qa_review.py <id> && python3 media/info2/scorecard.py <id> && python3 media/info2/sources.py <id>
python3 media/info2/readme_v2.py                  # 이 절(점수표·출처·업로드 문구)을 다시 만듦
```

hanban2의 힌남노 9일 플립북(`hinnamnor_wv_wide_sequence.mp4`)은 `media/hanban2/sources.json`의 9개 Worldview 스냅숏을 0.8초씩 이어 붙여 다시 만들었습니다(`ffmpeg -framerate 1.25 -pattern_type glob -i 'hinnamnor_wv_wide_*.jpg'`).

### 편 목록

| id | 화면 제목 | 첫 문장(훅) | 음악 |
|---|---|---|---|
