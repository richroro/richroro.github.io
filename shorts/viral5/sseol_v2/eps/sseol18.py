# 엄마랑 같은 해에 입학했다 (새 편), 창작
ME = {"name": "나", "look": {"hairdo": "pony", "hair": "#3a2622", "top": "#7cc4ff", "topKind": "hoodie"}}
MOM = {"name": "엄마", "look": {"hairdo": "bob", "hair": "#2b2222", "top": "#ff8f6b", "topKind": "cardigan", "glasses": True}}
FR = {"name": "동기", "look": {"hairdo": "long", "hair": "#8a5a3a", "top": "#9be07b", "topKind": "tee", "acc": "headband", "accColor": "#ffd84d"}}
UNI = {"bg": "linear-gradient(180deg,#cfeaff 0%,#eef8ff 62%,#c9d6c0 62%,#b5c7a8 100%)"}
LIB = {"bg": "office", "place": "📍 도서관"}
EP = {
    "title": "엄마랑 같은 해에 입학했다ㅋㅋ",
    "music": ("hyperfun", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+10Hz"), "mom": ("SunHi", "+22%", "-8Hz"), "fr": ("SunHi", "+28%", "+16Hz")},
    "cast": {"me": ME, "mom": MOM, "fr": FR},
    "beats": [
        ("a", "nar", "엄마랑 같은 해에 입학했어.", "엄마랑 같은 해에 / [입학]했어", {**UNI, "chars": ["me:shock@0.28", "mom:laugh@0.72"], "prop": "🎓", "propX": 0.5, "tags": True}),
        ("b", "nar", "내가 대학 붙은 날, 엄마도 합격 문자를 받았거든.", "내가 대학 붙은 날 / 엄마도 [합격] 문자", {"bg": "home", "chars": ["me:happy@0.3*1.1"], "prop": "📱", "propX": 0.72}),
        ("c", "mom", "나도 붙었다. 사회복지학과.", "\"나도 붙었다 / [사회복지학과]\"", {"bg": "home", "chars": ["mom:laugh*1.5"], "prop": "📱", "propX": 0.85}),
        ("d", "nar", "엄마는 스무 살에 나를 가져서 대학을 못 갔대.", "엄마는 스무 살에 / 날 가져서 [대학] 못 갔대", {"bg": "hospital", "place": "📍 20년 전", "chars": ["mom:love@0.45*1.2"], "prop": "👶", "propX": 0.8}),
        ("e", "nar", "그래서 마흔에 수능을 다시 본 거야.", "그래서 [마흔]에 / 수능을 다시 봤어", {"bg": "desk", "chars": ["mom:think@0.45*1.25"], "prop": "📚", "propX": 0.84}),
        ("f", "nar", "근데 문제는, 학교까지 같다는 거야.", "근데 문제는 / [같은 학교]", {**UNI, "chars": ["me:shock*1.5"]}),
        ("g", "nar", "입학식 날, 엄마가 우리 과 단체 사진에 껴 있었어.", "입학식 날 / 엄마가 [단체 사진]에", {"bg": "stage", "sign": "입학을 환영합니다", "chars": ["fr:happy@0.2*0.85", "mom:laugh@0.5*0.85", "me:shock@0.8*0.85"]}),
        ("h", "me", "엄마, 여기 우리 과야.", "\"엄마, 여기 / [우리 과]야\"", {"bg": "stage", "sign": "입학을 환영합니다", "chars": ["me:angry@0.45*1.45"]}),
        ("i", "mom", "알아. 너 친구 사귀나 보러 왔지.", "\"알아 / 너 [친구] 사귀나 보러 왔지\"", {"bg": "stage", "sign": "입학을 환영합니다", "chars": ["mom:smug*1.5"]}),
        ("j", "nar", "도서관에 가면 엄마가 내 자리까지 맡아 놔.", "도서관 가면 / 엄마가 [내 자리]까지", {**LIB, "chars": ["mom:happy@0.35*1.15"], "prop": "📚", "propX": 0.78}),
        ("k", "nar", "학식 먹으면 엄마가 내 식판에 반찬을 덜어 줘.", "학식 먹으면 / [반찬]을 덜어 줘", {"bg": "cafeteria", "sign": "학생 식당", "chars": ["mom:love@0.3", "me:sad@0.72"], "prop": "🍱", "propX": 0.5}),
        ("l", "nar", "동기들은 엄마를 언니라고 불러.", "동기들은 엄마를 / [언니]라고 불러", {**UNI, "chars": ["fr:laugh@0.3", "mom:shy@0.72"], "tags": True}),
        ("m", "fr", "언니, 과제 같이 해요.", "\"언니, / [과제] 같이 해요\"", {**LIB, "chars": ["fr:love*1.5"]}),
        ("n", "nar", "그리고 첫 학기 성적표가 나왔어.", "그리고 첫 학기 / [성적표]", {"bg": "home", "chars": ["me:think@0.3*1.1", "mom:smug@0.72"], "prop": "📄", "propX": 0.5}),
        ("o", "nar", "엄마는 장학금, 나는 학사 경고.", "엄마는 [장학금] / 나는 학사 경고", {"bg": "home", "chars": ["mom:laugh@0.3*1.15", "me:cry@0.72*0.9"], "big": "🏆 vs ⚠️"}),
        ("p", "mom", "다음 학기엔 엄마랑 같이 공부하자.", "\"다음 학기엔 / 엄마랑 [같이] 공부하자\"", {"bg": "home", "chars": ["mom:happy@0.45*1.45"], "prop": "📚", "propX": 0.85}),
    ],
    "sfx": [["a", "pop", 0.25], ["c", "tada", 0.25], ["g", "shutter", 0.3], ["o", "k_error_003", 0.25]],
}
