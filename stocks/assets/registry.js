"use strict";
/* =========================================================================
   종목 레지스트리 — 허브와 각 종목 페이지가 같이 읽습니다.
   data 가 있는 곳만 스크리너 표에 나옵니다(검증된 수치만 싣는다는 원칙).
   om(영업이익률)·topShare(최대 부문 비중)는 하드코딩하지 않고 허브에서 계산합니다.
   ========================================================================= */
const REGISTRY = [
  /* ---- M7 (별도 폴더) ---- */
  { slug:"nvda", kr:"공급", tk:"NVDA", ko:"엔비디아", ab:"NV", c:"#3987e5", group:"m7", base:"/m7/",
    sector:"반도체", hint:"데이터센터가 매출의 92%",
    data:{ fy:"FY2026", emp:42000, empAsOf:"2026년", rev:215.9, oi:130.387, top:{k:"데이터센터", v:75.0, of:81.6} } },
  { slug:"aapl", kr:"공급", tk:"AAPL", ko:"애플", ab:"AA", c:"#6E7683", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"아이폰 절반, 이익은 서비스",
    data:{ fy:"FY2025", emp:166000, empAsOf:"2026년", rev:416.161, oi:133.05, top:{k:"아이폰", v:209.59, of:416.161} } },
  { slug:"msft", kr:"간접", tk:"MSFT", ko:"마이크로소프트", ab:"MS", c:"#1baf7a", group:"m7", base:"/m7/",
    sector:"소프트웨어", hint:"Azure 1,000억 달러 돌파",
    data:{ fy:"FY2026", emp:228000, empAsOf:"2026년", rev:331.839, oi:155.2, top:{k:"생산성·비즈니스", v:139.996, of:331.839} } },
  { slug:"googl", kr:"간접", tk:"GOOGL", ko:"알파벳", ab:"GO", c:"#eb6834", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"광고가 버는 돈으로 다 한다",
    data:{ fy:"2025", emp:198933, empAsOf:"2026년 6월", rev:402.8, oi:129.039, top:{k:"구글 서비스", v:342.721, of:402.8} } },
  { slug:"amzn", kr:"간접", tk:"AMZN", ko:"아마존", ab:"AM", c:"#c98500", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"매출 18%가 이익 57%",
    data:{ fy:"2025", emp:1576000, empAsOf:"2025년 말", rev:716.9, oi:80.0, top:{k:"북미", v:426.3, of:716.9} } },
  { slug:"meta", kr:"간접", tk:"META", ko:"메타", ab:"ME", c:"#4a3aa7", group:"m7", base:"/m7/",
    sector:"플랫폼", hint:"광고 이익의 19%를 태운다",
    data:{ fy:"2025", emp:75472, empAsOf:"2026년 2분기", rev:200.97, oi:83.28, top:{k:"패밀리 오브 앱스", v:198.76, of:200.97} } },
  { slug:"tesla", kr:"공급", tk:"TSLA", ko:"테슬라", ab:"TS", c:"#E82127", group:"m7", href:"/tesla-metrics/",
    sector:"자동차", hint:"매출 최대, 이익률 1.4%",
    data:{ fy:"2025", emp:134785, empAsOf:"2025년 말", rev:94.83, oi:4.35, top:{k:"자동차", v:69.52, of:94.83} } },

  /* ---- 반도체·AI 인프라 ---- */
  { slug:"avgo", kr:"간접", tk:"AVGO", ko:"브로드컴", ab:"BR", c:"#C81E3A", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"반도체 58% · 소프트웨어 42%",
    data:{ fy:"FY2025", emp:33000, empAsOf:"2025년 11월", rev:63.887, oi:null, top:{k:"반도체 솔루션", v:36.858, of:63.887} } },
  { slug:"amd", kr:"공급", tk:"AMD", ko:"AMD", ab:"AD", c:"#eb6834", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"엔비디아와 같은 시장, 이익률 6분의 1",
    data:{ fy:"2025", emp:31000, empAsOf:"FY2025", rev:34.6, oi:3.7, top:{k:"데이터센터", v:16.6, of:34.6} } },
  { slug:"mu", kr:"경쟁", tk:"MU", ko:"마이크론", ab:"MU", c:"#1baf7a", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"한 분기가 작년 한 해보다 크다",
    data:{ fy:"FY2025", emp:53000, empAsOf:"FY2025", rev:37.38, oi:9.77, top:null } },
  { slug:"tsm", kr:"경쟁", tk:"TSM", ko:"TSMC", ab:"TS", c:"#2a78d6", group:"semi", base:"/stocks/",
    sector:"반도체", hint:"AI 칩은 결국 여기를 지난다",
    data:{ fy:"2025", emp:90557, empAsOf:"2025년 말", rev:122.42, oi:62.19, top:{k:"HPC·AI", v:71.0, of:122.42} } },
  { slug:"asml", kr:"고객", tk:"ASML", ko:"ASML", ab:"AS", c:"#4a3aa7", group:"semi", base:"/stocks/",
    sector:"반도체 장비", hint:"삼성·SK가 고객인 유일한 회사",
    data:{ fy:"2025", emp:44209, empAsOf:"2025년", rev:32.7, oi:null, top:null, cur:"€" } }
];
