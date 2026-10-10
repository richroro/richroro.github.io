# 컵 홀더 고양이 (v1: "카페 사장님이 내 컵에만 / 그림을 그려 주는 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "long", "hair": "#2b2222", "top": "#ffd84d", "topKind": "hoodie"}}
BOSS = {"name": "사장님", "look": {"hairdo": "bun", "hair": "#5a3a22", "top": "#5a7a5a", "topKind": "apron", "accColor": "#e9dcc4", "glasses": True}}
CAFE = {"bg": "cafeteria", "sign": "작은 카페"}
EP = {
    "title": "카페 컵에 내 만화가 연재된다ㅋㅋ",
    "music": ("hyperfun", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "boss": ("InJoon", "+22%")},
    "cast": {"me": ME, "boss": BOSS},
    "beats": [
        ("a", "nar", "카페 컵에 내 만화가 연재돼.", "카페 컵에 / [내 만화]가 연재돼", {**CAFE, "chars": ["me:shock@0.28", "boss:smug@0.72"], "prop": "☕", "propX": 0.5, "tags": True}),
        ("b", "nar", "비 오는 날 노란 우산 쓰고 가는 단골 카페인데, 내 컵에만 그림을 그려 줘.", "단골 카페 사장님이 / 내 컵에만 [그림]", {"bg": "rain", "chars": [{"style": "chibi", **ME, "name": None, "mood": "happy", "x": 0.4, "size": 1.2, "hat": "☂️"}], "prop": "☕", "propX": 0.8}),
        ("c", "nar", "첫날은 노란 우산 쓴 고양이 한 마리.", "첫날은 / [노란 우산] 쓴 고양이", {"bg": "rain", "chars": [], "big": "🐱☂️"}),
        ("d", "nar", "다음엔 그 고양이가 버스를 타고, 그다음엔 비에 홀딱 젖어 있어.", "다음엔 [버스] 타고 / 그다음엔 비에 젖고", {"bg": "subway", "chars": [], "big": "🐱🚌💧"}),
        ("e", "me", "이거 무슨 만화지, 다음 화 궁금하네.", "\"이거 무슨 만화지? / [다음 화] 궁금하네\"", {**CAFE, "chars": ["me:think*1.5"], "prop": "☕", "propX": 0.85}),
        ("f", "nar", "근데 이상한 게, 그림은 비 오는 날에만 그려 주시는 거야.", "근데 그림은 / [비 오는 날]만 그려", {"bg": "rain", "chars": ["me:neutral@0.45*1.15"], "prop": "☕", "propX": 0.82}),
        ("g", "nar", "그래서 사장님한테 대놓고 물어봤어.", "그래서 사장님한테 / [대놓고] 물어봤어", {**CAFE, "chars": ["me:smug@0.3", "boss:neutral@0.72"]}),
        ("h", "me", "사장님, 이 고양이 누구예요?", "\"사장님, 이 고양이 / [누구]예요?\"", {**CAFE, "chars": ["me:think@0.45*1.45"], "prop": "🐱", "propX": 0.85}),
        ("i", "boss", "손님이요, 비 오는 날만 노란 우산 쓰고 오시잖아요.", "\"손님이요 / [노란 우산] 쓰고 오시잖아요\"", {**CAFE, "chars": ["boss:laugh*1.5"]}),
        ("j", "nar", "생각해 보니 나는 비 올 때만 그 카페에 갔어.", "생각해 보니 / 나는 [비 올 때]만 갔어", {"bg": "rain", "chars": [{"style": "chibi", **ME, "name": None, "mood": "shock", "x": 0.5, "size": 1.3, "hat": "☂️"}]}),
        ("k", "nar", "버스 놓친 날, 비 맞고 온 날까지 다 기억하신 거야.", "버스 놓친 날까지 / [다 기억]하신 거야", {**CAFE, "chars": ["boss:happy@0.6*1.2"], "prop": "📒", "propX": 0.2}),
        ("l", "me", "그럼 맑은 날은요?", "\"그럼 / [맑은 날]은요?\"", {**CAFE, "chars": ["me:shy@0.45*1.45"], "prop": "☀️", "propX": 0.85}),
        ("m", "boss", "맑은 날엔 안 오시잖아요.", "\"맑은 날엔 / [안 오시잖아요]\"", {**CAFE, "chars": ["boss:smug*1.5"]}),
        ("n", "nar", "그 뒤로는 맑은 날에도 가.", "그 뒤로는 / [맑은 날]에도 가", {"bg": "street", "chars": ["me:happy@0.4*1.2"], "prop": "☀️", "propX": 0.82}),
        ("o", "nar", "오늘 받은 컵에는, 고양이가 도장판을 들고 있었어.", "오늘 컵엔 고양이가 / [도장판]을 들고 있어", {**CAFE, "chars": [], "big": "🐱🎫"}),
        ("p", "nar", "도장 열 개, 꽉 채워서.", "도장 [10개] / 꽉 채워서", {**CAFE, "chars": ["me:love@0.3", "boss:laugh@0.72"], "prop": "🎫", "propX": 0.5}),
    ],
    "sfx": [["a", "pop", 0.25], ["c", "bubble", 0.25], ["i", "pop_hi", 0.25], ["p", "tada", 0.25]],
}
