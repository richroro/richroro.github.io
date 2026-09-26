/* ================================================================
   성공 애니 · 에피소드 대본
   ----------------------------------------------------------------
   에피소드 하나 = 객체 하나. 새 이야기를 넣으려면 아래 EPISODES 배열에
   같은 모양의 객체를 하나 더 붙이면 끝입니다. (README.md 참고)

   cast   : 등장인물. 얼굴·머리·옷을 숫자와 이름으로만 정합니다.
            hair   머리색    style  short|spiky|part|bowl|long|bun|gray|bald
            outfit suit|shirt|hanbok|hoodie|apron|coat|gown|jacket
            color  옷 색     tie    넥타이 색(없으면 생략)
            eye    눈동자색  glasses true|false   age young|adult|old
            sex    'f' 이면 여성 목소리로 읽음 (기본 남성)
   scenes : 장면. bg 배경, time 시간대(dawn|day|dusk|night), year 자막,
            cast 무대에 세울 인물(왼쪽부터), fx 장면 내내 도는 효과,
            sign 가게(riceshop) 배경의 간판 글씨, beats 한 컷씩 넘어가는 대사.
   hook   : 쇼츠 첫 화면에 크게 박히는 한 줄
   lessons: [제목, 설명, 장면 번호] — 장면 번호(0부터)는 레슨 쇼츠에서
            그 교훈을 보여 줄 장면입니다.
   beat   : n    나레이션
            who  말하는 사람(cast 키) + t 대사 + face 표정
                 (normal|smile|laugh|shock|angry|sad|determined|think|cry)
            fx   이번 컷 효과 (flash|shake|speed|sparkle|money|fire|rain|paper|petal|zoom)
            big  화면 가운데 크게 박히는 한 줄
   ----------------------------------------------------------------
   사실관계(연도·숫자·사건)는 자서전·언론 인터뷰·회사 공시로 공개된 내용만
   썼습니다. 대사는 그 사실을 바탕으로 각색한 것이며 실제 발언 인용이
   아닙니다. 실제 발언으로 널리 알려진 말만 quote: true 로 표시했습니다.
   ================================================================ */

window.EPISODES = [
/* ---------------------------------------------------------------- 1 */
{
  id: 'chung',
  title: '이봐, 해봤어?',
  hook: '소 판 돈 70원으로 현대를 세운 소년',
  person: '정주영',
  company: '현대그룹 창업자',
  years: '1915 – 2001',
  color: '#e8590c',
  mood: 'brave',
  logline: '소 판 돈 70원을 들고 서울로 도망친 산골 소년이 500원 지폐 한 장으로 조선소를 세우기까지.',
  cast: {
    ju:   { name: '정주영', hair: '#1a1a1a', style: 'short',  outfit: 'shirt',  color: '#d9cbb0', eye: '#3b2a1a', age: 'young' },
    juS:  { name: '정주영', hair: '#1a1a1a', style: 'part',   outfit: 'suit',   color: '#2b2f3a', tie: '#c92a2a', eye: '#3b2a1a', age: 'adult' },
    dad:  { name: '아버지', hair: '#3a3a3a', style: 'bun',    outfit: 'hanbok', color: '#e9e2cf', eye: '#2a1d12', age: 'old' },
    boss: { name: '쌀가게 주인', hair: '#555', style: 'bald', outfit: 'apron',  color: '#6b8e5a', eye: '#2a1d12', age: 'old' },
    lb:   { name: '롱바텀 회장', hair: '#c9b27c', style: 'gray', outfit: 'suit', color: '#3b3b48', tie: '#1c4a8a', eye: '#4a7ab5', age: 'old', glasses: true },
    crew: { name: '현장 직원', hair: '#222', style: 'spiky', outfit: 'jacket', color: '#f08c00', eye: '#2a1d12', age: 'young' }
  },
  scenes: [
    { bg: 'village', time: 'dawn', year: '1930년대 초 · 강원도 통천 아산리', cast: ['dad', 'ju'], fx: 'petal', beats: [
      { n: '강원도 통천의 가난한 농가. 소학교만 마친 장남은 신문에 실린 도시 이야기를 잊지 못했다.' },
      { who: 'ju', face: 'determined', t: '아버지, 저는 서울로 가겠습니다. 여기서 평생 흙만 파고 살 수는 없어요.' },
      { who: 'dad', face: 'angry', t: '장남이 농사를 안 지으면 이 집은 누가 지키냐!', fx: 'shake' },
      { n: '세 번 집을 나갔고, 세 번 모두 붙잡혀 돌아왔다.' },
      { n: '네 번째 가출. 소년의 손에는 아버지가 소를 판 돈 70원이 들려 있었다.', fx: 'speed', big: '네 번째 가출' }
    ]},
    { bg: 'riceshop', time: 'day', year: '1934 · 서울 쌀가게 배달원', cast: ['boss', 'ju'], beats: [
      { n: '서울에서 얻은 일은 쌀가게 배달. 자전거도 탈 줄 몰라 밤새 넘어지며 쌀가마니 싣는 법부터 익혔다.' },
      { who: 'ju', face: 'smile', t: '장부 정리도 제가 해 놓겠습니다. 쌀 한 되도 비지 않게요.' },
      { who: 'boss', face: 'shock', t: '창고가 이렇게 반듯한 건 처음 보는구먼…' },
      { n: '가게를 정리하게 된 주인은 아들이 아니라 배달꾼에게 가게를 넘겼다.', fx: 'sparkle' },
      { big: '1937 · 스물두 살, 경일상회 주인', fx: 'flash', n: '성실함이 첫 번째 자본이 됐다. 그러나 전시 쌀 배급제로 가게는 2년 만에 문을 닫는다.' }
    ]},
    { bg: 'garage', time: 'night', year: '1940 · 자동차 수리공장 아도서비스', cast: ['ju'], fx: 'fire', beats: [
      { n: '빚을 얻어 인수한 자동차 수리공장. 문을 연 지 한 달도 안 돼 불이 났다.', fx: 'shake' },
      { who: 'ju', face: 'shock', t: '고객 차까지… 전부 타 버렸어.' },
      { who: 'ju', face: 'determined', t: '다시 빌리겠습니다. 이번엔 누구보다 빨리 고쳐서 갚겠습니다.', fx: 'speed' },
      { n: '그는 다시 돈을 빌려 공장을 세웠고, "제일 빨리 고치는 집"으로 소문이 났다.' }
    ]},
    { bg: 'bank', time: 'day', year: '1971 · 영국 런던', cast: ['lb', 'juS'], fx: 'rain', beats: [
      { n: '해방 뒤 건설로 회사를 키운 그는 이번엔 조선소를 짓겠다고 나선다. 배를 만들어 본 적도, 조선소도, 돈도 없었다.' },
      { who: 'lb', face: 'think', t: '배를 한 척도 만들어 본 적 없는 회사에 누가 돈을 빌려줍니까?' },
      { who: 'juS', face: 'determined', t: '회장님, 이 지폐를 보십시오.', fx: 'zoom' },
      { big: '500원 지폐 속 거북선', fx: 'flash' },
      { who: 'juS', face: 'smile', t: '우리는 1500년대에 이미 철갑선을 만든 민족입니다. 시작이 늦었을 뿐, 능력은 충분합니다.' },
      { who: 'lb', face: 'laugh', t: '…좋습니다. 추천서를 써 드리지요.', fx: 'sparkle' },
      { n: '추천서로 영국 은행 차관의 문이 열렸다. 남은 건 배를 사 줄 선주였다. 그는 모래사장 사진 한 장과 유조선 설계도로 그리스 선주에게서 26만 톤급 유조선 두 척을 수주한다.' }
    ]},
    { bg: 'shipyard', time: 'dusk', year: '1972 ~ 1974 · 울산 미포만', cast: ['crew', 'juS'], beats: [
      { n: '조선소를 짓는 일과 배를 만드는 일을 동시에 했다. 도크가 완성되기 전에 이미 선체 블록이 쌓이고 있었다.' },
      { who: 'crew', face: 'sad', t: '회장님, 이 일정은 아무래도 불가능합니다…' },
      { who: 'juS', face: 'determined', t: '이봐, 해봤어?', quote: true, fx: 'speed', big: '이봐, 해봤어?' },
      { n: '1974년, 조선소 준공과 함께 1호선이 바다에 떴다. 착공 2년 3개월 만이었다.', fx: 'sparkle' }
    ]},
    { bg: 'stage', time: 'dusk', year: '그 뒤', cast: ['juS'], fx: 'sparkle', beats: [
      { n: '자동차·조선·건설·중공업. 쌀가게 배달꾼은 한국 산업화의 한 축을 세운 기업인이 되었다.' },
      { n: '1998년에는 소 1,001마리를 트럭에 싣고 판문점을 넘었다. 70원어치 소를 갚는다는 마음이었다고 한다.', big: '소 1,001마리' }
    ]}
  ],
  lessons: [
    ['신용이 첫 자본', '돈이 없던 배달꾼이 가게를 물려받은 이유는 장부와 창고였다.', 1],
    ['실패는 수업료', '불탄 공장 앞에서 그가 한 일은 다시 빌리고, 더 빨리 고치는 것이었다.', 2],
    ['없는 것을 핑계로 멈추지 않기', '조선소도 없이 모래사장 사진으로 배를 팔았다.', 3]
  ],
  timeline: [
    ['1915', '강원도 통천 출생'], ['1937', '쌀가게 경일상회 인수'], ['1940', '아도서비스 인수·화재'],
    ['1947', '현대토건사 설립'], ['1967', '현대자동차 설립'], ['1972', '울산 조선소 착공'],
    ['1974', '조선소 준공·1호선 명명'], ['1998', '소떼 방북']
  ],
  sources: '자서전 『이 땅에 태어나서』, 『시련은 있어도 실패는 없다』 및 언론 보도'
},

/* ---------------------------------------------------------------- 2 */
{
  id: 'seo',
  title: '마흔셋, 실업자의 바이오',
  hook: '마흔셋에 잘린 임원이 세계 1호 바이오시밀러를',
  person: '서정진',
  company: '셀트리온 창업자',
  years: '1957 –',
  color: '#1c7ed6',
  mood: 'hope',
  logline: '외환위기로 하루아침에 직장을 잃은 대기업 임원이, 전공도 아닌 바이오에서 세계 첫 항체 바이오시밀러를 만들기까지.',
  cast: {
    seo:  { name: '서정진', hair: '#1d1d1d', style: 'part', outfit: 'suit', color: '#34405a', tie: '#1c7ed6', eye: '#2d1f14', age: 'adult' },
    seoC: { name: '서정진', hair: '#1d1d1d', style: 'part', outfit: 'coat', color: '#4a4e5a', eye: '#2d1f14', age: 'adult' },
    mate: { name: '대우 동료', hair: '#2a2a2a', style: 'short', outfit: 'shirt', color: '#dfe7f2', tie: '#495057', eye: '#2d1f14', age: 'adult', glasses: true },
    prof: { name: '미국 연구자', hair: '#a0714f', style: 'gray', outfit: 'gown', color: '#ffffff', eye: '#3d7a57', age: 'old', glasses: true },
    doubt:{ name: '투자자', hair: '#333', style: 'part', outfit: 'suit', color: '#222831', tie: '#868e96', eye: '#1d1d1d', age: 'adult' }
  },
  scenes: [
    { bg: 'office', time: 'day', year: '1990년대 · 대우자동차', cast: ['seo'], beats: [
      { n: '삼성을 거쳐 대우자동차로 스카우트된 그는 30대에 임원이 됐다. 회사에서 가장 젊은 임원이었다.' },
      { who: 'seo', face: 'smile', t: '숫자로 증명하면 된다. 회사가 날 믿어 준 만큼.' }
    ]},
    { bg: 'city', time: 'night', year: '1998 · 외환위기', cast: ['mate', 'seoC'], fx: 'rain', beats: [
      { n: '외환위기가 대우를 무너뜨렸다. 명함도, 사무실도, 월급도 한꺼번에 사라졌다.', fx: 'shake' },
      { who: 'mate', face: 'sad', t: '이제 어디로 가야 합니까. 다들 한 가정의 가장인데…' },
      { who: 'seoC', face: 'determined', t: '우리가 나가서 회사를 하나 만들면 됩니다. 같이 갑시다.' },
      { big: '1999 · 동료 10명, 자본금 5천만 원', fx: 'flash', n: '대우 출신 동료들과 컨설팅 회사 넥솔을 차렸다.' }
    ]},
    { bg: 'lab', time: 'day', year: '1999 ~ 2001 · 미국', cast: ['prof', 'seoC'], beats: [
      { n: '무엇으로 먹고살 것인가. 그는 1년 가까이 미국의 연구소와 제약회사를 찾아다니며 묻고 또 물었다.' },
      { who: 'seoC', face: 'think', t: '앞으로 10년, 가장 크게 바뀔 산업은 무엇입니까?' },
      { who: 'prof', face: 'normal', t: '바이오 의약품입니다. 곧 대형 항체 의약품들의 특허가 줄줄이 만료되죠.' },
      { who: 'seoC', face: 'shock', t: '특허가 끝나면… 누구나 똑같은 약을 만들 수 있다는 뜻이군요.', fx: 'zoom' },
      { big: '바이오시밀러', fx: 'speed', n: '비싼 오리지널 항체 의약품과 효능이 같은, 더 싼 복제약. 아직 아무도 제대로 해내지 못한 시장이었다.' }
    ]},
    { bg: 'office', time: 'night', year: '2002 · 셀트리온 설립', cast: ['doubt', 'seo'], beats: [
      { who: 'doubt', face: 'angry', t: '자동차 하던 사람이 바이오를 한다고요? 전공자도 아니잖습니까.' },
      { who: 'seo', face: 'determined', t: '그래서 더 절박하게 공부합니다. 모르는 건 제일 잘 아는 사람에게 묻고요.' },
      { n: '2002년 미국 백스젠과 손잡고 셀트리온을 세웠다. 인천 송도에 대규모 세포배양 공장을 짓는 동안 자금은 늘 바닥이었다.', fx: 'shake' },
      { n: '돈을 구하러 다니던 시절에 대해 그는 훗날 "사채까지 썼다"고 털어놓았다.' }
    ]},
    { bg: 'stage', time: 'dusk', year: '2012 · 램시마', cast: ['seo'], fx: 'sparkle', beats: [
      { n: '2012년, 셀트리온의 램시마가 세계 최초의 항체 바이오시밀러로 허가를 받는다.', fx: 'flash', big: '세계 최초 항체 바이오시밀러' },
      { n: '이듬해 유럽, 2016년에는 미국 FDA 승인까지. 마흔셋의 실업자가 시작한 회사는 한국을 대표하는 바이오 기업이 됐다.' },
      { who: 'seo', face: 'laugh', t: '남들이 안 된다고 할 때가, 경쟁자가 없을 때입니다.' }
    ]}
  ],
  lessons: [
    ['위기는 판을 새로 짠다', '직장이 사라진 해에 새 산업을 찾기 시작했다.', 1],
    ['모르면 가장 잘 아는 사람에게', '1년 동안 전문가를 찾아다니며 산업 지도를 새로 그렸다.', 2],
    ['아무도 없는 시장', '특허 만료라는 날짜가 정해진 기회를 먼저 봤다.', 4]
  ],
  timeline: [
    ['1957', '충북 청주 출생'], ['1990년대', '대우자동차 임원'], ['1999', '넥솔 설립'],
    ['2002', '셀트리온 설립'], ['2012', '램시마 국내 허가'], ['2013', '유럽 승인'], ['2016', '미국 FDA 승인']
  ],
  sources: '언론 인터뷰, 셀트리온 공시 및 보도자료'
},

/* ---------------------------------------------------------------- 3 */
{
  id: 'kim',
  title: 'PC방 사장의 국민 메신저',
  hook: 'PC방 사장님이 카톡을 만들기까지',
  person: '김범수',
  company: '한게임·카카오 창업자',
  years: '1966 –',
  color: '#f59f00',
  mood: 'bright',
  logline: '여덟 식구 단칸방의 아이가 PC방을 차려 게임 회사를 먹여 살리고, 무료 메신저 하나로 온 국민의 휴대폰에 들어가기까지.',
  cast: {
    kid:  { name: '김범수', hair: '#161616', style: 'bowl', outfit: 'shirt', color: '#f2e7c9', eye: '#2a1c10', age: 'young' },
    bs:   { name: '김범수', hair: '#161616', style: 'short', outfit: 'shirt', color: '#fff3bf', tie: '#f59f00', eye: '#2a1c10', age: 'adult', glasses: true },
    bsH:  { name: '김범수', hair: '#161616', style: 'short', outfit: 'hoodie', color: '#fcc419', eye: '#2a1c10', age: 'adult', glasses: true },
    mom:  { name: '어머니', hair: '#2b2b2b', style: 'bun', outfit: 'apron', color: '#e599a8', eye: '#2a1c10', age: 'adult', sex: 'f' },
    gamer:{ name: 'PC방 손님', hair: '#5c3d2e', style: 'spiky', outfit: 'hoodie', color: '#4dabf7', eye: '#2a1c10', age: 'young' },
    dev:  { name: '개발자', hair: '#222', style: 'long', outfit: 'hoodie', color: '#ffd43b', eye: '#2a1c10', age: 'young', sex: 'f' }
  },
  scenes: [
    { bg: 'room', time: 'night', year: '1970 ~ 80년대 · 서울', cast: ['mom', 'kid'], beats: [
      { n: '할머니까지 여덟 식구가 단칸방에서 살았다. 형제 중 대학에 간 건 그가 처음이었다.' },
      { who: 'mom', face: 'smile', t: '우리 범수는 공부로 이 방을 넓힐 거지?' },
      { who: 'kid', face: 'determined', t: '네. 재수를 하더라도 꼭 갈게요.' },
      { n: '재수 끝에 서울대 산업공학과에 들어갔고, 대학원에서 처음 컴퓨터와 PC통신을 만났다.', fx: 'sparkle' }
    ]},
    { bg: 'office', time: 'day', year: '1992 · 삼성SDS', cast: ['bs'], beats: [
      { n: '삼성SDS 개발자로 PC통신 서비스 개발에 참여했다. 사람들이 화면 너머에서 모여 노는 모습이 그의 머리를 떠나지 않았다.' },
      { who: 'bs', face: 'think', t: '게임은 혼자 할 때보다 같이 할 때 훨씬 재미있다. 인터넷으로 고스톱이나 바둑을 둘 수 있다면?' }
    ]},
    { bg: 'pcbang', time: 'night', year: '1998 · 한양대 앞 PC방', cast: ['gamer', 'bs'], beats: [
      { n: '회사를 나와 게임을 만들려니 돈이 없었다. 그래서 먼저 PC방을 차렸다.' },
      { who: 'gamer', face: 'laugh', t: '사장님! 여기 두 시간 연장이요!' },
      { who: 'bs', face: 'smile', t: '(PC방 매출로 월급을 주고, 남는 시간엔 코드를 짠다.)' },
      { n: 'PC방을 운영하며 만든 관리 프로그램까지 팔아 개발비를 댔다.', fx: 'money' },
      { big: '1998.11 · 한게임 오픈', fx: 'flash', n: '무료 웹보드 게임 한게임. 입소문만으로 회원이 폭발적으로 늘었다.' }
    ]},
    { bg: 'office', time: 'dusk', year: '2000 · NHN', cast: ['bs'], beats: [
      { n: '사람은 모았지만 돈 버는 법이 필요했다. 검색 회사 네이버컴과 합쳐 NHN이 된다.' },
      { who: 'bs', face: 'determined', t: '게임이 사람을 모으고, 검색이 그 사람들을 붙잡는다.' },
      { n: 'NHN은 한국 최대 인터넷 회사가 됐다. 그리고 2007년, 그는 대표 자리를 내려놓고 회사를 떠났다.', fx: 'petal' }
    ]},
    { bg: 'room', time: 'day', year: '2010 · 아이위랩', cast: ['dev', 'bsH'], beats: [
      { n: '미국에서 아이폰을 본 그는 확신했다. 컴퓨터 다음은 손안의 컴퓨터다.' },
      { who: 'dev', face: 'think', t: '문자 한 통에 돈을 내는데, 공짜 메시지 앱을 누가 쓸까요?' },
      { who: 'bsH', face: 'laugh', t: '전부 다. 공짜로, 빠르게, 단체방까지.', fx: 'speed' },
      { big: '2010.3 · 카카오톡 출시', fx: 'flash' },
      { n: '출시 1년여 만에 가입자 1,000만 명. 문자메시지의 시대가 끝났다.', fx: 'sparkle' }
    ]},
    { bg: 'stage', time: 'night', year: '그 뒤', cast: ['bsH'], fx: 'sparkle', beats: [
      { n: '2014년 다음과 합병. 메신저 위에 택시·은행·결제·선물하기가 올라갔다.' },
      { who: 'bsH', face: 'smile', t: '사람이 모이는 곳을 먼저 만들면, 돈 버는 방법은 뒤따라온다.' }
    ]}
  ],
  lessons: [
    ['현금 흐름부터', '게임 개발비는 PC방 매출로 댔다. 꿈과 월급을 동시에 지켰다.', 2],
    ['무료로 사람을 모은다', '한게임도 카카오톡도 먼저 공짜로 사람을 모았다.', 4],
    ['정점에서 떠날 용기', '최대 인터넷 회사를 떠나 스마트폰 시대에 다시 창업했다.', 3]
  ],
  timeline: [
    ['1966', '서울 출생'], ['1992', '삼성SDS 입사'], ['1998', '한게임 창업'], ['2000', '네이버컴과 합병, NHN'],
    ['2007', 'NHN 대표 사임'], ['2010', '카카오톡 출시'], ['2014', '다음카카오 합병']
  ],
  sources: '언론 인터뷰 및 강연, 카카오 공시'
},

/* ---------------------------------------------------------------- 4 */
{
  id: 'baemin',
  title: '전단지를 줍던 디자이너',
  hook: '길바닥 전단지를 주워 4조 회사를',
  person: '김봉진',
  company: '배달의민족(우아한형제들) 창업자',
  years: '1976 –',
  color: '#12b886',
  mood: 'bright',
  logline: '가구점을 말아먹고 빚더미에 앉은 디자이너가, 길바닥 전단지를 주워 한국의 배달 문화를 바꾸기까지.',
  cast: {
    bj:   { name: '김봉진', hair: '#111', style: 'spiky', outfit: 'shirt', color: '#ffffff', eye: '#2a1c10', age: 'young', glasses: true },
    bjJ:  { name: '김봉진', hair: '#111', style: 'spiky', outfit: 'jacket', color: '#12b886', eye: '#2a1c10', age: 'adult', glasses: true },
    bro:  { name: '형', hair: '#222', style: 'short', outfit: 'hoodie', color: '#495057', eye: '#2a1c10', age: 'adult' },
    lend: { name: '빚쟁이', hair: '#333', style: 'bald', outfit: 'coat', color: '#343a40', eye: '#111', age: 'adult' },
    team: { name: '팀원', hair: '#7a4b2a', style: 'long', outfit: 'hoodie', color: '#63e6be', eye: '#2a1c10', age: 'young', sex: 'f' }
  },
  scenes: [
    { bg: 'sea', time: 'day', year: '1976 · 전남 완도', cast: ['bj'], fx: 'petal', beats: [
      { n: '섬에서 태어나 서울로 올라온 소년. 공고를 나와 서울예대에서 디자인을 배웠다.' },
      { who: 'bj', face: 'smile', t: '그림 그리는 게 제일 좋았어. 그걸로 먹고살 수 있다면.' },
      { n: '인터넷 회사의 웹디자이너가 됐다. 제법 잘나가는 디자이너였다.' }
    ]},
    { bg: 'riceshop', sign: '디자인 가구', time: 'dusk', year: '2008 · 가구점 창업', cast: ['lend', 'bj'], beats: [
      { n: '회사를 나와 디자인 가구점을 차렸다. 예쁜 가구는 칭찬만 받고 팔리지 않았다.' },
      { who: 'lend', face: 'angry', t: '이번 달 이자는 언제 줄 거요?', fx: 'shake' },
      { who: 'bj', face: 'cry', t: '…조금만, 조금만 더 기다려 주세요.' },
      { big: '1년 만에 폐업, 남은 건 빚', fx: 'flash', n: '그는 다시 회사로 돌아가 월급으로 빚을 갚으며 버텼다.' }
    ]},
    { bg: 'street', time: 'night', year: '2010 · 서울 거리', cast: ['bro', 'bjJ'], fx: 'paper', beats: [
      { n: '형과 함께 스마트폰 앱을 궁리하던 밤. 현관문마다 배달 전단지가 덕지덕지 붙어 있었다.' },
      { who: 'bro', face: 'think', t: '사람들이 배달 시킬 때마다 전단지를 찾느라 온 집을 뒤지잖아.' },
      { who: 'bjJ', face: 'shock', t: '형… 이거 쓰레기가 아니라 데이터야!', fx: 'zoom' },
      { n: '둘은 밤마다 거리와 아파트 현관을 돌며 전단지를 주웠다. 가게 이름과 전화번호를 한 장씩 손으로 입력했다.', fx: 'speed' },
      { big: '2010.6 · 배달의민족 출시', fx: 'flash' }
    ]},
    { bg: 'office', time: 'day', year: '2010년대 · 우아한형제들', cast: ['team', 'bjJ'], beats: [
      { who: 'team', face: 'laugh', t: '대표님, 광고 문구가 너무 B급인데요? "우리가 어떤 민족입니까"라니.' },
      { who: 'bjJ', face: 'laugh', t: '그게 우리야. 디자이너가 만든 회사는 말투부터 달라야지.', fx: 'sparkle' },
      { n: '폰트를 만들고, 잡지 광고를 내고, 배민만의 말투를 만들었다. 가구점에서 실패한 디자인이 이번엔 브랜드가 됐다.' }
    ]},
    { bg: 'stage', time: 'dusk', year: '2019 ~ 2021', cast: ['bjJ'], fx: 'sparkle', beats: [
      { n: '2019년 12월, 독일 딜리버리히어로가 우아한형제들을 기업가치 약 40억 달러에 인수한다고 발표했다.', fx: 'money', big: '약 40억 달러' },
      { n: '2021년 그는 재산의 절반 이상을 기부하겠다고 약속하며 한국인 최초로 더기빙플레지에 이름을 올렸다.' },
      { who: 'bjJ', face: 'smile', t: '길에서 주운 전단지로 시작했으니, 다시 길 위의 사람들에게 돌려줘야죠.' }
    ]}
  ],
  lessons: [
    ['실패도 자산이 된다', '팔리지 않던 가구점의 디자인 감각이 배민의 브랜드가 됐다.', 3],
    ['불편함이 곧 시장', '온 집을 뒤지게 만들던 전단지가 사업 아이템이었다.', 2],
    ['손으로 먼저', '데이터가 없으면 직접 주워 입력했다. 확장은 그다음이었다.', 2]
  ],
  timeline: [
    ['1976', '전남 완도 출생'], ['2008', '가구점 창업·폐업'], ['2010', '배달의민족 출시'],
    ['2011', '우아한형제들 법인 설립'], ['2019', '딜리버리히어로 인수 발표'], ['2021', '더기빙플레지 서약']
  ],
  sources: '저서 『배민다움』, 언론 인터뷰 및 보도'
},

/* ---------------------------------------------------------------- 5 */
{
  id: 'toss',
  title: '여덟 번 실패한 치과의사',
  hook: '치과의사 그만두고 8번 망한 남자',
  person: '이승건',
  company: '토스(비바리퍼블리카) 창업자',
  years: '1982 –',
  color: '#3182f6',
  mood: 'hope',
  logline: '안정된 치과의사 자리를 박차고 나와 여덟 번을 실패한 끝에, 공인인증서 없는 송금으로 금융을 바꾸기까지.',
  cast: {
    lee:  { name: '이승건', hair: '#111', style: 'part', outfit: 'gown', color: '#ffffff', eye: '#20160d', age: 'young' },
    leeH: { name: '이승건', hair: '#111', style: 'part', outfit: 'hoodie', color: '#3182f6', eye: '#20160d', age: 'young' },
    mem:  { name: '팀원', hair: '#3b2b20', style: 'bowl', outfit: 'hoodie', color: '#adb5bd', eye: '#20160d', age: 'young', glasses: true },
    user: { name: '인터뷰한 사용자', hair: '#6b4226', style: 'long', outfit: 'jacket', color: '#f783ac', eye: '#20160d', age: 'young', sex: 'f' },
    reg:  { name: '규제 담당자', hair: '#2b2b2b', style: 'part', outfit: 'suit', color: '#343a40', tie: '#495057', eye: '#111', age: 'adult', glasses: true }
  },
  scenes: [
    { bg: 'lab', time: 'day', year: '2000년대 · 치과의사', cast: ['lee'], beats: [
      { n: '서울대 치의학과를 나와 치과의사가 됐다. 누구나 부러워하는 안정된 길이었다.' },
      { who: 'lee', face: 'think', t: '평생 이 의자 옆에서… 정말 이게 내가 할 일일까.' },
      { n: '공중보건의로 일하던 시절, 수백 권의 책을 읽으며 그는 창업을 결심한다.', fx: 'sparkle' }
    ]},
    { bg: 'room', time: 'night', year: '2011 ~ 2014 · 비바리퍼블리카', cast: ['mem', 'leeH'], beats: [
      { n: '첫 서비스는 모바일 SNS. 실패했다. 투표 앱, 또 실패. 그렇게 여덟 번.', fx: 'shake', big: '실패 × 8' },
      { who: 'mem', face: 'sad', t: '대표님, 통장에 석 달 치 월급도 안 남았어요…' },
      { who: 'leeH', face: 'determined', t: '우리가 만들고 싶은 걸 만들었으니까 실패한 거야. 이번엔 사람들이 진짜 불편해하는 걸 찾자.' }
    ]},
    { bg: 'city', time: 'day', year: '2013 · 사용자 인터뷰', cast: ['user', 'leeH'], beats: [
      { who: 'user', face: 'angry', t: '친구한테 만 원 보내는데 공인인증서, 보안카드, 프로그램 설치까지… 이게 말이 돼요?' },
      { who: 'leeH', face: 'shock', t: '송금 한 번에 단계가 몇 개나 되는 거야…', fx: 'zoom' },
      { big: '비밀번호만으로 송금', fx: 'flash', n: '문제는 사용자 입에서 나왔다.' }
    ]},
    { bg: 'bank', time: 'day', year: '2014 · 규제의 벽', cast: ['reg', 'leeH'], beats: [
      { who: 'reg', face: 'normal', t: '현행 규정상 이 방식의 송금 서비스는 허용되지 않습니다.' },
      { n: '앱을 내놓자마자 규제에 막혀 서비스를 내려야 했다.', fx: 'shake' },
      { who: 'leeH', face: 'determined', t: '규칙이 바뀔 때까지 설명하고, 또 설명하겠습니다.' },
      { n: '핀테크 규제가 풀리기 시작한 2015년 2월, 토스가 정식 출시된다.', fx: 'speed', big: '2015.2 · 토스 출시' }
    ]},
    { bg: 'stage', time: 'night', year: '그 뒤', cast: ['leeH'], fx: 'sparkle', beats: [
      { n: '송금에서 시작해 증권, 결제, 그리고 2021년 인터넷전문은행 토스뱅크까지.', fx: 'money' },
      { who: 'leeH', face: 'smile', t: '실패를 빨리, 많이 한 게 결국 가장 빠른 길이었어요.' }
    ]}
  ],
  lessons: [
    ['빨리, 많이 실패하기', '여덟 번의 실패가 아홉 번째를 위한 연습이었다.', 1],
    ['답은 사용자 입에서', '만들고 싶은 것 대신, 사람들이 화내는 지점을 찾았다.', 2],
    ['규제는 벽이자 해자', '먼저 넘은 벽은 뒤따라오는 경쟁자를 막아 준다.', 3]
  ],
  timeline: [
    ['1982', '출생'], ['2011', '비바리퍼블리카 창업'], ['2011~14', '여덟 번의 실패'],
    ['2015', '토스 간편송금 출시'], ['2018', '기업가치 1조 원, 유니콘 등극'], ['2021', '토스뱅크 출범']
  ],
  sources: '언론 인터뷰 및 강연, 비바리퍼블리카 보도자료'
},
/* ---------------------------------------------------------------- 6 */
{
  id: 'krafton',
  title: '망하기 직전의 배틀그라운드',
  hook: '적자 회사를 살린 100명 중 최후의 1인',
  person: '장병규',
  company: '네오위즈·첫눈·크래프톤 창업자',
  years: '1973 –',
  color: '#f08c00',
  mood: 'brave',
  logline: '박사과정을 그만두고 세 번 창업한 연쇄 창업가가, 적자에 허덕이던 게임 회사를 배틀로얄 하나에 걸어 세계 1위로 만들기까지.',
  cast: {
    jang: { name: '장병규', hair: '#151515', style: 'short', outfit: 'shirt', color: '#dbe4ff', eye: '#20160d', age: 'young', glasses: true },
    jangJ:{ name: '장병규', hair: '#151515', style: 'short', outfit: 'jacket', color: '#495057', eye: '#20160d', age: 'adult', glasses: true },
    dev:  { name: '개발 PD', hair: '#222', style: 'spiky', outfit: 'hoodie', color: '#f08c00', eye: '#20160d', age: 'adult' },
    cfo:  { name: '재무 담당', hair: '#333', style: 'part', outfit: 'suit', color: '#343a40', tie: '#868e96', eye: '#111', age: 'adult', glasses: true },
    gamer:{ name: '스트리머', hair: '#8a5a3b', style: 'long', outfit: 'hoodie', color: '#74c0fc', eye: '#355c8a', age: 'young', sex: 'f' }
  },
  scenes: [
    { bg: 'lab', time: 'day', year: '1997 · KAIST', cast: ['jang'], beats: [
      { n: 'KAIST 전산학 박사과정 학생. 논문보다 인터넷이 더 궁금했다.' },
      { who: 'jang', face: 'determined', t: '연구실에서 논문 쓰는 것보다, 지금 세상을 바꾸는 걸 만들고 싶어.' },
      { n: '스물넷에 박사과정을 그만두고 네오위즈를 공동 창업했다. 원클릭, 세이클럽. 첫 창업이 성공했다.', fx: 'sparkle' }
    ]},
    { bg: 'office', time: 'dusk', year: '2005 ~ 2006 · 첫눈', cast: ['jangJ'], beats: [
      { n: '두 번째 회사는 검색 엔진 첫눈. 1년 만에 NHN이 약 350억 원에 사 갔다.', fx: 'money', big: '두 번째 창업, 350억 매각' },
      { who: 'jangJ', face: 'think', t: '돈은 벌었다. 그런데 세계에서 통하는 걸 만들어 본 적은 없어.' }
    ]},
    { bg: 'office', time: 'night', year: '2007 ~ 2016 · 블루홀', cast: ['cfo', 'jangJ'], fx: 'rain', beats: [
      { n: '세 번째 회사 블루홀. 대작 온라인 게임 테라를 만들었지만, 들인 돈만큼 벌지 못했다.' },
      { who: 'cfo', face: 'sad', t: '대표님, 적자가 몇 년째입니다. 다음 게임이 안 되면 정말 끝이에요.', fx: 'shake' },
      { who: 'jangJ', face: 'determined', t: '그럼 다음 게임은 아무도 안 해 본 걸로 하자.' }
    ]},
    { bg: 'room', time: 'night', year: '2016 · 새 장르', cast: ['dev', 'jangJ'], beats: [
      { who: 'dev', face: 'laugh', t: '100명이 섬에 떨어져서, 마지막 한 명만 살아남는 게임입니다.' },
      { who: 'jangJ', face: 'shock', t: '대작도 아니고, 1년 안에 만든다고?', fx: 'zoom' },
      { n: '배틀로얄 장르를 처음 만든 개발자 브렌던 그린을 데려오고, 작은 팀이 1년 만에 게임을 완성했다.', fx: 'speed', big: '최후의 1인' }
    ]},
    { bg: 'pcbang', time: 'night', year: '2017.3 · 스팀 얼리 액세스', cast: ['gamer'], beats: [
      { who: 'gamer', face: 'laugh', t: '이겼닭! 오늘 저녁은 치킨이다!', fx: 'sparkle' },
      { n: '출시하자마자 전 세계 방송인들이 틀기 시작했다. 입소문이 입소문을 불렀다.' },
      { big: '스팀 동시접속 325만 명', fx: 'flash', n: '2018년 1월, 스팀 역사상 최고 동시접속 기록. 한국 게임이 세계 1위에 올랐다.' }
    ]},
    { bg: 'stage', time: 'dusk', year: '그 뒤', cast: ['jangJ'], fx: 'sparkle', beats: [
      { n: '블루홀은 크래프톤으로 이름을 바꾸고 2021년 유가증권시장에 상장했다.', fx: 'money' },
      { who: 'jangJ', face: 'smile', t: '망할 뻔한 회사였기 때문에, 큰 회사가 안 하는 걸 할 수 있었습니다.' }
    ]}
  ],
  lessons: [
    ['연쇄 창업의 근육', '네오위즈·첫눈·블루홀. 앞선 창업들이 네 번째 판을 버티는 힘이 됐다.', 1],
    ['막다른 길에서 새 장르', '적자 속에서 검증된 대작 대신, 아무도 크게 성공시키지 못한 장르에 걸었다.', 2],
    ['장르를 만든 사람에게 베팅', '배틀로얄을 처음 만든 사람을 직접 데려왔다.', 3]
  ],
  timeline: [
    ['1973', '대구 출생'], ['1997', '네오위즈 공동 창업'], ['2005', '첫눈 창업'], ['2006', '첫눈 NHN 매각'],
    ['2007', '블루홀 설립'], ['2017', '배틀그라운드 출시'], ['2018', '사명 크래프톤'], ['2021', '유가증권시장 상장']
  ],
  sources: '언론 인터뷰, 크래프톤 증권신고서 및 보도자료'
},

/* ---------------------------------------------------------------- 7 */
{
  id: 'smilegate',
  title: '한국에서 진 게임, 중국을 삼키다',
  hook: '한국에서 망한 게임이 중국 국민게임이 된 이유',
  person: '권혁빈',
  company: '스마일게이트 창업자',
  years: '1974 –',
  color: '#e03131',
  mood: 'brave',
  logline: '국내에서 외면받은 총싸움 게임 하나를 들고 중국으로 건너가, 중국의 국민 게임으로 만들기까지.',
  cast: {
    kwon: { name: '권혁빈', hair: '#141414', style: 'part', outfit: 'shirt', color: '#ffe3e3', eye: '#20160d', age: 'young', glasses: true },
    kwonS:{ name: '권혁빈', hair: '#141414', style: 'part', outfit: 'suit', color: '#2b2f3a', tie: '#e03131', eye: '#20160d', age: 'adult', glasses: true },
    staff:{ name: '개발자', hair: '#2b2b2b', style: 'bowl', outfit: 'hoodie', color: '#868e96', eye: '#20160d', age: 'young' },
    tc:   { name: '중국 파트너', hair: '#101010', style: 'short', outfit: 'suit', color: '#1c3d6e', tie: '#e03131', eye: '#1d1410', age: 'adult' },
    fan:  { name: '중국 게이머', hair: '#1a1a1a', style: 'spiky', outfit: 'jacket', color: '#ff6b6b', eye: '#1d1410', age: 'young' }
  },
  scenes: [
    { bg: 'room', time: 'night', year: '2002 · 스마일게이트 창업', cast: ['kwon'], beats: [
      { n: '서강대 전자공학과를 나온 젊은 개발자가 작은 사무실에서 회사를 차렸다.' },
      { who: 'kwon', face: 'determined', t: '사람들을 웃게 만드는 문, 스마일게이트. 이름부터 정했어.' }
    ]},
    { bg: 'pcbang', time: 'night', year: '2007 · 크로스파이어 국내 출시', cast: ['staff', 'kwon'], beats: [
      { n: '총싸움 게임 크로스파이어를 내놨다. 하지만 한국 PC방은 이미 다른 게임들이 꽉 잡고 있었다.' },
      { who: 'staff', face: 'sad', t: '대표님… 접속자가 거의 늘지 않습니다.', fx: 'shake' },
      { who: 'kwon', face: 'think', t: '게임이 나쁜 걸까, 시장이 맞지 않는 걸까.' }
    ]},
    { bg: 'bank', time: 'day', year: '2008 · 중국', cast: ['tc', 'kwonS'], beats: [
      { who: 'tc', face: 'normal', t: '중국 PC방엔 사양 낮은 컴퓨터가 많습니다. 가볍고 빠른 총싸움이라면 해볼 만합니다.' },
      { who: 'kwonS', face: 'shock', t: '우리 게임이… 거기선 장점이 되는군요.', fx: 'zoom' },
      { n: '중국 최대 인터넷 기업 텐센트와 손잡고 중국 서비스를 시작했다.', fx: 'speed', big: '2008 · 중국 진출' }
    ]},
    { bg: 'city', time: 'night', year: '2008 ~ · 중국 전역', cast: ['fan'], beats: [
      { who: 'fan', face: 'laugh', t: '오늘도 한 판! 친구들 전부 이거 해요!', fx: 'sparkle' },
      { n: '동시접속자 수백만 명. 한국에서 외면받은 게임이 중국의 국민 FPS가 됐다.', fx: 'money', big: '중국 국민 FPS' },
      { n: '작은 개발사는 한국에서 손꼽히는 게임 회사가 됐다.' }
    ]},
    { bg: 'stage', time: 'dusk', year: '2018 · 로스트아크', cast: ['kwonS'], fx: 'sparkle', beats: [
      { n: '그 돈을 쌓아 두지 않았다. 대작 MMORPG 로스트아크에 7년 넘게 쏟아부었다.' },
      { big: '2018 · 로스트아크 출시', fx: 'flash' },
      { who: 'kwonS', face: 'smile', t: '한 번의 성공은 다음 도전을 위한 시간일 뿐입니다.' }
    ]}
  ],
  lessons: [
    ['시장은 하나가 아니다', '한국에서 진 게임이 중국에서 이겼다. 제품보다 시장을 바꿨다.', 2],
    ['현지의 강자와 손잡기', '텐센트의 유통망을 타고 중국 전역으로 퍼졌다.', 3],
    ['번 돈은 다음 판에', '크로스파이어로 번 돈을 로스트아크에 7년 넘게 부었다.', 4]
  ],
  timeline: [
    ['1974', '출생'], ['2002', '스마일게이트 설립'], ['2007', '크로스파이어 국내 출시'], ['2008', '중국 텐센트 서비스'],
    ['2018', '로스트아크 출시']
  ],
  sources: '언론 인터뷰 및 보도, 스마일게이트 보도자료'
},

/* ---------------------------------------------------------------- 8 */
{
  id: 'kurly',
  title: '새벽 7시의 배송 혁명',
  hook: '밤 11시 주문, 아침 7시 도착을 처음 만든 사람',
  person: '김슬아',
  company: '마켓컬리 창업자',
  years: '1983 –',
  color: '#7048e8',
  mood: 'bright',
  logline: '장 볼 시간도 없던 금융맨이, 자는 동안 문 앞에 신선식품을 가져다 놓는 새벽배송으로 새 시장을 만들기까지.',
  cast: {
    seul: { name: '김슬아', hair: '#1a1210', style: 'long', outfit: 'suit', color: '#343a40', eye: '#2d1f14', age: 'young', sex: 'f' },
    seulK:{ name: '김슬아', hair: '#1a1210', style: 'long', outfit: 'jacket', color: '#7048e8', eye: '#2d1f14', age: 'adult', sex: 'f' },
    ops:  { name: '물류 담당', hair: '#222', style: 'short', outfit: 'jacket', color: '#ffd43b', eye: '#20160d', age: 'adult' },
    mom:  { name: '고객', hair: '#3b2b20', style: 'bun', outfit: 'apron', color: '#b197fc', eye: '#20160d', age: 'adult', sex: 'f' }
  },
  scenes: [
    { bg: 'office', time: 'night', year: '2000년대 · 해외 금융가', cast: ['seul'], beats: [
      { n: '민족사관고, 미국 웰즐리대를 나와 해외 금융·컨설팅 회사에서 일했다. 밤늦게까지 이어지는 야근의 연속.' },
      { who: 'seul', face: 'sad', t: '월급은 많은데… 제대로 된 장 한 번 볼 시간이 없네.' }
    ]},
    { bg: 'room', time: 'night', year: '2014 · 퇴근 후 부엌', cast: ['seul'], beats: [
      { n: '좋은 식재료를 사려면 주말에 발품을 팔아야 했다. 퇴근 후엔 이미 가게 문이 닫혀 있었다.' },
      { who: 'seul', face: 'think', t: '나 같은 사람이 분명 많을 거야. 퇴근길에 주문하고, 아침에 받을 수 있다면?' },
      { n: '2014년 회사를 그만두고 창업했다. 이듬해 5월, 마켓컬리가 문을 열었다.', fx: 'sparkle' }
    ]},
    { bg: 'office', time: 'night', year: '2015 · 샛별배송', cast: ['ops', 'seulK'], beats: [
      { who: 'ops', face: 'shock', t: '밤 11시에 주문을 받아서 아침 7시까지요? 물류센터가 밤새 돌아야 합니다!' },
      { who: 'seulK', face: 'determined', t: '그래서 아무도 안 하는 거예요. 우리가 하면 우리만의 시장이 되죠.', fx: 'speed' },
      { big: '밤 11시 주문 → 아침 7시 도착', fx: 'flash', n: '신선식품을 차갑게 유지한 채 밤새 나르는 샛별배송이 시작됐다.' }
    ]},
    { bg: 'street', time: 'dawn', year: '새벽 · 아파트 현관', cast: ['mom'], fx: 'petal', beats: [
      { who: 'mom', face: 'laugh', t: '자고 일어났더니 문 앞에 장바구니가 와 있네!', fx: 'sparkle' },
      { n: '입소문을 탄 보라색 상자는 바쁜 직장인과 아이 키우는 부모들의 아침을 바꿨다.' }
    ]},
    { bg: 'stage', time: 'dawn', year: '그 뒤', cast: ['seulK'], fx: 'sparkle', beats: [
      { n: '대형 유통사들이 줄줄이 뒤따랐다. ‘새벽배송’은 한 회사의 서비스 이름이 아니라 시장 이름이 됐다.', fx: 'money', big: '새벽배송' },
      { who: 'seulK', face: 'smile', t: '제가 불편했던 걸 풀었을 뿐인데, 모두가 같은 걸 불편해하고 있었어요.' }
    ]}
  ],
  lessons: [
    ['내 불편에서 시작', '장 볼 시간이 없던 자신의 문제가 곧 수많은 직장인의 문제였다.', 1],
    ['상품이 아니라 시간을 판다', '밤 11시 주문, 아침 7시 도착. 고객의 아침 시간을 팔았다.', 2],
    ['아무도 안 하는 어려운 일', '밤새 돌아가는 물류라는 어려움이 그대로 진입장벽이 됐다.', 2]
  ],
  timeline: [
    ['1983', '출생'], ['2014', '회사 설립(더파머스, 현 컬리)'], ['2015', '마켓컬리 출시·샛별배송 시작'], ['그 뒤', '새벽배송 시장 경쟁 본격화']
  ],
  sources: '언론 인터뷰 및 보도, 컬리 보도자료'
}
];
