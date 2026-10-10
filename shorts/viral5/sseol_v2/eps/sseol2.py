# 반장 쪽지 (v1: "반장이 매일 내 책상에 / 쪽지를 두고 간 이유"), 창작
ME = {"name": "나", "look": {"age": "teen", "hairdo": "pony", "hair": "#3a2622", "top": "#2f3e66", "topKind": "uniform", "pants": "#2f3e66"}}
BJ = {"name": "반장", "look": {"age": "teen", "hairdo": "side", "hair": "#1f1f24", "top": "#2f3e66", "topKind": "uniform", "glasses": True, "accColor": "#3d6fd9"}}
FR = {"name": "짝꿍", "look": {"age": "teen", "hairdo": "bob", "hair": "#7a4a2a", "top": "#2f3e66", "topKind": "uniform", "acc": "headband", "accColor": "#ffd84d"}}
MOM = {"name": "엄마", "look": {"hairdo": "bun", "hair": "#2b2222", "top": "#ffb36b", "topKind": "apron", "accColor": "#fff3c4"}}
CL = {"bg": "class", "sign": "1학년 2반"}
EP = {
    "title": "반장 쪽지가 100일째 온다",
    "music": ("sneaky_snitch", 0.17),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+12Hz"), "fr": ("SunHi", "+28%", "+4Hz"), "mom": ("SunHi", "+20%", "-10Hz")},
    "cast": {"me": ME, "bj": BJ, "fr": FR, "mom": MOM},
    "beats": [
        ("a", "nar", "반장이 백 일째 쪽지를 줘.", "반장이 100일째 / [쪽지]를 줘", {**CL, "chars": ["me:shock@0.28", "bj:smug@0.72"], "prop": "📝", "propX": 0.5, "tags": True}),
        ("b", "nar", "아침마다 접힌 쪽지가 하나씩 있는 거야.", "아침마다 / 접힌 쪽지 [하나]", {"bg": "desk", "chars": ["me:think@0.3*1.2"], "prop": "📝", "propX": 0.75}),
        ("c", "nar", "물 많이 마셔, 우산 챙겨, 밥 꼭 먹어.", "'물 많이 마셔' / '우산 챙겨' / '밥 꼭 먹어'", {**CL, "chars": [], "big": "💧 ☂️ 🍚", "steps": [0, 0, 9, 0.1]}),
        ("d", "me", "이거 완전 나 좋아하는 거 아냐?", "\"이거 완전 / [나 좋아하는] 거 아냐?\"", {**CL, "chars": ["me:love*1.55"], "zoom0": 1.0, "zoom": 1.06}),
        ("e", "nar", "짝꿍도 옆에서 백 퍼센트라고 난리였어.", "짝꿍도 옆에서 / [100%]라고 난리", {**CL, "chars": ["fr:laugh@0.3", "me:shy@0.7"]}),
        ("f", "fr", "야, 이건 고백이야 고백.", "\"야, 이건 [고백]이야\"", {**CL, "chars": ["fr:smug@0.45*1.45"], "prop": "💌", "propX": 0.84}),
        ("g", "nar", "그래서 밤새 고민하다가 답장을 썼어.", "밤새 고민하다가 / [답장]을 썼어", {"bg": "bedroom", "place": "📍 내 방", "chars": ["me:think@0.35*1.1"], "prop": "✏️", "propX": 0.75}),
        ("h", "nar", "나도 너 좋아. 이렇게 딱 한 줄.", "'나도 너 좋아' / [딱 한 줄]", {"bg": "bedroom", "chars": ["me:shy@0.62*1.35"], "prop": "💌", "propX": 0.2}),
        ("i", "nar", "다음 날 반장 책상에 몰래 넣어 놨지.", "반장 책상에 / [몰래] 넣어 놨지", {**CL, "chars": ["me:smug@0.5*1.0!"], "prop": "💌", "propX": 0.8}),
        ("j", "nar", "근데 그날 저녁에 엄마가 날 부르는 거야.", "그날 저녁 / [엄마]가 날 불렀어", {"bg": "home", "place": "📍 우리 집", "chars": ["me:neutral@0.28", "mom:neutral@0.72"], "tags": True}),
        ("k", "mom", "너 반장한테 이런 거 썼니?", "\"너 반장한테 / [이런 거] 썼니?\"", {"bg": "home", "chars": ["mom:smug@0.42*1.45"], "prop": "💌", "propX": 0.82}),
        ("l", "nar", "엄마 손에 내 답장이 들려 있더라.", "엄마 손에 / [내 답장]이...", {"bg": "home", "chars": ["me:shock*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("m", "nar", "알고 보니 반장은 엄마 친구 아들이었고,", "알고 보니 반장은 / [엄마 친구 아들]", {"bg": "street", "chars": ["mom:happy@0.25", "bj:smug@0.5", "me:shock@0.78*0.9"]}),
        ("n", "nar", "그 쪽지는 전부 엄마가 부탁한 잔소리였어.", "쪽지는 전부 / 엄마의 [잔소리]", {"bg": "class", "chars": ["bj:happy@0.68*1.2"], "big": "📝 × [100]", "steps": [0, 0, 9, 0.2]}),
        ("o", "mom", "답장은 엄마가 잘 받았다.", "\"답장은 / [엄마가] 잘 받았다\"", {"bg": "home", "chars": ["mom:laugh@0.3", "me:cry@0.72"]}),
        ("p", "me", "아 진짜 이사 가고 싶다.", "\"아 진짜 / [이사] 가고 싶다\"", {"bg": "bedroom", "chars": ["me:cry*1.5"], "prop": "🏠", "propX": 0.84}),
    ],
    "sfx": [["a", "pop", 0.25], ["d", "bubble", 0.3], ["f", "pop_hi", 0.25], ["l", "k_error_003", 0.3], ["m", "whoosh", 0.25], ["o", "boing", 0.3]],
}
