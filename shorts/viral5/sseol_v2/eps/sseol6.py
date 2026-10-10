# 신입의 사탕 (v1: "신입이 매일 아침 팀장님 / 책상에 사탕을 두는 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#6f8fd9", "topKind": "shirt", "pants": "#3d4a66"}}
NEW = {"name": "신입", "look": {"hairdo": "bob", "hair": "#5a3a22", "top": "#ffd84d", "topKind": "cardigan", "acc": "pin", "accColor": "#ff5c8a"}}
BOSS = {"name": "팀장님", "look": {"hairdo": "side", "hair": "#555560", "top": "#2f3a4f", "topKind": "suit", "glasses": True, "accColor": "#d33b3b"}}
C1 = {"name": "동료", "look": {"hairdo": "spiky", "hair": "#7a4a2a", "top": "#9be07b", "topKind": "shirt"}}
C2 = {"name": "동료", "look": {"hairdo": "long", "hair": "#2b2222", "top": "#ff9eb5", "topKind": "shirt"}}
OF = {"bg": "office"}
EP = {
    "title": "신입이 매일 사탕을 두고 간다ㅋㅋ",
    "music": ("sneaky_snitch", 0.16),
    "voices": {"nar": ("Hyunsu", "+36%"), "me": ("Hyunsu", "+32%", "+8Hz"), "new": ("SunHi", "+30%", "+6Hz"), "c1": ("InJoon", "+30%"),
               "c2": ("SunHi", "+28%", "-6Hz"), "boss": ("InJoon", "+26%", "-8Hz")},
    "cast": {"me": ME, "new": NEW, "boss": BOSS, "c1": C1, "c2": C2},
    "beats": [
        ("a", "nar", "신입이 매일 사탕을 두고 가.", "신입이 매일 / [사탕]을 두고 가", {**OF, "chars": ["new:smug@0.3", "boss:think@0.72"], "prop": "🍬", "propX": 0.5, "tags": True}),
        ("b", "nar", "근데 회의 있는 날엔 꼭 제일 큰 사탕이야.", "근데 회의 있는 날엔 / 꼭 [제일 큰 사탕]", {**OF, "chars": ["boss:shock@0.3*1.1"], "prop": "🍬", "propX": 0.72}),
        ("c", "nar", "그러니까 사무실에 소문이 돌았지.", "사무실에 / [소문]이 돌았지", {**OF, "chars": ["c1:think@0.2*0.9", "c2:smug@0.5*0.9", "me:shock@0.8*0.9"]}),
        ("d", "c1", "저거 완전 아부 아니야?", "\"저거 완전 / [아부] 아니야?\"", {**OF, "chars": ["c1:smug*1.5"]}),
        ("e", "c2", "아니야, 짝사랑이래.", "\"아니야, / [짝사랑]이래\"", {**OF, "chars": ["c2:love@0.45*1.45"], "prop": "💘", "propX": 0.85}),
        ("f", "nar", "궁금해서 내가 직접 물어봤어.", "궁금해서 / [직접] 물어봤어", {**OF, "chars": ["me:think@0.3", "new:neutral@0.72"], "tags": True}),
        ("g", "me", "너 팀장님 좋아해?", "\"너 [팀장님] / 좋아해?\"", {**OF, "chars": ["me:smug*1.5"]}),
        ("h", "new", "아뇨, 회의 때문에요.", "\"아뇨. / [회의] 때문에요\"", {**OF, "chars": ["new:neutral@0.45*1.45"], "prop": "📋", "propX": 0.84}),
        ("i", "nar", "팀장님이 아침 굶은 날은, 회의가 두 시간을 넘는대.", "팀장님이 굶은 날 / 회의가 [2시간]", {"bg": "office", "place": "📍 회의실", "chars": ["boss:angry@0.5*1.2"], "big": "⏰ [2시간]", "steps": [0, 0, 9, 0.3]}),
        ("j", "nar", "신입이 석 달 동안 기록해서 알아낸 거래.", "석 달 동안 / [기록]해서 알아냈대", {"bg": "desk", "chars": ["new:think@0.3*1.1"], "prop": "📒", "propX": 0.72}),
        ("k", "nar", "그래서 사탕 하나로 당 충전을 시킨 거지.", "사탕 하나로 / [당 충전]", {**OF, "chars": ["boss:love@0.45*1.4"], "prop": "🍬", "propX": 0.85}),
        ("k2", "nar", "팀장님은 그것도 모르고, 신입이 자기 좋아하는 줄 알았대.", "팀장님은 신입이 / [자기 좋아하는] 줄 알았대", {**OF, "chars": ["boss:shy*1.5"], "prop": "💕", "propX": 0.85}),
        ("l", "nar", "효과는 진짜였어, 회의가 십 분 만에 끝나.", "효과는 진짜 / 회의가 [10분] 컷", {**OF, "place": "📍 회의실", "chars": ["boss:happy@0.25", "c1:shock@0.52*0.9", "c2:shock@0.8*0.9"]}),
        ("m", "boss", "자, 오늘은 여기까지.", "\"자, 오늘은 / [여기까지]\"", {**OF, "chars": ["boss:happy*1.55"]}),
        ("n", "nar", "지금은 사탕값을 팀원들이 나눠서 내.", "지금은 사탕값을 / 팀원들이 [나눠서] 내", {**OF, "chars": ["c1:happy@0.2*0.9", "me:happy@0.5*0.9", "c2:happy@0.8*0.9"], "prop": "🪙", "propX": 0.5}),
        ("o", "new", "팀장님, 오늘은 두 개 드세요, 회의 많아요.", "\"오늘은 [두 개] 드세요 / 회의 많아요\"", {**OF, "chars": ["new:smug@0.3", "boss:shock@0.72"], "prop": "🍬🍬", "propX": 0.5}),
    ],
    "sfx": [["a", "pop", 0.25], ["e", "bubble", 0.25], ["i", "k_error_003", 0.25], ["l", "tada", 0.25], ["o", "pop_hi", 0.3]],
}
