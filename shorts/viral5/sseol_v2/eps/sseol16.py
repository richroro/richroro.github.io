# 할아버지의 나무 사진 (v1: "할아버지가 매일 / 같은 나무만 찍는 이유"), 창작
ME = {"name": "나", "look": {"hairdo": "long", "hair": "#4a2f22", "top": "#7cc4ff", "topKind": "tee"}}
GPA = {"name": "할아버지", "look": {"age": "old", "hairdo": "bald", "hair": "#dcdce2", "top": "#6a8f5a", "topKind": "vest", "acc": "cap", "accColor": "#c98a4b"}}
GMA = {"name": "할머니", "look": {"age": "old", "hairdo": "perm", "hair": "#ececf0", "top": "#ff9eb5", "topKind": "gown"}}
GMA2 = {"name": "할머니", "look": {"age": "old", "hairdo": "perm", "hair": "#ececf0", "top": "#ff9eb5", "topKind": "cardigan"}}
PARK = {"bg": "linear-gradient(180deg,#bfe6ff 0%,#e9f7ff 60%,#9bd27b 60%,#7fbf5f 100%)"}
EP = {
    "title": "할아버지가 나무만 1년 찍었다",
    "music": ("monkeys_spinning_monkeys", 0.15),
    "voices": {"nar": ("SunHi", "+28%"), "me": ("SunHi", "+26%", "+8Hz"), "gpa": ("InJoon", "+12%", "-15Hz"), "gma": ("SunHi", "+14%", "-10Hz")},
    "cast": {"me": ME, "gpa": GPA, "gma": GMA, "gma2": GMA2},
    "beats": [
        ("a", "nar", "할아버지가 일 년째 나무만 찍어.", "할아버지가 1년째 / [나무만] 찍어", {**PARK, "chars": ["gpa:smug@0.3*1.1"], "prop": "🌳", "propX": 0.75, "tags": True}),
        ("b", "nar", "매일 아침 같은 시간, 같은 자리에서, 같은 나무만.", "매일 같은 시간 / 같은 자리, [같은 나무]", {**PARK, "chars": ["gpa:neutral@0.65*1.2"], "prop": "🌳📱", "propX": 0.22}),
        ("c", "me", "할아버지, 나무가 그렇게 좋아?", "\"할아버지, 나무가 / [그렇게] 좋아?\"", {**PARK, "chars": ["me:think*1.5"]}),
        ("d", "gpa", "응, 이 나무가 제일 예뻐.", "\"응, 이 나무가 / [제일] 예뻐\"", {**PARK, "chars": ["gpa:happy@0.45*1.45"], "prop": "🌳", "propX": 0.85}),
        ("e", "nar", "휴대폰 사진첩이 전부 그 나무였어.", "사진첩이 전부 / [그 나무]", {"bg": "home", "chars": [], "big": "🌳🌳🌳🌳"}),
        ("f", "nar", "근데 사진마다 누구한테 보낸 기록이 있는 거야.", "사진마다 / [보낸 기록]이 있어", {"bg": "home", "chars": ["me:shock@0.35*1.2"], "prop": "📤", "propX": 0.8}),
        ("g", "nar", "받는 사람은 할머니였어.", "받는 사람은 / [할머니]", {"bg": "hospital", "chars": ["gma:happy@0.35*1.2"], "prop": "📱", "propX": 0.72, "tags": True}),
        ("h", "nar", "할머니는 일 년째 병원에 입원해 계셨거든.", "할머니는 1년째 / [병원]에 계셨어", {"bg": "hospital", "place": "📍 병실", "chars": ["gma:sleep@0.3*1.1"]}),
        ("i", "nar", "병실 창밖으로는 회색 벽만 보였대.", "병실 창밖은 / [회색 벽]뿐", {"bg": "linear-gradient(180deg,#9aa3ad,#c3c9cf)", "chars": ["gma:sad@0.5*1.3"], "prop": "🧱", "propX": 0.15}),
        ("j", "nar", "그래서 할아버지가 바깥 계절을 하루 한 장씩 보낸 거야.", "바깥 계절을 / 하루 [한 장]씩", {**PARK, "chars": ["gpa:love@0.35*1.2"], "prop": "📱🌳", "propX": 0.75}),
        ("k", "nar", "봄엔 꽃, 여름엔 초록, 가을엔 단풍, 겨울엔 눈.", "봄엔 꽃, 여름엔 초록 / 가을엔 단풍, 겨울엔 눈", {**PARK, "chars": [], "big": "🌸🌳🍁⛄"}),
        ("l", "nar", "그리고 오늘, 할머니가 퇴원하셨어.", "그리고 오늘 / 할머니가 [퇴원]", {"bg": "street", "chars": ["gma2:happy@0.3", "gpa:cry@0.72"], "prop": "💐", "propX": 0.5}),
        ("m", "nar", "할머니가 그 나무 앞에 서서 한참 보시더니,", "그 나무 앞에서 / 한참 보시더니", {**PARK, "chars": ["gma2:love@0.35*1.2"], "prop": "🌳", "propX": 0.78}),
        ("n", "gma", "사진보다 실물이 더 예쁘네.", "\"사진보다 / [실물]이 더 예쁘네\"", {**PARK, "chars": ["gma2:laugh*1.5"]}),
        ("o", "gpa", "그럼 내일부턴 당신을 찍어야지.", "\"내일부턴 / [당신]을 찍어야지\"", {**PARK, "chars": ["gpa:shy@0.45*1.45"], "prop": "📸", "propX": 0.85}),
    ],
    "sfx": [["a", "shutter", 0.3], ["e", "pop", 0.25], ["k", "bubble", 0.25], ["o", "shutter", 0.3]],
}
