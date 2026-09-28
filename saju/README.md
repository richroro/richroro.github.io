# 만세력 사주

생년월일시로 사주 원국(년·월·일·시주)을 세우고 오행·십성·지장간·12운성·신강약·용신·신살·합충·대운·세운과
성향·연애·이직·재물 리포트를 보여 주는 한 페이지 서비스. 서버 없이 브라우저에서만 계산한다.

| 파일 | 역할 |
| --- | --- |
| `manseryeok.js` | 만세력 엔진. 태양 황경(VSOP87 절단판)·합삭(Meeus 49장)을 직접 계산해 절기·음력·간지를 낸다. 한국 표준시 변천·서머타임·경도/균시차 보정, 야자시 옵션, 대운 |
| `interpret.js` | 분석과 리포트 문장 조립 |
| `app.js` | 화면 |
| `tw.css` | Tailwind 로 빌드한 스타일(커밋된 결과물) |

## 정확도

- 절기 시각: 1901–2099년 전 구간에서 참조 구현(lunar-javascript)과 1분 안, 2024–2026 입춘은 천문연 발표와 분 단위 일치
- 음력: 1900–2050년 매일을 korean-lunar-calendar(천문연 자료)와 대조해 불일치 0
- 네 기둥·대운: 무작위 약 2만 건을 lunar-javascript 八字와 대조해 불일치 0(같은 기준 시각·자시 규칙일 때)

## 개발

```sh
node --test saju/tests/engine.test.js   # 테스트
cd saju && npx tailwindcss@3 -c tailwind.config.js -i tailwind.src.css -o tw.css --minify   # 클래스를 바꿨을 때
```

URL 쿼리로 입력을 공유한다: `?g=F&c=solar&d=19900515&t=1030&p=0&tm=longitude&js=split`
(`c`: solar·lunar·leap, `t`: HHMM 또는 x, `p`: 도시 번호 또는 x, `tm`: longitude·solar·none, `js`: split·yajasi)
