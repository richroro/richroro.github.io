/* ================================================================
   성공 애니 · 에피소드 대본
   ----------------------------------------------------------------
   에피소드 하나 = 객체 하나. 새 이야기를 넣으려면 아래 EPISODES 배열에
   같은 모양의 객체를 하나 더 붙이면 끝입니다. (README.md 참고)

   여덟 편은 모두 이야기 방식이 다릅니다.
     1 정주영   액자식        — 1998년 판문점에서 시작해 66년 전으로, 다시 판문점으로
     2 서정진   하룻밤        — 실직한 날 밤 포장마차, 밤 9시부터 새벽 1시까지, 그리고 13년 뒤
     3 김범수   교차 편집     — 2010년 카카오톡과 1998년 PC방을 번갈아
     4 김봉진   사물의 시점   — 나레이터가 전단지
     5 이승건   실패 일지     — 일지 #1부터 #9까지
     6 장병규   게임 스테이지 — STAGE 1 · 2 · 3 · FINAL
     7 권혁빈   거울 구조     — 같은 게임, 한국과 중국
     8 김슬아   고객의 하룻밤 — 주인공은 가상의 고객, 창업자는 조연

   cast   : 등장인물. 얼굴·머리·옷을 숫자와 이름으로만 정합니다.
            hair   머리색    style  short|spiky|part|bowl|long|bun|gray|bald
            outfit suit|shirt|hanbok|hoodie|apron|coat|gown|jacket
            color  옷 색     tie    넥타이 색(없으면 생략)
            eye    눈동자색  glasses true|false   age young|adult|old
   scenes : 장면. bg 배경, time 시간대(dawn|day|dusk|night), year 자막,
            cast 무대에 세울 인물(왼쪽부터), fx 장면 내내 도는 효과,
            sign 가게(riceshop) 배경의 간판 글씨, beats 한 컷씩 넘어가는 대사.
            chapter 장면 앞에 뜨는 장 제목, kicker 그 위의 작은 글씨,
            past true 이면 회상(세피아 톤).
   narrator: 나레이션에 붙는 이름표 (예: '전단지'). 없으면 이름표 없이.
   ending : 마지막 화면과 요약 쇼츠 끝에 남는 한 줄
   hook   : 쇼츠 첫 화면에 크게 박히는 한 줄
   format : 요약 쇼츠 형식 — cold(결말부터) | quiz(누구일까?) | numbers(숫자로 보는)
            | manga(만화 컷) | chronicle(연대기, 기본)
            climax [장면, 컷] cold 형식에서 먼저 보여 줄 장면을 직접 지정
            quizHide quiz 형식에서 추가로 가릴 단어
   lessons: [제목, 설명, 장면 번호, 보통 사람의 방식]
            장면 번호(0부터)는 레슨 쇼츠에서 그 교훈을 보여 줄 장면,
            보통 사람의 방식은 VS·착각 깨기 형식에서 대비되는 한 줄입니다.
   beat   : n    나레이션
            who  말하는 사람(cast 키) + t 대사 + face 표정
                 (normal|smile|laugh|shock|angry|sad|determined|think|cry)
            fx   이번 컷 효과 (flash|shake|speed|sparkle|money|fire|rain|paper|petal|zoom)
            big  화면 가운데 크게 박히는 한 줄
   ----------------------------------------------------------------
   사실관계(연도·숫자·사건)는 자서전·언론 인터뷰·회사 공시로 공개된 내용만
   썼습니다. 대사와 장면 설정(포장마차의 밤, 전단지의 시점, 가상의 고객 등)은
   그 사실을 바탕으로 각색한 것이며 실제 발언 인용이 아닙니다. 실제 발언으로
   널리 알려진 말만 quote: true 로 표시했습니다.
   ================================================================ */

window.EPISODES = [
/* ---------------------------------------------------------------- 1 · 액자식 */
{
  id: 'chung',
  format: 'cold',
  title: '소 한 마리, 소 천 마리',
  hook: '소 판 돈 70원으로 현대를 세운 소년',
  person: '정주영',
  company: '현대그룹 창업자',
  years: '1915 – 2001',
  color: '#e8590c',
  mood: 'brave',
  logline: '1998년, 소 떼를 실은 트럭이 판문점을 넘는다. 맨 앞의 노인은 66년 전 아버지의 소 판 돈을 들고 도망친 소년이었다.',
  ending: '소 한 마리 값으로 시작한 인생이, 소 천 마리가 되어 돌아왔다.',
  cast: {
    juO:  { name: '정주영', hair: '#d9d6cf', style: 'gray', outfit: 'coat', color: '#3b3f4a', eye: '#3b2a1a', age: 'old' },
    ju:   { name: '정주영', hair: '#1a1a1a', style: 'short',  outfit: 'shirt',  color: '#d9cbb0', eye: '#3b2a1a', age: 'young' },
    juS:  { name: '정주영', hair: '#1a1a1a', style: 'part',   outfit: 'suit',   color: '#2b2f3a', tie: '#c92a2a', eye: '#3b2a1a', age: 'adult' },
    dad:  { name: '아버지', hair: '#3a3a3a', style: 'bun',    outfit: 'hanbok', color: '#e9e2cf', eye: '#2a1d12', age: 'old' },
    boss: { name: '쌀가게 주인', hair: '#555', style: 'bald', outfit: 'apron',  color: '#6b8e5a', eye: '#2a1d12', age: 'old' },
    lb:   { name: '롱바텀 회장', hair: '#c9b27c', style: 'gray', outfit: 'suit', color: '#3b3b48', tie: '#1c4a8a', eye: '#4a7ab5', age: 'old', glasses: true },
    crew: { name: '현장 직원', hair: '#222', style: 'spiky', outfit: 'jacket', color: '#f08c00', eye: '#2a1d12', age: 'young' }
  },
  scenes: [
    { chapter: '판문점', kicker: '1998년 6월', bg: 'border', time: 'day', year: '1998 · 판문점', cast: ['juO'], beats: [
      { n: '트럭 50대가 줄지어 군사분계선 쪽으로 다가온다. 짐칸마다 소가 실려 있다. 모두 500마리.', big: '소 500마리 · 트럭 50대' },
      { n: '맨 앞의 노인이 차에서 내려 북쪽을 바라본다. 여든을 넘긴 나이였다.' },
      { who: 'juO', face: 'think', t: '이제 그 한 마리가 천 마리의 소가 되어, 그 빚을 갚으러 꿈에 그리던 고향 산천을 찾아갑니다.', quote: true },
      { n: '빚. 그는 그 빚을 66년 동안 기억하고 있었다.', fx: 'zoom' }
    ]},
    { chapter: '소 판 돈 70원', kicker: '66년 전', past: true, bg: 'village', time: 'dawn', year: '1930년대 초 · 강원도 통천 아산리', cast: ['dad', 'ju'], fx: 'petal', beats: [
      { n: '강원도 통천의 가난한 농가. 소학교만 마친 장남은 신문에 실린 도시 이야기를 잊지 못했다.' },
      { who: 'ju', face: 'determined', t: '아버지, 저는 서울로 가겠습니다. 여기서 평생 흙만 파고 살 수는 없어요.' },
      { who: 'dad', face: 'angry', t: '장남이 농사를 안 지으면 이 집은 누가 지키냐!', fx: 'shake' },
      { n: '세 번 집을 나갔고, 세 번 모두 붙잡혀 돌아왔다.' },
      { n: '네 번째 새벽. 소년의 품에는 아버지가 소를 판 돈 70원이 들어 있었다.', fx: 'speed', big: '네 번째 가출' }
    ]},
    { chapter: '배달꾼', kicker: '서울', past: true, bg: 'riceshop', time: 'day', year: '1934 · 서울 쌀가게', cast: ['boss', 'ju'], beats: [
      { n: '서울에서 얻은 일은 쌀가게 배달. 자전거도 탈 줄 몰라 밤새 넘어지며 쌀가마니 싣는 법부터 익혔다.' },
      { who: 'ju', face: 'smile', t: '장부 정리도 제가 해 놓겠습니다. 쌀 한 되도 비지 않게요.' },
      { who: 'boss', face: 'shock', t: '창고가 이렇게 반듯한 건 처음 보는구먼…' },
      { n: '가게를 정리하게 된 주인은 아들이 아니라 배달꾼에게 가게를 넘겼다.', fx: 'sparkle' },
      { big: '1937 · 스물두 살, 가게 주인', fx: 'flash', n: '그러나 전시 쌀 배급제로 가게는 2년 만에 문을 닫는다.' }
    ]},
    { chapter: '불', kicker: '첫 번째 공장', past: true, bg: 'garage', time: 'night', year: '1940 · 자동차 수리공장', cast: ['ju'], fx: 'fire', beats: [
      { n: '빚을 얻어 인수한 자동차 수리공장. 문을 연 지 한 달도 안 돼 불이 났다.', fx: 'shake' },
      { who: 'ju', face: 'shock', t: '고객 차까지… 전부 타 버렸어.' },
      { who: 'ju', face: 'determined', t: '다시 빌리겠습니다. 이번엔 누구보다 빨리 고쳐서 갚겠습니다.', fx: 'speed' },
      { n: '그는 다시 돈을 빌려 공장을 세웠고, 제일 빨리 고치는 집으로 소문이 났다.' }
    ]},
    { chapter: '지폐 한 장', kicker: '런던', past: true, bg: 'bank', time: 'day', year: '1971 · 영국 런던', cast: ['lb', 'juS'], fx: 'rain', beats: [
      { n: '해방 뒤 건설로 회사를 키운 그는 이번엔 조선소를 짓겠다고 나선다. 배를 만들어 본 적도, 조선소도, 돈도 없었다.' },
      { who: 'lb', face: 'think', t: '배를 한 척도 만들어 본 적 없는 회사에 누가 돈을 빌려줍니까?' },
      { who: 'juS', face: 'determined', t: '회장님, 이 지폐를 보십시오.', fx: 'zoom', big: '500원 지폐 속 거북선' },
      { who: 'juS', face: 'smile', t: '우리는 1500년대에 이미 철갑선을 만든 민족입니다. 시작이 늦었을 뿐, 능력은 충분합니다.' },
      { who: 'lb', face: 'laugh', t: '…좋습니다. 추천서를 써 드리지요.', fx: 'sparkle' },
      { n: '추천서로 차관의 문이 열렸다. 그는 모래사장 사진 한 장과 설계도로 그리스 선주에게서 26만 톤급 유조선 두 척을 수주한다.' }
    ]},
    { chapter: '모래사장', kicker: '울산', past: true, bg: 'shipyard', time: 'dusk', year: '1972 ~ 1974 · 울산 미포만', cast: ['crew', 'juS'], beats: [
      { n: '조선소를 짓는 일과 배를 만드는 일을 동시에 했다. 도크가 완성되기 전에 이미 선체 블록이 쌓이고 있었다.' },
      { who: 'crew', face: 'sad', t: '회장님, 이 일정은 아무래도 불가능합니다…' },
      { who: 'juS', face: 'determined', t: '이봐, 해봤어?', quote: true, fx: 'speed', big: '이봐, 해봤어?' },
      { n: '1974년, 조선소 준공과 함께 1호선이 바다에 떴다. 착공 2년 3개월 만이었다.', fx: 'sparkle' }
    ]},
    { chapter: '다시, 판문점', kicker: '1998년 10월', bg: 'border', time: 'dusk', year: '1998 · 판문점', cast: ['juO'], fx: 'sparkle', beats: [
      { n: '넉 달 뒤, 501마리가 더 선을 넘었다. 두 번에 걸쳐 모두 1,001마리.', big: '소 1,001마리' },
      { who: 'juO', face: 'smile', t: '70원어치 소 한 마리였지. 빚은 이자까지 쳐서 갚는 거야.' },
      { n: '쌀가게 배달꾼은 자동차·조선·건설·중공업을 일군 기업인이 되어, 소를 몰고 고향 쪽으로 돌아갔다.' }
    ]}
  ],
  lessons: [
    ['신용이 첫 자본', '돈이 없던 배달꾼이 가게를 물려받은 이유는 장부와 창고였다.', 2, '돈이 없으면 장사를 못 한다고 생각한다'],
    ['실패는 수업료', '불탄 공장 앞에서 그가 한 일은 다시 빌리고, 더 빨리 고치는 것이었다.', 3, '공장이 불타면 거기서 멈춘다'],
    ['없는 것을 핑계로 멈추지 않기', '조선소도 없이 모래사장 사진으로 배를 팔았다.', 4, '조선소부터 지어야 배를 팔 수 있다고 생각한다']
  ],
  timeline: [
    ['1915', '강원도 통천 출생'], ['1937', '쌀가게 인수'], ['1940', '자동차 수리공장 인수·화재'],
    ['1947', '현대토건사 설립'], ['1967', '현대자동차 설립'], ['1972', '울산 조선소 착공'],
    ['1974', '조선소 준공·1호선 명명'], ['1998', '소떼 방북 (6월 500마리, 10월 501마리)']
  ],
  sources: '자서전 『이 땅에 태어나서』, 『시련은 있어도 실패는 없다』 및 언론 보도'
},

/* ---------------------------------------------------------------- 2 · 하룻밤 */
{
  id: 'seo',
  format: 'numbers',
  title: '포장마차의 밤',
  hook: '마흔셋에 잘린 임원이 세계 1호 바이오시밀러를',
  person: '서정진',
  company: '셀트리온 창업자',
  years: '1957 –',
  color: '#1c7ed6',
  mood: 'hope',
  logline: '외환위기로 회사가 무너진 뒤, 명함을 잃은 대우 사람들이 포장마차에 모였다. 새벽까지 이어진 그 술자리에서 한 회사가 시작된다.',
  ending: '그날 밤 포장마차에 모인 실업자들은, 13년 뒤 세계 최초가 됐다.',
  cast: {
    seoC: { name: '서정진', hair: '#1d1d1d', style: 'part', outfit: 'coat', color: '#4a4e5a', eye: '#2d1f14', age: 'adult' },
    seo:  { name: '서정진', hair: '#1d1d1d', style: 'part', outfit: 'suit', color: '#34405a', tie: '#1c7ed6', eye: '#2d1f14', age: 'adult' },
    mate: { name: '대우 동료', hair: '#2a2a2a', style: 'short', outfit: 'shirt', color: '#dfe7f2', tie: '#495057', eye: '#2d1f14', age: 'adult', glasses: true },
    mate2:{ name: '막내 동료', hair: '#3a2a1a', style: 'bowl', outfit: 'jacket', color: '#868e96', eye: '#2d1f14', age: 'young' },
    prof: { name: '미국 연구자', hair: '#a0714f', style: 'gray', outfit: 'gown', color: '#ffffff', eye: '#3d7a57', age: 'old', glasses: true },
    doubt:{ name: '투자자', hair: '#333', style: 'part', outfit: 'suit', color: '#222831', tie: '#868e96', eye: '#1d1d1d', age: 'adult' }
  },
  scenes: [
    { chapter: '명함이 사라진 날', kicker: '밤 9시', bg: 'pojang', time: 'night', year: '1998 · 외환위기', cast: ['mate', 'seoC', 'mate2'], beats: [
      { n: '외환위기가 대우를 무너뜨렸다. 30대에 대우자동차 최연소 임원이 됐던 그도 하루아침에 직장을 잃었다.' },
      { who: 'mate', face: 'sad', t: '명함을 내밀 데가 없네요. 이제 저는 뭐라고 소개해야 합니까.' },
      { who: 'mate2', face: 'cry', t: '애가 내년에 학교 들어가는데…' },
      { who: 'seoC', face: 'think', t: '…한 잔 더 합시다. 오늘은 그냥 마십시다.' }
    ]},
    { chapter: '뭘 해서 먹고살까', kicker: '밤 11시', bg: 'pojang', time: 'night', year: '1998 · 포장마차', cast: ['mate', 'seoC', 'mate2'], beats: [
      { who: 'mate2', face: 'normal', t: '다들 치킨집 한다던데요. 저희도 그거라도…' },
      { who: 'mate', face: 'angry', t: '이 나이에 누가 우릴 다시 뽑아 줘!', fx: 'shake' },
      { who: 'seoC', face: 'determined', t: '뽑아 줄 데가 없으면, 우리가 회사를 만들면 됩니다. 여기 있는 사람들 다 일 잘하잖아요.' },
      { big: '동료 10명 · 자본금 5천만 원', fx: 'flash', n: '이듬해 그는 대우 출신 동료들과 작은 컨설팅 회사를 차린다.' }
    ]},
    { chapter: '10년 뒤를 묻는 사람', kicker: '새벽 1시', bg: 'pojang', time: 'night', year: '1998 · 포장마차', cast: ['mate', 'seoC'], beats: [
      { who: 'mate', face: 'think', t: '컨설팅으로 평생 먹고살 수는 없잖아요. 진짜 사업은 뭘로 하실 겁니까?' },
      { who: 'seoC', face: 'think', t: '모르겠어요. 그러니까 물어보러 다녀야죠. 앞으로 10년 동안 제일 크게 바뀔 산업이 뭔지.' },
      { who: 'mate', face: 'laugh', t: '누구한테요?' },
      { who: 'seoC', face: 'smile', t: '제일 잘 아는 사람들한테. 미국이든 어디든.', fx: 'speed' }
    ]},
    { chapter: '특허가 끝나는 날', kicker: '1년 뒤, 미국', bg: 'lab', time: 'day', year: '1999 ~ 2001 · 미국', cast: ['prof', 'seoC'], beats: [
      { n: '그는 1년 가까이 미국의 연구소와 제약회사를 찾아다니며 묻고 또 물었다.' },
      { who: 'prof', face: 'normal', t: '바이오 의약품입니다. 곧 대형 항체 의약품들의 특허가 줄줄이 만료되죠.' },
      { who: 'seoC', face: 'shock', t: '특허가 끝나면… 똑같은 약을 더 싸게 만들 수 있다는 뜻이군요.', fx: 'zoom' },
      { big: '바이오시밀러', fx: 'speed', n: '비싼 항체 의약품과 효능이 같은 복제약. 아직 아무도 제대로 해내지 못한 시장이었다.' }
    ]},
    { chapter: '전공자가 아니라서', kicker: '인천 송도', bg: 'office', time: 'night', year: '2002 · 셀트리온 설립', cast: ['doubt', 'seo'], beats: [
      { who: 'doubt', face: 'angry', t: '자동차 하던 사람이 바이오를 한다고요? 전공자도 아니잖습니까.' },
      { who: 'seo', face: 'determined', t: '그래서 더 절박하게 공부합니다. 모르는 건 제일 잘 아는 사람에게 묻고요.' },
      { n: '2002년 미국 백스젠과 손잡고 셀트리온을 세웠다. 송도에 대규모 세포배양 공장을 짓는 동안 자금은 늘 바닥이었다.', fx: 'shake' },
      { n: '돈을 구하러 다니던 시절에 대해 그는 훗날 사채까지 끌어다 버텼다고 회고했다.' }
    ]},
    { chapter: '세계 최초', kicker: '13년 뒤', bg: 'stage', time: 'dusk', year: '2012 · 램시마', cast: ['mate', 'seo'], fx: 'sparkle', beats: [
      { n: '2012년, 셀트리온의 램시마가 세계 최초의 항체 바이오시밀러로 허가를 받는다. 이듬해 유럽, 2016년에는 미국.', fx: 'flash', big: '세계 최초 항체 바이오시밀러' },
      { who: 'mate', face: 'laugh', t: '그날 포장마차에서 치킨집 했으면 어쩔 뻔했습니까.' },
      { who: 'seo', face: 'smile', t: '그랬으면 그 치킨집도 세계 최초로 만들었겠죠.' }
    ]}
  ],
  lessons: [
    ['위기는 판을 새로 짠다', '직장이 사라진 해에 새 산업을 찾기 시작했다.', 1, '직장을 잃으면 비슷한 자리부터 찾는다'],
    ['모르면 가장 잘 아는 사람에게', '1년 동안 전문가를 찾아다니며 산업 지도를 새로 그렸다.', 3, '모르는 분야는 처음부터 피한다'],
    ['아무도 없는 시장', '특허 만료라는 날짜가 정해진 기회를 먼저 봤다.', 5, '남들이 이미 돈 버는 시장에 뛰어든다']
  ],
  timeline: [
    ['1957', '충북 청주 출생'], ['1990년대', '대우자동차 임원'], ['1999', '동료들과 컨설팅 회사 설립'],
    ['2002', '셀트리온 설립'], ['2012', '램시마 국내 허가'], ['2013', '유럽 승인'], ['2016', '미국 FDA 승인']
  ],
  sources: '언론 인터뷰, 셀트리온 공시 및 보도자료'
},

/* ---------------------------------------------------------------- 3 · 교차 편집 */
{
  id: 'kim',
  format: 'manga',
  title: '1998과 2010',
  hook: 'PC방 사장님이 카톡을 만들기까지',
  person: '김범수',
  company: '한게임·카카오 창업자',
  years: '1966 –',
  color: '#f59f00',
  mood: 'bright',
  logline: '2010년, 공짜 메신저를 누가 쓰겠냐는 질문을 받은 남자는 12년 전 PC방을 떠올린다. 두 시간이 번갈아 흐르며 같은 답에 닿는다.',
  ending: '단칸방도 PC방도 카카오톡도, 결국 사람이 모이는 곳이었다.',
  cast: {
    kid:  { name: '김범수', hair: '#161616', style: 'bowl', outfit: 'shirt', color: '#f2e7c9', eye: '#2a1c10', age: 'young' },
    bs:   { name: '김범수', hair: '#161616', style: 'short', outfit: 'shirt', color: '#fff3bf', tie: '#f59f00', eye: '#2a1c10', age: 'adult', glasses: true },
    bsH:  { name: '김범수', hair: '#161616', style: 'short', outfit: 'hoodie', color: '#fcc419', eye: '#2a1c10', age: 'adult', glasses: true },
    mom:  { name: '어머니', hair: '#2b2b2b', style: 'bun', outfit: 'apron', color: '#e599a8', eye: '#2a1c10', age: 'adult' },
    gamer:{ name: 'PC방 손님', hair: '#5c3d2e', style: 'spiky', outfit: 'hoodie', color: '#4dabf7', eye: '#2a1c10', age: 'young' },
    dev:  { name: '개발자', hair: '#222', style: 'long', outfit: 'hoodie', color: '#ffd43b', eye: '#2a1c10', age: 'young' }
  },
  scenes: [
    { chapter: '여덟 식구 단칸방', kicker: '처음', past: true, bg: 'room', time: 'night', year: '1970 ~ 80년대 · 서울', cast: ['mom', 'kid'], beats: [
      { n: '할머니까지 여덟 식구가 한 방에서 잤다. 좁았지만, 늘 누군가 옆에 있었다.' },
      { who: 'mom', face: 'smile', t: '우리 범수는 공부로 이 방을 넓힐 거지?' },
      { who: 'kid', face: 'determined', t: '네. 재수를 하더라도 꼭 갈게요.' },
      { n: '재수 끝에 서울대에 들어갔고, 대학원에서 처음 PC통신을 만났다. 화면 너머에 사람들이 모여 있었다.', fx: 'sparkle' }
    ]},
    { chapter: '공짜 메신저를 누가 써요?', kicker: '2010', bg: 'room', time: 'day', year: '2010 · 아이위랩', cast: ['dev', 'bsH'], beats: [
      { n: '미국에서 아이폰을 본 그는 확신했다. 컴퓨터 다음은 손안의 컴퓨터다.' },
      { who: 'dev', face: 'think', t: '문자 한 통에 돈을 내는 세상인데, 공짜 메신저를 누가 쓸까요? 돈은 어떻게 벌고요?' },
      { who: 'bsH', face: 'think', t: '…1998년에도 누가 똑같이 물었었지.', fx: 'zoom' }
    ]},
    { chapter: 'PC방 사장님', kicker: '1998', past: true, bg: 'pcbang', time: 'night', year: '1998 · 한양대 앞 PC방', cast: ['gamer', 'bs'], beats: [
      { n: '삼성SDS를 나와 게임을 만들려니 돈이 없었다. 그래서 먼저 PC방을 차렸다.' },
      { who: 'gamer', face: 'laugh', t: '사장님! 여기 두 시간 연장이요! 친구들 온대요!' },
      { who: 'bs', face: 'think', t: '다들 혼자 하러 오는 게 아니야. 친구랑 같이 하러 오는 거지.' },
      { n: 'PC방 매출로 월급을 주고, 관리 프로그램까지 만들어 팔아 개발비를 댔다.', fx: 'money' }
    ]},
    { chapter: '친구가 거기 있으니까', kicker: '2010', bg: 'room', time: 'day', year: '2010 · 아이위랩', cast: ['dev', 'bsH'], beats: [
      { who: 'bsH', face: 'smile', t: '사람들은 공짜라서 오는 게 아니야. 친구가 거기 있으니까 오는 거지.' },
      { who: 'dev', face: 'shock', t: '그럼… 단체방이요. 가족방, 동창방, 회사방.' },
      { who: 'bsH', face: 'laugh', t: '그거야. 공짜로, 빠르게, 다 같이.', fx: 'speed', big: '2010.3 · 카카오톡 출시' }
    ]},
    { chapter: '한게임', kicker: '1998', past: true, bg: 'office', time: 'dusk', year: '1998.11 · 한게임 오픈', cast: ['bs'], beats: [
      { n: '고스톱과 바둑을 인터넷에서 같이 두는 무료 웹보드 게임. 입소문만으로 회원이 폭발적으로 늘었다.', fx: 'flash', big: '한게임 오픈' },
      { who: 'bs', face: 'determined', t: '사람이 모였으니, 이제 돈 버는 법을 찾으면 돼.' },
      { n: '2000년 검색 회사 네이버컴과 합쳐 NHN이 됐고, NHN은 한국 최대의 인터넷 회사가 됐다.' }
    ]},
    { chapter: '정상에서 내리다', kicker: '2007', past: true, bg: 'city', time: 'night', year: '2007 · NHN을 떠나며', cast: ['bs'], fx: 'rain', beats: [
      { n: '2007년, 그는 가장 잘나가던 회사의 대표 자리를 내려놓았다.' },
      { who: 'bs', face: 'think', t: '여기 있으면 편하겠지. 그런데 다음 시대는 여기서 안 보여.' }
    ]},
    { chapter: '1,000만', kicker: '2011', bg: 'city', time: 'day', year: '2011 · 출시 1년여 뒤', cast: ['dev', 'bsH'], beats: [
      { n: '출시 1년여 만에 가입자 1,000만 명. 문자메시지를 보내던 사람들이 단체방에 모여 있었다.', fx: 'sparkle', big: '가입자 1,000만' },
      { who: 'dev', face: 'laugh', t: '대표님, 그때 공짜 메신저 누가 쓰냐고 물은 사람도 지금은 쓰고 있겠죠?' },
      { who: 'bsH', face: 'smile', t: '아마 가족방에서.' }
    ]},
    { chapter: '다시, 사람들', kicker: '그 뒤', bg: 'stage', time: 'night', year: '2014 · 다음카카오', cast: ['bsH'], fx: 'sparkle', beats: [
      { n: '2014년 다음과 합병. 메신저 위에 택시·은행·결제·선물하기가 올라갔다.' },
      { who: 'bsH', face: 'smile', t: '단칸방 여덟 식구도, PC방 손님들도, 결국 같이 있고 싶었던 거야.' }
    ]}
  ],
  lessons: [
    ['현금 흐름부터', '게임 개발비는 PC방 매출로 댔다. 꿈과 월급을 동시에 지켰다.', 2, '투자부터 받고 나서 만들려고 한다'],
    ['무료로 사람을 모은다', '한게임도 카카오톡도 먼저 공짜로 사람을 모았다.', 4, '처음부터 돈을 받으려고 한다'],
    ['정점에서 떠날 용기', '최대 인터넷 회사를 떠나 스마트폰 시대에 다시 창업했다.', 5, '잘나갈 때는 자리를 지킨다']
  ],
  timeline: [
    ['1966', '서울 출생'], ['1992', '삼성SDS 입사'], ['1998', '한게임 창업'], ['2000', '네이버컴과 합병, NHN'],
    ['2007', 'NHN 대표 사임'], ['2010', '카카오톡 출시'], ['2014', '다음카카오 합병']
  ],
  sources: '언론 인터뷰 및 강연, 카카오 공시'
},

/* ---------------------------------------------------------------- 4 · 전단지의 시점 */
{
  id: 'baemin',
  format: 'quiz',
  quizHide: ['배민'],
  narrator: '전단지',
  title: '나는 전단지다',
  hook: '길바닥 전단지를 주워 4조 회사를',
  person: '김봉진',
  company: '배달의민족(우아한형제들) 창업자',
  years: '1976 –',
  color: '#12b886',
  mood: 'bright',
  logline: '태어나자마자 버려지는 게 일인 전단지 한 장이, 자기를 처음으로 주워 간 남자의 이야기를 들려준다.',
  ending: '버려지던 종이 한 장이, 앱의 첫 페이지가 됐다.',
  cast: {
    bj:   { name: '김봉진', hair: '#111', style: 'spiky', outfit: 'shirt', color: '#ffffff', eye: '#2a1c10', age: 'young', glasses: true },
    bjJ:  { name: '김봉진', hair: '#111', style: 'spiky', outfit: 'jacket', color: '#12b886', eye: '#2a1c10', age: 'adult', glasses: true },
    bro:  { name: '형', hair: '#222', style: 'short', outfit: 'hoodie', color: '#495057', eye: '#2a1c10', age: 'adult' },
    lend: { name: '빚쟁이', hair: '#333', style: 'bald', outfit: 'coat', color: '#343a40', eye: '#111', age: 'adult' },
    team: { name: '팀원', hair: '#7a4b2a', style: 'long', outfit: 'hoodie', color: '#63e6be', eye: '#2a1c10', age: 'young' }
  },
  scenes: [
    { chapter: '나는 전단지다', kicker: '프롤로그', bg: 'street', time: 'night', year: '어느 아파트 복도', cast: [], fx: 'paper', beats: [
      { n: '나는 전단지다. 치킨집, 중국집, 피자집. 이름만 다를 뿐 우리는 다 비슷하게 생겼다.' },
      { n: '현관문에 붙었다가 하루 만에 쓰레기통으로 가는 것. 그게 우리 일생이다.' },
      { n: '적어도, 그 남자를 만나기 전까지는 그랬다.', fx: 'zoom' }
    ]},
    { chapter: '팔리지 않던 예쁜 가구', kicker: '그 남자 이야기 · 2008', past: true, bg: 'riceshop', sign: '디자인 가구', time: 'dusk', year: '2008 · 가구점', cast: ['lend', 'bj'], beats: [
      { n: '그 남자에 대해 들은 이야기가 있다. 섬에서 태어나 디자이너가 됐고, 회사를 나와 가구점을 차렸다고.' },
      { who: 'lend', face: 'angry', t: '이번 달 이자는 언제 줄 거요?', fx: 'shake' },
      { who: 'bj', face: 'cry', t: '…조금만, 조금만 더 기다려 주세요.' },
      { big: '1년 만에 폐업', fx: 'flash', n: '예쁜 가구는 칭찬만 받고 팔리지 않았다. 그는 회사로 돌아가 월급으로 빚을 갚았다.' }
    ]},
    { chapter: '누군가 나를 떼어 냈다', kicker: '2010 · 어느 밤', bg: 'street', time: 'night', year: '2010 · 서울', cast: ['bro', 'bjJ'], fx: 'paper', beats: [
      { n: '그날 밤, 누군가 현관문에서 나를 떼어 냈다. 버리려는 줄 알았다.' },
      { who: 'bro', face: 'think', t: '배달 시킬 때마다 이거 찾느라 온 집을 뒤지잖아.' },
      { who: 'bjJ', face: 'shock', t: '형… 이거 쓰레기가 아니라 데이터야!', fx: 'zoom', big: '쓰레기가 아니라 데이터' },
      { n: '처음이었다. 누군가 나를 버리지 않고 주머니에 넣은 건.' }
    ]},
    { chapter: '한 장씩, 손으로', kicker: '그 뒤 몇 달', bg: 'office', time: 'night', year: '2010 · 작은 사무실', cast: ['bro', 'bjJ'], beats: [
      { n: '책상 위에 나 같은 전단지 수천 장이 쌓였다. 형제는 거리와 아파트를 돌며 우리를 주워 왔다.' },
      { who: 'bro', face: 'sad', t: '가게 이름, 전화번호, 메뉴… 눈이 빠질 것 같아.' },
      { who: 'bjJ', face: 'laugh', t: '이게 다 들어가면, 아무도 전단지를 안 찾아도 돼.' },
      { n: '내 전화번호가 한 글자씩 컴퓨터로 들어갔다.', fx: 'speed', big: '2010.6 · 앱 출시' }
    ]},
    { chapter: '말투', kicker: '회사가 커지며', bg: 'office', time: 'day', year: '2010년대 · 우아한형제들', cast: ['team', 'bjJ'], beats: [
      { who: 'team', face: 'laugh', t: '대표님, 광고 문구가 너무 B급인데요? "우리가 어떤 민족입니까"라니.' },
      { who: 'bjJ', face: 'laugh', t: '그게 우리야. 디자이너가 만든 회사는 말투부터 달라야지.', fx: 'sparkle' },
      { n: '가구점에서 팔리지 않던 그 감각이, 이번엔 사람들이 따라 하는 말투가 됐다고 한다.' }
    ]},
    { chapter: '첫 페이지', kicker: '2019 겨울', bg: 'stage', time: 'dusk', year: '2019 ~ 2021', cast: ['bjJ'], fx: 'sparkle', beats: [
      { n: '독일 딜리버리히어로가 그 회사를 기업가치 약 40억 달러에 인수한다고 발표했다.', fx: 'money', big: '약 40억 달러' },
      { n: '2021년 그는 재산의 절반 이상을 기부하겠다고 약속하며, 한국인 최초로 더기빙플레지에 이름을 올렸다.' },
      { n: '요즘은 현관문에 붙을 일이 거의 없다. 서운하냐고? 아니. 그 앱의 첫 페이지는 나였으니까.' }
    ]}
  ],
  lessons: [
    ['실패도 자산이 된다', '팔리지 않던 가구점의 디자인 감각이 배민의 브랜드가 됐다.', 4, '망한 가게는 잊고 싶은 과거로 남긴다'],
    ['불편함이 곧 시장', '온 집을 뒤지게 만들던 전단지가 사업 아이템이었다.', 2, '불편해도 원래 그런 거라며 넘어간다'],
    ['손으로 먼저', '데이터가 없으면 직접 주워 입력했다. 확장은 그다음이었다.', 3, '데이터가 없으면 시작을 못 한다고 생각한다']
  ],
  timeline: [
    ['1976', '전남 완도 출생'], ['2008', '가구점 창업·폐업'], ['2010', '배달의민족 출시'],
    ['2011', '우아한형제들 법인 설립'], ['2019', '딜리버리히어로 인수 발표'], ['2021', '더기빙플레지 서약']
  ],
  sources: '저서 『배민다움』, 언론 인터뷰 및 보도'
},

/* ---------------------------------------------------------------- 5 · 실패 일지 */
{
  id: 'toss',
  format: 'numbers',
  narrator: '일지',
  title: '실패 일지',
  hook: '치과의사 그만두고 8번 망한 남자',
  person: '이승건',
  company: '토스(비바리퍼블리카) 창업자',
  years: '1982 –',
  color: '#3182f6',
  mood: 'hope',
  logline: '치과의사를 그만둔 남자가 쓴 실패 일지. 여덟 장이 실패로 채워진 뒤, 아홉 번째 장에서 이야기가 바뀐다.',
  ending: '여덟 장의 실패 뒤, 아홉 번째 장에 토스가 있었다.',
  cast: {
    lee:  { name: '이승건', hair: '#111', style: 'part', outfit: 'gown', color: '#ffffff', eye: '#20160d', age: 'young' },
    leeH: { name: '이승건', hair: '#111', style: 'part', outfit: 'hoodie', color: '#3182f6', eye: '#20160d', age: 'young' },
    mem:  { name: '팀원', hair: '#3b2b20', style: 'bowl', outfit: 'hoodie', color: '#adb5bd', eye: '#20160d', age: 'young', glasses: true },
    user: { name: '인터뷰한 사용자', hair: '#6b4226', style: 'long', outfit: 'jacket', color: '#f783ac', eye: '#20160d', age: 'young' },
    reg:  { name: '규제 담당자', hair: '#2b2b2b', style: 'part', outfit: 'suit', color: '#343a40', tie: '#495057', eye: '#111', age: 'adult', glasses: true }
  },
  scenes: [
    { chapter: '일지를 쓰기 전', kicker: '진료실', bg: 'lab', time: 'day', year: '2000년대 · 치과의사', cast: ['lee'], beats: [
      { n: '서울대 치의학과를 나와 치과의사가 됐다. 누구나 부러워하는 안정된 길이었다.' },
      { who: 'lee', face: 'think', t: '평생 이 의자 옆에서… 정말 이게 내가 할 일일까.' },
      { n: '공중보건의 시절 수백 권의 책을 읽은 끝에, 그는 첫 일지를 펼쳤다.', fx: 'sparkle' }
    ]},
    { chapter: '모바일 SNS', kicker: '일지 #1', bg: 'room', time: 'night', year: '2011 · 비바리퍼블리카', cast: ['mem', 'leeH'], beats: [
      { n: '첫 서비스는 모바일 SNS. 가입자 수, 어제와 같음. 오늘도 같음.' },
      { who: 'mem', face: 'sad', t: '대표님, 오늘도 새 가입자가 없어요.' },
      { who: 'leeH', face: 'determined', t: '괜찮아. 다음 거 하자.', big: '실패 #1' }
    ]},
    { chapter: '모바일 투표 앱', kicker: '일지 #2', bg: 'room', time: 'night', year: '2012', cast: ['mem', 'leeH'], beats: [
      { n: '두 번째는 투표 앱. 사람들은 한 번 눌러 보고, 다시 오지 않았다.', big: '실패 #2' },
      { who: 'leeH', face: 'think', t: '재미있어 보이는 건 만들었는데… 없으면 안 되는 건 아니었어.' }
    ]},
    { chapter: '다 적기도 힘든 여섯 개', kicker: '일지 #3 ~ #8', bg: 'room', time: 'night', year: '2012 ~ 2014', cast: ['mem', 'leeH'], fx: 'rain', beats: [
      { n: '셋, 넷, 다섯… 여덟. 일지의 페이지가 실패로 채워졌다.', fx: 'shake', big: '실패 × 8' },
      { who: 'mem', face: 'cry', t: '대표님, 통장에 석 달 치 월급도 안 남았어요…' },
      { who: 'leeH', face: 'determined', t: '우리가 만들고 싶은 걸 만들어서 실패한 거야. 이번엔 사람들이 진짜 화내는 걸 찾자.' }
    ]},
    { chapter: '사람들이 화내는 곳', kicker: '일지 #9', bg: 'city', time: 'day', year: '2013 · 사용자 인터뷰', cast: ['user', 'leeH'], beats: [
      { who: 'user', face: 'angry', t: '친구한테 만 원 보내는데 공인인증서, 보안카드, 프로그램 설치까지… 이게 말이 돼요?' },
      { who: 'leeH', face: 'shock', t: '송금 한 번에 단계가 몇 개나 되는 거야…', fx: 'zoom' },
      { big: '비밀번호만으로 송금', fx: 'flash', n: '아홉 번째 장에는 처음으로 사용자의 말이 적혔다.' }
    ]},
    { chapter: '벽', kicker: '일지 #9, 둘째 장', bg: 'bank', time: 'day', year: '2014 · 규제', cast: ['reg', 'leeH'], beats: [
      { who: 'reg', face: 'normal', t: '현행 규정상 이 방식의 송금 서비스는 허용되지 않습니다.' },
      { n: '앱을 내놓자마자 규제에 막혀 서비스를 내려야 했다.', fx: 'shake' },
      { who: 'leeH', face: 'determined', t: '규칙이 바뀔 때까지 설명하고, 또 설명하겠습니다.' },
      { n: '핀테크 규제가 풀리기 시작한 2015년 2월, 토스가 정식 출시된다.', fx: 'speed', big: '2015.2 · 토스 출시' }
    ]},
    { chapter: '마지막 장', kicker: '그 뒤', bg: 'stage', time: 'night', year: '2015 ~ 2021', cast: ['leeH'], fx: 'sparkle', beats: [
      { n: '송금에서 시작해 증권, 결제, 그리고 2021년 인터넷전문은행까지.', fx: 'money' },
      { who: 'leeH', face: 'smile', t: '여덟 장을 빨리 쓴 게, 결국 가장 빠른 길이었어요.' }
    ]}
  ],
  lessons: [
    ['빨리, 많이 실패하기', '여덟 번의 실패가 아홉 번째를 위한 연습이었다.', 3, '한 번 실패하면 창업은 안 맞는다고 결론 낸다'],
    ['답은 사용자 입에서', '만들고 싶은 것 대신, 사람들이 화내는 지점을 찾았다.', 4, '내가 만들고 싶은 것부터 만든다'],
    ['규제는 벽이자 해자', '먼저 넘은 벽은 뒤따라오는 경쟁자를 막아 준다.', 5, '규제에 막히면 다른 아이템으로 바꾼다']
  ],
  timeline: [
    ['1982', '출생'], ['2011', '비바리퍼블리카 창업'], ['2011~14', '여덟 번의 실패'],
    ['2015', '토스 간편송금 출시'], ['2018', '기업가치 1조 원, 유니콘 등극'], ['2021', '토스뱅크 출범']
  ],
  sources: '언론 인터뷰 및 강연, 비바리퍼블리카 보도자료'
},

/* ---------------------------------------------------------------- 6 · 게임 스테이지 */
{
  id: 'krafton',
  format: 'quiz',
  quizHide: ['배틀그라운드', '블루홀', '테라'],
  title: 'STAGE 4',
  hook: '적자 회사를 살린 100명 중 최후의 1인',
  person: '장병규',
  company: '네오위즈·첫눈·크래프톤 창업자',
  years: '1973 –',
  color: '#f08c00',
  mood: 'brave',
  logline: '연구실을 나온 청년의 창업은 게임처럼 스테이지를 넘는다. 두 판을 깨고, 세 번째 판에서 보스를 만나고, 마지막 판은 100명이 떨어지는 섬이었다.',
  ending: '세 판을 버틴 사람만 마지막 판에 설 수 있었다.',
  cast: {
    jang: { name: '장병규', hair: '#151515', style: 'short', outfit: 'shirt', color: '#dbe4ff', eye: '#20160d', age: 'young', glasses: true },
    jangJ:{ name: '장병규', hair: '#151515', style: 'short', outfit: 'jacket', color: '#495057', eye: '#20160d', age: 'adult', glasses: true },
    dev:  { name: '개발 PD', hair: '#222', style: 'spiky', outfit: 'hoodie', color: '#f08c00', eye: '#20160d', age: 'adult' },
    cfo:  { name: '재무 담당', hair: '#333', style: 'part', outfit: 'suit', color: '#343a40', tie: '#868e96', eye: '#111', age: 'adult', glasses: true },
    gamer:{ name: '스트리머', hair: '#8a5a3b', style: 'long', outfit: 'hoodie', color: '#74c0fc', eye: '#355c8a', age: 'young' }
  },
  scenes: [
    { chapter: '연구실 탈출', kicker: 'STAGE 1', bg: 'lab', time: 'day', year: '1997 · KAIST', cast: ['jang'], beats: [
      { n: 'KAIST 전산학 박사과정. 논문보다 인터넷이 더 궁금했다.' },
      { who: 'jang', face: 'determined', t: '연구실에서 논문 쓰는 것보다, 지금 세상을 바꾸는 걸 만들고 싶어.' },
      { n: '스물넷에 박사과정을 그만두고 네오위즈를 공동 창업했다. 원클릭, 세이클럽.', fx: 'sparkle', big: 'STAGE CLEAR' }
    ]},
    { chapter: '검색 엔진', kicker: 'STAGE 2', bg: 'office', time: 'dusk', year: '2005 ~ 2006 · 첫눈', cast: ['jangJ'], beats: [
      { n: '두 번째 판은 검색 엔진 첫눈. 1년 만에 NHN이 약 350억 원에 사 갔다.', fx: 'money', big: 'STAGE CLEAR · 350억' },
      { who: 'jangJ', face: 'think', t: '두 판을 깼다. 그런데 세계에서 통하는 걸 만들어 본 적은 없어.' }
    ]},
    { chapter: '보스: 적자', kicker: 'STAGE 3', bg: 'office', time: 'night', year: '2007 ~ 2016 · 블루홀', cast: ['cfo', 'jangJ'], fx: 'rain', beats: [
      { n: '세 번째 판 블루홀. 대작 온라인 게임 테라를 만들었지만, 들인 돈만큼 벌지 못했다. 적자가 쌓였다.' },
      { who: 'cfo', face: 'sad', t: '대표님, 체력이 바닥입니다. 다음 게임이 안 되면 정말 끝이에요.', fx: 'shake', big: 'HP 바닥' },
      { who: 'jangJ', face: 'determined', t: '그럼 다음 판은 아무도 안 해 본 규칙으로 하자.' }
    ]},
    { chapter: '새 규칙', kicker: 'BONUS', bg: 'room', time: 'night', year: '2016', cast: ['dev', 'jangJ'], beats: [
      { who: 'dev', face: 'laugh', t: '100명이 섬에 떨어져서, 마지막 한 명만 살아남는 게임입니다.' },
      { who: 'jangJ', face: 'shock', t: '대작도 아니고, 1년 안에 만든다고?', fx: 'zoom' },
      { n: '이 장르를 처음 만든 개발자 브렌던 그린을 데려오고, 작은 팀이 1년 만에 게임을 완성했다.', fx: 'speed', big: '100명 중 1명' }
    ]},
    { chapter: '100명이 떨어지는 섬', kicker: 'FINAL STAGE', bg: 'pcbang', time: 'night', year: '2017.3 · 스팀 얼리 액세스', cast: ['gamer'], beats: [
      { who: 'gamer', face: 'laugh', t: '이겼닭! 오늘 저녁은 치킨이다!', fx: 'sparkle' },
      { n: '출시하자마자 전 세계 방송인들이 틀기 시작했다. 입소문이 입소문을 불렀다.' },
      { big: '동시접속 325만', fx: 'flash', n: '2018년 1월, 스팀 역사상 최고 동시접속 기록. 한국 게임이 세계 1위에 올랐다.' }
    ]},
    { chapter: '결과', kicker: 'RESULT', bg: 'stage', time: 'dusk', year: '2018 ~ 2021 · 크래프톤', cast: ['jangJ'], fx: 'sparkle', beats: [
      { n: '블루홀은 크래프톤으로 이름을 바꾸고 2021년 유가증권시장에 상장했다.', fx: 'money' },
      { who: 'jangJ', face: 'smile', t: '망할 뻔한 판이었기 때문에, 큰 회사가 안 하는 규칙으로 싸울 수 있었습니다.' }
    ]}
  ],
  lessons: [
    ['연쇄 창업의 근육', '네오위즈·첫눈·블루홀. 앞선 창업들이 네 번째 판을 버티는 힘이 됐다.', 1, '한 번 성공하면 거기서 은퇴한다'],
    ['막다른 길에서 새 장르', '적자 속에서 검증된 대작 대신, 아무도 크게 성공시키지 못한 장르에 걸었다.', 2, '위기일수록 검증된 안전한 길로 간다'],
    ['장르를 만든 사람에게 베팅', '배틀로얄을 처음 만든 사람을 직접 데려왔다.', 3, '경력 화려한 사람을 뽑는다']
  ],
  timeline: [
    ['1973', '대구 출생'], ['1997', '네오위즈 공동 창업'], ['2005', '첫눈 창업'], ['2006', '첫눈 NHN 매각'],
    ['2007', '블루홀 설립'], ['2017', '배틀그라운드 출시'], ['2018', '사명 크래프톤'], ['2021', '유가증권시장 상장']
  ],
  sources: '언론 인터뷰, 크래프톤 증권신고서 및 보도자료'
},

/* ---------------------------------------------------------------- 7 · 거울 구조 */
{
  id: 'smilegate',
  format: 'manga',
  title: '같은 게임, 두 나라',
  hook: '한국에서 망한 게임이 중국 국민게임이 된 이유',
  person: '권혁빈',
  company: '스마일게이트 창업자',
  years: '1974 –',
  color: '#e03131',
  mood: 'brave',
  logline: '한국 PC방에서 외면받은 총싸움 게임 하나. 똑같은 게임이 바다 건너 PC방에서는 전혀 다른 대접을 받는다.',
  ending: '한국에서 진 게임이 번 돈으로, 그는 한국에서 다시 싸웠다.',
  cast: {
    kwon: { name: '권혁빈', hair: '#141414', style: 'part', outfit: 'shirt', color: '#ffe3e3', eye: '#20160d', age: 'young', glasses: true },
    kwonS:{ name: '권혁빈', hair: '#141414', style: 'part', outfit: 'suit', color: '#2b2f3a', tie: '#e03131', eye: '#20160d', age: 'adult', glasses: true },
    staff:{ name: '개발자', hair: '#2b2b2b', style: 'bowl', outfit: 'hoodie', color: '#868e96', eye: '#20160d', age: 'young' },
    krg:  { name: '한국 게이머', hair: '#4a2f1f', style: 'short', outfit: 'hoodie', color: '#495057', eye: '#2a1c10', age: 'young' },
    tc:   { name: '중국 파트너', hair: '#101010', style: 'short', outfit: 'suit', color: '#1c3d6e', tie: '#e03131', eye: '#1d1410', age: 'adult' },
    fan:  { name: '중국 게이머', hair: '#1a1a1a', style: 'spiky', outfit: 'jacket', color: '#ff6b6b', eye: '#1d1410', age: 'young' }
  },
  scenes: [
    { chapter: '웃게 만드는 문', kicker: '시작', bg: 'room', time: 'night', year: '2002 · 스마일게이트 창업', cast: ['kwon'], beats: [
      { n: '서강대 전자공학과를 나온 젊은 개발자가 작은 사무실에서 회사를 차렸다.' },
      { who: 'kwon', face: 'determined', t: '사람들을 웃게 만드는 문, 스마일게이트. 이름부터 정했어.' }
    ]},
    { chapter: '텅 빈 서버', kicker: '한국 · 2007', bg: 'pcbang', time: 'night', year: '2007 · 크로스파이어 국내 출시', cast: ['krg', 'staff'], beats: [
      { n: '총싸움 게임 크로스파이어가 나왔다. 한국 PC방은 이미 다른 게임들이 꽉 잡고 있었다.' },
      { who: 'krg', face: 'normal', t: '이거요? 저는 하던 거 계속 할게요.' },
      { who: 'staff', face: 'sad', t: '대표님… 접속자가 거의 늘지 않습니다.', fx: 'shake', big: '외면' }
    ]},
    { chapter: '꽉 찬 PC방', kicker: '중국 · 2008', bg: 'pcbang', time: 'night', year: '2008 · 크로스파이어 중국 서비스', cast: ['fan', 'staff'], beats: [
      { n: '똑같은 게임, 똑같은 총, 똑같은 지도. 바다 건너 PC방의 풍경은 정반대였다.' },
      { who: 'fan', face: 'laugh', t: '이거 최고예요! 친구들 전부 이거 해요!', fx: 'sparkle' },
      { who: 'staff', face: 'shock', t: '대표님… 서버가 모자랍니다.', big: '열광' }
    ]},
    { chapter: '무엇이 달랐나', kicker: '갈림길', bg: 'bank', time: 'day', year: '2008 · 중국 파트너와', cast: ['tc', 'kwonS'], beats: [
      { who: 'tc', face: 'normal', t: '중국 PC방엔 사양 낮은 컴퓨터가 많습니다. 가볍고 빠른 총싸움이라면 해볼 만하죠.' },
      { who: 'kwonS', face: 'shock', t: '우리 게임이 가진 그대로… 거기선 장점이 되는군요.', fx: 'zoom' },
      { n: '중국 최대 인터넷 기업 텐센트와 손잡고 중국 전역으로 퍼져 나갔다.', fx: 'speed' }
    ]},
    { chapter: '국민 FPS', kicker: '중국', bg: 'city', time: 'night', year: '2008 ~', cast: ['fan'], beats: [
      { n: '동시접속자 수백만 명. 한국에서 외면받은 게임이 중국의 국민 FPS가 됐다.', fx: 'money', big: '중국 국민 FPS' },
      { who: 'fan', face: 'laugh', t: '이 게임 한국 거라면서요? 한국에서도 엄청 인기겠네요!' }
    ]},
    { chapter: '다시, 한국', kicker: '한국 · 2018', bg: 'stage', time: 'dusk', year: '2018 · 로스트아크', cast: ['kwonS'], fx: 'sparkle', beats: [
      { n: '그 돈을 쌓아 두지 않았다. 대작 MMORPG 로스트아크에 7년 넘게 쏟아부었다.' },
      { big: '2018 · 로스트아크 출시', fx: 'flash', n: '이번엔 한국에서였다.' },
      { who: 'kwonS', face: 'smile', t: '한국에서 진 게임이 벌어 온 돈으로, 한국에서 다시 싸운 겁니다.' }
    ]}
  ],
  lessons: [
    ['시장은 하나가 아니다', '한국에서 진 게임이 중국에서 이겼다. 제품보다 시장을 바꿨다.', 2, '안 팔리면 제품을 버린다'],
    ['현지의 강자와 손잡기', '텐센트의 유통망을 타고 중국 전역으로 퍼졌다.', 3, '해외도 혼자 힘으로 뚫으려고 한다'],
    ['번 돈은 다음 판에', '크로스파이어로 번 돈을 로스트아크에 7년 넘게 부었다.', 5, '크게 벌면 쌓아 두고 지킨다']
  ],
  timeline: [
    ['1974', '출생'], ['2002', '스마일게이트 설립'], ['2007', '크로스파이어 국내 출시'], ['2008', '중국 텐센트 서비스'],
    ['2018', '로스트아크 출시']
  ],
  sources: '언론 인터뷰 및 보도, 스마일게이트 보도자료'
},

/* ---------------------------------------------------------------- 8 · 고객의 하룻밤 */
{
  id: 'kurly',
  format: 'cold',
  climax: [5, 0],
  title: '밤 10시 반부터 아침 7시까지',
  hook: '밤 11시 주문, 아침 7시 도착을 처음 만든 사람',
  person: '김슬아',
  company: '마켓컬리 창업자',
  years: '1983 –',
  color: '#7048e8',
  mood: 'bright',
  logline: '이 이야기의 주인공은 창업자가 아니다. 장 볼 시간 없이 퇴근하는 어느 직장인의 하룻밤이다. 그 밤을 먼저 겪은 사람이 있었다.',
  ending: '그녀가 불편했던 밤이, 누군가의 아침을 바꿨다.',
  cast: {
    work: { name: '퇴근한 직장인', hair: '#3b2b20', style: 'long', outfit: 'coat', color: '#868e96', eye: '#2d1f14', age: 'young' },
    seul: { name: '김슬아', hair: '#1a1210', style: 'long', outfit: 'suit', color: '#343a40', eye: '#2d1f14', age: 'young' },
    seulK:{ name: '김슬아', hair: '#1a1210', style: 'long', outfit: 'jacket', color: '#7048e8', eye: '#2d1f14', age: 'adult' },
    ops:  { name: '물류 담당', hair: '#222', style: 'short', outfit: 'jacket', color: '#ffd43b', eye: '#20160d', age: 'adult' },
    pack: { name: '새벽 근무자', hair: '#2b2b2b', style: 'bowl', outfit: 'apron', color: '#7048e8', eye: '#20160d', age: 'young' }
  },
  scenes: [
    { chapter: '퇴근', kicker: '밤 10시 30분', bg: 'room', time: 'night', year: '서울의 어느 원룸 (가상의 인물)', cast: ['work'], beats: [
      { n: '이 이야기의 주인공은 창업자가 아니다. 매일 밤 이렇게 늦게 퇴근하는 수많은 사람들 중 한 명이다.' },
      { who: 'work', face: 'sad', t: '냉장고가 텅 비었네. 마트는 벌써 문 닫았고…' },
      { who: 'work', face: 'think', t: '내일 아침도 편의점 삼각김밥이겠다.' }
    ]},
    { chapter: '같은 밤을 보낸 사람', kicker: '몇 년 전', past: true, bg: 'office', time: 'night', year: '2000년대 · 해외 금융가', cast: ['seul'], beats: [
      { n: '민족사관고와 미국 웰즐리대를 나와 해외 금융·컨설팅 회사에서 일하던 사람도, 똑같은 밤을 보내고 있었다.' },
      { who: 'seul', face: 'sad', t: '월급은 많은데… 제대로 된 장 한 번 볼 시간이 없네.' },
      { who: 'seul', face: 'determined', t: '나 같은 사람이 분명 많을 거야. 퇴근길에 주문하고, 아침에 받을 수 있다면?' },
      { n: '2014년 그녀는 회사를 그만두고 창업했다.', fx: 'sparkle' }
    ]},
    { chapter: '주문', kicker: '밤 11시', bg: 'room', time: 'night', year: '서울의 어느 원룸', cast: ['work'], beats: [
      { who: 'work', face: 'shock', t: '지금 주문하면… 내일 아침 7시 도착이라고?', fx: 'zoom' },
      { n: '장바구니에 우유, 달걀, 샐러드를 담고 결제 버튼을 누른다. 그리고 불을 끈다.' }
    ]},
    { chapter: '불가능하다는 회의', kicker: '밤 11시, 몇 년 전', past: true, bg: 'office', time: 'night', year: '2015 · 샛별배송을 만들던 밤', cast: ['ops', 'seulK'], beats: [
      { who: 'ops', face: 'shock', t: '밤 11시에 주문을 받아서 아침 7시까지요? 물류센터가 밤새 돌아야 합니다!' },
      { who: 'seulK', face: 'determined', t: '그래서 아무도 안 하는 거예요. 우리가 하면 우리만의 시장이 되죠.', fx: 'speed' },
      { big: '밤 11시 주문 → 아침 7시 도착', fx: 'flash', n: '2015년, 마켓컬리의 샛별배송이 시작됐다.' }
    ]},
    { chapter: '잠들지 않는 곳', kicker: '새벽 3시', bg: 'warehouse', time: 'night', year: '물류센터', cast: ['pack', 'ops'], beats: [
      { n: '그 직장인이 잠든 사이, 도시 반대편의 물류센터는 가장 바쁜 시간을 보내고 있었다.' },
      { who: 'ops', face: 'determined', t: '냉장 상품 먼저 싣자! 아침 7시까지 문 앞이야!', fx: 'speed' },
      { who: 'pack', face: 'smile', t: '우유, 달걀, 샐러드. 이 집은 아침을 제대로 먹겠네요.' }
    ]},
    { chapter: '문 앞', kicker: '아침 7시', bg: 'street', time: 'dawn', year: '아파트 현관', cast: ['work'], fx: 'petal', beats: [
      { who: 'work', face: 'laugh', t: '자고 일어났더니 문 앞에 장바구니가 와 있네!', fx: 'sparkle' },
      { n: '보라색 상자 안에서 우유가 아직 차가웠다.' }
    ]},
    { chapter: '새벽배송이라는 말', kicker: '그 뒤', bg: 'stage', time: 'dawn', year: '2015 ~', cast: ['seulK'], fx: 'sparkle', beats: [
      { n: '대형 유통사들이 줄줄이 뒤따랐다. 새벽배송은 한 회사의 서비스 이름이 아니라 시장 이름이 됐다.', fx: 'money', big: '새벽배송' },
      { who: 'seulK', face: 'smile', t: '제가 불편했던 걸 풀었을 뿐인데, 모두가 같은 걸 불편해하고 있었어요.' }
    ]}
  ],
  lessons: [
    ['내 불편에서 시작', '장 볼 시간이 없던 자신의 문제가 곧 수많은 직장인의 문제였다.', 1, '사업 아이템은 멀리서 찾아야 한다고 생각한다'],
    ['상품이 아니라 시간을 판다', '밤 11시 주문, 아침 7시 도착. 고객의 아침 시간을 팔았다.', 3, '더 싸게, 더 많이 팔 궁리만 한다'],
    ['아무도 안 하는 어려운 일', '밤새 돌아가는 물류라는 어려움이 그대로 진입장벽이 됐다.', 4, '어렵고 힘든 일은 피한다']
  ],
  timeline: [
    ['1983', '출생'], ['2014', '회사 설립(더파머스, 현 컬리)'], ['2015', '마켓컬리 출시·샛별배송 시작'], ['그 뒤', '새벽배송 시장 경쟁 본격화']
  ],
  sources: '언론 인터뷰 및 보도, 컬리 보도자료'
}
];
