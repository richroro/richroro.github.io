# 은행에 출근하는 할아버지 (v1: "할아버지가 매일 같은 시간에 / 은행에 가는 이유", v2에서 이유를 다시 씀), 창작
ME = {"name": "나", "look": {"hairdo": "pony", "hair": "#3a2622", "top": "#9be07b", "topKind": "hoodie"}}
GPA = {"name": "할아버지", "look": {"age": "old", "hairdo": "side", "hair": "#e4e4ea", "top": "#3a3f5c", "topKind": "suit", "glasses": True, "accColor": "#c9a23a"}}
GMA = {"name": "할머니", "look": {"age": "old", "hairdo": "perm", "hair": "#d9d9de", "top": "#ff9eb5", "topKind": "cardigan"}}
CLK = {"name": "직원", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#2f5d8a", "topKind": "suit", "accColor": "#7cc4ff"}}
BANK = {"bg": "office", "place": "📍 동네 은행"}
EP = {
    "title": "할아버지가 은행에 출근한다ㅋㅋ",
    "music": ("scheming_weasel", 0.16),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "gpa": ("InJoon", "+22%", "-15Hz"), "gma": ("SunHi", "+22%", "-10Hz"), "clk": ("Hyunsu", "+26%", "+4Hz")},
    "cast": {"me": ME, "gpa": GPA, "gma": GMA, "clk": CLK},
    "beats": [
        ("a", "nar", "할아버지가 은행에 출근해.", "할아버지가 / 은행에 [출근]해", {**BANK, "chars": ["gpa:smug@0.4*1.2"], "prop": "🏦", "propX": 0.82, "tags": True}),
        ("b", "nar", "매일 오전 열 시, 천 원짜리 한 장 들고 나가셔.", "매일 오전 [10시] / 천 원 한 장 들고", {"bg": "door", "sign": "우리 집", "chars": ["gpa:happy@0.3*1.1"], "prop": "💵", "propX": 0.75}),
        ("c", "me", "할아버지 은퇴하신 지 딱 이십 년 됐는데?", "\"은퇴하신 지 / 딱 [20년] 됐는데?\"", {"bg": "home", "chars": ["me:think*1.5"]}),
        ("d", "nar", "궁금해서 몰래 따라가 봤어.", "궁금해서 / [몰래] 따라가 봤어", {"bg": "street", "chars": ["me:smug@0.2*0.9", "gpa:neutral@0.7*1.0!"]}),
        ("e", "clk", "할아버님, 오늘도 천 원이시죠?", "\"할아버님 / 오늘도 [천 원]이시죠?\"", {**BANK, "chars": ["clk:happy@0.3", "gpa:laugh@0.72"], "tags": True}),
        ("f", "nar", "직원들도 다 아는 단골이었어. 매일 딱 천 원만 넣고 가신대.", "매일 딱 [천 원]만 / 넣고 가신대", {**BANK, "chars": ["gpa:smug@0.45*1.4"], "prop": "💵", "propX": 0.85}),
        ("g", "me", "천 원을 왜 매일 넣지?", "\"천 원을 / 왜 [매일] 넣지?\"", {"bg": "street", "chars": ["me:think*1.5"]}),
        ("h", "nar", "할머니한테 물어봤더니, 할머니가 갑자기 딴청을 피우시더라.", "할머니한테 물었더니 / 갑자기 [딴청]", {"bg": "home", "chars": ["gma:shy@0.45*1.35"], "prop": "🎵", "propX": 0.84, "tags": True}),
        ("i", "nar", "그리고 내 스무 살 생일, 할아버지가 통장을 하나 주셨어.", "내 스무 살 생일 / 할아버지가 [통장]을", {"bg": "home", "place": "📍 내 생일", "chars": ["gpa:love@0.3", "me:shock@0.72"], "prop": "📒", "propX": 0.5}),
        ("j", "nar", "첫 줄 날짜가, 내가 태어난 날이었어.", "첫 줄 날짜가 / [내가 태어난 날]", {"bg": "home", "chars": [], "big": "📒 [첫 줄]"}),
        ("k", "nar", "이십 년 동안 하루도 안 빠지고, 천 원씩.", "20년 동안 하루도 안 빠지고 / [천 원]씩", {"bg": "home", "chars": ["me:cry*1.5"]}),
        ("l", "gpa", "대학 가면 노트북 사.", "\"대학 가면 / [노트북] 사\"", {"bg": "home", "chars": ["gpa:happy@0.45*1.45"], "prop": "💻", "propX": 0.85}),
        ("m", "nar", "근데 잔액을 보는데 좀 이상했어.", "근데 잔액이 / 좀 [이상했어]", {"bg": "home", "chars": ["me:think@0.35*1.25"], "prop": "📒", "propX": 0.8}),
        ("n", "nar", "칠백삼십만 원이어야 하는데, 삼백만 원밖에 없는 거야.", "730만 원이어야 하는데 / [300만 원]", {"bg": "home", "chars": ["me:shock*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("o", "gpa", "중간에 할머니가 몇 번 찾아 쓰셨다.", "\"중간에 [할머니]가 / 몇 번 찾아 쓰셨다\"", {"bg": "home", "chars": ["gpa:sad@0.3", "gma:smug@0.72"]}),
        ("p", "gma", "이자는 할미가 갚을게.", "\"[이자]는 / 할미가 갚을게\"", {"bg": "home", "chars": ["gma:laugh@0.45*1.45"], "prop": "💸", "propX": 0.85}),
    ],
    "sfx": [["a", "pop", 0.25], ["i", "tada", 0.25], ["n", "k_error_003", 0.25], ["p", "pop_hi", 0.3]],
}
