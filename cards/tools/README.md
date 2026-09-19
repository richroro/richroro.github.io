# 카드뉴스 렌더러

콘텐츠 JSON 한 장으로 1080×1350 카드 이미지를 만든다.

```bash
node cards/tools/render.mjs cards/tools/content/0006-younger-me.json
# -> cards/0006-younger-me/01_cover.png ... 12_outro.png
```

출력 경로는 JSON의 `slug`를 따른다. 두 번째 인자로 다른 폴더를 넘기면
커밋 전에 미리보기만 뽑아볼 수 있다.

## 준비물

- Node 18+ 와 `playwright` (프로젝트 또는 전역 설치 둘 다 인식한다)
- `pngquant` (선택). 있으면 카드 한 장을 90KB 안팎으로 줄인다.

손글씨 폰트(Gaegu)와 본문 폰트(Noto Sans KR)는 첫 실행 때 Google Fonts에서
`cards/tools/.fonts/`로 내려받는다. 이 폴더는 커밋하지 않는다.

## 콘텐츠 JSON

`lists` 항목 하나가 카드 한 장이다. 제목 길이에 따라 글자 크기가 자동으로
한 단계씩 줄어들기 때문에, 제목은 20자 안쪽으로 쓰는 편이 안전하다.

```json
{
  "slug": "0006-younger-me",
  "brand": "삶의 문장 노트",
  "cover": { "eyebrow": "...", "title": ["1행", "2행"], "sub": ["1행", "2행"],
             "footL": "...", "footR": "..." },
  "lists": [
    { "title": "제목", "items": ["1", "2", "3"], "note": "아래 작은 글씨" }
  ],
  "outro": { "title": ["1행", "2행"], "sub": ["1행", "2행"], "button": "..." }
}
```

## 쇼츠

같은 콘텐츠 JSON으로 유튜브 쇼츠용 영상을 만든다.

```bash
node cards/tools/shorts.mjs cards/tools/content/0006-younger-me.json
# -> cards/0006-younger-me/shorts.mp4  (1080x1920, 30fps, H.264 + AAC)
```

카드를 9:16으로 다시 뽑아서 한 장씩 옆으로 밀어 넘기고(xfade slideleft),
직접 합성한 잔잔한 BGM을 깔아 인코딩한다. 체류 시간은 `shorts.mjs` 위쪽의
`COVER`/`LIST`/`OUTRO`/`SLIDE` 상수로 조절한다.

9:16 프레임은 1080×1350 카드를 그대로 가운데에 놓고 배경만 위아래로 늘린
형태다. 유튜브 UI가 위아래를 가리기 때문에 글자는 안전 영역 안에 머무르고,
페이지 번호(오른쪽 버튼에 가린다)는 이 모드에서만 숨긴다.

- `ffmpeg` (libx264 + aac) 필요. 우분투는 `apt-get install ffmpeg`.
- BGM은 `bgm.py`가 numpy로 그때그때 합성한다(`pip install numpy`).
  느린 피아노 발라드로, C–G/B–Am–Am/G–F–C/E–Dm7–G 하행 베이스 진행에
  8분음표 분산화음 반주와 성긴 멜로디를 얹었다. 템포는 영상 길이에 맞춰
  56~74 BPM 사이에서 정해지고, 마스터는 약 -20 LUFS다.

  샘플도 학습된 모델도 쓰지 않고 파형부터 합성한다. AI 음악 모델을 쓰지
  않은 이유는 라이선스다 — MusicGen 가중치는 CC-BY-NC라 수익화 채널에
  쓸 수 없다. 직접 합성한 소리는 그런 제약이 없다.

  피아노 음색은 현의 강성 때문에 배음이 정수배보다 높게 뜨는 성질
  (`stiffness`)과, 높은 배음이 먼저 사라지는 감쇠 차이를 흉내 낸 것이다.
  이 둘이 없으면 그냥 오실레이터 소리가 난다. 잔향은 감쇠하는 노이즈와의
  컨볼루션이다. 지연 탭 몇 개로 대신하면 피아노에서는 잔향이 아니라
  또렷한 메아리로 들린다.

## 정보형 인포그래픽 (세로로 긴 한 장)

```bash
node cards/tools/infographic.mjs cards/tools/content/0007-100m.json
# -> cards/0007-100m/poster.png  (1080 × 높이 자동)
```

헤더(스티커 + 제목 + 부제) / 행 목록 / 하단 고지 구조다. 행마다 왼쪽 썸네일
슬롯이 있는데, `image`에 로컬 경로를 주면 사진이 들어가고 없으면 순번이
들어간다. **사진 없이도 성립하도록** 만든 것이라, 확보한 이미지가 생기면
그때 경로만 넣으면 된다.

제목은 첫 줄을 Gothic A1 ExtraBold, 둘째 줄을 Black Han Sans로 쓴다.
Black Han Sans는 획이 굵어서 두 줄 다 쓰면 속공간이 메워져 뭉개진다.
강조할 한 줄에만 쓰는 편이 읽힌다.

### 숫자를 다룰 때

`0007-100m.json`의 기간 값은 적립식 복리 공식으로 계산한 뒤
월별 적립 시뮬레이션으로 교차 검증한 것이다(월 50만원 → 154개월,
그 시점 잔고 100,413,855원). 손으로 적은 값이 아니다.

수치가 들어가는 콘텐츠는 하단 고지(`note`)에 **계산 전제**를 반드시 적는다.
위 카드의 경우 목표 금액, 이율과 복리 주기, 빠뜨린 것(세금·수수료·물가)이다.
전제를 숨긴 숫자는 틀린 숫자와 같다.

## 스크롤 쇼츠 (한 장짜리)

긴 포스터 한 장을 세로로 훑는 방식. 장면 전환이 없다.

```bash
node cards/tools/infographic.mjs cards/tools/content/0008-apt.json --tall
node cards/tools/scrollshorts.mjs cards/tools/content/0008-apt.json --dur=30 --style=drive
# -> cards/0008-apt/shorts.mp4
```

`--tall`은 행을 가로 4열이 아니라 세로로 쌓아 글자를 키운다. 기본 포스터는
1080×2512라 1920 프레임보다 조금 큰 정도여서 훑을 거리가 600px밖에 안 나오고,
글자도 폰에서 작다. `--tall`은 4716px이 되어 2796px을 훑는다.

양 끝에서 1.6초씩 멈췄다가 움직인다. 헤더와 하단 고지를 읽을 틈이다.

## BGM 두 가지

```bash
python3 cards/tools/bgm.py out.wav 30 drive    # 순위·카운트다운용
python3 cards/tools/bgm.py out.wav 45 ballad   # 잔잔한 카드용(기본)
```

`drive`는 104 BPM에 킥·하이햇·베이스·분산화음을 얹고, 마디가 지나면서 악기를
하나씩 더한다(2마디 킥, 3마디 베이스, 5마디 하이햇). 처음부터 다 깔면 밋밋해진다.

## 사진 넣기

행에 `image`(로컬 경로)와 `credit`을 주면 썸네일이 사진으로 바뀌고 하단에
출처가 붙는다. png·jpg·webp·gif를 받는다.

```json
{ "rank": 1, "label": "에테르노청담",
  "image": "cards/0008-apt/img/eterno.jpg",
  "credit": "촬영자 이름 / CC BY-SA 4.0" }
```

`credit`은 장식이 아니다. CC BY·CC BY-SA는 저작자 표시가 이용 조건이라,
빠뜨리면 라이선스 위반이다. 그래서 데이터에서 자동으로 뽑아 찍는다.
표기에는 저작자, 라이선스 이름, 원본 파일 URL, 잘라 썼다면 그 사실까지 적는다.

### CC BY-SA를 쓸 때 자르지 말 것

CC는 **이미지 자르기를 2차적 저작(adaptation)으로 본다.** CC BY-SA 사진을
잘라서 넣으면 결과물 전체에 동일조건변경허락이 따라붙어서, 만든 영상도
CC BY-SA로 배포해야 한다. 원본 그대로 넣으면 '모음(collection)'이라
그 의무가 생기지 않는다.

그래서 행에 `"fit": "contain"`을 주면 사진을 자르지 않고 통째로 넣는다.
CC BY-SA 사진은 이 옵션을 쓰거나, 아예 CC0·퍼블릭 도메인·CC BY 파일을
고르는 편이 낫다. 그쪽은 동일조건변경허락 자체가 없다.

**저작권 있는 사진에 필터를 씌워 그림처럼 만드는 것은 해결책이 아니다.**
그렇게 만든 결과물은 2차적저작물이고, 2차적저작물 작성권은 원저작자에게 있다.
사진의 보호 대상은 픽셀이 아니라 구도·각도·빛 같은 촬영자의 선택인데,
필터는 그걸 지우지 못한다. 쓰려면 애초에 이용이 허락된 사진이어야 한다.

## 붙여넣은 표로 만들기

순위 데이터를 직접 구해왔을 때, 표를 그대로 넣으면 콘텐츠 JSON이 된다.

```bash
cat > /tmp/t.txt <<'T'
삼성전자	1,234조원	반도체
SK하이닉스	987조원	반도체
T
node cards/tools/from-table.mjs /tmp/t.txt 0019-marketcap "시가총액 상위 | 10개 기업" \
  > cards/tools/content/0019-marketcap.json
node cards/tools/make.mjs cards/tools/content/0019-marketcap.json --dur=30 --style=drive
```

한 줄은 `이름 <탭> 값 [<탭> 보조설명]`이다. 값의 앞쪽 숫자로 막대 길이를 잡고,
표시는 적어준 문자열 그대로 나간다. 단위와 자릿수를 직접 통제할 수 있다.

만들고 나면 `subtitle`과 `note`의 **기준일과 출처를 반드시 채운다.**
시가총액·시세처럼 매일 바뀌는 값은 기준일이 없으면 틀린 숫자가 된다.

## 한 화면에 다 보이는 쇼츠 (--fit)

스크롤도 전환도 없이, 1080×1920 한 프레임에 전부 담는다.

```bash
node cards/tools/infographic.mjs cards/tools/content/0008-apt.json --fit
node cards/tools/scrollshorts.mjs cards/tools/content/0008-apt.json --fit \
  --dur=20 --style=drive --out=shorts-fit.mp4
```

`--fit`은 행을 한 줄로 압축한다. 왼쪽에 작은 아이콘과 순위, 가운데 이름과
부연, 오른쪽에 값. 10행이 여백까지 포함해 1920px에 들어간다.

세 가지 레이아웃의 쓰임이 다르다.

| 모드 | 크기 | 용도 |
|---|---|---|
| 기본 | 1080×2500 안팎 | 블로그·카톡용 가로 4열 |
| `--tall` | 1080×4700 안팎 | 스크롤 쇼츠. 글자가 크다 |
| `--fit` | 1080×1920 고정 | 한눈에 보는 정지 쇼츠 |

포스터가 프레임보다 크지 않으면 `scrollshorts.mjs`가 스크롤을 생략하고
정지 화면으로 인코딩한다. 별도 플래그가 필요 없다.

`--fit`에서는 상단 칼럼 머리말을 빼는데, 값이 오른쪽 한 칼럼에 세로로
쌓이기 때문에 2열 머리말이 아래 내용과 맞지 않아서다.

## 테마

같은 콘텐츠를 네 가지 톤으로 뽑는다. 콘텐츠 JSON에 `"theme"`을 적거나
`--theme=`로 덮어쓴다.

| 테마 | 톤 | 어울리는 주제 |
|---|---|---|
| `paper` | 따뜻한 크림 + 빨강, 손글씨 | 가볍고 친근한 것. 스포츠, 습관 |
| `noir` | 짙은 차콜 + 금색 | 부동산, 고액, 순위 |
| `mint` | 밝은 화이트 + 초록 | 금리, 계산, 금융 |
| `press` | 미색 + 명조체 + 진홍 | 통계, 공공 자료 |
| `neon` | 짙은 보라 + 시안·마젠타, 발광 | 확률, IT, 자극적인 숫자 |

```bash
node cards/tools/infographic.mjs cards/tools/content/0008-apt.json --fit --theme=noir
```

색과 서체는 전부 `THEMES` 객체의 토큰으로만 정의한다. 레이아웃 쪽에는
색상 리터럴이 남아 있지 않아서, 테마를 하나 더 만들 때 CSS를 건드릴 일이 없다.
아이콘 창(`slotBg`)은 SVG 안에서도 쓰이므로 토큰이 SVG 생성기까지 전달된다.

`neon`만 발광을 쓴다. `glow`(강조 글자의 text-shadow)와 `slotGlow`(아이콘 창의
box-shadow) 두 토큰이고, 나머지 테마는 `'none'`으로 꺼둔다.

테마를 새로 만들 때 확인할 것: **순위 배지가 아이콘 창 위에서 읽히는지.**
`noir`는 처음에 금색 배지를 금색 창 위에 올려서 숫자가 사라졌다.
지금은 배지를 어둡게 뒤집어 놓았다.
