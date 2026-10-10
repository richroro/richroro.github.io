# 매달 1일 만 원이 입금된다 (새 편), 창작
ME = {"name": "나", "look": {"hairdo": "bob", "hair": "#3a2622", "top": "#ffd84d", "topKind": "hoodie"}}
FR = {"name": "하나", "look": {"hairdo": "long", "hair": "#2b2222", "top": "#9be07b", "topKind": "shirt"}}
KME = {"name": "8살 나", "look": {"age": "kid", "hairdo": "bob", "hair": "#3a2622", "top": "#ffd84d", "topKind": "tee"}}
KFR = {"name": "짝꿍", "look": {"age": "kid", "hairdo": "pigtails", "hair": "#2b2222", "top": "#9be07b", "topKind": "tee"}}
CLK = {"name": "은행 직원", "look": {"hairdo": "short", "hair": "#2a2a30", "top": "#2f5d8a", "topKind": "suit", "accColor": "#7cc4ff"}}
APP = "입출금 내역"
EP = {
    "title": "매달 1일 만 원이 입금된다",
    "music": ("sneaky_snitch", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "fr": ("SunHi", "+26%", "-4Hz"), "clk": ("Hyunsu", "+26%")},
    "cast": {"me": ME, "fr": FR, "kme": KME, "kfr": KFR, "clk": CLK},
    "beats": [
        ("a", "nar", "매달 일 일, 모르는 사람이 만 원을 보내.", "매달 1일 / 모르는 [만 원]이 와", {"bg": "bedroom", "chars": ["me:shock@0.24"], "chat": {"title": APP, "msgs": [{"name": "입금", "text": "[10,000원] 하나", "color": "#9be07b"}]}, "steps": [0, 0, 9, 0, 0.05]}),
        ("b", "nar", "입금자 이름은 매번 똑같아, 하나.", "입금자는 / 매번 '[하나]'", {"bg": "bedroom", "chars": ["me:think@0.24"], "chat": {"title": APP, "msgs": [{"name": "입금", "text": "10,000원 [하나]", "color": "#9be07b"}, {"name": "입금", "text": "10,000원 [하나]", "color": "#9be07b"}, {"name": "입금", "text": "10,000원 [하나]", "color": "#9be07b"}]}, "steps": [0, 0, 9, 0, 0.1, 0.5, 0.9]}),
        ("c", "me", "하나, 그게 누구지?", "\"[하나]? / 그게 누구지?\"", {"bg": "bedroom", "chars": ["me:think*1.5"]}),
        ("d", "nar", "벌써 일 년째, 한 번도 안 빠졌어.", "벌써 [1년째] / 한 번도 안 빠졌어", {"bg": "home", "chars": ["me:shock@0.3*1.1"], "big": "💸 × [12]"}),
        ("e", "nar", "혹시 사기인가 싶어서 은행에도 물어봤어.", "혹시 [사기]인가 / 은행에 물어봤어", {"bg": "office", "place": "📍 은행", "chars": ["me:sad@0.3", "clk:neutral@0.72"], "tags": True}),
        ("f", "clk", "보낸 분 계좌는 정상이에요.", "\"보낸 분 계좌는 / [정상]이에요\"", {"bg": "office", "chars": ["clk:happy*1.5"]}),
        ("g", "nar", "그래서 나도 일 원 보내면서 메모를 적었어.", "그래서 [1원] 보내며 / 메모를 적었어", {"bg": "bedroom", "chars": ["me:smug@0.24"], "chat": {"title": APP, "msgs": [{"me": True, "text": "1원 [누구세요?]"}]}, "steps": [0, 0, 9, 0, 0.4]}),
        ("h", "nar", "다음 달 일 일, 만 원이랑 메모가 같이 왔어.", "다음 달 1일 / 만 원과 [메모]", {"bg": "bedroom", "chars": ["me:shock@0.24"], "chat": {"title": APP, "msgs": [{"name": "입금", "text": "10,000원 하나", "color": "#9be07b"}, {"name": "메모", "text": "초등학교 때 빌린 [천 원] 갚아요", "color": "#ffd84d"}]}, "steps": [0, 0, 9, 0, 0.1, 0.8]}),
        ("i", "nar", "초등학교 때 빌린 천 원 갚아요.", "'초등학교 때 빌린 / [천 원] 갚아요'", {"bg": "bedroom", "chars": ["me:think*1.5"], "prop": "💭", "propX": 0.85}),
        ("j", "nar", "기억났어, 이 학년 때 준비물 못 산 짝꿍한테 천 원 빌려줬거든.", "2학년 때 짝꿍한테 / [천 원] 빌려줬어", {"bg": "class", "sign": "준비물: 색종이", "place": "📍 2학년 때", "chars": ["kme:happy@0.3", "kfr:cry@0.72"], "prop": "💵", "propX": 0.5, "tags": True}),
        ("k", "nar", "그 천 원 갚으려고 일 년 동안 만 원씩 보낸 거야.", "천 원 갚으려고 / 1년 동안 [만 원]씩", {"bg": "home", "chars": ["fr:shy@0.45*1.3"], "prop": "💸", "propX": 0.84, "tags": True}),
        ("l", "me", "야, 너 이자를 얼마나 쳐 준 거야?", "\"야, [이자]를 / 얼마나 쳐 준 거야?\"", {"bg": "cafeteria", "sign": "카페", "chars": ["me:laugh@0.3", "fr:shy@0.72"]}),
        ("m", "fr", "그때 그 천 원 없었으면 나 울었어.", "\"그 천 원 없었으면 / 나 [울었어]\"", {"bg": "cafeteria", "sign": "카페", "chars": ["fr:cry*1.5"]}),
        ("n", "nar", "그래서 이번 달엔 내가 만 원을 보냈어.", "이번 달엔 / [내가] 만 원 보냄", {"bg": "bedroom", "chars": ["me:smug@0.24"], "chat": {"title": APP, "msgs": [{"me": True, "text": "[10,000원] 하나에게"}]}, "steps": [0, 0, 9, 0, 0.3]}),
        ("o", "nar", "메모는, 밥 사, 십이만 원어치.", "메모: '밥 사' / [12만 원]어치", {"bg": "cafeteria", "sign": "카페", "chars": ["me:laugh@0.3", "fr:laugh@0.72"], "big": "🍚 [12만 원]"}),
    ],
    "sfx": [["a", "coin", 0.3], ["d", "coin", 0.25], ["h", "ding", 0.3], ["o", "tada", 0.25]],
}
