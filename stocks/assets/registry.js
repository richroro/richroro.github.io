"use strict";
/* =========================================================================
   종목 레지스트리 — 허브와 각 종목 페이지가 같이 읽습니다.
   data 가 있는 곳만 스크리너 표에 나옵니다(검증된 수치만 싣는다는 원칙).
   om(영업이익률)·nm(순이익률)·topShare(최대 부문 비중)·업력은
   하드코딩하지 않고 읽는 쪽에서 계산합니다.

   data : 회계연도 실적 (단위 10억, cur 없으면 달러)
     fy 회계연도 표기 · growth 전년 대비 매출 증감(%) · gm 총마진(%)
     rev 매출 · oi 영업이익 · ni 순이익 · emp 임직원 · top 최대 부문
   p    : 회사 프로필 (자주 바뀌지 않는 값만)
     est 설립연도 · hq 본사 · ex 주거래소 · ex2 2차 상장(ADR) · ceo/ceoEn CEO · since 취임연도
     fye 회계연도 종료 · div 배당 지급 여부
   f    : 앞으로 (회사가 직접 공시·발표한 숫자만. 애널리스트 추정치는 싣지 않는다)
     items[] = { k 항목 · v 표시값 · u 단위 · p 기준 시점 · s 보조 설명
                 t 종류(guide 가이던스 / backlog 수주잔고 / capex 자본지출 /
                        capacity 생산능력 / none 미공개)
                 n 숫자(있을 때만) · rel "total" 이면 연매출 대비 배수를 계산해 붙인다 }
   ========================================================================= */
const REGISTRY = [
  /* ---- M7 (별도 폴더) ---- */
  { slug:"nvda", kr:"공급", tk:"NVDA", ko:"엔비디아", ab:"NV", c:"#3987e5", group:"m7", base:"/m7/",
    sector:"반도체", hint:"데이터센터가 매출의 92%",
    p:{ est:1993, hq:"미국 캘리포니아 산타클라라", ex:"나스닥", ceo:"젠슨 황", ceoEn:"Jensen Huang",
        since:1993, fye:"1월 마지막 일요일", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"다음 분기 매출 가이던스", v:"108", u:"B$", p:"FY2027 3분기", t:"guide",
        s:"회사 제시 ±2% · 분기 1,000억 달러를 처음 넘긴다" },
      { k:"FY2028 매출 성장 전망", v:"약 +70", u:"%", p:"FY2028", t:"guide",
        s:"창사 이래 첫 연간 전망 · 회사는 수요가 아니라 공급이 제약이라고 밝혔다" },
      { k:"공급 약정", v:"581", u:"B$", p:"2026년 7월 말", t:"backlog",
        s:"부품·전력·리스를 미리 묶어 둔 금액 · 매출 약속이 아니라 지출 약속이다" }
    ] },
    data:{ fy:"FY2026", growth:65.0, gm:71.1, emp:42000, empAsOf:"2026년", rev:215.9, oi:130.387, ni:120.067, top:{k:"데이터센터", v:75.0, of:81.6} } },
  { slug:"aapl", kr:"공급", tk:"AAPL", ko:"애플", ab:"AA", c:"#6E7683", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"아이폰 절반, 이익은 서비스",
    p:{ est:1976, hq:"미국 캘리포니아 쿠퍼티노", ex:"나스닥", ceo:"존 터너스", ceoEn:"John Ternus",
        since:2026, sinceNote:"2026년 9월 1일 취임 · 팀 쿡은 이사회 의장(Executive Chair)으로", fye:"9월 마지막 토요일", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"매출 가이던스", v:"미공개", u:"", p:"2020년 이후", t:"none",
        s:"애플은 구체적 수치 가이던스를 주지 않는다 — 실적 발표에서 방향만 말한다" }
    ] },
    data:{ fy:"FY2025", growth:6.0, gm:46.9, emp:166000, empAsOf:"2026년", rev:416.161, oi:133.05, ni:112.01, top:{k:"아이폰", v:209.59, of:416.161} } },
  { slug:"msft", kr:"간접", tk:"MSFT", ko:"마이크로소프트", ab:"MS", c:"#1baf7a", group:"m7", base:"/m7/",
    sector:"소프트웨어", hint:"Azure 1,000억 달러 돌파",
    p:{ est:1975, hq:"미국 워싱턴 레드먼드", ex:"나스닥", ceo:"사티아 나델라", ceoEn:"Satya Nadella",
        since:2014, fye:"6월 30일", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"상업 부문 계약 잔고(RPO)", v:"678", u:"B$", p:"FY2026 4분기 말", n:678, rel:"total", t:"backlog",
        s:"계약은 했지만 아직 매출로 안 잡힌 금액 · +84% · 가중평균 2.3년" },
      { k:"1년 내 매출로 잡히는 몫", v:"약 30", u:"%", p:"RPO 678B$ 중", t:"backlog",
        s:"회사 제시 · 나머지는 1년 뒤로 · 오픈AI를 빼도 RPO는 +25%" },
      { k:"FY2027 자본지출 계획", v:"255~260", u:"B$", p:"FY2027", t:"capex",
        s:"FY2026 AI 인프라 지출 115.9B$의 두 배 이상" }
    ] },
    data:{ fy:"FY2026", growth:18.0, gm:68.0, emp:228000, empAsOf:"2026년", rev:331.839, oi:155.2, ni:133.7, top:{k:"생산성·비즈니스", v:139.996, of:331.839} } },
  { slug:"googl", kr:"간접", tk:"GOOGL", ko:"알파벳", ab:"GO", c:"#eb6834", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"광고가 버는 돈으로 다 한다",
    p:{ est:1998, estNote:"구글 설립 1998년 · 지주회사 알파벳 전환 2015년", hq:"미국 캘리포니아 마운틴뷰",
        ex:"나스닥", ceo:"순다르 피차이", ceoEn:"Sundar Pichai", since:2019,
        sinceNote:"구글 CEO 2015년 · 알파벳 CEO 2019년", fye:"12월 31일", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"클라우드 수주잔고", v:"514", u:"B$", p:"2026년 2분기 말", t:"backlog",
        s:"분기 만에 +50B$ 이상 · 절반 남짓이 24개월 안에 매출로" },
      { k:"2026 자본지출 계획", v:"195~205", u:"B$", p:"2026년", t:"capex",
        s:"2월 180~190B$에서 상향 · 2027년에도 크게 늘린다고 밝혔다" }
    ] },
    data:{ fy:"2025", growth:15.0, gm:59.6, emp:198933, empAsOf:"2026년 6월", rev:402.8, oi:129.039, ni:132.2, top:{k:"구글 서비스", v:342.721, of:402.8} } },
  { slug:"amzn", kr:"간접", tk:"AMZN", ko:"아마존", ab:"AM", c:"#c98500", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"매출 18%가 이익 57%",
    p:{ est:1994, hq:"미국 워싱턴 시애틀", ex:"나스닥", ceo:"앤디 재시", ceoEn:"Andy Jassy",
        since:2021, fye:"12월 31일", div:false },
    f:{ asOf:"2026년 9월", items:[
      { k:"AWS 수주잔고", v:"496", u:"B$", p:"2026년 6월 말", t:"backlog",
        s:"한 분기에 +132B$ · AWS 계약분만이고 전사 기준이 아니다" },
      { k:"2026 자본지출 계획", v:"220", u:"B$", p:"2026년", t:"capex",
        s:"2025년 125B$에서 76% 증가 · 거의 전부 AWS 데이터센터와 자체 칩" }
    ] },
    data:{ fy:"2025", growth:12.0, gm:50.3, emp:1576000, empAsOf:"2025년 말", rev:716.9, oi:80.0, ni:77.7, top:{k:"북미", v:426.3, of:716.9} } },
  { slug:"meta", kr:"간접", tk:"META", ko:"메타", ab:"ME", c:"#4a3aa7", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"광고 이익의 19%를 태운다",
    p:{ est:2004, hq:"미국 캘리포니아 멘로파크", ex:"나스닥", ceo:"마크 저커버그", ceoEn:"Mark Zuckerberg",
        since:2004, fye:"12월 31일", div:true, divNote:"2024년 첫 배당 개시" },
    f:{ asOf:"2026년 9월", items:[
      { k:"2026 자본지출 계획", v:"130~145", u:"B$", p:"2026년", t:"capex",
        s:"연초 125~145B$에서 하단을 올렸다 · 잉여현금흐름이 거의 0까지 눌렸다" }
    ] },
    data:{ fy:"2025", growth:22.0, gm:82.0, emp:75472, empAsOf:"2026년 2분기", rev:200.97, oi:83.28, ni:60.5, top:{k:"패밀리 오브 앱스", v:198.76, of:200.97} } },
  { slug:"tesla", kr:"공급", tk:"TSLA", ko:"테슬라", ab:"TS", c:"#E82127", group:"m7", href:"/tesla-metrics/",
    sector:"자동차", hint:"매출 최대, 최근 분기 이익률 1.4%",
    p:{ est:2003, hq:"미국 텍사스 오스틴", ex:"나스닥", ceo:"일론 머스크", ceoEn:"Elon Musk",
        since:2008, fye:"12월 31일", div:false },
    f:{ asOf:"2026년 9월", items:[
      { k:"2026 자본지출 계획", v:"25 이상", u:"B$", p:"2026년", t:"capex",
        s:"2025년 8.5B$의 세 배 — 차·로봇·에너지·배터리 라인을 동시에 깐다" },
      { k:"사이버캡 생산능력", v:"12.5만", u:"대/년", p:"기가 텍사스", t:"capacity",
        s:"2026년 2분기 생산 시작 · 설치 능력이지 실제 생산량이 아니다" },
      { k:"옵티머스 3 생산", v:"2026 하반기", u:"", p:"프리몬트", t:"capacity",
        s:"회사 목표 · 한 번 미뤄졌고 양산 시점은 아직 확정이 아니다" }
    ] },
    data:{ fy:"2025", growth:-3.0, gm:18.0, emp:134785, empAsOf:"2025년 말", rev:94.83, oi:4.35, ni:3.79, top:{k:"자동차", v:69.52, of:94.83} } },

  /* ---- 반도체·AI 인프라 ---- */
  { slug:"avgo", kr:"간접", tk:"AVGO", ko:"브로드컴", ab:"BR", c:"#C81E3A", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"반도체 58% · 소프트웨어 42%",
    p:{ est:1961, estNote:"HP 반도체 부문에서 출발 · 아바고를 거쳐 2018년 브로드컴 Inc.", hq:"미국 캘리포니아 팰로앨토",
        ex:"나스닥", ceo:"혹 탄", ceoEn:"Hock Tan", since:2006, fye:"11월 초(52/53주)", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"FY2026 AI 반도체 매출 가이던스", v:"약 56", u:"B$", p:"FY2026", t:"guide",
        s:"FY2025 대비 약 +180% · 전사가 아니라 AI 반도체만" },
      { k:"AI 수주잔고", v:"73", u:"B$", p:"FY2026 2분기", t:"backlog",
        s:"회사는 18개월에 걸쳐 인도한다고 밝혔다 · AI 부문만" }
    ] },
    data:{ fy:"FY2025", growth:23.9, gm:78.6, emp:33000, empAsOf:"2025년 11월", rev:63.887, oi:null, ni:23.126, top:{k:"반도체 솔루션", v:36.858, of:63.887} } },
  { slug:"amd", kr:"공급", tk:"AMD", ko:"AMD", ab:"AD", c:"#eb6834", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"엔비디아와 같은 시장, 이익률 6분의 1",
    p:{ est:1969, hq:"미국 캘리포니아 산타클라라", ex:"나스닥", ceo:"리사 수", ceoEn:"Lisa Su",
        since:2014, fye:"12월 말(52/53주)", div:false },
    f:{ asOf:"2026년 9월", items:[
      { k:"2027 데이터센터 매출", v:"2배 이상", u:"", p:"2027년", t:"guide",
        s:"회사 표현은 \"well over 100%\" · 금액 가이던스는 아니다" },
      { k:"오픈AI 공급 계약", v:"6", u:"GW", p:"2026년 하반기 시작", t:"backlog",
        s:"첫 1GW가 2026년 하반기 · 금액은 공시하지 않았다" }
    ] },
    data:{ fy:"2025", growth:34.3, gm:50.0, emp:31000, empAsOf:"FY2025", rev:34.6, oi:3.7, ni:4.3, top:{k:"데이터센터", v:16.6, of:34.6} } },
  { slug:"mu", kr:"경쟁", tk:"MU", ko:"마이크론", ab:"MU", c:"#1baf7a", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"한 분기가 작년 한 해보다 크다",
    p:{ est:1978, hq:"미국 아이다호 보이시", ex:"나스닥", ceo:"산제이 메로트라", ceoEn:"Sanjay Mehrotra",
        since:2017, fye:"8월 말~9월 초", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"HBM 생산분", v:"2027년치까지 완판", u:"", p:"2026~2027년", t:"backlog",
        s:"만들 수 있는 물량이 이미 다 팔렸다 — 가격보다 생산능력이 매출을 정한다" },
      { k:"FY2026 자본지출", v:"25 이상", u:"B$", p:"FY2026", t:"capex",
        s:"FY2027에는 건설비만 +10B$ 이상 더 든다고 밝혔다" }
    ] },
    data:{ fy:"FY2025", growth:49.0, gm:40.0, emp:53000, empAsOf:"FY2025", rev:37.38, oi:9.77, ni:8.539, top:null } },
  { slug:"tsm", kr:"경쟁", tk:"TSM", ko:"TSMC", ab:"TS", c:"#2a78d6", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"AI 칩은 결국 여기를 지난다",
    p:{ est:1987, hq:"대만 신주", ex:"대만거래소 2330", ex2:"뉴욕증권거래소 ADR", ceo:"웨이저자", ceoEn:"C.C. Wei",
        since:2018, sinceNote:"2018년 CEO · 2024년부터 회장 겸임", fye:"12월 31일", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"2026 매출 성장 전망", v:"+40 이상", u:"%", p:"2026년 · 달러 기준", t:"guide",
        s:"연초 +30% 이상에서 상향" },
      { k:"2026 자본지출 계획", v:"60~64", u:"B$", p:"2026년", t:"capex",
        s:"70~80%가 첨단 공정 · 나머지가 특수 공정과 첨단 패키징" },
      { k:"AI 가속기 5년 CAGR", v:"50%대 중후반", u:"", p:"2024~2029년", t:"guide",
        s:"회사 장기 전망 · 전사 CAGR 목표는 25% 근방" }
    ] },
    data:{ fy:"2025", growth:35.9, gm:59.9, emp:90557, empAsOf:"2025년 말", rev:122.42, oi:62.19, ni:55.21, top:{k:"HPC·AI", v:71.0, of:122.42} } },
  { slug:"asml", kr:"고객", tk:"ASML", ko:"ASML", ab:"AS", c:"#4a3aa7", group:"semi", base:"/stocks/",
    sector:"반도체 장비", hint:"삼성·SK가 고객인 유일한 회사",
    p:{ est:1984, estNote:"필립스·ASM 합작으로 출발 · 1988년 독립", hq:"네덜란드 펠트호번",
        ex:"유로넥스트 암스테르담", ex2:"나스닥 ADR", ceo:"크리스토프 푸케", ceoEn:"Christophe Fouquet",
        since:2024, fye:"12월 31일", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"2026 매출 가이던스", v:"43~45", u:"B€", p:"2026년", t:"guide",
        s:"4월 36~40B€에서 상향 · 2025년 32.7B€ 대비 큰 폭 증가" },
      { k:"2026 총마진 가이던스", v:"54~56", u:"%", p:"2026년", t:"guide",
        s:"2025년 52.8%에서 개선" },
      { k:"수주잔고", v:"38.8", u:"B€", p:"2025년 말", t:"backlog",
        s:"2026년 시스템 매출을 덮고 2027년까지 간다 · 2026년부터 분기 수주는 공시하지 않는다" }
    ] },
    data:{ fy:"2025", growth:15.6, gm:52.8, emp:44209, empAsOf:"2025년", rev:32.7, oi:null, ni:9.6, top:null, cur:"€" } },
  /* ---- 반도체 2차 (설계 IP · 모바일 · 파운드리 · 커스텀 실리콘 · AI 서버) ---- */
  { slug:"arm", kr:"고객", tk:"ARM", ko:"암", ab:"AR", c:"#008300", group:"semi", base:"/stocks/",
    sector:"반도체 IP", hint:"칩을 안 만드는데 거의 모든 칩에 들어간다",
    p:{ est:1990, estNote:"에이콘·애플·VLSI 합작으로 출범 · 2016년 소프트뱅크가 인수, 2023년 재상장",
        hq:"영국 케임브리지", ex:"나스닥 ADS", ceo:"르네 하스", ceoEn:"Rene Haas",
        since:2022, fye:"3월 31일", div:false },
    f:{ asOf:"2026년 9월", items:[
      { k:"2031년 칩 매출 목표", v:"15", u:"B$", p:"2031년", t:"guide",
        s:"IP 로열티만 받던 회사가 칩을 직접 판다는 계획 · 장기 목표지 가이던스가 아니다" },
      { k:"2031년 EPS 목표", v:"9 이상", u:"$", p:"2031년", t:"guide",
        s:"FY2026 실적 발표 자료에서 제시" }
    ] },
    data:{ fy:"FY2026", growth:23.0, gm:97.5, emp:7096, empAsOf:"2026년 3월", rev:4.92, oi:null, ni:0.904,
           top:{k:"로열티", v:2.61, of:4.92} } },
  { slug:"qcom", kr:"고객", tk:"QCOM", ko:"퀄컴", ab:"QC", c:"#d55181", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"매출 +14%인데 GAAP 이익은 반토막",
    p:{ est:1985, hq:"미국 캘리포니아 샌디에이고", ex:"나스닥", ceo:"크리스티아누 아몬", ceoEn:"Cristiano Amon",
        since:2021, fye:"9월 말(52/53주)", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"비핸드셋 매출 성장", v:"+60 이상", u:"%", p:"FY2027", t:"guide",
        s:"FY2026 +24%에서 가속 · 데이터센터 매출이 FY2027부터 잡히기 시작한다" }
    ] },
    data:{ fy:"FY2025", growth:14.0, gm:55.0, emp:52000, empAsOf:"2025년 9월", rev:44.3, oi:12.36, ni:5.54,
           top:{k:"QCT(칩)", v:38.37, of:44.3} } },
  { slug:"intc", kr:"경쟁", tk:"INTC", ko:"인텔", ab:"IN", c:"#256abf", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"매출 제자리, 파운드리는 90억 달러 적자",
    p:{ est:1968, hq:"미국 캘리포니아 산타클라라", ex:"나스닥", ceo:"립부 탄", ceoEn:"Lip-Bu Tan",
        since:2025, fye:"12월 말(52/53주)", div:false, divNote:"2024년 2분기부터 배당을 중단했다" },
    f:{ asOf:"2026년 9월", items:[
      { k:"2026 자본지출", v:"20 이상", u:"B$", p:"2026년", t:"capex",
        s:"2분기 실적 뒤 상향 · 2027년에는 더 높아진다고 밝혔다" }
    ] },
    data:{ fy:"2025", growth:0.0, gm:34.8, emp:85100, empAsOf:"2025년 말", rev:52.9, oi:-2.22, ni:-0.3,
           top:{k:"파운드리", v:17.8, of:52.9} } },
  { slug:"mrvl", kr:"공급", tk:"MRVL", ko:"마벨", ab:"MV", c:"#9085e9", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"매출의 4분의 3이 데이터센터",
    p:{ est:1995, hq:"미국 캘리포니아 산타클라라", ex:"나스닥", ceo:"맷 머피", ceoEn:"Matt Murphy",
        since:2016, fye:"1월 말(52/53주)", div:true },
    f:{ asOf:"2026년 9월", items:[
      { k:"FY2027 매출 목표", v:"약 11.5", u:"B$", p:"FY2027", t:"guide",
        s:"FY2026 8.195B$에서 약 +40% · 1분기 실적 뒤 상향" },
      { k:"FY2028 매출 목표", v:"약 16.5", u:"B$", p:"FY2028", t:"guide",
        s:"2년 만에 두 배 · 회사가 직접 제시한 중기 목표" },
      { k:"인터커넥트 성장", v:"+70 이상", u:"%", p:"FY2027", t:"guide",
        s:"기존 전망 +50%에서 상향" }
    ] },
    data:{ fy:"FY2026", growth:42.1, gm:null, emp:7042, empAsOf:"FY2025", rev:8.195, oi:null, ni:2.670, top:null } },
  { slug:"smci", kr:"공급", tk:"SMCI", ko:"슈퍼마이크로", ab:"SM", c:"#e66767", group:"semi", base:"/stocks/",
    sector:"AI 서버", hint:"매출 두 배, 총마진 10.8%",
    p:{ est:1993, hq:"미국 캘리포니아 산호세", ex:"나스닥", ceo:"찰스 량", ceoEn:"Charles Liang",
        since:1993, fye:"6월 30일", div:false },
    f:{ asOf:"2026년 9월", items:[
      { k:"FY2027 매출 가이던스", v:"65~72", u:"B$", p:"FY2027", t:"guide",
        s:"FY2026 39.1B$에서 최대 84% · 회사가 제시한 범위가 이례적으로 넓다" },
      { k:"신규 AI 수주", v:"60 이상", u:"B$", p:"FY2026 4분기 발표", t:"backlog",
        s:"회사는 역대 최대 수주잔고라고 밝혔다 · 금액 기준일은 따로 공시하지 않았다" }
    ] },
    data:{ fy:"FY2026", growth:77.7, gm:10.8, emp:6605, empAsOf:"2026년 3월", rev:39.1, oi:null, ni:2.2, top:null } }
];
