# 티끌 타이쿤

드로퍼가 떨어뜨린 돈이 컨베이어를 타고 금고로 들어가는 로블록스 타이쿤.
같은 저장소의 [티끌모아 태산](../../games/tikkeul-moa/)과 같은 소재(티끌을 모아
태산)를 3D 공장으로 옮긴 것이다.

**맵과 UI를 전부 코드로 짓는다.** Studio 에서 손으로 배치해 둘 파트도, StarterGui 에
미리 넣어둘 ScreenGui 도 없다. 빈 베이스플레이트에서 Play 를 누르면 공장 6칸과
로비가 생성된다.

## 실행

### 1. 바로 열어보기 (설치할 것 없음)

`build/TikkeulTycoon.rbxlx` 를 받아 Roblox Studio 로 연다. Play 를 누르면 끝이다.

이 파일은 `src/` 에서 생성된 것이다. 코드를 고쳤으면 아래로 다시 만든다.

```bash
rojo build default.project.json --output build/TikkeulTycoon.rbxlx
```

### 2. 작업하면서 고치기 (권장)

[Rojo](https://rojo.space) 로 Studio 에 연결하면 저장할 때마다 반영된다.

```bash
rojo serve default.project.json      # Studio 의 Rojo 플러그인에서 Connect
```

### 3. 저장 기능

DataStore 를 쓰므로 Studio 에서는 **Game Settings → Security → Enable Studio Access
to API Services** 를 켜야 진행도가 남는다. 안 켜도 게임은 정상으로 돌아가고,
경고 한 줄과 함께 그 세션만 저장 없이 진행된다.

## 게임

로비에서 시작해 빈 공장의 파란 패드를 밟으면 그 칸의 주인이 된다. 한 사람이
한 칸만 가질 수 있고, 나가면 칸이 반납된다.

기본 드로퍼는 차지하는 순간 공짜로 지어진다. 돈이 0인 채로 아무것도 못 사는
상태를 없애려는 것이다. 이후로는 초록 패드를 밟아 순서대로 사 나간다.

| 구매 | 가격 | 효과 |
| --- | --- | --- |
| 티끌 드로퍼 | 공짜 | 초당 5 (차지하면 자동) |
| 동전 드로퍼 | 100 | 초당 12 |
| 컨베이어 개조 I | 350 | 수입 x1.3, 벨트 20 |
| 지폐 드로퍼 | 900 | 초당 32 |
| 공장 벽 | 2,500 | 수입 x1.1 |
| 금고 드로퍼 | 4,500 | 초당 110 |
| 컨베이어 개조 II | 1.5만 | 수입 x1.4, 벨트 28 |
| 골드 드로퍼 | 2.5만 | 초당 400 |
| 지붕 | 7만 | 수입 x1.15 |
| 케이던스 코어 | 12만 | 초당 1,500 |
| 금고 확장 | 40만 | 수입 x2 |

전부 사면 환생 패드가 열린다. 공장을 비우고 돈을 0으로 되돌리는 대신 수입
배수가 영구히 2배가 된다. 환생 비용은 판마다 3배씩 오른다.

## 밸런스

`python3 tools/balance.py` 가 Config 의 가격과 수입만 떼어내 계산한다. 숫자를
따로 베껴두지 않고 `src/shared/Config.luau` 원본을 그대로 읽으므로, Config 를
고치면 결과도 같이 움직인다.

| 환생 | 수입 배수 | 환생 비용 | 한 판 | 누적 |
| --- | --- | --- | --- | --- |
| 0회 | x1 | 100만 | 11분 15초 | 11분 15초 |
| 1회 | x2 | 300만 | 7분 23초 | 18분 38초 |
| 2회 | x4 | 900만 | 6분 19초 | 24분 58초 |
| 3회 | x8 | 2,700만 | 7분 07초 | 32분 05초 |
| 4회 | x16 | 8,100만 | 9분 29초 | 41분 35초 |
| 5회 | x32 | 2.4억 | 13분 38초 | 55분 14초 |

1~3회차가 첫 판보다 빠른 건 구매 가격이 고정이라 배수가 오르면 재구매가 금방
끝나기 때문이다. 4회차부터 다시 길어진다. 환생 가격 증가율(`PriceGrowth`)을
2.6 / 3.0 / 3.5 로 놓고 비교해서 3.0 을 골랐다 — 2.6 은 5~7분에서 더 이상
늘지 않아 밋밋하고, 3.5 는 5회차가 29분까지 뛴다.

## 구조

```
src/shared/     Config  Format  Net          (ReplicatedStorage)
src/server/     init.server + 6개 모듈        (ServerScriptService)
src/client/     init.client + Hud            (StarterPlayerScripts)
```

| 모듈 | 하는 일 |
| --- | --- |
| `Config` | 가격·수입·좌표·색. 밸런스는 전부 여기서만 고친다 |
| `Build` | 파트/빌보드/표지판 만드는 잡일 |
| `World` | 지면, 조명, 로비 |
| `Plot` | 공장 한 칸. 바닥·벨트·금고는 서버 시작 시, 드로퍼와 장식은 산 대로 |
| `PlotService` | 6칸 배치, 한 사람 한 칸 |
| `Economy` | 돈·환생·배수. 플레이어 프로필의 유일한 주인 |
| `Data` | DataStore 읽기/쓰기, 재시도, 값 검증 |

서버가 전부 판정한다. 클라이언트가 서버로 보낼 수 있는 건 환생 확인
(`RebirthConfirm`) 하나뿐이고, 그것도 서버에서 조건을 다시 본다. 구매는
패드의 `Touched` 로만 일어난다.

HUD 는 RemoteEvent 로 밀지 않고 `leaderstats` 와 Player attribute 를 읽는다.
attribute 는 알아서 복제되고 중간에 들어온 클라이언트도 최신값을 받는다.

## 만들면서 걸린 것

| 증상 | 원인 | 대응 |
| --- | --- | --- |
| 공장을 차지할 수 없음 | `claimPad` 를 만들어 놓고 `Touched` 를 연결하지 않았다. 타입 검사는 통과한다 | 헤드리스 시나리오에서 클레임 패드를 밟아보고 나서야 드러났다 |
| 1번 드로퍼가 벨트를 안 탐 | 드로퍼 슬롯 x=26 이 금고 흡입구(x=21.5~30.5) 안이라 생성 즉시 먹혔다 | 벨트를 늘리고 슬롯을 16/6/-4/-14/-24/-34 로 재배치 |
| 환생 패드와 클레임 패드가 겹침 | z=26(14칸)과 z=40(16칸)이 z=32~33 에서 물렸다 | 클레임 패드를 12칸으로 |

### 컨베이어를 물리에 맡기지 않았다

고정 파트의 `AssemblyLinearVelocity` 를 컨베이어 표면 속도로 쓰는 방식은
엔진 버전을 타고, 안 먹히면 돈이 벨트 위에 그대로 쌓여서 게임이 멈춘다.
여기서는 낙하물마다 `LinearVelocity` 를 `Line` 모드로 달아 **x축 속도만**
직접 고정한다. y(중력)와 z 는 그대로 두므로 떨어지는 모양은 같고, 금고까지는
반드시 간다. 벨트의 `AssemblyLinearVelocity` 도 같이 걸어두지만 그건 보조다.

그래도 끼거나 맵 밖으로 떨어지는 낙하물이 있을 수 있어서, 15초가 지난 것은
`sweepDrops` 가 회수해서 **정산해준다**. 물리가 어긋났다고 플레이어 돈이
사라지지는 않게 했다.

### 불러오기에 실패하면 저장하지 않는다

DataStore 읽기가 3번 다 실패했는데 기본값으로 진행하고 그대로 저장하면 남의
진행도를 통째로 날린다. `Data.load` 는 성공 여부를 같이 반환하고, 실패한
세션은 `persist = false` 로 표시돼 저장 경로 전체가 막힌다. HUD 에도
"이 세션은 저장이 꺼져 있다" 가 뜬다.

## 검증

Studio 없이 돌릴 수 있는 것만 자동화했다.

```bash
python3 tools/test.py          # 서버 코드를 실제로 실행 (시나리오 2개)
python3 tools/balance.py       # 진행 속도 계산
python3 tools/checkprops.py    # 속성 가방 키 이름 검사
```

`tools/test.py` 는 Roblox API 를 흉내낸 스텁(`tools/sim/stub.luau`)과 협조적
스케줄러(`tools/sim/sched.luau`) 위에 `src/server` 를 통째로 올린다.
`task.wait(n)` 을 `coroutine.yield(n)` 으로 바꾸고 가상 시계를 돌리기 때문에
120초 자동 저장이 0.1초마다 도는 일 없이 시간 간격이 그대로 지켜진다.

시나리오가 보는 것:

- 월드 생성, Studio 기본 Baseplate 제거
- 클레임 → 기본 드로퍼 → 수입(10초에 50원) → 구매 사슬 11단계 → 환생 → 수입 2배
- 배치: 밟는 패드 12개가 서로 안 겹치는지, 구조물이 바닥 밖으로 안 나가는지,
  드로퍼가 전부 벨트 위인지, 1번 드로퍼가 흡입구 밖인지
- 퇴장 시 철거·루프 종료, 다른 사람이 같은 칸을 다시 차지, 한 사람 한 칸
- 저장/복원 왕복, 깨진 저장값(문자열 돈, 음수 환생, 모르는 아이템) 거르기
- 읽기 실패 시 덮어쓰기 거부, 저장소가 살아나면 원래 값 복구
- 끼인 낙하물 자동 정산

타입 검사는 실제 Roblox API 정의로 한다.

```bash
rojo sourcemap default.project.json --output sourcemap.json
luau-lsp analyze --definitions=globalTypes.d.luau --sourcemap=sourcemap.json \
  --base-luaurc=.luaurc src/shared src/server src/client
```

`globalTypes.d.luau` 는 [luau-lsp 저장소](https://github.com/JohnnyMorganz/luau-lsp/blob/main/scripts/globalTypes.d.luau)
에 있다. `Build.part` 같은 속성 가방을 `{ [string]: any }` 로 두면 오타가
런타임까지 살아남으므로 실제 쓰는 키만 타입으로 선언해 뒀다. 값 타입과 Enum
이름은 이걸로 잡히지만, **선언에 없는 키가 하나 더 들어가는 건 Luau 가 통과
시킨다.** 그건 `tools/checkprops.py` 가 본다.

### 검증하지 못한 것

`tools/test.py` 에는 물리 엔진이 없다. 낙하물을 금고에 넣는 것도 시나리오가
직접 한다. 그래서 아래는 **Studio 에서 직접 봐야 한다.**

- 컨베이어와 충돌 — 낙하물이 실제로 벨트를 타고 금고까지 가는지
- `LinearVelocity` 의 `Line` 모드가 의도대로 x축만 고정하는지
- 렌더링, 네트워크 복제, 실제 DataStore 처리량 제한
- 여러 명이 동시에 붙었을 때의 성능

벨트 부하는 계산상 플롯당 평균 7~15개(상한 90)라 상한에 닿지 않는다.
6칸이 다 차도 동시 낙하물은 50~90개 수준이다.

## 라이선스

개인 프로젝트.
