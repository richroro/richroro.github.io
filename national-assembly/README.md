# 국회의사당 3D 모델 (Blender)

여의도 국회의사당 본관을 Blender 파이썬(bpy)으로 **전부 코드로** 만드는 스크립트입니다.
Blender 안에서 손으로 배치한 것은 없고, `build_national_assembly.py` 하나를 실행하면
기단·대계단·본체·24개 열주·처마·돔·주변 부지·조명·카메라가 한 번에 만들어집니다.

| 파일 | 내용 |
|---|---|
| `build_national_assembly.py` | 모델 생성 스크립트 (Blender 4.2+ / `pip install bpy`) |
| `national_assembly.blend` | 스크립트로 만든 씬 (재질·조명·카메라 3대 포함) |
| `national_assembly.glb` | 웹 뷰어용 glTF (`index.html` 에서 사용) |
| `render_hero.png` `render_aerial.png` `render_front.png` | Cycles 렌더 3장 (1920×1080) |
| `index.html` | 브라우저에서 돌려 볼 수 있는 뷰어 페이지 |

## 실행

```bash
# 1) Blender GUI: Scripting 탭에서 파일을 열고 ▶ 실행 (현재 씬을 비우고 모델을 만듭니다)

# 2) Blender 헤드리스
blender -b -P build_national_assembly.py -- --out ./out --blend --glb --render

# 3) Blender 없이 (pip 의 bpy 휠)
pip install bpy
python build_national_assembly.py --out ./out --blend --glb --render
```

옵션: `--samples N`(기본 96) · `--size WxH`(기본 1920x1080) · `--no-site`(건물만).

## 치수 근거 (단위 m)

| 항목 | 값 | 비고 |
|---|---|---|
| 본관 평면 | 122 × 81 | 열주 중심선 기준 |
| 열주 | 24개, 높이 32.5, 8각 화강석 | 앞·뒤 8개씩(전면 8개 = 팔도), 좌·우 사이 4개씩 = 24절기 |
| 돔 | 밑지름 64, 철골 약 1,000 t | 처마 위 받침 원통 4 m + 구면 캡 22 m |
| 전체 높이 | 70 | 기단 6 + 열주 32.5 + 처마·파라펫 5.5 + 돔 26 |
| 층수 | 지상 6층 | 1층은 기단 안, 기단 위 5개 층 × 6.5 m |

창 띠·멀리언 간격, 대계단 폭(46 m), 돔 리브 24개, 나무·분수 같은 주변 요소는 사진을 보고 단순화한 값이라
실측치가 아닙니다. 상수는 스크립트 맨 위에 모아 두었으니 바꿔서 다시 실행하면 됩니다.

## 구조

- `build_podium` 기단 + 지상 1층 창 띠 + 정면 대계단(단면을 X 방향으로 밀어낸 한 덩어리) + 경사 난간벽
- `build_body` 유리 커튼월 덩어리 + 층마다 화강석 스팬드럴 + 세로 멀리언 + 정면 출입구(포털·청동문)
- `build_columns` 주초·8각 주신(위로 갈수록 가늘게)·주두 24개
- `build_roof` 처마 슬래브 · 그림자 홈 · 파라펫 · 옥상 설비
- `build_dome` 받침 원통·루버 · 구면 캡 돔 · 리브 24개 · 꼭대기 마감·피뢰침
- `build_site` 잔디·광장·분수·가로수 (`--no-site` 로 생략)
- `build_lighting_and_cameras` 하늘 그라데이션 월드 · 태양광 · 카메라 3대(3/4 뷰·항공·정면 입면)
