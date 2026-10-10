# 초코와 아빠 퇴근 (v1: "우리 집 강아지가 / 아빠 퇴근을 미리 아는 이유"), 창작
ME = {"name": "나", "look": {"age": "teen", "hairdo": "long", "hair": "#3a2622", "top": "#ffd84d", "topKind": "hoodie"}}
MOM = {"name": "엄마", "look": {"hairdo": "bob", "hair": "#2b2222", "top": "#c9a7ff", "topKind": "cardigan"}}
DAD = {"name": "아빠", "look": {"hairdo": "side", "hair": "#2a2a30", "top": "#3a4766", "topKind": "suit", "accColor": "#d33b3b", "glasses": True}}
CHOCO = {"name": "초코", "look": {"kind": "dog", "hair": "#7a4a2a", "acc": "collar", "accColor": "#e8212e"}}
DOOR = {"bg": "door", "sign": "우리 집"}
EP = {
    "title": "강아지가 아빠 퇴근을 안다ㅋㅋ",
    "music": ("hyperfun", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+12Hz"), "mom": ("SunHi", "+22%", "-10Hz"), "dad": ("InJoon", "+22%", "-8Hz")},
    "cast": {"me": ME, "mom": MOM, "dad": DAD, "dog": CHOCO},
    "beats": [
        ("a", "nar", "강아지가 아빠 퇴근을 알아.", "강아지가 / 아빠 [퇴근]을 알아", {**DOOR, "chars": ["dog:happy@0.45*1.2"], "prop": "⏰", "propX": 0.84, "tags": True}),
        ("b", "nar", "우리 집 초코는 아빠 오기 딱 십 분 전에 현관에 앉아.", "아빠 오기 [10분 전] / 현관에 딱 앉아", {**DOOR, "chars": ["dog:neutral@0.3*1.0"], "big": "⏰ [-10분]"}),
        ("c", "nar", "근데 이상하게, 엄마가 외출한 날만 틀려.", "근데 엄마가 / [외출한 날]만 틀려", {"bg": "night", "chars": ["dog:smug@0.5*1.1"], "prop": "🌙", "propX": 0.2}),
        ("d", "me", "초코 너 초능력 있어?", "\"초코 너 / [초능력] 있어?\"", {"bg": "home", "chars": ["me:shock@0.3", "dog:smug@0.72*0.8"], "tags": True}),
        ("e", "nar", "그래서 하루는 초코를 하루 종일 지켜봤어.", "그래서 하루 종일 / [초코]를 지켜봤어", {"bg": "home", "chars": ["me:think@0.3*1.1", "dog:sleep@0.75*0.8"]}),
        ("f", "nar", "저녁 일곱 시 오십 분, 엄마 휴대폰이 울렸어.", "저녁 7시 50분 / [엄마 폰]이 울렸어", {"bg": "home", "chars": ["mom:shock@0.4*1.2"], "prop": "📱", "propX": 0.82, "tags": True}),
        ("g", "dad", "나 주차장이야, 올라간다.", "\"나 [주차장]이야 / 올라간다\"", {"bg": "street", "place": "📍 주차장", "chars": ["dad:happy@0.45*1.35"], "prop": "📱", "propX": 0.84, "tags": True}),
        ("h", "mom", "초코야, 아빠 오신다.", "\"초코야 / [아빠 오신다]~\"", {"bg": "home", "chars": ["mom:happy*1.5"]}),
        ("i", "nar", "그 말 듣자마자 초코가 현관으로 달려가.", "그 말 듣자마자 / 초코가 [현관]으로", {**DOOR, "chars": ["dog:laugh@0.4*1.3"], "prop": "💨", "propX": 0.85}),
        ("j", "nar", "초능력이 아니라, 엄마 말을 외운 거였어.", "초능력이 아니라 / 엄마 말을 [외운] 거야", {"bg": "home", "chars": ["dog:think*1.45"]}),
        ("k", "nar", "그래서 엄마가 장난으로 한번 그 말을 해 봤어.", "엄마가 [장난]으로 / 한번 말해 봤어", {"bg": "home", "chars": ["mom:smug@0.3", "dog:shock@0.72*0.8"]}),
        ("l", "mom", "초코야, 아빠 오신다.", "\"초코야 / [아빠 오신다]~\"", {"bg": "home", "chars": ["mom:laugh@0.45*1.45"]}),
        ("m", "nar", "초코는 현관에서 한 시간을 기다렸어.", "초코는 현관에서 / [한 시간]을 기다렸어", {**DOOR, "chars": ["dog:sad@0.4*1.2"], "big": "⏳ [1시간]"}),
        ("n", "nar", "그리고 진짜 아빠가 왔을 때,", "그리고 진짜 / [아빠]가 왔을 때", {**DOOR, "chars": ["dad:happy@0.4*1.3"], "prop": "👋", "propX": 0.84}),
        ("o", "nar", "초코는 아빠를 쳐다보지도 않았어.", "초코는 아빠를 / [쳐다보지도] 않았어", {"bg": "home", "chars": ["dad:shock@0.3", "dog:angry@0.72*0.85!"]}),
        ("p", "dad", "초코야, 나 왜 삐졌어?", "\"초코야 / 나 [왜] 삐졌어?\"", {"bg": "home", "chars": ["dad:cry*1.5"]}),
    ],
    "sfx": [["a", "pop", 0.25], ["f", "ding", 0.3], ["i", "whoosh", 0.25], ["o", "k_error_003", 0.25], ["p", "boing", 0.3]],
}
