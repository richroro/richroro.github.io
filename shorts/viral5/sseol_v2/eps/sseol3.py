# 할머니와 운동화 (v1: "할머니가 비 오는 날마다 / 내 운동화를 숨긴 이유"), 창작
ME = {"name": "나", "look": {"age": "kid", "hairdo": "buzz", "hair": "#2a1f1a", "top": "#9be07b", "topKind": "tee", "pants": "#3d5a8a"}}
GMA = {"name": "할머니", "look": {"age": "old", "hairdo": "perm", "hair": "#ececf0", "top": "#c9a7ff", "topKind": "cardigan", "pants": "#6b5a7a"}}
FR = {"name": "친구", "look": {"age": "kid", "hairdo": "spiky", "hair": "#5a3a22", "top": "#ff8f6b", "topKind": "hoodie"}}
EP = {
    "title": "비 오면 내 운동화가 사라진다ㅋㅋ",
    "music": ("monkeys_spinning_monkeys", 0.17),
    "voices": {"nar": ("InJoon", "+28%"), "me": ("InJoon", "+26%", "+22Hz"), "gma": ("SunHi", "+22%", "-10Hz"), "fr": ("Hyunsu", "+26%", "+18Hz")},
    "cast": {"me": ME, "gma": GMA, "fr": FR},
    "beats": [
        ("a", "nar", "비만 오면 내 운동화가 사라져.", "비만 오면 / 내 [운동화]가 사라져", {"bg": "rain", "chars": ["me:shock@0.4*1.2"], "prop": "👟❓", "propX": 0.8}),
        ("b", "nar", "현관에 있던 운동화가 감쪽같이 없어지는 거야.", "현관에 있던 운동화가 / [감쪽같이] 없어져", {"bg": "door", "sign": "101호", "chars": ["me:think@0.25*1.1"], "prop": "❓", "propX": 0.5}),
        ("c", "me", "할머니, 내 운동화 못 봤어?", "\"할머니, 내 / [운동화] 못 봤어?\"", {"bg": "home", "chars": ["me:sad*1.5"], "zoom0": 1.0, "zoom": 1.06}),
        ("d", "gma", "몰라. 할미 무릎이 쑤셔. 장화 신고 가.", "\"몰라. 할미 [무릎] 쑤셔 / 장화 신고 가\"", {"bg": "home", "chars": ["gma:smug@0.4*1.45"], "prop": "🥾", "propX": 0.84}),
        ("e", "nar", "노란 장화 신고 학교 가면 어떻게 되는지 알아?", "노란 장화 신고 / [학교] 가면?", {"bg": "class", "sign": "3학년 1반", "chars": ["me:sad@0.5*1.0"], "prop": "🥾", "propX": 0.8}),
        ("f", "fr", "야, 너 아기 장화 신었어?", "\"야, 너 / [아기 장화] 신었어?\"", {"bg": "class", "sign": "3학년 1반", "chars": ["fr:laugh@0.3*1.1", "me:cry@0.74*0.9"]}),
        ("g", "nar", "그렇게 놀림받은 게 벌써 세 번째야.", "놀림받은 게 / 벌써 [세 번째]", {"bg": "class", "chars": ["me:cry*1.5"], "big": "[3]번째"}),
        ("g2", "nar", "근데 이상한 건, 다음 날 돌아온 운동화가 늘 따끈따끈했다는 거야.", "근데 돌아온 운동화가 / 늘 [따끈따끈]했어", {"bg": "door", "sign": "101호", "chars": ["me:think@0.3*1.1"], "prop": "👟♨️", "propX": 0.72}),
        ("h", "nar", "그래서 비 오는 밤에 몰래 지켜봤거든.", "비 오는 밤 / [몰래] 지켜봤어", {"bg": "night", "chars": ["me:think@0.2*1.0"], "prop": "👀", "propX": 0.6}),
        ("i", "nar", "할머니가 내 운동화를 들고 욕실로 가는 거야.", "할머니가 운동화 들고 / [욕실]로 가더라", {"bg": "bath", "place": "📍 욕실", "chars": ["gma:neutral@0.62"], "prop": "👟", "propX": 0.25}),
        ("j", "nar", "솔로 박박 빨더니, 전기장판 위에 말리더라.", "솔로 박박 빨고 / [전기장판]에 말려", {"bg": "bedroom", "chars": ["gma:happy@0.3*1.1"], "prop": "👟♨️", "propX": 0.7}),
        ("k", "gma", "젖은 신발 신으면 발 썩어.", "\"젖은 신발 신으면 / [발 썩어]\"", {"bg": "bedroom", "chars": ["gma:angry*1.5"], "zoom0": 1.0, "zoom": 1.06}),
        ("l", "nar", "젖어서 온 내 운동화가 계속 신경 쓰였던 거지.", "젖어 온 운동화가 / [신경] 쓰였던 거야", {"bg": "rain", "chars": ["me:sad@0.5*1.1"], "prop": "💧👟", "propX": 0.82}),
        ("m", "me", "할머니, 그냥 말하지 그랬어.", "\"할머니, 그냥 / [말하지] 그랬어\"", {"bg": "home", "chars": ["me:cry@0.3", "gma:shy@0.72"]}),
        ("n", "gma", "말하면 니가 장화를 안 신잖아.", "\"말하면 니가 / 장화 [안 신잖아]\"", {"bg": "home", "chars": ["gma:laugh@0.45*1.4"], "prop": "🥾", "propX": 0.85}),
        ("o", "nar", "근데 문제는, 할머니가 일기예보보다 무릎을 믿는다는 거야.", "문제는 할머니가 / 예보보다 [무릎]을 믿어", {"bg": "home", "chars": ["gma:smug@0.6*1.2"], "prop": "☀️", "propX": 0.2}),
        ("p", "nar", "오늘도 쨍쨍한데, 무릎이 비 온대서 장화 신고 간다.", "오늘도 쨍쨍한데 / 무릎 예보로 [장화] 신고 간다", {"bg": "street", "chars": ["me:sad@0.45*1.2"], "prop": "🥾", "propX": 0.82}),
    ],
    "sfx": [["a", "pop", 0.25], ["f", "boing", 0.3], ["h", "whoosh", 0.25], ["k", "k_error_003", 0.25], ["p", "pop_hi", 0.3]],
}
