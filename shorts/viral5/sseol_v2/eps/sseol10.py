# 동생의 생일 선물 (v1: "동생이 내 생일마다 / 이상한 선물을 주는 이유"), 창작
ME = {"name": "나", "look": {"age": "teen", "hairdo": "spiky", "hair": "#2a2a30", "top": "#6f8fd9", "topKind": "hoodie"}}
SIS = {"name": "동생", "look": {"age": "kid", "hairdo": "pony", "hair": "#4a2f22", "top": "#ff9eb5", "topKind": "tee", "acc": "ribbon", "accColor": "#ffd84d"}}
EP = {
    "title": "동생 선물이 양말 1짝이다ㅋㅋ",
    "music": ("sneaky_snitch", 0.16),
    "voices": {"nar": ("Hyunsu", "+28%"), "me": ("Hyunsu", "+26%", "+8Hz"), "sis": ("SunHi", "+26%", "+18Hz")},
    "cast": {"me": ME, "sis": SIS},
    "beats": [
        ("a", "nar", "동생 생일 선물이 양말 한 짝이야.", "동생 생일 선물이 / 양말 [한 짝]", {"bg": "bedroom", "chars": ["me:shock@0.28", "sis:smug@0.72*0.9"], "prop": "🧦", "propX": 0.5, "tags": True}),
        ("b", "nar", "작년 내 생일에 동생이 상자를 줬는데,", "작년 내 생일에 / 동생이 [상자]를 줬어", {"bg": "home", "chars": ["sis:happy@0.4*1.2"], "prop": "🎁", "propX": 0.8}),
        ("c", "nar", "열어 보니까 양말 딱 한 짝이 들어 있더라.", "열어 보니 / 양말 [한 짝]", {"bg": "home", "chars": ["me:think@0.3*1.1"], "prop": "🧦", "propX": 0.72}),
        ("d", "me", "야, 이게 뭐야? 나머지 한 짝은?", "\"야, 이게 뭐야? / [나머지 한 짝]은?\"", {"bg": "home", "chars": ["me:angry*1.5"]}),
        ("e", "sis", "있잖아. 잘 찾아봐.", "\"있잖아. / [잘 찾아봐]\"", {"bg": "home", "chars": ["sis:smug@0.45*1.45"]}),
        ("f", "nar", "다음 선물은 이어폰 한쪽, 그다음엔 머리끈.", "다음엔 [이어폰 한쪽] / 그다음엔 머리끈", {"bg": "bedroom", "chars": ["me:shock@0.3*1.0"], "prop": "🎧🎀", "propX": 0.72}),
        ("g", "nar", "마지막엔 접는 우산까지 나왔어.", "마지막엔 / [접는 우산]까지", {"bg": "bedroom", "chars": ["me:sad@0.35*1.15"], "prop": "☂️", "propX": 0.8}),
        ("h", "me", "얘 쓰레기 모으나?", "\"얘 [쓰레기] / 모으나?\"", {"bg": "bedroom", "chars": ["me:think*1.5"]}),
        ("i", "nar", "근데 우산을 펼쳐 보니까, 내 이름이 써 있는 거야.", "우산을 펼쳐 보니 / [내 이름]이 써 있어", {"bg": "bedroom", "chars": ["me:shock@0.3*1.15"], "prop": "☂️", "propX": 0.75, "big": "[내 이름]", "steps": [0, 0, 9, "i.이름이"]}),
        ("j", "nar", "그제야 알았어. 전부 내가 잃어버린 거였어.", "전부 내가 / [잃어버린] 거였어", {"bg": "street", "chars": ["me:sad@0.6*1.2"], "prop": "🧦🎧☂️", "propX": 0.25}),
        ("k", "sis", "오빠가 흘린 거, 일 년 동안 주웠어.", "\"오빠가 흘린 거 / [1년 동안] 주웠어\"", {"bg": "home", "chars": ["sis:happy*1.5"]}),
        ("l", "nar", "양말은 소파 밑에서, 이어폰은 버스에서.", "양말은 [소파 밑] / 이어폰은 버스", {"bg": "subway", "chars": ["sis:think@0.5*1.1"], "prop": "🎧", "propX": 0.85}),
        ("m", "nar", "괜히 감동받아서 동생 머리를 쓰다듬었지.", "괜히 감동받아서 / 머리를 [쓰다듬었지]", {"bg": "home", "chars": ["me:cry@0.3", "sis:love@0.7*0.85"]}),
        ("n", "nar", "그리고 마지막 상자를 열었는데,", "마지막 상자를 / [열었는데]", {"bg": "home", "chars": ["me:happy@0.3*1.15"], "prop": "🎁", "propX": 0.75}),
        ("o", "nar", "동생이 빌려 가서 안 돌려준 내 패딩이 들어 있었어.", "동생이 빌려 간 / [내 패딩]이 들어 있었어", {"bg": "home", "chars": ["me:shock*1.5"], "prop": "🧥", "propX": 0.85}),
        ("p", "sis", "그건 잃어버린 거 아니야. 선물이야.", "\"그건 잃어버린 거 아냐 / [선물]이야\"", {"bg": "home", "chars": ["sis:laugh@0.45*1.45"], "prop": "🧥", "propX": 0.84}),
    ],
    "sfx": [["a", "pop", 0.25], ["d", "boing", 0.3], ["i.이름이", "k_error_003", 0.2], ["o", "pop_hi", 0.3]],
}
