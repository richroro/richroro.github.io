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
| `robots` | NASA가 만든 / 이상한 로봇 4대 🤖 | 52.8초 | NASA/JPL-Caltech, NASA, NASA/Ames | Sneaky Snitch |

완성본은 `final/<id>.mp4`에 있습니다(저장소 보관용으로 조금 압축한 것이라, 업로드용 최고 화질은 `./render.sh <id>`로 다시 뽑으면 됩니다).
`politics/`는 국회방송(NATV) 원본으로 국정감사 화제 장면을 자르는 도구이고, 같은 도구로 미국 상원 청문회 번역 쇼츠 5편과 오바마 학생 연설 쇼츠 2편도 만들었습니다(아래 참고).

## 만드는 순서

```bash
npm i
./fetch.sh                                  # 글꼴·효과음·기본 음악 → public/
# 원본 영상은 public/<id>/src/ 에 (edit.json의 sources.file 이름으로)
python3 voice_edge.py <id>                  # 내레이션(Edge TTS) + 음절 타이밍 → build/<id>/
python3 prep.py <id>                        # 컷 편집·자막 페이지·더킹 데이터 → src/data/<id>.json
./render.sh <id>                            # out/<id>.mp4 (1080×1920, 30fps, -14 LUFS)
python3 qa_review.py <id>                   # 조회수 10만+ 쇼츠 형식 검토(REVIEW.md) → out/review/<id>/
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
| `uskennedy` | “이빨 요정은 믿습니까?” / “당신 때문에 토할 것 같네요” | 59.6초 | 케네디(공화) ↔ 잭 스미스 전 특별검사, 법사위 2026.9.29 |
| `usfauci` | 파우치 변호인이 끼어들자 / “발언권 없어요! 경위, 내보내세요” | 57.5초 | 폴(공화, 위원장) ↔ 파우치·변호인, 피터스(민주), 국토안보위 2026.7.29 |

```bash
MEDIA=<원본 폴더> python3 politics/prep_split.py ustariff    # lines에 "ko"가 있으면 번역 모드
./render.sh ustariff
```

- **번역 모드**: `lines`마다 한국어(`ko`)와 원문(`en`)을 쓰고, `at`(원본 초)으로 그 줄이 시작하는 순간을 고정합니다(`to`는 끝). 한 줄이 자막 한 장이고 한국어 아래에 작은 영어 원문이 붙습니다. 어순이 달라 단어별 강조는 하지 않습니다.
- 원문은 영어 음성인식(whisper tiny.en·small.en)을 짧은 구간으로 여러 번 겹쳐 돌려 맞췄습니다. 두 사람이 겹쳐 말해 확실하지 않은 말은 빼고 `…`로 표시했습니다.
- 화면은 한 사람씩 얼굴 중심으로 크롭하고(`single: [cx, cy, zoom]`) 이름표(`label`)를 붙입니다. 카메라가 다른 사람을 비추는 동안 들리는 말에는 자막 위에 `🎙 이름`이 붙습니다(`names`, 이름이 `label`에 들어 있는 사람이 화면 속 인물).
- 컷은 길이를 줄일 때만 쓰고(흰 번쩍임), `uspatel`은 원본 55초를 자르지 않고 그대로 썼습니다. `usai`는 같은 청문회 두 클립을 이었고, 순서가 바뀐 곳에 "같은 청문회 · 홀리 위원장 개회 발언" 스티커를 붙였습니다.
- `uskennedy`·`usfauci`는 Senate 스트림의 자체 영어 자막 트랙(HLS `text_1.m3u8`)으로 장면을 찾고, faster-whisper medium.en·small.en·large-v3로 단어 시간을 맞췄습니다. `uskennedy`는 원본 165초에서 세 구간(바이든·이빨 요정 / 보스버그 판사 / 비공개 명령·“토할 것 같다”)을 이었고, 둘째 구간 앞에 “이어서 · 의원 통화기록 수집 질의” 스티커를 붙였습니다. 빠진 것은 호파 질문, 통화기록 문답 일부, “J.Crew 카탈로그” 대목입니다. `usfauci`의 변호인은 마이크가 없어 중계에 목소리가 잡히지 않으므로 그의 말은 자막에 없고, 노란 스티커로 그 사실을 적었습니다. “(방청석 웃음·박수)”는 상원 자막 트랙의 [LAUGHTER] [APPLAUSE] 표기 그대로입니다.
- 수치와 주장(가구당 1,700달러, 에이전트 1,200개, 기자 관련 의혹 등)은 청문회 발언 그대로이고 따로 검증한 사실이 아닙니다. 업로드 설명에도 그렇게 적습니다. `ushawks` 끝의 노란 스티커만 이후 언론 보도(WP·CBS) 내용입니다.
- 클립 선정은 도우미 세션이 보도량·화제성과 한국 시청자 관심도로 했습니다(질의자 기준 공화 2, 민주 3). 이후 한쪽에 치우치지 않도록 공화당 질의자 2편(`uskennedy`, `usfauci`)을 더해 공화 4, 민주 3입니다. 원본 클립과 출처 페이지·HLS 주소·원본 구간은 `ccr-d399bb63-yneedc-media` 브랜치의 `media/overseas/`에 있습니다.

## 옛날 영화·아르테미스 2호 쇼츠

같은 도구(`politics/prep_split.py`)로 만든, 정치와 무관한 쇼츠입니다(`artemis3`만 내레이션 방식). 원본은 도우미 세션이 `ccr-d399bb63-yneedc-media` 브랜치 `media/oldfilm`, `media/oldmusic`, `media/nasa`에 올렸습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `oldfilm` | 100년 넘은 영화 명장면 5 / 4번은 지금 봐도 소름 😱 | 56.7초 | 〈달세계 여행〉(1902), 〈대열차강도〉(1903), 〈노스페라투〉(1922), 〈오페라의 유령〉(1925), 〈전함 포템킨〉(1925)의 한 장면씩, 1903년 수자 악단 행진곡 → 1904년 카루소 아리아 |
| `artemis` | 달을 눈앞에서 본 우주비행사 / “달은 포스터가 아니라 진짜 장소예요” 🌕 | 57.1초 | 아르테미스 2호 발사, 달 근접 비행 날 크리스티나 코크의 소감(원음 + 번역), 귀환 직전 창밖의 지구, 낙하산 귀환 |
| `artemis2` | 달 뒤로 사라지기 6분 전 / 지구와 나눈 마지막 교신 🌙 | 57.7초 | 달 뒤편 교신 두절 직전, 휴스턴 관제센터의 인사와 빅터 글로버 조종사의 답(원음 + 번역), 오리온 카메라에 잡힌 초승달 |
| `artemis3` | 달에서 돌아오는 우주선 / 창밖 실제 영상 🔥 | 42.7초 | 내레이션: 재진입 중 조종석 창밖 → 창문 가득 지구 → 발사 회상 → 드로그·주 낙하산 → 지상 카메라로 본 착수 |
| `oldbball` | 100년 전 농구는 이랬다 🏀 / 치마 입고 잔디밭에서 슛?! | 57.1초 | 1904년 미주리 밸리 칼리지 여학생 경기(LOC) → 1934년 Ford News 디트로이트 노던 고교 → 1945년 미 육군 영상 속 매디슨 스퀘어 가든, 1906년 미 해병대 군악대 〈메이플 리프 래그〉 |
| `oldbball2` | 80년 전 미국 농구 직관 🏟️ / NBA도 3점슛도 없던 시절 | 38.1초 | 1945년 매디슨 스퀘어 가든 유타대-세인트존스대 경기(미 육군 Army-Navy Screen Magazine) + 1904년 화면으로 마무리 |

- 무성영화라 소리가 없어서 자막(`"en": ""`이면 영어 줄 없이 크게)과 1926년 이전 녹음으로 만들었습니다. 영화 사실(대열차강도 마지막 장면은 극장이 앞뒤에 골라 붙일 수 있었음, 노스페라투 저작권 소송과 필름 폐기 판결, 론 체이니 직접 분장, 〈언터처블〉의 오데사 계단 오마주)은 널리 기록된 내용만 썼습니다.
- `artemis`는 코크의 목소리 한 줄기(`music` 목록의 클립 음성)를 달·초승달·지구 화면 위로 이어서 깔았고, 자막은 출력 시간(`t`/`tend`)으로 맞췄습니다. 오리온 카메라 영상은 옆으로 달린 카메라라 `rotate: 90`으로 세웠습니다.
- 농구 두 편(`oldbball`, `oldbball2`)은 원본이 모두 무성이라 자막과 음악만 씁니다. 1934년 Ford News 사본에 붙은 소리와 1904년 LOC 사본에 붙은 2023년 음악은 쓰지 않았습니다(`audio: 0`). 1945년 사본은 archive.org 메타데이터상 무성(`sound: silent`)이고 실제로 소리가 없어서, 번역할 내레이션이 없습니다. 1945년 화면은 너무 흐려서 대비를 올린 사본(`media/oldbasketball/basketball_1945_msg_graded.mp4`)을 만들어 썼습니다. 1936년 올림픽 선발전 아웃테이크는 NARA가 "Restricted – Possibly"로 표시해서 쓰지 않았습니다.
- 사실 확인: 1891년 네이스미스 발명·복숭아 바구니, 1937년 득점 후 센터 점프 폐지, BAA(NBA 전신) 1946년 출범, NBA 24초 룰 1954년, NBA 3점슛 1979년, 유타대 1944년 NCAA 우승, 와트 미사카(1947 닉스, NBA가 인정하는 첫 비백인 선수). 1945년 영상이 정확히 어느 날 경기인지는 확인하지 못해서(1944년 3월 30일 적십자 자선경기일 가능성이 큼) 날짜와 점수는 쓰지 않았습니다. 화면 설명(긴 치마, 잔디밭, 판자 없는 백보드 틀, 무릎 보호대)은 영상에서 직접 확인했습니다.
- 템플릿 변경: `prep_split.py`의 구간에 `"frame": "wide"`를 주면 16:9 상자로 나옵니다(기본은 기존대로 `square`). 1945년 전광판과 경기장 전경에 썼습니다.
- `artemis2`는 비행 6일째 하이라이트 원본(images.nasa.gov, 41분 52초)의 19:50~22:10을 잘라 `media/nasa/fd6_flyby_1190.mp4`로 쓴 것입니다(`MEDIA`에 이 파일을 두고 `prep_split.py`). 교신 원문은 faster-whisper large-v3·medium.en·small.en과 NASA 자막(.srt)을 대조했고, NASA 비행 6일째 블로그(6:44 p.m.)에 실린 문장과도 맞춰 봤습니다. 말하는 사람: NASA 영상이 바로 앞 발언에 “Voice of Victor Glover, Artemis II Pilot” 자막을 달았고, NASA 블로그도 이 인용 뒤에 “Victor Glover, Artemis II Pilot”을 붙였으며 언론(OSV News 등)도 글로버로 보도했습니다. 목소리 높이로 보면 “Thank you. Godspeed.”와 “Houston copies. We'll see you on the other side.”는 남자인 글로버가 아니라 여성 교신 담당(CAPCOM)의 목소리라서 둘 다 휴스턴으로 표시했습니다. 길이 때문에 두 군데를 뺐습니다: 글로버 답변 앞부분(“Thank you for that, Jenny… 달에 가장 가까운 곳, 지구에서 가장 먼 곳에 다가가며 우주의 신비를 풀어 가는 지금”)과 맨 앞 “Integrity, Houston”. 뺀 곳은 흰 번쩍임으로 표시되고, 남은 문장은 원래 순서 그대로입니다.
- 두 편의 원본은 저장소에 넣지 않았고, NASA 서버에서 바로 잘라 만들 수 있습니다(`-ss`를 입력 앞에 두고 다시 인코딩하면 프레임 단위로 정확합니다):

  ```bash
  N=https://images-assets.nasa.gov/video
  F=$N/jsc2026m000073_ArtemisIIFlightDay6Highlights_NoLowerThirds/jsc2026m000073_ArtemisIIFlightDay6Highlights_NoLowerThirds~large.mp4
  ffmpeg -ss 1190 -i $F -t 130 -c:v libx264 -crf 16 -c:a aac -b:a 192k media/nasa/fd6_flyby_1190.mp4
  G=$N/GP011149/GP011149~large.mp4; D=public/artemis3/src
  ffmpeg -ss 0 -i $G -t 40 -c:v libx264 -crf 16 -an $D/gp_0.mp4
  ffmpeg -ss 150 -i $G -t 180 -c:v libx264 -crf 16 -an $D/gp_150.mp4
  ffmpeg -ss 470 -i $G -t 110 -c:v libx264 -crf 16 -an $D/gp_470.mp4
  curl -L -o $D/splash.mp4 $N/KSC-20260410-MH-JBP01-0001-Artemis_II_Splashdown_GSS_Visual_60fps-M19183/KSC-20260410-MH-JBP01-0001-Artemis_II_Splashdown_GSS_Visual_60fps-M19183~large.mp4
  cp <media>/nasa/artemis2_launch_slowmo.mp4 $D/launch.mp4
  ffmpeg -i <media>/nasa/artemis2_liftoff_orion_cam.mp4 -vf transpose=1 -c:v libx264 -crf 16 -an $D/orioncam_upright.mp4
  ```
- `artemis3`는 내레이션 방식(`shorts/artemis3`)입니다. 사실은 모두 NASA 자료에서 가져왔습니다: 대기권 진입 시 음속의 35배, 약 6분 교신 두절(플라스마), 고도 23,400피트(약 7km) 드로그, 5,400피트(약 1.6km) 주 낙하산 3개, 7:53 p.m. 진입 → 8:07 p.m. EDT 착수(약 14분), 샌디에이고 앞바다([재진입 블로그](https://www.nasa.gov/blogs/missions/2026/04/10/artemis-ii-flight-day-10-re-entry-live-updates/)), 4월 1일 발사·4명([발사 영상 설명](https://images.nasa.gov/details/KSC%20ART%20II%20Cause%20Way%20Launch%20low%20angle)), 1972년 아폴로 17호 이후 첫 달 귀환([비행 6일째 블로그](https://www.nasa.gov/blogs/missions/2026/04/06/artemis-ii-flight-day-6-crew-wraps-historic-lunar-flyby/)). 창밖 영상은 GP011149 원본(11분 50초)의 0–40초, 150–330초, 470–580초를 잘라 썼고, 발사 카메라 영상은 `transpose=1`로 세운 파일을 썼습니다. 착수 장면이 화면 아래쪽이라 자막을 프레임 아래(`"captionY": 1600`, `prep.py`에 추가)로 내렸습니다. 내레이션 음성 파일은 `media/voice/artemis3/`.

## NASA 로봇 쇼츠 (`robots`)

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `robots` | NASA가 만든 / 이상한 로봇 4대 🤖 | 52.8초 | 화성 헬기 인저뉴어티(헬기 시점, 5배속) → 뱀 로봇 EELS → ISS 비행 로봇 아스트로비와 ‘양말’ 사건 → 로보넛 2, 세그웨이 탄 선배 로보넛(2004) |

- 내레이션 방식(`shorts/robots/`). 수치는 모두 NASA·JPL 페이지 기준입니다: 인저뉴어티 1.8kg, 25번째 비행 704m(“longest and fastest flight to date”, 영상은 약 5배속), 계획 최대 5회 → 실제 72회, 첫 비행 2021.4 · 마지막 비행 2024.1([science.nasa.gov](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/), [NASA 보도자료](https://www.nasa.gov/news-release/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/)); EELS 4.4m · 100kg, 엔셀라두스 얼음 틈 아래 바다에서 생명 탐색, 개발 중([JPL](https://www.jpl.nasa.gov/robotics-at-jpl/eels/)); 아스트로비는 전기 팬으로 비행, 이름은 허니·퀸·범블([NASA](https://www.nasa.gov/astrobee/)); 로보넛 2는 2011.2.24 디스커버리호로 간 최초의 인간형 로봇([NASA](https://www.nasa.gov/robonaut2/)); 2004년 로보넛이 세그웨이를 탐(영상 설명문, [NTRS](https://ntrs.nasa.gov/citations/20060009023)).
- ‘양말’은 ISAAC 시연의 **모의 상황**이고 화면 속 양말도 그림이라 빨간 스티커로 밝혔습니다.
- 출처마다 크레딧이 달라서 템플릿에 클립별 크레딧을 추가했습니다(`edit.json`의 `sources.<src>.credit` 또는 `clips[].credit`, 없으면 예전처럼 `credit` 하나).
- 기존 Astrobee 소개 영상(`iss_astrobee_flying_robot.mp4`)의 ISS 장면은 **애니메이션**이라(NASA B-roll 설명: “Animation of Astrobee robots as they will appear on the station”) 쓰지 않고, 실제 ISS 영상 두 개를 새로 받았습니다. 마이크로덕 등 제3자 로봇 영상은 쓰지 않았습니다.
- 영상: [Ingenuity 25번째 비행](https://images.nasa.gov/details/JPL-20220527-M2020f-0001-NASAs_Ingenuity_Mars_Helicopter_Captures_Video_of_Record_Flight2), [EELS 테스트](https://images.nasa.gov/details/JPL-20240508-EELSf-0002-Testing%20Out%20JPLs%20New%20Snake%20Robot) — NASA/JPL-Caltech; [Space to Ground 2022.2.4](https://images.nasa.gov/details/jcs2022m000007_Space%20to%20Ground_407_220204) — NASA; [ISAAC × Astrobee](https://images.nasa.gov/details/ARC-20210810-AAV3354-ISAAC-Astrobee-NASAWeb-1080p) — NASA/Ames; [로보넛 2 발사 준비 2010](https://images.nasa.gov/details/ksc_082710_robonaut), [로보넛 첫걸음 2004](https://images.nasa.gov/details/ksc_081704_robonaut) — NASA. 새 원본은 `media/robots/`, 목소리는 `media/voice/robots/`.

**robots** — NASA가 만든 이상한 로봇 4대 🤖 (마지막이 제일 이상함)
> 화성 하늘을 72번 난 1.8kg 헬리콥터 인저뉴어티, 토성의 위성 엔셀라두스에서 생명체를 찾으려는 4.4m 뱀 로봇 EELS, 우주정거장을 전기 팬으로 날아다니는 큐브 로봇 아스트로비(훈련 중 찾아낸 범인은 ‘양말’), 그리고 우주에 간 최초의 인간형 로봇 로보넛 2와 세그웨이를 탔던 선배 로보넛까지. 모두 NASA 실제 영상입니다. (NASA가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: NASA/JPL-Caltech, NASA, NASA/Ames · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #NASA #로봇 #화성 #인저뉴어티 #우주정거장 #shorts

## 미국 해안경비대 구조 쇼츠 (`politics/uscg*`)

DVIDS에 올라온 미국 해안경비대(USCG) 구조 영상에 한국어 자막을 붙였습니다. 헬기 호이스트 운용사의 실제 교신은 번역하고, 나머지 사실은 USCG 보도자료와 DVIDS 영상 설명에 있는 것만 적었습니다.

| id | 제목 | 길이 | 영상 |
| --- | --- | --- | --- |
| `uscg1` | 얼음 위에 하루 넘게 갇힌 가족 / 구조 헬기 실제 교신 🎧🚁 | 58.2초 | 알래스카 셰포낙, 2026.4.12, MH-60 호이스트 카메라 |
| `uscg2` | 바다에 빠진 두 남자, 헬기가 왔다 / 구조된 남자가 한 말 🥹 | 52.6초 | 하와이 할레이와 앞바다, 2026.7.14, MH-65 호이스트 + 기지 도착 |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py uscg1    # 원본: media/uscg/
./render.sh uscg1
```

- 영상은 DVIDS 페이지 머리에 "Video by <촬영자>"가 있고 설명 끝이 "(U.S. Coast Guard video)"인 것만 썼습니다. "Courtesy Video"나 "courtesy of Air Station …" 표시가 있는 영상은 쓰지 않았습니다. 그래서 로그 강 래프터(2026.10.1)와 데이먼 포인트 카이트보더 구조는 제외했습니다. 원본과 출처·크레디트·구간은 `media/uscg/*.json`에 있습니다.
- 교신 번역은 whisper small.en·medium.en·large-v3 중 둘 이상이 같은 말을 들은 줄만 넣었습니다. "Swimmer"인지 아닌지 엇갈린 말("Server's on deck" 등)은 뺐습니다. 교신의 숫자는 남은 거리(피트)입니다.
- 구조된 사람의 얼굴: `uscg1`은 밤에 위에서 내려다본 화면이라 얼굴이 보이지 않습니다. `uscg2`는 바스켓 속 얼굴이 보이는 4.5초(원본 51.9–56.4초)를 잘라냈습니다. 기지에서 감사 인사를 하는 장면은 화면 전체를 흐리게 처리하고 목소리만 살렸습니다(이름도 자막에 넣지 않음).
- 세그먼트에 `"vf"`(ffmpeg 필터)를 붙일 수 있습니다. `uscg1`은 어두운 야간 화면을 밝혔고(`eq`), `uscg2`는 기지 장면을 흐렸습니다(`boxblur`).
- 음악("Lightless Dawn", "Heroic Age", "Rising Tide")은 `fetch.sh`에 없으니 incompetech.com에서 `public/music/<곡 제목>.mp3`로 받아 둡니다.
- 미 해안경비대가 이 영상을 보증하거나 후원한다는 인상을 주면 안 됩니다(DVIDS 저작권 안내).

## 한영자막 모음 영상 (가로 16:9, `src/LongForm.tsx`)

레퍼런스(Project스노우볼 「AI 시대에도 여전히 유효한 1만 시간의 법칙 (한영자막)」)처럼 한 주제로 여러 사람의 말을 이어 붙인 가로 영상입니다. 레퍼런스는 남의 인터뷰를 그대로 올린 영상이라 형식만 따르고, 영상은 퍼블릭 도메인(미 연방정부 저작물 등)만 씁니다.

- 쇼츠용으로 만든 `politics/<id>` 편집을 차례로 이어 1920×1080으로 보여 줍니다. 화면은 자르지 않고 전체를 보이고(세로·4:3 화면은 흐린 배경 위에), 자막은 아래에 영어(크게)와 한국어(작게) 두 줄, 이름표는 왼쪽 위, 출처는 오른쪽 위입니다.
- 맨 앞에 제목 카드(3.5초, 둘째 줄 노란색), 파트마다 짧은 카드(1.8초, 그 쇼츠의 제목과 이름표)가 들어갑니다.
- 목록은 `src/longs.ts`에 적습니다. 아직 prep하지 않은 파트는 빠지고 나머지로 만들어집니다.

```bash
MEDIA=<원본 폴더> python3 politics/prep_split.py jfkmoon   # 파트마다 한 번
./render.sh talks1                                          # out/talks1.mp4 (1920×1080, -14 LUFS)
```

- 쇼츠에서 영어를 위에, 한국어를 아래에 두려면 `edit.json`에 `"subOrder": "en-ko"`를 씁니다. 영어 줄의 `[대괄호]` 부분은 노란색으로 나옵니다.

**`talks1`** — 실패해도 다시, 도전하는 이유..? (한영자막) · 4분 36초 · 1920×1080 · `final/talks1.mp4`(1080p, CRF 27)

연설 쇼츠 다섯 편(`jfkmoon` → `obama09` → `astrofail` → `obama09b` → `reagan86`)을 이은 것입니다. 각 파트의 원본과 출처는 해당 쇼츠 항목에 있습니다. 쇼츠의 스티커(문맥 설명, 인용 카드)는 가로 화면에는 넣지 않았습니다.

> 케네디, 오바마, NASA 우주비행사들, 레이건 — 실패와 도전에 대해 직접 한 말을 영어·한국어 자막으로 모았습니다.
>
> 0:00 PART 1 케네디 「쉬워서가 아니라 어렵기 때문에」 (1962)
> 1:04 PART 2 오바마 「실패가 여러분을 가르치게 하세요」 (2009)
> 1:55 PART 3 우주비행사들 「떨어지고 다시 도전했다」 (NASA)
> 2:43 PART 4 오바마 「잘하게 태어나는 사람은 없다」 (2009)
> 3:34 PART 5 레이건 「미래는 용감한 사람의 것」 (1986)
>
> 영상: NASA, 백악관 영상(2009), 백악관 TV실·레이건 대통령 도서관(1986), 사진 NASA/Bill Ingalls. 번역·자막 직접 제작. NASA·백악관이 이 영상을 보증하거나 후원하지 않습니다.
> #명연설 #한영자막 #영어공부 #동기부여 #케네디 #오바마 #레이건 #NASA

## 옐로스톤 쇼츠 (`yellowstone`, `yellowstone2`)

| id | 제목 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `yellowstone` | 옐로스톤에서 / 절대 하면 안 되는 것 🚫 | 47.6초 | 주차장 차를 들이받는 수컷 엘크 → 엘크 옆에서 사진 찍는 사람들 → 규칙 ① 바이슨·엘크 23m ② 곰·늑대 91m(곰도 바이슨 떼한텐 쫓겨남, 공원 웹캠) ③ 온천은 보드워크 위에서만 → 결론 “가장 안전한 관람석은 차 안” | Scheming Weasel (faster version) |
| `yellowstone2` | 땅이 끓는 곳 / 옐로스톤 실제 영상 ♨️ | 54.7초 | 파운틴 페인트 팟 진흙 웅덩이 → 분기공 → 올드 페이스풀 → 그랜드 프리즈매틱 → 스팀보트 간헐천 2018.9.17 분출 | Five Armies |

- 내레이션 방식(`shorts/yellowstone*/`). 영상은 모두 **미국 국립공원관리청(NPS)이 직접 찍어 공개한 영상**(nps.gov 멀티미디어, NPS API `parkCode=yell`)이고, 크레딧이 NPS 직원(“NPS/…”)이거나 NPS인 것만 썼습니다. NPS 페이지의 다른 영상 중 몬태나주 FWP·외부 제작사·개인 촬영본(예: “Bear Jams”에 섞인 Montana FWP 화면, “Elk Rut Safety Video”)은 쓰지 않았습니다. 클립별 크레딧은 화면 오른쪽 위에 “영상: 미국 국립공원관리청(NPS) · 촬영자”로 붙습니다.
- 수치는 모두 nps.gov/yell 기준입니다.
  - 거리 규칙: 곰·늑대·쿠거 100야드(91m), 바이슨·엘크 등 다른 동물 25야드(23m), “가장 안전한(그리고 대개 가장 좋은) 관람석은 차 안”, 보드워크·지정 탐방로로만, 온천에 들어가거나 빠져 화상으로 숨진 사람 20명 이상 — [Safety](https://www.nps.gov/yell/planyourvisit/safety.htm)
  - 바이슨 수컷 최대 2,000파운드(900kg), 최고 시속 35마일(55km), “How fast can a bison run? Faster than you.” — [Bison](https://www.nps.gov/yell/learn/nature/bison.htm) (같은 페이지 다른 곳의 “30 miles per hour”는 쓰지 않음)
  - 엘크 수컷 약 700파운드(약 320kg), 짝짓기 철(rut) 9~10월 — [Elk](https://www.nps.gov/yell/learn/nature/elk.htm)
  - 열수 지형 1만 개 이상, 진흙 웅덩이(미생물이 황화수소를 황산으로 바꿔 바위를 진흙으로 분해, 썩은 달걀 냄새), 분기공 최고 280°F(138°C) — [Hydrothermal Features](https://www.nps.gov/yell/learn/nature/hydrothermal-features.htm)
  - 전 세계 간헐천의 60% 가까이, 올드 페이스풀 분출구 물 203°F(95.6°C)·평균 높이 130피트(40m)·분출 간격 중앙값 102분(2025년 1월 기준)·30년 사이 간격 약 30분 증가, 그랜드 프리즈매틱은 옐로스톤에서 가장 큰 온천·깊이 121피트(37m) 이상 — [Explore Old Faithful](https://www.nps.gov/yell/planyourvisit/exploreoldfaithful.htm) (그랜드 프리즈매틱 지름은 같은 페이지에 370피트와 200–330피트가 함께 있어 쓰지 않음)
  - 스팀보트는 세계에서 가장 높은 활동 간헐천, 큰 분출 300피트(91m) 이상, 예측 불가 — [Steamboat Geyser](https://www.nps.gov/yell/learn/nature/steamboat-geyser.htm)
- “늙은 충직이”는 Old Faithful의 뜻풀이, 마지막 “엘크 철엔 차도 거리 두기”는 농담입니다(엘크 영상 속 차량은 주차된 차).
- 바이슨이 회색곰을 쫓는 장면은 올드 페이스풀 **공원 웹캠** 녹화(2025.3.31, NPS 게시)라 화질이 낮아서 2.2배 확대했습니다. NPS 설명에 따르면 웹캠은 Canon USA가 Yellowstone Forever에 낸 기부금으로 운영됩니다.
- 스팀보트 원본(Minute Out In It)에는 화면 아래에 자막이 박혀 있어 그 부분이 보이지 않게 위쪽으로 잘랐습니다. 원본은 `media/yellowstone/`(각 50MB 이하, 큰 두 개는 쓰는 구간만 잘라 둠, `.json`에 페이지·파일 주소·크레딧·라이선스), 목소리는 `media/voice/yellowstone*/`.
- NPS가 이 영상을 보증하거나 후원한다는 인상을 주면 안 됩니다(업로드 문구에 명시). NPS 로고(화살촉)는 쓰지 않았습니다.

**영상 (NPS, 퍼블릭 도메인)**
- `yellowstone`: [Bull elk ramming a car (주차장)](https://www.nps.gov/media/video/view.htm?id=4C26BFFD-E27F-4CE9-A4C5-DAC73900622C)·[Bull elk ramming a car (관광객)](https://www.nps.gov/media/video/view.htm?id=A3D8973C-F455-4F23-8E1A-903226FF8871) — NPS/Dale Bohlke; [Bison on Road](https://www.nps.gov/media/video/view.htm?id=40B0478B-B508-40B9-940E-91A6E3573322), [Bison rut](https://www.nps.gov/media/video/view.htm?id=FEF4DA95-94F8-4739-A73D-43D05D0E1D8E), [Grizzly Bear (early spring)](https://www.nps.gov/media/video/view.htm?id=33B6D18B-8420-4B6F-B1DF-CA1311461886), [Crowd waiting for Old Faithful](https://www.nps.gov/media/video/view.htm?id=3849F91C-3645-417C-B9A8-5C2D3D6C28EE), [Grand Prismatic Spring](https://www.nps.gov/media/video/view.htm?id=BB1BF3AD-40C7-4A03-B7C9-47BDB6CC26C4), [Fountain Paint Pot](https://www.nps.gov/media/video/view.htm?id=D95FB989-6426-4E5F-AAA3-223A4B4DBD70) — NPS/Neal Herbert; [Old Faithful Webcam: Bison Herd Chasing Grizzly Bear](https://www.nps.gov/media/video/view.htm?id=52782724-1D13-487B-AAB2-FE6454D4244A) — NPS
- `yellowstone2`: Fountain Paint Pot, Grand Prismatic Spring, Crowd waiting for Old Faithful(위와 같음), [Norris Geyser Basin (telephoto)](https://www.nps.gov/media/video/view.htm?id=4BFD3294-51CE-4042-A5E9-4933E3EE44B7), [Castle Geyser (with rainbow)](https://www.nps.gov/media/video/view.htm?id=E1509357-9B8B-4E86-AD95-EC7C387ECF22), [Fumaroles, Porcelain Basin](https://www.nps.gov/media/video/view.htm?id=3D40E676-3A1C-40E3-9EBA-A19BEAD4C7FA), [Old Faithful (initial eruption)](https://www.nps.gov/media/video/view.htm?id=C2A88982-A52B-4A64-8F23-68031E322E33), [Old Faithful (continuing eruption)](https://www.nps.gov/media/video/view.htm?id=3B9A209B-F2D5-43E1-9764-9AAF93D586FE), [Old Faithful (summer)](https://www.nps.gov/media/video/view.htm?id=B793FF8E-2164-4A09-9C96-D816E55CE317) — NPS/Neal Herbert; [Minute Out In It: Steamboat Geyser Eruption](https://www.nps.gov/media/video/view.htm?id=E82CA7B7-2638-42F3-9480-5280D003D608) — NPS/Jacob W. Frank
- 음악: "Scheming Weasel (faster version)", "Five Armies" Kevin MacLeod (CC BY 4.0)

**yellowstone** — 옐로스톤에서 절대 하면 안 되는 것 🚫 (마지막 규칙이 제일 중요)
> 미국 옐로스톤 국립공원에서는 짝짓기 철(9~10월) 수컷 엘크가 주차된 차를 들이받기도 합니다. 미국 국립공원관리청(NPS)이 안내하는 거리 규칙: 바이슨·엘크와는 최소 23m(25야드), 곰·늑대와는 최소 91m(100야드). 바이슨은 900kg인데 시속 55km로 달립니다. 온천 지대에서는 반드시 보드워크 위로만 다니세요. 영상은 모두 NPS가 공개한 실제 영상입니다. (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) — Dale Bohlke, Neal Herbert, Old Faithful 웹캠 · 음악: "Scheming Weasel (faster version)" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #옐로스톤 #국립공원 #바이슨 #엘크 #미국여행 #shorts

**yellowstone2** — 땅이 끓는 곳 ♨️ 옐로스톤 실제 영상
> 미국 옐로스톤 국립공원에는 온천·간헐천·진흙 웅덩이·분기공 같은 열수 지형이 1만 개 넘게 있습니다. 썩은 달걀 냄새가 나는 진흙 웅덩이, 최고 138도의 분기공, 평균 40m로 솟는 올드 페이스풀, 깊이 37m가 넘는 그랜드 프리즈매틱, 그리고 세계에서 가장 높이 솟는 활동 간헐천 스팀보트(2018년 9월 17일 분출). 수치는 미국 국립공원관리청(NPS) 옐로스톤 공식 페이지 기준입니다. (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) — Neal Herbert, Jacob W. Frank · 음악: "Five Armies" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #옐로스톤 #간헐천 #올드페이스풀 #국립공원 #지구과학 #shorts

## 연설 쇼츠 (`politics/reagan86`)

유명인이 한 주제로 직접 말하는 장면에 영어(위, 흰색)·한국어(아래, 작게) 2단 자막을 붙이는 형식(`"subOrder": "en-ko"`)입니다. 형식만 참고했고, 영상은 모두 미국 연방정부 저작물이며 번역은 직접 했습니다. 내레이션·AI 목소리는 없습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `reagan86` | 우주왕복선이 폭발한 날 / 대통령이 아이들에게 한 말..? | 59.7초 | 1986.1.28 챌린저호 사고 당일 레이건 대통령의 대국민 연설 중 학생들에게 한 말 → "우주 탐사는 계속된다" → "지구의 거친 굴레를 벗어나 신의 얼굴을 만지러" |

```bash
MEDIA=$PWD/media python3 politics/prep_split.py reagan86    # 원본: media/speech/reagan86_*.mp4 (기본 MEDIA와 같음)
./render.sh reagan86
```

- **영상**: 백악관 TV실(WHTV)이 촬영한 연설 원본 — 국립문서기록관리청(NARA) 레이건 대통령 도서관 소장 [NAID 6014714](https://catalog.archives.gov/id/6014714) ("Collection RR-WHTV"). NARA 유튜브 업로드의 archive.org 사본(`yt_DqilE4AAa-M`)을 받았습니다. 방송사 중계 화면은 쓰지 않았습니다.
- **원본 구간**: `media/speech/reagan86_whtv.mp4` = 원본 118.0–251.2초. 쇼츠에 쓴 구간(이 클립 기준): 1.3–31.9초(학생들에게 한 말 전체), 51.5–65.95초("We'll continue our quest in space" ~ "our journeys continue"), 118.5–132.5초(마지막 문단 끝). 그 사이 두 번 자른 곳에만 흰 번쩍임이 있습니다. 빠진 부분은 NASA 공개성·자유 언급("We don't hide our space program…"), NASA 직원에게 한 말, 드레이크 일화입니다.
- **B-roll**: 목소리는 그대로 두고 화면만 NASA 사진·필름으로 바꾼 구간은 `media/speech/reagan86_broll.mp4`(연설 클립과 같은 시간축, 소리 = 연설)로 만들었습니다 — 발사 사진 51L-S-156·51L-S-157, 승무원 공식 사진 S85-44253, 발사 당일 아침 식사 51L-S-029([images.nasa.gov](https://images.nasa.gov/details/51l-s-029)), 교사 크리스타 매콜리프가 승무원들을 처음 만난 1985년 NASA 필름(NARA RG 255, archive.org `yt_RpV1vKPRyJ8`, 34.0–42.4초). 폭발 장면은 넣지 않았고, 사고는 첫 화면의 흰 스티커 한 줄로만 적었습니다(발사 73초 후, 승무원 7명).
- **자막**: 레이건 도서관의 [연설문](https://www.reaganlibrary.gov/archives/speech/address-nation-explosion-space-shuttle-challenger)과 faster-whisper small.en·medium.en·large-v3를 대조해 실제로 말한 대로 적었습니다(연설문 "it is" → 음성 "it's"). 연설문의 "but **sometimes** painful things like this happen"은 이 사본에서 "but"과 "painful" 사이에 약 0.2초 무음(디지털 드롭아웃)이 있고 세 모델 중 둘이 아무 말도 듣지 못해서 `but … painful things`로 비웠습니다.
- 템플릿 변경(기존 쇼츠 영향 없음): 구간에 `"broll": true`를 주면 같은 시간축 B-roll로 넘어갈 때 흰 번쩍임을 넣지 않고, `"credit"`을 주면 그 구간에만 다른 출처 표기(NASA 등)가 나옵니다. 🎙 이름표는 `names: ["레이건 대통령", "챌린저호"]`로, B-roll 이름표에 "챌린저호"가 들어가 다른 화면으로 판정되게 했습니다.
- 마지막 구절 "slipped the surly bonds of earth … touch the face of God"은 연설문에도 따옴표로 표시된 존 길레스피 머기 2세의 1941년 시 〈High Flight〉 인용이라 노란 스티커로 밝혔습니다.
- 음악은 넣지 않았습니다(`public/music`의 곡이 추모 연설과 어울리지 않음). 라우드니스 −14 LUFS(측정 −14.1).
- 라이선스: 백악관 TV실 영상과 NASA 사진·필름은 미국 연방정부 저작물로 퍼블릭 도메인(17 U.S.C. §105)입니다. 다만 NASA·백악관·NARA·레이건 도서관이 이 영상을 보증하거나 후원한다는 인상을 주면 안 되고, NASA 로고를 따로 쓰지 않습니다. 화면에는 "백악관 영상 · 레이건 대통령 도서관", "NASA", "NASA · 미국 국립문서기록관리청"만 적었습니다.

**reagan86** — 우주왕복선이 폭발한 날, 대통령이 아이들에게 한 말
> 1986년 1월 28일, 우주왕복선 챌린저호가 발사 73초 만에 폭발해 승무원 7명이 숨졌습니다. 그중엔 우주에서 수업을 하기로 했던 교사 크리스타 매콜리프도 있었고, 미국의 많은 학생들이 교실에서 발사 생중계를 보고 있었습니다. 그날 저녁 레이건 대통령은 연두교서 발표를 미루고 백악관 집무실에서 대국민 연설을 했습니다. "미래는 겁 많은 사람의 것이 아니라 용감한 사람의 것입니다."
> 영상: 백악관 TV실(레이건 대통령 도서관·미국 국립문서기록관리청 소장), NASA. 번역: 직접 번역. (NASA·NARA·레이건 대통령 도서관이 이 영상을 보증하거나 후원하지 않습니다.)
> #챌린저호 #우주왕복선 #레이건 #NASA #명연설 #영어공부 #한영자막 #shorts

## 명연설 영어·한글 자막 쇼츠 (`politics/jfkmoon`)

유명인의 육성 연설에 영어(위, 크게)·한국어(아래, 작게) 두 줄 자막을 붙이는 형식입니다. 내레이터와 AI 음성은 없습니다. 형식만 참고했고, 영상은 모두 미국 정부(NASA)가 만든 사본이며 번역은 직접 했습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `jfkmoon` | 케네디가 달에 가자고 한 / 진짜 이유..? | 58.7초 | 1962.9.12 라이스대 연설 “But why, some say, the Moon?” → “not because they are easy, but because they are hard” → 아폴로 11호 착륙 교신 “The Eagle has landed”(1969.7.20) |

```bash
MEDIA=$PWD/media python3 politics/prep_split.py jfkmoon     # 원본: media/speech/
./render.sh jfkmoon
```

- **영상**: [John F. Kennedy Speech - Rice Stadium](https://archive.org/details/John-F-Kennedy_Speech_Rice-Stadium): NASA 존슨우주센터(JSC) 홍보실이 archive.org에 올린 NASA 컬렉션(creator: NASA, “JFK Resource Reel”, Public Domain Mark) 720p ProRes 사본의 1355–1417초. 방송사 화면이나 유튜브 재업로드는 쓰지 않았습니다. 착륙 장면은 [HQ-194 〈Eagle Has Landed: The Flight of Apollo 11〉](https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928)(NASA 1969년 영화, NARA 255-HQ-194)의 783–814초입니다. 16mm 하강 카메라 화면과 실제 교신 음성이 나오는 구간이고, 이 구간에는 내레이션이 없습니다.
- **라이선스**: 둘 다 미국 연방정부 저작물이라 퍼블릭 도메인입니다(17 U.S.C. §105). 수익 창출 채널에도 올릴 수 있습니다. NASA 미디어 가이드라인에 따라 NASA가 보증하거나 후원한다는 인상을 주면 안 됩니다. 화면 크레딧은 “NASA”만 적습니다.
- **자막**: 영어 원문은 같은 NASA 항목의 연설문(`JFK-Address-at-Rice.txt`, JFK 도서관 연설문과 같은 내용)을 기준으로, faster-whisper small.en·medium.en·large-v3로 들은 실제 발화에 맞췄습니다. 연설문과 다르게 말한 곳(“we're willing”, “one we intend to win”, “We choose to go to the Moon”을 세 번 말함)은 들리는 대로 적었습니다. 착륙 교신은 공식 교신록 문구(Contact light / Okay, engine stop / We copy you down, Eagle / Tranquility Base here. The Eagle has landed)와 whisper 두 모델이 일치합니다. 영화판 음성에는 “Houston,”이 들리지 않아서 자막에 넣지 않았습니다. 화자는 차례로 올드린, 휴스턴 관제센터(찰리 듀크), 암스트롱입니다.
- **컷**: 둘째 “We choose to go to the Moon” 뒤의 박수 약 6초(원본 클립 25.6–31.2초)만 잘랐습니다(흰 번쩍임). 그 앞뒤 문장은 이어지는 말이라 뜻이 바뀌지 않습니다. 하강 화면은 착륙 직후 그림자 때문에 검게 변해서, “The Eagle has landed” 소리(영화 802.4초)에는 같은 영화에서 5.6초 뒤에 나오는 착륙 직후 창밖 화면(808.0초)을 깔았습니다(`media/speech/a11_eagle_landed_window.mp4`, 이름표 “착륙 직후 창밖”).
- “약 7년 뒤 · 1969년 7월 20일”: 연설(1962.9.12)에서 착륙까지는 6년 10개월이라 “약”을 붙였습니다. 끝 스티커는 연설 핵심 구절을 반복한 것입니다. 음악은 넣지 않았습니다(현장 박수와 육성만).
- 템플릿 변경(`prep_split.py`, 기존 쇼츠에는 영향 없음): 구간의 `"credit"`이 그 구간이 나오는 동안의 크레딧이 되고, 구간의 `"shows"`(names 번호, B-roll이면 -1)를 주면 화면에 말하는 사람이 없는 장면에서도 모든 자막에 `🎙 이름`이 붙습니다.

**jfkmoon** — 케네디가 달에 가자고 한 진짜 이유..? 🌕 “쉬워서가 아니라, 어렵기 때문에”
> 1962년 9월 12일, 미국 휴스턴 라이스대학교. 존 F. 케네디 대통령은 “왜 하필 달이냐”는 물음에 이렇게 답했습니다. “우리는 달에 가기로 했습니다. 쉬워서가 아니라 어렵기 때문입니다.” 그로부터 약 7년 뒤인 1969년 7월 20일, 아폴로 11호 착륙선 이글이 달에 내려앉았습니다. 연설과 교신은 실제 육성이고, 번역은 원문 그대로 옮겼습니다(박수 구간만 짧게 줄임).
> 영상: NASA (라이스대 연설 필름, 1969년 NASA 영화 〈Eagle Has Landed: The Flight of Apollo 11〉). NASA가 이 영상을 보증하거나 후원하지 않습니다.
> #케네디 #달착륙 #아폴로11호 #명연설 #영어공부 #동기부여 #shorts

## 오바마 학생 연설 쇼츠 (`politics/obama09*`)

레퍼런스(유명인이 자기 목소리로 노력·실패를 말하는 장면 + 위 영어·아래 한국어 2단 자막 + 상식을 뒤집는 질문형 제목)의 **형식만** 따라 만든 두 편입니다. 2009년 9월 8일 버락 오바마 대통령이 버지니아주 알링턴 웨이크필드 고등학교에서 전국 학생들에게 한 개학 연설이고, 영상은 백악관이 직접 촬영·공개한 파일입니다.

| id | 제목 | 길이 | 원본 구간 (백악관 파일 기준) |
| --- | --- | --- | --- |
| `obama09` | 세상에서 가장 성공한 사람들, / 실패도 가장 많았다..? | 49.4초 | 877.5–926.3초 (자르지 않음) |
| `obama09b` | 잘하는 건 정말 / 타고나는 걸까..? | 48.7초 | 935.85–974.35초 + 1005.55–1014.95초 (컷 1번, 흰 번쩍임) |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py obama09    # 원본: media/speech/
./render.sh obama09
```

- 레이아웃: `"subOrder": "en-ko"`(영어 위·한국어 아래), `captionY` 1420, 영어 `[괄호]`와 한국어 `keys`로 핵심 구절만 노란색(obama09: the most failures / rejected 12 times / teach you, obama09b: No one's born / hard work / practice / don't ever give up on yourself).
- 백악관 영상 자체에 청중 컷어웨이가 있어서(원본 882.45–887.71초, 942.64–947.88초) 그 구간은 크롭 없이 정사각으로 보여 주고, 그 위의 자막에는 `🎙 버락 오바마`가 붙습니다. 이 컷어웨이 구간은 세그먼트에 `"shows": -1`(화면에 말하는 사람이 없음)을 줘서 표시합니다.
- 자막 원문은 백악관 공식 녹취록(실제 발언본, "12:06 P.M. EDT")과 faster-whisper small.en·medium.en을 대조했고 세 가지가 모두 일치합니다. 녹취록의 "J.K. Rowling's -- who wrote Harry Potter --"는 실제로도 그렇게 말해서 그대로 적었습니다. 연설 원고에 있는 "No one's born being good at all things"를 실제 발언대로 썼습니다("Nobody's"가 아님).
- `obama09b`의 컷: "…before it's good enough to hand in." 뒤에서 "질문하고 도움을 청하라"는 대목(약 31초)을 빼고 "And even when you're struggling…"으로 이었습니다. 마지막 "don't ever give up on yourself." 뒤의 "Because when you give up on yourself, you give up on your country."는 넣지 않았습니다(문장 단위로 끊어 의미는 바뀌지 않음).
- 음악·효과음 없이 연설 원음(박수 포함)만 씁니다. AI 목소리·내레이션 없음.
- 라이선스: 백악관(대통령실) 직원이 직무로 만든 영상이라 미국 연방정부 저작물, **퍼블릭 도메인**(17 U.S.C. §105)입니다. 현재는 국립문서기록관리청(NARA)이 관리하는 obamawhitehouse.archives.gov에 보존돼 있습니다. 화면 오른쪽 위 "WH.gov" 표시는 원본 그대로입니다. 백악관·오바마 전 대통령·오바마 재단이 이 영상을 보증하거나 후원하는 것처럼 보이면 안 되고, 정치적 목적으로 쓰지 않습니다. C-SPAN·방송사 화면, 알링턴 카운티 방송(ATV) 녹화본은 쓰지 않았습니다.
- 영상: [President Obama's Message for America's Students](https://obamawhitehouse.archives.gov/video/President-Obamas-Message-for-Americas-Students) (파일 `https://obamawhitehouse.archives.gov/videos/2009/September/090809_ArlingtonVA.mp4`, 1280×720, 19분), 녹취록: [Remarks by the President in a National Address to America's Schoolchildren](https://obamawhitehouse.archives.gov/the-press-office/remarks-president-a-national-address-americas-schoolchildren). 잘라낸 원본과 출처·구간은 `media/speech/obama09*.mp4`·`.json`.

**obama09** — 세상에서 가장 성공한 사람들, 실패도 가장 많았다?
> 2009년 9월 8일, 미국 버지니아주 웨이크필드 고등학교. 버락 오바마 대통령이 전국 학생들에게 한 개학 연설 중 '실패' 대목입니다. 해리 포터 첫 책은 12번 거절당했고, 마이클 조던은 고등학교 농구팀에서 탈락했습니다. "실패가 여러분을 규정하게 두지 말고, 실패가 여러분을 가르치게 하세요." 영어 원문과 한국어 번역 자막.
> 영상: 백악관(The White House, 2009) · 이 영상은 백악관이나 연설자가 보증·후원한 것이 아닙니다.
> #동기부여 #실패 #영어공부 #영어명언 #오바마 #해리포터 #마이클조던 #shorts

**obama09b** — 잘하는 건 정말 타고나는 걸까?
> 2009년 9월 8일, 미국 웨이크필드 고등학교 개학 연설. "모든 걸 잘하게 태어나는 사람은 없습니다. 열심히 노력해야 잘하게 되는 겁니다." 버락 오바마 대통령이 학생들에게 한 '연습' 이야기. 영어 원문과 한국어 번역 자막.
> 영상: 백악관(The White House, 2009) · 이 영상은 백악관이나 연설자가 보증·후원한 것이 아닙니다.
> #동기부여 #노력 #연습 #1만시간의법칙 #영어공부 #영어명언 #오바마 #shorts

## 뉴스 쇼츠 스타일 (`"titleStyle": "news"`, `"hook"`)

국내 스포츠·연예 뉴스 쇼츠에서 흔한 모양입니다. 위쪽 흰 띠에 검은 제목 두 줄, 얼굴 위에 흰 테두리를 두른 빨간 헤드라인 두 줄이 나옵니다. 빨간 헤드라인은 첫 프레임부터 보여서 그대로 썸네일이 됩니다.

- 내레이션 쇼츠(`shorts/<id>/edit.json`)와 자막 쇼츠(`politics/<id>/edit.json`) 모두에서 쓸 수 있습니다.
  - `"titleStyle": "news"` — 제목을 흰 띠 위 검은 글씨로 바꿉니다. 내용은 기존처럼 `title` 두 줄입니다.
  - `"hook": ["대한민국 축구가", "들썩이고 있습니다"]` — 빨간 헤드라인입니다.
  - `"hookY"` — 헤드라인 중심 높이입니다. 기본 1180으로, 정사각 화면 아래쪽 얼굴·가슴께에 놓입니다.
  - `"hookTo"` — 헤드라인을 내리는 시각입니다. 없으면 끝까지 보입니다.
  - 자막이 겹치지 않게 `"captionY": 1430` 정도로 내립니다.
- 헤드라인과 제목은 사실이어야 합니다. 이 형식의 채널 상당수가 기자회견·중계 영상을 그대로 쓰고 없는 일을 지어내 저작권 경고나 명예훼손 소송을 받습니다. 여기서는 확인된 기사만 쓰고, 그림은 공공누리 1유형·CC BY·퍼블릭 도메인 사진만 씁니다.

## 그래픽 해설 쇼츠 (`gfx` 클립, `"titleStyle": "band"`)

조회수 10만 이상 한국 정보 쇼츠의 화면 문법을 따른다(`research/research-info.md`).
- 위쪽 400px 검정 띠에 2줄 제목을 0초부터 끝까지 둔다.
- 가운데 1080×1080 칸에 그래픽이나 영상을 넣는다.
- 아래쪽에 1줄 자막을 넣는다(`"captionY": 1640`).

남의 영상 없이 우리 그래픽과 내레이션만으로 25~35초 해설을 만들 수 있다. 예시는 `shorts/gfxdemo/`에 있다. 모든 그래픽 종류를 한 번씩 쓰는 시험용이라 업로드하지 않는다.

- **제목**: `"titleStyle": "band"`이면 둘째 줄이 노랑이다. 줄 안에 `[핵심어]`를 쓰면 그 단어만 노랑이 된다.
- **그래픽 클립**: `clips`의 한 항목에 `"src"` 대신 `"gfx": {...}`를 넣는다. `"src"`도 함께 주면 그 영상이 어둡게 깔린다. `"steps"`는 나레이션 기준점(`"b.미국"`)이나 클립 시작 후 초(숫자)이고, 그래픽이 하나씩 나오는 순간이다. 텍스트 안의 `[ ]`는 노랑이다.

  | type | 쓰임 | 주요 값 |
  |---|---|---|
  | `counter` | 숫자가 올라감 (연봉, 금액) | `to`, `kr`(1억 4,000만 표기), `unit`, `label`, `sub`, `emoji` |
  | `bars` | 막대 비교 (나라별, 연도별) | `items[{label, value, text, emoji, color}]`, `hi`, `title` |
  | `units` | 개수로 체감 (쌀알 1개 = 1억) | `emoji`, `n`, `per`, `label`, `total`, `zoom`(1개에서 확 빠지며 전체) |
  | `text` | 뉴스 요약·문장 카드 | `lines`, `badge`("긴급정리"), `align` |
  | `ox` | 사실 판정 O / X / △ | `verdict`, `text`, `sub` |
  | `vs` | 맞대결 | `left`, `right`(`label`, `value`, `emoji`), `win` |
  | `rank` | TOP N 순위 | `n`, `text`, `emoji` |
  | `quiz` | 문제 → 3초 카운트 → 정답 | `q`, `options`, `answer`, `count`. steps는 [카운트 시작, 정답] |

- **사진**: 출처 파일이 `.jpg`/`.png`/`.webp`이면 사진으로 보여 주고 천천히 줌한다.
- **빨간 원·화살표**: `"marks": [{"kind": "circle", "x": 540, "y": 900, "r": 150, "from": "a.연봉", "to": "a@end"}]`. 좌표는 1080×1920 화면 기준이다. `arrow`는 (x, y)를 가리키고 `rot` 방향에서 들어온다.
- **순위표 (TOP 5 랭킹)**: 클립(prep.py)이나 구간(politics/prep_split.py)에 `"rank": {"n": 5, "label": "낙하산이 펴지는 순간"}`을 달면 화면 아래(기본 y 1496, `"rankY"`로 조정)에 1~5위 목록이 생긴다. 아직 안 나온 순위는 "???"로 보이고, 지금 나오는 순위는 노랑으로 켜진다. 이때 자막은 영상 위 `"captionY": 1380`에 둔다. 조회수 10만 이상 오락 쇼츠 가운데 「역대급 ○○ 랭킹 TOP5」형이 중앙값 410만으로 가장 높다(`research/research-fun.md`).
- **나레이션**: Edge TTS를 `"rate": "+20%"` 안팎으로 빠르게 쓴다. 한 줄은 15자 안팎, 자막 한 장은 12자 이내가 되도록 `/`로 나눈다. 마지막 줄은 반전이나 첫 질문으로 돌아가는 말로 끝낸다.

## 썰 쇼츠 (`scene`·`post` 클립, 등장인물 목소리)

조회수 10만 이상 오락 쇼츠 중 TTS·내레이션 썰은 중앙값 109만이다. 썰구리(구독 3.9만)는 커뮤니티 글 화면, 캐릭터, AI 내레이션만으로 최근 15편 중 14편이 10만을 넘었다(`research/research-fun.md`). 우리는 AI 그림 도구가 없어서 캐릭터를 직접 그린다(`src/lib/Sseol.tsx`). 표정이 바뀌는 찹쌀떡 모양 캐릭터가 문장마다 장면을 연기한다. 예시는 `shorts/sseol1/`이다.

- **화면**: `"titleStyle": "band"` 제목 띠, 가운데 1080×1080 장면, 아래 자막(`"captionY": 1650`). 장면 위에는 자막용 그늘을 깔지 않는다.
- **첫 클립 `post`**: 커뮤니티 글 카드(실제 서비스 이름이나 로고 없음)로 훅을 건다. `chars`에 주인공 한두 명(예: 놀란 얼굴 `shock`)을 넣으면 카드 오른쪽 아래에 0초부터 서 있어서, 첫 프레임(썸네일)에 글만이 아니라 얼굴이 보인다(조회수 높은 쇼츠는 첫 프레임에 주인공을 보여 준다). `title`, `body`(줄마다 `steps`로 한 줄씩 나타남), `board`(기본 "썰 게시판"), `meta`(기본 "익명 · 창작 썰"). 조회수·추천 수를 지어내지 않도록 `likes`·`comments`·`hot`(🔥 인기글)은 기본으로 끈다.
- **장면 `scene`**: 문장마다 한 장면(2~3초)을 둔다.

  | 값 | 쓰임 |
  |---|---|
  | `chars[]` | 등장인물. `name`(이름표), `color`, `mood`, `to`(steps[2]에 바뀌는 표정), `size`(1보다 크면 키가 큼), `x`(0~1), `hat`(머리 위 이모지), `flip` |
  | `mood` | `neutral` `happy` `laugh` `shock` `sad` `cry` `angry` `smug` `shy` `think` `sleep` `love` `sick` |
  | `bg` | 배경 `class` `home` `street` `store` `army` `night` `stage` `office` `door`(현관문·초인종), 또는 CSS 배경 |
  | `sign` | 배경 판에 쓰는 글(칠판, 무대 현수막, 생활관 게시판, 가게 간판, 현관문 호수) |
  | `say` | 말풍선 `{"who": 0, "text": "야! [내 거]잖아!"}`. 말하는 인물 머리 위에 뜬다(steps[0]) |
  | `prop` / `propX` | 소품 이모지(🥛📱💸). steps[1]에 튀어나온다 |
  | `big` | 장면 위에 크게 박히는 말("🥛 × [200]"), steps[3] |
  | `card` | 화면 전체를 어둡게 덮는 전환 문구("15년 후...") |
  | `place` | 왼쪽 위 장소 표시("📍 졸업식") |
  | `zoom` / `focus` | 3초 동안 천천히 다가감, `focus`는 가운데 둘 인물 번호 |

- **목소리**: `script.json`의 `"voices"`에 인물마다 `{"edge", "rate", "pitch"}`를 두고, 줄마다 `"voice"`로 고른다. 내레이터는 `nar`다. 예: 아이 목소리 `{"edge": "ko-KR-SunHiNeural", "rate": "+18%", "pitch": "+30Hz"}`. 줄마다 음량을 맞추므로 목소리가 달라도 크기는 같다.
- **대사는 말풍선으로**: 인물의 대사 줄은 `"cap": [""]`로 두면 아래 자막을 띄우지 않고 말풍선만 보여 준다. 내레이션 줄만 아래 자막으로 나온다.
- **이야기 틀**: 이상한 행동이나 상황으로 시작한다(제목 "~한 이유", "~한 썰"). 3~4번 쌓아서 반전 한 줄로 끝내고 바로 끊는다. 30~40초.
- **같은 인물은 같은 색**: `color`를 비우면 장면 안 순서대로 색이 정해져서, 같은 인물이라도 순서가 바뀌면 색이 바뀐다. 여러 장면에 나오는 인물은 `"color"`를 직접 준다(예: 나 `#FFD84D`, 짝꿍 `#8FD3FF`). `hat`은 머리 위에 얹는 것(모자, 우산)에만 쓴다. 안경 같은 얼굴 소품은 머리 위에 떠서 후광처럼 보인다.
- **창작 표시**: 이야기는 지어낸 것이다. 실화라고 쓰지 않고, 카드 `meta`와 설명란에 "창작"을 밝힌다. 실존 인물, 학교, 회사, 브랜드 이름은 쓰지 않는다.

## 썰 쇼츠 (`sseol1`~`sseol4`)

학교·가족 창작 썰 4편. 모두 지어낸 이야기이고, 카드 `meta`는 "익명 · 창작 썰"이다. 음악은 gain 0.2 안팎, 화면 크레딧은 없다(그림은 직접 그린 것).

| id | 제목 띠 | 한 줄 줄거리 | 길이 | 음악 |
| --- | --- | --- | --- | --- |
| `sseol1` | 짝꿍이 1년 동안 / 내 우유를 마신 이유 | 초6 짝꿍이 1년 내내 내 우유를 뺏어 먹었는데, 사실은 우유 먹고 배 아파하는 나 대신 마셔 준 것. 15년 뒤 그 짝꿍은 남편 | 34.3초 | Monkeys Spinning Monkeys |
| `sseol2` | 반장이 매일 내 책상에 / 쪽지를 두고 간 이유 | 고1 반장의 매일 쪽지에 설레서 답장까지 썼는데, 엄마가 반장한테 부탁한 알림이었다. 그날 저녁 내 답장은 엄마 손에 | 37.4초 | Sneaky Snitch |
| `sseol3` | 할머니가 비 오는 날마다 / 내 운동화를 숨긴 이유 | 비만 오면 사라지던 운동화는 할머니가 몰래 빨아 전기장판에 말려 둔 것. 예보가 틀려 쨍쨍한 날에도 장화는 신고 감 | 39.9초 | Monkeys Spinning Monkeys |
| `sseol4` | 환갑 아빠가 갑자기 / 영어 공부를 시작한 이유 | 외국에서 자란 남자친구를 맞으려고 새벽마다 "아임 수아스 파더"를 연습한 아빠. 남자친구는 한국말을 잘했지만 아빠는 지금도 영어로만 말함 | 39.0초 | Scheming Weasel |

**목소리** (Edge TTS, `script.json`의 `voices`)
- `sseol1`: 내레이션 SunHi +12%, 나(아이) SunHi +18% +30Hz, 짝꿍 InJoon +15% +25Hz
- `sseol2`: 내레이션 SunHi +12%, 나 SunHi +15% +22Hz, 반장 InJoon +12% +10Hz, 짝꿍 HyunsuMultilingual +15% +15Hz, 엄마 SunHi −3% −10Hz
- `sseol3`: 내레이션 InJoon +12%, 나(아이) InJoon +15% +22Hz, 할머니 SunHi −8% −10Hz
- `sseol4`: 내레이션(수아) SunHi +12%, 아빠 InJoon −5% −15Hz, 엄마 SunHi −5% −10Hz, 남자친구 HyunsuMultilingual +12%

모든 줄을 faster-whisper(medium)로 다시 들어 대본과 맞췄다. 잘못 들리던 줄은 말을 바꿨다("신는 거야" → "아기 같잖아", "엿들어 봤다" → "문 뒤에 숨어서 들어 봤다", "갸웃" → "갸우뚱").

### 업로드 문구

**sseol1**
- 제목: 짝꿍이 1년 동안 내 우유를 마신 이유ㅋㅋ
- 설명: 초6 때 짝꿍이 매일 내 급식 우유를 뺏어 먹었다… 졸업식 날 밝혀진 진짜 이유 🥛 (창작 썰입니다)
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0
- 해시태그: #썰 #창작썰 #썰툰 #학교썰 #쇼츠

**sseol2**
- 제목: 반장이 매일 내 책상에 쪽지를 두고 간 이유ㅋㅋ
- 설명: 매일 아침 책상 위 반장의 쪽지… 설레서 답장까지 썼는데 📝 (창작 썰입니다)
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0
- 해시태그: #썰 #창작썰 #썰툰 #학교썰 #엄마썰

**sseol3**
- 제목: 할머니가 비 오는 날마다 운동화를 숨긴 이유
- 설명: 비만 오면 사라지던 내 운동화, 범인은 할머니였다 👟☔ (창작 썰입니다)
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0
- 해시태그: #썰 #창작썰 #썰툰 #할머니 #가족썰

**sseol4**
- 제목: 환갑 아빠가 갑자기 영어 공부를 시작한 이유ㅋㅋ
- 설명: 매일 새벽 5시, 아빠가 몰래 연습하던 단 한 문장 📖 (창작 썰입니다)
  Music: "Scheming Weasel (faster version)" Kevin MacLeod (incompetech.com), CC BY 4.0
- 해시태그: #썰 #창작썰 #썰툰 #아빠썰 #가족썰

## 썰 쇼츠 (`sseol5`~`sseol8`)

`shorts/sseol1`과 같은 틀로 만든 알바·회사·연애·가족 창작 썰 4편이다. 모두 지어낸 이야기이고, 실존 인물·가게·회사 이름은 없다. 목소리는 Edge TTS이고 줄마다 faster-whisper로 알아듣는지 확인했다.

| id | 제목 띠 | 길이 | 한 줄 줄거리 | 음악 |
| --- | --- | --- | --- | --- |
| `sseol5` | 새벽 3시 할아버지에게 / 돈 받지 말라는 사장님 | 39.9초 | 편의점 야간 알바 첫날, 새벽 3시마다 우유와 빵만 두고 가는 할아버지. 알고 보니 알바생이 착한지 보러 온 사장님 아버지였고, 다음 달 시급이 올랐다. | Scheming Weasel |
| `sseol6` | 신입이 매일 아침 팀장님 / 책상에 사탕을 두는 이유 | 34.5초 | 아부다, 짝사랑이다 소문이 돌았지만, 신입은 팀장님이 아침을 거른 날만 회의가 두 시간이 된다는 걸 알아냈다. 이제 회의는 10분, 사탕값은 팀이 나눠 낸다. | Sneaky Snitch |
| `sseol7` | 소개팅 상대가 내 이름 듣고 / 웃음 참은 이유 | 34.4초 | "보리예요" 하자마자 웃음을 참던 소개팅 상대. 그 집 강아지 이름이 보리였다. 3년 뒤 결혼해서, 부르면 보리 둘이 다 온다. | Monkeys Spinning Monkeys |
| `sseol8` | 택배 기사님이 우리 집만 / 오면 웃는 이유 | 33.0초 | 기사님들이 초인종만 누르면 웃는 이유는, 다섯 살 조카가 몰래 바꿔 녹음한 초인종 소리. 다음 날 문 앞에 사탕과 "나도 사랑해" 쪽지가 있었다. | Hyperfun |

**목소리**(`script.json`의 `voices`)

- `sseol5`: 내레이터·나 `ko-KR-HyunsuMultilingualNeural` +14% / +15%·+8Hz, 사장님 `InJoon` +8%·−4Hz, 할아버지 `InJoon` −5%·−15Hz
- `sseol6`: 내레이터·나 `HyunsuMultilingual` +14% / +15%·+8Hz, 신입 `SunHi` +10%·+6Hz, 선배 `InJoon` +10%, 동료 `SunHi` +14%·−6Hz, 팀장님 `InJoon` +5%·−8Hz
- `sseol7`: 내레이터·나 `SunHi` +12% / +12%·+8Hz, 상대(남편) `InJoon` +10%
- `sseol8`: 내레이터·나 `SunHi` +12% / +14%·+8Hz, 조카 `SunHi` +15%·+32Hz, 기사님 `InJoon` 0%·−8Hz

초인종 소리(`sseol8`의 `g`)는 말풍선 대신 🔔 자막으로 보여 준다. 녹음된 소리라 말하는 인물이 화면에 없기 때문이다.
말풍선 글은 단어 안 글자 사이에 U+2060(보이지 않는 연결 문자)을 넣어, 긴 말풍선이 단어 중간이 아니라 띄어쓰기에서 줄을 바꾸게 했다. 지금은 템플릿 말풍선이 `wordBreak: keep-all`로 단어를 지키므로 새 편에는 넣지 않아도 된다.

**업로드 문구**

`sseol5`
- 제목: 새벽 3시 할아버지한테 돈 받지 말라는 사장님ㅋㅋ
- 설명:
  ```
  편의점 야간 알바 첫날 들은 이상한 규칙의 정체 🥛🍞 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물과 장소는 실제와 관계없습니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #편의점알바

`sseol6`
- 제목: 신입이 매일 아침 팀장님 책상에 사탕을 두는 이유ㅋㅋ
- 설명:
  ```
  아부도 짝사랑도 아니었던 신입의 사탕 🍬 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물과 회사는 실제와 관계없습니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #회사생활

`sseol7`
- 제목: 소개팅 상대가 내 이름 듣고 웃음 참은 이유ㅋㅋ
- 설명:
  ```
  첫 소개팅에서 이름 말하자마자 생긴 일 🐶 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #소개팅

`sseol8`
- 제목: 택배 기사님이 우리 집만 오면 웃는 이유ㅋㅋ
- 설명:
  ```
  현관 카메라에 찍힌 기사님들이 웃는 이유 🔔 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #조카

## 썰 쇼츠 (`sseol9`~`sseol12`)

이웃·가족·단골 가게 창작 썰 4편이다. 모두 지어낸 이야기이고, 실존 인물·가게·은행·브랜드 이름은 없다. 템플릿의 `keep-all` 말풍선을 쓰므로 U+2060은 넣지 않았다.

| id | 제목 띠 | 길이 | 한 줄 줄거리 | 음악 |
| --- | --- | --- | --- | --- |
| `sseol9` | 옆집 할머니가 매일 우리 집 / 문에 반찬을 거는 이유 | 35.1초 | 매일 저녁 문고리에 걸리는 반찬. 3년 전 엘리베이터가 고장 난 날 쌀 포대를 5층까지 들어 드린 옆집 할머니의 보답이었고, 반찬통을 돌려드리러 갔다가 더 받아 와서 냉장고 절반이 할머니 반찬통이 됐다. | Monkeys Spinning Monkeys |
| `sseol10` | 동생이 내 생일마다 / 이상한 선물을 주는 이유 | 33.0초 | 양말 한 짝, 이어폰 한쪽, 머리끈, 접는 우산. 전부 내가 잃어버린 물건을 동생이 1년 내내 주워 모은 것이었고, 마지막 상자엔 동생이 빌려 가서 안 돌려준 내 패딩이 들어 있었다. | Sneaky Snitch |
| `sseol11` | 카페 사장님이 내 컵에만 / 그림을 그려 주는 이유 | 30.3초 | 컵 홀더에 만화처럼 이어지는 고양이 그림. 그 고양이는 비 오는 날만 노란 우산을 쓰고 오는 나였고, 마지막 화에서 고양이는 꽉 찬 단골 도장판을 들고 있었다. | Hyperfun |
| `sseol12` | 할아버지가 매일 같은 시간에 / 은행에 가는 이유 | 30.9초 | 매일 오전 10시 은행 로비에서 손님들에게 "어서 오세요" 하시는 할아버지. 30년 전 이 지점의 지점장이셨고, 직원들은 커피를 드리고, 오늘은 신입 교육까지 하셔서 명예 지점장님이 됐다. | Scheming Weasel |

**목소리**(`script.json`의 `voices`)

- `sseol9`: 내레이터·나 `SunHi` +12% / +14%·+8Hz, 할머니 `SunHi` −8%·−10Hz
- `sseol10`: 내레이터·나 `HyunsuMultilingual` +14% / +15%·+8Hz, 동생 `SunHi` +12%·+15Hz
- `sseol11`: 내레이터·나 `SunHi` +12% / +14%·+8Hz, 사장님 `InJoon` +6%
- `sseol12`: 내레이터·나 `SunHi` +12% / +14%·+8Hz, 할아버지 `InJoon` −5%·−15Hz, 직원 `HyunsuMultilingual` +10%·+4Hz

**업로드 문구**

`sseol9`
- 제목: 옆집 할머니가 매일 우리 집 문에 반찬을 거는 이유ㅋㅋ
- 설명:
  ```
  매일 저녁 문고리에 걸린 반찬의 정체 🍱 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #이웃

`sseol10`
- 제목: 동생이 내 생일마다 이상한 선물을 주는 이유ㅋㅋ
- 설명:
  ```
  양말 한 짝, 이어폰 한쪽... 동생 선물의 비밀 🎁 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #남매

`sseol11`
- 제목: 카페 사장님이 내 컵에만 그림을 그려 주는 이유ㅋㅋ
- 설명:
  ```
  컵 홀더에 연재되는 고양이 만화의 정체 ☕🐱 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물과 가게는 실제와 관계없습니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #단골카페

`sseol12`
- 제목: 할아버지가 매일 같은 시간에 은행에 가는 이유ㅋㅋ
- 설명:
  ```
  매일 오전 10시, 할아버지를 몰래 따라가 봤다 🏦 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물과 은행은 실제와 관계없습니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #할아버지

## 팻 베어 위크 쇼츠 (`fatbear`, `fatbear2`)

알래스카 카트마이 국립공원의 ‘팻 베어 위크’(2026년은 9월 22~29일) 시기에 맞춘 두 편입니다. 내레이션 방식(`shorts/fatbear*/`)이고, 영상과 사진은 모두 **미국 국립공원관리청(NPS)이 만든 것**만 썼습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `fatbear` | 곰 살찌우기 대회 🐻 / 역대 챔피언 비포·애프터 | 57.3초 | 164번 ‘버키’ 2026년 6월 → 늦여름, 대회 소개, 겨울잠과 연어, 747(“비포도 이미 뚱뚱”), 480 오티스 4회 우승, 128 그레이저 2연패, 32 청크(부러진 턱으로 2025 우승), 작년 투표 수, 2026 챔피언 스티커 |
| `fatbear2` | 곰 살찌우기 대회 시즌 🐟 / 곰이 연어 잡는 법 3가지 | 52.5초 | 브룩스 폭포, 폭포 꼭대기 ‘립 피셔’(그레이저), 폭포 아래 앉아 실패한 연어 줍기(버키), 물속에 머리 박기·자리싸움, 곰 목걸이 카메라(가자미·다른 곰), 89번 ‘백팩’ 별명 유래와 2026 우승 스티커 |

- **2026년 우승: 89번 ‘백팩’** — 내레이션은 그대로 두고 스티커로만 넣었습니다(`fatbear` 끝, `fatbear2`의 백팩 대목과 끝). 근거: explore.org [Fat Bear Week 결과표](https://explore.org/fat-bear-week) 9월 29일 결승 “89 Backpack: 103,334 / 910: 98,253”(전체 2,503,731표), [CBS News 2026.9.29](https://www.cbsnews.com/news/fat-bear-week-2026-winner-backpack/)(같은 득표 수, “according to Explore.org”), [UPI 2026.9.30](https://www.upi.com/Odd_News/2026/09/30/fat-bear-week-katmai-national-park-backpack-winner/1461790779913/)(카트마이 국립공원 페이스북 발표 인용). 2026-10-09 기준 NPS 웹사이트(명예의 전당·보도자료)에는 아직 2026년 결과가 없습니다. 백팩의 늦여름 사진은 explore.org 사진이라 계속 쓰지 않았습니다.
- 2026년 우승 외의 사실은 모두 NPS 페이지 기준입니다: 역대 우승(2014 오티스, 2015 409 ‘비드노즈’, 2016·2017 오티스, 2018 409, 2019 435 홀리, 2020 747, 2021 오티스, 2022 747, 2023·2024 128 그레이저, 2025 32 청크), 2014년 하루짜리 ‘팻 베어 튜즈데이’로 시작, 겨울잠 동안 몸무게 최대 3분의 1 감소, 연어는 대략 6월 말~9월, ‘사람보다 갈색곰이 많은 곳’([Fat Bear Week: Past and Present](https://www.nps.gov/katm/learn/nature/fat-bear-week-past-and-present.htm)); 2026년 9월 22~29일, 작년 100여 개국 170만 표 이상([NPS 보도자료 2026.9.11](https://www.nps.gov/katm/learn/news/fat-bear-week-2026.htm)); 그레이저는 ‘립 피셔’·새끼 3번 출산([128](https://www.nps.gov/katm/bear-128-grazer.htm)); 청크는 2025년 초여름 부러진 턱으로 돌아왔지만 살을 찌움([32](https://www.nps.gov/katm/bear-32-chunk.htm)); 버키는 폭포 아래 앉아 점프에 실패한 연어를 잡고, 2026년 브룩스강 최강자([164](https://www.nps.gov/katm/bear-164-bucky.htm)); 백팩은 새끼 때 발을 다쳐 어미 등에 업혀 다녀서 생긴 별명([89](https://www.nps.gov/articles/000/bear-89-backpack.htm)).
- ‘747 = 점보 제트기’는 번호를 두고 한 농담이고, 747의 ‘비포’ 사진이 이미 뚱뚱한 것은 NPS 페이지 사진 그대로입니다(대체 텍스트도 “already, honestly, quite fat”). 그레이저의 비포(2024)와 애프터(2023)는 연도가 달라서 스티커로 연도를 밝혔습니다. 오티스는 비포 사진이 NPS 사진이 아니라(Courtesy N. Boak) 애프터만 썼습니다.
- **explore.org 웹캠 영상·사진은 쓰지 않았습니다.** NPS 페이지에 같이 실린 “Courtesy of explore.org”, “Courtesy ○○” 사진도 뺐습니다.
- 영상 원본: [Brooks Camp Bear School 101](https://www.nps.gov/media/video/view.htm?id=D3EB8991-E1A2-4A2A-9A98-2F1C45991B0E) (NPS, 제작 Katmai NP & Harpers Ferry Center; 원본 음악은 Musicbed·Shutterstock 라이선스 음악이라 소리는 쓰지 않음), [Katmai Virtual Field Trip](https://www.nps.gov/media/video/view.htm?id=5E5C2E41-E0D4-44AD-B8D1-13596483B3F5) (NPS Video By T. Vaughn and J. Pfeiffenberger), 곰 목걸이 카메라 [Eating Flounder](https://www.nps.gov/media/video/view.htm?id=D8836D8B-7778-4896-B872-A541BC6D88FA)·[Bear Encounter](https://www.nps.gov/media/video/view.htm?id=3C759EC8-D2D1-4CF0-ADAA-D2EAC1214DFE) (NPS ‘Changing Tides’ 연구, 2015).
- 사진: NPS / N. Boak (747), NPS / C. Spencer (오티스), NPS / T. Carmack·F. Jimenez (그레이저), NPS / C. Loberg·T. Carmack (청크), NPS / C. Loberg (버키·백팩 2026).
- 사진은 `ffmpeg -loop 1`로 10초짜리 mp4를 만들어 영상처럼 넣었고, 얼굴 확대는 기존 `crop` 기능을 그대로 썼습니다(템플릿 변경 없음). 원본·사진과 각 파일의 출처 JSON은 `media/fatbear/`, 목소리는 `media/voice/fatbear*/`.

**fatbear** — 곰 살찌우기 대회 🐻 역대 챔피언 비포·애프터
> 알래스카 카트마이 국립공원의 ‘팻 베어 위크’는 겨울잠 준비를 가장 잘한(=가장 살찐) 곰을 전 세계 투표로 뽑는 대회입니다. 2026년 대회는 9월 22~29일. 두 번 우승한 747, 최다 4회 우승 오티스, 2연패 엄마 곰 그레이저, 부러진 턱으로도 2025년 우승한 청크까지 — 역대 챔피언의 비포·애프터를 모았습니다. 2026년 챔피언은 89번 ‘백팩’(explore.org 발표)! 여러분의 원픽은? 영상·사진: 미국 국립공원관리청(NPS) (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #팻베어위크 #FatBearWeek #곰 #알래스카 #국립공원 #shorts

**fatbear2** — 곰이 연어 잡는 법 3가지 🐟 (곰 살찌우기 대회 시즌)
> 알래스카 카트마이 국립공원 브룩스 폭포의 곰들은 연어를 이렇게 잡습니다. ① 폭포 꼭대기에서 입 벌리고 기다리기 ② 폭포 아래 앉아 점프에 실패한 연어 줍기 ③ 물속에 머리 박기. 곰 목걸이 카메라로 본 시점과, 새끼 때 엄마 등에 업혀 다녀서 별명이 ‘백팩’이 된 89번 곰 — 2026년 팻 베어 위크 챔피언(explore.org 발표) — 이야기까지. 영상·사진: 미국 국립공원관리청(NPS) (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Scheming Weasel (faster version)" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #팻베어위크 #FatBearWeek #곰 #연어 #알래스카 #shorts

## 축구 뉴스 쇼츠 (`newsfb1`~`newsfb4`)

‘어나더 뉴스’ 같은 국내 축구 뉴스 쇼츠의 **모양과 속도만** 따라 한 네 편입니다(흰 띠 제목 + 얼굴 클로즈업 + 빨간 헤드라인, 남자 뉴스 목소리 `ko-KR-InJoonNeural` +15%). 2026-10-09 기준 지난 2주(9.25~10.9)의 실제 기사만 썼고, 사실마다 매체 두 곳 이상에서 확인했습니다. 인용은 기사에 실린 말만 썼습니다.

| id | 흰 띠 제목 | 빨간 헤드라인 | 길이 | 내용 |
| --- | --- | --- | --- | --- |
| `newsfb1` | 손흥민 A매치 59호 골 / 차범근 넘었다 | 대한민국 축구 역사가 / 새로 쓰였습니다 | 46.1초 | 10.6 우즈베키스탄전 프리킥 골, 151경기 59골(차범근 136경기 58골), 월드컵 땐 56골 → 4연전 3골, 우루과이전 타이, 경기 뒤 소감, 2-0 승리 |
| `newsfb2` | 김민재 작심 발언 / “수비수들 불쌍하다” | 대표팀 분위기가 / 심상치 않습니다 | 49.1초 | 10.2 베네수엘라전 0-0 뒤 축구화를 벗어 던진 장면과 방송 인터뷰, 황인범 발언, 모레노 감독 반응(감싸면서도 반박), 이틀 훈련 불참(대표팀 “피로 누적”), 김민재 빠진 우즈벡전 2-0 |
| `newsfb3` | FC서울 10년 만의 우승 / 승점 10 남았다 | FC서울이 우승을 / 눈앞에 뒀습니다 | 42.9초 | 30라운드까지 19승 5무 6패 승점 62, 2위 울산 47, 남은 8경기에서 승점 10이면 자력 우승, 2016년 이후 첫 우승, 최소 실점 25, 클리말라·야고 13골 공동 선두, 10.10 제주전 |
| `newsfb4` | ‘손흥민 시대 저무나’ 석 달 뒤 / A매치 최다 골 신기록 | 손흥민이 / 실력으로 답했습니다 | 48.9초 | ‘3개월 전 vs 지금’ 반전 구성: 북중미 월드컵 1승 2패·3경기 무득점·남아공전 선발 제외·조별리그 탈락 → 대회 뒤 인스타그램 약속(“나를 필요로 하실 때까지… 죽기 살기로 달려보겠다”) → 에콰도르·우루과이·우즈벡전 골, 59골 신기록 → 2025 유로파리그 주장 우승 → 기록 날 소감 |

- 헤드라인 근거: “대표팀 분위기가 심상치 않습니다”는 스포츠조선(“대한민국 축구대표팀이 심상치 않다”)·머니투데이(“韓 대표팀 심상치 않은 분위기”) 표현을 따랐습니다. ‘충격’·‘초토화’·‘단독/속보’는 쓰지 않았습니다.
- `newsfb2`는 비판 기사라 모레노 감독의 반응(“김민재는 상징적인 선수… 그런 이야기는 충분히 할 수 있다”, “공격은 물론 수비도 11명 다 뛰었다”)과 대표팀의 훈련 불참 설명(“피로 누적”)을 함께 넣었습니다. 김민재가 교체된 시각은 매체마다 후반 35분·40분으로 달라 말하지 않았습니다.
- `newsfb3`는 **10월 9일 기준**입니다(화면에 스티커). 10일 제주전 결과가 나오면 내용이 낡으니 그 전에 올리거나 고쳐서 올려야 합니다.
- 사진은 모두 **지난 경기 자료**라 화면 위 크레딧에 연도와 경기를(예: “· 2021 이란전”), 첫 장면에 “사진은 지난 경기 자료” 스티커를, 경기 날짜 스티커에는 “사진은 2024년”을, 단체 사진에서 얼굴을 확대한 장면에는 “가운데: 김민재 · 2021년 사진”처럼 누구인지를 붙였습니다. 모레노 감독·김기동 감독·클리말라는 자유 라이선스 사진이 없어서(위키미디어의 것은 CC BY-SA이거나 구단 유튜브 캡처) 쓰지 않고, 발언 카드·순위표·계산 카드(직접 만든 그래픽)와 경기장 사진으로 대신했습니다. 레바논축구협회(FA Lebanon) CC BY 사진도 ‘협회 사진’이라 쓰지 않았습니다.
- 사진을 영상으로 바꾼 방법: `ffmpeg -loop 1 -t 12`로 12초짜리 mp4(타스님 사진은 아래 사진가 표기 띠를 잘라 냄)를 `public/<id>/src/`에 두고, 얼굴 확대는 `crop`, 천천히 밀기는 `zoom`. 템플릿 코드는 바꾸지 않았습니다. 사진·카드와 출처 JSON은 `media/newsfb/`, 목소리는 `media/voice/newsfb*/`.

**출처 (기사)**
- `newsfb1`: [한국일보 10.6](https://www.hankookilbo.com/news/article/A2026100621050002334)(151경기 59골, 차범근 136경기 58골, 오른발 낮은 프리킥, 월드컵 땐 56골), [SBS 10.6](https://news.sbs.co.kr/news/endPage.do?news_id=N1008785548), [국민일보 10.6](https://www.kmib.co.kr/article/view.asp?arcid=9000020378)(소감 “감정이 많이 북받치는 것 같다… 함께한 16년이란 시간이 소중하다”, 2-0), [엑스포츠뉴스 10.6](https://www.xportsnews.com/article/2204732)(잠시 말을 멈춤, “골문 오른쪽 하단 구석”, 같은 소감), [머니투데이 10.6](https://www.mt.co.kr/sports/2026/10/06/2026100621544044286), [서울신문 10.7](https://www.seoul.co.kr/news/sport/soccer/2026/10/07/20261007034002)(오세훈 후반 15분 헤더, 우루과이전 58호 타이, 월드컵 3골은 2014·2018), [한국일보 9.28](https://www.hankookilbo.com/news/article/A2026092821560005891)·[스포츠경향 9.28](https://sports.khan.co.kr/article/202609282157003/)(우루과이전 1-4, 58호 골), [FIFA 경기 보고서](https://www.fifa.com/ko/tournaments/mens/worldcup/2030/articles/korea-republic-v-uzbekistan-match-report-october-ko)
- `newsfb2`: [OSEN 10.2(네이트)](https://m.news.nate.com/view/20261002n37341)(교체 뒤 모레노 감독과 대화, 축구화, 김민재 인터뷰 전문, 모레노 “상징적이고 중요한 선수… 충분히 할 수 있다”, “공격은 물론 수비도 11명 다 뛰었다”), [스타뉴스 10.2(네이트)](https://m.news.nate.com/view/20261002n36375)(같은 장면·발언, 모레노 “섣불리 판단하는 것은 성급”), [머니투데이 10.3](https://www.mt.co.kr/amp/sports/2026/10/03/2026100316294283203), [스포츠조선 10.6(네이트)](https://m.news.nate.com/view/20261006n21778)·[파이낸셜뉴스 10.3](https://www.fnnews.com/news/202610031359112439)(황인범 “대표팀 9년 차… 변화돼야 하는 것들이 많은데 잘 안되는 것 같다”, 울먹임), [경향신문 10.5](https://www.khan.co.kr/article/202610052020025)(모레노 “공격에서도 수비에서도 함께 뛰어줘서 긍정적”, 김민재 실내훈련), [YTN 10.6](https://www.ytn.co.kr/_ln/0107_202610061437469220)(이틀 연속 팀 훈련 불참, 관계자 “피로 누적”), [국민일보 10.6](https://www.kmib.co.kr/article/view.asp?arcid=9000020378)(우즈벡전 출전 명단 제외), [코리아중앙데일리](https://www.koreajoongangdaily.com/sports/kim-minjae-likely-to-sit-out-uzbekistan-friendly-after-missing-training-for-second-straight-day/12905678)
- `newsfb3`: [국민일보 10.8](https://www.kmib.co.kr/article/view.asp?arcid=9000020975)(19승 5무 6패 승점 62, 울산 47, 남은 8경기·승점 10이면 자력 우승, 2016년 이후, 25실점 최소, 클리말라 13골 야고와 공동 선두, 제주 3위 46·최근 5경기 3승 2무), [뉴시스 10.8](https://www.newsis.com/view/NISX20261008_0003819968)(같은 수치, 10일 오후 2시 서울월드컵경기장, 9.20 포항전 1-2), [서울신문 10.9](https://www.seoul.co.kr/news/sport/soccer/2026/10/09/20261009035002)(같은 수치, 득점 순위)

- `newsfb4`(사용자가 보여 준 ‘손흥민을 비판하는 사람들에게 반박하는 팬 글’에서 주제만 가져옴. 그 글과 사진은 쓰지 않음): [MBC 뉴스데스크](https://imnews.imbc.com/replay/2026/nwdesk/article/6833466_37004.html)(‘손흥민 시대‥이대로 저무나’, 남아공전 교체 명단), [뉴스핌 6.30](https://www.newspim.com/news/view/20260630000293)(체코 2-1, 멕시코 0-1, 남아공 0-1, 남아공전 선발 제외, 조 3위 중 10위로 탈락, 인스타그램 전문 인용), [머니투데이 7.1](https://www.mt.co.kr/article/2026070109235539075)(같은 인스타그램 문장, 조별리그 탈락), [한국일보 10.6](https://www.hankookilbo.com/news/article/A2026100621050002334)·[일간스포츠 9.25](https://isplus.com/article/view/isp202609250002)(에콰도르전 프리킥 57호), [서울신문 10.7](https://www.seoul.co.kr/news/sport/soccer/2026/10/07/20261007034002)(우루과이전 58호), [국민일보 10.6](https://www.kmib.co.kr/article/view.asp?arcid=9000020378)·[엑스포츠뉴스 10.6](https://www.xportsnews.com/article/2204732)(“어릴 때부터 이 자리를 당연하게 생각하지 않았다”), [전북일보 2025.5.22](https://jjan.kr/article/20250522580005)(유로파리그 결승 토트넘 1-0 맨유, 주장, 유럽 1군 15시즌 만의 첫 우승)·[경인일보](https://www.kyeongin.com/article/1740541)(한국인 최초)
**사진 크레딧** (모두 위키미디어 공용, `media/newsfb/*.json`에 페이지·파일 주소·저자·라이선스)
- Meghdad Madadi / Tasnim News Agency, CC BY 4.0 — 2021.10.12 이란-한국(테헤란): [손흥민](https://commons.wikimedia.org/wiki/File:Iran,_S._Korea_Closer_to_Securing_Spot_in_World_Cup_Tournament_after_Draw_2021-7.jpg), [손흥민·자한바크시](https://commons.wikimedia.org/wiki/File:Iran,_S._Korea_Closer_to_Securing_Spot_in_World_Cup_Tournament_after_Draw_2021-42.jpg), [한국 선발(김민재·황인범·손흥민)](https://commons.wikimedia.org/wiki/File:Iran,_S._Korea_Closer_to_Securing_Spot_in_World_Cup_Tournament_after_Draw_2021-8.jpg)
- M.Sadegh Nikgostar / Fars News Agency, CC BY 4.0 — 2024.2.6 아시안컵 4강 요르단-한국: [5](https://commons.wikimedia.org/wiki/File:Asian_Nations_Cup_-_Jordan_and_South_Korea_(5).jpg), [30](https://commons.wikimedia.org/wiki/File:Asian_Nations_Cup_-_Jordan_and_South_Korea_(30).jpg), [32](https://commons.wikimedia.org/wiki/File:Asian_Nations_Cup_-_Jordan_and_South_Korea_(32).jpg), [42](https://commons.wikimedia.org/wiki/File:Asian_Nations_Cup_-_Jordan_and_South_Korea_(42).jpg), [64](https://commons.wikimedia.org/wiki/File:Asian_Nations_Cup_-_Jordan_and_South_Korea_(64).jpg), [70](https://commons.wikimedia.org/wiki/File:Asian_Nations_Cup_-_Jordan_and_South_Korea_(70).jpg), [야잔](https://commons.wikimedia.org/wiki/File:Yazan_Al-Arab_2.jpg)
- Koen Suyk / Anefo (Nationaal Archief), CC0 — [차범근 1979](https://commons.wikimedia.org/wiki/File:Aankomst_van_het_voetbalelftal_van_Eintracht_Frankfurt_op_Schiphol_i.v.m._de_UEF,_Bestanddeelnr_930-5808.jpg)
- Photo and Share CC / 무인양품 (Flickr), CC BY 2.0 — [2013 ACL 결승 1차전 서울월드컵경기장](https://commons.wikimedia.org/wiki/File:AFC_Champions_League_Final_1st_leg.jpg)
- 국립민속박물관(문덕관 기증), 공공누리 제1유형 — [서울월드컵경기장 2001](https://commons.wikimedia.org/wiki/File:서울_월드컵_경기장_전경_(2001.11).jpg); 한국항공우주연구원, 공공누리 제1유형 — [아리랑 1호 위성 사진](https://commons.wikimedia.org/wiki/File:아리랑_1호가_촬영한_서울_월드컵_경기장_(335).jpg)
- 음악: "Lightless Dawn" Kevin MacLeod (CC BY 4.0), 세 편 공통

**newsfb1** — 손흥민 A매치 59호 골, 차범근 넘었다 ⚽
> 손흥민이 10월 6일 우즈베키스탄과의 평가전(용인미르스타디움)에서 프리킥으로 A매치 59호 골을 넣어, 차범근 전 감독의 58골을 넘어 한국 남자 선수 A매치 최다 골 기록을 새로 썼습니다(151경기 59골). 한국은 오세훈의 추가 골로 2-0 승리. 손흥민의 A매치 골, 몇 골까지 갈까요? (사진은 지난 경기 자료입니다.)
> 사진: Meghdad Madadi/Tasnim News Agency (CC BY 4.0), M.Sadegh Nikgostar/Fars News Agency (CC BY 4.0), Koen Suyk/Anefo·Nationaal Archief (CC0), via Wikimedia Commons · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #손흥민 #차범근 #축구국가대표 #A매치 #우즈베키스탄 #shorts

**newsfb2** — 김민재 작심 발언 “수비수들 불쌍하다” 👟
> 10월 2일 베네수엘라전(0-0) 뒤 김민재가 “수비수들 보면 불쌍하다”, “다 같이 머리 처박고 뛰어야 한다”고 말했습니다. 황인범도 아쉬움을 털어놨고, 모레노 임시 감독은 “김민재는 상징적인 선수, 충분히 할 수 있는 말”이라면서도 “공격·수비 모두 다 같이 뛰었다”고 했습니다. 김민재가 선발에서 빠진 6일 우즈베키스탄전은 2-0 승리. 여러분 생각은? (발언은 OSEN·스타뉴스·스포츠조선·파이낸셜뉴스·YTN 보도 기준, 사진은 2021·2024년 경기 자료입니다.)
> 사진: Meghdad Madadi/Tasnim News Agency (CC BY 4.0), M.Sadegh Nikgostar/Fars News Agency (CC BY 4.0), via Wikimedia Commons · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #김민재 #황인범 #모레노 #축구국가대표 #베네수엘라전 #shorts

**newsfb3** — FC서울 10년 만의 우승, 승점 10 남았다 🏆
> 2026년 10월 9일 기준 K리그1 선두 FC서울은 19승 5무 6패 승점 62로 2위 울산(47)에 15점 앞서 있습니다. 남은 8경기에서 승점 10만 더하면 울산이 전승해도 자력 우승 — 2016년 이후 10년 만입니다. 다음 경기는 10월 10일 오후 2시 서울월드컵경기장 제주전. 몇 라운드에 확정될까요? (사진은 2001·2013·2024년 자료입니다.)
> 사진: Photo and Share CC/무인양품 (CC BY 2.0), 국립민속박물관·한국항공우주연구원 (공공누리 제1유형), M.Sadegh Nikgostar/Fars News Agency (CC BY 4.0), via Wikimedia Commons · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #FC서울 #K리그 #K리그1 #김기동 #우승경쟁 #shorts

**newsfb4** — ‘손흥민 시대 저무나’ 석 달 뒤, A매치 최다 골 🔥
> 2026 북중미 월드컵 3경기 무득점, 남아공전 선발 제외, 조별리그 탈락. 대회 뒤 손흥민은 “팬분들이 나를 필요로 하실 때까지 모든 것을 쏟아붓겠다, 죽기 살기로 달려보겠다”고 했습니다. 그리고 석 달 뒤 에콰도르·우루과이·우즈베키스탄전 골로 A매치 59골, 차범근을 넘어 한국 남자 최다 골. 손흥민, 몇 살까지 대표팀에서 뛰어주길 바라나요? (사진은 2021·2024년 경기 자료입니다.)
> 사진: Meghdad Madadi/Tasnim News Agency (CC BY 4.0), M.Sadegh Nikgostar/Fars News Agency (CC BY 4.0), via Wikimedia Commons · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #손흥민 #축구국가대표 #A매치최다골 #차범근 #월드컵 #shorts

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
- `uskennedy`: [법사위 잭 스미스 청문회](https://www.judiciary.senate.gov/committee-activity/hearings/oversight-of-jack-smiths-abuse-of-authority-and-the-targeting-of-republicans-and-related-matters) (2026.9.29), 스트림 `judiciary092926` 1:28:38–1:31:23
- `usfauci`: [국토안보위 파우치 증언 청문회](https://www.hsgac.senate.gov/hearings/testimony-of-anthony-fauci/) (2026.7.29), 스트림 `govtaff072926` 55:58–59:33

**옛날 영화 (미국·한국 모두 저작권 만료, 도우미 리서치 `public_domain_old_2026-10.md` 기준)**
- 〈달세계 여행〉 1902 조르주 멜리에스 — [archive.org](https://archive.org/details/le-voyage-dans-la-lune-1902-georges-melies) (흑백판, 2011년 컬러 복원판 아님)
- 〈대열차강도〉 1903 에드윈 S. 포터 — [미국 의회도서관](https://www.loc.gov/item/00694220/)
- 〈노스페라투〉 1922 F. W. 무르나우 — [archive.org](https://archive.org/details/Nosferatu1922)
- 〈오페라의 유령〉 1925 — [archive.org](https://archive.org/details/CEP147)
- 〈전함 포템킨〉 1925 세르게이 에이젠슈테인 — [archive.org](https://archive.org/details/BattleshipPotemkin1925HD)
- 음악: "The Stars and Stripes Forever" Sousa's Band (Victor 1903), "Vesti la giubba" Enrico Caruso (Victor 1904) — [미국 의회도서관 National Jukebox](https://www.loc.gov/collections/national-jukebox/), 1926년 이전 녹음이라 퍼블릭 도메인. 아카이브 사본에 나중에 입힌 배경음악은 쓰지 않았습니다.

**옛날 농구 (미국·한국 모두 저작권 만료, 도우미 리서치 `old_basketball_2026-10.md` 기준)**
- 1904 〈Basket ball, Missouri Valley College〉 American Mutoscope & Biograph — [미국 의회도서관](https://www.loc.gov/item/2024600553/) (2023년 음악 트랙은 제외)
- 1934 〈Ford News〉 "Northern High Takes 90 Home Games in Row" — [국립문서기록관리청 NARA 93356](https://catalog.archives.gov/id/93356), [archive.org](https://archive.org/details/fc-fc-4227) (1962년 미국 정부에 권리 양도)
- 1945 〈Army-Navy Screen Magazine No. 1〉 "Hooping It Up", 미 육군 통신대 — [archive.org](https://archive.org/details/TheArmyNavyScreenMagazineNo1NavyEdition01HoopingItUp.mp4) (미국 정부 저작물)
- 음악: "Maple Leaf Rag" (스콧 조플린) 미 해병대 군악대 1906년 녹음 — [위키미디어 공용](https://commons.wikimedia.org/wiki/File:1906_-_Scott_Joplin%27s_Maple_Leaf_Rag_(1899)_played_by_the_United_States_Marine_Band.ogg) (1926년 이전 녹음 + 미국 정부 저작물)

**아르테미스 2호 (NASA, 퍼블릭 도메인)** — [발사 슬로모션](https://images.nasa.gov/details/KSC%20ART%20II%20Cause%20Way%20Launch%20low%20angle), [오리온 카메라 이륙](https://images.nasa.gov/details/art002m1200912222_Liftoff_1), [비행 6일째 하이라이트(달 근접 비행)](https://images.nasa.gov/details/jsc2026m000073_ArtemisIIFlightDay6Highlights_NoLowerThirds), [재진입·낙하산](https://images.nasa.gov/details/GP011149); 음악 "Lightless Dawn" Kevin MacLeod (CC BY 4.0)
- `artemis2`: [비행 6일째 하이라이트(달 근접 비행)](https://images.nasa.gov/details/jsc2026m000073_ArtemisIIFlightDay6Highlights_NoLowerThirds) 19:50~22:10, [비행 6일째 블로그](https://www.nasa.gov/blogs/missions/2026/04/06/artemis-ii-flight-day-6-lunar-flyby-updates/); 음악 "Lightless Dawn" Kevin MacLeod (CC BY 4.0)
- `artemis3`: [오리온 창밖 재진입·낙하산(GP011149)](https://images.nasa.gov/details/GP011149), [지상 카메라 착수](https://images.nasa.gov/details/KSC-20260410-MH-JBP01-0001-Artemis_II_Splashdown_GSS_Visual_60fps-M19183), [발사 슬로모션](https://images.nasa.gov/details/KSC%20ART%20II%20Cause%20Way%20Launch%20low%20angle), [오리온 카메라 이륙](https://images.nasa.gov/details/art002m1200912222_Liftoff_1); 사실: [재진입 블로그](https://www.nasa.gov/blogs/missions/2026/04/10/artemis-ii-flight-day-10-re-entry-live-updates/); 음악 "Lightless Dawn" Kevin MacLeod (CC BY 4.0)

**미국 해안경비대 (퍼블릭 도메인, DVIDS)**
- `uscg1`: [Coast Guard rescues 4 from vessel trapped in ice near Chefornak, Alaska](https://www.dvidshub.net/video/1002629/coast-guard-rescues-4-vessel-trapped-ice-near-chefornak-alaska) — U.S. Coast Guard video by Petty Officer 1st Class Shannon Shepard · [보도자료](https://www.news.uscg.mil/Press-Releases/Article/4460663/coast-guard-rescues-4-from-vessel-trapped-in-ice-near-chefornak-alaska/)
- `uscg2`: [Coast Guard rescues 2 from water off Haleiwa](https://www.dvidshub.net/video/1014806/coast-guard-rescues-2-water-off-haleiwa) — U.S. Coast Guard video by Petty Officer 2nd Class Mikaela McGee · [보도자료](https://www.news.uscg.mil/Press-Releases/Article/4547835/coast-guard-rescues-2-from-water-off-haleiwa/)

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

**oldfilm** — 100년 넘은 영화 명장면 5 🎬 (4번은 지금 봐도 소름)
> 1902년 〈달세계 여행〉부터 1925년 〈전함 포템킨〉까지, 영화 역사에 남은 장면 다섯 개. 모두 저작권이 끝난 퍼블릭 도메인 작품입니다.
> 음악: "The Stars and Stripes Forever" Sousa's Band (1903), "Vesti la giubba" Enrico Caruso (1904) — 미국 의회도서관 National Jukebox
> #옛날영화 #무성영화 #영화역사 #명장면 #shorts

**artemis** — 달을 눈앞에서 본 우주비행사 “달은 포스터가 아니라 진짜 장소예요” 🌕
> 2026년 4월, 아르테미스 2호 우주비행사 4명이 1972년 아폴로 17호 이후 처음으로 달을 돌아왔습니다. 달 근접 비행 날 크리스티나 코크 우주비행사가 남긴 말과, 귀환 직전 창밖의 지구.
> 영상: NASA · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0
> #아르테미스 #NASA #달 #우주 #shorts

**artemis2** — 달 뒤로 사라지기 6분 전, 지구와 나눈 마지막 교신 🌙
> 2026년 4월 6일, 아르테미스 2호가 달 뒤편으로 들어가 약 40분간 교신이 끊기기 직전. 휴스턴 관제센터의 인사에 빅터 글로버 조종사가 남긴 답을 원음 그대로, 한국어 번역과 함께. (길이 때문에 답변 앞부분 일부는 줄였습니다)
> 영상: NASA · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 — http://creativecommons.org/licenses/by/4.0/
> #아르테미스 #NASA #달 #우주 #shorts

**artemis3** — 달에서 돌아오는 우주선, 창밖 실제 영상 🔥
> 음속의 35배로 대기권에 들어와, 약 6분 교신 두절, 낙하산, 그리고 태평양에 풍덩. 아르테미스 2호 오리온 우주선 조종석 창에 달린 카메라와 지상 카메라가 찍은 2026년 4월 10일 귀환 장면입니다. 대기권 진입부터 착수까지 약 14분.
> 영상: NASA · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 — http://creativecommons.org/licenses/by/4.0/
> #아르테미스 #NASA #우주 #재진입 #shorts

**uskennedy** — “이빨 요정은 믿습니까?” / “당신 때문에 토할 것 같네요”
> 2026년 9월 29일 미 상원 법사위원회 잭 스미스 전 특별검사 청문회. 존 케네디 상원의원(공화)이 바이든 백악관의 기소 지시 여부와 의원 통화기록 수집을 묻고, 스미스 전 특검이 답합니다. 발언은 청문회 원문 그대로 번역했고, 주장 내용은 따로 검증한 사실이 아닙니다. 영상: 미 상원 법사위 공식 중계(Senate Recording Studio, 퍼블릭 도메인), 길이를 줄이려 일부 구간을 잘랐습니다(흰 번쩍임).
> #미국정치 #상원청문회 #잭스미스 #존케네디 #shorts

**usfauci** — 파우치 변호인이 끼어들자 “발언권 없어요! 경위, 내보내세요”
> 2026년 7월 29일 미 상원 국토안보위원회 앤서니 파우치 증언 청문회. 파우치가 수정헌법 5조를 들어 답변을 거부한 뒤, 발언권 없이 끼어든 변호인을 랜드 폴 위원장(공화)이 퇴장시킵니다. 게리 피터스 간사(민주)는 변호인 말을 들어 보자고 했습니다. 변호인 목소리는 중계 마이크에 잡히지 않았습니다. 영상: 미 상원 국토안보위 공식 중계(Senate Recording Studio, 퍼블릭 도메인), 길이를 줄이려 일부 구간을 잘랐습니다(흰 번쩍임).
> #파우치 #랜드폴 #미국정치 #상원청문회 #shorts

## 옛날 영화 쇼츠 2·3 (`politics/oldfilm2`, `politics/oldfilm3`)

| id | 제목 | 길이 | 장면 | 음악 |
| --- | --- | --- | --- | --- |
| `oldfilm2` | 100년도 더 전, 처음 나온 영화들 / 4번은 지금 봐도 귀여움 🦕 | 47.1초 | 〈재채기〉 1894 · 〈키스〉 1896 · 멜리에스 〈1인 오케스트라〉 1900 · 〈공룡 거티〉 1914 | Dill Pickles Rag (1909, Arthur Pryor's Band) |
| `oldfilm3` | 100년 넘은 공포영화 원조 4편 / 마지막 장면이 공식을 만들었다 🧛 | 56.1초 | 멜리에스 〈악마의 성〉 1896 · 〈프랑켄슈타인〉 1910 · 〈칼리가리 박사의 밀실〉 1920 · 〈노스페라투〉 1922 | In the Hall of the Mountain King (Musopen Symphony, PD) |

- 영상은 모두 미국·한국 양쪽에서 저작권이 끝난 작품(◎)만 썼고, 아카이브 사본에 붙은 현대 반주는 모두 지웠습니다. 원본 클립과 출처·구간·권리 메모(.json)는 `ccr-d399bb63-yneedc-oldfilm2` 브랜치의 `media/oldfilm/`, `media/oldmusic/`에 있습니다.
- 4:3 무성영화를 자르지 않고 보여 주려고 세그먼트에 `"frame": "film"`(1080×810 상자)을 쓸 수 있게 했습니다. 기본값은 그대로 정사각형입니다.
- 자막 속 사실은 영어 위키백과 각 작품 문서로 확인했습니다. 전설이나 논란이 있는 내용은 그렇다고 적었습니다. 〈키스〉는 ‘첫 키스로 꼽히는’, 거티의 ‘그림 1만 장’은 영화 자막에 나오는 주장으로 표현했습니다.

**출처**
- 〈재채기〉 Edison Kinetoscopic Record of a Sneeze (1894): [LOC 00694192](https://www.loc.gov/item/00694192/)
- 〈키스〉 The Kiss (1896, Edison/William Heise): [archive.org CEP00115](https://archive.org/details/CEP00115)
- 〈1인 오케스트라〉 L'Homme orchestre (1900, Georges Méliès): [archive.org LhommeOrchestre](https://archive.org/details/LhommeOrchestre)
- 〈공룡 거티〉 Gertie the Dinosaur (1914, Winsor McCay): [archive.org Gertie](https://archive.org/details/Gertie)
- 〈악마의 성〉 Le Manoir du diable (1896, Méliès): [archive.org le-manoir-du-diable-1896](https://archive.org/details/le-manoir-du-diable-1896)
- 〈프랑켄슈타인〉 Frankenstein (1910, Edison/J. Searle Dawley): [archive.org frankenstein-1910_202601](https://archive.org/details/frankenstein-1910_202601)
- 〈칼리가리 박사의 밀실〉 (1920, Robert Wiene): [archive.org TheCabinetOfDoctorCaligari](https://archive.org/details/TheCabinetOfDoctorCaligari) (붙어 있던 현대 반주는 삭제)
- 〈노스페라투〉 (1922, F. W. Murnau): [archive.org Nosferatu1922](https://archive.org/details/Nosferatu1922)
- 음악: Dill Pickles Rag (Victor, 1909): [LOC National Jukebox](https://www.loc.gov/item/jukebox-127191/) · In the Hall of the Mountain King (Musopen Symphony, 퍼블릭 도메인 기증): [archive.org MusopenCollectionAsFlac](https://archive.org/details/MusopenCollectionAsFlac)

**oldfilm2** — 100년도 더 전, 처음 나온 영화들 🎬 (4번은 지금 봐도 귀여움)
> 1894년 에디슨 회사가 찍은 5초짜리 ‘재채기’, 18초짜리인데 당시 “역겹다”는 비난과 경찰이 나서라는 요구까지 받은 1896년 〈키스〉, 필름을 7번 되감아 혼자 7명이 된 멜리에스의 〈1인 오케스트라〉(1900), 그리고 매머드를 던져버리는 1914년 손그림 애니 〈공룡 거티〉.
> 영상: 저작권이 만료된 퍼블릭 도메인 영화(LOC, Internet Archive) · 음악: "Dill Pickles Rag" Arthur Pryor's Band (1909, 퍼블릭 도메인)
> #옛날영화 #무성영화 #영화역사 #공룡거티 #shorts

**oldfilm3** — 100년 넘은 공포영화 원조 4편 👻 (마지막 장면이 공식을 만들었다)
> ‘최초의 공포영화’로 꼽히는 멜리에스의 〈악마의 성〉(1896), 불타는 인형을 거꾸로 돌려 괴물 탄생을 만든 최초의 〈프랑켄슈타인〉(1910), 몽유병자 체자레가 눈을 뜨는 〈칼리가리 박사의 밀실〉(1920), 그리고 흡혈귀가 햇빛에 죽는 장면을 처음 보여 준 〈노스페라투〉(1922).
> 영상: 저작권이 만료된 퍼블릭 도메인 영화(Internet Archive) · 음악: "In the Hall of the Mountain King" (그리그) Musopen Symphony (퍼블릭 도메인)
> #공포영화 #노스페라투 #프랑켄슈타인 #무성영화 #shorts

**oldbball** — 100년 전 농구는 이랬다 🏀 치마 입고 잔디밭에서 슛?!
> 1904년 미국 미주리 밸리 칼리지 여학생들의 실제 농구 경기. 긴 치마를 입고 잔디밭에서, 판자 없이 틀만 있는 백보드에 슛을 던집니다. 농구가 발명된 지 겨우 13년 뒤입니다. 1934년엔 골을 넣을 때마다 센터 점프볼로 다시 시작했고(1937년 폐지), 1945년엔 뉴욕 매디슨 스퀘어 가든이 관중으로 꽉 찼습니다.
> 영상: 미국 의회도서관(1904), National Archives / Ford Film Collection(1934), 미 육군 Army-Navy Screen Magazine(1945) · 음악: "Maple Leaf Rag" 미 해병대 군악대(1906) — 모두 퍼블릭 도메인
> #농구 #옛날영상 #농구역사 #NBA #shorts

**oldbball2** — 80년 전 미국 농구 직관 🏟️ NBA도 3점슛도 없던 시절
> 1945년 미군이 장병들에게 보여 준 뉴스 영화 속 매디슨 스퀘어 가든 대학농구, 유타대 대 세인트존스대. NBA(전신 BAA 1946년)도, 3점슛(NBA 1979년)도, 24초 공격 제한(NBA 1954년)도 없던 시절입니다. 1944년 NCAA 우승팀 유타대의 와트 미사카는 훗날 NBA가 인정하는 첫 비백인 선수가 됐습니다.
> 영상: 미 육군 Army-Navy Screen Magazine(1945), 미국 의회도서관(1904) · 음악: "Maple Leaf Rag" 미 해병대 군악대(1906) — 모두 퍼블릭 도메인
> #농구 #NBA #대학농구 #옛날영상 #shorts

**uscg1** — 얼음 위에 하루 넘게 갇힌 가족… 구조 헬기 실제 교신 🎧🚁
> 2026년 4월 12일 새벽, 알래스카 셰포낙 서쪽 약 16km. 물범 사냥에 나섰던 가족 4명(어른 3, 아이 1)의 5.5m 배가 얼음 위에 갇힌 지 24시간이 넘었습니다. 미 해안경비대 코디악 항공기지의 MH-60 헬기가 중간 급유를 두 번 하며 800마일 넘게 날아가 4명을 모두 끌어올렸고, 다친 사람은 없었습니다. 영상 속 목소리는 헬기 호이스트 운용사가 조종사에게 위치를 불러 주는 실제 교신입니다(숫자는 남은 거리, 피트).
> 영상: 미국 해안경비대(U.S. Coast Guard video by PO1 Shannon Shepard, 퍼블릭 도메인) · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #해안경비대 #구조 #알래스카 #헬기 #shorts

**uscg2** — 바다에 빠진 두 남자, 헬기가 왔다… 구조된 남자가 한 말 🥹
> 2026년 7월 14일, 하와이 오아후 할레이와 앞바다 약 18.5km. 길이 3m 쌍동선이 뒤집혀 두 남자가 바다에 빠졌고, 위치 신호기(PLB) 조난 신호를 받은 미 해안경비대가 이미 비행 중이던 비행기와 헬기를 돌려 두 사람을 끌어올렸습니다. 다친 사람은 없었습니다. 해안경비대는 위치 신호기를 꼭 등록해 달라고 당부했습니다. (구조된 분의 얼굴은 가렸습니다)
> 영상: 미국 해안경비대(U.S. Coast Guard video by PO2 Mikaela McGee, 퍼블릭 도메인) · 음악: "Heroic Age", "Rising Tide" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #해안경비대 #구조 #하와이 #감동 #shorts

## 아폴로 쇼츠 (`politics/apollo1`, `politics/apollo2`)

NASA가 직접 공개한 아폴로 원본 영상(퍼블릭 도메인)에 우주비행사·관제실 교신을 번역 자막으로 붙였습니다. 같은 도구(`politics/prep_split.py`, 번역 모드)로 만들었고, 원본 클립과 출처 메모(.json)는 `media/apollo/`에 있습니다. 자막 원문은 모두 [Apollo Lunar Surface Journal](https://www.nasa.gov/history/alsj-and-afj/)(ALSJ, NASA 역사국이 안내하는 공식 교신 기록, 현재 apollojournals.org)과 음성인식(faster-whisper base/small/medium.en)을 대조해 **둘이 일치하는 말만** 넣었습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `apollo1` | 달에서 망치와 깃털을 / 동시에 떨어뜨리면? 🪶🔨 | 55.8초 | 아폴로 15호 데이브 스콧 선장의 망치·깃털 낙하 실험(1971.8.2 생중계) 원음 + 번역, 낙하 순간 슬로모션 다시 보기, 관제실 조 앨런 “Superb.” |
| `apollo2` | 달에서 넘어지고, 점프하고, / 폭주까지 🤣 (실제 NASA 영상) | 57.1초 | 아폴로 17호 해리슨 슈미트가 샘플 가방을 쓰러뜨리고 두 번 넘어짐(“흙 좀 묻어도 괜찮죠?”, 관제실 “Twinkletoes 좀 도와줘요”) → 아폴로 16호 존 영의 ‘해군식 점프 경례’ → 월면차 ‘그랑프리’(찰리 듀크 “인디 500도 이런 드라이버는 처음 볼걸”) |

- 템플릿 변경: `prep_split.py`의 구간에 `"speed": 0.4`처럼 주면 그 구간을 느리게 만든 클립이 들어갑니다(길이 = (out − in) / speed, 기본값 1이라 기존 쇼츠는 그대로). `fetch.sh`가 `Floating Cities`, `Lightless Dawn`(incompetech.com)도 받습니다. `ClipShort.tsx`는 두 칸 패널(`panels`)이 없는 쇼츠에서 `single` 없이 `"frame": "film"`만 준 구간도 화면이 나오도록 고쳤습니다(국감 쇼츠는 그대로).
- `apollo1`: 망치·깃털이 작게 보이는 원거리 TV 화면이라, 실제 속도로 한 번 보여 준 뒤 0.4배속으로 손~바닥 부분을 확대해 다시 보여 줍니다(“🔁 슬로모션” 라벨, 그 구간은 무음). 마지막 두 줄(공기 저항이 없어서 같이 떨어짐, 망치 1.32kg, 공군사관학교 매 깃털)은 NSSDC 페이지(NASA SP-289 인용)와 ALSJ의 스콧 회고에 나온 사실입니다. 첫 자막 앞부분 “Well,”·“And I guess”는 자연스러운 한국어로 옮기며 줄였습니다.
- `apollo2`: 슈미트가 넘어지는 첫 장면(0–5.6초)에는 교신 루프의 다른 대화(“At four… we will at five”)가 섞여 있는데 ALSJ에 없는 말이라 번역하지 않고 소리를 낮췄습니다(장면 설명 자막만). 서넌의 “Oh, dadgummit!”은 ALSJ상 갈퀴 때문에 한 말이라 넘어지는 장면에 붙이지 않았습니다. 그랑프리 화면은 NASA 1972년 다큐 〈Nothing So Hidden〉(JSC-580)에 실린 것으로, 그 영화가 실제 교신을 편집해 깔아 둔 것이라 발언 순서가 실시간 그대로는 아닙니다(ALSJ 124:56:58–124:59:22 안의 발언들). ‘Twinkletoes’(발놀림 가벼운 사람이라는 놀림)는 ‘발레리나’로 옮겼습니다. 점프 경례 수치(체공 약 1.45초, 높이 약 0.42m)는 ALSJ 분석의 첫 번째 점프 값입니다. 효과음(boing)은 편집에서 넣은 것입니다.
- 화질: 1970년대 TV·16mm 사본이라(352×240 ~ 720×480) 흐립니다. 복원·컬러화·업스케일한 재업로드는 권리 문제가 생길 수 있어 쓰지 않았습니다.

**출처 (모두 NASA, 미국 정부 저작물 · 퍼블릭 도메인)**
- 망치·깃털: [NSSDC “The Apollo 15 Hammer-Feather Drop”](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_15_feather_drop.html) (NASA 고다드, [MP4 큰 버전](https://nssdc.gsfc.nasa.gov/planetary/image/AS15_Ham_feath_drop3.mp4)) · 교신: [ALSJ Apollo 15 EVA-3 마무리 167:22:06–167:22:58](https://apollojournals.org/alsj/a15/a15.clsout3.html)
- 점프 경례·그랑프리: NASA 영화 [JSC-580 Apollo 16: Nothing So Hidden (1972)](https://archive.org/details/Jsc-580Apollo16-NothingSoHidden.wmv) (archive.org, NASA JSC 계정 업로드) 11:30–11:55, 15:55–16:52 · 교신: [ALSJ 120:25:23](https://apollojournals.org/alsj/a16/a16.alsepoff.html), [ALSJ 124:56:58](https://apollojournals.org/alsj/a16/a16.trvlm1.html)
- 슈미트 넘어짐: [ALSJ Apollo 17 Station 4 TV 클립 a17v.1445023](https://apollojournals.org/alsj/a17/a17.trvsta4.html) (NASA 달 표면 TV + 실시간 교신, 144:50:23–144:52:37)
- 음악: "Floating Cities"(apollo1), "Monkeys Spinning Monkeys"(apollo2) Kevin MacLeod (incompetech.com), CC BY 4.0

**apollo1** — 달에서 망치와 깃털을 동시에 떨어뜨리면? 🪶🔨
> 1971년 8월 2일, 아폴로 15호 데이브 스콧 선장이 달 표면 생중계 카메라 앞에서 왼손엔 매 깃털, 오른손엔 1.32kg 망치를 들고 동시에 놓았습니다. 공기가 없는 달에서는 둘이 똑같이 떨어집니다. “갈릴레오 선생이 옳았다는 게 증명됐네요.” 스콧 선장과 관제실 조 앨런의 실제 교신을 번역했습니다(교신 기록: Apollo Lunar Surface Journal).
> 영상: NASA (NSSDC/Goddard) · NASA가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #아폴로15호 #달 #NASA #갈릴레오 #과학실험 #shorts

**apollo2** — 달에서 넘어지고, 점프하고, 폭주까지 🤣 (실제 NASA 영상)
> 아폴로 17호 해리슨 슈미트가 샘플 가방을 챙기다 꽈당(1972.12), 관제실은 “Twinkletoes 좀 도와줘요”, 본인은 “도움 필요 없어요!”. 아폴로 16호 존 영의 해군식 점프 경례와 달 탐사차 ‘그랑프리’ 시험 주행까지(1972.4.21). 우주비행사와 관제실의 실제 교신을 번역했습니다(교신 기록: Apollo Lunar Surface Journal). 그랑프리 장면은 NASA 1972년 기록영화 〈Nothing So Hidden〉에 실린 영상과 교신입니다.
> 영상: NASA · NASA가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #아폴로 #달 #NASA #우주비행사 #월면차 #shorts

## 1945·1951 한국 쇼츠 (`politics/korea1`, `politics/korea2`)

미군이 직접 찍은 해방 직후 서울과 6·25 전쟁 중 진해 장터 영상입니다. 미국 연방정부 저작물(17 U.S.C. §105)이라 퍼블릭 도메인이고, 한국에서도 영상저작물 보호기간(공표 후 70년)이 지났습니다. 원본은 이 브랜치의 `media/korea1945/`에 있고, 파일마다 `.json`에 NARA 식별번호·카탈로그 설명(shot list)·파일 주소·구간을 적었습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `korea1` | 81년 전 서울은 이랬다 / 1945년 9월, 해방 직후 🇰🇷 | 58.5초 | 거리의 아이들, 조선총독부 청사, 전차 선로, 미군 행렬과 구경 나온 시민들, 항복 문서 서명, 일장기 하강·성조기 게양, 옥상의 태극기, ‘WELCOME ALLIES!’ 현수막, 환영 연설과 인파 |
| `korea2` | 75년 전 장날 풍경 / 1951년 진해 장터 🧺 | 57.0초 | 1951년 3월 진해: 카메라로 달려오는 아이들, 장터, 지게 진 땔감 장수, 곡식 장사, 머리에 짐 인 여인들, 땔감 시장, 갯벌 조개 캐기 |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py korea1   # korea2도 같음
./render.sh korea1
```

- 무성 영상이라 자막(`"en"` 없이 한국어만)과 음악만 씁니다. 화면 설명은 NARA 카탈로그 설명과 영상에서 직접 보이는 것만 적었고, 사실은 널리 기록된 것만 더했습니다: 조선총독부 청사 1995~96년 철거, 항복 조인식 1945년 9월 9일, 미군정 1945~1948, 진해 군항제.
- **쓰지 않은 것**: NARA가 "Restricted – Possibly"로 표시한 자료(서울 거리·시장이 많이 나오는 111-ADC 육군 통신대 릴, 「Big Picture」 Rebirth of Seoul 등), 민간 뉴스릴(Universal·Warner-Pathé 표기가 있는 111-LC 일부), 컬러화·복원 재업로드. 전쟁 피해·시신·피란 장면도 넣지 않았습니다. 이전 도우미가 받은 `media/korea_retro/`의 1945 기차역·1947 집회·화재 클립은 같은 이유("Restricted – Possibly")로 쓰지 않았습니다.
- 확인하지 못한 것: 전차 선로 장면(107-1553 0:18)과 항복식 국기 게양 장면이 서울의 정확히 어느 곳인지는 카탈로그에 없어서 장소를 따로 적지 않았습니다(국기 장면 라벨은 같은 릴의 "Keijo(경성) 항복식" 설명을 따랐습니다). 일장기 하강·성조기 게양이 조선총독부 앞이었다는 것은 역사 기록에 있지만 화면에서 건물이 보이지 않아 자막에는 쓰지 않았습니다. NARA 14705의 날짜는 1945.9.8로 적혀 있지만 서울 항복 조인은 9월 9일이라 자막은 9월 9일로 했습니다.

**출처**
- [NARA 107.1553 (NAID 13796) 〈U.S. Occupation of Korea〉](https://catalog.archives.gov/id/13796) 1945, 미 전쟁부 공보국·미 육군 통신대 — archive.org 사본 [gov.archives.li.107-1553](https://archive.org/details/gov.archives.li.107-1553); 이용 제한 "Undetermined"
- [NARA 428-NPC-14705 (NAID 79851) 〈Japanese Surrender on Korea〉](https://catalog.archives.gov/id/79851) 1945.9, 미 해군; "Undetermined"
- [NARA 428-NPC-421 (NAID 75511) 〈Scenes near Republic of Korea Naval Academy〉](https://catalog.archives.gov/id/75511) 1951.3.15 진해, 미 해군 태평양함대 전투촬영반; "Undetermined"
- 음악: "Gymnopedie No 1"(korea1), "Heartwarming"(korea2) Kevin MacLeod (incompetech.com), CC BY 4.0

**korea1** — 81년 전 서울은 이랬다 | 1945년 9월, 해방 직후 🇰🇷
> 1945년 9월, 해방 직후의 서울. 미 육군·해군 촬영반이 찍은 실제 영상입니다. 거리를 가득 메운 사람들, 조선총독부 청사, 9월 9일 항복 문서 서명과 일장기가 내려가던 순간, 건물 옥상에 올라간 태극기, 손으로 쓴 환영 현수막까지. 이 인파 속에 우리 할머니·할아버지도 계셨을지 모릅니다.
> 영상: 미국 국립문서기록관리청(NARA) 107.1553 (NAID 13796), 428-NPC-14705 (NAID 79851) — 미국 정부 저작물(퍼블릭 도메인)
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #옛날서울 #1945년 #광복 #해방 #서울 #근현대사 #옛날영상 #shorts

**korea2** — 75년 전 장날 풍경 | 1951년 진해 장터 🧺
> 1951년 3월, 6·25 전쟁 중의 경남 진해. 미 해군 촬영반이 찍은 장터와 아이들 영상입니다. 지게에 땔감을 한가득 진 장수, 곡식을 펼쳐 놓은 아주머니들, 머리에 짐을 이고 가는 여인들, 갯벌에서 조개를 캐는 사람들, 그리고 카메라로 달려오는 아이들.
> 영상: 미국 국립문서기록관리청(NARA) 428-NPC-421 (NAID 75511) — 미국 정부 저작물(퍼블릭 도메인)
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #옛날영상 #진해 #창원 #장날 #1951년 #근현대사 #추억 #shorts

## 120년 전 뉴욕 쇼츠 (`politics/nyc1`, `politics/nyc2`)

| id | 제목 | 길이 | 장면 | 음악 |
| --- | --- | --- | --- | --- |
| `nyc1` | 120년 전 뉴욕은 이랬다 🗽 / 먼로보다 54년 먼저 치마가 날렸다 | 54.5초 | 23번가 환풍구 치마(1901, 슬로모션 다시 보기) · 플랫아이언 빌딩 앞 강풍(1903) · 스타 극장 철거 저속촬영(1901) · 매디슨 스퀘어 눈보라(1902) · 코니아일랜드의 밤(1905) | Give My Regards to Broadway (S. H. Dudley, Victor 1905) |
| `nyc2` | 120년 전 뉴욕 지하철 타 보기 🚇 / 개통 7개월 차, 맨 앞칸 시점 | 53.7초 | 지하철 14번가→42번가 맨 앞 시점·그랜드 센트럴역(1905) · 지하철 개통일 시청 앞(1904) · 9번가 고가철도 ‘빅 루프’(1899) · 브루클린 다리 건너는 열차(1899) · 브로드웨이 만원 전차(1901) · 타임스 빌딩에서 본 타임스 스퀘어(1905) | Down in the Subway (Billy Murray, Victor 1904) |

- 영상은 모두 미국 의회도서관(LOC) Paper Print Collection의 **LOC 자체 mp4**(tile.loc.gov)입니다. 컬러화·AI 업스케일·복원 재업로드는 쓰지 않았습니다. LOC 사본 중 6개(플랫아이언, 스타 극장, 눈보라, 코니아일랜드, 개통식, 고가철도)에 붙어 있던 현대 반주는 원본 클립을 자를 때 오디오를 통째로 뺐고(`-an`), 편집에서도 `audio: 0`입니다.
- 원본 클립과 메모(.json: LOC id·페이지·파일 URL·권리 문구·자른 구간)는 이 브랜치의 `media/nyc1900/`에 있습니다. `MEDIA=<저장소>/media python3 politics/prep_split.py nyc1`.
- 권리: LOC 영화 권리 문구 “The Library of Congress is not aware of any U.S. copyright or other restrictions in the vast majority of motion pictures in these collections”, 모두 1899–1905년 미국 저작권 등록작이라 만료(미국 PD), 한국도 공표 70년이 훨씬 지났습니다. 음악은 1923년 이전 발매 녹음이라 2022년 1월 1일부터 미국 퍼블릭 도메인(Music Modernization Act, LOC National Jukebox 권리 안내), 작곡도 1904년 작품입니다.
- 구간 배속은 `prep_split.py`의 `"speed"`(0.5면 슬로모션, 2면 2배속)로 줍니다. 스타 극장 저속촬영 5배속, 23번가 슬로모션 0.5배, 지하철 2배속(자막에 표시), 고가철도·브루클린 다리 1.5배, 코니아일랜드 첫 장면 1.5배입니다.
- 라벨과 출처 표시가 겹치지 않게 라벨을 짧게 하고 화면 출처는 “영상·음악: 미 의회도서관”으로 줄였습니다(자세한 출처는 설명란).
- 사실 확인(모두 LOC 항목 설명 기준): 23번가 장면은 신문사 앞 환풍구 바람, “신문팔이·구두닦이·행인들이 크게 즐거워했다”(에디슨 카탈로그), 1901년 8월 21일 저작권 등록; 〈7년 만의 외출〉 먼로 장면은 1955년 영화라 54년 차이. 플랫아이언은 브로드웨이·23번가, 1903년 10월 26일 촬영, “도시에서 바람이 가장 센 모퉁이로 알려졌고 경찰이 구경꾼을 쫓아낸 데서 ‘23 skidoo’가 나왔다”는 건 LOC도 “일부 역사가에 따르면”이라 적은 설이라 자막도 “~는 설도”로 썼습니다. 스타 극장 1861년 개관(월랙 극장), 철거 약 30일을 저속촬영. 눈보라는 “아마도 1902년 2월 17일” 매디슨 스퀘어라 “1902년 2월”로만. 코니아일랜드는 1905년 6월 3–4일 놀이공원 조명만으로 촬영. 지하철은 1905년 5월 21일 촬영, 1904년 10월 27일 개통 7개월 뒤, 앞차를 따라가며 옆 선로 작업차 조명으로 찍었고 옛 그랜드 센트럴역에서 끝남. 개통식 영상 설명의 착공일(1900년 3월 24일). 고가철도 ‘빅 루프’는 “100피트가 넘는 가장 높고 가장 위험한 구간”(1899년 촬영, 1903년 발매). 브루클린 다리 영상은 에디슨 카탈로그가 “The best picture of the Brooklyn Bridge yet secured”라고 소개. 타임스 빌딩은 “새로 지은 약 20층 높이”.
- 확인하지 못한 것: 1901년 브로드웨이·14번가 영상의 차량을 LOC 설명은 “horse-drawn street car”라고 하지만 화면에 말이 보이지 않아(당시 브로드웨이는 케이블카 노선) 자막은 그냥 “만원 전차”로만 썼습니다. 코니아일랜드 첫 장면이 루나 파크인지 드림랜드인지는 확실하지 않아 이름을 넣지 않았습니다.

**출처**
- 〈What happened on Twenty-third Street, New York City〉 1901, Edison: [LOC 00694379](https://www.loc.gov/item/00694379/)
- 〈At the foot of the Flatiron〉 1903, Biograph: [LOC 00694378](https://www.loc.gov/item/00694378/)
- 〈Star Theatre〉 1901, Biograph: [LOC 00694388](https://www.loc.gov/item/00694388/)
- 〈New York City in a blizzard〉 1902, Edison: [LOC 2017604954](https://www.loc.gov/item/2017604954/)
- 〈Coney Island at night〉 1905, Edison (Edwin S. Porter): [LOC mp73008500](https://www.loc.gov/item/mp73008500/)
- 〈Interior N.Y. subway, 14th St. to 42nd St〉 1905, Biograph (G. W. Bitzer): [LOC 00694394](https://www.loc.gov/item/00694394/)
- 〈Opening ceremonies, New York subway, Oct. 27, 1904〉 Edison: [LOC 2016600205](https://www.loc.gov/item/2016600205/)
- 〈Elevated railroad, New York〉 1899/1903, American Mutoscope & Biograph: [LOC 00694393](https://www.loc.gov/item/00694393/)
- 〈New Brooklyn to New York via Brooklyn Bridge, no. 2〉 1899, Edison: [LOC 00694260](https://www.loc.gov/item/00694260/)
- 〈Broadway & Union Square, New York〉 1901/1903, Biograph: [LOC 94500023](https://www.loc.gov/item/94500023/)
- 〈Panorama from Times Building, New York〉 1905, Biograph: [LOC 00694370](https://www.loc.gov/item/00694370/)
- 음악: “Give my regards to Broadway” S. H. Dudley (Victor, 1905): [LOC jukebox-121880](https://www.loc.gov/item/jukebox-121880/) · “Down in the subway” Billy Murray (Victor, 1904): [LOC jukebox-120860](https://www.loc.gov/item/jukebox-120860/)

**nyc1** — 120년 전 뉴욕은 이랬다 🗽 먼로보다 54년 먼저 치마가 날렸다
> 1901년 에디슨 회사가 뉴욕 23번가에서 찍은 실제 영상. 신문사 앞 환풍구 위를 지나던 여성의 치마가 훅 — 마릴린 먼로의 그 장면(1955)보다 54년 먼저입니다. 이어서 강풍이 몰아치는 1903년 플랫아이언 빌딩 앞, 1861년에 문 연 스타 극장이 철거되는 약 한 달을 담은 1901년 저속촬영, 1902년 2월 눈보라 속 매디슨 스퀘어, 놀이공원 불빛만으로 찍은 1905년 코니아일랜드의 밤까지.
> 영상: 미국 의회도서관(Library of Congress) Paper Print Collection · 음악: "Give My Regards to Broadway" S. H. Dudley (Victor, 1905) — 모두 퍼블릭 도메인. 일부 장면은 배속·슬로모션.
> #뉴욕 #옛날영상 #120년전 #마릴린먼로 #shorts

**nyc2** — 120년 전 뉴욕 지하철 타 보기 🚇 개통 7개월 차, 맨 앞칸 시점
> 1905년 5월, 개통한 지 7개월 된 뉴욕 지하철 맨 앞에서 찍은 실제 영상(14번가→42번가, 옛 그랜드 센트럴역 도착). 1904년 10월 27일 개통식 날 시청 앞, 100피트(30m) 넘는 높이를 도는 9번가 고가철도 ‘빅 루프’, 에디슨 회사가 “지금까지 찍은 브루클린 다리 최고의 영상”이라던 1899년 브루클린 다리, 브로드웨이 만원 전차, 그리고 1905년 새 타임스 빌딩에서 내려다본 타임스 스퀘어.
> 영상: 미국 의회도서관(Library of Congress) Paper Print Collection · 음악: "Down in the Subway" Billy Murray (Victor, 1904) — 모두 퍼블릭 도메인. 일부 장면은 배속.
> #뉴욕 #지하철 #옛날영상 #120년전 #shorts

## 우주비행사 실패·재도전 쇼츠 (`politics/astrofail`)

유명인 인터뷰를 이어 붙이는 “1만 시간의 법칙” 류 쇼츠의 **형식만** 가져왔습니다: 내레이션 없이 본인 목소리, 위에 큰 흰색 영어 원문, 아래 작은 한국어 번역(`"subOrder": "en-ko"`), 핵심 구절만 노란색. 영상은 모두 NASA가 직접 찍어 images.nasa.gov에 올린 인터뷰이고, 번역은 직접 했습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `astrofail` | 우주비행사도 / 떨어졌다..? | 46.9초 | 닉 헤이그(2018 소유스 MS-10 발사 중단 → 5개월 뒤 재도전) → 아닐 메논(선발 과정 여러 번, “trying and trying again”) → 데니즈 번햄(“This was not my first application”) |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py astrofail    # 원본: media/speech/
./render.sh astrofail
```

- 원문은 NASA가 함께 올린 자막(.srt)과 faster-whisper(small.en·medium.en, 애매한 곳은 large-v3)로 맞췄고, 완성본 오디오를 다시 인식시켜 자막 19줄과 대조했습니다. 메논의 “it's **a** real testament”는 medium.en이 “a”를 못 들었지만 NASA 자막과 large-v3가 일치합니다. 헤이그의 첫마디 “Space is really hard”는 NASA 자막·small.en 기준이고 medium.en·large-v3는 “Base”로 들었습니다(앞뒤 문맥상 Space).
- 컷: 헤이그 “Space is really hard … unpredictable,” 뒤의 스타라이너 이야기(“we've seen that play out over the last several months”)부터 경력 소개까지 빼고 첫 발사 이야기로 바로 넘어갑니다. 메논은 “a few times,” 뒤의 “설레고 긴장됐다·이전 선발 때 만난 사람들과 아직 친구” 부분을 뺐습니다. 의미가 바뀌는 컷은 없습니다(컷마다 흰 번쩍임).
- 헤이그 구간(“My first launch …”부터)은 목소리만 NASA 인터뷰 원음 그대로 두고, 화면은 B-roll 클립 `media/speech/hague_crew9_2024_broll.mp4`로 바꿨습니다(이름표에 🎙). NASA 영상 속 소유스 발사·추적·로켓 탑재 카메라·바이코누르 공항 장면은 촬영 주체가 표시되어 있지 않아(Roscosmos 영상일 가능성) 쓰지 않고, NASA/Bill Ingalls 사진 4장을 천천히 당겨(1.00→1.08) 넣었습니다: 소유스 MS-10 발사 → 하늘에서 본 발사 중단 → 공항에서 아내와 포옹 → 소유스 MS-12 재발사. 그 뒤 ISS 해치 포옹·우주유영 장면은 NASA 영상 그대로입니다. 자막 문구와 타이밍은 바뀌지 않았습니다.
- 음량: render.sh의 loudnorm(TP −1.5) 결과가 −14.7 LUFS여서, 0.75 dB를 올리고 리미터(−1.2 dBFS)를 걸어 **−14.1 LUFS, 최대 −1.0 dBFS**로 맞췄습니다.
- 메논·번햄은 영상 당시(2021.12) 우주비행사 **후보**라 이름표를 “NASA 우주비행사 후보 (2021)”로 적었습니다(둘 다 2024년 3월 수료). 스티커 두 개(“2018.10 소유스 MS-10 발사 중단”, “2019.3 소유스 MS-12로 재도전”)는 NASA 사진 설명과 같은 영상의 화면 표기(“Soyuz MS-10/12”) 기준입니다.
- 음악은 넣지 않았습니다. 헤이그 영상에는 NASA가 깐 음악이 원래 들어 있습니다.
- 원본 클립과 출처·NASA ID·구간은 `media/speech/*.json`에 있습니다.

**출처 (NASA, 미국 연방정부 저작물 — 17 U.S.C. §105)**
- 닉 헤이그: [Meet NASA Astronaut Nick Hague, Crew-9 Commander](https://images.nasa.gov/details/jsc2024m000167_Meet_NASA_Astronaut_Nick_Hague_Crew-9_Commander_HD) (`jsc2024m000167`, 2024.10) — 원본 0:16.5–0:20.25(화면+소리), 1:02.4–1:19.0(소리; 화면은 1:14.3–1:19.0만)
- 헤이그 구간 사진 (모두 NASA/Bill Ingalls): [NHQ201810110023](https://images.nasa.gov/details/NHQ201810110023) 소유스 MS-10 발사 2018.10.11 · [NHQ201810110018](https://images.nasa.gov/details/NHQ201810110018) 같은 발사, 하늘에서 본 발사 중단 · [NHQ201810110008](https://images.nasa.gov/details/NHQ201810110008) 크라이니 공항에서 아내 케이티와 포옹 2018.10.11 · [NHQ201903150007](https://images.nasa.gov/details/NHQ201903150007) 소유스 MS-12 발사 2019.3.15(현지 시각)
- 아닐 메논: [NASA Astronaut Candidate Anil Menon](https://images.nasa.gov/details/jsc2021m000273_NASA_Astronaut_Candidate_Anil_Menon) (`jsc2021m000273`, 2021.12) — 원본 3:42.3–3:45.1, 4:12.85–4:26.85
- 데니즈 번햄: [NASA Astronaut Candidate Deniz Burnham](https://images.nasa.gov/details/jsc2021m000276_NASA_Astronaut_Candidate_Deniz_Burnham) (`jsc2021m000276`, 2021.12) — 원본 7:18.05–7:27.55
- NASA가 이 영상을 보증하거나 후원한다는 인상을 주면 안 되고, NASA 로고를 채널 로고처럼 쓰면 안 됩니다(NASA media usage guidelines).

**astrofail** — 우주비행사도 떨어졌다..? 🚀 “첫 지원이 아니었어요”
> NASA 우주비행사들이 직접 말하는 실패와 재도전. 닉 헤이그는 2018년 첫 발사가 2분 만에 중단돼 200일 임무가 20분 만에 끝났지만, 5개월 뒤 다시 올라가 우주정거장에서 6개월을 보냈습니다. 아닐 메논은 선발 과정을 여러 번 거친 끝에, 데니즈 번햄은 첫 지원이 아닌 도전 끝에 2021년 우주비행사 후보로 뽑혔습니다. 발언은 원문 그대로 번역했고, 길이를 줄이려 일부 구간을 잘랐습니다(흰 번쩍임). (NASA가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상·사진: NASA (사진 NASA/Bill Ingalls)
> #우주비행사 #NASA #동기부여 #포기하지마 #영어공부 #shorts

## 1960년대 한국 컬러 쇼츠 (`politics/korea3`, `politics/korea4`)

`korea1`·`korea2`의 후속편입니다. 1964년과 1969년에 미군 촬영반이 찍은 **컬러** 필름으로, 1960년대 서울 거리와 시골 가을걷이를 보여 줍니다. 잘라 둔 원본은 저장소 루트의 `media/korea3/`에 있습니다. 파일마다 `.json`에 NARA 식별번호, 카탈로그 주소, 파일 주소, 제작 기관, 이용 제한 상태, shot list, 자른 구간을 적었고, 음악 파일도 `media/korea3/music/`에 넣었습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `korea3` | 흑백인 줄 알았던 서울 / 1960년대, 컬러로 보면 🎨 | 57.2초 | 1969년 가을 서울 도심(차량·믹서 트럭·고층 건물), 1964년 2월 언덕에서 본 서울, 숭례문, 솜옷 차림 시민과 간판, 말수레, 웃는 아이, 밤의 네온사인(‘대한마아가린’, 춤추는 무희가 나오는 ‘한국타이야’), 1969년 서울시청(깃발, 현수막) |
| `korea4` | 57년 전 가을걷이 / 1969년 시골, 컬러 영상 🌾 | 57.2초 | 초가 마을 탈곡 마당, 발로 밟는 탈곡기, 도리깨질, 아기를 업고 일하는 여인, 짚단 묶는 할아버지, 소, 볏단 싣는 소달구지 |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py korea3   # korea4도 같음
./render.sh korea3
```

- 무성 필름입니다(NAID 29288은 카탈로그에 "Silent"로 표시). 원본 오디오는 쓰지 않고 디지털 무음으로 바꿨으며, 자막(한국어만)과 음악만 넣었습니다. 템플릿 코드는 바꾸지 않았습니다.
- 화면 설명은 NARA shot list와 화면에 보이는 것만 썼습니다. 탈곡기("foot pedal machine"), 도리깨("thin pole with straps attached"), 아기 업은 여인(shot 19), 되새김질하는 소("chewing her cud"), 시청 깃발("Korean flag ... flag of the city of Seoul"), 남대문("South Gate to city"), 네온사인이 그 근거입니다. 간판 글자(대한마아가린, 한국타이야)는 화면에서 읽었습니다.
- 덧붙인 사실은 두 가지입니다. ① 숭례문은 2008년 2월 10일 방화로 누각이 불탔고 2013년 5월 4일 복구 기념식과 함께 다시 공개됐습니다([서울신문 2013.4.30](https://m.seoul.co.kr/news/2013/04/30/20130430002007), [국가기록원 숭례문](https://theme.archives.go.kr//next/koreaOfRecord/sungnyemunGate.do)). ② 옛 서울시청 본관은 1926년에 경성부청사로 지어져 2008년 5월까지 시청으로 쓰였고, 2012년 10월 서울도서관으로 문을 열었습니다([서울시 미디어허브](https://mediahub.seoul.go.kr/archives/196127), [서울신문 2012.10.27](https://m.go.seoul.co.kr/news/2012/10/27/20121027011029)).
- 1969년 릴의 시골 장면은 카탈로그에 마을 이름이 없습니다. 슬레이트에는 "Stock footage Seoul, ROK"라고 적혀 있지만 서울이라고 단정하지 않고 라벨을 "한국 농촌"으로 했습니다. 1964년 장면 날짜는 NARA 제작일(1964.2.28)과 필름 슬레이트(25/2/64)를 따랐습니다. 2층 건물과 탑이 있는 광장 장면처럼 이름을 확인하지 못한 건물은 이름을 적지 않았습니다.
- **쓰지 않은 것**: 도우미가 모은 `media/korea_retro/` 가운데 `korea_1968_orphanage_children_color`(NAID 102044680, "Restricted – Possibly"), 1945 역·1947 집회·1947 화재 클립(모두 "Restricted – Possibly")은 쓰지 않았습니다. `korea_1960_new_housing_and_shop`(NAID 28210, "Unrestricted")은 쓸 수 있지만 흑백이라 이번 컬러 편에서는 뺐습니다. AFAK 필름의 판자촌·천막촌·가까이 찍은 아이들 장면도 넣지 않았습니다. 웃는 아이 한 컷만 길가 장면에서 썼습니다.

**출처**
- [NARA 428-NPC-43612 (NAID 87540) 〈STOCK FOOTAGE OF KOREA Seoul, Korea〉](https://catalog.archives.gov/id/87540): 1969년 가을(카탈로그 1969.9.21~11.2), 컬러. 미 해군 태평양함대 전투촬영반(슬레이트: T.K. Reynolds), RG 428 해군 사진센터. 파일 https://catalog.archives.gov/medialz/mopix/428/NPC/428-npc-43612.mp4. 이용 제한 "Undetermined", 열람 "Unrestricted". 0:26~2:38(도심), 2:46~6:40(탈곡), 6:40~10:50(짚단·소달구지)를 썼습니다.
- [NARA 111-LC-47652 (NAID 29288) 〈AFAK (Armed Forces Assistance to Korea)〉](https://catalog.archives.gov/id/29288): 1964.2.28, 컬러, 무성. 미 육군(RG 111 육군 통신감실, Army Library Copy Collection, 슬레이트: 촬영 Welsh). 파일 https://catalog.archives.gov/medialz/mopix/111/lc/111-lc-47652.mp4. 이용 제한 "Unrestricted". 0:28~1:14(전경), 3:47~6:45(거리·숭례문·노점·네온사인)를 썼습니다.
- 두 항목 모두 2026-10-09에 NARA 카탈로그 API(`catalog.archives.gov/proxy/records/search?naId=…`)로 이용 제한 상태를 직접 확인했습니다.
- 음악: "Wholesome"(korea3), "Bathed in the Light"(korea4) Kevin MacLeod (incompetech.com), CC BY 4.0

**korea3**: 흑백인 줄 알았던 서울 | 1960년대, 컬러로 보면 🎨
> 1964년과 1969년, 미군 촬영반이 컬러 필름으로 찍은 서울입니다. 차들이 오가는 도심, 언덕에서 내려다본 낮은 지붕들, 숭례문, 솜 점퍼 차림의 시민들과 말이 끄는 수레, 밤을 밝힌 ‘대한마아가린’과 ‘한국타이야’ 네온사인, 그리고 지금은 서울도서관이 된 옛 서울시청까지. 그 시절 서울, 기억나시나요?
> 영상: 미국 국립문서기록관리청(NARA) 428-NPC-43612 (NAID 87540, 미 해군 촬영), 111-LC-47652 (NAID 29288, 미 육군 촬영)
> 음악: "Wholesome" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #옛날서울 #1960년대 #컬러영상 #서울 #숭례문 #서울시청 #근현대사 #옛날영상 #shorts

**korea4**: 57년 전 가을걷이 | 1969년 시골, 컬러 영상 🌾
> 1969년 가을, 초가지붕 마을의 타작 마당. 미 해군 촬영반이 컬러로 찍은 실제 영상입니다. 발로 밟아 돌리는 탈곡기, 도리깨질, 아기를 업고도 일손을 보태는 어머니, 짚단을 묶는 할아버지, 볏단을 가득 실은 소달구지. 우리 할머니·할아버지의 젊은 날 가을 풍경입니다.
> 영상: 미국 국립문서기록관리청(NARA) 428-NPC-43612 (NAID 87540, 미 해군 촬영)
> 음악: "Bathed in the Light" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #가을걷이 #타작 #1969년 #시골풍경 #초가집 #소달구지 #옛날영상 #추억 #shorts

## 초기 비행 쇼츠 (`politics/oldflight`, `politics/oldflight2`)

1908~1925년에 찍힌 실제 기록영화로 만든 무성 쇼츠 두 편입니다. 소리가 없어서 한국어 자막(`"en": ""`)과 1926년 이전 녹음만 씁니다. 원본 클립은 `media/oldflight/`, 음악은 `media/oldmusic/`에 있고, 파일마다 `.json`에 제목·연도·제작·카탈로그 주소·파일 주소·자른 구간·권리 근거를 적었습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `oldflight` | 100년 전 비행기 발명 실패 모음 / 이게 날 거라고 믿었다고? 🤨 | 58.3초 | ① 프로펠러를 위로 잔뜩 단 회전날개 기계(먼지만 날리고 못 뜸) → ② 1920년대 베를리너 헬리콥터(1924년 최고 4.6m·1분 35초) → ③ 라이트 비행기: 말이 끌고, 프로펠러는 손으로, 레일 위에서 추를 떨어뜨려 발사 → ④ 1908년 프랑스, 윌버 라이트 |
| `oldflight2` | 117년 전 첫 군용 비행기 시험 / 대통령은 구경, 전 대통령은 탑승?! ✈️ | 58.7초 | 1909년 7월 포트마이어: 격납고, 오빌 라이트와 프랭크 람 중위, 추 탑 이륙, 1시간 12분 2인 비행 세계 기록, 속도 시험 통과와 3만 달러 구입(‘통신대 1호’) → 1910년 10월 세인트루이스: 루스벨트 전 대통령이 “됐소”라더니 직접 타고 “Bully!” |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py oldflight    # oldflight2도 같음
./render.sh oldflight
```

- 템플릿 코드는 바꾸지 않았습니다(`"frame": "film"`, `"audio": 0`, 번역 모드 자막만 사용). 원본은 모두 4:3 화면만 남기고 정사각 화소로 다시 인코딩했습니다(NARA 428-NPC 사본은 720x480 비정사각 화소·인터레이스라 `yadif`로 풀고 960x704로).
- **사실 근거**: 1909 군용기(1909.7.27 오빌 라이트·람 중위 1시간 12분 40초, 7.30 포울루아 중위와 알렉산드리아 왕복 속도 시험 평균 시속 42.5마일, 2만 5천+5천 달러, ‘Signal Corps No. 1’, 세계 첫 군용 비행기)는 [NASM 1909 Wright Military Flyer](https://airandspace.si.edu/collection-objects/1909-wright-military-flyer/nasm_A19120001000); 태프트 대통령 참관은 [NARA 111-H-1185 설명](https://catalog.archives.gov/id/24690); 첫 비행 12초는 NASM; 베를리너 헬리콥터(1924.2.23 4.57m·1분 35초, 추력 부족으로 지면 효과를 못 벗어남)는 [NASM Berliner Helicopter, Model 1924](https://airandspace.si.edu/collection-objects/berliner-helicopter-model-1924/nasm_A19240006000); 루스벨트 비행(1910.10.11 킨로크 비행장, 라이트 시범비행단 아치 혹시, 100피트 미만, 전·현직 통틀어 처음 비행한 미국 대통령)은 [LOC 설명](https://www.loc.gov/item/mp76000114/)·[FAA](https://www.faa.gov/blog/clearedfortakeoff/oval-office-skies-us-presidents-aviation-age); “No, thank you. There are enough high-fliers up there already.”와 “Bully!”는 LOC 필름의 자막 그대로입니다. 라이트 비행기의 레일·추 발사, 말, 손으로 돌리는 프로펠러는 미 육군 항공대 필름의 자막과 화면 그대로입니다.
- **확실하지 않아서 말을 줄인 것**: ① 회전날개 기계는 필름에도 카탈로그에도 이름·연도가 없어서 “제작자 미상”으로만 적었습니다(항공대 필름 자막: “라이트 복엽기의 라이벌로 나온 이상하고 다소 위험한 기계들”). ③의 말·레일 장면은 연도가 적혀 있지 않아 “1908년 무렵”(바로 다음 자막이 1908년 프랑스 시범)으로, ④는 항공대 필름의 1908년 10월 프랑스 자막을 따라 “1908 · 프랑스 · 윌버 라이트”로만 적고 특정 비행이라고 하지 않았습니다. NARA는 111-H-1185 일부가 1908년 시험일 수 있다고 했지만, 쓴 장면은 1909년 시험 비행 설명에 맞춰 1909로 표기했습니다. 베를리너 헬리콥터 영상은 NARA 설명상 1925년 볼링 필드 시험이라 라벨은 “1920년대”, 기록은 “1924년 최고 기록”으로 나눠 적었습니다.
- **쓰지 않은 것**: 1908년 9월 17일 셀프리지 중위 사망 사고(화면도 언급도 없음), 사람이 다친 추락 장면, 브리티시 파테·게티·AP 사본과 유튜브 재업로드, 파테 뉴스 장면이 섞인 〈Make America First in the Air〉(342-USAF-17686). 1880~1900년대 날갯짓 비행기(오니솝터)·접히는 기계 같은 유명한 실패 장면은 대부분 파테·고몽 뉴스릴이라 쓸 수 있는 사본을 찾지 못했습니다.
- **권리**: NARA 16-P·111-H 릴에는 “Restricted – Possibly”(“일부 저작권이 있을 수 있음”이라는 일반 문구) 표시가 있지만, 쓴 장면은 모두 미국 정부가 찍었거나(17 U.S.C. §105) 1926년 이전에 공개된 영상이라 미국에서 퍼블릭 도메인이고, 한국에서도 공표 후 70년이 지났습니다. 428-NPC-28731은 1929~30년경 육군 항공대가 엮은 정부 제작물이고(“Undetermined”), 안의 장면은 1908~1915년 것입니다. 음악 두 곡은 1926년 이전 녹음(미국 Music Modernization Act로 퍼블릭 도메인)입니다.

**출처**
- [NARA 16-P-1316-1 (NAID 2038) 〈Wright Brothers' Flight〉](https://catalog.archives.gov/id/2038) 1909.7.27 포트마이어, 미 농무부 — [MP4](https://catalog.archives.gov/medialz/mopix/016/16-P/16-p-1316-1.mp4)
- [NARA 111-H-1185 (NAID 24690) 〈First Army Aeroplane Flight, Fort Myer, Virginia〉](https://catalog.archives.gov/id/24690) 1909, 미 육군 통신대 — [MP4](https://catalog.archives.gov/medialz/mopix/111/h/111-h-1185_5Mbps.mp4), [NARA 블로그](https://unwritten-record.blogs.archives.gov/2022/09/01/the-wright-military-flyer-soars-on-celluloid-uncovering-the-story-of-our-oldest-government-film/)
- [NARA 111-H-1186 (NAID 24691) 〈Aviation, Historical, since 1919〉 1권](https://catalog.archives.gov/id/24691) 베를리너 헬리콥터 1925, 미 육군 통신대 — [MP4](https://catalog.archives.gov/medialz/mopix/111/h/111-h-1186-r1_5Mbps.mp4)
- [NARA 428-NPC-28731 (NAID 83219) 〈Pre-War I Air Force Outtakes〉](https://catalog.archives.gov/id/83219) 미 육군 항공대 편집, 1908~1915년 장면 — [MP4](https://catalog.archives.gov/medialz/mopix/428/NPC/428-npc-28731.mp4)
- [미 의회도서관 〈Colonel Roosevelt is invited to fly in Arch Hoxsey's plane at St. Louis, Mo., 1910〉](https://www.loc.gov/item/mp76000114/) Theodore Roosevelt Association Collection — [MP4](https://tile.loc.gov/storage-services/service/mbrs/ntscrm/01203936/01203936.mp4) (앞의 “Preserved by” 카드는 잘라냄)
- 음악: "Come Josephine in My Flying Machine" Blanche Ring (Victor 60032, 1910년 12월 녹음) — [archive.org](https://archive.org/details/comeJosephineInMyFlyingMachine) (oldflight); "The Rifle Regiment" (Sousa) United States Marine Band (Victor, 1921) — [LOC National Jukebox](https://www.loc.gov/item/jukebox-40962/) / [archive.org](https://archive.org/details/loc-jukebox-40962-the-rifle-regiment) (oldflight2)

**oldflight** — 100년 전 비행기 발명 실패 모음 ✈️ (이게 날 거라고 믿었다고?)
> 프로펠러를 위로 잔뜩 달았지만 먼지만 날린 기계, 4.6m 높이에서 더 오르지 못한 1920년대 헬리콥터, 그리고 성공한 라이트 비행기조차 말이 끌고, 프로펠러를 손으로 돌리고, 탑에서 추를 떨어뜨려 쏘아 올려야 했던 시절. 1903년 12초였던 첫 비행이 5년 만에 유럽 하늘을 날기까지. 모두 100년 넘은 실제 기록영화입니다.
> 영상: 미국 국립문서기록관리청(NARA) 428-NPC-28731, 111-H-1186, 16-P-1316-1 — 미 육군·미 농무부 촬영
> 음악: "Come Josephine in My Flying Machine" Blanche Ring (Victor, 1910)
> #비행기 #라이트형제 #옛날영상 #발명 #실패 #헬리콥터 #역사 #shorts

**oldflight2** — 117년 전 첫 군용 비행기 시험 ✈️ 대통령은 구경, 전 대통령은 탑승?!
> 1909년 7월, 미국 버지니아 포트마이어. 오빌 라이트가 프랭크 람 중위를 태우고 1시간 12분을 날아 2인 비행 세계 기록을 세웠고, 사흘 뒤 속도 시험까지 통과한 이 비행기를 미 육군이 3만 달러에 사들였습니다. 세계 첫 군용 비행기 ‘통신대 1호’. 그리고 이듬해, “하늘엔 허풍선이가 이미 많다”며 사양하던 시어도어 루스벨트 전 대통령이 결국 직접 타고 내려와 한 말: “Bully!”
> 영상: 미국 국립문서기록관리청(NARA) 16-P-1316-1, 111-H-1185 · 미국 의회도서관(Library of Congress, Motion Picture, Broadcasting, and Recorded Sound Division)
> 음악: "The Rifle Regiment" (J. P. Sousa) United States Marine Band (Victor, 1921) — 미국 의회도서관 National Jukebox
> #라이트형제 #비행기 #루스벨트 #옛날영상 #미국역사 #항공 #역사 #shorts

## 항공모함 쇼츠 (`carrier1`, `carrier2`)

미 해군이 DVIDS에 올린 비행갑판 영상(“U.S. Navy video by …”, 근무 중인 연방 공무원 저작물)에 한국어 내레이션(Edge TTS ko-KR-SunHiNeural)과 단어별 자막을 붙인 내레이션 방식 쇼츠입니다(`shorts/carrier1`, `shorts/carrier2`).

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `carrier1` | 항공모함에 착함하는 법 / 브레이크는 갈고리 하나 🪝 | 45.8초 | 슈퍼호넷 착함 → E-2 테일후크 → 줄에 걸려 정지 → 갑판 아래 착함 장치 → 줄 되감기(125회 쓰고 교체) → 볼터 → 웨이브 오프 → 야간 착함 → 조지 워싱턴호 20만 번째 착함(2026.8.18) |
| `carrier2` | 2초 만에 시속 265km / 항공모함 캐터펄트 발진 🚀 | 46.4초 | 캐터펄트 발진 → 갑판 옷 색깔(노랑·초록·보라) → ‘SHOOTER’ 옷의 슈터 → 슈터 발진 신호와 F-35C 발진 → 증기 → 니미츠호 슈터 “배에서 최고의 직업” |

```bash
# 원본: media/carrier/ (파일마다 .json에 DVIDS ID·페이지·파일 주소·크레디트·날짜·함정·구간)
mkdir -p public/carrier1/src public/carrier2/src
cp ../../media/carrier/*.mp4 public/carrier1/src/; cp ../../media/carrier/*.mp4 public/carrier2/src/
python3 voice_edge.py carrier1 && python3 prep.py carrier1 && ./render.sh carrier1   # carrier2도 같음
```

- **소리**: 원본 소리(제트 굉음·캐터펄트)는 B-roll(현장음만 있는 영상)에서만 살렸습니다(`moments`: 착함·야간 착함·발진 직후). 인터뷰가 든 특집 영상(909637 「Shooter: USS Nimitz Catapult Officers」)은 음악이 깔려 있어서(AudioSet AST 모델로 확인) **소리를 끄고** 화면만 썼습니다. 음악이 깔린 다른 특집(899725, 1022379, 1019391, 924177 등)은 쓰지 않았습니다.
- **교신**: 착함신호장교(LSO)의 실제 무전(“ball”, “wave off”)이 들어간 미 해군 영상은 찾지 못했습니다(DVIDS LSO 영상 4건, PALS 인증 영상 2건, FCLP 영상을 faster-whisper로 확인: 음악·인터뷰만 있거나 무전이 없음). 그래서 번역 교신 자막은 없고, ‘웨이브 오프’는 DVIDS 기사 설명으로만 다뤘습니다.
- **인용**: carrier2 끝의 “Being a shooter is, in my opinion, the best job on the ship”은 909637 영상 2:52–2:58의 말을 faster-whisper small.en·medium.en·base.en으로 확인한 것입니다. 이 대목은 화면이 B-roll이고 목소리만 나오는데, 같은 인터뷰에서 0:54에 “Lieutenant Sam Posey, callsign Beaky”라고 자기소개를 하고 1:03 이름표가 Samuel “Beaky” Posey라서 포지 대위의 말로 적었습니다. 화면(3:10~)은 같은 사람의 인터뷰 장면이고 소리는 껐습니다.
- **화면 설명 라벨**: 볼터 대목의 화면은 실제 볼터가 아니라 착함하러 들어오는 기체라서 “착함하러 들어오는 슈퍼호넷”으로 적었습니다. 슈터의 발진 신호(몸을 낮추고 팔을 뻗음)는 화면에 보이는 그대로만 말했습니다.
- **줄 개수**: 링컨함 기사는 “네 가닥”이지만 화면 대부분이 조지 H.W. 부시함이라 개수는 말하지 않았습니다(함마다 다를 수 있음).

**사실 출처 (모두 미 해군 공식 기사·영상 설명, DVIDS)**
- 캐터펄트 “a dead stop to 165 miles per hour in under two seconds” (165mph ≈ 265km/h), 증기 캐터펄트: [Locked, Loaded, and Ready to Launch, USS George Washington, 2022.2.18](https://www.dvidshub.net/news/415784/locked-loaded-and-ready-launch)
- 착함 장치가 착함 기체를 “about 340 feet”(약 104m)에 세움, 항모의 증기 캐터펄트 4기: [FRCSW VRT Maintains Carrier Flight Decks, 2021.2.9](https://www.dvidshub.net/news/388705/frcsw-vrt-maintains-carrier-flight-decks)
- 테일후크가 cross deck pendant(줄)를 잡고 줄은 갑판 아래 엔진으로 이어짐, 줄 하나는 125회 착함 후 교체: [On the wire, USS George Washington, 2014.11.17](https://www.dvidshub.net/news/148007/wire-behind-scenes-arrested-arcraft)
- 볼터 = “an aircraft missed the arresting wires”, “That pilot came back around and nailed the next landing”: [New Year’s Onboard USS Harry S. Truman, 2020.1.5](https://www.dvidshub.net/news/358237/new-years-onboard-uss-harry-s-truman-firsts-decade)
- 웨이브 오프 “we simply wave them off and they come back and try again”(LSO): [Marine pilots serve as LSOs, MCAS Beaufort, 2011](https://www.dvidshub.net/news/71531/marine-pilots-serve-lsos)
- 갑판 옷 색깔(노랑 = 항공기 지휘, 초록 = 착함 장비·캐터펄트, 보라 = 급유 “grapes”): [The Colors of the Flight Deck, USS Gerald R. Ford, 2017](https://www.dvidshub.net/news/255096)
- 슈터 = “catapult and arresting gear officer also known as a shooter”: DVIDS 899725 [Faces of the Flight Deck – Shooter](https://www.dvidshub.net/video/899725) 인터뷰(0:53)
- 20만 번째 착함 2026.8.18 인도양: DVIDS [1019352](https://www.dvidshub.net/video/1019352)·[1019391](https://www.dvidshub.net/video/1019391) 설명
- navy.mil 페이지는 이 작업 환경에서 403으로 막혀 확인하지 못해서, 위 DVIDS(미 국방부 공식 배포) 기사만 썼습니다. “시속 240km에서 2초 만에 정지”는 공식 출처를 찾지 못해 쓰지 않았습니다.

**영상** (모두 DVIDS, “U.S. Navy video by …” 표기, 공개 도메인 안내 페이지 기준; 원본 주소·구간은 `media/carrier/*.json`)
- [974894](https://www.dvidshub.net/video/974894) Flight Deck Operations — MC2 Christina Lewis, USS George H.W. Bush, 2025.8.12, 대서양
- [974949](https://www.dvidshub.net/video/974949) Flight Ops aboard USS George H.W. Bush — MC2 Emily Guillory · MCSN Francisco Linares, 2025.8.17
- [994266](https://www.dvidshub.net/video/994266) Flight Operations aboard USS George H.W. Bush — MCSA Soley Reed · MC2 Christina Lewis, 2026.1.15
- [986704](https://www.dvidshub.net/video/986704) Flight Deck Operations aboard USS George H.W. Bush — MC3 Jayden Brown, 2025.11.8
- [576952](https://www.dvidshub.net/video/576952) Carrier Flight Operations — MC3 David Lee, USS George H.W. Bush, 2017.11.29 (설명에 “Video by Mass Communication Specialist 3rd Class David Lee”)
- [824121](https://www.dvidshub.net/video/824121) F-35C flight operations — MC3 Michael Singley, USS Abraham Lincoln, 2021.11.16
- [948608](https://www.dvidshub.net/video/948608) F-35C Lightning II B-roll Package — MC2 Caden Richmond, USS Carl Vinson, 2024.8.13
- [1019347](https://www.dvidshub.net/video/1019347) George Washington Conduct Night Flight Operations — MC1 Robert S. Price, 2026.8.18, 인도양
- [1019352](https://www.dvidshub.net/video/1019352) 200,000th Aircraft Lands aboard George Washington — MC1 Robert S. Price, 2026.8.18
- [909637](https://www.dvidshub.net/video/909637) Shooter: USS Nimitz Catapult Officers — MC2 Carson Croom, USS Nimitz, 2023.8.29 (음소거)
- 음악: "Exhilarate"(carrier1), "Movement Proposition"(carrier2) Kevin MacLeod (incompetech.com), CC BY 4.0 — `fetch.sh`가 받습니다.

**carrier1** — 항공모함에 착함하는 법 | 브레이크는 갈고리 하나 🪝
> 활주로가 턱없이 짧은 항공모함에 전투기는 어떻게 멈출까? 꼬리의 갈고리(테일후크)가 갑판을 가로지르는 강철 줄을 낚아채면, 갑판 아래 장치가 약 100m 안에 전투기를 세웁니다. 줄을 전부 놓치면 ‘볼터’, 다시 돌아와 재도전. 밤에도 똑같이 합니다. 2026년 8월, 조지 워싱턴호의 20만 번째 착함 순간까지. 모두 미 해군이 공개한 실제 영상입니다.
> 영상: 미 해군 (DVIDS) — USS George H.W. Bush, USS Abraham Lincoln, USS George Washington. 미 해군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Exhilarate" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #항공모함 #착함 #전투기 #슈퍼호넷 #F35 #미해군 #shorts

**carrier2** — 2초 만에 시속 265km | 항공모함 캐터펄트 발진 🚀
> 정지 상태에서 2초도 안 돼 시속 265km. 항공모함 캐터펄트가 전투기를 쏘아 보내는 순간입니다. 갑판 위 노랑·초록·보라 옷은 각각 하는 일이 다르고(보라 옷 별명은 ‘포도’), 발진을 책임지는 사람은 ‘슈터’라고 부릅니다. 니미츠호 슈터의 한마디: “배에서 최고의 직업이에요.” 모두 미 해군이 공개한 실제 영상입니다.
> 영상: 미 해군 (DVIDS) — USS George H.W. Bush, USS Abraham Lincoln, USS Carl Vinson, USS Nimitz. 미 해군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #항공모함 #캐터펄트 #전투기 #F35 #미해군 #탑건 #shorts

## 해외파 뉴스 쇼츠 (`newsab1`, `newsab2`, `newsab3`)

`"titleStyle": "news"` 모양(흰 띠 제목 + 빨간 헤드라인)으로 만든 해외파 소식 세 편입니다. 2026년 10월 9일 기준 최근 2주 안의 실제 소식만 다뤘고, 사실은 모두 매체 두 곳 이상에서 확인했습니다. 인용은 보도된 말 그대로만 썼습니다. 내레이션은 Edge TTS `ko-KR-InJoonNeural`, 속도 `+22%`(+12%로는 한 편이 60초를 넘어서 올렸음)입니다.

| id | 제목(흰 띠) | 빨간 헤드라인 | 길이 | 내용 |
| --- | --- | --- | --- | --- |
| `newsab1` | 손흥민 A매치 59호골 / 차범근 기록 넘었다 | 한국 축구 역사가 / 바뀌었습니다 | 51.5초 | 10.6 우즈베키스탄전 프리킥 골 → 151경기 59골, 차범근 58골(1978.12) 넘어 47년 9개월 만에 한국 남자 최다 → 월드컵 무득점 뒤 9월 두 골로 동률 → 오세훈 추가골 2:0 → 소감 → “최고의 골은?” |
| `newsab2` | 이강인 아틀레티코 / 9월 이달의 선수 | 스페인 팬들이 / 이강인을 뽑았습니다 | 45.4초 | 팬 투표 9월 이달의 선수(후보 시메오네·데이비드·그리말도·카르도주) → 7월 PSG에서 이적, 2031년까지, 7번 → 말라가전 데뷔 결승골·라리가 8월 이달의 골 → 오사수나전 골 4:0, 레알전 89분 2:1 → “몇 골 넣을까?” |
| `newsab3` | 아시안게임 4연패 / 결승서 일본 1-0 | 한일전 결승을 / 또 이겼습니다 | 45.8초 | 10.3 도요타 스타디움 결승 → 후반 16분 양민혁 크로스·엄지성 골 → 엄지성 대회 4호골 → 인천·자카르타·항저우·나고야 사상 첫 4연패 → 최근 결승 3번 모두 일본 상대 승리 → 유럽파 9명 → “대회 MVP는?” |

**만드는 법.** 사진은 `media/newsab/stills.sh <id> <사진>`이 10초짜리 mp4(짧은 변 1440px로 lanczos 확대)로 바꿔 `public/<id>/src/`에 넣습니다. 숫자·기록 카드는 `media/newsab/make_cards.py`로 만든 자체 그래픽입니다. 얼굴 확대는 기존 `crop` 그대로 쓰되, 빨간 헤드라인(화면 y≈1070–1290)에 얼굴이 가리지 않게 얼굴이 사각 화면 위쪽 1/3에 오도록 `cy`를 잡았습니다. 템플릿 코드는 바꾸지 않았습니다. 클립 라벨은 화면에 나오지 않아서, **사진 연도는 클립별 크레딧 줄 맨 앞에** 넣었습니다(예: “2024 아시안컵 · 사진: …”). 소식과 다른 경기 사진이라는 점은 스티커로도 밝혔습니다(“※ 사진은 이전 경기 자료 사진”). 원본 사진과 출처 JSON(page, file_url, author, license, attribution)은 `media/newsab/`, 목소리는 `media/voice/newsab*/`.

**쓰지 않은 것.** 대한축구협회·구단·통신사 사진과 중계·기자회견 영상은 하나도 쓰지 않았습니다. 엄지성·이강인(아틀레티코 시절)·도요타 스타디움·메트로폴리타노의 위키미디어 사진은 모두 CC BY-SA라 쓰지 않았고, 엄지성은 그래픽 카드로 대신하면서 화면에 그 이유를 적었습니다. 2022년 대통령 만찬 사진(KOREA.NET 플리커)도 CC BY-SA 2.0이라 뺐습니다. 같은 시기 화제였던 대표팀 ‘96라인’ 갈등, 아시안게임 병역 특례 발언 논란은 사실관계와 양측 입장이 아직 엇갈려 다루지 않았습니다.

### 출처 (기사)

**newsab1** — 손흥민 A매치 59호골
- 경기·기록(10월 6일 용인 미르스타디움, 우즈베키스탄 2-0, 황희찬 패스를 받은 손흥민의 슈팅이 상대 팔에 맞아 프리킥 → 낮게 깔아 찬 오른발 슈팅이 수비벽을 돌아 오른쪽 구석, 151경기 59골, 차범근 136경기 58골·1978.12.17 방콕 아시안게임, 47년 9개월 19일 만, 오세훈 후반 헤더). 내레이션·자막·카드는 이에 맞춰 “1978년 12월 → 47년 9개월 만”으로 적었습니다(연도만 빼면 48로 보여 헷갈리므로 개월까지 표기): [서울신문 2026.10.6](https://www.seoul.co.kr/news/sport/soccer/2026/10/06/20261006500310)(사진 연합뉴스), [한국일보 2026.10.6](https://www.hankookilbo.com/news/article/A2026100621050002334), [머니투데이 2026.10.6](https://www.mt.co.kr/sports/2026/10/06/2026100621544044286), [KBC광주방송 2026.10.6](https://news.ikbc.co.kr/article/view/kbc202610060077). 골 시간은 전반 5분(한국일보)·6분(서울신문)으로 엇갈려 말하지 않았습니다.
- 월드컵 조별리그 3경기 무득점(56골), 9.24 에콰도르전 프리킥 57호, 9.28 우루과이전 58호로 동률: [한국일보 2026.10.6](https://www.hankookilbo.com/news/article/A2026100621050002334), [일간스포츠 2026.9.25](https://isplus.com/article/view/isp202609250002)(에콰도르전 57호), [KBC 2026.10.6](https://news.ikbc.co.kr/article/view/kbc202610060077)(우루과이전 58호 동률).
- 소감 “역사를 쓸 수 있어서 정말 영광”, “태극마크를 달고 이렇게 많은 골을 넣은 것은 혼자만이 할 수 없는 것”: [일간스포츠 2026.10.7](https://isplus.com/article/view/isp202610070014), [엑스포츠뉴스 2026.10.7](https://www.xportsnews.com/article/2204832)(“한 역사를 쓸 수 있게 돼서 정말 너무나도 영광”, “저 혼자만이 할 수 없는 것”). 내레이션은 두 기사 공통 내용만 옮겼습니다.
- 16년(2010년 12월 데뷔): 서울신문·한국일보(위와 같음).

**newsab2** — 이강인 아틀레티코 9월 이달의 선수
- 9월 이달의 선수(팬 투표, 구단 공식 앱 등, 후원사 마오우가 현지 10월 2일 SNS 발표, 후보 줄리아노 시메오네·조너선 데이비드·그리말도·조니 카르도주): [데일리안 2026.10 초](https://www.dailian.co.kr/news/view/1697635), [스포츠경향 2026.10.5](https://sports.khan.co.kr/article/202610050944003/)(문도 데포르티보 4일 보도 인용).
- 7월 PSG에서 이적·2031년 6월까지 계약·등번호 7번(그리즈만이 달던 번호): 스포츠경향 2026.10.5, 데일리안(위와 같음)(위와 같음).
- 말라가 개막전(한국시간 8.20, 2-0) 교체 투입 후 왼발 감아차기 결승골: [머니투데이 2026.8.20](https://www.mt.co.kr/sports/2026/08/20/2026082020124284891), [일간스포츠 2026.8.20](https://isplus.com/article/view/isp202608200110); 라리가 8월 이달의 골: [엑스포츠뉴스 2026.9.10](https://www.xportsnews.com/article/2194075), 스포츠경향 2026.10.5.
- 오사수나전 풀타임·골·4-0, 레알 마드리드전 89분·2-1 역전승: [스포츠경향 2026.9.17](https://sports.khan.co.kr/article/202609170356003), 데일리안(위와 같음).
- 9월 출전 수(4경기 vs 5경기)와 ‘몇 번째 개인상’은 매체마다 달라 말하지 않았습니다.

**newsab3** — 아시안게임 남자축구 4연패
- 10월 3일 도요타 스타디움 결승 한국 1-0 일본, 후반 16분 엄지성(스완지 시티), 4회 연속 우승(2014 인천·2018 자카르타 팔렘방·2022 항저우), 최근 세 번의 결승 모두 일본 상대 승리: [경향신문 2026.10.3](https://www.khan.co.kr/article/202610032131001), [부산일보 2026.10.3](https://www.busan.com/view/busan/view.php?code=2026100320083228829).
- 양민혁의 오른쪽 크로스, 엄지성이 오른발로 잡아 왼발 슈팅: 부산일보(위와 같음), [머니투데이 2026.10.3](https://www.mt.co.kr/sports/2026/10/03/2026100320543717622).
- 엄지성 대회 4골: 부산일보(위와 같음), [YTN 2026.10.4](https://www.ytn.co.kr/_ln/0103_202610041329075285).
- 유럽파 9명(양민혁·배준호 등): [머니투데이 2026.7.9](https://www.mt.co.kr/sports/2026/07/09/2026070909140418386), [데일리안 2026.7.9](https://www.dailian.co.kr/news/view/1665425/), [뉴시스 2026.7.9](https://www.newsis.com/view/NISX20260709_0003702004).

### 사진 크레딧

- **Fars News Agency / M.Sadegh Nikgostar (CC BY 4.0)** — 2024년 2월 6일 아시안컵 4강 요르단 2-0 한국(카타르). 손흥민·이강인 경기 장면, 태극기, 경기장, 대표팀 원진. 위키미디어 공용 [Category:Jordan v South Korea, 6 February 2024](https://commons.wikimedia.org/wiki/Category:Jordan_v_South_Korea,_6_February_2024) 사진 (4), (5), (8), (13), (16), (30), (32), (34), (40), (51), (62), (64), (68), (70). 패배한 경기 사진이라 크레딧 줄에 연도와 대회를 적었습니다.
- **타타르스탄 공화국 체육부 (tatarstan.ru, CC BY 4.0)** — 2018 월드컵 한국 2-0 독일: [17](https://commons.wikimedia.org/wiki/File:South_Korea_vs_Germany_2018_World_Cup_17.jpg), [20](https://commons.wikimedia.org/wiki/File:South_Korea_vs_Germany_2018_World_Cup_20.jpg).
- **Meghdad Madadi / Tasnim News Agency (CC BY 4.0)** — 2021.10.12 이란 1-1 한국(테헤란), 손흥민 몸풀기: [2021-7](https://commons.wikimedia.org/wiki/File:Iran,_S._Korea_Closer_to_Securing_Spot_in_World_Cup_Tournament_after_Draw_2021-7.jpg).
- **Timmy96 (CC0)** — 2025.3.15 QPR 임대 시절 양민혁 [(9)](https://commons.wikimedia.org/wiki/File:Yang_Min-hyuk_15032025_(9).jpg)·[(6)](https://commons.wikimedia.org/wiki/File:Yang_Min-hyuk_15032025_(6).jpg), 2025.9.20 스토크 시티 배준호 [(3)](https://commons.wikimedia.org/wiki/File:Bae_Jun-ho_20092025_(3).jpg)·[(1)](https://commons.wikimedia.org/wiki/File:Bae_Jun-ho_20092025_(1).jpg).
- **Ayuntamiento de Roquetas de Mar (퍼블릭 도메인 마크)** — 2015년 유소년 대회의 14살 이강인: [Kangin Lee 2015](https://commons.wikimedia.org/wiki/File:Kangin_Lee_2015.jpeg) ([플리커 원본](https://www.flickr.com/photos/aytoroquetas/17092037717/)).
- 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), CC BY 4.0.

### 업로드 문구

**newsab1** — 손흥민 A매치 59호골, 차범근 기록 넘었다 ⚽
> 2026년 10월 6일 우즈베키스탄전(2-0 승). 손흥민이 프리킥으로 A매치 151경기 59번째 골을 넣으며 차범근 전 감독의 58골(1978년)을 넘어 한국 남자 선수 A매치 최다 골 기록을 새로 썼습니다. 경기 뒤 소감: “역사를 쓸 수 있어서 정말 영광”, “태극마크를 달고 이렇게 많은 골을 넣은 것은 혼자만이 할 수 없는 것”(일간스포츠·엑스포츠뉴스 보도). 여러분이 꼽는 손흥민 최고의 골은?
> ※ 영상 속 사진은 이전 경기 자료 사진입니다(2024 아시안컵·2021 이란 원정·2018 월드컵).
> 사진: M.Sadegh Nikgostar / Fars News Agency (CC BY 4.0), Meghdad Madadi / Tasnim News Agency (CC BY 4.0), 타타르스탄 공화국 체육부 tatarstan.ru (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #손흥민 #차범근 #A매치최다골 #축구국가대표 #우즈베키스탄 #shorts

**newsab2** — 이강인, 아틀레티코 9월 이달의 선수 🏆 (팬 투표)
> 이강인이 아틀레티코 마드리드 팬 투표로 뽑는 9월 이달의 선수에 선정됐습니다(후원사 10월 2일 발표). 7월 PSG에서 이적해 2031년까지 계약하고 7번을 단 이강인은 말라가와의 개막전 데뷔골(라리가 8월 이달의 골), 9월 오사수나전 골(4-0), 레알 마드리드와의 더비 2-1 승리(89분 출전)로 활약을 이어가고 있습니다. 이번 시즌 몇 골까지 넣을까요?
> ※ 영상 속 사진은 2024 아시안컵 대표팀 경기와 2015년 유소년 대회 자료 사진입니다.
> 사진: M.Sadegh Nikgostar / Fars News Agency (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/, Ayuntamiento de Roquetas de Mar (퍼블릭 도메인)
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #이강인 #아틀레티코마드리드 #라리가 #이달의선수 #해외축구 #shorts

**newsab3** — 아시안게임 4연패! 한일전 결승 1-0 🥇
> 2026년 10월 3일 아이치·나고야 아시안게임 남자축구 결승에서 한국이 개최국 일본을 1-0으로 꺾고 사상 첫 4회 연속 금메달을 따냈습니다. 후반 16분 양민혁의 크로스를 엄지성(스완지 시티)이 마무리했고, 엄지성의 이번 대회 4번째 골이었습니다. 최근 세 번의 결승 상대는 모두 일본, 세 번 모두 한국이 이겼습니다. 여러분이 뽑는 대회 MVP는?
> ※ 경기 사진이 아닌 자료 사진(2025년 양민혁·배준호, 2024 아시안컵)과 자체 그래픽을 썼습니다.
> 사진: Timmy96 (CC0), M.Sadegh Nikgostar / Fars News Agency (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #아시안게임 #한일전 #엄지성 #양민혁 #축구 #shorts

## 린드버그 대서양 횡단 쇼츠 (`politics/lindbergh1`)

“해낼 수 없다던 일을 해낸 사람” 편입니다. 1927년에 극장에서 상영된 실제 뉴스 영화(Fox News, Kinograms)로 만들었고, 영어 줄은 **그 뉴스 영화의 화면 자막(intertitle)을 그대로** 옮겼습니다. 무성 필름이라 육성은 없고(`"en": ""` 줄은 한국어 설명만), 음악만 깝니다. 내레이션·AI 목소리 없음.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `lindbergh1` | 아무도 못 한 대서양 단독 횡단, / 25살 우편 비행사가 해냈다..? | 58.8초 | “The annals of mankind record no more daring individual achievement…” → 1927.5.20 루스벨트 비행장 이륙(“the cheers — and fears”) → 다음 날 밤 파리 르부르제의 인파(“He lands!”) → 파리의 린드버그 → 3주 뒤 워싱턴 귀국, 쿨리지 대통령의 수훈비행십자훈장(“The proudest moment of his life”) |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py lindbergh1    # 원본: media/speech/lindbergh1927_fox_kinograms.mp4
./render.sh lindbergh1
```

- **영상**: [archive.org `Lindberg1927` 〈[Lindbergh's Flight and Return]〉](https://archive.org/details/Lindberg1927) — 프렐링거 아카이브(Prelinger Archives), 제작 “Fox News / Kinograms”, 1927, 무성. 워터마크·덧입힌 음악 없음. 원본 MPEG(368×480, 비정사각 화소, 인터레이스)을 `yadif`로 풀어 640×480으로 다시 인코딩했고, 소스 15–365초만 `media/speech/lindbergh1927_fox_kinograms.mp4`(40 MB)로 잘라 두었습니다. 쓴 구간과 인용한 화면 자막은 같은 이름의 `.json`에 있습니다.
- **라이선스**: 1927년에 상영(공표)된 뉴스 영화라 미국에서 퍼블릭 도메인입니다(2026년 기준 1930년 이전 공표작은 모두 만료). archive.org 항목도 Public Domain 표시입니다. 화면 크레딧은 “Fox News · Kinograms (1927) · Prelinger Archives”만 적었습니다.
- **자막**: 영어 줄 11개는 필름의 화면 자막 6장을 그대로 옮겼습니다. Fox News 자막 카드는 이 사본에서 좌우가 조금 잘려 줄 끝 한두 글자가 안 보이는데(manki[nd], gather[ed], fat[e], mas[s], a[ll], reac[h], a[ir] 등), 앞뒤 문맥으로 확실한 것만 채웠습니다. 실제 카드의 “- -”는 “—”로 적었습니다. 한국어 설명 줄(이륙·영웅·환영 인파)과 스티커의 사실 근거는 [NASM 〈Spirit of St. Louis〉](https://airandspace.si.edu/collection-objects/ryan-nyp-spirit-st-louis-charles-lindbergh/nasm_A19280021000): 1927.5.20 아침 뉴욕 출발, 33시간 30분, 3,610마일(≈5,810 km), 최초의 대서양 단독 무착륙 비행, 그전 직업은 세인트루이스–시카고 항공우편 조종사. 나이 25세(1902.2.4 출생).
- **라벨 근거**: 장면 순서와 Kinograms 자막(“The Memphis arrives at the Navy Yard”, “Then to the Washington Monument for his presentation to President Coolidge”). 색종이 장면은 도시가 자막에 없어서 “1927.6 · 귀국 환영”으로만 적었습니다.
- 컷마다 흰 번쩍임(템플릿 기본). 음악은 `duck: false`(무성이라 줄일 목소리가 없음). 라우드니스 −14.0 LUFS, 최대 −1.5 dBFS. 템플릿 코드는 바꾸지 않았습니다.
- **헬렌 켈러 편(`helen1`)은 만들지 않았습니다.** 앤 설리번이 설명하고 헬렌 켈러가 “I am not dumb now”라고 말하는 필름의 유일한 원본 기록은 사우스캐롤라이나대 MIRC의 [Fox Movietone News Story 2-83 〈Helen Keller and Annie Sullivan Macy--outtakes〉](https://digital.tcl.sc.edu/digital/collection/MVTN/id/4264)(촬영 1929.2.27, 유성)인데, ① 카탈로그상 **아웃테이크**(상영본에서 빠진 촬영분)라 1930년 이전 공표를 확인할 수 없고, ② 사본에 “Copyright Moving Image Research Collections. All rights reserved.”라는 권리 주장이 붙어 있습니다. 미 의회도서관·국립문서기록관리청·archive.org에서는 다른 깨끗한 사본을 찾지 못했습니다(LOC의 1919년 〈Deliverance〉는 무성 극영화). 그래서 추측으로 진행하지 않았습니다.

**lindbergh1** — 아무도 못 한 대서양 단독 횡단, 25살 우편 비행사가 해냈다..? ✈️
> 1927년 5월 20일 아침, 뉴욕 루스벨트 비행장. 25살 항공우편 조종사 찰스 린드버그가 ‘스피릿 오브 세인트루이스’호를 타고 혼자 이륙했습니다. 33시간 30분 뒤 파리 르부르제 비행장에 내리자 엄청난 인파가 몰려들었고, 그는 하루아침에 세계의 영웅이 됐습니다. 영어 자막은 1927년 뉴스 영화 화면에 실제로 나온 문구이고, 한국어는 직접 번역했습니다.
> 영상: Fox News · Kinograms (1927), Prelinger Archives (archive.org)
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #린드버그 #대서양횡단 #도전 #포기하지마 #동기부여 #옛날영상 #역사 #영어공부 #shorts

## 위력 실험 쇼츠 (`politics/boom1`, `politics/boom2`)

DVIDS에 올라온 미군 촬영 B-roll(현장음만 있고 음악은 없음)에 원래 소리를 그대로 두고, 실제로 들리는 외침만 번역 자막으로 붙였습니다. 내레이션, 그래픽, 음악은 넣지 않았습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `boom1` | 바닷속 불발탄 폭파 / 물기둥 실화냐 | 17.9초 | 첫 화면은 솟구치는 물기둥입니다. 이어서 물속 잠수요원, 보트 위에서 지켜보는 대원, "Fire in the hole!"(폭파한다!) 외침, 두 번째 물기둥 순서로 갑니다. |
| `boom2` | 어깨에 메고 쏘는 84mm / 후폭풍 실화냐 | 24.3초 | 첫 화면은 사격 순간 뒤로 일어나는 흙먼지입니다. 이어서 "Fire, fire, fire" 사격, 교관의 "Tap it. Always tap just to make sure it's seated.", "Back blast all clear." 뒤 사격과 흙먼지, 표적 착탄 순서로 갑니다. |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py boom1    # 원본: media/boom/ (boom2도 같음)
./render.sh boom1 final/boom1.mp4
```

**영상** (DVIDS 페이지에 "Video by …"와 PUBLIC DOMAIN이 있고 Restrictions 안내는 없음. 둘 다 B-Roll 분류)
- `boom1`: [DVIDS 923887 「ACDC: EOD Underwater UXO Demolitions」](https://www.dvidshub.net/video/923887/acdc-eod-underwater-uxo-demolitions)
  - 촬영: Staff Sgt. Dana Beesley (U.S. Marine Corps). 촬영일 2024.5.14, 필리핀 카비테 카바요섬 앞바다, Archipelagic Coastal Defense Continuum(ACDC).
  - 원본 파일: https://d34w7g4gy10iej.cloudfront.net/video/2405/DOD_110313154/DOD_110313154.mp4
  - 설명에 따르면 필리핀 해병대·미 해병대 폭발물처리반과 필리핀 해군 특수작전사령부·미 해군 잠수요원이 수중 불발탄 처리 폭파를 했습니다.
  - 쓴 구간(원본 초): 118.9–121.0(첫 물기둥), 104.0–106.6(잠수요원), 107.0–111.5(보트 위 대원), 125.4–134.0(외침과 두 번째 물기둥).
- `boom2`: [DVIDS 876009 「B-Roll: Marines fire MAAWS downrange」](https://www.dvidshub.net/video/876009/b-roll-marines-fire-maaws-downrange)
  - 촬영: Sgt. Jacob Yost (U.S. Marine Corps). 촬영일 2023.3.9, 캘리포니아 캠프 펜들턴, 미 1해병사단.
  - 원본 파일: https://d34w7g4gy10iej.cloudfront.net/video/2303/DOD_109502604/DOD_109502604.mp4
  - 설명에 따르면 M3E1 MAAWS는 "Carl Gustaf"라고도 부르는 84mm 무반동 무기입니다.
  - 쓴 구간(원본 초): 101.4–103.0, 63.5–68.6, 77.6–82.0, 111.8–121.0, 133.6–137.5.
- `media/boom/`의 mp4 파일:
  - 내용: 원본에서 잘라낸 구간을 저장용으로 다시 인코딩한 것입니다(x264 CRF 26).
  - 파일명: `boom_dvids923887_100-136.mp4`는 원본 100–136초, `boom_dvids876009_58-140.mp4`는 원본 58–140초입니다.
  - 시간축: edit.json의 시간은 이 파일 기준입니다.
  - 옆의 .json에 DVIDS ID, 페이지·파일 주소, 크레디트, 설명, 구간을 적었습니다.

**소리와 자막**
- 음악 확인: 두 영상 모두 AudioSet AST 모델로 5초 단위로 검사했습니다. Speech, Vehicle, Boat 같은 현장음만 나왔고 음악은 없었습니다.
- 자막 확인: faster-whisper small과 medium.en이 둘 다 같은 말을 들은 줄만 번역했습니다.
  - "Fire in the hole"(923887, 122.4–128.9초)과 "Fire, fire, fire", "Tap it. Always tap just to make sure it's seated.", "Back blast all clear."(876009)가 해당합니다.
  - 두 모델이 엇갈린 말("Ready for the back blast?", "Back blast area secure", "SCA loaded" 등)은 넣지 않았습니다.
  - 923887의 타갈로그어 대화도 넣지 않았습니다.
- 말하는 사람을 특정할 수 없어 이름표는 달지 않았습니다. 사람 이름, 계급, 사연은 지어내지 않았습니다.
- 설명 자막("미·필리핀 잠수요원들", "바닷속 불발탄 처리 훈련 중", "미 해병대 칼 구스타프 사격", "84mm 무반동총")은 DVIDS 설명에 있는 내용만 썼습니다.
- 라우드니스: render.sh 결과 −14.6 LUFS(boom1), −14.9 LUFS(boom2)입니다. 폭발음 피크 때문에 true peak −1.5 dB 제한에 걸려 −14보다 조금 낮게 나왔습니다.
- 미 해병대·국방부가 이 영상을 보증하거나 후원한다는 인상을 주면 안 됩니다(DVIDS 저작권 안내). 화면에는 "영상: 미 해병대 (DVIDS)"만 적었습니다.

### 업로드 문구

**boom1**
- 제목: `바닷속 불발탄 폭파, 물기둥 실화냐 😳` (21자)
- 설명:
  ```
  필리핀 카바요섬 앞바다에서 필리핀·미국 해병대와 해군 잠수요원들이 바닷속 불발탄을 폭파 처리하는 순간 (2024년 5월, 연합훈련 ACDC).
  "Fire in the hole!" = 폭파한다!
  영상: U.S. Marine Corps video by Staff Sgt. Dana Beesley (DVIDS 923887). 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
  ```
- 해시태그: `#폭발물처리반 #불발탄 #물기둥 #해병대 #shorts`

**boom2**
- 제목: `어깨에 메고 쏘는 84mm, 후폭풍 실화냐` (22자)
- 설명:
  ```
  미 해병대 1해병사단의 칼 구스타프(M3E1 MAAWS, 84mm 무반동 무기) 사격 훈련. 쏘기 전 "후폭풍 구역 이상 없음!"을 외치는 이유가 보입니다. (2023년 3월, 캘리포니아 캠프 펜들턴)
  영상: U.S. Marine Corps video by Sgt. Jacob Yost (DVIDS 876009). 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
  ```
- 해시태그: `#칼구스타프 #무반동총 #후폭풍 #미해병대 #shorts`

## 문 폭파 돌입 쇼츠 (`politics/boom3`)

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `boom3` | 문 하나 따는데 / 이렇게까지? | 20.8초 | 첫 화면은 문이 터지는 순간의 불꽃과 방폭 담요 뒤에 붙어 선 해병들입니다. 이어서 "Five, four, three, two, one" 카운트다운, 폭파, 연기 속 돌입, 다른 날 문 앞에 둔 카메라에 잡힌 폭파 순서로 갑니다. |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py boom3
./render.sh boom3 final/boom3.mp4
```

**영상** (둘 다 DVIDS B-Roll, PUBLIC DOMAIN, Restrictions 안내 없음, 미 해병대 촬영)
- [DVIDS 580472 「Breaching Range」](https://www.dvidshub.net/video/580472/breaching-range)
  - 페이지 머리 크레디트: Staff Sgt. Albert Carls. 설명 끝: "U.S. Marine Corps video by Lance Cpl. Kaitlynn M. Hendricks".
  - 촬영 2018.1.12(설명 기준), 노스캐롤라이나 캠프 르준, 보병학교(동부) 보병훈련대대 A중대의 도심 폭파 돌입 교육 종합 평가.
  - 원본 파일: https://d34w7g4gy10iej.cloudfront.net/video/1801/DOD_105249590/DOD_105249590-1024x576-1769k.mp4
  - 쓴 구간(원본 초): 473.3–475.0(첫 화면), 466.4–481.6.
- [DVIDS 580456 「Breaching Range」](https://www.dvidshub.net/video/580456/breaching-range)
  - 크레디트: Staff Sgt. Albert J. Carls. 촬영 2018.1.11(설명 기준), 같은 교육. 문 앞 바닥에 둔 카메라 화면입니다.
  - 원본 파일: https://d34w7g4gy10iej.cloudfront.net/video/1801/DOD_105249328/DOD_105249328-1024x576-1769k.mp4
  - 쓴 구간(원본 초): 286.5–290.4.
  - 다른 날 다른 폭파라서 자막에 "다른 날"이라고 적었습니다.
- 원본 조각: `media/boom/boom_dvids580472_460-485.mp4`, `media/boom/boom_dvids580456_280-295.mp4`. 옆의 .json에 출처와 구간을 적었습니다.

**소리와 자막**
- AST로 검사한 결과 Speech, Artillery fire, Explosion만 나오고 음악은 없었습니다. 원래 소리를 그대로 썼습니다.
- 카운트다운 "Five, four, three, two, one"은 faster-whisper small과 medium.en이 같게 들었습니다.
- 두 모델이 엇갈린 말("Reach there"/"Freeze clear", "Lay down more…")은 넣지 않았습니다.
- 설명 자막("미 해병대 폭파 돌입 훈련")은 DVIDS 설명("demolition and explosive breaching training")에 근거합니다.
- 화면에 보이는 대로 "문이 터지듯 열렸다", "연기 속으로 바로 돌입"이라고만 적었습니다. 장약 종류나 만드는 법은 다루지 않았습니다.
- 라우드니스 −14.3 LUFS(폭발 피크가 true peak 제한에 걸림).

### 업로드 문구

**boom3**
- 제목: `문 하나 따는데 이렇게까지? 💥` (16자)
- 설명:
  ```
  미 해병대 보병학교의 도심 폭파 돌입(explosive breaching) 훈련. "다섯, 넷, 셋, 둘, 하나" 뒤에 문이 터지고, 대원들은 바로 연기 속으로 들어갑니다. (2018년 1월, 노스캐롤라이나 캠프 르준)
  영상: U.S. Marine Corps video by Lance Cpl. Kaitlynn M. Hendricks / Staff Sgt. Albert J. Carls (DVIDS 580472, 580456). 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
  ```
- 해시태그: `#미해병대 #폭파돌입 #군대 #해병대 #shorts`


## 군견 쇼츠 (`politics/dog1`~`politics/dog5`)

미군이 DVIDS에 올린 군견(MWD) 영상에 한국어 자막을 붙인 쇼츠 5편입니다. 장르는 ‘군대 실화·공감’이고, 기계가 아니라 사람과 개(얼굴·반응)가 주인공입니다. 그래픽 클립(gfx)은 쓰지 않았습니다. 영상은 모두 미군 장병·국방부 직원이 촬영한 연방정부 저작물(퍼블릭 도메인)입니다. DVIDS 페이지마다 PUBLIC DOMAIN 표시가 있고 Restrictions 안내는 없습니다.

| id | 제목 | 길이 | 내용 | 소리 |
| --- | --- | --- | --- | --- |
| `dog1` | 물로 도망치면 / 군견도 못 따라올까? | 23.5초 | 수영장 수중 제압 훈련: 물속 방어복 요원에게 뛰어드는 군견 → 다이빙 → 물속 수영 → 팔 물기 → “물도 안전지대 아님” | 현장음 + 음악 낮게 |
| `dog2` | 암 진단받은 군견을 위해 / 전우들이 준비한 경례 | 37.6초 | 은퇴 군견 루도를 기리는 부대 행사: 공식 수색 1만 회 이상, 비밀경호국 임무 15회, 대통령 지원 임무 6회 → 2020년 4월 암 진단 → 장병들의 경례 | 행사 영상의 실제 목소리(배경음악 제거) + 자막 |
| `dog3` | 군견 훈련 미끼가 된 / 대령님의 최후 | 28.3초 | 코소보 평화유지군(KFOR) 동부지역사령관 대령이 직접 방어복을 입고 군견 훈련 미끼가 됨 → “더 빨리 뛰셔야 돼요!” → 제압 | 현장음 + 음악 낮게 |
| `dog4` | 헬기에서 내려온 / 군견의 출근길 | 20.2초 | 해안경비대 군견 심바가 핸들러와 함께 헬기에서 바다 위 배 갑판으로 하강(호이스트 훈련) | 현장음(헬기·바다) + 음악 낮게 |
| `dog5` | 10년 복무한 군견의 / 전역식 날 생긴 일 | 29.4초 | 포트 베닝 군견 추모비 앞 전역식: 낭독된 전역 증서(“수많은 장병을 구하고… 새 가족 품에서 은퇴할 자격이 충분합니다”) → 핸들러가 군견을 안아 줌 | 현장음 + 증서 낭독 목소리 + 음악 낮게 |

```bash
# 원본: media/dogs/*.mp4 (파일마다 .json에 DVIDS ID·페이지·파일 주소·크레디트·부대·날짜·구간)
python3 politics/prep_split.py dog1 && ./render.sh dog1 final/dog1.mp4   # dog2, dog3도 같음
# final/은 저장소 크기 때문에 -crf 22로 다시 압축했습니다(dog1, dog3)
```

- 레이아웃: `"titleStyle": "band"`, 정사각 화면에 `single` 크롭으로 얼굴·개를 크게, 자막 `"captionY": 1600`, 컷마다 흰 번쩍임 없이(`"broll": true`) 바로 붙였습니다. 길이 23.5초·37.6초·28.3초, 라우드니스 −14.0·−14.1·−14.4 LUFS(render.sh).
- **dog2 소리**: 원본은 공군이 만든 짧은 영상(Package)이라 목소리 밑에 피아노 음악이 깔려 있습니다(AudioSet AST 모델 Music 점수 약 0.45). Demucs(htdemucs, `--two-stems=vocals`)로 음악을 지우고 목소리만 남겼습니다(Music 점수 0.01–0.05). 그 위에 우리 음악(Floating Cities)을 낮게 깔았습니다. 그림은 첫 1.25초만 같은 영상 43.25–44.5초(루도가 핸들러 옆에서 걷는 장면)로 바꿔 첫 화면을 개 얼굴로 했습니다. 목소리는 그대로입니다(`media/dogs/rudo_edit.json`).
- **dog2 자막**: 영상 속 내레이션을 faster-whisper small.en·medium.en으로 듣고 번역했습니다. 일부는 빼거나 자막을 달지 않았습니다.
  - “He retired from the Air Force as a ___”의 마지막 단어는 확실히 들리지 않아 이 문장을 통째로 잘랐습니다.
  - 핸들러 이름은 자막에 넣지 않았습니다. 미 공군 기사 검색 결과로는 Staff Sgt. Peter Van Salisbury지만, af.mil이 이 환경에서 403이라 원문을 직접 확인하지 못했습니다.
  - 개 이름은 음성 인식이 Bruno/Reno/Rudo로 흔들려서 DVIDS 설명의 “Rudo”(루도)를 따랐습니다.
  - 뒤의 “to the 823, to the 824”는 길이 때문에 잘랐습니다.
- **dog3 자막**: 확실히 들리는 말만 따옴표로 번역했습니다.
  - “get a good smell of me right now” → “지금 내 냄새 잘 맡아 둬”. 개 앞에 무릎 꿇은 대령의 말입니다.
  - “You've got to run faster” / “Run faster” → “더 빨리 뛰셔야 돼요!” / “더 빨리!”. 화면 밖 목소리입니다.
  - 나머지(“계급장? 군견은 모릅니다”, “대령님도 예외 없음”)는 화면을 설명하는 재치 자막입니다.
  - 방어복을 입은 사람이 대령이라는 점은 DVIDS 설명(“Col. Brey Hopkins … dons a bite suit”)과 화면(실내에서 대령이 방어복과 투구를 입는 장면, 같은 옷차림)에 근거합니다. 훈련장 장면에서는 투구 때문에 얼굴이 보이지 않습니다.
- **dog1 자막**: 말소리 대부분은 들리지 않는 현장 잡담이라 자막을 달지 않았습니다. 사실 자막 두 줄(“미 공군 군견 수중 제압 훈련”, “낯선 환경에 익숙해지는 훈련”)은 DVIDS 설명(“water aggression training … acclimate MWDs to an atypical environment … apprehend a target in water”)에 근거합니다.

**영상 출처** (모두 DVIDS, 원본 주소·구간은 `media/dogs/*.json`)
- dog1 — [976540](https://www.dvidshub.net/video/976540) B-Roll: 509 SFS Military Working Dog Water Aggression Training — U.S. Air Force video by Senior Airman Bryce Moore, 509th Security Forces Squadron, 2025.9.2, 미국 미주리주 세데일리아 공공 수영장. 원본 39.25–43.95, 97–100.5, 150–152.8, 84–88.5, 130–135.5, 138.3–140.8초.
- dog2 — [761955](https://www.dvidshub.net/video/761955) 824th Pays Respects to Military Working Dog — Senior Airman Hayden Legg (824th Base Defense Group, Air Combat Command 공보), 2020.7.20, 미국 조지아주 밸도스타(무디 공군기지). 원본 43.25–44.5(그림만), 1.6–8.6, 15.95–26.3, 28.45–42.3, 42.95–48.1초.
- dog3 — [811932](https://www.dvidshub.net/video/811932) Camp Bondsteel Bite Suit Training (B-roll) — Sgt. Gillian McCreedy(미 육군), 2021.8.28, 코소보 캠프 본드스틸. 원본 32–36.5, 12.5–17.5, 37.3–40.6, 46.5–54, 99.6–107.6초.

**사실 출처**
- dog1: DVIDS 976540 설명 — “Military working dogs assigned to 509th Security Forces Squadron perform water aggression training at a community pool in Sedalia, Missouri, Sept. 2, 2025. The training helped acclimate MWDs to an atypical environment and enhanced their capability to apprehend a target in water.”
- dog2: DVIDS 761955 설명 — “The 824th BDG paid tribute to Rudo, a medically-retired military working dog, during a ceremony that honored his life, service and sacrifice to the U.S. Air Force.” 수색 1만 회 이상, 비밀경호국 임무 15회, 대통령 지원 임무 6회, 마지막 핸들러가 집에 데려가려 함, 2020년 4월 암 진단은 같은 영상 속 내레이션이 직접 한 말입니다. 같은 행사를 다룬 미 공군 기사 [824th BDS honors retired MWD (moody.af.mil)](https://www.moody.af.mil/News/Article-Display/Article/2278729/824th-bds-honors-retired-mwd/)는 403으로 원문을 열지 못했습니다. 검색 요약으로는 2020.7.15 행사와 약 5년 복무가 나와서, 이 날짜와 숫자는 쓰지 않았습니다. 루도의 이후 소식(사망 여부 등)은 확인된 출처가 없어 말하지 않았습니다.
- dog3: DVIDS 811932 설명 — “U.S. Army Col. Brey Hopkins, Commander of KFOR Regional Command-East, dons a bite suit to provide Military Working Dogs (MWD) with another opportunity for ongoing bite suit training. This training ensures that MWDs can assist military police and apprehend suspects using non-lethal force.”

**라이선스**: 미군 장병·국방부 직원이 직무로 만든 영상은 미국 연방정부 저작물로 퍼블릭 도메인입니다(17 U.S.C. §105, DVIDS 저작권 안내 https://www.dvidshub.net/about/copyright). 화면에는 “영상: 미 공군 (DVIDS)”·“영상: 미 육군 (DVIDS)”만 적었습니다. 미군·국방부가 이 영상을 보증하거나 후원한다는 인상을 주면 안 됩니다. 음악은 Kevin MacLeod(incompetech.com) CC BY 4.0입니다: dog1 “Hustle”, dog2 “Floating Cities”, dog3 “Sneaky Snitch”. 효과음은 `public/sfx`(whoosh, ding, boing)입니다.

**dog1** — 물로 도망치면 군견도 못 따라올까? 🐕💦
> 수영장으로 도망치면 군견을 따돌릴 수 있을까요? 미 공군 제509보안경찰대대 군견들이 2025년 9월 미국 미주리주의 한 공공 수영장에서 ‘수중 제압 훈련’을 했습니다. 낯선 환경에 익숙해지고 물속에서도 대상을 붙잡는 능력을 키우는 훈련이라고 합니다. 결론: 물도 안전지대가 아닙니다.
> 영상: 미 공군 (DVIDS, Senior Airman Bryce Moore). 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군견 #군대 #미공군 #강아지 #shorts

**dog2** — 암 진단받은 군견을 위해 전우들이 준비한 경례
> 미 공군 제824기지방어단의 군견 루도. 공식 수색만 1만 번 넘게 했고, 비밀경호국 임무 15번, 대통령 지원 임무 6번을 수행했습니다. 마지막 핸들러는 루도를 집에 데려가 가족이 되어 주고 싶어 했지만, 루도는 2020년 4월 암 진단을 받았고, 부대는 루도의 복무에 감사하는 자리를 마련했습니다. 장병들이 줄지어 경례하며 루도를 맞았습니다. 영상 속 목소리를 직접 번역했습니다.
> 영상: 미 공군 (DVIDS, Senior Airman Hayden Legg). 원본의 배경음악은 지웠습니다. 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군견 #감동 #실화 #미공군 #shorts

**dog3** — 군견 훈련 미끼가 된 대령님의 최후 😂
> 2021년 8월 코소보 캠프 본드스틸. 코소보 평화유지군(KFOR) 동부지역사령관인 미 육군 대령이 직접 방어복을 입고 군견 훈련의 미끼가 됐습니다. 군견에게 냄새를 맡게 해 주고, 투구까지 쓰고 달렸지만… 계급장은 군견에게 통하지 않습니다.
> 영상: 미 육군 (DVIDS, Sgt. Gillian McCreedy). 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군견 #군대 #대령 #미군 #shorts


**dog4·dog5 추가 메모**
- dog4: 원본(B-roll)은 헬기·바다 현장음만 있습니다(AST Music 점수 0.01, 말소리 없음). 그래서 자막은 모두 화면 설명입니다. 사실 자막(“해안경비대 군견 심바”, “배에 빠르게 투입하는 훈련”)은 DVIDS 설명(“U.S. Coast Guard K9 Simba from Maritime Safety and Security Team Houston, conducts a hoist … These practice hoists are done to prepare the K9 and their handler for rapid deployments to vessels out on the water.”)에 근거합니다. 마지막 “출근은 헬기로 합니다”는 재치 자막입니다. 후보였던 427728(해병대 CH-53E 패스트로프, 군견 Bobo)은 음악이 깔린 제작 영상이고 화면이 어두워서 쓰지 않았습니다.
- dog5: 원본은 현장음 B-roll입니다(Music 0.00–0.03). 전역 증서 낭독(원본 51.0–70.3초, `media/dogs/max_certificate.wav`)을 같은 행사의 다른 장면(낭독자, 군견들) 밑에 목소리로 깔았습니다. 그 구간의 장면 소리는 껐습니다. 첫 장면과 마지막 장면은 현장음 그대로입니다. 증서 문장은 faster-whisper small.en·medium.en이 똑같이 들은 부분만 번역했습니다(“For they are credited with saving countless lives of deployed soldiers and personnel in dangerous combat areas, to keeping thousands of personnel, families, and communities safe. These MWDs are truly remarkable and most deserving of retiring to wonderful families eager to share their loving homes.”). 서명 부분(“Signed, Clinton W. Cox, Colonel …”)은 넣지 않았습니다.
- dog5 이름: DVIDS 설명에는 “Max, a 10-year veteran Belgian Malinois, and Grisha”만 있고 어느 개가 맥스인지는 없습니다. 그래서 화면의 개를 이름으로 가리키지 않았습니다. 첫 자막만 “군견 맥스와 그리샤의 전역식”이고, 제목의 “10년 복무한 군견”은 맥스를 뜻합니다. “4년”은 설명 문장에서 누구에 대한 것인지 애매해서 쓰지 않았습니다.
- dog5 크레디트: Shantika Ogletree(포트 베닝 공보실, 계급 표기 없음 = 국방부 민간 직원). DVIDS 페이지에 PUBLIC DOMAIN 표시가 있습니다.

**영상 출처 (dog4·dog5)**
- dog4 — [849910](https://www.dvidshub.net/video/849910) Coast Guard conducts K9 hoist training in Galveston, Texas — Petty Officer 3rd Class Alejandro Rivera, 미 해안경비대 MSST Houston, 2022.6.18, 미국 텍사스주 갤버스턴. 원본 2.4–10, 11.5–18, 18–22.5, 23–24.6초.
- dog5 — [705767](https://www.dvidshub.net/video/705767) Military Working Dog Retirement Ceremony BRoll — Shantika Ogletree, 904th Military Working Dog Police Detachment, 2019.3.22, 미국 조지아주 포트 베닝 군견 추모비(War Dog Memorial). 원본 23–27.6, 54–57, 46.2–51.2, 2–7, 76–82.3, 94–99.5초(그림), 51.0–70.3초(목소리).

**dog4** — 헬기에서 내려온 군견의 출근길 🚁🐕
> 미 해안경비대 군견 심바가 핸들러와 함께 헬기에서 바다 위 배로 내려옵니다. 2022년 6월 미국 텍사스주 갤버스턴에서 한 호이스트 훈련이고, 물 위의 선박에 군견과 핸들러를 빠르게 투입하려고 연습한다고 합니다. 출근길이 헬기인 강아지.
> 영상: 미 해안경비대 (DVIDS, Petty Officer 3rd Class Alejandro Rivera). 미 해안경비대·국토안보부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Exhilarate" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군견 #헬기 #해안경비대 #강아지 #shorts

**dog5** — 10년 복무한 군견의 전역식 날 생긴 일
> 2019년 3월 미국 포트 베닝 군견 추모비 앞에서 열린 군견 맥스와 그리샤의 전역식. 맥스는 10년 차 베테랑입니다. 낭독된 전역 증서: “이 군견들은 위험한 전투 지역에서 수많은 장병의 목숨을 구했고 수천 명의 장병과 가족, 지역사회를 지켰습니다. 사랑 가득한 새 가족 품에서 은퇴할 자격이 충분합니다.” 두 군견은 전역해 새 가족과 함께 살게 됩니다.
> 영상: 미 육군 포트 베닝 (DVIDS, Shantika Ogletree). 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군견 #전역 #감동 #미군 #shorts

## 동물 랭킹 쇼츠 (`politics/anirank1`, `politics/anirank2`)

10만 이상 오락 쇼츠 중 중앙값이 가장 높은 「역대급 ○○ 랭킹 TOP5」형(`research/research-fun.md`)을 실제 동물 영상으로 만든 두 편입니다. 내레이션·AI 목소리·그래픽 없이 **원본 소리 + 가벼운 음악 + 한 줄 자막**만 씁니다. 순위는 우리가 고른 것이고 공식 순위가 아닙니다. 1위가 끝나면 바로 영상 처음(5위)으로 이어져 반복 재생됩니다(`"tail": 0`).

| id | 제목(화면) | 길이 | 5위 → 1위 | 음악 |
| --- | --- | --- | --- | --- |
| `anirank1` | 역대급 귀여운 아기동물 / TOP5 (다들 몇 번?ㅋㅋ) | 37.0초 | 졸다가 철퍼덕 아기 바이슨 · 얼음! 꼬마 청설모 · 엄마 옆 꿀잠 아기 코끼리물범 · 카메라 쳐다보는 아기 물개 · 모래에 얼굴 박은 아기 바다사자 | Monkeys Spinning Monkeys |
| `anirank2` | 역대급 웃긴 물범 모먼트 / TOP5 (다들 몇 번?ㅋㅋ) | 35.8초 | 바나나 자세 물범 · 모래 범벅 몽크물범 · 코끼리 코 수컷 · 눈 마주친 코끼리물범 · 카메라 코앞에서 입 쩍 몽크물범 | Hyperfun |

```bash
MEDIA=$PWD/media python3 politics/prep_split.py anirank1     # 원본 발췌: media/anirank/*.mp4 (+ 출처 .json)
./render.sh anirank1 final/anirank1.mp4
```

- 레이아웃: `"titleStyle": "band"`(검정 띠 2줄 제목, `[TOP5]`만 노랑), 정사각 화면에 동물이 크게 오도록 `single` 크롭, 자막은 화면 아래쪽 위(`"captionY": 1380`), 그 아래 순위표(구간마다 `"rank"`). 순위마다 흰 번쩍임으로 컷이 바뀝니다. 아기 물개 장면은 원본이 어두워 `vf`로 밝기만 올렸습니다.
- 자막은 각 장면을 사실대로 묘사하고, 사실 정보는 아래 출처에 있는 것만 넣었습니다. “뭘 봐”, “얼음!” 같은 말은 장면에 붙인 농담입니다. 바다사자 1위의 두 컷(앉아 있는 장면, 엎어지는 장면)은 같은 원본에서 20초쯤 떨어진 같은 새끼의 장면입니다.

**영상 (모두 미국 연방기관이 직접 만든 퍼블릭 도메인 영상, 17 U.S.C. §105)** — 원본 발췌와 출처·파일 주소·크레딧·사용 구간은 `media/anirank/*.json`
- 아기 바이슨: [Bison Calf](https://www.nps.gov/media/video/view.htm?id=7C9B301A-C879-4F27-BD03-820EFEEE2063) — NPS/Neal Herbert, 옐로스톤 라마 밸리, 2014.5.17 (페이지에 “Copyright Info: Public domain”)
- 꼬마 청설모: [Mountain Moment: Scurry of Douglas Squirrels](https://www.nps.gov/media/video/view.htm?id=A3DE415A-76D8-4567-8E54-4B32ED747FCB) — NPS, 레이니어산 국립공원 (원본 앞의 NPS 로고 화면은 쓰지 않음)
- 코끼리물범(아기·수컷·털갈이): [B-Roll: Elephant Seals on the Channel Islands](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seals-and-sea-lions/video/897627749001/b-roll:-elephant-seals-on-the-channel-islands) — NOAA Fisheries
- 아기 물개: [B-Roll: Northern Fur Seals on the Pribilof Islands](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seals-and-sea-lions/video/897639164001/b-roll:-northern-fur-seals-on-the-pribilof-islands) — NOAA Fisheries
- 아기 바다사자: [B-Roll: California Sea Lions](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seals-and-sea-lions/video/4084857759001/b-roll:-california-sea-lions) — NOAA Fisheries
- 잔점박이물범: [B-Roll: Harbor Seals on the Pacific Coast](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seals-and-sea-lions/video/4419966618001/b:roll:-harbor-seals-on-the-pacific-coast) — NOAA Fisheries (촬영 John D. Brooks / NOAA)
- 하와이몽크물범: [B-Roll: Hawaiian Monk Seal](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seals-and-sea-lions/video/5352712499001/b-roll:-hawaiian-monk-seal) — NOAA Fisheries (NMFS ESA/MMPA 허가 #16632, #13707 하에 촬영)
- NOAA 영상 갤러리의 원본 타이틀 카드: “All footage courtesy of the National Oceanic and Atmospheric Administration (NOAA), a federal agency of the U.S. Department of Commerce. Please credit ‘NOAA Fisheries’”. NPS·NOAA가 이 영상을 보증하거나 후원하지 않으며, 두 기관의 로고는 쓰지 않았습니다. 화면에는 “영상: 미국 국립공원관리청(NPS)”, “영상: 미국 해양대기청(NOAA)”만 적었습니다.
- 음악: "Monkeys Spinning Monkeys", "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0

**자막 속 사실과 출처**
- 바이슨 새끼는 4월 말~5월에 태어나고 갓 태어나면 붉은 황갈색 — [NPS Yellowstone: Bison](https://www.nps.gov/yell/learn/nature/bison.htm) (영상 촬영일 5월 17일 → “올봄에 태어난”)
- 이 영상은 등산객을 수상하게 여기는 어린 더글러스청설모 — 위 NPS 영상 설명(“This curious young Douglas squirrel wasn't sure about passing hikers”)
- 북방코끼리물범 새끼는 젖을 뗄 때까지 검은색 / 다 자란 수컷의 큰 코는 번식기에 서로 위협할 때 소리를 울리는 데 쓰임 / 털갈이 때 털과 함께 커다란 피부 조각이 벗겨짐 — [NOAA: Northern Elephant Seal](https://www.fisheries.noaa.gov/species/northern-elephant-seal) (털갈이 장면은 원본 카드 “Molting Elephant Seals, San Nicholas Island”)
- 북방물개 새끼는 생후 약 3개월에 털갈이하기 전까지 검은색, 이후 은회색 — [NOAA: Northern Fur Seal](https://www.fisheries.noaa.gov/species/northern-fur-seal)
- 원본 설명 “California sea lions and pups” — [NOAA: California Sea Lion](https://www.fisheries.noaa.gov/species/california-sea-lion)(새끼는 태어날 때 짙은 갈색)
- 잔점박이물범은 머리와 뒷지느러미를 든 ‘바나나 같은’ 자세로 쉼 — [NOAA: Harbor Seal](https://www.fisheries.noaa.gov/species/harbor-seal)
- 하와이몽크물범은 멸종위기종, 개체 수 약 1,600마리 — [NOAA: Hawaiian Monk Seal](https://www.fisheries.noaa.gov/species/hawaiian-monk-seal)
- 몽크물범 1위 장면은 “입을 크게 벌린” 것만 적었습니다(하품인지 소리를 내는지는 영상만으로 알 수 없어 단정하지 않음).

**anirank1** — 역대급 귀여운 아기동물 TOP5 (다들 몇 번?ㅋㅋ)
> 졸다가 철퍼덕 눕는 아기 바이슨부터 모래에 얼굴 박은 아기 바다사자까지, 실제 야생 아기동물 영상으로 뽑은 귀여움 TOP5! 여러분의 원픽은 몇 번인가요? 순위는 저희 마음대로 고른 것입니다😆
> 영상: 미국 국립공원관리청(NPS) — Neal Herbert(옐로스톤), 레이니어산 국립공원 · 미국 해양대기청(NOAA Fisheries) (NPS·NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #아기동물 #귀여운동물 #동물 #랭킹 #shorts

**anirank2** — 역대급 웃긴 물범 모먼트 TOP5 (다들 몇 번?ㅋㅋ)
> 바나나 자세로 쉬는 물범, 모래 범벅 몽크물범, 코끼리 코 수컷, 털갈이 중 눈 마주친 코끼리물범, 카메라 코앞에서 입 쩍 벌린 하와이몽크물범(전 세계 약 1,600마리뿐인 멸종위기종)까지! 다들 몇 번이 제일 웃겨요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 해양대기청(NOAA Fisheries) (NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #물범 #바다사자 #웃긴동물 #동물 #shorts


## 고통 훈련 리액션 쇼츠 (`politics/ouch1`~`ouch3`)

미군이 테이저건·후추 스프레이(OC)를 **직접 맞아 보는** 자격 훈련 장면입니다. 기계가 아니라 사람(표정·비명·전우의 반응)이 주인공이고, 원본 현장음을 그대로 살렸습니다. 내레이션·음악 없음. 자막은 실제로 들리는 말의 번역(한국어 + 작은 영어 원문)과, 화면에 보이는 사실만 적은 짧은 한 줄(영어 없음)입니다.

| id | 제목 | 길이 | 영상 |
| --- | --- | --- | --- |
| `ouch1` | 테이저건 맞기 1초 전 / 미 공군의 표정 ⚡ | 16.9초 | 웃던 공군 → “테이저! 테이저! 테이저!” → 비명, 넷이 팔짱 끼고 동시에, 양옆 전우가 붙잡아 주는 장면 |
| `ouch2` | 후추 스프레이 맞고 / 바로 해야 하는 일 🌶️ | 29.5초 | “심호흡하고, 눈 감고, 대기. OC! OC! OC! 눈 떠, 가자!” → 눈 못 뜬 채 코스(제압·수갑) → 세안 |
| `ouch3` | 후추 스프레이 맞고 나서 / 웃으며 한 한마디 😂 | 15.9초 | 세안 → 대형 선풍기 → “진짜 최악이야, 최악.” → 웃으며 “야, 내 얼굴에 아직 (삐-) 묻어 있어?” |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py ouch1    # 원본: media/ouch/ (파일마다 .json에 DVIDS ID·페이지·파일 주소·크레디트·부대·날짜·쓴 구간)
./render.sh ouch1 final/ouch1.mp4
```

**영상** (모두 DVIDS B-roll, 현장음만 있고 음악 없음. 페이지에 개별 제한(Restrictions)·Courtesy 표시 없음, 미군이 직무로 촬영한 연방정부 저작물 → 퍼블릭 도메인)
- `ouch1` — [844913](https://www.dvidshub.net/video/844913) CEW Training with Security Forces (BROLL) — U.S. Air Force video by Senior Airman Gary Hilton, 18th Security Forces Squadron(18th Wing), 일본 가데나 공군기지, 2022.5.17. 원본 64.0–67.6, 69.6–75.8, 76.6–79.2, 80.5–84.95초.
- `ouch2` — [961560](https://www.dvidshub.net/video/961560) 22nd MEU | Non-Lethal Weapons Course Day 2 — U.S. Marine Corps video by Cpl. Maurion Moore, 22nd Marine Expeditionary Unit, 미 노스캐롤라이나 스톤베이 해병기지, 2025.4.29. 원본 141.8–143.4(첫 화면, 뒤에 다시 나옴), 130.3–138.3, 139.4–145.5, 145.5–152.0, 201.0–205.6, 216.0–218.6초. 마지막 두 장면은 다른 해병이라 자막도 “다음 해병도”로 적었습니다.
- `ouch3` — [1008601](https://www.dvidshub.net/video/1008601) Security Forces OC spray — U.S. Air National Guard video by Airman 1st Class Taylor Warehime, 121st Security Forces Squadron(오하이오 주방위군), 릭켄배커 주방위군 기지, 2026.3.8. 원본 177.3–180.5, 185.5–190.5, 193.5–196.4, 196.8–201.6초. 원본은 4K 60p라 1080p 30p로 줄여 잘랐고, 마지막 대사의 욕설 한 단어(“shit”, 원본 199.58–199.80초)는 소리를 삐 처리하고 자막은 “(삐-)”로 적었습니다.

**사실·자막**
- 훈련 성격은 DVIDS 설명 그대로입니다: 844913 “conducted energy weapons qualification training … exposure to CEW discharge”, 961560 “non-lethal weapons course”, 1008601 “exercises involving the taser, oleoresin capsicum spray, PepperBall”. 이름·계급·사연은 쓰지 않았습니다.
- 대사는 faster-whisper small.en과 large-v3 두 모델이 같은 말을 들은 것만 넣었습니다. 1008601의 189–192초(“I don't feel my eyes”/“I don't pull my eyes”로 엇갈림), 185초(“take it for a walk”)는 넣지 않았습니다. 844913의 첫 묶음 뒤 “Got a bam …”, “That's a problem”도 불확실해서 뺐습니다.
- “테이저! 테이저! 테이저!”는 쏘기 직전의 경고 구호(“Taser, taser, taser”), “OC! OC! OC!”는 스프레이를 뿌리며 외치는 구호입니다(화면의 분사 순간과 소리가 일치).
- 보이는 것만 적은 줄: “4명이 팔짱 끼고 동시에”, “양옆 전우가 꽉 붙잡아 주는 이유”(붙잡힌 채 무너지는 장면), “다음 코스: 선풍기 앞”, “후추 스프레이 맞고 세안 중”. ouch3의 세안·선풍기·마지막 대사는 같은 훈련의 다른 사람들일 수 있어 한 사람의 이야기로 묶지 않았습니다(“진짜 최악이야”는 화면 밖 목소리).
- 사람을 놀리지 않고 상황만 웃음 포인트로 썼습니다. 다친 장면은 없습니다. OC 착색제가 피처럼 보이는 장면(961560의 손 213–215초, 918493의 붉은 얼굴)은 오해를 살 수 있어 쓰지 않았습니다.
- 라우드니스: ouch1 −14.5, ouch2 −15.1, ouch3 −14.3 LUFS. 미 공군·해병대·국방부가 이 영상을 보증하거나 후원하는 것처럼 보이면 안 됩니다.

**업로드 문구**

**ouch1** — 테이저건 맞기 1초 전, 미 공군의 표정 ⚡
> 미 공군 보안군은 테이저건 자격을 따려면 직접 맞아 봐야 합니다. “테이저! 테이저! 테이저!” 경고 구호 1초 뒤, 웃던 얼굴이… 양옆 전우들은 팔을 꽉 붙잡아 줍니다. 2022년 일본 가데나 공군기지 실제 훈련 영상.
> 영상: 미 공군 (DVIDS) — U.S. Air Force video by Senior Airman Gary Hilton, 18th Wing. 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #테이저건 #미공군 #군대 #훈련 #shorts

**ouch2** — 후추 스프레이 맞고 바로 해야 하는 일 🌶️
> “심호흡하고, 눈 감고, 대기.” 얼굴에 후추 스프레이(OC)를 맞고 나면 끝이 아니라 시작입니다. 눈도 못 뜬 채 상대를 제압하고 수갑까지 채워야 하는 미 해병대 비살상무기 과정. 2025년 노스캐롤라이나 실제 훈련 영상.
> 영상: 미 해병대 (DVIDS) — U.S. Marine Corps video by Cpl. Maurion Moore, 22nd MEU. 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #후추스프레이 #미해병대 #군대 #훈련 #shorts

**ouch3** — 후추 스프레이 맞고 나서 웃으며 한 한마디 😂
> 후추 스프레이 훈련이 끝난 뒤: 물로 씻고, 대형 선풍기 앞에 엎드리고… “진짜 최악이야.” 그리고 웃으며 한 한마디. 2026년 미 오하이오 주방위군 보안군 실제 훈련 영상(욕설 한 단어 삐 처리).
> 영상: 미 공군 주방위군 (DVIDS) — U.S. Air National Guard video by Airman 1st Class Taylor Warehime, 121st Air Refueling Wing. 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #후추스프레이 #미공군 #군대 #훈련 #shorts

### 이어서: 얼음물·레펠 (`politics/ouch4`, `politics/ouch5`)

| id | 제목 | 길이 | 영상 |
| --- | --- | --- | --- |
| `ouch4` | 얼음 구멍에 뛰어든 / 미군의 표정 🥶 | 24.6초 | 얼음 구멍 속 얼굴 → “발 꼬지 마” “신의 가호를, 젊은이” → “준비됐으면, 실시” 입수 → “크게 내쉬어, 호흡 조절해” → 얼음송곳으로 기어 나옴 “A1이지!” |
| `ouch5` | 레펠 타워 끝에 선 훈련병 / 교관의 한마디 🪢 | 21.1초 | 타워 끝 훈련병과 모자 쓴 교관 → “이쪽으로 오지 마라.” → “세 번 통통 뛰어 봐” → “이제 벽 차고 뛰어내려.” → 하강 |

**영상** (DVIDS B-roll, 현장음만, 음악 없음, 페이지에 개별 제한·Courtesy 표시 없음, 국방부 민간인 직원이 직무로 촬영 → 퍼블릭 도메인)
- `ouch4` — [821976](https://www.dvidshub.net/video/821976) Cold water immersion training during Cold Weather Operations Course class 21-02 — U.S. Army video by Cedar Wolf(Fort McCoy Multimedia Visual Information), 미 위스콘신 포트 매코이, 2021.1.15. 원본 228.0–229.8, 248.0–252.7, 216.0–222.5, 24.2–29.6, 229.8–231.4, 235.5–239.45초. 설명: “U.S. Soldiers and Marines complete cold water immersion training”.
- `ouch5` — [1018603](https://www.dvidshub.net/video/1018603) Echo Company, 2nd Battalion, 58th Infantry Regiment, 198th Infantry Brigade, Eagle Rappel Tower Training — Basil Lee, Fort Benning Public Affairs Office, 미 조지아 포트 베닝, 2026.8.6. 원본 137.6–158.0초(4K 60p → 1080p 30p로 잘라 씀, 끝의 인터뷰는 안 씀). 설명: 신병 기초훈련(initial entry training) 중 “Eagle Confidence Tower” 레펠 훈련. `"flash": false`로 흰 번쩍임 없이 이었습니다.

**자막**
- 대사는 faster-whisper small.en·large-v3(일부 medium.en)가 같은 말을 들은 것만 넣었습니다. ouch4에서 물속 병사와 나눈 잡담(“2학년이라 2년 반…”)과 썰매 장면의 “How was it?”(다른 장면)은 쓰지 않았고, ouch5의 “Go ahead and take a step”(large-v3만 들음)과 “Lane … rappel”도 뺐습니다.
- ouch4는 같은 훈련의 여러 사람(육군·해병)이 번갈아 나옵니다. 자막은 한 사람의 이야기로 묶지 않았습니다. “A1이지!”(“A1, baby!”)는 누가 한 말인지 화면으로 확인되지 않아 말한 사람을 적지 않았습니다.
- 보이는 것만 적은 줄: “얼음 깨고 만든 구멍 속”, “나올 땐 얼음송곳으로 찍고”(주황 손잡이 송곳으로 얼음을 찍고 나옴), “옆에 모자 쓴 분이 교관”(드릴 서전트 모자), “그리고 진짜 내려감”.
- 라우드니스: ouch4 −14.9, ouch5 −14.4 LUFS. ouch4 완성본은 30MB를 넘지 않게 CRF 22로 다시 압축했습니다(15.2MB).

**ouch4** — 얼음 구멍에 뛰어든 미군의 표정 🥶
> 얼음판을 네모나게 깨서 만든 구멍에 군복 입은 채로 뛰어듭니다. “크게 내쉬어, 호흡 조절해.” 나올 땐 얼음송곳으로 찍고 기어 나와야 합니다. 2021년 1월 미 위스콘신 포트 매코이 혹한기 작전 과정의 실제 훈련 영상.
> 영상: 미 육군 (DVIDS) — U.S. Army video by Cedar Wolf, Fort McCoy. 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #혹한기훈련 #얼음물 #미군 #군대 #shorts

**ouch5** — 레펠 타워 끝에 선 훈련병, 교관의 한마디 🪢
> 미 육군 신병들이 거치는 레펠 타워. 끝에 선 훈련병에게 교관이 한 말: “이쪽으로 오지 마라.” 그리고 “세 번 통통 뛰고, 이제 벽 차고 뛰어내려.” 2026년 8월 미 조지아 포트 베닝 실제 훈련 영상.
> 영상: 미 육군 (DVIDS) — Video by Basil Lee, Fort Benning Public Affairs. 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #레펠 #훈련병 #미육군 #군대 #shorts

## 군인 감동 실화 쇼츠 (`home1`, `home2`, `home3`)

미군이 DVIDS에 올린 실제 귀국·은퇴 영상(촬영자가 현역 군인, 페이지에 PUBLIC DOMAIN 표시, Restrictions 없음)에 빠른 한국어 내레이션(Edge TTS, `+15%`)을 얹은 1분뉴스쇼·심리야놀자 방식 쇼츠입니다. 기계가 아니라 **사람의 얼굴과 반응**이 주인공이고, 원본 현장음(본인의 말·환호·박수)을 살려 번역 자막을 붙였습니다.

| id | 제목 (띠 두 줄) | 길이 | 영상 | 음악 |
| --- | --- | --- | --- | --- |
| `home1` | 깜짝 귀국한 아빠가 / 오히려 더 놀란 이유 | 37.8초 | DVIDS 303088 (미 공군) | Heartwarming |
| `home2` | 상대 팀 70번이 / **아빠**였을 때 아들 반응 | 33.1초 | DVIDS 301936 (미 공군) | Touching Moments Two - Higher |
| `home3` | 35년 군 생활 / **마지막 비행**이 끝나자 생긴 일 | 36.5초 | DVIDS 489332 (미 육군) | Dreamer |

```bash
# 원본 컷: ../../media/home/ (파일마다 .json에 DVIDS ID·페이지·파일 주소·크레디트·부대·날짜·원본 구간)
mkdir -p public/home1/src public/home2/src public/home3/src
cp ../../media/home/bingham_*.mp4 public/home1/src/
cp ../../media/home/martel_*.mp4 public/home2/src/
cp ../../media/home/george_*.mp4 public/home3/src/
# home2만: 301936 원본 소리가 아주 작아서(경기장 컷 -43.6 LUFS) 작업 사본의 소리만 키움(화면은 그대로)
for f in public/home2/src/martel_*.mp4; do ffmpeg -y -i $f -c:v copy -af "loudnorm=I=-19:TP=-2:LRA=15,aresample=48000" -c:a aac -b:a 160k /tmp/x.mp4 && mv /tmp/x.mp4 $f; done
for id in home1 home2 home3; do python3 voice_edge.py $id && python3 prep.py $id && ./render.sh $id; done
```

- **템플릿 변경**: `prep.py`에 `edit.json`의 `"subs"`를 넣었습니다. 내레이션 사이 원본 대사(`moments`) 구간에 번역 자막 한 장을 놓습니다: `{"from": "hug@end+0.6", "to": "hug@end+3.85", "ko": "… [노랑]", "en": "원문"}`. 모양은 `prep_split.py` 번역 자막과 같습니다(한국어 위, 영어 아래). 대사 구간은 다음 줄의 `gap`을 대사 길이만큼 벌려서 만듭니다. `fetch.sh`가 위 음악 세 곡도 받습니다.
- **모양**: `"titleStyle": "band"`(검정 띠 두 줄 제목), 정사각 화면에 `crop`으로 얼굴을 크게, 자막은 화면 아래(`"captionY": 1600`). 첫 프레임은 가장 강한 얼굴(home1 포옹, home2 우는 아들, home3 물세례)이고, 끝은 환호(home1)·포옹(home2)·본인의 마지막 말(home3)에서 바로 끊습니다.
- **원본 소리**: 303088은 기자 내레이션 영상이라 원본 27–40초, 54–76초에 음악이 깔려 있습니다(AudioSet AST 모델로 확인). 그 구간은 **소리를 끄고** 화면만 썼고, 빙엄 소령의 말(78–85초)과 복도 환호(96–101초)만 살렸습니다. 301936·489332는 현장음만 있는 B-roll입니다(음악 없음).
- **자막 = 실제 말**: 원문은 faster-whisper medium.en으로 받아 적고, 완성본을 small.en으로 다시 받아 적어 자막 시간과 맞는지 확인했습니다.
- **쓰지 않은 것**: DVIDS 746401 「Deployed mom surprises kids with early return」은 좋은 장면이지만 크레디트(Jo Anita Miley, Jonathan Stinson, Redstone Arsenal)가 국방부 공무원인지 신문(Redstone Rocket) 외주 인력인지 확인하지 못해서 뺐습니다. 846785(AFMC 사령관 Fini Flight)는 마스크로 얼굴이 가려 뺐습니다.

### 사실과 출처
모든 사실은 DVIDS 영상 설명, 영상 첫 화면의 공식 슬레이트, 영상 속 본인·동료의 말에서만 가져왔습니다. 이름은 원문 그대로 썼습니다.

**home1** — [DVIDS 303088 「Coming Home」](https://www.dvidshub.net/video/303088/coming-home), SrA Kristen Coager, 27th Special Operations Wing, Cannon AFB, N.M., 2013-10-08
- 로버트 빙엄 소령(Maj. Robert Bingham), MC-130J 조종사, 522nd Special Operations Squadron (설명·자막 이름표). 화면에서는 “미 공군 수송기 조종사”로만 말함.
- 아프가니스탄 넉 달 파병(“deployed for four months to Afghanistan”, 영상 내레이션 0:10)
- 아내 Elssy가 학교 교장과 조회를 계획해 아이들을 놀래 줌(설명), 아이들 Isabella·Zach, 4살·8살(영상 내레이션 0:23–0:34)
- 학교 전체가 성조기를 들고 복도에 늘어섬(화면)
- 빙엄 소령의 말(원본 1:18–1:25): “I thought it was just going to be me going into their classrooms and surprising them, and in the end I think I'm the one that got the big surprise.”

**home2** — [DVIDS 301936 「Deployed Airman Returns Home to Surprise Son」](https://www.dvidshub.net/video/301936/deployed-airman-returns-home-surprise-son), MSgt Gustavo Castillo (슬레이트: SSgt Robbie Arp), 52nd Fighter Wing Public Affairs, Spangdahlem AB, 2013-09-21
- 조셉 마텔 상사(MSgt Joseph Martel), 480th Expeditionary Aircraft Maintenance Unit, 아프가니스탄 칸다하르 파병 후 귀국(설명·슬레이트)
- 아내가 깜짝 귀국을 함께 계획, 아들 Justin은 전혀 몰랐음, 비행기에서 내려 아내와 만난 **직후** 벨기에 브뤼셀의 아들 고교 미식축구 경기로 감(슬레이트 원문 “completely unaware”, “Immediately after exiting the plane and reuniting with his wife”)
- 마텔 상사의 말(원본 1:14–1:19): “My wife's standing right there, we're gonna go see my son play some football in Brussels.”
- **70번 = 아빠**: 설명에는 없고 **화면으로 판단**했습니다. 동전 던지기에 나온 빨간(상대 팀, 홈 팀) 70번이 흰 BITBURG 51번 선수를 안고, 51번이 울음을 터뜨립니다. 70번의 얼굴(원본 3:58–4:05)이 비행장에서 내린 마텔 상사(1:14–1:17)와 같은 사람이고, 경기 뒤 같은 사람이 51번 옆에 섭니다(4:50). 그래서 “상대 팀 유니폼을 입고 나왔다”는 화면에 보이는 그대로만 말하고, 일부러 변장했다거나 51번이 Justin이라는 이름은 말하지 않았습니다(“아들”로만).

**home3** — [DVIDS 489332 「CW5 George retires after 35 years」](https://www.dvidshub.net/video/489332/cw5-george-retires-after-35-years), SFC Eliodoro Molina, U.S. Forces Afghanistan, 2016-10-26
- 폴 조지 준위(CW5 Paul George), 아프가니스탄 바그람 비행장에서 35년 군 생활의 마지막 비행(설명), 2016년 10월 22일(원본 1:43 감사문 “final flight, 22 October 2016”)
- 전통: 먼저 비행기가 물을 맞고, 그다음 조종사(설명 “spraying down the aircraft after the last flight and then soaking down the pilot”, 슬레이트 “first their aircraft gets soaked, then they do”)
- 감사문(원본 1:47–1:52): “…Army aviation excellence during your 35-year career is greatly appreciated.”
- 본인 인터뷰(원본 3:28–3:33, 4:25–4:26): “…this send-off here in Afghanistan, I couldn't hope for better.” / “It's been an honor to serve.”

### 업로드 문구

**home1** — 깜짝 귀국한 아빠가 오히려 더 놀란 이유
> 아프가니스탄 파병 넉 달 만에 돌아온 미 공군 조종사 빙엄 소령. 교실에 몰래 들어가 남매만 놀래 줄 생각이었는데, 복도에는 학교 전체가 성조기를 들고 기다리고 있었습니다. “결국 제일 크게 놀란 건 저였던 것 같아요.” (2013년 10월, 미국 뉴멕시코주 클로비스)
> 영상: 미 공군 (DVIDS 303088, SrA Kristen Coager, 27th Special Operations Wing). 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군인 #깜짝귀국 #감동 #미공군 #shorts

**home2** — 상대팀 70번이 아빠였을 때 아들 반응
> 아프가니스탄 칸다하르 파병을 마치고 돌아온 미 공군 마텔 상사. 비행기에서 내려 아내와 포옹하자마자 아들의 고교 미식축구 경기장으로 향했습니다. 아들은 아빠가 돌아온 걸 전혀 몰랐고, 경기 전 동전 던지기에 상대 팀 70번 유니폼을 입은 사람이 걸어 나왔습니다. (2013년 9월, 벨기에 브뤼셀)
> 영상: 미 공군 (DVIDS 301936, MSgt Gustavo Castillo / SSgt Robbie Arp, 52nd Fighter Wing). 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Touching Moments Two - Higher" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군인 #깜짝귀국 #미식축구 #감동실화 #shorts

**home3** — 35년 군 생활 마지막 비행이 끝나자 생긴 일
> 미 육군 조종사 폴 조지 준위의 35년 군 생활 마지막 비행(2016년 10월, 아프가니스탄 바그람). 조종사의 마지막 비행엔 전통이 있습니다. 먼저 비행기가 물대포를 맞고, 그다음은 조종사 차례. “복무할 수 있어서 영광이었습니다.”
> 영상: 미 육군 (DVIDS 489332, SFC Eliodoro Molina, U.S. Forces Afghanistan). 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Dreamer" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군인 #전역 #마지막비행 #미육군 #shorts

### 4·5편 (`home4`, `home5`)

| id | 제목 (띠 두 줄) | 길이 | 영상 | 음악 |
| --- | --- | --- | --- | --- |
| `home4` | 시구하러 나온 해병이 / **갑자기 무릎** 꿇은 이유 | 35.6초 | DVIDS 292271 (미 해병대) | Heartwarming |
| `home5` | 한국 근무 중인 미군 이병 / **정비고에 나타난** 사람 | 38.2초 | DVIDS 293363 (미 육군) | Touching Moments Two - Higher |

```bash
mkdir -p public/home4/src public/home5/src
cp ../../media/home/mcgregor_*.mp4 public/home4/src/
cp ../../media/home/rankin_*.mp4 public/home5/src/
# home5만: 293363 인터뷰 소리가 작아서(-30.9 LUFS) 작업 사본의 소리만 키움
for f in public/home5/src/rankin_*.mp4; do ffmpeg -y -i $f -c:v copy -af "loudnorm=I=-19:TP=-2:LRA=15,aresample=48000" -c:a aac -b:a 160k /tmp/x.mp4 && mv /tmp/x.mp4 $f; done
for id in home4 home5; do python3 voice_edge.py $id && python3 prep.py $id && ./render.sh $id; done
```

- **home4 소리**: 292271은 기자 내레이션 영상이고 원본 9–17초, 63–78초에 경기장 음악이 깔려 있어서 그 구간은 쓰지 않거나 소리를 껐습니다. 청혼 순간의 관중 환호(38.5–45초)와 인터뷰(46.2–61.1초)만 원본 소리로 씁니다. 화면 뒤 광고판(구단·주류 로고)은 경기장 배경으로만 나옵니다.
- **home5 화질**: 293363 원본이 640×480(4:3 SD)이라 다른 편보다 흐립니다. 얼굴을 크게 잡아서 썼습니다.
- **쓰지 않은 것**: 789339·786107(군견 Bogi 은퇴·재회)은 DVIDS 페이지에 “Asset contains copyrighted material”이 있어 뺐습니다. 966210·826854(군견 은퇴식)는 멀리서 찍은 정적인 화면이라, 913596(병사와 반려견 재회)은 10초짜리라 뺐습니다. 451808은 순직한 핸들러 이야기라 뺐습니다.

**home4** — [DVIDS 292271 「Marine Proposes to Girlfriend」](https://www.dvidshub.net/video/292271/marine-proposes-girlfriend), CPT Isaac Lamberth (영상 끝 “Reporting for the 3rd Marine Aircraft Wing”), 2013-06-02, 샌디에이고 펫코 파크
- 메모리얼 데이 직후 샌디에이고 파드리스의 군인 감사의 밤(military appreciation night), 시구자 윌리엄 맥그리거 병장(Sgt. William McGregor), 시구 뒤 무릎 꿇고 2년 사귄 여자친구에게 청혼(설명, 영상 내레이션 0:09–0:35). 화면에서는 계급 없이 “해병대원”으로만 말함.
- 인터뷰(원본 0:46–1:01): “I was nervous for him throwing out the first pitch and either throwing it in the dirt or hitting the camerawoman standing behind him. It didn't occur to me until he dropped to his knee and it was perfect. It was absolutely perfect.” 화자의 이름은 영상에 없습니다. 목소리와 내용(“until he dropped to his knee”)으로 청혼받은 여자친구로 보고 따로 이름을 붙이지 않았습니다.

**home5** — [DVIDS 293363 「Father Surprises Son Serving in U.S. Army in the Republic of Korea」](https://www.dvidshub.net/video/293363/father-surprises-son-serving-us-army-republic-korea), SSG Junius Stone, 1st Armored Brigade Combat Team Public Affairs, 2013-06-13, 동두천 캠프 케이시
- 벤저민 랭킨 3세 이병(Pvt. Benjamin Eugene Rankin III), 2보병사단 1기갑여단 72기갑연대 1대대 D중대 전차병, 캠프 케이시(설명)
- 정비고(motor pool)에서 일하다 여단 공보실 인터뷰를 하는 줄 알았음(설명), 전역 군인인 아버지 벤저민 랭킨 주니어가 25번째 생일에 맞춰 깜짝 방문, 가족이 몇 달 동안 몰래 계획(설명)
- 아들의 말(원본 4:17–4:26): “I never expected it in my wildest dreams to be standing here in Korea, look over, and all of a sudden see my dad walking through the motor pool. It's a dream come true.” / 끝(5:35): “Get over here.”

**home4** — 시구하러 나온 해병이 갑자기 무릎 꿇은 이유
> 2013년 6월, 샌디에이고 파드리스의 군인 감사의 밤. 시구를 맡은 해병대원 윌리엄 맥그리거가 공을 던진 뒤 향한 곳은 2년 사귄 여자친구 앞이었습니다. “공을 땅에 꽂거나 카메라 기자를 맞힐까 봐 걱정했는데… 완벽했어요.”
> 영상: 미 해병대 (DVIDS 292271, CPT Isaac Lamberth, 3rd Marine Aircraft Wing). 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군인 #청혼 #프러포즈 #미해병대 #shorts

**home5** — 한국 근무 중인 미군 이병 앞에 나타난 사람
> 경기도 동두천 캠프 케이시의 전차병 랭킨 이병. 부대 인터뷰가 있는 줄 알았던 날, 정비고로 걸어 들어온 사람은 미국에서 온 아빠였습니다. 25번째 생일에 맞춰 가족이 몇 달 동안 몰래 준비한 방문. “꿈이 이뤄진 거죠.” (2013년 6월)
> 영상: 미 육군 (DVIDS 293363, SSG Junius Stone, 1st Armored Brigade Combat Team, 2nd Infantry Division). 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Touching Moments Two - Higher" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #주한미군 #깜짝방문 #아빠 #감동실화 #shorts

## 동물 랭킹 쇼츠 2 (`politics/anirank3`, `politics/anirank4`)

`anirank1`·`anirank2`와 같은 틀(검정 띠 제목, 정사각 크롭, 자막 `captionY` 1380, 순위표, 1위 뒤 처음으로 반복)입니다. 순위는 우리가 고른 것이고 공식 순위가 아닙니다.

| id | 제목(화면) | 길이 | 5위 → 1위 | 음악 |
| --- | --- | --- | --- | --- |
| `anirank3` | 역대급 웃긴 곰 모먼트 / TOP5 (다들 몇 번?ㅋㅋ) | 32.9초 | 연어 물고 표정 관리 곰 · 엄마 따라 줄 선 아기곰들 · 연어 두고 신경전 · 폭포 앞 연어 받아먹기 · 상자 부수고 올라탄 곰 | Scheming Weasel (faster version) |
| `anirank4` | 역대급 신기한 바다 동물 / TOP5 (다들 몇 번?ㅋㅋ) | 38.7초 | 갈기 휘날리는 쏠배감펭 · 납작 엎드린 전자리상어 · 부리 달린 비늘돔 · 뿔 달린 용곰치 · 눈 마주친 대왕문어 | Sneaky Snitch |

**영상 (미국 연방기관 저작물, 퍼블릭 도메인)** — 발췌와 출처·사용 구간은 `media/anirank/*.json`
- 곰(5편 모두): [Brooks Camp Bear School 101](https://www.nps.gov/media/video/view.htm?id=D3EB8991-E1A2-4A2A-9A98-2F1C45991B0E) — NPS, 카트마이 국립공원 브룩스 캠프(페이지 크레딧 “NPS”, 2019). 이 영화의 음악은 Musicbed·Shutterstock 라이선스 음악이라 **원본 소리는 모두 껐습니다**(`audio: 0`). 1위 상자 장면의 모서리 표시(카메라 뷰파인더 모양)는 원본 영상 그대로입니다. explore.org 웹캠·“Courtesy” 영상은 쓰지 않았고, 페이지가 열리지 않는 곰 목걸이 카메라 영상(“Katmai Bear Video – …”)과 “Boardwalk Bear”도 쓰지 않았습니다.
- 쏠배감펭: [B-Roll: Indo-Pacific Lionfish](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-fish-sharks/video/4088881464001/b-roll:-indo-pacific-lionfish), 전자리상어: [B-Roll: Sharks](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-fish-sharks/video/4651707268001/b-roll:-sharks)(“Angel Shark” 구간), 비늘돔·용곰치: [B-Roll: Hawkfish, Dragon Moray, and Parrotfish](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-fish-sharks/video/6039896460001/b-roll:-hawkfish-dragon-moray-and-parrotfish)(북서 하와이 제도, “Dragon Moray (Enchelycore pardalis) at Kure Atoll”), 대왕문어: [B-Roll: Octopuses on the West Coast](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-shellfish-other-invertebrates/video/4768156052001/b-roll:-octopuses-on-the-west-coast)(“Giant Pacific Octopus in Tank”) — 모두 NOAA Fisheries, 타이틀 카드 “All footage courtesy of NOAA … Please credit ‘NOAA Fisheries’”.
- 쏠배감펭·용곰치 장면은 원본이 어두워 `vf`로 밝기만 올렸습니다. NPS·NOAA가 이 영상을 보증하거나 후원하지 않으며 로고는 쓰지 않았습니다.
- 음악: "Scheming Weasel (faster version)", "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0

**자막 속 사실과 출처**
- 불곰 새끼는 보통 한 번에 1~3마리, 4마리는 가끔 — [NPS: Brown Bears](https://www.nps.gov/subjects/bears/brown-bears.htm) (“Typically a female will have a litter of one to three cubs, although litters of four occur occasionally.”) 영상 속 새끼 4마리는 화면에서 직접 셌습니다.
- 곰 장면의 나머지 자막(“입엔 연어”, “그거 내 거 아님?”, “덥석”, “상자… 올라감”)은 장면 묘사와 농담입니다. 상자가 무엇인지는 알 수 없어 “나무 상자”로만 적었습니다.
- 쏠배감펭(lionfish) 가시에 독 — NOAA 원본 구간 제목 “Removal of Venomous Spines”; 인도·태평양 원산, 대서양 침입종 — [NOAA Ocean Service: What is a lionfish?](https://oceanservice.noaa.gov/facts/lionfish-facts.html)
- 전자리상어류는 바닥에 숨어 먹이가 지나가길 기다리는 매복형 — [NOAA Fisheries: Common Angelshark](https://www.fisheries.noaa.gov/species/common-angelshark)(같은 무리 종의 설명; 원본은 종명 없이 “Angel Shark”)
- 비늘돔(parrotfish)은 부리 같은 이빨로 산호를 갉아 먹고 모래로 배설 — [NOAA Ocean Service: How does sand form?](https://oceanservice.noaa.gov/facts/sand.html)
- 문어는 심장 3개, 뇌 9개(팔마다 하나 + 중앙) — [NOAA Ocean Service, 2026.2](https://oceanservice.noaa.gov/news/feb26/undersea-creatures-valentines-day.html)

**anirank3** — 역대급 웃긴 곰 모먼트 TOP5 (다들 몇 번?ㅋㅋ)
> 연어 물고 표정 관리하는 곰, 엄마 따라 줄 선 아기곰 4마리, 연어 두고 신경전, 폭포 앞에서 연어 받아먹기, 그리고 나무 상자를 부수고 올라탄 곰까지! 알래스카 카트마이 국립공원 브룩스 캠프의 불곰들입니다. 여러분은 몇 번이 제일 웃겨요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) 카트마이 국립공원 (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Scheming Weasel (faster version)" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #곰 #불곰 #웃긴동물 #알래스카 #shorts

**anirank4** — 역대급 신기한 바다 동물 TOP5 (다들 몇 번?ㅋㅋ)
> 독가시 갈기를 휘날리는 쏠배감펭, 모래에 납작 엎드린 전자리상어, 산호를 갉아 먹고 모래를 만드는 비늘돔, 뿔 달린 용곰치, 그리고 심장 3개·뇌 9개 대왕문어까지! 다들 몇 번이 제일 신기해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 해양대기청(NOAA Fisheries) (NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #바다생물 #문어 #신기한동물 #해양생물 #shorts


## 동물 "몇가지·이유" 쇼츠 (`politics/ani1`~`ani3`)

조회수 10만 이상 동물 쇼츠(`research/research-fun.md`, 동그리 형식)를 따라 만든 세 편입니다. 동물 클립에 위트 있는 자막 한 줄씩, 내레이션 없이 원본 소리나 가벼운 음악만 깔았습니다. 영상은 모두 **미국 국립공원관리청(NPS)이 직접 찍어 공개한 영상**이고, 사실은 NPS·NOAA 페이지와 논문에서만 가져왔습니다.

| id | 제목(화면) | 길이 | 영상 |
| --- | --- | --- | --- |
| `ani1` | 주차장 점령한 이 녀석 / 코끼리물범에 대한 몇가지 | 34.0초 | 포인트레예스 국립해안 (드레이크스 비치 주차장의 수컷, 어미와 갓 태어난 새끼, 젖 뗀 새끼들) |
| `ani2` | 프레리도그가 / 뽀뽀하는 이유ㅋㅋ | 35.1초 | 브라이스캐니언 국립공원 (유타프레리도그) |
| `ani3` | 겨울잠 안 자는 토끼 친척 / 피카의 필살기ㅋㅋ | 36.6초 | 레이니어산 국립공원 (아메리카우는토끼) |

```bash
# 원본은 media/<topic>/*.mp4 (저장소에는 넣지 않음, 각 .json의 "file" 주소로 다시 받기). MEDIA 기본값이 media/
python3 politics/prep_split.py ani1 && ./render.sh ani1 final/ani1.mp4   # ani2, ani3도 같음
```

- **형식**: `"titleStyle": "band"`(검정 띠 2줄 제목, 아랫줄 노랑), `"tail": 0`(끝에 검은 화면 없이 마지막 장면에서 바로 반복), 정사각 화면에 `single` 크롭으로 동물을 크게, 자막은 화면 아래 `"captionY": 1600`, 한 장면 2~6초. 마지막 장면은 첫 장면(또는 같은 동물)으로 돌아가 반복 재생이 이어지게 했습니다.
- **템플릿 변경**: `politics/prep_split.py`에 `"flash": false`를 추가했습니다. 컷마다 들어가던 흰 번쩍임을 끄고 그냥 자릅니다(기존 쇼츠는 기본값 그대로).
- **소리**: 코끼리물범 수컷 울음·프레리도그 현장음은 원본 소리를 살렸습니다. 원본에 배경음악이 깔린 영상(Weanling Season at Drakes Beach의 'Into the Sunshine', Call of the Pika)은 음소거했습니다.
- **원본 기록**: `media/eseal/*.json`, `media/pdog/utah.json`, `media/pika/*.json`에 NPS 페이지·파일 주소·크레딧·라이선스·쓴 구간(초)을 적었습니다.
- **라이선스**: 모두 NPS 저작물입니다. 각 NPS 영상 페이지에 "Multimedia credited to NPS without any copyright symbol are public domain"이라고 적혀 있고, 저작권 표시가 없습니다. 크레딧이 개인 이름인 영상은 NPS 직원 것만 썼습니다. Carlo Arreglo는 NPS 기사에 "Interpretive ranger"로 나오고, Marjorie Cox는 NPS 모니터링 기사의 사진 크레딧("NPS / Marjorie Cox, NMFS Permit")입니다. 신분을 확인하지 못한 "NPS / Ellen Greenblatt" 영상 4개는 쓰지 않았습니다. 화면에는 "영상: 미국 국립공원관리청(NPS)"만 적었고, NPS 로고(화살촉)는 쓰지 않았습니다.
- **빼고 검토한 것**: 에버글레이즈 악어 트레일캠(화면에 자막이 박혀 있고 새끼가 잘 안 보임), 바다거북 새끼(720p라 너무 작음). Pexels·Pixabay·위키미디어 공용은 이 작업 환경에서 403·429로 막혀 확인하지 못했습니다.

**사실 출처**
- `ani1` 코끼리물범
  - 수컷 2,000~2,722kg("4400-6000 lbs"), 젖 떼기까지 30일, 어미는 굶으며 젖을 먹여 몸무게 30~40% 감소, 젖 뗀 새끼는 "overstuffed sausages affectionately called weaners", 교미 뒤 어미는 바다로 떠나고 새끼는 혼자 남음, 육지에 있는 동안 굶음 — [NPS 포인트레예스 소식지 "The Northern Elephant Seal"](https://www.nps.gov/pore/learn/upload/resourcenewsletter_elephantseals.pdf)
  - 수컷의 울음("trumpeting")은 1마일(1.6km) 넘게 들림, 약 한 달 수유 뒤 어미가 떠남 — [NPS Viewing Elephant Seals](https://www.nps.gov/pore/planyourvisit/wildlife_viewing_elephantseals.htm)
  - 수컷의 큰 코는 번식기에 다른 수컷을 위협하는 소리를 울리는 데 씀, 번식기에 굶어 몸무게 최대 36% 감소 — [NOAA Fisheries: Northern Elephant Seal](https://www.fisheries.noaa.gov/species/northern-elephant-seal)
  - 2019년 1월 방문자센터(주차장) 앞 해변을 차지("possibly shutdown inspired take-over of Drakes Beach", 1월 31일 암컷 53·새끼 52) — [NPS Elephant Seal Monitoring Season Summary 2018–2019](https://www.nps.gov/articles/elephant-seal-monitoring-season-summary-2018-2019.htm)
  - 젖 뗀 새끼가 남아서 수영을 배움 — [NPS 영상 Weanling Season at Drakes Beach 설명](https://www.nps.gov/media/video/view.htm?id=A5FB64F6-D275-4105-B6ED-664AF342297F)
  - 바다에서 하루 평균 약 2시간 수면, 육지에서는 10시간 넘게 — Kendall-Bar et al., "Brain activity of diving seals reveals short sleep cycles at depth", *Science* 380, 260–265 (2023) ([UC Santa Cruz·옥스퍼드 보도](https://www.ox.ac.uk/news/2023-04-21-elephant-seals-drift-sleep-while-diving-far-below-ocean-surface)). 연구 대상은 어른 암컷이라 자막은 "어른이 되면"으로 적었습니다.
- `ani2` 유타프레리도그
  - 10월부터 3월 말까지 겨울잠, 유타주 남서부에만 삶, 천적마다 다른 경고음과 천적 생김새를 설명하는 '문장', 망보기 — [NPS 브라이스캐니언 Utah Prairie Dog](https://www.nps.gov/brca/learn/nature/upd.htm)
  - 무리 안에서 "identifying kiss or sniff"로 서로를 알아봄 — [NPS 시어도어루스벨트 국립공원 Prairie Dogs](https://www.nps.gov/thro/learn/nature/prairie-dogs.htm) (검은꼬리프레리도그 설명이라 자막은 프레리도그 일반으로 적음)
- `ani3` 피카
  - 토끼과, 겨울잠을 자지 않음, 풀·잎을 모아 '건초더미'를 바위 밑·구멍에 저장, 눈이 덮이면 눈 밑에 굴을 파서 겨울 내내 먹음, 모으다가 간식 — [NPS 영상 A Hungry Pika 설명](https://www.nps.gov/media/video/view.htm?id=B47A5F36-69EE-40CD-A872-84EE3892C3B4)
  - "eep!" 울음, 울음소리로 다른 개체를 알아본다는 연구 — [NPS 영상 Mountain Moment: Call of the Pika 설명](https://www.nps.gov/media/video/view.htm?id=5833D73D-CDF3-4B07-A008-D668ADCD51D5)
  - "우는토끼"는 Ochotona의 우리말 이름입니다. 마지막 "그래서 이름이 우는토끼"는 이름과 울음을 이은 말장난입니다.

**ani1** — 주차장 점령한 코끼리물범에 대한 몇가지ㅋㅋ
> 2019년 미국 포인트레예스 국립해안, 코끼리물범들이 방문자센터 앞 해변과 주차장까지 차지했습니다. 수컷 코는 소리를 울리는 확성기, 엄마는 한 달 동안 굶으면서 젖만 먹이고, 그 결과 새끼는 '꽉 찬 소시지(위너)'가 됩니다. 사실은 미국 국립공원관리청(NPS)·NOAA 자료와 Science(2023) 논문 기준입니다. (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) 포인트레예스 국립해안 — Carlo Arreglo, Marjorie Cox (NMFS Permit No. 21425)
> 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #코끼리물범 #동물 #동물상식 #귀여운동물 #shorts

**ani2** — 프레리도그가 뽀뽀하는 이유ㅋㅋ
> 길 한복판에서 뽀뽀하는 프레리도그, 사실은 가족 확인 중입니다. 천적마다 다른 경고음을 내고, 10월부터 3월 말까지 겨울잠을 자는 유타프레리도그. 전 세계에서 미국 유타주 남서부에만 삽니다. 영상은 브라이스캐니언 국립공원에서 미국 국립공원관리청(NPS)이 촬영했습니다. (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) 브라이스캐니언 국립공원
> 음악: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #프레리도그 #동물 #귀여운동물 #동물상식 #shorts

**ani3** — 겨울잠 안 자는 토끼 친척, 피카의 필살기ㅋㅋ
> 햄스터 아닙니다. 토끼과 동물 '우는토끼(피카)'. 겨울잠을 자지 않는 대신 눈 오기 전에 풀과 잎을 모아 바위 밑에 '건초더미'를 쌓고, 눈이 덮이면 눈 밑에 굴을 파서 겨울 내내 꺼내 먹습니다. 영상은 레이니어산 국립공원에서 미국 국립공원관리청(NPS)이 촬영했습니다. (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) 레이니어산 국립공원
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #피카 #우는토끼 #동물 #귀여운동물 #shorts

### 동물 쇼츠 2차 (`politics/ani4`, `ani5`)

| id | 제목(화면) | 길이 | 영상 |
| --- | --- | --- | --- |
| `ani4` | 들소한테 가까이 / 가면 안 되는 이유 | 37.0초 | 옐로스톤 Video Library: Bison on Roads, Bison in Summer, Bison in Winter, Bison Calves |
| `ani5` | 사슴인데 / 비명 지르는 이유ㅋㅋ | 32.3초 | 옐로스톤 Video Library: Elk Bugling (원본 소리 = 실제 버글링) |

- 영상은 [옐로스톤 Video Library](https://www.nps.gov/yell/learn/photosmultimedia/videolibrary.htm)의 B-roll입니다. 각 페이지에 "Copyright Info: Public domain"이라고 적혀 있습니다. 파일 주소·구간은 `media/bison/*.json`, `media/elk/*.json`에 있습니다. 1280×720 파일이 가장 큰 사본이라 크롭을 1.6배 이하로 제한했습니다.
- 두 편 모두 `"tail": 0`이고, blackdetect(`crop=1080:1080:0:400,blackdetect=d=0.05:pix_th=0.06`)로 검은 화면이 없음을 확인했습니다.
- ani5는 엘크 울음(버글링)이 첫 1초부터 들리도록 원본 소리를 100%로 두고 음악을 낮췄습니다(0.3).
- 검토하고 쓰지 않은 것: [NOAA Fisheries B-Roll: Sea Otters](https://videos.fisheries.noaa.gov/detail/video/2789953172001/b-roll:-sea-otters)는 슬레이트에 "All footage courtesy of NOAA, Please credit 'NOAA Fisheries'"라고 적혀 있어 쓸 수 있습니다. 하지만 해달이 720p 화면에서 너무 작게 나와서(어미·새끼 9초 분량만 중간 크기) 이번에는 쓰지 않았습니다.

**사실 출처**
- `ani4` 들소: 수컷 최대 900kg, 최고 시속 55km, "How fast can a bison run? Faster than you.", 큰 어깨·목 근육으로 머리를 좌우로 휘둘러 눈을 치움, 혹은 근육이라 머리를 제설기처럼 쓸 수 있게 해 줌, 새끼는 태어나고 2~3시간이면 무리를 따라감 — [NPS Yellowstone: Bison](https://www.nps.gov/yell/learn/nature/bison.htm). 바이슨·엘크와는 최소 25야드(23m) — [NPS Yellowstone: Safety](https://www.nps.gov/yell/planyourvisit/safety.htm). "(그래도 아직은 아기ㅋㅋ)"는 자는 새끼 화면에 붙인 농담입니다.
- `ani5` 엘크: 짝짓기 철 9월 초~10월 중순, 수컷은 암컷에게 자기 존재와 건강을 알리고 다른 수컷에게 경고·도전하려고 버글링, 뿔은 봄에 새로 자라 한창때 하루 2/3인치(약 1.7cm), 다음 해 3~4월에 떨어짐 — [NPS Yellowstone: Elk](https://www.nps.gov/yell/learn/nature/elk.htm). 엘크는 사슴과(Cervidae) 동물입니다.

**ani4** — 들소한테 가까이 가면 안 되는 이유
> 몸무게 최대 900kg, 달리기는 시속 55km. "들소가 얼마나 빨리 달리나요?"라는 질문에 미국 국립공원관리청(NPS) 옐로스톤 공식 답변은 "Faster than you(당신보다 빠릅니다)". 겨울엔 머리를 제설기처럼 휘둘러 눈을 치우고, 새끼는 태어나고 2~3시간이면 무리를 따라다닙니다. 길에서 만나면 최소 23m, 아니면 차 안에서 구경하세요. 영상: NPS 옐로스톤 국립공원 (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) 옐로스톤 국립공원
> 음악: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #들소 #바이슨 #옐로스톤 #동물상식 #shorts

**ani5** — 사슴인데 비명 지르는 이유ㅋㅋ
> 미국 옐로스톤의 엘크 수컷은 9~10월 짝짓기 철이 되면 이런 소리(버글링)를 냅니다. 암컷에게는 "나 여기 있고 건강해", 다른 수컷에게는 "덤빌 테면 덤벼". 뿔은 봄마다 새로 자라서 한창때는 하루 약 1.7cm씩 크는데, 다음 해 3~4월이면 떨어집니다. 영상과 소리는 실제 NPS 촬영본입니다. (NPS가 이 영상을 보증하거나 후원하지 않습니다.)
> 영상: 미국 국립공원관리청(NPS) 옐로스톤 국립공원
> 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #엘크 #사슴 #옐로스톤 #동물소리 #shorts

## 공수 강하·헬로캐스트 쇼츠 (`politics/boom4`, `politics/boom5`)

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `boom4` | 비행기 문 밖으로 / 한 걸음 내딛으면 | 24.9초 | 첫 화면은 C-130 램프 끝에서 하늘로 나가는 강하자입니다. 이어서 173공수여단의 낙하산 착용(얼굴), 다른 강하의 헬멧캠으로 본 램프 걸음과 이탈, 산개, 땅에서 본 낙하산들, 착지 순서로 갑니다. |
| `boom5` | 헬기에서 바다로 / 그냥 뛰어내림 | 22.0초 | 첫 화면은 CH-53E 뒷문에서 바다로 뛰어내리는 실루엣입니다. 이어서 해변의 2수색대대 해병들(얼굴), 헬기 안, 뒷문 너머 바다, 한 명씩 뛰어내리는 장면 순서로 갑니다. |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py boom4    # boom5도 같음
./render.sh boom4 out/boom4.big.mp4 && ffmpeg -i out/boom4.big.mp4 -c:v libx264 -crf 23 -preset slow -c:a copy -movflags +faststart final/boom4.mp4   # 30MB 이하로
```

**영상** (모두 DVIDS B-Roll, PUBLIC DOMAIN, Restrictions 안내 없음)
- `boom4`:
  - [DVIDS 759457 「310TH PSYOP COMPANY AIRBORNE JUMP」](https://www.dvidshub.net/video/759457)
    - 촬영: U.S. Army Reserve video by Staff Sgt. Austin Berner. 2020.7.10, 조지아 도빈스 공군예비기지 Tyler 강하장, 공군 C-130 램프에서 강하. 헬멧캠 시점입니다.
    - 원본 파일: https://d34w7g4gy10iej.cloudfront.net/video/2007/DOD_107893851/DOD_107893851-1024x576-1769k.mp4
    - 쓴 구간(원본 초): 10.4–12.0, 5.5–16.0, 21.0–23.0, 92.0–96.2.
  - [DVIDS 956430 「B-Roll: 173rd Airborne Brigade conducts operation at Juliet drop zone」](https://www.dvidshub.net/video/956430)
    - 촬영: U.S. Army video by Sgt. Kylejian Francia. 2025.3.20, 이탈리아 아비아노, 173공수여단 1-503보병대대.
    - 원본 파일: https://d34w7g4gy10iej.cloudfront.net/video/2503/DOD_110883211/DOD_110883211.mp4
    - 쓴 구간(원본 초): 6.5–10.5(shot list "paratroopers donning their parachutes"), 32.0–34.5(공군 86공수비행단 C-130에서 강하).
  - 서로 다른 강하라서 자막에 "미 육군 173공수여단 (2025.3)", "다른 강하, 헬멧캠 시점으로"라고 구분했습니다.
- `boom5`: [DVIDS 873781 「2d Recon Helo Casting B-roll」](https://www.dvidshub.net/video/873781)
  - 촬영: Lance Cpl. Ethan R. Jones (USMC). 2023.2.14, 캠프 르준, 2해병사단 2수색대대 A중대가 CH-53E에서 헬로캐스트.
  - 원본 파일(4K): https://d34w7g4gy10iej.cloudfront.net/video/2302/DOD_109463194/DOD_109463194.mp4
  - 쓴 구간(원본 초): 295.6–297.6, 29.0–33.5, 278.0–282.5, 285.0–288.5, 293.5–301.0.
  - 헬기 안 인물은 비행 헬멧을 썼지만, 설명에 역할이 없어 "CH-53E 헬기 안"으로만 적었습니다.
- 원본 조각과 출처 .json: `media/boom/boom_dvids759457_0-100.*`, `boom_dvids956430_4-37.*`, `boom_dvids873781_270-312.*`, `boom_dvids873781_25-40.*`(873781은 1920×1080으로 줄임).

**소리와 자막**
- AST 검사 결과 네 영상 모두 음악이 없었습니다(Speech, Vehicle, Helicopter, Wind 등 현장음). 원래 소리를 그대로 썼습니다.
- 강하 영상은 엔진과 바람 소리에 묻혀, faster-whisper small.en과 medium.en이 같은 말을 거의 듣지 못했습니다. 그래서 번역 자막 없이 DVIDS 설명에 근거한 상황 자막만 달았습니다.
- 헬로캐스트 영상은 회전익 소음뿐이라 대사가 없습니다.
- 라우드니스: boom4 −14.0, boom5 −13.5 LUFS.

### 업로드 문구

**boom4**
- 제목: `비행기 문 밖으로 한 걸음 내딛으면 🪂` (20자)
- 설명:
  ```
  미 육군 공수부대원이 C-130 뒷문(램프)에서 뛰어내리는 순간을 헬멧캠으로. (2020년 7월, 미국 조지아 도빈스 공군예비기지)
  강하 전 낙하산 착용 장면과 땅에서 본 강하는 미 육군 173공수여단 (2025년 3월, 이탈리아 아비아노).
  영상: U.S. Army Reserve video by Staff Sgt. Austin Berner (DVIDS 759457), U.S. Army video by Sgt. Kylejian Francia (DVIDS 956430). 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
  ```
- 해시태그: `#공수부대 #낙하산 #C130 #미육군 #shorts`

**boom5**
- 제목: `헬기에서 바다로 그냥 뛰어내림 🌊` (17자)
- 설명:
  ```
  미 해병대 2수색대대의 헬로캐스트(helocast) 훈련. CH-53E 헬기 뒷문에서 바다로 한 명씩 뛰어내립니다. (2023년 2월, 노스캐롤라이나 캠프 르준)
  영상: U.S. Marine Corps video by Lance Cpl. Ethan R. Jones (DVIDS 873781). 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
  ```
- 해시태그: `#미해병대 #수색대 #헬로캐스트 #CH53 #shorts`

## 동물 랭킹 쇼츠 3 (`politics/anirank5`, `politics/anirank6`)

같은 틀입니다(검정 띠 제목, 정사각 크롭, 자막 1380, 순위표, 1위 뒤 처음으로 반복). 순위는 우리가 고른 것입니다. 음악 아래로 원본 자연음(목도리뇌조 날갯짓 소리 등)을 그대로 씁니다.

| id | 제목(화면) | 길이 | 5위 → 1위 | 음악 |
| --- | --- | --- | --- | --- |
| `anirank5` | 역대급 귀여운 아기동물 2탄 / TOP5 (다들 몇 번?ㅋㅋ) | 36.3초 | 아장아장 아기 큰뿔양 · 끼리끼리 모인 아기 코끼리물범 · 털뭉치 알바트로스 새끼 · 엄마 옆 딱 붙은 아기 몽크물범 · 밥 달라고 부리 톡톡 알바트로스 | Monkeys Spinning Monkeys (40초부터) |
| `anirank6` | 역대급 웃긴 야생동물 / TOP5 (다들 몇 번?ㅋㅋ) | 28.4초 | 식량 모으는 우는토끼 · 레슬링 한판 마멋 · 날개로 북 치는 목도리뇌조 · 부리 맞대고 꽁냥 알바트로스 · 물 밖으로 고개 빼꼼 몽크물범 | Hustle |

**영상 (미국 연방기관 저작물, 퍼블릭 도메인)** — 발췌와 출처·사용 구간은 `media/anirank/*.json`
- 아기 큰뿔양: [Young Desert Bighorn Sheep](https://www.nps.gov/media/video/view.htm?id=33CB309C-0802-485D-A84D-9E8FC5204529) — NPS Video: Michael Quinn, 그랜드캐니언
- 아기 코끼리물범: [Elephant Seal - Weanling Pod](https://www.nps.gov/media/video/view.htm?id=7E48438D-7E63-4478-AAB9-F0504B3BD80D) — NPS / C. Arreglo, 포인트레이즈 국립해안(“a group of weaned elephant seal pups”)
- 우는토끼: [A Hungry Pika](https://www.nps.gov/media/video/view.htm?id=B47A5F36-69EE-40CD-A872-84EE3892C3B4), 마멋: [Mountain Moment: Madness of Marmots](https://www.nps.gov/media/video/view.htm?id=46BE6244-8744-4764-955B-47B427FA3EA9) — NPS, 레이니어산 국립공원 (원본 앞의 NPS 로고 화면은 쓰지 않음)
- 목도리뇌조: [Minute Out In It: Drumbeats in the Forest](https://www.nps.gov/media/video/view.htm?id=552D11E5-7DC7-45E6-924D-3A2A53E89D5A) — NPS/Neal Herbert & Jennifer Jerrett, 옐로스톤
- 알바트로스(새끼·먹이 주기·커플): [B-Roll: Laysan Albatross on Midway Island](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seabirds/video/897660927001/b-roll:-laysan-albatross-on-midway-island) — NOAA Fisheries (“Shots include chicks in colony and adults feeding chicks”)
- 몽크물범(새끼·고개 빼꼼): [B-Roll: Hawaiian Monk Seal](https://videos.fisheries.noaa.gov/detail/videos/b-roll:-seals-and-sea-lions/video/5352712499001/b-roll:-hawaiian-monk-seal) — NOAA Fisheries (NMFS ESA/MMPA 허가 #16632, #13707 하에 촬영)
- 쓰지 않은 것: 크레딧이 비어 있는 NPS 늑대 새끼 목걸이 카메라 영상(Yukon-Charley), 페이지가 열리지 않는 “Backyard Owls”, 너무 작게 찍힌 오리·흰물떼새·선인장굴뚝새·까마귀 영상. NPS·NOAA가 이 영상을 보증하거나 후원하지 않으며 로고는 쓰지 않았습니다.
- 음악: "Monkeys Spinning Monkeys", "Hustle" Kevin MacLeod (incompetech.com), CC BY 4.0

**자막 속 사실과 출처**
- “young Desert Bighorn Sheep” — 위 NPS 영상 설명
- 코끼리물범 새끼는 약 한 달 만에 젖을 떼고, 어미는 그 직전에 짝짓기 후 바다로 돌아감 — [NOAA: Northern Elephant Seal](https://www.fisheries.noaa.gov/species/northern-elephant-seal)
- 갓 태어난 몽크물범 새끼는 털이 까맘 — [NOAA: Hawaiian Monk Seal](https://www.fisheries.noaa.gov/species/hawaiian-monk-seal) (“Newborn monk seal pups have black fur.”) 영상 속 검은 새끼가 갓 태어났는지는 알 수 없어 일반 사실로만 적었습니다.
- 알바트로스 부모는 바다에서 찾은 먹이를 토해서 새끼에게 먹임 — [USFWS: Albatross: Lifetime at Sea](https://www.fws.gov/story/albatross-lifetime-sea), 원본 설명 “adults feeding chicks”. 영상 속 어른이 어미인지 아비인지 알 수 없어 “부모”로 적었습니다. 커플 장면은 행동 이름 없이 “부리 맞대고 꽁냥꽁냥”으로만 적었습니다.
- 우는토끼(pika)는 토끼과 동물이고 겨울잠을 자지 않고 먹이 더미를 모음 / 어린 마멋은 장난 싸움을 자주 함 / 목도리뇌조 수컷은 날갯짓으로 쿵쿵 소리를 내며 영역을 알림 — 각 NPS 영상 설명

**anirank5** — 역대급 귀여운 아기동물 2탄 TOP5 (다들 몇 번?ㅋㅋ)
> 아장아장 다가오는 아기 큰뿔양, 젖 떼고 끼리끼리 모인 아기 코끼리물범, 털뭉치 알바트로스 새끼, 엄마 옆에 딱 붙은 아기 몽크물범, 그리고 밥 달라고 부리를 톡톡 치는 알바트로스 새끼까지! 여러분의 원픽은? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) — Michael Quinn(그랜드캐니언), C. Arreglo(포인트레이즈) · 미국 해양대기청(NOAA Fisheries) (NPS·NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #아기동물 #귀여운동물 #알바트로스 #동물 #shorts

**anirank6** — 역대급 웃긴 야생동물 TOP5 (다들 몇 번?ㅋㅋ)
> 겨울잠 대신 식량 모으는 우는토끼, 레슬링 한판 벌이는 마멋, 날개로 북 치는 목도리뇌조, 부리 맞대고 꽁냥대는 알바트로스 커플, 그리고 물 밖으로 고개 빼꼼 내민 몽크물범까지! 다들 몇 번이 제일 웃겨요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) — Neal Herbert·Jennifer Jerrett(옐로스톤), 레이니어산 국립공원 · 미국 해양대기청(NOAA Fisheries) (NPS·NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #웃긴동물 #야생동물 #마멋 #동물 #shorts

## 군대 훈훈·유쾌 쇼츠 (`politics/fun1`, `politics/fun2`)

사람이 주인공인 가벼운 군대 장면 2편입니다. 현장음을 그대로 쓰고, 레이아웃은 군견 쇼츠와 같습니다(`titleStyle: band`, `captionY 1600`, `single` 크롭, `broll`로 흰 번쩍임 없음).

| id | 제목 | 길이 | 내용 | 소리 |
| --- | --- | --- | --- | --- |
| `fun1` | 미군 줄다리기 대회에 / 헬기 편대가 지나가면 | 24.7초 | 미 육군 3사단 ‘마른 위크’ 줄다리기(6명 대 6명, 1분씩 3라운드, 중앙선 넘기면 승리) → 힘쓰는 얼굴·응원 → 머리 위로 헬기 편대가 지나가고 장병들이 손을 흔듦 | 현장음 + 음악 낮게(Hyperfun) |
| `fun2` | 6개월 파병 다녀온 / 교장 선생님이 돌아오자 | 21.5초 | 아이오와 공군 주방위군 상사이자 초등학교 교장 드루 와그너가 6개월 중동 파병을 마치고 돌아오자 학교가 깜짝 환영식 → 포옹·하이파이브 → “이렇게 따뜻한 환영 속에 집에 오는 것만 한 게 없죠” | 현장음(환호)·인터뷰 육성, 음악 없음 |

```bash
# 원본: media/fun/*.mp4 (.json에 DVIDS ID·페이지·파일 주소·크레디트·날짜·구간)
python3 politics/prep_split.py fun1 && ./render.sh fun1 final/fun1.mp4   # fun2도 같음; final/은 -crf 22로 다시 압축
```

- 두 원본 모두 B-roll이고 음악이 없습니다(AST Music 점수 0.00–0.10). 후보였던 RIMPAC 26 줄다리기(1013771)는 음악이 깔려 있어서 쓰지 않았습니다.
- fun1 자막은 모두 화면 설명이고, 줄다리기 규칙은 같은 행사의 다른 DVIDS 영상 [865659](https://www.dvidshub.net/video/865659) 설명에 근거합니다(“a single elimination tournament where two six-person teams on opposite ends of the rope had three one-minute rounds to drag the other team across the center line”). 헬기 편대 장면은 같은 영상(866305) 2:13–2:19에 있습니다. DVIDS 설명에 헬기 이야기가 없어서 기종이나 이유는 말하지 않았습니다. 줄다리기 승패도 영상에 나오지 않아 말하지 않았습니다.
- fun2의 인물 정보(아이오와 공군 주방위군 185공중급유비행단 상사, 네브래스카 포트 칼훈 초등학교 교장, 6개월 중동 파병, 학교가 준비한 깜짝 환영식, “second family”)는 DVIDS 840409 설명에서 가져왔습니다. 마지막 인용(“there's nothing like coming home to a warm welcoming like this”)은 같은 영상 186.1–190.2초의 인터뷰를 faster-whisper medium.en으로 듣고 번역했습니다(단어 확률 0.89–1.0). 아이들 얼굴이 나오지만 공개 행사를 미 공군이 공개한 영상이고, 크롭은 와그너 상사에게 맞췄습니다.

**영상 출처**
- fun1 — [866305](https://www.dvidshub.net/video/866305) 3rd Infantry Division Marne Week 2022 Tug of War B-Roll — Daniel Malta, 3rd Infantry Division, 2022.11.28, 미국 조지아주 포트 스튜어트. 원본 44.8–48, 7.5–10.5, 13.5–16.5, 38.5–41, 112–116, 121–124, 133.5–139.5초.
- fun2 — [840409](https://www.dvidshub.net/video/840409) Fort Calhoun, Neb. School Principal welcomed home following Air Force deployment — Senior Master Sgt. Vincent De Groot, 185th Air Refueling Wing(아이오와 공군 주방위군), 2022.4.21, 미국 네브래스카주 포트 칼훈 초등학교. 원본 53.8–57.6, 9.5–13.5, 34.5–37.5, 38.5–41.5, 60.5–63.5, 185.9–190.6초.
- 라이선스: 미군·주방위군이 직무로 만든 연방정부 저작물로 퍼블릭 도메인입니다(DVIDS 페이지에 PUBLIC DOMAIN 표시, Restrictions 없음). 음악은 Kevin MacLeod CC BY 4.0입니다.

**fun1** — 미군 줄다리기 대회에 헬기 편대가 지나가면 🚁
> 미 육군 3사단의 ‘마른 위크(Marne Week)’ 줄다리기 대회. 6명 대 6명이 1분씩 3라운드를 겨뤄 상대를 중앙선 너머로 끌어오면 이깁니다. 모두 진심으로 줄을 당기던 그때, 머리 위로 헬기 편대가 지나갔습니다. 2022년 11월, 미국 조지아주 포트 스튜어트.
> 영상: 미 육군 (DVIDS, Daniel Malta). 미 육군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #줄다리기 #미군 #군대 #헬기 #shorts

**fun2** — 6개월 파병 다녀온 교장 선생님이 돌아오자
> 미국 네브래스카주의 한 초등학교 교장 선생님은 아이오와 공군 주방위군 상사이기도 합니다. 6개월 중동 파병을 마치고 돌아오자, 학교는 전교생이 모인 깜짝 환영식을 준비했습니다. 그가 ‘제2의 가족’이라 부르는 아이들과의 재회. “이렇게 따뜻한 환영 속에 집에 오는 것만 한 게 없죠.”
> 영상: 미 공군 주방위군 (DVIDS, Senior Master Sgt. Vincent De Groot). 미 공군·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #파병 #귀환 #감동 #선생님 #shorts

## 새 랭킹 쇼츠 (`politics/anirank7`)

| id | 제목(화면) | 길이 | 5위 → 1위 | 음악 |
| --- | --- | --- | --- | --- |
| `anirank7` | 역대급 웃긴 새 모먼트 / TOP5 (다들 몇 번?ㅋㅋ) | 35.2초 | 다친 척 연기하는 킬디어 · 보라 풍선 달고 춤추는 뇌조 · 머리에 뿔 세운 초원뇌조 · 꼬리 활짝 산쑥들꿩 · 가슴 풍선 뿅뿅 산쑥들꿩 | Sneaky Snitch (45초부터) |

- **영상**: 미국 어류야생동물관리국(USFWS) 국립보전교육센터(NCTC)의 [American Birds B-roll](https://www.fws.gov/NCTC-american-bird-b-rolls) — #3 Plovers and Sandpipers(킬디어), #12 Sharp-tailed Grouse, #13 Lesser Prairie Chicken 1, #11 Sage Grouse. 영상 첫 타이틀 카드에 “All footage is public domain. Please credit ‘U.S. Fish & Wildlife Service, National Conservation Training Center, Creative Imagery’”, 제작 Billings·Canfield·Hagerty(USFWS/NCTC). 목록 페이지가 “일부 영상에는 라이선스 음악이 들어 있다”고 해서 **원본 소리는 모두 뺐습니다**(음악만). 발췌와 사용 구간은 `media/anirank/*.json`.
- **사실과 출처**
  - 킬디어는 둥지나 새끼에게 다가오는 적을 떼어 내려고 날개가 부러진 척한다 — [USFWS: Nesting season bird behavior](https://www.fws.gov/story/nesting-season-bird-behavior), [NPS 미시시피강: Killdeer](https://home.nps.gov/miss/learn/nature/birdskill.htm)
  - 뾰족꼬리뇌조(sharp-tailed grouse) 수컷은 레크에 모여 발을 구르고 보라색 목주머니를 부풀린다 — [USFWS Crescent Lake NWR](https://www.fws.gov/refuge/crescent-lake/visit-us/tours)
  - 작은초원뇌조(lesser prairie-chicken) 수컷은 구애 때 목 옆 긴 깃털(pinnae)을 세운다 — [USFWS: Lesser Prairie-Chicken](https://www.fws.gov/species/lesser-prairie-chicken-tympanuchus-pallidicinctus) (“뿔”은 그 깃털을 두고 한 농담)
  - 산쑥들꿩(greater sage-grouse) 수컷은 새벽 레크에서 꼬리를 부채처럼 펴고, 가슴의 노란 공기주머니 두 개를 부풀렸다 꺼뜨리며 펑펑 소리를 내고, 아침에 3~4시간 동안 거의 쉬지 않고 과시한다 — [USFWS: Ensuring the Greater Sage-grouse Remains Lek-y in Love](https://www.fws.gov/story/ensuring-greater-sage-grouse-remains-lek-y-love), [USFWS 종 페이지](https://www.fws.gov/species/greater-sage-grouse-centrocercus-urophasianus)
  - 한국어 이름: sharp-tailed grouse는 화면에선 “뇌조”, lesser prairie-chicken은 “초원뇌조”, greater sage-grouse는 “산쑥들꿩”으로 적었습니다.

**anirank7** — 역대급 웃긴 새 모먼트 TOP5 (다들 몇 번?ㅋㅋ)
> 날개 다친 척 연기하는 킬디어, 보라 풍선 달고 춤추는 뇌조, 머리에 ‘뿔’ 세운 초원뇌조, 꼬리를 부채처럼 펼친 산쑥들꿩, 그리고 가슴의 노란 풍선을 뽕뽕 부풀리는 산쑥들꿩까지! 다들 몇 번이 제일 웃겨요? 순위는 저희 마음대로 고른 것입니다.
> 영상: U.S. Fish & Wildlife Service, National Conservation Training Center, Creative Imagery (미국 어류야생동물관리국이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #새 #웃긴동물 #구애댄스 #동물 #shorts


## 신병 훈련소 쇼츠 (`politics/boot1`, `politics/boot2`)

미 해병대 신병훈련소 B-roll(현장음만 있는 원본 묶음)으로 만든 군대 공감 쇼츠 두 편입니다. 사람 얼굴과 반응이 주인공이고, 내레이션 없이 원본 소리(교관 고함, "Yes, sir!", 울음·환호)를 그대로 살렸습니다. 레이아웃은 `"titleStyle": "band"`(검정 띠 두 줄 제목), 정사각 화면에 얼굴 위주 크롭, 그 아래 자막(`"captionY": 1610`)입니다. 음악과 그래픽은 넣지 않았습니다.

| id | 제목 | 길이 | 내용 |
| --- | --- | --- | --- |
| `boot1` | 미 해병대 훈련소 첫날 밤 / 버스에 교관이 올라탔다 | 23.3초 | 입소 버스에 오른 교관의 첫 지시("Yes, sir / No, sir만", "내 노란 발자국 위로") → 버스에서 뛰어내림 → 이발소 → 삭발 직후 정면 응시 |
| `boot2` | 훈련소 13주 만에 / 가족을 다시 만난 순간 | 34.6초 | 패밀리 데이 관람석의 가족 → 장내 안내 "곧 여러분의 새 해병을 만나게 됩니다" → 운동장으로 달려가는 가족 → 포옹 → '해병대 엄마' 티셔츠의 어머니 |

```bash
# 원본: media/boot/ (파일마다 .json에 DVIDS ID·페이지·파일 주소·크레디트·부대·날짜·쓴 구간)
python3 politics/prep_split.py boot1 && ./render.sh boot1 final/boot1.mp4
python3 politics/prep_split.py boot2 && ./render.sh boot2 out/boot2.mp4   # 30MB를 넘어서 final은 crf 22로 한 번 더 압축
```

- **영상 고르기**: DVIDS 항목 페이지에 "Video by <해병대원>"과 "PUBLIC DOMAIN" 표시가 있고, Restrictions 표시나 제3자 자료(courtesy) 표기가 없는 것만 썼습니다. 음악은 AudioSet AST 모델(`MIT/ast-finetuned-audioset-10-10-0.4593`)로 확인했습니다. 음악이 깔린 편집본(Video Productions)은 쓰지 않았습니다. 예: 강아지 마스코트 "Recruit Chesty XVII Meets His Drill Instructors"(1023578), Charlie Company Pick Up(1024979), 가스실 편집본들(930217·944876·1004444 등). 879117 클립의 24–39초와 1025928의 처음 10초에는 음악 같은 소리가 있어서 그 부분도 빼고 잘랐습니다.
- **자막(boot1)**: 교관의 말은 faster-whisper small.en·medium.en·large-v3 세 모델이 같은 말을 들은 줄만 번역했습니다. 부대 이름은 인식 결과가 "Recruit Team 5"/"Recurrent Team"으로 갈려서, 실제 이름인 Marine Corps Recruit Depot San Diego로 적었습니다(영상 설명에 나오는 장소). 세 모델이 서로 다르게 들은 "You will scream 'aye, sir'…"는 줄째로 잘라내고 자막도 넣지 않았습니다. 'file off onto my yellow footprints'의 'file off'도 확실하지 않아서 영어 줄에서는 "…onto my yellow footprints."만 남겼습니다. "trash"는 수하물을 가리키지만 원문의 말투를 살려 "쓰레기"로 옮겼습니다.
- **자막(boot2)**: 장내 안내 "Shortly, you'll meet your new Marine and be able to discuss with them first hand their experiences…"는 medium.en과 large-v3가 일치합니다. 앞부분만 자막으로 넣었습니다. 포옹 장면에는 알아들을 수 있는 말이 없어서 자막을 넣지 않았습니다. 화면 속 사람들의 관계(엄마·아들 등)는 확인할 수 없어서 쓰지 않았고, 티셔츠에 "UNITED STATES MARINE MOM"이라고 적힌 분만 '해병대 엄마'라고 했습니다. 2023년(879117)과 2026년(1025928) 패밀리 데이 영상을 섞었기 때문에 같은 가족이라고 말하지 않았습니다.
- **사실 출처**(모두 DVIDS 영상 설명): 입소 날 이발·소지품 검사·가족에게 정해진 문구로 전화(1004207, 1015330), 13주 훈련(1015330, 1024979), 패밀리 데이는 수료식 전날이고 가족이 새 해병을 처음 보는 날(1017446, 668636 "Family Day is the first day in which Marines have seen their family since leaving for recruit training").
- 마지막 자막("훈련소 첫날, 기억나시죠?", "수료식 날, 우리 엄마도 이랬죠")은 한국 시청자에게 하는 말입니다. 미군과 한국군을 비교하는 내용은 넣지 않았습니다.
- 음악은 넣지 않았습니다(업로드 문구에 음악 크레디트 없음).
- 둘 다 얼굴이 작아지지 않게 `single: [cx, cy, zoom]`으로 크롭했습니다. 어두운 버스 안 장면은 `"vf": "eq=…"`로 조금 밝혔습니다. 라우드니스는 −14.0 LUFS입니다.

**영상** (DVIDS, 미 해병대 공보 인력이 촬영한 연방정부 저작물)
- [910298](https://www.dvidshub.net/video/910298) Hotel Company Receiving BROLL package — Lance Cpl. Francisco Angel, MCRD San Diego, 2024.1.9 (세로 4K). boot1: 원본 80.8–88.9초, 93.1–101.8초
- [1015330](https://www.dvidshub.net/video/1015330) Fox Company Receiving — Cpl. Brooke Pedersen, MCRD San Diego, 2026.7.13. boot1: 원본 291.2–293.4초, 301.4–305.7초 (이발)
- [879117](https://www.dvidshub.net/video/879117) Family Day B-ROLL Package — Cpl. Luis Arturo Ponce Alavez Jr. 외 8명, MCRD Parris Island, 2023.4.6 (세로). boot2: 원본 589.4–592.6, 597.6–603.8, 1136.0–1142.0, 1237.3–1242.5, 1486.0–1488.6, 1492.8–1499.2초
- [1025928](https://www.dvidshub.net/video/1025928) Delta Company Family Day — Pfc. Ya-Davi A. Gonzalez, MCRD Parris Island, 2026.10.1. boot2: 원본 30.0–35.0초 (달려가는 가족)

**boot1** — 미 해병대 훈련소 첫날, 버스에 교관이 올라탔다
> 미국 해병대 신병훈련소 입소 첫날 밤. 신병들이 탄 버스에 교관이 올라와 처음 하는 말입니다. "지금부터 너희 입에서 나올 수 있는 말은 '예, 써!' 아니면 '아닙니다, 써!'뿐이다." 그리고 노란 발자국 위로, 다음은 이발소. 훈련소 첫날 기억나시죠?
> 영상: 미 해병대 (DVIDS) — Lance Cpl. Francisco Angel, Cpl. Brooke Pedersen / Marine Corps Recruit Depot San Diego. 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #훈련소 #해병대 #군대 #신병 #shorts

**boot2** — 훈련소 13주 만에 가족을 다시 만난 순간
> 미국 해병대 신병훈련소 수료식 하루 전날인 '패밀리 데이'. 13주 훈련을 마친 새 해병들이 입소 뒤 처음으로 가족을 만나는 날입니다. 관람석에서 기다리던 가족들이 운동장으로 달려가는 순간까지. 수료식 날 우리 부모님 얼굴, 기억나시나요?
> 영상: 미 해병대 (DVIDS) — Cpl. Luis Arturo Ponce Alavez Jr., Cpl. Collin R. Harper, Cpl. Zachary Foshee, Lance Cpl. Brenna A. Ritchie, Lance Cpl. Vincent Needham, Lance Cpl. Jake Richardson, Lance Cpl. William Horsely, Pfc. Landon Lingle, Pfc. Mary Jenni, Pfc. Ya-Davi A. Gonzalez / Marine Corps Recruit Depot Parris Island. 미 해병대·국방부가 이 영상을 보증하거나 후원하지 않습니다.
> #훈련소 #수료식 #해병대 #감동 #shorts


## 군대 랭킹 TOP5 쇼츠 (`politics/rank1`, `politics/rank2`)

「역대급 ○○ 랭킹 TOP5」형(오락 쇼츠 중 조회수 중앙값 최고, `research/research-fun.md`)으로, **사람이 주인공인** DVIDS 실제 영상 다섯 장면을 5위→1위로 세웠습니다. 순위는 편집자 선정이고(“역대급”, 공식 순위 아님), 1위가 끝나면 바로 끊겨 처음으로 돌아갑니다. 내레이션·AI 목소리 없음, 원래 현장음 + 낮은 음악.

| id | 제목(화면) | 길이 | 5위 → 1위 |
| --- | --- | --- | --- |
| `rank1` | 보기만 해도 아픈 군대 훈련 TOP5 / 다들 몇 위가 제일 아파 보임?ㅋㅋ | 37.2초 | 테이저건 직접 맞기 → 퍼길스틱 대련 → 얼음 구멍 입수 → 가스실 탈출 → OC(후추) 스프레이 얼굴 직격 |
| `rank2` | 역대급 소름 돋는 군인 TOP5 / 다들 몇 위에서 소름 돋음?ㅋㅋ | 39.5초 | 해병대 사일런트 드릴 → 눈 속의 무명용사의 묘 경비병 → 항공모함 ‘슈터’의 발진 신호 → C-17 뒷문 고고도 강하 → 신병이 ‘해병’이 되는 순간(EGA 수여식 + 해병대 찬가) |

```bash
MEDIA=<저장소>/media python3 politics/prep_split.py rank1    # 원본: media/rank1/, media/rank2/
./render.sh rank1 final/rank1.mp4                            # 저장소 보관본은 이어서 CRF 22로 다시 압축
```

- 레이아웃: `"titleStyle": "band"`, 정사각 화면에 `single` 크롭으로 얼굴을 크게, 자막은 화면 아래쪽 `"captionY": 1380`, 순위표는 그 아래(`rank` 구간 값). 순위가 바뀔 때 흰 번쩍임 + 작은 “○위” 노란 스티커 + `whoosh` 효과음. 첫 프레임에 제목이 이미 떠 있습니다(rank1: 테이저 맞기 직전 웃는 얼굴, rank2: 사일런트 드릴 대원 얼굴).
- 영상은 모두 DVIDS 페이지 머리의 “Video by …”가 미군 장병이나 국방부 민간인 직원이고, 페이지에 Restrictions 표시나 “Courtesy” 표시가 없는 B-roll만 썼습니다. 자른 원본과 DVIDS ID·페이지·파일 주소·크레디트·부대·날짜·쓴 구간은 `media/rank1/*.json`, `media/rank2/*.json`.
- 음악 확인: AudioSet(AST) 태거로 구간별 음악 점수를 보고, 음악이 깔린 영상은 뺐습니다(837044 노르웨이 냉수 입수 패키지, 829296 Ice Bath 제작 영상). EGA 수여식(987854)은 눈물 장면 아래에 지속음(현악 패드)이 보여서 그 3.8초는 **소리를 끄고**(`audio: 0`) 우리 음악만 깔았고, 해병대 찬가를 외치는 부분(원본 342–358초)은 지속음 없이 군중 함성만 있어 원음을 그대로 씁니다.
- 무음 원본: 퍼길스틱(900015)과 사일런트 드릴(965624)은 원본 오디오 트랙이 무음이라 음악만 들립니다. 효과음으로 타격음을 지어내지 않았습니다.
- 자막: 실제로 들리는 말은 faster-whisper small.en·medium.en·large-v3로 맞춰 둘 이상이 같은 것만 번역했습니다 — “Taser, taser, taser.”(844913, large-v3·medium.en), “All the way, dunk your head, there you go.”(871794, medium.en·large-v3 “head” / small.en “hands”라 2:1), 해병대 찬가 “and to keep our honor clean, we are proud to claim the title of United States Marine.”(987854, large-v3 + 찬가 가사). 가스실 교관 고함은 인식 결과가 제각각(“Yes!”, “Go Lazio!”)이라 자막에 넣지 않았습니다. 나머지 줄은 화면 설명입니다.

**rank1 영상** (DVIDS, 페이지 = `https://www.dvidshub.net/video/<ID>`)
- 5위 [844913](https://www.dvidshub.net/video/844913) CEW Training with Security Forces (BROLL) — Senior Airman Gary Hilton, 18th Wing(가데나 공군기지), 2022.5.17 · 원본 63.6–69.2초(“Taser, taser, taser” → 비명), 72.4–76.3초(2명 동시에). DVIDS 설명: 자격 훈련에 “exposure to CEW discharge” 포함.
- 4위 [900015](https://www.dvidshub.net/video/900015) 198th 2-19 IN Pugil Stick Combat — Toygar Ayla, Fort Benning PAO(VIRIN 231005-A-…), 2023.10.5 · 62.0–68.2초.
- 3위 [871794](https://www.dvidshub.net/video/871794) Airmen train in cold-water immersion at Fort McCoy … Part V — Scott T. Sturkol, Fort McCoy PAO, 2023.1.27 · 32.0–38.6초. 설명: 공군 주관 16일 혹한기 작전 과정(CWOC)의 일부.
- 2위 [1016785](https://www.dvidshub.net/video/1016785) Hotel Company Confidence Chamber – B-Roll — Cpl. Eric Valerio, MCRD San Diego, 2026.7.27 · 106.6–113.4초(가스실 문을 나서는 신병들, 밖의 교관들).
- 1위 [1008601](https://www.dvidshub.net/video/1008601) Security Forces OC spray — Airman 1st Class Taylor Warehime, 121st Air Refueling Wing(오하이오 주방위군), 2026.3.8 · 97.9–101.8초(분사), 176.6–181.2초(호스로 눈 세척, 다른 대원).
- 음악: "Hyperfun" Kevin MacLeod.

**rank2 영상**
- 5위 [965624](https://www.dvidshub.net/video/965624) New York Fleet Week Silent Drill Platoon B-Roll — Cpl. Christopher Prelle, Marine Barracks Washington, 2025.5.21(타임스스퀘어) · 178.0–184.5초. 세로(1080×1920) 원본.
- 4위 [911824](https://www.dvidshub.net/video/911824) Winter 2024 B-Roll – Arlington National Cemetery — Daryl Vaca, Arlington National Cemetery, 2024.1.19 · 216.6–220.3초, 231.2–234.0초(설명의 03:31–04:33 Tomb of the Unknown Soldier 구간).
- 3위 [948608](https://www.dvidshub.net/video/948608) F-35C Lightning II B-roll Package — MC2 Caden Richmond, USS Carl Vinson, 2024.8.12 · 63.6–69.0초(제트 소리는 30%로 낮춤).
- 2위 [1005227](https://www.dvidshub.net/video/1005227) Static Line and High-Altitude Jump B-Roll Package — Airman 1st Class Nathan Langston, 97th Air Mobility Wing, 2026.4.10(포트 베닝, C-17) · 273.0–280.5초. 세로 원본.
- 1위 [987854](https://www.dvidshub.net/video/987854) Fox Company Eagle, Globe, and Anchor Ceremony B-Roll — Cpl. Jordy Morales, MCRD Parris Island, 2025.10.25 · 333.0–336.8초(무음), 346.6–356.3초(원음).
- 음악: "Heroic Age" Kevin MacLeod (`fetch.sh`가 받음).

**사실 근거 (rank2 자막)**
- 사일런트 드릴은 구령 없이 하는 소총 시범: Marine Corps 사진 설명·[Marine Barracks Washington 기사](https://www.barracks.marines.mil/News/News-Article-Display/Article/498164/marines-compete-to-march-in-silent-drill-platoon/), [위키백과](https://en.wikipedia.org/wiki/United_States_Marine_Corps_Silent_Drill_Platoon).
- 무명용사의 묘는 1937년 7월부터 24시간 경계: [미 육군 Tomb 역사](https://www.army.mil/tomb/pages/history.html).
- EGA는 54시간 ‘크루서블’ 뒤 신병이 처음 ‘해병’으로 불리며 받는 엠블럼: DVIDS 987854 설명(“final event of the Crucible … transformation from recruit to Marine”), DVIDS 968533 설명(“The Crucible is a 54-hour culminating event”).
- 해병대 찬가 마지막 구절: “First to fight for right and freedom / And to keep our honor clean; / We are proud to claim the title / Of United States Marine.”
- 슈터 장면은 화면에 보이는 것(팔을 들고 몸을 낮춤 → 바로 옆에서 F-35C 발진)만 적었습니다.

**rank1** — 보기만 해도 아픈 군대 훈련 TOP5 (몇 위가 제일 아파 보임?)
> 테이저건 직접 맞기, 퍼길스틱 대련, 얼음 구멍 입수, 가스실, 그리고 후추(OC) 스프레이까지. 미군이 실제 훈련에서 겪는 장면을 모았습니다. 순위는 저희 마음대로 정했어요. 여러분 생각엔 몇 위가 제일 아파 보이나요?
> 영상: 미 공군·미 공군 주방위군·미 육군·미 해병대 (DVIDS) — Senior Airman Gary Hilton, Toygar Ayla, Scott T. Sturkol, Cpl. Eric Valerio, Airman 1st Class Taylor Warehime. 미 국방부와 각 군이 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군대 #미군 #훈련 #테이저 #shorts

**rank2** — 역대급 소름 돋는 군인 TOP5 (몇 위에서 소름 돋음?)
> 구령 없이 소총을 돌리는 해병대 사일런트 드릴, 1937년부터 하루도 쉬지 않은 무명용사의 묘 경비병, 항공모함 ‘슈터’의 발진 신호, C-17 뒷문 고고도 강하, 그리고 54시간 ‘크루서블’을 마친 신병이 해병대 엠블럼을 받고 해병대 찬가를 외치는 순간. 순위는 편집자 선정입니다.
> 영상: 미 해병대·미 육군(알링턴 국립묘지)·미 해군·미 공군 (DVIDS) — Cpl. Christopher Prelle, Daryl Vaca, MC2 Caden Richmond, Airman 1st Class Nathan Langston, Cpl. Jordy Morales. 미 국방부와 각 군이 이 영상을 보증하거나 후원하지 않습니다.
> 음악: "Heroic Age" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #군대 #미군 #해병대 #소름 #shorts

## 한반도 자연·과학 지식 쇼츠 (`hanban1`~`hanban4`)

「질문형 해설 + 공공 B-roll」(`research/research-info.md` 형식 A)로 만든 정보 쇼츠 4편입니다. 위쪽 검정 띠에 2줄 제목(0초부터 끝까지), 가운데 실제 위성사진·우주정거장 사진·현장 영상, 아래 1줄 자막(`"captionY": 1640`), Edge TTS `ko-KR-InJoonNeural`/`SunHiNeural` +20%, 빨간 원·화살표, 마지막 반전 한 줄. 그래픽 카드는 쓰지 않았습니다. 모두 `qa_review.py`에서 FAIL·WARN 없이 통과했고, faster-whisper small로 들은 내레이션이 대본과 맞습니다.

| id | 제목(화면) | 길이 | 용량 | 내용 | 음악 |
| --- | --- | --- | --- | --- | --- |
| `hanban1` | 백두산이 폭발하면 / 화산재는 어디로 갈까? | 29.9초 | 22.7MB | 946년 ‘천년 분화’ → 화산재가 바다 건너 일본까지(높은 하늘의 바람) → 2002~2005년 무렵 지진 급증·지표 상승 → 기상청 위성 감시 → “언제 터질지 아무도 모른다, 그래서 지켜본다” | Lightless Dawn |
| `hanban2` | 태풍이 한국 앞에서 / 휙 꺾이는 이유 | 30.2초 | 17.9MB | 북태평양고기압 가장자리를 따라 서→북 → 편서풍을 만나 북동쪽으로 전향 → 2022 힌남노(오키나와 남쪽 정체 → 꺾인 뒤 시속 98km) → 2026년 6월 태풍 장미도 오키나와 부근에서 전향 → “어디서 꺾이느냐가 우리 동네 날씨” | Movement Proposition |
| `hanban3` | 가을 하늘이 유독 / 높고 파란 이유 | 28.2초 | 9.0MB | 레일리 산란 → 먼지·수증기가 많으면 희뿌옇게(2023.4.12 황사 날 위성) → 가을엔 건조한 이동성 고기압(2025.10.28 맑은 날 위성) → 2025년 서울 초미세먼지 봄 24 → 가을 13 → 새털구름 → “하늘이 높아진 게 아니라 공기가 깨끗해진 것” | Dreamer |
| `hanban4` | 한국에서 오로라가 / 찍힌 날 생긴 일 | 32.6초 | 16.1MB | 2024년 5월 태양 흑점 폭발 → 21년 만의 G5 지자기 폭풍 → 원래 북극 근처 현상 → 영천 보현산천문대 카메라에 붉은 오로라, 강원 화천에서도 촬영 → 붉은빛은 200km 넘는 높이 → 반전: 눈으로는 거의 안 보였고 카메라에만 찍힘 | Floating Cities |

```bash
python3 voice_edge.py hanban1 && python3 prep.py hanban1
./render.sh hanban1 out/hanban1.mp4        # 저장소 보관본은 이어서 CRF 23으로 다시 압축(final/)
python3 qa_review.py hanban1
```

- 원본은 `public/hanban*/src/`(저장소에 넣지 않음)에 받아 썼고, 파일마다 페이지·파일 주소·라이선스·크레디트·장면 설명이 `media/hanban*/sources.json`에 있습니다. 크레디트는 화면 오른쪽 위에 클립별로 “사진: NASA”, “영상: USGS”처럼 짧게만 붙였습니다.
- **다른 곳의 그림임을 밝힘**: 백두산 분화 영상은 없으므로 세인트헬렌스·킬라우에아·피나투보·통가 장면에는 “참고: …” 스티커를 붙였습니다. 오로라 사진·영상은 미국(아이다호·유타)에서 찍은 NASA 자료라 첫 프레임부터 “같은 폭풍 · 미국 아이다호” 스티커, 유타 영상에는 “※ 미국 유타 영상” 스티커를 붙였습니다. 한국 오로라 사진(천문연·용인어린이천문대)은 공공누리 표시가 없고 “©”라 쓰지 않았고, 한국은 우주정거장에서 찍은 한반도 야경(NASA)으로 보여 줍니다. 허리케인 밀턴·에린 ISS 영상은 “참고: 우주에서 본 허리케인”으로 표시했습니다.
- **군 자료 없음**: 미 공군 허리케인 헌터, JTWC·해군 자료, 미 해군 NRL 진로가 겹친 NASA 이미지(2026 바비)는 쓰지 않았습니다.

**사실 근거**

`hanban1` 백두산
- 946년 말 분화, “공통 시대(CE) 최대급 분화 중 하나”, 화산재가 일본 해저·호수 퇴적층(B-Tm 층)에서 발견, 하루 안에 일본에 닿을 수 있는 성층권 하부 기류 — Oppenheimer et al. 2017, *Quaternary Science Reviews* 158:164–171 ([PDF](https://www.climatology.uni-mainz.de/files/2016/03/Oppenheimer_2017_QSR-1.pdf), [UCL](https://discovery.ucl.ac.uk/id/eprint/10096385/)). 이 연대로 ‘분화가 발해를 멸망시켰다’는 설은 성립하지 않습니다(926년 멸망). “지난 2천 년 사이 가장 큰 분화 중 하나”는 이 논문의 “largest volcanic eruptions of the Common Era”를 옮긴 것입니다.
- 화산재가 일본까지: NASA Earth Observatory 2016 “flung ash as far away as Japan” ([Mount Paektu: North Korea's Slumbering Giant](https://science.nasa.gov/earth/earth-observatory/mount-paektu-north-koreas-slumbering-giant-88020/)).
- 분출량·VEI는 연구마다 달라(24km³ DRE, 40–98km³, VEI 6 vs 7: Yang et al. 2021 *Bull. Volcanol.* 83:74) 숫자를 쓰지 않았습니다.
- 2002~2005년 무렵 미소지진 급증·지표 상승: Liu et al. 2020 *Frontiers in Earth Science* ([doi](https://frontiersin.org/articles/10.3389/feart.2020.599329/full), “unrest from July 2002 to July 2005”), Ri et al. 2016 *Science Advances* ([PMC4846464](https://pmc.ncbi.nlm.nih.gov/articles/PMC4846464)), NASA EO 2016(“Between 2002 and 2005, a surge of weak earthquakes”), 기상청 [국내 화산 자료](https://www.weather.go.kr/w/eqk-vol/volcano/archive/korea.do)(“2003.6월부터 미소지진발생 급증하여 2006년까지”). 출처마다 끝 연도가 달라 화면은 “2002~2005년 무렵”, 내레이션은 “2002년부터 몇 년 동안”.
- 기상청 위성 감시: 기상청 [화산 분석](https://www.weather.go.kr/eqk_pub/analVolcano.do) “광학ㆍ열적외선 위성(Landsat 5~8호)과 레이더 위성(Sentinel-1)을 이용하여 백두산 지표온도 및 지표변위 … 정기적으로 분석”, 같은 페이지 “향후 분화 가능성도 있다”.
- “언제 터질지 아무도 모른다”: NASA EO 2016 “more research and monitoring is required before scientists can say much about … the likelihood that it will erupt”, 뉴시스 2023.1.12(“2025년에 정확히 백두산이 분화한다는 과학적 근거는 없다”, [기사](https://www.newsis.com/view/NISX20230112_0002156039)).

`hanban2` 태풍
- 북태평양고기압 가장자리를 따라 북서진 → 서쪽 가장자리에서 북상 → 편서풍 영향으로 빠르게 북동진(전향): 기상청 [2011 태풍분석보고서](https://www.kma.go.kr/download_01/typhoon/typreport_2011.pdf)(“mT 남서쪽 가장자리 … 북서진”, “편서풍 효과가 가미되면서 빠르게 북동진”). NOAA AOML [Hurricane FAQ G5](https://www.aoml.noaa.gov/hrd/tcfaq/G5.html)(“subtropical ridge … recurve back toward the east … westerly winds”).
- 힌남노: 기상청 [2022 태풍 분석보고서](https://www.kma.go.kr/download_01/typhoon/typeffect_2022.pdf) — 8.28 발생, 남쪽으로 이동, “9월 1일부터 이틀간 일본 오키나와 남쪽 해상에서 정체”, 9.5 “북동진으로 전향한 이후 … 이동속도가 빨라지며”, 9.6 04:50 거제 부근 상륙; 분석표 이동속도 9.2 시속 2–5km → 9.6 18시 동해상 시속 98km(화면 “시속 2km → 98km”, 내레이션 “백 킬로미터 가까이”). “초강력”은 같은 보고서의 강도 분류. NASA EO [Typhoon Hinnamnor](https://earthobservatory.nasa.gov/images/150290/typhoon-hinnamnor).
- 태풍 장미: 기상청 보도자료 2026.6.2 “1951년 이후, 역대 세 번째로 이른 영향 태풍”, “1일(월) 낮 오키나와 부근에서 오른쪽으로 전향 … 우리나라 육상에는 영향이 없을 것으로 보인다”([보도자료](https://www.weather.go.kr/kma/flexer/html/press/2026/06/02/ATC202606020316422_d6d87f66-a42e-4f4c-9787-6bb9ba16a81e.hwp.files/Sections1.html)). 위성사진은 NASA EO [Typhoon Jangmi](https://science.nasa.gov/earth/earth-observatory/typhoon-jangmi/)(2026.5.31).
- 영향 태풍은 7~9월, 그중 8월이 가장 많음(평년 1991–2020, 같은 2022 보고서). 이번 편에는 쓰지 않았습니다.

`hanban3` 가을 하늘
- 파란빛이 더 잘 흩어짐: NASA Space Place [Why Is the Sky Blue?](https://spaceplace.nasa.gov/blue-sky/en/)(“Blue light is scattered more than the other colors”). 배수(400nm vs 700nm 약 9배)는 계산값이라 내레이션은 “훨씬”만 씁니다.
- 가을 하늘이 높고 파란 이유 = 습도가 낮고 대기가 투명: 기상청 강원지방기상청 보도자료 2010.10.1(“가을철은 습도가 낮고 … 대기가 투명해지기 때문”, [보도자료](https://www.kma.go.kr/kma/flexer/html/press2/2010/10/01/ATC201010011327022_e8101fd9-cc6e-4fa6-b3b2-863093d606f0.hwp.files/Sections1.html)). 같은 자료의 파장 설명(파란색을 장파로 적음)은 틀려서 쓰지 않았습니다.
- 가을 이동성 고기압 → 맑고 건조: 기상청 3개월 전망 2014.9.23(“10월은 이동성 고기압의 영향을 자주 받아 맑고 건조한 날이 많겠으며”, [뉴스와이어 게재](https://www.newswire.co.kr/newsRead.php?no=767078)). ‘양쯔강 기단’은 기상청 출처가 없어 쓰지 않았습니다.
- 서울 초미세먼지(PM2.5) 2025년 계절 평균 봄 24, 가을 13㎍/㎥, 2023·2024년에도 가을이 가장 낮음: 서울시 대기환경정보 [계절별 평균](https://cleanair.seoul.go.kr/statistics/seasonAverage). 일평균 미세먼지(PM10) 2023.4.12 260㎍/㎥(황사 위기경보 ‘관심’), 2025.10.28 22㎍/㎥: 같은 사이트 일별 자료.
- 습도는 여름보다 가을이 낮지만 봄보다 낮지는 않아서(서울 평년 7월 76.2%, 10월 61.8%, 4월 54.8%) “가을이 가장 건조”라고 하지 않았습니다. 봄과 가을의 차이는 먼지라 먼지 수치를 씁니다.
- 새털구름(권운) 높이 6km 이상: 미국 기상청 [Cloud Classification](https://www.weather.gov/lmk/cloud_classification)(“High-level clouds occur above about 20,000 feet … Cirrus”). “높아 보인다”는 설명(멀리까지 또렷 + 높은 구름)은 해석이라 “~보이는 거죠”로 말합니다.

`hanban4` 오로라
- 한국천문연구원 보도 참고자료 2024.5.13 「천문연 망원경 및 한국에서 촬영한 오로라 사진」([KASI](https://www.kasi.re.kr/kor/publication/post/newsMaterial/30045)): 보현산천문대 TIMOS 전천카메라(적색광 OI 630.0nm 필터)가 “북쪽 고위도 방향에서 적색 오로라를 포착”, 5월 12일 새벽 강원 화천에서 용인어린이천문대 박정하·심형섭 씨 촬영, 2003년 10월 30일에도 보현산 전천카메라에 붉은 오로라. 보현산 사진 시각 표기 “240510 19:09”는 세계시로 보여(한국 시각 5.11 새벽) 화면에는 날짜만 “그날”로 썼습니다.
- 육안으로는 거의 안 보임: 이데일리 2024.5.13(“육안으로는 긴가민가 할 정도 … 노출 시간을 늘려 촬영”, [Daum](https://v.daum.net/v/20240513143330827)), YTN 2024.5.15(“한국에서는 육안으로 오로라를 볼 수 없었지만”, [기사](https://www.ytn.co.kr/_ln/0103_202405151400013483)), MBC([기사](https://imnews.imbc.com/news/2024/society/article/6597973_36438.html)).
- G5(최고 등급), 2003년 10월 이후 처음: NOAA SWPC [NOAA Space Weather Scales](https://www.swpc.noaa.gov/noaa-scales-explanation), USGS [May 10, 2024 Magnetic Disturbance](https://www.usgs.gov/programs/geomagnetism/science/may-10-2024-magnetic-disturbance)(“The last G5 storm occurred on October 31, 2003”), NASA [How NASA Tracked the Most Intense Solar Storm in Decades](https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/)(흑점군 AR 13663·13664, CME 7개 이상). 플레어 영상은 13664의 X2.2(5.9)·X5.8(5.11).
- 붉은빛은 200km 위 산소: NASA [Auroras](https://science.nasa.gov/sun/auroras/)(“Green … 60 to 120 miles (100–200 km) altitude, and red occurs above 120 miles (200 km)”). “그래서 멀리서도 보인 것”은 높이에 따른 기하학적 설명입니다.
- 원래 고위도 현상: YTN 2024.5.15 천문연 전문가(“지자기 위도로 65도 정도 부근에서 발생”). 2024년 10월·2025년의 한국 오로라는 공식 확인 자료가 없어 넣지 않았습니다.

**그림 출처와 라이선스**
- `hanban1`: [Landsat 8 백두산 2015.9](https://science.nasa.gov/earth/earth-observatory/mount-paektu-north-koreas-slumbering-giant-88020/)·[MODIS 한반도 2010.1.3](https://science.nasa.gov/earth/earth-observatory/heavy-snow-in-korea-42211/)·[ISS006-E-43366 백두산 칼데라 2003](https://eol.jsc.nasa.gov/Collections/EarthObservatory/articles/Baitoushan_Volcano,_China_and_North_Korea.htm) — NASA, 퍼블릭 도메인; [GOES-17 통가 우산 구름 2022.1.15](https://science.nasa.gov/earth/earth-observatory/hunga-tonga-hunga-haapai-erupts-149347/) — NASA Earth Observatory/NOAA, 퍼블릭 도메인; [킬라우에아 정상 분화 2018.5.24](https://www.usgs.gov/media/videos/kilauea-volcano-summit-eruption-may-24-2018)(원본 12–15초, 20–24초) — USGS, 퍼블릭 도메인; [세인트헬렌스 1980.5.18](https://commons.wikimedia.org/wiki/File:MSH80_eruption_mount_st_helens_05-18-80.jpg)(USGS/Austin Post)·[피나투보 1991.6.12](https://commons.wikimedia.org/wiki/File:Pinatubo91eruption_plume.jpg)(USGS/Dave Harlow) — PD-USGov-USGS.
- `hanban2`: [MODIS 힌남노 2022.9.1](https://earthobservatory.nasa.gov/images/150290/typhoon-hinnamnor) — NASA; NASA Worldview VIIRS 스냅숏 2022.8.29–9.6(9일치를 0.8초씩 이어 붙인 플립북 포함, 주소는 `media/hanban2/sources.json`) — NASA EOSDIS, 퍼블릭 도메인; [GPM 태풍 카눈 2023](https://svs.gsfc.nasa.gov/5135) — NASA GSFC SVS; [ISS 허리케인 밀턴 2024.10.8](https://images.nasa.gov/details/jsc2024m000173_International_Space_Station_Cameras_Capture_New_Views_Of_Hurricane_Milton_241008)(원본 18초~)·[ISS 허리케인 에린 2025](https://images.nasa.gov/details/jsc2025m000148-Hurricane_Erin_Seen_From_International_Space_Station)(원본 170초~) — NASA; [VIIRS 태풍 장미 2026.5.30–31](https://science.nasa.gov/earth/earth-observatory/typhoon-jangmi/) — NASA. ESA 우주인이 함께 있던 시기의 힌남노 ISS 사진(ISS067-E-302073)은 촬영자가 확인되지 않아 쓰지 않았습니다.
- `hanban3`: NASA Worldview MODIS Terra 한반도·서울 2023.4.12, 2025.10.28 — NASA EOSDIS, 퍼블릭 도메인; [ISS073-E-0983131 한반도 남부와 파란 대기층 2025.9.21](https://images.nasa.gov/details/iss073e0983131)(NASA 우주인 조니 김 촬영) — NASA; [Cirrus cloud over Federal Way, WA](https://commons.wikimedia.org/wiki/File:Cirrus_cloud_over_Federal_Way,_WA.jpg) — Ron Clausen, CC0; [Ongjin South Korea sea city 03](https://commons.wikimedia.org/wiki/File:Ongjin_South_Korea_sea_city_03.jpg) — Hankook12, CC0; [Time lapse clouds](https://commons.wikimedia.org/wiki/File:Free_Creative_Commons_Stock_video_-_Time_lapse_clouds.webm) — Johann Mynhardt, **CC BY 2.0**(설명란 표기 필요). 한국 가을 하늘 사진은 Commons에 대부분 CC BY-SA, 서울시 사진은 공공누리 4유형이라 쓰지 않았습니다.
- `hanban4`: [SDO X2.2 플레어 2024.5.9](https://svs.gsfc.nasa.gov/5284/)·[SDO X5.8 2024.5.11](https://svs.gsfc.nasa.gov/5289/)·[SDO 13663·13664 플레어 2024.5.7–8](https://svs.gsfc.nasa.gov/14683/) — NASA/SDO; [2024년 5월 오로라 사진·타임랩스(유타·아이다호)](https://svs.gsfc.nasa.gov/14835/) — NASA/Bill Dunford(같은 페이지의 편집 영상은 제3자 화면·음악이 섞여 쓰지 않음); [ISS072-E-147641 붉은·초록 오로라 2024.11](https://images.nasa.gov/details/iss072e147641)·[ISS038-E-038300 한반도 야경 2014.1.30](https://images.nasa.gov/details/iss038e038300)·[ISS062-E-082060 서울 야경 2020.3.5](https://images.nasa.gov/details/iss062e082060) — NASA, 퍼블릭 도메인.
- 음악: Kevin MacLeod "Lightless Dawn", "Movement Proposition", "Dreamer", "Floating Cities" (incompetech.com, CC BY 4.0, `fetch.sh`가 받음). NASA·USGS·NOAA는 이 영상을 보증하거나 후원하지 않습니다(설명란 명시, 로고 미사용).

**업로드 문구**

**hanban1** — 백두산 폭발하면 화산재는 어디로 갈까?
> 서기 946년 말, 백두산은 지난 2천 년 사이 가장 큰 분화 중 하나를 일으켰고, 그 화산재는 바다 건너 일본까지 날아가 쌓였습니다(Oppenheimer et al. 2017). 2002~2005년 무렵에는 백두산 아래 미소지진이 급증하고 땅이 부풀어 올랐고, 지금은 기상청이 Landsat·Sentinel-1 위성으로 지표 온도와 변위를 정기적으로 분석합니다. 언제 분화할지는 아직 아무도 예측하지 못합니다. ※ 분화 장면은 다른 화산(세인트헬렌스·킬라우에아·피나투보·통가)의 참고 영상입니다.
> 출처: 기상청 화산 분석 weather.go.kr/eqk_pub/analVolcano.do · Oppenheimer et al. 2017 Quaternary Science Reviews · NASA Earth Observatory "Mount Paektu: North Korea's Slumbering Giant" · Liu et al. 2020 Frontiers in Earth Science
> 사진·영상: NASA(Landsat 8, Terra MODIS, 국제우주정거장), NASA·NOAA(GOES-17), USGS(Austin Post, Dave Harlow, 하와이 화산관측소). NASA·USGS·NOAA는 이 영상을 보증하지 않습니다.
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #백두산 #화산 #천지 #지구과학 #shorts

**hanban2** — 태풍이 한국 앞에서 휙 꺾이는 이유?
> 태풍은 북태평양고기압을 뚫지 못하고 가장자리를 따라 서쪽에서 북쪽으로 돌다가, 편서풍을 만나면 북동쪽으로 꺾입니다(전향). 2022년 힌남노는 오키나와 남쪽에서 이틀간 정체(시속 2~5km)했다가 전향 뒤 빨라져, 9월 6일 거제에 상륙하고 동해로 빠질 때는 시속 98km였습니다. 2026년 6월 태풍 장미도 오키나와 부근에서 전향해 우리나라 육상에는 영향이 없었습니다. 여러분 동네는 힌남노 때 어땠나요?
> 출처: 기상청 2022 태풍 분석보고서, 2011 태풍분석보고서, 기상청 보도자료(2026.6.2) · NOAA AOML Hurricane FAQ · NASA Earth Observatory
> 위성·영상: NASA(Terra MODIS, Worldview VIIRS, GPM, 국제우주정거장). NASA는 이 영상을 보증하지 않습니다.
> 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #태풍 #힌남노 #날씨 #기상청 #shorts

**hanban3** — 가을 하늘이 유독 높고 파란 이유
> 하늘이 파란 건 파란빛이 공기에 더 잘 흩어지기 때문(레일리 산란). 먼지와 수증기가 많으면 모든 빛이 흩어져 하늘이 희뿌예지는데, 가을엔 건조한 이동성 고기압이 자주 찾아와 공기가 맑고 투명해집니다. 2025년 서울 초미세먼지 평균은 봄 24㎍/㎥, 가을 13㎍/㎥. 위성사진: 2023년 4월 12일 황사 날(서울 미세먼지 260) vs 2025년 10월 28일(22).
> 출처: 기상청 보도자료(2010.10.1)·3개월 전망 · 서울시 대기환경정보 계절별 평균 · NASA Space Place "Why Is the Sky Blue?" · 미국 기상청 구름 분류
> 사진·영상: NASA(Worldview MODIS, 국제우주정거장), Ron Clausen (CC0), Hankook12 (CC0), "Time lapse clouds" Johann Mynhardt (CC BY 2.0, https://creativecommons.org/licenses/by/2.0/). NASA는 이 영상을 보증하지 않습니다.
> 음악: "Dreamer" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #가을하늘 #미세먼지 #날씨 #과학 #shorts

**hanban4** — 한국에서 오로라가 찍힌 날 ㄷㄷ
> 2024년 5월, 2003년 이후 처음으로 최고 등급(G5) 지자기 폭풍이 지구를 덮쳤습니다. 이때 경북 영천 보현산천문대의 전천카메라에 붉은 오로라가 잡혔고(한국천문연구원), 5월 12일 새벽 강원 화천에서도 아마추어 천문가들이 촬영에 성공했습니다. 다만 눈으로는 거의 보이지 않았고 장노출 카메라에만 찍혔습니다. ※ 영상 속 오로라는 같은 폭풍 때 미국 유타·아이다호에서 NASA가 촬영한 것입니다.
> 출처: 한국천문연구원 참고자료(2024.5.13) · NOAA SWPC · USGS 지자기 프로그램 · NASA "How NASA Tracked the Most Intense Solar Storm in Decades", "Auroras"
> 사진·영상: NASA/SDO, NASA/Bill Dunford, NASA(국제우주정거장). NASA는 이 영상을 보증하지 않습니다.
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #오로라 #태양폭풍 #보현산천문대 #우주 #shorts
