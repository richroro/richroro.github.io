# 새벽 3시 손님 (v1: "새벽 3시 할아버지에게 / 돈 받지 말라는 사장님", v2에서 이야기를 다시 씀), 창작
ME = {"name": "나", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#3cb4a5", "topKind": "vest", "pants": "#3d4a66"}}
BOSS = {"name": "사장님", "look": {"hairdo": "side", "hair": "#3a3030", "top": "#3cb4a5", "topKind": "vest", "mustache": True}}
BOSS_PJ = {"name": "사장님", "look": {"hairdo": "side", "hair": "#3a3030", "top": "#9fb8ff", "topKind": "tee", "mustache": True}}
GPA = {"name": "할아버지", "look": {"age": "old", "hairdo": "bald", "hair": "#d9d9de", "top": "#8a6f55", "topKind": "cardigan", "glasses": True}}
STORE = {"bg": "store", "sign": "24시 편의점"}
EP = {
    "title": "3시 손님한텐 돈 받지 말래",
    "music": ("scheming_weasel", 0.16),
    "voices": {"nar": ("Hyunsu", "+28%"), "me": ("Hyunsu", "+26%", "+8Hz"), "boss": ("InJoon", "+24%", "-4Hz"), "gpa": ("InJoon", "+10%", "-15Hz")},
    "cast": {"me": ME, "boss": BOSS, "boss2": BOSS_PJ, "gpa": GPA},
    "beats": [
        ("a", "nar", "세 시 손님한텐 돈 받지 말래.", "3시 손님한텐 / [돈 받지 말래]", {**STORE, "chars": ["me:shock@0.28", "gpa:happy@0.72"], "prop": "🥛🍞", "propX": 0.5}),
        ("b", "nar", "편의점 야간 알바 첫날, 사장님이 이상한 규칙을 줬어.", "야간 알바 첫날 / 사장님의 [이상한 규칙]", {**STORE, "chars": ["boss:smug@0.6*1.2"], "tags": True}),
        ("c", "boss", "세 시 할아버지는 그냥 보내. 나 찾으면 방금 나갔다고 해.", "\"할아버지 오시면 그냥 보내 / 나 찾으면 [방금 나갔다]고 해\"", {**STORE, "chars": ["boss:shy*1.55"], "zoom0": 1.0, "zoom": 1.06}),
        ("d", "nar", "진짜 세 시 딱 되니까 할아버지가 오셨어.", "진짜 [3시] 되니까 / 할아버지가 오셨어", {"bg": "night", "place": "📍 새벽 3시", "chars": ["gpa:neutral@0.62*1.1"], "prop": "🕒", "propX": 0.2, "tags": True}),
        ("e", "nar", "우유랑 빵 올려놓고, 가게를 한 바퀴 둘러보시더라.", "우유 하나, 빵 하나 / 가게를 [한 바퀴] 둘러봐", {**STORE, "chars": ["gpa:think@0.35*1.1"], "prop": "🥛🍞", "propX": 0.75}),
        ("f", "gpa", "학생, 사장은 오늘도 야간 하지?", "\"학생, 사장은 / 오늘도 [야간] 하지?\"", {**STORE, "chars": ["gpa:smug*1.55"]}),
        ("g", "me", "네, 방금 잠깐 나가셨어요.", "\"네, 방금 / [잠깐] 나가셨어요\"", {**STORE, "chars": ["me:shy@0.45*1.45"], "prop": "💦", "propX": 0.84}),
        ("h", "nar", "한 달 내내 사장님은 매일 방금 나간 사람이 됐어.", "한 달 내내 사장님은 / 매일 [방금 나간] 사람", {"bg": "night", "chars": ["gpa:neutral@0.3", "me:shy@0.72"], "big": "[30]일째"}),
        ("i", "nar", "근데 하루는 할아버지가 근무표를 넘겨 보시더니,", "하루는 할아버지가 / [근무표]를 넘겨 보더니", {**STORE, "chars": ["gpa:think@0.45*1.4"], "prop": "📋", "propX": 0.84}),
        ("j", "gpa", "야간에 사장 이름이 한 번도 없네?", "\"야간에 [사장 이름]이 / 한 번도 없네?\"", {**STORE, "chars": ["gpa:angry*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("k", "nar", "알고 보니 할아버지가 이 가게 진짜 주인이었어.", "알고 보니 할아버지가 / 가게 [진짜 주인]", {**STORE, "chars": ["gpa:smug@0.4*1.3", "me:shock@0.82*0.85"]}),
        ("l", "nar", "아들한테 가게 맡기면서, 야간은 꼭 직접 하라고 했는데,", "아들한테 맡기면서 / [야간은 직접] 하랬대", {"bg": "home", "place": "📍 1년 전", "chars": ["gpa:neutral@0.3", "boss:happy@0.72"]}),
        ("m", "nar", "사장님은 몰래 나를 쓰고 집에서 자고 있었던 거지.", "사장님은 몰래 / 집에서 [자고] 있었던 거야", {"bg": "bedroom", "chars": ["boss2:sleep@0.55*1.25"], "prop": "💤", "propX": 0.2}),
        ("n", "gpa", "학생은 잘못 없어. 내일도 나와.", "\"학생은 잘못 없어 / 내일도 [나와]\"", {**STORE, "chars": ["gpa:happy*1.5"]}),
        ("o", "nar", "그리고 다음 날부터 야간 알바가 한 명 늘었어.", "다음 날부터 / 야간 알바가 [한 명] 늘었어", {"bg": "night", "chars": ["me:laugh@0.3", "boss:cry@0.72"]}),
        ("p", "boss", "아버지, 저 원래 아침형 인간인데요.", "\"아버지, 저 원래 / [아침형 인간]인데요\"", {**STORE, "chars": ["boss:sleep@0.45*1.45"], "prop": "🥱", "propX": 0.85}),
    ],
    "sfx": [["a", "pop", 0.25], ["d", "whoosh", 0.25], ["j", "k_error_003", 0.25], ["o", "boing", 0.3]],
}
