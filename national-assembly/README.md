# 국회의사당 3D 모델 (Blender, v2)

여의도 국회의사당 본관과 둘레 캠퍼스를 Blender 파이썬(bpy) 스크립트 **한 파일**로 짓습니다.
Blender 안에서 손으로 배치한 것은 없고, `build_national_assembly.py`를 실행하면 기단·대계단·본체·열주 24개·처마·돔,
잔디광장과 분수·해태상·이웃 건물·사랑재·한강, 하늘과 조명, 카메라까지 한 번에 만들어집니다.

페이지: <https://richroro.github.io/national-assembly/> — 본관 낮·밤 모델과 캠퍼스 모델을 브라우저에서 돌려 볼 수 있습니다.

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 웹 페이지. model-viewer 3.5 뷰어(낮·밤·캠퍼스, 시점 버튼, 지점), 첫 버전 비교, 렌더 갤러리 |
| `build_national_assembly.py` | 모델 생성 스크립트 (Blender 4.2+ 또는 pip `bpy` 5.x, 약 7,900줄) |
| `national_assembly.blend` | 스크립트로 만든 낮 장면 (절차적 재질·조명·카메라 포함) |
| `national_assembly.glb` | 웹용 본관 · 낮 (Draco) |
| `national_assembly_night.glb` | 웹용 본관 · 밤. 창·LED·조명이 발광 재질 (`KHR_materials_emissive_strength`) |
| `national_assembly_campus.glb` | 웹용 캠퍼스 전체 · 낮 (중심 반경 650 m) |
| `env_night.hdr` | 밤 GLB와 짝을 이루는 어두운 환경맵 |
| `hotspots.json` | 뷰어 지점 앵커 13개 (`id`, `label`, `desc`, `scopes`, `data_position`, `data_normal`, `orbit`) |
| `renders/*.jpg` | Cycles 렌더 11장 (1920×1080). `v1_hero.jpg`는 첫 버전 비교용 |
| `renders/thumb/*.jpg` | 갤러리 썸네일 (가로 960 px). `make_thumbs.py`로 만듭니다 |
| `draco/` | Draco 디코더 (`draco_wasm_wrapper.js`, `draco_decoder.wasm`) — 외부 CDN 없이 같은 폴더에서 불러옵니다 |

## 실행

```bash
# 1) Blender GUI: Scripting 탭에서 build_national_assembly.py 열고 ▶ 실행 (현재 씬을 비우고 낮 장면을 만듭니다)

# 2) Blender 헤드리스
blender -b -P build_national_assembly.py -- --out ./out --blend --glb --render

# 3) Blender 없이 (pip의 bpy 휠)
pip install bpy
python build_national_assembly.py --out ./out --blend --glb --render
```

자주 쓰는 조합:

```bash
python build_national_assembly.py --validate                                   # 치수 검사만 (실패하면 종료 코드 1)
python build_national_assembly.py --render --shots night:hero,night:axis --format jpg --samples 64
python build_national_assembly.py --blend --tod golden --no-site               # 건물만, 이른 아침 장면
python build_national_assembly.py --render --cam stair=0,-130,6/0,-80,4/35 --shots day:stair
```

## 옵션

| 옵션 | 하는 일 |
|---|---|
| `--out DIR` | 결과물 폴더 (기본 `./out`) |
| `--blend` | `national_assembly.blend` 저장 |
| `--glb` | 웹용 GLB 세 개(본관 낮·밤, 캠퍼스) + `hotspots.json` + `env_night.hdr`. Draco 압축 |
| `--glb-scopes LIST` | 내보낼 GLB만 고르기: `building`, `night`, `campus` (쉼표) |
| `--no-draco` | GLB를 Draco 없이 |
| `--render` | 기본 샷 11장을 Cycles로 렌더 |
| `--shots LIST` | 렌더할 샷 `시간대:카메라` (쉼표). 시간대 `day` `golden` `night`, 카메라 `hero` `front` `aerial` `axis` `colonnade` `dome` `haetae` `golden` |
| `--tod day\|golden\|night` | GUI와 `--blend` 장면의 시간대 (기본 `day`) |
| `--samples N` | 렌더 샘플 수 (기본 128) |
| `--size WxH` | 렌더 해상도 (기본 `1920x1080`) |
| `--format png\|jpg` | 렌더 파일 형식 (기본 `png`) |
| `--threads N` | 렌더 스레드 (0 = 자동) |
| `--no-site` | 잔디·광장·나무·이웃 건물 같은 주변 부지를 빼고 건물만 |
| `--validate` | 높이 69.19 m, 돔 64 m, 열주 24개, 기단 5.44 m 등을 검사하고 실패하면 종료 코드 1 |
| `--flat` | 렌더 전에 재질을 GLB 대표색으로 바꿔 웹에서 보일 모습을 미리 봅니다 |
| `--cam name=x,y,z/tx,ty,tz[/lens]` | 임시 카메라 추가 (여러 번 가능, `--shots day:name`으로 렌더). 좌표는 Blender 기준, 정면이 −Y |

## 치수 근거와 추정 (단위 m)

자료에 나온 값:

| 항목 | 값 | 출처 |
|---|---|---|
| 지반 → 기단면 | 5.44 | 한국민족문화대백과 |
| 기단면 → 돔 꼭대기 | 63.75 (합 69.19, 흔히 "70 m") | 한국민족문화대백과 |
| 열주 | 24개, 높이 32.5 (전면 8개 = 팔도, 24 = 24절기) | 한국민족문화대백과 |
| 대계단 너비 | 50 | 한국민족문화대백과 |
| 층고 | 5.2~6.5 | 한국민족문화대백과 |
| 본관 평면 | 122 × 81 | 국가기록원·언론 |
| 돔 | 밑지름 64, 높이 20, 약 1,000 t | 국가기록원·언론 |
| 준공 | 1975 | 국가기록원 |
| 처마 · 기단 · 돔 윤곽 | 약 156 × 115 · 164 × 123 · 66 | OpenStreetMap 건물 윤곽 |
| 정면 방위 | 142° (남동) | OpenStreetMap 건물 윤곽·축 |

추정한 값 (사진을 보고 정함, 스크립트 상수로 바꿀 수 있음):

- 열주 단면: 밑 2.8 m 모서리 깎은 사각 → 위 3.3 m 정팔각, 돌 드럼 약 1.41 m
- 층 배분: 6.5 m 한 층 + 5.2 m 다섯 층 = 32.5 m
- 창·핀 리듬: 열주 한 칸을 10모듈(약 2.06 m)로 나눈 화강석 핀
- 처마 두께 3.2 m, 파라펫 2.8 m, 돔 받침 높이 5.25 m
- 돔 동판 스탠딩 심 128줄, 녹청 색과 얼룩
- 대계단 34단(챌면 0.16 m)과 참 두 곳
- LED 그릴 크기(약 18.4 × 12.4 m)
- 분수·해태·청동 군상의 크기와 형태, 이웃 건물의 매스와 입면, 의원동산 높이(약 7 m)

해 위치는 서울의 실제 태양 위치입니다: 낮 = 9월 하순 오전 10시 무렵(방위 125°, 고도 42°), 이른 아침 = 방위 93°, 고도 7.5°,
밤 = 해가 지평선 아래 5.5°인 블루아워. 밤 조명은 2007년 경관조명 계획(열주 업라이트, 처마 워시, 돔 투광)을 따랐습니다.

## 평면 해석 (`PLAN_BASIS`)

자료의 "122 × 81 m"가 무엇을 잰 값인지는 적혀 있지 않습니다.

- `'osm'` (기본): 122 × 81 = 열주 뒤 **본체 외벽**. OpenStreetMap 윤곽(처마 약 156 × 115, 기단 약 164 × 123, 돔 66)과
  공개된 연면적 81,444 m²가 이 해석과 맞습니다. 회랑 깊이 11 m, 열주 중심선 144 × 103, 열주 칸 약 20.6 m로 거의 정사각형.
- `'colonnade'`: 122 × 81 = 열주 중심선 (첫 버전의 해석). 스크립트 맨 위 `PLAN_BASIS`를 바꾸면 이쪽으로 다시 짓습니다.

확정된 도면을 본 것은 아니므로 어디까지나 해석입니다.

## 섹션 구조

스크립트는 섹션 12개를 번호 순서로 이어 붙인 한 파일입니다. 파일 안에서 섹션마다 `# ----` 머리 주석으로 나뉩니다.

| 섹션 | 내용 |
|---|---|
| `00_header` | 공유 치수, 좌표계(원점 = 본관 중심 지면, 정면 −Y)와 방위, `PLAN_BASIS` |
| `10_core` | 장면 초기화, 컨텍스트(`Ctx`), 재질 노드·bmesh 도우미 |
| `20_materials` | 공유 재질: 화강석·콘크리트·유리·금속·청동 (절차적, 거리에 따라 무늬가 평균색으로 바뀜) |
| `30_site` | 지형과 한강, 캠퍼스 차로·광장, 잔디광장 네 칸, 분수, 나무, 가로등, 울타리 |
| `35_landmarks` | 해태 한 쌍, 정문, 상징석, 애국애족의 군상, 국회도서관·의원회관·의정관·국회박물관·소통관, 사랑재 |
| `40_podium` | 기단(안에 지상 1층), 대계단, 옆 계단, 기단 파라펫, 뒤쪽 출입구 |
| `50_body` | 본체 외벽: 화강석 핀·층 띠, 청동빛 유리, 정면 출입구, LED 그릴(밤에 태극기) |
| `60_colonnade` | 열주 24개, 처마 슬래브, 회랑 천장 격자와 다운라이트, 파라펫과 옥상 |
| `70_dome` | 돔 받침, 구면 캡 셸, 동판 스탠딩 심, 녹청 재질, 피뢰침 |
| `80_lighting` | 물리 하늘과 해 위치, 밤 조명, 카메라(샷), 렌더 설정 |
| `85_export` | 웹용 GLB 세 개(본관 낮·밤, 캠퍼스)와 `hotspots.json`, `env_night.hdr` |
| `90_main` | 빌드 순서, 치수 검사(`--validate`), 렌더, 명령줄 |

빌드 순서: 재질 → (부지 옵션이면) 부지 · 상징물 → 기단 → 본체 → 열주 → 처마·옥상 → 돔 → 하늘 → 조명 → 카메라.

## 웹 뷰어

- Google model-viewer 3.5 (`ajax.googleapis.com`). Draco 디코더는 이 폴더의 `draco/`에서 불러옵니다
  (`dracoDecoderLocation`을 모델을 불러오기 전에 설정).
- 낮: `environment-image="legacy"`, 노출 0.85, 그림자 1. 밤: `env_night.hdr`, 노출 1.1, 그림자 0, 어두운 배경.
  캠퍼스는 낮 모델만 있어 캠퍼스를 고르면 밤 버튼이 꺼집니다.
- 지점은 `hotspots.json`에서 만들고 `scopes`(`building`/`campus`)로 거릅니다. 누르면 `orbit` 카메라로 이동하고,
  카메라가 멈추면 그 점은 흐려져 가리키는 부분을 가리지 않습니다. JSON을 못 불러와도 뷰어는 그대로 동작합니다.
- 작은 조각상(해태상, 애국애족의 군상)은 내보낸 `orbit`이 멀어 `index.html`의 `HS_VIEW`에서 시점을 덮어씁니다.
  `hotspots.json`을 다시 내보내도 이 설정은 유지됩니다.
- 시점 버튼은 뷰어의 가로세로 비율에 따라 넓은 화면용(`orbit`)과 세로 화면용(`phone`) 값을 섞어 씁니다.
- GLB·hotspots·env를 다시 만들려면 `--glb`로 내보내 이 폴더에 덮어씁니다.

렌더를 바꾼 뒤에는 썸네일을 다시 만듭니다 (파일 이름은 그대로):

```bash
python3 make_thumbs.py --src national-assembly/renders     # 또는 blender -b -P make_thumbs.py -- --src ...
```

## 라이선스 참고

- `draco/`의 Draco 디코더(`draco_wasm_wrapper.js`, `draco_decoder.wasm`)는 Google Draco 프로젝트의 파일로,
  three.js 예제(`examples/jsm/libs/draco/gltf/`)에서 가져왔습니다. Apache License 2.0을 따릅니다.
- model-viewer는 Apache License 2.0, Google CDN에서 불러옵니다.
- 캠퍼스 배치와 건물 윤곽은 OpenStreetMap 자료를 참고했습니다 (© OpenStreetMap 기여자, ODbL).
- 국회의사당 본관(1975년 준공)을 참고한 학습용 모델이며 실제 건물과 다른 부분이 있습니다.
