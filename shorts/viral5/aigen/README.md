# aigen — AI 그림(정지 이미지) 만들기, CPU

2026-10-11 "쇼츠 50만+ AI" 작업에서 만든 이미지 생성 도구다. 가중치는 저장소에 넣지 않는다. `fetch_models.py`가 받는다.

## 결론

- **쓰는 모델은 SDXL base 1.0 + SDXL-Lightning 4-step이다.** ByteDance가 합쳐 놓은 체크포인트(`ByteDance/SDXL-Lightning`의 `sdxl_lightning_4step.safetensors`)를 q8_0으로 다시 저장해 쓴다. 라이선스는 CreativeML OpenRAIL++-M이다.
  - 디코더는 taesdxl(MIT)이다.
  - 실행기는 stable-diffusion.cpp(MIT)의 `sd-cli`다.
- **640×1152 한 장에 약 4~5.5분이 걸린다**(CPU 4코어, RAM 16GB). 목표인 3~4분보다 조금 느리다. 영상에서는 1080×1920으로 키워 쓴다.
- **FLUX.1-schnell(Apache-2.0)은 이 환경에서 쓸 수 없다.** 768×1344에서 샘플링 한 스텝에 858초가 걸렸다. 4스텝이면 한 장에 약 1시간이다.

## 시간표

| 모델 | 크기 | 스텝 | 디코더 | 샘플링 | 디코드 | 한 장 전체 | 최대 RAM |
|---|---|---|---|---|---|---|---|
| FLUX.1-schnell Q4_0 + T5-XXL Q4_K | 768×1344 | 4 | ae(f32) | 858 s/스텝 (1스텝째에 멈춤) | - | 약 60분(추정) | 약 12GB |
| SDXL-Lightning 4-step (불러올 때 q8_0) | 768×1344 | 4 | SDXL VAE, 타일 | 366초 | 약 390초(45타일 × 8.6초) | 약 13분 | - |
| **SDXL-Lightning 4-step q8_0 gguf** | **640×1152** | **4** | **taesdxl** | **235초** | **13초** | **252초** |  |
| 같은 설정, 장면 생성(`gen.py`, 다른 일과 CPU를 나눔) | 640×1152 | 4 | taesdxl | | | 329초 등 → `media/aigen/test/timings.csv` | |

## 같은 인물을 여러 장면에 (일관성)

- **인물 시트 문장을 고정한다.** `scenes.json`의 `chars`에 인물마다 나이, 머리, 옷 색을 한 문장으로 적는다(예: "a 25-year-old young adult korean man with short messy black hair and a mustard yellow hoodie"). 모든 장면 프롬프트에 `{me}`처럼 그 문장을 그대로 넣는다.
- **스타일 문장과 금지어도 고정한다.** 장면마다 바꾸지 않는다.
- **시드는 장면마다 고정한다.** 다시 돌려도 같은 그림이 나온다.
- **한계.** 얼굴까지 똑같지는 않다. 머리 모양과 옷 색으로 같은 인물로 읽히는 수준이다. 얼굴을 맞추려면 IP-Adapter(Apache-2.0 가중치)나 img2img가 필요한데, CPU에서는 한 장에 몇 분씩 더 걸려 이번에는 시험하지 않았다. FaceID·InsightFace 계열은 쓰지 않는다.
- 시험 결과는 `media/aigen/test/contact.jpg`에 있다. 노란 후드 남자는 `s01`과 `t00`, 빨간 재킷 여자는 `s02`~`s04`다. 직접 보고 판정했다.
  - 옷 색과 머리는 장면이 바뀌어도 이어진다.
  - **얼굴과 그림체는 장면마다 달라진다.** 같은 인물이라고 믿기 어렵다. 8~14장면에 같은 인물을 세우려면 이 방법만으로는 부족하다.
  - **장면 지시는 일부만 따랐다.**
    - `s01`: 카메라를 들지 않았다.
    - `s02`: 한 장이 위아래 두 칸으로 나뉘었다.
    - `s03`: '사진을 든 손' 대신 길에 앉은 사람이 나왔다. 뒤 건물에는 뜻 없는 간판 글자가 생겼다.
  - **`t00`은 "young adult"를 넣지 않아 아이처럼 보인다.** 인물 시트에 나이를 꼭 적는다.
  - 다음에 할 일: 이미지마다 2~4개 시드를 뽑아 사람이 고르기(장당 시간 ×2~4), img2img로 기준 얼굴 이어 가기, 간판이 생기는 배경 피하기, `negative`에 "split panel, comic panels" 넣기.

## 라이선스 (2026-10-11에 모델 카드와 라이선스 원문을 직접 읽음)

| 무엇 | 라이선스 | 출력물 상업 사용 | 확인한 곳 |
|---|---|---|---|
| SDXL base 1.0 | CreativeML OpenRAIL++-M | 된다. 라이선스 4절의 "Licensor claims no rights in the Output"에 따라 출력물에 권리를 주장하지 않는다. 대신 Attachment A의 금지 용도를 지켜야 한다(불법, 미성년자 해악, 남을 해치는 허위 정보, 명예훼손·괴롭힘, 차별, 의료 조언 등) | huggingface.co/stabilityai/stable-diffusion-xl-base-1.0 `LICENSE.md` |
| SDXL-Lightning (ByteDance) | 같은 OpenRAIL++-M 원문 + ByteDance 저작권 한 줄 | 위와 같다 | huggingface.co/ByteDance/SDXL-Lightning `LICENSE.md` |
| taesdxl | MIT | 된다 | huggingface.co/madebyollin/taesdxl |
| stable-diffusion.cpp | MIT | (실행기) | github.com/leejet/stable-diffusion.cpp |
| FLUX.1-schnell (시험만) | Apache-2.0. 모델 카드에 "personal, scientific, and commercial purposes"라고 적혀 있다 | 된다 | github.com/black-forest-labs/flux `model_licenses/LICENSE-FLUX1-schnell`, `model_cards/FLUX.1-schnell.md`. 받은 GGUF는 HF `second-state/FLUX.1-schnell-GGUF`(Apache-2.0) |

- **쓰지 않는 것:** FLUX.1-dev(비상업), NC 라이선스, InsightFace, IP-Adapter-FaceID, Civitai 전용 체크포인트.
- **업로드할 때:** 설명란에 "이미지: AI 생성(SDXL-Lightning, CreativeML OpenRAIL++-M)"을 쓴다. 그림이 실사처럼 보이면 YouTube의 "변경되거나 합성된 콘텐츠"에 체크한다.
- **그림에 넣지 않는 것:** 실존 인물, 닮은 사람, 브랜드, 로고, 읽을 수 있는 간판. 모델이 만든 글자는 뜻 없는 글자가 되니 글은 자막으로 넣는다.

## 명령

```bash
python3 aigen/fetch_models.py            # sd.cpp 빌드 + 가중치(6.9GB, taesdxl 10MB) + q8_0 변환(4.2GB) → /opt/aigen (AIGEN_DIR로 바꿈)
python3 aigen/gen.py <id> [s01 s02 ...]  # media/aigen/<id>/scenes.json → media/aigen/<id>/img/<key>.jpg, timings.csv
python3 aigen/contact.py <id>            # media/aigen/<id>/contact.jpg
```

`gen.py`가 부르는 설정: `sd-cli -m sdxl_lightning_4step_q8_0.gguf --taesd taesdxl.safetensors --cfg-scale 1.0 --sampling-method euler --scheduler sgm_uniform --steps 4 -W 640 -H 1152 -s <seed> -t 4`

- **네트워크:** Hugging Face와 GitHub(git clone)에 연결된다.
  - `black-forest-labs/FLUX.1-schnell` 원본 저장소는 로그인 동의가 필요한 gated 저장소다. 그래서 HF 안의 Apache-2.0 GGUF 변환본을 받았다.
  - GitHub 릴리스 페이지는 curl로 403이었다. 그래서 소스를 받아 직접 빌드했다.

## 썰 캐릭터 시험 (`aigen/sseol/`, 2026-10-11, AI 썰 제작 중단)

썰구리식 "앱 글 카드 + 줄마다 AI 치비 장면"(`aisseol1`~`3`)을 만들려고 한 시험이다. 사용자가 목소리가 많이 들어가는 사연 형식을 접어서 쇼츠는 만들지 않았다. 대본, 녹음, 업로드 문구는 저장소에 넣지 않았다. 도구와 시험 그림만 남긴다.

- **설정:** 위와 같은 SDXL base 1.0 + SDXL-Lightning 4-step이다. 다만 합쳐진 체크포인트 대신 base 체크포인트에 LoRA(`sdxl_lightning_4step_lora.safetensors`)를 `--lora-apply-mode immediately`로 얹고, f16으로 돌린다. 크기는 정사각 832×832(글 카드 그림 칸이 900px), `--diffusion-fa`, taesdxl 디코더다.
  - 이 sd.cpp 빌드(2988060)에서는 `--type q8_0`과 LoRA를 함께 쓰면 `apply_loras_to_params`에서 죽는다. q8_0은 f16보다 빠르지도 않았다(1024²에서 88 s/스텝 대 86 s/스텝, 계산이 병목).

| 설정 | 샘플링 | 한 장 전체(모델 로드 약 25초 포함) |
|---|---|---|
| FLUX.1-schnell Q4_0, 512×512, 2스텝 | 190 s/스텝 | 489초 |
| SDXL + Lightning LoRA, f16, 1024×1024 | 86 s/스텝 | 400초 |
| **SDXL + Lightning LoRA, f16, 832×832, flash attention** | **41 s/스텝** | **213~226초** |
| Animagine XL 4.0(OpenRAIL++-M, 추가 제한 없음) + Lightning LoRA, 832² | 비슷함 | 233초. 4스텝에서 그림이 뭉개져서 버렸다(LoRA 없이 쓰려면 약 25스텝) |

- **일관성: 인물 시트 + 장면 구도.** `aigen/sseol/cast.py`에 그림체 문장 하나와 인물 시트(나: 둥근 검정 안경·빨간 넥타이, 서아: 높은 포니테일·노란 곱창끈, 할머니: 흰 파마·연보라 카디건 등)를 두고, 모든 프롬프트에 그대로 넣는다. 시드는 편마다 하나다. 시험 그림은 `aigen/sseol/img/test/sheet.jpg`다.
  - **한 장에 인물 한 명이면 이어진다.** `t3_seoa`(포니테일, 노란 곱창끈), `t1_me`(안경, 빨간 넥타이), `t5_gma`(흰 파마, 연보라)는 시트대로 나왔다.
  - **한 장에 인물 두 명이면 특징이 섞인다.** 4스텝, cfg 1에서는 "누가 무엇을" 묶지 못한다. `t2_me_tae`에서는 일진이 사라지고 모두 안경을 썼다. `t4_me_seoa`에서는 서아도 안경을 쓰고 포니테일이 없어졌다.
  - 그래서 **장면마다 인물을 한 명만 그리고, 상대는 시점 샷으로 처리한다**("seen from the point of view of …", "smiling at the viewer"). 웹툰이 대화를 그리는 방식과 같다. 벤치마크 썸네일도 대부분 한두 명이다.
  - 그 밖에 보인 것
    - 배경의 반 친구들이 주인공 특징(안경)을 따라 한다.
    - "only one character", "empty classroom"이라고 써도 없어지지 않는다.
    - 사람이 작게 나오면(`t5_gma` 버스 정류장, `t6_driver`) 시트가 흐려지고 인물이 둘로 늘기도 한다. "upper body shot", "close-up"처럼 구도를 적는다.
    - 칠판에는 뜻 없는 글자가 생긴다. 칠판·간판이 들어가는 배경은 피한다.
- **명령:** `python3 aigen/sseol/fetch_models.py`(가중치 → `~/.cache/aigen`, sd.cpp 빌드), `python3 aigen/sseol/gen.py --test`, `python3 aigen/sseol/sheet.py test`.
