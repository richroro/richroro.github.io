# 초인종 소리 (v1: "택배 기사님이 우리 집만 / 오면 웃는 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "bun", "hair": "#3a2622", "top": "#c9a7ff", "topKind": "hoodie"}}
KID = {"name": "조카", "look": {"age": "kid", "hairdo": "pigtails", "hair": "#3a2622", "top": "#ffd84d", "topKind": "dress"}}
DRV = {"name": "기사님", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#5a8f6a", "topKind": "vest", "acc": "cap", "accColor": "#5a8f6a"}}
DOOR = {"bg": "door", "sign": "302호"}
EP = {
    "title": "택배 기사님이 매번 웃는다ㅋㅋ",
    "music": ("hyperfun", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "kid": ("SunHi", "+24%", "+32Hz")},
    "cast": {"me": ME, "kid": KID, "drv": DRV},
    "beats": [
        ("a", "nar", "택배 기사님이 우리 집만 오면 웃어.", "택배 기사님이 / 우리 집만 오면 [웃어]", {**DOOR, "chars": ["drv:laugh@0.3*1.1"], "prop": "📦", "propX": 0.5, "tags": True}),
        ("b", "nar", "현관 카메라 영상을 보다가 알게 됐어.", "현관 카메라 보다가 / 알게 됐어", {"bg": "home", "chars": ["me:think@0.3*1.15"], "prop": "📱", "propX": 0.72}),
        ("c", "nar", "기사님들이 초인종만 누르면 다 웃는 거야.", "초인종만 누르면 / 다들 [웃어]", {**DOOR, "chars": ["drv:happy@0.3*1.1"], "prop": "🔔", "propX": 0.84}),
        ("d", "nar", "배를 잡고 웃는 분도 있고, 손까지 흔드는 분도 있어.", "배 잡고 웃고 / [손]까지 흔들어", {**DOOR, "chars": ["drv:laugh*1.5"], "prop": "👋", "propX": 0.84}),
        ("e", "me", "우리 집 문에 뭐 붙었나?", "\"우리 집 문에 / [뭐] 붙었나?\"", {**DOOR, "chars": ["me:think@0.3*1.2"]}),
        ("f", "nar", "확인해 봤는데 문에는 아무것도 없었어.", "문에는 / [아무것도] 없었어", {**DOOR, "chars": ["me:shock@0.25*1.0"], "prop": "❓", "propX": 0.75}),
        ("g", "nar", "그래서 내가 직접 초인종을 눌러 봤지.", "그래서 직접 / [초인종]을 눌렀지", {**DOOR, "chars": ["me:neutral@0.3*1.2"], "prop": "👆", "propX": 0.85}),
        ("h", "kid", "택배 아저씨 사랑해요. 힘내세요.", "🔔 \"택배 아저씨 / [사랑해요] 힘내세요\"", {**DOOR, "chars": [], "big": "🔔 [♥]", "steps": [0, 0, 9, 0.1]}),
        ("i", "nar", "다섯 살 조카가 몰래 초인종 소리를 바꿔 놨던 거야.", "5살 조카가 / 초인종 소리를 [바꿨어]", {"bg": "home", "chars": ["kid:smug@0.5*1.2"], "prop": "🎙️", "propX": 0.84, "tags": True}),
        ("j", "me", "너 이거 언제 녹음했어?", "\"너 이거 / [언제] 녹음했어?\"", {"bg": "home", "chars": ["me:shock@0.3", "kid:happy@0.72*0.85"]}),
        ("k", "kid", "이모 잘 때. 아저씨들 힘들잖아.", "\"이모 잘 때 / 아저씨들 [힘들잖아]\"", {"bg": "home", "chars": ["kid:shy*1.5"]}),
        ("l", "nar", "지우려다가 그냥 놔뒀어.", "지우려다가 / [그냥] 놔뒀어", {"bg": "home", "chars": ["me:love@0.45*1.35"]}),
        ("m", "nar", "그리고 다음 날, 문 앞에 작은 봉지가 있었어.", "다음 날 문 앞에 / [작은 봉지]", {**DOOR, "chars": ["me:shock@0.25"], "prop": "🛍️", "propX": 0.62}),
        ("n", "nar", "안에는 사탕이랑 쪽지 한 장.", "사탕이랑 / [쪽지] 한 장", {"bg": "home", "chars": ["kid:shock@0.3*1.1"], "prop": "🍭💌", "propX": 0.72}),
        ("o", "nar", "나도 사랑해. 택배 아저씨가.", "'나도 사랑해' / - 택배 아저씨", {"bg": "home", "chars": [], "big": "💌 [사랑해]", "steps": [0, 0, 9, 0.1]}),
        ("p", "kid", "이모, 나 답장 또 녹음할래.", "\"이모, 답장 / [또 녹음]할래\"", {"bg": "home", "chars": ["kid:love@0.45*1.45"], "prop": "🎙️", "propX": 0.84}),
    ],
    "sfx": [["c", "ding", 0.3], ["g", "ding", 0.3], ["i", "k_error_003", 0.2], ["m", "pop", 0.25], ["o", "tada", 0.25]],
}
