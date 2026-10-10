# 할머니가 우리 반 단톡방에 있다 (새 편), 창작
ME = {"name": "나", "look": {"age": "teen", "hairdo": "side", "hair": "#2a2a30", "top": "#2f3e66", "topKind": "uniform", "accColor": "#3d6fd9"}}
GMA = {"name": "할머니", "look": {"age": "old", "hairdo": "perm", "hair": "#e9e9ee", "top": "#ff9eb5", "topKind": "cardigan", "glasses": True}}
FR = {"name": "친구", "look": {"age": "teen", "hairdo": "spiky", "hair": "#6a3e26", "top": "#2f3e66", "topKind": "uniform", "accColor": "#3d6fd9"}}
FR2 = {"name": "반 친구", "look": {"age": "teen", "hairdo": "pony", "hair": "#2b2222", "top": "#2f3e66", "topKind": "uniform"}}
CH = "2학년 4반 단톡방"
EP = {
    "title": "할머니가 우리 단톡방에 있다ㅋㅋ",
    "music": ("hyperfun", 0.15),
    "voices": {"nar": ("InJoon", "+28%"), "me": ("InJoon", "+26%", "+12Hz"), "fr": ("Hyunsu", "+28%", "+10Hz"), "fr2": ("SunHi", "+28%", "+12Hz"), "gma": ("SunHi", "+16%", "-10Hz")},
    "cast": {"me": ME, "gma": GMA, "fr": FR, "fr2": FR2},
    "beats": [
        ("a", "nar", "할머니가 우리 반 단톡방에 있어.", "할머니가 우리 반 / [단톡방]에 있어", {"bg": "class", "chars": ["me:shock@0.24"], "chat": {"title": CH, "msgs": [{"name": "할미", "text": "얘들아 안녕", "color": "#ff9eb5"}]}, "steps": [0, 0, 9, 0, 0.1]}),
        ("b", "nar", "어느 날 단톡방에 할미라는 사람이 들어왔어.", "어느 날 단톡방에 / '[할미]'가 들어왔어", {"bg": "bedroom", "chars": ["me:think@0.24"], "chat": {"title": CH, "msgs": [{"name": "알림", "text": "[할미]님이 들어왔습니다", "color": "#d9d9d9"}]}, "steps": [0, 0, 9, 0, 0.3]}),
        ("c", "fr", "할미? 누구 할머니야?", "\"[할미]? / 누구 할머니야?\"", {"bg": "class", "sign": "2학년 4반", "chars": ["fr:laugh@0.45*1.45"], "tags": True}),
        ("d", "nar", "나는 바로 알았어. 우리 할머니 사진이었거든.", "나는 알았어 / [우리 할머니] 사진", {"bg": "bedroom", "chars": ["me:shock*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("e", "nar", "할머니가 내 폰으로 사진 보다가 초대를 눌렀대.", "할머니가 내 폰 보다가 / [초대]를 눌렀대", {"bg": "home", "place": "📍 할머니 방", "chars": ["gma:think@0.4*1.25"], "prop": "📱", "propX": 0.82, "tags": True}),
        ("f", "gma", "얘들아, 우리 손주 잘 부탁해.", "\"얘들아 / 우리 [손주] 잘 부탁해\"", {"bg": "home", "chars": ["gma:happy@0.24"], "chat": {"title": CH, "msgs": [{"name": "할미", "text": "얘들아 우리 손주 [잘 부탁해]", "color": "#ff9eb5"}]}, "steps": [0, 0, 9, 0, 0.2]}),
        ("g", "nar", "그 한마디에 단톡방이 난리가 났어.", "그 한마디에 / 단톡방이 [난리]", {"bg": "class", "chars": ["me:cry@0.24"], "chat": {"title": CH, "msgs": [{"name": "친구", "text": "ㅋㅋㅋㅋㅋㅋ", "color": "#7cc4ff"}, {"name": "반 친구", "text": "할머니 귀여워ㅠㅠ", "color": "#ffd84d"}, {"name": "친구", "text": "손주 누구임ㅋㅋ", "color": "#7cc4ff"}]}, "steps": [0, 0, 9, 0, 0.1, 0.6, 1.1]}),
        ("h", "fr2", "할머니 안녕하세요.", "\"할머니 / [안녕하세요]\"", {"bg": "class", "sign": "2학년 4반", "chars": ["fr2:happy@0.45*1.45"], "prop": "📱", "propX": 0.85, "tags": True}),
        ("i", "nar", "다음 날부터 할머니가 매일 아침 인사를 올려.", "다음 날부터 / 매일 [아침 인사]", {"bg": "home", "chars": ["gma:love@0.45*1.3"], "prop": "🌞📱", "propX": 0.85}),
        ("j", "gma", "오늘 비 온다. 우산 챙겨라.", "\"오늘 비 온다 / [우산] 챙겨라\"", {"bg": "home", "chars": ["gma:smug@0.24"], "chat": {"title": CH, "msgs": [{"name": "할미", "text": "오늘 비 온다 [우산] 챙겨라", "color": "#ff9eb5"}]}, "steps": [0, 0, 9, 0, 0.2]}),
        ("k", "nar", "근데 그날 진짜 비가 왔어.", "근데 그날 / 진짜 [비]가 왔어", {"bg": "rain", "chars": ["fr:shock@0.3", "fr2:shock@0.72"]}),
        ("l", "nar", "그때부터 애들이 할머니 말을 믿기 시작했어.", "애들이 할머니를 / [믿기] 시작했어", {"bg": "class", "sign": "2학년 4반", "chars": ["fr:love@0.3", "fr2:love@0.72"]}),
        ("m", "fr", "할머니, 내일 시험 나와요?", "\"할머니, 내일 / [시험] 나와요?\"", {"bg": "class", "chars": ["fr:think@0.24"], "chat": {"title": CH, "msgs": [{"name": "친구", "text": "할머니 내일 [시험] 나와요?", "color": "#7cc4ff"}]}, "steps": [0, 0, 9, 0, 0.2]}),
        ("n", "gma", "공부한 데서 나온다.", "\"[공부한 데]서 / 나온다\"", {"bg": "home", "chars": ["gma:laugh*1.5"]}),
        ("o", "nar", "지금은 반장 공지보다 할머니 말을 더 잘 들어.", "지금은 반장보다 / [할머니 공지]가 더 셈", {"bg": "class", "sign": "2학년 4반", "chars": ["gma:smug@0.5*1.2"], "big": "👑"}),
        ("p", "nar", "졸업식 날엔 우리 반 전부 할머니랑 사진 찍었어.", "졸업식 날 / 반 전체가 [할머니랑] 찰칵", {"bg": "stage", "sign": "졸업을 축하합니다", "chars": ["fr:laugh@0.18*0.85", "gma:laugh@0.5*0.95", "me:laugh@0.82*0.85"]}),
    ],
    "sfx": [["a", "ding", 0.25], ["d", "k_error_003", 0.25], ["g", "pop", 0.25], ["k", "boing", 0.25], ["p", "shutter", 0.3]],
}
