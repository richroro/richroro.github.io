# 할머니 벨소리 (v1: "외할머니가 내 전화만 / 3초 늦게 받는 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "bob", "hair": "#4a2f22", "top": "#7cc4ff", "topKind": "hoodie"}}
GMA = {"name": "외할머니", "look": {"age": "old", "hairdo": "perm", "hair": "#ececf0", "top": "#9be07b", "topKind": "cardigan", "glasses": True}}
MOM = {"name": "엄마", "look": {"hairdo": "long", "hair": "#2b2222", "top": "#ff9eb5", "topKind": "shirt"}}
KID = {"name": "8살 나", "look": {"age": "kid", "hairdo": "pigtails", "hair": "#4a2f22", "top": "#ffd84d", "topKind": "dress"}}
GH = {"bg": "home", "place": "📍 할머니 집"}
EP = {
    "title": "할머니가 내 전화만 늦게 받아ㅋㅋ",
    "music": ("scheming_weasel", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "kid": ("SunHi", "+24%", "+30Hz"), "gma": ("SunHi", "+22%", "-10Hz")},
    "cast": {"me": ME, "gma": GMA, "mom": MOM, "kid": KID},
    "beats": [
        ("a", "nar", "할머니가 내 전화만 늦게 받아.", "할머니가 / [내 전화만] 늦게 받아", {**GH, "chars": ["gma:smug@0.4*1.2"], "prop": "📱", "propX": 0.82, "tags": True}),
        ("b", "nar", "엄마가 걸면 한 번 만에 바로 받으시는데,", "엄마가 걸면 / [바로] 받으시는데", {"bg": "office", "chars": ["mom:happy@0.4*1.2"], "prop": "📱", "propX": 0.82, "tags": True}),
        ("c", "nar", "내가 걸면 꼭 한참 울리고 나서 받으셔.", "내가 걸면 / 꼭 [한참] 울려", {"bg": "bedroom", "chars": ["me:sad@0.35*1.2"], "prop": "📱", "propX": 0.8}),
        ("c2", "nar", "할머니 폰은 내가 여덟 살 때 같이 고른, 십 년 넘은 폰이야.", "할머니 폰은 / 내가 [8살] 때 고른 폰", {**GH, "chars": ["gma:happy@0.6*1.2"], "prop": "📱", "propX": 0.2}),
        ("d", "me", "할머니, 왜 내 전화만 늦게 받아?", "\"왜 [내 전화만] / 늦게 받아?\"", {"bg": "bedroom", "chars": ["me:angry*1.5"]}),
        ("e", "gma", "어, 늦게 받았나, 허허.", "\"어? 늦게 받았나? / [허허]\"", {**GH, "chars": ["gma:shy*1.5"]}),
        ("f", "nar", "그래서 할머니 집에 가서 몰래 전화를 걸어 봤어.", "할머니 집에서 / 몰래 [전화]를 걸었어", {**GH, "chars": ["me:smug@0.2*0.95", "gma:neutral@0.72"]}),
        ("g", "nar", "근데 할머니가 휴대폰을 보면서 가만히 듣고만 계시는 거야.", "할머니가 폰을 보며 / [가만히] 듣고만 계셔", {**GH, "chars": ["gma:love@0.45*1.35"], "prop": "📱", "propX": 0.84}),
        ("h", "kid", "할머니 사랑해, 할머니 최고.", "🎵 \"할머니 사랑해 / 할머니 [최고]\"", {**GH, "chars": [], "big": "🎵📱🎵"}),
        ("i", "nar", "여덟 살 때 내가 녹음해 드린 벨소리였어.", "[8살] 때 내가 / 녹음해 드린 벨소리", {"bg": "bedroom", "place": "📍 그때", "chars": ["kid:laugh@0.45*1.2"], "prop": "🎙️", "propX": 0.84, "tags": True}),
        ("j", "nar", "그걸 끝까지 들으려고, 일부러 늦게 받으신 거야.", "끝까지 들으려고 / [일부러] 늦게 받은 거야", {**GH, "chars": ["gma:happy@0.6*1.25"], "prop": "📱", "propX": 0.22}),
        ("k", "gma", "이거 들으면 하루 종일 기분이 좋아.", "\"이거 들으면 / 하루 종일 [기분 좋아]\"", {**GH, "chars": ["gma:laugh*1.5"]}),
        ("l", "nar", "그날 이후로 나는 하루에 세 번 전화해.", "그 뒤로 나는 / 하루에 [세 번] 전화해", {"bg": "bedroom", "chars": ["me:happy@0.4*1.2"], "big": "📞 × [3]"}),
        ("m", "me", "할머니, 밥 먹었어?", "\"할머니, / [밥] 먹었어?\"", {"bg": "street", "chars": ["me:love@0.45*1.4"], "prop": "📱", "propX": 0.85}),
        ("n", "nar", "근데 요즘은 할머니가 이러셔.", "근데 요즘은 / 할머니가 [이러셔]", {**GH, "chars": ["gma:smug@0.5*1.2"]}),
        ("o", "gma", "벨소리 끝나기 전에 끊어, 다시 걸어.", "\"벨소리 끝나기 전에 / [끊고 다시 걸어]\"", {**GH, "chars": ["gma:laugh@0.45*1.45"], "prop": "🎵", "propX": 0.85}),
    ],
    "sfx": [["a", "pop", 0.25], ["e", "boing", 0.25], ["h", "ding", 0.3], ["o", "pop_hi", 0.3]],
}
