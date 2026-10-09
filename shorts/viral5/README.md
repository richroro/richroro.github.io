# viral5 — 실제 영상으로 만드는 쇼츠 5편

NASA·NOAA·USGS가 공개한 **퍼블릭 도메인 실제 영상**을 한국어 내레이션에 맞춰 편집하는 Remotion 프로젝트입니다.
자막은 [remotion-dev/template-tiktok](https://github.com/remotion-dev/template-tiktok) 방식(단어별 등장·현재 단어 초록 강조)이고, 노란 키워드·스티커·효과음·음악 더킹이 데이터(JSON)로 붙습니다.

| id | 제목 | 길이 | 영상 출처 | 음악 |
| --- | --- | --- | --- | --- |
| `mars` | 이거 CG 아님 / 화성 실제 착륙 영상 | 29.8초 | NASA/JPL-Caltech | Impact Prelude |
| `deepsea` | 수심 4,000m에서 / 카메라에 찍힌 것 | 24.4초 | NOAA Ocean Exploration | Investigations |
| `lava` | 이 강 / 물이 아닙니다 🌋 | 25.9초 | USGS | Space Fighter Loop |
| `hairwash` | 우주정거장에서 / 머리 감는 법 🧴 | 25.7초 | NASA | Monkeys Spinning Monkeys |
| `hurricane` | 허리케인 속으로 / 일부러 들어가는 비행기 | 27.3초 | NOAA | Volatile Reaction |

완성본은 `final/<id>.mp4`에 있습니다(저장소 보관용으로 조금 압축한 것이라, 업로드용 최고 화질은 `./render.sh <id>`로 다시 뽑으면 됩니다).
`politics/`는 국회방송(NATV) 원본으로 국정감사 화제 장면을 자르는 도구이고, 같은 도구로 미국 상원 청문회 번역 쇼츠 5편도 만들었습니다(아래 참고).

## 만드는 순서

```bash
npm i
./fetch.sh                                  # 글꼴·효과음·기본 음악 → public/
# 원본 영상은 public/<id>/src/ 에 (edit.json의 sources.file 이름으로)
python3 voice_edge.py <id>                  # 내레이션(Edge TTS) + 음절 타이밍 → build/<id>/
python3 prep.py <id>                        # 컷 편집·자막 페이지·더킹 데이터 → src/data/<id>.json
./render.sh <id>                            # out/<id>.mp4 (1080×1920, 30fps, -14 LUFS)
npx remotion studio                         # 미리보기
```

- `shorts/<id>/script.json` — 대사(`say`, `|`로 호흡), 자막(`cap`, `/`로 페이지, `[키워드]`는 노란색)
- `shorts/<id>/edit.json` — 컷 목록. 시간은 내레이션 기준 앵커라 목소리를 다시 뽑아도 편집이 따라갑니다.
  `"crane"`(그 줄 시작), `"crane.줄에"`(그 단어를 말하는 순간), `"crane@end+0.1"`(그 줄 끝 0.1초 뒤).
  `crop: [cx, cy, zoom]`은 원본의 한 지점을 화면 가운데로, `moments`는 원본 소리(관제실 음성 등)를 올리는 구간입니다.

## 국감 쇼츠 (`politics/`)

국회 영상회의록(w3.assembly.go.kr) 원본은 질의자와 증인이 좌우로 나란히 나오는 화면이라, 이걸 **위(질의자)·아래(증인) 두 칸**으로 나누고 말하는 사람에게 노란 테두리를 줍니다.

```bash
python3 politics/transcribe.py <clip.mp4> politics/<id>/transcript.json   # 한국어 Zipformer 단어별 시간 (보조)
# politics/<id>/whisper.json = faster-whisper large-v3 단어별 시간 (주)
MEDIA=<원본 폴더> python3 politics/prep_split.py <id>                      # 패널·자막·말하는 사람 타임라인
./render.sh <id>
```

- `politics/<id>/edit.json`의 `lines`가 자막 원문입니다. 음성인식 3종(large-v3, small, Zipformer)과 국회 공식 자막(있을 때)을 대조해 **다수가 일치하는 말만** 적고, 확실하지 않은 부분은 자막에서 뺐습니다. 시간은 자모 단위 최장공통부분열로 음성인식 결과에 맞추고, 필요하면 `"at"`(원본 초)으로 줄 시작을 고정합니다.
- 컷은 길이를 줄이기 위해서만 쓰고(컷마다 흰 번쩍임), 앞뒤 맥락이 바뀌는 컷은 하지 않습니다. 예: 다른 사람의 말을 인용하는 대목은 "아침에 이런 말씀을 하셨어요"까지 넣어 인용임을 남깁니다.
- 원칙: 국회 원본만(방송사 화면 X), 실제 발언만(짜깁기·AI 목소리 X), 제목은 발언 인용 그대로, 출처 표기, 60초 이내. 클립은 국회방송 공식 클립 조회수 순으로 골라 정당과 무관합니다.
- ⚠ **국회 회의 영상은 「국회법」 제149조제2항에 따라 상업적 목적으로 쓸 수 없습니다**(영상회의록·국회방송 고지). 수익 창출 채널에는 올리지 마세요. 그래서 국감 영상 파일은 저장소에 올리지 않았습니다.
- 국회 공개 발언은 저작권법 제24조로 이용할 수 있지만, 한 사람의 발언만 모아 편집하는 것은 예외입니다. 그래서 여러 사람이 오가는 장면 단위로 자릅니다. 국회 중계방송 규칙상 선거운동·정당 홍보용으로는 쓸 수 없습니다.

## 미국 상원 청문회 쇼츠 (`politics/us*`)

미 상원 위원회가 직접 촬영해 공개한 청문회 영상(Senate Recording Studio, senate.gov 플레이어)에 한국어 번역 자막을 붙였습니다. 미국 연방정부 저작물이라 **퍼블릭 도메인**(17 U.S.C. §105)이므로, 국감 영상과 달리 수익 창출 채널에도 올릴 수 있습니다. 다만 상원 규칙(S.Res.431)상 정치 광고나 선거운동 용도로는 쓸 수 없습니다. C-SPAN 화면이나 방송사 클립은 쓰지 않았습니다(C-SPAN 카메라 영상은 C-SPAN 저작물).

| id | 제목 | 길이 | 장면 |
| --- | --- | --- | --- |
| `ushawks` | “호크스 경기 갔죠?” 몰아붙였는데 / 알고 보니 ‘호커이스’ 🏀 | 60.1초 | 슈미트(공화) ↔ 잭 스미스 전 특별검사, 법사위 2026.9.29 |
| `usai` | 美 상원 ‘폭주 AI’ 청문회 / “에이전트 1,200개가 탈출” | 55.4초 | 홀리(공화) ↔ 페인터(METR), 국토안보위 소위 2026.9.30 |
| `ushegseth` | 美 국방장관 “실패라니 무책임” / 상원의원 “실패한 건 바로 당신” | 57.6초 | 피터스(민주) ↔ 헤그세스 국방장관, 세출위 2026.7.21 |
| `ustariff` | 美 무역대표 “관세로 물가 안 올랐다” / 워런 “재무부가 뭘 모른다는 건가” | 50.0초 | 워런(민주) ↔ 그리어 무역대표, 재무위 2026.7.22 |
| `uspatel` | FBI 국장 “거짓말은 마음대로 하시라” / 상원의원 “답 안 하면 인정한 걸로” | 56.0초 | 부커(민주) ↔ 파텔 FBI 국장, 법사위 2026.9.15 |

```bash
MEDIA=<원본 폴더> python3 politics/prep_split.py ustariff    # lines에 "ko"가 있으면 번역 모드
./render.sh ustariff
```

- **번역 모드**: `lines`마다 한국어(`ko`)와 원문(`en`)을 쓰고, `at`(원본 초)으로 그 줄이 시작하는 순간을 고정합니다(`to`는 끝). 한 줄이 자막 한 장이고 한국어 아래에 작은 영어 원문이 붙습니다. 어순이 달라 단어별 강조는 하지 않습니다.
- 원문은 영어 음성인식(whisper tiny.en·small.en)을 짧은 구간으로 여러 번 겹쳐 돌려 맞췄습니다. 두 사람이 겹쳐 말해 확실하지 않은 말은 빼고 `…`로 표시했습니다.
- 화면은 한 사람씩 얼굴 중심으로 크롭하고(`single: [cx, cy, zoom]`) 이름표(`label`)를 붙입니다. 카메라가 다른 사람을 비추는 동안 들리는 말에는 자막 위에 `🎙 이름`이 붙습니다(`names`, 이름이 `label`에 들어 있는 사람이 화면 속 인물).
- 컷은 길이를 줄일 때만 쓰고(흰 번쩍임), `uspatel`은 원본 55초를 자르지 않고 그대로 썼습니다. `usai`는 같은 청문회 두 클립을 이었고, 순서가 바뀐 곳에 "같은 청문회 · 홀리 위원장 개회 발언" 스티커를 붙였습니다.
- 수치와 주장(가구당 1,700달러, 에이전트 1,200개, 기자 관련 의혹 등)은 청문회 발언 그대로이고 따로 검증한 사실이 아닙니다. 업로드 설명에도 그렇게 적습니다. `ushawks` 끝의 노란 스티커만 이후 언론 보도(WP·CBS) 내용입니다.
- 클립 선정은 도우미 세션이 보도량·화제성과 한국 시청자 관심도로 했습니다(질의자 기준 공화 2, 민주 3). 원본 클립과 출처 페이지·HLS 주소·원본 구간은 `ccr-d399bb63-yneedc-media` 브랜치의 `media/overseas/`에 있습니다.

## 출처와 라이선스

**영상 (모두 미국 정부 저작물, 퍼블릭 도메인)**
- 화성: [Perseverance Rover's Descent and Touchdown on Mars](https://svs.gsfc.nasa.gov/31250) — NASA/JPL-Caltech
- 심해: NOAA Ocean Exploration — [유령 문어(2016 EX1603)](https://oceanexplorer.noaa.gov/video_playlist/best-casper.html), [덤보 문어(2019 EX1903)](https://oceanexplorer.noaa.gov/multimedia/video-shorts/ex1903-dumbo.html), [해파리(2016 마리아나)](https://oceanexplorer.noaa.gov/?p=13461), [ROV Deep Discoverer](https://oceanexplorer.noaa.gov/technology/subs/deep-discoverer/deep-discoverer.html)
- 용암: USGS — [fissure 8 UAS 2018-07-14](https://www.usgs.gov/media/videos/july-14-2018-kilauea-fissure-8-video-captured-uas), [vent to sea](https://www.usgs.gov/media/videos/kilauea-volcano-fissure-8-flow-vent-sea), [compilation](https://www.usgs.gov/media/videos/kilauea-volcano-fissure-8-video-compilation), [overflight](https://www.usgs.gov/media/videos/kilauea-volcano-fissure-8-overflight)
- 머리 감기: [Karen Nyberg Shows How You Wash Hair in Space](https://archive.org/details/NybergShampoo) (NASA, 2013), [Water Recovery on the Space Station](https://images.nasa.gov/details/318_ECLSSWaterRec) (NASA), [Fun with Water Bubbles](https://images.nasa.gov/details/art002m1200950026_SHARED_Returned_0025_Z9_019_Wiseman) (NASA, Artemis II)
- 허리케인: NOAA OMAO 허리케인 헌터 영상 — [커밋 조종석, 허리케인 델타 2020](https://www.omao.noaa.gov/aircraft-operations/news-media/video/lt-cmdr-rebecca-shaw-piloting-noaa-wp-3d-n42rf-kermit-hurricane-delta-oct-6-2020-credit-mike-mascaro-noaa) (Mike Mascaro/NOAA), [도리안 난기류 2019](https://www.omao.noaa.gov/media/6206) (LT Kevin Doremus), [도리안의 눈 통과 2019](https://www.omao.noaa.gov/aircraft-operations/news-media/video/noaa-wp-3d-orion-hurricane-hunter-pass-through-eye-hurricane-dorian-5-sept-2019), [미스 피기, 허리케인 베릴의 눈 2024](https://www.omao.noaa.gov/aircraft-operations/news-media/video/view-inside-hurricane-beryl-noaa-wp-3d-orion-n43rf-miss-piggy-2-july-2024), [미스 피기 이륙](https://www.omao.noaa.gov/aircraft-operations/news-media/video/noaa43-miss-piggy-takeoff); 위성: GOES-19 허리케인 멜리사 2025-10-28 ([NOAA 공개 데이터](https://noaa-goes19.s3.amazonaws.com/index.html#ABI-L1b-RadM/2025/301/)에서 렌더링)

**미국 상원 청문회 (퍼블릭 도메인, Senate Recording Studio)**
- `ushawks`: [법사위 잭 스미스 청문회](https://www.judiciary.senate.gov/committee-activity/hearings/oversight-of-jack-smiths-abuse-of-authority-and-the-targeting-of-republicans-and-related-matters) (2026.9.29)
- `usai`: [국토안보위 소위 ‘Rogue AI’ 청문회](https://www.hsgac.senate.gov/subcommittees/dmdcc/hearings/rogue-ai-securing-the-homeland-against-ai-agent-attacks/) (2026.9.30)
- `ushegseth`: [세출위 추가 예산 청문회](https://www.appropriations.senate.gov/hearings/a-review-of-the-presidents-supplemental-funding-request-of-june-24-2026) (2026.7.21)
- `ustariff`: [재무위 2026 무역정책 청문회](https://www.finance.senate.gov/hearings/rescheduled-the-presidents-2026-trade-policy-agenda) (2026.7.22)
- `uspatel`: [법사위 FBI 감독 청문회](https://www.judiciary.senate.gov/committee-activity/hearings/oversight-of-the-federal-bureau-of-investigation-09-15-2026) (2026.9.15)

NASA 영상은 NASA가 보증·후원한다는 인상을 주거나 NASA 로고를 채널 로고처럼 쓰면 안 됩니다(NASA media usage guidelines).

**음악** — Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 — 업로드 설명란에 아래 문구를 그대로 넣어야 합니다.

```
"<곡 제목>" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
```

**효과음** — Kenney Interface Sounds (CC0), 나머지는 `../tools/sfx.py`로 직접 합성.
**글꼴** — Black Han Sans, Pretendard (SIL OFL).
**내레이션** — Microsoft Edge TTS `ko-KR-SunHiNeural`. 수익 창출 채널이라면 같은 목소리를 상업 이용 약관이 있는 Azure AI Speech로 다시 뽑는 것을 권장합니다(`voice_edge.py`의 음성만 바꾸면 됨).
**Remotion** — 개인·3인 이하 회사는 무료, 그 이상은 회사 라이선스 필요 ([remotion.dev/license](https://remotion.dev/license)).

## 업로드 문구

**mars** — 이거 CG 아님… 화성에 진짜 착륙하는 영상 🚀
> 2021년 2월 18일, NASA 퍼서비어런스 로버가 화성에 내리는 순간을 탐사선 카메라가 직접 찍었습니다. 낙하산 → 열 방패 분리 → 스카이 크레인 → 착지, 그리고 실제 관제실 음성 "Touchdown confirmed". 신호가 지구까지 11분 걸려서, 환호할 땐 이미 착륙해 있었어요.
> 영상: NASA/JPL-Caltech · 음악: "Impact Prelude" Kevin MacLeod (incompetech.com), CC BY 4.0
> #화성 #NASA #퍼서비어런스 #우주 #shorts

**deepsea** — 수심 4,000m에서 카메라에 찍힌 것 🐙
> 빛 한 줄기 없는 심해에서 NOAA 무인잠수정이 찍은 실제 영상. 이름도 없던 유령 문어, 귀로 헤엄치는 덤보 문어, UFO 같은 해파리까지. 바다의 80% 이상은 아직 아무도 제대로 본 적이 없습니다.
> 영상: NOAA Ocean Exploration · 음악: "Investigations" Kevin MacLeod (incompetech.com), CC BY 4.0
> #심해 #바다 #덤보문어 #NOAA #shorts

**lava** — 이 강, 물이 아닙니다 🌋
> 2018년 하와이 킬라우에아 화산. 용암이 시속 20km 넘게, 13km를 흘러 바다까지 가서 축구장 약 500개 크기(약 3.5㎢)의 새 땅을 만들었습니다.
> 영상: USGS · 음악: "Space Fighter Loop" Kevin MacLeod (incompetech.com), CC BY 4.0
> #용암 #화산 #하와이 #킬라우에아 #shorts

**hurricane** — 허리케인 속으로 일부러 들어가는 비행기 ✈️🌀
> 미국 해양대기청(NOAA)의 허리케인 헌터는 일부러 허리케인 한가운데로 날아가 관측 센서를 떨어뜨립니다. 구름 벽을 뚫고 나가면 나타나는 고요한 '허리케인의 눈'. 조종석의 개구리 인형은 비행기 이름이 '커밋'이라서, 동료 비행기 이름은 '미스 피기'.
> 영상: NOAA · 음악: "Volatile Reaction" Kevin MacLeod (incompetech.com), CC BY 4.0
> #허리케인 #태풍의눈 #NOAA #허리케인헌터 #shorts

**hairwash** — 우주정거장에서 머리 감는 법 🧴 (마지막에 반전)
> 샤워기가 없는 국제우주정거장에서 NASA 우주인 캐런 나이버그가 머리 감는 법. 남은 물기는 공기 중으로 증발했다가 정수 장치를 거쳐 다시 식수가 됩니다. 물 재활용률 98%.
> 영상: NASA · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0
> #우주정거장 #NASA #우주 #과학 #shorts

**ushawks** — “호크스 경기 갔죠?” 몰아붙였는데… 알고 보니 ‘호커이스’ 🏀
> 미 상원 법사위 청문회(2026.9.29). 에릭 슈미트 상원의원이 잭 스미스 전 특별검사에게 "2024년 2월 3일 애틀랜타 호크스 경기에 가지 않았느냐"고 몰아붙였습니다. 이후 미국 언론(WP·CBS)은 문자 속 경기가 NBA '호크스'가 아니라 아이오와대 '호커이스' 여자농구 경기였다고 보도했습니다.
> 영상: 미 상원 법사위원회(퍼블릭 도메인)
> #미국정치 #상원청문회 #잭스미스 #호크스 #shorts

**usai** — 美 상원 ‘폭주 AI’ 청문회 “오픈AI 에이전트 1,200개가 탈출” 🤖
> 미 상원 국토안보위 소위 청문회(2026.9.30). AI 평가 기관 METR의 크리스 페인터와 조시 홀리 상원의원이 말한 사건: 테스트 환경을 벗어난 에이전트 1,200여 개가 5~6일간 7만 건 넘는 메시지를 주고받았고, 꼼수를 숨기려다 허깅페이스 해킹까지. 샘 올트먼은 출석 요청을 거절했습니다. (수치는 청문회 발언 그대로)
> 영상: 미 상원 국토안보위원회(퍼블릭 도메인)
> #AI #오픈AI #샘올트먼 #AI안전 #shorts

**ushegseth** — 美 국방장관 “실패라니 무책임” vs 상원의원 “실패한 건 바로 당신”
> 미 상원 세출위원회 이란 전쟁 추가 예산 청문회(2026.7.21). 게리 피터스 상원의원과 피트 헤그세스 국방장관의 설전.
> 영상: 미 상원 세출위원회(퍼블릭 도메인)
> #헤그세스 #미국정치 #이란 #청문회 #shorts

**ustariff** — 美 무역대표 “관세로 물가 안 올랐다” vs 워런 “재무부가 뭘 모른다는 건가”
> 미 상원 재무위원회 무역정책 청문회(2026.7.22). 엘리자베스 워런 상원의원이 "트럼프 관세로 물가가 올랐느냐"고 묻자 제이미슨 그리어 무역대표는 "아니요". 워런은 의회예산국·재무부 수치(가구당 평균 1,700달러)와 연방대법원의 관세 판결을 들어 반박했습니다. (수치는 청문회 발언 그대로)
> 영상: 미 상원 재무위원회(퍼블릭 도메인)
> #관세 #트럼프관세 #미국경제 #물가 #shorts

**uspatel** — FBI 국장 “거짓말은 마음대로 하시라” vs 상원의원 “답 안 하면 인정한 걸로”
> 미 상원 법사위 FBI 감독 청문회(2026.9.15). 코리 부커 상원의원이 뉴욕타임스 기자 관련 의혹을 예/아니요로 묻자, 캐시 파텔 FBI 국장은 "거짓 공격"이라며 답하지 않았습니다. 의혹은 부커 의원의 질문 내용이고 파텔 국장은 이를 거짓이라고 반박했습니다.
> 영상: 미 상원 법사위원회(퍼블릭 도메인)
> #FBI #캐시파텔 #미국정치 #청문회 #shorts
