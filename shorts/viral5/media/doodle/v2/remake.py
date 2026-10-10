"""doodle1-doodle10 v2: a new first line (a line of dialogue or the conclusion, so the hook ends by 1.8 s), conflict-style
titles, InJoon +40%, and the v1 scenes re-shot for the tall box. Facts are unchanged (README "낙서 짤툰 v2").
usage: python3 media/doodle/v2/remake.py [doodle1 ...]     (from shorts/viral5)
"""
import sys
from lib import ORANGE, all_sources, build, guy, keep_sfx, me, v1, vs_scene

SRC = all_sources()
MOM = dict(hairdo="perm", hair="#5a3a2a")
EP = {}

def ep(fn):
    EP[fn.__name__.replace("_", "")] = fn
    return fn

def old(sid):
    e = v1(sid, "edit")
    return {c["from"]: c["gfx"] for c in e["clips"]}, e

@ep
def doodle2():
    o, e = old("doodle2")
    L = [("k0", "buyer", "그럼 배송비만 내주세요.", '"배송비만 / 내주세요"'),
         ("a", "nar", "만 원짜리 의자 올렸다가 들은 말임.", "[만 원]짜리 의자 / 올렸다가 들은 말"),
         ("b", "buyer", "네고 되나요?", '"네고 되나요?"'),
         ("c", "nar", "네고 일 단계. 여기까진 국룰.", "[1단계] / 여기까진 국룰"),
         ("d", "buyer", "팔천 원 되나요?", '"8천 원 되나요?"'),
         ("e", "nar", "이 단계. 갑자기 이천 원이 증발.", "[2단계] / 2천 원 증발"),
         ("f", "buyer", "직접 가지러 가니까, 오천 원?", '"직접 가니까 / 5천 원?"'),
         ("g", "nar", "삼 단계. 픽업이 할인 사유가 됨.", "[3단계] / 픽업이 할인 사유"),
         ("h", "buyer", "혹시 무료 나눔은 안 되나요?", '"무료 나눔은 / 안 되나요?"'),
         ("i", "nar", "사 단계. 의자가 공짜가 되는 중.", "[4단계] / 의자가 [0원]"),
         ("j", "me", "아, 그냥 안 팔래요.", ""),
         ("j2", "nar", "근데 구매자, 여기서 안 멈춤.", "근데 구매자 / 여기서 [안 멈춤]"),
         ("k", "buyer", "그럼 배송비만 내주세요.", '"그럼 / 배송비만 내주세요"'),
         ("l", "nar", "오 단계. 이제 내가 돈을 내야 함.", "[5단계] / 이제 [내가] 내야 함"),
         ("y", "nar", "참고로 그 의자, 아직 내 방에 있음.", "그 의자 / [아직] 내 방에 있음"),
         ("y2", "nar", "이제 의자랑 정든 듯.", "이제 의자랑 / [정든] 듯"),
         ("z", "nar", "님들이 받아본 최강 네고는?", "님들이 받은 / [최강 네고]는?")]
    C = [("k0", {**o["l"], "steps": [9, 9, 9, -1], "big": "배송비 내가?", "chars": [me("shock")]}), ("a", {**o["a"], "steps": [9, 9, 9, "a+0.3"]}),
         ("b", o["b"]), ("d", o["d"]), ("e", o["e"]), ("f", o["f"]), ("g", o["g"]), ("h", o["h"]), ("i", o["i"]), ("j", o["j"]), ("j2", {"bg": "night", "chars": [me("shock")], "prop": "📱", "steps": [9, 0.1, 9, 9]}), ("k", o["k"]),
         ("l", o["l"]), ("y", o["y"]), ("y2", {"bg": "bedroom", "chars": [me("love")], "prop": "🪑", "steps": [9, 0.1, 9, 9]}), ("z", o["z"])]
    sfx = keep_sfx(e["sfx"], L, [("k0", "boing", 0.28)])
    build("doodle2", ["중고거래 네고", "선 넘으면 벌어지는 일"], L, C, e["music"], sfx,
          voices={"buyer": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+5Hz"}}, sources=SRC)

@ep
def doodle3():
    o, e = old("doodle3")
    L = [("i0", "me", "기사님, 내려요!", ""),
         ("a", "nar", "네 명이 동시에 외친 이유가 있음.", "네 명이 동시에 / 외친 [이유]"),
         ("b", "nar", "내릴 정류장 두 개 전. 아직 여유.", "내릴 곳 / [두 정거장] 전"),
         ("c", "nar", "한 정거장 전. 누가 누르겠지.", "한 정거장 전 / 누가 [누르겠지]"),
         ("d", "me", "저 아저씨도 내릴 것 같은데?", ""),
         ("e", "nar", "근데 다들 똑같은 생각 중.", "근데 다들 / [똑같은] 생각 중"),
         ("e2", "nar", "다들 폰 보는 척하면서 벨만 쳐다봄.", "폰 보는 척 / 벨만 [쳐다봄]"),
         ("f", "nar", "손은 벨 근처. 근데 아무도 안 누름.", "손은 벨 근처 / [아무도] 안 누름"),
         ("g", "nar", "그리고 버스는 쿨하게 통과.", "버스는 / [쿨하게] 통과"),
         ("g2", "nar", "이 순간 버스 안 공기, 영하 십 도.", "버스 안 공기 / [영하 10도]"),
         ("g3", "me", "아, 아까 눌렀어야 했는데.", ""),
         ("h", "nar", "그 순간 네 명이 동시에 벌떡.", "그 순간 / [네 명]이 동시에 벌떡"),
         ("i", "me", "기사님, 내려요!", ""),
         ("j", "nar", "알고 보니 전부 같은 정류장.", "알고 보니 / [전부 같은] 정류장"),
         ("k", "nar", "결국 다 같이 한 정거장 걸어서 복귀.", "결국 다 같이 / [걸어서] 복귀"),
         ("k2", "me", "다음엔 내가 누른다.", ""),
         ("z", "nar", "님들은 벨 먼저 누르는 쪽임?", "님들은 벨 / [먼저] 누르는 쪽?")]
    C = [("i0", {**o["h"], "steps": [0, 9, 9, 9], "chars": [me("shock", _keep=1, size=2.0, x=0.5, y=100)], "say": {"who": 0, "text": "기사님, 내려요!"}}),
         ("a", {**o["a"], "chars": [me("think")]}), ("b", o["b"]), ("c", o["c"]), ("e", o["e"]), ("e2", o["e2"]), ("f", vs_scene(o["f"], "sick")),
         ("g", o["g"]), ("g2", o["g2"]), ("g3", {"photo": "doodle/px15595490.jpg", "chars": [me("cry")], "steps": ["g3", 9, 9, 9], "say": {"who": 0, "text": "아까 눌렀어야 했는데"}}),
         ("h", o["h"]), ("j", {**{k: v for k, v in o["j"].items() if k not in ("photo", "photoPos")}, "bg": "street"}), ("k", o["k"]), ("k2", {"bg": "street", "chars": [me("angry")], "steps": ["k2", 9, 9, 9], "say": {"who": 0, "text": "다음엔 내가 누른다"}}), ("z", o["z"])]
    sfx = keep_sfx(e["sfx"], L, [("i0", "boing", 0.28)])
    build("doodle3", ["하차벨 아무도", "안 누르면 벌어지는 일"], L, C, e["music"], sfx, sources=SRC)

@ep
def doodle6():
    o, e = old("doodle6")
    L = [("j0", "boss", "넵.", ""),
         ("a", "nar", "팀장님의 이 넵이 제일 무서움.", "팀장님의 이 넵이 / 제일 [무서움]"),
         ("a2", "nar", "단톡 넵에도 단계가 있음.", "단톡 넵에도 / [단계]가 있음"),
         ("b", "nar", "일 단계 넵은 평범한 접수.", "[1단계] 넵 / 평범한 접수"),
         ("c", "nar", "이 단계 넵 느낌표는 열정 한 스푼.", "[2단계] 넵! / 열정 한 스푼"),
         ("d", "nar", "삼 단계 넵넵은 빨리 대화 끝내고 싶음.", "[3단계] 넵넵 / 빨리 끝내고 싶음"),
         ("e", "nar", "사 단계 넵 알겠습니다는 긴장한 상태.", "[4단계] 넵 알겠습니다 / 긴장 중"),
         ("f", "nar", "오 단계 넹은 팀장님이 편해진 사람.", "[5단계] 넹 / 팀장님이 편해짐"),
         ("g", "nar", "육 단계 넵 점점점점은 속으로 우는 중.", "[6단계] 넵.... / 속으로 [우는 중]"),
         ("h", "nar", "그리고 마지막 칠 단계.", "그리고 마지막 / [7단계]"),
         ("h2", "nar", "보고서 미루겠다고 보낸 날.", "보고서 미루겠다고 / 보낸 [그날]"),
         ("i", "me", "팀장님, 그 보고서 오늘은 좀 어려울 것 같습니다.", ""),
         ("j", "boss", "넵.", ""),
         ("k", "nar", "팀장님이 보내는 넵. 이건 그냥 공포.", '팀장님의 "넵." / 이건 [공포]'),
         ("l", "me", "아닙니다! 지금 바로 하겠습니다!", ""),
         ("l2", "nar", "그날 보고서, 퇴근 전에 냄.", "그날 보고서 / [퇴근 전]에 냄"),
         ("z", "nar", "님은 주로 몇 단계 넵 씀?", "님은 주로 / [몇 단계] 넵 씀?")]
    C = [("j0", {**o["k"], "steps": [9, 0, 9, 0], "big": '팀장님: "넵."'}), ("a2", {**o["a"], "steps": [9, 9, "a2.단계", 9]}), ("b", o["b"]), ("c", o["c"]), ("d", o["d"]),
         ("e", o["e"]), ("f", o["f"]), ("g", vs_scene(o["g"], "cry")), ("h", o["h"]), ("h2", {"bg": "office", "chars": [me("sick")], "prop": "📄", "steps": [9, 0.1, 9, 9]}), ("i", o["i"]), ("k", o["k"]), ("l", o["l"]),
         ("l2", {"bg": "night", "chars": [me("sleep")], "prop": "📄", "place": "📍 퇴근 5분 전", "steps": [9, 0.1, 9, 9]}), ("z", o["z"])]
    sfx = keep_sfx(e["sfx"], L, [("j0", "boing", 0.3)])
    build("doodle6", ['팀장님 "넵." 받으면', "벌어지는 일"], L, C, e["music"], sfx,
          voices={"boss": {"edge": "ko-KR-SunHiNeural", "rate": "+32%", "pitch": "-8Hz"}}, sources=SRC)

@ep
def doodle10():
    o, e = old("doodle10")
    G = dict(hairdo="perm", hair="#8a8a8a")
    L = [("e0", "me", "혹시 수상한 사람인가?", ""),
         ("a", "nar", "새벽 세 시 편의점. 문이 딸랑.", "새벽 [3시] 편의점 / 문이 딸랑"),
         ("b", "nar", "매일 같은 시간에 오는 손님이 있음.", "매일 [같은 시간]에 / 오는 손님"),
         ("c", "nar", "컵라면 하나, 삼각김밥 하나. 늘 똑같음.", "컵라면, 삼각김밥 / 늘 [똑같음]"),
         ("d", "nar", "말 한마디 없이 먹고 감. 솔직히 좀 무서움.", "말없이 먹고 감 / 솔직히 [좀 무서움]"),
         ("d2", "nar", "눈도 안 마주치고 고개만 까딱.", "눈도 안 마주치고 / 고개만 [까딱]"),
         ("f", "nar", "그러다 비가 엄청 오던 날 새벽.", "비가 [엄청] 오던 / 날 새벽"),
         ("g", "nar", "그 손님이 들어오자마자 계산대로 직진.", "들어오자마자 / 계산대로 [직진]"),
         ("h", "me", "뭐, 뭐 찾으세요?", ""),
         ("i", "nar", "내민 건 따뜻한 캔커피 하나.", "내민 건 / 따뜻한 [캔커피] 하나"),
         ("j", "guest", "매일 고생 많아요. 이건 학생 거.", ""),
         ("j2", "me", "네? 저, 저요?", ""),
         ("k", "nar", "알고 보니 야간 근무 마치고 오는 길이었음.", "알고 보니 / [야간 근무] 퇴근길"),
         ("k2", "nar", "그날 이후, 그 손님 오면 내가 먼저 인사함.", "그날 이후 / 내가 [먼저] 인사함"),
         ("l", "me", "오늘도 수고하셨어요!", ""),
         ("z", "nar", "님은 새벽에 이런 손님 만나 봄?", "님은 이런 손님 / [만나 봄]?")]
    C = [("e0", {**o["e"], "steps": [0, 9, 9, 9]}), ("a", {**o["a"], "steps": [9, 9, "a.딸랑", 9]}), ("b", o["b"]), ("c", o["c"]), ("d", o["d"]), ("d2", {"bg": "store", "chars": [guy("neutral", **G)], "steps": [9, 9, 9, 9]}), ("f", o["f"]), ("g", o["g"]),
         ("h", o["h"]), ("i", o["i"]), ("j", o["j"]), ("j2", {"bg": "#e9e4dc", "chars": [me("shy")], "prop": "🥫", "steps": ["j2", 0.1, 9, 9], "say": {"who": 0, "text": "네? 저, 저요?"}}), ("k", o["k"]), ("k2", o["k2"]), ("l", o["l"]), ("z", o["z"])]
    sfx = keep_sfx(e["sfx"], L, [("e0", "pop", 0.22)])
    build("doodle10", ["새벽 3시 편의점", "수상한 손님의 정체"], L, C, e["music"], sfx,
          voices={"guest": {"edge": "ko-KR-SunHiNeural", "rate": "+32%", "pitch": "-6Hz"}}, sources=SRC)

FRI = dict(hairdo="bob", hair="#3b3b3b")
DAD = dict(hairdo="spiky", hair="#3b3b3b")
V_FRIEND = {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+5Hz"}
V_MOM = {"edge": "ko-KR-SunHiNeural", "rate": "+38%", "pitch": "-4Hz"}
V_DAD = {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+30%", "pitch": "-10Hz"}
P = lambda i: f"doodle/px{i}.jpg"
say = lambda t, who=0: {"who": who, "text": t}

@ep
def doodle1():
    """roommate stacks power strips three high; 도치 quotes the rules; the whole tower turns out not plugged into the wall (허탈 개그)"""
    e = v1("doodle1", "edit")
    L = [("a0", "me", "멀티탭에 또 멀티탭?", ""),
         ("a", "nar", "자취방 멀티탭 탑, 벌써 삼 층.", "자취방 멀티탭 탑 / 벌써 [3층]"),
         ("b", "friend", "칸이 모자란데 어떡해.", ""),
         ("c", "friend", "근데 요즘 폰이 하루 종일 충전 중이야.", ""),
         ("d", "me", "정부도 멀티탭에 또 연결하지 말랬어.", ""),
         ("e", "friend", "그거 그냥 잔소리잖아.", ""),
         ("f", "me", "콘센트, 멀티탭 사고만 5년간 387건이래.", ""),
         ("g", "friend", "우리 건 멀쩡하거든?", ""),
         ("h", "nar", "그래서 도치가 탑을 한 층씩 따라 내려가 봄.", "탑을 한 층씩 / [따라] 내려가 봄"),
         ("i", "nar", "삼 층엔 충전기 다섯 개. 이 층엔 선풍기.", "3층 충전기 5개 / 2층 [선풍기]"),
         ("j", "nar", "그리고 일 층 플러그를 따라가 봤더니,", "1층 플러그를 / [따라가] 봤더니"),
         ("k", "nar", "벽 콘센트에 안 꽂혀 있었음.", "벽 콘센트에 / [안 꽂혀] 있었음"),
         ("l", "friend", "어쩐지 충전이 안 되더라.", ""),
         ("z", "nar", "님 방 멀티탭은 지금 몇 층임?", "님 방 멀티탭은 / 지금 [몇 층]?")]
    C = [("a0", {"photo": P(16886334), "chars": [me("angry", _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(5544612), "chars": [me("shock")], "big": "3층", "steps": [9, 9, 9, "a.삼"]}),
         ("b", {"bg": "bedroom", "chars": [guy("smug", **FRI)], "prop": "🔌", "steps": ["b", 0.1, 9, 9], "say": say("칸이 모자란데 어떡해")}),
         ("c", {"bg": "bedroom", "chars": [guy("think", **FRI)], "prop": "📱", "steps": ["c", 0.1, 9, 9], "say": say("폰이 하루 종일 충전 중")}),
         ("d", {"photo": P(8101095), "chars": [me("angry")], "steps": ["d", 9, 9, 9], "say": say("또 연결하지 말랬어")}),
         ("e", {"bg": "#e9e4dc", "chars": [guy("smug", **FRI)], "steps": ["e", 9, 9, 9], "say": say("그냥 잔소리잖아")}),
         ("f", {"bg": "office", "chars": [me("shock")], "big": "387건", "steps": ["f", 9, 9, "f+0.9"], "say": say("5년간 387건이래")}),
         ("g", {"bg": "bedroom", "chars": [guy("angry", **FRI), me("sick")], "steps": ["g", 9, 9, 9], "say": say("우리 건 멀쩡하거든?")}),
         ("h", {"photo": P(5544612), "photoPos": "30% 50%", "chars": [me("think")], "prop": "🔍", "steps": [9, 0.1, 9, 9]}),
         ("i", {"photo": P(16886334), "photoPos": "60% 50%", "chars": [me("think")], "prop": "🌀", "steps": [9, "i.선풍기", 9, 9]}),
         ("j", {"bg": "night", "chars": [me("think", to="shock")], "prop": "🔌", "steps": [9, 0.1, "j@end", 9]}),
         ("k", {"photo": P(8101107), "chars": [me("shock")], "big": "안 꽂힘", "steps": [9, 9, 9, "k.안"]}),
         ("l", {"bg": "bedroom", "chars": [guy("laugh", **FRI), me("cry")], "steps": ["l", 9, 9, 9], "say": say("어쩐지 충전이 안 되더라")}),
         ("z", {"photo": P(5544612), "chars": [me("think", to="smug")], "steps": [9, 9, "z.몇", 9]})]
    sfx = [["a.삼", "pop", 0.25], ["b", "pop", 0.22], ["d", "pop", 0.22], ["f", "boing", 0.25], ["g", "pop", 0.22], ["h", "whoosh", 0.2],
           ["j", "whoosh", 0.2], ["k.안", "boing", 0.3], ["l", "pop", 0.22], ["z", "pop", 0.22]]
    build("doodle1", ["멀티탭에 멀티탭", "꽂으면 벌어지는 일"], L, C, e["music"], sfx, voices={"friend": V_FRIEND}, sources=SRC)

@ep
def doodle4():
    """10 minutes of searching the fridge for kimchi mom says is there; mom "finds" it in 1 second: the jar she had in her hand all along (정체 반전)"""
    o, e = old("doodle4")
    JAR = {"prop": "🫙", "propX": 0.3}
    L = [("b0", "mom", "냉장고에 있잖아!", ""),
         ("a0", "nar", "엄마 말 믿고 열었다가 십 분 날림.", "엄마 말 믿고 / [10분] 날림"),
         ("a", "me", "엄마, 김치 어디 있어?", ""),
         ("b", "mom", "냉장고에 있잖아!", ""),
         ("c", "nar", "열어 봄. 없음.", "열어 봄 / [없음]"),
         ("c2", "nar", "야채 칸 냉동실 문 칸까지 다 열어 봄.", "야채 칸 냉동실 / [문 칸]까지 다 봄"),
         ("d", "nar", "반찬통 탑을 하나씩 해체함.", "반찬통 [탑]을 / 하나씩 해체"),
         ("e", "nar", "뒤에 그 뒤에 또 그 뒤까지 수색.", "뒤에 뒤에 / [또 뒤]까지 수색"),
         ("e2", "nar", "십 분째 냉장고 문 열고 서 있음.", "[10분]째 / 문 열고 서 있음"),
         ("m", "mom", "문 좀 닫아, 냉기 다 나가!", ""),
         ("f", "me", "엄마, 진짜 없는데?", ""),
         ("g", "mom", "눈은 장식이니?", ""),
         ("h", "nar", "엄마 등장. 냉장고 열고 일 초 만에 꺼냄.", "엄마 등장 / [1초] 만에 꺼냄"),
         ("h2", "mom", "여기 있네!", ""),
         ("i", "me", "그거 아까부터 엄마 손에 있던 거잖아.", ""),
         ("j", "mom", "어머, 이걸 왜 들고 있었지?", ""),
         ("z", "nar", "님 집 엄마도 이런 적 있음?", "님 집 엄마도 / 이런 적 [있음]?")]
    C = [("b0", {**o["b"], **JAR, "steps": [0, 0, 9, 9]}), ("a0", {**o["a0"], "steps": [9, 9, "a0.날림", 9]}), ("a", o["a"]),
         ("b", {**o["m"], **JAR, "say": {"who": 0, "text": "냉장고에 있잖아!"}, "chars": [guy("angry", **MOM)], "steps": ["b", 0, 9, 9]}),
         ("c", o["c"]), ("c2", o["c2"]), ("d", o["d"]), ("e", o["e"]), ("e2", o["e2"]), ("m", {**o["m"], **JAR, "steps": ["m", 0, 9, 9]}), ("f", o["f"]),
         ("g", {**o["g"], **JAR, "steps": ["g", 0, 9, 9]}), ("h", {**o["h"], "big": "1초"}),
         ("h2", {"photo": P(38853682), "chars": [guy("smug", **MOM)], "prop": "🫙", "steps": ["h2", 0.1, 9, 9], "say": say("여기 있네!")}),
         ("i", {"bg": "home", "chars": [me("angry")], "prop": "🫙", "steps": ["i", 0.1, 9, 9], "say": say("아까부터 엄마 손에 있던 거잖아")}),
         ("j", {"bg": "#FFE14D", "chars": [guy("shock", **MOM)], "prop": "🫙", "steps": ["j", 0.1, 9, 9], "say": say("어머, 이걸 왜 들고 있었지?")}),
         ("z", {**o["z"], "steps": [9, 9, "z.있음", 9]})]
    sfx = keep_sfx(e["sfx"], L, [("b0", "boing", 0.28), ("h2", "pop", 0.25), ("i", "boing", 0.3)])
    build("doodle4", ['"냉장고에 있잖아"', "엄마 vs 나"], L, C, e["music"], sfx, voices={"mom": V_MOM}, sources=SRC)

@ep
def doodle5():
    """도치 buys 4번 eggs thinking bigger is better; mom explains the shell code; the eggs already in mom's fridge are 4번 too (역전)"""
    e = v1("doodle5", "edit")
    L = [("a0", "mom", "계란 일 번으로 사 오랬지!", ""),
         ("a", "nar", "사 번 계란 사 왔다가 들은 말.", "[4번] 계란 사 왔다가 / 들은 말"),
         ("b", "me", "숫자 클수록 좋은 거 아니야?", ""),
         ("c", "mom", "끝자리는 닭이 사는 집이야.", ""),
         ("d", "nar", "껍데기 열 자리 중 맨 끝 한 자리가 사육환경 번호.", "열 자리 중 맨 끝 / [사육환경] 번호"),
         ("e", "mom", "일 번은 풀밭, 이 번은 축사 안을 돌아다녀.", ""),
         ("f", "mom", "삼 번, 사 번은 케이지.", ""),
         ("g", "me", "그럼 사 번이 제일 넓은 방 아님?", ""),
         ("h", "nar", "땡. 사 번은 한 마리당 에이포 한 장보다 좁음.", "[4번]은 한 마리당 / A4보다 좁음"),
         ("i", "me", "그럼 앞에 영팔이삼은 뭔데?", ""),
         ("j", "mom", "닭이 알 낳은 날. 팔월 이십삼일.", ""),
         ("k", "nar", "도치, 반성하며 냉장고 문을 열었는데,", "반성하며 / 냉장고 문을 [열었는데]"),
         ("l", "nar", "안에 있던 엄마 계란 끝자리도 사 번.", "엄마 계란 끝자리도 / [4번]"),
         ("m", "me", "엄마, 이건 뭔데?", ""),
         ("n", "mom", "그건 세일하길래.", ""),
         ("z", "nar", "님 냉장고 계란은 몇 번임?", "님 냉장고 계란은 / [몇 번]임?")]
    C = [("a0", {"photo": P(38853682), "chars": [guy("angry", **MOM, _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(8556246), "chars": [me("shock")], "big": "4번", "steps": [9, 9, 9, "a+0.3"]}),
         ("b", {"bg": "home", "chars": [me("smug")], "prop": "🥚", "steps": ["b", 0.1, 9, 9], "say": say("숫자 클수록 좋은 거 아님?")}),
         ("c", {"bg": "home", "chars": [guy("angry", **MOM), me("think")], "steps": ["c", 9, 9, 9], "say": say("끝자리는 닭이 사는 집이야")}),
         ("d", {"photo": P(19891628), "chars": [me("think")], "big": "끝 1자리", "steps": [9, 9, 9, "d.끝"]}),
         ("e", {"photo": P(2255459), "chars": [guy("happy", **MOM)], "big": "1번 풀밭", "steps": ["e", 9, 9, "e.풀밭"], "say": say("1번 풀밭, 2번 축사 안")}),
         ("f", {"photo": P(1300375), "chars": [guy("sad", **MOM)], "big": "3·4번 케이지", "steps": ["f", 9, 9, "f+0.2"]}),
         ("g", {"bg": "#dff3ff", "chars": [me("smug")], "prop": "🏠", "steps": ["g", 0.1, 9, 9], "say": say("4번이 제일 넓은 방 아님?")}),
         ("h", {"bg": "#FFB3C7", "chars": [me("shock")], "prop": "📄", "big": "A4보다 좁음", "steps": [9, 0.1, 9, "h.좁음"]}),
         ("i", {"photo": P(19891628), "photoPos": "30% 50%", "chars": [me("think")], "steps": ["i", 9, 9, 9], "say": say("앞에 0823은 뭔데?")}),
         ("j", {"bg": "#dff3ff", "chars": [guy("smug", **MOM)], "prop": "🐣", "big": "8월 23일", "steps": ["j", 0.1, 9, "j.팔월"], "say": say("닭이 알 낳은 날")}),
         ("k", {"photo": P(38853682), "chars": [me("sad")], "steps": [9, 9, 9, 9]}),
         ("l", {"photo": P(8556246), "photoPos": "30% 50%", "chars": [me("shock")], "big": "엄마 계란도 4번", "steps": [9, 9, 9, "l.사"]}),
         ("m", {"bg": "home", "chars": [me("smug"), guy("shock", **MOM)], "prop": "🥚", "steps": ["m", 0.1, 9, 9], "say": say("엄마, 이건 뭔데?")}),
         ("n", {"bg": "#FFE14D", "chars": [guy("shy", **MOM)], "steps": ["n", 9, 9, 9], "say": say("그건 세일하길래…")}),
         ("z", {"photo": P(6294391), "chars": [me("think", to="smug")], "steps": [9, 9, "z.몇", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b", "pop", 0.22], ["d.끝", "pop", 0.25], ["g", "pop", 0.22], ["h.좁음", "boing", 0.28], ["j.팔월", "pop", 0.25],
           ["k", "whoosh", 0.2], ["l.사", "boing", 0.3], ["n", "pop", 0.22], ["z", "pop", 0.22]]
    build("doodle5", ["계란 1번 vs 4번", "진짜 차이"], L, C, e["music"], sfx, voices={"mom": V_MOM}, sources=SRC)

@ep
def doodle7():
    """도치 wants to replace the 2010 extinguisher; dad argues it is unused so new; the numbers beat him; next day it is the front door's doorstop (허탈 개그)"""
    e = v1("doodle7", "edit")
    L = [("a0", "dad", "멀쩡한 걸 왜 버려!", ""),
         ("a", "nar", "현관 소화기 바꾸자고 했다가 들은 말.", "현관 소화기 / 바꾸자 했다가 [들은 말]"),
         ("b", "me", "아빠, 바늘이 초록 밖이야.", ""),
         ("c", "nar", "압력계 바늘이 초록 밖이면 압력이 빠진 거라 교체.", "바늘이 초록 밖 / 압력 빠짐 [교체]"),
         ("d", "dad", "한 번도 안 썼으니까 새거지.", ""),
         ("e", "me", "여기 제조 이천십 년이라고 적혀 있는데?", ""),
         ("f", "nar", "분말 소화기는 딱 십 년.", "분말 소화기는 / 딱 [10년]"),
         ("g", "dad", "그럼 검사받으면 되잖아.", ""),
         ("h", "nar", "검사 합격해도 연장은 한 번, 삼 년뿐.", "검사 합격해도 / 연장은 1번 [3년]"),
         ("i", "me", "이천십에 십삼 더하면 이천이십삼. 이미 지났어.", ""),
         ("j", "dad", "알았다, 알았어. 새로 사자.", ""),
         ("k", "nar", "근데 다음 날, 그 소화기가 안 버려짐.", "근데 다음 날 / 소화기가 [안 버려짐]"),
         ("l", "nar", "현관문 밑에 받쳐져 있었음.", "현관문 밑에 / [받쳐져] 있었음"),
         ("m", "dad", "문 받침으로는 아직 쌩쌩하잖아.", ""),
         ("z", "nar", "님 집 소화기 바늘, 지금 초록임?", "님 집 소화기 바늘 / 지금 [초록]임?")]
    C = [("a0", {"bg": "door", "chars": [guy("angry", **DAD, _keep=1, size=2.0, x=0.36, y=100)], "prop": "🧯", "propX": 0.84, "steps": [9, 0, 9, 9]}),
         ("a", {"photo": P(21299748), "chars": [me("shock")], "steps": [9, 9, 9, 9], "place": "📍 현관"}),
         ("b", {"photo": P(39649976), "photoPos": "50% 35%", "chars": [me("think")], "steps": ["b", 9, 9, 9], "say": say("바늘이 초록 밖이야")}),
         ("c", {"bg": "#FFB3C7", "chars": [me("shock")], "prop": "🧯", "big": "초록 밖 = 교체", "steps": [9, 0.1, 9, "c+0.6"]}),
         ("d", {"bg": "door", "chars": [guy("smug", **DAD)], "prop": "🧯", "steps": ["d", 0.1, 9, 9], "say": say("안 썼으니까 새거지")}),
         ("e", {"photo": P(13756513), "chars": [me("smug")], "big": "2010", "steps": ["e", 9, 9, "e.이천십"], "say": say("제조 2010년인데?")}),
         ("f", {"bg": "#FFE14D", "chars": [me("shock")], "prop": "⏳", "big": "분말 10년", "steps": [9, 0.1, 9, "f+0.3"]}),
         ("g", {"bg": "home", "chars": [guy("think", **DAD)], "steps": ["g", 9, 9, 9], "say": say("검사받으면 되잖아")}),
         ("h", {"bg": "#dff3ff", "chars": [me("think")], "prop": "✅", "big": "+3년, 한 번", "steps": [9, 0.1, 9, "h+0.5"]}),
         ("i", {"bg": "office", "chars": [me("smug"), guy("sick", **DAD)], "big": "2023", "steps": ["i", 9, 9, "i.이천이십삼"], "say": say("이미 지났어")}),
         ("j", {"bg": "home", "chars": [guy("sad", **DAD)], "steps": ["j", 9, 9, 9], "say": say("알았다, 새로 사자")}),
         ("k", {"bg": "night", "chars": [me("happy", to="think")], "place": "📍 다음 날", "steps": [9, 9, "k.안", 9]}),
         ("l", {"bg": "door", "chars": [me("shock")], "prop": "🧯", "propX": 0.8, "big": "문 받침", "steps": [9, 0, 9, "l.받쳐져"]}),
         ("m", {"bg": "door", "chars": [guy("laugh", **DAD)], "prop": "🧯", "propX": 0.84, "steps": ["m", 0, 9, 9], "say": say("문 받침으로는 쌩쌩하잖아")}),
         ("z", {"photo": P(21299748), "chars": [me("think", to="smug")], "steps": [9, 9, "z.초록", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b", "pop", 0.22], ["d", "pop", 0.22], ["e.이천십", "boing", 0.25], ["g", "pop", 0.22], ["i.이천이십삼", "boing", 0.28],
           ["k", "whoosh", 0.2], ["l.받쳐져", "boing", 0.3], ["m", "pop", 0.22], ["z", "pop", 0.22]]
    build("doodle7", ["소화기 바늘", "초록 밖이면 벌어지는 일"], L, C, e["music"], sfx, voices={"dad": V_DAD}, sources=SRC)

@ep
def doodle8():
    """도치 stares at the buzzer, checks at the counter, it buzzes in hand: it was the friend's buzzer, which the friend had set next to his (오해)"""
    o, e = old("doodle8")
    L = [("g0", "me", "저기, 제 거 아직인가요?", ""),
         ("a", "nar", "카페 진동벨, 받는 순간부터 게임 시작임.", "진동벨 받는 순간 / [게임] 시작"),
         ("b", "nar", "자리에 앉자마자 벨만 쳐다봄.", "앉자마자 / 벨만 [쳐다봄]"),
         ("b2", "nar", "친구도 벨 하나 받아서 내 벨 옆에 둠.", "친구 벨도 / 내 벨 [옆에]"),
         ("c2", "friend", "야, 내 말 듣고 있어?", ""),
         ("d", "nar", "옆 테이블 벨이 울리면 내 건 줄 알고 움찔.", "옆 테이블 벨에 / 내 건 줄 [움찔]"),
         ("e", "nar", "십 분째 조용함. 혹시 고장 남?", "[10분]째 조용 / 혹시 고장?"),
         ("e2", "friend", "그거 진동 꺼진 거 아니야?", ""),
         ("f", "nar", "결국 벨 하나 집어 들고 카운터로 감.", "벨 하나 집어 들고 / [카운터]로"),
         ("g", "me", "저기, 제 거 아직인가요?", ""),
         ("h", "nar", "그 순간 손에서 벨이 울림. 부르르르.", "그 순간 손에서 / [부르르르]"),
         ("i", "nar", "카운터 바로 앞에서 울리는 벨. 민망함 백 퍼센트.", "카운터 앞에서 울림 / 민망함 [100%]"),
         ("j", "nar", "근데 알고 보니, 내가 들고 간 건 친구 벨이었음.", "내가 들고 간 건 / [친구] 벨"),
         ("k", "friend", "오, 내 거 가져왔어? 고마워!", ""),
         ("z", "nar", "님은 진동벨 울리면 몇 초 만에 일어남?", "님은 벨 울리면 / [몇 초] 만에 일어남?")]
    C = [("g0", {**o["g"], "chars": [me("think", _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}), ("a", o["a"]), ("b", o["b"]),
         ("b2", {"photo": P(12620633), "chars": [guy("happy", **FRI)], "prop": "🔔🔔", "propX": 0.7, "steps": [9, 0.1, 9, 9]}),
         ("c2", o["c2"]), ("d", o["d"]), ("e", o["e"]), ("e2", {**o["c2"], "say": {"who": 0, "text": "진동 꺼진 거 아니야?"}, "steps": ["e2", 9, 9, 9]}),
         ("f", o["f"]), ("g", o["g"]), ("h", o["h"]), ("i", o["i"]), ("j", o["j"]), ("k", o["k"]), ("z", o["z"])]
    sfx = keep_sfx(e["sfx"], L, [("g0", "pop", 0.22), ("b2", "pop", 0.22)])
    build("doodle8", ["카페 진동벨", "울리면 벌어지는 일"], L, C, e["music"], sfx, voices={"friend": V_FRIEND}, sources=SRC)

@ep
def doodle9():
    """여기요파 vs 저기요파, 도치 can't call the staff; the friend's one word "이모!" wins (허탈 개그); cold open is 도치's timid try"""
    o, e = old("doodle9")
    L = [("h0", "me", "저, 저기요…", ""),
         ("a", "nar", "식당에서 직원 부르기, 이게 제일 어려움.", "식당에서 직원 부르기 / 이게 제일 [어려움]"),
         ("b", "nar", "여기요파는 내 위치부터 알려줌.", "[여기요]파는 / 내 위치부터 알려줌"),
         ("c", "nar", "저기요파는 일단 말부터 걸고 봄.", "[저기요]파는 / 일단 말부터 걸고 봄"),
         ("d", "nar", "근데 진짜 문제는 타이밍.", "근데 진짜 문제는 / [타이밍]"),
         ("e", "nar", "직원분 지나갈 때 손을 반쯤 듦.", "지나갈 때 / 손을 [반쯤] 듦"),
         ("f", "nar", "못 보고 지나감. 든 손은 머리 긁는 척.", "못 보고 지나감 / 머리 긁는 [척]"),
         ("f2", "nar", "또 지나감. 이번엔 눈만 마주치고 감.", "또 지나감 / 눈만 [마주침]"),
         ("g", "nar", "용기 내서 목소리를 냄.", "용기 내서 / [목소리]를 냄"),
         ("h", "me", "저, 저기요…", ""),
         ("i", "nar", "아무도 못 들음. 옆 테이블만 쳐다봄.", "아무도 못 들음 / 옆 테이블만 [쳐다봄]"),
         ("i2", "me", "들은 척이라도 해 주지.", ""),
         ("j", "nar", "그때 친구가 한 방에 끝냄.", "그때 친구가 / [한 방]에 끝냄"),
         ("k", "friend", "이모! 여기 공깃밥 하나요!", ""),
         ("l", "nar", "결론. 최강은 이모님 파.", "결론: 최강은 / [이모님]파"),
         ("z", "nar", "님은 여기요파, 저기요파, 이모님파?", "님은 여기요? 저기요? / [이모님]?")]
    C = [("h0", {**o["h"], "chars": [me("shy", _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}), ("a", {**o["a"], "steps": [9, 9, "a.어려움", 9]}), ("b", o["b"]), ("c", o["c"]),
         ("d", {"bg": "#dff3ff", "chars": [me("think")], "prop": "⏱️", "big": "타이밍", "steps": [9, 0.1, 9, "d.타이밍"]}), ("e", o["e"]),
         ("f", o["f"]), ("f2", o["f2"]), ("g", o["g"]), ("h", o["h"]), ("i", o["i"]), ("i2", {**o["h"], "say": {"who": 0, "text": "들은 척이라도 해 주지"}, "chars": [me("cry")], "steps": ["i2", 9, 9, 9]}),
         ("j", o["j"]), ("k", o["k"]), ("l", o["l"]), ("z", o["z"])]
    sfx = keep_sfx(e["sfx"], L, [("h0", "pop", 0.2)])
    build("doodle9", ["식당 직원 부를 때", '"여기요" vs "저기요"'], L, C, e["music"], sfx,
          voices={"friend": V_FRIEND, "me": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+25%", "pitch": "+12Hz"}}, sources=SRC)


for sid in sys.argv[1:] or sorted(EP, key=lambda s: int(s[6:])):
    EP[sid]()
