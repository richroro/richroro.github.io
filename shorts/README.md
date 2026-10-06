# AI 직원 뽑았더니 — 45일 만에 생긴 일 (쇼츠)

이 사이트를 소재로 만든 유튜브 쇼츠. 사장님은 "만들어 줘" 한 마디만 하고, AI 직원이 앱을 찍어낸다.
반전은 저장소 통계이고, 끝 반전은 "이 영상도 AI가 만들었다"다.

- 영상: [`ai-employee-45days.mp4`](ai-employee-45days.mp4) — 52.9초 · 1080×1920 · 30fps · H.264/AAC · −14 LUFS
- 썸네일: [`thumbnail.jpg`](thumbnail.jpg)
- 대본·자막: [`script.json`](script.json), 화면: [`render/index.html`](render/index.html), 도구: [`tools/`](tools)

## 구성

| 시간 | 목소리 | 내레이션 | 화면 |
| --- | --- | --- | --- |
| 0:00 | 내레이터 | 앱 스무 개, 페이지 천 개. 만드는 데 걸린 시간, 딱 사십오 일. | 앱 캡처 20장 벽, 숫자 카운터, 달력 8/22→10/6, `45일` 도장 |
| 0:04 | 내레이터 | 개발팀이 몇 명이냐고요? 사장님이랑, AI 직원, 그리고 새벽 여섯 시에 출근하는 자동화 봇! | 조직도: 사장님 / AI 직원 / 자동화 봇 |
| 0:11 | 내레이터·사장님·AI | 사장님 업무는 딱 하나. "만들어 줘." "넵! 바로 만들게요!" | 카톡 스타일 채팅 |
| 0:15 | 사장님 | 공모주 캘린더 만들어 줘. 주식 찾는 앱도. 아파트 실거래가까지. 내 연봉 순위도. 국회의사당도, 3D로. 게임도 몇 개. 작곡 앱이랑 영상 편집기도. | 요청 말풍선 → **찰칵**(플래시·뷰파인더) → 폰 캡처, 확대·빨간 동그라미, 드립 스티커, `AI 납품 ✅ N건` |
| 0:30 | 내레이터 | 근데 진짜 소름 돋는 건, 따로 있어요. | 음악 끊김, 😱, 심장 소리 |
| 0:33 | 내레이터 | 작업 기록 244개 중에, 70%를 AI랑 봇이 했어요. | 후렴 드롭과 함께 커밋 막대그래프, `70%` 도장 |
| 0:38 | 내레이터 | 사장님은? 주로 승인 버튼 담당. | `Merge pull request` 클릭 → `✓ Merged`, `승인 버튼 26번 클릭` |
| 0:40 | 내레이터 | 여러분 반복 업무도, 이제 AI 직원한테 맡기세요. | Cadence 랜딩 캡처, `무료로 진단받기` 강조 |
| 0:44 | 내레이터 | 참고로, 이 영상도 AI가 만들었어요. | 크레딧: 기획·목소리·편집 AI, 배경음악은 사이트 '한 줄 작곡', 편집자 월급 0원 |
| 0:47 | 내레이터 | 근데 구독 버튼은, AI가 못 눌러요. 그건 여러분이 눌러 주세요! | 로봇 손을 피해 도망가는 구독 버튼 → 사람 손이 누름 |

## 숫자는 전부 이 저장소에서 셌다

| 화면 | 값 | 근거 |
| --- | --- | --- |
| 만든 앱 | 20+ | 웹 프로젝트 20개(랜딩·게임 6종 포함) + 카드뉴스·로블록스 게임 |
| 페이지 | 1,037 | `find . -name index.html \| wc -l` |
| 45일 | 2026-08-22 → 2026-10-06 | 첫 커밋 날짜 |
| 새벽 6시 출근 봇 | 매일 06:10 | `.github/workflows/update-real-estate.yml` 의 `cron: '10 21 * * *'` (UTC) |
| 종목·ETF 1만 4천 개 | 14,088 | 전 종목 탐색기 문구: 미국 5,887 + 한국 2,873 + ETF 5,328 |
| 커밋 244개 | AI 126 · 봇 46 · 사람 계정 72 | `git log --format=%an \| sort \| uniq -c` (AI+봇 172 = 70.5%) |
| 승인 버튼 26번 | 26 | `Merge pull request` 커밋 수 |
| PR #40 | 계좌 준비, Claude 커밋 1개 | `git log 1b39caa^1..1b39caa^2` |

## 만든 방법

사람 손 없이 이 저장소와 컨테이너 안에서 끝냈다.

| 단계 | 방법 | 파일 |
| --- | --- | --- |
| 캡처 | 헤드리스 크로미움, 모바일 393×852 @2.5배. 3D 게임은 SwiftShader 로 실제 플레이 화면까지 | `tools/capture*.js` |
| 배경음악 | 사이트의 [한 줄 작곡](../ai-music/)에 "중독성 있는 후크송 컴백곡"을 넣고 WAV 저장 (K-pop · C장조 · 114 BPM) | `tools/bgm.js` |
| 목소리 | [Supertonic 3](https://github.com/supertone-inc/supertonic) 온디바이스 TTS (sherpa-onnx). 내레이터·사장님·AI 세 화자 | `tools/build_voice.py` |
| 발음 검수 | 한국어 Zipformer 음성인식으로 줄마다 받아쓰기 → 가장 정확한 테이크 선택. 음악을 깐 최종 믹스로 한 번 더 확인 | `tools/build_voice.py` |
| 자막 타이밍 | 같은 인식기의 토큰 타임스탬프로 자막 덩어리 경계를 맞추고, 덩어리 안에서는 음절 수로 단어 등장 시각 배분 | `tools/build_voice.py` |
| 효과음 | numpy 로 직접 합성 16종: 찰칵·휙·뿅·띠링·톡·타닥·쿵·두근·끼익·띠용·촤라락·딸깍·짠·동전 | `tools/sfx.py` |
| 화면 | HTML/CSS 한 장. `renderFrame(t)` 가 시간의 순수 함수라서 프레임마다 시각을 넣고 스크린샷 (4워커, 약 85초) | `render/index.html`, `tools/render.js` |
| 믹스 | 말할 때 음악·효과음 덕킹, 대사마다 음악을 13 dB 아래로 보장, 후렴 드롭을 통계 공개 0.35초 앞에, 구독 개그에서 테이프 스톱 | `tools/mix.py` |
| 인코딩 | x264 CRF 20, AAC 192k, `loudnorm` 2패스로 −14 LUFS | `tools/encode.sh` |

### 자막 스타일

- 상단 고정 제목: Black Han Sans, 둘째 줄 노랑
- 본 자막: Pretendard Black 84px, 검정 외곽선 15px(`paint-order: stroke fill`), `[핵심어]` 는 노랑
- 말하는 순간 단어가 톡 튀어나오는 리빌, 이모지는 크게 흔들림
- 드립은 네오브루탈 스티커(Jua, 굵은 테두리·그림자), 강조는 손그림 빨간 동그라미와 노란 테두리

## 다시 만들기

저장소 루트에서:

```bash
bash shorts/tools/setup.sh                       # 모델·폰트·three.js → shorts/build/ (git 제외)
python3 -m http.server 8765 &                    # 사이트를 로컬로 띄움 (SITE 로 주소 변경 가능)

node shorts/tools/capture.js shorts/build/caps shorts/build/npm        # 앱 화면
node shorts/tools/capture_states.js shorts/build/caps                  # 작곡 결과·검색·편집기 샘플
node shorts/tools/capture_states2.js shorts/build/caps                 # 연봉 결과 위치 등
node shorts/tools/capture_games.js shorts/build/caps shorts/build/npm  # 농구 3D 플레이 화면
node shorts/tools/bgm.js shorts/build/bgm "중독성 있는 후크송 컴백곡"

M=shorts/build/models
python3 shorts/tools/build_voice.py shorts/script.json $M/sherpa-onnx-supertonic-3-tts-int8-2026-05-11 $M shorts/build
python3 shorts/tools/sfx.py shorts/build/sfx
node shorts/tools/render.js http://127.0.0.1:8765/shorts shorts/build/frames 30 4 shorts/build/plan.json
python3 shorts/tools/mix.py shorts/build shorts/build/bgm/bgm1.wav shorts/build/mix.wav
bash shorts/tools/encode.sh shorts/build shorts/ai-employee-45days.mp4
```

장면 하나만 확인할 때는 `node shorts/tools/stills.js http://127.0.0.1:8765/shorts <폴더> 17.4 33.6` 처럼 원하는 초를 넘긴다.
대사를 바꾸면 `script.json` 만 고치고 `build_voice.py` 부터 다시 돌리면 화면·효과음·음악 위치가 새 타이밍을 따라간다.

## 라이선스 메모

| 재료 | 라이선스 |
| --- | --- |
| Supertonic 3 모델 | OpenRAIL-M (코드는 MIT) — 해로운 용도가 아니면 상업 이용 가능 |
| 폰트 | Black Han Sans · Jua · Gaegu · Pretendard 모두 SIL OFL |
| 배경음악 | 이 사이트 '한 줄 작곡'이 만든 곡. 외부 음원 없음 |
| 효과음 | 직접 합성 |
| 화면 | 이 사이트 캡처, 국회의사당 렌더는 `national-assembly/renders/` |

## 한계

- 목소리는 TTS 라 성우만큼 억양이 다채롭지 않다. "실거래가", "이백사십사" 처럼 받침이 몰린 말은 테이크를 골라 붙였다.
- 화면 캡처는 그날의 데이터다. 공모주·시세 화면은 다시 캡처하면 숫자가 바뀐다.
- 렌더에는 헤드리스 크로미움과 한글 폰트가 필요하다(`setup.sh` 가 설치).
