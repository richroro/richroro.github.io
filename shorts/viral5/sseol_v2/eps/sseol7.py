# 소개팅과 보리 (v1: "소개팅 상대가 내 이름 듣고 / 웃음 참은 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "long", "hair": "#6a3e26", "top": "#ff9eb5", "topKind": "dress", "acc": "ribbon", "accColor": "#ffffff"}}
HE = {"name": "소개팅남", "look": {"hairdo": "side", "hair": "#1f1f24", "top": "#7a8fa8", "topKind": "shirt", "pants": "#2f3a4f"}}
DOG = {"name": "보리", "look": {"kind": "dog", "hair": "#c98a4b", "acc": "collar", "accColor": "#3d6fd9"}}
CAFE = {"bg": "linear-gradient(180deg,#fff1df,#ffe0c2)"}
EP = {
    "title": "소개팅남이 내 이름에 웃었다ㅋㅋ",
    "music": ("monkeys_spinning_monkeys", 0.16),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "he": ("InJoon", "+26%")},
    "cast": {"me": ME, "he": HE, "dog": DOG},
    "beats": [
        ("a", "nar", "소개팅 상대가 내 이름 듣고 웃었어.", "소개팅남이 / [내 이름]에 웃었어", {"bg": "cafeteria", "sign": "카페", "chars": ["me:shock@0.28", "he:laugh@0.72"], "tags": True}),
        ("b", "nar", "근데 그 사람 바지에 갈색 털이 잔뜩 묻어 있었어.", "근데 그 사람 바지에 / [갈색 털]이 잔뜩", {"bg": "street", "chars": ["me:shy@0.45*1.3"], "prop": "💓", "propX": 0.84}),
        ("c", "me", "안녕하세요, 보리예요.", "\"안녕하세요 / [보리]예요\"", {"bg": "cafeteria", "sign": "카페", "chars": ["me:happy*1.55"]}),
        ("d", "nar", "근데 상대가 갑자기 고개를 숙이는 거야.", "근데 상대가 / 갑자기 [고개]를 숙여", {"bg": "cafeteria", "sign": "카페", "chars": ["he:shy@0.55*1.3"], "prop": "☕", "propX": 0.2}),
        ("e", "nar", "어깨가 막 떨리고, 웃음을 참는 게 보였어.", "어깨가 떨리고 / [웃음]을 참더라", {"bg": "cafeteria", "sign": "카페", "chars": ["he:laugh*1.55"], "zoom0": 1.0, "zoom": 1.08}),
        ("f", "me", "제 이름이 웃겨요?", "\"제 이름이 / [웃겨요?]\"", {"bg": "cafeteria", "sign": "카페", "chars": ["me:angry@0.45*1.45"]}),
        ("g", "he", "아니요, 죄송해요. 진짜 아니에요.", "\"아니요 / [진짜 아니에요]\"", {"bg": "cafeteria", "sign": "카페", "chars": ["he:shock@0.5*1.4"], "prop": "💦", "propX": 0.85}),
        ("h", "nar", "기분 상해서 밥만 먹고 일어나려는데,", "기분 상해서 / [일어나려는데]", {"bg": "cafeteria", "sign": "카페", "chars": ["me:angry@0.3", "he:sad@0.72"]}),
        ("i", "nar", "그 사람이 휴대폰을 보여 주더라.", "그 사람이 / [휴대폰]을 보여 줬어", {"bg": "cafeteria", "sign": "카페", "chars": ["he:shy@0.3*1.15"], "prop": "📱", "propX": 0.72}),
        ("j", "nar", "화면에는 갈색 강아지 사진이 있었어.", "화면에는 / 갈색 [강아지]", {"bg": "home", "chars": ["dog:happy*1.4"]}),
        ("k", "he", "우리 집 강아지 이름이 보리예요.", "\"우리 강아지 이름이 / [보리]예요\"", {"bg": "cafeteria", "sign": "카페", "chars": ["he:laugh@0.45*1.45"], "prop": "🐶", "propX": 0.85}),
        ("l", "nar", "아침에도 보리야 밥 먹자, 하고 나왔대.", "아침에도 / '보리야 [밥 먹자]'", {"bg": "home", "place": "📍 그날 아침", "chars": ["he:happy@0.3", "dog:love@0.72*0.8"]}),
        ("m", "nar", "그 말에 나도 빵 터져서, 그날 세 시간을 떠들었어.", "나도 빵 터져서 / [3시간] 떠들었어", {"bg": "cafeteria", "sign": "카페", "chars": ["me:laugh@0.3", "he:laugh@0.72"], "prop": "☕☕", "propX": 0.5}),
        ("n", "nar", "그리고 삼 년 뒤, 우리는 결혼했어.", "3년 뒤 / 우리는 [결혼]했어", {"bg": "stage", "sign": "결혼을 축하합니다", "chars": ["me:love@0.3", "he:love@0.7"]}),
        ("o", "nar", "지금 우리 집에서 보리야, 하고 부르면,", "지금 우리 집에서 / '[보리야]' 부르면", {"bg": "home", "place": "📍 우리 집", "chars": ["he:smug@0.45*1.3"], "prop": "📣", "propX": 0.84}),
        ("p", "nar", "보리 둘이 동시에 달려와.", "보리 [둘]이 / 동시에 달려와", {"bg": "home", "chars": ["me:laugh@0.3", "dog:laugh@0.72*0.85"]}),
    ],
    "sfx": [["a", "pop", 0.25], ["e", "boing", 0.25], ["j", "bubble", 0.3], ["n", "tada", 0.25], ["p", "pop_hi", 0.3]],
}
