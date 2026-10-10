# 은행에 출근하는 할아버지 (v1: "할아버지가 매일 같은 시간에 / 은행에 가는 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "pony", "hair": "#3a2622", "top": "#9be07b", "topKind": "hoodie"}}
GPA = {"name": "할아버지", "look": {"age": "old", "hairdo": "side", "hair": "#e4e4ea", "top": "#3a3f5c", "topKind": "suit", "glasses": True, "accColor": "#c9a23a"}}
CLK = {"name": "직원", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#2f5d8a", "topKind": "suit", "accColor": "#7cc4ff"}}
BANK = {"bg": "office", "place": "📍 동네 은행"}
EP = {
    "title": "할아버지가 은행에 출근한다ㅋㅋ",
    "music": ("scheming_weasel", 0.16),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "gpa": ("InJoon", "+12%", "-15Hz"), "clk": ("Hyunsu", "+26%", "+4Hz")},
    "cast": {"me": ME, "gpa": GPA, "clk": CLK},
    "beats": [
        ("a", "nar", "할아버지가 은행에 출근해.", "할아버지가 / 은행에 [출근]해", {**BANK, "chars": ["gpa:smug@0.4*1.2"], "prop": "🏦", "propX": 0.82, "tags": True}),
        ("b", "nar", "매일 오전 열 시만 되면 정장을 입고 나가셔.", "매일 오전 [10시] / 정장 입고 나가셔", {"bg": "door", "sign": "우리 집", "chars": ["gpa:happy@0.3*1.1"], "prop": "🕙", "propX": 0.75}),
        ("c", "me", "할아버지 은퇴하신 지 이십 년 됐는데?", "\"은퇴하신 지 / [20년] 됐는데?\"", {"bg": "home", "chars": ["me:think*1.5"]}),
        ("d", "nar", "궁금해서 몰래 따라가 봤어.", "궁금해서 / [몰래] 따라가 봤어", {"bg": "street", "chars": ["me:smug@0.2*0.9", "gpa:neutral@0.7*1.0!"]}),
        ("e", "nar", "할아버지가 들어간 곳은 동네 은행이었어.", "들어간 곳은 / 동네 [은행]", {**BANK, "chars": ["me:shock@0.5*1.2"]}),
        ("f", "gpa", "어서 오세요, 번호표 뽑으세요.", "\"어서 오세요 / [번호표] 뽑으세요\"", {**BANK, "chars": ["gpa:happy*1.5"], "prop": "🎫", "propX": 0.85}),
        ("g", "nar", "로비에서 손님들한테 인사를 하고 계신 거야.", "로비에서 손님들한테 / [인사]를 하셔", {**BANK, "chars": ["gpa:laugh@0.4*1.15"], "prop": "🙇", "propX": 0.8}),
        ("h", "nar", "직원들은 할아버지한테 커피까지 갖다드리고.", "직원들은 / [커피]까지 갖다드려", {**BANK, "chars": ["clk:happy@0.3", "gpa:love@0.72"], "prop": "☕", "propX": 0.5, "tags": True}),
        ("i", "clk", "지점장님, 오늘도 나오셨어요?", "\"[지점장님] / 오늘도 나오셨어요?\"", {**BANK, "chars": ["clk:laugh*1.5"]}),
        ("j", "me", "지점장님이라고?", "\"[지점장님]이라고?\"", {**BANK, "chars": ["me:shock*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("k", "nar", "알고 보니 할아버지가 삼십 년 전에 그 지점 지점장이셨대.", "할아버지가 30년 전 / 그 지점 [지점장]", {"bg": "office", "place": "📍 30년 전", "chars": ["gpa:smug@0.45*1.3"], "prop": "🏅", "propX": 0.84}),
        ("l", "nar", "은퇴하고도 손님 맞는 게 습관이 되신 거지.", "은퇴하고도 / [손님 맞이]가 습관", {**BANK, "chars": ["gpa:happy@0.6*1.2"], "prop": "👋", "propX": 0.25}),
        ("m", "nar", "오늘은 신입 직원 교육까지 하고 계셨어.", "오늘은 [신입 교육]까지", {**BANK, "chars": ["gpa:smug@0.3", "clk:shock@0.72"]}),
        ("n", "gpa", "도장은 이렇게, 똑바로 찍는 거야.", "\"도장은 이렇게 / [똑바로]\"", {**BANK, "chars": ["gpa:angry*1.5"], "prop": "🔴", "propX": 0.85}),
        ("o", "nar", "결국 은행에서 명예 지점장 명패까지 만들어 드렸대.", "결국 [명예 지점장] / 명패까지 받으셨어", {**BANK, "chars": ["gpa:cry@0.45*1.3"], "big": "명예 [지점장]"}),
        ("p", "gpa", "내일은 십 분 일찍 가야겠다.", "\"내일은 [10분] / 일찍 가야겠다\"", {"bg": "home", "chars": ["gpa:laugh@0.4*1.4"], "prop": "⏰", "propX": 0.85}),
    ],
    "sfx": [["a", "pop", 0.25], ["j", "k_error_003", 0.25], ["o", "tada", 0.25], ["p", "pop_hi", 0.3]],
}
