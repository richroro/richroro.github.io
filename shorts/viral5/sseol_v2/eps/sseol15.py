# 독서실 핫팩 (v1: "독서실 사장님이 매일 / 내 자리에 핫팩 두는 이유"), 창작
ME = {"name": "나", "look": {"age": "teen", "hairdo": "buzz", "hair": "#1f1f24", "top": "#ececf0", "topKind": "tee", "glasses": True}}
BOSS = {"name": "사장님", "look": {"hairdo": "bald", "hair": "#6a6a70", "top": "#8a6f55", "topKind": "cardigan", "mustache": True}}
ST = {"name": "다른 학생", "look": {"age": "teen", "hairdo": "pony", "hair": "#5a3a22", "top": "#ff9eb5", "topKind": "tee"}}
DESK = {"bg": "desk"}
EP = {
    "title": "8월인데 책상에 핫팩이 있다",
    "music": ("sneaky_snitch", 0.15),
    "voices": {"nar": ("InJoon", "+28%"), "me": ("InJoon", "+26%", "+10Hz"), "boss": ("Hyunsu", "+20%", "-8Hz"), "st": ("SunHi", "+28%", "+8Hz")},
    "cast": {"me": ME, "boss": BOSS, "st": ST},
    "beats": [
        ("a", "nar", "팔월인데 내 자리에 핫팩이 있어.", "8월인데 내 자리에 / [핫팩]이 있어", {**DESK, "chars": ["me:shock@0.3*1.2"], "prop": "♨️", "propX": 0.75, "tags": True}),
        ("b", "nar", "고삼 여름, 독서실에서 거의 살았거든.", "고3 여름 / 독서실에서 [살았어]", {**DESK, "chars": ["me:sleep@0.45*1.25"], "prop": "📚", "propX": 0.84}),
        ("c", "nar", "근데 매일 저녁 내 책상에 핫팩이 하나씩 놓여 있는 거야.", "매일 저녁 책상에 / [핫팩] 하나", {**DESK, "chars": [], "big": "♨️ × [30]"}),
        ("d", "me", "누가 장난치나? 한여름에 핫팩을?", "\"한여름에 / [핫팩]을?\"", {**DESK, "chars": ["me:angry*1.5"]}),
        ("e", "nar", "그래서 하루는 일찍 와서 숨어서 봤어.", "일찍 와서 / [숨어서] 봤어", {"bg": "night", "chars": ["me:think@0.2*0.9"], "prop": "👀", "propX": 0.55}),
        ("f", "nar", "핫팩을 놓고 간 사람은 독서실 사장님이었어.", "놓고 간 사람은 / [사장님]", {**DESK, "chars": ["boss:smug@0.4*1.3"], "prop": "♨️", "propX": 0.84, "tags": True}),
        ("g", "me", "사장님, 이거 왜 주시는 거예요?", "\"사장님, 이거 / [왜] 주시는 거예요?\"", {**DESK, "chars": ["me:shock@0.3", "boss:neutral@0.72"]}),
        ("h", "boss", "너 에어컨 바로 밑이잖아. 맨날 떨더라.", "\"너 [에어컨] 바로 밑이잖아 / 맨날 떨더라\"", {**DESK, "chars": ["boss:happy*1.5"], "prop": "❄️", "propX": 0.15}),
        ("i", "nar", "생각해 보니 나는 매일 담요를 두르고 공부했어.", "생각해 보니 / 매일 [담요] 두르고 공부", {**DESK, "chars": ["me:sick@0.45*1.35"], "prop": "❄️", "propX": 0.15}),
        ("j", "nar", "자리를 바꾸기엔 거기가 제일 조용했거든.", "자리 바꾸기엔 / 거기가 [제일 조용]해", {**DESK, "chars": ["me:sad@0.55*1.2"], "prop": "🤫", "propX": 0.2}),
        ("k", "nar", "다음 날 갔더니, 그 에어컨에 종이가 붙어 있었어.", "다음 날 그 에어컨에 / [종이]가 붙어 있었어", {"bg": "office", "chars": ["me:think@0.3*1.1"], "prop": "📄", "propX": 0.72}),
        ("l", "nar", "사장님 글씨로, 고장. 딱 두 글자.", "사장님 글씨로 / '[고장]'", {"bg": "office", "chars": [], "big": "[고장]"}),
        ("m", "st", "아 왜 저것만 고장이야, 더워.", "\"왜 저것만 [고장]이야 / 더워\"", {**DESK, "chars": ["st:angry*1.5"], "prop": "🥵", "propX": 0.85}),
        ("n", "nar", "애들은 덥다고 난리였는데, 사장님은 모른 척하셨어.", "애들은 덥다고 난리 / 사장님은 [모른 척]", {**DESK, "chars": ["st:sick@0.25*0.95", "boss:smug@0.72"]}),
        ("o", "nar", "그해 겨울, 나는 수능을 잘 봤어.", "그해 겨울 / [수능] 잘 봤어", {"bg": "street", "place": "📍 그해 겨울", "chars": ["me:laugh@0.45*1.3"], "prop": "💯", "propX": 0.84}),
        ("p", "nar", "그리고 그 에어컨은, 지금도 고장이래.", "그 에어컨은 / 지금도 [고장]이래", {"bg": "office", "chars": ["boss:laugh@0.4*1.35"], "prop": "📄", "propX": 0.84}),
    ],
    "sfx": [["a", "pop", 0.25], ["f", "k_error_003", 0.2], ["l", "boing", 0.3], ["o", "tada", 0.25]],
}
