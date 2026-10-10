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

- `shorts/<id>/script.json` — 대사(`say`, `|`로 호흡), 자막(`cap`, `/`로 페이지, `[키워드]`는 노란색, `{키워드}`는 빨강)
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

- **제목**: `"titleStyle": "band"`이면 둘째 줄이 노랑이다. 줄 안에 `[핵심어]`를 쓰면 그 단어만 노랑이 된다. `"titleKey": "#ff2a2a"`로 강조색을 바꿀 수 있다(괴담은 빨강).
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
  | `bg` | 배경 `class` `home` `street` `store` `army` `night` `stage` `office` `door`(현관문·초인종) `hospital`(병실 창·침대), 또는 CSS 배경. 칠판(`class`)에 `sign`이 있으면 `big`은 칠판 아래로 내려온다 |
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

## 썰 쇼츠 (`sseol13`~`sseol16`)

가족·동네 창작 썰 4편. 모두 지어낸 이야기이고, 카드 `meta`는 "익명 · 창작 썰"이다. 음악 gain 0.2, 화면 크레딧 없음. 줄마다 faster-whisper(medium)로 알아듣는지 확인했다.

| id | 제목 띠 | 길이 | 한 줄 줄거리 | 음악 |
| --- | --- | --- | --- | --- |
| `sseol13` | 외할머니가 내 전화만 / 3초 늦게 받는 이유 | 38.8초 | 엄마 전화는 바로 받는 외할머니가 내 전화만 늦게 받는 건, 여덟 살 때 내가 녹음해 준 "할머니 사랑해!" 벨소리를 끝까지 듣고 싶어서. 요즘은 하루 세 번 거는데, 할머니는 끊고 다시 걸라고 한다. | Scheming Weasel |
| `sseol14` | 우리 집 강아지가 / 아빠 퇴근을 미리 아는 이유 | 38.5초 | 아빠 퇴근 10분 전마다 현관에 앉는 초코. 아빠가 주차장에서 엄마한테 전화하면 엄마가 "아빠 오신다~" 하는 걸 외운 것. 엄마가 장난으로 한 번 말한 날, 진짜 온 아빠는 한 시간 동안 외면당했다. | Hyperfun |
| `sseol15` | 독서실 사장님이 매일 / 내 자리에 핫팩 두는 이유 | 36.5초 | 한여름에도 매일 저녁 내 자리에 놓이던 핫팩은, 에어컨 바로 밑에서 떠는 나를 본 사장님이 둔 것. 다음 날 그 에어컨엔 사장님 글씨로 "고장"이 붙었다. | Sneaky Snitch |
| `sseol16` | 할아버지가 매일 / 같은 나무만 찍는 이유 | 36.0초 | 할아버지가 매일 같은 나무를 찍은 건, 오래 입원한 할머니한테 창밖 계절을 하루 한 장씩 보내려고. 오늘 퇴원한 할머니가 직접 보고 "사진보다 예쁘네", 할아버지는 "내일부턴 당신을 찍어야지". | Monkeys Spinning Monkeys |

제목 띠는 한 줄 12자 안팎에 맞추려고 받은 제목에서 조금 줄였다(`sseol14` "아빠 퇴근 / 10분 전에만 현관에 앉는 이유" → "아빠 퇴근을 미리 아는 이유", `sseol15` "핫팩을" → "핫팩", `sseol16`은 줄 나눔만 바꿈).
`sseol13`의 벨소리(`i`)는 녹음된 소리라 `sseol8`처럼 말풍선 대신 🎵 자막으로 보여 준다.

**목소리**(`script.json`의 `voices`)

- `sseol13`: 내레이터 `SunHi` +12%, 나 `SunHi` +12%·+8Hz, 8살 나(벨소리) `SunHi` +15%·+30Hz, 외할머니 `SunHi` −8%·−10Hz
- `sseol14`: 내레이터 `SunHi` +12%, 나 `SunHi` +12%·+8Hz, 엄마 `SunHi` +5%·−10Hz, 아빠 `InJoon` +5%·−8Hz
- `sseol15`: 내레이터 `InJoon` +12%, 나 `InJoon` +12%·+10Hz, 사장님 `HyunsuMultilingual` 0%·−8Hz
- `sseol16`: 내레이터 `SunHi` +12%, 나 `SunHi` +12%·+8Hz, 할아버지 `InJoon` −5%·−15Hz, 할머니 `SunHi` −8%·−10Hz

**업로드 문구**

`sseol13`
- 제목: 외할머니가 내 전화만 3초 늦게 받는 이유ㅠㅠ
- 설명:
  ```
  엄마 전화는 바로 받으시는데, 내 전화만 꼭 늦게 받는 외할머니 📱 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #할머니 #가족썰

`sseol14`
- 제목: 우리 집 강아지가 아빠 퇴근을 미리 아는 이유ㅋㅋ
- 설명:
  ```
  퇴근 10분 전마다 현관에 앉는 우리 집 초능력견 🐶 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #강아지 #가족썰

`sseol15`
- 제목: 독서실 사장님이 매일 내 자리에 핫팩 두는 이유
- 설명:
  ```
  한여름에도 매일 저녁 내 자리에 놓여 있던 핫팩의 정체 ♨️ (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물과 장소는 실제와 관계없습니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #독서실 #고3

`sseol16`
- 제목: 할아버지가 매일 같은 나무만 찍는 이유
- 설명:
  ```
  매일 아침 같은 자리, 같은 각도로 찍은 나무 사진의 비밀 🌳 (창작 썰)
  이 이야기는 지어낸 창작 썰입니다. 등장인물은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0
  ```
- 해시태그: #썰 #창작썰 #썰툰 #할아버지 #가족썰

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

## 생활 상식 “~하는 이유” 쇼츠 (`life1`~`life4`)

질문형 해설 + 스톡 실사 B-roll 방식(`research/research-info.md` 형식 A)입니다. 위쪽 검정 띠에 두 줄 제목이 0초부터 끝까지 있고, 가운데 정사각 화면은 2~3초마다 바뀌는 실제 영상·사진이며, 아래에 한 줄 자막이 붙습니다. 내레이션은 Edge TTS `ko-KR-InJoonNeural` `+20%`이고, 마지막 줄 직후에 바로 끊습니다. 그래픽 카드는 쓰지 않았고 군 영상(DVIDS 등)도 없습니다.

| id | 띠 제목 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `life1` | 비행기 창문이 / 네모가 아닌 진짜 이유 | 28.6초 | 둥근 모서리 창 → 1954년 코멧 2대 공중분해 → 물탱크 압력 시험 → 네모난 창 모서리에서 균열(실제로는 지붕 안테나 창·비상구 창이라고 스티커로 밝힘) → 각진 모서리에 힘이 몰림 → 그래서 둥글게 | Movement Proposition |
| `life2` | 엘리베이터 거울이 / 셀카용이 아닌 진짜 이유 | 29.1초 | 엘베 거울 셀카 → “기다림이 덜 지루하라고”는 흔한 설 → 진짜 이유는 법에 있음 → 휠체어는 안에서 못 돌아서 후진으로 내림 → 뒷벽 0.6m 이상 높이에 견고한 거울 → 돌 수 없는 장애인용 승강기는 의무 → “휠체어의 백미러” | Sneaky Snitch |
| `life3` | 제한속도 지켜도 / 1차로에서 단속되는 이유 | 27.4초 | 인천대교 ‘급차선 변경 집중 단속중(고속도로순찰대)’ 전광판 → 편도 3차로 이상 고속도로 1차로는 앞지르기 차로 → 추월 후 오른쪽으로 → 지정차로 위반 승용 4만 원·벌점 10점(승합 5만 원) → 시속 80km 미만 정체 땐 예외 → “여러분은 몇 차로?” | Exhilarate |
| `life4` | 이착륙 때 창문 덮개 / 열라고 하는 진짜 이유 | 30.7초 | 창밖 상황 빨리 발견·대응 → 정전 시 바깥 빛으로 비상구 찾기 → 밖에서도 기내 확인 → 조명 낮추는 것도 눈의 어둠 적응 → 반전: 대한항공은 2021년부터 의무 아닌 권고, 날개 위·비상구 창은 여는 게 원칙 → “여러분은 열어 두시나요?” | Floating Cities |

```bash
# 원본: media/life/sources.json 의 주소에서 받아 1080p로 다시 인코딩해 public/life*/src/ 에 (파일 이름은 edit.json sources.file)
# life3 운전 영상 3개(36017323, 36108436, 35186893)는 번호판이 안 읽히도록 화면 아래 42%를 흐리게 처리:
ffmpeg -i <원본>.mp4 -filter_complex "[0]scale=-2:1080,split[a][b];[b]crop=iw:ih*0.42:0:ih*0.5,gblur=sigma=5[c];[a][c]overlay=0:H*0.5" -an px<id>.mp4
for id in life1 life2 life3 life4; do python3 voice_edge.py $id && python3 prep.py $id && ./render.sh $id final/$id.mp4; done
for id in life1 life2 life3 life4; do python3 qa_review.py $id; done   # 네 편 모두 FAIL·WARN 없음
```

### 사실과 출처 (2026-10-09 확인)

**life1 — 코멧 사고와 둥근 창**
- [FAA Lessons Learned: de Havilland Comet](https://www.faa.gov/lessons_learned/transport_airplane/accidents/G-ALYV): BOAC 781편(G-ALYP) 1954.1.10 엘바섬 근처 공중분해 35명 사망, 남아공항공 201편(G-ALYY) 1954.4.8 나폴리 근처 21명 사망. 물탱크 시험 기체 G-ALYU는 실제 비행 1,230회 뒤 탱크 ‘비행’ 1,830회 만에 “squarish forward escape hatch window” 모서리에서 파손. 엘바 사고의 첫 균열은 동체 지붕의 “ADF windows, also squarish”. 결론: “squarish windows were creating stress concentrations… fatigued the material around the window corners.”
- [DH Aircraft Heritage – Comet 1 inquiry](https://www.dh-aircraft.co.uk/aircraft/dh106/comet1/inquiry/): 균열은 지붕의 ADF 창에서 시작해 앞쪽 창으로 이어짐, 3,060회 압력 주기 뒤 파손.
- [Aerossurance – Comet misconceptions](https://aerossurance.com/safety-management/comet-misconceptions/): “객실 네모 창 때문에 추락했다”는 단순화된 설명이고 나폴리 사고 기원은 확인되지 않았다는 점. 그래서 내레이션은 “네모난 창의 모서리”라고만 하고, 화면 스티커로 “실제 균열: 지붕 안테나 창·비상구 창 모서리”를 밝혔습니다. “세계 첫 제트 여객기”는 코멧 1이 1952년 5월 BOAC 런던–요하네스버그 노선으로 세계 첫 정기 제트 여객 운항을 한 기종이라는 뜻입니다([This Day in Aviation](https://www.thisdayinaviation.com/tag/de-havilland-dh-106-comet-1/)). “칠십 년 전”은 1954년 기준 어림수(72년)입니다.

**life2 — 엘리베이터 거울**
- [장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 [별표 1]](https://www.law.go.kr/법령/장애인·노인·임산부등의편의증진보장에관한법률시행규칙/별표) (시행 2026.7.2., 별표 1 개정 2023.12.11.) 9. 장애인용 승강기 라. 기타 설비 (2): “승강기 내부의 후면에는 내부에서 휠체어가 180도 회전이 불가능할 경우에는 휠체어가 후진하여 문의 개폐여부를 확인하거나 내릴 수 있도록 승강기 후면의 0.6미터 이상의 높이에 견고한 재질의 거울을 설치하여야 한다.”
- 적용 대상(장애인용 승강기를 둬야 하는 시설)은 같은 법 시행령 [별표 2]. 그래서 “모든 엘리베이터”가 아니라 “휠체어가 돌 수 없는 장애인용 승강기라면 의무”라고 말했습니다. “기다림이 덜 지루하라고”는 1차 출처가 없는 통설이라 “흔히 ~ 하는데요”로만 소개했습니다.

**life3 — 고속도로 1차로**
- [도로교통법](https://www.law.go.kr/법령/도로교통법) (시행 2026.7.1.) 제60조①(고속도로에서 행정안전부령으로 정하는 차로에 따라 통행), 제60조②(앞지르기는 정해진 차로로).
- [도로교통법 시행규칙](https://www.law.go.kr/법령/도로교통법시행규칙) (시행 2026.8.24.) 제16조③(중앙선 쪽부터 1차로), [별표 9] 고속도로 편도 3차로 이상 1차로: “앞지르기를 하려는 승용자동차 및 앞지르기를 하려는 경형·소형·중형 승합자동차. 다만, 차량통행량 증가 등 도로상황으로 인하여 부득이하게 시속 80킬로미터 미만으로 통행할 수밖에 없는 경우에는 앞지르기를 하는 경우가 아니라도 통행할 수 있다.” [별표 28] 21. 지정차로 통행위반(제60조제1항 포함) 벌점 10점.
- [도로교통법 시행령 [별표 8]](https://www.law.go.kr/법령/도로교통법시행령) (시행 2026.10.2.) 39. 고속도로 지정차로 통행 위반(제60조제1항): 승합자동차등 5만 원, 승용자동차등 4만 원.
- 언론·정부 확인: [SBS 2025.7.16](https://news.sbs.co.kr/news/endPage.do?news_id=N1008178713) “벌점 10점에 승용차 운전자에게는 범칙금 4만 원, 승합차는 5만 원”, [정책브리핑 2023.7.25](https://www.korea.kr/news/policyNewsView.do?newsId=148918108) “1차로(추월차로)… 벌점 10점… 승용 4만 원 / 승합 5만 원”.
- 화면의 “고속도로 급차선 변경 집중 단속중(고속도로순찰대)” 전광판은 Pexels 영상(인천대교 구간으로 보임) 속 실제 표지이고, 지정차로 단속과는 별개의 안내입니다. 내레이션은 전광판을 설명하지 않습니다.

**life4 — 이착륙 때 창문 덮개**
- [대한항공 뉴스룸 2023.9.6 「항공상식 Q&A」](https://news.koreanair.com/항공상식qa-우리-비행기는-곧-착륙하오니-이-것/): “이·착륙 시 창문 밖으로 벌어지는 상황을 신속하게 발견하고 빠르게 대응”, “혹 기내가 정전이 될 경우 바깥의 불빛에 의지해 비상구를 찾거나…”, “외부에서도 항공기 내부 상황을 확인해 대처”, 조명을 낮추는 것은 “승객들의 눈을 어둠에 빠르게 적응하도록 하는 예방 조치”, “대한항공은 2021년부터 이·착륙 시 창문 덮개를 열어두는 것을 의무가 아닌 권고 사항으로 실시”, “날개 위쪽, 비상구 창문 등은 법적으로 개방하는 것이 원칙”.
- 미국 FAA에는 창문 덮개 규정이 없고 항공사마다 다르다는 점(예: [AFAR](https://www.afar.com/magazine/why-do-window-shades-have-to-be-open-for-takeoff-and-landing))을 고려해 “항공사·공항마다 규정이 다를 수 있음” 스티커를 붙였습니다. “사고는 대부분 이착륙 때” 같은 통계는 출처를 확인하지 못해 쓰지 않았습니다.

### 영상·사진과 라이선스
모든 원본의 페이지·파일 주소·제작자·라이선스·쓴 구간은 `media/life/sources.json`과 각 `edit.json`의 `sources`에 있습니다. 화면에는 “영상: Pexels”, “사진: Pexels”, “영상: Pixabay”, “사진: 영국 정보부(IWM TR 6113)”만 표시합니다.
- **Pexels License**: 상업적 이용·수정 가능, 출처 표기 불필요(식별 가능한 인물을 나쁘게 보이게 하거나 보증을 암시하는 사용 금지). 이번 쇼츠의 인물 장면은 셀카·대기·탑승 등 중립적 장면뿐입니다.
  - life1: 10710412 Afif Ramdhasuma, 3740041 K, 11292266 Alireza Akhlaghi, 2023708 Sher Lyn ., 8511231 Lukas L, 35839565 Rise Within Studio, 3785721 Taryn Elliott
  - life2: 사진 32571093 Anna Holodna, 17489439 Zakhar Vozhdaienko, 7722159 Max Vakhtbovych; 영상 5378938 cottonbro studio, 15434928 Yusuf Çelik, 7423581 Gustavo Fring, 8400828 SHVETS production, 8525792 cottonbro studio
  - life3: 36017323 Raphael Kim, 18565055 FREE VIDEO HAPPY, 36108436 Airam Dato-on, 35186893 Nothing Ahead, 4608282 K, 28690652 SHOX ART
  - life4: 18749262 Dilara Hazıroğlu, 10710412 Afif Ramdhasuma, 3723453 K, 35576270 Content Kiosk, 3701057 K, 35507462 Grigoriy Bunkov, 3740041 K, 3740022 K, 3785721 Taryn Elliott
- **Pixabay Content License**: [131012 Jesehab](https://pixabay.com/videos/inside-elevator-elevator-rise-131012/) (life2 엘리베이터 안·문 열림).
- **퍼블릭 도메인(PD-UKGov)**: [BOAC Comet, Entebbe 1952](https://commons.wikimedia.org/wiki/File:BOAC_Comet_1952.jpg), Ministry of Information official photographer, Imperial War Museums TR 6113 (1957년 6월 1일 이전 촬영된 영국 정부 사진). 코멧 잔해 사진(CC BY-SA)은 쓰지 않았습니다.
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0.

### 업로드 문구

**life1** — 비행기 창문이 네모가 아닌 진짜 이유 ✈️
> 1954년, 세계 첫 제트 여객기 ‘코멧’ 두 대가 석 달 사이 하늘에서 부서졌습니다. 동체를 통째로 물탱크에 넣고 압력을 수천 번 넣었다 빼는 시험 끝에 찾은 원인은 네모난 창(지붕 안테나 창·비상구 창) 모서리의 금속 피로. 그래서 지금 비행기 창문은 모서리를 둥글게 만듭니다. (출처: FAA Lessons Learned – de Havilland Comet)
> 영상: Pexels (Afif Ramdhasuma, K, Alireza Akhlaghi, Sher Lyn, Lukas L, Rise Within Studio, Taryn Elliott) · 사진: BOAC Comet 1952, Ministry of Information/Imperial War Museums (퍼블릭 도메인)
> 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #비행기 #비행기창문 #항공상식 #생활상식 #shorts

**life2** — 엘리베이터 거울이 셀카용이 아닌 진짜 이유 🪞
> 엘리베이터 거울, 기다림이 덜 지루하라고 달았다는 얘기 들어 보셨죠? 우리 법에는 다른 이유가 적혀 있습니다. 「장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙」 [별표 1]: 휠체어가 안에서 180도 돌 수 없는 장애인용 승강기는, 후진하며 문이 열렸는지 확인할 수 있도록 뒷벽 0.6m 이상 높이에 견고한 거울을 달아야 합니다. (2026년 10월 기준, law.go.kr)
> 영상·사진: Pexels (Anna Holodna, Zakhar Vozhdaienko, Max Vakhtbovych, cottonbro studio, Yusuf Çelik, Gustavo Fring, SHVETS production), Pixabay (Jesehab)
> 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #엘리베이터 #엘베거울 #생활상식 #휠체어 #shorts

**life3** — 제한속도 지켜도 1차로에서 단속되는 이유 🚗
> 편도 3차로 이상 고속도로의 1차로는 앞지르기할 때만 쓰는 차로입니다(도로교통법 시행규칙 별표 9). 계속 달리면 고속도로 지정차로 위반 — 승용차 범칙금 4만 원, 승합차 5만 원, 벌점 10점. 단, 정체로 시속 80km 미만일 땐 예외입니다. (2026년 10월 기준, law.go.kr) 여러분은 몇 차로로 달리시나요?
> 영상: Pexels (Raphael Kim, FREE VIDEO HAPPY, Airam Dato-on, Nothing Ahead, K, SHOX ART)
> 음악: "Exhilarate" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #고속도로 #1차로 #지정차로 #운전상식 #shorts

**life4** — 이착륙 때 창문 덮개 열라는 진짜 이유 ✈️
> 이착륙 때 창문 덮개를 열어 두면 창밖 상황을 빨리 발견할 수 있고, 정전 때 바깥 빛으로 비상구를 찾을 수 있고, 밖에서도 기내를 확인할 수 있습니다. 조명을 낮추는 것도 눈이 어둠에 적응하도록 하는 것. 다만 대한항공은 2021년부터 의무가 아닌 권고로 운영하고, 날개 위·비상구 창문은 여는 게 원칙입니다(대한항공 뉴스룸 2023.9). 항공사마다 규정은 다를 수 있어요. 여러분은 이착륙 때 창문, 열어 두시나요?
> 영상: Pexels (Dilara Hazıroğlu, Afif Ramdhasuma, K, Content Kiosk, Grigoriy Bunkov, Taryn Elliott)
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #비행기 #항공상식 #창문덮개 #대한항공 #shorts
**issue4** — 노벨물리학상 받은 남극 얼음 덩어리의 정체 🧊
> 2026년 노벨물리학상은 남극 얼음 1km³를 통째로 검출기로 만든 '아이스큐브 중성미자 관측소'를 이끈 프랜시스 할젠 교수에게 돌아갔습니다(10월 6일 발표, 단독 수상). 얼음 속 1,450~2,450m에 심은 센서 5,160개가 중성미자가 드물게 부딪힐 때 나는 빛을 잡아, 2013년 우주에서 온 고에너지 중성미자를 처음 확인했습니다. 중성미자는 지금도 1초에 약 100조 개씩 우리 몸을 통과합니다.
> 출처: 노벨위원회 발표(서울신문·한국일보 보도), IceCube 공식 자료, NASA / 영상: NASA 고다드 우주비행센터 애니메이션 · 사진: John Hardin(CC BY 4.0), IceCube Collaboration 구조도(CC BY 4.0), 미국 국립과학재단(NSF). NASA·NSF가 이 영상을 보증하지 않습니다.
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #노벨물리학상 #중성미자 #아이스큐브 #남극 #shorts

### 2차: `life5`~`life8` (31~45초)

같은 형식(검정 띠 제목 + 실사 영상·사진 + 한 줄 자막, Edge TTS InJoon +20%)입니다. 군 영상은 없습니다. `qa_review.py` 네 편 모두 FAIL·WARN 없음(30MB를 넘은 life5·life8은 CRF 22로 다시 인코딩). 출처 기록은 `media/life/sources2.json`과 각 `edit.json`의 `sources`에 있습니다.

| id | 띠 제목 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `life5` | 신호등 노란불이 / 3초인 진짜 이유 | 37.5초 | 대부분 교차로가 3초 → 노란불은 “정지선 앞에서 멈추라”는 신호(시행규칙 별표 2) → 시속 50km는 멈추는 데 2.46초(KOTI) → 시속 70km는 5.9초, 딜레마존 → 2024년 대법원 “못 멈출 거리였어도 신호위반” → “밟는 시간이 아니라 줄이라는 시간” | Hustle |
| `life6` | 비상구 표시가 / 초록색인 진짜 이유 | 35.1초 | “연기 속 초록이 잘 보여서”는 근거 부족(연기 실험에서 빨강·초록 비슷) → 국제표준에서 초록은 안전, 빨강은 금지·소방 장비 → 소방청 고시: 피난구유도등은 녹색 바탕에 백색 문자 → 달리는 사람 그림은 1970년대 일본 공모전 → 1980년대 ISO 채택 → 미국엔 빨간 EXIT도 많지만 한국은 초록 | Lightless Dawn |
| `life7` | 볼펜 뚜껑에 / 구멍이 뚫린 진짜 이유 | 35.4초 | “잉크 마르지 말라고?” → 아님, ISO 11540 → 아이가 뚜껑을 들이마셔 기도가 막히는 위험 → 14세 이하용 펜 뚜껑은 크게(16mm 게이지) 또는 공기가 통하게 → 분당 8L, 지름 약 2mm 구멍 하나면 충분 → 질식을 완전히 막진 못해도 시간을 벎 → 한국 학용품 안전기준에도 마킹펜 뚜껑 질식 기준 → “뚜껑 씹는 버릇 있으세요?” | Scheming Weasel |
| `life8` | 지하철 임산부 배려석이 / 분홍색인 진짜 이유 | 36.3초 | 2013.12 서울 지하철 1~8호선 칸당 2석 시작, 처음엔 엠블럼뿐 → 눈에 안 띄어 참여 저조 → 2015년 좌석·등받이·바닥까지 분홍 ‘핑크카펫’(새 생명을 품은 임산부 환영) → 임신 초기는 티가 안 남 → 2016년 1~8호선 7,140석 → “분홍 자리, 비워 두시나요?” | Heartwarming |

#### 사실과 출처 (2026-10-10 확인)

**life5 — 노란불 3초**
- [한국교통연구원 카드뉴스 「황색신호와 딜레마존」 2025.5.21](https://www.koti.re.kr/user/bbs/cardnewsView.do?bbs_no=69012): “현실에서는 대부분의 신호교차로에서 3초의 황색 현시시간을 부여하고 있고”, “주행속도별(50km/h, 60km/h, 70km/h, 100km/h)로 각각 2.46초, 3.58초, 5.90초, 10~11초의 정지시간이 필요”, 딜레마존 정의. 출처는 KOTI 수시연구 「신호교차로 통행권 전환시간 정의 재정립 연구」.
- 법령에는 황색 시간을 3초로 정한 조항이 없습니다(도로교통법 시행규칙 [별표 3]에도 없음). 그래서 “대부분 딱 3초”라고만 하고 화면에 “법정 시간은 아님”을 붙였습니다. 경찰청 「교통신호기 설치·관리 매뉴얼」 원문은 확인하지 못했습니다.
- 황색 등화의 뜻: 도로교통법 시행규칙 [별표 2] — “차마는 정지선이 있거나 횡단보도가 있을 때는 그 직전이나 교차로의 직전에 정지하여야 하며, 이미 교차로에 차마의 일부라도 진입한 경우에는 신속히 교차로 밖으로 진행하여야 한다.”
- 대법원 3부 판결(2024.5 보도): “교차로 진입 전 황색 신호로 바뀐 이상 차의 정지거리가 정지선까지의 거리보다 길 것으로 예상되더라도, 교차로 직전에 정지하지 않았다면 신호를 위반했다고 보는 게 타당하다” — [세계일보 2024.5.13](https://www.segye.com/newsView/20240513501777), [문화일보](https://www.munhwa.com/article/11429407). 사건은 제한속도 40km/h 도로에서 61km/h로 달리던 차가 정지선 약 8.3m 앞에서 황색으로 바뀐 경우(1심 무죄 → 파기환송).

**life6 — 비상구 초록**
- 소방청 고시 「유도등의 형식승인 및 제품검사의 기술기준」(시행 2024.4.1., 제2024-6호) 제2조 2호: 피난구유도등은 “녹색등화의 유도등”, 제9조 ②: “유도등의 표시면 색상은 피난구유도등인 경우 녹색바탕에 백색문자로, 통로유도등인 경우는 백색바탕에 녹색문자를 사용하여야 한다.”, 제9조 ①: “국제표준화기구(ISO)의 기준에 의한 그림문자를 준용” (law.go.kr 행정규칙).
- ISO 3864(안전색: 초록 = 안전 상태, 빨강 = 금지·소방 장비), ISO 7010 E001(비상구 그림문자). 달리는 사람 그림은 1978~79년 일본 소방청 공모에서 오타 유키오가 디자인, 1980년대 ISO 채택(채택 연도는 자료마다 1984·1985·1987로 달라 “1980년대”로만 표기).
- “연기 속에서 초록이 더 잘 보인다”는 통설: 연기 챔버 연구 요약에서 빨강·초록 표지의 가시성은 비슷하고 밝기·연기 농도가 더 중요했다는 결과(예: [Hull 대학 논문](https://hull-repository.worktribe.com/OutputFile/4213042), [arXiv 2404.11439](https://arxiv.org/abs/2404.11439)). 그래서 “연구로 뒷받침되지 않는다”가 아니라 “연기 실험에선 빨강과 초록이 비슷하게 보였다”고만 말합니다.
- 미국 비상구 표시는 빨강·초록이 함께 쓰입니다(“빨간 EXIT도 많다”).

**life7 — 볼펜 뚜껑 구멍**
- ISO 11540:2021 (Pens and refill caps for children up to 14 years — 3판): 서문 “If a child inhales a pen cap it might become lodged below the larynx and block the trachea. The risk of asphyxiation can be reduced if the pen cap is ventilated or too large to enter the airway.” 4.2: 16mm 링 게이지를 통과하지 못하는 뚜껑은 흡입 위험이 없는 크기, 4.3: “caps shall permit a minimum air flow of 8 l/min … with a maximum pressure drop of 1,33 kPa”, 비고: 단일 원형 구멍 “approximately 3,4 mm²”이면 충족 예상(지름 약 2.1mm). 서문은 목적을 질식을 “delay … pending medical intervention”으로 설명 → “병원에 갈 시간을 벌어 준다”.
- 한국: 산업통상자원부 공고 제2016-492호(학용품 안전기준 개정안, [WTO 통보문](https://members.wto.org/crnattachments/2016/TBT/KOR/16_4257_01_x.pdf)) “마킹펜류의 뚜껑은 6.8에 따라 시험했을 때 적합하거나, 질식 위험에 대한 경고 표시를 하여야 함”. 부록 수치와 현행 고시 번호는 확인하지 못해 수치 없이 “질식 기준이 있다”고만 말합니다.
- “잉크 마름·기압 때문”은 ISO가 밝힌 목적이 아니라 화면에서 “아닙니다”로 처리했습니다.

**life8 — 임산부 배려석 분홍**
- [서울시 교통 2013](https://news.seoul.go.kr/traffic/archives/13937): “12.2(월)부터 지하철 1~8호선 열차 1칸 당 2석 씩 ‘임산부 배려석’을 본격 운영”, 처음엔 30cm 엠블럼 표시.
- [서울시 미디어허브 2015.7.23](https://mediahub.seoul.go.kr/archives/894957): “좌석과 등받이, 바닥까지 ‘분홍색’으로 연출해 주목도를 높이기로”, 핑크카펫은 “미래 주인공이 될 새 생명을 잉태한 임산부를 환영한다는 뜻”, “입덧 등으로 힘든 초기 임신부는 외관상으론 표시가 나지 않아 자리를 양보 받지 못하는 경우가 많다”.
- [뉴스토마토 2016.1.15](https://www.newstomato.com/ReadNews.aspx?no=615973): 배려석 “인지 및 참여도가 낮게 나타나면서” 확대, “1~8호선 전체 임산부 배려석 7,140석”(2016년 기준, 현재 수는 확인 못 함).

#### 영상·사진과 라이선스
- Pexels License — life5: 33825909 SHOX ART, 3999410 K, 17041886 Ben Garves, 5921059 Aleks Magnusson, 1390281 Zuzanna Musial, 31801544 Paul Bill(광화문), 34507814 JMT 35, 39573529 Yasemin Gül / life6: 사진 31827772 Nischal Pradhan, 37643871 Norbert Szomszéd, 24702725 Jakub Zerdzicki, 영상 7644222 Yaroslav Shuraev, 3134591 Caleb Oquendo, 16657022 Erik Mclean, 14595546 Mustafa Akkuş, 28957437 Paolo San, 31801555 Paul Bill(서울 지하철) / life7: 6878203 cottonbro studio, 28405798 Адам Аушев, 5601055·5599021 Allan Mas, 12760956 Mizuno K, 3678073 cottonbro studio, 6324531 Vanessa Garcia / life8: 사진 36621878 wal_ 172619(서울 지하철), 영상 31801555 Paul Bill, 36302344 Earth Photart, 7677215 PNW Production, 27355485 Orhan Pergel, 8772870 KADO FUETA.
- Wikimedia Commons — life7: [02](https://commons.wikimedia.org/wiki/File:02-BICcristal2008-03-26.jpg)·[04](https://commons.wikimedia.org/wiki/File:04-BICcristal2008-03-26.jpg)·[05-BICcristal2008-03-26.jpg](https://commons.wikimedia.org/wiki/File:05-BICcristal2008-03-26.jpg), Trounce, CC BY 3.0(GFDL과 이중 라이선스 중 CC BY 3.0 선택; 같은 범주의 Carlos Delgado 사진들은 CC BY-SA라 쓰지 않음). 화면 표기 “사진: Trounce (CC BY 3.0)”. life8: [Designated seats for pregnant women of Seoul Metro Line 1 in 2018.jpg](https://commons.wikimedia.org/wiki/File:Designated_seats_for_pregnant_women_of_Seoul_Metro_Line_1_in_2018.jpg), Garam, {{Attribution}}(“allows anyone to use it for any purpose, provided that the copyright holder is properly attributed”; 국내 신문·페이스북 약관과는 호환되지 않는다는 안내가 있어 그 플랫폼에는 올리지 말 것). 화면 표기 “사진: Garam (위키미디어 공용)”.
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0.

#### 업로드 문구

**life5** — 신호등 노란불이 3초인 진짜 이유 🚦
> 대부분의 교차로 노란불은 3초. 시속 50km면 멈추는 데 2.46초라 충분하지만, 시속 70km면 5.9초가 필요해 ‘딜레마존’이 생깁니다(한국교통연구원). 노란불은 ‘정지선 앞에서 멈추라’는 신호이고(도로교통법 시행규칙 별표 2), 2024년 대법원은 못 멈출 거리였어도 정지선 앞에서 안 멈췄다면 신호위반이라고 봤습니다. 노란불 3초는 밟는 시간이 아니라 미리 줄이라는 시간!
> 영상: Pexels (SHOX ART, K, Ben Garves, Aleks Magnusson, Zuzanna Musial, Paul Bill, JMT 35, Yasemin Gül)
> 음악: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #신호등 #노란불 #딜레마존 #운전상식 #shorts

**life6** — 비상구 표시가 초록색인 진짜 이유 🟩
> 비상구 표시가 초록인 건 연기 속에서 더 잘 보여서가 아니라 국제 약속 때문입니다. 국제표준(ISO 3864·7010)에서 초록은 ‘안전’, 빨강은 ‘금지·소방 장비’. 우리 소방청 기준도 피난구유도등은 녹색 바탕에 흰 문자로 정해 뒀어요. 달리는 사람 그림은 1970년대 일본 공모전에서 나와 1980년대 국제표준이 됐습니다. (2026년 10월 기준)
> 영상·사진: Pexels (Nischal Pradhan, Norbert Szomszéd, Jakub Zerdzicki, Yaroslav Shuraev, Caleb Oquendo, Erik Mclean, Mustafa Akkuş, Paolo San, Paul Bill)
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #비상구 #생활상식 #소방 #픽토그램 #shorts

**life7** — 볼펜 뚜껑에 구멍이 뚫린 진짜 이유 🖊️
> 볼펜 뚜껑 끝 구멍은 잉크 때문이 아니라 아이 안전 때문입니다. 국제표준 ISO 11540은 14세 이하 아이가 쓸 만한 펜의 뚜껑을 충분히 크게 만들거나, 분당 8리터 이상 공기가 통하게 하라고 정합니다. 지름 약 2mm 구멍 하나면 충분하고, 질식을 완전히 막진 못해도 병원에 갈 시간을 벌어 줘요. 우리 학용품 안전기준에도 마킹펜 뚜껑 질식 기준이 있습니다. 볼펜 뚜껑 씹는 버릇, 있으신가요?
> 영상: Pexels (cottonbro studio, Адам Аушев, Allan Mas, Mizuno K, Vanessa Garcia) · 사진: Trounce, Wikimedia Commons (CC BY 3.0)
> 음악: "Scheming Weasel (faster version)" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #볼펜 #생활상식 #어린이안전 #ISO #shorts

**life8** — 지하철 임산부 배려석이 분홍색인 진짜 이유 🩷
> 서울 지하철 임산부 배려석은 2013년 12월 1~8호선 칸당 2석으로 시작했지만, 처음엔 작은 엠블럼뿐이라 눈에 잘 띄지 않았습니다. 그래서 서울시는 2015년 좌석·등받이·바닥까지 분홍으로 바꾼 ‘핑크카펫’을 도입했어요. 새 생명을 품은 임산부를 환영한다는 뜻이고, 티가 나지 않는 임신 초기 임산부를 배려하려는 것. 2016년엔 1~8호선 7,140석으로 늘었습니다(서울시 발표). 여러분은 분홍 자리, 비워 두시나요?
> 사진: Garam, Wikimedia Commons · 영상·사진: Pexels (wal_ 172619, Paul Bill, Earth Photart, PNW Production, Orhan Pergel, KADO FUETA)
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #임산부배려석 #핑크카펫 #지하철 #서울지하철 #shorts
## 이번 주 이슈 30초 정리 (`issue1`~`issue4`)

2026년 10월 둘째 주 뉴스 4편. 군사 소재·군 촬영 영상은 쓰지 않습니다. 장르는 하나로 묶었습니다: **정치색 없는 뉴스를 30초에 풀어 주는 질문형 해설**(검정 제목 띠 + 실제 영상·사진 + 1줄 자막 + Edge TTS +20%). 원본은 `media/{nuri,oil,hangul,nobel}/`(영상 파일은 저장소에 넣지 않음, `sources.json`에 페이지·파일 주소·라이선스·크레디트·쓴 구간), 작업 사본은 `public/issueN/src/`.

| id | 제목(화면 띠) | 길이 | 내용 | 정확한 날짜 한계 | 음악 |
| --- | --- | --- | --- | --- | --- |
| `issue1` | 누리호 위성 15기 중 / 1기만 못 나온 이유 | 33.2초 | 10월 7일 5차 발사 성공 → 군집위성 5기 궤도 → 고도 약 570km 분리 → 큐브위성 1기는 사출관 덮개가 안 열려 미분리 → 군집위성 5기 당일 교신 성공 → 내년 5기 더, 한반도 하루 3번 넘게 → 5번 중 4번 성공, 다음은 내년 하반기 | **10월 14일께**까지(발사 1주일. 숫자는 이후에도 맞지만, 큐브위성 교신 결과나 최종 판정 등 우주청 추가 발표가 나오면 그 전에 올리거나 내용 확인) | Heroic Age |
| `issue2` | 기름값 상한제 있는데 / 경유 20% 오른 이유 | 32.4초 | 9월 경유 1년 새 20.0%↑ → 중동 전쟁·국제유가 → 3월 13일 석유 최고가격제 → 상한은 주유소 판매가가 아니라 정유사 공급가 → 경유 상한 1,713원(1차) → 1,773원(10차) → 상한제 없었으면 물가 3.5%(정부 추정) → 지금 상한은 10월 중순까지 | **10월 15일까지**(10차 최고가격은 9월 19일부터 4주 → 16일께 11차 발표. 10월 소비자물가는 11월 초 발표) | Movement Proposition |
| `issue3` | 한글날이 22년 동안 / 쉬는 날 아니었던 이유 | 28.7초 | 1991년부터 공휴일 제외(어려운 경제 여건 등, 국군의 날과 함께) → 2006년 국경일 → 2012년 12월 24일 국무회의 의결로 2013년부터 다시 공휴일 → "한글날에 학교 간 기억 있나요?" | 내용은 늘 맞음. 다만 화제성은 한글날 주간(**10월 12일께**까지). 화면의 "2026년 제580돌 한글날"은 올해만 맞음 | Heartwarming |
| `issue4` | 올해 노벨물리학상 / 남극 얼음 덩어리의 정체 | 33.7초 | 1초에 약 100조 개가 몸을 통과하는 중성미자 → 남극 얼음 1km³ 검출기 아이스큐브, 센서 5,160개 → 2013년 우주 고에너지 중성미자 첫 확인 → 프랜시스 할젠 단독 수상(10월 6일 발표) → 물리학상 단독 수상은 34년 만 | 내용은 계속 맞음. 화제성은 시상식 전후(**10월 말**까지, 늦어도 12월 10일 시상식) | Floating Cities |

### 사실 근거
**issue1 누리호 5차 발사**
- 10월 7일 낮 12시 25분 발사, 주탑재 초소형군집위성(네온샛) 5기 목표 궤도 투입, 큐브위성 10기 중 9기 투입, 1기는 "분리 신호를 받았으나 위성을 내보내는 덮개가 열리지 않음", 분리 고도 570km±15km 기준 충족, 성공률 75%→80%: [파이낸셜뉴스](https://www.fnnews.com/news/202610071826359850), [아시아경제](https://view.asiae.co.kr/article/2026100713324180944), [아이뉴스24](https://inews24.com/view/2012682)(큐브위성 10기 중 9기 분리), [머니투데이방송](https://news.mtn.co.kr/news-detail/2026100717103775939)("정상 분리 신호를 냈지만 사출관 뚜껑이 열리지 않은 것으로 확인")
- 분리 고도 약 575km, 7~11호기 내년 9월 발사, 10기 운용 시 한반도 하루 3회 이상 촬영: [전자신문](https://www.etnews.com/20261007000371)
- 군집위성 5기 교신 전원 성공(13:08~17:52, 세종기지·스발바르 지상국): [정책브리핑 카드(우주항공청)](https://www.korea.kr/multi/visualNewsView.do?newsId=148973195)
- 6차 발사 내년 하반기 목표, 2032년까지 매년 1회 이상: [정책브리핑 우주항공청 기사](https://www.korea.kr/news/policyNewsView.do?newsId=148973163)
- 누리호 1차(2021) 실패, 2·3·4·5차 성공 → 5번 중 4번(80%): 위 기사들의 성공률 75%→80%

**issue2 경유값**
- 2026년 9월 소비자물가 2.9%, 석유류 14.8%, 경유 20.0%, 휘발유 11.8%, 등유 19.5%: [정책브리핑 9월 소비자물가동향 브리핑](https://www.korea.kr/briefing/policyBriefingView.do?newsId=156784092), [이투데이](https://www.etoday.co.kr/news/view/2631864), [서울신문](https://www.seoul.co.kr/news/economy/2026/10/02/20261002500041)
- 최고가격제가 없었다면 9월 3.5%(0.6%p 낮춤, 재정경제부 추정): [이투데이](https://www.etoday.co.kr/news/view/2631784), [뉴데일리](https://biz.newdaily.co.kr/site/data/html/2026/10/02/2026100200046.html)
- 3월 13일 0시 시행, 상한은 정유사 공급가(주유소 판매가 아님), 1차 경유 1,713원: [KDI 경제정보센터(정부 발표)](https://eiec.kdi.re.kr/policy/materialView.do?num=277913), [뉴닉 정리](https://newneek.co/@saltylife/article/39324)
- 중동 전쟁 이후 도입: [에너지경제](https://m.ekn.kr/view.php?key=20260313022247530), 산업통상부 10차 자료("중동정세 불안")
- 10차 경유 1,773원, 9월 19일 0시부터 4주: [산업통상부 참고자료](https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/172224/view), [머니투데이](https://www.mt.co.kr/economy/2026/09/18/2026091816121493397)

**issue3 한글날**
- "1991년 어려운 경제 여건 등을 이유로 공휴일에서 제외된 지 22년 만", "2013년도부터 한글날이 다시 공휴일(12. 24., 국무회의 의결)": [문화체육관광부 보도자료](https://www.mcst.go.kr/kor/s_notice/press/pressView.jsp?pSeq=12511)
- 국군의 날과 함께 1991년부터 제외, 2005년 12월 8일 국회 통과 → 2006년 국경일: [국가기록원 기록으로 보는 국경일](https://theme.archives.go.kr/next/koreaOfRecord/nationHoliday.do)
- 1990년 대통령령 개정으로 국군의 날과 함께 제외(공휴일이 10월에 몰리고 해외 평균 13.4일보다 많다는 이유), 시행은 1991년부터: [서울신문 2024](https://m.seoul.co.kr/news/2024/09/17/20240917500023)
- 2026년은 제580돌(1446년 반포, 2025년 제579돌): [시대일보 2025](https://www.sidae.com/article/2025100116340066353)

**issue4 노벨물리학상**
- 10월 6일 발표, 프랜시스 할젠(82, 위스콘신대) 단독 수상, "아이스큐브 중성미자 관측소에 대한 결정적 기여와 천체 기원 고에너지 중성미자 발견", 약 1km³, 86줄 5,160개 광센서, 최대 2,450m, 2013년 첫 확인, 물리학상 단독 수상 34년 만(1992년 샤르파크 이후): [서울신문](https://www.seoul.co.kr/news/peoples/2026/10/07/20261007023005), [한국일보](https://www.hankookilbo.com/news/article/A2026100709400000234), [Al Jazeera(의학상 등 일정)](https://www.aljazeera.com/news/2026/10/5/nobel-medicine-prize-honours-us-and-german-scientists-for-optogenetics-work)
- 1km³, 5,160개 센서, 1,450~2,450m, 1초에 약 100조 개가 몸을 통과: [IceCube 공식 Facts](https://icecube.wisc.edu/about-us/facts/)
- 중성미자는 물질과 거의 상호작용하지 않아 지구도 통과: [NASA SVS 20281 설명](https://svs.gsfc.nasa.gov/20281)

### 사진·영상 출처와 라이선스
화면에는 짧은 크레디트만 씁니다(오른쪽 위). 라이선스는 여기와 업로드 문구에만 적습니다.
- **issue1** — 한국항공우주연구원(KARI) 공식 영상: [누리호 1차 발사 장면(2021)](https://commons.wikimedia.org/wiki/File:%EB%88%84%EB%A6%AC%ED%98%B8_1%EC%B0%A8_%EC%8B%9C%ED%97%98_%EB%B0%9C%EC%82%AC_%EC%9E%A5%EB%A9%B4.webm), [2차 발사(2022)](https://commons.wikimedia.org/wiki/File:Second_launch_of_the_Korean_Space_Launch_Vehicle-II_on_21_June_2022.webm), [3차 발사·탑재 카메라(2023)](https://commons.wikimedia.org/wiki/File:Third_launch_of_the_Korean_Space_Launch_Vehicle-II_on_25_May_2023.webm) — 모두 위키미디어 공용, **CC BY**(KARI TV가 CC BY로 공개). 사진 [KSLV-II Nuri and the launchpad 01](https://commons.wikimedia.org/wiki/File:KSLV-II_Nuri_and_the_launchpad_01.jpg) — KARI, **공공누리 제1유형**. 5차 발사 자체의 영상·사진은 쓰지 않았습니다(정책브리핑의 5차 영상엔 공공누리 표시가 없고, 기사 사진은 뉴스1·연합뉴스). 그래서 화면에 "자료화면: 지난 발사 영상", "자료화면 · 3차 발사 탑재 카메라" 스티커를 붙였습니다.
- **issue2** — [Filling Up Gas Tank](https://commons.wikimedia.org/wiki/File:Filling_Up_Gas_Tank.webm)(Antti Makkonen / Sounds of Changes, **CC BY 4.0**); [우주정거장에서 본 호르무즈 해협 iss063e002679](https://images.nasa.gov/details/iss063e002679)(NASA, Christopher Cassidy, **퍼블릭 도메인**); 유조선 사진 [Crude Oil Tanker in Port Arthur, Texas](https://commons.wikimedia.org/wiki/File:Crude_Oil_Tanker_in_Port_Arthur,_Texas.jpg)(Quintin Soloviev, **CC0**), [Advantage Smooth, Calandkanaal](https://commons.wikimedia.org/wiki/File:Advantage_Smooth,_Crude_Oil_Tanker,_IMO_9999620,_Calandkanaal_pic1.jpg)(Alfvanbeem, **CC0**); 주유소 사진 [태창주유소](https://commons.wikimedia.org/wiki/File:%ED%83%9C%EC%B0%BD%EC%A3%BC%EC%9C%A0%EC%86%8C(%ED%99%8D%EC%B2%9C%EA%B5%B0_%EC%84%9C%EB%A9%B4)IMG_3903.jpg)(최광모, **CC0**), [Filling station in South Korea](https://commons.wikimedia.org/wiki/File:Filling_station_in_South_Korea.jpg)(Hankook12, **CC0**), [Hyundai Oilbank Songak](https://commons.wikimedia.org/wiki/File:Hyundai_Oilbank_Songak_Gas_Station_20240729.jpg)(LandAndTree, **CC0**), [SK Enclean](https://commons.wikimedia.org/wiki/File:SK_Enclean.jpg)(iTurtle, **CC BY 3.0**), [S Oil Songnae](https://commons.wikimedia.org/wiki/File:S_Oil_Songnae_Interchange_Gas_Station_-_panoramio.jpg)(슈트레인저, **CC BY 3.0**). 특정 주유소·정유사를 탓하는 문장은 없습니다(브랜드는 배경으로만 보임).
- **issue3** — [훈민정음 해례본](https://commons.wikimedia.org/wiki/Category:Hunminjeongeum_Haerye) 1·2·7면(**퍼블릭 도메인**); [한글날 기념식(1954)](https://commons.wikimedia.org/wiki/File:%ED%95%9C%EA%B8%80%EB%82%A0_%EA%B8%B0%EB%85%90%EC%8B%9D_(1954).jpg)(한국정책방송원, 공유마당); [Gwanghwamun in November 1993](https://commons.wikimedia.org/wiki/File:Gwanghwamun_in_November_1993.jpg)(국립민속박물관 민속아카이브); [광화문 (1996.05)](https://commons.wikimedia.org/wiki/File:%EA%B4%91%ED%99%94%EB%AC%B8_(1996.05).jpg)·[광화문과 구중앙청 (1996.08)](https://commons.wikimedia.org/wiki/File:%EA%B4%91%ED%99%94%EB%AC%B8%EA%B3%BC_%EA%B5%AC%EC%A4%91%EC%95%99%EC%B2%AD_(1996.08)_01.jpg)(서울연구원 사진으로 본 서울); [광화문광장 야경 2024](https://commons.wikimedia.org/wiki/File:Nightview_of_the_Gwanghwamun_Square_2024.jpg)(서울관광재단); [나신걸 한글편지(1490)](https://commons.wikimedia.org/wiki/File:%EB%82%98%EC%8B%A0%EA%B1%B8_%ED%95%9C%EA%B8%80%ED%8E%B8%EC%A7%80,_1490.jpg)·[여주 영릉 항공](https://commons.wikimedia.org/wiki/File:%EC%97%AC%EC%A3%BC_%EC%98%81%EB%A6%89%EA%B3%BC_%EC%98%81%EB%A6%89_%EC%84%B8%EC%A2%85_%EC%98%81%EB%A6%89_%EC%A0%84%EA%B2%BD(%ED%95%AD%EA%B3%B5).jpg)(국가유산청) — 해례본 외 모두 **공공누리 제1유형**. 광화문 세종대왕 동상 사진은 쓰지 않았습니다(한국은 조형물 파노라마 자유가 비영리로 한정). 연표 그래픽 1장은 해례본 사진을 어둡게 깐 위에 올렸습니다.
- **issue4** — NASA 고다드 우주비행센터 애니메이션 [SVS 20281 Blazar EarthShot A·B](https://svs.gsfc.nasa.gov/20281), [SVS 12994](https://svs.gsfc.nasa.gov/12994)(**퍼블릭 도메인**, 12994의 배경음악 "Hidden Tides"(Killer Tracks)는 소리를 0으로 꺼서 쓰지 않음, 12994 안의 Mellinger·SYSTEM Sounds 항목은 쓰지 않음); [The ICL at Dawn](https://commons.wikimedia.org/wiki/File:The_ICL_at_Dawn.jpg)·[The ICL at Night](https://commons.wikimedia.org/wiki/File:The_ICL_at_Night.jpg)(John Hardin, **CC BY 4.0**); [The IceCube Neutrino Observatory 구조도](https://commons.wikimedia.org/wiki/File:The_IceCube_Neutrino_Observatory.jpg)(Karen Andeen·Matthias Plum for the IceCube Collaboration, **CC BY 4.0**); [Amundsen-Scott dome Aurora](https://commons.wikimedia.org/wiki/File:Amundsen-Scott_dome_Aurora_1.jpg)(Jonathan Berry/NSF, **퍼블릭 도메인**). 수상자 사진은 쓰지 않았습니다.
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0.

### 업로드 문구
**issue1** — 누리호 위성 15기 중 1기만 못 나온 이유 🚀
> 10월 7일 누리호 5차 발사 성공! 주탑재위성인 초소형 군집위성 5기는 모두 궤도에 올라 당일 교신까지 성공했지만, 큐브위성 10기 중 1기는 분리 신호를 받고도 위성을 내보내는 덮개가 열리지 않아 분리되지 못했습니다. 누리호는 5번 중 4번 성공(80%), 6차 발사는 내년 하반기 목표입니다. (2026년 10월 기준)
> 출처: 우주항공청·정책브리핑, 파이낸셜뉴스, 전자신문, 머니투데이방송, 아이뉴스24 / 영상: 한국항공우주연구원(KARI) 2021~2023 발사 영상(CC BY, 자료화면) · 사진: 한국항공우주연구원(공공누리 제1유형)
> 음악: "Heroic Age" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #누리호 #우주항공청 #군집위성 #나로우주센터 #shorts

**issue2** — 기름값 상한제 있는데 경유 20% 오른 이유 ⛽
> 2026년 9월 소비자물가에서 경유는 1년 전보다 20.0%, 휘발유는 11.8% 올랐습니다. 3월 13일 시작된 석유 최고가격제는 주유소 판매가가 아니라 정유사가 주유소에 공급하는 가격에 상한을 두고, 상한선도 국제유가에 따라 다시 정해집니다(경유 1차 1,713원 → 10차 1,773원). 정부는 상한제가 없었다면 9월 물가 상승률이 2.9%가 아니라 3.5%였을 것으로 추정합니다. 10차 상한은 9월 19일부터 4주간 적용됩니다. (2026년 10월 기준)
> 출처: 국가데이터처 9월 소비자물가동향(정책브리핑), 재정경제부·산업통상부 자료, 이투데이, 머니투데이, KDI 경제정보센터 / 영상: Antti Makkonen "Filling Up Gas Tank"(CC BY 4.0) · 사진: NASA, 위키미디어 공용 최광모·Hankook12·LandAndTree·Quintin Soloviev·Alfvanbeem(CC0), iTurtle·슈트레인저(CC BY 3.0). NASA가 이 영상을 보증하지 않습니다.
> 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #기름값 #경유 #석유최고가격제 #소비자물가 #shorts

**issue3** — 한글날이 22년 동안 쉬는 날이 아니었던 이유 📅
> 한글날은 1991년부터 "공휴일이 너무 많다", "어려운 경제 여건" 등을 이유로 국군의 날과 함께 공휴일에서 빠졌습니다. 2006년 국경일이 됐지만 쉬지는 않았고, 2012년 12월 24일 국무회의 의결로 2013년부터 다시 공휴일이 됐습니다. 여러분은 한글날에 학교 간 기억, 있나요?
> 출처: 문화체육관광부 보도자료(2012), 국가기록원 '기록으로 보는 국경일' / 사진: 훈민정음 해례본(퍼블릭 도메인), 한국정책방송원·국립민속박물관·서울연구원·서울관광재단·국가유산청(공공누리 제1유형)
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #한글날 #공휴일 #훈민정음 #한국사 #shorts

**issue4** — 노벨물리학상 받은 남극 얼음 덩어리의 정체 🧊
> 2026년 노벨물리학상은 남극 얼음 1km³를 통째로 검출기로 만든 '아이스큐브 중성미자 관측소'를 이끈 프랜시스 할젠 교수에게 돌아갔습니다(10월 6일 발표, 단독 수상). 얼음 속 1,450~2,450m에 심은 센서 5,160개가 중성미자가 드물게 부딪힐 때 나는 빛을 잡아, 2013년 우주에서 온 고에너지 중성미자를 처음 확인했습니다. 중성미자는 지금도 1초에 약 100조 개씩 우리 몸을 통과합니다.
> 출처: 노벨위원회 발표(서울신문·한국일보 보도), IceCube 공식 자료, NASA / 영상: NASA 고다드 우주비행센터 애니메이션 · 사진: John Hardin(CC BY 4.0), IceCube Collaboration 구조도(CC BY 4.0), 미국 국립과학재단(NSF). NASA·NSF가 이 영상을 보증하지 않습니다.
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #노벨물리학상 #중성미자 #아이스큐브 #남극 #shorts

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

## 빅테크 CEO 청문회 쇼츠 (`politics/ceo1`~`ceo4`)

유명 테크 CEO가 미국 의회 청문회에서 한 화제의 한마디를, 레퍼런스(“1만 시간의 법칙 (한영자막)”)와 같은 **형식만** 따라 영어(위, 크게)·한국어(아래, 작게) 2단 자막으로 만든 4편입니다. 내레이터·AI 목소리·음악 없이 청문회 원음만 씁니다. 영상은 모두 **미 상원 Recording Studio가 직접 촬영한 위원회 공식 영상**(senate.gov ISVP 플레이어의 HLS 원본)이고, C-SPAN·방송사·유튜브 재업로드 화면은 쓰지 않았습니다.

| id | 제목 | 길이 | 장면 |
| --- | --- | --- | --- |
| `ceo1` | 페북 공짜인데 돈은 어떻게? / 저커버그의 한마디..? | 35.0초 | 오린 해치 상원의원 ↔ 마크 저커버그, 상무·법사위 합동 2018.4.10, “Senator, we run ads.” |
| `ceo2` | 챗GPT 만든 CEO에게 / “돈 많이 버시죠?” 묻자..? | 37.7초 | 존 케네디 상원의원 ↔ 샘 올트먼, 법사위 소위 2023.5.16, “I have no equity in OpenAI.” / “You need a lawyer or an agent.” |
| `ceo3` | 틱톡 CEO 추쇼우즈에게 / 국적을 거듭 묻자..? | 35.1초 | 톰 코튼 상원의원 ↔ 추쇼우즈(틱톡), 법사위 2024.1.31, “Senator, I'm Singaporean.” |
| `ceo4` | “딥시크, 얼마나 큰일이었나?” / 올트먼과 리사 수의 대답..? | 34.5초 | 테드 크루즈 위원장 ↔ 샘 올트먼·리사 수(AMD), 상무위 2025.5.8, “Not a huge deal.” / “somewhere in between” |

```bash
MEDIA=$PWD/media python3 politics/prep_split.py ceo1    # 원본: media/celeb/
./render.sh ceo1 final/ceo1.mp4
```

- **첫 장면·장면 길이 (qa_review 대응)**: 상원 카메라는 질문하는 동안 의원만 비추므로, ceo1·ceo3·ceo4는 0초에 CEO가 **말없이 듣고 있는 얼굴**(같은 청문회의 다른 순간, 원음은 끄고 `"cutaway": true`)을 1.8~2초 보여 주고, 그 밑에 의원의 실제 질문 음성(`music` 목소리 파트, 원본 그대로)이 흐릅니다. 그 컷에서 말하는 입 모양은 나오지 않습니다(ceo1 저커버그 64.35–66.35: 해치 질문 뒤 답하기 전 침묵 / ceo3 추쇼우즈 29.6–31.4: 여권 질문을 듣는 중 / ceo4 리사 수 50.0–52.0: 옆자리 올트먼 발언을 듣는 중). 한 화면이 4.5초를 넘지 않도록 긴 단일 카메라 구간은 같은 화면 안에서 가까운 크롭/넓은 크롭을 번갈아 나눴습니다(흰 번쩍임 없음, 시간은 이어짐).
- 템플릿 변경(`prep_split.py`, 기존 쇼츠 영향 없음): 구간에 `"cutaway": true`를 주면 자막 시간 계산(`at`/`to`→출력 초)에서 그 구간을 건너뜁니다. 원본 시각이 ±0.3초 안에 겹치는 반응 컷이 다른 줄을 가로채지 않게 하기 위한 것입니다.
- **레이아웃**: `"titleStyle": "band"`(검정 띠 2줄 질문형 제목, 아랫줄 노랑), `"subOrder": "en-ko"`, `"captionY": 1600`, 정사각 화면에 `single` 크롭으로 얼굴을 크게, 이름표 “이름 · 직함 (연도)”. 화면에 없는 사람이 말하면 자막 위에 `🎙 이름`. 첫 3초에 장면 설명 스티커(“2018년 미국 상원 청문회 · 개인정보 유출 사태 직후” 등). 영어 `[괄호]`·한국어 `keys`로 핵심 구절만 노랑.
- **자막 검증**: 영어는 GPO 공식 청문회 기록(아래 링크)과 faster-whisper small.en·medium.en(위치 찾기는 tiny.en, 2024·2025년은 상원 스트림 자체 영어 자막 트랙도)을 대조했고 모두 일치합니다. 기록과 실제 발음이 다른 곳은 들리는 대로 적었습니다: ceo1 “users don't pay”(기록 “do not”), ceo2 “I make… no.”(기록 “No.”), “Would you be qualified…”(실제로 “to… to…” 하고 말을 고름). 자막 시간은 medium.en 단어 시간에 `at`/`to`로 고정했습니다.
- **컷과 화면** (원본 = `media/celeb/<파일>.mp4` 초. HLS를 스트림 복사로 잘라 시작점이 세그먼트 경계에 맞춰지므로, 스트림 시각은 ±15초쯤 어긋날 수 있습니다. 정확한 위치는 인용한 문장으로 찾으면 됩니다)
  - `ceo1` (`zuck.mp4`, 스트림 약 1:30:50부터): (0–2초 반응 컷 64.35–66.35, 그 밑 음성 27.2–29.2) + 29.2–49.4 + 59.62–71.85. 컷 1번: 저커버그 답변의 “It is our mission to… we are committed to doing that.”(약 10초)를 뺐습니다. 답의 요지(“무료 버전은 언제나 있다”)는 그대로이고, 바로 다음 해치의 “Well, if so, how do you sustain…”으로 이어집니다. 원본이 640×360뿐이라 화질이 낮고, 원본 화면 아래 위원회 자막(“Joint Commerce and Judiciary Committee”)이 크롭 밖으로 빠집니다.
  - `ceo2` (`alt23.mp4`, 스트림 약 1:58:10부터): 2.2–39.3, 자르지 않음(크롭 전환만). 첫 1.8초는 올트먼 얼굴(케네디의 “Can you send me that information?”이 들림).
  - `ceo3` (`chew.mp4`, 스트림 약 2:39:50부터): (0–1.8초 반응 컷 29.6–31.4, 그 밑 음성 7.45–9.25) + 9.25–18.05 + 28.75–52.68. 컷 1번: “중국 시민권을 신청한 적 있나”·“싱가포르 여권이 있나” 문답(약 10.7초)을 뺐습니다. 답에 싱가포르 국가·군 복무 이야기가 나와서(군대 소재 제외), 문답 단위로 통째로 뺐고 앞뒤 질문·답은 온전합니다. 끝 0.5초는 상원 카메라가 추쇼우즈를 비춥니다.
  - `ceo4` (`ai25.mp4`, 스트림 약 3:13:50부터): (0–2초 반응 컷 50.0–52.0, 그 밑 음성 20.25–22.25) + 22.25–30.38 + 34.6–47.3 + 85.3–89.7 + 100.55–107.2. 컷 3번: 크루즈 질문 끝 “and what's coming next? And let's, each of the four of you.”, 올트먼 답 뒷부분(“maybe the most downloaded app overall” 이후 오픈소스·소비자 앱 이야기), 리사 수 답 중간(“When you think about what we learned… in the United States.”)을 뺐습니다. 리사 수의 첫 문장(85.3–89.7)은 상원 카메라가 회의장 전경을 비추는 구간이라 `"shows": -1`로 🎙 표시. 올트먼 구간은 올트먼과 옆자리 리사 수가 함께 보이게 넓게 크롭했습니다.
- **리사 수 스티커**(“리사 수는 엔비디아 젠슨 황의 먼 친척”): 리사 수 본인이 “distant relatives”라고 말했고(2020 CTA 행사, 2024 블룸버그 인터뷰 “We were really distant, so we didn't grow up together”), 엔비디아 대변인도 젠슨 황 어머니 쪽 먼 친척이라고 확인했습니다([Business Insider](https://www.businessinsider.nl/amd-ceo-lisa-su-says-she-never-met-her-distant-cousin-nvidia-ceo-jensen-huang-until-later-in-their-careers/), [AOL/BI](https://www.aol.com/amd-ceo-lisa-su-says-014208683.html)). 정확한 촌수(5촌 등)는 계보학자 추정이라 쓰지 않았습니다.
- **중립성**: 질의자 4명이 모두 공화당 상원의원인 것은 화제 장면을 고르다 보니 그렇게 된 것이고, 정당이 아니라 CEO의 답이 주인공입니다. 정당·정치인을 조롱하는 문구는 없고, ceo3 제목도 “국적을 거듭 물은 장면”으로만 잡았습니다. 수치·주장(딥시크 다운로드 1위 등)은 발언 그대로이며 따로 검증한 사실이 아닙니다. 화면에 회사 로고를 브랜딩처럼 쓰지 않았습니다.
- **라이선스**: 미 상원 Recording Studio(상원 직원)가 직무로 촬영한 위원회 청문회 영상이라 미국 연방정부 저작물, **퍼블릭 도메인**(17 U.S.C. §105)입니다. 위원회 청문회 페이지에 박힌 senate.gov ISVP 플레이어(`www.senate.gov/isvp/?comm=…&filename=…`)가 재생하는 상원 Akamai HLS 원본을 그대로 받았습니다. C-SPAN 로고나 방송사 화면은 없습니다. 상원 규칙(S.Res.431)상 정치·선거운동 용도로는 쓸 수 없고, 상원·의원·증인·회사가 이 영상을 보증하는 것처럼 보이면 안 됩니다.
- **원본**: 쓰는 구간을 담은 원본 클립(0초 기준 재인코딩)과 출처 페이지·HLS 주소·스트림 구간·기록 링크가 `media/celeb/*.mp4`·`*.json`에 있습니다.
  - `ceo1`: [상무위 청문회 페이지](https://www.commerce.senate.gov/2018/4/facebook-social-media-privacy-and-the-use-and-abuse-of-data) · 스트림 `commerce041018` 약 1:31:17–1:32:22 · 기록 [S. Hrg. 115-683](https://www.govinfo.gov/content/pkg/CHRG-115shrg37801/html/CHRG-115shrg37801.htm)
  - `ceo2`: [법사위 청문회 페이지](https://www.judiciary.senate.gov/committee-activity/hearings/oversight-of-ai-rules-for-artificial-intelligence) · 스트림 `judiciary051623` 약 1:58:12–1:58:49 · 기록 [S. Hrg. 118-37](https://www.govinfo.gov/content/pkg/CHRG-118shrg52706/html/CHRG-118shrg52706.htm)
  - `ceo3`: [법사위 청문회 페이지](https://www.judiciary.senate.gov/committee-activity/hearings/big-tech-and-the-online-child-sexual-exploitation-crisis) · 스트림 `judiciary013124` 약 2:39:57–2:40:43 · 기록 [S. Hrg. 118-497](https://www.govinfo.gov/content/pkg/CHRG-118shrg57444/html/CHRG-118shrg57444.htm)
  - `ceo4`: [상무위 청문회 페이지](https://www.commerce.senate.gov/2025/5/winning-the-ai-race-strengthening-u-s-capabilities-in-computing-and-innovation_2) · 스트림 `commerce050825` 약 3:14:10–3:15:37 · 기록 [S. Hrg. 119-143](https://www.govinfo.gov/content/pkg/CHRG-119shrg61426/html/CHRG-119shrg61426.htm)
- **원래 계획에서 바뀐 것**: `ceo2`는 원래 순다르 피차이(2018.12.11 하원 법사위, “iPhone is made by a different company”)였습니다. 하원 법사위 청문회 페이지가 위원회 공식 유튜브 영상(`Ul5fMAG2tk4`, House Committee on the Judiciary 채널)만 걸어 두고 있고, 이 작업 환경에서는 유튜브가 다운로드를 막아(“Sign in to confirm you're not a bot”, 스토리보드만 허용) 받을 수 없었습니다. 그래서 대안 목록의 샘 올트먼 2023 상원 법사위 소위로 바꿨습니다. 그 영상을 받을 수 있는 환경이라면 같은 형식으로 피차이 편을 만들 수 있습니다(하원 위원회 직원 촬영이면 역시 퍼블릭 도메인).

**ceo1** — 페북 공짜인데 돈은 어떻게? 저커버그의 한마디
> 2018년 4월 10일, 미국 상원 상무위원회·법사위원회 합동 청문회(워싱턴 D.C.). 케임브리지 애널리티카 개인정보 유출 사태 직후 처음 의회에 선 마크 저커버그 페이스북 CEO에게 오린 해치 상원의원이 물었습니다. “사용자가 돈을 안 내는데 사업은 어떻게 유지하죠?” 저커버그의 대답은 한마디였습니다. 영어 원문과 한국어 번역 자막(답변 중간 일부 생략).
> 영상: 미국 상원(U.S. Senate) 위원회 청문회 공식 영상 · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #저커버그 #페이스북 #청문회 #영어공부 #shorts

**ceo2** — 챗GPT 만든 CEO에게 "돈 많이 버시죠?" 묻자
> 2023년 5월 16일, 미국 상원 법사위원회 AI 소위원회 청문회(워싱턴 D.C.). AI 규제를 논의하던 자리에서 존 케네디 상원의원이 오픈AI의 샘 올트먼 CEO에게 “돈은 많이 버시죠?”라고 묻자 나온 대답. (오픈AI 지분 관련 발언은 2023년 청문회 당시 본인 말입니다.) 영어 원문과 한국어 번역 자막.
> 영상: 미국 상원(U.S. Senate) 위원회 청문회 공식 영상 · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #샘올트먼 #챗GPT #오픈AI #영어공부 #shorts

**ceo3** — 틱톡 CEO 추쇼우즈에게 국적을 거듭 묻자
> 2024년 1월 31일, 미국 상원 법사위원회 청문회(워싱턴 D.C.). 빅테크 CEO 5명이 출석한 자리에서 톰 코튼 상원의원이 틱톡의 추쇼우즈(Shou Zi Chew) CEO에게 국적과 중국 공산당과의 관계를 거듭 물었고, 추쇼우즈 CEO는 차분하게 “저는 싱가포르인입니다”라고 답했습니다. 영어 원문과 한국어 번역 자막(중간 문답 일부 생략).
> 영상: 미국 상원(U.S. Senate) 위원회 청문회 공식 영상 · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #틱톡 #청문회 #싱가포르 #영어공부 #shorts

**ceo4** — "딥시크, 얼마나 큰일이었나?" 올트먼과 리사 수의 대답
> 2025년 5월 8일, 미국 상원 상무위원회 ‘AI 경쟁’ 청문회(워싱턴 D.C.). 테드 크루즈 위원장이 “딥시크는 얼마나 큰일이었나”라고 묻자 오픈AI 샘 올트먼 CEO와 AMD 리사 수 CEO의 답이 엇갈렸습니다. 리사 수 CEO는 엔비디아 젠슨 황 CEO와 먼 친척이기도 합니다(본인 언급). 발언 속 수치·평가는 발언 그대로입니다. 영어 원문과 한국어 번역 자막(답변 일부 생략).
> 영상: 미국 상원(U.S. Senate) 위원회 청문회 공식 영상 · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #딥시크 #샘올트먼 #리사수 #AI #shorts

## 젠슨 황·테크 리더 육성 쇼츠 (`politics/jensen*`)

레퍼런스(유명인 육성 + 위 영어·아래 한국어 2단 자막 + 질문형 제목)의 **형식만** 따랐습니다. 젠슨 황 인터뷰를 올리는 국내 채널들이 쓰는 방송·행사 영상은 쓰지 않았고, 라이선스를 확인한 영상만 썼습니다. 내레이션·AI 음성·음악 없이 본인 목소리만 씁니다.

| id | 제목 (검정 띠, 2줄째 노랑) | 길이 | 출처 · 쓴 구간 (클립 기준 초) |
| --- | --- | --- | --- |
| `jensen1` | 젠슨 황이 말한 GPU 1대, / 무게가 32kg..? | 44.8초 | 백악관 2025.4.30 · 17.5–21.75, 43.15–83.0 (컷 1번) |
| `jensen2` | 젠슨 황: 전기를 넣으면 / '이것'이 나오는 기계..? | 35.3초 | 백악관 2025.4.30 · 112.6–117.5, 136.75–166.5 (컷 1번) |
| `jensen3` | 젠슨 황이 인도에 / '지금이 기회'라고 한 이유..? | 32.1초 | 모디 총리 공식 채널(CC BY) 2024.9.22 · 18.6–31.1, 84.6–103.5 (컷 1번) |
| `jensen4` | 손정의가 말한 / AGI 다음에 오는 것..? | 37.0초 | 백악관 2025.1.21 '스타게이트' 발표 · 11.0–47.3 (자르지 않음) |

```bash
MEDIA=$PWD/media python3 politics/prep_split.py jensen1     # 원본: media/celeb/ (출처·구간은 같은 이름의 .json)
./render.sh jensen1 final/jensen1.mp4
```

- **장면 전환**: 긴 원본 테이크를 문장 시작마다(3~4초) 이어지는 구간으로 나눠 얼굴 크롭을 번갈아 바꿨습니다(가까이↔조금 멀리). 시간이 이어지는 구간이라 흰 번쩍임은 없고 말도 그대로입니다. 백악관 와이드 화면은 연단의 젠슨 황에 맞춰 1.8~2.2배로 당겼습니다(360p라 흐림). `qa_review.py` 결과 네 편 모두 WARN·FAIL 없음.
- **레이아웃**: `"titleStyle": "band"`, `"subOrder": "en-ko"`, `captionY` 1590(사진 아래, 유튜브 버튼 영역 위), 정사각 얼굴 크롭, 첫 화면부터 제목. 영어 `[괄호]`와 한국어 `keys`로 핵심 구절만 노랗게. 시작 3초 흰 스티커로 장소·날짜만 적었습니다. 화면 출처 표기는 "백악관 영상 · 날짜", "나렌드라 모디 공식 채널 · 2024.9".
- **영상 1 — 백악관 "Investing in America" 행사(2025.4.30)**: 백악관 공식 유튜브 [WtXHaYrhflk](https://www.youtube.com/watch?v=WtXHaYrhflk)의 25:10–28:30. 이 컨테이너에서는 유튜브 다운로드가 봇 확인으로 막혀서, 같은 업로드를 그대로 보존한 archive.org 미러 [youtube-WtXHaYrhflk](https://archive.org/details/youtube-WtXHaYrhflk)(channel @WhiteHouse, creator "The White House")에서 받았습니다. 미러가 **360p뿐**이라 화질이 낮고, 원본 중계가 중간에 객석 뒤 와이드 화면으로 바뀌어(클립 57–95초, 144–172초) 그 구간은 연단의 젠슨 황을 작게 비춥니다. 미국 연방정부 저작물, 퍼블릭 도메인(17 U.S.C. §105).
  - 자막: 백악관이 올린 영어 자막(en-US.vtt)과 faster-whisper small.en·medium.en·large-v3 대조. "Well, after all this time"(자막·small·large 일치), `jensen2` 첫 줄은 "manufacturing, manufacturing…"으로 말을 고쳐 시작해 둘째 "Manufacturing isn't about…"부터 썼고(구간만 따로 돌린 세 모델 모두 같은 문장), "The really, the really amazing thing"도 고쳐 말한 뒤의 "The really amazing thing"부터 썼습니다(세 모델 일치; 백악관 자막은 "real").
  - 뺀 부분: IBM System 360 설명, 대통령 지도력·정책에 대한 감사(83–111초, 166초 이후). 정치적 발언을 빼고 기술 설명만 남겼습니다. 컷은 각각 문장 경계에서 한 번(흰 번쩍임).
  - "70파운드(약 32kg)": 단위 환산만 괄호로 덧붙였습니다. "That's one GPU unit"은 무대 옆 전시물(GB200 NVL 랙 계열로 보이나 영상에서 확인 불가)을 가리킨 말이라 번역은 "저게 GPU 한 대"로 그대로 뒀습니다.
- **영상 2 — 모디 총리 공식 채널 인터뷰(2024.9.22, 뉴욕)**: Wikimedia Commons [File:PM Modi is such an incredible student, NVIDIA CEO Jensen Huang.webm](https://commons.wikimedia.org/wiki/File:PM_Modi_is_such_an_incredible_student,_NVIDIA_CEO_Jensen_Huang.webm) (원본: Narendra Modi 유튜브 [saTD1u8PorI](https://www.youtube.com/watch?v=saTD1u8PorI), 유튜브 "크리에이티브 커먼즈 저작자 표시"로 공개, Commons 표기 **CC BY 3.0**). 총리 채널이 직접 찍고 자막(이름표)을 넣은 인터뷰라 업로더가 원저작자입니다. Commons에는 "라이선스 검토 대기" 표시가 있습니다. 1080p.
  - 자막: 공식 녹취록이 없어 whisper 세 모델만으로 맞췄고 세 모델이 일치합니다.
  - 정치색을 피하려고 앞부분의 총리 칭찬("such an incredible student")과 협력사 나열은 빼고, 인도 인재·AI 산업·"AI가 컴퓨팅을 대중화했다·지금이 인도의 순간" 부분만 썼습니다. 컷 1번(31.1→84.6초, 문장 경계).
- **영상 3 (대체편) — 백악관 '스타게이트' 발표(2025.1.21, 루스벨트룸)**: 백악관 공식 유튜브 [X5gMiDnYEds](https://www.youtube.com/watch?v=X5gMiDnYEds)의 8:00–9:05, archive.org 미러 [youtube-X5gMiDnYEds](https://archive.org/details/youtube-X5gMiDnYEds)(360p). 퍼블릭 도메인(17 U.S.C. §105). 젠슨 황 본인 영상이 2건뿐이라 넷째 편은 손정의 소프트뱅크그룹 회장의 발언으로 채웠습니다. 백악관 자막은 "AGI"를 "Asia"로 잘못 적었는데 whisper 세 모델 모두 "AGI"로 들어서 AGI로 썼습니다. 마지막 "Well, this is the beginning of our golden age."(정치 구호와 겹침)는 넣지 않고 "…we could solve."에서 끝냈습니다. "Larry"는 래리 엘리슨(오라클)입니다.
- 원본 클립과 출처·라이선스·구간 기록: `media/celeb/*.mp4`·`.json`. 단어 시간: `politics/jensen*/whisper.json`(faster-whisper medium.en).
- **찾았지만 쓰지 않은 젠슨 황 영상**: 2025.10.31 APEC 경주 이재명 대통령 접견·CEO 서밋 특별세션·GPU 26만 장 발표(정책브리핑 기사는 "텍스트에 한하여" 공공누리 1유형이고 사진은 연합뉴스, 영상은 정책브리핑에 저작권 없음 표기; KTV 영상은 "All Rights Reserved"이고 공공누리 1유형 표시를 찾지 못함; CEO 서밋은 대한상의 주최), 2026.6 방한(기업·대학 행사, 정부 영상 없음), 2026.9.2 G20 혁신장관회의 러트닉 장관 대담(상무부 주최라 유력했지만 찾은 영상은 CNBC·News Central·DRM News 등 방송사 업로드뿐, 상무부 자체 녹화본을 찾지 못함), 2026.9.29 백악관 AI 오찬(공개 발언은 대통령뿐), 2026.10.8 국가과학·기술메달 수여(대통령·크라치오스만 발언), 2026.8.19 백악관 기술 리더 행사(젠슨 황 발언 확인 불가, 유튜브 다운로드 불가), 2025.11.19 미·사우디 투자포럼 머스크 대담(포럼 주최측 제작·C-SPAN, 머스크 동석), 대만 총통부·행정원(젠슨 황 발언 영상 없음), Commons의 Computex 2025 한국 유튜버 영상(CC BY지만 젠슨 황은 지나가는 장면뿐이고 기조연설 화면은 엔비디아 저작물), GTC·Computex·스탠퍼드·칼텍·CMU 연설과 팟캐스트(라이선스 불가).

**jensen1** — 젠슨 황이 말한 GPU 1대, 무게가 32kg..?
> 2025년 4월 30일 미국 백악관 'Investing in America' 행사. 엔비디아 젠슨 황 CEO가 "60년 만에 컴퓨터를 다시 발명했다"며 GPU 한 대가 70파운드(약 32kg), 부품 6만 개, 1만 와트라고 설명합니다. "슈퍼컴퓨터를 시험하는 데도 슈퍼컴퓨터가 필요합니다." 영어 원문과 한국어 번역 자막(직접 번역).
> 영상: 백악관(The White House, 2025.4.30) · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #젠슨황 #엔비디아 #GPU #영어공부 #한영자막

**jensen2** — 젠슨 황: 전기를 넣으면 '이것'이 나오는 기계..?
> 2025년 4월 30일 미국 백악관 행사에서 젠슨 황 엔비디아 CEO가 말한 AI의 정체. "제조업은 이제 값싼 노동력이 아니라 기술의 문제입니다." "예전엔 물이 들어가면 전기가 나왔다면, 이제는 전기가 들어가면 토큰, 즉 인공지능이 나옵니다." 영어 원문과 한국어 번역 자막(직접 번역).
> 영상: 백악관(The White House, 2025.4.30) · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #젠슨황 #엔비디아 #인공지능 #AI공장 #영어공부

**jensen3** — 젠슨 황이 인도에 '지금이 기회'라고 한 이유..?
> 2024년 9월 22일 미국 뉴욕, 인도 총리와 테크 CEO 간담회 뒤 젠슨 황 엔비디아 CEO 인터뷰. "AI는 컴퓨팅을 정말 대중화했습니다. 지금이 인도의 순간입니다. 기회를 잡아야 합니다." 영어 원문과 한국어 번역 자막(직접 번역, 일부 구간 생략).
> 영상: Narendra Modi 공식 유튜브 "PM Modi is such an incredible student: NVIDIA CEO Jensen Huang" (https://www.youtube.com/watch?v=saTD1u8PorI), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/) — 잘라내고 확대·자막을 넣음. 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #젠슨황 #엔비디아 #인도 #AI #한영자막

**jensen4** — 손정의가 말한 AGI 다음에 오는 것..?
> 2025년 1월 21일 미국 백악관, AI 인프라 '스타게이트' 발표. 손정의 소프트뱅크그룹 회장: "AGI는 아주, 아주 곧 옵니다. 그다음엔 초인공지능이 와서 인류가 풀 수 있으리라 생각하지 못한 문제들을 풀 겁니다." 영어 원문과 한국어 번역 자막(직접 번역).
> 영상: 백악관(The White House, 2025.1.21) · 이 영상은 영상 속 인물이나 기관이 보증·후원한 것이 아닙니다.
> #손정의 #AGI #초인공지능 #스타게이트 #영어공부

## "○○ 특" 공감 애니 (`teuk1`~`teuk4`)

자체공감(구독 31.6만)의 벡터 마스코트 "○○ 특" 쇼츠(편당 36~58만, `research/research-fun.md` 4절, 8절 제안 4번)를 우리 찹쌀떡 캐릭터로 만든 4편이다. 썰 쇼츠와 같은 `scene` 클립을 쓰지만 글 카드(`post`)는 없다. 0초부터 첫 장면(제목 띠 + 주인공 표정 + 소품)으로 시작한다. 이어서 번호 붙은 공감 7개를 장면 하나에 3~4초씩 보여 주고, "여러분은 몇 개 해당?ㅋㅋ"라는 댓글 질문으로 끝난다. 마지막 줄은 주인공의 말풍선 "난 7개 다…ㅋㅋ"다.

- **틀**: 내레이터가 항목 이름만 빠르게 읽는다(+15%). 자막은 `"1. 알람 [다섯 번] 끄기"`처럼 번호를 붙인다(번호는 읽지 않음). 그다음 주인공이 말풍선 한 줄로 반응하고(목소리 있음, 아래 자막 없음), 표정이 바뀌며(`to`), 큰 글씨(`big`)가 박힌다.
- **시리즈 마스코트**: 주홍색 찹쌀떡 "나"(`#FFB36B`)가 네 편 모두에 나온다. 제목 띠 첫 줄은 대상("직장인", "학생이라면 공감", "학교 다닐 때", "누구나 있는"), 둘째 줄은 "○○ 특"이다.
- **그림**: 전부 직접 그렸다(`src/lib/Sseol.tsx`). 외부 사진·영상은 없다. 그래서 `sources`는 비어 있고 화면 크레딧도 없다.
- **유머**: 자기 자신을 소재로 한 가벼운 공감이다. 특정 집단, 몸, 지역, 직업을 놀리지 않는다. 등장인물, 학교, 회사, 앱 이름은 모두 지어낸 것이고, 단톡방 화면은 실제 메신저의 로고나 디자인을 쓰지 않은 일반 채팅 화면이다.

| id | 제목 띠 | 길이 | 1~7 | 음악 |
| --- | --- | --- | --- | --- |
| `teuk1` | 직장인 / 월요일 아침 특 | 29.0초 | 알람 다섯 번 끄기 · 주말까지 며칠 남았는지 세기 · 씻다가 다시 잠들 뻔 · 지하철에서 서서 졸기 · 회사 앞에서 깊은 한숨 · 커피 마시고 겨우 사람 되기 · 출근하자마자 점심 메뉴 고민 | Hustle |
| `teuk2` | 학생이라면 공감 / 시험 기간 특 | 31.9초 | 갑자기 책상 정리 · 계획표만 한 시간 · 안 보던 다큐가 꿀잼 · 10분만 누웠는데 아침 · 쉬는 시간 10분에 제일 많이 외움 · 끝나자마자 전부 까먹기 · 벼락치기 중 갑자기 인생 고민 | Sneaky Snitch |
| `teuk3` | 학교 다닐 때 / 급식 먹을 때 특 | 29.4초 | 4교시부터 메뉴 확인 · 종 치자마자 급식실 직행("뛰지 말고… 빠르게 걷기!") · 앞에 몇 명인지 세기 · 맛있는 반찬은 마지막에 · 친구가 안 먹는 반찬 노리기 · 디저트 나오는 날은 하루 종일 행복 · 식판 반납 전 우유 원샷 | Monkeys Spinning Monkeys |
| `teuk4` | 누구나 있는 / 단톡방 특 | 29.9초 | 알림 끄고 몰래 다 읽기 · 질문하면 아무도 대답 안 함 · 약속 잡으면 결국 안 만남 · 새벽 감성 톡 아침에 후회 · 엄마한테 보낼 톡을 단톡방에 · 숫자 1 사라지는지 계속 확인(생일 축하로 끝남) · 나가기 버튼 고민만 100번 | Hyperfun |

```bash
python3 voice_edge.py teuk1 && python3 prep.py teuk1 && ./render.sh teuk1 final/teuk1.mp4 && python3 qa_review.py teuk1
```

**목소리**(`script.json`의 `voices`)

- `teuk1`: 내레이터 `SunHi` +15%, 나 `InJoon` +10%·+8Hz
- `teuk2`: 내레이터 `HyunsuMultilingual` +15%, 나 `SunHi` +15%·+20Hz
- `teuk3`: 내레이터 `SunHi` +15%, 나 `InJoon` +15%·+25Hz
- `teuk4`: 내레이터 `HyunsuMultilingual` +15%, 나 `SunHi` +12%·+10Hz

**템플릿 추가**(`src/lib/Sseol.tsx`, 기존 편은 그대로)

- 배경 5종을 더했다. `bedroom`(침대·커튼 창), `bath`(타일·거울·세면대), `subway`(지하철 창·손잡이·좌석), `cafeteria`(배식대·메뉴판, `sign` 가능), `desk`(밤 책상·스탠드·책 더미).
- `chat`은 장면 오른쪽에 단톡방 휴대폰 화면을 그린다. 값은 `{"title": "우리 반 (28)", "msgs": [{"name", "text", "me", "unread"}]}`이다. 메시지 i는 `steps[4 + i]`에 뜨고(없으면 0.45초 간격), 넘치면 위로 밀린다. `chat`이 있으면 인물은 기본적으로 왼쪽(x 0.24)에 선다.

**qa_review**: 4편 모두 11개 항목 PASS(WARN·FAIL 0). 칠판이나 급식실 `sign`이 있는 장면에서는 `big`이 표지판과 겹쳐서 그 장면의 `sign`을 뺐다.

**업로드 문구**

`teuk1`
- 제목: 직장인 월요일 아침 특ㅋㅋ
- 설명:
  ```
  알람 다섯 번 끄기부터 출근하자마자 점심 고민까지 ⏰☕ 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #직장인 #월요일 #공감애니

`teuk2`
- 제목: 시험 기간 특ㅋㅋ
- 설명:
  ```
  시험 전날만 되면 책상 정리가 왜 이렇게 하고 싶을까 📚 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #시험기간 #학생공감 #공감애니

`teuk3`
- 제목: 급식 먹을 때 특ㅋㅋ
- 설명:
  ```
  4교시부터 메뉴 확인하던 그 시절 🍱 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #급식 #학교 #공감애니

`teuk4`
- 제목: 단톡방 특ㅋㅋ
- 설명:
  ```
  알림 끄고 몰래 다 읽는 사람 손 🙋 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물과 채팅방은 실제와 관계없습니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #단톡방 #친구공감 #공감애니

## 역대급 랭킹 TOP5 쇼츠 (`politics/top1`~`top4`, 군대 아님)

「역대급 ○○ 랭킹 TOP5」형(오락 쇼츠 중 조회수 중앙값 410만, `research/research-fun.md`)을 **쓸 수 있는 영상만으로** 만든 네 편입니다. 내레이션 없음, 음악 + 한 줄 자막. 순위는 편집자 선정이고 공식 순위가 아닙니다. 1위가 끝나면 바로 끊겨 5위로 다시 돌아갑니다(`"tail": 0`). 장소·장면마다 두 컷(3.4초 안팎, 두 번째는 다른 구간이나 더 크게 자른 컷)이라 한 장면이 4초를 넘지 않습니다. 사람·얼굴이 나오는 장면은 쓰지 않았습니다(top2만 손).

| id | 제목(화면) | 길이 | 5위 → 1위 | 음악 |
| --- | --- | --- | --- | --- |
| `top1` | 역대급 소름 돋는 백룸 같은 공간 / TOP5 (몇 위가 제일 소름?) | 35.1초 | 한밤의 텅 빈 수영장 · 끝이 안 보이는 주차장 · 끝없는 지하 에스컬레이터 · 아무도 없는 쇼핑몰 복도 · 불 꺼진 병원 복도 | Dark Fog |
| `top2` | 역대급 만족스러운 순간 / TOP5 (몇 위가 제일 좋음?ㅋㅋ) | 35.1초 | 구슬 슬라임 주무르기 · 초코 케이크 단면 · 연필심에 하트 조각 · 물감 흘러내리기 · 키네틱 샌드 자르기 | Monkeys Spinning Monkeys |
| `top3` | 역대급 신기한 자연현상 / TOP5 (몇 위가 제일 신기?ㄷㄷ) | 37.4초 | 세계 최대 활동 간헐천 · 바다 밑의 호수 · 알래스카 오로라 · 구름에 잠긴 그랜드캐니언 · 최고 400m 용암 분수 | Floating Cities |
| `top4` | 우주에서 찍힌 소름 돋는 장면 / TOP5 (몇 위가 제일 소름?) | 34.6초 | 우주에서 본 번개 폭풍 · 발밑에 깔린 오로라 · 지구에 드리운 달 그림자 · 지구 위로 떠오른 혜성 · 달 뒤로 지는 지구 | Lightless Dawn |

```bash
./fetch.sh                                                   # "Dark Fog"(top1) 포함
MEDIA=$PWD/media python3 politics/prep_split.py top1         # 원본: media/top1~top4/*.mp4 (저장소에 없음, 각 .json의 주소로 다시 받기)
./render.sh top1 final/top1.mp4                              # top3·top4 보관본은 이어서 CRF 22로 다시 압축(30MB 이하)
python3 qa_review.py top1                                    # 네 편 모두 FAIL 0, WARN 0
```

- 레이아웃: `"titleStyle": "band"`, 정사각 화면에 `single` 크롭, 자막 `"captionY": 1380`, 그 아래 순위표(`rank`, 안 나온 순위는 "???", 지금 순위는 노랑). 순위가 바뀔 때 흰 번쩍임 + “○위” 노란 스티커 + `whoosh`. 첫 프레임에 제목·순위표·5위 영상이 함께 보입니다. 원본 소리는 모두 껐습니다(`audio: 0`; 음악·잡음이 섞인 원본이 있어서).
- top1의 “백룸”은 장르 이름으로만 썼고, 원조 백룸 사진이나 위키 이미지는 쓰지 않았습니다. 영상은 모두 실제 공간의 Pexels 영상이며 어둡게·비네트만 더했습니다(`vf`). 수영장 시계는 21시 28분이라 자막을 “밤 9시 반”으로 적었습니다.
- top4의 ISS 장면은 NASA 웹 영상(1024×768)이 흐려서, NASA ‘Gateway to Astronaut Photography’의 원본 사진(4256×2832)을 받아 우리가 다시 타임랩스로 이었습니다(사진 번호는 아래). 1위는 NASA 사진 한 장(art002e021278)에 천천히 다가가는 화면입니다. 브리프의 “우주에서 본 로켓 발사”는 쓸 만한 NASA 영상이 없어(ISS에서 찍은 소유스 발사는 연기 자국 사진뿐) 혜성 장면으로 바꿨습니다.

### 영상과 라이선스 (원본 페이지·파일 주소·크레딧·쓴 구간: `media/top*/*.json`, 각 `edit.json`의 `sources`)
- **Pexels License** (상업적 이용·수정 가능, 출처 표기 선택, 식별 가능한 인물 비하·보증 암시 금지 — 각 영상 페이지와 https://www.pexels.com/license/ 확인)
  - top1: [6011926](https://www.pexels.com/video/an-indoor-swimming-pool-used-in-training-6011926/) Tima Miroshnichenko, [5972198](https://www.pexels.com/video/view-of-an-empty-indoor-parking-space-5972198/) gusat silviu, [31053763](https://www.pexels.com/video/empty-underground-escalator-in-urban-setting-31053763/) Yunus Kılıç, [15365449](https://www.pexels.com/video/an-empty-shopping-mall-corridor-with-flickering-lights-15365449/) Matthias Groeneveld, [29241126](https://www.pexels.com/video/dimly-lit-hospital-corridor-with-gurney-29241126/) SN.CHE
  - top2: [6150670](https://www.pexels.com/video/person-squishing-a-purple-slime-with-beads-6150670/) cottonbro studio, [3326577](https://www.pexels.com/video/slicing-the-cake-in-slow-motion-3326577/) Taryn Elliott, [30324202](https://www.pexels.com/video/precision-crafting-of-pink-pencil-sculpture-30324202/) Vũ Vũ, [5908184](https://www.pexels.com/video/pouring-paint-into-a-shape-5908184/) Mike Murray
- **Pixabay Content License**: top2 1위 [키네틱 샌드 144459](https://pixabay.com/videos/kinetic-sand-sand-cutting-asmr-144459/) (u_5l867xgjyb)
- **미국 연방기관 퍼블릭 도메인 (17 U.S.C. §105)**
  - top3: [Steamboat Geyser](https://www.nps.gov/media/video/view.htm?id=E82CA7B7-2638-42F3-9480-5280D003D608) NPS/Jacob W. Frank(2018.9.17) · [브라인 풀](https://archive.oceanexplorer.noaa.gov/okeanos/explorations/ex1711/dailyupdates/media/video/dive10-brinepool/brinepool.html) NOAA Office of Ocean Exploration and Research(2017, 멕시코만) · [데날리 오로라](https://www.nps.gov/media/video/view.htm?id=7207C6A8-ED77-4A35-B3F8-4F09E00B0B86) NPS/Jacob W. Frank(원본 배경음악은 별도 저작물이라 소리 없이 영상만) · [그랜드캐니언 구름 바다](https://www.nps.gov/media/video/view.htm?id=8564EE61-9CF1-4B78-A32F-546EEA5230E8) NPS/M. Quinn(2015.1.28) · [킬라우에아 43번째 분출](https://www.usgs.gov/media/videos/march-10-2026-video-kilauea-episode-43-lava-fountaining) USGS/M. Patrick(2026.3.10)
  - top4: ISS Crew Earth Observations (Image Science & Analysis Laboratory, NASA Johnson Space Center) — [번개](https://eol.jsc.nasa.gov/BeyondThePhotography/CrewEarthObservationsVideos/#lightningstorms_iss_20120218) ISS030-E-104579~104672(2012.2.18, 우간다→잔지바르) · [남극 오로라](https://eol.jsc.nasa.gov/BeyondThePhotography/CrewEarthObservationsVideos/#aurora_iss_20110917) ISS029-E-5985~6095(2011.9.17, 인도양) · [일식 그림자](https://eol.jsc.nasa.gov/BeyondThePhotography/CrewEarthObservationsVideos/#solareclipse_iss_20120520) ISS031-E-56780~57000(2012.5.20) · [러브조이 혜성](https://eol.jsc.nasa.gov/BeyondThePhotography/CrewEarthObservationsVideos/#lovejoy_iss_20111221) ISS030-E-14287~14400(2011.12.21) · [Earthset art002e021278](https://images.nasa.gov/details/art002e021278) NASA(아르테미스 2호, 2026.4.6)
  - 화면에는 “영상: Pexels/Pixabay/NASA”, “사진: NASA”, “영상: 미국 국립공원관리청(NPS)” 등 짧은 출처만 적었습니다. 기관 로고·타이틀 카드는 쓰지 않았습니다.
- 음악: "Dark Fog", "Monkeys Spinning Monkeys", "Floating Cities", "Lightless Dawn" Kevin MacLeod (incompetech.com), CC BY 4.0

### 자막 속 사실과 출처
- 스팀보트 간헐천은 세계에서 가장 높이 솟는 활동 간헐천, 큰 분출은 300피트(91m) 이상 — [NPS Yellowstone](https://www.nps.gov/yell/learn/nature/steamboat-geyser.htm)
- 브라인 풀은 사실상 바닷속 호수, 염도가 주변 바닷물의 3~8배 — [NOAA Ocean Exploration EX1711](https://archive.oceanexplorer.noaa.gov/okeanos/explorations/ex1711/dailyupdates/media/video/dive10-brinepool/brinepool.html)
- 데날리 오로라: 영상 페이지(NPS Denali). 그랜드캐니언: 찬 공기가 따뜻한 공기층 아래 갇히는 드문 ‘지면 역전’이 협곡을 구름으로 채움 — [DOI/NPS](https://www.doi.gov/employees/news/nps-grand-canyon-fills-with-sea-of-clouds)
- 킬라우에아 43번째 분출(2026.3.10) 최고 분수 높이는 두 분출구 모두 “적어도 1,300피트(400m)로 추정” — [USGS HVO](https://www.usgs.gov/observatories/hvo/news/photo-video-chronology-march-10-11-2026-kilauea-episode-43-eruption-and) (화면: “최고 400m 이상 (추정)”)
- top4는 각 NASA 페이지 설명 그대로: 2012.2.18 중앙아프리카 번개 폭풍 / 2011.9.17 남극 오로라(인도양 상공) / 2012.5.20 동아시아 금환일식 때 구름 위 달 그림자 / 2011.12.21 러브조이 혜성 / 2026.4.6 아르테미스 2호 승무원이 찍은 Earthset(달 뒤로 지는 지구)

### 업로드 문구

**top1** — 역대급 소름 돋는 백룸 같은 공간 TOP5 ㄷㄷ
> 아무도 없는 밤 수영장, 끝이 안 보이는 지하주차장, 끝없는 지하 에스컬레이터, 사람 하나 없는 쇼핑몰 복도, 그리고 불 꺼진 병원 복도까지. ‘백룸’ 느낌 나는 실제 공간 TOP5! 다들 몇 위가 제일 소름 돋나요? 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — Tima Miroshnichenko, gusat silviu, Yunus Kılıç, Matthias Groeneveld, SN.CHE
> 음악: "Dark Fog" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #백룸 #리미널스페이스 #소름 #랭킹 #shorts

**top2** — 역대급 만족스러운 순간 TOP5 ㅋㅋ
> 구슬 슬라임, 초코 케이크 단면, 연필심 하트 조각, 흘러내리는 물감, 그리고 키네틱 샌드 자르기까지! 보기만 해도 속이 시원한 순간 TOP5. 다들 몇 위가 제일 좋아요? 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — cottonbro studio, Taryn Elliott, Vũ Vũ, Mike Murray · Pixabay — u_5l867xgjyb
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #만족 #ASMR #키네틱샌드 #힐링 #shorts

**top3** — 역대급 신기한 자연현상 TOP5 ㄷㄷ
> 91m 넘게 치솟는 세계 최대 활동 간헐천, 바닷속에 있는 호수(브라인 풀), 알래스카 데날리의 오로라, 구름 바다에 잠긴 그랜드캐니언, 그리고 2026년 3월 최고 400m(추정)까지 솟은 하와이 킬라우에아 용암 분수까지. 다들 몇 위가 제일 신기해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) — Jacob W. Frank, M. Quinn · 미국 해양대기청(NOAA Ocean Exploration) · 미국 지질조사국(USGS) — M. Patrick (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #자연현상 #용암 #오로라 #신기한영상 #shorts

**top4** — 우주에서 찍힌 소름 돋는 장면 TOP5 ㄷㄷ
> 국제우주정거장(ISS)에서 내려다본 번개 폭풍과 오로라, 2012년 금환일식 때 구름 위에 드리운 달 그림자, 지구 위로 떠오른 러브조이 혜성, 그리고 2026년 4월 아르테미스 2호 승무원이 찍은 ‘달 뒤로 지는 지구’까지. 전부 실제 사진·영상입니다. 다들 몇 위가 제일 소름?
> 영상·사진: NASA (ISS Crew Earth Observations, Image Science & Analysis Laboratory, NASA Johnson Space Center · Artemis II) (NASA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #우주 #NASA #소름 #지구 #shorts

## 낙서 짤툰 쇼츠 (`doodle1`~`doodle4`)

`research/research-formats2.md` 5절의 "낙서 짤툰 내레이션"(김블루·원정상·도롱챠·콩자반: 최근 15편 중 9~15편이 10만 이상)을 우리 그림과 스톡 사진으로 만든 4편이다. 화면은 검정 바탕에 위쪽 2줄 제목 띠(윗줄 흰색, 아랫줄 초록 `#3CFF6A`), 가운데 1080×1080 그림, 아래 한 줄 자막(`captionY` 1640)이다. 그림은 세 종류를 섞는다. 사진 위에 선 낙서 주인공, 그린 배경의 낙서 장면, 가끔 `gfx` `vs`다. 2~4초마다 바뀐다. 내레이터는 Edge TTS `ko-KR-InJoonNeural` +25%로 빠르고 건조하게 읽는다. 짧은 인물 대사는 자기 목소리로 말풍선에 뜨고, 아래 자막은 없다. 끝은 시청자에게 묻는 한 줄이고, 0.3초 뒤에 끊는다(`"tail": 0.3`). 구독 요청이나 페이드아웃은 없다.

**시리즈 주인공 "도치"**: 주황색 삐죽머리(`#FF7A1A`)에 흰 감자 모양 몸, 막대 팔다리를 가진 낙서 캐릭터다. 네 편 모두에 나온다. 김블루(파란 머리 남자, 흰 곰 후드)나 다른 채널의 캐릭터를 본뜨지 않고 새로 그렸다. 조연도 같은 스킨이고 머리만 다르다. 엄마는 갈색 파마(`perm`), 승객은 검은 단발(`bob`), 민머리(`bald`), 회색 파마다.

| id | 제목 띠 | 길이 | 내용 | 사실/창작 | 음악 |
| --- | --- | --- | --- | --- | --- |
| `doodle1` | 대부분 모르는 / 멀티탭의 수명 | 34.4초 | "몇 년 됐음?" → 콘센트·멀티탭 사고 5년간 387건 → "3년? 5년?" → 반전: 정해진 숫자는 없음 → 교체 신호(헐렁, 변색, 타는 냄새), 먼지, 멀티탭에 멀티탭 금지, 에어컨·온열기는 벽 콘센트 → "님 멀티탭은 몇 개 해당?" | 사실 (출처 아래) | Sneaky Snitch |
| `doodle2` | 중고거래 / "네고 되나요?"의 진화 | 32.1초 | 1만 원 의자 → 네고 → 8천 → "직접 가니까 5천" → 무료 나눔 요청 → "안 팔래요" → "배송비만 내주세요"(5단계) → 반전: 그 의자 아직 내 방에 있음 → "님들이 받은 최강 네고는?" | 창작 | Monkeys Spinning Monkeys |
| `doodle3` | 버스 하차벨 / 아무도 안 누르면 벌어지는 일 | 33.3초 | 두 정거장 전 → "누가 누르겠지" → 다들 같은 생각, 폰 보는 척 벨만 봄(`vs` 내가 누름 vs 남이 누름) → 버스 통과, 공기 영하 10도 → 네 명이 동시에 벌떡 "기사님, 내려요!" → 반전: 전부 같은 정류장 → 다 같이 걸어서 복귀 → "님들은 벨 먼저 누르는 쪽?" | 창작 | Scheming Weasel |
| `doodle4` | 엄마가 "냉장고에 있잖아" / 하면 벌어지는 일 | 35.0초 | 김치가 없음 → 엄마 "냉장고에 있잖아!" → 열어 봄, 없음 → 반찬통 탑 해체, 10분째 수색, 엄마 "문 좀 닫아!" → "눈은 장식이니?" → 엄마가 1초 만에 꺼냄, 맨 앞 칸 → `vs` 내 손 vs 엄마 손 → "님 집 냉장고도 엄마만 보이는 칸 있음?" | 창작 | Hyperfun |

```bash
media/doodle/fetch.sh                      # 사진 17장 → public/doodle/ (저장소에는 넣지 않음)
for i in 1 2 3 4; do python3 voice_edge.py doodle$i && python3 prep.py doodle$i && ./render.sh doodle$i final/doodle$i.mp4 && python3 qa_review.py doodle$i; done
```

**목소리**(`script.json`의 `voices`): 내레이터 `InJoon` +25%. 도치는 `HyunsuMultilingual` +18%·+12Hz. doodle2의 구매자는 `SunHi` +15%·+5Hz다. 구매자 대사는 따옴표 자막으로도 나온다. doodle4의 엄마는 `SunHi` +12%·−4Hz다.

**새 템플릿 부품**(모두 하위호환이다. 값을 안 쓰면 예전과 똑같이 그린다)

- **사진 배경** (`src/lib/Doodle.tsx`의 `PhotoBackdrop`, `Sseol.tsx`의 `Scene`): `scene`에 `"photo": "doodle/px16886334.jpg"`(public/ 아래 경로)를 주면 `bg` 대신 그 사진이 장면 칸을 채운다. 천천히 줌인하고(1.03→), 인물은 그 위에 선다. `"photoFit": "cover"`(기본) 또는 `"contain"`, `"photoPos": "70% 50%"`(CSS object-position)로 보일 부분을 고른다. 화면 크레딧은 클립의 `"credit": "사진: Pexels"`로 단다.
- **낙서 스킨** (`src/lib/Doodle.tsx`의 `Doodle`): 인물에 `"style": "doodle"`을 주면 찹쌀떡 대신 낙서 캐릭터로 그린다. 흰 몸, 막대 팔다리, 굵기가 고르지 않은 검정 선(선을 두 번, 다른 흔들림과 굵기로 그림)이다. 선은 1초에 8번 새로 그려져서 손그림처럼 떨린다(line boil). `"hair": "#FF7A1A"`는 머리색이고, `"hairdo"`는 `spiky`(기본), `perm`, `bob`, `bald` 중 하나다. 기존 13가지 `mood`와 `to`를 그대로 쓴다. 표정마다 팔 자세도 바뀐다(놀람은 만세, 생각은 턱 괴기, 거만은 팔짱, 화남은 허리에 손). `name`, `hat`, `flip`, `size`, `x`도 같다.
- **빨간 강조** `{단어}` (`src/lib/Marked.tsx`, `Captions.tsx`, `prep.py`): 자막(`cap`)과 제목 띠, 말풍선, `big`, 채팅에서 `{ }` 안의 단어가 빨강(`#FF3B3B`)이 된다. `[ ]` 노랑은 그대로다. 자막의 빨간 단어는 읽는 순간에도 빨강을 유지한다. prep.py는 `{ }`를 쓴 단어에만 `"red": true`를 적으므로, 기존 쇼츠의 `src/data/*.json`은 바이트 단위로 같다. teuk1로 확인했다. 데이터가 같고, 템플릿 변경 전과 후의 정지 화면(123프레임) md5가 같다.

**사진**: 모두 Pexels 사진이다. 사람 얼굴이 없는 물건·장소 사진이고, 읽히는 상표나 로고가 없는 것만 골랐다. 처음 고른 18358118(플러그 사진)은 상표 로고가 보여서 16886336으로 바꿨고, 4061622(냉장고)는 음료 상표가 보여서 뺐다. 각 사진 페이지를 2026-10-10에 열어 "License: Free"(Pexels License)를 확인했다. [Pexels License](https://www.pexels.com/license/)는 무료이고, 상업적 이용과 수정이 가능하며, 출처 표기는 필요 없다. 다만 식별 가능한 인물을 나쁘게 보여 주거나, 보증을 암시하거나, 수정하지 않은 사본을 다시 팔 수는 없다. 그래서 사진을 저장소에 넣지 않고 `media/doodle/fetch.sh`가 받는다. 페이지 주소, 파일 주소, 제작자, 쓴 구간(초)은 `media/doodle/sources.json`과 각 `edit.json`의 `sources`에 있다. 화면에는 "사진: Pexels"만 쓴다.

| 파일 | 제작자 | 쓴 곳(초) |
| --- | --- | --- |
| [16886334](https://www.pexels.com/photo/many-chargers-are-connected-to-an-electrical-outlet-on-a-white-background-16886334/) 멀티탭과 충전기 | Саша Алалыкин | doodle1 0~2.4 |
| [8101095](https://www.pexels.com/photo/white-power-strip-on-gray-floor-8101095/) 바닥의 멀티탭 | Nikita Nikitin | doodle1 8.0~11.5 |
| [8101107](https://www.pexels.com/photo/white-wall-socket-on-white-painted-wall-8101107/) 벽 콘센트 | Nikita Nikitin | doodle1 16.7~18.6 |
| [16886336](https://www.pexels.com/photo/many-chargers-are-connected-to-an-electrical-outlet-on-a-white-background-16886336/) 충전기 꽂힌 멀티탭 | Саша Алалыкин | doodle1 18.6~20.6 |
| [5544612](https://www.pexels.com/photo/sockets-and-cables-5544612/) 줄줄이 이은 콘센트 | Tim Mossholder | doodle1 26.6~29.9 |
| [36757234](https://www.pexels.com/photo/rustic-wooden-chair-against-weathered-wall-36757234/) 낡은 나무 의자 | Gizem Gökce | doodle2 0~3.4, 21.2~23.0, 27.5~30.2 |
| [6170455](https://www.pexels.com/photo/brown-cardboard-box-beside-white-wooden-door-6170455/) 문 앞 상자 | Tima Miroshnichenko | doodle2 24.7~27.5 |
| [17800465](https://www.pexels.com/photo/stop-button-on-a-bus-17800465/) 버스 하차 버튼 | Elina Volkova | doodle3 0~2.8, 12.6~14.8, 31.2~33.2 |
| [15595486](https://www.pexels.com/photo/interior-of-bus-15595486/) 빈 버스 안 | Pramod Tiwari | doodle3 4.8~6.8 |
| [15595490](https://www.pexels.com/photo/empty-seats-in-bus-15595490/) 버스 좌석 | Pramod Tiwari | doodle3 6.8~10.9 |
| [21348105](https://www.pexels.com/photo/seoul-21348105/) 밤의 서울 버스 | Elina Volkova | doodle3 18.0~19.8 |
| [21235187](https://www.pexels.com/photo/bus-at-stop-on-street-21235187/) 정류장의 버스 | Elina Volkova | doodle3 25.8~27.4 |
| [38853682](https://www.pexels.com/photo/organized-refrigerator-with-bottles-and-limes-38853682/) 냉장고 안 | thAnh nguyễn | doodle4 0~2.3, 23.5~26.9 |
| [6508345](https://www.pexels.com/photo/interior-of-contemporary-light-kitchen-with-white-furniture-and-modern-appliances-6508345/) 부엌 | Max Vakhtbovych | doodle4 2.3~4.3, 17.3~20.4 |
| [4058699](https://www.pexels.com/photo/evening-kitchen-neon-home-4058699/) 밤의 냉장고 | cottonbro studio | doodle4 5.7~6.8 |
| [4443439](https://www.pexels.com/photo/fruits-and-vegetables-in-the-fridge-4443439/) 냉장고 채소 칸 | Polina Tankilevitch | doodle4 6.8~10.4, 32.5~35.0 |
| [6823267](https://www.pexels.com/photo/clear-glass-jar-with-kimchi-beside-the-wooden-chopsticks-6823267/) 김치 병 | Antoni Shkraba | doodle4 26.9~28.6 |

**doodle1 사실 확인**

- "콘센트·멀티탭 사고 5년간 387건": 2020~2024년 소비자위해감시시스템(CISS)에 접수된 콘센트·멀티탭·플러그 안전사고 387건이다(79건에서 101건으로 늘었다). 출처는 산업통상부(제품안전정보과)·한국소비자원·국립소방연구원 보도자료 「멀티탭 오사용 시 화재 위험, 어린이 사고 많아 보호자 주의 필요」, 2025-09-04: https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/170883/view
- "멀티탭에 멀티탭 꽂기 금지", "에어컨·온열기는 벽 콘센트": 같은 보도자료의 주의사항이다. 원문은 "멀티탭에 또 다른 멀티탭을 연결해 사용하지 말 것", "에어컨, 온열기같이 높은 소비전력의 제품은 벽면의 전용·단독 콘센트를 사용할 것"이다.
- "정해진 숫자(수명 몇 년)는 없음": 위 정부 보도자료와 소방 당국 안내에는 공통 교체 연수가 없다. 언론과 블로그가 인용하는 기간도 2년, 3~5년 등으로 서로 다르다. 그래서 숫자를 쓰지 않고 교체 신호를 소개했다. 비건뉴스(2026-08-29)는 "공식 소비자 자료에 공통 기준이 없다"고 정리했다: https://www.vegannews.co.kr/news/article.html?no=385250
- 교체 신호, 먼지, 오래된 멀티탭
  - 헐렁함: 서울시와 한국전기안전공사의 생활 전기안전 캠페인은 "플러그가 느슨하게 접속되면 먼지 등 인화성 물질이 불꽃을 일으킬 수 있다"고 안내한다. 위 비건뉴스 기사에서 인용했다.
  - 오래된 멀티탭: 소방청은 "피복이 벗겨진 전선이나 오래된 멀티탭을 즉시 새 제품으로 교체"하라고 안내했다. 같은 기사에서 인용했다.
  - 노후화와 먼지: 부산소방재난본부 화재조사담당은 "노후화ㆍ먼지 오염 등으로 화재가 발생할 수 있으므로" "오래된 멀티탭을 교환하고 먼지 제거 등 자주 청소를 해야 한다"고 밝혔다. 소방방재신문 2019-10-07: https://www.fpn119.co.kr/123504
  - 콘센트 사이 먼지: 전남 강진소방서는 콘센트 사이에 쌓인 먼지가 전류와 만나 불꽃 화재가 나는 사례(트래킹)를 알렸다(2023-01, 시민일보): https://siminilbo.co.kr/news/newsview.php?ncode=1160275377962087
  - 변색·그을음·타는 냄새는 위 비건뉴스 기사가 정리한 사용 중단 신호다. 화면에서는 "변색", "타는 냄새면 바로 교체"로만 짧게 말한다.
- "기억 안 나면 이미 꽤 된 거임"은 농담조 문장이고 수치를 말하지 않는다.

**qa_review**: 4편 모두 11개 항목 PASS(WARN·FAIL 0). 처음 doodle2·doodle3에서 `big`이 장면 끝에 떨어져 거의 안 보였다. 그래서 `big`은 줄 시작 0.4~0.5초 뒤(`"e+0.5"`)로 당겼고, 첫 장면은 0초부터 보이게(-1) 했다. doodle2는 처음에 다른 의자 사진을 섞어 썼는데, "그 의자 아직 내 방에 있음"과 맞지 않아서 같은 의자(36757234)로 통일했다.

**업로드 문구**

`doodle1`
- 제목: 대부분 모르는 멀티탭의 수명 ㄷㄷ
- 설명:
  ```
  님 방 멀티탭, 몇 년 됐음? 🔌 정해진 수명 대신 이런 신호가 오면 교체! 님 멀티탭은 몇 개 해당?
  출처: 산업통상부·한국소비자원·국립소방연구원 보도자료(2025.9.4, 2020~2024년 CISS 접수 387건), 소방청·부산소방재난본부·서울시·한국전기안전공사 안전 안내
  사진: Pexels (Саша Алалыкин, Nikita Nikitin, Tim Mossholder) · 캐릭터는 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #멀티탭 #생활꿀팁 #전기안전 #짤툰 #낙서툰

`doodle2`
- 제목: "네고 되나요?"의 진화ㅋㅋ
- 설명:
  ```
  만 원짜리 의자 올렸다가 배송비 낼 뻔한 썰 🪑 님들이 받아본 최강 네고는? (창작)
  창작 짤툰입니다. 등장인물과 대화는 실제와 관계없으며 특정 앱·서비스와 무관합니다.
  사진: Pexels (Gizem Gökce, Tima Miroshnichenko)
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #중고거래 #네고 #공감 #짤툰 #낙서툰

`doodle3`
- 제목: 버스 하차벨 아무도 안 누르면ㅋㅋ
- 설명:
  ```
  누가 누르겠지… 하다가 다 같이 걸어간 썰 🚌🔔 님들은 벨 먼저 누르는 쪽? (창작)
  창작 짤툰입니다. 등장인물은 실제와 관계없습니다.
  사진: Pexels (Elina Volkova, Pramod Tiwari)
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #버스 #하차벨 #눈치게임 #공감 #짤툰

`doodle4`
- 제목: 엄마 "냉장고에 있잖아"ㅋㅋ
- 설명:
  ```
  10분 찾아도 없던 김치, 엄마는 1초 컷 🫙 님 집 냉장고도 엄마만 보이는 칸 있음? (창작)
  창작 짤툰입니다. 등장인물은 실제와 관계없습니다.
  사진: Pexels (thAnh nguyễn, Max Vakhtbovych, cottonbro studio, Polina Tankilevitch, Antoni Shkraba)
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #엄마 #냉장고 #공감 #짤툰 #낙서툰

## 2D 운전 참교육 애니 (`road1`~`road4`)

알룔료(구독 35.2만, 최근 15편 모두 10만+, 중앙값 127만)의 "2D 운전 참교육" 쇼츠(`research/research-formats2.md` 7절)를 우리 그림으로 만든 4편이다. 단순한 2D 차와 찹쌀떡 운전자가 도로 빌런(1차로 정속 주행, 깜빡이 없는 끼어들기, 빨간불 우회전, 스쿨존 과속)을 연기한다. 주인공 표정이 바뀌고, 법규가 나오고, 빌런은 **합법적인 결과**(경찰 단속, 범칙금)로 참교육을 당한다. 사고 장면, 실제 차종·로고, 번호판은 없다. 보복운전은 "범죄"라고 화면과 내레이션에서 말한다(1·2편).

- **틀**: 박자 4개. ① 빌런 행동(0초부터, 첫 프레임이 썸네일) → ② 주인공 반응(운전석 시점, 말풍선) → ③ 법규(조문 그대로, 숫자는 확인한 것만) → ④ 경찰 단속과 범칙금 통고 카드 → 댓글 질문 한 줄, 바로 컷.
- **시리즈 고정**: 주인공 "나"는 파란 차·노란 얼굴(`#4DA3FF`/`#FFD84D`), 빌런은 빨간 차·보라 얼굴(`#FF5C5C`/`#C9A7FF`), 제목 띠 둘째 줄은 빨강(`"titleKey": "#FF3B3B"`).
- **목소리**: 내레이터 `InJoon` +20%, 빌런 `HyunsuMultilingual` +10~12%·−6Hz, 나 `SunHi` +15%·+10Hz, 경찰 `InJoon` +12%·−14Hz. 대사 줄은 `"cap": [""]`(말풍선만).
- **그림·소리**: 전부 직접 그린 것(`src/lib/Road.tsx`, 얼굴은 `Sseol.tsx`의 `Mochi`)이고 경적·사이렌은 numpy로 합성했다(`road_sfx.py`). 외부 사진·영상이 없어서 `sources`는 비어 있고 화면 크레딧도 없다. 사실 근거는 `media/road/facts.json`.

| id | 제목 띠 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `road1` | 고속도로 1차로 / 정속 주행 빌런 참교육 | 36.4초 | 뻥 뚫린 1차로를 막는 빌런 → 답답한 나(위협은 보복운전) → 1차로는 추월할 때만, 끝나면 오른쪽으로(막힐 땐 예외) → 순찰차에 갓길로, 범칙금 4만 원 → "여러분 앞에도 이런 차 있었죠?" | Hyperfun |
| `road2` | 깜빡이 없이 / 훅 들어오는 차의 최후 | 39.5초 | 노깜빡이 끼어들기, 급브레이크 연쇄 → 똑같이 하면 보복운전 → 30m(고속도로 100m) 전부터, 다 옮길 때까지 깜빡이 → 또 끼어든 뒤차가 경찰차, 범칙금 3만 원 → "깜빡이 잘 켜시나요?" | Sneaky Snitch |
| `road3` | 빨간불 우회전 / 무조건 서야 하는 이유 | 39.8초 | 빨간불에 멈춘 나에게 빵빵대는 빌런 → 앞 신호 빨간불이면 정지선에서 일단 멈춤(2023.1.22~), 건너려는 사람 있으면 또 멈춤 → 안 서고 간 빌런 단속, 신호 위반 6만 원 → 반전: 우회전 신호등이 있으면 초록 화살표에만 | Scheming Weasel |
| `road4` | 스쿨존에서 / 30km 넘으면 생기는 일 | 38.3초 | 스쿨존 55km/h 빌런 → 제한속도 대부분 30, 아이가 튀어나와도 30이라 멈춘 나 → 오전 8시~오후 8시 범칙금 가중(20~40 초과: 6만 → 9만) → 25km 초과 단속, 범칙금 9만 원 → "지키고 계신가요?" | Hustle |

```bash
python3 voice_edge.py road1 && python3 prep.py road1 && ./render.sh road1 final/road1.mp4 && python3 qa_review.py road1
```

**qa_review**: 4편 모두 11개 항목 PASS(WARN·FAIL 0). 첫 시도에서 `road3`가 제목 호기심(패턴 없음)과 장면 길이(7.1초, 같은 교차로 장면끼리 이어진 곳)에서 FAIL이어서, 제목을 "빨간불 우회전 / 무조건 서야 하는 이유"로 바꾸고 그 두 클립을 이미 확대된 채로 시작하게(`zoom: [from, to]`) 했다. `road2`는 끝 시각이 프레임 반올림 경계에 걸려 마지막 1프레임이 검게 나와서 `tail`을 0.42로 늘렸다(템플릿 수정 없음, 아래 참고).

### 새 템플릿 부품: `road` 그래픽 클립 (`src/lib/Road.tsx`)

`clips`의 한 항목에 `"gfx": {"type": "road", ...}`를 넣는다. 1080×1080 칸에 그려지고, `scene`·`post`처럼 검정 바탕에 자막 그늘이 없다(`ClipShort.tsx`). qa_review는 `road` 클립을 그림 장면으로 세서 더 작은 화면 변화도 전환으로 잡는다. `steps`는 다른 그래픽처럼 내레이션 기준점이나 클립 시작 후 초이고, 아래 값의 "step"은 `steps`의 번호다.

| 값 | 쓰임 |
|---|---|
| `view` | `"top"`(위에서 본 도로, 기본) 또는 `"cockpit"`(운전석: 앞유리·대시보드·핸들·주인공 얼굴, 앞차는 뒷모습) |
| `lanes` | 차로 수(기본 3). 1차로가 가장 왼쪽(중앙선 옆). 갓길 장면은 `lanes: 4`로 두고 4차로에 `paint` "갓길" |
| `road` | `"highway"`(잔디, 기본) `"city"`(보도) `"school"`(붉은 스쿨존 포장) `"tunnel"`(어두운 벽·주황 조명) |
| `speed` / `stopAt` | 차선이 흘러가는 속도 px/s(기본 900, 0이면 정지). `stopAt` step에 서서히 멈춤 |
| `solid` | 차선을 실선으로(차로 변경 금지 구간) |
| `cars[]` | `{lane, y, color, kind: "car"\|"truck"\|"bus"\|"police", face, mood, to, toAt, tag, path, blink, blinkAt, blinkOff, brake, brakeOff, honk, honkAt, fast, sirenAt}` |
| `cars[].y` | top: 차 중심 y(0 위 ~ 1080 아래). cockpit: 거리(0 멀리 ~ 1080 바로 앞) |
| `cars[].path` | `[[step, lane, y, rot?, dur?], ...]`. 그 step부터 `dur`초(기본 0.7) 동안 부드럽게 이동. `lane`은 소수 가능(차로 사이), 차로 변경 때 차 머리가 저절로 돌아간다. `rot` 90은 오른쪽을 향함(우회전) |
| `blink` | `"L"`/`"R"` 깜빡이(`blinkAt`~`blinkOff` step 동안 점멸) |
| `brake` | 브레이크등. `true`(처음부터) 또는 step 번호, `brakeOff` |
| `honk` | 경적 말풍선("빵!"), `honkAt` step부터 1.2초. 화면이 살짝 떨린다(소리는 `sfx`의 `horn`) |
| `mood` / `to` / `toAt` | 운전자 표정(썰 캐릭터와 같은 13가지), `toAt` step(기본 steps[2])에 `to`로 바뀜 |
| `kind: "police"` | 흰 차체·검은 앞뒤·"경찰" 글씨·경광등(`sirenAt` step부터 빨강/파랑 점멸). 얼굴 없음 |
| `tag` / `fast` | 차 밑 이름표("나", "빌런"), 과속 차 뒤 속도선 |
| `people[]` | 걷는 사람(작은 찹쌀떡) `{x, y, path: [[step, x, y, dur]], color, mood, to, hat, size}` |
| `cross` | 이 y에 가로 교차로(위아래 횡단보도, 아래쪽 정지선) |
| `paint[]` | 아스팔트 글씨 `{lane, y, text}`(도로와 함께 흐름) |
| `signs[]` | 표지 `{x, y, text, kind: "speed"(빨간 원 숫자)\|"info"(파랑)\|"warn"(노랑)\|"green"(고속도로 초록), size}` |
| `light` | 오른쪽 위 신호등 `"red"`/`"yellow"`/`"green"`/`"arrow"`(초록 →), 또는 `[[step, 상태], ...]`(step −1은 처음) |
| `shake` | 이 step들에서 화면 흔들림(급정거) |
| `zoom` / `focus` | 천천히 다가감(숫자), 또는 `[시작, 끝]`(컷 순간부터 다른 화면 크기라서 비슷한 장면끼리도 전환으로 보임). `focus`는 가운데 둘 차 번호 |
| `say` / `sayAt` | 썰과 같은 말풍선. `who`는 차 번호, 또는 운전석 시점의 주인공 `"me"` |
| `big` / `bigAt` | 썰과 같은 큰 글씨(기본 steps[3]) |
| `ticket` / `ticketAt` | 아래에서 올라오는 통고 카드 `{title, lines}`(마지막 줄이 크게, `[ ]`는 빨강) |
| `imagine` | 과장·상상 장면: 보라 테두리 + "※ 상상" 표시 |
| `me` | 운전석 시점 주인공 `{face, mood, to, toAt, lane}`(`lane`은 주인공이 달리는 차로, 기본 2) |
| `place` | 왼쪽 위 장소 표시("📍 고속도로") |

- 효과음 `horn`·`siren`은 `fetch.sh`가 `road_sfx.py`로 `public/sfx/`에 만든다.
- 알아 둘 점: 컴포지션 길이는 `ceil(end×30)`인데 마지막 클립은 `round(end×30)`에서 끝나서, `end×30`의 소수부가 0.5 미만이면 마지막 1프레임이 비어 검게 나온다(기존 템플릿 동작). 이번에는 `tail`로 피했고 공유 코드는 고치지 않았다.
- 이번 4편은 모두 합법적인 결과(단속·범칙금)로 끝나서 `imagine`을 쓰지 않았다. 초능력·과장 참교육을 넣을 때는 반드시 `imagine: true`로 표시한다.

### 사실과 출처 (2026-10-10, 국가법령정보센터 현행 본문과 별표 원문 HWP에서 확인)

- 고속도로 1차로: 편도 3차로 이상은 "앞지르기를 하려는" 승용·경형·소형·중형 승합차가 다닌다. 차량통행량 증가 등으로 부득이하게 시속 80km 미만으로 다닐 수밖에 없으면 예외다. — 도로교통법 제60조제1항, 같은 법 시행규칙 제39조·[별표 9]
- 고속도로 지정차로 통행 위반 범칙금: 승용자동차등 4만 원. — 도로교통법 시행령 제93조제1항·[별표 8] 제39호
- 깜빡이 시기: 진로를 바꾸려는 지점 30m(고속도로 100m) 이상 앞에서. — 도로교통법 시행령 제21조·[별표 2]. 그 행위가 끝날 때까지 신호. — 도로교통법 제38조제1항
- 진로변경 신호 불이행 범칙금: 승용자동차등 3만 원. — 시행령 [별표 8] 제52호
- 빨간불 우회전: 정지선·횡단보도·교차로 직전에서 정지한 후, 신호에 따라 진행하는 다른 차의 교통을 방해하지 않고 우회전. 우회전 삼색등이 적색이면 우회전 불가. — 도로교통법 시행규칙 [별표 2](2022.1.21 개정). 2023년 1월 22일 시행, 우회전 신호등이 있으면 녹색 화살표에만 우회전. — 경찰청 발표 보도([보안뉴스](https://m.boannews.com/html/detail.html?idx=104515), [이투데이](https://www.etoday.co.kr/news/view/2213636))
- 횡단보도에 보행자가 통행하고 있거나 통행하려고 할 때 일시정지. — 도로교통법 제27조제1항
- 신호·지시 위반 범칙금: 승용자동차등 6만 원. — 시행령 [별표 8] 제4호
- 어린이 보호구역 제한속도: 시속 30km 이내로 제한할 수 있다(그래서 "대부분 30"이라고 썼다). — 도로교통법 제12조제1항
- 스쿨존 범칙금(오전 8시~오후 8시, 승용): 20km/h 초과 40km/h 이하 9만 원(일반 도로는 6만 원, [별표 8] 제6호). 55km/h는 25km/h 초과라서 이 구간이다. — 시행령 제93조제2항·[별표 10] 제3호
- 보복운전은 형사처벌 대상(형법상 특수협박 등)이라는 일반 설명만 썼고, 형량 숫자는 쓰지 않았다.
- 벌점은 별표 28의 표 구조를 확실히 읽지 못해서 쓰지 않았다. 별표 8의 묶음 금액(제21~43호 5/4만 원, 제44~53호 3/3만 원)은 HWP 표에서 병합 칸 순서를 보고 읽었고, 별표 10의 2배 관계(통행 금지·제한 위반 4만 → 8만, 보행자 보호 불이행 4만 → 8만)로 교차 확인했다.

### 업로드 문구

`road1`
- 제목: 1차로 정속 주행 빌런 참교육ㄷㄷ
- 설명:
  ```
  뻥 뚫린 고속도로 1차로를 막고 가는 차, 법으로는 어떻게 될까? 🚗💨 (창작 애니)
  1차로는 앞지르기할 때 쓰는 차로예요(도로교통법 제60조, 시행규칙 별표 9). 고속도로 지정차로 위반 범칙금은 승용차 4만 원(시행령 별표 8).
  뒤에서 바짝 붙거나 위협하는 보복운전은 범죄입니다. 위험한 차는 블랙박스 영상으로 신고하세요.
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #운전 #참교육 #1차로 #고속도로 #도로교통법

`road2`
- 제목: 깜빡이 없이 훅 들어오는 차의 최후ㄷㄷ
- 설명:
  ```
  깜빡이 없이 끼어드는 차, 결국 이렇게 됩니다 🚨 (창작 애니)
  차로를 바꿀 땐 30m 전부터(고속도로 100m), 다 옮길 때까지 방향지시등(도로교통법 제38조, 시행령 별표 2). 신호 불이행 범칙금은 승용차 3만 원(시행령 별표 8).
  화가 나도 똑같이 끼어들면 보복운전, 범죄입니다.
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #운전 #참교육 #깜빡이 #끼어들기 #도로교통법

`road3`
- 제목: 빨간불 우회전 무조건 서야 하는 이유ㄷㄷ
- 설명:
  ```
  빨간불 우회전, 그냥 가면 신호 위반! 뒤에서 빵빵대도 일단 멈춤 ✋ (창작 애니)
  2023년 1월 22일부터 앞 신호가 빨간불이면 정지선에서 멈춘 뒤 우회전(도로교통법 시행규칙 별표 2). 우회전 신호등이 있으면 초록 화살표에만. 신호 위반 범칙금은 승용차 6만 원(시행령 별표 8).
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #운전 #우회전 #일시정지 #참교육 #도로교통법

`road4`
- 제목: 스쿨존에서 30km 넘으면 생기는 일ㄷㄷ
- 설명:
  ```
  아무도 없어 보여도 스쿨존은 30 🚸 (창작 애니)
  어린이 보호구역은 시속 30km 이내로 제한할 수 있어요(도로교통법 제12조). 오전 8시~오후 8시 20km/h 초과 40km/h 이하 과속 범칙금은 승용차 9만 원, 일반 도로는 6만 원(시행령 별표 8·10).
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #스쿨존 #운전 #참교육 #어린이보호구역 #도로교통법

## 괴담 쇼츠 “이해하면 소름 돋는 ○○” (`horror1`~`horror4`)

디로록(구독 13.1만)의 「[괴담] 이해하면 무서운 ○○」는 최근 8편이 모두 70만~130만 회다. 짧은 수수께끼 괴담에 빨간 한 단어 제목을 붙이고, 다시 보게 만드는 반전 한 줄로 끝낸다. 공포·괴담은 10만+ 한국 오락 쇼츠에서 다섯 번째로 큰 주제다(중앙값 82만, `research/research-fun.md`). 네 편 모두 **직접 쓴 창작 괴담**이고, 사람이 나오지 않는 Pexels·Pixabay 실사 영상을 어둡게 보정해 깔았다.

- **화면**: 검정 띠 제목(`"titleStyle": "band"`, `"titleKey": "#ff2a2a"`). 둘째 줄은 장소 한 단어로, 빨간색이다. 아래쪽에 한 줄 자막(`"captionY": 1640`)을 둔다.
- **제목 첫 줄**: 화면에는 「[괴담] 이해하면 소름 돋는」을 쓴다. 만들 때는 `qa_review.py`의 제목 패턴 목록에 “무서운”이 없어서 “소름”을 넣었다. 지금은 “괴담”과 “무서운”도 목록에 있다. 업로드 제목에는 “이해하면 무서운”을 그대로 쓴다(검색어 #이해하면무서운이야기).
- **대괄호**: 띠 제목에서 `[ ]`는 강조 표시라 “[괴담]”이 그대로 보이지 않았다. 그래서 `\[`로 쓰면 대괄호를 글자 그대로 보여 주도록 `src/lib/Marked.tsx`와 `src/ClipShort.tsx`(Title)를 고쳤다. 기존 제목·자막에는 `\[`가 없어서 바뀌는 것이 없다. script.json에는 `"\\[괴담] 이해하면 소름 돋는"`으로 쓴다.
- **내레이션**: Edge TTS `ko-KR-InJoonNeural` `+5%` `-10Hz`, 짧은 문장. 엘리베이터 안내 방송(horror1)과 택배 문자(horror3)는 `ko-KR-SunHiNeural`로 읽는다.
- **구성**: 평범한 상황 3~4문장, 생각해야 이상한 한 가지, 봉인하는 마지막 줄, 0.5~0.6초 쉼, 그리고 “이해하셨나요? 정답은 댓글에”.
- **효과음**: 효과음은 아껴 썼다. 딩·경고음·도어락 확인음은 상황 소리로 쓰고, 반전 직전에 심장박동, 끝 줄에 글리치를 넣었다. 번쩍임은 편마다 한 번이다.
- **음악**: Kevin MacLeod “Gathering Darkness”(horror1·3), “Ghost Story”(horror2·4). `fetch.sh`의 incompetech 목록에 두 곡을 더했다.
- 피·폭력·실존 장소·브랜드·인물은 없다. 공포는 암시로만 준다.

| id | 띠 제목 | 길이 | 이야기 (정답) |
| --- | --- | --- | --- |
| `horror1` | [괴담] 이해하면 소름 돋는 / 엘리베이터 | 34.3초 | 밤 11시, 건물엔 나 혼자. 1층에서 부른 엘리베이터가 4→3→2→1로 내려와 텅 빈 채 열림. 한 발 들어서자 “정원이 초과되었습니다”. 뒷걸음질, 엘리베이터는 혼자 위로. “나는 다음 걸 타기로 했다.” (정답: 눈에 안 보이는 ‘누군가들’로 이미 꽉 차 있었다. 위층에서 내려온 것도 그들) |
| `horror2` | [괴담] 이해하면 소름 돋는 / 도어락 | 36.4초 | 새벽 3시 도어락이 열렸다 다시 잠김. 비밀번호는 나만 앎. 아침에 현관은 그대로인데 신발이 한 켤레 더. “나는 혼자 산다.” (정답: 누군가 들어와서 안에서 문을 잠갔고, 나간 적이 없다. 아직 집 안에 있다) |
| `horror3` | [괴담] 이해하면 소름 돋는 / 택배 | 28.0초 | 회사에서 받은 택배 문자: “문 앞에 두었습니다. 안에 계신 분이 바로 받아 가셨어요.” 나는 회사, 혼자 살고, 문은 잠그고 나왔다. 퇴근해 보니 문 앞엔 아무것도 없다. (정답: 잠긴 집 안에 누군가 있었고, 택배를 들고 들어갔다. 지금도 안에 있다) |
| `horror4` | [괴담] 이해하면 소름 돋는 / 거울 | 28.5초 | 새 원룸의 큰 거울 속 방은 늘 조금 어둡다. 불을 끄고 누웠는데 거울 속 방은 아직 불이 켜져 있고, 거울 속 침대엔 아무도 누워 있지 않다. (정답: 거울 속은 내 방의 반사가 아니라 다른 ‘누군가’의 방이다. 그 사람은 지금 누워 있지 않다. 일어나서 이쪽을 보고 있다) |

```bash
# 원본: media/horror/sources.json 의 file_url에서 받아 public/<id>/src/ 에 (파일 이름은 edit.json sources.file)
#   40~60초로 자르고 1080p·무음으로 줄인 뒤 어둡게 보정:
#   ffmpeg -i <원본> -t 40 -vf "scale=-2:1080,fps=30,eq=gamma=0.78:contrast=1.08:saturation=0.5,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/4.5" -an <file>
#   (이미 어두운 클립 19217894/5/9, 7598737, 5384813, 4623153, 34786856/878은 eq=saturation=0.6과 푸른 톤만, Pixabay 28237은 eq=gamma=1.6:saturation=0.6과 푸른 톤)
python3 media/horror/make_edits.py          # shorts/horror*/edit.json + media/horror/sources.json
for id in horror1 horror2 horror3 horror4; do python3 voice_edge.py $id && python3 prep.py $id && ./render.sh $id final/$id.mp4; done
for id in horror1 horror2 horror3 horror4; do python3 qa_review.py $id; done
```

### 영상과 라이선스 (2026-10-10, 각 페이지에서 라이선스 확인)
사람이 나오는 클립은 쓰지 않았다. 35999369(문 잠금장치)는 손이 들어오기 전(0~2.5초)과 손이 빠진 뒤(5.9초~)만 썼다. horror3의 택배 상자(7362620)와 종이봉투(7362603)는 상표·스티커·“LEAVE PACKAGE HERE” 매트가 화면에 안 들어오게 잘라 썼다(`crop`). 화면에는 “영상: Pexels” 또는 “영상: Pixabay”만 표시한다. 페이지·파일 주소·제작자·쓴 구간은 `media/horror/sources.json`과 각 `edit.json`의 `sources`에 있다.
- **Pexels License** (무료, 수정 가능, 출처 표기 불필요. 수정 없는 판매·재배포 금지):
  - horror1: 978049 Stefan Kwiecinski, 5823578 Charlotte May, 34779661 Stefan, 37410328 Airam Dato-on, 15201563 Darina Evstafeva, 19217894 Nino Souza, 15434928 Yusuf Çelik
  - horror2: 9658661 Videas Cl, 35999369 Jakub Bukowski, 29038649 Адам Аушев, 8472547 MART PRODUCTION, 3512344 Bran Sodre, 19217899 Nino Souza, 7598737 Artadya Gumelar, 5384813 Tima Miroshnichenko
  - horror3: 34786856·34786878 Sambhaji Gaikwad, 7362603·7362620 RDNE Stock project, 5483080 cottonbro studio, 8346903 Kampus Production, 9658661 Videas Cl, 15365449 Matthias Groeneveld, 7598737 Artadya Gumelar
  - horror4: 36778198 Curtis Adams, 32834268 Benjamin Eriksen, 27861219 Nothing Ahead, 5384813 Tima Miroshnichenko, 4623153 Artem Podrez, 19217895 Nino Souza, 7598737 Artadya Gumelar
- **Pixabay Content License** (무료, 수정 가능, 출처 표기 불필요. 원본 그대로의 판매·배포 금지): [130783](https://pixabay.com/videos/elevator-door-open-waiting-elevator-130783/)·[131012](https://pixabay.com/videos/inside-elevator-elevator-rise-131012/) Jesehab(horror1), [28237](https://pixabay.com/videos/house-door-open-spirit-haunted-28237/) Jacques_Barrette(horror2)
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0.

### 업로드 문구
설명란 첫 줄에 **창작 괴담**이라고 밝힌다. 고정 댓글: “정답 맞히신 분? 댓글로 풀이해 주세요 👀”.

**horror1** — [괴담] 이해하면 무서운 엘리베이터 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물과 관계없습니다. 아무도 없는 엘리베이터가 왜 정원 초과였을까요? 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Stefan Kwiecinski, Charlotte May, Stefan, Airam Dato-on, Darina Evstafeva, Nino Souza, Yusuf Çelik), Pixabay (Jesehab)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #엘리베이터 #shorts

**horror2** — [괴담] 이해하면 무서운 도어락 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물과 관계없습니다. 새벽 3시에 열렸다 닫힌 도어락, 그리고 한 켤레 늘어난 신발. 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Videas Cl, Jakub Bukowski, Адам Аушев, MART PRODUCTION, Bran Sodre, Nino Souza, Artadya Gumelar, Tima Miroshnichenko), Pixabay (Jacques_Barrette)
> 음악: "Ghost Story" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #도어락 #shorts

**horror3** — [괴담] 이해하면 무서운 택배 문자 ㄷㄷ
> 창작 괴담입니다. 실제 업체·인물과 관계없습니다. 나는 회사에 있고, 혼자 사는데… 택배는 누가 받아 갔을까요? 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Sambhaji Gaikwad, RDNE Stock project, cottonbro studio, Kampus Production, Videas Cl, Matthias Groeneveld, Artadya Gumelar)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #택배 #shorts

**horror4** — [괴담] 이해하면 무서운 거울 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물과 관계없습니다. 불을 껐는데 거울 속 방은 아직 밝았다면? 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Curtis Adams, Benjamin Eriksen, Nothing Ahead, Tima Miroshnichenko, Artem Podrez, Nino Souza, Artadya Gumelar)
> 음악: "Ghost Story" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #거울 #shorts

## 그 시절 레트로 쇼츠 (`retro1`~`retro4`)

`research/research-formats2.md` 6절의 "그 시절 레트로" 포맷입니다. 검정 바탕, 위 2줄 띠 제목(윗줄 흰색, 아랫줄 노랑), 가운데 **둥근 모서리 4:3 옛 사진**(필름 그레인, 왼쪽 위 노란 연도 스티커), 아래 한 줄 자막으로 되어 있습니다. 사진은 한 줄에 한 장씩 3~4초마다 바뀌고 천천히 줌됩니다. 내레이션은 Edge TTS `ko-KR-SunHiNeural` `+10%`이고, "지금은 ○○" 대비 한 줄 뒤에 "이 시절 ○○, 기억나는 분?"으로 끝납니다.

| id | 띠 제목 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `retro1` | 해 질 때까지 / 골목에서 놀던 시절 | 33.3초 | 1978년 서울 한남동 골목 아이들 → 고무줄(1952 진해·마산) → 널뛰기 → 쪼그려 앉아 노는 남자아이들 → 1968년 물방개 뽑기 장수 → 찻길 축구·냇가 물놀이·놀이터(KTV 1958·1973) → 국가기록원 "산업화로 많은 놀이가 사라졌다" → 기억나는 분? | Heartwarming |
| `retro2` | 세탁기 없던 그 시절 / 온 동네 빨래터 | 38.1초 | "빨래는 어디서?" → 1952년 부산 보수천 개울 → 아이 업고 빨래 → 마을 공동 빨래터(1953) → 수로 밑 → 자갈 위에 널어 말리기 → 1968년 서울 발로 밟아 빨기 → 1960~70년대에도 개울 빨래 → 세탁기는 1970년대부터 늘기 시작 → 2002년 말 보급률 96% → 기억나는 분? | Gymnopedie No 1 |
| `retro3` | 세간살이 통째로 / 지게로 나르던 시절 | 37.3초 | 1960년 수원, 세간살이를 진 지게꾼 → 1953년 부산 가구 지게 행상 → 멸치·과일 장수 → 밭 작물·땔감 → 아이용 작은 지게 → 길가에 세워 둔 지게 → 1956년 서울 자동차 5,335대 → 지금은 문 앞까지 택배 → 기억나는 분? | Gymnopedie No 2 |
| `retro4` | MZ는 모르는 / 그 시절 버스 정류장 | 35.1초 | 1968년 종로5가 정류장의 한복·양산 → 종로3가 버스와 택시 → 1954년 중앙청 앞 시내버스 → 1952년 대구 버스 → 독립문 옆 정류장 아이들 → 영등포 어르신들 → 1956년 서울 버스 810대 → 1959년 첫 신호등 → 지금 서울 시내버스 7,383대(9배 넘게) → 기억나는 분? | Gymnopedie No 1 |

```bash
python3 media/retro/fetch.py                  # 사진(공유마당)과 음악 → public/retroN/src/, public/music/ (라이선스도 다시 확인)
python3 voice_edge.py retro1 && python3 prep.py retro1
./render.sh retro1 final/retro1.mp4
python3 qa_review.py retro1
```

### 새 템플릿 부품 (`src/lib/Retro.tsx`)

`edit.json` 최상위에 두면 모든 클립에, 클립에 두면 그 클립에만 적용됩니다. 기존 쇼츠는 이 값이 없으므로 그대로 렌더됩니다(teuk1을 바꾸기 전후로 렌더해 프레임이 픽셀 단위로 같은 것을 확인).

- `"frame": "rounded43"` — 사진을 1080×1080 정사각 대신 둥근 모서리 4:3 액자(1020×765, 위 440px, 얇은 흰 테두리)에 넣고 바탕은 검정으로 둡니다. 크레딧은 액자 안 오른쪽 아래에 붙습니다. `"crop": [cx, cy, zoom]`을 주면 그 지점을 확대한 "디테일 컷"이 되어, 한 장면이 4.5초를 넘을 때 같은 사진으로 컷을 나눌 수 있습니다.
- `"grain": 0.15` — 사진 위에만 필름 그레인(프레임마다 바뀌는 노이즈)과 부드러운 비네팅을 얹습니다. 0~1.
- `"year": "1978"` — 액자 왼쪽 위의 노란 원형 연도 스티커입니다. 클립마다 다르게 줄 수 있고, 앞 클립과 연도가 바뀔 때만 톡 튀어나옵니다. 네 자리 숫자면 아래에 "년"이 붙습니다.
- 바꾼 곳: `src/lib/Retro.tsx`(새 파일), `src/ClipShort.tsx`(Clip 타입에 `rounded43`·`grain`·`year`, FRAME 한 줄, ClipView 분기 하나, Credit 위치 한 줄), `prep.py`(클립 `frame` 기본값을 edit.json 최상위에서 읽고, `grain`·`year`를 넘기는 3줄).
- "그때 vs 지금" 비교는 그래픽 카드 대신 숫자를 내레이션·자막·출처 스티커로 넣었습니다(그래픽 전용 화면은 쓰지 않는다는 요청에 따라). 필요하면 기존 `gfx` `vs`를 `"src"`와 함께 써서 사진 위에 얹을 수 있습니다.

### 사진 출처와 라이선스

모든 사진은 **공유마당(gongu.copyright.or.kr, 한국저작권위원회)** 에서 각 항목 페이지의 라이선스 표시를 직접 확인한 것만 썼습니다(2026-10-10). `media/retro/fetch.py`가 항목 페이지의 라이선스 코드를 읽어 `01`(공공누리 제1유형)이나 `21`(CC BY)이 아니면 BAD로 표시합니다. 항목별 페이지·파일 주소·라이선스·저작자·연도·사용 구간(초)은 `media/retro/retro1~4.json`과 각 `edit.json`의 `sources`에 있습니다.

- **한국저작권위원회 소장 근현대 사진 (CC BY)**: 공유마당 "2018년 공유저작물DB수집", 요약정보 "부경근대사료연구소에서 대한민국의 각 지역별 근현대사진을 수집하여 제공". 저작자 표시는 "한국저작권위원회".
- **한국정책방송원(KTV) 사진 (공공누리 제1유형)**: `retro1`의 1958·1973년 사진 3장(물놀이, 주택가 축구, 주택가 놀이터).
- 쓰지 않은 것: 서울역사아카이브(공공누리 1유형)는 이미지 서버가 8088 포트라 이 환경에서 받을 수 없었습니다. 공유마당의 셀수스협동조합 사진은 "기증저작물 자유이용"(공공누리 아님)이라 뺐습니다. 위키미디어 공용의 전민조 기증 사진은 원 출처(대한민국역사박물관) 페이지가 지금 공공누리 제4유형이고 신문사 사진기자의 사진이라 뺐습니다. 국가기록원 기록물 검색의 사진은 항목 페이지에 공공누리 유형 표시가 없어 쓰지 않았습니다. 전쟁·군 관련 장면(철조망, 군인, 비행장)과 상표가 크게 보이는 사진도 고르지 않았습니다.
- 사진은 1600px로 줄였고, 어두운 슬라이드 5장(`"fix": "bright"`)은 밝기를 보정했습니다. 화면에는 "사진: 한국저작권위원회", "사진: 한국정책방송원"만 표시합니다.

항목별 목록(사용한 사진):

- **retro1**: [1978년 서울 한남동 골목에 모여 놀이를 하는 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154959&menuNo=200018) (한국저작권위원회, 1978년, CC BY); [1952년 진해의 어느 공터에서 고무줄 뛰기를 하는 여자 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154364&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 마산의 어느골목에서 고무줄 뛰기를 하는 소녀들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154363&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 경남 진해 어느 마을 골목 마당에서 널뛰기를 하는 아이들 ](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154340&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1968년 물방개를 황용한 뽑기놀이 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153490&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [주택가 길에서 축구하는 어린이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13071730&menuNo=200018) (한국정책방송원, 1973-06-08, KOGL 1); [서울 시내 주택가 어린이 놀이터](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13071729&menuNo=200018) (한국정책방송원, 1973-06-08, KOGL 1); [물놀이하는 어린이들 ](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070985&menuNo=200018) (한국정책방송원, 1958-07-08, KOGL 1); [1978년 서울 한남동 학교 앞 문구점 앞의 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154977&menuNo=200018) (한국저작권위원회, 1978년, CC BY); [1978년 서울 한남동 주택가 골목안 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154972&menuNo=200018) (한국저작권위원회, 1978년, CC BY); [1952년 부산 수영구 남천동 농가의 마당에서 노는 여자 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153791&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년경 대구 둔산로 주변 마을 고목에서 그네 뛰는 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152472&menuNo=200018) (한국저작권위원회, 1952년경, CC BY)
- **retro2**: [1952년 부산 중구 보수천 하구에서 빨래를 하는 주민들_2](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153849&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 보수천 하구에서 빨래를 하는 주민들_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153772&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 보수천 하구에서 빨래를 하는 여인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153771&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 수영구 남천동 개울에서 아이를 업고 빨래를 하는 여인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153790&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 부산 외곽의 마을공동 빨래터](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153990&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1952년 9월 김포의 수로 밑에서 빨래를 하는 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153229&menuNo=200018) (한국저작권위원회, 1952년9월, CC BY); [1968년 서울의 어느 골목에서 빨래감을 발로 문지르고 있는 할머니](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154904&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1952년 대구 신천 강변에서 빨래를 널거나  머리를 감고 있는 여인_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152451&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 서울 외곽지역 정비된 하천에서 빨래하는 여인들_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154702&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1973년 10월 충주 달천에서 빨래하는 사람들과 계명산](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154395&menuNo=200018) (한국저작권위원회, 1973년 10월, CC BY); [1967년 6월 부산 동래구 세병교 아래에서 빨래하는 여인들과 동해남부선 철교](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154089&menuNo=200018) (한국저작권위원회, 1967년 6월, CC BY); [1953년 서울 외곽지역 정비된 하천에서 빨래하는 여인들_2](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154703&menuNo=200018) (한국저작권위원회, 1953년, CC BY)
- **retro3**: [1960년 수원 용주여관앞을 지나는 지게에 세간살이를 얹고가는 사람](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153007&menuNo=200018) (한국저작권위원회, 1960년, CC BY); [1953년 부산 중구의 가구를 지게에 지고 다니며 팔러 다니는 사람과 그 뒤를 따라 가는 아가씨들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155025&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1953년 부산 중심가 한국손해보험 앞 거리에서 가구를 지게에 지고가는 사람](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153994&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1952년 부산 중구 광복로 거리의 멸치 지게 행상인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153842&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1967년 대구거리_ 짐 운반용 지게를 진 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152680&menuNo=200018) (한국저작권위원회, 1967년, CC BY); [1952년 부산 남구 감만동 주민이 빈지게를 지고 지나가는 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153603&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 남구 대연동 우룡산 자락 밭에서 농작물을 캐서 지게에 지고 가는 여인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153641&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 남구 대연동 논둑 옆 길에 세워 둔 지게](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153627&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 작은 지게를 진 아이](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153202&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1952년 대구 지겟짐에 사과를 담아 거리에서 팔고있는 참외장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152344&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 서울 영등포역 앞 역전식당과 지게꾼](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154692&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1952년 부산 남구 대연동의 산에서 나무뿌리를 캐서 지게에 지고 가는 어르신](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153680&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1960년 6월 경기도 파주 법원리 도로의 지게에 짐을 지고 가는 사람](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153114&menuNo=200018) (한국저작권위원회, 1960년6월, CC BY)
- **retro4**: [1968년 서울 종로5가 거리와 택시, 시내버스 모습_2](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154193&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1954년 7월 14일 서울 중앙청 앞 대로를 지나는 시내버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154758&menuNo=200018) (한국저작권위원회, 19919, CC BY); [1960년 3월 서울시내 한국상업은행 앞 거리와 시내버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154858&menuNo=200018) (한국저작권위원회, 1960년 3월, CC BY); [1963년 서울거리의 시내버스 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154652&menuNo=200018) (한국저작권위원회, 1963년, CC BY); [1968년 서울 종로3가 거리와 택시, 시내버스 모습_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154192&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1952년 대구역 앞 시영버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152535&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 부산 부산진구 연지동의 시내버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155010&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1953년 서울 서대문구 독립문 옆 버스정류장의 사람들과 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154682&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1953년 서울 영등포의 버스를 기다리는 어르신들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154695&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1967년 대구 거리_ 외곽지역에서 버스를 기다리는 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152653&menuNo=200018) (한국저작권위원회, 1967년, CC BY); [1959년 서울역](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154168&menuNo=200018) (한국저작권위원회, 1959년, CC BY)

### 사실과 출처 (2026-10-10 확인)

- 사진의 연도·장소는 각 공유마당 항목의 제목과 창작년도를 그대로 따랐습니다(예: "1952년 부산 보수천 하구에서 빨래를 하는 주민들", "1960년 수원 … 지게에 세간살이를 얹고가는 사람", "1968년 서울 종로5가 거리와 택시, 시내버스 모습"). 사진에 보이지 않는 이야기는 지어내지 않았습니다.
- `retro1` — [국가기록원 「사진대한민국: 민속놀이」](https://theme.archives.go.kr/next/photo/folkPlay.do): "산업화로 농경생활의 틀에서 벗어나면서 여러 종류의 민속놀이가 우리 주변에서 사라졌다."
- `retro2` — [국가기록원 「사진대한민국: 가전제품」](https://theme.archives.go.kr/next/photo/homeAppliances.do): "1970년대 들어 … 냉장고, 세탁기의 보급률도 점차 높아지기 시작하였다", "2002년말 기준으로 주요 가전제품의 보급률은 … 세탁기 96%".
- `retro3` — [국가기록원 「사진대한민국: 자동차」](https://theme.archives.go.kr/next/photo/motorCar.do): "1956년 서울에는 5,335대의 자동차가 있었다."
- `retro4` — 같은 「자동차」 페이지: "그 중 … 버스가 810대", "1959년 전국적으로 총 6,319건의 교통사고가 발생하였고, 이로 인해 서울시내에 처음으로 교통신호등이 등장하였다." [서울시 교통분야 누리집 「시내버스, 마을버스 운영현황('26년 1월 기준)」](https://news.seoul.go.kr/traffic/archives/1706): 시내버스 64개 회사, 7,383대(예비 353대), 396개 노선. 7,383 ÷ 810 = 9.1 → "아홉 배가 넘죠".

### 업로드 문구

**retro1** — 해 질 때까지 골목에서 놀던 시절 ㅠㅠ
> 학교만 끝나면 다 골목으로! 1952년 진해·마산의 고무줄 뛰기, 마당의 널뛰기, 1968년 물방개 뽑기 장수, 1973년 서울 주택가 찻길 축구와 놀이터, 1978년 서울 한남동 골목의 아이들까지. 국가기록원은 산업화로 많은 놀이가 우리 곁에서 사라졌다고 적었습니다. 이 시절 골목 놀이, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집), 한국정책방송원(공유마당, 공공누리 제1유형) · 일부 크기 조정·밝기 보정
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #추억 #골목놀이 #옛날사진 #shorts

**retro2** — 세탁기 없던 그 시절, 온 동네 빨래터
> 세탁기가 없던 시절, 빨래는 개울에서 했습니다. 1952년 부산 보수천, 아이를 업은 채 빨래하는 엄마, 마을 공동 빨래터, 자갈 위에 널어 말린 빨래, 1968년 서울 골목에서 발로 밟아 빨던 할머니까지. 국가기록원에 따르면 세탁기 보급은 1970년대에 들어서야 높아지기 시작했고, 2002년 말 보급률은 96%였습니다. 이 시절 빨래터, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #빨래터 #옛날사진 #추억 #shorts

**retro3** — 세간살이 통째로 지게로 나르던 시절 ㄷㄷ
> 1960년 수원, 등에 진 건 세간살이 통째로! 1953년 부산의 가구 지게 행상, 멸치·과일 장수, 밭에서 캔 작물과 땔감, 아이용 작은 지게까지. 1956년 서울의 자동차는 5,335대뿐이었습니다(국가기록원). 지금은 클릭 한 번이면 문 앞까지 오는 택배. 이 시절 지게, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정
> 음악: "Gymnopedie No 2" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #지게 #옛날사진 #추억 #shorts

**retro4** — MZ는 모르는 그 시절 버스 정류장
> 1968년 종로5가 정류장, 한복에 양산 쓰고 버스를 기다리던 풍경. 1954년 중앙청 앞 시내버스, 1952년 대구 버스, 독립문 옆 정류장의 아이들까지. 1956년 서울의 버스는 810대, 1959년엔 서울에 첫 교통신호등이 생겼습니다(국가기록원). 지금 서울 시내버스는 7,383대(서울시, 2026년 1월 기준). 이 시절 버스 정류장, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정·밝기 보정
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #버스정류장 #옛날서울 #추억 #shorts

## 낙서 짤툰 쇼츠 2 (`doodle5`~`doodle10`)

`doodle1`~`doodle4`와 같은 틀로 만든 6편이다. `research/research-formats2.md` 9절의 "같은 틀로 여러 편"을 따랐다. 틀은 앞 4편과 똑같다: 검정 바탕, 2줄 제목 띠(아랫줄 초록 `#3CFF6A`), 가운데 1080×1080 그림, `captionY` 1640의 한 줄 자막, 주인공 도치(주황 삐죽머리 `"style": "doodle"`), 내레이터 InJoon +25%, 인물 대사는 자기 목소리의 말풍선(아래 자막 없음), 사진+낙서 장면과 가끔 `vs`, 끝은 묻는 한 줄 뒤 0.3초 컷. 템플릿 코드는 바꾸지 않았다. 새 조연은 같은 낙서 스킨이고 머리만 다르다: 친구(검은 단발 `bob`), 새벽 손님(회색 파마 `perm`).

| id | 제목 띠 | 길이 | 내용 | 사실/창작 | 음악 |
| --- | --- | --- | --- | --- | --- |
| `doodle5` | 대부분 모르는 / 계란 껍데기 숫자의 뜻 | 32.4초 | "이 숫자 뭔지 앎?" → 도치 "공장 번호 아님?" → 땡, 10자리 전부 뜻 있음 → 앞 4자리 산란일(0823 = 8월 23일) → 가운데 5자리 농장 고유번호(조회 가능) → 마지막 한 자리: 1 방사, 2 평사, 3·4 케이지 → `vs` 3번 0.075㎡ vs 4번 0.05㎡ → 4번은 A4 한 장보다 좁음 → "님 냉장고 계란은 몇 번임?" | 사실 (출처 아래) | Sneaky Snitch |
| `doodle6` | 회사 단톡 / "넵"의 7단계 | 34.8초 | 단톡 화면에 넵 → 넵! → 넵넵 → 넵 알겠습니다 → 넹 → `vs` 넵! vs 넵.... → 7단계: 도치가 "오늘은 어려울 것 같습니다" 보내자 팀장님의 "넵." → 공포 → "지금 바로 하겠습니다!" → "님은 주로 몇 단계 넵 씀?" | 창작 | Hustle |
| `doodle7` | 대부분 모르는 / 소화기 바늘의 비밀 | 33.2초 | "바늘 어디 가리킴?" → "바늘이 있었어?" → 손잡이 옆 압력계 → 초록이면 정상, 벗어나면 교체 → 분말 소화기 10년, 검사 합격 시 1회 3년 연장(`vs`) → "우리 집 거 2010년산인데?" → 쓰는 법 네 동작(안전핀, 바람 등지고, 호스 불 쪽, 손잡이 쥐고 빗자루처럼) → "지금 초록임?" | 사실 (출처 아래) | Scheming Weasel |
| `doodle8` | 카페 진동벨 / 울리면 벌어지는 일 | 32.3초 | 진동벨 받는 순간 게임 시작 → 벨만 쳐다봄(`vs` 친구 얼굴 vs 진동벨) → 친구 "내 말 듣고 있어?" → 옆 테이블 벨에 움찔 → 10분째 조용 → 카운터에 확인하러 감 → 그 순간 손에서 부르르르, 민망함 100% → 반전: 친구 벨이었음 → "님은 벨 울리면 몇 초 만에 일어남?" | 창작 | Monkeys Spinning Monkeys |
| `doodle9` | 식당에서 / "여기요" vs "저기요" | 34.2초 | 여기요파 vs 저기요파(`vs`) → 진짜 문제는 타이밍 → 손 반쯤 들었다가 머리 긁는 척 → 눈만 마주침 → 용기 내서 "저, 저기요…" → 아무도 못 들음 → 친구가 "이모! 여기 공깃밥 하나요!" 한 방 → 최강은 이모님파 → "님은 여기요? 저기요? 이모님?" | 창작 | Hyperfun |
| `doodle10` | 편의점 알바가 / 새벽 3시에 보는 손님 | 33.1초 | 새벽 3시, 매일 같은 손님 → 컵라면·삼각김밥, 말없이 먹고 감, 좀 무서움 → 비 오는 날 계산대로 직진 → 내민 건 따뜻한 캔커피 "이건 학생 거" → 야간 근무 퇴근길이었음 → 그날 이후 내가 먼저 인사 → "님은 이런 손님 만나 봄?" | 창작 (훈훈한 반전) | Sneaky Snitch |

```bash
media/doodle/fetch.sh                      # 사진 43장(doodle1~10) → public/doodle/ (저장소에는 넣지 않음)
for i in 5 6 7 8 9 10; do python3 voice_edge.py doodle$i && python3 prep.py doodle$i && ./render.sh doodle$i final/doodle$i.mp4 && python3 qa_review.py doodle$i; done
```

**목소리**(`script.json`의 `voices`): 내레이터 `InJoon` +25%, 도치 `HyunsuMultilingual` +18%·+12Hz(앞 4편과 같음). doodle9의 도치만 +5%로 늦췄다("저, 저기요…"가 작고 머뭇거리게). doodle6의 팀장님은 `SunHi` +10%·−8Hz, doodle8·doodle9의 친구는 `SunHi` +15%·+5Hz, doodle10의 손님은 `SunHi` +8%·−6Hz다.

**사진**: 모두 Pexels 사진이다. 사람 얼굴이 없는 물건·장소·동물 사진이고, 읽히는 상표·로고·간판이 없는 것만 골랐다. 각 사진 페이지를 2026-10-10에 열어 "License: Free"(Pexels License)를 확인했다(조건은 위 `doodle1`~`doodle4` 절과 같다). 고르는 중에 상표가 보인 사진(노트북·모니터 로고, 소화기 상표 라벨, 커피머신 상표, 편의점 상품 포장)과 산란계 케이지 사진, 휴대폰 화면 UI 사진은 뺐다. 진동벨은 Pexels에 쓸 만한 사진이 없어 🔔 이모지로 그렸다. doodle7의 압력계 사진(39649976)은 소화기용이 아닌 일반 압력계다. 초록·노랑·빨강 눈금이 있어 "초록이면 정상"을 보여 주는 그림으로만 썼고, 화면 문구는 "압력계"뿐이다. doodle9의 주방 사진(4947388) 안쪽 끝에 아주 작은 요리사 실루엣이 있으나 얼굴은 알아볼 수 없다. doodle10의 상가 사진(34534099) 오른쪽 끝의 약국 표시는 정사각형 자르기 밖이다. 페이지 주소, 파일 주소, 제작자, 쓴 구간(초)은 `media/doodle/sources.json`과 각 `edit.json`의 `sources`에 있다. 화면에는 "사진: Pexels"만 쓴다.

| 파일 | 제작자 | 쓴 곳(초) |
| --- | --- | --- |
| [8556246](https://www.pexels.com/photo/brown-eggs-in-egg-tray-8556246/) 달걀 판 | Marcello Sokal | doodle5 0.0~2.9 |
| [19891628](https://www.pexels.com/photo/eggs-on-white-background-19891628/) 흰 바탕 달걀 4개 | Ben Molyneux | doodle5 6.4~8.4 |
| [2255459](https://www.pexels.com/photo/flock-of-hens-on-green-field-2255459/) 풀밭의 닭 | Alexas Fotos | doodle5 17.1~19.2 |
| [1300375](https://www.pexels.com/photo/peep-of-brown-chicken-1300375/) 축사 바닥의 닭 | Magda Ehlers | doodle5 19.2~21.6 |
| [6294391](https://www.pexels.com/photo/fried-egg-with-condiment-in-frying-pan-6294391/) 달걀 프라이 | Klaus Nielsen | doodle5 30.6~32.4 |
| [8533741](https://www.pexels.com/photo/close-up-shot-of-a-smartphone-on-white-surface-8533741/) 흰 바닥의 휴대폰(빈 화면) | Hanna Pad (anna-nekrashevich) | doodle6 0.0~2.1 |
| [8472486](https://www.pexels.com/photo/a-photo-of-a-minimalist-workspace-8472486/) 책상 위 노트북(빈 화면) | Cup of Couple | doodle6 12.1~16.1 |
| [5483236](https://www.pexels.com/photo/an-empty-office-5483236/) 빈 사무실 | cottonbro studio | doodle6 22.2~23.7 |
| [30391091](https://www.pexels.com/photo/cozy-workspace-with-coffee-mug-on-desk-30391091/) 키보드 옆 커피 | Letícia Alvares | doodle6 30.0~33.0 |
| [21299748](https://www.pexels.com/photo/fire-alarm-21299748/) 벽에 걸린 소화기 | Jakub Zerdzicki | doodle7 0.0~2.5, 30.7~33.2 |
| [39649976](https://www.pexels.com/photo/analog-pressure-gauge-on-cutting-mat-39649976/) 압력계(일반용) | Mohsen Adelimoghaddam | doodle7 4.3~8.3 |
| [13756513](https://www.pexels.com/photo/photograph-of-a-red-fire-extinguisher-13756513/) 복도의 소화기 | Tibor Szabo | doodle7 12.9~14.7 |
| [4099350](https://www.pexels.com/photo/kitchen-room-design-4099350/) 가스레인지 부엌 | Taryn Elliott | doodle7 22.8~24.4 |
| [2566027](https://www.pexels.com/photo/coffee-machine-2566027/) 커피머신 | Sander Dalhuisen | doodle8 0.0~3.0 |
| [12620633](https://www.pexels.com/photo/cup-of-latte-art-on-brown-wooden-table-12620633/) 라테 | Gabriel | doodle8 3.0~4.9 |
| [18721982](https://www.pexels.com/photo/plants-near-chairs-in-restaurant-18721982/) 카페 실내 | Arda Kaykısız | doodle8 8.3~10.7 |
| [6612572](https://www.pexels.com/photo/an-espresso-machine-6612572/) 카페 카운터 | Pavel Danilyuk | doodle8 13.8~15.4 |
| [302900](https://www.pexels.com/photo/cappuccino-drink-on-table-302900/) 유리잔 라테 | Chevanon Photography | doodle8 26.6~29.9 |
| [30027297](https://www.pexels.com/photo/quiet-indoor-restaurant-with-sunlit-tables-30027297/) 빈 식당 | Jim (Jimothy) Natanauan | doodle9 0.0~2.8 |
| [13774731](https://www.pexels.com/photo/kimchi-stew-on-a-clay-pot-13774731/) 김치찌개 | Cynthia Ortega Espinosa | doodle9 8.6~10.6, 30.7~34.2 |
| [4947388](https://www.pexels.com/photo/kitchen-restaurant-4947388/) 식당 주방 | Maria Orlova | doodle9 14.1~17.5 |
| [2313695](https://www.pexels.com/photo/chopsticks-on-plate-near-foods-on-plates-2313695/) 만두와 반찬 | Lio Photography | doodle9 20.5~23.7 |
| [34534099](https://www.pexels.com/photo/shopping-cart-at-night-outside-storefront-34534099/) 밤의 상가 입구 | El Jundi | doodle10 0.0~3.2, 31.1~33.1 |
| [13796733](https://www.pexels.com/photo/noodles-with-vegetables-in-white-ceramic-bowl-13796733/) 컵라면 | Markus Winkler | doodle10 5.1~8.6 |
| [12394042](https://www.pexels.com/photo/lights-on-the-road-during-a-rainy-night-12394042/) 비 오는 밤길 | Denniz Futalan | doodle10 13.1~15.2 |
| [18139081](https://www.pexels.com/photo/steam-over-a-cup-18139081/) 김 나는 머그잔 | More Amore | doodle10 20.9~24.2 |

**doodle5 사실 확인**

- "10자리 = 산란일자 4자리 + 농장(생산자) 고유번호 5자리 + 사육환경번호 1자리", 예 "0823M3FDS2" = 8월 23일 산란: 식품의약품안전처, 정책브리핑 「"이제 산란일자 표시보고 신선한 달걀 구입하세요"」 2019-08-02: https://www.korea.kr/news/policyNewsView.do?newsId=148863411 , 농림축산식품부 「닭이 알을 낳은 날짜 확인하고 구입하세요」 2019-02-21(식약처·농식품부, 2019-02-23 시행): https://www.mafra.go.kr/bbs/mafra/68/319933/artclView.do
- 사육환경번호 "1 방사, 2 평사, 3 개선 케이지(0.075㎡/마리), 4 기존 케이지(0.05㎡/마리)": 농림축산식품부 「계란 껍데기 표시정보(난각표시)로 계란 이력정보 확인하세요」 2022-01-20: https://www.mafra.go.kr/bbs/mafra/68/329424/artclView.do . 같은 식약처 2019-08-02 자료는 1을 "방목장에서 닭이 자유롭게 다니도록", 2를 "케이지(닭장)와 축사를 자유롭게 다니도록" 키우는 방식으로 설명한다. 화면의 "닭장 없이 축사 안을 다님"은 이 설명을 줄인 것이다.
- "번호로 어느 농장인지 조회 가능": 위 농식품부 2022-01-20 자료(축산물이력관리시스템 www.mtrace.go.kr·축산물이력제 앱), 식품안전나라 달걀 이력 조회: https://www.foodsafetykorea.go.kr/portal/fooddanger/farmInfoSearch.do
- "4번은 A4 용지 한 장보다 좁음": A4는 210×297mm = 0.0624㎡이고 4번 기준은 0.05㎡/마리라서 계산으로 맞다(3번 0.075㎡은 A4보다 넓다). 화면에서는 위 농식품부 자료의 번호별 기준만 말한다.

**doodle7 사실 확인**

- "압력계 바늘이 초록(녹색) 범위면 정상, 벗어나면 압력이 빠진 것이라 교체": 충북 영동소방서 안내(뉴스서울 2023-12-20) "압력지시계의 바늘이 녹색 범위를 벗어나 있으면 압력 저하로 사용할 수 없으므로 반드시 교체 또는 폐기를 해야 한다": https://newsseoul.co.kr/news/view/1065579634577441 . 인천 남동소방서 「10년 지난 노후 소화기 교체 당부」 2021-07-14 "압력계의 바늘은 녹색 범위에 있는지 등을 확인한다": https://www.incheon.go.kr/119/NE030401/2073127
- "분말 소화기 10년, 성능 확인 검사 합격 시 1회 3년 연장": 인천 서부소방서 「10년 이상 노후 소화기 교체·폐기 당부」 2021-09-02 "분말소화기의 내용연수가 10년으로 법제화됐다", "한국소방산업기술원의 성능 확인검사에서 합격하면 1회에 한해 3년 연장 사용이 가능하다": https://www.incheon.go.kr/119/NE030401/2075369 . 같은 내용이 위 영동소방서 안내와 서산소방서 안내(뉴스서울 2023-02-06)에도 있다: https://newsseoul.co.kr/news/view/1065580233271372
- "쓰는 법: 안전핀 뽑고, 바람 등지고, 호스는 불 쪽, 손잡이 꽉 쥐고 빗자루로 쓸듯이": 서울시 「화재 발생시 이렇게 하세요!」 "손잡이 부분의 안전핀을 뽑아주세요", "바람을 등지고 서서 호스를 불쪽으로 향하게 합시다", "손잡이를 힘껏 움켜쥐고 빗자루로 쓸듯이 뿌립시다": https://news.seoul.go.kr/safe/archives/20691
- "우리 집 거 2010년산인데?"는 도치의 농담 대사(창작)다. 2010년 제조면 2026년에 10년이 넘었다는 점만 웃음 포인트로 쓴다.

**창작 편**(doodle6, 8, 9, 10): 수치나 법령을 말하지 않는다. 실제 앱·카페·식당·편의점 이름이나 로고는 없다. 단톡 화면은 "○○팀 단톡"이라는 우리 그림이다. 설명란에 "창작"을 적는다.

**qa_review**: 6편 모두 11개 항목 PASS(WARN·FAIL 0). 처음 doodle6은 단톡 화면 세 장면(1~3단계)이 같은 사무실 배경이라 한 장면(10초)으로 잡혀 "장면 길이" FAIL이 났다. 2·3단계 배경을 노랑·밤으로 바꿔 최장 4.0초가 됐다. 시트를 보고 두 가지를 고쳤다. doodle5의 📅 이모지는 "7월 17일"이 그려져 "0823"과 어긋나서 🐣로 바꿨고, doodle8의 📳 이모지는 스마트폰으로 보여서 진동벨을 🔔로 그렸다.

**업로드 문구**

`doodle5`
- 제목: 대부분 모르는 계란 껍데기 숫자의 뜻
- 설명:
  ```
  계란에 찍힌 10자리, 공장 번호 아님 🥚 앞 4자리는 낳은 날, 마지막 한 자리는 닭이 사는 환경! 님 냉장고 계란은 몇 번?
  출처: 식품의약품안전처(2019.8.2), 농림축산식품부(2019.2.21, 2022.1.20) 난각표시 안내
  사진: Pexels (Marcello Sokal, Ben Molyneux, Alexas Fotos, Magda Ehlers, Klaus Nielsen) · 캐릭터는 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #계란 #난각번호 #생활꿀팁 #짤툰 #낙서툰

`doodle6`
- 제목: 회사 단톡 "넵"의 7단계ㅋㅋ
- 설명:
  ```
  같은 넵인데 마음은 다 다름 📱 마지막 단계는 진짜 공포… 님은 주로 몇 단계 넵 씀? (창작)
  창작 짤툰입니다. 등장인물과 대화는 실제와 관계없으며 특정 앱·회사와 무관합니다.
  사진: Pexels (Hanna Pad, Cup of Couple, cottonbro studio, Letícia Alvares)
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #회사생활 #넵 #직장인공감 #짤툰 #낙서툰

`doodle7`
- 제목: 대부분 모르는 소화기 바늘의 비밀
- 설명:
  ```
  님 집 소화기 바늘, 지금 초록임? 🧯 초록 밖이면 교체, 분말 소화기는 10년! 쓰는 법 네 동작까지.
  출처: 충북 영동소방서·인천 남동소방서·인천 서부소방서·서산소방서 소화기 관리 안내, 서울시 화재 행동요령
  사진: Pexels (Jakub Zerdzicki, Mohsen Adelimoghaddam, Tibor Szabo, Taryn Elliott) · 캐릭터는 직접 그린 그림입니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #소화기 #화재안전 #생활꿀팁 #짤툰 #낙서툰

`doodle8`
- 제목: 카페 진동벨 울리면 벌어지는 일ㅋㅋ
- 설명:
  ```
  10분 기다리다 카운터 갔더니 손에서 부르르… 근데 그 벨 📳 님은 벨 울리면 몇 초 만에 일어남? (창작)
  창작 짤툰입니다. 등장인물은 실제와 관계없으며 특정 카페와 무관합니다.
  사진: Pexels (Sander Dalhuisen, Gabriel, Arda Kaykısız, Pavel Danilyuk, Chevanon Photography)
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #카페 #진동벨 #공감 #짤툰 #낙서툰

`doodle9`
- 제목: 식당에서 "여기요" vs "저기요"
- 설명:
  ```
  손 반쯤 들었다가 머리 긁는 척한 사람 🙋 결국 최강은 따로 있음. 님은 여기요? 저기요? 이모님? (창작)
  창작 짤툰입니다. 등장인물은 실제와 관계없으며 특정 식당과 무관합니다.
  사진: Pexels (Jim Natanauan, Cynthia Ortega Espinosa, Maria Orlova, Lio Photography)
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #식당 #여기요 #저기요 #공감 #짤툰

`doodle10`
- 제목: 편의점 알바가 새벽 3시에 보는 손님
- 설명:
  ```
  매일 새벽 3시, 말없이 컵라면 먹고 가던 손님 🌙 비 오던 날 내민 건… 님은 이런 손님 만나 봄? (창작)
  창작 짤툰입니다. 등장인물은 실제와 관계없으며 특정 편의점과 무관합니다.
  사진: Pexels (El Jundi, Markus Winkler, Denniz Futalan, More Amore)
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #편의점 #알바 #훈훈 #짤툰 #낙서툰

## "○○ 특" 공감 애니 2 (`teuk5`~`teuk8`)

`teuk1`~`teuk4`와 똑같은 틀로 만든 4편이다(`research/research-fun.md` 4절, `research-formats2.md` 9절: 같은 틀로 많이). 주홍 찹쌀떡 "나"(`#FFB36B`), 제목 띠 두 줄(대상 / "○○ 특"), 0초부터 첫 장면, 번호 붙은 공감 7개(장면당 3~4초, 내레이터가 항목만 읽고 "나"가 말풍선으로 반응), "여러분은 몇 개 해당?ㅋㅋ" + "난 7개 다…ㅋㅋ"로 끝난다. 자막 위치(`captionY` 1650), 효과음 배치(pop·whoosh·boing·ding)도 1편들과 같다.

- **그림**: 전부 직접 그렸다(`src/lib/Sseol.tsx`). 외부 사진·영상·사실 인용은 없다. 그래서 `sources`는 비어 있고 화면 크레딧도 없다. 숫자("1년", "D-30", "6시간 뒤")는 모두 창작 속 장면이지 사실 주장이 아니다.
- **유머**: 자기 자신의 습관을 소재로 한다. 몸, 직업, 지역, 집단을 놀리지 않는다(헬스장 편도 체형 얘기 없이 "회원권·근육통·치킨"만). 실제 가게·앱·은행·카드사 이름이나 로고는 없다("편의점", "입금 알림", "장바구니"는 일반 명사).
- **길이 맞추기**: 1편들(29~32초)보다 조금 길게 하려고 내레이터 속도를 +15%에서 +12%로, 항목 앞 쉼(`gap`)을 0.18초에서 0.4초로, 끝 여백(`tail`)을 1.0초로 늘렸다.

| id | 제목 띠 | 길이 | 1~7 | 음악 |
| --- | --- | --- | --- | --- |
| `teuk5` | 자취생이라면 / 자취 첫 달 특 | 32.2초 | 너무 조용해서 잠이 안 옴 · 라면 냄비가 곧 그릇 · 대파 한 단은 끝까지 못 먹음 · 휴지 없는 걸 마지막 한 칸에서 앎 · 빨래 돌려 놓고 까맣게 잊기 · 엄마 반찬이 세상에서 제일 맛있음 · 관리비 고지서 보고 깜짝 | Scheming Weasel (faster version) |
| `teuk6` | 장마철 공감 / 비 오는 날 특 | 32.6초 | 우산 챙긴 날은 비가 안 옴 · 우산 없는 날만 갑자기 소나기 · 집에 우산 많은데 또 사기 · 양말 젖으면 하루 종일 찝찝 · 괜히 파전 생각나기 · 빗소리 들으면 잠이 쏟아짐 · 집 도착하자마자 비 그침 | Monkeys Spinning Monkeys |
| `teuk7` | 운동 시작하면 / 헬스장 첫 주 특 | 32.1초 | 일단 1년부터 끊기 · 운동복부터 풀세트 · 기구 쓰는 법 몰라서 몰래 따라 하기 · 첫날부터 너무 열심히 · 다음 날 계단을 못 내려감 · 운동했으니까 치킨은 괜찮음 · 사흘째부터 갈까 말까 고민 | Exhilarate |
| `teuk8` | 직장인 / 월급날 특 | 33.1초 | 아침부터 입금 알림만 기다림 · 들어오자마자 카드값 빠져나감 · 점심은 괜히 비싼 메뉴 · 고생한 나한테 선물 · 장바구니 전부 결제 · 이번 달은 진짜 아끼자 다짐 · 다음 날부터 다음 월급날 세기 | Hustle |

```bash
python3 voice_edge.py teuk5 && python3 prep.py teuk5 && ./render.sh teuk5 final/teuk5.mp4 && python3 qa_review.py teuk5
```

**목소리**(`script.json`의 `voices`)

- `teuk5`: 내레이터 `SunHi` +12%, 나 `InJoon` +12%·+15Hz
- `teuk6`: 내레이터 `HyunsuMultilingual` +12%, 나 `SunHi` +12%·+18Hz
- `teuk7`: 내레이터 `SunHi` +12%, 나 `InJoon` +15%·+10Hz
- `teuk8`: 내레이터 `HyunsuMultilingual` +12%, 나 `SunHi` +15%·+15Hz

**템플릿 추가**(`src/lib/Sseol.tsx`, 기존 배경·장면은 그대로)

- 배경 2종을 더했다. `gym`(벽 거울, 덤벨 선반, 회색 바닥), `rain`(흐린 하늘 빌딩 거리, 사선 빗줄기, 물웅덩이). `Backdrop`의 `switch`에 `case` 두 개만 늘었다.

**qa_review**: 4편 모두 11개 항목 PASS(WARN·FAIL 0). `teuk7` 4번 장면은 처음에 표정이 그대로라 화면 전환이 5.0초 동안 잡히지 않아(WARN) 표정을 happy→angry로 바꿨다. 같은 편 1번의 달력 이모지(📅)는 영어 날짜가 찍혀 보여서 ✅로 바꿨다.

**업로드 문구**

`teuk5`
- 제목: 자취 첫 달 특ㅋㅋ
- 설명:
  ```
  대파 한 단은 왜 끝까지 못 먹을까 🥬 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Scheming Weasel (faster version)" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #자취생 #자취 #공감애니

`teuk6`
- 제목: 비 오는 날 특ㅋㅋ
- 설명:
  ```
  우산 챙긴 날만 비가 안 오는 사람 손 ☔ 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #비오는날 #장마 #공감애니

`teuk7`
- 제목: 헬스장 첫 주 특ㅋㅋ
- 설명:
  ```
  1년 회원권 끊고 사흘째부터 고민 시작 💪 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Exhilarate" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #헬스장 #운동 #공감애니

`teuk8`
- 제목: 직장인 월급날 특ㅋㅋ
- 설명:
  ```
  월급은 통장을 스쳐 갈 뿐 💸 여러분은 몇 개 해당?ㅋㅋ (창작 애니)
  직접 그린 창작 애니메이션입니다. 등장인물은 실제와 관계없습니다.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #공감 #특 #직장인 #월급날 #공감애니

## 2D 운전 참교육 애니 2 (`road5`~`road10`)

`road1`~`road4`와 **같은 틀**로 만든 6편이다(`research/research-formats2.md` 7절, 9절 "같은 틀로 여러 편"). 차·얼굴 색, 빨간 제목 둘째 줄(`"titleKey": "#FF3B3B"`), 목소리 4개(내레이터 `InJoon` +20%, 빌런 `HyunsuMultilingual` +12%·−6Hz, 나 `SunHi` +15%·+10Hz, 경찰 `InJoon` +12%·−14Hz), 자막 위치(`captionY` 1640), 말풍선 대사(`"cap": [""]`), 범칙금 통고 카드, 질문 한 줄 끝맺음이 모두 같다. 박자도 같다: ① 빌런 행동(0초부터, 첫 프레임이 썸네일) → ② "나"의 반응(말풍선) → ③ "법은 이래요." 법규 → ④ 경찰 단속·범칙금 통고 → 질문.

- **그림·소리**: 전부 직접 그린 것(`src/lib/Road.tsx`, 얼굴은 `Sseol.tsx`의 `Mochi`)이고 경적·사이렌은 `road_sfx.py`로 합성했다. 외부 사진·영상이 없어서 `sources`는 비어 있고 화면 크레딧도 없다. 사고 장면, 실제 차종·로고·번호판, 실제 앱·회사 이름은 없다. 사실 근거는 `media/road/facts2.json`.
- **보복운전**: 나는 매번 참는다. 5편은 "경적 연타도 위반", 8편은 "막아서면 더 위험", 9편은 "겁주기 급제동 = 보복운전", 7·9편은 "거리를 넉넉히", 9편은 "비켜 주고 영상으로 신고"라고 말한다. 상상 장면은 없어서 `imagine`은 쓰지 않았다.
- **새 부품 없음**: 템플릿 코드는 고치지 않았다. 6편의 옆 길 차는 `path`의 첫 점을 step `-1`(−0.8초, `stepT` 기본값), 시간 0.01초로 줘서 0초부터 가로(−90°/90°)로 서 있게 했다.
- **제작 스크립트**: 장면 JSON은 손으로 쓰지 않고 작은 Python 생성기로 만든 뒤 `shorts/<id>/`에 저장했다(생성기는 저장소에 넣지 않았다. 결과 JSON이 원본이다).

| id | 제목 띠 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `road5` | 터널 안 차선 변경 / 안 되는 진짜 이유 | 38.5초 | 터널 실선에서 이리저리 바꾸는 빌런, 내 앞으로 훅 → 놀란 나, 경적 연타도 위반 → 흰색 실선은 차로 변경 금지, 터널 안은 앞지르기도 금지 → 또 휙 했는데 바로 옆이 경찰차, 진로 변경 금지 위반 3만 원 → "잘 지키시나요?" | Monkeys Spinning Monkeys |
| `road6` | 교차로 꼬리물기 / 빌런 참교육 | 39.2초 | 앞이 막혔는데 노란불에 밀고 들어간 빌런, 빨간불에 교차로 한가운데 정지 → 옆 길의 나 "우리 신호인데 못 가잖아!" → 교차로 안에 멈출 것 같으면 초록불이어도 진입 금지, 정지선에서 대기 → 빠져나가자마자 단속, 교차로 통행방법 위반 4만 원 → "동네에도 꼬리물기 많죠?" | Hyperfun |
| `road7` | 운전 중 휴대폰 / 만지면 생기는 일 | 37.0초 | 비틀비틀 앞차, 알고 보니 휴대폰 → 차선 넘어와 놀란 나, 거리 두기 → 운전 중 사용 금지, 서 있을 때·긴급 신고·손에 안 드는 장치는 예외 → 출발하며 또 보다 단속, 6만 원 → "폰 안 보시죠?" | Sneaky Snitch |
| `road8` | 고속도로 갓길 / 달리는 빌런의 최후 | 39.6초 | 정체 속 갓길로 쌩 → "갓길은 고장 났을 때 쓰는 곳인데!", 막아서면 더 위험 → 고장 등 부득이할 때만, 긴급차·신호/경찰 지시는 예외 → 갓길 끝에 서 있던 경찰차, 갓길 통행 6만 원 → 줄 선 내가 더 빨랐다 | Hustle |
| `road9` | 상향등 켜고 / 바짝 붙는 차의 최후 | 38.9초 | 상향등 번쩍이며 바짝 → 무서운 나, 급제동으로 겁주면 보복운전, 비켜 주고 영상으로 신고 → 안전거리, 반복 위협은 난폭운전(1년 이하 징역·500만 원 이하 벌금) → 또 바짝 붙은 앞차가 경찰차, 고속도로 안전거리 미확보 4만 원 → "이런 차 만난 적 있죠?" | Scheming Weasel |
| `road10` | 버스전용차로 / 혼자 타면 생기는 일 | 37.4초 | 버스전용차로를 혼자 쌩 → "저기 버스 전용인데…" → 고속도로 버스전용차로는 9인승 이상, 12인승 이하는 6명 이상(11인승·7명 승합차는 OK) → 혼자 탄 빌런 단속, 6만 원 → "알고 계셨나요?" | Monkeys Spinning Monkeys |

```bash
python3 voice_edge.py road5 && python3 prep.py road5 && ./render.sh road5 final/road5.mp4 && python3 qa_review.py road5
```

**qa_review**: 6편 모두 11개 항목 PASS(WARN·FAIL 0), −14.0 LUFS, 8.2~11.1MB. 첫 시도에서 `road10`이 첫 장면 3.9초(WARN)라 첫 문장 중간("버스전용차로")에 확대 컷을 넣었다. 시트를 보고 고친 것: `road5`·`road7` 차끼리 겹쳐 사고처럼 보이던 장면의 간격, `road8` 버스와 트럭이 겹친 첫 화면, `road6` 화면 밖으로 잘린 "나" 이름표와 너무 긴 자막 한 장, `road9` 통고 카드 제목 줄바꿈과 썸네일의 "번쩍번쩍!"(0초부터).

### 사실과 출처 (2026-10-10, 국가법령정보센터 현행 본문과 별표 원문에서 확인)

도로교통법(2026.7.1 시행), 같은 법 시행령(2026.10.2 시행), 시행규칙(2026.8.24 시행). 범칙금은 모두 시행령 [별표 8](운전자)의 승용자동차등 금액이고, 별표 8은 여러 호를 한 칸으로 묶어 금액을 적는다(제4~20호 6만 원, 제21~43호 4만 원, 제44~58호 3만 원).

- `road5` 진로 변경 금지: 안전표지로 진로 변경이 금지된 곳에서는 진로를 바꾸면 안 된다(공사 장애물 등은 예외). — 도로교통법 제14조제5항. 그 표시가 백색실선(노면표시 506 진로변경제한선). — 시행규칙 [별표 6]. 터널 안 앞지르기 금지. — 법 제22조제3항제2호. 정당한 사유 없는 반복·연속 경음기 금지. — 법 제49조제1항제8호다목(별표 8 제36호). 진로 변경 금지 장소 진로 변경 3만 원. — 시행령 [별표 8] 제45호
- `road6` 꼬리물기: 앞차 상황 때문에 교차로(정지선 넘은 부분)에 멈춰 다른 차를 방해할 우려가 있으면 교차로에 들어가면 안 된다. — 법 제25조제5항(신호 색과 관계없음). 교차로 통행방법 위반 4만 원. — 시행령 [별표 8] 제25호
- `road7` 휴대폰: 운전 중 휴대용 전화 사용 금지, 예외는 정지 중·긴급자동차·범죄/재해 신고 등 긴급·대통령령 장치. — 법 제49조제1항제10호. 그 장치는 "손으로 잡지 아니하고도 사용할 수 있도록 해 주는 장치". — 시행령 제29조. 범칙금 6만 원. — 시행령 [별표 8] 제15호
- `road8` 갓길: 고속도로등에서 고장 등 부득이한 경우가 아니면 갓길 통행 금지. 예외: 긴급자동차·보수작업 차, 정체 시 신호기나 경찰공무원등의 신호·지시. — 법 제60조제1항. 갓길 통행 6만 원. — 시행령 [별표 8] 제19호
- `road9` 안전거리: 앞차가 갑자기 서도 충돌을 피할 거리. — 법 제19조제1항. 급제동 금지. — 법 제19조제4항. 안전거리 미확보 등을 지속·반복해 위협하면 난폭운전. — 법 제46조의3. 1년 이하 징역이나 500만 원 이하 벌금. — 법 제151조의2제1호. 고속도로·자동차전용도로 안전거리 미확보 4만 원. — 시행령 [별표 8] 제23호. 보복운전은 형사처벌 대상(형법상 특수협박 등)이라는 일반 설명만 했다. 상향등 자체의 위법 여부(법 제37조제2항·시행령 제20조는 밤에 앞차 바로 뒤에서 전조등 밝기를 함부로 조작하지 말라는 규정)는 화면에서 단정하지 않았다.
- `road10` 버스전용차로: 고속도로 버스전용차로는 9인승 이상 승용자동차와 승합자동차, 단 승용자동차와 12인승 이하 승합자동차는 6명 이상 탄 경우만. — 시행령 제9조제1항·[별표 1]. 운영 구간·시간은 경찰청 고시에 따르므로 화면에 쓰지 않았다. 고속도로버스전용차로 통행 위반 6만 원. — 시행령 [별표 8] 제20호
- 벌점은 쓰지 않았다(시행규칙 별표 28 표를 확실히 대조하지 않았다).

### 업로드 문구

`road5`
- 제목: 터널 안 차선 변경 안 되는 진짜 이유ㄷㄷ
- 설명:
  ```
  터널 안 흰색 실선, 그냥 선이 아닙니다 🚇 (창작 애니)
  흰색 실선(진로변경제한선)에선 차로를 바꾸면 안 되고(도로교통법 제14조), 터널 안은 앞지르기도 금지예요(제22조). 진로 변경 금지 위반 범칙금은 승용차 3만 원(시행령 별표 8).
  화가 나도 경적을 계속 울리거나 쫓아가 위협하지 마세요. 보복운전은 범죄입니다.
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #운전 #참교육 #터널 #실선 #도로교통법

`road6`
- 제목: 교차로 꼬리물기 빌런 참교육ㄷㄷ
- 설명:
  ```
  앞이 막혔는데 교차로로 밀고 들어가면? 🚦 (창작 애니)
  교차로 안에 멈춰 다른 차를 막을 것 같으면 초록불이어도 들어가면 안 돼요(도로교통법 제25조제5항). 교차로 통행방법 위반 범칙금은 승용차 4만 원(시행령 별표 8).
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #꼬리물기 #교차로 #운전 #참교육 #도로교통법

`road7`
- 제목: 운전 중 휴대폰 만지면 생기는 일ㄷㄷ
- 설명:
  ```
  "잠깐 답장만…" 그 잠깐이 제일 위험해요 📱 (창작 애니)
  운전 중 휴대폰 사용은 금지(도로교통법 제49조). 차가 서 있을 때, 긴급 신고, 손에 들지 않는 장치는 예외예요. 범칙금은 승용차 6만 원(시행령 별표 8).
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #운전중휴대폰 #운전 #참교육 #안전운전 #도로교통법

`road8`
- 제목: 고속도로 갓길 달리는 빌런의 최후ㄷㄷ
- 설명:
  ```
  꽉 막힌 고속도로, 갓길로 쌩 달리면 결국… 🚨 (창작 애니)
  고속도로 갓길은 고장 등 부득이한 경우가 아니면 달릴 수 없어요. 긴급차, 정체 때 신호나 경찰이 허락한 경우는 예외(도로교통법 제60조). 갓길 통행 범칙금은 승용차 6만 원(시행령 별표 8).
  화가 나도 막아서지 마세요. 그게 더 위험합니다.
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #갓길 #고속도로 #운전 #참교육 #도로교통법

`road9`
- 제목: 상향등 켜고 바짝 붙는 차의 최후ㄷㄷ
- 설명:
  ```
  뒤에서 번쩍번쩍 바짝 붙는 차, 이렇게 됩니다 💡 (창작 애니)
  앞차가 갑자기 서도 부딪히지 않을 거리를 둬야 해요(도로교통법 제19조). 고속도로 안전거리 미확보 범칙금은 승용차 4만 원(시행령 별표 8). 계속 위협하면 난폭운전으로 1년 이하 징역이나 500만 원 이하 벌금(제46조의3, 제151조의2).
  급제동으로 겁주면 보복운전, 범죄입니다. 비켜 주고 블랙박스 영상으로 신고하세요.
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #안전거리 #상향등 #보복운전 #참교육 #도로교통법

`road10`
- 제목: 버스전용차로 혼자 타면 생기는 일ㄷㄷ
- 설명:
  ```
  고속도로 버스전용차로, 몇 명 타야 달릴 수 있을까? 🚌 (창작 애니)
  고속도로 버스전용차로는 9인승 이상 차만, 그중 12인승 이하는 6명 이상 타야 해요(도로교통법 시행령 별표 1). 위반 범칙금은 승용차 6만 원(시행령 별표 8). 운영 구간과 시간은 표지판을 확인하세요.
  직접 그린 창작 애니메이션입니다. 등장인물과 차량은 실제와 관계없습니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #버스전용차로 #고속도로 #운전 #참교육 #도로교통법

## 그 시절 레트로 쇼츠 2 (`retro5`~`retro8`)

"그 시절 레트로" 시리즈 2탄입니다. 틀은 `retro1`~`retro4`와 똑같습니다: 검정 바탕, 위 2줄 띠 제목(아랫줄 노랑), `"frame": "rounded43"` 둥근 4:3 옛 사진 + 필름 그레인 `0.15` + 클립별 노란 연도 스티커, 아래 한 줄 자막(`captionY` 1335), Edge TTS `ko-KR-SunHiNeural` `+10%`, 한 줄에 사진 한 장, "지금은 ○○" 대비 뒤 "이 시절 ○○, 기억나는 분?"으로 끝, 끝에 `ding`, 음악 Gymnopedie·Heartwarming(gain 0.22), 출처 스티커는 흰 바탕 y 1478. 템플릿 코드는 바꾸지 않았습니다.

| id | 띠 제목 | 길이 | 내용 | 음악 |
| --- | --- | --- | --- | --- |
| `retro5` | 엄마 손 잡고 따라가던 / 그 시절 시장 구경 | 39.0초 | 1966년 부산 부평시장 → 1952년 부평시장의 고춧가루·과일 수레·무와 파 좌판·금붕어 장수 → 1967년 대구 서문시장 갈치 → 1968년 자갈치시장 → 1968년 남대문시장 낮과 밤의 포목점 → 1978년 서울 한남동 시장 → 지금은 만져 보지도 않고 인터넷으로 장보기(국가기록원) → 기억나는 분? | Heartwarming |
| `retro6` | 학교 끝나면 사 먹던 / 그 시절 길거리 간식 | 38.5초 | "뻥!" 귀 막는 아이와 1952년 부산 뻥튀기 장수 → 옥수수 모양 풀빵 → 풀빵·도너츠 → 1953년 대구·1967년 서문시장 번데기 → 1952년 광주 리어카 빙수 → 1968년 부산 아이스케익 뽑기 → 1978년 서울 엿판 → 1952년 마산 사탕·과자·전 노점 → 지금은 편의점 → 기억나는 분? | Heartwarming |
| `retro7` | 칙칙폭폭 증기기관차 / 그 시절 기차역 | 39.5초 | 1957년 함백선 증기기관차 → 1957년 영월의 기와지붕 새 역 → 1954년·1952년 서울역 → 1953년 대구역 앞 한복 차림 승객 → 1952년 부산 철도공작창 증기기관차 → 열차 창밖 논밭(1952 경주) → 1957년 서울역 디젤기관차 시운전 → 1964년 열차에서 본 한강대교 → 지금은 2004년부터 KTX, 2024년 이용객 8천만 명 넘게(국토교통부) → 1973년 청주역, 기억나는 분? | Gymnopedie No 1 |
| `retro8` | 운동장에서 입학식 하던 / 그 시절 국민학교 | 39.0초 | 1952년 땅바닥에 앉은 야외 입학식 → "국민학교" → 1958년 남대문 초등학교 체조 시간 → 1953년 경북 돌담 학교 → 1954년 소풍 행렬과 1958년 소풍 점심 → 1952년 부산 여중생 소풍 → 1962년 실력고사 → 1950년대엔 새 학년이 4월 → 1962년부터 3월, 1996년 초등학교로(국가기록원) → 기억나는 분? | Gymnopedie No 2 |

```bash
python3 media/retro/fetch.py retro5 retro6 retro7 retro8   # 사진(공유마당) → public/retroN/src/ (라이선스 코드 01·21만 OK)
python3 voice_edge.py retro5 && python3 prep.py retro5
./render.sh retro5 final/retro5.mp4
python3 qa_review.py retro5
```

- 연도 스티커는 항목 제목 앞의 연도("1954년 7월 14일 서울역")를 쓰고, 제목에 연도가 없는 KTV 사진은 창작년도("1957-03-09")를 씁니다. 공유마당 창작년도 칸이 깨진 항목(`13154762` "19919", `13154382` "26963", `13154170` "1960년대")은 제목의 연도를 따랐습니다.
- 4.5초가 넘는 줄(훅, `retro7` "지금은", `retro8` "1962년부터")은 같은 사진의 `crop` 디테일 컷으로 나눴습니다. `retro8`의 마지막 컷은 훅 사진의 디테일 컷이라 첫 장면으로 이어집니다.

### 사진 출처와 라이선스

`retro1`~`retro4`와 같은 두 묶음만 썼고, `media/retro/fetch.py`로 각 공유마당 항목 페이지의 라이선스 코드를 다시 확인했습니다(모두 `21` CC BY 또는 `01` 공공누리 제1유형, 2026-10-10). 항목별 페이지·파일 주소·라이선스·저작자·연도·사용 구간(초)은 `media/retro/retro5~8.json`과 각 `edit.json`의 `sources`에 있습니다.

- **한국저작권위원회 소장 근현대 사진 (CC BY)**: 공유마당 "2018년 공유저작물DB수집"(부경근대사료연구소 수집). 화면 표시 "사진: 한국저작권위원회".
- **한국정책방송원(KTV) 사진 (공공누리 제1유형)**: `retro7`의 함백선 열차·영월 역사·디젤기관차·서울역 야경, `retro8`의 체조 시간·소풍·실력고사. 화면 표시 "사진: 한국정책방송원".
- 고르지 않은 것: 공유마당 검색에 많이 나오는 "1971년_…" 사진(셀수스협동조합)은 라이선스 코드 `98`(기증저작물 자유이용)이라 뺐습니다. 1951~53년 사진 중 군인·미군 시설·비행장·철조망·폭격 피해·포로·피란민이 제목이나 화면에 있는 것, 구걸·고아처럼 사람을 딱하게 보이게 하는 것, 상표 간판이 크게 보이는 것(예: 남대문시장 박카스, 자유시장 영문 간판), 사행성 뽑기 기계는 고르지 않았습니다.
- 사진은 1600px로 줄였고 밝기 보정은 하지 않았습니다.

항목별 목록(사용한 사진):

- **retro5**: [1966년 부산 중구 부평동 부평시장](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155112&menuNo=200018) (한국저작권위원회, 1966년, CC BY); [1952년 부산 중구 부평시장의 고춧가루 노점상들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153869&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 중구 부평동시장의 과일구루마 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153856&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 중구 부평시장의 야채 노점상들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153878&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 중구 부평시장의 금붕어 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153871&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1967년 대구 서문시장_어물전의 갈치장수_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152674&menuNo=200018) (한국저작권위원회, 1967년, CC BY); [1968년 자갈치시장 생선 노점상과 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153524&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1968년 서울 남대문시장 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154179&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1968년 서울 남대문시장 포목점 야간 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154183&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1978년 서울 한남동 재래시장 내 야채 노점상들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154969&menuNo=200018) (한국저작권위원회, 1978년, CC BY); [1978년 서울 한남동 재래시장 입구_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154970&menuNo=200018) (한국저작권위원회, 1978년, CC BY); [1978년 서울 한남동 재래시장 내 과일가게](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154966&menuNo=200018) (한국저작권위원회, 1978년, CC BY)
- **retro6**: [1952년 부산 중구 보수동 축대식 담벼락 아래의 뻥튀기 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153848&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 중구 부평시장의 옥수수 모양의 풀빵 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153881&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 중구 부평시장의 풀빵과 도너츠장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153886&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 대구거리의 번데기 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152591&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1967년 대구 서문시장 골목_번데기장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152661&menuNo=200018) (한국저작권위원회, 1967년, CC BY); [1952년 광주 거리의 리어카 빙수 판매점](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153161&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1968년 부산_ 거리의 아이스케익 뽑기 노점](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153509&menuNo=200018) (한국저작권위원회, 1968년, CC BY); [1967년 대구 서문시장_엿장수, 과일 노점 등](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152677&menuNo=200018) (한국저작권위원회, 1967년, CC BY); [1978년 서울 동대문시장 거리의 엿장수 엿판](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154943&menuNo=200018) (한국저작권위원회, 1978년, CC BY); [1952년 마산 어시장 인근 거리에서 사탕과 과자를 팔면서 전을 굽고있는 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154354&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 부산 중구 부평시장 카바이트상가 앞의 팥죽과 콩국 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153864&menuNo=200018) (한국저작권위원회, 1952년, CC BY)
- **retro7**: [함백선을 질주하는 열차](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070891&menuNo=200018) (한국정책방송원, 1957-03-09, 공공누리 제1유형); [1954년 7월 14일 서울역](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154762&menuNo=200018) (한국저작권위원회, 19919, CC BY); [1952년 서울역과 역 앞 거리 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154123&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1953년 대구역 앞에서 차를 기다리는 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152491&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [1952년 부산철도 공작창과 수리를 위해 있는 증기 기관차들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153930&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [외국에서 도입된 디젤기관차를 서울역에서 시운전중이다](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070920&menuNo=200018) (한국정책방송원, 1957-09-22, 공공누리 제1유형); [함백선 개통과 함께 신축된 강원도 영월의 철도역사](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070892&menuNo=200018) (한국정책방송원, 1957-03-09, 공공누리 제1유형); [1964년 열차 안에서 촬영한 서울 한강대교](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154170&menuNo=200018) (한국저작권위원회, 1960년대, CC BY); [1952년 여름, 열차를 타고가며 바라본 경주 남산](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153143&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1973년 10월 26일  청주역](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154382&menuNo=200018) (한국저작권위원회, 26963, CC BY); [서울역 야경](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070998&menuNo=200018) (한국정책방송원, 1958-08-17, 공공누리 제1유형)
- **retro8**: [1952년 부산의 야외에서 진행 중인 초등학생 입학식 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153919&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [남대문 초등학교의 체조시간](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070976&menuNo=200018) (한국정책방송원, 1958-06-14, 공공누리 제1유형); [1953년 경북지역의 외벽 담을 돌로 만든 학교의 학생들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154419&menuNo=200018) (한국저작권위원회, 1953년, CC BY); [소풍나온 어린이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070827&menuNo=200018) (한국정책방송원, 1954-05-05, 공공누리 제1유형); [1958년 초등학교 소풍의 점심시간](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152627&menuNo=200018) (한국저작권위원회, 1958년, CC BY); [1952년 부산의 여자중학생들이 소풍을 마치고 대연동 인근 고갯길을 넘어오는 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153920&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [1952년 진해우체국과 여학생들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154322&menuNo=200018) (한국저작권위원회, 1952년, CC BY); [62년도 실력고사](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13071202&menuNo=200018) (한국정책방송원, 1962-10-27, 공공누리 제1유형); [1966년 부산 중구 옛 부산시청 앞을 지나는 여학생들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155113&menuNo=200018) (한국저작권위원회, 1966년, CC BY)

### 사실과 출처 (2026-10-10 확인)

- 사진의 연도·장소·내용은 각 공유마당 항목의 제목과 창작년도를 따랐습니다(예: "1952년 부산 중구 부평시장의 금붕어 장수", "1953년 대구역 앞에서 차를 기다리는 사람들", "함백선 개통과 함께 신축된 강원도 영월의 철도역사"(KTV, 1957-03-09), "62년도 실력고사"(KTV, 1962-10-27)). 사진에 보이지 않는 이야기, 가격, 인물 사연은 넣지 않았습니다.
- `retro5` — [국가기록원 「사진대한민국: 시장과 백화점」](https://theme.archives.go.kr/next/photo/market.do): "최근에는 사람도 장소도 상품도 보이지 않고 직접 만져볼 수 없는 네트워크를 통한 '인터넷쇼핑몰'과 'TV홈쇼핑몰' 등이 등장했다." → "지금은 손으로 만져 보지도 않고 인터넷으로 장을 보죠."
- `retro6` — 숫자나 연도 주장은 사진 제목의 것뿐입니다. "지금은 편의점 하나면 다 있지만"은 특정 상표 없이 쓴 일반 대비 문장입니다.
- `retro7` — [e-나라지표 「고속철도 여객 수송동향」(국토교통부 철도운영과)](https://www.index.go.kr/unify/idx-info.do?idxCd=1252): "KTX 이용자수는 2004.4.1부터 운행을 시작하여", KTX 수송인원 "81,184 천명('24년)" → "2004년부터 KTX가 달리고, 2024년 이용객만 8천만 명이 넘어요."
- `retro8` — [국가기록원 「사진대한민국: 졸업」](https://theme.archives.go.kr/next/photo/graduation.do): "학기의 시작은 광복 이후부터 1951년까지는 9월, 1950년대는 4월, 1962년부터는 3월이었다." 같은 주제의 [「초·중·고등학교」 페이지](https://theme.archives.go.kr/next/photo/graduation02List.do): "1906년 보통학교, 1938년 심상소학교, 1941년 국민학교로 명칭이 변경되었다. 1996년 초등학교로 명칭이 변경된 이후 오늘까지 이어지고 있다."

### 업로드 문구

**retro5** — 엄마 손 잡고 따라가던 그 시절 시장 구경
> 엄마 손 잡고 따라가던 시장, 기억나세요? 1952년 부산 부평시장의 고춧가루 노점과 과일 수레, 금붕어 장수, 1967년 대구 서문시장의 갈치, 1968년 자갈치시장과 남대문시장, 1978년 서울 한남동 시장까지. 지금은 손으로 만져 보지도 않고 인터넷으로 장을 보죠(국가기록원 「사진대한민국: 시장과 백화점」). 이 시절 시장 구경, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #재래시장 #옛날사진 #추억 #shorts

**retro6** — 학교 끝나면 사 먹던 그 시절 길거리 간식 ㅠㅠ
> "뻥!" 소리에 귀부터 막던 뻥튀기, 기억나세요? 1952년 부산의 뻥튀기 장수와 풀빵·도너츠, 1953년 대구와 1967년 서문시장의 번데기, 1952년 광주 리어카 빙수, 1968년 부산 아이스케익 뽑기, 1978년 서울 엿장수 엿판까지. 이 시절 길거리 간식, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #추억의간식 #뻥튀기 #옛날사진 #shorts

**retro7** — 칙칙폭폭 증기기관차, 그 시절 기차역
> 연기 뿜으며 달리던 증기기관차, 기억나세요? 1957년 함백선 열차와 영월의 기와지붕 새 역, 1950년대 서울역과 대구역, 부산 철도공작창의 증기기관차, 1957년 서울역 디젤기관차 시운전, 1964년 열차에서 본 한강대교까지. 지금은 2004년 4월부터 KTX가 달리고, 2024년 한 해 KTX 이용객은 8,118만 명이었습니다(e-나라지표, 국토교통부). 이 시절 기차역, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집), 한국정책방송원(공유마당, 공공누리 제1유형) · 크기 조정
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #기차역 #증기기관차 #옛날사진 #shorts

**retro8** — 운동장에서 입학식 하던 그 시절 국민학교
> 의자도 없이 땅바닥에 앉아 치른 1952년 입학식, 1958년 체조 시간, 소풍날의 줄 맞춘 행렬과 점심시간, 1962년 실력고사까지. 1950년대엔 새 학년이 4월에 시작했고 1962년부터 3월로 바뀌었으며, 1941년부터 쓰던 "국민학교"라는 이름은 1996년 "초등학교"가 됐습니다(국가기록원 「사진대한민국: 졸업」). 이 시절 국민학교, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집), 한국정책방송원(공유마당, 공공누리 제1유형) · 크기 조정
> 음악: "Gymnopedie No 2" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #국민학교 #입학식 #추억 #shorts

## 괴담 쇼츠 2 (`horror5`~`horror8`)

「[괴담] 이해하면 소름 돋는 ○○」 시리즈 2차분이다. 틀은 `horror1`~`horror4`와 똑같다. 검정 띠 제목에 빨간 장소 한 단어(`"titleKey": "#ff2a2a"`)를 두고, 자막은 `"captionY": 1640`에 둔다. 내레이션은 Edge TTS `ko-KR-InJoonNeural` `+5%` `-10Hz`다. 평범한 3~4문장 뒤에 생각해야 이상한 한 가지가 오고, 봉인하는 한 줄, 0.6초 쉼, “이해하셨나요? 정답은 댓글에”로 끝난다. 음악은 같은 두 곡을 번갈아 쓴다. 효과음은 편마다 2~4개, 번쩍임은 한 번이다. 네 편 모두 **직접 쓴 창작 괴담**이다. 피·폭력·실존 장소·브랜드·인물은 없고, 공포는 암시로만 준다. 화면은 사람이 나오지 않는 Pexels 영상을 어둡게 보정해 깔았다.

- **horror7 녹화 화면**: 홈캠에 찍힌 침대 장면(6443851, 15887293)은 회색 야간 카메라처럼 보정했다(흑백, 노이즈, 비네트). 그 위에 빨간 “● REC 02:13” 스티커를 띄운다.
- **horror6 글씨**: 김 서린 유리 장면에 흰 스티커 “또 봤네?”를 띄운다. 글씨는 우리가 넣은 것이다.
- 템플릿 코드는 바꾸지 않았다. `media/horror/catalog.py`에 새 클립을 더했고(`NIGHTVISION` 포함), `make_edits.py`에 `horror5`~`horror8` 컷 목록을 더했다. 보정은 `media/horror/grade2.sh`로 한다. `make_edits.py`를 다시 돌려도 `horror1`~`horror4`의 edit.json은 그대로다.

| id | 띠 제목 | 길이 | 이야기 (정답) | 음악 |
| --- | --- | --- | --- | --- |
| `horror5` | [괴담] 이해하면 소름 돋는 / 비상계단 | 33.5초 | 엘리베이터 점검 날, 12층에서 계단으로 내려간다. 비상계단은 사람이 지나가야 켜지는 센서등인데, 내가 도착하기 전에 아래층 불이 먼저 켜진다. 1층까지 꼭 한 층씩 먼저. 1층 문손잡이를 잡자 등 뒤에서 딸깍, 2층 불이 켜진다. “나는 뒤돌아보지 않았다.” (정답: 눈에 안 보이는 누군가가 계속 한 층 아래에서 앞서 내려가고 있었다. 1층에 다 오자 그것은 내 옆을 지나 등 뒤 2층으로 올라갔다. 지금 내 바로 뒤에 있다) | Gathering Darkness |
| `horror6` | [괴담] 이해하면 소름 돋는 / 지하주차장 | 32.0초 | 지하 3층의, 몇 달째 안 움직인 먼지투성이 차. 주인을 본 사람이 없다. 지나갈 때마다 창문 안을 들여다보는데, 오늘은 운전석 유리에 김이 서려 있고 손가락 글씨가 있다: “또 봤네?” 글씨는 좌우가 뒤집혀 있었다. 차 문은 전부 잠겨 있었다. (정답: 김은 차 안에서 누가 숨을 쉬어야 서린다. 뒤집힌 글씨는 안쪽에서 쓴 것이다. 잠긴 차 안에 몇 달째 누군가 있고, 내가 들여다볼 때마다 나를 보고 있었다) | Ghost Story |
| `horror7` | [괴담] 이해하면 소름 돋는 / 홈캠 | 32.6초 | 혼자 사는 집, 현관을 향하게 홈캠을 달았다. 며칠 동안 찍힌 건 나뿐이다. 어젯밤 영상을 돌려 보니 새벽 2~4시에 자고 있는 내가 찍혀 있다. 침대 바로 옆에서, 나를 내려다보는 각도로. 그날 밤 현관문은 한 번도 열리지 않았다. “홈캠은 지금도 현관을 보고 있다.” (정답: 누군가 카메라를 떼어 두 시간 동안 내 머리맡에서 나를 찍고, 다시 현관 쪽으로 돌려 놓았다. 현관으로 들어온 기록이 없으니 그 사람은 처음부터 집 안에 있었고, 지금도 있다) | Gathering Darkness |
| `horror8` | [괴담] 이해하면 소름 돋는 / 캠핑장 | 33.6초 | 혼자 캠핑, 밤새 비. 새벽에 텐트 밖에서 철벅철벅 발소리가 텐트를 한 바퀴 돈다. 아침에 나가 보니 젖은 흙 위에 발자국이 있다. 텐트 입구에서 나와서, 한 바퀴 돌고, 다시 입구로 들어간 발자국. “나는 밤새 텐트 밖으로 나간 적이 없다.” (정답: 발자국의 주인은 밖에서 온 게 아니라 내 텐트 안에서 나왔다가 다시 들어갔다. 밤새 텐트 안에 나 말고 누가 있었고, 아직 나오지 않았다) | Ghost Story |

```bash
python3 media/horror/make_edits.py          # shorts/horror*/edit.json + media/horror/sources.json
media/horror/grade2.sh                      # Pexels 원본 받기 + 보정 → public/horror5-8/src/
for id in horror5 horror6 horror7 horror8; do python3 voice_edge.py $id && python3 prep.py $id && ./render.sh $id final/$id.mp4; done
for id in horror5 horror6 horror7 horror8; do python3 qa_review.py $id; done
# horror7(야간 노이즈)·horror8은 30MB를 넘어서 CRF 23으로 다시 인코딩했다 (15.3MB, 13.0MB):
#   ffmpeg -i final/$id.mp4 -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/$id.mp4
```

### 영상과 라이선스 (2026-10-10, 각 영상 페이지에서 “Free”·제작자를 확인)
사람이 나오는 클립과 사람이 지나가는 구간은 쓰지 않았다. 상표·간판·번호판이 읽히는 클립도 뺐다(광고판이 보이던 주차장 29019380, 상표가 보이던 차 35099109·14481621, 카메라 상표가 보이는 7205347). 0초 화면은 horror5 빈 계단, horror6 빈 지하주차장, horror7 렌즈 조리개, horror8 숲속 텐트다. 화면에는 “영상: Pexels”만 표시한다. 페이지·파일 주소·제작자·쓴 구간은 `media/horror/sources.json`과 각 `edit.json`의 `sources`에 있다.
- **Pexels License** (https://www.pexels.com/license/ — 무료, 수정 가능, 출처 표기 불필요. 수정 없는 판매·재배포, 사람을 나쁘게 보이게 하는 사용 금지):
  - horror5: 5843879·9152640 Erik Mclean, 6010700 Tima Miroshnichenko, 12096163 Sasha Poberailo, 5986347 Pat Whelen, 39024320 Alef Morais, 7644222 Yaroslav Shuraev, 3134591 Caleb Oquendo, 4990438 Pavel Danilyuk
  - horror6: 6028858·6028882 Артем Ковальчук, 19217892 Nino Souza, 5972195 gusat silviu, 27890130 Baran Robin, 38433795 Rishabh Kaple, 5192033 Ming Z, 5227362 Francesco Ungaro, 32078487 Rec Everywhere
  - horror7: 5245970 Hemanth K M, 6028175 Ricky Esquivel, 34106136 Cemrecan Yurtman, 19228170·3773489·15887293 Curtis Adams, 19193293 Rafael Fernanz, 6443851 Pavel Danilyuk, 6114429 cottonbro studio
  - horror8: 5994915 cottonbro studio, 9591436 Kain kn, 4162882 Grisha Grishkoff, 5419248 Yaroslav Shuraev, 9976082 George Morina, 5391986 Saidouni Sidi Med, 34405948 Emir Reinado, 39485457·39485454·39619866 Nothing Ahead, 7714908 Greta Hoffman
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0.
- 사실 인용: 네 편 모두 창작 괴담이라 숫자·법·날짜 같은 사실 주장이 없다.

### 업로드 문구
설명란 첫 줄에 **창작 괴담**이라고 밝힌다. 고정 댓글: “정답 맞히신 분? 댓글로 풀이해 주세요 👀”.

**horror5** — [괴담] 이해하면 무서운 비상계단 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물과 관계없습니다. 내가 가기도 전에 먼저 켜지던 아래층 센서등, 그리고 등 뒤에서 켜진 2층 불. 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Erik Mclean, Tima Miroshnichenko, Sasha Poberailo, Pat Whelen, Alef Morais, Yaroslav Shuraev, Caleb Oquendo, Pavel Danilyuk)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #비상계단 #shorts

**horror6** — [괴담] 이해하면 무서운 지하주차장 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물과 관계없습니다. 몇 달째 서 있는 차, 김 서린 유리에 좌우가 뒤집힌 글씨 “또 봤네?”. 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Артем Ковальчук, Nino Souza, gusat silviu, Baran Robin, Rishabh Kaple, Ming Z, Francesco Ungaro, Rec Everywhere)
> 음악: "Ghost Story" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #지하주차장 #shorts

**horror7** — [괴담] 이해하면 무서운 홈캠 영상 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물·제품과 관계없습니다. 현관만 비추던 홈캠에 왜 자는 내가 찍혀 있었을까요? 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (Hemanth K M, Ricky Esquivel, Cemrecan Yurtman, Curtis Adams, Rafael Fernanz, Pavel Danilyuk, cottonbro studio)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #홈캠 #shorts

**horror8** — [괴담] 이해하면 무서운 캠핑장 ㄷㄷ
> 창작 괴담입니다. 실제 장소·인물과 관계없습니다. 텐트 입구에서 나와 한 바퀴 돌고 다시 들어간 발자국. 나는 밤새 나간 적이 없는데요. 이해하셨다면 댓글로 정답을 남겨 주세요.
> 영상: Pexels (cottonbro studio, Kain kn, Grisha Grishkoff, Yaroslav Shuraev, George Morina, Saidouni Sidi Med, Emir Reinado, Nothing Ahead, Greta Hoffman)
> 음악: "Ghost Story" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #괴담 #이해하면무서운이야기 #공포 #캠핑 #shorts

## 역대급 랭킹 TOP5 쇼츠 2 (`politics/top5`~`top8`)

`top1`~`top4`와 **완전히 같은 틀**로 만든 네 편입니다. `"titleStyle": "band"`(윗줄 흰색 "역대급 ○○", 아랫줄 "[TOP5] (몇 위가 제일 ○○?)"), 정사각 `single` 크롭, 자막 `"captionY": 1380`, 아래 순위표(`rank`, 안 나온 순위 "???"), 순위마다 노란 “○위” 스티커 + `whoosh`, 장소마다 3.4초 컷 두 개(1위만 세 개, 마지막 컷에 "다들 몇 위가 제일 ○○?"), 내레이션 없음·원본 소리 끔(`audio: 0`), 1위가 끝나면 바로 끊김(`"tail": 0`). 순위는 편집자 선정이고 공식 순위가 아닙니다. 사람 얼굴·상표·군사 소재는 없습니다(동물 랭킹은 다른 채널 몫이라 top6에는 생물 장면을 해파리 한 컷만 넣었습니다).

| id | 제목(화면) | 길이 | 5위 → 1위 | 음악 |
| --- | --- | --- | --- | --- |
| `top5` | 역대급 거대한 폭포 / [TOP5] (몇 위가 제일 웅장?ㄷㄷ) | 37.4초 | 안개 속 거대한 급류(그레이트폴스) · 레이니어산 나라다 폭포 · 그랜드캐니언 숨은 폭포(디어크릭) · 옐로스톤 로어 폭포 · 740m 요세미티 폭포 | Heroic Age |
| `top6` | 바닷속 소름 돋는 장면 / [TOP5] (몇 위가 제일 소름?) | 37.4초 | 이름 없는 심해 해파리 · 바위 밑 가스의 강 · 우연히 찾은 난파선 · 검은 연기 뿜는 굴뚝 · 사상 첫 해저 화산 분화 | Gathering Darkness |
| `top7` | 역대급 무서운 날씨 / [TOP5] (몇 위가 제일 무서움?) | 37.4초 | 회전하는 괴물 구름(슈퍼셀) · 옐로스톤 500년 홍수 · 허리케인 눈 속 비행 · 우주에서 본 허리케인 · EF3 거대 토네이도 | Movement Proposition |
| `top8` | 지구에서 가장 이상한 장소 / [TOP5] (몇 위가 제일 이상?ㄷㄷ) | 37.4초 | 아치스 균형 바위 · 북미에서 가장 낮은 땅(배드워터) · 화산 속 용암 호수 · 스스로 움직이는 돌(레이스트랙) · 무지개색 거대 온천(그랜드 프리즈매틱) | Dreamer |

```bash
./fetch.sh                                                   # 네 곡 모두 포함
MEDIA=$PWD/media python3 politics/prep_split.py top5         # 원본: media/top5~top8/*.mp4 (저장소에 없음, 각 .json의 주소로 다시 받아 cut_from_original_seconds 구간을 1920x1080·30fps로 자름)
./render.sh top5 final/top5.mp4                              # 렌더 뒤 영상만 CRF 23으로 다시 압축(오디오 복사) → 11~17MB
python3 qa_review.py top5                                    # 네 편 모두 FAIL 0, WARN 0
```

- 원본 클립은 모두 14초 안팎으로 잘라 둔 것입니다(쓴 구간·화면 설명은 `media/top*/*.json`의 `notes`·`used_in`). 저해상도 원본(브림스톤 분화 640x480, 할레마우마우 850x480, 디어크릭·그레이트폴스 720p, 밀턴 720p, 토네이도 720p)은 1080p로 키워서 조금 흐립니다.
- top6 브림스톤 원본 위쪽의 ROV 정보 줄(날짜·수심)은 잘라 냈고, top8 용암 호수의 USGS 모서리 표시·top7 밀턴의 ISS 모듈·top7 어마의 비행기 엔진·top6 난파선의 ROV 장비는 정사각 크롭 밖으로 뺐습니다(밀턴 확대 컷은 아래쪽에 정거장 부품이 조금 보임).
- top8 그랜드 프리즈매틱은 전망대에서 찍은 영상이라 산책로에 아주 작은 관광객 실루엣·먼 주차장 버스가 보입니다(식별 불가, 확대 컷은 쓰지 않음).
- top7 슈퍼셀 원본은 12초뿐이라 두 구간(0–3.7초, 5.25–12초)을 이어 0.771배로 늦췄습니다(풍선 띄우는 사람 4명이 나오는 1.5초는 뺌). 토네이도 영상 속 차량 소리는 꺼서 목소리가 들리지 않습니다. 토네이도는 사망·부상 0명(NWS 조사), 피해 건물은 화면에 없습니다.
- top7 옐로스톤 홍수 영상은 Flickr 기록상 2022.6.20 촬영(최고 수위 6.13 이후의 높은 물)이라 자막을 “500년 만의 홍수 (2022)”로만 적었습니다.

### 영상과 라이선스 (원본 페이지·파일 주소·크레딧·쓴 구간: `media/top5~top8/*.json`, 각 `edit.json`의 `sources`)
- **미국 연방기관 퍼블릭 도메인 (17 U.S.C. §105)**
  - top5: [Great Falls B-roll](https://www.nps.gov/media/video/view.htm?id=3E1DA12E-2547-42CE-AE27-312E81574332) NPS · [Narada Falls](https://www.nps.gov/media/video/view.htm?id=DAB28414-8ACE-492F-BCB8-2DF544BC3D1C) NPS · [Deer Creek Falls](https://www.nps.gov/media/video/view.htm?id=7EAC3264-E68F-4F00-8431-7582706F1745) NPS/Blum, Well, Wang, Estrada, Caldon · [Lower Falls](https://www.nps.gov/media/video/view.htm?id=DA88A39A-11E3-439B-9CFD-E56913A4BBDD) NPS/Jacob W. Frank — NPS 페이지: "Multimedia credited to NPS without any copyright symbol are public domain"
  - top6 (모두 NOAA Ocean Exploration): [붉은 해파리 Poralia](https://oceanexplorer.noaa.gov/multimedia/video-playlist-ex2104-redjelly/) 2021 North Atlantic Stepping Stones · [가스 거품](https://oceanexplorer.noaa.gov/multimedia/video-playlist-ex2304-bubbles/) Seascape Alaska(2023.7.18) · [19세기 난파선](https://oceanexplorer.noaa.gov/multimedia/video-playlist-marine-finest/) (2019.5.16, 멕시코만) · [블랙 스모커](https://oceanexplorer.noaa.gov/multimedia/video-playlist-ex1605-vents/) 2016 Deepwater Exploration of the Marianas · [브림스톤 피트 분화](https://oceanexplorer.noaa.gov/multimedia/video-playlist-06rof-brimstone/) Submarine Ring of Fire 2006, NOAA/PMEL
  - top7: [슈퍼셀 타임랩스](https://www.flickr.com/photos/noaanssl/48325626841/) NOAA/NSSL/Matthew Woods (Flickr Public Domain Mark) · [라마강 홍수](https://www.flickr.com/photos/yellowstonenps/52212141973/) NPS/Chase Tedder (Public Domain Mark, Commons PD-USGov-NPS) · [어마 눈 속 비행](https://commons.wikimedia.org/wiki/File:Although_most_of_our_Hurricane_-Irma_flight_videos_display_the_unique_turbule....webm) Nick Underwood, NOAA Hurricane Hunters (Commons PD-NOAA, 라이선스 검토 완료) · [ISS에서 본 허리케인 밀턴](https://images.nasa.gov/details/jsc2024m000173_International_Space_Station_Cameras_Capture_New_Views_Of_Hurricane_Milton_241008) NASA · [세인트리보리 토네이도](https://commons.wikimedia.org/wiki/File:Sean_Waugh_NOAA_NSSL_-_Saint_Libory_Nebraska_EF3_Tornado_17_05_2026.webm) Dr. Sean Waugh, NOAA NSSL (Commons PD-USGov-NOAA)
  - top8: [Balanced Rock](https://www.nps.gov/media/video/view.htm?id=FD943AF9-7F2B-4299-B91B-491F2CDB1C29) NPS/Neal Herbert · [Badwater Basin](https://www.nps.gov/media/video/view.htm?id=55850C7D-FFC3-6103-D5C288C1FF969A31) NPS · [Racetrack](https://www.nps.gov/media/video/view.htm?id=582F570D-B9C7-8138-0C0BDC270BD0D080) NPS · [Halemaʻumaʻu 용암 호수](https://www.usgs.gov/media/videos/lava-lake-within-halemaumau-vent) USGS HVO ("Sources/Usage: Public Domain.") · [Grand Prismatic 타임랩스](https://commons.wikimedia.org/wiki/File:Grand_Prismatic_Spring_(timelapse).webm) NPS/Jacob W. Frank (Commons PD-USGov-NPS)
- **CC BY 4.0**: top5 1위 [Yosemite Upper Falls high flow](https://commons.wikimedia.org/wiki/File:Yosemite_Upper_Falls_high_flow_Yosemite_CA_2023-07-13_14-42-17_1.webm) G. Edward Johnson (Wikimedia Commons) — 확대·크롭·소리 끔으로 수정. NPS의 요세미티 폭포 영상(Yosemite Nature Notes)은 Yosemite Conservancy CC BY-ND라 쓰지 않았습니다.
- 화면에는 “영상: 미국 국립공원관리청(NPS)”, “영상: 미국 해양대기청(NOAA)”, “영상: 미국 지질조사국(USGS)”, “영상: NASA”, “영상: G. Edward Johnson (CC BY)”만 적었습니다. 기관 로고·타이틀 카드는 쓰지 않았습니다.
- 음악: "Heroic Age", "Gathering Darkness", "Movement Proposition", "Dreamer" Kevin MacLeod (incompetech.com), CC BY 4.0

### 자막 속 사실과 출처
- top5: 그레이트폴스는 20피트 폭포 여럿, 1마일도 안 되는 거리에서 총 76피트(23m) 낙차 — [NPS Great Falls](https://www.nps.gov/grfa/learn/nature/falls.htm) / 나라다 폭포 전체 높이 168피트(51m) — [NPS](https://www.nps.gov/places/narada-falls.htm) / 디어크릭 폭포 174피트(53m) — [NPS 영상 설명](https://www.nps.gov/media/video/view.htm?id=46D6B336-AA98-49FB-B7F8-D238C47D12F9) / 옐로스톤 로어 폭포 308피트(94m) — [NPS Yellowstone](https://home.nps.gov/yell/planyourvisit/canyonplan.htm) / 요세미티 폭포 2,425피트(740m), 세 폭포(윗폭포 1,430·중간 675·아랫폭포 320피트)로 이루어짐 — [NPS Yosemite](https://www.nps.gov/yose/planyourvisit/waterfalls.htm) (영상은 윗폭포)
- top6: 붉은 해파리는 수심 700m 탐사 구간에서 발견, Poralia 속이지만 “미기재 종일 수도” — [NOAA](https://oceanexplorer.noaa.gov/multimedia/video-playlist-ex2104-redjelly/) (화면 “신종?”) / 사낙 가스 분출대의 가스 커튼이 해저에서 1,500m 넘게 솟음 — [NOAA](https://oceanexplorer.noaa.gov/news/ak-seep-discovery/) / 난파선은 19세기 중반 범선으로 추정, 길이 약 37.8m — [NOAA EX1902](https://oceanexplorer.noaa.gov/expedition/ex1902/) (화면 “19세기 범선?”) / 이 블랙 스모커 열수구 지대엔 30m(98피트)가 넘는 굴뚝도 있음 — [NOAA](https://oceanexplorer.noaa.gov/multimedia/video-playlist-ex1605-vents/) (영상 속 굴뚝이 그 굴뚝이라는 말은 하지 않음) / 2006년 브림스톤 피트에서 사상 처음으로 해저 화산 분화를 목격 — [NOAA](https://oceanexplorer.noaa.gov/multimedia/video-playlist-06rof-brimstone/)
- top7: 가장 강한 토네이도 대부분이 슈퍼셀에서 나옴 — [NOAA SPC](https://www.spc.noaa.gov/misc/AbtDerechos/supercells.htm) / 2022.6.13 옐로스톤 500년 빈도 홍수 — [NPS](https://www.nps.gov/yell/planyourvisit/flood-recovery.htm) / 2024.10.8 오전 8시(미 동부) 밀턴 풍속 시속 145마일(233km) — [NASA](https://images.nasa.gov/details/jsc2024m000173_International_Space_Station_Cameras_Capture_New_Views_Of_Hurricane_Milton_241008) / 2026.5.17 네브래스카 세인트리보리 토네이도 EF-3, 최대 추정 풍속 160mph(257km/h), 사망 0·부상 0 — [NWS Hastings 조사](https://www.weather.gov/media/gid/events/2026/May17th/PNS.pdf) / 어마의 눈 안 파란 하늘은 영상에 보이는 그대로(수치 없음)
- top8: 밸런스드 록 높이 128피트(39m) — [NPS Arches](https://www.nps.gov/places/balanced-rock-viewing-area.htm) / 배드워터 분지는 해수면보다 282피트(86m) 낮은 북미 최저점 — [NPS Death Valley](https://www.nps.gov/places/badwater-basin.htm) / 용암 호수 폭 약 150m — [USGS](https://www.usgs.gov/media/videos/lava-lake-within-halemaumau-vent) / 레이스트랙의 돌은 물·얼음·바람의 드문 조합으로 움직임 — [NPS](https://www.nps.gov/articles/deva-moving-rocks.htm) / 그랜드 프리즈매틱은 옐로스톤 최대 온천, 지름 200–330피트(61–100m) — [NPS](https://www.nps.gov/places/000/grand-prismatic-spring.htm)

### 업로드 문구

**top5** — 역대급 거대한 폭포 TOP5 ㄷㄷ
> 안개 속 그레이트폴스 급류, 레이니어산 나라다 폭포, 그랜드캐니언 붉은 협곡의 디어크릭 폭포, 높이 94m 옐로스톤 로어 폭포, 그리고 세 단 합쳐 740m인 요세미티 폭포까지. 다들 몇 위가 제일 웅장해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) — Jacob W. Frank, Blum·Well·Wang·Estrada·Caldon · Yosemite Falls: G. Edward Johnson / CC BY 4.0 (Wikimedia Commons, 잘라내고 확대함) (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Heroic Age" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #폭포 #요세미티 #옐로스톤 #대자연 #shorts

**top6** — 바닷속 소름 돋는 장면 TOP5 ㄷㄷ
> 수심 700m의 핏빛 해파리, 바위 밑을 강처럼 흐르는 가스 거품, 우연히 찾은 19세기 범선 난파선, 검은 연기를 뿜는 심해 굴뚝, 그리고 사람이 처음으로 목격한 해저 화산 분화까지. 전부 실제 탐사 영상입니다. 다들 몇 위가 제일 소름?
> 영상: 미국 해양대기청(NOAA Ocean Exploration, NOAA/PMEL) (NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #심해 #바다 #소름 #해저화산 #shorts

**top7** — 역대급 무서운 날씨 TOP5 ㄷㄷ
> 하늘을 통째로 돌리는 슈퍼셀, 2022년 옐로스톤 500년 만의 홍수, 허리케인 어마의 눈 속으로 들어간 관측기, 우주정거장에서 본 허리케인 밀턴, 그리고 2026년 5월 네브래스카의 EF3 토네이도(최대 풍속 시속 257km 추정, 인명 피해 없음)까지. 다들 몇 위가 제일 무서워요?
> 영상: 미국 해양대기청(NOAA/NSSL — Matthew Woods, Sean Waugh · NOAA Hurricane Hunters — Nick Underwood) · 미국 국립공원관리청(NPS — Chase Tedder) · NASA (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #토네이도 #허리케인 #날씨 #자연재해 #shorts

**top8** — 지구에서 가장 이상한 장소 TOP5 ㄷㄷ
> 쓰러질 듯 안 쓰러지는 39m 균형 바위, 바다보다 86m 낮은 소금 사막, 화산 속에서 끓는 용암 호수, 아무도 없는데 스스로 움직이는 돌, 그리고 무지개색 거대 온천까지. 전부 실제 미국 국립공원에 있는 장소입니다. 다들 몇 위가 제일 이상해요?
> 영상: 미국 국립공원관리청(NPS) — Neal Herbert, Jacob W. Frank · 미국 지질조사국(USGS) (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Dreamer" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #신기한장소 #국립공원 #옐로스톤 #데스밸리 #shorts

## 괴담 쇼츠 v2 (벤치마크, `horror1`~`horror12`)

`research/benchmark-footage.md` 1절과 `research/benchmark-targets-footage.json`의 `horror_riddle`(디로록 「[괴담] 이해하면 무서운」, 중앙값 21초)에 맞춰 `horror1`~`horror8`을 같은 영상으로 다시 만들고, 아이디어 목록에서 학교·일상 물건 괴담 4편(`horror9`~`horror12`)을 새로 만들었다. 이야기는 2, 6, 7, 8편이 v1과 같다. 1, 3, 4, 5, 12편은 아래 이야기 검토에서 다시 썼다. 열두 편 모두 **직접 쓴 창작 괴담**이다. 피·폭력·실존 장소·브랜드·인물은 없고, 공포는 암시로만 준다.

**이야기 검토 (REVIEW.md 2-1, 2026-10-10).** 다 만든 뒤 2-1절로 열두 편을 다시 봤다. 세 가지를 확인했다. 단서가 앞에 공정하게 깔렸는가. 반전이 마지막 한 줄에 오는가. 제목이나 첫 줄로 맞힐 수 없고, 흔한 괴담을 되풀이하지 않는가. 그 결과 다섯 편을 다시 썼다.
- **`horror1` 엘리베이터:** “보이지 않는 사람들로 정원 초과”는 이미 널리 알려진 괴담이었다. 화자가 귀신인 이야기로 바꿨다.
- **`horror3` 택배:** “안에 계신 분이 받아 가셨어요”에서 정답이 중간에 드러났다. 빈 옆집 이야기로 바꿨다.
- **`horror4` 거울:** 거울 속 다른 방은 흔한 괴담이다. 「정전」으로 바꿔 따뜻한 반전을 넣었다.
- **`horror5` 센서등:** 끝이 “등 뒤에 누가 있다”였다. 30초 규칙을 단서로 쓰는 끝으로 바꿨다.
- **`horror12` 숨바꼭질:** 끝이 “옷장 안 내 뒤에 누가 있다”였고, 반전이 마지막 줄보다 앞에 왔다. 술래가 동생이 아니었다는 문자 반전으로 바꿨다.
- **남긴 일곱 편:** 2, 6, 7, 8, 9, 10, 11편은 단서가 공정하고 반전이 마지막 줄에 와서 그대로 뒀다. 다만 2, 7, 8, 10편은 모두 “숨은 누군가”라는 뼈대다. 2-1의 9번(같은 뼈대를 연달아 쓰지 않는다)에 따라 아래 업로드 순서에서 이 넷이 붙지 않게 했다.
- **다시 쓴 편의 영상:** 같은 영상 묶음 안에서 컷을 다시 짰다. `horror4`는 손(10210122, 7546178), 꺼진 휴대폰을 든 손(7822022), 현관 손잡이(2108274), 복도(7598737, 9658661, 19217899)를 더했다.

**v1에서 바뀐 것**
- **길이 32.4초 → 20.0~22.5초.** 목소리를 Edge TTS `ko-KR-InJoonNeural` `+18%` `-4Hz`로 다시 녹음하고, 대본을 7~8줄로 줄였다. 줄 사이 쉼은 0.18초(`horror9`·`horror11`은 0.26초)다.
- **끝.** “이해하셨나요? 정답은 댓글에” 줄을 지웠다. 반전 한 줄 뒤 0.45~0.6초에서 끊고 첫 장면으로 돌아간다(루프). 정답 유도는 고정 댓글로 옮겼다.
- **0초.** 첫 자막(3~5음절, “밤 열한 시”)과 제목 단어가 첫 프레임에 이미 떠 있다. 첫 줄의 `gap`을 0으로 두면 첫 자막 페이지가 0 ms에 시작하고, `capLook: "plain"`은 등장 애니메이션이 없어서 첫 프레임에 글자가 다 보인다. 첫 장면은 열두 편 모두 **얼굴 없는 손이나 실루엣**이다(버튼을 누르는 손, 문손잡이를 잡는 손, 휴대폰을 든 손, 꺼진 휴대폰을 든 손, 젖은 유리를 짚은 손, 텐트 안 손 그림자, 공책을 든 손, 할머니 손 위의 아이 손, 옷걸이를 잡은 손).
- **화면.** 검정 띠와 1:1 박스를 없애고 9:16 전체 화면에 영상을 깔았다. 위쪽에 흰 작은 글씨 “이해하면 무서운”과 큰 빨간 한 단어(예: “엘리베이터”)를 그림 위에 얹는다. 자막은 흰색 한 가지이고 높이 62.5%(y=1200)에 둔다. 강조색과 현재 단어 초록 강조는 없다. 화면에 출처 배지가 없고, 영상 크레딧은 모두 설명란에 넣는다.
- **제목 명사.** 장소 대신 물건으로 바꾼 편이 있다: 비상계단 → **센서등**, 지하주차장 → **김 서린 차**, 캠핑장 → **발자국**, 거울 → **정전**(이야기를 새로 씀).
- 어두운 보정과 아껴 쓴 효과음(편마다 3~4개, 번쩍임 1번)은 그대로다. 음악은 Kevin MacLeod “Gathering Darkness”(홀수 편)와 “Ghost Story”(짝수 편)를 번갈아 쓴다.
- **브랜드 점검.** v1 `horror2`의 운동화(8472547)는 옆면에 상표 별 무늬가 보여서 빼고, 손이 신발을 내려놓는 장면(8533759)으로 바꿨다. v1 `horror3`의 택배 상자(7362620)는 빨간 “FRAGILE” 스티커가 9:16 화면에 들어와서 빼고, 종이봉투(7362603)만 쓴다. 화면이 거의 검게 보이던 휴대폰 알림 클립(34786856·34786878)도 손에 든 휴대폰 장면으로 바꿨다. 0초 화면에는 상표·간판·라벨이 없다.

### 새 템플릿 옵션 (edit.json, 기존 쇼츠는 그대로)
| 옵션 | 뜻 |
|---|---|
| `"titleStyle": "riddle"` | 띠 없이 그림 위에 2줄 제목을 얹는다. `title[0]`은 흰 작은 수식어(최대 64px), `title[1]`은 빨간 큰 한 단어(최대 168px)이고 검은 외곽선과 그림자가 있다. 색은 `"titleKey"`(기본 `#E8141B`)로 바꾼다 |
| `"titleY"` | riddle 제목 블록의 세로 중심(기본 330px, 약 17%) |
| `"capLook": "plain"` | 흰색 한 가지 자막. 최대 82px, 얇은 외곽선과 그림자가 있고 단어 강조·등장 애니메이션은 없다. `"captionY"`로 위치를 정한다(괴담 v2는 1200) |
| `"frame": "full"` + `"credit": ""` + 클립마다 `"credit": ""` | 이미 있던 기능이다. 9:16 전체 화면에 화면 크레딧 없이 쓴다 |

- 코드: 새 파일 `src/lib/Riddle.tsx`(`RiddleTitle`, `PlainCaptions`). 공유 파일에는 연결부만 넣었다. `src/ClipShort.tsx`에 import 1줄, `ShortData` 타입 3필드, `Title`에 1줄, 자막 자리에 분기 1개를 넣었고, `prep.py`는 넘기는 키 목록에 `titleY`, `capLook` 두 개를 더했다. 이 키가 없는 쇼츠는 data JSON과 화면이 전과 같다.
- 확인: 손대지 않은 `doodle1`을 바꾸기 전 커밋(워크트리)과 바꾼 뒤에 각각 렌더했다. `src/data/doodle1.json`이 같고, mp4 파일이 바이트 단위로 같다(1,032프레임 framemd5 모두 일치).
- 시리즈 스크립트: `media/horror/make_edits_v2.py`(12편 컷 목록 → edit.json과 `media/horror/sources_v2.json`), `media/horror/grade3.sh`(원본을 받아 `catalog.CX` 지점을 중심으로 9:16로 자르고 1080×1920으로 어둡게 보정), `media/horror/scorecard.py`(아래 표), `media/horror/catalog.py`에 새 클립·`CX`·`DARK`·`BRIGHT` 추가. 예전 `make_edits.py`는 v1 기록용이라 다시 돌리면 안 된다(v2 edit.json을 덮어쓴다).

```bash
python3 media/horror/make_edits_v2.py       # shorts/horror1-12/edit.json + media/horror/sources_v2.json
media/horror/grade3.sh                      # Pexels·Pixabay 원본 → public/horror*/src/ (9:16, 1080x1920, 보정)
for i in $(seq 1 12); do python3 voice_edge.py horror$i && python3 prep.py horror$i && ./render.sh horror$i final/horror$i.mp4; done
# horror7(야간 노이즈)은 45.7MB라 CRF 23으로 다시 인코딩했다 (15.0MB):
#   ffmpeg -i final/horror7.mp4 -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/horror7.mp4
for i in $(seq 1 12); do python3 qa_review.py horror$i; done
python3 media/horror/scorecard.py $(seq -f "horror%g" 1 12)
```

| id | 화면 제목 | 길이 | 검토 | 한 줄 요약 | 결말 유형 | 노리는 감정 | 정답 해설 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `horror1` | 엘리베이터 | 20.7초 | 다시 씀 | 혼자 탄 엘리베이터에 탄 아저씨가 '텅 빈' 안을 보고 도망가고, 층마다 아무도 안 탄다 | 정체 반전(화자가 귀신) | 소름 | 아저씨는 내가 있는데도 텅 빈 안을 봤다(나는 안 보인다). 나 혼자인데 정원 초과였다(안에 나 같은 것들이 가득하다). 나는 이 엘리베이터에서 내리지 못하는 귀신이다 |
| `horror2` | 도어락 | 21.8초 | 유지 | 새벽 3시 도어락이 열렸다 다시 잠기고, 아침엔 신발이 한 켤레 늘었다 | 숨은 침입자 | 소름 | 도어락은 안에서 다시 잠겼고 신발이 늘었다. 들어온 사람은 나가지 않았고 아직 집 안에 있다 |
| `horror3` | 택배 | 20.7초 | 다시 씀 | 사흘째 그대로인 옆집 택배, 석 달 전 이사 가 비었다는 관리사무소 답장, 그리고 어제 날짜 주문 | 정체 반전(빈집의 주인) | 소름 | 비었다는 옆집에서 밤마다 TV 소리·발소리가 나고 어제 주문까지 했다. 빈집에 누군가 몰래 살고 있고, 택배를 가지러 문밖으로는 나오지 않는다(사흘째 그대로) |
| `horror4` | 정전 | 22.3초 | 다시 씀 | 정전된 새벽, 작은 손이 나를 현관 밖까지 데려다줬는데 엄마는 "집에 너 혼자라 걱정했다"고 한다 | 따뜻한 반전 | 뭉클한 소름 | 집엔 나 혼자였다. 나를 데리고 나온 작은 손은 사람이 아니다. 그래도 그 손은 나를 구했다 |
| `horror5` | 센서등 | 21.2초 | 다시 씀 | 30초 뒤 꺼지는 비상계단 센서등이 5분 넘게 내려가는 동안 하나도 꺼지지 않았다 | 규칙 단서(의외의 이유) | 소름 | 센서등은 사람이 지나가고 30초 뒤 꺼진다. 5분이 지나도 하나도 안 꺼졌다면, 층마다 지금도 누군가 서 있다 |
| `horror6` | 김 서린 차 | 21.0초 | 유지 | 몇 달째 안 움직인 잠긴 차, 김 서린 운전석 유리에 좌우가 뒤집힌 "또 봤네?" | 사물 단서 | 소름 | 김은 차 안에서 숨을 쉬어야 서리고, 뒤집힌 글씨는 안쪽에서 쓴 것이다. 잠긴 차 안에 몇 달째 누가 있다 |
| `horror7` | 홈캠 | 20.5초 | 유지 | 현관만 비추던 홈캠에, 침대 옆에서 자는 나를 내려다본 두 시간이 찍혀 있다 | 숨은 침입자(기록 단서) | 소름 | 현관문은 열린 적이 없는데 카메라가 옮겨졌다 돌아왔다. 처음부터 집 안에 있던 누군가의 짓이다 |
| `horror8` | 발자국 | 22.2초 | 유지 | 텐트를 한 바퀴 돈 발소리, 아침엔 입구에서 나와 다시 입구로 들어간 발자국 | 숨은 동행 | 소름 | 발자국은 밖에서 온 게 아니라 텐트 안에서 나왔다 들어갔다. 밤새 텐트 안에 나 말고 누가 있었다 |
| `horror9` | 단톡방 | 20.2초 | 유지 | 새벽 3시 반 단톡방 초대, "이제야 다 모였네", 참여 인원 30명 | 숫자 단서 | 소름 | 우리 반은 나까지 29명인데 30명이다. 반 아이가 아닌 누군가가 끼어 있고, 내가 들어오길 기다리고 있었다 |
| `horror10` | 알림장 | 20.0초 | 유지 | 출장 간 엄마 이름으로 알림장에 사인이 되어 있다 | 숨은 침입자(물건 단서) | 소름 | 엄마는 출장, 집엔 나 혼자, 알림장은 밤새 내 방 가방 안. 내가 자는 사이 누군가 내 방에 들어와 엄마인 척 사인했다 |
| `horror11` | 할머니 손금 | 20.1초 | 유지 | 내 손금을 보고 웃으신 할머니의 손바닥에는 손금이 하나도 없다 | 정체 반전 | 소름 | 얼음처럼 차갑고 손금이 없는 손. 그 '할머니'는 살아 있는 사람이 아니다 |
| `horror12` | 숨바꼭질 | 22.5초 | 다시 씀 | 옷장에 숨었는데, 방문을 하나씩 열던 술래가 안방 앞에서 멈춘 순간 동생 문자: "나 아직 화장실인데" | 정체 반전(술래가 다르다) | 소름 | 동생은 아직 화장실에 있다. 낮은 목소리로 열을 세고 방문을 열던 '술래'는 동생이 아니고, 지금 안방 문 앞에 서 있다 |

**업로드 순서(결말 유형이 연달아 겹치지 않게):** `horror1` → `horror6` → `horror11` → `horror2` → `horror9` → `horror4` → `horror8` → `horror3` → `horror5` → `horror7` → `horror12` → `horror10`

### 검토 결과 (`qa_review.py`)
열두 편 모두 **FAIL 0**이고, `설명글` 줄은 PASS다. WARN은 편마다 같은 두 줄이다.
- **길이 WARN (20.0~22.5초).** 검토표의 PASS 구간은 25~45초인데, 이 포맷의 벤치마크 목표가 20~23초다. 일부러 맞춘 값이다.
- **제목 띠 WARN (`riddle`).** 벤치마크가 띠 없는 그림 위 제목이라 일부러 띠를 뺐다.
- 그 밖에 첫 장면 0.2~1.5초, 최장 샷 2.1~3.0초, 자막 한 장 최장 12자 이하, −14.0 LUFS, 검은 화면 없음, 용량 10.4~27.3MB로 모두 PASS다.
- 사람이 본 것(first.png, last.png, sheet.png): 0초에 손이나 실루엣, 빨간 제목 단어, 첫 자막이 함께 보인다. 끝은 반전 자막 위의 정지에 가까운 장면이다. 글자가 겹치거나 잘린 곳은 없다. 얼굴이 알아볼 수 있게 나오는 장면은 없다(`horror6` 빈 주차장 먼 문 앞의 작은 실루엣 하나는 v1과 같은 클립이고, 알아볼 수 없는 크기다).

### 벤치마크 점수표
렌더(`final/*.mp4`)를 `qa_review.py`와 같은 장면 감지로 재고, 음성 타임라인(`build/<id>/timeline.json`)과 대본에서 셌다. 훅 끝은 첫 문장 마지막 음절 + 0.15초, 음절/초는 전체 음절 ÷ 길이, 줄 수는 대본 줄(괄호는 문장 수)이다.

| id | 길이 (목표 20–23, 21) | 훅 끝 (≤1.2) | 첫 전환 (≤1.5) | 평균 샷 (1.9) | 최장 샷 (≤3.0) | 음절/초 (≥5.8) | 줄 수 (9) | 화면 제목 (10+5자) |
|---|---|---|---|---|---|---|---|---|
| `horror1` | 20.7초 | 0.65초 | 0.8초 | 1.72초 | 2.37초 | 5.9 (122음절) | 7줄 (12문장) | 이해하면 무서운 / 엘리베이터 (7+5자) |
| `horror2` | 21.8초 | 0.73초 | 0.23초 | 1.28초 | 2.07초 | 3.99 (87음절) | 8줄 (12문장) | 이해하면 무서운 / 도어락 (7+3자) |
| `horror3` | 20.7초 | 1.42초 | 0.73초 | 1.59초 | 2.53초 | 5.47 (113음절) | 7줄 (9문장) | 이해하면 무서운 / 택배 (7+2자) |
| `horror4` | 22.3초 | 0.68초 | 1.5초 | 1.72초 | 2.77초 | 4.89 (109음절) | 7줄 (13문장) | 이해하면 무서운 / 정전 (7+2자) |
| `horror5` | 21.2초 | 0.81초 | 0.33초 | 1.51초 | 2.57초 | 5.75 (122음절) | 7줄 (12문장) | 이해하면 무서운 / 센서등 (7+3자) |
| `horror6` | 21.0초 | 0.64초 | 0.83초 | 1.4초 | 2.6초 | 5.18 (109음절) | 7줄 (10문장) | 이해하면 무서운 / 김 서린 차 (7+4자) |
| `horror7` | 20.5초 | 0.68초 | 0.77초 | 1.46초 | 2.47초 | 5.56 (114음절) | 7줄 (11문장) | 이해하면 무서운 / 홈캠 (7+2자) |
| `horror8` | 22.2초 | 0.76초 | 1.0초 | 1.48초 | 2.67초 | 4.92 (109음절) | 7줄 (12문장) | 이해하면 무서운 / 발자국 (7+3자) |
| `horror9` | 20.2초 | 0.65초 | 0.77초 | 1.44초 | 3.0초 | 5.36 (108음절) | 8줄 (10문장) | 이해하면 무서운 / 단톡방 (7+3자) |
| `horror10` | 20.0초 | 0.89초 | 1.23초 | 1.43초 | 2.5초 | 5.69 (114음절) | 8줄 (9문장) | 이해하면 무서운 / 알림장 (7+3자) |
| `horror11` | 20.1초 | 0.55초 | 0.7초 | 1.43초 | 2.3초 | 5.48 (110음절) | 7줄 (10문장) | 이해하면 무서운 / 할머니 손금 (7+5자) |
| `horror12` | 22.5초 | 0.83초 | 1.1초 | 1.6초 | 2.8초 | 4.72 (106음절) | 7줄 (11문장) | 이해하면 무서운 / 숨바꼭질 (7+4자) |

**못 맞춘 것과 이유**
- **음절/초 3.99~5.9 (목표 5.8 이상).** `horror1`(5.9)만 넘었다. 목표 5.8은 벤치마크에서 잰 값이 아니다. “+18%로 약 6.2음절/초”를 가정한 추정이다. 실제 InJoon `+18%`의 순수 발화 속도는 약 5.6음절/초라 대부분 편이 닿기 어렵다. 지시대로 +18%를 지켰고, 문장 안 쉼과 줄 사이 쉼을 줄여 v1(4.1)보다 빨라졌다. `horror2`가 가장 낮은 이유는 “삑, 삑, 삑, 삑”처럼 박자를 두고 읽는 소리 구절 때문이다(지우면 이야기의 소리 단서가 사라진다).
- **평균 샷 1.28~1.72초 (목표 1.9, 추정).** 목표보다 조금 더 빠르다. 장면 감지는 한 클립 안에서 문이 열리거나 불이 켜지는 변화도 전환으로 센다. 최장 샷은 모두 3.0초 이하로 목표 안이다.
- **훅 끝:** `horror3`은 1.42초(목표 1.2초 이하)다. 첫 문장 “옆집 문 앞의 택배 봉투.”가 9음절이기 때문이다. 0초 자막은 “옆집 문 앞 택배” 한 장이다.
- **줄 수 7~8줄 (목표 9, 추정).** 문장 수로는 9~13문장이고, 자막 한 장은 3~9음절이다.
- **화면 제목 7+2~5자 (목표 10+5).** 벤치마크 화면 제목이 “신기한 / 지우개”처럼 짧은 수식어 + 명사라서 화면에서는 “[괴담]”을 빼고 “이해하면 무서운 / ○○”만 둔다. “[괴담] 이해하면 무서운 ○○”는 업로드 제목에 쓴다.
- 길이, 첫 전환(0.23~1.5초), 최장 샷은 열두 편 모두 목표 안이다. 훅 끝도 `horror3`을 빼면 모두 목표 안이다.

### 영상과 라이선스 (2026-10-10, 각 영상 페이지를 열어 “Free”·제작자를 확인)
페이지 주소·파일 주소·제작자·쓴 구간(초)은 `media/horror/sources_v2.json`과 각 `edit.json`의 `sources`에 있다. 화면에는 출처를 표시하지 않고, 업로드 설명란 출처 줄에 모든 제작자를 적는다.
- **Pexels License** (https://www.pexels.com/license/ — 무료, 수정 가능, 출처 표기 불필요. 수정 없는 판매·재배포와 사람을 나쁘게 보이게 하는 사용은 금지):
  - horror1: 7701962 MART PRODUCTION, 15434928 Yusuf Çelik, 34779661 Stefan, 15201563 Darina Evstafeva, 5823578 Charlotte May, 978049 Stefan Kwiecinski / Pixabay: 131012·130783 Jesehab
  - horror2: 2108274 Nazar Matveichev, 35999369 Jakub Bukowski, 9658661 Videas Cl, 29038649 Адам Аушев, 7598737 Artadya Gumelar, 19217899 Nino Souza, 5384813 Tima Miroshnichenko, 3512344 Bran Sodre, 8533759 Kaboompics (karola-g) / Pixabay: 28237 Jacques_Barrette
  - horror3: 6611938 Tima Miroshnichenko, 7362603 RDNE Stock project, 9658661 Videas Cl, 15365449 Matthias Groeneveld, 7598737 Artadya Gumelar, 13358555 Edwin Lopez
  - horror4: 7822022 RDNE Stock project, 4623153 Artem Podrez, 19217895·19217899 Nino Souza, 7598737 Artadya Gumelar, 10210122 cottonbro studio, 7546178 SHVETS production, 2108274 Nazar Matveichev, 9658661 Videas Cl
  - horror5: 4354915 Ahmet Akpolat, 5843879·9152640 Erik Mclean, 3134591 Caleb Oquendo, 12096163 Sasha Poberailo, 39024320 Alef Morais, 5986347 Pat Whelen, 6010700 Tima Miroshnichenko, 4990438 Pavel Danilyuk
  - horror6: 6302990 Klaus Nielsen, 27890130 Baran Robin, 6028858·6028882 Артем Ковальчук, 19217892 Nino Souza, 38433795 Rishabh Kaple, 5192033 Ming Z, 5227362 Francesco Ungaro, 32078487 Rec Everywhere
  - horror7: 13358555 Edwin Lopez, 19228170·15887293 Curtis Adams, 34106136 Cemrecan Yurtman, 6028175 Ricky Esquivel, 19193293 Rafael Fernanz, 6114429 cottonbro studio, 5245970 Hemanth K M, 6443851 Pavel Danilyuk
  - horror8: 5994916·5994907·5994915 cottonbro studio, 9976082 George Morina, 34405948 Emir Reinado, 7714908 Greta Hoffman, 9591436 Kain kn, 5391986 Saidouni Sidi Med, 4162882 Grisha Grishkoff, 39485457·39619866 Nothing Ahead, 5419248 Yaroslav Shuraev
  - horror9: 6611941·5384813 Tima Miroshnichenko, 13358555 Edwin Lopez, 8342690·8342695 Pavel Danilyuk, 6935499·7822022 RDNE Stock project, 19193293 Rafael Fernanz
  - horror10: 7055339 Kindel Media, 5897634 Katerina Holmes, 6326847 Kaboompics (karola-g), 8342690 Pavel Danilyuk, 6863499 Nataliya Vaitkevich, 7598737 Artadya Gumelar, 19193293 Rafael Fernanz, 5384813 Tima Miroshnichenko, 19217899 Nino Souza, 39425735 Sergei Starostin
  - horror11: 9479751 Ron Lach, 19585708 Salih Sezgen, 35889601 K (@kelly), 10210122·4547598 cottonbro studio, 7234023 Artem Podrez, 5271483 Moe Magners, 7546178 SHVETS production
  - horror12: 9594994·8322393 Ron Lach, 7598737 Artadya Gumelar, 19217899 Nino Souza, 9658661 Videas Cl, 4547598 cottonbro studio, 37554583 Zulfugar Karimov, 13358555 Edwin Lopez
  - v2에서 새로 쓴 클립의 페이지: 7701962, 2108274, 6611938, 7646797, 4354915, 6302990, 13358555, 5994916, 5994907, 6611941, 7822022, 8342690, 6935499, 8342695, 7055339, 5897634, 6326847, 6863499, 39425735, 9479751, 19585708, 35889601, 10210122, 7234023, 5271483, 7546178, 4547598, 9594994, 8322393, 37554583, 8533759. 주소는 `https://www.pexels.com/video/<slug>-<id>/`이고, slug는 `catalog.py`에 있다. 7646797은 v2 첫 판의 `horror4`에만 썼고, 지금 편에는 쓰지 않는다.
- **Pixabay Content License** (무료, 수정 가능, 출처 표기 불필요. 원본 그대로의 판매·배포 금지): 130783·131012 Jesehab(`horror1`), 28237 Jacques_Barrette(`horror2`).
- 손은 모두 얼굴이 나오지 않는 익명의 손이다. 무섭거나 나쁜 맥락의 장면에 알아볼 수 있는 사람은 없다.
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0.
- 사실 인용: 열두 편 모두 창작 괴담이라 숫자·법·날짜 같은 사실 주장이 없다(`horror5`의 “30초 뒤 꺼진다”는 이야기 속 설정이다).

### 업로드 문구
설명글은 `upload/README.md` 형식이다. `upload/specs/horror1~12.json`(`"fiction": true`, 요약은 상황과 궁금증까지만 쓰고 정답은 쓰지 않음)을 `python3 upload/make_desc.py horror<n>`으로 돌려 `upload/txt/horror<n>.txt`를 만들었다. 요약 앞에 “(창작)”이 붙는다. 출처 줄에는 모든 영상 제작자, “이야기 직접 제작(창작 괴담, 실제 장소·인물과 무관) · 내레이션: AI 합성 음성”, 음악 크레딧(CC BY 4.0)이 들어간다. 해시태그는 #Shorts를 포함해 10개다. 채널 이름과 핸들은 `[채널명]`·`[핸들]` 자리표시자로 두었다. 업로드 제목은 「[괴담] 이해하면 무서운 ○○ ㄷㄷ」이다. 정답 유도는 영상에서 빼고 고정 댓글로 옮겼다. 고정 댓글은 정답을 직접 말하지 않고 단서를 준다.

**horror1** — [괴담] 이해하면 무서운 엘리베이터 ㄷㄷ

설명글: `upload/txt/horror1.txt` (`upload/specs/horror1.json`)

고정 댓글: “아저씨는 왜 '텅 빈' 안을 보고 놀랐을까요? 정원 초과 경고가 울린 이유까지 맞히면 정답! 풀이는 답글로 👀”

**horror2** — [괴담] 이해하면 무서운 도어락 ㄷㄷ

설명글: `upload/txt/horror2.txt` (`upload/specs/horror2.json`)

고정 댓글: “문은 '안에서' 다시 잠겼고, 신발은 한 켤레 늘었습니다. 그 사람은 언제 나갔을까요? 풀이는 답글로 👀”

**horror3** — [괴담] 이해하면 무서운 택배 ㄷㄷ

설명글: `upload/txt/horror3.txt` (`upload/specs/horror3.json`)

고정 댓글: “석 달째 비어 있다는 옆집, 밤마다 들리던 TV 소리, 그리고 어제 날짜의 주문. 택배는 누가 시켰을까요? 풀이는 답글로 👀”

**horror4** — [괴담] 이해하면 무서운 정전 ㄷㄷ

설명글: `upload/txt/horror4.txt` (`upload/specs/horror4.json`)

고정 댓글: “엄마 말대로라면 그날 밤 집에는 나 혼자였어요. 그럼 나를 데리고 나온 작은 손은… 풀이는 답글로 👀”

**horror5** — [괴담] 이해하면 무서운 센서등 ㄷㄷ

설명글: `upload/txt/horror5.txt` (`upload/specs/horror5.json`)

고정 댓글: “센서등은 30초 뒤에 꺼집니다. 5분이 지나도 하나도 꺼지지 않았다면, 계단 층층마다… 풀이는 답글로 👀”

**horror6** — [괴담] 이해하면 무서운 김 서린 차 ㄷㄷ

설명글: `upload/txt/horror6.txt` (`upload/specs/horror6.json`)

고정 댓글: “김은 어느 쪽에서 숨을 쉬어야 서릴까요? 그리고 글씨는 왜 뒤집혀 있었을까요? 풀이는 답글로 👀”

**horror7** — [괴담] 이해하면 무서운 홈캠 ㄷㄷ

설명글: `upload/txt/horror7.txt` (`upload/specs/horror7.json`)

고정 댓글: “현관문은 한 번도 열리지 않았는데, 누가 홈캠을 침대 옆으로 옮겼다가 다시 돌려놨을까요? 풀이는 답글로 👀”

**horror8** — [괴담] 이해하면 무서운 발자국 ㄷㄷ

설명글: `upload/txt/horror8.txt` (`upload/specs/horror8.json`)

고정 댓글: “발자국은 입구에서 '나와서' 다시 '들어갔습니다'. 그날 밤 텐트 안엔 몇 명이 있었을까요? 풀이는 답글로 👀”

**horror9** — [괴담] 이해하면 무서운 단톡방 ㄷㄷ

설명글: `upload/txt/horror9.txt` (`upload/specs/horror9.json`)

고정 댓글: “우리 반은 나까지 29명인데 참여 인원은 30명. 서른 번째는 누구였고, 누구를 기다리고 있었을까요? 풀이는 답글로 👀”

**horror10** — [괴담] 이해하면 무서운 알림장 ㄷㄷ

설명글: `upload/txt/horror10.txt` (`upload/specs/horror10.json`)

고정 댓글: “엄마는 출장 중이고 집엔 나 혼자였습니다. 밤새 내 방 가방에서 알림장을 꺼내 사인한 사람은 누구일까요? 풀이는 답글로 👀”

**horror11** — [괴담] 이해하면 무서운 할머니 손금 ㄷㄷ

설명글: `upload/txt/horror11.txt` (`upload/specs/horror11.json`)

고정 댓글: “살아 있는 사람이라면 손바닥에 손금이 있죠. 얼음처럼 차가운 손, 손금 없는 손바닥의 '할머니'는 누구였을까요? 풀이는 답글로 👀”

**horror12** — [괴담] 이해하면 무서운 숨바꼭질 ㄷㄷ

설명글: `upload/txt/horror12.txt` (`upload/specs/horror12.json`)

고정 댓글: “동생은 아직 화장실에 있었습니다. 그럼 열까지 세고 방문을 하나씩 열던 건 누구였을까요? 풀이는 답글로 👀”

## 그 시절 레트로 v2 (벤치마크, `retro1`~`retro12`)

`research/benchmark-footage.md` 2절과 `research/benchmark-targets-footage.json`의 `retro` 목표에 맞춰 다시 만든 판입니다. 벤치마크는 그 시절 우리의 「김치 식단」(359만), 「80년대 캠핑」(314만), 「계곡 식사」(189만)입니다. 바뀐 점은 다음과 같습니다.

- **화면 제목**: 노란 1줄은 도발·대비형("요즘 ○○ 반성해라", "○○ 없어도 ○○했다"), 흰 2줄은 시대("80년대 ○○ 모습/실태"). `retro1`~`retro8`은 사진이 1950~70년대라서 2줄을 "그 시절 ○○ 모습"으로 썼습니다.
- **그림 박스**: 높이 27~73%(위 518px, 높이 884px), 폭 95%, 둥근 모서리. 바탕은 검정입니다.
- **자막**: 박스 안 아래쪽의 반투명 검정 띠 위에 흰 글씨로 넣고, 강조색은 노랑 하나만 씁니다. 단어별 초록 강조는 쓰지 않습니다. 첫 자막은 0초 프레임부터 떠 있어 썸네일에 잡힙니다.
- **출처 표시**: 화면의 출처 배지·각주 스티커와 위아래 그림자를 모두 뺐습니다. 크레딧은 설명란에 넣습니다.
- **연도 표시**: 박스 왼쪽 위에 작은 노란 연도 태그를 둡니다.
- **길이와 발화**: 27~31초, Edge TTS `ko-KR-SunHiNeural` `+25%`, 9~12문장. 첫 구절은 연도나 짧은 문장으로 끊어 1.5초 안에 끝냅니다.
- **시대**: 새 편 `retro9`~`retro12`는 1980~1995년 사진입니다.

### 새 템플릿 옵션 (`src/lib/RetroV2.tsx`)

`edit.json` 최상위에 두 키를 넣으면 켜집니다. 키가 없는 쇼츠는 예전과 똑같이 렌더됩니다.

- 확인 1: 이 판 이전(HEAD 1dcdd42)의 `retro1`(`rounded43`)을 옛 코드와 새 코드로 렌더해 0·120·400프레임을 비교했습니다. 다른 픽셀은 0개였습니다.
- 확인 2: `teuk1`의 0·200·500·800프레임도 바꾸기 전후로 렌더해 비교했습니다. 역시 0픽셀이 달랐습니다.

```json
{ "titleStyle": "band", "frame": "retrobox", "look": "retro2", "grain": 0.12, "credit": "" }
```

- `"frame": "retrobox"`: 사진을 27~73% 높이의 둥근 박스(`RETROBOX`)에 넣습니다. `rounded43`과 같은 필름 그레인(`grain`), `crop: [cx, cy, zoom]` 디테일 컷, 클립별 `year`를 씁니다. 연도는 작은 노란 태그로 보이고, 첫 클립에서는 튀어나오지 않아 0초 프레임에도 보입니다.
- `"look": "retro2"`: 위 25% 안의 노랑(1줄)·흰색(2줄) 제목(`RetroTitle`), 박스 안 반투명 띠 자막(`StripCaptions`)을 켜고, 그림자 오버레이와 출처 배지(`Credit`)를 끕니다. `titleStyle`은 `qa_review.py`의 제목 띠 검사 때문에 `"band"`로 둡니다.
- 바꾼 곳:
  - `src/lib/RetroV2.tsx`(새 파일).
  - `src/lib/Retro.tsx`: `Rounded43`과 `rounded43Crop`에 생략 가능한 `box` 인자를 추가했습니다. 기본값은 기존 `ROUNDED43`입니다.
  - `src/ClipShort.tsx`: import 1줄, `Clip.frame`에 `"retrobox"`, `ShortData.look`, `FRAME` 1줄, ClipView 분기 조건과 연도 태그 1줄, Title 1줄, Credit 조건 1개, 그림자 조건 1개, Captions 분기 1줄을 바꿨습니다.
  - `prep.py`: `look`을 넘기는 1줄을 추가했습니다.
- 도구(`media/retro/`):
  - `v2_remake.py`: `retro1`~`retro8`을 v2로 바꾼 일회성 스크립트입니다. 제목, `+25%`, 간격 0.06초, 줄 빼기, 첫 구절, 각주 스티커 제거를 합니다.
  - `fetch_commons.py`: 위키미디어 공용 파일 페이지에서 라이선스를 확인하고, 썸네일러로 받아 sRGB로 변환합니다. 서울역사아카이브 스캔 중 일부가 CMYK입니다.
  - `v2_new.py`: `retro9`~`retro12`의 대본과 편집을 만듭니다.
  - `v2_seconds.py`: 사진별 화면 사용 구간(초)을 edit.json과 사이드카에 기록합니다.
  - `v2_scorecard.py`: 아래 성적표를 계산합니다.

```bash
python3 media/retro/fetch.py retro1 retro2 retro3 retro4 retro5 retro6 retro7 retro8   # 공유마당 사진 (기존)
python3 media/retro/fetch_commons.py retro9 retro10 retro11 retro12                   # 위키미디어 공용 사진 (라이선스 확인)
python3 media/retro/v2_new.py                                                           # retro9~12 script.json·edit.json
python3 voice_edge.py retro9 && python3 prep.py retro9 && python3 media/retro/v2_seconds.py retro9
./render.sh retro9 final/retro9.mp4    # 30MB가 넘으면 CRF 23으로 다시 인코딩(retro9~12는 그렇게 했습니다)
python3 qa_review.py retro9
python3 media/retro/v2_scorecard.py retro1 retro2 retro3 retro4 retro5 retro6 retro7 retro8 retro9 retro10 retro11 retro12
```

`retro9`~`retro12`는 그레인과 세밀한 사진 때문에 처음 렌더가 30MB를 넘었습니다(31~44MB). 그래서 `ffmpeg -c:v libx264 -crf 23 -preset slow -c:a copy`로 다시 인코딩했습니다(9.6~14.3MB).

### 에피소드

| id | 화면 제목 (노랑 / 흰) | 길이 | 사진 시대 | 내용 | 음악 |
| --- | --- | --- | --- | --- | --- |
| `retro1` | 요즘 키즈카페 반성해라 / 그 시절 골목 놀이 모습 | 28.0초 | 1952~1978 | 기존 대본 12줄, 마지막 국가기록원 문장을 짧게 | Heartwarming |
| `retro2` | 세탁기 없어도 끄떡없던 / 그 시절 빨래터 모습 | 28.4초 | 1952~1973 | "수로 밑", "1960년대에도" 2줄 뺌 | Gymnopedie No 1 |
| `retro3` | 트럭 없어도 다 날랐다 / 그 시절 지게꾼 모습 | 28.9초 | 1952~1967 | "큰 가구도", "쉴 땐" 2줄 뺌 | Gymnopedie No 2 |
| `retro4` | 요즘 정류장 반성해라 / 그 시절 버스 정류장 | 30.5초 | 1952~1968 | 첫 구절 "1968년 종로." | Gymnopedie No 1 |
| `retro5` | 요즘 대형마트 반성해라 / 그 시절 시장 구경 모습 | 29.2초 | 1952~1978 | "좌판", "밤 포목점" 2줄 뺌, 첫 구절 "1966년 부산." | Heartwarming |
| `retro6` | 편의점 없어도 행복했다 / 그 시절 길거리 간식 | 28.6초 | 1952~1978 | "도너츠", "1967년 번데기" 2줄 뺌 | Heartwarming |
| `retro7` | 고속열차보다 낭만 있던 / 그 시절 기차역 모습 | 29.4초 | 1952~1973 | "1952년 서울역 앞", "창밖 논밭" 2줄 뺌 | Gymnopedie No 1 |
| `retro8` | 의자 없이 땅바닥 입학식 / 그 시절 국민학교 실태 | 27.6초 | 1952~1966 | "돌담 학교", "여중생 소풍" 2줄 뺌, 첫 구절 "의자도 없이 땅바닥에." | Gymnopedie No 2 |
| `retro9` | 요즘 출근길 반성해라 / 80년대 지하철 모습 | 28.1초 | 1983~1987 | 1983년 꽃 단 2호선 개통 열차 → 시운전 노선도 → 1984년 이대역 초록 타일 터널 → 구로공단역(지금 구로디지털단지역) → 1984년 5월 2호선 48.8km 완전 개통 → 하루 230만 명 → 1986년 자동 개찰구 → 지금은 카드 "삑" → 기억나는 분? | Heartwarming |
| `retro10` | 요즘 놀이공원 반성해라 / 80년대 나들이 모습 | 27.1초 | 1984, 1989 | 1984년 5월 1일 서울대공원 개원 인파 → 공사 5년 7개월 → 코끼리 얼굴 열차 → 꼬마·엄마 아빠 → 돌아오는 길 1989년 분식집의 튀김·김밥·만두, 국밥·김치찌개 → 예약 없이 가던 시절 → 기억나는 분? | Heartwarming |
| `retro11` | 엘리베이터 없어도 살았다 / 80년대 산동네 실태 | 27.7초 | 1981, 1984, 1989 | 1981년 서울 성북구 산을 덮은 집 → 지붕 위에 지붕 → 언덕 → 1989년 부산 영도 산비탈·항구 → 1984년 남산에서 본 도심 빌딩 → 지금은 엘리베이터 → 기억나는 분? | Gymnopedie No 1 |
| `retro12` | 빌딩숲 없어도 북적였다 / 80년대 시내 모습 | 29.6초 | 1980~1995 | 1980년 광화문과 뒤의 중앙청 → 1984년 숭례문 일대 빌딩, 시청과 호텔 → 1983년 연말 남대문시장 털옷 → 1985년 상봉터미널 준공 → 1995년 부산 자갈치시장 좌판·소쿠리 → 1993년 광화문 앞 한산한 도로 → 기억나는 분? | Gymnopedie No 2 |

모든 편은 `python3 qa_review.py retro1 … retro12`에서 **WARN 0개, FAIL 0개**입니다. 베이스 브랜치에 새로 생긴 "설명글" 검사도 통과했습니다. 업로드 설명글 spec은 `upload/specs/retro1~12.json`, 생성된 설명글은 `upload/txt/retro1~12.txt`에 있습니다. 채널 이름과 핸들은 아직 `upload/channels.json`의 자리표시자입니다. 길이 27.1~30.5초, 자막 한 장 최장 12자, 소리 −13.9~−14.0 LUFS, 용량 9.6~28.6MB입니다. 각 편의 `out/review/<id>/first.png`, `last.png`, `sheet.png`를 보고 다음을 확인했습니다.

- 0초 프레임에 2줄 제목, 사람 또는 풍경, 첫 자막이 함께 보입니다.
- 마지막 장면은 첫 장면의 사진이라 루프로 이어집니다.
- 글자가 겹치거나 잘리지 않았습니다.
- 크게 보이는 상표가 없습니다(아래 참고).

### 벤치마크 성적표 (`python3 media/retro/v2_scorecard.py`)

측정 방법은 다음과 같습니다.

- 길이·첫 전환·평균/최장 샷: `final/<id>.mp4`를 `qa_review.py`와 같은 장면 감지(그림 박스, 임계값 0.12)로 쟀습니다.
- 훅 끝: 첫 내레이션 구절(첫 `|`까지)의 마지막 음절이 끝나는 시각입니다(`build/<id>/timeline.json`).
- 음절/초: 숫자를 읽는 음절까지 센 전체 발화 음절 수 ÷ 길이입니다.
- 줄 수: 내레이션 문장 수입니다.
- 제목 글자: 줄마다 셌고, 띄어쓰기는 뺐습니다.

| id | 길이 | 훅 끝 | 첫 전환 | 평균 샷 | 최장 샷 | 음절/초 | 줄 수 | 제목 글자 |
|---|---|---|---|---|---|---|---|---|
| 목표 | 28초 | ≤1.5초 | ≤2.5초 | 2.7초 | ≤4.0초 | 6.0 | ≤12 | 11/9 |
| `retro1` | 28.0초 | 1.5초 | 2.2초 | 2.2초 | 3.6초 | 6.0 | 12 | 10/9 |
| `retro2` | 28.4초 | 1.1초 | 1.5초 | 2.6초 | 3.4초 | 6.1 | 10 | 10/8 |
| `retro3` | 28.9초 | 1.3초 | 2.1초 | 2.2초 | 3.6초 | 6.0 | 10 | 9/8 |
| `retro4` | 30.5초 | 1.4초 | 2.2초 | 2.3초 | 3.5초 | 6.2 | 10 | 9/8 |
| `retro5` | 29.2초 | 1.4초 | 2.1초 | 2.7초 | 3.5초 | 6.3 | 10 | 10/9 |
| `retro6` | 28.6초 | 1.5초 | 1.5초 | 2.6초 | 3.7초 | 5.9 | 10 | 10/8 |
| `retro7` | 29.4초 | 0.7초 | 1.5초 | 2.7초 | 3.6초 | 6.4 | 9 | 10/8 |
| `retro8` | 27.6초 | 1.4초 | 1.5초 | 2.5초 | 3.3초 | 6.2 | 9 | 10/9 |
| `retro9` | 28.1초 | 1.2초 | 1.6초 | 2.3초 | 3.7초 | 6.2 | 10 | 9/9 |
| `retro10` | 27.1초 | 1.2초 | 1.6초 | 2.3초 | 3.8초 | 5.8 | 11 | 10/9 |
| `retro11` | 27.7초 | 1.1초 | 1.6초 | 2.3초 | 3.9초 | 6.2 | 11 | 11/9 |
| `retro12` | 29.6초 | 1.0초 | 1.6초 | 2.5초 | 3.6초 | 6.1 | 11 | 10/8 |

**놓친 것과 이유**

- **제목 1줄 글자 수**: 9~11자로, 목표 11자에 1~2자 모자랍니다. 짧은 도발형("요즘 ○○ 반성해라")은 띄어쓰기를 빼면 9~10자입니다. 줄당 13자 이하인 검토 기준은 모두 지킵니다.
- **`retro10` 음절/초 5.8**: 목표 6.0보다 조금 낮습니다. 사진이 두 장뿐이라 컷마다 문장을 짧게 끊었습니다.
- **`retro4` 길이 30.5초**: 목표 28초보다 2.5초 깁니다. 대본은 10문장으로 이미 짧고, 숫자(810대, 7,383대)를 읽느라 길어졌습니다.
- **벤치마크 쪽 수치는 대부분 추정입니다**: 길이·컷·음성은 측정하지 못했고(`benchmark-footage.md` 0절), 확실한 것은 레이아웃과 제목뿐입니다. 우리 쪽은 모두 실측입니다.
- **움직이는 영상은 쓰지 못했습니다** (가장 큰 차이). 1980~90년대 대한뉴스와 KTV 영상을 찾았지만 조건에 맞는 것이 없었습니다.
  - e-영상역사관: 대한뉴스·문화영화 항목 페이지(예: 대한뉴스 1602호 「여름 피서철」(1986), 1497호 「물놀이 조심」(1984))에 공공누리 표시가 없고, "공공누리가 부착되지 않은 자료는 사전에 협의"라고 나옵니다.
  - e-영상역사관 국가기록사진(해수욕장, 피서, 귀성 등 1983~1999년 26건): 모두 **공공누리 제4유형**(변경금지·상업 이용 금지)이었습니다.
  - 공유마당 영상: 1980년대 대한뉴스·KTV 영상이 없습니다(대한뉴스 검색 3건은 2000년대 이후 영상).
  - 공유마당 KTV 사진(공공누리 제1유형, wrtSn 13070800~13071799): 하나씩 열어 봤는데 모두 1950~70년대였습니다.
  - 위키미디어 공용의 대한뉴스 영상: 1953년 2건뿐입니다.
- **아이디어 목록 소재를 대부분 바꿨습니다**: 양은 도시락, 연탄, 해수욕장, 귀성길, 구멍가게, 안내양, 운동회는 쓸 수 있는 1980~90년대 사진이 거의 없었습니다.
  - 국립민속박물관의 양은도시락·연탄화덕 같은 유물 사진(공유마당, 공공누리 제1유형): 원본 이미지가 외부 서버(nfm.museum.go.kr)에 있는데, 이 환경에서 접속되지 않았습니다. 사람도 나오지 않습니다.
  - 그래서 공공누리 제1유형·CC BY 사진이 실제로 있는 소재로 정했습니다: 지하철 출근길(아이디어 7번의 출근길 실태), 놀이공원 나들이(6번), 산동네, 시내.
  - `retro10`·`retro11`은 사진이 2~3장이라, 한 사진을 여러 각도의 디테일 컷(`crop`)으로 나눴습니다. 벤치마크 ③도 한 장면을 길게 씁니다.
- **뺀 사진**:
  - 1984년 여의도 고층 빌딩 공사 사진 12장(CC BY 3.0): 위키미디어 공용이 "건축저작물, 한국 파노라마 자유는 비영리만"이라고 경고해서 뺐습니다.
  - 1988년 "John TDY" 서울 거리 사진(CC BY 2.0): 미군 출장(TDY) 사진첩이라 뺐습니다(군대 관련 배제).
  - 1990년 실내 놀이공원 간식 수레 사진(공공누리 제1유형): 수레와 냉동고에 기업 로고와 캐릭터가 커서 뺐습니다.
- **`retro1`~`retro8`의 시대**: 사진은 그대로 1950~70년대입니다. 알려진 한계입니다.

### 사진 출처와 라이선스

`retro1`~`retro8`은 기존과 같습니다. 공유마당 항목 페이지에서 라이선스 코드(`21` CC BY, `01` 공공누리 제1유형)를 `media/retro/fetch.py`로 2026-10-10에 다시 확인했습니다.

- 저작자는 한국저작권위원회(2018년 공유저작물DB수집, 부경근대사료연구소 수집)와 한국정책방송원입니다.
- v2에서 뺀 줄의 사진은 `edit.json`의 `sources`에서도 뺐습니다. 사이드카 `media/retro/retroN.json`에는 남아 있고 `used_seconds`가 `[]`입니다.

`retro9`~`retro12`는 **위키미디어 공용** 파일 페이지의 라이선스 틀을 `media/retro/fetch_commons.py`로 확인했습니다(2026-10-10). 허용한 라이선스는 KOGL Type 1, CC BY(버전 무관), CC0, 퍼블릭 도메인뿐이고, 17개 파일이 모두 통과했습니다.

| 묶음 | 라이선스 | 원 출처 |
| --- | --- | --- |
| 서울역사박물관 / 서울특별시 | 공공누리 제1유형 | 서울역사아카이브, 『선진 수도로의 도약: 1979-1983』(2018), 『세계는 서울로, 서울은 세계로: 1984-1988』(2019) |
| 후지모토 다쿠미 기증 | 공공누리 제1유형 | 국립민속박물관 민속아카이브 |
| 한국저작권위원회 | CC BY 4.0 | 공유마당 |
| 서울특별시 | CC BY 3.0 | 서울사진아카이브 (상봉터미널 1985) |

- 이미지는 이 컨테이너에서 `upload.wikimedia.org`가 429를 돌려줘서 `commons.wikimedia.org/w/thumb.php`(폭 2000px)로 받았습니다. 그다음 sRGB로 바꾸고 1600px로 줄였습니다.
- 항목별 페이지·파일 주소·라이선스·저작자·원 출처·설명·사용 구간(초)은 `media/retro/retro9~12.json`과 각 `edit.json`의 `sources`에 있습니다.
- 사람이 나오는 사진은 다음과 같이 처리했습니다.
  - 인파, 승객, 시장 손님은 모두 일상 장면입니다.
  - `retro9` 시운전 사진과 자동 개찰 사진에는 당시 서울시장과 공무원들이 있습니다. 그래서 노선도와 손잡이, 개찰구 기계만 보이게 확대해서 썼습니다.
  - `retro12` 남대문시장 사진에는 시장과 수행원이 있습니다. 오른쪽 털옷 진열만 확대해서 썼습니다.
  - 정치 인물은 이름을 말하지도 보여 주지도 않습니다.
- 간판: 분식집 간판(국밥·백반·김치찌개)과 역 이름판, 노선도 같은 일반 글자는 보입니다. 기업 로고는 크게 나오지 않습니다.
- 확인 필요: `retro9` 0초의 2호선 개통 열차 앞면에는 당시 서울지하철공사(공기업) 원형 마크가 작게 보입니다.

항목별 목록(사용한 사진, 쓴 구간):

- **retro1**: [1978년 서울 한남동 주택가 골목안 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154972&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 0–2.25, 2.25–3.59초); [1978년 서울 한남동 학교 앞 문구점 앞의 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154977&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 3.59–5.87초); [1952년 진해의 어느 공터에서 고무줄 뛰기를 하는 여자 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154364&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 5.87–9.5초); [1952년 마산의 어느골목에서 고무줄 뛰기를 하는 소녀들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154363&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 9.5–11.04초); [1952년 경남 진해 어느 마을 골목 마당에서 널뛰기를 하는 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154340&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 11.04–12.6초); [1978년 서울 한남동 골목에 모여 놀이를 하는 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154959&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 12.6–15.21초); [1968년 물방개를 황용한 뽑기놀이 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153490&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 15.21–18.2초); [주택가 길에서 축구하는 어린이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13071730&menuNo=200018) (한국정책방송원, 1973-06-08, 공공누리 제1유형 (출처표시); 18.2–19.49초); [물놀이하는 어린이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070985&menuNo=200018) (한국정책방송원, 1958-07-08, 공공누리 제1유형 (출처표시); 19.49–21.04초); [서울 시내 주택가 어린이 놀이터](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13071729&menuNo=200018) (한국정책방송원, 1973-06-08, 공공누리 제1유형 (출처표시); 21.04–22.92초); [1952년경 대구 둔산로 주변 마을 고목에서 그네 뛰는 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152472&menuNo=200018) (한국저작권위원회, 1952년경, CC BY (저작자표시); 22.92–25.29초); [1952년 부산 수영구 남천동 농가의 마당에서 노는 여자 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153791&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 25.29–27.94초)
- **retro2**: [1952년 부산 중구 보수천 하구에서 빨래를 하는 주민들_2](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153849&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 0–1.45, 1.45–2.92초); [1952년 부산 보수천 하구에서 빨래를 하는 주민들_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153772&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 2.92–6.25초); [1952년 부산 보수천 하구에서 빨래를 하는 여인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153771&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 6.25–8.83초); [1952년 부산 수영구 남천동 개울에서 아이를 업고 빨래를 하는 여인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153790&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 8.83–11.08초); [1953년 부산 외곽의 마을공동 빨래터](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153990&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 11.08–13.1초); [1952년 대구 신천 강변에서 빨래를 널거나  머리를 감고 있는 여인_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152451&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 13.1–16.02초); [1968년 서울의 어느 골목에서 빨래감을 발로 문지르고 있는 할머니](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154904&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 16.02–19.11초); [1973년 10월 충주 달천에서 빨래하는 사람들과 계명산](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154395&menuNo=200018) (한국저작권위원회, 1973년 10월, CC BY (저작자표시); 19.11–22.54초); [1953년 서울 외곽지역 정비된 하천에서 빨래하는 여인들_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154702&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 22.54–25.9초); [1953년 서울 외곽지역 정비된 하천에서 빨래하는 여인들_2](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154703&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 25.9–28.39초)
- **retro3**: [1960년 수원 용주여관앞을 지나는 지게에 세간살이를 얹고가는 사람](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153007&menuNo=200018) (한국저작권위원회, 1960년, CC BY (저작자표시); 0–2.08, 2.08–3.8, 3.8–5.19초); [1953년 부산 중구의 가구를 지게에 지고 다니며 팔러 다니는 사람과 그 뒤를 따라 가는 아가씨들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155025&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 5.19–8.78초); [1952년 부산 중구 광복로 거리의 멸치 지게 행상인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153842&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 8.78–10.04초); [1952년 대구 지겟짐에 사과를 담아 거리에서 팔고있는 참외장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152344&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 10.04–11.58초); [1952년 부산 남구 대연동 우룡산 자락 밭에서 농작물을 캐서 지게에 지고 가는 여인](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153641&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 11.58–14.3초); [1952년 부산 남구 대연동의 산에서 나무뿌리를 캐서 지게에 지고 가는 어르신](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153680&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 14.3–16.02초); [1953년 작은 지게를 진 아이](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153202&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 16.02–18.38초); [1953년 서울 영등포역 앞 역전식당과 지게꾼](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154692&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 18.38–21.06초); [1960년 6월 경기도 파주 법원리 도로의 지게에 짐을 지고 가는 사람](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153114&menuNo=200018) (한국저작권위원회, 1960년6월, CC BY (저작자표시); 21.06–23.88초); [1952년 부산 남구 감만동 주민이 빈지게를 지고 지나가는 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153603&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 23.88–26.5초); [1967년 대구거리_ 짐 운반용 지게를 진 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152680&menuNo=200018) (한국저작권위원회, 1967년, CC BY (저작자표시); 26.5–28.84초)
- **retro4**: [1968년 서울 종로5가 거리와 택시, 시내버스 모습_2](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154193&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 0–2.16, 2.16–4.18초); [1968년 서울 종로3가 거리와 택시, 시내버스 모습_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154192&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 4.18–7.01초); [1954년 7월 14일 서울 중앙청 앞 대로를 지나는 시내버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154758&menuNo=200018) (한국저작권위원회, 19919, CC BY (저작자표시); 7.01–9.41초); [1952년 대구역 앞 시영버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152535&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 9.41–12.43초); [1953년 서울 서대문구 독립문 옆 버스정류장의 사람들과 아이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154682&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 12.43–14.52초); [1953년 서울 영등포의 버스를 기다리는 어르신들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154695&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 14.52–16.66초); [1960년 3월 서울시내 한국상업은행 앞 거리와 시내버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154858&menuNo=200018) (한국저작권위원회, 1960년 3월, CC BY (저작자표시); 16.66–19.65초); [1963년 서울거리의 시내버스 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154652&menuNo=200018) (한국저작권위원회, 1963년, CC BY (저작자표시); 19.64–21.21초); [1953년 부산 부산진구 연지동의 시내버스](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155010&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 21.21–23.06초); [1959년 서울역](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154168&menuNo=200018) (한국저작권위원회, 1959년, CC BY (저작자표시); 23.06–26.6, 26.6–27.71초); [1967년 대구 거리_ 외곽지역에서 버스를 기다리는 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152653&menuNo=200018) (한국저작권위원회, 1967년, CC BY (저작자표시); 27.7–30.46초)
- **retro5**: [1966년 부산 중구 부평동 부평시장](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155112&menuNo=200018) (한국저작권위원회, 1966년, CC BY (저작자표시); 0–2.14, 2.14–4.4초); [1952년 부산 중구 부평시장의 고춧가루 노점상들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153869&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 4.41–6.2초); [1952년 부산 중구 부평동시장의 과일구루마 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153856&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 6.2–7.9초); [1952년 부산 중구 부평시장의 금붕어 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153871&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 7.9–10.31초); [1967년 대구 서문시장_어물전의 갈치장수_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152674&menuNo=200018) (한국저작권위원회, 1967년, CC BY (저작자표시); 10.31–13.66초); [1968년 자갈치시장 생선 노점상과 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153524&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 13.66–17초); [1968년 서울 남대문시장 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154179&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 17–19.83초); [1978년 서울 한남동 재래시장 입구_1](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154970&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 19.83–23.32초); [1978년 서울 한남동 재래시장 내 과일가게](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154966&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 23.32–26.49초); [1978년 서울 한남동 재래시장 내 야채 노점상들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154969&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 26.49–29.2초)
- **retro6**: [1952년 부산 중구 보수동 축대식 담벼락 아래의 뻥튀기 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153848&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 0–1.53, 1.53–3.79, 3.79–6.17초); [1952년 부산 중구 부평시장의 옥수수 모양의 풀빵 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153881&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 6.17–8.71초); [1953년 대구거리의 번데기 장수](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152591&menuNo=200018) (한국저작권위원회, 1953년, CC BY (저작자표시); 8.71–11.39초); [1952년 광주 거리의 리어카 빙수 판매점](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153161&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 11.39–15.08초); [1968년 부산_ 거리의 아이스케익 뽑기 노점](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153509&menuNo=200018) (한국저작권위원회, 1968년, CC BY (저작자표시); 15.08–18.03초); [1978년 서울 동대문시장 거리의 엿장수 엿판](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154943&menuNo=200018) (한국저작권위원회, 1978년, CC BY (저작자표시); 18.03–21.08초); [1952년 마산 어시장 인근 거리에서 사탕과 과자를 팔면서 전을 굽고있는 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154354&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 21.08–23.99초); [1952년 부산 중구 부평시장 카바이트상가 앞의 팥죽과 콩국 노점상](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153864&menuNo=200018) (한국저작권위원회, 1952년, CC BY (저작자표시); 23.99–25.86초); [1967년 대구 서문시장_엿장수, 과일 노점 등](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152677&menuNo=200018) (한국저작권위원회, 1967년, CC BY (저작자표시); 25.86–28.6초)
- **retro7**: [함백선을 질주하는 열차](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070891&menuNo=200018) (한국정책방송원, 1957, 공공누리 제1유형 (출처표시); 0–1.45, 1.45–2.9초); [함백선 개통과 함께 신축된 강원도 영월의 철도역사](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070892&menuNo=200018) (한국정책방송원, 1957, 공공누리 제1유형 (출처표시); 2.9–6.24초); [1954년 7월 14일 서울역](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154762&menuNo=200018) (한국저작권위원회, 1954, CC BY (저작자표시); 6.24–9.21초); [1953년 대구역 앞에서 차를 기다리는 사람들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152491&menuNo=200018) (한국저작권위원회, 1953, CC BY (저작자표시); 9.21–12.56초); [1952년 부산철도 공작창과 수리를 위해 있는 증기 기관차들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153930&menuNo=200018) (한국저작권위원회, 1952, CC BY (저작자표시); 12.56–15.66초); [외국에서 도입된 디젤기관차를 서울역에서 시운전중이다](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070920&menuNo=200018) (한국정책방송원, 1957, 공공누리 제1유형 (출처표시); 15.66–19.29초); [1964년 열차 안에서 촬영한 서울 한강대교](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154170&menuNo=200018) (한국저작권위원회, 1964, CC BY (저작자표시); 19.29–21.93초); [서울역 야경](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070998&menuNo=200018) (한국정책방송원, 1958, 공공누리 제1유형 (출처표시); 21.93–25.22, 25.22–26.89초); [1973년 10월 26일  청주역](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154382&menuNo=200018) (한국저작권위원회, 1973, CC BY (저작자표시); 26.89–29.33초)
- **retro8**: [1952년 부산의 야외에서 진행 중인 초등학생 입학식 모습](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13153919&menuNo=200018) (한국저작권위원회, 1952, CC BY (저작자표시); 0–1.45, 1.45–3.92, 24.92–27.56초); [남대문 초등학교의 체조시간](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070976&menuNo=200018) (한국정책방송원, 1958, 공공누리 제1유형 (출처표시); 3.92–6.51, 6.51–9.24초); [소풍나온 어린이들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13070827&menuNo=200018) (한국정책방송원, 1954, 공공누리 제1유형 (출처표시); 9.24–11.58초); [1958년 초등학교 소풍의 점심시간](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13152627&menuNo=200018) (한국저작권위원회, 1958, CC BY (저작자표시); 11.58–13.9초); [62년도 실력고사](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13071202&menuNo=200018) (한국정책방송원, 1962, 공공누리 제1유형 (출처표시); 13.9–17.02초); [1952년 진해우체국과 여학생들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13154322&menuNo=200018) (한국저작권위원회, 1952, CC BY (저작자표시); 17.02–20.09초); [1966년 부산 중구 옛 부산시청 앞을 지나는 여학생들](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13155113&menuNo=200018) (한국저작권위원회, 1966, CC BY (저작자표시); 20.09–23.41, 23.41–24.92초)
- **retro9**: [지하철 2호선 개통](https://commons.wikimedia.org/wiki/File%3A%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EA%B0%9C%ED%86%B5_%281983.12.17%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/2/20/%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EA%B0%9C%ED%86%B5_%281983.12.17%29.jpg); 서울역사박물관, 1983년, KOGL Type 1, 원 출처 서울역사아카이브; 0–1.6, 1.6–3.36, 3.36–6.05, 25.64–28.07초); [지하철 2호선 연장구간 시운전](https://commons.wikimedia.org/wiki/File%3A%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EC%97%B0%EC%9E%A5%EA%B5%AC%EA%B0%84_%EC%8B%9C%EC%9A%B4%EC%A0%84_%281983.03.19%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/6/69/%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EC%97%B0%EC%9E%A5%EA%B5%AC%EA%B0%84_%EC%8B%9C%EC%9A%B4%EC%A0%84_%281983.03.19%29.jpg); 서울특별시, 1983년, KOGL Type 1, 원 출처 『세계는 서울로, 서울은 세계로: 1984-1988』(2019); 6.05–8.52초); [이대역](https://commons.wikimedia.org/wiki/File%3A%EC%9D%B4%EB%8C%80%EC%97%AD_%281984.04.15%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/d/df/%EC%9D%B4%EB%8C%80%EC%97%AD_%281984.04.15%29.jpg); 서울역사박물관, 1984년, KOGL Type 1, 원 출처 서울역사아카이브; 8.52–10.71, 10.71–12.05초); [구로공단역](https://commons.wikimedia.org/wiki/File%3A%EA%B5%AC%EB%A1%9C%EA%B3%B5%EB%8B%A8%EC%97%AD_%281984.05.03%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/c/c1/%EA%B5%AC%EB%A1%9C%EA%B3%B5%EB%8B%A8%EC%97%AD_%281984.05.03%29.jpg); 서울역사박물관, 1984년, KOGL Type 1, 원 출처 서울역사아카이브; 12.05–14.7초); [지하철 2호선 순환열차](https://commons.wikimedia.org/wiki/File%3A%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EC%88%9C%ED%99%98%EC%97%B4%EC%B0%A8_%281984.08.07%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/3/3e/%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EC%88%9C%ED%99%98%EC%97%B4%EC%B0%A8_%281984.08.07%29.jpg); 서울역사박물관, 1984년, KOGL Type 1, 원 출처 서울역사아카이브; 14.7–18.39, 18.39–20.59, 24.12–25.64초); [지하철 역무 자동화](https://commons.wikimedia.org/wiki/File%3A%EC%A7%80%ED%95%98%EC%B2%A0_%EC%97%AD%EB%AC%B4_%EC%9E%90%EB%8F%99%ED%99%94_%281987.03.10%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/f/fd/%EC%A7%80%ED%95%98%EC%B2%A0_%EC%97%AD%EB%AC%B4_%EC%9E%90%EB%8F%99%ED%99%94_%281987.03.10%29.jpg); 서울역사박물관, 1987년, KOGL Type 1, 원 출처 서울역사아카이브; 20.59–24.12초)
- **retro10**: [서울대공원 개원.jpg](https://commons.wikimedia.org/wiki/File%3A%EC%84%9C%EC%9A%B8%EB%8C%80%EA%B3%B5%EC%9B%90_%EA%B0%9C%EC%9B%90.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/e/e8/%EC%84%9C%EC%9A%B8%EB%8C%80%EA%B3%B5%EC%9B%90_%EA%B0%9C%EC%9B%90.jpg); 서울역사아카이브, 1984년, KOGL Type 1, 원 출처 『세계는 서울로, 서울은 세계로: 1984-1988』(2019); 0–1.6, 1.6–2.45, 2.45–4.88, 4.88–6.8, 6.8–9.33, 9.33–11.99, 11.99–14.28, 22.36–24.63, 24.63–27.07초); [Bunsikjeom in Seoul](https://commons.wikimedia.org/wiki/File%3ABunsikjeom_in_Seoul_%281989%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/6/60/Bunsikjeom_in_Seoul_%281989%29.jpg); 후지모토 다쿠미, 1989년, KOGL Type 1, 원 출처 민속아카이브; 14.28–18.03, 18.03–20.87, 20.87–22.36초)
- **retro11**: [Villages in Seongbuk-gu, 1981.jpg](https://commons.wikimedia.org/wiki/File%3AVillages_in_Seongbuk-gu%2C_1981.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/9/9f/Villages_in_Seongbuk-gu%2C_1981.jpg); 후지모토 다쿠미, 1981년, KOGL Type 1, 원 출처 민속아카이브; 0–1.6, 1.6–3.33, 3.33–5.56, 5.56–7.45, 7.45–9.96, 23.09–25.15, 25.15–27.68초); [1989년 부산 남항에서 바라본 영도 영선동 산자락 주거 모습.jpg](https://commons.wikimedia.org/wiki/File%3A1989%EB%85%84_%EB%B6%80%EC%82%B0_%EB%82%A8%ED%95%AD%EC%97%90%EC%84%9C_%EB%B0%94%EB%9D%BC%EB%B3%B8_%EC%98%81%EB%8F%84_%EC%98%81%EC%84%A0%EB%8F%99_%EC%82%B0%EC%9E%90%EB%9D%BD_%EC%A3%BC%EA%B1%B0_%EB%AA%A8%EC%8A%B5.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/9/98/1989%EB%85%84_%EB%B6%80%EC%82%B0_%EB%82%A8%ED%95%AD%EC%97%90%EC%84%9C_%EB%B0%94%EB%9D%BC%EB%B3%B8_%EC%98%81%EB%8F%84_%EC%98%81%EC%84%A0%EB%8F%99_%EC%82%B0%EC%9E%90%EB%9D%BD_%EC%A3%BC%EA%B1%B0_%EB%AA%A8%EC%8A%B5.jpg); 한국저작권위원회, 1989년, CC BY 4.0, 원 출처 공유마당; 9.96–13.44, 13.44–15.48, 15.48–17.58초); [남산에서 내려다 본 1984년 서울도심 전경.jpg](https://commons.wikimedia.org/wiki/File%3A%EB%82%A8%EC%82%B0%EC%97%90%EC%84%9C_%EB%82%B4%EB%A0%A4%EB%8B%A4_%EB%B3%B8_1984%EB%85%84_%EC%84%9C%EC%9A%B8%EB%8F%84%EC%8B%AC_%EC%A0%84%EA%B2%BD.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/b/b1/%EB%82%A8%EC%82%B0%EC%97%90%EC%84%9C_%EB%82%B4%EB%A0%A4%EB%8B%A4_%EB%B3%B8_1984%EB%85%84_%EC%84%9C%EC%9A%B8%EB%8F%84%EC%8B%AC_%EC%A0%84%EA%B2%BD.jpg); 서울특별시청, 1984년, KOGL Type 1, 원 출처 서울역사아카이브 > 서울시정사진> 촬영연도별 > 1984-1988 > 남산에서 내려다 본 서울전경; 17.58–21.46, 21.46–23.09초)
- **retro12**: [서울 광화문과 중앙청](https://commons.wikimedia.org/wiki/File%3A%EC%84%9C%EC%9A%B8_%EA%B4%91%ED%99%94%EB%AC%B8%EA%B3%BC_%EC%A4%91%EC%95%99%EC%B2%AD_%281980%EB%85%84_10%EC%9B%94_14%EC%9D%BC%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/e/ea/%EC%84%9C%EC%9A%B8_%EA%B4%91%ED%99%94%EB%AC%B8%EA%B3%BC_%EC%A4%91%EC%95%99%EC%B2%AD_%281980%EB%85%84_10%EC%9B%94_14%EC%9D%BC%29.jpg); 한국저작권위원회, 1980년, CC BY 4.0, 원 출처 공유마당; 0–1.6, 1.6–2.92, 2.92–4.67, 26.91–29.63초); [숭례문 일대](https://commons.wikimedia.org/wiki/File%3A%EC%88%AD%EB%A1%80%EB%AC%B8_%EC%9D%BC%EB%8C%80_%281984.10.15%29.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/0/04/%EC%88%AD%EB%A1%80%EB%AC%B8_%EC%9D%BC%EB%8C%80_%281984.10.15%29.jpg); 서울역사박물관, 1984년, KOGL Type 1, 원 출처 서울역사아카이브; 4.67–8.18, 8.18–10.03초); [남대문 시장.jpg](https://commons.wikimedia.org/wiki/File%3A%EB%82%A8%EB%8C%80%EB%AC%B8_%EC%8B%9C%EC%9E%A5.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/4/4a/%EB%82%A8%EB%8C%80%EB%AC%B8_%EC%8B%9C%EC%9E%A5.jpg); Seoul History Archive, 1983년, KOGL Type 1, 원 출처 https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY766&type=B&upperNodeId=CTGRY770&fileSn=300&fileId=H-TRNS-97471-770; 10.03–13.59초); [Seoul Sangbong Bus Terminal 1985.JPG](https://commons.wikimedia.org/wiki/File%3ASeoul_Sangbong_Bus_Terminal_1985.JPG) ([파일](https://upload.wikimedia.org/wikipedia/commons/b/b9/Seoul_Sangbong_Bus_Terminal_1985.JPG); 서울특별시, 1985년, CC BY 3.0, 원 출처 http://photoarchives.seoul.go.kr/photo/view/70278?only=true; 13.6–16.66초); [1995년 부산 자갈치시장 수변.jpg](https://commons.wikimedia.org/wiki/File%3A1995%EB%85%84_%EB%B6%80%EC%82%B0_%EC%9E%90%EA%B0%88%EC%B9%98%EC%8B%9C%EC%9E%A5_%EC%88%98%EB%B3%80.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/4/46/1995%EB%85%84_%EB%B6%80%EC%82%B0_%EC%9E%90%EA%B0%88%EC%B9%98%EC%8B%9C%EC%9E%A5_%EC%88%98%EB%B3%80.jpg); 한국저작권위원회, 1995년, CC BY 4.0, 원 출처 공유마당; 16.66–20.21, 20.21–22.25초); [Gwanghwamun in November 1993.jpg](https://commons.wikimedia.org/wiki/File%3AGwanghwamun_in_November_1993.jpg) ([파일](https://upload.wikimedia.org/wikipedia/commons/d/d4/Gwanghwamun_in_November_1993.jpg); 후지모토 다쿠미, 1993년, KOGL Type 1, 원 출처 민속아카이브; 22.25–24.91, 24.91–26.91초)

### 사실과 출처

`retro1`~`retro8`의 사실 문장은 앞 섹션 「그 시절 레트로 쇼츠」·「그 시절 레트로 쇼츠 2」의 "사실과 출처"를 그대로 따릅니다. v2에서 남은 사실 문장과 출처는 다음과 같습니다.

| id | 남은 사실 문장 | 출처 |
| --- | --- | --- |
| `retro1` | 산업화로 놀이가 사라짐 | 국가기록원 「사진대한민국: 민속놀이」 |
| `retro2` | 세탁기는 1970년대에 늘기 시작, 2002년 말 보급률 96% | 「가전제품」 |
| `retro3` | 1956년 서울 자동차 5,335대 | 「자동차」 |
| `retro4` | 1956년 서울 버스 810대, 1959년 첫 신호등, 지금 서울 시내버스 7,383대 | 「자동차」, 서울시 교통분야 누리집 |
| `retro5` | 인터넷 장보기 | 「시장과 백화점」 |
| `retro6` | 연도만 (사진 제목) | 공유마당 사진 제목 |
| `retro7` | 2004년 KTX, 2024년 이용객 8천만 명 넘음 | e-나라지표, 국토교통부 |
| `retro8` | 1950년대 4월 학기, 1962년부터 3월, 1996년 초등학교 | 「졸업」, 「초·중·고등학교」 |

`retro9`~`retro12`의 사실 문장은 모두 각 사진의 공식 기록 설명에서 왔습니다(서울역사박물관 간행 사진집이 위키미디어 공용 파일 설명에 인용되어 있음). 사진에 보이지 않는 사연이나 가격은 넣지 않았습니다.

- `retro9`:
  - [「지하철 2호선 개통 (1983.12.17)」](https://commons.wikimedia.org/wiki/File:%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EA%B0%9C%ED%86%B5_(1983.12.17).jpg) — 『선진 수도로의 도약: 1979-1983』(서울역사박물관, 2018) 154쪽: "1983년 12월 지하철 2호선 중 교대역에서 서울대입구역 구간이 개통되었다." → "1983년 12월, 2호선 새 구간이 개통한 날".
  - [「지하철 2호선 연장구간 시운전 (1983.03.19)」](https://commons.wikimedia.org/wiki/File:%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EC%97%B0%EC%9E%A5%EA%B5%AC%EA%B0%84_%EC%8B%9C%EC%9A%B4%EC%A0%84_(1983.03.19).jpg): "미개통 구간인 서울대입구역-홍대입구역을 … 시운전하는 모습" → "개통 전엔 시운전도 했죠".
  - [「이대역 (1984.04.15)」](https://commons.wikimedia.org/wiki/File:%EC%9D%B4%EB%8C%80%EC%97%AD_(1984.04.15).jpg): "시운전 중인 지하철 2호선이 이대역을 지나고 있다."
  - [「구로공단역 (1984.05.03)」](https://commons.wikimedia.org/wiki/File:%EA%B5%AC%EB%A1%9C%EA%B3%B5%EB%8B%A8%EC%97%AD_(1984.05.03).jpg): "현재 '구로디지털단지'역이 개통 당시에는 '구로공단'역으로 표기되어 있다."
  - [「지하철 2호선 순환열차 (1984.08.07)」](https://commons.wikimedia.org/wiki/File:%EC%A7%80%ED%95%98%EC%B2%A0_2%ED%98%B8%EC%84%A0_%EC%88%9C%ED%99%98%EC%97%B4%EC%B0%A8_(1984.08.07).jpg) — 『세계는 서울로, 서울은 세계로: 1984-1988』(2019): "1984년 5월 22일 … 지하철 2호선 48.8km 전구간이 완전 개통되었다", "하루 230만 명을 수송" → "그해 5월 48.8킬로미터가 다 이어졌어요", "하루 230만 명이 지하철을 탔대요". 230만 명은 1·2호선 합계 수송 인원이라 "2호선만"이라고 말하지 않았습니다.
  - [「지하철 역무 자동화 (1987.03.10)」](https://commons.wikimedia.org/wiki/File:%EC%A7%80%ED%95%98%EC%B2%A0_%EC%97%AD%EB%AC%B4_%EC%9E%90%EB%8F%99%ED%99%94_(1987.03.10).jpg): "1986년 4월부터 승차권 발매에서 집표에 이르는 지하철 역무의 자동화가 이루어짐에 따라 자동 개찰 장치를 이용하여" → "1986년부터는 표를 넣는 자동 개찰구".
- `retro10`:
  - [「서울대공원 개원」](https://commons.wikimedia.org/wiki/File:%EC%84%9C%EC%9A%B8%EB%8C%80%EA%B3%B5%EC%9B%90_%EA%B0%9C%EC%9B%90.jpg): "1984년 5월 서울대공원이 착공 5년 7개월 만에 개원하였다. (1984.05.01)" → "1984년 5월 1일 서울대공원이 문 연 날", "공사만 5년 7개월". 코끼리 얼굴을 단 열차는 사진에 보이는 그대로입니다.
  - [「Bunsikjeom in Seoul (1989)」](https://commons.wikimedia.org/wiki/File:Bunsikjeom_in_Seoul_(1989).jpg): "서울에서 촬영한 튀김과 김밥, 만두 등을 판매하는 분식집." 국밥·김치찌개는 사진 속 간판 글자입니다.
- `retro11`: 사진 설명의 연도·장소만 썼습니다.
  - [「Villages in Seongbuk-gu, 1981」](https://commons.wikimedia.org/wiki/File:Villages_in_Seongbuk-gu,_1981.jpg): "서울 성북구에서 촬영한 마을의 가옥들"
  - [「1989년 부산 남항에서 바라본 영도 영선동 산자락 주거 모습」](https://commons.wikimedia.org/wiki/File:1989%EB%85%84_%EB%B6%80%EC%82%B0_%EB%82%A8%ED%95%AD%EC%97%90%EC%84%9C_%EB%B0%94%EB%9D%BC%EB%B3%B8_%EC%98%81%EB%8F%84_%EC%98%81%EC%84%A0%EB%8F%99_%EC%82%B0%EC%9E%90%EB%9D%BD_%EC%A3%BC%EA%B1%B0_%EB%AA%A8%EC%8A%B5.jpg)
  - [「남산에서 내려다 본 1984년 서울도심 전경」](https://commons.wikimedia.org/wiki/File:%EB%82%A8%EC%82%B0%EC%97%90%EC%84%9C_%EB%82%B4%EB%A0%A4%EB%8B%A4_%EB%B3%B8_1984%EB%85%84_%EC%84%9C%EC%9A%B8%EB%8F%84%EC%8B%AC_%EC%A0%84%EA%B2%BD.jpg)
  - "지금은 엘리베이터로 집에 올라가지만"은 숫자나 특정 장소 없이 쓴 일반 대비 문장입니다.
- `retro12`:
  - [「서울 광화문과 중앙청 (1980년 10월 14일)」](https://commons.wikimedia.org/wiki/File:%EC%84%9C%EC%9A%B8_%EA%B4%91%ED%99%94%EB%AC%B8%EA%B3%BC_%EC%A4%91%EC%95%99%EC%B2%AD_(1980%EB%85%84_10%EC%9B%94_14%EC%9D%BC).jpg)
  - [「숭례문 일대 (1984.10.15)」](https://commons.wikimedia.org/wiki/File:%EC%88%AD%EB%A1%80%EB%AC%B8_%EC%9D%BC%EB%8C%80_(1984.10.15).jpg): "오른쪽 상단에는 서울 플라자호텔, 서울시청, 프레스센터가 위치" → "시청과 호텔이 보이죠"(호텔 이름은 말하지 않음).
  - [「남대문 시장」](https://commons.wikimedia.org/wiki/File:%EB%82%A8%EB%8C%80%EB%AC%B8_%EC%8B%9C%EC%9E%A5.jpg): "(1983.12.24)" → "1983년 연말 남대문시장".
  - [「Seoul Sangbong Bus Terminal 1985」](https://commons.wikimedia.org/wiki/File:Seoul_Sangbong_Bus_Terminal_1985.JPG): "서울 상봉시외버스터미널이 준공", 1985-08-01 → "1985년엔 상봉터미널이 새로 지어졌어요".
  - [「1995년 부산 자갈치시장 수변」](https://commons.wikimedia.org/wiki/File:1995%EB%85%84_%EB%B6%80%EC%82%B0_%EC%9E%90%EA%B0%88%EC%B9%98%EC%8B%9C%EC%9E%A5_%EC%88%98%EB%B3%80.jpg)
  - [「Gwanghwamun in November 1993」](https://commons.wikimedia.org/wiki/File:Gwanghwamun_in_November_1993.jpg)
  - 중앙청 철거 같은 정치·역사 평가는 넣지 않았습니다.

### 업로드 문구

모든 편은 실제 기록 사진과 사실 문장으로 만들었습니다. 창작(허구) 장면이 없어서 "창작" 표기는 필요 없습니다.

설명란 공통 끝줄은 음악 크레딧입니다. 곡 이름은 편마다 다릅니다.

> 음악: "곡 이름" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/

공통 고정 댓글 틀: "여러분은 이 시절 ○○, 어떤 기억이 있으세요? 그때 몇 살이었는지도 댓글로 알려 주세요 👇"

**retro1** — 해 질 때까지 골목에서 놀던 그 시절, 지금은 상상도 못할 진짜 골목 놀이
> 학교만 끝나면 다 골목으로! 1952년 진해·마산의 고무줄 뛰기, 마당의 널뛰기, 1968년 물방개 뽑기 장수, 1973년 서울 주택가 찻길 축구와 놀이터, 1978년 서울 한남동 골목의 아이들까지. 국가기록원은 산업화로 많은 놀이가 우리 곁에서 사라졌다고 적었습니다(「사진대한민국: 민속놀이」). 이 시절 골목 놀이, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집), 한국정책방송원(공유마당, 공공누리 제1유형) · 크기 조정·밝기 보정·부분 확대
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #골목놀이 #옛날사진 #추억 #shorts
>
> 고정 댓글: 고무줄, 널뛰기, 물방개 뽑기… 여러분 동네에선 뭐 하고 놀았어요? 👇

**retro2** — 개울 돌 위에서 빨래 비비던 그 시절, 지금은 상상도 못할 진짜 빨래터 풍경
> 세탁기가 없던 시절, 빨래는 개울에서 했습니다. 1952년 부산 보수천, 아이를 업은 채 빨래하는 엄마, 마을 공동 빨래터, 자갈 위에 널어 말린 빨래, 1968년 서울 골목에서 발로 밟아 빨던 할머니까지. 국가기록원에 따르면 세탁기 보급은 1970년대에 들어서야 높아지기 시작했고, 2002년 말 보급률은 96%였습니다(「사진대한민국: 가전제품」). 이 시절 빨래터, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정·부분 확대
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #빨래터 #옛날사진 #추억 #shorts
>
> 고정 댓글: 개울 빨래, 방망이 소리 기억나는 분? 집에 세탁기 처음 들어온 날도 알려 주세요 👇

**retro3** — 세간살이 통째로 지게에 지고 나르던 그 시절, 다시는 볼 수 없는 진짜 지게꾼
> 1960년 수원, 등에 진 건 세간살이 통째로! 1953년 부산의 가구 지게 행상, 멸치·과일 장수, 밭에서 캔 작물과 땔감, 아이용 작은 지게까지. 1956년 서울의 자동차는 5,335대뿐이었습니다(국가기록원 「사진대한민국: 자동차」). 지금은 클릭 한 번이면 문 앞까지 오는 택배. 이 시절 지게, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정·부분 확대
> 음악: "Gymnopedie No 2" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #지게 #옛날사진 #추억 #shorts
>
> 고정 댓글: 할아버지 댁에 지게 있었던 분? 직접 져 본 분도 손! 👇

**retro4** — 한복에 양산 쓰고 버스 기다리던 그 시절, 지금은 상상도 못할 진짜 정류장
> 1968년 종로, 한복에 양산 쓰고 버스를 기다리던 풍경. 1954년 중앙청 앞 시내버스, 1952년 대구 버스, 독립문 옆 정류장의 아이들까지. 1956년 서울의 버스는 810대, 1959년엔 서울에 첫 교통신호등이 생겼습니다(국가기록원). 지금 서울 시내버스는 7,383대(서울시, 2026년 1월 기준). 이 시절 버스 정류장, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정·밝기 보정·부분 확대
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #버스정류장 #옛날서울 #추억 #shorts
>
> 고정 댓글: 처음 타 본 시내버스, 기억나세요? 그때 버스비 얼마였는지도 알려 주세요 👇

**retro5** — 엄마 손 잡고 시장 따라가던 그 시절, 요즘 마트가 못 주는 진짜 장보기 풍경
> 엄마 손 잡고 따라가던 시장, 기억나세요? 1952년 부산 부평시장의 고춧가루 노점과 과일 수레, 금붕어 장수, 1967년 대구 서문시장의 갈치, 1968년 자갈치시장과 남대문시장, 1978년 서울 한남동 시장까지. 지금은 손으로 만져 보지도 않고 인터넷으로 장을 보죠(국가기록원 「사진대한민국: 시장과 백화점」). 이 시절 시장 구경, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정·부분 확대
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #재래시장 #옛날사진 #추억 #shorts
>
> 고정 댓글: 시장 따라가면 꼭 사 달라고 조르던 거 있었죠? 뭐였어요? 👇

**retro6** — 뻥 소리에 귀 막고 기다리던 그 시절, 지금은 사라진 진짜 길거리 간식
> "뻥!" 소리에 귀부터 막던 뻥튀기, 기억나세요? 1952년 부산의 뻥튀기 장수와 옥수수 모양 풀빵, 1953년 대구의 번데기 노점, 1952년 광주 리어카 빙수, 1968년 부산 아이스케익 뽑기, 1978년 서울 엿장수 엿판까지. 이 시절 길거리 간식, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집) · 크기 조정·부분 확대
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #추억의간식 #뻥튀기 #옛날사진 #shorts
>
> 고정 댓글: 뻥튀기, 번데기, 엿… 여러분의 최애 길거리 간식은? 👇

**retro7** — 연기 뿜는 증기기관차 타던 그 시절, 다시는 볼 수 없는 진짜 기차역 풍경
> 연기 뿜으며 달리던 증기기관차, 기억나세요? 1957년 함백선 열차와 영월의 기와지붕 새 역, 1950년대 서울역과 대구역, 부산 철도공작창의 증기기관차, 1957년 서울역 디젤기관차 시운전, 1964년 열차에서 본 한강대교까지. 지금은 2004년 4월부터 KTX가 달리고, 2024년 한 해 KTX 이용객은 8,118만 명이었습니다(e-나라지표, 국토교통부). 이 시절 기차역, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집), 한국정책방송원(공유마당, 공공누리 제1유형) · 크기 조정·부분 확대
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #기차역 #증기기관차 #옛날사진 #shorts
>
> 고정 댓글: 기차 타고 처음 간 곳 어디였어요? 삶은 달걀 까먹던 기억도 👇

**retro8** — 땅바닥에 앉아 입학식 하던 그 시절, 지금은 상상도 못할 진짜 국민학교
> 의자도 없이 땅바닥에 앉아 치른 1952년 입학식, 1958년 체조 시간, 소풍날의 줄 맞춘 행렬과 점심시간, 1962년 실력고사까지. 1950년대엔 새 학년이 4월에 시작했고 1962년부터 3월로 바뀌었으며, 1941년부터 쓰던 "국민학교"라는 이름은 1996년 "초등학교"가 됐습니다(국가기록원 「사진대한민국: 졸업」). 이 시절 국민학교, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY, 부경근대사료연구소 수집), 한국정책방송원(공유마당, 공공누리 제1유형) · 크기 조정·부분 확대
> 음악: "Gymnopedie No 2" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #국민학교 #입학식 #추억 #shorts
>
> 고정 댓글: 국민학교 졸업생 손! 몇 회 졸업이세요? 👇

**retro9** — 꽃 단 열차로 2호선이 개통하던 80년대, 지금은 상상도 못할 진짜 지하철 풍경
> 1983년 12월, 꽃 장식을 단 2호선 열차가 새 구간 개통을 알렸습니다. 개통 전 시운전, 1984년 초록 타일 터널의 이대역, 지금은 구로디지털단지역이 된 구로공단역까지. 1984년 5월 22일 2호선 48.8km가 완전 개통됐고, 그 무렵 서울 지하철은 하루 230만 명을 실어 날랐습니다. 1986년 4월부터는 표를 넣는 자동 개찰구가 생겼죠(서울역사박물관 『선진 수도로의 도약: 1979-1983』, 『세계는 서울로, 서울은 세계로: 1984-1988』). 이 시절 2호선, 기억나는 분?
> 사진: 서울역사박물관·서울특별시(서울역사아카이브, 공공누리 제1유형, Wikimedia Commons) · 크기 조정·색 공간 변환·부분 확대
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #80년대 #지하철2호선 #출근길 #shorts
>
> 고정 댓글: 종이 승차권 넣고 개찰구 통과하던 기억 있으세요? 처음 탄 지하철 노선은? 👇

**retro10** — 코끼리 열차 보려고 인파가 몰리던 80년대, 다시는 볼 수 없는 진짜 나들이 풍경
> 1984년 5월 1일, 착공 5년 7개월 만에 서울대공원이 문을 열던 날의 인파(서울역사박물관 『세계는 서울로, 서울은 세계로: 1984-1988』). 코끼리 얼굴을 단 열차, 모자 쓴 꼬마와 엄마 아빠, 그리고 돌아오는 길 1989년 서울 분식집의 튀김·김밥·만두까지. 이 시절 나들이, 기억나는 분?
> 사진: 서울역사박물관(서울역사아카이브, 공공누리 제1유형), 후지모토 다쿠미 기증(국립민속박물관 민속아카이브, 공공누리 제1유형), Wikimedia Commons · 크기 조정·색 공간 변환·부분 확대
> 음악: "Heartwarming" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #80년대 #서울대공원 #나들이 #shorts
>
> 고정 댓글: 어릴 때 처음 간 동물원·놀이공원 어디였어요? 그날 먹은 것도 알려 주세요 👇

**retro11** — 산비탈 끝까지 집이 빼곡하던 80년대, 지금은 상상도 못할 진짜 산동네 풍경
> 1981년 서울 성북구, 산이 집으로 덮였던 풍경. 지붕 위에 지붕, 집 위에 또 집. 1989년 부산 영도의 산비탈 마을과 항구, 그리고 1984년 남산에서 내려다본 서울 도심까지. 이 시절 산동네, 기억나는 분?
> 사진: 후지모토 다쿠미 기증(국립민속박물관 민속아카이브, 공공누리 제1유형), 서울특별시(서울역사아카이브, 공공누리 제1유형), 한국저작권위원회(공유마당, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/), Wikimedia Commons · 크기 조정·색 공간 변환·부분 확대
> 음악: "Gymnopedie No 1" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #80년대 #산동네 #옛날사진 #shorts
>
> 고정 댓글: 언덕 위 동네 살아 본 분? 계단 몇 개였는지 기억나세요? 👇

**retro12** — 광화문 뒤에 중앙청이 서 있던 80년대, 다시는 볼 수 없는 진짜 시내 풍경
> 1980년 광화문과 그 뒤의 중앙청, 1984년 숭례문 일대와 시청 쪽 빌딩들, 1983년 연말 남대문시장의 털옷 가게, 1985년 새로 지어진 상봉시외버스터미널, 1995년 부산 자갈치시장 물가의 좌판, 1993년 한산한 광화문 앞까지. 이 시절 시내 풍경, 기억나는 분?
> 사진: 한국저작권위원회(공유마당, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/), 서울역사박물관(서울역사아카이브, 공공누리 제1유형), 서울특별시(서울사진아카이브, CC BY 3.0, https://creativecommons.org/licenses/by/3.0/), 후지모토 다쿠미 기증(국립민속박물관 민속아카이브, 공공누리 제1유형), Wikimedia Commons · 크기 조정·색 공간 변환·부분 확대
> 음악: "Gymnopedie No 2" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #그시절 #80년대 #옛날서울 #광화문 #shorts
>
> 고정 댓글: 80~90년대 시내 나가면 꼭 들르던 곳 있었죠? 어디였어요? 👇

## 역대급 랭킹 TOP5 v2 (벤치마크, `politics/top1`~`top12`)

`research/benchmark-footage.md` §3와 `research/benchmark-targets-footage.json`의 `ranking_top5`(약 25초, 5개 × 4.5–5초)에 맞춰 **top1–8을 같은 영상으로 다시 편집**하고, 같은 틀로 **top9–12를 새로 만든** 열두 편입니다. 내레이션 없음, 음악 + 예고형 자막. 순위는 편집자 선정이고 공식 순위가 아닙니다. 벤치마크 채널(랭킹김·랭킹공·랭킹각)에서는 **구조만** 따랐고, 그 채널의 영상은 한 프레임도 쓰지 않았습니다.

| id | 화면 제목 (1줄 / 2줄 / 3줄) | 길이 | 5위 → 2위 (1위는 끝까지 "???") | 음악 |
| --- | --- | --- | --- | --- |
| `top1` | 역대급 백룸 같은 공간들 / 랭킹 TOP5 / (몇 번이 제일 무서움?) | 25.6초 | 수영장 · 주차장 · 지하통로 · 쇼핑몰 (1위: 불 꺼진 병원 복도) | Dark Fog |
| `top2` | 역대급 만족스러운 순간 / 랭킹 TOP5 / (1번 제목 추천좀) | 25.6초 | 슬라임 · 케이크 · 연필심 · 물감 (1위: 키네틱 샌드 썰기) | Monkeys Spinning Monkeys |
| `top3` | 역대급 신기한 자연현상 / 랭킹 TOP5 / (몇 번이 제일 신기?ㄷㄷ) | 25.6초 | 간헐천 · 심해호수 · 오로라 · 구름바다 (1위: 킬라우에아 용암 분수) | Floating Cities |
| `top4` | 우주에서 찍힌 역대급 장면 / 랭킹 TOP5 / (1번 제목 추천좀) | 25.6초 | 번개 · 오로라 · 달그림자 · 혜성 (1위: 달 뒤로 지는 지구) | Lightless Dawn |
| `top5` | 역대급 거대한 폭포 / 랭킹 TOP5 / (몇 번이 제일 웅장?) | 25.6초 | 급류 · 나라다 · 디어크릭 · 로어폭포 (1위: 요세미티 폭포) | Heroic Age |
| `top6` | 역대급 소름 돋는 바닷속 / 랭킹 TOP5 / (몇 번이 제일 소름?) | 25.6초 | 해파리 · 가스강 · 난파선 · 굴뚝 (1위: 브림스톤 해저 분화) | Gathering Darkness |
| `top7` | 역대급 무서운 날씨 / 랭킹 TOP5 / (몇 번이 제일 무서움?) | 25.6초 | 슈퍼셀 · 홍수 · 태풍눈 · 우주태풍 (1위: EF3 토네이도) | Movement Proposition |
| `top8` | 역대급 이상한 지구 장소 / 랭킹 TOP5 / (몇 번이 제일 이상?) | 25.6초 | 균형바위 · 소금사막 · 용암호수 · 떠도는돌 (1위: 그랜드 프리즈매틱 온천) | Dreamer |
| `top9` (새) | 역대급 시원한 얼음 깨기 / 랭킹 TOP5 / (1번 제목 추천좀) | 25.6초 | 얼음낚시 · 바이칼 · 얼음투척 · 알래스카 (1위: 그린란드 빙벽 붕괴) | Exhilarate |
| `top10` (새) | 역대급 시원한 파도 / 랭킹 TOP5 / (몇 번이 제일 시원함?) | 25.6초 | LA 파도 · 방파제 · 분수구멍 · 폭풍철탑 (1위: 바위 위 돌집을 덮친 파도) | Heroic Age |
| `top11` (새) | 역대급 화산·용암 모먼트 / 랭킹 TOP5 / (몇 번이 제일 무서움?) | 25.6초 | 용암채취 · 숲 삼킴 · 도로침공 · 바다폭발 (1위: 용암호 낙석 폭발) | Gathering Darkness |
| `top12` (새) | 역대급 물에 던진 돌 / 랭킹 TOP5 / (몇 번이 제일 시원함?) | 25.6초 | 거울호수 · 진흙물 · 계곡돌 · 물왕관 (1위: 바윗덩이 물기둥) | Hustle |

```bash
npm i && ./fetch.sh
python3 media/fetch_top.py                                  # top1~top8 원본을 media/top*/의 JSON대로 다시 받음(ISS 타임랩스는 원본 사진으로 다시 만듦)
                                                            # top9~top12 원본: media/top9~12/*.json의 page_url·file_url·cut_from_original_seconds 구간(1080p, 30fps)
python3 politics/top_v2.py top9                             # politics/top9/spec.json → politics/top9/edit.json (시간 계산)
MEDIA=$PWD/media python3 politics/prep_split.py top9
./render.sh top9 final/top9.mp4                             # 30MB가 넘으면 영상만 CRF 23으로 다시 압축(오디오 복사): top11만 해당
python3 qa_review.py top9                                   # 열두 편 모두 FAIL 0, WARN 0
```

### 새 템플릿 옵션 (모두 새 옵션이라, 이 옵션이 없는 쇼츠는 전과 똑같이 렌더됩니다)

- **`src/lib/RankV2.tsx`** (새 파일)
  - `RankBand`: 3줄 띠, 높이 420px. 1줄 `title[0]`은 `rank2.color`색(기본 분홍) 86px, 2줄 `title[1]`("랭킹 TOP5")은 흰색 150px, 3줄 `rank2.sub`는 46px.
  - `RankList`: 영상 위 왼쪽(x 22, y 452~)의 순위표. 1 빨강 `#FF3B3B`, 2 주황 `#FF9A1F`, 3 노랑 `#FFE14D`, 4–5 흰색. 이름은 그 순위가 시작될 때 채워집니다. `rank2.hide`(기본 `[1]`)의 순위는 **끝까지 "???"**입니다. 지금 순위는 그 색 테두리 + 어두운 바탕으로 켜지고, 시작할 때 0.35초 튀어 오릅니다(0초 썸네일 프레임에서는 튀지 않음).
  - `BoxCaptions`: 검정 상자 위 흰 글씨 자막(최대 76px, `captionY` 기본 1640). **0초에 시작하는 자막은 등장 애니메이션 없이 첫 프레임부터 떠 있습니다**(썸네일).
  - `TALL`: 새 화면 틀 `"frame": "tall"` = 띠 아래 전부(y 420~1920, 1080×1500). 아래 23%의 빈 회색 칸이 없어집니다.
- **`src/ClipShort.tsx`** (작은 연결만): `ShortData.rank2`, 프레임 종류 `"tall"`, 그리고 `rank2`가 있을 때만 `Title`→`RankBand`, `Ranks`→`RankList`, `Captions`→`BoxCaptions`로 바꾸는 세 줄.
- **`politics/prep_split.py`** (한 단어): edit.json의 `rank2`를 데이터로 넘깁니다. 설명은 파일 머리말에 있습니다.
- **`politics/top_v2.py`** (새 파일): `politics/<id>/spec.json`(제목·3줄·색·음악·순위별 라벨·자막·샷)으로 edit.json을 씁니다. 5위→1위로 샷을 이어 붙이고, 샷마다 자막 1장(첫 자막 0초), 순위가 바뀔 때 `whoosh`, `"tail": 0`(1위가 끝나면 바로 5위로 루프), `"flash": false`, `"credit": ""`(출처 배지는 화면에서 빼고 설명란으로), 원본 소리 끔, `sources`에 쓴 구간을 채웁니다.
- **`media/fetch_top.py`** (새 파일): top1–8 원본 40개를 각 JSON대로 다시 만듭니다(Flickr 링크는 페이지의 secret으로, Commons 429는 재시도).
- 회귀 확인: 손대지 않은 `doodle1`(프레임 200·1000)과 **예전 top5 edit.json**(밴드 + 아래 순위표 경로, 프레임 0·150·600·1050)을 바뀌기 전·후 코드로 렌더해 픽셀 비교 → 모두 **차이 없음**.

edit.json 예:
```json
"titleStyle": "band", "title": ["역대급 시원한 얼음 깨기", "랭킹 TOP5"], "credit": "", "flash": false, "tail": 0, "captionY": 1640,
"rank2": {"sub": "(1번 제목 추천좀)", "color": "#FF5FA2", "hide": [1]},
"segments": [{"src": "top9/x.mp4", "in": 1.0, "out": 3.3, "frame": "tall", "single": [0.62, 0.5, 1.0], "audio": 0, "rank": {"n": 5, "label": "얼음낚시"}}, …],
"lines": [{"who": 0, "t": 0.0, "tend": 2.3, "ko": "얼음에 구멍 뚫는데.."}, …]
```

### 벤치마크 점수표

목표는 `benchmark-targets-footage.json`의 `ranking_top5`: 길이 25초 · 훅 끝 0초(첫 자막이 0초에 떠 있음) · 첫 전환 ≤2.5초 · 평균 샷 2.4초 · 최장 샷 3.5초 · 음절/초 0(내레이션 없음) · 자막 7장 · 제목 줄당 [10, 7, 12]자.
우리 값: 길이·LUFS·용량은 렌더본(ffprobe, `qa_review.py`), 샷은 편집 목록(edit.json 세그먼트 = 실제 컷), 괄호 안은 `qa_review.py` 장면 감지 값(영상 속 움직임까지 컷으로 셈).

| id | 길이 | 첫 자막 | 첫 전환 | 평균 샷 (감지) | 최장 샷 | 음절/초 | 자막 장 수 (최장) | 제목 줄당 글자 | 결과 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| top1 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (10자) | 10 / 6 / 8 | FAIL 0 WARN 0, 17.5MB |
| top2 | 25.6 | 0.0초 | 2.3 | 2.33 (2.1) | 2.8 | 0 | 10 (9자) | 10 / 6 / 7 | FAIL 0 WARN 0, 18.1MB |
| top3 | 25.6 | 0.0초 | 2.3 | 2.33 (2.1) | 2.8 | 0 | 10 (10자) | 10 / 6 / 7 | FAIL 0 WARN 0, 20.1MB |
| top4 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (9자) | 11 / 6 / 7 | FAIL 0 WARN 0, 25.6MB |
| top5 | 25.6 | 0.0초 | 2.3 | 2.33 (1.8) | 2.8 | 0 | 10 (10자) | 8 / 6 / 7 | FAIL 0 WARN 0, 28.2MB |
| top6 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (10자) | 10 / 6 / 7 | FAIL 0 WARN 0, 27.5MB |
| top7 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (10자) | 8 / 6 / 8 | FAIL 0 WARN 0, 18.9MB |
| top8 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (9자) | 10 / 6 / 7 | FAIL 0 WARN 0, 22.6MB |
| top9 | 25.6 | 0.0초 | 2.3 (감지 0.3) | 2.33 (1.8) | 2.8 | 0 | 10 (8자) | 10 / 6 / 7 | FAIL 0 WARN 0, 14.0MB |
| top10 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (8자) | 8 / 6 / 8 | FAIL 0 WARN 0, 12.9MB |
| top11 | 25.6 | 0.0초 | 2.3 | 2.33 (1.7) | 2.8 | 0 | 10 (8자) | 10 / 6 / 8 | FAIL 0 WARN 0, 15.9MB |
| top12 | 25.6 | 0.0초 | 2.3 | 2.33 (2.3) | 2.8 | 0 | 10 (8자) | 8 / 6 / 8 | FAIL 0 WARN 0, 17.7MB |

이전 판(top1–8)과 비교: 34.6–37.4초 → 25.6초, 항목당 약 7초 → 5.1초(5위 2.3+2.8, 4–2위 2.5+2.6, 1위 1.8+1.7+1.7), 첫 전환 3.4 → 2.3초, 최장 샷 4.0 → 2.8초.

**빗나간 것과 이유**
- **길이 25.6초(목표 25초)**: `qa_review.py`의 길이 통과선이 25초 이상이라 0.6초 여유를 두었습니다(벤치마크 범위 22–25초, 레시피 23–26초 안).
- **자막 10장(목표 7장)**: 레시피의 "항목당 1–2장"을 5개 항목 모두에 2장씩 적용했습니다(설정 1장 + 결과 1장). 7은 벤치마크 평균 추정값입니다. 1위의 세 번째 샷에는 새 자막을 넣지 않고 두 번째 자막을 이어 띄웁니다.
- **제목 2줄 6자(목표 7자)**: 우리는 TOP5라 "랭킹 TOP5"(벤치마크는 "랭킹 TOP7"과 같은 형식, 숫자만 다름). 3줄은 7–8자로 목표 12자보다 짧습니다. 벤치마크의 "(다들 몇 번이 제일 웃김?ㅋㅋㅋ)"처럼 길게 쓰면 46px에서 너무 작아져서입니다.
- **감지된 평균 샷이 짧은 편(top5·9·11 1.7–1.8초)**: 편집 컷은 똑같이 11개이고, 장면 감지가 화면 속 큰 움직임(물보라, 폭발 섬광, 얼음 구멍 드릴)을 컷으로 더 센 것입니다. top9의 "첫 전환 0.3초"도 드릴이 돌며 화면이 크게 변한 것을 감지한 값이고, 실제 첫 컷은 2.3초입니다.
- **피사체**: 벤치마크는 사람·동물의 반응이 중심입니다. 우리는 얼굴 금지 규칙 때문에 손·뒷모습·실루엣만 썼습니다(top2·9·11·12). top1·3–8은 기존 영상이라 "결과가 있는 순간"이 약한 장면(정지에 가까운 풍경)이 남아 있어, 자막을 예고형으로 바꿔 보완했습니다.

### 영상과 라이선스 (원본 페이지·파일 주소·크레딧·쓴 구간: `media/top*/*.json`의 `used_in`(`"version": "v2"`), 각 `edit.json`의 `sources.used_seconds`)

- **top1–8**: 영상과 라이선스는 위의 「역대급 랭킹 TOP5 쇼츠」·「역대급 랭킹 TOP5 쇼츠 2」 절과 같습니다(같은 클립, 쓴 구간만 바뀜). v2에서는 화면 출처 배지를 없애고 크레딧을 모두 설명란(아래 업로드 문구)에 넣었습니다.
- **top9** (얼음 깨기)
  - Pexels License (각 영상 페이지 "Free" → https://www.pexels.com/license/ 확인): [6831069](https://www.pexels.com/video/man-opening-a-hole-in-the-ice-6831069/) Tima Miroshnichenko (얼음 드릴, 1.0–3.3·7.2–10.0초) · [4434241](https://www.pexels.com/video/ice-breaking-4434241/) Yaroslav Shuraev (바이칼 얼음 찍기, 0.4–2.9·3.2–5.8초) · [7128251](https://www.pexels.com/video/man-breaking-ice-7128251/) Nadezhda Moryak (역광 실루엣이 얼음판을 던짐, 0.3–2.8·2.7–5.3초) · [28988888](https://www.pexels.com/video/dramatic-arctic-iceberg-collapse-in-greenland-28988888/) Cristian Manieri (그린란드 빙벽 붕괴, 6.0–7.8·8.2–9.9·10.2–11.9초)
  - **CC BY 2.0**: [Margerie Glacier calving video](https://commons.wikimedia.org/wiki/File:Margerie_Glacier_calving_video.webm) gails_pictures (Flickr, Wikimedia Commons 경유; 파일은 Commons가 인용한 Flickr 원본), 0.0–2.5·2.4–5.0초, 잘라내고 확대함
  - (쓰기 쉬운 미국 기관 빙하 영상은 해설이 섞인 480p 이하 프로그램뿐이라 쓰지 않았습니다. Pixabay의 빙하 붕괴 결과는 AI 생성물이라 뺐습니다.)
- **top10** (파도) — 모두 Pexels License: [20363746](https://www.pexels.com/video/massive-ocean-wave-on-california-los-angeles-coast-beach-20363746/) Joshua Woroniecki (3.6–5.9·7.8–10.6초) · [15876185](https://www.pexels.com/video/a-large-wave-crashes-into-the-rocks-at-the-end-of-a-pier-15876185/) Guidance Pillar Production (0.4–2.9·3.0–5.6초) · [32379563](https://www.pexels.com/video/dramatic-coastal-blowholes-and-ocean-waves-32379563/) FUNESMA79 (2.0–4.5·9.3–11.9초; 원본 1–7초 왼쪽 끝의 아주 작은 두 사람은 크롭 밖) · [34490216](https://www.pexels.com/video/dramatic-storm-waves-crashing-on-coastal-tower-34490216/) AP Vibes (0.5–3.0·3.0–5.6초) · [32091837](https://www.pexels.com/video/dramatic-ocean-waves-crashing-on-rocks-32091837/) pippu (1.8–3.6·4.5–6.2·8.3–10.0초)
- **top11** (화산·용암) — 모두 **미국 지질조사국(USGS) Hawaiian Volcano Observatory, 퍼블릭 도메인**(각 페이지 "Sources/Usage: Public Domain."): [용암 채취 2023.6.22](https://www.usgs.gov/media/videos/lava-sampling-halemaumau-june-22-2023) (4.8–7.1·10.2–13.0초; 주황 작업복의 뒷모습·다리·장갑 낀 손만, 얼굴 없음) · [식생을 태우는 용암 끝 2016.6.29](https://www.usgs.gov/media/videos/flow-front-moving-through-vegetation) (2.0–4.5·9.0–11.6초) · [카우필리 거리의 용암 2018.5.24](https://www.usgs.gov/media/videos/kilauea-volcano-pahoehoe-flows-kaupili-street) (0.0–2.5·6.0–8.6초) · [푸히오칼라이키니 해안 폭발 2010.9.28](https://www.usgs.gov/media/videos/successive-littoral-explosions-puhi-o-kalaikini-ocean-entry) (0.0–2.5·3.8–6.4초) · [할레마우마우 대형 낙석 2016.1.8](https://www.usgs.gov/media/videos/large-rockfall-halemaumau-crater) (0.0–1.8·2.0–3.7·5.0–6.7초). 모서리의 USGS 표시와 웹캠 시각 표시는 크롭 밖으로 뺐습니다.
- **top12** (물에 던진 돌) — 모두 Pexels License: [12279967](https://www.pexels.com/video/stones-falling-into-a-lake-in-a-mountain-landscape-12279967/) Marsel Sharipov (2.6–4.9·4.9–7.7초) · [34666821](https://www.pexels.com/video/rippling-water-surface-with-stone-splash-34666821/) Jack And Matt Photography (0.3–2.8·2.8–5.4초) · [4174020](https://www.pexels.com/video/slow-motion-of-rocks-falling-to-the-water-4174020/) K (@kelly) (1.6–4.1·6.3–8.9초) · [13723991](https://www.pexels.com/video/stone-falling-into-lake-13723991/) Marsel Sharipov (2.45–4.95·4.0–6.6초, 두 번째 샷은 확대 다시보기) · [4510319](https://www.pexels.com/video/throwing-big-rock-on-water-4510319/) Martina Tomšič (1.4–3.2·3.2–4.9·6.4–8.1초)
- 예비 클립(편집에는 안 씀)도 같은 형식의 JSON이 `media/top9~12/`에 있습니다.
- 음악: "Dark Fog", "Monkeys Spinning Monkeys", "Floating Cities", "Lightless Dawn", "Heroic Age", "Gathering Darkness", "Movement Proposition", "Dreamer", "Exhilarate", "Hustle" Kevin MacLeod (incompetech.com), CC BY 4.0

### 자막 속 사실과 출처

- top1–8: 위 두 절의 「자막 속 사실과 출처」와 같습니다(91m 간헐천, 바닷물보다 최대 8배 짠 브라인 풀, 400m 이상(추정) 용암 분수, 23m·51m·53m·94m·740m 폭포, 수심 700m 해파리, 19세기 범선, 500년 만의 홍수, 시속 233km 밀턴, 시속 257km(추정) EF3 토네이도, 39m 균형 바위, 해수면보다 86m 낮은 배드워터). v2에서 새로 넣은 숫자는 없습니다. top4 3위 "달 그림자였음??"은 NASA 페이지의 2012.5.20 금환일식 설명 그대로입니다.
- top9 2위 "높이 61m 얼음벽": 마저리 빙하는 "폭 약 0.85마일, 얼음 벽 높이는 수면 위 약 200피트" — [NPS Glacier Bay](https://www.nps.gov/glba/learn/nature/overview-of-selected-glaciers-in-glacier-bay.htm) (200피트 ≈ 61m). 나머지 top9 자막에는 숫자가 없습니다(그린란드 영상은 Pexels 설명 "Greenland iceberg"만 있음).
- top11 4위 "나무가 그대로 불탐": "The leading tip of the flow is burning vegetation in a kīpuka." — [USGS](https://www.usgs.gov/media/videos/flow-front-moving-through-vegetation)
- top11 3위 "아스팔트까지 불탐": "Burning asphalt created the black smoke seen in the video…" — [USGS](https://www.usgs.gov/media/videos/kilauea-volcano-pahoehoe-flows-kaupili-street)
- top11 2위 "돌이 20m 치솟음": "The explosions were throwing ejecta up to about 20 meters." — [USGS](https://www.usgs.gov/media/videos/successive-littoral-explosions-puhi-o-kalaikini-ocean-entry)
- top11 1위 "카메라까지 날아옴": 낙석 폭발이 "용암호 수면보다 약 110m 위인 분화구 가장자리까지 빛나는 파편을 던졌고 … 파편이 USGS HVO 웹캠 쪽으로 날아온다" — [USGS](https://www.usgs.gov/media/videos/large-rockfall-halemaumau-crater)
- top10·top12는 사실 주장이 없는 예고형 자막뿐입니다("LA 파도"는 Pexels 페이지 제목의 "California Los Angeles Coast", top10 1위 "돌집"은 화면에 보이는 바위 위 작은 돌 구조물을 부른 말).

### 업로드 문구

공통: 고정 댓글은 **"1번 제목 지어주세요 👇 제일 웃긴 제목 고정합니다"** (top2·4·9) 또는 아래 각 편의 질문. 설명란 첫 줄에 1위 이름은 쓰지 않습니다(댓글용).

**top1** — 역대급 백룸 같은 공간들 랭킹 TOP5 ㄷㄷ
> 밤 9시 반 텅 빈 수영장, 차 한 대 없는 지하주차장, 끝없이 내려가는 지하통로, 불이 깜빡이는 쇼핑몰 복도… 그리고 1위는? 다들 몇 번이 제일 무서움? 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — Tima Miroshnichenko, gusat silviu, Yunus Kılıç, Matthias Groeneveld, SN.CHE
> 음악: "Dark Fog" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #백룸 #리미널스페이스 #랭킹 #소름 #shorts
> 고정 댓글: 1번 장소 이름 지어주세요 👇 여기 혼자 갈 수 있는 사람?

**top2** — 역대급 만족스러운 순간 랭킹 TOP5 ㅋㅋ
> 구슬 슬라임, 와르르 무너지는 초코 케이크, 하트가 나오는 연필심, 줄줄 흘러내리는 물감… 1위는 직접 보세요. 1번 제목 추천받습니다! 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — cottonbro studio, Taryn Elliott, Vũ Vũ, Mike Murray · Pixabay — u_5l867xgjyb
> 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #만족 #ASMR #랭킹 #힐링 #shorts
> 고정 댓글: 1번 제목 지어주세요 👇 제일 웃긴 제목 고정합니다

**top3** — 역대급 신기한 자연현상 랭킹 TOP5 ㄷㄷ
> 91m 넘게 솟는 간헐천, 바다 밑바닥의 호수, 하늘에서 춤추는 오로라, 구름 바다에 잠긴 그랜드캐니언, 그리고 1위는 땅이 갈라지며 솟은 그것(최고 400m 이상 추정). 다들 몇 번이 제일 신기해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) — Jacob W. Frank, M. Quinn · 미국 해양대기청(NOAA Ocean Exploration) · 미국 지질조사국(USGS) — M. Patrick (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Floating Cities" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #자연현상 #신기한영상 #랭킹 #오로라 #shorts
> 고정 댓글: 이 중에 직접 보고 싶은 거 몇 번?

**top4** — 우주에서 찍힌 역대급 장면 랭킹 TOP5 ㄷㄷ
> 구름 속 번개, 발밑에 깔린 오로라, 구름 위 검은 얼룩의 정체(2012년 금환일식 달 그림자), 지평선 위로 떠오른 혜성… 그리고 1위는 2026년 아르테미스 2호에서 찍힌 그 장면. 전부 실제 NASA 사진·영상입니다. 1번 제목 추천좀!
> 영상·사진: NASA (ISS Crew Earth Observations, Image Science & Analysis Laboratory, NASA Johnson Space Center · Artemis II) (NASA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #우주 #NASA #랭킹 #지구 #shorts
> 고정 댓글: 1번 제목 지어주세요 👇 제일 웃긴 제목 고정합니다

**top5** — 역대급 거대한 폭포 랭킹 TOP5 ㄷㄷ
> 1마일 안에 23m를 떨어지는 급류, 높이 51m 나라다 폭포, 붉은 협곡의 53m 디어크릭 폭포, 낙차 94m 옐로스톤 로어 폭포, 그리고 1위는 세 단 합쳐 740m. 다들 몇 번이 제일 웅장해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: 미국 국립공원관리청(NPS) — Jacob W. Frank, Blum·Well·Wang·Estrada·Caldon · Yosemite Falls: G. Edward Johnson / CC BY 4.0 (Wikimedia Commons, 잘라내고 확대함) (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Heroic Age" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #폭포 #대자연 #랭킹 #옐로스톤 #shorts
> 고정 댓글: 1위 폭포 이름 아는 사람? 👇

**top6** — 역대급 소름 돋는 바닷속 랭킹 TOP5 ㄷㄷ
> 수심 700m의 핏빛 해파리, 바위 밑을 흐르는 은빛 가스의 강, 어둠 속 19세기 범선 난파선, 검은 연기를 뿜는 바다 밑 굴뚝, 그리고 1위는 사람이 처음 목격한 그 장면. 전부 실제 탐사 영상입니다. 다들 몇 번이 제일 소름?
> 영상: 미국 해양대기청(NOAA Ocean Exploration, NOAA/PMEL) (NOAA가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #심해 #바다 #소름 #랭킹 #shorts
> 고정 댓글: 바닷속 들어갈 수 있다면 몇 번 보러 감?

**top7** — 역대급 무서운 날씨 랭킹 TOP5 ㄷㄷ
> 하늘이 통째로 도는 슈퍼셀, 2022년 옐로스톤 500년 만의 홍수, 허리케인 눈 속의 파란 하늘, 우주에서 본 시속 233km 허리케인, 그리고 1위는 최대 시속 257km(추정)의 그것(인명 피해 없음). 다들 몇 번이 제일 무서워요?
> 영상: 미국 해양대기청(NOAA/NSSL — Matthew Woods, Sean Waugh · NOAA Hurricane Hunters — Nick Underwood) · 미국 국립공원관리청(NPS — Chase Tedder) · NASA (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #날씨 #토네이도 #허리케인 #랭킹 #shorts
> 고정 댓글: 이 중에 실제로 겪어본 거 있음?

**top8** — 역대급 이상한 지구 장소 랭킹 TOP5 ㄷㄷ
> 안 떨어지는 39m 균형 바위, 바다보다 86m 낮은 소금 사막, 화산 속에서 출렁이는 용암 호수, 돌이 혼자 움직인 흔적, 그리고 1위는 땅 위의 무지개 웅덩이. 전부 실제 미국 국립공원에 있는 장소입니다. 다들 몇 번이 제일 이상해요?
> 영상: 미국 국립공원관리청(NPS) — Neal Herbert, Jacob W. Frank · 미국 지질조사국(USGS) (각 기관이 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Dreamer" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #신기한장소 #국립공원 #랭킹 #여행 #shorts
> 고정 댓글: 1위 장소 이름 맞히는 사람? 👇

**top9** — 역대급 시원한 얼음 깨기 랭킹 TOP5 ㄷㄷ
> 얼음 구멍에서 물이 콸콸, 바이칼 얼음판이 거미줄처럼 쩍쩍, 던진 얼음판이 산산조각, 높이 61m 알래스카 빙하 벽이 와르르… 1위는 직접 보세요. 1번 제목 추천좀! 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — Tima Miroshnichenko, Yaroslav Shuraev, Nadezhda Moryak, Cristian Manieri · "Margerie Glacier calving video" gails_pictures / CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/, Wikimedia Commons, 잘라내고 확대함) · 빙하 높이: 미국 국립공원관리청(NPS) Glacier Bay
> 음악: "Exhilarate" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #얼음 #빙하 #시원한영상 #랭킹 #shorts
> 고정 댓글: 1번 제목 지어주세요 👇 제일 웃긴 제목 고정합니다

**top10** — 역대급 시원한 파도 랭킹 TOP5 ㄷㄷ
> 집채만 한 LA 파도, 방파제 끝에서 폭발하는 파도, 바위 틈에서 솟는 물기둥, 폭풍 속 철탑을 삼킨 파도… 1위는 바위 위 돌집을 통째로? 다들 몇 번이 제일 시원해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — Joshua Woroniecki, Guidance Pillar Production, FUNESMA79, AP Vibes, pippu
> 음악: "Heroic Age" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #파도 #바다 #시원한영상 #랭킹 #shorts
> 고정 댓글: 1위 제목 지어주세요 👇 몇 번이 제일 시원했음?

**top11** — 역대급 화산·용암 모먼트 랭킹 TOP5 ㄷㄷ
> 용암을 망치로 퍼 올리는 과학자, 숲을 태우며 밀려오는 용암, 아스팔트까지 태운 도로 위 용암, 바다를 만나 20m 치솟은 돌… 그리고 1위는 카메라까지 날아온 그것. 전부 하와이 화산관측소의 실제 영상입니다. 다들 몇 번이 제일 무서워요?
> 영상: 미국 지질조사국(USGS) Hawaiian Volcano Observatory (USGS가 이 영상을 보증하거나 후원하지 않습니다.)
> 음악: "Gathering Darkness" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #화산 #용암 #하와이 #랭킹 #shorts
> 고정 댓글: 1위 이름 지어주세요 👇 몇 번이 제일 무서웠음?

**top12** — 역대급 물에 던진 돌 랭킹 TOP5 ㅋㅋ
> 거울 호수가 깨지는 순간, 진흙 폭탄, 계곡 물기둥, 물 왕관… 1위는 바윗덩이 하나로 물이 하늘까지? 다들 몇 번이 제일 시원해요? 순위는 저희 마음대로 고른 것입니다.
> 영상: Pexels — Marsel Sharipov, Jack And Matt Photography, K (@kelly), Martina Tomšič
> 음악: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
> #돌던지기 #물튀김 #시원한영상 #랭킹 #shorts
> 고정 댓글: 1번 제목 지어주세요 👇

창작: 열두 편 모두 실제 영상이고 지어낸 이야기는 없어 "창작" 표시는 필요 없습니다. 자막 중 "~했는데.."·"~??"는 다음 장면을 예고하는 말투일 뿐 사실 주장이 아닙니다.
## 2D 운전 애니 무언 해외판 (벤치마크, `drive1`~`drive10`)

`research/benchmark-drawn.md` 2절과 `research/benchmark-targets-drawn.json`의 `road` 목표(알룔료 R1 3,201만·R2 2,865만·R3 2,601만)를 그대로 따른 **말 없는 해외판** 10편이다. 내레이션과 자막이 없고, 9:16 화면 가운데 16:9 그림, 위 검정 칸에 흰 한국어 제목 한 줄, 아래 검정 칸에 영어 한 줄이 처음부터 끝까지 있다. 운전자 얼굴 클로즈업(그림 높이의 약 70%)과 3D 차 장면(3/4 뒤·옆·앞·위)을 1.5~2초마다 번갈아 자르고, 효과음(경적·엔진·타이어·둥둥·사이렌)과 음악만으로 진행한다. 결말은 모두 자업자득이다(출구를 놓침, 맨 뒤 줄, 트럭 뒤에 갇힘, 단속 카메라, 경찰에 갓길로). 사고·부상·주인공의 보복은 없고, 주인공은 거리를 두거나 비켜 주거나 깜빡이를 켠다. `drive1`~`drive6`은 보고서 아이디어 목록의 새 편이고, `drive7`~`drive10`은 기존 `road1`·`road2`·`road8`·`road9`의 무언판이다(`road1`~`road10`은 그대로 둠).

- **그림·소리**: 전부 직접 그린 것(코드로 그림)과 numpy 합성음이다. 외부 사진·영상이 없어서 `sources`는 비어 있고 화면 크레딧도 없다. 실제 차종·로고·번호판·상표·사람은 없다. 화면의 글자는 제목 두 줄과 표지판 숫자("1km", "32km", "100", "30")뿐이다.
- **같은 틀**: 주인공은 노란 후드(`HERO`) 또는 분홍 옷(`HEROINE`)에 파란 차(`#4DA3FF`), 경찰은 남색 모자·콧수염(`COP`), 트럭 기사는 초록 모자·수염(`TRUCKER`). 악역은 편마다 바뀐다. 컷 순서는 0초 얼굴(썸네일) → 차 장면 → 얼굴 반응 → … → "둥둥"과 붉은 테두리 → 악역 우는 얼굴.
- **무언판으로 고른 기존 4편과 이유**: `road1`(1차로 정속), `road2`(깜빡이 없이 끼어들기), `road8`(갓길 주행), `road9`(상향등·바짝 붙기)는 고속도로 한 곳에서 일어나고, 세계 어디서나 같은 빌런이며, 원래 결말(경찰이 갓길로 세움, 갓길 끝의 경찰차, 앞차가 경찰)이 그림만으로 통쾌하다. `road3`(빨간불 우회전)·`road4`(스쿨존 범칙금 구간)·`road7`(휴대폰 예외)·`road10`(버스전용차로 인원)·`road5`(터널 실선)는 한국 법 조문을 말로 설명해야 이해되고, `road6`(꼬리물기)은 교차로 장면이 필요해서 뺐다.
- **보복운전 없음**: 주인공은 경적을 울리지 않고(1편의 경적은 악역), 막아서지 않는다. 9편 주인공은 갓길 차를 막지 않고, 8편 주인공은 마지막에 깜빡이를 켜고 들어간다.

```bash
python3 drive_eps.py                          # 장면 목록 → shorts/drive*/edit.json, script.json (내레이션 없음)
python3 voice_edge.py drive1 && python3 prep.py drive1 && ./render.sh drive1 final/drive1.mp4 && python3 qa_review.py drive1
```
`voice_edge.py`는 대사 줄이 없으면 음성을 만들지 않고 길이(`tail`)만 적는다. `drive7`은 렌더 뒤 −12.7 LUFS(WARN)라서 영상은 그대로 두고 소리만 −1.3dB 다시 인코딩했다(−14.0 LUFS).

### 새 템플릿 옵션 (모두 새 값이라 기존 쇼츠는 그대로)

| 파일 | 바뀐 것 |
|---|---|
| `src/lib/Drive.tsx` (새 파일) | `road` 그래픽의 새 시점 `view: "face"`(운전석 얼굴 클로즈업)와 `view: "car"`(작은 3D 장면). 1920×1080 무대를 클립 칸에 맞춰 줄인다(`"frame": "wide"`면 1080×608 = 16:9) |
| `src/lib/DriveFace.tsx` (새 파일) | 운전자 얼굴(머리·어깨) 17가지 표정, 머리 모양 8가지, 선글라스·안경, 콧수염·수염, 표정 타임라인. 기호(`!`, `?`, `?!`, 분노, 땀, 음표)와 경적 폭발 그림(글자 없음) |
| `src/lib/Bilingual.tsx` (새 파일) | `titleEn`이 있으면 쓰는 제목: 그림 위 검정 칸에 흰 한국어(Pretendard 800), 그림 아래 검정 칸에 영어 |
| `src/lib/Road.tsx` | `view`가 `"face"`/`"car"`면 `Drive`로 넘기는 한 줄(+ 타입에 두 값) |
| `src/ClipShort.tsx` | `ShortData.titleEn` 타입과 `Title` 첫 줄의 분기 한 줄 |
| `prep.py` | `titleEn`을 데이터로 넘김. 음성이 하나도 없으면 더킹 정규화를 건너뜀(빈 배열의 percentile 오류 방지, 음성이 있으면 같은 계산) |
| `drive_sfx.py` (새 파일), `fetch.sh` 한 줄 | `engine.wav`(엔진 부앙), `squeal.wav`(타이어 끼익), `dundun.wav`(둥둥) 합성. 경적·사이렌은 기존 `road_sfx.py` |
| `drive_eps.py` (새 파일) | 10편의 장면 목록과 `edit.json`/`script.json` 생성기 |

**쓰는 법** (`edit.json`): `"titleStyle": "band"`, `"titleEn": "English line"`, 각 클립 `"frame": "wide"`, `"gfx": {"type": "road", "view": "face" | "car", ...}`. 시간 값은 모두 **그 클립이 시작한 뒤 초**다(`steps` 안 씀). `script.json`은 `"lines": []`, `"tail"`이 전체 길이.

| 값 | 쓰임 |
|---|---|
| 공통 `zoom` `shake` `dun` `flash` `streaks` `time` | 천천히 다가감(`[from,to]`), 흔들림, "둥둥"(살짝 줌 + 어두운 붉은 테두리), 흰 번쩍(단속 카메라), 집중선 `[t0,t1]`, `"night"`/`"dusk"` |
| 공통 `speed` `stopAt` | 세상이 흐르는 속도(car: m/s, face: 옆 창 px/s), `stopAt` 초에 서서히 멈춤 |
| face `driver` | `{skin, hair: short\|spiky\|slick\|bald\|cap\|bob\|curly\|long, hairColor, cap, glasses: sun\|round, beard: mustache\|stubble\|full, shirt, mood, moods: [[t, mood]]}`. 표정: neutral smug grin angry rage shock scared sad cry happy laugh cool side bored yell eek squint |
| face `flip` `car` | 좌우 반전(악역 컷은 반대쪽을 봄), 문틀에 보이는 차 색 |
| face `ahead` | 앞유리로 보이는 앞차 `{kind, color, size 0..1, to, toAt, brake: [[t0,t1]], siren, dark}` |
| face `peer` | 옆 창으로 지나가는 차·트럭 `{kind, color, driver, x0, x1, at, dur, siren}` |
| face `honk` `marks` `police` `glare` | 손으로 경적(그림 + 흔들림), 머리 위 기호 `[[t, "!"]]`, 경광등 빛(t부터), 뒤차 상향등 눈부심 `[[t0,t1]]` |
| car `cam` `cam2` `camAt` `camDur` `follow` | 카메라 프리셋 `rear` `rearL` `rearR` `side` `sideL` `front` `frontL` `high` 또는 `{x,y,z,yaw,pitch,fov}`(따라가는 차 기준), 중간에 다른 카메라로 이동 |
| car `cars[]` | `{kind: car\|tiny\|suv\|sports\|van\|truck\|police\|work, color, lane, z, vz, path: [[t, lane, z, dur]], heading, driver, brake, blink, blinkAt, blinkOff, honk, siren, lights, dark (true 또는 그 초까지), smoke, fast, marks}`. 1차로가 왼쪽, `lanes+1`이 갓길. 운전자 얼굴은 유리 너머로만 보이고, 뒤에서 보면 뒤통수 |
| car 도로 | `lanes`, `cones: [[lane, z]]`, `laneEnd: {lane, z0, z1}`(차로 끝 라바콘·빗금), `exit: {z}`(오른쪽 출구 + 140m 앞 표지), `signs: [{z, kind: exit\|km\|speed\|merge\|work, text}]`, `speedCam: {z, at}`, `hill`(오르막) |

**확인**: 손대지 않은 기존 쇼츠 `road1`(도로 그래픽)과 `sseol1`(썰 장면)을 원래 커밋의 코드와 바뀐 코드로 같은 음성 빌드에서 렌더해 비교했다. 두 편 모두 영상 프레임이 비트 단위로 같았다(framemd5 일치, PSNR inf).

### 벤치마크 점수표

목표는 `benchmark-targets-drawn.json`의 `road`: 길이 28초, 훅 끝 0.0초, 첫 화면 변화 ≤1.5초, 평균 장면 2.0초, 최장 4.0초, 초당 음절 0(내레이션 없음), 줄 1(제목 한 줄 + 영어), 제목 9~16자. 우리 값은 렌더한 `final/<id>.mp4`를 `qa_review.py`와 같은 방법(그림 칸 scene > 0.04, 0.3초 안 전환 합침)으로 잰 것이다. 이 방법은 표정·줌·경광등이 바뀌어도 전환으로 센다. 훅 끝은 0.0초다: 0초 첫 프레임에 제목과 얼굴(또는 차)이 이미 있고 말이 없다. 초당 음절과 내레이션 줄은 `build/<id>/timeline.json`의 대사 줄이 0개라서 0이다.

| id | 화면 제목 (한 / 영) | 길이 | 훅 끝 | 첫 전환 | 평균 / 최장 장면 | 전환 | 초당 음절 | 줄 | 제목 글자 | qa |
|---|---|---|---|---|---|---|---|---|---|---|
| `drive1` | 감히 경차를 무시해? / How dare you ignore a tiny car? | 27.2초 | 0.0초 | 0.7초 | 1.4 / 2.6초 | 18 | 0 | 0 (제목 1줄 + 영어) | 8자 | PASS 10/10, -14.0 LUFS, 6.8MB |
| `drive2` | 합류 끝까지 달린 차의 최후 / The Last-Second Merger | 27.0초 | 0.0초 | 1.4초 | 1.5 / 2.6초 | 17 | 0 | 0 (제목 1줄 + 영어) | 11자 | PASS 10/10, -13.9 LUFS, 6.8MB |
| `drive3` | 트럭 옆에서 까불면 안되는 이유 / Never Mess With a Truck | 27.1초 | 0.0초 | 1.5초 | 1.4 / 3.0초 | 18 | 0 | 0 (제목 1줄 + 영어) | 13자 | PASS 10/10, -14.0 LUFS, 7.1MB |
| `drive4` | 추월하면 빨라지는 차의 최후 / He Speeds Up When You Pass | 26.6초 | 0.0초 | 1.4초 | 1.8 / 2.6초 | 14 | 0 | 0 (제목 1줄 + 영어) | 12자 | PASS 10/10, -14.0 LUFS, 6.4MB |
| `drive5` | 브레이크만 밟는 빌런 / The Brake Checker | 26.6초 | 0.0초 | 0.3초 | 1.6 / 2.6초 | 16 | 0 | 0 (제목 1줄 + 영어) | 9자 | PASS 10/10, -14.0 LUFS, 6.9MB |
| `drive6` | 밤에 라이트 안 켠 차의 최후 / The Invisible Car (No Headlights) | 26.7초 | 0.0초 | 1.3초 | 1.6 / 2.6초 | 16 | 0 | 0 (제목 1줄 + 영어) | 11자 | PASS 10/10, -14.6 LUFS, 4.7MB |
| `drive7` | 1차로 막는 차의 최후 / The Left-Lane Hog | 27.0초 | 0.0초 | 1.4초 | 1.8 / 2.6초 | 14 | 0 | 0 (제목 1줄 + 영어) | 9자 | PASS 10/10, -14.0 LUFS, 6.3MB |
| `drive8` | 깜빡이 없이 끼어든 차의 최후 / Cut In Without a Signal? | 26.5초 | 0.0초 | 0.2초 | 1.7 / 2.4초 | 15 | 0 | 0 (제목 1줄 + 영어) | 12자 | PASS 10/10, -14.0 LUFS, 6.3MB |
| `drive9` | 갓길로 새치기한 차의 최후 / The Shoulder Cheater | 26.0초 | 0.0초 | 1.4초 | 1.6 / 2.6초 | 15 | 0 | 0 (제목 1줄 + 영어) | 11자 | PASS 10/10, -14.0 LUFS, 7.2MB |
| `drive10` | 상향등 켜고 붙던 차의 최후 / Tailgating With High Beams? | 26.1초 | 0.0초 | 1.3초 | 1.5 / 2.6초 | 17 | 0 | 0 (제목 1줄 + 영어) | 11자 | PASS 10/10, -14.0 LUFS, 5.7MB |

**놓친 것과 이유**
- 길이 26.0~27.2초로 목표 28초보다 0.8~2초 짧다. 레시피 범위(20~35초)와 이번 요청(25~30초) 안이고, 마지막 컷을 늘리면 우는 얼굴이 늘어져 루프가 느려져서 그대로 뒀다.
- 평균 장면 1.4~1.8초는 목표 2.0초보다 짧다. 표정이 바뀌는 순간(같은 컷 안)과 "둥둥" 줌도 전환으로 세는 측정 방식 때문이다. 실제 컷은 편마다 14개로, 컷 평균은 1.86~1.94초다.
- 첫 전환 0.2~1.5초는 모두 목표(≤1.5초) 안이다. 최장 장면 2.4~3.0초도 목표(≤4.0초) 안이다.
- 벤치마크 값 중 길이·첫 전환·장면 길이는 보고서가 *추정*으로 적은 것이다(유튜브가 로그인을 요구해 재지 못함).

**qa_review**: 10편 모두 FAIL 0. 처음 렌더에서 `drive7`만 소리 WARN(−12.7 LUFS)이 나와 소리만 다시 맞췄다(위). 첫 시트를 보고 고친 것: 얼굴 눈꺼풀 기울기가 화남·슬픔에서 반대로 그려지던 것, 트럭 옆 카메라가 트레일러에 가려지던 컷(`drive1` 9번째), 옆 카메라 앞을 가리던 나무, 경찰차가 카메라 바로 앞에 크게 걸리던 컷(`drive8`), 영어 제목 한 단어 줄바꿈(`drive4`).

### 출처·라이선스·사실 근거

- 그림: 전부 이 저장소 코드로 직접 그림(`src/lib/Drive.tsx`, `DriveFace.tsx`). 외부 이미지·영상 없음. 벤치마크 채널(알룔료)의 영상·캐릭터는 쓰지 않았고 구성(얼굴 클로즈업 ↔ 차 장면, 16:9 레터박스, 한·영 제목, 자업자득 결말)만 따랐다.
- 효과음: `drive_sfx.py`(엔진·타이어·둥둥), `road_sfx.py`(경적·사이렌), `../tools/sfx.py`(`shutter`, `click`) — 모두 numpy 합성.
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0 — Sneaky Snitch(1·5편), Hustle(2·8편), Scheming Weasel(3·6·10편), Hyperfun(4·9편), Monkeys Spinning Monkeys(7편).
- 사이드카: `media/drive/sources.json`(외부 출처 없음, 음악·효과음·사실 근거).
- 사실(설명란에만 씀, 2026-10-10 국가법령정보센터 도로교통법 현행 본문에서 확인):
  - 제37조제1항: 밤(해가 진 후부터 해가 뜨기 전까지)에 도로에서 차를 운행하면 전조등·차폭등·미등과 그 밖의 등화를 켜야 한다. 제2항: 밤에 마주 보고 가거나 앞차 바로 뒤를 따라갈 때는 등화 밝기를 줄이는 등 필요한 조작을 해야 한다. (`drive6`, `drive10`)
  - 제19조제1항(앞차가 갑자기 서도 충돌을 피할 거리), 제4항(위험방지 등 부득이한 경우가 아니면 급제동 금지). (`drive3`, `drive5`, `drive10`)
  - 제46조의3: 안전거리 미확보·진로변경 금지 위반·급제동 금지 위반, 정당한 사유 없는 소음 발생 등을 연달아 하거나 지속·반복해 위협하면 난폭운전. (`drive1`, `drive5`, `drive10`)
  - `drive7`·`drive8`·`drive9`의 1차로(제60조제1항·시행규칙 [별표 9]), 깜빡이 시기(제38조제1항·시행령 [별표 2]), 갓길(제60조제1항)은 위 `road1`~`road4`, `road5`~`road10` 절의 출처 그대로다.
  - 화면에는 법 조문·범칙금을 쓰지 않았다. `drive2`(합류)와 `drive4`(추월)는 설명란에도 법 문장을 쓰지 않았다.

### 업로드 문구

모든 편의 설명란 끝에 같은 창작 표시와 음악 크레딧을 붙인다. 해시태그는 한국어와 영어를 섞어 5개다.

`drive1`
- 제목: 감히 경차를 무시해?ㄷㄷ / How dare you ignore a tiny car? 🚗
- 설명:
  ```
  (창작 애니) 경차 뒤에 바짝 붙어 빵빵대던 SUV, 결국 나가야 할 출구를 놓쳤다 🚗
  The SUV that bullied a tiny car missed its own exit.
  바짝 붙거나 경적으로 계속 위협하면 난폭운전이 될 수 있어요(도로교통법 제46조의3).
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #애니메이션 #karma #driving
  ```
- 해시태그: #운전공감 #참교육 #애니메이션 #karma #driving
- 고정 댓글: 경차 무시하는 차, 여러분도 만나 보셨나요? / Ever been bullied for driving a small car? 👇

`drive2`
- 제목: 합류 끝까지 달린 차의 최후ㄷㄷ / The Last-Second Merger
- 설명:
  ```
  (창작 애니) 줄 선 차들 옆으로 끝까지 달려간 차, 결국 맨 뒤 작업차 뒤로 🐢
  He raced past the whole line to the very end of the lane... and ended up behind the slowest truck.
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #애니메이션 #karma #driving
  ```
- 해시태그: #운전공감 #참교육 #애니메이션 #karma #driving
- 고정 댓글: 합류 구간 새치기, 여러분은 양보해 주나요? / Do you let last-second mergers in? 👇

`drive3`
- 제목: 트럭 옆에서 까불면 안되는 이유ㄷㄷ / Never Mess With a Truck 🚚
- 설명:
  ```
  (창작 애니) 트럭 앞에서 알짱대던 스포츠카, 오르막 한 차로에서 트럭 뒤에 갇혔다 🚚
  The show-off who taunted a truck got stuck behind it on a one-lane hill.
  앞차를 놀리듯 갑자기 브레이크를 밟는 급제동은 금지예요(도로교통법 제19조제4항).
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #트럭 #karma #truck
  ```
- 해시태그: #운전공감 #참교육 #트럭 #karma #truck
- 고정 댓글: 트럭 앞에서 급제동하는 차, 보신 적 있나요? / Seen anyone brake-test a truck? 👇

`drive4`
- 제목: 추월하면 빨라지는 차의 최후ㄷㄷ / He Speeds Up When You Pass
- 설명:
  ```
  (창작 애니) 추월하려고만 하면 밟아 버리던 차, 결국 단속 카메라 앞에서 번쩍 📸
  He sped up every time someone tried to pass... right into a speed camera.
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #애니메이션 #karma #driving
  ```
- 해시태그: #운전공감 #참교육 #애니메이션 #karma #driving
- 고정 댓글: 추월하면 빨라지는 차, 왜 그러는 걸까요? / Why do people speed up when you pass? 👇

`drive5`
- 제목: 브레이크만 밟는 빌런ㄷㄷ / The Brake Checker
- 설명:
  ```
  (창작 애니) 뒤차 겁주려고 브레이크를 콕콕 밟던 빌런, 이번 뒤차는… 🚓
  The brake checker picked the wrong car to brake-check.
  부득이한 경우가 아니면 급제동은 금지(도로교통법 제19조제4항), 반복해서 위협하면 난폭운전(제46조의3)이에요. 이런 차를 만나면 거리를 넉넉히 두세요.
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #급제동 #karma #brakecheck
  ```
- 해시태그: #운전공감 #참교육 #급제동 #karma #brakecheck
- 고정 댓글: 브레이크 빌런 만나면 어떻게 하세요? / What do you do with a brake checker? 👇

`drive6`
- 제목: 밤에 라이트 안 켠 차의 최후ㄷㄷ / The Invisible Car (No Headlights)
- 설명:
  ```
  (창작 애니) 밤길에 라이트도 안 켜고 달리던 차, 드디어 켰더니 바로 앞에… 🚓
  He finally switched his headlights on... right behind a police car.
  밤(해가 진 뒤부터 뜨기 전까지)에 도로를 달릴 때는 전조등·차폭등·미등을 켜야 해요(도로교통법 제37조).
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #스텔스차량 #karma #headlights
  ```
- 해시태그: #운전공감 #참교육 #스텔스차량 #karma #headlights
- 고정 댓글: 밤에 라이트 안 켠 차, 얼마나 무서운지 아시죠? / Ever met an invisible car at night? 👇

`drive7` (`road1` 무언판)
- 제목: 1차로 막는 차의 최후ㄷㄷ / The Left-Lane Hog
- 설명:
  ```
  (창작 애니) 뻥 뚫린 길에서 1차로를 막고 느긋하게 가던 차, 결국 🚓
  The left-lane hog finally meets the car behind him.
  편도 3차로 이상 고속도로의 1차로는 앞지르기할 때 쓰는 차로예요(도로교통법 제60조제1항, 시행규칙 [별표 9]). 그래도 바짝 붙어 위협하면 보복운전입니다.
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #1차로 #karma #leftlane
  ```
- 해시태그: #운전공감 #참교육 #1차로 #karma #leftlane
- 고정 댓글: 1차로 정속 주행, 여러분 생각은? / Left-lane campers: annoying or fine? 👇

`drive8` (`road2` 무언판)
- 제목: 깜빡이 없이 끼어든 차의 최후ㄷㄷ / Cut In Without a Signal?
- 설명:
  ```
  (창작 애니) 깜빡이 없이 훅훅 끼어들던 차, 이번에 끼어든 앞은 하필… 🚓
  No signal, no warning... and this time he cut in front of the police.
  진로를 바꿀 땐 30m(고속도로 100m) 앞부터 깜빡이를 켜야 해요(도로교통법 제38조, 시행령 [별표 2]). 화가 나도 똑같이 끼어들면 보복운전입니다.
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #깜빡이 #karma #turnsignal
  ```
- 해시태그: #운전공감 #참교육 #깜빡이 #karma #turnsignal
- 고정 댓글: 깜빡이 안 켜고 끼어드는 차, 하루에 몇 번 보세요? / How many no-signal cut-ins do you see a day? 👇

`drive9` (`road8` 무언판)
- 제목: 갓길로 새치기한 차의 최후ㄷㄷ / The Shoulder Cheater
- 설명:
  ```
  (창작 애니) 꽉 막힌 길에서 갓길로 쌩 달리던 차, 갓길 끝에서 기다리던 건… 🚧
  He used the shoulder to skip the jam... until the shoulder ended.
  고속도로 갓길은 고장 등 부득이한 경우가 아니면 달릴 수 없어요(도로교통법 제60조제1항). 막아서지 마세요, 그게 더 위험합니다.
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #갓길 #karma #trafficjam
  ```
- 해시태그: #운전공감 #참교육 #갓길 #karma #trafficjam
- 고정 댓글: 갓길 주행하는 차 보면 어떤 생각 드세요? / What do you think of shoulder drivers? 👇

`drive10` (`road9` 무언판)
- 제목: 상향등 켜고 붙던 차의 최후ㄷㄷ / Tailgating With High Beams?
- 설명:
  ```
  (창작 애니) 상향등 켜고 바짝 붙던 차, 다음에 붙은 앞차는… 🚓
  High beams, tailgating... and the next car he tailgated was a police car.
  밤에 앞차 바로 뒤를 따라갈 때는 등화 밝기를 줄여야 하고(도로교통법 제37조제2항), 앞차가 갑자기 서도 피할 거리를 둬야 해요(제19조제1항). 계속 위협하면 난폭운전(제46조의3).
  직접 그린 창작 애니메이션입니다. 등장인물·차량·상황은 실제와 관계없습니다.
  An original hand-drawn cartoon (fiction). No real people, cars or brands.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  #운전공감 #참교육 #상향등 #karma #tailgating
  ```
- 해시태그: #운전공감 #참교육 #상향등 #karma #tailgating
- 고정 댓글: 상향등 테러 당해 보신 분? / Ever been blinded by high beams from behind? 👇

## 낙서 짤툰 v2 (벤치마크, `doodle1`~`doodle16`)

`research/benchmark-drawn.md` 1절과 `research/benchmark-targets-drawn.json`의 `doodle` 목표에 맞춰 기존 10편을 다시 만들고 6편을 새로 만들었다. 벤치마크는 콩자반 「현재 논란중인 에스컬레이터 길막녀」(955만), 「오프리쉬 신고하면 벌어지는 일」(614만), 김블루 「읽기만 해도 기빨리는 게시글」(494만)이다. 이 채널들의 **구조만** 따랐고 영상·그림은 하나도 가져오지 않았다. 가장 큰 변화는 주제 각도다. "알면 좋은 상식"에서 **"누가 잘못했나"**(민폐, 신고, A vs B)로 옮겼다. 상황은 누구나 겪는 일반적인 것이고, 실존 인물이나 특정 사건은 다루지 않는다. 양쪽 입장을 다 보여 준다.

**v1에서 바뀐 것**

| 항목 | v1 | v2 |
|---|---|---|
| 첫 줄 | 질문·배경 설명(훅 2.0~3.3초) | **대사**("기사님, 내려요!", "멀티탭에 또 멀티탭?", "계란 일 번으로 사 오랬지!"), 0초부터 따옴표 자막, 훅 끝 0.4~1.8초 |
| 말 속도 | InJoon +25%, 5.3음절/초 | InJoon **+50%**, 인물 +25~42%, 문장 안 마침표는 쉼표로 읽음, **6.3~7.1음절/초** |
| 제목 | "대부분 모르는 ○○" 상식형 | "○○ 신고하면 벌어지는 일", "현재 논란중인 ○○", "읽기만 해도 기빨리는 ○○", "A vs B" |
| 이야기 | 상식 나열 4편 | 16편 모두 갈등 + 복선 있는 펀치라인(아래 "이야기 검토") |
| 그림 칸 | 1080×1080, 아래 440px 빈 검정 | **세로로 꽉 찬 칸**(1080×1520, 제목 띠 아래부터 화면 끝까지) |
| 자막 | 그림 밖 검정 칸, 한 줄 3~6자, 초록·노랑·빨강, 인물 대사는 말풍선만 | **그림 안 아래쪽 남색 상자**, 한 문장을 1~2줄로(12자까지 한 장), **노랑 한 색**. 인물 대사도 따옴표 자막으로 나온다. 말풍선은 두 명 이상이 한 화면에 있을 때만 남긴다(누가 말하는지 보이게) |
| 도치 | 모든 장면 같은 크기·자리·포즈 | **1.6~2.1배**, 장면마다 미디엄 → 가슴 위 클로즈업 → 옆으로 기운 컷 → 반대쪽 클로즈업 순서로 바뀜 |
| 화면 출처 표시 | "사진: Pexels" 배지 | 없음. 사진 크레딧은 모두 설명란에 쓴다 |
| `vs` 그래픽 카드 | 사용 | 낙서 장면으로 바꿈(그래픽만 나오는 화면 없음) |

### 새 템플릿 옵션 (모두 하위호환)

옵션을 안 쓰는 쇼츠는 예전과 똑같이 그린다. 확인: 템플릿을 바꾸기 전에 `sseol1`과 `teuk1`의 `src/data/*.json`을 고정해 두고 0·123·400·700프레임을 렌더했다. 바꾼 뒤 같은 데이터로 다시 렌더했더니 8장 모두 PNG md5가 같았다. `qa_review.py`는 바꾸지 않았다.

- **`"frame": "capTall"`** (`src/lib/CapBox.tsx`의 `CAP_TALL`, `ClipShort.tsx`의 `FRAME`에 한 줄. 랭킹 v2의 `"tall"`(위 420px)과는 다른 틀이다): 그림 칸을 제목 띠 아래(400px)부터 화면 끝(1920px)까지 1080×1520으로 쓴다. edit.json 맨 위에 두면 모든 클립에 적용된다(prep.py는 원래 `frame`을 넘겨준다). 낙서 장면(`scene`)은 높이를 받아 배경과 바닥을 그대로 늘려 그린다.
- **`"capBox": {"y": 1600, "accent": "#FFE14D", "bg": "rgba(16,20,52,.9)", "width": 940}`** (`src/lib/CapBox.tsx`, `ClipShort.tsx`와 `prep.py`에 한 줄씩): 기존 단어 자막(`Captions`) 대신 남색 둥근 상자 안의 흰 굵은 자막을 그린다. 한 줄에 다 들어가면 크게 한 줄로, 아니면 **글자 수가 비슷한 두 줄**로 나눈다(아랫줄에 한 단어만 남지 않게). `[키워드]`와 `{빨강}`은 둘 다 `accent` 한 색이고, 읽는 단어는 색 대신 살짝 튀어 오른다. `y`는 상자 중심 높이, 나머지는 생략하면 위 기본값이다.
- **인물 `y`, `rot`** (`src/lib/Sseol.tsx` `Char`): `y`는 발을 바닥보다 y px 아래로 내린다. 크게 키운 인물이 가슴 위만 보이는 클로즈업이 된다. `rot`는 인물을 발 기준으로 기울인다(도). 말풍선 높이도 `y`를 따라간다.
- **장면 `floor`** (`Sseol.tsx` `SceneG`): 칸 아래에서 바닥선까지의 높이(px, 기본 76)다. 세로 칸에서는 400으로 올린다. 그러면 인물 얼굴이 자막 상자 위에 오고, 자막 아래로도 바닥이 이어져 빈 곳이 없다.
- **장면 `bigSize`** (`Sseol.tsx`): `big` 글씨 크기(기본 160). 7자 이상이면 빌더가 104~118로 줄여 칸 밖으로 나가지 않게 한다.
- 제목 띠 둘째 줄은 기존 `titleKey`를 노랑(`#FFE14D`)으로 썼다(코드 변경 없음).

**만드는 법**: 대본과 편집은 `media/doodle/v2/`의 빌더가 쓴다. `remake.py`는 doodle1~10을 만든다. v1 장면을 v1 커밋(`6b46ca7`)에서 읽어 새 대본에 다시 배치한다. `new.py`는 doodle11~16을 처음부터 쓴다. `lib.py`가 공통 부분이다. 세로 칸 배치, 컷마다 다른 도치 샷, 한 색 강조, `/` 두 쪽을 12자 안이면 한 장(두 줄)으로 합치기, 대사의 따옴표 자막, 문장 안 마침표를 쉼표로 읽게 하기, 긴 `big` 글씨 줄이기를 맡는다.

```bash
media/doodle/fetch.sh                                   # 사진 55장 → public/doodle/
python3 media/doodle/v2/remake.py && python3 media/doodle/v2/new.py    # shorts/doodle1~16/script.json, edit.json
for i in $(seq 1 16); do python3 voice_edge.py doodle$i && python3 prep.py doodle$i; done
python3 media/doodle/v2/seconds.py doodle{1..16}        # 사진이 화면에 나온 초 → edit.json sources, media/doodle/sources.json
for i in $(seq 1 16); do ./render.sh doodle$i final/doodle$i.mp4 && python3 qa_review.py doodle$i; done
python3 media/doodle/v2/score.py doodle{1..16}          # 아래 점수표
python3 media/doodle/v2/upload.py                       # 아래 업로드 문구
```

### 이야기 검토 (REVIEW.md 2-1절)

v2 대본을 처음 쓴 뒤 REVIEW.md에 2-1절 "이야기 검토"가 생겼다. 16편을 그 기준으로 다시 봤다. 1번(한 줄 요약), 2번(제목으로 결말을 못 맞힘), 5번(복선 있는 반전), 7번(설교 금지) 중 하나에 걸린 12편을 다시 쓰고 다시 만들었다.

| id | 다시 쓴 이유 | 바꾼 것 |
|---|---|---|
| `doodle1` | 1·5·7: 교체 신호를 늘어놓는 정보 나열, 반전 없음 | 룸메이트와의 말다툼으로 바꿨다. 복선은 "폰이 하루 종일 충전 중"이고, 결말은 멀티탭 탑이 벽에 안 꽂혀 있었다는 것 |
| `doodle4` | 2: "엄마가 1초 만에 찾음"은 제목만 봐도 보인다 | 엄마가 처음부터 들고 있던 반찬통(첫 장면부터 손에 보임)이 곧 김치였다는 정체 반전 |
| `doodle5` | 1·7: 숫자 뜻을 늘어놓기만 함 | 4번 계란을 사 와서 엄마에게 혼남 → 엄마가 설명 → 엄마 냉장고 계란도 4번(세일). 사실은 엄마 대사에 녹였다 |
| `doodle7` | 1·7: 압력계·기한·사용법 강의 | "멀쩡한 걸 왜 버려" 아빠와 숫자 싸움을 하다가 이긴다. 다음 날 그 소화기가 문 받침이 되어 있다(첫 장면 문 옆 소화기가 복선) |
| `doodle8` | 5: 첫 장면 "근데 내 벨 아님"이 반전을 미리 말함 | 첫 줄을 "저기, 제 거 아직인가요?"로 바꾸고 복선("친구도 벨을 내 벨 옆에 둠")을 넣었다 |
| `doodle9` | 5: 첫 장면이 펀치라인("이모!")을 미리 씀 | 첫 줄을 도치의 기어드는 "저, 저기요…"로 바꿨다 |
| `doodle11` | 7: 안전수칙 세 가지를 늘어놓음. 끝("계단으로 갈게요")이 약함 | 출근 첫날의 말다툼으로 바꿨다. 복선은 "9시 회의라고요!"이고, 결말은 그 사람이 팀장님이었다는 정체 반전. 사실은 둘의 말싸움 안에 넣었다 |
| `doodle12` | 7: 신고 구역 여섯 곳을 늘어놓음. 5: 아빠 차 반전의 복선이 없었음 | 이웃과의 문답에 규정을 녹였다. 복선은 "빨간 차, 어디서 많이 본 차" |
| `doodle13` | 5: 끝 "나도 체크는 했음"이 약함 | 복선 "이 방엔 반장 어머님도 계심"을 넣고, 결말을 "참석 셋: 반장, 나, 반장 어머님"으로 바꿨다 |
| `doodle14` | 1·5: 단어 뜻 나열로 끝남 | 배운 말로 "이모님, 정지에서 욕보셨습니다!"라고 인사하는 역전에 이어, 앞에 깐 "파이다"를 다시 꺼내는 펀치라인 |
| `doodle15` | 2·7: 결론이 "속도랑 말 한마디"라는 교훈 | 젖히기가 도미노처럼 번지다가 맨 뒷줄 "저는 뒤가 벽인데요?"로 끝난다 |
| `doodle16` | 5: "면접 본다며?"의 복선이 없었음 | 맡길 때 "단추 하나 없는데 다림질만", 통화 "다음 주 면접이라"를 앞에 깔았다 |

그대로 둔 4편(`doodle2`, `doodle3`, `doodle6`, `doodle10`)은 네 기준을 통과했다. 각각 단계적으로 커지다가, 앞에 깐 단서("아직 내 방", "다들 똑같은 생각", 넵 단계, "매일 같은 시간")로 꺾인다.

| id | 한 줄 요약 | 결말 유형 | 노리는 감정 |
|---|---|---|---|
| `doodle1` | 룸메이트가 멀티탭을 3층까지 쌓았다가, 그 탑이 벽에 안 꽂혀 있었다 | 허탈 개그 | 웃음 |
| `doodle2` | 만 원 의자를 팔다가 네고가 배송비 요구까지 갔고, 의자는 아직 내 방에 있다 | 허탈 개그 | 웃음 |
| `doodle3` | 다들 누가 벨 누르겠지 하다가, 네 명이 같은 정류장에서 같이 걸었다 | 의외의 이유 | 공감 |
| `doodle4` | 냉장고를 10분 뒤지다가, 김치가 엄마 손에 있었다 | 정체 반전 | 웃음 |
| `doodle5` | 4번 계란을 사 와서 혼났는데, 엄마 냉장고 계란도 4번이었다 | 역전 | 웃음 |
| `doodle6` | 넵 7단계를 늘어놓다가, 팀장님의 "넵." 한 글자에 보고서를 냈다 | 역전 | 공감 |
| `doodle7` | 2010년산 소화기로 아빠와 싸워 이겼는데, 그 소화기가 문 받침이 됐다 | 허탈 개그 | 웃음 |
| `doodle8` | 진동벨만 보다가 카운터에서 울렸는데, 그게 친구 벨이었다 | 오해 | 웃음 |
| `doodle9` | 직원을 못 불러 쩔쩔매다가, 친구의 "이모!" 한 마디에 끝났다 | 허탈 개그 | 공감 |
| `doodle10` | 무섭던 새벽 3시 손님이, 비 오는 날 캔커피를 건넸다 | 따뜻한 반전 | 뭉클 |
| `doodle11` | 에스컬레이터 왼쪽에서 말다툼한 아저씨가, 출근 첫날 우리 팀장님이었다 | 정체 반전 | 웃음 |
| `doodle12` | 소화전 앞 빨간 차를 신고했는데, 아빠 차였다 | 역전 | 웃음 |
| `doodle13` | 동창회 공지가 7줄까지 길어졌는데, 참석 체크는 반장·나·반장 어머님 셋이었다 | 허탈 개그 | 공감 |
| `doodle14` | 부산 친구 집에서 사투리를 배워 인사했더니, 옷은 "파이다"였다 | 역전 | 웃음 |
| `doodle15` | 기차 의자를 끝까지 젖혔더니 도미노가 됐고, 맨 뒷줄은 벽이었다 | 허탈 개그 | 웃음 |
| `doodle16` | 사람을 얼룩으로 기억하는 세탁소 사장님이, 지나가듯 한 면접 얘기까지 기억해 단추를 달아 줬다 | 따뜻한 반전 | 뭉클 |

결말 유형은 허탈 개그 6, 역전 4, 정체 반전 2, 따뜻한 반전 2, 오해 1, 의외의 이유 1로 섞었다. 같은 유형이 연달아 나오지 않게 올리는 순서를 이렇게 권한다(9번, 같은 뼈대 연속 금지): 11 → 2 → 4 → 12 → 1 → 3 → 16 → 5 → 13 → 8 → 14 → 7 → 10 → 15 → 6 → 9.

### 벤치마크 점수표

`python3 media/doodle/v2/score.py doodle{1..16}`로 쟀다. 기준은 `research/benchmark-targets-drawn.json`의 `doodle` 목표다. 길이·훅·첫 화면 변화·화면 길이·음절/초는 벤치마크를 재지 못해 보고서의 **추정값**이다. 측정 방법은 보고서와 같다. 그림 칸 1080×1080(400px부터)에서 ffmpeg scene > 0.04를 쓰고 0.3초 안의 변화는 합친다. 음절/초는 한글 음절 수를 대사 줄 길이 합으로 나눈 값이다. 훅 끝은 첫 줄이 끝나는 시각이다.

| id | 제목 | 길이 | 훅 끝 | 첫 화면 변화 | 평균/최장 화면 | 음절/초 | 줄 수 | 제목 글자(줄별) |
|---|---|---|---|---|---|---|---|---|
| 목표 | 2줄 6~9자 | 34초 (30~38) | ≤1.8초 | ≤2.0초 | 2.5 / ≤4.0초 | ≥6.2 | 14 (12~16) | 6~9 |
| `doodle1` | 멀티탭에 멀티탭 / 꽂으면 벌어지는 일 | 26.5초 | 1.43초 | 0.37초 | 0.74 / 2.63초 | 6.65 | 14 | 7+8 |
| `doodle2` | 중고거래 네고 / 선 넘으면 벌어지는 일 | 28.2초 | 1.31초 | 0.37초 | 0.78 / 2.00초 | 6.59 | 17 | 6+9 |
| `doodle3` | 하차벨 아무도 / 안 누르면 벌어지는 일 | 28.7초 | 1.28초 | 0.33초 | 1.11 / 2.90초 | 6.76 | 17 | 6+9 |
| `doodle4` | "냉장고에 있잖아" / 엄마 vs 나 | 27.5초 | 1.02초 | 0.27초 | 0.71 / 2.47초 | 6.32 | 17 | 7+5 |
| `doodle5` | 계란 1번 vs 4번 / 진짜 차이 | 29.2초 | 1.30초 | 0.77초 | 0.81 / 2.47초 | 6.83 | 16 | 8+4 |
| `doodle6` | 팀장님 "넵." 받으면 / 벌어지는 일 | 28.5초 | 0.36초 | 0.37초 | 1.24 / 3.33초 | 7.08 | 17 | 7+5 |
| `doodle7` | 소화기 바늘 / 초록 밖이면 벌어지는 일 | 30.7초 | 1.46초 | 0.37초 | 0.77 / 1.90초 | 6.51 | 15 | 5+10 |
| `doodle8` | 카페 진동벨 / 울리면 벌어지는 일 | 30.6초 | 1.71초 | 0.50초 | 0.87 / 2.73초 | 6.63 | 15 | 5+8 |
| `doodle9` | 식당 직원 부를 때 / "여기요" vs "저기요" | 29.3초 | 1.27초 | 0.90초 | 0.75 / 1.97초 | 6.28 | 16 | 7+8 |
| `doodle10` | 새벽 3시 편의점 / 수상한 손님의 정체 | 30.2초 | 1.43초 | 1.50초 | 1.26 / 2.87초 | 6.68 | 16 | 7+8 |
| `doodle11` | 현재 논란중인 / 에스컬레이터 2줄 서기 | 33.3초 | 1.45초 | 0.77초 | 0.85 / 3.27초 | 6.45 | 16 | 6+10 |
| `doodle12` | 불법주차 신고하면 / 벌어지는 일 | 33.3초 | 1.04초 | 0.77초 | 0.98 / 2.97초 | 6.39 | 17 | 8+5 |
| `doodle13` | 읽기만 해도 기빨리는 / 동창회 단톡 현실 | 31.5초 | 1.77초 | 1.87초 | 1.12 / 2.73초 | 6.64 | 17 | 9+7 |
| `doodle14` | 서울 vs 부산 / 같은 말 다른 뜻 | 34.4초 | 1.47초 | 1.57초 | 0.77 / 1.60초 | 7.00 | 21 | 6+6 |
| `doodle15` | 현재 논란중인 / 기차 의자 끝까지 젖히기? | 28.1초 | 1.41초 | 0.77초 | 0.97 / 2.70초 | 6.82 | 16 | 6+10 |
| `doodle16` | 동네 세탁소 사장님의 / 미친 기억력 비결 | 34.9초 | 1.51초 | 1.60초 | 1.03 / 2.43초 | 6.75 | 17 | 9+7 |

v1과 비교하면(doodle1~10 중앙값) 훅 끝은 2.67초에서 1.3초로, 음절/초는 5.30에서 6.6으로 바뀌었다. qa_review는 16편 모두 11개 항목 PASS(WARN·FAIL 0)였다.

**못 맞춘 것과 이유**
- **길이**: 26.5~34.9초(중앙값 29.8초)이고, 9편이 목표 34초(30~38초)보다 짧다. 말을 +50%로 빠르게 하면서 같은 이야기가 5~6초 줄었다. 줄을 더하면 이야기가 늘어지거나(2-1절 4번) 설명이 끼어서(7번), 줄은 이야기에 필요한 만큼만 뒀다. 모두 qa_review의 25~45초 안이고, 5편은 31초 이상이다. 34초 목표 자체가 추정값이다(247편 중앙값).
- **평균 화면 길이**: 0.7~1.3초로, 목표 2.5초보다 "빠르다". 이 잣대(scene > 0.04)는 표정, 말풍선, 큰 글씨, 자막 상자가 바뀌어도 화면 변화로 센다. 장면(컷)의 실제 길이는 1.5~2.5초다. 최장은 1.6~3.3초로 목표 4.0초 안이다.
- **줄 수**: 17줄인 편이 8편, doodle14는 21줄이다. 대사가 짧게 오가는 말다툼 구조라서 줄이 짧다(doodle14는 사투리 대사가 한두 마디씩이다). 길이는 그대로 30~35초다.
- **제목 한 줄 6~9자**: doodle7 2줄(10자), doodle11 2줄(10자), doodle15 2줄(10자)이 넘는다. "에스컬레이터 2줄 서기", "기차 의자 끝까지 젖히기?"는 오케스트레이터가 정한 제목에서 왔다(doodle15의 "KTX"는 서비스 이름이라 "기차"로 바꿨다). qa_review 기준(한 줄 13자 이하)은 통과한다.


### 사진과 라이선스

모두 Pexels 사진이다. 사람 얼굴이 알아보이지 않는 물건·장소 사진이고, 읽히는 상표·로고·간판이 없는 것만 썼다. doodle1~10의 사진은 위 `doodle1`~`doodle4`, `doodle5`~`doodle10` 절의 표와 같다. 다만 v2의 세로 칸에서 doodle3의 「정류장의 버스」(21235187)는 버스 옆면 글씨와 노선 번호가 크게 보여서 빼고 그린 거리 배경으로 바꿨다. 새로 쓴 12장은 2026-10-10에 각 사진 페이지에서 "License: Free"(Pexels License)와 제작자를 확인했다. [Pexels License](https://www.pexels.com/license/)는 무료이고 상업적 이용과 수정이 가능하며 출처 표기가 필요 없다. 그래도 설명란에 제작자를 적는다. v2는 화면에 출처 배지를 띄우지 않는다. 페이지 주소, 파일 주소, 제작자, 쓴 구간(초)은 `media/doodle/sources.json`(`used_in`)과 각 `edit.json`의 `sources`에 있다. 쓴 구간은 `seconds.py`가 렌더 데이터에서 채운다.

| 파일 | 제작자 | 쓴 곳 |
| --- | --- | --- |
| [7202628](https://www.pexels.com/photo/photograph-of-two-escalators-7202628/) 나란한 에스컬레이터 | SpotwizardLee | doodle11 |
| [18764954](https://www.pexels.com/photo/view-of-the-escalator-18764954/) 어두운 에스컬레이터 | Orhan Pergel | doodle11 |
| [5264140](https://www.pexels.com/photo/red-fire-hydrant-on-street-5264140/) 인도의 빨간 소화전 | Brett Sayles | doodle12 |
| [15818611](https://www.pexels.com/photo/zebra-crossing-in-a-town-15818611/) 횡단보도(멀리 주차된 차의 번호판은 읽히지 않음) | Dương Huỳnh Trung | doodle12 |
| [19222549](https://www.pexels.com/photo/waterfront-of-seoul-from-the-hangang-river-19222549/) 한강과 서울 | Muneeb Babar | doodle14 |
| [17967670](https://www.pexels.com/photo/gwangan-bridge-near-skyscrapers-in-busan-south-korea-17967670/) 광안대교 | Junsu Park | doodle14 |
| [38010001](https://www.pexels.com/photo/haeundae-beach-with-skyline-in-south-korea-38010001/) 해운대(사람은 점처럼 작음) | Rüveyda Akkaya | doodle14 |
| [19870620](https://www.pexels.com/photo/empty-seats-on-train-19870620/) 빈 기차 좌석(로고 없음, 통로 끝 작은 실루엣은 알아볼 수 없음) | Budget Bizar | doodle15 |
| [14715657](https://www.pexels.com/photo/empty-train-car-14715657/) 파란 좌석 객차 | Kristina Chuprina | doodle15 |
| [17293343](https://www.pexels.com/photo/white-shirts-on-hangers-17293343/) 옷걸이의 흰 셔츠 | Pew Nguyen | doodle16 |
| [965632](https://www.pexels.com/photo/hanged-assorted-shirts-965632/) 걸린 셔츠들 | Arnie Chou | doodle16 |
| [28576618](https://www.pexels.com/photo/home-laundry-room-with-iron-and-clothes-28576618/) 다리미와 빨래 | Jonathan Borba | doodle16 |

doodle13은 앞 편의 [8533741](https://www.pexels.com/photo/close-up-shot-of-a-smartphone-on-white-surface-8533741/)(빈 화면 휴대폰, Hanna Pad)과 [30027297](https://www.pexels.com/photo/quiet-indoor-restaurant-with-sunlit-tables-30027297/)(빈 식당, Jim Natanauan)을 다시 썼다. 단톡 화면은 우리 그림이다. 어떤 앱의 모양도 따르지 않았고 방 이름은 "○○초 6회 동창회"다.

### 사실과 출처 (2026-10-10 확인)

doodle1, 5, 7은 이야기로 다시 썼지만(아래 "이야기 검토") 대사에 녹인 사실은 v1과 같은 출처에서 왔다. 출처 원문은 위 `doodle1`~`doodle4`, `doodle5`~`doodle10` 절에 있다.
- doodle1 "정부도 멀티탭에 또 연결하지 말랬어": 산업통상부·한국소비자원·국립소방연구원 보도자료(2025-09-04)의 "멀티탭에 또 다른 멀티탭을 연결해 사용하지 말 것"이다. "콘센트, 멀티탭 사고만 5년간 387건"은 같은 자료의 2020~2024년 CISS 접수 387건이다. 제목의 "벌어지는 일"은 룸메이트와의 말다툼과 결말이다. 화재가 났다고 말하지 않는다.
- doodle5: "껍데기 열 자리 중 맨 끝 한 자리가 사육환경 번호", "1번 풀밭(방사), 2번 축사 안(평사), 3·4번 케이지", "앞 네 자리 0823은 8월 23일 산란"은 식약처(2019-08-02)와 농식품부(2019-02-21, 2022-01-20) 자료다. "4번은 한 마리당 A4 한 장보다 좁음"은 4번 기준 0.05㎡/마리와 A4 0.0624㎡를 비교해 계산했다. 엄마가 세일 때문에 4번을 샀다는 결말은 창작이다.
- doodle7: "바늘이 초록 밖이면 압력이 빠진 거라 교체"는 영동소방서 안내 "압력지시계의 바늘이 녹색 범위를 벗어나 있으면 압력 저하로 사용할 수 없으므로 반드시 교체 또는 폐기"에서 왔다. "분말 소화기는 딱 10년", "검사 합격해도 연장은 한 번, 3년뿐"은 인천 서부소방서 안내(2021-09-02)다. 그래서 2010년 제조 소화기는 연장해도 2023년까지다. 문 받침 결말은 창작이다(화면에서는 웃음으로만 쓴다. 소화기를 문 받침으로 쓰라는 뜻이 아니다).

**doodle11 에스컬레이터 두 줄 서기**
- 2007년 정부의 두 줄 서기 캠페인, 2015년 공식 중단: YTN(중앙일보 인용) 2026-04-23. 원문은 2007년 정부가 "안전사고와 설비 고장 문제를 이유로" 두 줄 서기를 시작했고, 2015년 "두 줄 서기 캠페인을 공식 중단하고" 안전수칙으로 바꿨다는 내용이다. https://www.ytn.co.kr/_ln/0103_202604230947373431
- "10년간 중대 사고 135건, 그중 90건이 이용자 과실": 세계일보 2026-08-28(행정안전부 국가승강기정보센터 자료). 원문 "2016년부터 지난해까지 에스컬레이터에서 발생한 중대 사고는 총 135건이다… 이 중 이용자 과실로 발생한 사고가 90건". https://www.segye.com/newsView/20260827516314
- "올해 정부 설문도 49.9 대 50.1, 딱 반반": 더팩트. 2026-08-29 행정안전부 토론회의 사전 설문에서 두 줄 서기가 49.9%, 한 줄 서기와 걷기가 50.1%였다. https://news.tf.co.kr/read/life/2359430.htm
- 정부의 최근 입장(설명란 출처): SBS Biz 2026-09-23 "행안부는 토론 결과를 반영해 일률적인 두 줄 서기 캠페인과 규제는 더 이상 추진하지 않습니다". https://biz.sbs.co.kr/amp/article/20000336458
- 양쪽 입장: 비켜 주는 게 당연하다는 바쁜 사람과 걷기가 위험하다는 도치가 같은 분량으로 말한다. 정부 설문도 반반이다. 끝은 "님은 서는 편? 걷는 편?"이다. 그 사람이 팀장님이었다는 결말은 창작이다. 등장인물은 실존 인물이 아닌 낙서 인물이다.
- 2026-09-23 행정안전부가 일률적인 두 줄 서기 캠페인을 추진하지 않고 3대 안전 수칙(손잡이 잡기, 걷거나 뛰지 않기, 안전선 지키기)에 집중한다고 밝혔다(SBS Biz). v2 대본은 2-1절 7번(설교 금지) 때문에 이 수칙을 화면에서 늘어놓지 않는다. 설명란의 출처에만 둔다.

**doodle12 불법주차 신고** (신고 요건은 사실, 아빠 차 반전은 창작)
- "같은 자리, 같은 각도로 일 분 간격 두 장이요", "앱으로 보내면 단속 공무원 없이 과태료": 서울특별시 교통 누리집 「교통법규 위반차량 '시민신고제' 운영 안내」(2026-03-12 갱신). 원문 "동일한 위치·각도 1분 간격 사진 2장(정지상태 확인)을 통해 주정차 위반지역·차량번호 등이 식별 가능하고 촬영시간이 표출되어 있어야 함"이고, 요건을 갖추면 현장 단속 없이 과태료를 부과한다. https://news.seoul.go.kr/traffic/archives/507047
- "소화전, 횡단보도, 인도 같은 여섯 곳은 일 분이면 주민 신고 대상"(여섯 곳은 소화전 5m, 교차로 모퉁이 5m, 버스 정류소 10m, 횡단보도, 초등학교 정문 앞 어린이 보호구역, 인도): 경기일보 2023-08-02(행정안전부 인용). 원문 "기존 5곳(…)에서 인도를 포함해 총 6곳으로", "모든 지자체의 신고 기준이 1분으로 통일됐고". https://kyeonggi.com/article/20230801580171
- 과태료 금액: 처음에는 "소화전 앞은 승용차 8만 원"이라고 썼다. 근거는 강동구청 보도자료 2019-08-13의 "소화전 주변 5m 이내 주정차 시 과태료가 4만원에서 8만원으로 상향"과 같은 해 8월 1일 「도로교통법 시행령」 개정이었다. 그런데 국가법령정보센터(law.go.kr)의 현행 시행령 [별표 6] 원문은 이 환경에서 열리지 않았다(페이지가 스크립트로만 그려진다). 그래서 숫자를 빼고 "소화전 앞은 과태료가 더 세요"로 바꿔 다시 녹음하고 렌더했다. 일반 구역보다 높다는 점은 위 강동구청 자료(4만 원 → 8만 원)에 근거한다.
- "신고는 안전신문고 앱으로 함": 위 서울시 안내의 신고 채널 "행안부 안전신문고 앱 운영", "행안부 안전신문고 www.safetyreport.go.kr". 안전신문고는 정부(행정안전부) 신고 창구라서 이름을 그대로 썼다. 상업 앱이 아니다.
- 양쪽 입장: 지나가던 이웃이 "잠깐 세운 건데 너무하네"라고 차 주인 편을 든다. 신고하는 도치는 규정으로 답한다. 끝은 아빠 차였다는 반전과 "님이면 신고함? 안 함?"이다(가족이어도 신고할까). 이웃과 아빠는 창작 인물이다.

**doodle14 서울 vs 부산 같은 말 다른 뜻** (뜻은 사실, 장면은 창작. 화면의 "서울"은 표준어를 말하고, 영상 안에서도 그렇게 말한다)
- 정지: 우리말샘의 방언 뜻은 "'부엌'의 방언(강원, 경상, 전라, 제주, 충북)"이고, 표준어 정지(停止)는 "움직이고 있던 것이 멎거나 그침". https://opendict.korean.go.kr/search/searchResult?query=정지
- 정구지: 우리말샘 "'부추'의 방언(경상, 전북, 충청)". https://opendict.korean.go.kr/search/searchResult?query=정구지
- 욕보다: 표준국어대사전 "부끄러운 일을 당하다." 우리말샘 "'수고하다'의 방언(경상)". https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=욕보다 , https://opendict.korean.go.kr/search/searchResult?query=욕보다 (사전에 있는 다른 뜻 하나는 일부러 쓰지 않았다)
- 파이다: 우리말샘 "'나쁘다'의 방언(경상)". 표준어 파이다는 '파다'의 피동인 "구멍이나 구덩이가 만들어지다". https://opendict.korean.go.kr/search/searchResult?query=파이다

**창작 편**(doodle2, 3, 4, 6, 8, 9, 10, 13, 15, 16, 그리고 doodle12의 이야기): 수치나 법령을 말하지 않는다. 실제 업체·앱·식당·세탁소 이름이나 로고는 없다. doodle15는 처음에 제목을 "KTX 의자"로 했다가, 서비스 이름이라 규칙대로 "기차 의자"로 바꿨다. 대사와 자막에는 KTX가 나오지 않는다. 화면의 기차 사진은 로고가 없는 일반 객차다. 영상에는 사실 주장이 없고 매너 논쟁만 있다(젖힐 권리 vs 뒷사람 공간, 그리고 도미노처럼 번지는 결말). 설명란에 "창작"을 적는다.

### 유튜브 설명글 (`upload/` 형식)

`upload/README.md`의 공통 형식으로 16편의 `upload/specs/doodle*.json`을 `media/doodle/v2/specs.py`가 쓴다. 요약은 2~4문장이다. 첫 문장은 상황(사실이 있는 편은 그 사실)이고, 펀치라인은 쓰지 않는다. 사진 크레딧은 edit.json에서 읽고, 사실 출처 기관도 출처 줄에 넣는다. 16편 모두 `fiction: true`라서 요약 앞에 "(창작)"이 붙는다. 해시태그는 `#Shorts`를 빼고 10개다. `python3 upload/make_desc.py doodle<N>`이 `upload/txt/doodle<N>.txt`를 만든다. qa_review의 '설명글' 항목은 16편 모두 PASS다. 채널 이름과 핸들은 아직 `[채널명]`/`[핸들]` 자리표시자다. 아래 "업로드 문구"는 이 형식이 생기기 전의 초안이다. 제목과 고정 댓글은 같고, 설명글은 `upload/txt/`의 것을 쓴다.

### 업로드 문구

제목 끝에는 REVIEW.md 4절대로 ㅋㅋ·ㄷㄷ·?를 붙였다. 고정 댓글은 결말을 말하지 않는 질문이다. 사진 크레딧은 화면 대신 설명란에 모두 적었다.

`doodle1`
- 제목: 멀티탭에 멀티탭 꽂으면 벌어지는 일ㅋㅋ
- 설명:
  ```
  칸 모자라서 3층까지 쌓은 자취방 멀티탭 탑 🔌 잔소리 vs 멀쩡하거든? 끝까지 따라가 봤더니… 님 방 멀티탭은 몇 층? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  출처: 산업통상부·한국소비자원·국립소방연구원 보도자료(2025.9.4: 2020~2024년 CISS 접수 387건, 「멀티탭에 또 다른 멀티탭을 연결해 사용하지 말 것」)
  사진: Pexels (Саша Алалыкин, Nikita Nikitin, Tim Mossholder) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #멀티탭 #전기안전 #생활꿀팁 #짤툰
- 고정 댓글: 님 방 멀티탭, 지금 몇 층까지 쌓여 있음? 🔌

`doodle2`
- 제목: 중고거래 네고 선 넘으면 벌어지는 일ㅋㅋ
- 설명:
  ```
  만 원짜리 의자 올렸다가 배송비 낼 뻔한 썰 🪑 님들이 받아본 최강 네고는? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Gizem Gökce, Tima Miroshnichenko) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #중고거래 #네고 #공감 #짤툰
- 고정 댓글: 지금까지 받아본 네고 중 제일 선 넘은 거 적고 가기 👇

`doodle3`
- 제목: 하차벨 아무도 안 누르면 벌어지는 일ㅋㅋ
- 설명:
  ```
  누가 누르겠지… 하다가 네 명이 같이 걸어간 썰 🚌🔔 님들은 벨 먼저 누르는 쪽? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Elina Volkova, Pramod Tiwari) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #버스 #하차벨 #눈치게임 #짤툰
- 고정 댓글: 벨 먼저 누르는 쪽 🙋 vs 남이 누르길 기다리는 쪽 🙄 님은?

`doodle4`
- 제목: "냉장고에 있잖아" 엄마 vs 나ㅋㅋ
- 설명:
  ```
  10분 찾아도 없던 김치, 엄마는 1초 컷 🫙 근데 그 김치 어디서 나왔냐면… 님 집 엄마도 이런 적 있음? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Polina Tankilevitch, thAnh nguyễn, Max Vakhtbovych, cottonbro studio) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #엄마 #냉장고 #공감 #짤툰
- 고정 댓글: 님 집 냉장고에도 엄마 눈에만 보이는 칸 있음? 😂

`doodle5`
- 제목: 계란 1번 vs 4번 진짜 차이 ㄷㄷ
- 설명:
  ```
  4번 계란 사 왔다가 엄마한테 혼난 썰 🥚 끝자리는 닭이 사는 집! 근데 엄마 냉장고 계란은…? 님 냉장고 계란은 몇 번? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  출처: 식품의약품안전처(2019.8.2), 농림축산식품부(2019.2.21, 2022.1.20) 난각표시 안내
  사진: Pexels (thAnh nguyễn, Marcello Sokal, Ben Molyneux, Alexas Fotos, Magda Ehlers, Klaus Nielsen) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #계란 #난각번호 #생활꿀팁 #짤툰
- 고정 댓글: 지금 냉장고 계란 마지막 숫자 몇 번인지 확인하고 댓글 ㄱㄱ 🥚

`doodle6`
- 제목: 팀장님 "넵." 받으면 벌어지는 일ㅋㅋ
- 설명:
  ```
  같은 넵인데 마음은 다 다름 📱 마지막 단계는 진짜 공포… 님은 주로 몇 단계 넵 씀? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Hanna Pad, Cup of Couple, cottonbro studio, Letícia Alvares) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #회사생활 #넵 #직장인공감 #짤툰
- 고정 댓글: 님이 제일 많이 쓰는 넵은 몇 단계? 1~7 숫자로 ㄱㄱ

`doodle7`
- 제목: 소화기 바늘 초록 밖이면 벌어지는 일ㅋㅋ
- 설명:
  ```
  2010년산 소화기 바꾸자 vs 멀쩡한 걸 왜 버려 🧯 숫자로 아빠를 이겼는데 다음 날… 님 집 소화기 바늘, 지금 초록임? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  출처: 충북 영동소방서·인천 남동소방서·인천 서부소방서·서산소방서 소화기 관리 안내(압력계 녹색 범위, 분말 소화기 내용연수 10년, 성능 확인 검사 합격 시 1회 3년 연장)
  사진: Pexels (Jakub Zerdzicki, Mohsen Adelimoghaddam, Tibor Szabo) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #소화기 #화재안전 #생활꿀팁 #짤툰
- 고정 댓글: 지금 소화기 바늘 보고 오기 🧯 초록이었음?

`doodle8`
- 제목: 카페 진동벨 울리면 벌어지는 일ㅋㅋ
- 설명:
  ```
  10분째 조용한 진동벨, 들고 카운터 갔더니 손에서 부르르… 근데 그 벨 🔔 님은 벨 울리면 몇 초 만에 일어남? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Sander Dalhuisen, Gabriel, Arda Kaykısız, Pavel Danilyuk, Chevanon Photography) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #카페 #진동벨 #공감 #짤툰
- 고정 댓글: 진동벨 울리면 몇 초 만에 일어남? ⏱️

`doodle9`
- 제목: 식당 직원 부를 때 "여기요" vs "저기요"
- 설명:
  ```
  손 반쯤 들었다가 머리 긁는 척한 사람 🙋 결국 최강은 따로 있음. 님은 여기요? 저기요? 이모님? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Jim, Cynthia Ortega Espinosa, Maria Orlova, Lio Photography) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #식당 #여기요 #저기요 #짤툰
- 고정 댓글: 여기요파 🙋 / 저기요파 🗣️ / 이모님파 👑 님은?

`doodle10`
- 제목: 새벽 3시 편의점 수상한 손님의 정체
- 설명:
  ```
  매일 새벽 3시, 말없이 컵라면 먹고 가던 손님 🌙 비 오던 날 내민 건… 님은 이런 손님 만나 봄? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (El Jundi, Markus Winkler, Denniz Futalan, More Amore) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #편의점 #알바 #훈훈 #짤툰
- 고정 댓글: 알바하면서 만난 제일 기억에 남는 손님은? 🌙

`doodle11`
- 제목: 현재 논란중인 에스컬레이터 2줄 서기
- 설명:
  ```
  출근 첫날 왼쪽에 섰다가 "바빠요!" 🚶 두 줄 서기 vs 비켜 주기, 정부 설문도 49.9 대 50.1. 근데 그 아저씨 정체가… (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  출처: 세계일보(2026.8.28, 행정안전부 국가승강기정보센터 2016~2025 중대사고 135건·이용자 과실 90건), 더팩트(2026.8 토론회 사전 설문), SBS Biz(2026.9.23 행정안전부 발표), YTN(2026.4.23, 2007년 두 줄 서기·2015년 중단)
  사진: Pexels (SpotwizardLee, Orhan Pergel) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #에스컬레이터 #두줄서기 #논란 #짤툰
- 고정 댓글: 님은 서는 편 🧍 vs 걷는 편 🚶? 이유도 같이!

`doodle12`
- 제목: 불법주차 신고하면 벌어지는 일 ㄷㄷ
- 설명:
  ```
  소화전 앞 빨간 차, 1분 간격 사진 두 장 📸 신고 요건은 진짜, 마지막 반전은 창작. 님이면 신고함? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  출처: 서울특별시 교통 누리집 「교통법규 위반차량 시민신고제 운영 안내」(2026.3.12 갱신: 같은 위치·각도 1분 간격 사진 2장, 현장 단속 없이 과태료), 경기일보(2023.8.2, 행정안전부: 주민신고 6대 구역·1분 기준), 강동구청 보도자료(2019.8.13, 소화전 5m 이내 과태료 상향)
  사진: Pexels (Brett Sayles, Dương Huỳnh Trung) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Scheming Weasel" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #불법주차 #안전신문고 #소화전 #짤툰
- 고정 댓글: 가족 차여도 신고한다 🙋 vs 일단 전화부터 📞 님은?

`doodle13`
- 제목: 읽기만 해도 기빨리는 동창회 단톡 현실
- 설명:
  ```
  알림 32개, 공지 7줄 📢 근데 반장 입장도 있음… 참석 체크한 3명의 정체는? 님 단톡에도 이런 반장 있음? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Hanna Pad, Jim) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Hustle" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #동창회 #단톡 #공감 #짤툰
- 고정 댓글: 공지 길게 쓰는 반장 vs 읽고 답 안 하는 단톡방, 누가 더 잘못? 🤔

`doodle14`
- 제목: 서울 vs 부산 같은 말 다른 뜻ㅋㅋ
- 설명:
  ```
  정지 = 부엌, 정구지 = 부추, 욕봤다 = 수고했다 🌿 부산 친구 집에서 배운 말로 인사했더니… 님 동네에도 이런 말 있음? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  뜻 출처: 국립국어원 우리말샘·표준국어대사전(정지·정구지·욕보다·파이다·단디 표제어, 2026.10.10 확인). 화면의 '서울'은 표준어 기준입니다.
  사진: Pexels (Muneeb Babar, Junsu Park, Rüveyda Akkaya) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #부산사투리 #경상도사투리 #서울vs부산 #짤툰
- 고정 댓글: 님 동네에서만 쓰는 말 하나씩 적고 가기 👇

`doodle15`
- 제목: 현재 논란중인 기차 의자 끝까지 젖히기?
- 설명:
  ```
  의자 끝까지 젖히는 건 권리? 뒷사람 무릎은? 💺 한 번 젖혔더니 도미노가 시작됨. 님은 끝까지? 반만? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Budget Bizar, Kristina Chuprina) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Hyperfun" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #기차 #의자젖히기 #논란 #짤툰
- 고정 댓글: 끝까지 젖힌다 💺 vs 반만 젖힌다 🙂 vs 안 젖힌다 🙅 님은?

`doodle16`
- 제목: 동네 세탁소 사장님의 미친 기억력 비결
- 설명:
  ```
  번호표도 장부도 없이 내 셔츠를 꺼내는 사장님 👔 비결은 얼룩…? 일주일 뒤 셔츠에 생긴 일. 님 동네에도 이런 사장님 있음? (창작)
  창작 짤툰입니다. 등장인물과 이야기는 실제와 관계없으며 특정 업체·앱·단체와 무관합니다. 영상 속 수치와 규정은 아래 출처에 따른 사실입니다.
  사진: Pexels (Pew Nguyen, Arnie Chou, Jonathan Borba) · 캐릭터와 배경 그림은 직접 그린 그림입니다.
  Music: "Sneaky Snitch" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/
  ```
- 해시태그: #세탁소 #동네사장님 #훈훈 #짤툰
- 고정 댓글: 님 동네 단골집 사장님의 미친 기억력 썰 풀고 가기 👇


## "○○ 특" v2 (벤치마크, `teuk1`~`teuk14`)

`research/benchmark-drawn.md` 3절과 `research/benchmark-targets-drawn.json`의 `teuk` 목표(자체공감 「곱창 특」 98.7만, 「바나나 우유 특」 96.9만)에 맞춰 v1 8편을 다시 만들고 6편을 새로 만들었다. 2026-10-10 이야기 검토(REVIEW.md 2-1절)로 대본을 한 번 더 고쳤다.

**바뀐 점 (v1 → v2)**

- 제목은 한 줄 "○○ 특"(3~7자)이다. 제목을 읽는 첫 줄을 없애고, 0초부터 첫 항목과 가장 센 리액션 그림이 나온다.
- 위쪽 검정 띠가 없다. 어두운 단색 바탕(편마다 색이 조금 다름)이고, 오른쪽 위에 마스코트 로고, 가운데 그림 칸(1080×1160), 아래에 흰 글씨 2줄 관찰체 자막이 있다. 강조색과 단어 하이라이트는 없다.
- 첫 항목은 짧은 훅 줄(1~1.4초)과 그다음 줄로 나눴다. 첫 줄 끝(훅 끝)이 1.0~1.7초다.
- 항목마다 그림 종류가 바뀐다. 마스코트 클로즈업(정면 꽉 차게, 왼쪽, 오른쪽, 아래에서 올라옴, 기울임, 효과선, 땀, 김, 하트, 불꽃), 사진(Wikimedia Commons, 반응 원형 인서트), 그린 장면(`Sseol.tsx`)을 섞는다.
- 내레이터 속도를 올렸다(SunHi +32%, Hyunsu +40%, 실측 6.3~6.9음절/초). "나"의 반응 줄은 7줄에서 2줄로 줄였고, 말풍선 대신 따옴표 자막으로 넣었다.
- 번호 목록("1. 알람 다섯 번 끄기")을 없애고 "~함/~음" 관찰체 문장으로 썼다. 끝은 "여러분은 몇 개 해당?ㅋㅋ"와 "나"의 펀치라인 한 줄이다.
- 화면에 출처 배지가 없다. 사진 크레딧은 모두 설명란(`upload/txt/<id>.txt`)에 있다.

### 새 템플릿 옵션 (`src/lib/Teuk.tsx`, 기존 쇼츠는 그대로)

- `edit.json` 최상위에 `"layout": "teuk"`를 두면 `ClipShort`가 영상 전체를 `TeukShort`에 넘긴다(`src/ClipShort.tsx`에 import 1줄, 타입 2줄, `return` 1줄). `"teuk": {"bg": "#2e2321", "mascot": "#FFB36B"}`로 바탕색과 마스코트 색을 정한다.
- 클립의 `gfx.type`은 세 가지다. `"face"`는 마스코트 리액션 클로즈업이다(`mood`, `to`, `pos`: close·left·right·low·tilt, `fx`: lines·sweat·steam·gloom·sparkle·fire·hearts, `burst`, `prop`·`propX`·`propY`, `big`, `say`, `steps` = [표정 바뀌는 때, 말풍선, 큰 글씨]). `"photo"`는 클립의 `src` 사진을 천천히 확대해 보여 준다(`react`: 반응 원형 인서트 {mood, to, side, size}, `tag`, `big`, `zoom`, `pos`, `steps` = [인서트, 태그, 큰 글씨, 인서트 표정 바뀜]). `"scene"`은 기존 `Sseol.tsx` 장면이다.
- 자막: `prep.py`가 `layout: teuk`일 때 자막 페이지마다 `"g"`(대사 id:자막 번호)를 붙이고, `TeukShort`가 같은 `g`의 페이지를 2줄로 함께 띄운다. `cap`의 `/`가 줄바꿈이다. qa_review는 줄마다 글자 수를 잰다. 첫 자막은 0초부터, 마지막 자막은 영상 끝까지 보인다.
- 만드는 도구(`media/teuk/`): `episodes.py`(대본·그림), `make.py`(script.json·edit.json 생성), `fetch.py`(Commons 라이선스 확인 `resolve`, 사진 내려받기), `score.py`(벤치마크 점수표), `upload.py`(설명글 spec), `readme.py`(이 절).
- 하위 호환 확인: 템플릿을 바꾸기 전과 후에 `sseol1`(바꾸지 않은 썰 쇼츠)의 `src/data/sseol1.json`이 바이트 단위로 같고, 프레임 0·45·200·400·700의 정지 화면 md5가 모두 같았다.

```bash
python3 media/teuk/make.py teuk9 && python3 media/teuk/fetch.py teuk9 && python3 voice_edge.py teuk9 && python3 prep.py teuk9 \
  && ./render.sh teuk9 final/teuk9.mp4 && python3 qa_review.py teuk9 && python3 media/teuk/score.py teuk9
```

### 편 목록과 노리는 공감 포인트

| id | 화면 제목 | 노리는 공감 포인트 | 결말 유형 | 감정 | 음악 |
| --- | --- | --- | --- | --- | --- |
| `teuk1` | 월요일 아침 특 | 알람 이름까지 '진짜_최종_마지막'으로 바꿔 가며 버틴 아침이 겨우 오전 10시라는 허탈함 | 허탈 개그 | 공감 | Hustle |
| `teuk2` | 시험 기간 특 | 시험 전날에만 생기는 정리 욕구, 끝나고 나서야 잘되는 공부 | 역전(끝나니까 공부가 됨) | 웃음 | Sneaky Snitch |
| `teuk3` | 급식 특 | 4교시 메뉴 확인부터 국자 한 번 더까지, 졸업하고 나서야 그리운 급식 | 따뜻한 반전 | 뭉클한 공감 | Monkeys Spinning Monkeys |
| `teuk4` | 단톡방 특 | 알림 끄고 몰래 읽는 나, 정작 조용해지면 먼저 '심심해' 보내는 나 | 자기 폭로 반전 | 웃음 | Hyperfun |
| `teuk5` | 자취 첫 달 특 | 냄비가 그릇, 대파 한 단, 마지막 휴지 한 칸, 결국 본가 가는 날만 기다리는 첫 달 | 의외의 결말(자유 → 본가 그리움) | 공감 | Scheming Weasel (faster version) |
| `teuk6` | 비 오는 날 특 | 우산의 법칙과 밀가루 없는 파전, 집에 오자마자 그치는 비 | 허탈 개그 | 웃음 | Monkeys Spinning Monkeys |
| `teuk7` | 헬스장 첫 주 특 | 1년 회원권, 다음 날 계단, 운동 후 치킨, 결국 샤워만 하고 오는 헬스장 | 허탈 개그 | 웃음 | Exhilarate |
| `teuk8` | 월급날 특 | 입금 알림 대기부터 '내가 쏜다' 후회, 이틀 만에 원래 잔고 | 허탈 개그 | 공감 | Hustle |
| `teuk9` | 떡볶이 특 | 1인분 → 볶음밥, 단무지 리필, 어묵 국물 눈치, '당분간 안 먹어' 다음 날 또 추천 | 자기 배신 반전 | 웃음 | Hyperfun |
| `teuk10` | 컵라면 특 | 보이지 않는 물 선, 1분째 젓가락 대기, 고르는 데 20분·먹는 데 3분 | 자기 배신 반전 | 웃음 | Sneaky Snitch |
| `teuk11` | 붕어빵 특 | 팥 vs 슈크림 → 둘 다, 머리·꼬리 성격, 3마리 → 1마리, 지도에 몰래 별표 | 의외의 결말(혼자만 아는 가게) | 웃음 | Monkeys Spinning Monkeys |
| `teuk12` | 삼겹살 특 | 굽는 사람은 못 먹고, 엘리베이터에서 메뉴가 들키고, 마지막 한 점은 아무도 안 먹는 고깃집 | 펀치라인(그 한 점 내가 먹을게) | 웃음 | Hustle |
| `teuk13` | 길치 특 | 뒤를 가리키는 화살표, 출구 번호, 오른쪽 하면 왼쪽부터, 근데 맛집 가는 길은 한 번에 | 역전(맛집만 직진) | 웃음 | Scheming Weasel (faster version) |
| `teuk14` | 눈치 없는 사람 특 | '이거 누가 시켰어요?', 스포, 깜짝 파티 장소 질문 → 근데 제일 착한 친구 → 혹시 나야? | 따뜻한 반전 + 자기 폭로 | 웃음과 공감 | Sneaky Snitch |

### 벤치마크 점수표

벤치마크 값은 `benchmark-targets-drawn.json`의 `teuk`이다(길이·훅·컷·음절 속도는 보고서가 *추정*으로 표시한 값). 우리 값은 렌더(`final/<id>.mp4`, qa_review와 같은 그림 칸·장면 기준 0.12)와 목소리 타임라인(`build/<id>/timeline.json`, 한글 음절 수 ÷ 대사 길이 합, 줄 사이 쉼 제외)에서 쟀다. `python3 media/teuk/score.py <id>`로 다시 잴 수 있다.

| 편 | 길이 | 훅 끝 | 첫 화면 변화 | 평균 / 최장 장면 | 음절/초 | 줄 수 | 제목 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 목표 | 28초 | 1.5초 | 1.5초 | 2.2 / 3.5초 | 6.5 | 14 | 3~7자 |
| `teuk1` 월요일 아침 특 | 28.4초 | 1.36초 | 1.60초 | 2.03 / 2.77초 | 6.76 | 14 | 6자 |
| `teuk2` 시험 기간 특 | 28.9초 | 1.34초 | 1.60초 | 1.92 / 2.77초 | 6.43 | 14 | 5자 |
| `teuk3` 급식 특 | 28.6초 | 0.98초 | 1.23초 | 1.90 / 2.63초 | 6.84 | 14 | 3자 |
| `teuk4` 단톡방 특 | 27.7초 | 1.11초 | 1.37초 | 1.73 / 3.37초 | 6.30 | 14 | 4자 |
| `teuk5` 자취 첫 달 특 | 27.3초 | 1.19초 | 1.43초 | 1.95 / 3.17초 | 6.94 | 14 | 5자 |
| `teuk6` 비 오는 날 특 | 27.5초 | 1.16초 | 1.40초 | 1.96 / 2.70초 | 6.40 | 14 | 5자 |
| `teuk7` 헬스장 첫 주 특 | 25.4초 | 1.14초 | 1.40초 | 1.81 / 2.57초 | 6.77 | 14 | 6자 |
| `teuk8` 월급날 특 | 27.4초 | 1.70초 | 1.97초 | 1.95 / 2.80초 | 6.38 | 14 | 4자 |
| `teuk9` 떡볶이 특 | 29.5초 | 1.27초 | 1.53초 | 2.11 / 3.27초 | 6.72 | 13 | 4자 |
| `teuk10` 컵라면 특 | 30.3초 | 1.34초 | 1.60초 | 2.16 / 3.13초 | 6.36 | 14 | 4자 |
| `teuk11` 붕어빵 특 | 27.6초 | 1.20초 | 1.47초 | 1.97 / 2.90초 | 6.51 | 13 | 4자 |
| `teuk12` 삼겹살 특 | 28.8초 | 1.12초 | 1.37초 | 2.06 / 3.37초 | 6.85 | 14 | 4자 |
| `teuk13` 길치 특 | 27.6초 | 1.28초 | 1.53초 | 1.97 / 2.63초 | 6.66 | 14 | 3자 |
| `teuk14` 눈치 없는 사람 특 | 29.0초 | 1.01초 | 1.27초 | 1.93 / 2.83초 | 6.60 | 14 | 7자 |

**목표와 다른 점**

- 길이는 25.4~30.3초(중앙값 28.5초)로 목표(28초, 25~35초) 안이다. 가장 짧은 teuk7(25.4초)은 항목 문장이 짧은 편이다.
- 음절 속도는 6.30~6.94음절/초로 모두 6.2 이상이다(목표 6.5, v1 중앙값 5.27).
- 훅 끝: 첫 줄을 짧게 나눠 1.0~1.7초로 목표(1.5초)에 맞췄다.
- 평균 장면 길이는 목표(2.2초)보다 조금 짧거나 비슷하다. 줄마다 그림을 바꾸고, 사진 클립의 반응 인서트가 뜨는 순간도 화면 변화로 잡힌다.
- 줄 수는 13~14줄로 목표(14, 12~16)에 맞췄다. teuk9·teuk11은 항목이 길어 13줄이다.
- 제목 길이: `눈치 없는 사람 특`은 7자로, 목표 범위(3~7자)의 끝이다. 보고서 아이디어 목록의 제목(자체공감 「눈치 없는 사람 특」 117만)을 그대로 썼다.
- qa_review의 '제목 띠' WARN은 의도한 것이다. 벤치마크 레시피가 "위 제목 띠 없음"이라서 띠를 뺐다.

### 이야기 검토 (REVIEW.md 2-1, 2026-10-10)로 다시 쓴 항목

흔한 말, 구체적이지 않은 말, 마지막이 약한 항목을 바꿨다. 마지막 항목은 꺾이거나 가장 세게 했다. 바꾼 뒤 모두 다시 녹음하고 다시 렌더했다.

- `teuk1`: 일어나는 게 기본 → 마지막 알람 이름이 '진짜_최종_마지막' · 회사 앞 깊은 한숨 → 출입 카드 '삑' 소리가 하루 중 제일 슬픔 · 커피 마셔야 사람 됨 → 커피 전엔 메일을 읽어도 글자가 안 들어옴 · 출근하자마자 점심 고민(마지막) → 이렇게 버텼는데 아직 오전 10시
- `teuk2`: 새벽 3시 배고픔 → 새벽 3시에 갑자기 방 구조 바꾸고 싶음 · 벼락치기 중 인생 고민(마지막) → 시험 끝나고 나니까 공부가 제일 잘됨
- `teuk3`: 디저트 날은 하루 종일 행복 → 국자가 한 번 더 오면 그날은 대성공 · 우유 원샷(마지막) → 졸업하고 나니까 그 급식이 제일 그리움
- `teuk4`: 나가기 버튼 100번(마지막) → 막상 조용해지면 내가 먼저 '심심해' 보냄
- `teuk5`: 엄마 반찬이 세상에서 제일 맛있음 → 엄마 반찬통 돌려줄 때 빈 통 미안해서 과자 넣음 · 관리비 고지서 보고 깜짝(마지막) → 자유롭다더니 한 달 뒤 본가 가는 날만 기다림
- `teuk6`: 양말 젖으면 하루 종일 찝찝 → 젖은 운동화에서 하루 종일 '찌걱' 소리 · 비 오면 괜히 파전 생각 → 파전 해 먹자 했는데 밀가루가 없음
- `teuk7`: 사흘째부터 갈까 말까(마지막) → 결국 1년 회원권으로 샤워만 하고 옴
- `teuk8`: 고생한 나한테 선물 → '오늘은 내가 쏜다' 계산할 때 살짝 후회 · 다음 월급날 세기(마지막) → 이틀 만에 잔고가 월급 전이랑 같아짐
- `teuk9`: 맵다 맵다 하면서 젓가락 안 멈춤 → 맵다면서 단무지만 세 번 리필 · 어묵은 마지막에 먹어야 제맛 → 포장마차 어묵 국물 세 번째 컵부터 눈치 · 떡파 vs 어묵파 → 떡만 골라 먹는 친구랑 먹으면 어묵만 산더미 · 튀김 국물에 퐁당 → 김말이 찍는 순간 반은 국물 속으로 · 다음 날 또 생각남(마지막) → '당분간 안 먹어' 해 놓고 다음 날 점심에 또 추천
- `teuk10`: 2분 반에 뚜껑 → 1분째 젓가락 들고 대기 · 밤 11시엔 세상에서 제일 맛있음 → 붓기는 내일의 나에게 · 김치 없으면 허전 → 뚜껑 접어서 앞접시로 쓰는 건 국룰 · 하나 더 땡김 → 고르는 데 20분, 먹는 데 3분 · 다음 날 얼굴 퉁퉁(마지막) → '다음엔 다른 맛' 다짐하고 또 같은 맛
- `teuk11`: 입천장 데임 → 한 입에 입천장 데고 말 잃음 · 식으면 데워 먹음 → 천 원에 몇 마리인지로 물가 체감 · 파는 곳 찾으면 보물 찾은 기분(마지막) → 파는 곳 발견하면 지도에 몰래 별표
- `teuk12`: 옷 냄새는 집에 가서야 앎 → 엘리베이터 탄 사람들이 내 저녁 메뉴 맞힘 · 냄새 맡으면 또 배고픔 → '불판 갈아 드릴까요?' 배부른데 '네!' · 쌈장으로 밥 한 공기 → 마늘 안 먹는다더니 불판 위 마늘만 노림
- `teuk14`: 단체 사진에서 눈 감음(눈치와 무관) → 깜짝 생일 파티 장소를 주인공 앞에서 물어봄

### 사진 출처와 라이선스

Pexels와 Pixabay를 먼저 시도했지만, 두 사이트 모두 이 환경에 봇 확인 화면(Cloudflare)을 돌려줘서 항목별 라이선스 페이지를 열 수 없었다. 그래서 쓰지 않았다. 대신 Wikimedia Commons에서 CC0, 퍼블릭 도메인, CC BY 파일만 골랐다(BY-SA, NC, ND 제외). 라이선스는 각 파일 페이지의 메타데이터(imageinfo extmetadata)에서 2026-10-10에 확인했다(`media/teuk/fetch.py resolve`). 모든 사진을 큰 크기로 보고 상표, 가게 이름, 앱 아이콘, 알아볼 수 있는 얼굴이 없는 것만 남겼다. 컵라면 제품 사진은 위에서 내려다본 컵 속만 보이는 것만 썼다. 물 끓이는 주전자 사진은 각인된 글씨 때문에, 학교 급식 사진은 군 관련 사진뿐이라서 뺐다. 각 파일의 페이지 주소, 파일 주소, 라이선스, 작가, 쓴 구간은 `media/teuk/photos.json`과 각 `edit.json`의 `sources`에 있다. 화면에는 크레딧을 넣지 않고 설명란에 넣는다.

| 사진 키 | 파일 (Commons) | 작가 | 라이선스 | 쓴 편 (초) |
| --- | --- | --- | --- | --- |
| `alarm` | [Alarm clock on a chair (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Alarm_clock_on_a_chair_(Unsplash).jpg) | Szűcs László szucslaszlo | CC0 | teuk1 3.7~4.8 |
| `alley1` | [Bukchon, Seoul - Bukchon3283.jpg](https://commons.wikimedia.org/wiki/File:Bukchon,_Seoul_-_Bukchon3283.jpg) | lumoplank | CC0 | teuk13 3.6~5.6 |
| `bungeo1` | [Taiyaki - cut section.jpg](https://commons.wikimedia.org/wiki/File:Taiyaki_-_cut_section.jpg) | 毒島みるく | CC0 | teuk11 0.0~1.5 |
| `bungeo2` | [Bungeoppang-01.jpg](https://commons.wikimedia.org/wiki/File:Bungeoppang-01.jpg) | Siqbal at en.wikipedia | Public domain | teuk11 10.1~12.3 |
| `bungeo3` | [시장 2.jpg](https://commons.wikimedia.org/wiki/File:%EC%8B%9C%EC%9E%A5_2.jpg) | Chae Ji-young | CC BY 4.0 | teuk11 21.3~23.9 |
| `bungeo4` | [Taiyaki 003.jpg](https://commons.wikimedia.org/wiki/File:Taiyaki_003.jpg) | Ocdp | CC0 | teuk11 23.9~25.2 |
| `cake` | [Piece of chocolate cake on a white plate decorated with chocolate sauce.jpg](https://commons.wikimedia.org/wiki/File:Piece_of_chocolate_cake_on_a_white_plate_decorated_with_chocolate_sauce.jpg) | Daria Yakovleva (minor edits by Subsidiary account) | CC0 | teuk14 26.1~27.4 |
| `calendar` | [WallCalendar.jpg](https://commons.wikimedia.org/wiki/File:WallCalendar.jpg) | Claudio Elias | Public domain | teuk8 21.5~24.0 |
| `cart` | [Mini grocery toy pushcart.jpg](https://commons.wikimedia.org/wiki/File:Mini_grocery_toy_pushcart.jpg) | Me (Elsa Versailles) | Public domain | teuk8 11.5~13.5 |
| `chicken` | [Korean fried chicken 5.jpg](https://commons.wikimedia.org/wiki/File:Korean_fried_chicken_5.jpg) | insatiablemunch | CC BY 2.0 | teuk3 9.4~11.9, teuk7 13.2~15.1 |
| `coffee` | [Cappuchino latte art.jpg](https://commons.wikimedia.org/wiki/File:Cappuchino_latte_art.jpg) | Blanka Novotná | Public domain | teuk1 15.8~18.6 |
| `crossroad` | [An Example of Raised Crosswalks near Sogang University 2.jpg](https://commons.wikimedia.org/wiki/File:An_Example_of_Raised_Crosswalks_near_Sogang_University_2.jpg) | Monotaxism | CC0 | teuk13 9.3~11.4 |
| `cup` | [Cup Noodle Zeitaku-nikumori-Dandanmian.jpg](https://commons.wikimedia.org/wiki/File:Cup_Noodle_Zeitaku-nikumori-Dandanmian.jpg) | 毒島みるく | CC0 | teuk10 0.0~1.6 |
| `cup2` | [Cup Noodle Zeitaku-toromi-fukahire-soup.jpg](https://commons.wikimedia.org/wiki/File:Cup_Noodle_Zeitaku-toromi-fukahire-soup.jpg) | 毒島みるく | CC0 | teuk10 2.9~5.7 |
| `desk` | [Working on a planning session with stationery items, notebook, and colorful pencils on a wooden desk.jpg](https://commons.wikimedia.org/wiki/File:Working_on_a_planning_session_with_stationery_items,_notebook,_and_colorful_pencils_on_a_wooden_desk.jpg) | Shixart1985 | CC BY 2.0 | teuk2 26.5~28.9 |
| `dumbbell` | [Exercise equipment (rubber ball, light-weight dumbbells, jump rope).jpg](https://commons.wikimedia.org/wiki/File:Exercise_equipment_(rubber_ball,_light-weight_dumbbells,_jump_rope).jpg) | CDC/ Debora Cartagena | Public domain | teuk7 8.4~10.4 |
| `fried_kimchi` | [Kimchi fried rice.jpg](https://commons.wikimedia.org/wiki/File:Kimchi_fried_rice.jpg) | Sharon Ang | CC0 | teuk9 1.5~4.0 |
| `fried_pan` | [Kimchi-bokkeum-bap (Kimchi fried rice) - Kogi 2023-09-11.jpg](https://commons.wikimedia.org/wiki/File:Kimchi-bokkeum-bap_(Kimchi_fried_rice)_-_Kogi_2023-09-11.jpg) | Andy Li | CC0 | teuk12 14.8~16.8 |
| `greenonion` | [Beijing scallions.jpg](https://commons.wikimedia.org/wiki/File:Beijing_scallions.jpg) | Fumikas Sagisavas | CC0 | teuk5 5.7~7.9 |
| `greenonion2` | [CSA-Red-Spring-Onions.jpg](https://commons.wikimedia.org/wiki/File:CSA-Red-Spring-Onions.jpg) | Evan-Amos | Public domain | teuk5 23.9~25.2 |
| `grill1` | [Samgyeopsal-gui 1.jpg](https://commons.wikimedia.org/wiki/File:Samgyeopsal-gui_1.jpg) | chomjong | CC BY 2.0 | teuk12 0.0~1.4 |
| `grill2` | [Korean.food-Samgyeopsal-02.jpg](https://commons.wikimedia.org/wiki/File:Korean.food-Samgyeopsal-02.jpg) | Blue Lotus (a flickr user) | CC BY 2.0 | teuk12 8.7~11.4 |
| `grill3` | [Samgyeopsal-gui.jpg](https://commons.wikimedia.org/wiki/File:Samgyeopsal-gui.jpg) | jinsoo jang | CC0 | teuk12 26.6~28.8 |
| `kimchi` | [Korean cuisine-Kimchi-08.jpg](https://commons.wikimedia.org/wiki/File:Korean_cuisine-Kimchi-08.jpg) | Jeremy Keith | CC BY 2.0 | teuk3 24.9~26.1 |
| `lastslice` | [Pepperoni pizza slice on a red plate.jpg](https://commons.wikimedia.org/wiki/File:Pepperoni_pizza_slice_on_a_red_plate.jpg) | MVS9966 | CC BY 3.0 | teuk14 13.3~15.6 |
| `map` | [World Map 1689.JPG](https://commons.wikimedia.org/wiki/File:World_Map_1689.JPG) | Gerard van Schagen | Public domain | teuk13 25.6~27.6 |
| `notes` | [Personal organizer with metallic ring binder.jpg](https://commons.wikimedia.org/wiki/File:Personal_organizer_with_metallic_ring_binder.jpg) | Old Photo Profile | CC BY 2.0 | teuk2 3.7~5.7 |
| `pajeon` | [Korean pancake-Pajeon-08.jpg](https://commons.wikimedia.org/wiki/File:Korean_pancake-Pajeon-08.jpg) | Jamie | CC BY 2.0 | teuk6 10.9~13.6 |
| `phone` | [Smartphone display screen.jpg](https://commons.wikimedia.org/wiki/File:Smartphone_display_screen.jpg) | Skitterphoto | CC0 | teuk4 14.3~16.6 |
| `pot` | [Ramyeon and kimchi.jpg](https://commons.wikimedia.org/wiki/File:Ramyeon_and_kimchi.jpg) | Hyeon-Jeong Suk | CC BY 2.0 | teuk5 2.9~4.5 |
| `rainwindow` | [Clear Umbrella Rain Liverpool (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Clear_Umbrella_Rain_Liverpool_(Unsplash).jpg) | freddie marriage fredmarriage | CC0 | teuk6 5.3~6.5 |
| `ramyeon` | [20200804 033546 Ramyeon IMG 8515.jpg](https://commons.wikimedia.org/wiki/File:20200804_033546_Ramyeon_IMG_8515.jpg) | Choi Kwang-mo | CC0 | teuk10 17.2~19.6 |
| `ssam` | [Samgyeopsal table.jpg](https://commons.wikimedia.org/wiki/File:Samgyeopsal_table.jpg) | 이동원 | CC0 | teuk12 6.3~8.7 |
| `stairs` | [Stairs steps.jpg](https://commons.wikimedia.org/wiki/File:Stairs_steps.jpg) | Knites | CC0 | teuk7 10.4~12.0 |
| `steak` | [Steak, carrots, bok choy, sweet peppers, and mashed potatoes - Massachusetts.jpg](https://commons.wikimedia.org/wiki/File:Steak,_carrots,_bok_choy,_sweet_peppers,_and_mashed_potatoes_-_Massachusetts.jpg) | Daderot | CC0 | teuk8 6.8~8.7 |
| `tbk_cheese` | [Korean food at Tteokbokki restaurant in Shin-Okubo 3.jpg](https://commons.wikimedia.org/wiki/File:Korean_food_at_Tteokbokki_restaurant_in_Shin-Okubo_3.jpg) | Syced | CC0 | teuk9 16.9~19.9 |
| `tbk_eomuk` | [Korean.snacks-Tteokbokki-08.jpg](https://commons.wikimedia.org/wiki/File:Korean.snacks-Tteokbokki-08.jpg) | jetalone (flickr) | CC BY 2.0 | teuk9 7.6~10.6 |
| `tbk_fork` | [Tteokbokki Bunsik Korean food 02.jpg](https://commons.wikimedia.org/wiki/File:Tteokbokki_Bunsik_Korean_food_02.jpg) | Hankook12 | CC0 | teuk9 14.3~16.9 |
| `tbk_pan` | [Korean.snacks-Tteokbokki-04.jpg](https://commons.wikimedia.org/wiki/File:Korean.snacks-Tteokbokki-04.jpg) | Sung Sook | CC BY 2.0 | teuk9 0.0~1.5, teuk13 22.0~24.3 |
| `tbk_plate` | [Korean rice cake (tteokbokki).jpg](https://commons.wikimedia.org/wiki/File:Korean_rice_cake_(tteokbokki).jpg) | Fumikas Sagisavas | CC0 | teuk9 26.1~27.4 |
| `tissue` | [Chained rolls of toilet paper at MBTA Sullivan station bathrooms.jpg](https://commons.wikimedia.org/wiki/File:Chained_rolls_of_toilet_paper_at_MBTA_Sullivan_station_bathrooms.jpg) | 4300streetcar | CC BY 4.0 | teuk5 7.9~10.2 |
| `umbrella` | [Closeup of black umbrella in rain.jpg](https://commons.wikimedia.org/wiki/File:Closeup_of_black_umbrella_in_rain.jpg) | Shixart1985 | CC BY 2.0 | teuk6 6.5~8.5 |

### 사실 확인

14편 모두 관찰체 창작 대본이다. 통계, 가격, 법규 같은 사실 주장은 없다. 시간·숫자("10분", "3분", "천 원에 몇 마리")는 장면 속 표현이고 사실로 내세우지 않는다. 그래서 인용할 출처가 없다. 실제 브랜드, 가게, 앱, 회사 이름은 없다("국룰", "밀떡/쌀떡"은 일반 명사). 사람 유형 편(길치, 눈치 없는 사람)은 "나"의 습관으로 쓰고, 끝에서 "혹시 나야?", "맛집 가는 길은 한 번에"처럼 자기 자신을 소재로 돌린다. 몸, 지역, 직업, 집단은 놀리지 않는다. 설명란 요약 앞에 "(창작)"이 붙는다.

### 업로드 문구

설명글은 공통 형식(`upload/README.md`)으로 `upload/specs/<id>.json` → `python3 upload/make_desc.py <id>` → `upload/txt/<id>.txt`에 있다. 채널 이름과 핸들은 아직 자리표시자다. 아래는 그 내용이다.

`teuk1`
- 제목: 월요일 아침 특ㅋㅋ
- 설명:
  ```
  (창작) 알람을 다섯 번 끄고서야 겨우 일어나는 월요일 아침을 담았습니다. 마지막 알람 이름이 '진짜_최종_마지막'이고, 출입 카드 '삑' 소리가 하루 중 제일 슬프다면 공감할 겁니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Alarm clock on a chair (Unsplash).jpg by Szűcs László szucslaszlo (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Cappuchino latte art.jpg by Blanka Novotná (Public domain), via Wikimedia Commons · 음악: "Hustle" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #월요일 #직장인 #출근 #직장인공감
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #월요일 #직장인 #출근 #직장인공감
- 고정 댓글: 알람 몇 번 끄고 일어나세요?

`teuk2`
- 제목: 시험 기간 특ㅋㅋ
- 설명:
  ```
  (창작) 시험 전날만 되면 갑자기 책상 정리가 하고 싶어지는 시험 기간의 모습을 모았습니다. 계획표만 한 시간 만들고, 새벽 3시에 방 구조를 바꾸고 싶어지는 바로 그 마음입니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Personal organizer with metallic ring binder.jpg by Old Photo Profile (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Working on a planning session with stationery items, notebook, and colorful pencils on a wooden desk.jpg by Shixart1985 (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #시험기간 #학생공감 #벼락치기 #중간고사
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #시험기간 #학생공감 #벼락치기 #중간고사
- 고정 댓글: 시험 전날 제일 많이 한 딴짓은?

`teuk3`
- 제목: 급식 특ㅋㅋ
- 설명:
  ```
  (창작) 4교시부터 오늘 급식 메뉴만 생각하던 학교 급식 시간을 떠올려 봤습니다. 종이 치자마자 뛰지 않고 아주 빠르게 걷고, 국자가 한 번 더 오면 그날은 대성공이었죠. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Korean fried chicken 5.jpg by insatiablemunch (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Korean cuisine-Kimchi-08.jpg by Jeremy Keith (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #급식 #학교 #학창시절 #추억
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #급식 #학교 #학창시절 #추억
- 고정 댓글: 최애 급식 메뉴 하나만 적고 가기

`teuk4`
- 제목: 단톡방 특ㅋㅋ
- 설명:
  ```
  (창작) 알림은 꺼 놓고 몰래 다 읽는 단톡방의 하루를 모았습니다. 질문하면 아무도 대답이 없고, 엄마한테 보낼 톡을 단톡방에 보내는 그 순간까지 담았습니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Smartphone display screen.jpg by Skitterphoto (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #단톡방 #카톡공감 #친구공감 #읽씹
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #단톡방 #카톡공감 #친구공감 #읽씹
- 고정 댓글: 지금 안 읽은 톡 몇 개 있어요?

`teuk5`
- 제목: 자취 첫 달 특ㅋㅋ
- 설명:
  ```
  (창작) 집이 너무 조용해서 오히려 잠이 안 오는 자취 첫 달의 모습입니다. 라면 냄비가 곧 그릇이 되고, 대파 한 단은 끝까지 먹은 적이 없는 그 시절입니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Ramyeon and kimchi.jpg by Hyeon-Jeong Suk (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Beijing scallions.jpg by Fumikas Sagisavas (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Chained rolls of toilet paper at MBTA Sullivan station bathrooms.jpg by 4300streetcar (CC BY 4.0, https://creativecommons.org/licenses/by/4.0), via Wikimedia Commons · 사진: CSA-Red-Spring-Onions.jpg by Evan-Amos (Public domain), via Wikimedia Commons · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #자취 #자취생 #자취공감 #혼자살기
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #자취 #자취생 #자취공감 #혼자살기
- 고정 댓글: 자취하면서 제일 놀랐던 순간은?

`teuk6`
- 제목: 비 오는 날 특ㅋㅋ
- 설명:
  ```
  (창작) 우산 챙긴 날엔 비가 한 방울도 안 오는 비 오는 날의 법칙을 모았습니다. 집에 우산이 많은데 또 하나 사고, 파전 해 먹자 했는데 밀가루가 없는 날입니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Clear Umbrella Rain Liverpool (Unsplash).jpg by freddie marriage fredmarriage (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Closeup of black umbrella in rain.jpg by Shixart1985 (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Korean pancake-Pajeon-08.jpg by Jamie (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #비오는날 #장마 #우산 #날씨공감
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #비오는날 #장마 #우산 #날씨공감
- 고정 댓글: 집에 우산 몇 개 있어요?

`teuk7`
- 제목: 헬스장 첫 주 특ㅋㅋ
- 설명:
  ```
  (창작) 일단 회원권은 1년짜리부터 끊는 헬스장 첫 주의 모습입니다. 첫날부터 너무 열심히 해서 다음 날 계단을 못 내려가고, 운동했으니까 치킨은 괜찮다고 믿습니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Exercise equipment (rubber ball, light-weight dumbbells, jump rope).jpg by CDC/ Debora Cartagena (Public domain), via Wikimedia Commons · 사진: Stairs steps.jpg by Knites (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Korean fried chicken 5.jpg by insatiablemunch (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 음악: "Exhilarate" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #헬스장 #운동 #헬린이 #다이어트
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #헬스장 #운동 #헬린이 #다이어트
- 고정 댓글: 헬스장 며칠째까지 가 봤어요?

`teuk8`
- 제목: 월급날 특ㅋㅋ
- 설명:
  ```
  (창작) 아침부터 입금 알림만 기다리는 월급날 하루를 담았습니다. 들어오자마자 카드값이 빠져나가고, '오늘은 내가 쏜다' 해 놓고 계산할 때 살짝 후회합니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Steak, carrots, bok choy, sweet peppers, and mashed potatoes - Massachusetts.jpg by Daderot (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Mini grocery toy pushcart.jpg by Me (Elsa Versailles) (Public domain), via Wikimedia Commons · 사진: WallCalendar.jpg by Claudio Elias (Public domain), via Wikimedia Commons · 음악: "Hustle" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #월급날 #직장인 #월급 #직장인공감
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #월급날 #직장인 #월급 #직장인공감
- 고정 댓글: 월급날 제일 먼저 사는 건?

`teuk9`
- 제목: 떡볶이 특ㅋㅋ
- 설명:
  ```
  (창작) 1인분 시켰는데 정신 차려 보면 볶음밥까지 먹고 있는 떡볶이의 법칙을 모았습니다. 맵다면서 단무지만 세 번 리필하고, 밀떡 쌀떡 토론은 10분이 걸립니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Korean.snacks-Tteokbokki-04.jpg by Sung Sook (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Kimchi fried rice.jpg by Sharon Ang (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Korean.snacks-Tteokbokki-08.jpg by jetalone (flickr) (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Tteokbokki Bunsik Korean food 02.jpg by Hankook12 (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Korean food at Tteokbokki restaurant in Shin-Okubo 3.jpg by Syced (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Korean rice cake (tteokbokki).jpg by Fumikas Sagisavas (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #떡볶이 #분식 #먹방공감 #밀떡쌀떡
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #떡볶이 #분식 #먹방공감 #밀떡쌀떡
- 고정 댓글: 밀떡 vs 쌀떡, 여러분은?

`teuk10`
- 제목: 컵라면 특ㅋㅋ
- 설명:
  ```
  (창작) 물 선까지 부으라는데 그 선이 안 보이는 컵라면의 순간들을 모았습니다. 3분 기다리라는데 1분째 젓가락을 들고 있고, 고르는 데 20분, 먹는 데 3분이 걸립니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: 컵라면 사진 1 by 毒島みるく (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: 컵라면 사진 2 by 毒島みるく (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: 20200804 033546 Ramyeon IMG 8515.jpg by Choi Kwang-mo (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #컵라면 #라면 #야식 #편의점
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #컵라면 #라면 #야식 #편의점
- 고정 댓글: 컵라면 몇 분 기다리세요?

`teuk11`
- 제목: 붕어빵 특ㅋㅋ
- 설명:
  ```
  (창작) 팥이냐 슈크림이냐 고르다가 결국 둘 다 사는 붕어빵의 계절입니다. 머리부터 먹냐 꼬리부터 먹냐로 성격이 나오고, 세 마리 샀는데 집에 오면 한 마리만 남습니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Taiyaki - cut section.jpg by 毒島みるく (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Bungeoppang-01.jpg by Siqbal at en.wikipedia (Public domain), via Wikimedia Commons · 사진: 시장 2.jpg by Chae Ji-young (CC BY 4.0, https://creativecommons.org/licenses/by/4.0), via Wikimedia Commons · 사진: Taiyaki 003.jpg by Ocdp (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #붕어빵 #겨울간식 #팥붕슈붕 #길거리음식
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #붕어빵 #겨울간식 #팥붕슈붕 #길거리음식
- 고정 댓글: 팥 vs 슈크림, 머리 vs 꼬리?

`teuk12`
- 제목: 삼겹살 특ㅋㅋ
- 설명:
  ```
  (창작) 고기 굽는 사람은 정작 한 점도 못 먹는 삼겹살 자리의 모습을 모았습니다. 다 익었냐고 물으면 대답은 늘 '조금만 더'이고, 배부르다면서 볶음밥은 꼭 시킵니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Samgyeopsal-gui 1.jpg by chomjong (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Samgyeopsal table.jpg by 이동원 (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Korean.food-Samgyeopsal-02.jpg by Blue Lotus (a flickr user) (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: Kimchi-bokkeum-bap (Kimchi fried rice) - Kogi 2023-09-11.jpg by Andy Li (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Samgyeopsal-gui.jpg by jinsoo jang (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 음악: "Hustle" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #삼겹살 #고기 #회식 #먹방공감
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #삼겹살 #고기 #회식 #먹방공감
- 고정 댓글: 고기 굽는 담당 누구예요?

`teuk13`
- 제목: 길치 특ㅋㅋ
- 설명:
  ```
  (창작) 지도 앱을 켜고 걷는데 화살표가 계속 뒤를 가리키는 길치의 하루입니다. 길을 물어봐 놓고 반대로 걷고, 오른쪽이라고 하면 일단 왼쪽부터 봅니다. 여러분은 몇 개 해당되나요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Bukchon, Seoul - Bukchon3283.jpg by lumoplank (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: 횡단보도 사진 by Monotaxism (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 사진: Korean.snacks-Tteokbokki-04.jpg by Sung Sook (CC BY 2.0, https://creativecommons.org/licenses/by/2.0), via Wikimedia Commons · 사진: World Map 1689.JPG by Gerard van Schagen (Public domain), via Wikimedia Commons · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #길치 #방향치 #길찾기 #공감짤
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #길치 #방향치 #길찾기 #공감짤
- 고정 댓글: 길 잃어버린 썰 하나씩 풀고 가기

`teuk14`
- 제목: 눈치 없는 사람 특ㅋㅋ
- 설명:
  ```
  (창작) 다들 조용한데 혼자 '이거 누가 시켰어요?' 하고 묻는 친구, 주변에 한 명쯤 있죠. 결말이 궁금하다니까 진짜 결말을 말해 주고, 깜짝 파티 장소를 주인공 앞에서 물어봅니다. 여러분 주변에도 있나요, 아니면 혹시 나인가요?
  
  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
  
  출처: 그림·대본 직접 제작(등장인물·채팅방은 실제와 관계없음) · 목소리: AI 합성 음성 · 사진: Pepperoni pizza slice on a red plate.jpg by MVS9966 (CC BY 3.0, https://creativecommons.org/licenses/by/3.0), via Wikimedia Commons · 사진: Piece of chocolate cake on a white plate decorated with chocolate sauce.jpg by Daria Yakovleva (minor edits by Subsidiary account) (CC0, http://creativecommons.org/publicdomain/zero/1.0/deed.en), via Wikimedia Commons · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
  
  #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #눈치 #친구공감 #인간관계 #MBTI
  ```
- 해시태그: #Shorts #공감 #특 #공감툰 #공감애니 #창작애니 #일상공감 #눈치 #친구공감 #인간관계 #MBTI
- 고정 댓글: 혹시… 나야? 몇 개 해당?


---

## 롱폼: 반찬통에 이름 써 붙이는 남편과 각방 쓴 사연

`lfsaeyeon1` · 그림 사연툰 단편(리서치 `research/research-longform-story.md` 4절 레시피 ①, 아이디어 1) · 1920×1080, 10분 17초 · 창작 사연

- 파일: `final/lfsaeyeon1.mp4`, `final/lfsaeyeon1-thumb.jpg`
- 만들기: `longform/lfsaeyeon1/render.sh` (voice.py → build.py → prep.py → Remotion `src/lib/long/lfsaeyeon1_comps.tsx` → 2-pass H.264 + loudnorm −14 LUFS) · QA `python3 longform/lfsaeyeon1/qa.py`
- 원고: `longform/lfsaeyeon1/story.py`(장면 153개), 개요 3개는 `outlines.md`, 대본은 `script.json`, 컷 목록은 `scenes.json`, 음악·효과음은 `edit.json`
- 그림: 새 파일만 썼다. `src/lib/long/lfsaeyeon1_cast.tsx`(인물 4명), `_set.tsx`(배경·소품), `_stage.tsx`(16:9 한 컷), `_video.tsx`(전체), `_thumb.tsx`, `_comps.tsx`(컴포지션 2개). 쇼츠 템플릿 파일은 고치지 않았고, `src/Root.tsx` 끝에 `<LfSaeyeon1Comps />` 한 줄(과 import 한 줄)만 더했다. 롱폼 키트(`src/Long.tsx`)가 합쳐지기 전이라 자체 컴포지션으로 렌더했다. 키트가 들어오면 `SyStage`를 키트의 썰 장면에서 부르거나, 완성본에 `qa_long.py`를 돌리면 된다.

### 이야기 검토 (REVIEW.md 2-1, 녹음 전)

| 항목 | 결과 |
|---|---|
| 1. 한 줄 요약 | 반찬통에 이름표를 붙이던 남편 때문에 각방까지 썼는데, 남편은 손을 못 쓰게 된 어머님 체면과 내 반찬을 둘 다 지키려고 새벽마다 내 장조림을 흉내 내 만들고 있었다 |
| 2. 제목으로 결말을 못 맞힘 | 제목의 첫 추측은 "치사한 남편 / 혼자 먹으려는 남편". 5:00쯤 나오는 1차 답("시어머니가 가져갔다")도 미끼이고, 진짜 답(남편이 만든 '엄마' 통)은 6:46까지 안 나온다. 제목에는 결과(각방)만 있다 |
| 3. 구체적인 장면 | 별 모양 당근 장조림, 은색 스테인리스 '엄마' 통, 케첩에 붙은 '우리' 이름표, 밴드 세 개, 메추리알 껍데기, 화·목 14:10 도어록 기록, 한여름 면장갑 |
| 4. 커지는 갈등 | 이름표 → 거짓말(깻잎·헬스장·새벽 운동) → 각방 → 시댁에서 "올케도 좀 배워" 망신 → 짐 싸기. 네 번 커지고, 친구의 "딴 집 반찬?" 의심이 한 번 꺾는다 |
| 5. 복선 있는 반전 | 아래 단서 표. 우연·꿈·갑작스러운 제3자 없음. 1차 반전(시어머니)과 2차 반전(남편)이 같은 단서로 풀린다 |
| 6. 감정 하나 | 뭉클(따뜻한 반전). 사이다는 어머님이 스스로 장갑을 벗고 진실을 말하는 행동으로, 웃음은 "그럼 짠 건 누가 했는데?" → 손 드는 남편 한 번 |
| 7. 설교 금지 | 교훈 문장 없음. 해결은 장갑 벗기, 손 들기, 같이 장조림 만들기 |
| 8. 살아 있는 인물 | 나("아니 근데,", 별 깎는 버릇) · 남편("그냥…", 거짓말하면 귀가 빨개짐) · 어머님("아이고, 됐다 됐어", 손 관절, 딸에게만은 엄마 반찬을 끊기 싫음) · 형님("아 진짜~", 백일 아기, 지쳐서 말이 앞섬). 악역 없음, 모두 이유가 있다 |
| 9. 구조 돌려쓰기 | 결말 유형: 숨은 동기 + 이중 반전. 직전 썰(sseol13, 따뜻한 반전 "~하는 이유")과 뼈대가 다르다 |
| 10. 쓰는 순서 | 개요 3개(A 선택, B·C 버림) → 1번 기준 선택 → "20대 댓글" 거르기(예상 댓글: "각방 수락이 복선이었네", "삐뚤빼뚤 별에서 울컥", "짠 건 누가 했는데 ㅋㅋ") |

- **훅(0:00~0:18)**: 남편이 은색 통을 들고 "이건 엄마 거야. 당신은 손대지 마." → "아니 근데… 여기 우리 집 냉장고거든?" → "결혼 2년 차. 남편이 반찬통에 이름을 써 붙이기 시작했어요. 그리고 저희는… 각방을 썼습니다." → 제목 카드
- **반전**: 이름표는 나한테 한 말이 아니었다. '지은' = "엄마, 이건 손대지 마세요", '엄마' = "이건 가져가세요, 내가 만든 거예요". 1년 전부터 칼을 못 쥐는 어머님이 산후조리 중인 형님에게 "엄마 반찬"을 끊지 못해 우리 집 반찬을 가져갔고, 그걸 안 남편이 어머님 체면과 내 반찬을 둘 다 지키려고 새벽 4시 반마다 내 레시피로 장조림을 만들었다. 각방을 1초 만에 받아들인 것도 새벽에 나를 깨우지 않으려고.
- **노리는 감정**: 뭉클. 끝맛은 웃음("귀가… 빨갰어요.")

**복선(심은 시각 → 풀리는 시각)**

| 단서 | 심음 | 풀림 |
|---|---|---|
| 별 모양 당근(내 표시) | 0:31 | 4:19 형님 사진 속 별 당근 → 6:20 '엄마' 통 속 찌그러진 별 → 6:54 새벽에 별을 깎는 남편 |
| 남편은 라면 물도 못 맞춤 | 0:52 | 6:20 짠 장조림, 9:25 "그럼 짠 건 누가 했는데?" |
| 거짓말하면 귀가 빨개짐 | 0:57 | 1:25, 2:04, 2:46 거짓말마다 / 10:04 마지막 펀치라인 |
| 깻잎을 질색 → "내가 다 먹었어" | 1:02, 1:25 | 8:21 "엄마가 실수로 가져가신 거" |
| 맨 안쪽 은색 '엄마' 통, "빈 통이야" | 1:45, 2:04 | 6:07 어머님은 '엄마' 통만 가져감, 7:55 "내가 만든 거니까" |
| 손가락 밴드 세 개("덤벨") | 2:19 | 8:21 "별 깎다가", 9:30 손 든 남편 |
| 새벽 간장 냄새, 메추리알 껍데기 | 2:33, 2:37 | 6:36 세 단서가 한 줄로 맞물림, 6:49 새벽 4시 반 |
| 각방을 1초 만에 받아들임("일찍 일어나니까") | 3:29 | 8:13 "당신 깨우면 안 되니까" |
| 한여름 면장갑, 파스 냄새 | 3:58 | 7:07 관절, 8:52 장갑을 벗는 어머님 |
| "요즘 건 별이 찌그러졌더라, 좀 짜" | 4:44, 4:50 | 6:20 |
| 도어록 화·목 14:10 | 5:32 | 5:42~6:07 숨어서 본 어머님, 7:27 "석 달 전 도어록 알림" |

**버린 개요 2개** (전문은 `longform/lfsaeyeon1/outlines.md`)
- **B. 남편의 저염 식단**: 신장 수치 경고를 받은 남편이 걱정시킬까 봐 저염 반찬을 따로 먹으려 이름표를 붙였다. 버린 이유: "알고 보니 아팠다"는 사연 오디오북 단골 공식이라 병원 봉투가 나오는 순간 끝나고, 제3자가 판을 키우지 못하며, 감정이 슬픔으로 무거워진다. 저염이면 이름이 아니라 "저염"이라고 쓰면 된다.
- **C. 리서치 원안(시어머니의 반찬 바꿔치기)**: 시어머니가 내 반찬을 시누이에게 "엄마가 했다"며 주는 걸 막으려고 남편이 이름표를 붙였다. 버린 이유: 시댁 사연 시청자의 첫 추측이 "시어머니가 범인"이고, 결말이 시어머니 망신(빌런 → 벌)이 된다. 이름표로 막는다는 논리도 약하다. 이 개요는 A의 중간 반전(4:19~5:28)으로 썼다.

### 챕터

```
0:00 콜드 오픈
0:18 발단: 이름표
2:10 고조 1: 깻잎과 각방
3:42 고조 2: 시어머니 생신
5:28 단서: 도어록 기록
6:53 반전: 새벽 4시 반
8:42 사이다: 일요일 시댁
9:34 여운
10:07 여러분이라면?
```

레시피(0:20 / 2:00 / 4:00 / 6:00 / 7:30 / 9:00 / 9:40)보다 고조 2와 단서가 20~30초 이르다. 반전·사이다 구간이 길어서 둘로 나눴다(챕터 9개).

### 목소리 (Edge TTS, 한국어 목소리 3개를 인물별 속도·높이로 나눔)

| 인물 | voice | rate | pitch | 메모 |
|---|---|---|---|---|
| 내레이션(지은) | ko-KR-SunHiNeural | +4% | +0Hz | 리서치 권장 +3~5% |
| 나(지은, 대사) | ko-KR-SunHiNeural | +7% | +7Hz | 내레이션보다 밝고 빠르게 |
| 남편 도윤 | ko-KR-HyunsuMultilingualNeural | +0% | −5Hz | 말수 적고 낮게 |
| 어머님 | ko-KR-SunHiNeural | −12% | −20Hz | 느리고 낮게 |
| 형님 도희 | ko-KR-SunHiNeural | +12% | +16Hz | 빠르고 높게 |

- 대사 : 내레이션 = 줄 수로 88 : 65(약 6 : 4), 글자 수로 약 5 : 5. 문장은 짧게 끊고 "…", "아이고", "아 진짜~", "어? 아…" 같은 말버릇을 넣었다. 장면 전환마다 쉼을 길게(0.4~0.9초), 새벽 장면 직전에는 음악을 끊고 1.4초 무음.
- 한국어 Edge 목소리는 여성 1개(SunHi)뿐이라 지은·어머님·형님이 같은 목소리의 속도·높이 변형이다. 리서치(사람 목소리 채널이 히트)를 생각하면 가장 큰 약점이다. 사람 녹음으로 바꾸려면 `script.json`의 대사를 그대로 읽으면 된다.

### 그림

- 98컷(평균 6.3초에 한 컷). 같은 구도에서 표정과 말풍선만 바뀌는 줄은 컷으로 세지 않는다.
- 배경 8개: 부엌, 새벽 부엌, 냉장고 속, 거실, 안방(각방 분할 포함), 시댁 거실, 현관, 회상. 클로즈업: 장조림(반듯한 별 / 찌그러진 별), 밴드 붙은 손, 어머님 손, 도어록 기록, 형님 휴대폰 사진, 레시피 노트, 메추리알 껍데기.
- 인물은 썰 찹쌀떡과 같은 몸·표정 13개에 고정된 차림을 더했다. 나 = 복숭아색, 갈색 앞머리 + 노란 곱창밴드 묶음머리, 산호색 옷 · 남편 = 하늘색, 짧은 검은 머리 + 삐침머리, 남색 옷, 거짓말하면 빨개지는 귀 · 어머님 = 연보라, 회색 파마, 동그란 안경, 눈가 주름, 보라 카디건, 면장갑 · 형님 = 민트, 검은 단발 + 분홍 머리띠, 다크서클, 회색 후드, 분홍 포대기의 아기.
- 대사는 말풍선, 내레이션은 아래 자막. 화면 밖 목소리 말풍선에는 이름표를 붙였다. 오른쪽 위에 "창작 사연" 표시.

### 인코딩과 QA (`python3 longform/lfsaeyeon1/qa.py`, 0 FAIL)

- 1920×1080 30fps, H.264 2-pass 1,002 kbps(95MB에 맞춘 값) + AAC 192 kbps 48 kHz, faststart · 617.2초(10:17) · 93.0MB · −14.0 LUFS, 피크 −1.5 dBTP
- 검은 프레임 0, 마지막 프레임 밝음(평균 휘도 216), 1.5초 넘는 무음 0, 12초 넘게 멈춘 화면 0, 자막 최장 27자(6장은 1500px 안에 들도록 글자를 줄임, 넘침 없음), 금지어 없음
- WARN 1: 한 구도가 가장 길게 이어지는 곳은 3:02의 거실 다툼(23.5초). 같은 구도에서 표정·말풍선 7번이 바뀐다
- 콘택트 시트(30초 간격): `out/review/lfsaeyeon1/sheet_*.jpg` (git 밖). 썸네일 1280×720

### 출처와 라이선스

- 그림·이야기: 직접 제작(창작). 목소리: AI 합성 음성(Edge TTS). 사진·영상 소스 없음. 실제 브랜드·로고·앱 화면 없음(도어록 앱, 채팅, 케첩병은 이름 없는 일반 그림).
- 음악: Kevin MacLeod (incompetech.com), CC BY 4.0 — "Carefree"(0:00~2:10, 9:34~), "Sneaky Snitch"(2:10~3:42), "Investigations"(3:42~6:48), "Heartwarming"(6:49~9:34). `longform/lfsaeyeon1/fetch_music.sh`가 incompetech.com에서 받는다.
- 효과음: Kenney Interface Sounds(CC0)와 `../tools/sfx.py`로 합성한 소리(`fetch.sh`).
- 글꼴: Black Han Sans, Pretendard (SIL OFL).

### 업로드

- 제목: 반찬통에 이름 써 붙이는 남편과 각방 쓴 사연 [사연툰]
- 설명글: `upload/txt/lfsaeyeon1.txt` (spec `upload/specs/lfsaeyeon1.json`, channel "sseol", long, fiction). 요약은 반전을 말하지 않는다.
- 고정 댓글: 여러분이라면 이름표 붙인 남편, 바로 용서했을까요? 아니면 각방 한 달 더? 🤔
- 주기: 사연툰 단편은 주 1편(같은 요일·시간). 단편 4편이 쌓이면 모음집 1편(4편, 720p 또는 2편씩 1080p). 제목에 "썰툰", "야담", "참교육 애니"는 쓰지 않는다(로그아웃 검색 연령 확인).

## 롱폼 제작 키트 (가로 16:9, `src/Long.tsx`)

쇼츠만 만들던 이 프로젝트에서 **가로 1920×1080, 30fps 내레이션 롱폼**을 만드는 틀입니다. 쇼츠 템플릿(ClipShort, Captions, Sseol, Doodle, Road, prep.py)은 건드리지 않고 가져다 씁니다. 새 파일은 `src/Long.tsx`, `src/lib/long/*`, `longform/*`이고, 쇼츠와 함께 쓰는 곳은 `src/Root.tsx`의 `<LongCompositions />` 한 줄뿐입니다(기존 쇼츠는 전과 똑같이 렌더링됨, 아래 "확인").

다룰 수 있는 형식:
- 지식·우주·심해·자연 다큐 — 미국 연방정부 PD(NASA, NOAA, USGS, NPS)·Pexels 영상과 사진 위에 내레이션
- 그 시절 옛날 영상 — 국가기록원 등 공공누리 제1유형 영상·사진(`photo`의 켄 번스, 4:3은 `"fit": "contain"`)
- 썰 모음·괴담 몰아보기 — 우리 캐릭터(Mochi·낙서)가 16:9 무대에서 연기하거나 어두운 분위기 영상 위에 내레이션
- 우리 쇼츠 모음 — 세로 쇼츠를 흐린 배경 위에, 또는 쇼츠의 원본 클립으로 가로 화면을 다시 짜서

### 만드는 순서

```bash
npm i && ./fetch.sh && longform/fetch_long.sh        # 글꼴·효과음·음악 + 롱폼용 음악·환경음(빗소리·바람·심해·방 소리)
# longform/<id>/script.json, edit.json 작성. 원본 영상·사진은 edit.json "sources"의 file 경로에(media/… 등, 저장소에는 안 넣음)
python3 longform/prep_long.py <id>                   # TTS·자막·컷 → src/longdata/<id>.json, public/long/<id>/, upload/specs/<id>.json의 chapters·music
npx remotion still src/index.ts <id>-thumb final/<id>-thumb.jpg --image-format=jpeg --jpeg-quality=88   # 썸네일 1280×720
longform/render_long.sh <id>                         # final/<id>.mp4 (−14 LUFS, 95MB 이하)
python3 longform/qa_long.py <id>                     # 검사 → out/review/<id>/
npx remotion studio                                  # 미리보기 (<id>, <id>-thumb)
```

- `prep_long.py`는 Edge TTS 결과를 `build/long/<id>/tts/`에 저장해 두므로, 문장을 고친 줄만 다시 읽습니다. TTS 호출·무음 자르기·음절 시간은 `voice_edge.py`의 함수를, 숫자 읽기(`spoken_form`)는 `prep.py`의 함수를 그 파일에서 그대로 불러 씁니다(함수 정의만 읽음).
- 원본 위치: `edit.json`의 `file`은 `shorts/viral5/` 기준 경로(예: `media/top6/x.mp4`), 아니면 `$MEDIA/…`, `public/…` 순서로 찾습니다. 없으면 자리 표시 화면으로 렌더링되고 prep이 WARN을 냅니다.
- `src/longdata/`는 저장소에 넣습니다(작은 JSON). 그래서 롱폼을 prep하지 않은 상태에서도 쇼츠 렌더링이 깨지지 않습니다.

### 구성 (타임라인)

콜드 오픈(뒤 챕터의 가장 센 문장과 그 장면을 모아 20~40초) → 제목 카드(3초) → 챕터마다 [챕터 카드(1.5~2.5초, 번호와 제목) → 내레이션] → 아웃트로(20초, 엔드스크린 자리 + 내레이션 한 줄).
챕터 안에서는 왼쪽 위에 작은 챕터 표시, 오른쪽 위에 지금 화면의 출처("영상: NOAA Ocean Exploration")가 나옵니다. 자막은 아래 가운데 1~2줄(한 줄 약 22자), 흰 글씨에 검은 테두리, `[키워드]`는 노란색이고 Edge TTS 단어 경계로 소리에 맞춥니다. 아웃트로의 자막은 위쪽에 둡니다(아래는 구독 버튼 자리).

### `script.json`

```json
{
 "title": "수심 4,000m, 아무도 몰랐던 세계 | 심해 다큐",
 "sps": 6.0,
 "gap": 0.35,
 "voices": {
  "nar": {"edge": "ko-KR-InJoonNeural", "pitch": "+0Hz"},
  "minji": {"edge": "ko-KR-SunHiNeural", "rate": "+12%", "pitch": "+20Hz"},
  "sunbae": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+5%"}
 },
 "chapters": [
  {"id": "c1", "title": "빛이 사라지는 곳", "tail": 0.8, "lines": [
   {"id": "c1a", "text": "바닷속으로 [200m]만 내려가도 / 햇빛은 거의 사라집니다.", "say": "바닷속으로 이백 미터만 내려가도, 햇빛은 거의 사라집니다."},
   {"id": "c1b", "text": "그 아래는 [빛 한 줄기 없는] 어둠, / 바로 심해입니다."}
  ]},
  {"id": "c2", "title": "탐사선의 새벽 세 시", "lines": [
   {"id": "c2d", "voice": "minji", "text": "선배! 방금 [뭐가] 지나갔어요!", "cap": false, "gap": 0.3},
   {"id": "c4s", "short": "deepsea", "mode": "vertical"}
  ]}
 ],
 "outro": {"id": "out", "text": "다음 영상에서는 / [더 깊은 곳]으로 내려가 보겠습니다."}
}
```

| 값 | 쓰임 |
|---|---|
| `sps` | 내레이터 목표 속도(초당 음절). 있으면 prep이 첫 4문장을 기본 속도로 읽어 보고 `rate`를 계산합니다(데모: 기본 5.32 → `+13%` → 실제 5.98). 없으면 `voices.nar.rate`(기본 `+0%`). 롱폼 내레이션은 보통 5.5~6.5이고, 벗어나면 prep이 WARN |
| `voices` | 목소리 `{edge, rate, pitch}`. 줄마다 `"voice"`로 골라 대화를 만듭니다. 줄마다 음량을 맞추므로 목소리가 달라도 크기는 같습니다 |
| `gap` | 문장 사이 쉼(초). 줄마다 `"gap"`으로 바꿈 |
| 줄 `text` | 자막. `[키워드]` 노란색, `/`는 자막 페이지 나눔(없으면 쉼표·마침표에서 자동으로 2줄 이하로 나눔) |
| 줄 `say` | 읽는 문장(숫자를 한글로 등). 없으면 `text`에서 괄호와 `/`를 뺀 것 |
| 줄 `cap: false` | 아래 자막 없음(인물 대사를 말풍선으로만 보일 때) |
| 줄 `text`의 `{단어}` | 빨간 자막(괴담의 핵심어) |
| 줄 `pause` | 일부러 둔 침묵(초). 예: `{"id": "q3", "pause": 3, "text": "멈추고 생각해 보세요"}` — 목소리 없이 그 글이 자막으로 떠 있고, QA의 공백 검사에서 빠집니다(괴담 몰아보기의 "정답은?" 3초) |
| 목소리 `fx: "radio"` | 안내 방송·전화 목소리(대역 제한 + 약간 거친 소리). 예: `"pa": {"edge": "ko-KR-SunHiNeural", "fx": "radio"}` |
| 줄 `short` | 우리 쇼츠를 그 자리에서 재생. `"mode": "vertical"`은 `final/<id>.mp4`를 흐린 배경 위에(쇼츠 소리 그대로, 롱폼 음악은 꺼짐), `"mode": "relayout"`은 prep한 쇼츠(`src/data/<id>.json`)의 클립을 가로 전체 화면으로, 쇼츠의 목소리와 자막을 롱폼 자막으로. `from`/`to`(초)로 일부만, `gain` 음량 |
| 챕터 `tail` | 챕터 끝 여유(기본 0.8초) |
| `outro` | 아웃트로 내레이션 한 줄 |

### `edit.json`

```json
{
 "captions": true, "maxChars": 22, "captionSize": 56, "watermark": "",
 "credit": "영상: NOAA Ocean Exploration",
 "sources": {
  "jelly": {"file": "media/top6/red_jellyfish_poralia.mp4", "credit": "영상: NOAA Ocean Exploration",
            "desc": "붉은 해파리 Poralia, 2021 North Atlantic Stepping Stones — NOAA Ocean Exploration", "url": "https://oceanexplorer.noaa.gov/…"},
  "wreckStill": {"file": "media/top6/shipwreck_19th_century.mp4", "time": 8.0, "credit": "사진: NOAA Ocean Exploration"}
 },
 "music": {"gain": 0.24, "duck": 0.6, "xfade": 1.5},
 "coldOpen": {"lines": ["c1b", "c2d", "c3d", "c3h", "c1e"], "music": "Deep Haze", "gap": 0.5},
 "titleCard": {"dur": 3, "kicker": "심해 다큐", "title": ["수심 4,000m", "아무도 몰랐던 세계"], "bg": {"type": "footage", "src": "jelly", "in": 5}},
 "chapterCard": {"dur": 2},
 "chapters": {
  "c1": {"music": "Investigations", "ambience": {"name": "deep", "gain": 0.18}, "shots": [
   {"type": "footage", "src": "bubbles", "in": 6.0, "crop": [0.5, 0.5, 1.0], "push": [1.0, 1.08]},
   {"at": "c1a.햇빛", "type": "card", "kind": "fact", "label": "햇빛이 거의 사라지는 깊이", "big": "200m", "bg": "bubbles", "fade": 0.4},
   {"at": "c1g", "type": "photo", "src": "wreckStill", "kb": {"from": [0.5, 0.5, 1.0], "to": [0.42, 0.55, 1.18]}, "fade": 0.5, "lower": "2019 · 멕시코만"}
  ]}
 },
 "outro": {"dur": 20, "music": "Lost Frontier", "label": "다음 영상", "bg": {"type": "footage", "src": "smoker", "in": 0, "speed": 0.6}},
 "thumb": {"lines": ["수심 4,000m에서", "[찍힌] 것들"], "tag": "심해 다큐", "src": "jellyStill", "crop": [0.55, 0.5, 1.15], "circle": {"x": 900, "y": 360, "r": 190}},
 "description": {"fiction": true}
}
```

| 값 | 쓰임 |
|---|---|
| `captions` | `false`면 자막을 전부 끕니다 |
| `sleep` | 수면판: 화면을 30% 어둡게(`dim`), 샷 전환 기본 1초 교차, 챕터는 카드 대신 1초 검은 화면(`dip`), 음악 0.18·교차 3초. 내레이션 속도는 `voices.nar.rate`(예: `-10%`)로 |
| `dim` | 화면 전체를 이만큼 어둡게(0~1) |
| `maxChars` / `captionSize` | 자막 한 줄 글자 수(기본 22) / 글자 크기(기본 56px) |
| `credit` | 출처가 따로 없는 장면의 오른쪽 위 출처 |
| `sources` | 원본. `file`, `credit`(화면 오른쪽 위), `desc`·`url`(설명란 출처 줄), `time`(영상에서 한 장면을 사진으로 쓸 때 그 초) |
| `music` | `gain`(기본 0.25), `duck`(목소리 밑으로 내리는 정도, 기본 0.6), `xfade`(챕터 사이 음악 교차 시간, 기본 1.5초) |
| `coldOpen` | 콜드 오픈에 쓸 줄 id 목록(그 줄이 원래 챕터에서 가진 화면을 그 순간부터 가져옴), 음악, 문장 사이 `gap`, 권장 길이 `min`·`max`(기본 20~40초, 사연툰은 10~15초) |
| `titleCard` | `dur`, `kicker`(위 작은 글), `title`(2줄, 둘째 줄 노란색), `sub`, `bg`(샷 하나, 흐리게) |
| `chapterCard` | `dur`(1.5~2.5초, `dip`은 기본 1초), `style`(`card` 전체 화면 카드 · `dip` 검은 화면에 제목만 작게, 다음 장면은 0.5초 페이드인), `kicker`(위 작은 글, 기본 `"CHAPTER {n:02d}"`; 몰아보기는 `"괴담 {n:02d} / {total}"`) |
| `chapters.<id>` | `music`(곡 이름, 또는 `{"track", "from", "gain", "restart"}`; 이웃 챕터와 같은 곡이면 끊기지 않고 이어짐), `ambience`(`"rain"`·`"wind"`·`"deep"`·`"room"`·`"hum"`(형광등·냉장고, 밤 편의점) 또는 `{"name", "gain"}`), `sfx`(`[["앵커", "pop", 0.4], …]`, `public/sfx/`의 효과음), `musicCuts`(`[{"at": "앵커", "dur": 1.5}]` 반전 직전 음악을 뚝 끊었다가 0.5초에 걸쳐 돌아옴), `shots` |
| `outro` | `dur`(기본 20초), `music`, `label`, `bg`(샷 하나, 흐리게), `lineAt`(내레이션 시작, 기본 0.8초), `boxes`(엔드스크린 자리 표시, 기본 true) |
| `thumb` | 썸네일(아래) |
| `description.fiction` | 새 spec을 만들 때 그림 장면이 있으면 `"fiction": true`로 둘지(기본 true). 설명글 자체는 `upload/specs/<id>.json`에 씁니다(아래) |

**샷 시간**은 쇼츠의 `edit.json`과 같은 앵커입니다: `"c1a"`(그 줄 시작), `"c1a.햇빛"`(그 단어를 말하는 순간), `"c1a@end+0.2"`(그 줄 끝 0.2초 뒤), 숫자(챕터 첫 줄부터 몇 초). 챕터의 첫 샷은 `at`이 없어도 챕터 시작에 붙고, 샷은 다음 샷이 시작할 때까지 이어집니다. 모든 샷에 `fade`(그 샷으로 넘어가는 교차 시간, 0.3~0.5 권장, 0이면 컷), `lower`(왼쪽 아래 작은 이름표), `badge`(왼쪽 위 큰 노란 딱지, 예: "15위"), `credit`을 줄 수 있습니다.

### 샷 종류

| `type` | 쓰임과 값 |
|---|---|
| `footage` | 영상. `src`, `in`(원본 시작 초), `speed`(0.5 = 슬로모션), `crop: [cx, cy, zoom]`(원본의 이 지점을 화면 가운데로), `push: [시작 배율, 끝 배율]`(느린 밀기, 기본 1.0→1.06), `fit`(`cover` 기본 · `contain`은 흐린 배경 위에 전체, 4:3·세로 원본은 자동 contain). prep이 그 구간만 1080p 30fps로 잘라 둡니다(렌더러가 긴 원본을 찾아 넘기지 않게) |
| `photo` | 사진(또는 `sources.time`으로 영상의 한 장면). `kb: {"from": [cx, cy, zoom], "to": [cx, cy, zoom]}` 켄 번스, `fit` |
| `scene` | 그림 장면(16:9 무대). 쇼츠의 배경(`bg` "class"·"home"·"street"·"store"·"night"·"office"·"desk"·"door"·"hospital"·"bedroom"·"bath"·"subway"·"cafeteria"·"gym"·"rain"…, `sign`, `photo`), 캐릭터 `chars`(Mochi·`"style": "doodle"`, `name`·`color`·`mood`·`to`·`x`·`size`·`flip`·`hat`), `says: [{"who": 0, "line": "c2d"}]`(그 줄이 나올 때 그 인물 머리 위 말풍선, 또는 `{"who", "text", "at", "to"}`), `turn`(인물이 `to` 표정으로 바뀌는 앵커), `prop`·`propX`·`propAt`, `big`·`bigAt`(크게 박히는 말), `card`(화면을 덮는 "다음 날 아침..."), `place`, `chat`(단톡방 폰, 메시지마다 `at` 앵커), `zoom`·`focus`, `size`(인물 크기 px)·`floor`(발 위치). 인물은 1~4명이 왼쪽·오른쪽으로 자동 배치되고 자막 띠 위에 섭니다 |
| `post` | 썰 훅 카드(Sseol의 Post를 가운데에). `board`, `title`, `body`, `meta`, `chars`, `steps`(본문 줄이 나타나는 앵커) |
| `card` `kind: "fact"` | 큰 숫자·사실 카드: `label`(위, 노랑), `big`(가운데 크게, `[ ]` 노랑), `sub`, `revealAt`(숫자가 박히는 앵커), `bg`(흐린 배경 원본, `bgIn`) |
| `card` `kind: "text"` | 문장 카드: `text`(`\n` 줄바꿈), `bg` |
| `card` `kind: "rank"` | TOP n 카드: `n`(○위), `total`, `title`(위 노란 딱지, 기본 "TOP n"), `label`, `bg` |
| `card` `kind: "map"` | 지도 카드: `center: [경도, 위도]`, `span`(가로 몇 도), `label`(왼쪽 위), `dots: [{lon, lat, label, at}]`(빨간 점·이름표), `arrows: [{from, to, at, dashed}]`(그려지는 빨간 화살표, `dashed`는 점선 경로). `at`은 초 또는 앵커. 육지 윤곽은 Natural Earth 1:50m(퍼블릭 도메인, `longform/worldmap.py`로 `src/lib/long/worldmap.ts` 생성) |
| `card` `kind: "grid"` | 잡학 리스트의 "목차" 화면: 흰 판에 동그란 아이콘 `items: [{icon, label}]`, `cols`, `title`. `focus`(지금 항목, 노란 테두리)·`zoomAt`(그 항목으로 카메라가 들어가는 앵커), `done`(지난 항목, 흐리게 + ✓), `circle`·`circleAt`(빨간 동그라미, 답 공개). 항목마다 그리드로 돌아왔다가 들어가는 흐름을 샷 두 개로 만듭니다 |
| `card` `kind: "doc"` | 문서 카드(안내문·인수인계서·근무 수칙): `title`, `lines`(줄마다 `steps`의 앵커에 나타남, `{빨강}`·`[노랑]`), `page`("3쪽"), `paper`(종이 색), `bg`(뒤 흐린 원본) |
| `relayout` | 우리 쇼츠를 **가로로 다시 짜기**(쇼츠 원본이 가로 영상일 때 권장): `short`(id), `parts`(쓸 클립 번호), `lowerThirds`(순위 이름표, 기본 true), `push`, `cutFade`. `politics/<id>/edit.json`의 `segments`(src·in·out·speed·credit·rank)를 원본에서 다시 잘라 1920×1080 전체 화면으로 차례로 보여 주고(내레이션이 더 길면 처음부터 다시), `rank`가 있는 쇼츠는 "5위 · 이름"이 왼쪽 아래에 붙습니다. `shorts/<id>/`형 쇼츠는 prep된 `src/data/<id>.json`의 클립을 쓰고, **그림 썰 쇼츠(`scene`·`post` 클립)는 세로 화면을 자르지 않고 16:9 무대에서 다시 연기합니다**(같은 인물·배경·말풍선·표정 변화 시각) |
| 세로 쇼츠 | `script.json` 줄의 `"short": "<id>", "mode": "vertical"`이 자동으로 샷을 만듭니다(세로 화면 가운데 + 같은 영상을 흐리게 깐 배경). 그 사이 원래 샷은 쇼츠가 끝난 뒤 이어집니다 |

### 썸네일 (`<id>-thumb`, 1280×720)

`edit.json`의 `"thumb"`: `lines`(2~3줄, 아주 크게, `[키]` 노랑 또는 `key` 색, `{키}` 빨강, 굵은 검은 테두리), `src`+`time`(사진 또는 영상 한 장면)·`crop: [cx, cy, zoom]`, `char`(Mochi 캐릭터 `{color, mood, x, y, size}`), `circle: {x, y, r}`(빨간 원), `arrow: {x, y, rot, len}`(빨간 화살표, 끝이 x,y), `side`(`left` 기본 · `right`), `tag`(위 작은 딱지, "몰아보기 EP1~4"), `bg`. `npx remotion still … --image-format=jpeg --jpeg-quality=88`로 2MB 이하.

`"style"`로 조사에서 본 다른 틀도 씁니다:
- `"band"` — 사연툰: 위 띠에 제목 1~2줄(핵심어 `[ ]`는 `key` 색, `{ }`는 빨강), 아래에 그림 장면(`scene` 배경, `chars` 2~3명, `says: [{who, text}]` 말풍선), `bandBg`.
- `"grid"` — 잡학 리스트: 흰 바탕, 위 검은 굵은 제목(`{빨강}`·`[key 색]`), 아래 동그란 색 아이콘 `items: [{icon, label}]` 6~8개.
- 기본(사진·그림 + 큰 글씨) — 다큐·괴담: 어두운 실사 + 흰 2~3줄 + 노랑/빨강 강조어, 괴담은 `char`에 창백한 얼굴을 `side` 반대편에.

### 챕터와 설명란 (`upload/specs/<id>.json` → `upload/make_desc.py`)

**연결: prep_long.py가 챕터 타임스탬프와 쓴 음악 제목을 `upload/specs/<id>.json`의 `chapters`·`music`에 채우고, `python3 upload/make_desc.py <id>`가 모든 채널 공통 형식의 설명글(`upload/txt/<id>.txt`, 음악 크레딧 자동)을 만듭니다.** 챕터는 0:00 "인트로"(콜드 오픈+제목 카드)와 챕터 카드 시작 시각이고, 음악은 챕터마다 고른 곡에 세로로 다시 쓴 쇼츠의 곡까지 더한 목록입니다(edit.json의 `music`은 믹스 설정이라 make_desc가 곡을 읽을 수 없어서 spec에 적음). spec이 없으면 prep이 `title`(script 제목), `sources`(edit.json `sources`의 `desc`, 지도, 직접 그림), `long: true`와 요약·태그 자리표시자로 새로 만들고, 있으면 `chapters`·`music`만 바꿉니다. 요약·태그·`channel`(다큐는 `docu`)·`pinned`는 사람이 씁니다(`upload/README.md`). 유튜브 챕터 규칙(0:00 시작, 3개 이상, 각 10초 이상)을 어기면 prep이 WARN을 내고, `qa_long.py`가 spec의 챕터를 다시 검사합니다.

### 렌더링과 용량 (`longform/render_long.sh`)

1. **화면**: `CHUNK`프레임(기본 2700 = 90초)씩 `--frames`로 나눠 소리 없이 렌더링(x264 CRF 12, veryfast — 거의 무손실 중간본)하고, 다시 인코딩하지 않고 이어 붙입니다. 끝난 조각은 남겨 두므로 도중에 멈춰도 이어서 렌더링됩니다(prep을 다시 했다면 `out/long/<id>/`를 지우고 처음부터: 남은 조각은 옛 데이터로 그려진 것입니다). 25분이어도 한 번에 메모리에 올리는 것은 한 조각뿐입니다.
2. **소리**: 전체 타임라인을 한 번에 소리만 렌더링(이음매 없음) → 2-pass loudnorm −14 LUFS/−1.5 dBTP → AAC 160k. `out/long/<id>/master.mkv`가 업로드용 고화질 원본입니다(저장소에는 안 넣음).
3. **용량 맞추기**: 저장소 파일 한도(100MB) 때문에 `final/<id>.mp4`는 **95MB 이하**(`MAXMB`)입니다. 길이로 비트레이트를 계산해 2-pass로 인코딩하고 `+faststart`를 붙입니다. 소리는 10분까지 AAC 160k, 20분까지 128k, 그 위는 96k입니다(25분에 160k면 소리만 30MB).

**분당 용량 (실측).** 데모의 그림 챕터(30초)와 심해 영상 챕터(28초, 바닷눈·거품이 가득한 가장 무거운 경우)를 화질 고정(CRF)으로 인코딩한 값입니다. 깨끗하게 보이는 데 필요한 크기입니다.

| 내용 | x264 1080p CRF 23 | x265 1080p CRF 26 | x265 720p CRF 26 |
|---|---|---|---|
| 그림(썰·카드·지도) | 5.7MB/분 (750kb/s) | **3.5MB/분** (460kb/s) | 1.7MB/분 (220kb/s) |
| 실사 영상(심해) | 44MB/분 (5,900kb/s) | 21MB/분 (2,800kb/s) | **11.5MB/분** (1,530kb/s) |

그래서 코덱은 길이로 정해지는 비트레이트와 `edit.json`의 `"encode": {"content": "drawn" \| "mixed" \| "footage"}`(기본 `mixed`)로 고릅니다.

| 내용 | x264 1080p | x265 1080p (`hvc1`) | x265 720p | 95MB에 깨끗하게 들어가는 길이 |
|---|---|---|---|---|
| `drawn` | 900kb/s 이상 | 450kb/s 이상 | 그 아래 | 1080p로 약 25분까지(소리 96k 포함) |
| `mixed` (기본) | 3,000kb/s 이상 | 1,400kb/s 이상 | 그 아래 | 1080p 약 8분, 720p 약 15분 |
| `footage` | 5,000kb/s 이상 | 2,000kb/s 이상 | 그 아래 | 720p로 약 8분. 그보다 긴 실사 위주 롱폼은 95MB 안에서 깨끗할 수 없으므로 `master.mkv`를 업로드하고 `final/`은 보관용으로 둡니다(또는 편을 나눔) |

x265를 고르는 이유: 같은 모양에 x264보다 약 45~50% 작습니다(표). x264 1080p를 2Mb/s 아래로 내리면 심해 입자·물결처럼 움직임이 많은 화면이 뭉개지고, 그때는 해상도를 720p로 낮춰 화소당 비트를 지키는 편이 낫습니다. `X264_MIN`, `X265_MIN`, `CAP`(짧은 영상의 상한, 기본 8,000kb/s), `PRESET`(x265, 기본 `fast`)으로 바꿀 수 있고, 결과는 `out/long/<id>/render.json`(조각별 시간, 렌더링 fps, 코덱, 비트레이트, 용량)에 남습니다.

**렌더링 속도 (이 머신, 4코어·15GB).** 화면 렌더링 **초당 6.6~6.7프레임**(데모: 실사·그림·카드가 섞인 5,807프레임을 871~885초, 조각마다 번들 5초 포함). 흐린 배경을 CSS `blur()`로 그리던 첫 버전은 초당 약 4~5프레임이었고, prep이 만드는 192×108 미리 흐린 사본으로 바꿔 빨라졌습니다. x265 720p 2-pass는 초당 약 24프레임. 그래서 10분 롱폼은 렌더링 약 45분 + 인코딩 약 25분, 25분 롱폼은 약 1시간 55분 + 1시간 5분입니다. 메모리는 조각 하나 분량(크롬 4개 각 약 600MB)만 씁니다. 소리를 따로 한 번 더 렌더링하면(Remotion은 소리만 뽑을 때도 모든 프레임을 계산함) 시간이 거의 두 배가 되므로, 조각마다 16비트 PCM으로 같이 뽑아 프레임 수에 딱 맞게 잘라 이어 붙입니다(이음매 없음).

x265 2-pass에서 MP4로 바로 쓰면 전역 헤더 때문에 1차와 2차 설정이 달라져 "Incomplete CU-tree stats file"로 멈추므로, 2차는 MKV로 쓰고 MP4로 다시 담습니다.

### 검사 (`longform/qa_long.py`)

길이(타임라인과 일치, 10~25분 밖이면 WARN), 소리 −14 LUFS ±1, 용량 95MB 이하, 검은 화면(0.05초 이상, 마지막 한 프레임), 내레이션 안의 1.5초 넘는 공백(대본 기준 + 실제 믹스의 −50dB 무음), 자막 넘침(줄 너비 1,600px 초과·3줄 이상), 챕터 목록, 썸네일(1280×720, 2MB 이하), 20초 넘게 멈춘 화면(WARN). `out/review/<id>/`에 30초마다 한 장(`sheet.jpg`), 첫 15초 1초 간격(`first15.jpg`), 썸네일, `report.md`를 씁니다. FAIL이 있으면 종료 코드 1. `qa_review.py`(쇼츠용)는 바꾸지 않았습니다.

### 조사 보고서(`research/research-longform-docu.md`, `research-longform-story.md`)가 요구한 것과 키트

| 조사에서 나온 요구 | 키트 |
|---|---|
| 잡학 리스트(F3): 아이콘 그리드 목차로 돌아왔다가 항목으로 줌인, 답 공개에 빨간 동그라미, 흰 바탕 아이콘 그리드 썸네일 | `card` `grid`(`focus`·`zoomAt`·`done`·`circle`), 썸네일 `style: "grid"`, 낙서 인물은 `scene`의 `"style": "doodle"` |
| 스토리형 역사(F1): 켄 번스 3~5% 스틸, 지도 2~3장(화살표·점선 경로), 챕터 전환 1초 검은 페이드, 하단 자막 한 줄 | `photo` `kb`, `card` `map`(`dashed`), `chapterCard.style: "dip"`, 자막 페이지 자동 분할 |
| 가장 ○○한 N곳(F4): 순위 숫자를 왼쪽 위에, 지도 핀, 우리 TOP5 쇼츠 원본 재사용 | 샷 `badge`, `map` `dots`, `relayout` + `lower` |
| 수면판 재편집: 느린 내레이션, 어두운 화면 | `"sleep": true`(+ `voices.nar.rate: "-10%"`) |
| 사연툰: 콜드 오픈 10~15초, 인물별 목소리, 반전 직전 음악 끊고 1초 무음, 말풍선 팝·쿵 효과음, 위 띠 썸네일 | `coldOpen.min/max`, `voices` + 줄 `voice`, `musicCuts`, `sfx`, 썸네일 `style: "band"` |
| 커뮤니티 글 괴담: 어두운 실사 + 단순 인물, 문서 카드(인수인계서·안내문), 안내 방송 목소리, 형광등·냉장고 환경음, 핵심어 빨간 자막 | `scene`의 `photo` 배경 + `chars`, `card` `doc`, 목소리 `fx: "radio"`, `ambience: "hum"`, 자막 `{단어}` |
| 괴담 몰아보기: 편 사이 "괴담 03 / 12" 번호 카드, "정답은?" 3초 정지, 쇼츠는 세로 틀보다 16:9로 다시 배치 | `chapterCard.kicker: "괴담 {n:02d} / {total}"`, 줄 `pause`, `relayout`(그림 썰 쇼츠는 16:9 무대에서 다시 연기) |
| 음악: 다큐 저음 패드, 잡학 가벼운 곡, 괴담 패드 | `fetch_long.sh`에 Kevin MacLeod "Long Note Three", "Dark Walk", "Fluffing a Duck", "Darkest Child" 등 추가(CC BY 4.0, 설명란 문구는 prep이 씀) |

### 데모 `longdemo` (심해 다큐, 3분 14초)

`final/longdemo.mp4`(37.1MB, x265 720p 1,363kb/s + AAC 160k, `MAXMB=38`로 렌더링해 저장소에 넣을 수 있게 함), `final/longdemo-thumb.jpg`(0.13MB), 설명글 `upload/specs/longdemo.json` → `upload/txt/longdemo.txt`(channel `docu`, long). 모든 기능을 한 편에서 씁니다.
- 콜드 오픈 26초(뒤 챕터 다섯 문장과 그 장면) → 제목 카드 → 챕터 4개 → 아웃트로 20초(엔드스크린 자리)
- 1장 「빛이 사라지는 곳」: NOAA 심해 영상(`footage`, `crop`·`push`, 0.4초 교차), 숫자 카드 3장(`fact`), 지도 카드(한국 → 마리아나 해구 점선 화살표), 난파선 사진 켄 번스(`photo`, 영상의 한 장면), 효과음, 환경음 `deep`
- 2장 「탐사선의 새벽 세 시」: 그림 장면 — 썰 글 카드(`post`), Mochi 인물과 말풍선 대화(인물별 목소리 SunHi·Hyunsu), 표정 바뀜, 소품, 단톡방 폰, 문서 카드(근무 수칙), 빨간 자막 단어, "다음 날 아침..." 카드, 큰 글씨
- 3장 「바닷속 소름 돋는 장면 TOP5」: `top6` 쇼츠를 **가로로 다시 짜기**(`relayout`, 원본 NOAA 클립을 1920×1080 전체 화면으로), 아이콘 그리드 목차 + 줌인, 순위 딱지(`badge`), 1위 직전 2초 `pause`("1위는 과연?")와 음악 끊기(`musicCuts`), 그리드 답 공개 동그라미, TOP n 카드
- 4장 「쇼츠로 다시 보기」: `deepsea` 쇼츠(`final/deepsea.mp4`)를 흐린 배경 위 세로로 재생(쇼츠 소리 그대로, 롱폼 음악 꺼짐)
- 음악: Deep Haze → Investigations → Clean Soul → Gathering Darkness → Lost Frontier(챕터마다 교차, 목소리 밑 더킹)

**출처**: 영상 모두 NOAA Ocean Exploration · NOAA/PMEL(미국 정부 저작물), `media/top6/*.json`에 페이지·파일 주소·구간이 있고(받는 법: `media/fetch_top.py`, 또는 각 `file_url`을 받아 `cut_from_original_seconds` 구간을 1920×1080 30fps로 자름, 브림스톤은 위 ROV 정보 줄을 잘라 냄), 설명란 출처 줄은 `upload/txt/longdemo.txt`에 있습니다. 지도는 Natural Earth(퍼블릭 도메인), 그림은 직접 제작, 음악은 Kevin MacLeod(CC BY 4.0). 이야기(2장)는 창작입니다.

`python3 longform/qa_long.py longdemo` 결과: 길이 3:13.6(타임라인과 일치) · −14.0 LUFS · 37.1MB · 검은 화면 0 · 마지막 프레임 밝기 39/255 · 내레이션 공백 0 · 무음 0 · 자막 가장 긴 줄 861px · 챕터 5개(0:00 인트로, 0:26, 1:02, 1:37, 2:21) · 썸네일 1280×720 0.13MB · 멈춘 화면 0. WARN 하나: 데모라 10~25분 목표보다 짧음.

**확인 (기존 쇼츠는 그대로).** `src/Root.tsx`에 `<LongCompositions />`를 넣기 전과 후에 `sseol1`을 같은 설정으로 렌더링해 비교했습니다: 영상 1,008프레임의 framemd5가 모두 같고 소리 MD5도 같습니다(`b13659905638fd71ff57eda7cac6f7be`). `deepsea`의 0·300·600프레임 스틸도 바이트 단위로 같습니다.

## 썰 쇼츠 v2 (벤치마크, `sseol1`~`sseol20`)

`research/benchmark-drawn.md` 4절과 `research/benchmark-targets-drawn.json`의 `sseol` 목표(썰구리 "27살에 동생이 생겼다" 185만, "삼촌이 나보다 두 살 어리다" 109만)에 맞춰 `sseol1`~`sseol16`을 다시 만들고 `sseol17`~`sseol20`을 새로 만들었다. 20편 모두 창작이다. 화면 그림은 전부 직접 그린 것이라 외부 사진·영상은 쓰지 않았다(`edit.json`의 `sources`가 비어 있다).

**바뀐 점(벤치마크 레시피 그대로)**
- **화면 전체가 밝은 커뮤니티 앱 화면**이다. 위에서부터 앱 헤더("썰방", 우리가 지은 이름, 실제 서비스의 이름·로고·디자인 아님) → 글 제목 바(제목 + "익명 | 창작 사연게시판" + 빈 하트 "공감" 버튼, 숫자 없음) → **지금 말하는 문장**(검정 굵은 글씨 1~4줄, 강조어 한 색만 빨강) → **정사각형 풀컬러 그림 칸**(폭 900px, 83%) → 공감·댓글·공유 줄, 연한 "썰방" 워터마크 바탕. 0초부터 제목·첫 문장·그림이 함께 보인다. 아래 회색 빈칸, 화면 출처 표시, 무지개 강조색이 없다.
- **제목**은 "~한 이유" 2줄 25자에서 **이상한 사실 한 줄(11~13자)**로 바꿨다. `qa_review.py`의 "제목 호기심" 검사가 숫자·ㅋㅋ·? 같은 패턴을 요구해서, 숫자가 자연스러운 제목은 숫자를 넣고(“1년”, “100일째”, “3살”) 나머지는 커뮤니티 글 제목처럼 끝에 "ㅋㅋ"를 붙였다(ㅋ은 글자 수에 안 셈).
- **말투**는 문어체("~했다")에서 반말 구어체("~했어", "~거든", "겁나")로 다시 썼고, 내레이션은 Edge TTS **+28%**(인물 +26% 안팎, 노인 +10~16%)로 다시 녹음했다. 대사 안의 "!"·"..."는 TTS가 길게 쉬어서 말할 때는 쉼표로 바꾸고 화면 글에만 남겼다.
- **첫 문장(훅)**은 10~13음절로 줄여 2초 안팎에 끝난다. 대사는 말풍선 대신 본문에 따옴표로 나온다(벤치마크와 같음).
- **인물**은 모두 같은 찹쌀떡 대신 머리 모양·머리색·옷·나이가 다른 치비 캐릭터(`"style": "chibi"`)다. 할머니는 흰 파마 + 카디건, 아빠는 정장, 학생은 교복, 강아지는 강아지. 장면마다 크기·위치를 바꿔(클로즈업 1.4~1.55배, 둘이 마주 보기, 셋 이상 넓게) 같은 인물이 같은 자리에 같은 크기로 서 있지 않게 했다.

### 새 템플릿 옵션 (예전 쇼츠는 그대로)

| 파일 | 바뀐 것 |
|---|---|
| `src/lib/PostFrame.tsx` (새 파일) | `PostFrameShort`: `edit.json`에 `"postFrame"`이 있는 쇼츠를 위 앱 화면으로 그린다. 장면(`scene` 클립)은 1080×1080으로 그려서 그림 칸에 줄여 넣는다. 아래 자막·제목 띠는 그리지 않는다. 음성·음악·효과음은 `ClipShort`와 같다 |
| `src/lib/Chibi.tsx` (새 파일) | 치비 인물. `Look` = `hairdo`(`short` `spiky` `side` `buzz` `long` `bob` `pony` `pigtails` `bun` `perm` `bald`), `hair`, `skin`, `topKind`(`tee` `hoodie` `shirt` `suit` `cardigan` `uniform` `apron` `dress` `vest` `gown`), `top`, `pants`, `age`(`baby` `kid` `teen` `adult` `old`), `glasses`, `mustache`, `acc`(`ribbon` `pin` `headband` `cap`), `accColor`, `kind: "dog"`. 표정 13가지와 움직임은 찹쌀떡과 같다 |
| `src/lib/Sseol.tsx` | `Char`에 `style: "chibi"`와 `look`, 그리고 장면의 `zoom0`(시작 배율; `zoom`과 같으면 고정 클로즈업). 찹쌀떡 함수에 치비로 넘기는 한 줄. 둘 다 안 쓰면 예전과 같다 |
| `src/Root.tsx` | `postFrame`이 있는 쇼츠만 `PostFrameShort`로 그린다(한 줄) |
| `prep.py` | `edit.json`의 `postFrame`이 있으면 줄마다 본문 문장(그 줄 `cap`의 `/` 조각이 한 줄씩)과 시각을 `src/data/<id>.json`에 쓴다(세 줄) |
| `sseol_v2/build.py` (새 파일) | `sseol_v2/eps/<id>.py`의 짧은 이야기 명세(제목, 목소리, 등장인물 생김새, `(줄 id, 목소리, 대사, 본문, 장면)` 목록)에서 `shorts/<id>/script.json`·`edit.json`을 만든다 |
| `sseol_v2/score.py` (새 파일) | 아래 벤치마크 성적표를 잰다 |

`edit.json` 예:
```json
"postFrame": {"app": "썰방", "color": "#FF8A4C", "meta": "익명 | 창작 사연게시판"}
```
장면 인물 예: `{"style": "chibi", "mood": "shock", "size": 1.5, "look": {"age": "old", "hairdo": "perm", "hair": "#ececf0", "topKind": "cardigan", "top": "#c9a7ff"}}`

**만드는 순서**
```bash
python3 sseol_v2/build.py sseol17          # eps/sseol17.py → shorts/sseol17/script.json, edit.json
python3 voice_edge.py sseol17 && python3 prep.py sseol17
./render.sh sseol17 final/sseol17.mp4
python3 qa_review.py sseol17 && python3 sseol_v2/score.py sseol17
```
본문 한 줄(`cap`의 `/` 조각)은 12자 이하로 쓴다(`build.py`가 넘으면 알려 준다).

**다른 쇼츠가 그대로인지 확인**: 템플릿을 바꾸기 전에 `teuk1`, `road1`, 예전 `sseol2`(찹쌀떡 + 글 카드)의 0·100·300·600번째 프레임을 뽑아 두고, 바꾼 뒤 같은 데이터로 다시 뽑아 비교했다. 12장 모두 다른 픽셀이 0개였다(ImageMagick `compare -metric AE`).

### 이야기 검토 (REVIEW.md 2-1)

20편 모두 녹음 전에 2-1절 10개 항목으로 다시 봤다. 특히 1번(친구에게 전할 만한 한 줄), 2번(제목으로 결말을 못 맞힘), 5번(반전에 복선), 7번(설교 없음)을 봤다. 결말 유형은 9번에 따라 돌려 썼다.

**다시 쓴 편과 이유**
- `sseol5` (이야기 전체): 예전 결말 "착한 알바 → 시급 인상"은 2번이 금지하는 "착한 일 → 보상" 공식이었다. 새 이야기에서는 할아버지가 가게의 진짜 주인이고, 야간을 몰래 알바에게 떠넘긴 사장님이 들킨다. 복선: "나 찾으면 방금 나갔다고 해", 매일 "사장은 오늘도 야간 하지?"라고 묻기, 근무표.
- `sseol9` (이유): 예전 이유 "3년 전 쌀 포대를 들어 드린 보답"도 "착한 일 → 보상"이라 제목만 보고 맞힐 수 있었다. 새 이유: 밤마다 연습한 내 노래가 할머니의 자장가였고, 연습을 쉬자 반찬 대신 "왜 안 불러, 잠이 안 와" 쪽지가 걸린다. 복선: 반찬마다 들어 있는 도라지 배즙(목), 반찬이 시작된 주.
- `sseol12` (이유): 예전 "은퇴한 지점장 → 명예 지점장"은 뻔하고 보상형이었다. 새 이유: 할아버지는 내가 태어난 날부터 20년 동안 매일 천 원씩 저금했다. 펀치라인: 730만 원이어야 할 잔액이 300만 원이고, 범인은 할머니. 복선: "은퇴한 지 딱 20년", 매일 천 원, 할머니의 딴청.
- `sseol3` (제목·복선): 제목 "할머니가 내 운동화를 숨긴다"는 범인을 말해 버렸다. 그래서 "비 오면 내 운동화가 사라진다"로 바꿨다. 반전에 필요한 복선(다음 날 돌아온 운동화가 늘 따끈함 = 전기장판)과 마지막 펀치라인의 복선(할머니는 일기예보보다 무릎을 믿음)을 넣었다.
- 복선 보강(5번): `sseol1` "그 뒤로 내가 보건실 갈 일이 싹 없어짐", `sseol4` 남자친구가 "외국에서 자랐다고만" 말함, `sseol6` "회의 있는 날엔 꼭 제일 큰 사탕", `sseol7` 소개팅 상대 바지의 갈색 털, `sseol8` 조카가 일주일 놀러 온 뒤로 현관 카메라가 이상함, `sseol10` 내 패딩을 안 돌려준 동생, `sseol11` 비 오는 날 노란 우산, `sseol13` 내가 8살 때 고른 할머니 폰, `sseol14` "엄마가 외출한 날만 틀려", `sseol15` 에어컨 바로 밑 자리, `sseol17` 사 온 빵을 꼭 반 갈라 줌, `sseol18` 나는 동아리·엠티·미팅으로 바쁨.
- 손대지 않은 편: `sseol2`(쪽지 내용 "물 많이 마셔, 우산 챙겨"가 처음부터 엄마 잔소리 말투라는 복선이 있음), `sseol16`(사진마다 남은 보낸 기록), `sseol19`, `sseol20`(이름 "하나", 메모로 풀림).
- 설교(7번)는 20편 어디에도 없다. 교훈이나 "~하면 안 돼요"로 끝나는 편이 없다.

| id | 한 줄 요약 | 결말 유형 | 노리는 감정 |
|---|---|---|---|
| `sseol1` | 짝꿍이 1년 내내 내 우유를 뺏어 마셨는데, 사실 우유 못 먹는 애가 배 아픈 나 대신 마신 거였고, 지금은 남편이 돼서 습관처럼 다 마신다 | 의외의 이유 + 허탈 개그 | 설렘 |
| `sseol2` | 반장이 100일째 쪽지를 줘서 "나도 좋아" 답장까지 했는데, 쪽지는 엄마가 반장(엄마 친구 아들)에게 부탁한 잔소리였다 | 정체 반전 | 웃음 |
| `sseol3` | 비만 오면 운동화가 사라졌는데, 할머니가 몰래 빨아 전기장판에 말리고 있었고, 지금은 할머니 무릎 예보 때문에 맑은 날에도 장화를 신는다 | 의외의 이유 + 허탈 개그 | 웃음 |
| `sseol4` | 60살 아빠가 외국에서 자란 딸 남자친구를 맞으려고 석 달 영어를 연습했는데, 남자친구는 한국말을 더 잘했고 아빠는 지금도 영어만 쓴다 | 허탈 개그 | 웃음 |
| `sseol5` | 새벽 3시 할아버지한테 돈 받지 말라던 사장님, 할아버지는 가게 진짜 주인이었고 야간을 몰래 떠넘긴 게 들통났다 | 정체 반전 + 역전 | 사이다 웃음 |
| `sseol6` | 신입이 팀장님 책상에 매일 사탕을 둬서 아부·짝사랑 소문이 났는데, 굶은 날 회의가 2시간이 된다는 걸 알아낸 작전이었다 | 의외의 이유 | 공감 |
| `sseol7` | 소개팅 상대가 내 이름 "보리"에 웃음을 참았는데, 그 집 강아지 이름도 보리였다 | 오해 | 웃음 |
| `sseol8` | 택배 기사님들이 우리 집 초인종만 누르면 웃는데, 5살 조카가 초인종 소리를 "아저씨 사랑해요"로 바꿔 놓았다 | 정체 반전 | 뭉클한 웃음 |
| `sseol9` | 옆집 할머니가 3년째 반찬과 배즙을 걸어 줬는데, 밤마다 연습한 내 노래가 할머니 자장가였다 | 의외의 이유 | 뭉클 |
| `sseol10` | 동생이 생일마다 양말 한 짝, 이어폰 한쪽을 줬는데, 다 내가 잃어버린 거였고 마지막 상자엔 동생이 안 돌려준 내 패딩이 "선물"로 들어 있었다 | 허탈 개그 | 웃음 |
| `sseol11` | 카페 사장님이 내 컵에만 노란 우산 고양이 만화를 연재했는데, 그 고양이는 비 오는 날만 오는 나였다 | 정체 반전 | 설렘 |
| `sseol12` | 은퇴한 할아버지가 매일 은행에 천 원을 넣으러 갔는데, 내가 태어난 날부터 모은 통장이었고, 절반은 할머니가 꺼내 썼다 | 따뜻한 반전 + 허탈 개그 | 뭉클한 웃음 |
| `sseol13` | 할머니가 내 전화만 늦게 받았는데, 8살 내가 녹음한 벨소리를 끝까지 들으려고 그랬다 | 의외의 이유 | 뭉클 |
| `sseol14` | 강아지가 아빠 퇴근 10분 전을 맞혔는데, 엄마의 "아빠 오신다"를 외운 거였고, 엄마의 장난에 속은 날 진짜 아빠를 외면했다 | 의외의 이유 + 역전 개그 | 웃음 |
| `sseol15` | 한여름 독서실 내 자리에 매일 핫팩이 있었는데, 에어컨 밑에서 떠는 나를 본 사장님이었고, 다음 날 그 에어컨엔 "고장"이 붙었다 | 따뜻한 반전 | 뭉클 |
| `sseol16` | 할아버지가 1년 동안 같은 나무만 찍었는데, 입원한 할머니에게 계절을 보내는 거였고, 퇴원한 할머니는 "실물이 더 예쁘네" | 따뜻한 반전 | 뭉클 |
| `sseol17` | 족보가 꼬여 조카가 나보다 3살 위인데, 학교에선 날 부려 먹던 조카가 끝에 "우리 삼촌 건드리지 마" | 역전 | 사이다 웃음 |
| `sseol18` | 엄마랑 같은 해 같은 대학에 입학했는데, 첫 학기 성적이 엄마는 장학금, 나는 학사 경고 | 역전 개그 | 웃음 |
| `sseol19` | 할머니가 실수로 우리 반 단톡방에 들어왔는데, 반 애들이 할머니 공지를 반장보다 더 잘 듣게 됐다 | 의외의 전개 | 웃음 |
| `sseol20` | 모르는 "하나"가 매달 만 원을 보냈는데, 2학년 때 천 원 빌려준 짝꿍의 1년치 상환이었고, 나는 "12만 원어치 밥 사"로 답했다 | 정체 반전 | 뭉클한 웃음 |

### 벤치마크 성적표

`python3 sseol_v2/score.py <id>`로 쟀다. 벤치마크 쪽 길이·훅·전환·초당 음절·줄 수는 보고서의 *추정값*이다(재생 페이지가 로그인을 요구해서 못 쟀음). 우리 쪽은 렌더한 mp4(1080×1080 그림 칸, scene > 0.04)와 `build/<id>/timeline.json`에서 쟀다. 그림 칸에는 본문 문장도 들어가므로 문장이 바뀌는 것도 화면 변화로 센다.

| id | 제목 (글자) | 길이 | 훅 끝 | 첫 전환 | 평균/최장 화면 | 초당 음절 | 줄 |
|---|---|---|---|---|---|---|---|
| 목표 | 8~12자, "이유" 없음 | 40초 (35~55) | ≤2.0초 | ≤2.5초 | 2.8 / ≤4.0초 | ≥6.2 | 16 (14~20) |
| `sseol1` | 짝꿍이 내 우유를 1년 마셨다 (12) | 41.9초 | 1.86초 | 1.97초 | 2.33 / 3.83초 | 6.42 | 18 |
| `sseol2` | 반장 쪽지가 100일째 온다 (12) | 34.6초 | 1.63초 | 1.73초 | 2.16 / 2.87초 | 6.4 | 16 |
| `sseol3` | 비 오면 내 운동화가 사라진다ㅋㅋ (12) | 42.7초 | 1.77초 | 1.87초 | 2.25 / 3.83초 | 6.61 | 17 |
| `sseol4` | 60살 아빠가 영어 시작했다 (12) | 37.4초 | 1.88초 | 1.97초 | 2.34 / 3.4초 | 6.13 | 16 |
| `sseol5` | 3시 손님한텐 돈 받지 말래 (11) | 41.4초 | 1.95초 | 2.03초 | 2.59 / 3.43초 | 6.28 | 16 |
| `sseol6` | 신입이 매일 사탕을 두고 간다ㅋㅋ (12) | 36.5초 | 1.74초 | 1.83초 | 2.28 / 3.53초 | 6.27 | 16 |
| `sseol7` | 소개팅남이 내 이름에 웃었다ㅋㅋ (12) | 36.7초 | 2.18초 | 2.27초 | 2.29 / 3.73초 | 6.44 | 16 |
| `sseol8` | 택배 기사님이 매번 웃는다ㅋㅋ (11) | 37.8초 | 1.96초 | 2.03초 | 2.36 / 3.43초 | 6.38 | 16 |
| `sseol9` | 옆집에서 3년째 반찬이 온다 (12) | 38.4초 | 1.68초 | 1.77초 | 2.4 / 3.8초 | 6.52 | 16 |
| `sseol10` | 동생 선물이 양말 1짝이다ㅋㅋ (11) | 39.8초 | 2.04초 | 2.13초 | 2.49 / 3.77초 | 6.27 | 16 |
| `sseol11` | 카페 컵에 내 만화가 연재된다ㅋㅋ (12) | 41.1초 | 1.67초 | 1.77초 | 2.57 / 4.43초 | 6.45 | 16 |
| `sseol12` | 할아버지가 은행에 출근한다ㅋㅋ (12) | 38.7초 | 1.51초 | 1.6초 | 2.42 / 3.97초 | 6.58 | 16 |
| `sseol13` | 할머니가 내 전화만 늦게 받아ㅋㅋ (12) | 38.5초 | 1.72초 | 1.8초 | 2.41 / 3.47초 | 6.49 | 16 |
| `sseol14` | 강아지가 아빠 퇴근을 안다ㅋㅋ (11) | 35.5초 | 1.49초 | 1.57초 | 2.22 / 3.0초 | 6.41 | 16 |
| `sseol15` | 8월인데 책상에 핫팩이 있다 (12) | 41.5초 | 1.68초 | 1.77초 | 2.59 / 3.43초 | 6.49 | 16 |
| `sseol16` | 할아버지가 나무만 1년 찍었다 (13) | 35.8초 | 1.86초 | 1.93초 | 2.38 / 3.7초 | 6.57 | 15 |
| `sseol17` | 조카가 나보다 3살 형이다 (11) | 33.8초 | 1.46초 | 1.57초 | 2.11 / 2.97초 | 6.71 | 16 |
| `sseol18` | 엄마랑 같은 해에 입학했다ㅋㅋ (11) | 36.8초 | 1.65초 | 1.73초 | 2.3 / 3.1초 | 6.36 | 16 |
| `sseol19` | 할머니가 우리 단톡방에 있다ㅋㅋ (12) | 34.6초 | 1.75초 | 1.83초 | 2.16 / 3.1초 | 6.79 | 16 |
| `sseol20` | 매달 1일 만 원이 입금된다 (11) | 35.6초 | 1.56초 | 1.63초 | 2.37 / 3.77초 | 6.28 | 15 |

**목표를 못 맞춘 칸과 이유**
- **평균 화면 길이**는 20편 모두 2.1~2.6초로, 목표 2.8초보다 짧다. 문장마다 그림과 본문이 같이 바뀌기 때문이다. 벤치마크 S1·S2도 프레임 4장 중 3장이 달랐다. 최장 화면은 모두 4.5초 이하라서 qa 기준과 목표 4.0초 안팎을 지킨다(`sseol3` 3.83초, `sseol11` 4.43초는 한 문장이 길어서다).
- **길이**: `sseol2`·`sseol17`·`sseol19`는 35초보다 조금 짧다. 목표 40초는 추정값이고 qa 최적 구간(31~45초)에는 들어간다. 이야기를 늘리면 2-1절 "커지는 갈등"보다 군더더기가 늘어서 그대로 뒀다.
- **초당 음절**: `sseol4`는 6.13이다. 아빠가 더듬더듬 읽는 영어 두 줄("아임, 수아스, 파더", "오케이, 땡큐, 굿")이 일부러 느린 개그이고, 그 두 줄을 빼면 6.59다.
- **훅 끝**: 2.0초를 조금 넘는 편(`sseol7` 2.18초, `sseol10` 2.04초)은 첫 문장이 13음절이다. 첫 화면에는 0초부터 제목·첫 문장·그림이 함께 떠 있어서 훅은 0초에 보인다.
- **제목 길이**: `sseol16`은 13자로 목표(8~12자)보다 1자 길다. qa 기준(13자 이하)은 통과한다. 벤치마크처럼 숫자를 넣으면서 결말(할머니)을 숨기려면 이 길이가 필요했다.
- **줄 수**: 15~18줄로 목표(14~20)에 들어간다.

**`qa_review.py` 결과** (FAIL 0편)

- `sseol1`:  제목 띠 WARN 없음 
- `sseol2`:  제목 띠 WARN 없음 
- `sseol3`:  제목 띠 WARN 없음 
- `sseol4`:  제목 띠 WARN 없음 
- `sseol5`:  제목 띠 WARN 없음 
- `sseol6`:  제목 띠 WARN 없음 
- `sseol7`:  제목 띠 WARN 없음 
- `sseol8`:  제목 띠 WARN 없음 
- `sseol9`:  제목 띠 WARN 없음 
- `sseol10`:  제목 띠 WARN 없음 
- `sseol11`:  제목 띠 WARN 없음 
- `sseol12`:  제목 띠 WARN 없음 
- `sseol13`:  제목 띠 WARN 없음 
- `sseol14`:  제목 띠 WARN 없음 
- `sseol15`:  제목 띠 WARN 없음 
- `sseol16`:  제목 띠 WARN 없음 
- `sseol17`:  제목 띠 WARN 없음 
- `sseol18`:  제목 띠 WARN 없음 
- `sseol19`:  제목 띠 WARN 없음 
- `sseol20`:  제목 띠 WARN 없음 

`제목 띠` WARN은 20편 모두 같다. 이 검사는 위쪽 검정 띠 2줄 제목(`titleStyle: band`)을 찾는데, 썰 v2는 벤치마크대로 앱 화면의 글 제목 바가 제목 자리다. 그래서 띠를 일부러 쓰지 않았다(검사는 바꾸지 않았다).

### 출처·라이선스·사실

- **그림**: 20편 모두 `src/lib/Chibi.tsx`·`Sseol.tsx`로 직접 그렸다. 사진·영상·다른 채널의 캐릭터는 쓰지 않았다(`edit.json` `sources` = `{}`). 앱 화면 "썰방"은 지어낸 이름이고, 실제 서비스의 이름·로고·색을 따라 하지 않았다. 화면 안 간판·게시판 글은 "24시 편의점", "동네 서점", "작은 카페"처럼 일반 명사만 쓴다.
- **목소리**: Microsoft Edge TTS(ko-KR SunHi·InJoon·HyunsuMultilingual), `voice_edge.py`.
- **음악**: Kevin MacLeod (incompetech.com), CC BY 4.0. `sseol1`·`3`·`7`·`9`·`16` "Monkeys Spinning Monkeys", `sseol2`·`6`·`10`·`15`·`17`·`20` "Sneaky Snitch", `sseol4`·`5`·`12`·`13` "Scheming Weasel", `sseol8`·`11`·`14`·`18`·`19` "Hyperfun". 크레딧은 각 설명글에 있다.
- **사실 주장**: 20편 모두 지어낸 이야기(창작)이고, 사실로 내세우는 정보(수치, 법, 통계)가 없어서 인용할 자료가 없다. 설명글마다 "(창작)"과 "그림·이야기 직접 제작"과 "목소리: AI 합성 음성"이 들어간다. 실존 인물·학교·회사·은행·앱 이름은 없다.

### 업로드 문구

설명글은 `upload/specs/<id>.json` → `python3 upload/make_desc.py <id>` → `upload/txt/<id>.txt` 형식이다(채널 이름·핸들은 아직 `[채널명]`/`[핸들]` 자리표시자). 아래는 그 파일 내용 그대로이고, 고정 댓글을 함께 적었다.


`sseol1`
- 제목: 짝꿍이 내 우유를 1년 마셨다ㅋㅋ
- 설명:
  ```
  (창작) 초등학교 6학년 때 짝꿍은 1년 내내 급식 우유가 나오면 내 것까지 가져가서 원샷했습니다. 그렇게 뺏긴 우유만 200개, 그런데 걔는 마실 때마다 표정이 썩어 있었습니다. 졸업식 날, 짝꿍이 할 말이 있다며 나를 불렀습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #학교썰 #짝꿍 #급식 #우유 #초등학교 #설렘
  ```
- 고정 댓글: 여러분 짝꿍은 뭘 뺏어 먹었어요?ㅋㅋ

`sseol2`
- 제목: 반장 쪽지가 100일째 온다ㅋㅋ
- 설명:
  ```
  (창작) 고등학교 1학년, 반장이 100일째 매일 아침 내 책상에 접힌 쪽지를 두고 갔습니다. 물 많이 마셔, 우산 챙겨, 밥 꼭 먹어. 밤새 고민해서 답장까지 넣었는데, 그날 저녁 엄마가 나를 불렀습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #학교썰 #반장 #쪽지 #고백 #엄마 #고등학생
  ```
- 고정 댓글: 답장 엄마한테 들킨 적 있는 사람?ㅋㅋ

`sseol3`
- 제목: 비 오면 내 운동화가 사라진다ㅋㅋ
- 설명:
  ```
  (창작) 초등학생 시절, 비만 오면 현관에 있던 내 운동화가 감쪽같이 사라졌습니다. 덕분에 노란 장화를 신고 학교에 가서 놀림받은 게 세 번, 그런데 다음 날 돌아온 운동화는 늘 따끈따끈했습니다. 비 오는 밤, 몰래 현관을 지켜보기로 했습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #가족썰 #할머니 #운동화 #장마 #초등학생 #공감
  ```
- 고정 댓글: 할머니 사랑 느낀 순간 있으면 댓글로!

`sseol4`
- 제목: 60살 아빠가 영어 시작했다ㅋㅋ
- 설명:
  ```
  (창작) 예순 살 아빠가 갑자기 매일 새벽 5시에 거실에서 영어 한 문장만 백 번씩 연습하기 시작했습니다. 엄마도 이유를 모르는 아빠의 새벽 공부는 석 달 동안 계속됐습니다. 그 시작은 다음 주에 인사 오기로 한 딸의 남자친구였습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #가족썰 #아빠 #영어공부 #남자친구 #상견례 #아빠썰
  ```
- 고정 댓글: 여러분 아빠의 필살기 한마디는?ㅋㅋ

`sseol5`
- 제목: 3시 손님한텐 돈 받지 말래ㄷㄷ
- 설명:
  ```
  (창작) 편의점 야간 알바 첫날, 사장님은 새벽 3시에 오는 할아버지에게는 돈을 받지 말라는 이상한 규칙을 줬습니다. 할아버지는 매일 우유와 빵을 올려놓고 가게를 둘러본 뒤 사장님이 오늘도 야간을 하는지 물었습니다. 한 달째 되던 날, 할아버지가 근무표를 넘겨 보기 시작했습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #알바썰 #편의점 #편의점알바 #야간알바 #사장님 #사이다
  ```
- 고정 댓글: 알바하면서 들은 제일 이상한 규칙은?ㅋㅋ

`sseol6`
- 제목: 신입이 매일 사탕을 두고 간다ㅋㅋ
- 설명:
  ```
  (창작) 회사 신입이 매일 아침 팀장님 책상에 사탕을 하나씩 두고 갔고, 회의가 있는 날엔 꼭 제일 큰 사탕이었습니다. 사무실에는 아부다, 짝사랑이다 소문이 돌았습니다. 참다못해 직접 물어보니, 신입은 회의 때문이라고 답했습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #회사생활 #직장인 #신입 #팀장님 #회의 #공감
  ```
- 고정 댓글: 우리 팀장님 회의 몇 분 해요?ㅋㅋ

`sseol7`
- 제목: 소개팅남이 내 이름에 웃었다ㅋㅋ
- 설명:
  ```
  (창작) 첫 소개팅 자리에서 "보리예요" 하고 이름을 말하자마자 상대가 고개를 숙이고 웃음을 참았습니다. 그 사람 바지에는 갈색 털이 잔뜩 묻어 있었습니다. 기분이 상해 일어나려는데, 상대가 휴대폰을 꺼내 보여 줬습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #소개팅 #연애썰 #이름 #강아지 #커플 #설렘
  ```
- 고정 댓글: 이름 때문에 생긴 웃긴 일 있어요?ㅋㅋ

`sseol8`
- 제목: 택배 기사님이 매번 웃는다ㅋㅋ
- 설명:
  ```
  (창작) 조카가 일주일 놀러 왔다 간 뒤로, 택배 기사님들이 우리 집 초인종만 누르면 웃음을 터뜨렸습니다. 배를 잡고 웃는 분도, 카메라에 손을 흔드는 분도 있었지만 문에는 아무것도 붙어 있지 않았습니다. 결국 직접 초인종을 눌러 보기로 했습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #택배 #조카 #초인종 #택배기사님 #가족썰 #훈훈
  ```
- 고정 댓글: 조카가 친 사고 자랑해 주세요ㅋㅋ

`sseol9`
- 제목: 옆집에서 3년째 반찬이 온다
- 설명:
  ```
  (창작) 3년째 매일 저녁, 우리 집 문고리에 멸치볶음과 김치, 그리고 꼭 도라지 배즙 한 봉지가 든 반찬 봉지가 걸려 있습니다. 범인은 옆집 할머니였습니다. 왜 자꾸 반찬을 주시냐고 묻자, 할머니는 뜻밖에도 내 목 걱정을 했습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #이웃 #반찬 #할머니 #아파트 #층간소음 #감동
  ```
- 고정 댓글: 벽 너머 이웃이랑 생긴 일 있어요?

`sseol10`
- 제목: 동생 선물이 양말 1짝이다ㅋㅋ
- 설명:
  ```
  (창작) 내 패딩을 빌려 가서 안 돌려준 동생이 생일 선물이라며 준 상자에는 양말 딱 한 짝이 들어 있었습니다. 다음엔 이어폰 한쪽, 그다음엔 머리끈, 마지막엔 접는 우산까지 나왔습니다. 그런데 우산을 펼쳐 보니 거기에 내 이름이 쓰여 있었습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #남매 #동생 #생일선물 #가족썰 #현실남매 #선물
  ```
- 고정 댓글: 동생한테 받은 제일 이상한 선물은?ㅋㅋ

`sseol11`
- 제목: 카페 컵에 내 만화가 연재된다ㅋㅋ
- 설명:
  ```
  (창작) 비 오는 날마다 노란 우산을 쓰고 가는 단골 카페에서, 사장님은 내 컵 홀더에만 그림을 그려 줬습니다. 노란 우산 쓴 고양이가 버스를 타고, 비에 젖고, 만화처럼 이어졌습니다. 그런데 그림은 이상하게 비 오는 날에만 받을 수 있었습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #카페 #단골 #고양이 #비오는날 #카페사장님 #설렘
  ```
- 고정 댓글: 단골 가게에서 받은 서비스 자랑해 주세요!

`sseol12`
- 제목: 할아버지가 은행에 출근한다ㅋㅋ
- 설명:
  ```
  (창작) 은퇴한 지 딱 20년 된 할아버지가 매일 오전 10시, 천 원짜리 한 장을 들고 동네 은행으로 출근합니다. 직원들도 다 아는 단골인데, 넣는 돈은 늘 천 원뿐이었습니다. 할머니에게 이유를 묻자 할머니는 갑자기 딴청을 피웠습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #할아버지 #은행 #적금 #가족썰 #할머니 #감동
  ```
- 고정 댓글: 할머니 할아버지한테 받은 제일 큰 선물은?

`sseol13`
- 제목: 할머니가 내 전화만 늦게 받아ㅠㅠ
- 설명:
  ```
  (창작) 엄마가 전화하면 바로 받는 할머니가 내 전화만은 꼭 한참 울리게 둔 뒤에 받습니다. 할머니 폰은 내가 8살 때 같이 고른, 10년도 넘은 폰입니다. 할머니 집에서 몰래 전화를 걸어 보니, 할머니는 휴대폰을 보며 가만히 듣고만 있었습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #할머니 #가족썰 #전화 #벨소리 #손녀 #감동
  ```
- 고정 댓글: 오늘 할머니한테 전화 한 통 어때요?

`sseol14`
- 제목: 강아지가 아빠 퇴근을 안다ㅋㅋ
- 설명:
  ```
  (창작) 우리 집 강아지 초코는 아빠가 오기 딱 10분 전이면 현관에 가서 앉습니다. 하루도 틀리지 않는데, 이상하게 엄마가 외출한 날만 틀립니다. 그래서 하루 종일 초코를 지켜보기로 했습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #강아지 #반려견 #아빠 #퇴근 #가족썰 #댕댕이
  ```
- 고정 댓글: 여러분 강아지의 초능력은?ㅋㅋ

`sseol15`
- 제목: 8월인데 책상에 핫팩이 있다?
- 설명:
  ```
  (창작) 고3 여름, 독서실 에어컨 바로 밑 자리에서 공부하던 내 책상에 매일 저녁 핫팩이 하나씩 놓여 있었습니다. 한여름에 핫팩이라니 누가 장난을 치는 줄 알았습니다. 하루는 일찍 와서 숨어 지켜봤더니, 핫팩을 두고 간 사람은 독서실 사장님이었습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #독서실 #고3 #수험생 #핫팩 #에어컨 #감동
  ```
- 고정 댓글: 공부할 때 고마웠던 사람 있어요?

`sseol16`
- 제목: 할아버지가 나무만 1년 찍었다
- 설명:
  ```
  (창작) 할아버지는 1년 동안 매일 아침 같은 시간, 같은 자리에서, 같은 나무만 찍었습니다. 휴대폰 사진첩이 전부 그 나무였고, 사진마다 누군가에게 보낸 기록이 남아 있었습니다. 받는 사람은 할머니였습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #할아버지 #할머니 #나무 #사진 #부부 #감동
  ```
- 고정 댓글: 할머니 할아버지 이야기 들려주세요

`sseol17`
- 제목: 조카가 나보다 3살 형이다ㅋㅋ
- 설명:
  ```
  (창작) 큰누나와 나는 스물다섯 살 차이라서, 나보다 세 살 많은 조카가 있습니다. 문제는 그 조카와 같은 고등학교에 다닌다는 것, 학교에서는 선배인 조카에게 빵 심부름을 합니다. 그런데 명절만 되면 상황이 완전히 바뀝니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #족보 #조카 #삼촌 #가족썰 #명절 #고등학교
  ```
- 고정 댓글: 여러분 집 족보도 꼬였어요?ㅋㅋ

`sseol18`
- 제목: 엄마랑 같은 해에 입학했다ㅋㅋ
- 설명:
  ```
  (창작) 내가 대학에 붙은 날, 엄마도 합격 문자를 받았습니다. 스무 살에 나를 낳느라 대학을 못 간 엄마가 마흔에 수능을 다시 봤고, 하필 나와 같은 학교였습니다. 입학식 날 우리 과 단체 사진에는 엄마가 껴 있었습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #대학생 #새내기 #엄마 #만학도 #가족썰 #캠퍼스
  ```
- 고정 댓글: 엄마랑 같은 학교 다니면 어떨 것 같아요?ㅋㅋ

`sseol19`
- 제목: 할머니가 우리 단톡방에 있다ㅋㅋ
- 설명:
  ```
  (창작) 어느 날 우리 반 단톡방에 '할미'라는 사람이 들어왔습니다. 프로필 사진은 우리 할머니, 내 폰으로 사진을 보다가 초대 버튼을 누른 것이었습니다. 할머니의 첫 메시지 한 줄에 단톡방은 난리가 났습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Hyperfun" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #단톡방 #할머니 #학교썰 #고등학생 #카톡 #공감
  ```
- 고정 댓글: 단톡방에서 생긴 웃긴 일 있어요?ㅋㅋ

`sseol20`
- 제목: 매달 1일 만 원이 입금된다ㄷㄷ
- 설명:
  ```
  (창작) 매달 1일, 모르는 사람이 내 통장에 만 원을 보냅니다. 입금자 이름은 매번 '하나', 벌써 1년째 한 번도 빠지지 않았습니다. 은행에서도 정상 계좌라고 해서, 나도 1원을 보내며 메모를 적었습니다.

  ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]

  출처: 그림·이야기 직접 제작 · 목소리: AI 합성 음성 · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)

  #Shorts #썰 #썰툰 #창작썰 #썰애니 #웃긴썰 #입금 #통장 #친구 #초등학교 #우정 #감동
  ```
- 고정 댓글: 여러분은 어릴 때 빌려준 돈 기억나요?ㅋㅋ

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

**다른 쇼츠는 그대로인지 확인했습니다.** origin을 합치기 전, 손대지 않은 v1 `issue1`을 훅이 없는 원래 `ClipShort.tsx`와 훅을 넣은 `ClipShort.tsx`로 각각 렌더해 비교했더니, 두 mp4가 바이트까지 같았습니다(`cmp` 동일, 프레임별 md5 동일). `qa_review.py`는 고치지 않았습니다.

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
| `issue1` | 누리호 위성 15기 중 / 1기만 못 나온 이유 | 위성 딱 한 기가 못 나갔습니다. | Heroic Age |
| `issue2` | 기름값 상한제 있는데 / 경유 20% 오른 이유 | 경유값이 이십 퍼센트 올랐습니다. | Movement Proposition |
| `issue3` | 한글날이 22년 동안 / 쉬는 날 아니었던 이유 | 한글날, 이십이 년 안 쉬었습니다. | Heartwarming |
| `issue4` | 올해 노벨물리학상 / 남극 얼음 덩어리의 정체 | 일 초에 백조 개가 몸을 뚫고 갑니다. | Floating Cities |
| `life1` | 비행기 창문이 / 네모가 아닌 진짜 이유 | 창 모서리가, 비행기를 찢었습니다. | Movement Proposition |
| `life2` | 엘리베이터 거울이 / 셀카용이 아닌 진짜 이유 | 엘리베이터 거울, 셀카용 아닙니다. | Sneaky Snitch |
| `life3` | 제한속도 지켜도 / 1차로에서 단속되는 이유 | 1차로 주행, 사만 원입니다. | Exhilarate |
| `life4` | 이착륙 때 창문 덮개 / 열라고 하는 진짜 이유 | 창문 덮개는 비상구 찾는 빛. | Floating Cities |
| `life5` | 신호등 노란불이 / 3초인 진짜 이유 | 노란불 3초 밟는 시간 아닙니다. | Hustle |
| `life6` | 비상구 표시가 / 초록색인 진짜 이유 | 비상구 초록 국제 약속입니다. | Lightless Dawn |
| `life7` | 볼펜 뚜껑에 / 구멍이 뚫린 진짜 이유 | 볼펜 뚜껑 구멍은, 숨구멍입니다. | Scheming Weasel |
| `life8` | 지하철 임산부 배려석이 / 분홍색인 진짜 이유 | 분홍 배려석 눈에 띄라고 칠했습니다. | Heartwarming |
| `hanban1` | 백두산이 폭발하면 / 화산재는 어디로 갈까? | 백두산 화산재 일본까지 갔습니다. | Lightless Dawn |
| `hanban2` | 태풍이 한국 앞에서 / 휙 꺾이는 이유 | 태풍 길은, 고기압이 정합니다. | Movement Proposition |
| `hanban3` | 가을 하늘이 유독 / 높고 파란 이유 | 가을 하늘 먼지가 절반입니다. | Dreamer |
| `hanban4` | 한국에서 오로라가 / 찍힌 날 생긴 일 | 한국 하늘에 오로라가 찍혔습니다. | Floating Cities |
| `why1` | 한반도에 반달곰이 / 다시 돌아온 진짜 이유 | 여섯 마리가 구십육 마리 됐습니다. | Heartwarming |
| `why2` | 문어 심장이 / 3개인 진짜 이유 | 문어는 심장이 세 개입니다. | Monkeys Spinning Monkeys |
| `why3` | 철원에 두루미 떼가 / 해마다 오는 진짜 이유 | 두루미 떼, 만 천 마리 왔습니다. | Dreamer |
| `why4` | 까치가 한국에선 길조 / 영국에선 흉조인 이유 | 나라새 일 위 까치입니다. | Sneaky Snitch |

### 벤치마크 점수표

목표(`research/benchmark-targets-footage.json` → `info_reason`): 길이 32초(레시피 28–40), 훅 끝 ≤2.0초, 첫 컷 0.5초, 평균 샷 2.2초(레시피 2.0–2.5), 최장 샷 ≤3.5초, 6.4음절/초, 13문장(레시피 12–15), 제목 줄당 [11, 11]자(레시피 9–13).

우리 값은 `final/<id>.mp4`(ffprobe, qa_review.py 장면 감지)와 `build/<id>/timeline.json`(voice_edge.py)에서 `python3 media/info2/scorecard.py <id>`로 쟀습니다. 음절/초는 '전체'(음절 ÷ 영상 길이)와 '발화'(음절 ÷ 줄들의 소리 길이, 줄 안 쉼 포함). 문장 수는 대본의 마침표·물음표 수.

| id | 화면 제목 | 길이 | 훅 끝 | 첫 컷 | 평균 샷 | 최장 샷 | 음절/초 전체 · 발화 | 문장 | 제목 글자/줄 | 벗어난 점 |
|---|---|---|---|---|---|---|---|---|---|---|
| `issue1` | 누리호 위성 15기 중 / 1기만 못 나온 이유 | 31.7 | 1.71 | 0.5 | 2.12 | 3.43 | 5.92 · 6.24 | 11 | 12+11 | 문장 11개 |
| `issue2` | 기름값 상한제 있는데 / 경유 20% 오른 이유 | 32.3 | 1.86 | 0.5 | 2.02 | 3.1 | 6.1 · 6.39 | 9 | 11+12 | 문장 9개 |
| `issue3` | 한글날이 22년 동안 / 쉬는 날 아니었던 이유 | 27.4 | 1.9 | 0.5 | 1.96 | 3.2 | 6.28 · 6.66 | 9 | 11+12 | 길이 27.4초, 문장 9개 |
| `issue4` | 올해 노벨물리학상 / 남극 얼음 덩어리의 정체 | 29.4 | 1.9 | 0.5 | 1.63 | 2.97 | 6.43 · 6.76 | 9 | 9+13 | 문장 9개 |
| `life1` | 비행기 창문이 / 네모가 아닌 진짜 이유 | 27.0 | 1.97 | 0.5 | 2.25 | 3.3 | 6.62 · 7.03 | 7 | 7+12 | 길이 27.0초, 문장 7개 |
| `life2` | 엘리베이터 거울이 / 셀카용이 아닌 진짜 이유 | 27.3 | 1.93 | 0.5 | 1.95 | 3.3 | 6.59 · 7.03 | 9 | 9+13 | 길이 27.3초, 문장 9개 |
| `life3` | 제한속도 지켜도 / 1차로에서 단속되는 이유 | 25.8 | 1.8 | 0.5 | 1.72 | 3.23 | 6.33 · 6.74 | 9 | 8+13 | 길이 25.8초, 문장 9개 |
| `life4` | 이착륙 때 창문 덮개 / 열라고 하는 진짜 이유 | 27.9 | 1.43 | 0.5 | 2.15 | 3.3 | 6.2 · 6.57 | 9 | 11+12 | 길이 27.9초, 문장 9개 |
| `life5` | 신호등 노란불이 / 3초인 진짜 이유 | 35.4 | 1.62 | 0.5 | 2.08 | 3.57 | 6.39 · 6.72 | 9 | 8+9 | 최장 샷 3.57초, 문장 9개 |
| `life6` | 비상구 표시가 / 초록색인 진짜 이유 | 31.9 | 1.55 | 0.5 | 1.99 | 3.13 | 6.43 · 6.76 | 8 | 7+10 | 문장 8개 |
| `life7` | 볼펜 뚜껑에 / 구멍이 뚫린 진짜 이유 | 34.1 | 1.97 | 0.5 | 1.63 | 3.4 | 6.09 · 6.44 | 11 | 6+12 | 문장 11개 |
| `life8` | 지하철 임산부 배려석이 / 분홍색인 진짜 이유 | 33.6 | 1.67 | 0.5 | 1.98 | 3.0 | 6.12 · 6.46 | 10 | 12+10 | 문장 10개 |
| `hanban1` | 백두산이 폭발하면 / 화산재는 어디로 갈까? | 29.8 | 1.74 | 0.5 | 1.99 | 3.27 | 6.48 · 6.94 | 10 | 9+12 | 문장 10개 |
| `hanban2` | 태풍이 한국 앞에서 / 휙 꺾이는 이유 | 28.5 | 1.72 | 0.5 | 1.42 | 2.67 | 6.15 · 6.57 | 8 | 10+8 | 문장 8개 |
| `hanban3` | 가을 하늘이 유독 / 높고 파란 이유 | 28.6 | 1.43 | 0.5 | 1.79 | 3.3 | 6.36 · 6.8 | 9 | 9+8 | 문장 9개 |
| `hanban4` | 한국에서 오로라가 / 찍힌 날 생긴 일 | 29.4 | 1.54 | 0.5 | 2.1 | 3.37 | 5.88 · 6.27 | 10 | 9+9 | 문장 10개 |
| `why1` | 한반도에 반달곰이 / 다시 돌아온 진짜 이유 | 37.0 | 1.62 | 0.5 | 1.85 | 3.6 | 6.02 · 6.32 | 13 | 9+12 | 최장 샷 3.6초 |
| `why2` | 문어 심장이 / 3개인 진짜 이유 | 28.6 | 1.47 | 0.5 | 1.24 | 3.1 | 6.29 · 6.67 | 10 | 6+9 | 문장 10개 |
| `why3` | 철원에 두루미 떼가 / 해마다 오는 진짜 이유 | 29.7 | 1.87 | 0.5 | 1.85 | 3.1 | 6.0 · 6.31 | 12 | 10+12 | 없음 |
| `why4` | 까치가 한국에선 길조 / 영국에선 흉조인 이유 | 32.1 | 1.42 | 0.5 | 1.78 | 3.3 | 6.04 · 6.37 | 12 | 11+11 | 없음 |

**표에서 벗어난 점과 이유**

- **문장 수(목표 13, 레시피 12–15).** 우리 편은 대부분 8–11문장입니다. 대신 자막은 편마다 20–27장입니다.
  - 벤치마크 `lines`는 자막 단서로 추정한 값입니다. 우리 대본은 한 줄에 두세 구절(`|`)을 이어 말하기 때문에 마침표로 세면 적게 나옵니다.
  - 문장을 늘리면 길이가 40초를 넘기 쉽습니다. 그래서 정보량(음절 160–230)과 길이를 기준으로 맞췄습니다.
- **길이 28초 미만(life1 27.0, life2 27.3, life3 25.8, life4 27.9, issue3 27.4).** v1 대본에 결과형 첫 줄을 붙이고 목소리를 +25%로 올리면서 1–3초 줄었습니다.
  - qa_review 기준(25–45초)은 PASS입니다.
  - life3에는 같은 근거의 "승합차는 5만 원" 한 줄을 더해 25초를 넘겼습니다.
  - 내용이 없는 문장을 덧붙여 늘리지는 않았습니다.
- **최장 샷 3.5초 초과(why1 3.6, life5 3.57).**
  - why1은 같은 동물원 장면을 연달아 쓴 구간을 장면 감지가 한 샷으로 합쳤습니다.
  - life5는 대법원 판결 문장의 정지선 컷입니다.
  - 둘 다 qa_review 기준(4.5초)은 PASS입니다.
- **전체 음절/초가 6.4보다 낮은 편(5.7–6.3).** 전체 값은 줄과 줄 사이의 쉼과 끝 0.5초를 포함합니다. 말하는 동안의 속도(발화)는 6.0–7.0으로 벤치마크 6.3–6.6 근처입니다.
- **제목 줄당 글자.** 화면 제목은 v1 제목을 그대로 두었습니다. 띠 제목이 이미 "~하는 진짜 이유", "~ 생긴 일", "~의 정체" 패턴이고 qa_review 제목 길이도 PASS여서, 채널 안 일관성을 지켰습니다. 업로드 제목은 아래처럼 "진짜 이유", "ㄷㄷ", "?" 꼴로 바꿨습니다.
- **issue1, issue2, issue4, hanban3은 origin을 합치기 전에 렌더했습니다.** 합친 뒤 프레임 이름만 `tall`에서 공용 `capTall`로 바꿨고, 둘은 같은 1080×1520 상자라 화면은 같습니다. 나머지 16편은 합친 템플릿으로 렌더했습니다. qa_review는 20편 모두 합친 뒤의 qa_review.py로 다시 돌렸습니다.


### 영상·사진 출처와 라이선스

파일마다 페이지·파일 주소·라이선스·제작자·쓴 구간은 `media/info2/sources.json`(이 표의 원본)과 각 `edit.json`의 `sources`에 있습니다. Pexels 항목은 하나씩 페이지를 열어 License "Free"(Pexels License)를 확인했습니다(2026-10-10). 화면에는 출처 배지를 두지 않고, 아래 업로드 문구의 설명란에 모두 적습니다.

**issue1**
- [Second launch of the Korean Space Launch Vehicle-II on 21 June 2022 (KARI TV, CC BY)](https://commons.wikimedia.org/wiki/File:Second_launch_of_the_Korean_Space_Launch_Vehicle-II_on_21_June_2022.webm) — CC BY (KARI TV via Commons, YouTube CC-BY); 1.5-3.4s, 56.5-59.0s, 12.5-15.1s, 60.0-62.2s, cover still (frame at 4.4s)
- [Third launch of the Korean Space Launch Vehicle-II on 25 May 2023 (KARI TV, CC BY), incl. onboard cameras](https://commons.wikimedia.org/wiki/File:Third_launch_of_the_Korean_Space_Launch_Vehicle-II_on_25_May_2023.webm) — CC BY (KARI TV via Commons, YouTube CC-BY); 66.0-68.1s, 88.0-90.0s, 126.0-128.1s, 138.0-140.9s, 190.0-192.1s, 160.0-161.5s, 300.0-303.4s, 306.0-307.7s, 34.0-36.3s
- [누리호 1차 시험 발사 장면, 2021-10-21 (KARI, CC BY)](https://commons.wikimedia.org/wiki/File:누리호_1차_시험_발사_장면.webm) — CC BY (KARI via Commons, YouTube CC-BY); 52.0-54.4s

**issue2**
- [Pexels video 9592759 by David Bronner (Pexels License)](https://www.pexels.com/video/close-up-of-gas-pump-display-9592759/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 0.0-2.0s, 0.6-2.9s
- [Pexels video 9109484 by Shoot With Riyas (Pexels License)](https://www.pexels.com/video/a-person-refilling-gas-on-a-car-9109484/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 1.0-2.4s, 5.5-7.5s, 4.0-6.5s, cover still (frame at 2.4s)
- [Pexels video 15556113 by African Creator (Pexels License)](https://www.pexels.com/video/fuel-pump-15556113/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.6-4.7s, 5.5-8.6s
- [iss063e002679, northern tip of Oman on the Strait of Hormuz, 2020-04-23 (NASA, Christopher Cassidy, public domain)](https://images.nasa.gov/details/iss063e002679) — Public domain (NASA); still 2.4s on screen
- [Pexels video 4911815 by Esteban M (Pexels License)](https://www.pexels.com/video/an-oil-tanker-in-the-sea-4911815/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-3.9s
- [Pexels video 9654558 by Zahid Nisar (Pexels License)](https://www.pexels.com/video/an-oil-tanker-traveling-across-the-sea-9654558/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 1.0-2.5s
- [Pexels video 29959405 by Toàn BDS (Pexels License)](https://www.pexels.com/video/aerial-view-of-industrial-oil-refinery-by-the-sea-29959405/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 3.0-5.6s
- [Pexels video 10396407 by Tom Fisk (Pexels License)](https://www.pexels.com/video/aerial-view-of-oil-refinery-plant-10396407/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 5.0-7.3s
- [Pexels video 33682128 by Toàn BDS (Pexels License)](https://www.pexels.com/video/aerial-view-of-industrial-storage-tank-facility-33682128/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 20.0-22.1s
- [Pexels video 30899591 by Toàn BDS (Pexels License)](https://www.pexels.com/video/aerial-view-of-industrial-plant-and-storage-tanks-30899591/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 6.0-7.7s
- [Pexels video 14807918 by Luke Nomad (Pexels License)](https://www.pexels.com/video/drone-footage-of-a-docked-oil-tanker-14807918/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-4.5s

**issue3**
- [Hunminjeongeum Haerye 02 (1446, public domain)](https://commons.wikimedia.org/wiki/File:Hunminjeongeum_Haerye_02.jpg) — Public domain (PD-old, 1446); still 2.0s on screen, still 1.6s on screen, cover still (frame at 0s)
- [Gwanghwamun in November 1993, 국립민속박물관 민속아카이브 (KOGL Type 1)](https://commons.wikimedia.org/wiki/File:Gwanghwamun_in_November_1993.jpg) — KOGL Type 1; still 3.0s on screen, still 1.7s on screen
- [한글날 기념식 (1954), 한국정책방송원 via 공유마당 (KOGL Type 1)](https://commons.wikimedia.org/wiki/File:한글날_기념식_(1954).jpg) — KOGL Type 1; still 1.5s on screen, still 1.8s on screen
- [광화문과 구중앙청 (1996.08) 01, 서울연구데이터서비스 (KOGL Type 1)](https://commons.wikimedia.org/wiki/File:광화문과_구중앙청_(1996.08)_01.jpg) — KOGL Type 1; still 2.7s on screen
- [광화문 (1996.05), 서울연구데이터서비스 (KOGL Type 1)](https://commons.wikimedia.org/wiki/File:광화문_(1996.05).jpg) — KOGL Type 1; still 1.9s on screen
- [Hunminjeongeum Haerye 07 (1446, public domain)](https://commons.wikimedia.org/wiki/File:Hunminjeongeum_Haerye_07.jpg) — Public domain (PD-old, 1446); still 3.2s on screen
- [Nightview of the Gwanghwamun Square 2024, Seoul Tourism Organization (KOGL Type 1)](https://commons.wikimedia.org/wiki/File:Nightview_of_the_Gwanghwamun_Square_2024.jpg) — KOGL Type 1; still 2.7s on screen
- [Hunminjeongeum Haerye 01 front cover (1446, public domain)](https://commons.wikimedia.org/wiki/File:Hunminjeongeum_Haerye_01_(front_cover).jpg) — Public domain (PD-old, 1446); still 1.8s on screen
- [나신걸 한글편지, 1490 (Cultural Heritage Administration, KOGL Type 1)](https://commons.wikimedia.org/wiki/File:나신걸_한글편지,_1490.jpg) — KOGL Type 1; still 1.5s on screen
- [여주 영릉(세종) 전경(항공), 문화재청 (KOGL Type 1)](https://commons.wikimedia.org/wiki/File:여주_영릉과_영릉_세종_영릉_전경(항공).jpg) — KOGL Type 1; still 2.0s on screen

**issue4**
- [Blazar EarthShot A (NASA's Goddard Space Flight Center Conceptual Image Lab, SVS 20281)](https://svs.gsfc.nasa.gov/20281) — Public domain (NASA); 4.2-5.2s
- [NASA's Fermi Links Cosmic Neutrino to Monster Black Hole (NASA's Goddard Space Flight Center, SVS 12994) — picture only, its music is muted](https://svs.gsfc.nasa.gov/12994) — Public domain (NASA); third-party music muted; 25.0-26.1s, 22.0-23.9s, 53.0-56.0s, 47.0-48.9s, 11.0-13.1s, 58.0-60.1s
- [Blazar EarthShot B (NASA's Goddard Space Flight Center Conceptual Image Lab, SVS 20281)](https://svs.gsfc.nasa.gov/20281) — Public domain (NASA); 4.0-6.0s, 1.0-3.9s
- [The ICL at Dawn (John Hardin, CC BY 4.0)](https://commons.wikimedia.org/wiki/File:The_ICL_at_Dawn.jpg) — CC BY 4.0; still 2.9s on screen, still 1.9s on screen, cover still (frame at 0s)
- [The IceCube Neutrino Observatory (Karen Andeen and Matthias Plum for the IceCube Collaboration, CC BY 4.0)](https://commons.wikimedia.org/wiki/File:The_IceCube_Neutrino_Observatory.jpg) — CC BY 4.0; still 2.0s on screen
- [The ICL at Night (John Hardin, CC BY 4.0)](https://commons.wikimedia.org/wiki/File:The_ICL_at_Night.jpg) — CC BY 4.0; still 1.8s on screen
- [Amundsen-Scott dome Aurora (Jonathan Berry/National Science Foundation, public domain)](https://commons.wikimedia.org/wiki/File:Amundsen-Scott_dome_Aurora_1.jpg) — Public domain (PD-USGov-NSF); still 2.9s on screen

**life1**
- [Pexels video 10710412 by Afif Ramdhasuma (Pexels License)](https://www.pexels.com/video/an-airplane-window-seat-view-10710412/) — Pexels License; 0.3-2.4s, cover still (frame at 0.3s)
- [BOAC de Havilland Comet at Entebbe, 1952 — Ministry of Information official photographer, IWM TR 6113 (PD-UKGov)](https://commons.wikimedia.org/wiki/File:BOAC_Comet_1952.jpg) — Public domain (PD-UKGov: Crown copyright photograph taken before 1 June 1957); still 2.7s on screen, still 2.3s on screen, still 3.3s on screen
- [Pexels video 3740041 by K (Pexels License)](https://www.pexels.com/video/view-of-sunset-from-an-airplane-in-flight-3740041/) — Pexels License; 0.5-2.8s, 6.0-7.7s
- [Pexels video 11292266 by Alireza Akhlaghi (Pexels License)](https://www.pexels.com/video/window-view-from-an-airplane-flying-above-the-clouds-11292266/) — Pexels License; 10.0-12.6s
- [Pexels video 2023708 by Sher Lyn . (Pexels License)](https://www.pexels.com/video/view-of-an-airplane-s-wing-from-window-2023708/) — Pexels License; 1.0-4.2s
- [Pexels video 8511231 by Lukas L (Pexels License)](https://www.pexels.com/video/a-view-in-the-window-seat-8511231/) — Pexels License; 1.0-3.2s
- [Pexels video 35839565 by Rise Within Studio (Pexels License)](https://www.pexels.com/video/airplane-takeoff-view-with-rain-on-window-35839565/) — Pexels License; 3.0-4.9s
- [Pexels video 3785721 by Taryn Elliott (Pexels License)](https://www.pexels.com/video/view-of-the-airport-field-from-an-airplane-s-window-3785721/) — Pexels License; 4.0-6.7s

**life2**
- [Pexels photo 32571093 by Anna Holodna (Pexels License)](https://www.pexels.com/photo/couple-taking-mirror-selfie-in-elevator-32571093/) — Pexels License; still 2.1s on screen, still 2.7s on screen, still 1.6s on screen, cover still (frame at 0s)
- [Pexels video 5378938 by cottonbro studio (Pexels License)](https://www.pexels.com/video/people-waiting-fir-the-elevator-lift-5378938/) — Pexels License; 5.0-6.5s
- [Pexels video 15434928 by Yusuf Çelik (Pexels License)](https://www.pexels.com/video/an-elevator-screen-shows-going-downfloor-15434928/) — Pexels License; 0.5-1.7s
- [Pixabay video 131012 by Jesehab (Pixabay Content License)](https://pixabay.com/videos/inside-elevator-elevator-rise-131012/) — Pixabay Content License; 4.0-6.5s, 29.8-31.6s
- [Pexels photo 7722159 by Max Vakhtbovych (Pexels License)](https://www.pexels.com/photo/a-stainless-steel-narrow-elevator-7722159/) — Pexels License; still 1.8s on screen
- [Pexels video 7423581 by Gustavo Fring (Pexels License)](https://www.pexels.com/video/man-moving-his-wheelchair-7423581/) — Pexels License; 2.0-3.4s
- [Pexels video 8400828 by SHVETS production (Pexels License)](https://www.pexels.com/video/person-using-a-wheelchair-8400828/) — Pexels License; 3.0-4.7s
- [Pexels photo 17489439 by Zakhar Vozhdaienko (Pexels License)](https://www.pexels.com/photo/woman-in-jacket-taking-photo-of-herself-in-elevator-17489439/) — Pexels License; still 3.1s on screen
- [Pexels video 8525792 by cottonbro studio (Pexels License)](https://www.pexels.com/video/a-reflection-of-a-person-holding-the-push-ring-of-the-wheelchair-8525792/) — Pexels License; 3.0-6.3s, 20.0-22.5s

**life3**
- [Pexels video 36017323 by Raphael Kim (Pexels License)](https://www.pexels.com/video/driving-across-bridge-at-sunset-in-korea-36017323/) — Pexels License; 0.9-2.9s, 4.0-6.2s, 7.0-9.1s
- [Pexels video 18565055 by FREE VIDEO HAPPY (Pexels License)](https://www.pexels.com/video/sihwho-18565055/) — Pexels License; 1.0-2.8s, 7.0-9.5s, cover still (frame at 1s)
- [Pexels video 4608282 by K (Pexels License)](https://www.pexels.com/video/vehicle-overtaking-at-the-highway-4608282/) — Pexels License; 44.0-46.9s
- [Pexels video 36108436 by Airam Dato-on (Pexels License)](https://www.pexels.com/video/driving-on-a-highway-with-overcast-skies-36108436/) — Pexels License; 4.0-7.1s, 10.0-11.6s
- [Pexels video 28690652 by SHOX ART (Pexels License)](https://www.pexels.com/video/aerial-view-of-busy-highway-in-daylight-28690652/) — Pexels License; 2.0-5.0s, 7.0-8.4s
- [Pexels video 35186893 by Nothing Ahead (Pexels License)](https://www.pexels.com/video/city-highway-traffic-during-daytime-commute-35186893/) — Pexels License; 8.0-11.2s

**life4**
- [Pexels video 18749262 by Dilara Hazıroğlu (Pexels License)](https://www.pexels.com/video/a-view-of-an-airplane-window-from-inside-the-plane-18749262/) — Pexels License; 2.0-3.6s, cover still (frame at 2s)
- [Pexels video 3723453 by K (Pexels License)](https://www.pexels.com/video/footage-of-the-plane-taking-off-3723453/) — Pexels License; 8.0-9.4s
- [Pexels video 35576270 by Content Kiosk (Pexels License)](https://www.pexels.com/video/aerial-view-from-airplane-window-on-runway-35576270/) — Pexels License; 2.0-4.0s, 7.0-9.9s
- [Pexels video 3701057 by K (Pexels License)](https://www.pexels.com/video/silhouette-footage-of-a-person-in-the-window-3701057/) — Pexels License; 1.0-3.0s, 5.0-7.0s
- [Pexels video 35507462 by Grigoriy Bunkov (Pexels License)](https://www.pexels.com/video/airplane-cabin-with-passengers-and-crew-35507462/) — Pexels License; 0.5-2.0s, 6.0-9.3s
- [Pexels video 3740041 by K (Pexels License)](https://www.pexels.com/video/view-of-sunset-from-an-airplane-in-flight-3740041/) — Pexels License; 1.0-3.6s
- [Pexels video 3740022 by K (Pexels License)](https://www.pexels.com/video/footage-inside-the-airplane-3740022/) — Pexels License; 2.0-4.9s
- [Pexels video 10710412 by Afif Ramdhasuma (Pexels License)](https://www.pexels.com/video/an-airplane-window-seat-view-10710412/) — Pexels License; 2.0-4.5s
- [Pexels video 3785721 by Taryn Elliott (Pexels License)](https://www.pexels.com/video/view-of-the-airport-field-from-an-airplane-s-window-3785721/) — Pexels License; 2.0-5.2s

**life5**
- [Pexels video 33825909 by SHOX ART (Pexels License)](https://www.pexels.com/video/traffic-lights-changing-against-blue-sky-33825909/) — Pexels License; 4.0-5.8s, 5.0-6.1s, 4.5-7.5s
- [Pexels video 3999410 by K (Pexels License)](https://www.pexels.com/video/traffic-light-with-yellow-light-turning-to-red-3999410/) — Pexels License; 0.3-1.9s, 4.0-5.3s, cover still (frame at 0.3s)
- [Pexels video 1390281 by Zuzanna Musial (Pexels License)](https://www.pexels.com/video/city-driving-in-an-ordinary-day-1390281/) — Pexels License; 2.0-3.9s, 12.0-15.4s, 18.0-20.6s
- [Pexels video 34507814 by JMT 35 (Pexels License)](https://www.pexels.com/video/busy-urban-intersection-with-traffic-and-pedestrians-34507814/) — Pexels License; 3.0-5.1s, 8.0-9.3s
- [Pexels video 5921059 by Aleks Magnusson (Pexels License)](https://www.pexels.com/video/dash-cam-view-of-the-road-5921059/) — Pexels License; 3.0-4.6s, 7.0-9.4s
- [Pexels video 31801544 by Paul Bill (Pexels License)](https://www.pexels.com/video/bustling-seoul-street-near-gwanghwamun-gate-31801544/) — Pexels License; 2.0-5.3s, 10.0-12.0s
- [Pexels video 17041886 by Ben Garves (Pexels License)](https://www.pexels.com/video/a-yellow-painted-three-way-intersection-traffic-light-changes-from-green-to-amber-to-red-17041886/) — Pexels License; 1.5-5.1s
- [Pexels video 39573529 by Yasemin Gül (Pexels License)](https://www.pexels.com/video/busy-city-intersection-with-traffic-lights-39573529/) — Pexels License; 2.0-4.5s

**life6**
- [Pexels photo 31827772 by Nischal Pradhan (Pexels License)](https://www.pexels.com/photo/green-emergency-exit-sign-with-lighting-fixture-31827772/) — Pexels License; still 0.6s on screen, still 1.9s on screen, cover still (frame at 0s)
- [Pexels video 3134591 by Caleb Oquendo (Pexels License)](https://www.pexels.com/video/a-lighted-exit-sign-for-direction-3134591/) — Pexels License; 3.0-4.1s, 2.0-4.1s
- [Pexels video 14595546 by Mustafa Akkuş (Pexels License)](https://www.pexels.com/video/people-walking-in-corridor-in-green-lights-14595546/) — Pexels License; 1.0-4.1s, 7.0-8.8s
- [Pexels video 28957437 by Paolo San (Pexels License)](https://www.pexels.com/video/dramatic-foggy-light-show-in-dark-hallway-28957437/) — Pexels License; 12.0-14.6s, 3.0-4.3s
- [Pexels photo 37643871 by Norbert Szomszéd (Pexels License) — maker name on the sign painted over by us](https://www.pexels.com/photo/green-emergency-exit-sign-in-dark-corridor-37643871/) — Pexels License; still 1.8s on screen, still 2.6s on screen
- [Pexels video 16657022 by Erik Mclean (Pexels License)](https://www.pexels.com/video/a-red-exit-sign-in-the-dark-16657022/) — Pexels License; 1.0-3.5s, 3.0-5.1s
- [Pexels video 31801555 by Paul Bill (Pexels License)](https://www.pexels.com/video/urban-subway-commuters-boarding-a-train-31801555/) — Pexels License; 0.5-1.5s
- [Pexels video 7644222 by Yaroslav Shuraev (Pexels License)](https://www.pexels.com/video/an-exit-signage-at-the-building-7644222/) — Pexels License; 8.6-11.7s, 9.4-11.8s
- [Pexels photo 24702725 by Jakub Zerdzicki (Pexels License)](https://www.pexels.com/photo/evacuation-sign-hanging-under-ceiling-24702725/) — Pexels License; still 1.8s on screen

**life7**
- [Ballpoint pen cap with the ventilation hole, our own drawing (media/info2/draw_cap.py)](https://github.com/richroro/richroro.github.io/blob/main/shorts/viral5/media/info2/draw_cap.py) — our own drawing; still 2.1s on screen, still 0.9s on screen, still 3.2s on screen, still 2.5s on screen, still 2.6s on screen, cover still (frame at 0s)
- [Pexels video 28405798 by Адам Аушев (Pexels License)](https://www.pexels.com/video/a-person-writing-on-a-piece-of-paper-with-a-pen-28405798/) — Pexels License; 0.3-2.2s
- [Pexels video 6878203 by cottonbro studio (Pexels License)](https://www.pexels.com/video/man-spinning-pen-on-his-hand-6878203/) — Pexels License; 2.0-3.5s, 9.0-10.4s, 3.0-6.4s
- [Pexels photo 983826 'Three ball point pens' by Jess Bailey Designs (Pexels License)](https://www.pexels.com/photo/three-ball-point-pens-983826/) — Pexels License (free to use; checked on the item page 2026-10-10); still 3.0s on screen
- [Pexels video 5601055 by Allan Mas (Pexels License)](https://www.pexels.com/video/girl-drawing-on-a-paper-with-a-marker-5601055/) — Pexels License; 0.0-2.1s, 5.0-7.1s
- [Pexels video 12760956 by Mizuno K (Pexels License)](https://www.pexels.com/video/top-view-of-a-boy-doing-drawing-12760956/) — Pexels License; 2.0-4.3s
- [Pexels video 5599021 by Allan Mas (Pexels License)](https://www.pexels.com/video/little-girl-hands-using-colored-markers-5599021/) — Pexels License; 3.0-4.7s
- [Pexels video 3678073 by cottonbro studio (Pexels License)](https://www.pexels.com/video/a-girl-is-drawing-using-different-colored-pens-3678073/) — Pexels License; 8.0-10.0s
- [Pexels video 6324531 by Vanessa Garcia (Pexels License)](https://www.pexels.com/video/assorted-pens-on-wooden-desk-6324531/) — Pexels License; 2.0-3.4s

**life8**
- [Designated seats for pregnant women of Seoul Metro Line 1 in 2018 — Garam, Wikimedia Commons ('Attribution only' licence: any use with attribution)](https://commons.wikimedia.org/wiki/File:Designated_seats_for_pregnant_women_of_Seoul_Metro_Line_1_in_2018.jpg) — {{Attribution}}: any use, including commercial and derivative, with attribution to Garam; still 1.8s on screen, still 2.3s on screen, still 2.0s on screen, still 2.0s on screen, still 1.5s on screen, still 2.8s on screen, still 1.9s on screen, still 3.0s on screen, cover still (frame at 0s)
- [Pexels video 31801555 by Paul Bill (Pexels License)](https://www.pexels.com/video/urban-subway-commuters-boarding-a-train-31801555/) — Pexels License; 0.0-2.8s, 3.0-5.2s
- [Pexels video 27355485 by Orhan Pergel (Pexels License)](https://www.pexels.com/video/a-man-is-sitting-in-a-subway-train-with-other-people-27355485/) — Pexels License; 6.0-7.7s, 2.0-4.1s
- [Pexels photo 36621878 by wal_ 172619 (Pexels License)](https://www.pexels.com/photo/commuters-in-seoul-metro-subway-carriage-36621878/) — Pexels License; still 1.6s on screen
- [Pexels video 7677215 by PNW Production (Pexels License)](https://www.pexels.com/video/a-pregnant-woman-holding-her-baby-bump-7677215/) — Pexels License; 2.0-4.0s
- [Pexels video 36302344 by Earth Photart (Pexels License)](https://www.pexels.com/video/empty-subway-car-during-daytime-transit-36302344/) — Pexels License; 2.0-4.2s
- [Pexels video 8772870 by KADO FUETA (Pexels License)](https://www.pexels.com/video/a-subway-train-with-empty-seats-and-people-walking-8772870/) — Pexels License; 1.0-2.8s

**hanban1**
- [Mount St. Helens eruption column, 18 May 1980 (USGS/Austin Post)](https://commons.wikimedia.org/wiki/File:MSH80_eruption_mount_st_helens_05-18-80.jpg) — Public domain – {{PD-USGov-USGS}}; USGS photo by Austin Post, 18 May 1980 (from USGS Mount St. Helens image collection); still 1.9s on screen
- [Kilauea summit ash explosion, 24 May 2018 (USGS HVO)](https://www.usgs.gov/media/videos/kilauea-volcano-summit-eruption-may-24-2018) — Public domain (USGS page: 'Usage: Public Domain'; video from USGS Hawaiian Volcano Observatory); 12.0-14.6s, 20.0-22.5s
- [Mount Paektu, Landsat 8 OLI, Sep 2015 (NASA Earth Observatory)](https://science.nasa.gov/earth/earth-observatory/mount-paektu-north-koreas-slumbering-giant-88020/) — Public domain (NASA Earth Observatory image; Landsat 8 OLI data from USGS). Credit line on page: 'NASA Earth Observatory images by Joshua Stevens, using Landsat data from the U.S. Geological Survey'; still 2.0s on screen, still 2.5s on screen, still 1.9s on screen, still 2.3s on screen, cover still (frame at 0s)
- [Pinatubo eruption column, 12 Jun 1991 (USGS/Dave Harlow)](https://commons.wikimedia.org/wiki/File:Pinatubo91eruption_plume.jpg) — Public domain – {{PD-USGov-USGS}}; 'U.S. Geological Survey Photograph taken on June 12, 1991, 08:51 hours, by Dave Harlow' (CVO Photo Archives); still 1.0s on screen
- [Baitoushan/Paektu caldera from the ISS, ISS006-E-43366, Apr 2003 (NASA JSC)](https://eol.jsc.nasa.gov/Collections/EarthObservatory/articles/Baitoushan_Volcano,_China_and_North_Korea.htm) — Public domain – ISS astronaut photograph ISS006-E-43366 (NASA JSC Earth Science & Remote Sensing Unit). Required courtesy line: 'Image courtesy of the Earth Science and Remote Sensing Unit, NASA Johnson Space Center'; still 2.1s on screen, still 3.3s on screen
- [Korean Peninsula and Japan, Terra MODIS, 3 Jan 2010 (NASA Earth Observatory)](https://science.nasa.gov/earth/earth-observatory/heavy-snow-in-korea-42211/) — Public domain – 'NASA image by Jeff Schmaltz, MODIS Rapid Response Team, Goddard Space Flight Center'; still 1.4s on screen, still 1.6s on screen, still 2.2s on screen
- [Hunga Tonga-Hunga Ha'apai umbrella cloud, GOES-17, 15 Jan 2022 (NASA Earth Observatory)](https://science.nasa.gov/earth/earth-observatory/hunga-tonga-hunga-haapai-erupts-149347/) — Public domain – NASA Earth Observatory animation using 'GOES imagery courtesy of NOAA and the National Environmental Satellite, Data, and Information Service (NESDIS)'. Same loop on https://science.nasa.gov/resource/tonga-eruption/ credited 'NASA Earth Observatory image by Joshua Stevens using GOES imagery courtesy of NOAA and NESDIS'; 0.0-1.4s

**hanban2**
- [Super Typhoon Hinnamnor, Terra MODIS, 1 Sep 2022 (NASA Earth Observatory)](https://earthobservatory.nasa.gov/images/150290/typhoon-hinnamnor) — NASA Earth Observatory image (Lauren Dauphin, MODIS/Aqua via NASA EOSDIS LANCE, GIBS/Worldview) - public domain; still 1.9s on screen, still 2.4s on screen, cover still (frame at 0s)
- [GPM IMERG view of Typhoon Khanun, 31 Jul 2023 (NASA GSFC SVS 5135)](https://svs.gsfc.nasa.gov/5135) — NASA Scientific Visualization Studio (GPM IMERG + GPM core observatory) - NASA work, public domain; credit NASA/GSFC SVS; 0.5-3.2s, 7.0-8.7s
- [Hurricane Milton from the ISS, 8 Oct 2024 (NASA JSC, 0-75 s of the original)](https://images.nasa.gov/details/jsc2024m000173_International_Space_Station_Cameras_Capture_New_Views_Of_Hurricane_Milton_241008) — NASA JSC ISS external-camera video - public domain (NASA media guidelines; no NASA logo endorsement implied); 18.0-19.2s
- [Hinnamnor, VIIRS corrected reflectance, 4 Sep 2022 (NASA Worldview snapshot)](https://worldview.earthdata.nasa.gov/?v=115,15,150,46&l=VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m&t=2022-09-04) — NASA EOSDIS GIBS/Worldview imagery (Suomi NPP & NOAA-20 VIIRS) - US Government work, no copyright; NASA asks for acknowledgement "NASA Worldview / EOSDIS"; still 1.9s on screen
- [Hinnamnor south-west of Jeju, VIIRS, 5 Sep 2022 (NASA Worldview snapshot, lon 117-139, lat 17-45)](https://worldview.earthdata.nasa.gov/?v=117,17,139,45&l=VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m&t=2022-09-05) — NASA EOSDIS GIBS/Worldview imagery (Suomi NPP & NOAA-20 VIIRS) - US Government work, no copyright; NASA asks for acknowledgement "NASA Worldview / EOSDIS"; still 1.0s on screen
- [Hinnamnor gone north-east, VIIRS, 6 Sep 2022 (NASA Worldview snapshot, lon 117-139, lat 17-45)](https://worldview.earthdata.nasa.gov/?v=117,17,139,45&l=VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m&t=2022-09-06) — NASA EOSDIS GIBS/Worldview imagery (Suomi NPP & NOAA-20 VIIRS) - US Government work, no copyright; NASA asks for acknowledgement "NASA Worldview / EOSDIS"; still 1.5s on screen
- [Hinnamnor daily VIIRS flip-book, 29 Aug - 6 Sep 2022 (built from NASA Worldview snapshots, 0.8 s per day)](https://worldview.earthdata.nasa.gov/?v=115,15,150,46&l=VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m&t=2022-09-05) — NASA EOSDIS GIBS/Worldview imagery (Suomi NPP & NOAA-20 VIIRS) - US Government work, no copyright; NASA asks for acknowledgement "NASA Worldview / EOSDIS"; 1.0-3.7s, 4.0-7.0s
- [Typhoon Jangmi, VIIRS, 31 May 2026 (NASA Earth Observatory)](https://science.nasa.gov/earth/earth-observatory/typhoon-jangmi/) — NASA Earth Observatory image (Michala Garrison, VIIRS day-night band from NASA EOSDIS LANCE, GIBS/Worldview, JPSS) - public domain; still 2.1s on screen
- [Typhoon Jangmi eye, VIIRS, 30 May 2026 (NASA Earth Observatory)](https://science.nasa.gov/earth/earth-observatory/typhoon-jangmi/) — NASA Earth Observatory image (VIIRS, NASA EOSDIS LANCE/GIBS, JPSS) - public domain; still 2.2s on screen
- [Hurricane Erin from the ISS, Aug 2025 (NASA JSC, 122-176 s of the original)](https://images.nasa.gov/details/jsc2025m000148-Hurricane_Erin_Seen_From_International_Space_Station) — NASA JSC ISS external-camera video - public domain; 48.0-49.5s

**hanban3**
- [Cirrus cloud over Federal Way, WA (Ron Clausen, CC0, Wikimedia Commons)](https://commons.wikimedia.org/wiki/File:Cirrus_cloud_over_Federal_Way,_WA.jpg) — CC0 1.0 (Ron Clausen, own work); still 2.6s on screen, still 1.5s on screen, still 1.3s on screen, still 2.0s on screen, cover still (frame at 0s)
- [Ongjin, South Korea, sea and sky, May 2023 (Hankook12, CC0, Wikimedia Commons; 1920 px rendition)](https://commons.wikimedia.org/wiki/File:Ongjin_South_Korea_sea_city_03.jpg) — CC0 1.0 (Hankook12, own work; checked via the Commons API LicenseShortName); still 1.3s on screen, still 1.3s on screen, still 1.7s on screen
- [Southern Korea and the blue limb from the ISS, iss073e0983131, 21 Sep 2025 (NASA JSC)](https://images.nasa.gov/details/iss073e0983131) — Public domain (NASA ISS crew photo; EXIF description names NASA astronaut Jonny Kim); still 2.6s on screen
- [Korea on a yellow-dust day, Terra MODIS, 12 Apr 2023 (NASA Worldview snapshot)](https://worldview.earthdata.nasa.gov/?v=123.5,33,131.5,39.5&l=MODIS_Terra_CorrectedReflectance_TrueColor&t=2023-04-12-T00:00:00Z) — Public domain (NASA EOSDIS/Worldview imagery, no copyright; NASA requests credit); still 1.8s on screen
- [Seoul area on a yellow-dust day, Terra MODIS, 12 Apr 2023 (NASA Worldview snapshot)](https://worldview.earthdata.nasa.gov/?v=123.5,33,131.5,39.5&l=MODIS_Terra_CorrectedReflectance_TrueColor&t=2023-04-12-T00:00:00Z) — Public domain (NASA EOSDIS/Worldview imagery); still 1.6s on screen
- [Korea on a clear autumn day, Terra MODIS, 28 Oct 2025 (NASA Worldview snapshot)](https://worldview.earthdata.nasa.gov/?v=123.5,33,131.5,39.5&l=MODIS_Terra_CorrectedReflectance_TrueColor&t=2025-10-28-T00:00:00Z) — Public domain (NASA EOSDIS/Worldview imagery); still 2.6s on screen, still 3.3s on screen
- [Seoul area on a clear autumn day, Terra MODIS, 28 Oct 2025 (NASA Worldview snapshot)](https://worldview.earthdata.nasa.gov/?v=123.5,33,131.5,39.5&l=MODIS_Terra_CorrectedReflectance_TrueColor&t=2025-10-28-T00:00:00Z) — Public domain (NASA EOSDIS/Worldview imagery); still 1.8s on screen
- [Time lapse clouds (Johann Mynhardt, CC BY 2.0, Wikimedia Commons)](https://commons.wikimedia.org/wiki/File:Free_Creative_Commons_Stock_video_-_Time_lapse_clouds.webm) — CC BY 2.0 (Johann Mynhardt, via Flickr 7337676096); 3.0-4.3s, 12.0-13.8s

**hanban4**
- [Aurora over Idaho with the ISS streak, 11 May 2024 (NASA SVS 14835)](https://svs.gsfc.nasa.gov/14835/) — NASA media (page credit 'Credit: NASA/Bill Dunford'); treated as NASA PD. 3000x2000.; still 0.6s on screen, still 2.0s on screen, cover still (frame at 0s)
- [Korean Peninsula at night from the ISS, ISS038-E-038300, 30 Jan 2014](https://images.nasa.gov/details/iss038e038300) — Public domain (NASA JSC ISS crew Earth observation photo, no third-party credit in metadata); still 1.2s on screen, still 2.0s on screen, still 1.9s on screen, still 1.9s on screen
- [SDO AIA 131 X2.2 flare from AR 13664, 9 May 2024 (NASA SVS 5284)](https://svs.gsfc.nasa.gov/5284/) — Public domain (NASA/SDO; NASA media usage guidelines). Re-encoded H.264 CRF24 from 142 MB original, no other edits.; 2.5-5.6s
- [SDO AIA 131 flares from AR 13663/13664, 7-8 May 2024 (NASA SVS 14683)](https://svs.gsfc.nasa.gov/14683/) — Public domain (page credit: 'Credit: NASA/SDO'). Unmodified.; 12.6-14.1s
- [SDO AIA 171 X5.8 flare from AR 13664, 11 May 2024 (NASA SVS 5289)](https://svs.gsfc.nasa.gov/5289/) — Public domain (NASA/SDO). Unmodified.; 8.5-11.8s
- [Red and green aurora from the ISS, iss072e147641, 9 Nov 2024](https://images.nasa.gov/details/iss072e147641) — Public domain (NASA ISS crew photo, JSC; EXIF names NASA astronaut Don Pettit). 8256x5504.; still 2.7s on screen
- [Aurora timelapse, Bear Lake, Utah, 10 May 2024 (NASA SVS 14835)](https://svs.gsfc.nasa.gov/14835/) — NASA media (page credit 'Credit: NASA/Bill Dunford'); treated as NASA PD - see licensing note. Unmodified.; 0.5-1.9s
- [Red and green aurora over Utah, 10 May 2024 (NASA SVS 14835, PNG converted to JPEG)](https://svs.gsfc.nasa.gov/14835/) — NASA media (credit NASA/Bill Dunford); still 2.7s on screen
- [Aurora timelapse wide, Utah, 10 May 2024 (NASA SVS 14835)](https://svs.gsfc.nasa.gov/14835/) — NASA media (page credit 'Credit: NASA/Bill Dunford'); treated as NASA PD - see licensing note. Unmodified.; 0.0-1.8s
- [Night lights of Seoul from the ISS, iss062e082060, 5 Mar 2020](https://images.nasa.gov/details/iss062e082060) — Public domain (NASA JSC ISS crew Earth observation photo, no third-party credit in metadata); still 3.4s on screen

**why1**
- [Pexels video 35012840 by Magda Ehlers (Pexels License)](https://www.pexels.com/video/asian-black-bears-eating-in-natural-habitat-35012840/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.5-3.1s, 9.5-10.7s, 3.0-4.6s, 0.5-1.7s, 6.0-8.4s, 3.0-5.9s, cover still (frame at 3.0s)
- [Pexels video 34267124 by PUWOOK Kwak (Pexels License)](https://www.pexels.com/video/aerial-view-of-serene-mountain-landscape-34267124/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-2.4s, 12.0-14.3s, 20.0-23.6s, 25.0-27.4s
- [Pexels video 35012841 by Magda Ehlers (Pexels License)](https://www.pexels.com/video/asian-black-bears-grazing-in-natural-habitat-35012841/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 3.0-4.1s, 12.0-13.8s, 20.0-22.0s, 8.0-9.8s
- [Pexels video 39169726 by Irina Fedotova (Pexels License)](https://www.pexels.com/video/black-bear-climbing-trees-in-forest-habitat-39169726/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 18.0-19.8s, 28.0-29.7s, 10.0-11.2s
- [Pexels video 39323803 by Irina Fedotova (Pexels License)](https://www.pexels.com/video/asian-black-bear-exploring-zoo-habitat-39323803/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 5.0-7.2s
- [Pexels video 19022174 by Simo Herold (Pexels License)](https://www.pexels.com/video/hiking-trail-in-the-forest-19022174/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 3.0-6.3s, 10.0-11.6s

**why2**
- [Pexels video 34139293 by JUN HO LEE (Pexels License)](https://www.pexels.com/video/close-up-of-octopus-exploring-coral-reef-34139293/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 0.5-1.3s, 5.0-5.8s, 3.0-5.0s, 7.0-10.1s, 1.0-3.0s, cover still (frame at 0.5s)
- [Pexels video 1312397 by Tom Fisk (Pexels License)](https://www.pexels.com/video/video-of-an-octopus-underwater-1312397/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 6.0-7.8s, 14.0-15.8s
- [Pexels video 17836505 by Entdecker Fuchs (Pexels License)](https://www.pexels.com/video/pulpa-aquarium-biarritz-17836505/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-3.5s, 9.0-11.7s
- [Deep-sea octopus crawling, Astoria Canyon, EX2301 dive 6 (NOAA Ocean Exploration, 2023 Shakedown + EXPRESS West Coast Exploration)](https://oceanexplorer.noaa.gov/?p=12287) — US federal government work, public domain (NOAA Ocean Exploration media guidelines: credit 'NOAA Ocean Exploration'); logo corner cropped out; 5.0-6.9s, 15.0-16.4s
- [Pexels video 31496835 by JUN HO LEE (Pexels License)](https://www.pexels.com/video/octopus-camouflages-in-coral-reef-31496835/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-4.0s
- [Pexels video 39027976 by JUN HO LEE (Pexels License)](https://www.pexels.com/video/camouflaged-octopus-on-ocean-floor-39027976/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 1.0-2.9s, 4.0-5.4s
- [Pexels video 15623348 by Jozef Papp (Pexels License)](https://www.pexels.com/video/underwater-footage-of-an-octopus-swimming-in-the-sea-15623348/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 0.5-1.8s, 9.0-11.2s

**why3**
- [Pexels video 29982167 by Nicky Pe (Pexels License)](https://www.pexels.com/video/majestic-red-crowned-crane-in-winter-forest-29982167/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 0.5-1.3s, 9.3-12.2s, 2.0-3.6s, 4.0-5.8s, 11.0-13.7s
- [Pexels video 27021165 by Nicky Pe (Pexels License)](https://www.pexels.com/video/kranich_mandschurenkranich-27021165/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-3.2s, 11.0-12.9s, 6.0-7.2s, 14.0-15.0s
- [Pexels video 35571618 by Brixiv (Pexels License)](https://www.pexels.com/video/elegant-white-naped-crane-in-natural-habitat-35571618/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 3.0-3.1s, 10.0-11.7s, 16.0-17.3s
- [Pexels video 27182521 by Nicky Pe (Pexels License)](https://www.pexels.com/video/mandschurenkranich_rotkronenkranich-27182521/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 1.0-4.0s, 5.0-6.4s
- [Pexels video 27624545 by Nicky Pe (Pexels License)](https://www.pexels.com/video/rotkronenkranich-27624545/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-4.2s, 10.0-12.3s, 18.0-20.5s, cover still (frame at 2.0s)

**why4**
- [Pexels video 39575836 by Bil Hinton (Pexels License)](https://www.pexels.com/video/close-up-of-a-eurasian-magpie-in-nature-39575836/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 1.0-1.7s, 8.0-10.1s, 16.0-17.5s, 20.0-22.2s
- [Pexels video 13780153 by Justin Stretch (Pexels License)](https://www.pexels.com/video/close-up-of-magpie-13780153/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 3.0-3.9s, 14.0-16.2s, 30.0-31.2s, 38.0-40.4s, cover still (frame at 21.3s)
- [Pexels video 11202600 by 대정 김 (Pexels License)](https://www.pexels.com/video/magpies-drinking-water-from-puddle-11202600/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 2.0-5.3s, 12.0-13.4s, 20.0-22.0s, 6.0-7.5s, 24.0-26.0s
- [Pexels video 34931507 by Bil Hinton (Pexels License)](https://www.pexels.com/video/eurasian-magpie-foraging-in-forest-34931507/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 14.0-15.7s, 12.0-13.0s, 8.0-10.5s
- [Pexels video 36480781 by Scott Precious (Pexels License)](https://www.pexels.com/video/magpie-foraging-on-mossy-wall-in-early-spring-36480781/) — Pexels License (free to use, no attribution required; checked on the item page 2026-10-10); 5.0-6.1s, 14.0-16.5s

### 사실과 출처

**기존 16편.** 내레이션의 사실은 v1과 같습니다. 근거는 위의 각 절(「생활 상식 “~하는 이유” 쇼츠」, 「2차: life5~life8」, 「이번 주 이슈 30초 정리」, 「한반도 자연·과학 지식 쇼츠」)에 있는 그대로입니다. 새로 쓴 첫 문장은 같은 근거를 결과형으로 앞당긴 것입니다.
- issue1 "위성 딱 한 기가 못 나갔습니다": 큐브위성 10기 중 1기 미분리(머니투데이방송·아이뉴스24).
- issue2 "경유값이 20% 올랐습니다": 2026년 9월 경유 +20.0%(국가데이터처, 정책브리핑).
- issue3 "한글날, 22년 안 쉬었습니다": 1991–2012년(문화체육관광부 보도자료).
- issue4 "1초에 100조 개가 몸을 뚫고 갑니다": IceCube Facts.
- life1 "창 모서리가, 비행기를 찢었습니다": FAA Lessons Learned, "squarish windows were creating stress concentrations".
- life2 "엘리베이터 거울, 셀카용 아닙니다": 편의증진법 시행규칙 [별표 1].
- life3 "1차로 주행, 4만 원입니다": 시행령 [별표 8] 39. 이 편에 새로 넣은 "승합차는 5만 원"도 같은 별표에서 왔습니다.
- life4 "창문 덮개, 비상구 찾는 빛입니다": 대한항공 뉴스룸 2023.9.6, "정전이 될 경우 바깥의 불빛에 의지해 비상구를 찾거나".
- life5 "노란불 3초, 밟는 시간이 아닙니다": 시행규칙 [별표 2], 한국교통연구원.
- life6 "비상구 초록색, 국제 약속입니다": ISO 3864·7010, 소방청 고시.
- life7 "볼펜 뚜껑 구멍은, 숨구멍입니다": ISO 11540:2021 서문.
- life8 "분홍 배려석, 눈에 띄라고 칠했습니다": 서울시 미디어허브 2015.7.23, "'분홍색'으로 연출해 주목도를 높이기로".
- hanban1 "백두산 화산재, 일본까지 갔습니다": NASA EO 2016, Oppenheimer et al. 2017.
- hanban2 "태풍 길은, 고기압이 정합니다": 기상청 태풍분석보고서, NOAA AOML G5.
- hanban3 "가을 하늘, 먼지가 절반입니다": 서울시 2025년 초미세먼지 봄 24, 가을 13㎍/㎥. 본문에서 "거의 절반"이라고 말합니다.
- hanban4 "한국 하늘에, 오로라가 찍혔습니다": 한국천문연구원 2024.5.13.

**why1 반달가슴곰** (2026-10-10 확인)
- 2004년 러시아에서 들여온 6마리 첫 방사, 2022년 4세대 출산: [데일리벳 2022.6.2(환경부·국립공원공단 발표)](https://www.dailyvet.co.kr/?p=166985). 원문: "러시아에서 들여온 반달가슴곰 6마리가 지리산에 처음 방사".
- 야생 약 96마리(추정): [한국경제 2026.7.2(국립공원공단 발표)](https://www.hankyung.com/article/2026070228377), [경기일보 2026.7.2](https://www.kyeonggi.com/article/20260702580161). 원문: "지리산 등 야생에 사는 반달가슴곰은 현재 96마리로 추정된다."
- 목표 50마리(최소 존속 개체군): [데일리벳, 10주년 심포지엄 보도](https://www.dailyvet.co.kr/?p=30339).
- 천연기념물 제329호, 멸종위기 야생생물 Ⅰ급: [노컷뉴스](https://www.nocutnews.co.kr/news/6471859), [서울신문 2015](https://m.go.seoul.co.kr/news/2015/04/13/20150413012009).
- KM-53 '오삼이': 2017년 김천 수도산에서 발견, 2018년 수도산에 다시 방사. 출처: [서울신문 2018.9.4](https://m.go.seoul.co.kr/news/2018/09/04/20180904500093), [경기일보 2023.6.15](https://www.kyeonggi.com/article/20230615580305).
- 탐방로 10m 안에 머문 기록 0.44%(2015–2025년 위치 기록 약 3만 건): [세계일보 2026.5.7(국립공원공단 분석)](https://www.segye.com/newsView/20260507508420). "곰이 사람을 피해 다닌다"는 이 수치에 대한 해석으로 말했습니다.
- 확인하지 못한 것: 50마리 목표를 달성한 연도, 1983년 설악산 마지막 기록. 두 가지 모두 쓰지 않았습니다.
- 정치적 논쟁인 적정 개체 수(약 64마리설)는 다루지 않았습니다.

**why2 문어 심장**
- 아가미 심장 2개 + 체심장 1개: [Live Science](https://www.livescience.com/how-many-hearts-does-an-octopus-have), [BBC Science Focus](https://www.sciencefocus.com/nature/why-does-an-octopus-have-more-than-one-heart). BBC 원문: "copper-rich haemocyanin dissolved directly in their blood".
- 헤모시아닌이 산소를 덜 나르고 더 높은 압력이 필요함: BBC Science Focus, [ScienceABC](https://www.scienceabc.com/nature/animals/why-do-octopuses-have-three-hearts)(대중 과학 사이트).
- 헤엄칠 때 체심장이 멈춤: Wells M.J. et al. 1987, *J. Exp. Biol.* 131:175, doi:10.1242/jeb.131.1.175. 원문: "Jet propulsion is accompanied by cardiac arrest".
- "그래서 주로 기어 다닌다"는 이 연구에 대한 흔한 해석입니다. 내레이션은 "기어 다닐 때가 많죠"라고만 합니다.
- 우리나라 상업 문어는 대문어와 참문어(돌문어)이고, 대문어는 최대 약 3m, 50kg 이상입니다. 국립수산과학원 동해수산연구소 연구자 칼럼, [뉴스토마토 2016.7.8](https://newstomato.com/ReadNews.aspx?no=670095).

**why3 철원 두루미**
- 2025년 11월 29일 철원군 조사에서 두루미류 11,640마리를 셌습니다: 두루미 1,567, 재두루미 10,002, 흑두루미 60, 검은목두루미 1, 캐나다두루미 10. 역대 최대입니다. 출처: [강원도민일보 2025.12.14](https://www.kado.net/news/articleView.html?idxno=2022415). 이 때문에 훅은 "두루미 떼, 1만 1천 마리"이고, 본문에서 종별 숫자를 나눠 말합니다.
- 천연기념물 제202호, 멸종위기 Ⅰ급: [뉴스펭귄](https://www.newspenguin.com/news/articleView.html?idxno=13509).
- 세계 개체 수: BirdLife는 2,000–2,650마리, ICF는 약 4,500마리로 봅니다. 그래서 "몇천 마리뿐"이라고 했습니다. 출처: [BirdLife](https://datazone.birdlife.org/species/factsheet/red-crowned-crane-grus-japonensis), [ICF](https://savingcranes.org/species-field-guide/red-crowned-crane/).
- 철원에 오는 이유 세 가지의 출처는 [뉴스펭귄](https://www.newspenguin.com/news/articleView.html?idxno=13509)(철원 두루미 운영협의체)과 강원도민일보("볏집 존치사업과 무논 조성")입니다.
  - 사람이 거의 안 들어가는 민통선 들판
  - 볏짚 존치사업과 먹이 주기
  - 얕은 물에서 자는 습성, 겨울에도 얼지 않는 샘통, 물 댄 논
- 확인하지 못한 것: 2026년 1월 동시센서스 철원 수치.
- 민통선은 서식지 설명으로만 말하고 군 영상은 쓰지 않았습니다.

**why4 까치**
- 1964년 한 신문의 '나라새 뽑기 운동'에서 까치가 나라새로 뽑혔습니다. 정부가 국조로 지정한 적은 없습니다. 출처: [한국민족문화대백과사전 '까치'](https://encykorea.aks.ac.kr/Article/E0011213), [시대일보](https://www.sidae.com/article/2014070423258056079). 신문 이름은 말하지 않았습니다.
- "아침에 까치가 울면 반가운 사람이 온다", 칠석 오작교: 같은 사전 항목.
- 영국의 "One for sorrow" 미신: [USC Folklore Archive](https://folklore.usc.edu/one-for-sorrow-two-for-joy-nursery-rhyme/).
- 거울 자기 인식: Prior, Schwarz & Güntürkün 2008, *PLoS Biology* 6(8):e202, [PMC2517622](https://pmc.ncbi.nlm.nih.gov/articles/PMC2517622).
- 사람 얼굴 구별: Lee, Lee, Choe & Jablonski 2011, *Animal Cognition* 14:817–825.
- 유해 야생동물 지정(2000년, 전기 설비·농작물 피해): [전북일보 2025.3.19](https://jjan.kr/article/20250319580367), [KED Global 2023.7.25](https://www.kedglobal.com/newsView/ked202307250019).
- 중국에서도 까치(喜鹊)는 길조입니다. 그래서 제목을 "한국에서만"으로 쓰지 않았습니다.


### 업로드 문구

설명글은 저장소 공통 형식(`upload/README.md`)으로 `upload/specs/<id>.json`에 쓰고 `python3 upload/make_desc.py <id>`로 `upload/txt/<id>.txt`를 만들었습니다(`media/info2/upload_specs.py`가 spec을 씁니다). 화면 글자에는 저작권·라이선스 표시가 없고, 모든 크레딧은 설명란의 출처 줄에 있습니다. 창작(허구) 에피소드는 없습니다(모두 사실 해설). 해시태그는 공통 형식에 맞춰 #Shorts 포함 8~15개입니다(지시서의 3~5개보다 많음, 아래 보고 참고). 구독 줄의 채널 이름·핸들은 `upload/channels.json`의 자리표시자입니다.

**issue1** — 업로드 제목: 누리호 위성 15기 중 1기만 못 나온 진짜 이유 ㄷㄷ

> 10월 7일 누리호 5차 발사에서 군집위성 5기는 궤도에 올랐지만, 큐브위성 10기 중 1기는 분리 신호를 받고도 덮개가 열리지 않아 나오지 못했습니다. 군집위성 5기는 당일 교신에 성공했고, 누리호는 5번 중 4번 성공했습니다. 6차 발사는 내년 하반기 목표입니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 우주항공청·정책브리핑, 파이낸셜뉴스, 전자신문, 머니투데이방송, 아이뉴스24(2026-10 기준) · 영상: 한국항공우주연구원(2022 자료) (CC BY) · 영상: 한국항공우주연구원(2023 자료) (CC BY) · 영상: 한국항공우주연구원(2021 자료) (CC BY) · 음악: "Heroic Age" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 영상은 지난 발사(2021~2023) 자료화면입니다
>
> #Shorts #누리호 #우주항공청 #군집위성 #나로우주센터 #우주 #로켓 #과학뉴스 #이슈

고정 댓글: 다음 6차 발사, 몇 번째 성공일까요? 🚀

**issue2** — 업로드 제목: 기름값 상한제 있는데 경유 20% 오른 진짜 이유

> 2026년 9월 경유값은 1년 전보다 20.0% 올랐습니다. 3월 13일 시작된 석유 최고가격제는 주유소 판매가가 아니라 정유사 공급가에 상한을 두고, 상한선도 국제유가에 따라 바뀝니다. 정부는 상한제가 없었다면 9월 물가 상승률이 2.9%가 아니라 3.5%였을 것으로 봅니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 국가데이터처 9월 소비자물가동향(정책브리핑), 재정경제부·산업통상부 자료, KDI 경제정보센터(2026-10 기준) · 영상·사진: Pexels(David Bronner, Shoot With Riyas, African Creator, Esteban M, Zahid Nisar, Toàn BDS, Tom Fisk, Luke Nomad) · 사진: NASA (퍼블릭 도메인) · 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #기름값 #경유 #석유최고가격제 #소비자물가 #유가 #주유소 #경제뉴스 #이슈

고정 댓글: 요즘 주유소 가면 경유 리터당 얼마인가요? ⛽

**issue3** — 업로드 제목: 한글날이 22년 동안 쉬는 날이 아니었던 진짜 이유?

> 한글날은 1991년부터 2012년까지 22년 동안 공휴일이 아니었습니다. 공휴일이 많고 경제 여건이 어렵다는 이유로 국군의 날과 함께 빠졌기 때문입니다. 2006년 국경일이 됐고, 2013년부터 다시 쉬는 날이 됐습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 문화체육관광부 보도자료(2012), 국가기록원 '기록으로 보는 국경일' · 사진: 훈민정음 해례본(공유 저작물) (퍼블릭 도메인) · 사진: 국립민속박물관(후지모토 다쿠미) (공공누리 제1유형) · 사진: 한국정책방송원 (공공누리 제1유형) · 사진: 서울연구원 사진으로 본 서울 (공공누리 제1유형) · 사진: 서울관광재단 (공공누리 제1유형) · 사진: 국가유산청 (공공누리 제1유형) · 음악: "Heartwarming" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #한글날 #공휴일 #훈민정음 #한국사 #세종대왕 #국경일 #빨간날 #이슈

고정 댓글: 여러분은 한글날에 학교 간 기억, 있나요? 📅

**issue4** — 업로드 제목: 올해 노벨물리학상 받은 남극 얼음 덩어리의 정체 ㄷㄷ

> 2026년 노벨물리학상은 남극 얼음 1km³를 검출기로 만든 아이스큐브 중성미자 관측소를 이끈 프랜시스 할젠 교수가 단독으로 받았습니다. 얼음 속 센서 5,160개가 중성미자가 부딪힐 때 나는 빛을 잡아, 2013년 우주에서 온 고에너지 중성미자를 처음 확인했습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 노벨위원회 발표(서울신문·한국일보 보도), IceCube 공식 자료, NASA · 애니메이션: NASA 고다드 (퍼블릭 도메인) · 사진: John Hardin (CC BY 4.0) · 그림: IceCube Collaboration (CC BY 4.0) · 사진: 미국 국립과학재단(NSF) (퍼블릭 도메인) · 음악: "Floating Cities" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #노벨물리학상 #중성미자 #아이스큐브 #남극 #노벨상 #과학 #우주 #이슈

고정 댓글: 1초에 100조 개가 지나간다니, 믿어지시나요? 🧊

**life1** — 업로드 제목: 비행기 창문이 네모가 아닌 진짜 이유 ✈️

> 1954년 세계 첫 제트 여객기 코멧 두 대가 석 달 사이 하늘에서 부서졌습니다. 물탱크 압력 시험에서 찾은 원인은 네모난 창 모서리에 힘이 몰려 생긴 금속 피로였습니다. 그래서 지금 비행기 창문은 모서리가 둥급니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: FAA Lessons Learned – de Havilland Comet · 영상·사진: Pexels(Afif Ramdhasuma, K, Alireza Akhlaghi, Sher Lyn ., Lukas L, Rise Within Studio, Taryn Elliott) · 사진: 영국 정보부(IWM TR 6113) (퍼블릭 도메인) · 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #비행기 #비행기창문 #항공상식 #생활상식 #진짜이유 #코멧 #여행 #지식

고정 댓글: 창가 자리파? 통로 자리파? 🪟

**life2** — 업로드 제목: 엘리베이터 거울이 셀카용이 아닌 진짜 이유 ㄷㄷ

> 엘리베이터 거울은 셀카용이 아니라 법에 적힌 장치입니다. 휠체어가 안에서 돌 수 없는 장애인용 승강기는 후진하며 문을 확인할 수 있도록 뒷벽 0.6m 이상 높이에 거울을 달아야 합니다. 휠체어의 백미러인 셈입니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 국가법령정보센터 장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 [별표 1](2026-10-10 기준) · 영상·사진: Pexels(Anna Holodna, cottonbro studio, Yusuf Çelik, Max Vakhtbovych, Gustavo Fring, SHVETS production, Zakhar Vozhdaienko) · 영상: Pixabay (Pixabay Content License) · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #엘리베이터 #엘베거울 #생활상식 #휠체어 #진짜이유 #장애인편의 #법 #지식

고정 댓글: 엘베 거울, 셀카 말고 이렇게 쓰는 거 알고 계셨나요? 🪞

**life3** — 업로드 제목: 제한속도 지켜도 1차로에서 단속되는 진짜 이유 🚗

> 편도 3차로 이상 고속도로의 1차로는 앞지르기할 때만 쓰는 차로입니다. 계속 달리면 지정차로 위반으로 승용차 범칙금 4만 원, 승합차 5만 원, 벌점 10점입니다. 정체로 시속 80km도 못 낼 때는 예외입니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 국가법령정보센터 도로교통법 시행규칙 [별표 9]·시행령 [별표 8](2026-10-10 기준) · 영상·사진: Pexels(Raphael Kim, FREE VIDEO HAPPY, K, Airam Dato-on, SHOX ART, Nothing Ahead) · 음악: "Exhilarate" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #고속도로 #1차로 #지정차로 #운전상식 #진짜이유 #범칙금 #운전 #지식

고정 댓글: 여러분은 고속도로에서 몇 차로로 달리시나요? 🛣️

**life4** — 업로드 제목: 이착륙 때 창문 덮개 열라는 진짜 이유 ✈️

> 이착륙 때 창문 덮개를 열면 창밖 상황을 빨리 발견하고, 정전 때 바깥 빛으로 비상구를 찾을 수 있습니다. 조명을 낮추는 것도 눈이 어둠에 적응하라는 것입니다. 국내 한 항공사는 2021년부터 의무가 아닌 권고로 바꿨고, 날개 위와 비상구 창은 여는 게 원칙입니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 대한항공 뉴스룸 「항공상식 Q&A」(2023.9.6). 항공사마다 규정은 다를 수 있음 · 영상·사진: Pexels(Dilara Hazıroğlu, K, Content Kiosk, Grigoriy Bunkov, Afif Ramdhasuma, Taryn Elliott) · 음악: "Floating Cities" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #비행기 #항공상식 #창문덮개 #비상구 #진짜이유 #이착륙 #여행 #지식

고정 댓글: 이착륙 때 창문, 열어 두시나요? 🛫

**life5** — 업로드 제목: 노란불 3초, 밟으라는 시간이 아닌 진짜 이유 🚦

> 대부분의 교차로 노란불은 3초지만, 노란불은 정지선 앞에서 멈추라는 신호입니다. 시속 50km면 멈추는 데 2.46초, 70km면 5.9초가 걸려 딜레마존이 생깁니다. 2024년 대법원은 못 멈출 거리였어도 멈추지 않았다면 신호위반으로 봤습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 한국교통연구원 「황색신호와 딜레마존」(2025), 도로교통법 시행규칙 [별표 2], 대법원 2024.5 판결(세계일보·문화일보 보도) · 영상·사진: Pexels(SHOX ART, K, Zuzanna Musial, JMT 35, Aleks Magnusson, Paul Bill, Ben Garves, Yasemin Gül) · 음악: "Hustle" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #신호등 #노란불 #딜레마존 #운전상식 #진짜이유 #교통법규 #운전 #지식

고정 댓글: 노란불 보면 밟는다 vs 멈춘다, 솔직히? 🚥

**life6** — 업로드 제목: 비상구 표시가 초록색인 진짜 이유 🟩

> 비상구 표시가 초록인 건 연기 속에서 더 잘 보여서가 아니라 국제 약속 때문입니다. 국제표준에서 초록은 안전, 빨강은 금지와 소방 장비를 뜻하고, 소방청 기준도 피난구유도등을 녹색 바탕에 흰 글자로 정해 뒀습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 소방청 고시 「유도등의 형식승인 및 제품검사의 기술기준」 제9조, ISO 3864·7010 · 영상·사진: Pexels(Nischal Pradhan, Caleb Oquendo, Mustafa Akkuş, Paolo San, Norbert Szomszéd, Erik Mclean, Paul Bill, Yaroslav Shuraev, Jakub Zerdzicki) · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #비상구 #생활상식 #소방 #픽토그램 #진짜이유 #안전 #초록색 #지식

고정 댓글: 빨간 EXIT 표시, 해외에서 본 적 있나요? 🏃

**life7** — 업로드 제목: 볼펜 뚜껑에 구멍이 뚫린 진짜 이유 ㄷㄷ

> 볼펜 뚜껑 끝 구멍은 잉크 때문이 아니라 아이 안전 때문입니다. 국제표준 ISO 11540은 아이가 뚜껑을 삼켜도 숨을 쉴 수 있게 분당 8리터 이상 공기가 통하도록 정합니다. 질식을 완전히 막진 못해도 병원에 갈 시간을 벌어 줍니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: ISO 11540:2021, 산업통상자원부 학용품 안전기준 · 영상·사진: Pexels(Адам Аушев, cottonbro studio, Jess Bailey Designs, Allan Mas, Mizuno K, Vanessa Garcia) · 그림: 직접 그림 · 음악: "Scheming Weasel" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 뚜껑 그림은 직접 그린 것입니다
>
> #Shorts #볼펜 #생활상식 #어린이안전 #볼펜뚜껑 #진짜이유 #ISO #문구 #지식

고정 댓글: 볼펜 뚜껑 씹는 버릇, 있으신가요? 🖊️

**life8** — 업로드 제목: 지하철 임산부 배려석이 분홍색인 진짜 이유 🩷

> 서울 지하철 임산부 배려석은 2013년 작은 엠블럼으로 시작했지만 눈에 잘 띄지 않았습니다. 그래서 서울시는 2015년 좌석과 바닥까지 분홍으로 바꾼 핑크카펫을 도입했습니다. 2016년엔 1~8호선 7,140석으로 늘었습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 서울시 교통(2013), 서울시 미디어허브(2015.7.23), 뉴스토마토(2016.1.15) · 영상·사진: Pexels(Paul Bill, Orhan Pergel, wal_ 172619, PNW Production, Earth Photart, KADO FUETA) · 사진: Garam (위키미디어 공용) ({{Attribution}}: any use, including commercial and derivative, with attribution to Garam) · 음악: "Heartwarming" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #임산부배려석 #핑크카펫 #지하철 #서울지하철 #진짜이유 #생활상식 #임산부 #지식

고정 댓글: 분홍 자리, 비워 두시나요? 🚇

**hanban1** — 업로드 제목: 백두산 폭발하면 화산재는 어디로 갈까? ㄷㄷ

> 서기 946년 백두산 분화의 화산재는 바다 건너 일본까지 날아가 쌓였습니다. 2002~2005년 무렵에는 백두산 아래 작은 지진이 급증하고 땅이 부풀었습니다. 지금은 기상청이 위성으로 지표 온도와 변위를 감시하지만, 언제 분화할지는 아무도 모릅니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 기상청 화산 분석, Oppenheimer et al. 2017, NASA Earth Observatory, Liu et al. 2020 · 사진: USGS (퍼블릭 도메인) · 영상: USGS (퍼블릭 도메인) · 사진: NASA (퍼블릭 도메인) · 영상: NASA·NOAA (퍼블릭 도메인) · 음악: "Lightless Dawn" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 분화 장면은 다른 화산(세인트헬렌스·킬라우에아·피나투보·통가)의 참고 영상입니다. NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #백두산 #화산 #천지 #지구과학 #화산재 #기상청 #과학 #지식

고정 댓글: 백두산 천지, 직접 가 보신 분 있나요? 🌋

**hanban2** — 업로드 제목: 태풍이 한국 앞에서 휙 꺾이는 진짜 이유?

> 태풍은 북태평양고기압을 뚫지 못하고 가장자리를 따라 돌다가, 편서풍을 만나면 북동쪽으로 꺾입니다. 2022년 힌남노는 오키나와 남쪽에서 거의 멈췄다가 꺾인 뒤 시속 98km까지 빨라졌습니다. 올해 6월 태풍 장미도 오키나와 부근에서 꺾여 한국 땅을 비껴갔습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 기상청 2022 태풍 분석보고서·2011 태풍분석보고서·보도자료(2026.6.2), NOAA AOML · 위성: NASA (퍼블릭 도메인) · 영상: NASA (퍼블릭 도메인) · 위성: NASA Worldview (퍼블릭 도메인) · 음악: "Movement Proposition" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 우주에서 본 허리케인 장면은 참고 영상입니다. NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #태풍 #힌남노 #날씨 #기상청 #북태평양고기압 #편서풍 #과학 #지식

고정 댓글: 힌남노 때 우리 동네는 어땠나요? 🌀

**hanban3** — 업로드 제목: 가을 하늘이 유독 높고 파란 진짜 이유

> 하늘이 파란 건 파란빛이 공기에 더 잘 흩어지기 때문입니다. 가을엔 건조한 이동성 고기압이 자주 와서 먼지와 수증기가 적고, 2025년 서울 초미세먼지 평균은 봄 24에서 가을 13㎍/㎥로 거의 절반이었습니다. 하늘이 높아진 게 아니라 공기가 깨끗해진 것입니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 기상청 보도자료(2010.10.1), 서울시 대기환경정보 계절별 평균, NASA Space Place · 사진: Ron Clausen (CC0 1.0) · 사진: Hankook12 (CC0 1.0) · 사진: NASA (퍼블릭 도메인) · 사진: NASA Worldview (퍼블릭 도메인) · 영상: Johann Mynhardt (CC BY 2.0) · 음악: "Dreamer" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #가을하늘 #미세먼지 #날씨 #과학 #가을 #하늘 #레일리산란 #지식

고정 댓글: 오늘 여러분 동네 하늘은 몇 점인가요? ☁️

**hanban4** — 업로드 제목: 한국에서 오로라가 찍힌 날 생긴 일 ㄷㄷ

> 2024년 5월, 21년 만의 최고 등급 지자기 폭풍 때 경북 영천 보현산천문대 카메라에 붉은 오로라가 찍혔습니다. 강원 화천에서도 촬영됐지만, 눈으로는 거의 보이지 않고 장노출 카메라에만 잡혔습니다. 영상 속 오로라는 같은 폭풍 때 미국에서 찍힌 것입니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 한국천문연구원 참고자료(2024.5.13), NOAA SWPC, USGS, NASA · 사진: NASA/Bill Dunford (퍼블릭 도메인) · 사진: NASA (퍼블릭 도메인) · 영상: NASA SDO (퍼블릭 도메인) · 영상: NASA/Bill Dunford (퍼블릭 도메인) · 음악: "Floating Cities" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 영상 속 오로라는 같은 폭풍 때 미국 유타·아이다호에서 NASA가 촬영한 것입니다. NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #오로라 #태양폭풍 #보현산천문대 #우주 #지자기폭풍 #천문 #과학 #지식

고정 댓글: 한국에서 오로라, 직접 보고 싶나요? 🌌

**why1** — 업로드 제목: 한반도에 반달곰이 다시 돌아온 진짜 이유 🐻

> 2004년 러시아에서 들여온 반달가슴곰 6마리를 지리산에 풀어 준 것이 복원의 시작이었습니다. 국립공원공단은 지금 야생 반달가슴곰을 약 96마리로 추정합니다. 곰의 위치 기록 중 탐방로 10m 안에 머문 건 0.44%뿐이라, 정해진 길로만 다니는 게 서로에게 안전합니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 국립공원공단 발표(한국경제·경기일보 2026.7.2, 세계일보 2026.5.7), 환경부 발표(데일리벳 2022.6.2) · 영상·사진: Pexels(Magda Ehlers, PUWOOK Kwak, Irina Fedotova, Simo Herold) · 음악: "Heartwarming" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 곰 영상은 동물원의 반달가슴곰, 산 영상은 참고 영상입니다. 개체 수는 국립공원공단 추정치입니다
>
> #Shorts #반달가슴곰 #지리산 #국립공원 #멸종위기 #반달곰 #동물 #진짜이유 #동물상식

고정 댓글: 지리산 갔다가 반달곰 흔적 본 적 있나요? 🐾

**why2** — 업로드 제목: 문어 심장이 3개인 진짜 이유 ㄷㄷ

> 문어는 아가미로 피를 보내는 심장 2개와 온몸으로 보내는 심장 1개를 가졌습니다. 구리가 든 헤모시아닌 때문에 피가 파랗고, 산소를 덜 실어 더 센 압력으로 돌려야 합니다. 헤엄칠 땐 온몸 심장이 멈춘다는 연구가 있어, 문어는 주로 바닥을 기어 다닙니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: Wells et al. 1987 J. Exp. Biol. 131:175, BBC Science Focus, Live Science, 국립수산과학원 연구자 칼럼(뉴스토마토 2016) · 영상·사진: Pexels(JUN HO LEE, Tom Fisk, Entdecker Fuchs, Jozef Papp) · 영상: NOAA (퍼블릭 도메인) · 음악: "Monkeys Spinning Monkeys" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다
>
> #Shorts #문어 #문어심장 #바다생물 #과학상식 #동물 #진짜이유 #해양생물 #동물상식

고정 댓글: 문어 숙회 vs 문어 라면, 여러분 픽은? 🐙

**why3** — 업로드 제목: 철원에 두루미 떼가 해마다 오는 진짜 이유 ㄷㄷ

> 2025년 11월 철원군 조사에서 두루미류 1만 1,640마리가 확인돼 역대 최대를 기록했습니다. 재두루미 1만 2마리, 두루미 1,567마리 등 5종입니다. 사람이 드문 민통선 들판, 논에 남긴 볏짚과 곡식, 얼지 않는 샘통과 물 댄 논이 철원을 겨울 집으로 만들었습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 철원군 조사(강원도민일보 2025.12.14), 철원 두루미 운영협의체(뉴스펭귄), International Crane Foundation, BirdLife · 영상·사진: Pexels(Nicky Pe, Brixiv) · 음악: "Dreamer" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0) · 두루미 영상은 국외에서 찍은 참고 영상입니다. 개체 수는 철원군 조사 결과입니다
>
> #Shorts #두루미 #철원 #철새 #멸종위기 #재두루미 #천연기념물 #동물 #진짜이유

고정 댓글: 겨울 철원 두루미, 직접 보신 분 있나요? 🕊️

**why4** — 업로드 제목: 까치가 한국에선 길조, 영국에선 흉조인 진짜 이유?

> 까치는 1964년 한 신문의 나라새 뽑기에서 1위를 했고, 반가운 손님을 알리는 길조로 여겨졌습니다. 반면 영국에는 까치 한 마리를 보면 슬픔이 온다는 미신이 있습니다. 거울 속 자신을 알아보는 똑똑한 새지만, 우리나라에선 전기 설비 피해로 유해 야생동물로 지정돼 있습니다.
>
> ▶ [채널명] 채널 구독: https://www.youtube.com/@[핸들]
>
> 출처: 자료: 한국민족문화대백과사전 '까치', Prior et al. 2008 PLoS Biology, Lee et al. 2011 Animal Cognition, 환경부 자료(KED Global 2023) · 영상·사진: Pexels(Bil Hinton, Justin Stretch, 대정 김, Scott Precious) · 음악: "Sneaky Snitch" Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)
>
> #Shorts #까치 #길조 #새 #동물상식 #진짜이유 #칠월칠석 #오작교 #동물

고정 댓글: 여러분 동네 까치는 길조인가요, 해조인가요? 🐦

