# 새벽 3시 할아버지 (v1: "새벽 3시 할아버지에게 / 돈 받지 말라는 사장님"), 창작
ME = {"name": "나", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#3cb4a5", "topKind": "vest", "pants": "#3d4a66"}}
BOSS = {"name": "사장님", "look": {"hairdo": "side", "hair": "#3a3030", "top": "#3cb4a5", "topKind": "vest", "mustache": True}}
GPA = {"name": "할아버지", "look": {"age": "old", "hairdo": "bald", "hair": "#d9d9de", "top": "#8a6f55", "topKind": "cardigan", "glasses": True}}
STORE = {"bg": "store", "sign": "24시 편의점"}
EP = {
    "title": "새벽 3시에 할아버지가 온다",
    "music": ("scheming_weasel", 0.16),
    "voices": {"nar": ("Hyunsu", "+28%"), "me": ("Hyunsu", "+26%", "+8Hz"), "boss": ("InJoon", "+24%", "-4Hz"), "gpa": ("InJoon", "+10%", "-15Hz")},
    "cast": {"me": ME, "boss": BOSS, "gpa": GPA},
    "beats": [
        ("a", "nar", "할아버지한텐 돈 받지 말래.", "할아버지한텐 / [돈 받지 말래]", {**STORE, "chars": ["me:shock@0.28", "gpa:happy@0.72"], "prop": "🥛🍞", "propX": 0.5, "tags": True}),
        ("b", "nar", "편의점 야간 알바 첫날, 사장님이 그러더라.", "야간 알바 첫날 / [사장님]이 그러더라", {**STORE, "chars": ["boss:smug@0.6*1.2"], "tags": True}),
        ("c", "boss", "새벽 세 시 할아버지는, 그냥 보내.", "\"새벽 3시 할아버지는 / [그냥] 보내\"", {**STORE, "chars": ["boss:neutral*1.55"], "zoom0": 1.0, "zoom": 1.06}),
        ("d", "nar", "진짜 세 시 딱 되니까 할아버지가 오셨어.", "진짜 [3시] 되니까 / 할아버지가 오셨어", {"bg": "night", "place": "📍 새벽 3시", "chars": ["gpa:neutral@0.62*1.1"], "prop": "🕒", "propX": 0.2}),
        ("e", "nar", "우유 하나랑 빵 하나만 딱 올려놓으시고.", "[우유] 하나 / [빵] 하나", {**STORE, "chars": ["gpa:happy@0.3*1.1"], "prop": "🥛🍞", "propX": 0.72}),
        ("f", "gpa", "학생, 얼마야?", "\"학생, / [얼마]야?\"", {**STORE, "chars": ["gpa:neutral*1.55"]}),
        ("g", "me", "그냥 가셔도 돼요.", "\"그냥 / [가셔도] 돼요\"", {**STORE, "chars": ["me:shy@0.45*1.45"]}),
        ("h", "gpa", "허허, 그래? 고마워.", "\"허허, 그래? / [고마워]\"", {**STORE, "chars": ["gpa:laugh@0.5*1.35"]}),
        ("i", "nar", "그렇게 한 달 내내 할아버지는 매일 오셨어.", "한 달 내내 / [매일] 오셨어", {"bg": "night", "chars": ["gpa:happy@0.3", "me:happy@0.72"], "big": "[30]일째"}),
        ("j", "nar", "근데 하루는 내 이름표를 빤히 보시더니,", "하루는 내 이름표를 / [빤히] 보시더니", {**STORE, "chars": ["gpa:think@0.45*1.45"], "prop": "🏷️", "propX": 0.84}),
        ("k", "gpa", "자네, 우리 아들 가게에서 일 잘하네.", "\"자네, [우리 아들 가게] / 일 잘하네\"", {**STORE, "chars": ["gpa:smug*1.55"]}),
        ("l", "nar", "할아버지는 사장님 아버지였던 거야.", "할아버지는 / [사장님 아버지]", {**STORE, "chars": ["gpa:laugh@0.28", "boss:happy@0.5", "me:shock@0.8*0.9"], "tags": True}),
        ("m", "nar", "새로 온 알바가 착한지 보러 오신 거였고.", "새 알바가 [착한지] / 보러 오신 거야", {"bg": "night", "chars": ["gpa:smug@0.55*1.25"], "prop": "🔍", "propX": 0.2}),
        ("n", "nar", "다음 달 월급날, 통장을 보는데,", "다음 달 월급날 / 통장을 봤는데", {"bg": "bedroom", "chars": ["me:think@0.3*1.1"], "prop": "📱", "propX": 0.72}),
        ("o", "nar", "시급이 올라 있었어.", "[시급]이 올랐어", {"bg": "bedroom", "chars": ["me:shock*1.55"], "big": "💸 [UP]"}),
        ("p", "boss", "우리 아버지가 너 칭찬 엄청 하시더라.", "\"아버지가 너 / [칭찬] 엄청 하시더라\"", {**STORE, "chars": ["boss:laugh@0.3", "me:love@0.72"]}),
    ],
    "sfx": [["a", "pop", 0.25], ["d", "whoosh", 0.25], ["l", "k_error_003", 0.25], ["o", "coin", 0.3]],
}
