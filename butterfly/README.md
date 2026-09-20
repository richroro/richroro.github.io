# 기계 나비 — three.js

“three.js 로 아름다운 기계 나비 만들기” 한 줄에서 출발한 3D 장면.
모델링 파일도, 텍스처 이미지도 없다. 날개 골격·막·태엽·질감·환경광·빛 번짐까지
전부 페이지가 열릴 때 계산해서 만든다.

- 배포: https://richroro.github.io/butterfly/
- 소스: `index.html`(화면·조작) + `assets/butterfly.js`(장면) + `assets/three.min.js`(라이브러리)

## 쓴 것

| 항목 | 내용 |
| --- | --- |
| 라이브러리 | three.js r186 한 개. CDN 을 쓰지 않고 저장소에 함께 둔다(`assets/three.min.js`, MIT) |
| 에셋 | 없음. `.glb`·`.jpg`·`.hdr` 가 하나도 없다 |
| 빌드 | 없음. 정적 파일 그대로 GitHub Pages 에 올라간다 |
| 요구 사항 | WebGL2. 지원하지 않으면 안내 화면으로 대체한다 |

## 형상을 만드는 방법

### 날개

1. 바깥선을 점 11~12 개의 **닫힌 Catmull-Rom 스플라인**으로 뽑는다. 앞날개·뒷날개가 각각 다른 윤곽을 가진다.
2. 뿌리에 가장 가까운 점을 0번으로 돌려 놓고, 고리를 따라 일정 간격으로 **맥이 닿을 자리**를 정한다.
   이렇게 하면 앞전 → 끝 → 뒷전으로 부챗살이 자연스럽게 퍼진다.
3. 맥은 뿌리에서 그 자리까지 가는 **2차 베지에**. 관은 굵기가 변해야 해서 `TubeGeometry` 대신
   고리를 직접 쌓는 `taperedTube()` 를 썼다(뿌리 굵고 끝 가늘게).
4. 맥과 맥 사이를 다각형으로 채우고 **안쪽으로 0.026 만큼 줄여서**(`insetPolygon`) 판 사이에 금속 뼈대가 드러날 틈을 낸다.
   줄인 다각형을 `ExtrudeGeometry` 로 얇게 밀어 유리판처럼 만든다.
5. 다 만든 뒤 **휘어짐을 한 번에 입힌다**(`applyCamber`). 스팬을 따라 처지게 하고, 끝으로 갈수록
   비틀어(워시아웃) 평평한 판이 아니라 날개 단면처럼 보이게 한다.
6. UV 는 판별로 주지 않고 **날개 전체의 경계 상자 기준으로 다시 입혀서**(`remapUV`) 판이 나뉘어도 무늬가 이어지게 한다.

좌우는 좌표를 뒤집어(`side = ±1`) 따로 만든다. `scale.x = -1` 로 뒤집으면 법선이 뒤집혀
조명이 망가지기 때문이다. 대신 다각형이 뒤집힐 수 있어 `ensureCCW()` 로 방향을 맞춘다.

### 태엽

`gearGeometry()` 가 이빨·축구멍·살창을 도형으로 깎아 `ExtrudeGeometry` 로 밀어낸다.
크랭크는 **날갯짓 한 번에 정확히 한 바퀴** 돈다. 크랭크 위의 편심 핀과 날개 뿌리를 잇는 연결봉은
매 프레임 두 끝의 좌표를 다시 재서 위치·방향·길이를 맞춘다. 그래서 실제로 물려 도는 것처럼 보인다.

```js
r.pin.getWorldPosition(va); body.worldToLocal(va);      // 크랭크 핀
r.wing.wing.localToWorld(vb); body.worldToLocal(vb);    // 날개 위의 물림점
r.mesh.quaternion.setFromUnitVectors(ZAXIS, dir.normalize());
r.mesh.scale.z = dir.length();
```

### 몸통

가슴은 `LatheGeometry` 회전체, 배는 일곱 마디. 마디 안에 발광체를 넣어 **마디 사이로 빛이 샌다**.
겹눈은 면을 살린 20면체, 더듬이는 굵기가 변하는 관 + 끝의 발광 구슬, 다리는 세 쌍이 접힌 자세로 붙는다.

## 빛과 질감

- **무지갯빛**: `MeshPhysicalMaterial` 의 박막 간섭(iridescence). 캔버스에 그린 두께 지도
  (`iridescenceThicknessMap`)가 자리마다 막 두께를 다르게 만들어, 보는 각도에 따라 색이 갈린다.
  여기에 판마다 두께 범위를 0.72~1.42 배로 어긋나게 준 재질 다섯 벌을 돌려 쓴다.
  스테인드글라스처럼 칸칸이 다른 색이 나오는 건 이 때문이다.
- **환경광**: 스튜디오 조명을 코드로 만든다. 정방형도법 256×128 픽셀을 직접 채우되
  값이 1 을 넘는 **half-float HDR** 로 쓴다(`DataUtils.toHalfFloat`). 그래야 금속 하이라이트가
  하얗게 타면서 블룸에 걸린다. `PMREMGenerator` 로 거칠기별 흐림까지 미리 굽는다.
- **날개 질감**: 잔맥 22 줄과 그 사이 연결선을 한 번 계산해 바탕색·투명도·두께 지도·발광 회로
  네 장의 캔버스에 같은 자리로 그린다. 그래서 무늬가 서로 어긋나지 않는다.

## 빛 번짐(포스트 프로세싱)

three.js 의 `EffectComposer` 애드온을 쓰지 않고 직접 짰다. 애드온을 쓰면 `three/addons/...` 를
풀어 줄 import map 이 필요해지고, 저장소에 둬야 할 파일도 늘어난다.

1. 장면을 half-float 렌더 타깃에 그린다(데스크톱은 MSAA 4×).
2. 밝은 부분만 뽑는다(soft-knee threshold).
3. 절반씩 줄여 가며 **다섯 단계**로 가로·세로 가우시안 블러.
4. 합성 패스 하나에서 원본 + 다섯 단계를 더하고 ACES 톤매핑 · 비네팅 · 필름 그레인 ·
   색수차 · sRGB 변환까지 끝낸다.

## 숫자

| | |
| --- | --- |
| 삼각형 | 약 8.2만 개 |
| 드로우 콜 | 약 160 회 (장면 1 + 블룸 10 + 합성 1) |
| `three.min.js` | 725KB (gzip 약 186KB) |
| 나머지 코드 | `butterfly.js` 약 66KB + `index.html` 약 20KB |
| 처음 그리기까지 | 형상·질감·환경맵 계산을 모두 합쳐 수백 ms |

## 성능

- 픽셀 비율은 2 로 제한하고, 1 초 평균이 34fps 아래로 내려가면 해상도를 한 번 낮춘다(`quality: auto`).
- 탭이 가려지면 `requestAnimationFrame` 을 멈춘다.
- `prefers-reduced-motion` 이 켜져 있으면 자동 회전을 끄고 날갯짓·비행을 느리게 시작한다.
- 모바일은 먼지·불티 수를 줄이고 MSAA 를 끈다.

## 조작

| 입력 | 동작 |
| --- | --- |
| 드래그 / 한 손가락 | 시점 회전 |
| 휠 / 두 손가락 | 확대·축소 |
| `H` | 화면 정리(UI 숨기기) |
| `I` | 만든 방법 |
| `S` | 지금 화면을 PNG 로 저장 |
| `Space` | 정지 / 재생 |
| `R` | 시점 되돌리기 |

콘솔에서 `__butterfly` 로 장면을 직접 만질 수 있다.

```js
__butterfly.setPreset('titan');     // 색 바꾸기 (gold · titan · rose · jade)
__butterfly.set('flapSpeed', 0.3);  // 느리게
__butterfly.setView(1.2, 0.8, 3);   // 각도(수평, 수직), 거리
__butterfly.info();                 // 삼각형 수 · fps · 해상도
```

## three.js 를 저장소에 둔 이유

이 사이트의 다른 페이지들처럼 **외부 스크립트 없이** 돌아가게 하고 싶었다.
CDN 이 막히거나 버전이 바뀌면 페이지가 통째로 깨지는데, 정적 사이트에서 그건 되돌리기 어렵다.
`assets/three.min.js` 는 npm `three@0.186.0` 의 `build/three.module.js` 를 esbuild 로 묶어 압축한 것이다.
원본과 라이선스(MIT)는 `assets/three.LICENSE.txt` 에 함께 둔다.

```bash
npm i three@0.186.0
npx esbuild node_modules/three/build/three.module.js \
  --bundle --format=esm --minify --outfile=three.min.js
```
