# 아빠의 영어 공부 (v1: "환갑 아빠가 갑자기 / 영어 공부를 시작한 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "long", "hair": "#4a2f22", "top": "#ffd84d", "topKind": "tee", "pants": "#4a6fa8"}}
DAD = {"name": "아빠", "look": {"age": "old", "hairdo": "bald", "hair": "#8a8a90", "top": "#5b7fbf", "topKind": "shirt", "pants": "#3d3d48", "glasses": True}}
MOM = {"name": "엄마", "look": {"age": "old", "hairdo": "perm", "hair": "#4a3a34", "top": "#ff9eb5", "topKind": "cardigan"}}
BF = {"name": "남자친구", "look": {"hairdo": "side", "hair": "#2a2a30", "top": "#2f3a4f", "topKind": "suit", "accColor": "#7cc4ff"}}
EP = {
    "title": "60살 아빠가 영어 시작했다",
    "music": ("scheming_weasel", 0.16),
    "voices": {"nar": ("SunHi", "+28%"), "dad": ("InJoon", "+24%", "-15Hz"), "mom": ("SunHi", "+24%", "-10Hz"), "bf": ("Hyunsu", "+26%")},
    "cast": {"me": ME, "dad": DAD, "mom": MOM, "bf": BF},
    "beats": [
        ("a", "nar", "예순 살 아빠가 영어를 시작했어.", "60살 아빠가 / [영어]를 시작했어", {"bg": "home", "chars": ["dad:think@0.4*1.2"], "prop": "📖", "propX": 0.82, "tags": True}),
        ("b", "nar", "매일 새벽 다섯 시에 거실에서 중얼중얼하는 거야.", "매일 새벽 [5시] / 거실에서 중얼중얼", {"bg": "night", "place": "📍 새벽 5시", "chars": ["dad:think@0.6*1.1"], "prop": "📖", "propX": 0.25}),
        ("c", "dad", "아임, 수아스, 파더.", "\"아임... 수아스... / [파더]...\"", {"bg": "night", "chars": ["dad:smug*1.55"], "zoom0": 1.0, "zoom": 1.06}),
        ("d", "nar", "딱 그 한 문장만 백 번씩 연습하더라.", "딱 한 문장만 / [100번]씩", {"bg": "home", "chars": ["dad:sleep@0.3*1.0"], "big": "× [100]", "steps": [0, 0, 9, 0.2]}),
        ("e", "mom", "니 아빠 요즘 왜 저러니?", "\"니 아빠 요즘 / [왜 저러니?]\"", {"bg": "home", "chars": ["mom:think@0.3", "me:shy@0.72"], "tags": True}),
        ("f", "nar", "사실 그건 나 때문이었어.", "사실 그건 / [나] 때문이었어", {"bg": "bedroom", "chars": ["me:shy*1.5"]}),
        ("g", "nar", "다음 주에 남자친구가 인사 오기로 했거든.", "다음 주에 / [남자친구]가 인사 와", {"bg": "street", "chars": ["me:love@0.3", "bf:happy@0.72"], "tags": True}),
        ("h", "nar", "외국에서 자랐다고만 했더니, 아빠가 그날 영어 책을 산 거야.", "외국에서 자랐다고[만] 했더니 / 그날 영어 책 샀어", {"bg": "store", "sign": "동네 서점", "chars": ["dad:angry@0.4*1.2"], "prop": "📚", "propX": 0.82}),
        ("i", "nar", "드디어 그날, 아빠가 문을 열자마자.", "드디어 그날 / 문 열자마자", {"bg": "door", "sign": "우리 집", "chars": ["bf:neutral@0.25*1.1"], "prop": "🎁", "propX": 0.45}),
        ("j", "dad", "하이, 아임 수아스 파더.", "\"하이! / 아임 [수아스 파더]\"", {"bg": "door", "sign": "우리 집", "chars": ["dad:happy@0.4*1.45"], "prop": "👋", "propX": 0.84}),
        ("k", "bf", "안녕하세요 아버님, 말씀 편하게 하세요.", "\"안녕하세요 아버님 / [편하게] 하세요\"", {"bg": "home", "chars": ["bf:happy*1.5"]}),
        ("l", "nar", "남자친구는 한국말을 나보다 잘했어.", "남자친구는 / 한국말을 [나보다] 잘해", {"bg": "home", "chars": ["dad:shock@0.28", "bf:laugh@0.72"]}),
        ("m", "nar", "근데 아빠는 석 달 연습한 게 아까웠는지,", "근데 아빠는 / 석 달 연습이 [아까웠는지]", {"bg": "home", "chars": ["dad:sad@0.45*1.35"], "prop": "📖", "propX": 0.84}),
        ("n", "dad", "오케이, 땡큐, 굿.", "\"오케이... 땡큐... / [굿]\"", {"bg": "home", "chars": ["dad:smug*1.55"], "prop": "👍", "propX": 0.84}),
        ("o", "nar", "지금도 남자친구한테는 영어로만 말해.", "지금도 남친한텐 / [영어]로만 말해", {"bg": "home", "place": "📍 1년 뒤", "chars": ["dad:happy@0.25", "bf:laugh@0.55", "me:laugh@0.83*0.9"]}),
        ("p", "bf", "네 아버님, 저도 굿이에요.", "\"네 아버님 / 저도 [굿]이에요\"", {"bg": "home", "chars": ["bf:laugh@0.45*1.45"], "prop": "👍", "propX": 0.85}),
    ],
    "sfx": [["c", "bubble", 0.25], ["j", "pop_hi", 0.3], ["l", "k_error_003", 0.25], ["n", "boing", 0.3]],
}
