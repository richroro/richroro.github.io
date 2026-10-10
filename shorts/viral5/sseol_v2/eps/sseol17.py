# 조카가 나보다 형이다 (새 편), 창작
ME = {"name": "나", "look": {"age": "teen", "hairdo": "short", "hair": "#2a2a30", "top": "#2f3e66", "topKind": "uniform", "accColor": "#3d6fd9"}}
NEP = {"name": "조카", "look": {"age": "teen", "hairdo": "spiky", "hair": "#6a3e26", "top": "#2f3e66", "topKind": "uniform", "accColor": "#3d6fd9"}}
SIS = {"name": "큰누나", "look": {"hairdo": "bob", "hair": "#2b2222", "top": "#ff9eb5", "topKind": "cardigan"}}
MOM = {"name": "엄마", "look": {"age": "old", "hairdo": "perm", "hair": "#5a4a44", "top": "#c9a7ff", "topKind": "apron"}}
SCH = {"bg": "class", "sign": "1학년 3반"}
EP = {
    "title": "조카가 나보다 3살 형이다",
    "music": ("sneaky_snitch", 0.16),
    "voices": {"nar": ("InJoon", "+28%"), "me": ("InJoon", "+26%", "+12Hz"), "nep": ("Hyunsu", "+26%", "+6Hz"), "sis": ("SunHi", "+24%", "-6Hz")},
    "cast": {"me": ME, "nep": NEP, "sis": SIS, "mom": MOM},
    "beats": [
        ("a", "nar", "조카가 나보다 세 살 많아.", "조카가 나보다 / [3살] 많아", {**SCH, "chars": ["me:shock@0.28*0.9", "nep:smug@0.72*1.15"], "tags": True}),
        ("b", "nar", "우리 집 족보는 좀 꼬였어.", "우리 집 족보는 / 좀 [꼬였어]", {"bg": "home", "chars": [], "big": "🌳❓"}),
        ("c", "nar", "큰누나랑 나는 스물다섯 살 차이거든.", "큰누나랑 나는 / [25살] 차이", {"bg": "home", "chars": ["sis:happy@0.3*1.15", "me:neutral@0.75*0.85"], "tags": True}),
        ("d", "nar", "누나가 아들 낳고 삼 년 뒤에, 엄마가 나를 낳았어.", "누나가 아들 낳고 / [3년 뒤] 내가 태어났어", {"bg": "hospital", "place": "📍 그해", "chars": ["mom:love@0.35*1.15", "sis:shock@0.75"], "tags": True}),
        ("e", "nar", "그래서 나보다 형인 조카가 생긴 거야.", "그래서 나보다 / [형인 조카]", {"bg": "home", "chars": ["nep:smug@0.4*1.35"], "prop": "❓", "propX": 0.84}),
        ("f", "nar", "문제는 걔랑 같은 학교를 다닌다는 거야.", "문제는 / [같은 학교]", {"bg": "street", "chars": ["me:sad@0.3", "nep:laugh@0.72"]}),
        ("g", "nep", "야, 일 학년. 매점 가서 빵 사 와.", "\"야, 1학년 / [빵] 사 와\"", {**SCH, "chars": ["nep:smug*1.5"], "prop": "🍞", "propX": 0.85}),
        ("h", "me", "삼촌한테 말버릇이 그게 뭐야?", "\"[삼촌]한테 / 말버릇이 그게 뭐야?\"", {**SCH, "chars": ["me:angry@0.45*1.45"]}),
        ("i", "nar", "근데 사 온 빵은 꼭 반 갈라서 나한테 줘.", "근데 사 온 빵은 / 꼭 [반 갈라서] 나 줘", {**SCH, "chars": ["me:cry@0.3*0.9", "nep:laugh@0.72*1.1"], "prop": "🍞", "propX": 0.5}),
        ("j", "nar", "근데 명절만 되면 상황이 바뀌어.", "근데 [명절]만 되면", {"bg": "home", "place": "📍 설날", "chars": ["me:smug@0.45*1.3"], "prop": "🧧", "propX": 0.84}),
        ("k", "sis", "삼촌한테 세배 안 하니?", "\"[삼촌]한테 / 세배 안 하니?\"", {"bg": "home", "chars": ["sis:angry*1.5"]}),
        ("l", "nar", "삼 학년 형이 일 학년 삼촌한테 절을 해.", "3학년이 / 1학년한테 [세배]", {"bg": "home", "chars": ["nep:sad@0.3*0.8", "me:smug@0.72*1.15"], "big": "🙇"}),
        ("m", "me", "그래, 올해도 공부 열심히 하고.", "\"그래, 올해도 / [공부] 열심히 하고\"", {"bg": "home", "chars": ["me:laugh*1.5"], "prop": "🧧", "propX": 0.85}),
        ("n", "nar", "그날 걔 표정이 진짜 겁나 썩었어.", "그날 걔 표정 / 진짜 [겁나 썩었어]", {"bg": "home", "chars": ["nep:angry*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("o", "nar", "근데 학교에서 누가 나한테 시비를 걸었을 때,", "근데 학교에서 누가 / 나한테 [시비] 걸 때", {**SCH, "chars": ["me:shock@0.3*0.9"], "prop": "💢", "propX": 0.75}),
        ("p", "nep", "우리 삼촌 건드리지 마.", "\"우리 [삼촌] / 건드리지 마\"", {**SCH, "chars": ["nep:smug@0.6*1.4", "me:love@0.2*0.85"]}),
    ],
    "sfx": [["a", "pop", 0.25], ["d", "whoosh", 0.25], ["g", "boing", 0.25], ["l", "tada", 0.2], ["p", "pop_hi", 0.3]],
}
