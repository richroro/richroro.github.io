"""쇼츠 50만+ 벤치마크 (drawn): writes shorts/<id>/script.json and edit.json for the two shorts made from
research/research-500k-drawn.md (README "쇼츠 50만+ 벤치마크").

  rule1    "~하면 벌어지는 일" public-rule explainer (콩자반 「오프리쉬 신고하면 벌어지는 일」 structure): Seoul's bus
           takeaway-cup rule (서울시 시내버스 조례, 2018-01-04), told as 도치's argument with a driver; facts in the dialogue.
  senior1  시니어 반전 드라마 (ai방송국·마음우체국 structure) with our drawn chibi characters: a BBQ-restaurant part-timer and
           the grandpa who orders two portions alone every Thursday (따뜻한 반전).

Both use the 낙서 짤툰 v2 layout (band title, tall picture box, navy caption box) through media/doodle/v2/lib.py, and
Supertonic voices (README "음성 v2"), cast per character in script.json so --engine azure can swap them later.
usage: python3 media/hit500/build.py [rule1 senior1]      (from shorts/viral5)
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../doodle/v2"))
from lib import HERE, all_sources, build, guy, me  # noqa: E402

M = lambda f, g=0.12: {"file": f"music/{f}.mp3", "gain": g, "start": 0}
P = lambda i: f"doodle/px{i}.jpg"
say = lambda text, who=0: {"who": who, "text": text}

def st(voice, sps, edge):
    """a Supertonic preset at a target pace; "edge" keeps the Azure-equivalent name so --engine azure can recast"""
    return {"engine": "supertonic", "voice": voice, "sps": sps, "edge": edge}

def finish(sid, pauses, voices):
    """lib.build writes Edge voices for nar/me; replace the cast and add the 음성 v2 pause rules"""
    p = f"{HERE}/shorts/{sid}/script.json"
    s = json.load(open(p))
    s["voices"] = voices
    s["pauses"] = pauses
    json.dump(s, open(p, "w"), ensure_ascii=False, indent=1)

def rule1():
    """도치 is refused at the bus door with an iced americano; the driver gives the rule; no fine, so 도치 chugs it,
    and while 도치 drinks, the bus that was 'leaving now' leaves (허탈 개그)"""
    DRV = dict(hairdo="bald", hair="#3b3b3b", hat="🧢")
    PAX = dict(hairdo="perm", hair="#5a3a2a")
    L = [("a0", "drv", "손님, 그 컵 들고는 못 타세요.", ""),
         ("a", "nar", "아침 여덟 시, 버스 타다가 들은 말.", "아침 [8시] / 버스 타다 들은 말"),
         ("b", "nar", "손에는 방금 산 아이스 아메리카노.", "손에는 방금 산 / [아이스 아메리카노]"),
         ("c", "me", "뚜껑 닫혀 있는데요?", ""),
         ("d", "drv", "일회용 컵은 안 돼요. 빨리 정하세요, 출발 시간이에요.", '"일회용 컵은 안 돼요" / "[출발] 시간이에요"'),
         ("e", "nar", "서울 시내버스는 이천십팔 년부터, 기사가 이런 컵을 안 태울 수 있음.", "서울 버스는 [2018년]부터 / 기사가 거부 가능"),
         ("f", "me", "그럼 저분 텀블러는요?", ""),
         ("g", "drv", "텀블러는 돼요. 뚜껑 닫힌 병도 되고.", "\"텀블러는 돼요\" / \"뚜껑 닫힌 병도\""),
         ("h", "nar", "상자에 든 치킨, 안 딴 캔도 됨. 안 되는 건, 쏟아질 수 있는 컵이야.", "상자 치킨·안 딴 캔 OK / [쏟아지는 컵]은 NO"),
         ("i", "me", "벌금 내면 되잖아요.", ""),
         ("j", "drv", "벌금은 없어요. 그냥 탑승이 안 되는 거예요.", ""),
         ("k", "nar", "다음 버스는 십오 분 뒤.", "다음 버스 / [15분] 뒤"),
         ("l", "nar", "도치, 결심함. 원샷!", "도치, 결심함 / [원샷]"),
         ("m", "nar", "다 마시고 고개를 드니, 버스는 이미 출발.", "고개 드니 버스 / [이미 출발]"),
         ("n", "me", "얼음은 아직 남았는데…", ""),
         ("z", "nar", "기사님이랑 도치, 누가 맞는 거임?", "기사님 vs 도치 / [누가] 맞는 거임?")]
    STOP, IN1, IN2, BTN = P(21235187), P(15595486), P(15595490), P(17800465)
    C = [("a0", {"photo": STOP, "chars": [guy("angry", **DRV, _keep=1, size=2.0, x=0.5, y=100)], "prop": "🥤", "propX": 0.82, "steps": [9, 0.1, 9, 9]}),
         ("a", {"photo": STOP, "photoPos": "70% 50%", "chars": [me("shock")], "prop": "🥤", "steps": [9, 0.1, 9, 9]}),
         ("b", {"bg": "#dff3ff", "chars": [me("happy")], "prop": "🥤", "steps": [9, 0.1, 9, 9]}),
         ("c", {"photo": STOP, "chars": [guy("neutral", **DRV), me("think")], "steps": ["c", 9, 9, 9], "say": say("뚜껑 닫혀 있는데요?", 1)}),
         ("d", {"photo": IN1, "chars": [guy("angry", **DRV)], "prop": "⏱️", "steps": [9, 0.1, 9, 9]}),
         ("e", {"photo": IN2, "chars": [me("think")], "big": "2018년~", "steps": [9, 9, 9, "e+0.6"]}),
         ("f", {"photo": IN1, "photoPos": "30% 50%", "chars": [me("smug"), guy("neutral", **PAX)], "prop": "🍶", "propX": 0.84, "steps": ["f", 0.4, 9, 9], "say": say("저분 텀블러는요?")}),
         ("g", {"photo": IN2, "photoPos": "60% 50%", "chars": [guy("neutral", **DRV)], "prop": "🍶", "steps": [9, 0.1, 9, 9]}),
         ("h", {"bg": "#FFE14D", "chars": [me("think")], "prop": "📦🥫", "big": "컵 = NO", "steps": [9, 0.1, 9, "h.안 되는"]}),
         ("i", {"photo": STOP, "chars": [me("smug")], "prop": "💸", "steps": [9, 0.1, 9, 9]}),
         ("j", {"photo": IN1, "chars": [guy("smug", **DRV)], "big": "벌금 0원", "steps": [9, 9, 9, "j+0.4"]}),
         ("k", {"photo": BTN, "chars": [me("cry")], "big": "15분", "steps": [9, 9, 9, "k+0.3"]}),
         ("l", {"bg": "#2b1c1c", "chars": [me("angry", to="laugh")], "prop": "🥤", "big": "원샷", "steps": [9, 0.1, "l.원샷", "l.원샷"]}),
         ("m", {"photo": STOP, "photoPos": "40% 50%", "chars": [me("shock")], "prop": "🚌💨", "big": "출발", "steps": [9, 0.1, 9, "m.이미"]}),
         ("n", {"bg": "street", "chars": [me("cry")], "prop": "🧊", "steps": [9, 0.1, 9, 9]}),
         ("z", {"photo": STOP, "chars": [me("think", to="smug")], "steps": [9, 9, "z.누가", 9]})]
    sfx = [["a0", "whoosh", 0.2], ["c", "pop", 0.22], ["d", "pop", 0.22], ["e", "pop", 0.22], ["h.안 되는", "boing", 0.26],
           ["j", "pop", 0.22], ["k", "whoosh_dn", 0.22], ["l.원샷", "boing", 0.3], ["m.이미", "whoosh", 0.25], ["n", "pop", 0.2], ["z", "pop", 0.22]]
    build("rule1", ["테이크아웃 컵 들고", "버스 타면 벌어지는 일"], L, C, M("scheming_weasel"), sfx, sources=all_sources())
    finish("rule1", {"line": 0.12, "turn": 0.2, "punch": 0.4}, {
        "nar": st("M4", 7.6, "ko-KR-InJoonNeural"),
        "me": st("M1", 7.6, "ko-KR-HyunsuMultilingualNeural"),
        "drv": st("M2", 7.2, "ko-KR-BongJinNeural")})

def senior1():
    """a part-timer grumbles at the grandpa who orders two portions alone every Thursday and leaves half; the staff meat the
    boss hands him every Thursday was that half; the grandpa washed grills here 40 years ago (따뜻한 반전)"""
    GPA = {"style": "chibi", "look": {"age": "old", "hairdo": "short", "hair": "#e4e4ea", "top": "#c8b38a", "topKind": "shirt", "pants": "#5b5f66"}}
    ME = {"style": "chibi", "look": {"age": "adult", "hairdo": "spiky", "hair": "#1f1f24", "top": "#2e3a55", "topKind": "apron", "pants": "#2b2b30"}}
    BOSS = {"style": "chibi", "look": {"age": "adult", "hairdo": "buzz", "hair": "#141414", "top": "#b3423a", "topKind": "apron", "pants": "#3a3a40", "mustache": True}}
    def ch(base, mood, to=None, **kw):
        c = json.loads(json.dumps(base)); c["mood"] = mood
        if to: c["to"] = to
        c.update(kw); return c
    L = [("a0", "gpa", "삼겹살, 이 인분.", "\"삼겹살 [2인분]\""),
         ("a", "nar", "매주 목요일 일곱 시, 늘 혼자 오시는 할아버지.", "매주 [목요일 7시] / 늘 혼자 오는 할아버지"),
         ("b", "nar", "근데 꼭 이 인분을 시키고, 딱 반만 드세요. 나머지는 손도 안 대고.", "꼭 2인분 시키고 / [딱 반만] 드심"),
         ("c", "gpa", "학생, 저녁은 먹었어?", ""),
         ("d", "nar", "네, 먹었죠. 사실 제 저녁은 매일 컵라면.", "\"네, 먹었죠\" / 사실 매일 [컵라면]"),
         ("e", "boss", "남은 거야. 잔말 말고 구워 먹어.", ""),
         ("f", "nar", "목요일마다 나오는 직원 고기. 사장님 최고.", "목요일마다 나오는 / [직원 고기]"),
         ("g", "nar", "사장님, 저 할아버지 매번 반이나 남기세요. 그냥 일 인분만 드려요.", "\"매번 반이나 남기세요\" / \"그냥 [1인분]만 드려요\""),
         ("h", "boss", "잔말 말고, 이 인분 그대로 드려.", "\"잔말 말고 / [2인분] 드려\""),
         ("i", "nar", "그런데 그 주 목요일, 할아버지가 안 오셨다.", "그 주 목요일 / 할아버지가 [안 오셨다]"),
         ("j", "nar", "사장님, 오늘은 직원 고기 없어요?", "\"오늘은 / [직원 고기] 없어요?\""),
         ("k", "boss", "없어. 어르신이 안 오셨잖아.", ""),
         ("l", "nar", "장부엔 이렇게 적혀 있었다. 목요일 이 인분, 일 인분은 알바 학생 저녁밥.", "목요일 2인분 / 1인분은 [알바 학생 저녁]"),
         ("m", "boss", "그 어르신도 사십 년 전에 여기서 불판 닦았어. 우리 아버지가 똑같이 해 드렸대.", "\"그 어르신도 / [40년 전] 여기 알바\" / \"우리 아버지가 / 똑같이 해 드렸대\""),
         ("n", "gpa", "학생, 저녁은 먹었어?", "\"학생, / 저녁은 먹었어?\""),
         ("z", "nar", "네, 덕분에 잘 먹었어요.", "\"네, [덕분에] / 잘 먹었어요\"")]
    TBL, GUI = "hit500/samgyeopsal_table.jpg", "hit500/samgyeopsal_gui.jpg"
    C = [("a0", {"bg": "gogiNight", "chars": [ch(GPA, "neutral", _keep=1, size=1.9, x=0.5, y=90)], "prop": "🥩", "propX": 0.82, "steps": [9, 0.1, 9, 9]}),
         ("a", {"bg": "gogiNight", "chars": [ch(GPA, "neutral")], "place": "📍 목요일 저녁 7시", "steps": [9, 9, 9, 9]}),
         ("b", {"photo": TBL, "chars": [ch(GPA, "happy")], "big": "딱 반만", "steps": [9, 9, 9, "b.반만"]}),
         ("c", {"bg": "gogiNight", "chars": [ch(GPA, "happy"), ch(ME, "neutral")], "steps": ["c", 9, 9, 9], "say": say("학생, 저녁은 먹었어?")}),
         ("d", {"bg": "gogiBack", "chars": [ch(ME, "shy", to="sad")], "prop": "🍜", "steps": [9, 0.1, "d.사실", 9]}),
         ("e", {"bg": "gogiBack", "chars": [ch(BOSS, "neutral"), ch(ME, "shock", to="happy")], "prop": "🥩", "steps": ["e", 0.2, "e+0.9", 9], "say": say("잔말 말고 구워 먹어")}),
         ("f", {"photo": GUI, "chars": [ch(ME, "love")], "big": "직원 고기", "steps": [9, 9, 9, "f.직원"]}),
         ("g", {"bg": "gogi", "chars": [ch(ME, "angry"), ch(BOSS, "think")], "steps": ["g", 9, 9, 9], "say": say("매번 반이나 남기세요", 0)}),
         ("h", {"bg": "gogi", "chars": [ch(BOSS, "angry")], "steps": [9, 9, 9, 9]}),
         ("i", {"bg": "gogiNight", "chars": [ch(ME, "think")], "place": "📍 그 주 목요일", "prop": "🪑", "steps": [9, 0.3, 9, 9]}),
         ("j", {"bg": "gogiBack", "chars": [ch(ME, "sad")], "prop": "🍜", "steps": [9, 0.1, 9, 9]}),
         ("k", {"bg": "gogiBack", "chars": [ch(BOSS, "sad")], "steps": [9, 9, 9, 9]}),
         ("l", {"bg": "#f3ead6", "chars": [ch(ME, "shock")], "prop": "📒", "big": "알바 학생 저녁", "steps": [9, 0.1, 9, "l.알바"]}),
         ("m", {"bg": "gogi", "chars": [ch(BOSS, "think", to="happy")], "prop": "🖼️", "steps": [9, 0.2, "m.우리", 9]}),
         ("n", {"bg": "gogiNight", "chars": [ch(GPA, "happy"), ch(ME, "neutral")], "place": "📍 다음 주 목요일", "steps": [9, 9, 9, 9]}),
         ("z", {"bg": "gogiNight", "chars": [ch(ME, "cry", to="happy", _keep=1, size=1.9, x=0.5, y=90)], "steps": [9, 9, "z.덕분에", 9]})]
    sfx = [["a", "whoosh", 0.18], ["b.반만", "pop", 0.22], ["e", "pop", 0.2], ["f.직원", "ding", 0.22], ["i", "whoosh_dn", 0.2],
           ["k", "pop", 0.18], ["l.알바", "ding", 0.25], ["n", "whoosh", 0.18]]
    build("senior1", ["매주 혼자 와서", "2인분 시키던 할아버지"], L, C, M("Heartwarming", 0.14), sfx,
          sources={"samgyeopsal_table": {"file": "samgyeopsal_table.jpg", "path": "public/hit500/samgyeopsal_table.jpg", "page": "https://commons.wikimedia.org/wiki/File:Samgyeopsal_table.jpg",
                                         "file_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Samgyeopsal_table.jpg/1920px-Samgyeopsal_table.jpg", "license": "CC0", "creator": "이동원",
                                         "credit": "사진: Wikimedia Commons (설명란 표기)", "seconds": []},
                   "samgyeopsal_gui": {"file": "samgyeopsal_gui.jpg", "path": "public/hit500/samgyeopsal_gui.jpg", "page": "https://commons.wikimedia.org/wiki/File:Samgyeopsal-gui.jpg",
                                       "file_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Samgyeopsal-gui.jpg/1920px-Samgyeopsal-gui.jpg", "license": "CC0", "creator": "jinsoo jang",
                                       "credit": "사진: Wikimedia Commons (설명란 표기)", "seconds": []}})
    finish("senior1", {"line": 0.14, "turn": 0.24, "punch": 0.5}, {
        "nar": st("M1", 6.8, "ko-KR-HyunsuMultilingualNeural"),
        "gpa": st("M3", 6.0, "fr-FR-RemyMultilingualNeural"),
        "boss": st("M2", 6.6, "ko-KR-BongJinNeural")})

EP = {"rule1": rule1, "senior1": senior1}
for k in sys.argv[1:] or EP:
    EP[k]()
