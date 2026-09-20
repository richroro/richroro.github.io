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
   ========================================================================= */
const REGISTRY = [
  /* ---- M7 (별도 폴더) ---- */
  { slug:"nvda", kr:"공급", tk:"NVDA", ko:"엔비디아", ab:"NV", c:"#3987e5", group:"m7", base:"/m7/",
    sector:"반도체", hint:"데이터센터가 매출의 92%",
    p:{ est:1993, hq:"미국 캘리포니아 산타클라라", ex:"나스닥", ceo:"젠슨 황", ceoEn:"Jensen Huang",
        since:1993, fye:"1월 마지막 일요일", div:true },
    data:{ fy:"FY2026", growth:65.0, gm:71.1, emp:42000, empAsOf:"2026년", rev:215.9, oi:130.387, ni:120.067, top:{k:"데이터센터", v:75.0, of:81.6} } },
  { slug:"aapl", kr:"공급", tk:"AAPL", ko:"애플", ab:"AA", c:"#6E7683", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"아이폰 절반, 이익은 서비스",
    p:{ est:1976, hq:"미국 캘리포니아 쿠퍼티노", ex:"나스닥", ceo:"존 터너스", ceoEn:"John Ternus",
        since:2026, sinceNote:"2026년 9월 1일 취임 · 팀 쿡은 이사회 의장(Executive Chair)으로", fye:"9월 마지막 토요일", div:true },
    data:{ fy:"FY2025", growth:6.0, gm:46.9, emp:166000, empAsOf:"2026년", rev:416.161, oi:133.05, ni:112.01, top:{k:"아이폰", v:209.59, of:416.161} } },
  { slug:"msft", kr:"간접", tk:"MSFT", ko:"마이크로소프트", ab:"MS", c:"#1baf7a", group:"m7", base:"/m7/",
    sector:"소프트웨어", hint:"Azure 1,000억 달러 돌파",
    p:{ est:1975, hq:"미국 워싱턴 레드먼드", ex:"나스닥", ceo:"사티아 나델라", ceoEn:"Satya Nadella",
        since:2014, fye:"6월 30일", div:true },
    data:{ fy:"FY2026", growth:18.0, gm:68.0, emp:228000, empAsOf:"2026년", rev:331.839, oi:155.2, ni:133.7, top:{k:"생산성·비즈니스", v:139.996, of:331.839} } },
  { slug:"googl", kr:"간접", tk:"GOOGL", ko:"알파벳", ab:"GO", c:"#eb6834", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"광고가 버는 돈으로 다 한다",
    p:{ est:1998, estNote:"구글 설립 1998년 · 지주회사 알파벳 전환 2015년", hq:"미국 캘리포니아 마운틴뷰",
        ex:"나스닥", ceo:"순다르 피차이", ceoEn:"Sundar Pichai", since:2019,
        sinceNote:"구글 CEO 2015년 · 알파벳 CEO 2019년", fye:"12월 31일", div:true },
    data:{ fy:"2025", growth:15.0, gm:59.6, emp:198933, empAsOf:"2026년 6월", rev:402.8, oi:129.039, ni:132.2, top:{k:"구글 서비스", v:342.721, of:402.8} } },
  { slug:"amzn", kr:"간접", tk:"AMZN", ko:"아마존", ab:"AM", c:"#c98500", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"매출 18%가 이익 57%",
    p:{ est:1994, hq:"미국 워싱턴 시애틀", ex:"나스닥", ceo:"앤디 재시", ceoEn:"Andy Jassy",
        since:2021, fye:"12월 31일", div:false },
    data:{ fy:"2025", growth:12.0, gm:50.3, emp:1576000, empAsOf:"2025년 말", rev:716.9, oi:80.0, ni:77.7, top:{k:"북미", v:426.3, of:716.9} } },
  { slug:"meta", kr:"간접", tk:"META", ko:"메타", ab:"ME", c:"#4a3aa7", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"광고 이익의 19%를 태운다",
    p:{ est:2004, hq:"미국 캘리포니아 멘로파크", ex:"나스닥", ceo:"마크 저커버그", ceoEn:"Mark Zuckerberg",
        since:2004, fye:"12월 31일", div:true, divNote:"2024년 첫 배당 개시" },
    data:{ fy:"2025", growth:22.0, gm:82.0, emp:75472, empAsOf:"2026년 2분기", rev:200.97, oi:83.28, ni:60.5, top:{k:"패밀리 오브 앱스", v:198.76, of:200.97} } },
  { slug:"tesla", kr:"공급", tk:"TSLA", ko:"테슬라", ab:"TS", c:"#E82127", group:"m7", href:"/tesla-metrics/",
    sector:"자동차", hint:"매출 최대, 최근 분기 이익률 1.4%",
    p:{ est:2003, hq:"미국 텍사스 오스틴", ex:"나스닥", ceo:"일론 머스크", ceoEn:"Elon Musk",
        since:2008, fye:"12월 31일", div:false },
    data:{ fy:"2025", growth:-3.0, gm:18.0, emp:134785, empAsOf:"2025년 말", rev:94.83, oi:4.35, ni:3.79, top:{k:"자동차", v:69.52, of:94.83} } },

  /* ---- 반도체·AI 인프라 ---- */
  { slug:"avgo", kr:"간접", tk:"AVGO", ko:"브로드컴", ab:"BR", c:"#C81E3A", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"반도체 58% · 소프트웨어 42%",
    p:{ est:1961, estNote:"HP 반도체 부문에서 출발 · 아바고를 거쳐 2018년 브로드컴 Inc.", hq:"미국 캘리포니아 팰로앨토",
        ex:"나스닥", ceo:"혹 탄", ceoEn:"Hock Tan", since:2006, fye:"11월 초(52/53주)", div:true },
    data:{ fy:"FY2025", growth:23.9, gm:78.6, emp:33000, empAsOf:"2025년 11월", rev:63.887, oi:null, ni:23.126, top:{k:"반도체 솔루션", v:36.858, of:63.887} } },
  { slug:"amd", kr:"공급", tk:"AMD", ko:"AMD", ab:"AD", c:"#eb6834", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"엔비디아와 같은 시장, 이익률 6분의 1",
    p:{ est:1969, hq:"미국 캘리포니아 산타클라라", ex:"나스닥", ceo:"리사 수", ceoEn:"Lisa Su",
        since:2014, fye:"12월 말(52/53주)", div:false },
    data:{ fy:"2025", growth:34.3, gm:50.0, emp:31000, empAsOf:"FY2025", rev:34.6, oi:3.7, ni:4.3, top:{k:"데이터센터", v:16.6, of:34.6} } },
  { slug:"mu", kr:"경쟁", tk:"MU", ko:"마이크론", ab:"MU", c:"#1baf7a", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"한 분기가 작년 한 해보다 크다",
    p:{ est:1978, hq:"미국 아이다호 보이시", ex:"나스닥", ceo:"산제이 메로트라", ceoEn:"Sanjay Mehrotra",
        since:2017, fye:"8월 말~9월 초", div:true },
    data:{ fy:"FY2025", growth:49.0, gm:40.0, emp:53000, empAsOf:"FY2025", rev:37.38, oi:9.77, ni:8.539, top:null } },
  { slug:"tsm", kr:"경쟁", tk:"TSM", ko:"TSMC", ab:"TS", c:"#2a78d6", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"AI 칩은 결국 여기를 지난다",
    p:{ est:1987, hq:"대만 신주", ex:"대만거래소 2330", ex2:"뉴욕증권거래소 ADR", ceo:"웨이저자", ceoEn:"C.C. Wei",
        since:2018, sinceNote:"2018년 CEO · 2024년부터 회장 겸임", fye:"12월 31일", div:true },
    data:{ fy:"2025", growth:35.9, gm:59.9, emp:90557, empAsOf:"2025년 말", rev:122.42, oi:62.19, ni:55.21, top:{k:"HPC·AI", v:71.0, of:122.42} } },
  { slug:"asml", kr:"고객", tk:"ASML", ko:"ASML", ab:"AS", c:"#4a3aa7", group:"semi", base:"/stocks/",
    sector:"반도체 장비", hint:"삼성·SK가 고객인 유일한 회사",
    p:{ est:1984, estNote:"필립스·ASM 합작으로 출발 · 1988년 독립", hq:"네덜란드 펠트호번",
        ex:"유로넥스트 암스테르담", ex2:"나스닥 ADR", ceo:"크리스토프 푸케", ceoEn:"Christophe Fouquet",
        since:2024, fye:"12월 31일", div:true },
    data:{ fy:"2025", growth:15.6, gm:52.8, emp:44209, empAsOf:"2025년", rev:32.7, oi:null, ni:9.6, top:null, cur:"€" } }
];
