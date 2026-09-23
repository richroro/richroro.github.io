# 업로드 목록

주제 34개. 각 폴더의 `upload.md`에 제목·설명·태그가 있다.
영상은 `shorts-quiet.mp4`, 썸네일 후보는 `poster-quiet.png`.
테마는 밝은 세 가지(`paper`·`mint`·`press`)만 쓴다.

폴더에는 `poster-quiet.png`·`shorts-quiet.mp4`·`upload.md` 세 가지만 둔다.
`--fit`과 `--tall`은 도구에 남아 있지만 그 결과물은 커밋하지 않는다.
`0002`~`0006`은 순위표가 아니라 손글씨풍 카드뉴스라 구성이 다르다.

`CONTACT.png`는 34장을 한 장에 모은 명세서다. 한 장씩 보면 안 보이는 것이
거기서 보인다.

| 폴더 | 제목 | 테마 |
|---|---|---|
| `0007-100m` | 매달 50만원 모으면 1억까지 몇 년? | paper |
| `0008-apt` | 전국에서 가장 비싼 아파트 1위, 325억 | press |
| `0009-minwage` | 10년 전 최저시급, 기억하세요? | press |
| `0010-kbo` | 프로야구 구단 평균 연봉 1위는? | paper |
| `0011-salary` | 상반기에만 1억 8천만원 받는 회사 | mint |
| `0012-seoul-pyeong` | 서울에서 평당 9천만원 넘는 동네 | paper |
| `0013-loan` | 1억 빌리면 매달 얼마 갚을까 | mint |
| `0014-double` | 내 돈이 2배 되는 데 몇 년 걸릴까 | mint |
| `0015-one-pyeong` | 최저임금으로 서울 한 평 사려면 | press |
| `0016-hourly` | 연봉 5천만원이면 시급 얼마일까 | mint |
| `0017-coffee` | 커피값 아끼면 30년 뒤 얼마 될까 | paper |
| `0018-lotto` | 로또 1등 되려면 몇 년을 사야 할까 | press |
| `0019-billionaires` | 세계 1위 부자 재산, 1,204조원 | paper |
| `0020-tesla` | 테슬라는 한 분기에 몇 대나 팔까 | mint |
| `0021-inflation` | 지금 1억, 20년 뒤엔 5,537만원 | press |
| `0022-savings` | 적금 이자가 예금의 절반인 이유 | mint |
| `0023-debt` | 빚 1,000만원, 매달 10만원씩 갚으면 | paper |
| `0024-trillion` | 1조원을 하루 100만원씩 쓰면 2,738년 | press |
| `0025-fx` | 환율 100원 오르면 얼마나 손해일까 | mint |
| `0026-installment` | 120만원 24개월 할부, 수수료가 19만 6천원 | paper |
| `0027-saverate` | 월급 300만원, 저축률별 1년에 모이는 돈 | mint |
| `0028-compound` | 복리와 단리, 30년 뒤 1,822만원 차이 | press |
| `0029-real` | 이자 3%, 물가 3%면 남는 게 0입니다 | mint |
| `0030-homeprice` | 집값 1% 상승, 3억 집과 30억 집의 차이 | paper |
| `0031-lotto-tax` | 로또 20억 당첨, 실제로 받는 건 13억 | paper |
| `0032-insurance` | 연봉 5,000만원, 4대보험으로 매달 40만원 | mint |
| `0033-buycost` | 10억 집 살 때 집값 말고 3,800만원 더 든다 | press |
| `0034-severance` | 연봉 5,000만원 10년 다니면 퇴직금 4,167만원 | paper |
| `0035-lifetime` | 연봉 5,000만원, 평생 버는 돈은 15억 | press |
| `0036-pir` | 연봉 5,000만원으로 서울 아파트, 35년에서 63년 | press |
| `0037-hundred` | 월 얼마 모으면 1억이 될까, 저축액별 기간 | mint |
| `0038-taxfree` | 1,000만원 예금 이자, 세금 떼면 25만원 | paper |
| `0039-retire` | 은퇴 후 30년, 월 250만원 쓰면 9억 필요 | press |
| `0040-overtime` | 연봉별 야근수당, 한 시간에 얼마일까 | paper |

## 다시 만들려면

```bash
node cards/tools/make.mjs cards/tools/content/<슬러그>.json   # 포스터·영상·업로드 시트
node cards/tools/check.mjs <슬러그>
```

제목과 태그는 콘텐츠 JSON의 `youtube` 항목에 있다. 카드의 숫자를 고치면
제목도 같이 고쳐야 한다. `factcheck.py`가 어긋난 것을 잡아준다.

설명에는 카드 하단 고지 네 줄이 그대로 들어간다. 출처와 계산 가정이
영상 밖에도 남아야 하기 때문이다.

전부 다시 만들 때는 `for f in cards/tools/content/0*.json; do node cards/tools/make.mjs "$f"; done`
뒤에 `node cards/tools/contact.mjs`와 `node cards/tools/check.mjs`를 돌린다.
