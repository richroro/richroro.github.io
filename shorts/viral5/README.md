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
