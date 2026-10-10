# 짝꿍 우유 (v1: "짝꿍이 1년 동안 / 내 우유를 마신 이유"), 창작
ME = {"name": "나", "look": {"age": "kid", "hairdo": "bob", "hair": "#4a2f22", "top": "#FFD84D", "topKind": "tee", "acc": "pin", "accColor": "#ff5c8a"}}
JJ = {"name": "짝꿍", "look": {"age": "kid", "hairdo": "spiky", "hair": "#1f1f24", "top": "#7cc4ff", "topKind": "hoodie"}}
CLASS = {"bg": "class", "sign": "우유 남기지 않기!"}
EP = {
    "title": "짝꿍이 내 우유를 1년 마셨다",
    "music": ("monkeys_spinning_monkeys", 0.18),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+25Hz"), "jj": ("InJoon", "+26%", "+25Hz"),
               "me2": ("SunHi", "+26%", "+6Hz"), "jj2": ("InJoon", "+26%")},
    "cast": {"me": ME, "jj": JJ,
             "me2": {"name": "나", "look": {"hairdo": "long", "hair": "#4a2f22", "top": "#ff9eb5", "topKind": "cardigan"}},
             "jj2": {"name": "남편", "look": {"hairdo": "side", "hair": "#1f1f24", "top": "#7cc4ff", "topKind": "tee"}}},
    "beats": [
        ("a", "nar", "짝꿍이 내 우유를 일 년 마셨어.", "짝꿍이 [내 우유]를 / 1년 마셨어", {**CLASS, "chars": ["me:shock@0.27", "jj:laugh@0.72"], "prop": "🥛", "tags": True}),
        ("b", "nar", "육학년 때 급식 우유만 나오면, 내 것까지 가져가서 원샷하는 거야.", "급식 우유만 나오면 / 내 것까지 [원샷]", {"bg": "cafeteria", "sign": "오늘의 급식", "chars": ["jj:smug@0.6*1.25"], "prop": "🥛🥛", "propX": 0.2, "steps": [0, "b.가져가서"]}),
        ("c", "me", "야, 그거 내 거잖아!", "\"야! 그거 / [내 거]잖아!\"", {**CLASS, "chars": ["me:angry*1.55"], "zoom0": 1.0, "zoom": 1.06}),
        ("d", "jj", "응 맛있더라.", "\"응. 맛있더라~\"", {**CLASS, "chars": ["jj:smug@0.42*1.45"], "prop": "🥛", "propX": 0.82}),
        ("e", "nar", "그렇게 일 년 동안 뺏긴 우유가 무려 이백 개야.", "1년 동안 뺏긴 우유 / 무려 [200개]", {**CLASS, "chars": ["me:sad@0.25*0.9", "jj:laugh@0.75*0.9"], "big": "🥛 × [200]", "steps": [0, 0, 9, "e.이백"]}),
        ("f", "me", "얘 진짜 우유에 미쳤나?", "\"얘 우유에 / [미쳤나?]\"", {**CLASS, "chars": ["me:think@0.36*1.35"], "prop": "🥛", "propX": 0.8}),
        ("g", "nar", "근데 이상한 게, 걔는 마실 때마다 표정이 썩어 있었거든.", "근데 걔는 마실 때마다 / 표정이 [썩어] 있었어", {"bg": "cafeteria", "sign": "오늘의 급식", "chars": ["jj:sick*1.45"], "prop": "🥛", "propX": 0.84}),
        ("g2", "nar", "한번은 마시고 나서 화장실로 뛰어가는 것도 봤어.", "마시고 나서 / [화장실로] 뛰는 것도 봤어", {"bg": "bath", "place": "📍 화장실", "chars": ["jj:shock@0.62!"], "prop": "💨", "propX": 0.25}),
        ("h", "nar", "그러다 졸업식 날, 걔가 할 말 있다고 날 부르더라.", "졸업식 날 / 걔가 [할 말] 있대", {"bg": "stage", "sign": "졸업을 축하합니다", "place": "📍 졸업식", "chars": ["me:neutral@0.3", "jj:shy@0.7"]}),
        ("i", "jj", "사실 나, 우유 못 먹어.", "\"사실 나... / [우유 못 먹어]\"", {"bg": "stage", "sign": "졸업을 축하합니다", "chars": ["jj:shy*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("j", "me", "뭐 그럼 그걸 왜 마셨는데?", "\"뭐? 그럼 / [왜] 마셨는데?\"", {"bg": "stage", "sign": "졸업을 축하합니다", "chars": ["me:shock*1.5"]}),
        ("k", "jj", "너 우유만 먹으면 배 아파서 보건실 갔잖아.", "\"너 우유만 먹으면 / [배 아파서] 보건실 갔잖아\"", {"bg": "hospital", "place": "📍 그때 보건실", "chars": ["me:sick@0.3*1.1"]}),
        ("l", "nar", "남기면 혼나니까, 몰래 대신 마셔 준 거였어.", "남기면 혼나니까 / [대신] 마셔 준 거야", {**CLASS, "chars": ["jj:cry@0.42*1.3"], "prop": "🥛🥛", "propX": 0.82}),
        ("m", "nar", "덕분에 걔는 일 년 만에 키가 십오 센티 컸고,", "덕분에 걔는 / 키가 [15cm] 컸고", {**CLASS, "chars": ["me:shock@0.3*0.8", "jj:smug@0.68*1.4"], "prop": "📏", "propX": 0.5}),
        ("n", "nar", "십오 년 지난 지금은...", "15년 지난 지금은...", {"bg": "home", "card": "15년 후...", "chars": []}),
        ("o", "me2", "여보, 우유 좀 남기라고!", "\"여보! / [우유 좀 남기라고!]\"", {"bg": "home", "place": "📍 우리 집", "chars": ["me2:angry@0.28", "jj2:laugh@0.72"], "prop": "🥛", "propX": 0.5, "tags": True}),
        ("p", "jj2", "습관 돼서 못 끊겠어.", "\"습관 돼서 / [못 끊겠어]\"", {"bg": "home", "chars": ["jj2:smug@0.4*1.45"], "prop": "🥛", "propX": 0.82}),
    ],
    "sfx": [["b.원샷", "pop", 0.3], ["c", "boing", 0.3], ["e.이백", "coin", 0.25], ["i.못", "k_error_003", 0.3], ["n", "whoosh", 0.3], ["o", "pop_hi", 0.3]],
}
