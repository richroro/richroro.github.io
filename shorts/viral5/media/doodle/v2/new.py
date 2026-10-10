"""doodle11-doodle16 (낙서 짤툰 v2, research/benchmark-drawn.md §1 idea list): "who's in the wrong?" angles as everyday
situations, both sides given. Facts are cited in README "낙서 짤툰 v2"; the stories themselves are 창작.
usage: python3 media/doodle/v2/new.py [doodle11 ...]     (from shorts/viral5)
"""
import sys
from lib import all_sources, build, guy, me

SRC = all_sources()
EP = {}
M = lambda f: {"file": f"music/{f}.mp3", "gain": 0.12, "start": 0}
P = lambda i: f"doodle/px{i}.jpg"
RUSH = dict(hairdo="bald")
OWNER = dict(hairdo="perm", hair="#8a8a8a")
FRIEND = dict(hairdo="bob", hair="#3b3b3b")
AUNT = dict(hairdo="perm", hair="#5a3a2a")

def ep(fn):
    EP[fn.__name__] = fn
    return fn

def say(text, who=0):
    return {"who": who, "text": text}

@ep
def doodle11():
    L = [("a0", "rush", "저기요, 바빠요!", ""),
         ("a", "nar", "에스컬레이터 왼쪽에 가만히 섰다가 들은 말.", "왼쪽에 가만히 섰다가 / [들은 말]"),
         ("b", "nar", "한쪽은 걷는 사람한테 길 비켜 주는 게 매너라는 쪽.", "걷는 사람 길 비켜 주기 / [매너]다"),
         ("c", "rush", "바쁜 사람도 있잖아요!", ""),
         ("d", "nar", "다른 쪽은 에스컬레이터에서 걷는 게 위험하다는 쪽.", "에스컬레이터에서 걷기 / [위험]하다"),
         ("e", "me", "저는 안전 수칙 지킨 건데요?", ""),
         ("f", "nar", "실제로 십 년간 에스컬레이터 중대 사고 백삼십오 건.", "10년간 중대 사고 / [135건]"),
         ("g", "nar", "그중 구십 건이 이용자 과실이었음.", "그중 [90건]이 / 이용자 과실"),
         ("h", "nar", "사실 이천칠 년엔 정부가 두 줄 서기 캠페인까지 했음.", "2007년 / [두 줄 서기] 캠페인"),
         ("i", "nar", "근데 이천십오 년에 공식 중단.", "2015년 / 공식 [중단]"),
         ("j", "nar", "올해 정부 토론회 설문도 거의 반반.", "올해 토론회 설문 / 거의 [반반]"),
         ("k", "nar", "결국 정부는 두 줄 서기를 밀어붙이지 않기로 함.", "두 줄 서기 / [강요 안 함]"),
         ("l", "nar", "대신 딱 세 가지만 지켜 달라는 것.", "대신 딱 / [세 가지]만"),
         ("m", "nar", "손잡이 잡기, 걷거나 뛰지 않기, 안전선 지키기.", "손잡이·걷지 않기 / [안전선]"),
         ("n", "rush", "그럼 저는 계단으로 갈게요.", ""),
         ("z", "nar", "님은 서는 편임, 걷는 편임?", "님은 [서는] 편? / [걷는] 편?")]
    C = [("a0", {"photo": P(7202628), "chars": [guy("angry", **RUSH, _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(18764954), "chars": [me("shock")], "steps": [9, 9, 9, 9], "place": "📍 에스컬레이터"}),
         ("b", {"bg": "subway", "chars": [guy("smug", **RUSH), me("think")], "big": "비켜 주기 = 매너", "steps": [9, 9, 9, "b+0.5"]}),
         ("c", {"photo": P(7202628), "photoPos": "30% 50%", "chars": [guy("angry", **RUSH)], "steps": ["c", 9, 9, 9], "say": say("바쁜 사람도 있잖아요!")}),
         ("d", {"bg": "#dff3ff", "chars": [me("think")], "prop": "⚠️", "big": "걷기 = 위험", "steps": [9, 0.1, 9, "d+0.6"]}),
         ("e", {"photo": P(18764954), "chars": [me("angry")], "steps": ["e", 9, 9, 9], "say": say("저는 안전 수칙 지킨 건데요?")}),
         ("f", {"bg": "#FFE14D", "chars": [me("shock")], "big": "135건", "steps": [9, 9, 9, "f.백삼십오"]}),
         ("g", {"bg": "#FFB3C7", "chars": [me("sick")], "prop": "🚶", "big": "90건 = 이용자", "steps": [9, 0.1, 9, "g+0.4"]}),
         ("h", {"bg": "subway", "chars": [me("happy"), guy("happy", **FRIEND)], "big": "2007 두 줄 서기", "steps": [9, 9, 9, "h+0.5"]}),
         ("i", {"bg": "night", "chars": [me("sad")], "prop": "🛑", "big": "2015 중단", "steps": [9, 0.1, 9, "i+0.4"]}),
         ("j", {"bg": "office", "chars": [guy("think", **RUSH), me("think")], "big": "49.9 : 50.1", "steps": [9, 9, 9, "j.반반"]}),
         ("k", {"photo": P(7202628), "photoPos": "70% 50%", "chars": [me("neutral", to="smug")], "steps": [9, 9, "k.않기로", 9]}),
         ("l", {"bg": "#d8f5c8", "chars": [me("think")], "prop": "☝️", "big": "딱 3가지", "steps": [9, 0.1, 9, "l+0.3"]}),
         ("m", {"photo": P(18764954), "chars": [me("happy")], "prop": "✋", "big": "손잡이 · 안전선", "steps": [9, "m.손잡이", 9, "m+0.3"]}),
         ("n", {"bg": "street", "chars": [guy("smug", **RUSH)], "prop": "🏃", "steps": ["n", 0.1, 9, 9], "say": say("계단으로 갈게요")}),
         ("z", {"photo": P(7202628), "chars": [me("think", to="smug")], "steps": [9, 9, "z.걷는", 9]})]
    sfx = [["a", "whoosh", 0.2], ["c", "pop", 0.22], ["e", "pop", 0.22], ["f.백삼십오", "boing", 0.28], ["h", "whoosh", 0.2], ["i.중단", "k_error_003", 0.28],
           ["j.반반", "pop", 0.25], ["k.않기로", "boing", 0.28], ["m", "whoosh", 0.2], ["n", "pop", 0.22], ["z", "pop", 0.22]]
    build("doodle11", ["현재 논란중인", "에스컬레이터 2줄 서기"], L, C, M("sneaky_snitch"), sfx,
          voices={"rush": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "-2Hz"}}, sources=SRC)

@ep
def doodle12():
    L = [("a0", "owner", "사진은 왜 찍어요?", ""),
         ("a", "nar", "소화전 앞 불법주차, 신고하려다 들은 말.", "소화전 앞 불법주차 / 신고하려다 [들은 말]"),
         ("b", "nar", "신고는 안전신문고 앱으로 함.", "신고는 / [안전신문고] 앱"),
         ("c", "nar", "같은 자리, 같은 각도에서 일 분 간격으로 두 장.", "같은 자리·각도 / [1분 간격] 두 장"),
         ("d", "nar", "차 번호랑 찍은 시간이 보여야 함.", "차 번호·시간이 / [보여야] 함"),
         ("e", "owner", "잠깐 세운 건데 너무하네.", ""),
         ("f", "nar", "차 주인은 잠깐이라고 억울해함.", "차 주인은 / [잠깐]이라 억울"),
         ("g", "nar", "근데 소화전, 교차로 모퉁이, 버스 정류소, 횡단보도.", "소화전·모퉁이 / 정류소·[횡단보도]"),
         ("h", "nar", "초등학교 앞 어린이 보호구역, 그리고 인도.", "어린이 보호구역 / 그리고 [인도]"),
         ("i", "nar", "이 여섯 곳은 일 분만 서 있어도 주민 신고 대상.", "이 [6곳]은 / 1분만 서도 신고 대상"),
         ("j", "nar", "요건 맞으면 단속 공무원 없이 과태료.", "요건 맞으면 / 현장 단속 [없이] 과태료"),
         ("k", "nar", "소화전 앞은 승용차 기준 팔만 원.", "소화전 앞 승용차 / [8만 원]"),
         ("l", "me", "불 나면 소방차가 여기 써야 하잖아요.", ""),
         ("m", "nar", "그런데 다음 날 저녁.", "그런데 / [다음 날] 저녁"),
         ("n", "dad", "아들, 아빠 차에 과태료가 나왔다?", ""),
         ("o", "nar", "그 차, 우리 아빠 차였음.", "그 차 / [우리 아빠] 차였음"),
         ("z", "nar", "님이면 신고함, 안 함?", "님이면 / [신고]함? 안 함?")]
    C = [("a0", {"photo": P(5264140), "chars": [guy("angry", **OWNER, _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(5264140), "photoPos": "70% 50%", "chars": [me("shock")], "prop": "🚗", "steps": [9, 0.1, 9, 9]}),
         ("b", {"bg": "home", "chars": [me("smug")], "prop": "📱", "steps": [9, 0.1, 9, 9]}),
         ("c", {"photo": P(15818611), "chars": [me("think")], "prop": "📸", "big": "1분 간격 2장", "steps": [9, 0.1, 9, "c+0.8"]}),
         ("d", {"bg": "street", "chars": [me("think")], "prop": "🚗", "big": "번호 + 시간", "steps": [9, 0.1, 9, "d+0.4"]}),
         ("e", {"bg": "street", "chars": [guy("angry", **OWNER), me("sick")], "steps": ["e", 9, 9, 9], "say": say("잠깐 세운 건데 너무하네")}),
         ("f", {"bg": "#e9e4dc", "chars": [guy("sad", **OWNER)], "big": "잠깐인데…", "steps": [9, 9, 9, "f+0.4"]}),
         ("g", {"photo": P(5264140), "photoPos": "40% 50%", "chars": [me("think")], "big": "소화전 · 모퉁이", "steps": [9, 9, 9, "g.교차로"]}),
         ("h", {"photo": P(15818611), "photoPos": "60% 50%", "chars": [me("think")], "big": "보호구역 · 인도", "steps": [9, 9, 9, "h.인도"]}),
         ("i", {"bg": "#FFE14D", "chars": [me("shock")], "big": "6곳 = 1분", "steps": [9, 9, 9, "i+0.4"]}),
         ("j", {"bg": "office", "chars": [me("neutral", to="smug")], "prop": "📄", "steps": [9, 0.1, "j.과태료", 9]}),
         ("k", {"bg": "#FFB3C7", "chars": [guy("cry", **OWNER)], "prop": "💸", "big": "8만 원", "steps": [9, 0.1, 9, "k+0.3"]}),
         ("l", {"photo": P(5264140), "chars": [me("angry")], "prop": "🚒", "steps": ["l", 0.1, 9, 9], "say": say("불 나면 소방차가 써야죠")}),
         ("m", {"bg": "night", "chars": [me("happy")], "steps": [9, 9, 9, 9], "place": "📍 다음 날 저녁"}),
         ("n", {"bg": "home", "chars": [guy("sad", hairdo="spiky", hair="#3b3b3b"), me("shock")], "prop": "📄", "steps": ["n", 0.1, 9, 9], "say": say("아빠 차에 과태료가 나왔다?")}),
         ("o", {"bg": "#2b1c1c", "chars": [me("shock", to="cry")], "big": "우리 아빠 차", "steps": [9, 9, "o.아빠", "o+0.3"]}),
         ("z", {"bg": "home", "chars": [me("sick", to="think"), guy("smug", hairdo="spiky", hair="#3b3b3b")], "steps": [9, 9, "z.신고", 9]})]
    sfx = [["a", "whoosh", 0.2], ["c", "pop", 0.22], ["e", "pop", 0.22], ["i", "boing", 0.28], ["j.과태료", "pop", 0.25], ["k", "k_error_003", 0.28],
           ["l", "pop", 0.22], ["m", "whoosh", 0.2], ["o.아빠", "boing", 0.3], ["z", "pop", 0.22]]
    build("doodle12", ["불법주차 신고하면", "벌어지는 일"], L, C, M("scheming_weasel"), sfx,
          voices={"owner": {"edge": "ko-KR-SunHiNeural", "rate": "+38%", "pitch": "-6Hz"}, "dad": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+30%", "pitch": "-10Hz"}}, sources=SRC)

@ep
def doodle13():
    T = "○○초 6회 동창회 (32)"
    msgs = [{"name": "반장", "text": "📢 공지! 다들 꼭 읽어 주세요", "color": "#FFD84D"},
            {"name": "반장", "text": "날짜 투표 오늘 밤 12시까지!", "color": "#FFD84D"},
            {"name": "반장", "text": "회비 5만 원, 입금하면 ✅ 눌러 주기", "color": "#FFD84D"},
            {"name": "반장", "text": "불참자는 사유 한 줄씩", "color": "#FFD84D"},
            {"name": "반장", "text": "1차 고기, 2차 노래방, 3차 해장국", "color": "#FFD84D"},
            {"name": "반장", "text": "드레스 코드는 초록색", "color": "#FFD84D"},
            {"name": "반장", "text": "읽고 답 없는 사람 이름 부릅니다", "color": "#FFD84D"}]
    L = [("a0", "chief", "답 없는 사람, 이름 부릅니다.", ""),
         ("a", "nar", "동창회 단톡에 올라온 공지 마지막 줄.", "동창회 단톡 공지 / [마지막 줄]"),
         ("b", "nar", "알림 서른두 개. 숨 쉴 틈이 없음.", "알림 [32개] / 숨 쉴 틈 없음"),
         ("c", "nar", "날짜 투표는 오늘 밤 열두 시까지.", "날짜 투표 / 오늘 밤 [12시]까지"),
         ("d", "nar", "회비 오만 원, 입금하면 체크 누르기.", "회비 [5만 원] / 입금하면 체크"),
         ("e", "nar", "불참자는 사유 한 줄씩.", "불참자는 / [사유] 한 줄씩"),
         ("f", "nar", "일 차 고기, 이 차 노래방, 삼 차 해장국.", "고기·노래방 / [해장국]까지"),
         ("g", "nar", "드레스 코드는 초록색.", "드레스 코드 / [초록색]"),
         ("h", "me", "초록색 옷 없는데?", ""),
         ("i", "nar", "근데 반장 입장도 있음.", "근데 [반장] 입장도 있음"),
         ("j", "nar", "지난번엔 다 읽고 아무도 답을 안 했음.", "지난번엔 다 읽고 / [아무도] 답 안 함"),
         ("k", "chief", "읽씹하면 나만 바보 되잖아.", ""),
         ("l", "nar", "그래서 공지가 점점 길어지는 중.", "그래서 공지가 / 점점 [길어지는] 중"),
         ("m", "nar", "결국 참석 체크한 사람, 세 명.", "참석 체크 / 딱 [3명]"),
         ("n", "me", "나도 일단 체크는 했음.", ""),
         ("z", "nar", "님 단톡에도 이런 반장 있음?", "님 단톡에도 / 이런 [반장] 있음?")]
    ph = {"photo": P(8533741), "photoPos": "50% 40%"}
    C = [("a0", {"bg": "#2b1c1c", "chars": [guy("angry", **FRIEND, _keep=1, size=2.0, x=0.5, y=100)], "prop": "📢", "propX": 0.8, "steps": [9, 0.1, 9, 9]}),
         ("a", {**ph, "chars": [me("shock")], "steps": [9, 9, 9, 9]}),
         ("b", {"bg": "bedroom", "chars": [me("sick")], "chat": {"title": T, "msgs": msgs[:2]}, "steps": [9, 9, 9, 9, 0.1, "b.서른두"]}),
         ("c", {"bg": "night", "chars": [me("think")], "chat": {"title": T, "msgs": msgs[:2]}, "steps": [9, 9, 9, 9, 0, 0]}),
         ("d", {"bg": "#FFE14D", "chars": [me("shock")], "chat": {"title": T, "msgs": msgs[:3]}, "steps": [9, 9, 9, 9, 0, 0, "d+0.2"]}),
         ("e", {"bg": "office", "chars": [me("sad")], "chat": {"title": T, "msgs": msgs[:4]}, "steps": [9, 9, 9, 9, 0, 0, 0, "e+0.1"]}),
         ("f", {"bg": "#FFB3C7", "chars": [me("sick")], "chat": {"title": T, "msgs": msgs[:5]}, "steps": [9, 9, 9, 9, 0, 0, 0, 0, "f+0.2"]}),
         ("g", {"bg": "#d8f5c8", "chars": [me("shock")], "chat": {"title": T, "msgs": msgs[:6]}, "steps": [9, 9, 9, 9, 0, 0, 0, 0, 0, "g+0.1"]}),
         ("h", {"bg": "bedroom", "chars": [me("cry")], "prop": "👕", "steps": ["h", 0.1, 9, 9], "say": say("초록색 옷 없는데?")}),
         ("i", {"bg": "home", "chars": [guy("sad", **FRIEND)], "big": "반장 입장", "steps": [9, 9, 9, "i+0.3"]}),
         ("j", {"bg": "night", "chars": [guy("cry", **FRIEND)], "prop": "📱", "big": "읽음 31", "steps": [9, 0.1, 9, "j.아무도"]}),
         ("k", {"bg": "#e9e4dc", "chars": [guy("angry", **FRIEND)], "steps": ["k", 9, 9, 9], "say": say("읽씹하면 나만 바보잖아")}),
         ("l", {"bg": "#dff3ff", "chars": [guy("think", **FRIEND)], "prop": "📜", "steps": [9, 0.1, 9, 9]}),
         ("m", {"photo": P(30027297), "chars": [guy("sad", **FRIEND), me("neutral"), guy("neutral", hairdo="bald")], "big": "3명", "steps": [9, 9, 9, "m.세"]}),
         ("n", {**ph, "chars": [me("shy")], "steps": ["n", 9, 9, 9], "say": say("체크는 했음")}),
         ("z", {"bg": "bedroom", "chars": [me("think", to="smug")], "prop": "📱", "steps": [9, 0.1, "z.반장", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b.서른두", "pop", 0.25], ["d", "pop", 0.22], ["f", "pop", 0.22], ["g", "boing", 0.28], ["h", "pop", 0.22],
           ["i", "whoosh", 0.2], ["k", "pop", 0.22], ["m.세", "k_error_003", 0.28], ["z", "pop", 0.22]]
    build("doodle13", ["읽기만 해도 기빨리는", "동창회 단톡 현실"], L, C, M("hustle"), sfx,
          voices={"chief": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+0Hz"}}, sources={**SRC})

@ep
def doodle14():
    L = [("a0", "aunt", "정지에 정구지 갖고 온나!", ""),
         ("a", "nar", "부산 친구 집에서 들은 말. 하나도 못 알아들음.", "부산 친구 집에서 / [하나도] 못 알아들음"),
         ("a2", "nar", "서울말, 그러니까 표준어랑 비교해 봄.", "서울말 = [표준어]랑 / 비교해 봄"),
         ("b", "me", "정지요? 멈추라고요?", ""),
         ("c", "nar", "서울에서 정지는 멈춤.", "서울에서 정지는 / [멈춤]"),
         ("d", "nar", "근데 경상도에서 정지는 부엌.", "경상도에서 정지는 / [부엌]"),
         ("e", "nar", "그리고 정구지는 부추.", "정구지는 / [부추]"),
         ("f", "me", "부엌에 부추 가져오라는 거였어?", ""),
         ("g", "aunt", "아이고, 욕봤다.", ""),
         ("h", "nar", "서울에서 욕보다는 부끄러운 일을 당하다.", "서울에서 욕보다 / [부끄러운 일] 당함"),
         ("i", "nar", "경상도에선 수고했다는 뜻.", "경상도에선 / [수고했다]"),
         ("j", "me", "칭찬이었어?", ""),
         ("k", "friend", "니 그 옷 좀 파이다.", ""),
         ("l", "nar", "파이다는 서울에선 땅이 파이는 거.", "서울에선 / 땅이 [파이는] 거"),
         ("m", "nar", "경상도에선 별로라는 뜻.", "경상도에선 / [별로]라는 뜻"),
         ("n", "me", "이건 칭찬 아니지?", ""),
         ("o", "friend", "농담이다. 다음엔 단디 입고 온나.", ""),
         ("p", "nar", "단디는 단단히, 제대로라는 뜻.", "단디 = [단단히] / 제대로"),
         ("z", "nar", "님 동네에도 이런 말 있음?", "님 동네에도 / 이런 [말] 있음?")]
    C = [("a0", {"bg": "home", "chars": [guy("happy", **AUNT, _keep=1, size=2.0, x=0.5, y=100)], "prop": "🌿", "propX": 0.8, "steps": [9, 0.1, 9, 9]}),
         ("a", {"photo": P(17967670), "chars": [me("shock")], "place": "📍 부산", "steps": [9, 9, 9, 9]}),
         ("a2", {"bg": "#e9e4dc", "chars": [me("think")], "big": "서울말 = 표준어", "steps": [9, 9, 9, "a2+0.4"]}),
         ("b", {"bg": "home", "chars": [me("think")], "prop": "🛑", "steps": ["b", 0.1, 9, 9], "say": say("정지요? 멈추라고요?")}),
         ("c", {"photo": P(19222549), "chars": [me("smug")], "prop": "🛑", "big": "서울: 정지 = 멈춤", "place": "📍 서울", "steps": [9, 0.1, 9, "c+0.3"]}),
         ("d", {"photo": P(38010001), "chars": [me("shock")], "prop": "🍳", "big": "경상: 정지 = 부엌", "place": "📍 부산", "steps": [9, 0.1, 9, "d.부엌"]}),
         ("e", {"bg": "#d8f5c8", "chars": [me("think")], "prop": "🌿", "big": "정구지 = 부추", "steps": [9, 0.1, 9, "e.부추"]}),
         ("f", {"bg": "home", "chars": [me("laugh")], "prop": "🌿", "steps": ["f", 0.1, 9, 9], "say": say("부엌에 부추였어?")}),
         ("g", {"bg": "home", "chars": [guy("happy", **AUNT), me("shock")], "steps": ["g", 9, 9, 9], "say": say("아이고, 욕봤다")}),
         ("h", {"photo": P(19222549), "photoPos": "30% 50%", "chars": [me("cry")], "big": "서울: 욕보다 = 창피", "steps": [9, 9, 9, "h+0.4"]}),
         ("i", {"photo": P(17967670), "photoPos": "60% 50%", "chars": [me("shock", to="happy")], "big": "경상: 수고했다", "steps": [9, 9, "i.수고", "i+0.3"]}),
         ("j", {"bg": "#FFB3C7", "chars": [me("shy")], "steps": ["j", 9, 9, 9], "say": say("칭찬이었어?")}),
         ("k", {"photo": P(38010001), "photoPos": "40% 50%", "chars": [guy("smug", **FRIEND), me("happy")], "steps": ["k", 9, 9, 9], "say": say("니 그 옷 좀 파이다")}),
         ("l", {"bg": "street", "chars": [me("think")], "prop": "🕳️", "big": "서울: 땅이 파임", "steps": [9, 0.1, 9, "l+0.4"]}),
         ("m", {"bg": "#2b1c1c", "chars": [me("shock", to="cry")], "big": "경상: 파이다 = 별로", "steps": [9, 9, "m.별로", "m+0.2"]}),
         ("n", {"bg": "bedroom", "chars": [me("sad")], "prop": "👕", "steps": ["n", 0.1, 9, 9], "say": say("이건 칭찬 아니지?")}),
         ("o", {"photo": P(38010001), "chars": [guy("laugh", **FRIEND)], "steps": ["o", 9, 9, 9], "say": say("다음엔 단디 입고 온나")}),
         ("p", {"bg": "#d8f5c8", "chars": [me("happy")], "prop": "💪", "big": "단디 = 단단히", "steps": [9, 0.1, 9, "p.단단히"]}),
         ("z", {"photo": P(17967670), "chars": [me("think", to="smug"), guy("laugh", **FRIEND)], "steps": [9, 9, "z+0.6", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b", "pop", 0.22], ["d.부엌", "boing", 0.28], ["e.부추", "pop", 0.25], ["g", "pop", 0.22], ["i.수고", "boing", 0.28],
           ["k", "pop", 0.22], ["m.별로", "k_error_003", 0.28], ["z", "pop", 0.22]]
    build("doodle14", ["서울 vs 부산", "같은 말 다른 뜻"], L, C, M("monkeys_spinning_monkeys"), sfx,
          voices={"aunt": {"edge": "ko-KR-SunHiNeural", "rate": "+30%", "pitch": "-4Hz"}, "friend": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+5Hz"}}, sources=SRC)

@ep
def doodle15():
    L = [("a0", "back", "저기요, 제 무릎이요!", ""),
         ("a", "nar", "기차 의자 끝까지 젖혔다가 들은 말.", "의자 끝까지 젖혔다가 / [들은 말]"),
         ("b", "nar", "두 시간 반 타는 기차. 의자는 젖히라고 있는 거 아님?", "2시간 반 / 의자는 [젖히라고] 있는 것"),
         ("c", "me", "저도 표 값 다 냈는데요?", ""),
         ("d", "nar", "젖히는 쪽 생각. 의자 기능이니까 내 자리 권리.", "젖히는 쪽 / 의자 기능 = [권리]"),
         ("e", "nar", "뒷사람 생각. 끝까지 오면 노트북도 못 폄.", "뒷사람 / 노트북도 [못 폄]"),
         ("f", "back", "도시락 먹고 있었단 말이에요.", ""),
         ("g", "nar", "둘 다 틀린 말은 아님.", "둘 다 / [틀린 말]은 아님"),
         ("h", "nar", "문제는 젖히는 속도랑 말 한마디.", "문제는 / [속도]랑 [말 한마디]"),
         ("i", "nar", "확 젖히면 뒷사람 커피가 날아감.", "확 젖히면 / 커피가 [날아감]"),
         ("j", "nar", "그래서 도치가 다시 해 봄.", "그래서 / 다시 해 봄"),
         ("k", "me", "저기, 의자 좀 젖혀도 될까요?", ""),
         ("l", "back", "아, 도시락만 다 먹고요!", ""),
         ("m", "nar", "오 분 뒤 천천히 반만. 평화 회복.", "5분 뒤 천천히 / [반만]"),
         ("z", "nar", "님은 끝까지 젖힘, 반만 젖힘?", "님은 [끝까지]? / [반만]?")]
    C = [("a0", {"photo": P(19870620), "chars": [guy("angry", hairdo="bob", hair="#7a4a2a", _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(14715657), "chars": [me("shock", rot=-14)], "steps": [9, 9, 9, 9], "place": "📍 기차 안"}),
         ("b", {"photo": P(19870620), "photoPos": "30% 50%", "chars": [me("smug")], "prop": "💺", "big": "2시간 30분", "steps": [9, 0.1, 9, "b+0.4"]}),
         ("c", {"bg": "subway", "chars": [me("angry")], "prop": "🎫", "steps": ["c", 0.1, 9, 9], "say": say("저도 표 값 다 냈는데요?")}),
         ("d", {"bg": "#FFE14D", "chars": [me("smug")], "big": "내 자리 권리", "steps": [9, 9, 9, "d+0.5"]}),
         ("e", {"bg": "#dff3ff", "chars": [guy("cry", hairdo="bob", hair="#7a4a2a")], "prop": "💻", "big": "노트북 못 폄", "steps": [9, 0.1, 9, "e+0.4"]}),
         ("f", {"photo": P(14715657), "photoPos": "60% 50%", "chars": [guy("sad", hairdo="bob", hair="#7a4a2a")], "prop": "🍱", "steps": ["f", 0.1, 9, 9], "say": say("도시락 먹고 있었어요")}),
         ("g", {"bg": "subway", "chars": [me("think"), guy("think", hairdo="bob", hair="#7a4a2a")], "big": "둘 다 맞음", "steps": [9, 9, 9, "g+0.3"]}),
         ("h", {"bg": "#d8f5c8", "chars": [me("think")], "prop": "🐢", "big": "속도 + 말 한마디", "steps": [9, 0.1, 9, "h.속도"]}),
         ("i", {"bg": "#2b1c1c", "chars": [guy("shock", hairdo="bob", hair="#7a4a2a")], "prop": "☕", "big": "확!", "steps": [9, "i.날아감", 9, "i+0.2"]}),
         ("j", {"bg": "night", "chars": [me("neutral")], "card": "다시 해 봄", "steps": [9, 9, 9, 9]}),
         ("k", {"photo": P(19870620), "chars": [me("shy")], "steps": ["k", 9, 9, 9], "say": say("의자 좀 젖혀도 될까요?")}),
         ("l", {"photo": P(14715657), "chars": [guy("happy", hairdo="bob", hair="#7a4a2a")], "prop": "🍱", "steps": ["l", 0.1, 9, 9], "say": say("도시락만 다 먹고요!")}),
         ("m", {"bg": "subway", "chars": [me("happy"), guy("happy", hairdo="bob", hair="#7a4a2a")], "big": "평화 회복", "steps": [9, 9, 9, "m.평화"]}),
         ("z", {"photo": P(19870620), "photoPos": "40% 50%", "chars": [me("think", to="smug")], "steps": [9, 9, "z.반만", 9]})]
    sfx = [["a", "whoosh", 0.2], ["c", "pop", 0.22], ["d", "pop", 0.22], ["e", "pop", 0.22], ["g", "whoosh", 0.2], ["i.날아감", "k_error_003", 0.3],
           ["j", "whoosh", 0.2], ["k", "pop", 0.22], ["m.평화", "boing", 0.28], ["z", "pop", 0.22]]
    build("doodle15", ["현재 논란중인", "KTX 의자 끝까지 젖히기?"], L, C, M("hyperfun"), sfx,
          voices={"back": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+3Hz"}}, sources=SRC)

@ep
def doodle16():
    BOSS = dict(hairdo="bald")
    L = [("a0", "boss", "김칫국물 총각 왔네!", ""),
         ("a", "nar", "이름도 안 말했는데 사장님이 내 셔츠를 꺼냄.", "이름도 안 말했는데 / 내 셔츠를 [꺼냄]"),
         ("b", "nar", "동네 세탁소 사장님 기억력, 진짜 미침.", "세탁소 사장님 / 기억력 [미침]"),
         ("c", "nar", "번호표도 없음. 장부도 안 봄.", "번호표 없음 / 장부도 [안 봄]"),
         ("d", "me", "제 거 어떻게 아셨어요?", ""),
         ("e", "boss", "커피 자국 바지는 삼 층 아가씨 거고.", ""),
         ("f", "boss", "단추 하나 없는 코트는 경비 아저씨 거고.", ""),
         ("g", "nar", "사장님은 사람을 얼룩으로 기억함.", "사람을 / [얼룩]으로 기억함"),
         ("h", "me", "그럼 저는 영원히 김칫국물이에요?", ""),
         ("i", "nar", "솔직히 좀 억울함. 그날만 흘린 건데.", "솔직히 좀 억울 / 그날만 [흘린] 건데"),
         ("j", "nar", "근데 다음 주, 맡긴 셔츠를 찾으러 감.", "다음 주 / 셔츠 찾으러 감"),
         ("k", "nar", "떨어졌던 단추가 새로 달려 있었음.", "떨어진 단추가 / [새로] 달려 있음"),
         ("l", "boss", "그거 서비스야. 면접 본다며?", ""),
         ("m", "nar", "지나가듯 한 말까지 기억하고 계심.", "지나가듯 한 말까지 / [기억]하심"),
         ("z", "nar", "님 동네에도 이런 사장님 있음?", "님 동네에도 / 이런 [사장님] 있음?")]
    C = [("a0", {"photo": P(17293343), "chars": [guy("happy", **BOSS, _keep=1, size=2.0, x=0.5, y=100)], "prop": "👔", "propX": 0.82, "steps": [9, 0.1, 9, 9]}),
         ("a", {"photo": P(965632), "chars": [me("shock")], "prop": "👔", "steps": [9, "a.꺼냄", 9, 9], "place": "📍 동네 세탁소"}),
         ("b", {"photo": P(17293343), "photoPos": "30% 50%", "chars": [guy("smug", **BOSS)], "big": "기억력 미침", "steps": [9, 9, 9, "b.미침"]}),
         ("c", {"bg": "store", "chars": [me("think")], "prop": "🚫", "big": "번호표 없음", "steps": [9, 0.1, 9, "c+0.3"]}),
         ("d", {"photo": P(28576618), "chars": [me("shock")], "steps": ["d", 9, 9, 9], "say": say("제 거 어떻게 아셨어요?")}),
         ("e", {"bg": "store", "chars": [guy("smug", **BOSS)], "prop": "☕", "steps": ["e", 0.1, 9, 9], "say": say("커피 자국은 3층 아가씨")}),
         ("f", {"photo": P(965632), "photoPos": "70% 50%", "chars": [guy("think", **BOSS)], "prop": "🧥", "steps": ["f", 0.1, 9, 9], "say": say("단추 없는 코트는 경비 아저씨")}),
         ("g", {"bg": "#FFE14D", "chars": [me("shock")], "big": "사람 = 얼룩", "steps": [9, 9, 9, "g.얼룩"]}),
         ("h", {"bg": "home", "chars": [me("cry")], "prop": "🍲", "steps": ["h", 0.1, 9, 9], "say": say("저는 영원히 김칫국물이에요?")}),
         ("i", {"bg": "#FFB3C7", "chars": [me("sad")], "big": "그날만…", "steps": [9, 9, 9, "i.흘린"]}),
         ("j", {"bg": "street", "chars": [me("neutral")], "place": "📍 일주일 뒤", "steps": [9, 9, 9, 9]}),
         ("k", {"photo": P(17293343), "photoPos": "60% 50%", "chars": [me("shock", to="love")], "prop": "🔘", "big": "새 단추", "steps": [9, 0.1, "k.새로", "k.새로"]}),
         ("l", {"bg": "store", "chars": [guy("happy", **BOSS), me("shy")], "steps": ["l", 9, 9, 9], "say": say("서비스야, 면접 본다며?")}),
         ("m", {"photo": P(28576618), "chars": [me("love")], "steps": [9, 9, 9, 9]}),
         ("z", {"photo": P(965632), "chars": [me("happy", to="smug")], "steps": [9, 9, "z.사장님", 9]})]
    sfx = [["a.꺼냄", "pop", 0.25], ["b.미침", "boing", 0.28], ["d", "pop", 0.22], ["e", "pop", 0.22], ["f", "pop", 0.22], ["g.얼룩", "boing", 0.28],
           ["h", "pop", 0.22], ["j", "whoosh", 0.2], ["k.새로", "pop", 0.25], ["l", "pop", 0.22], ["z", "pop", 0.22]]
    build("doodle16", ["동네 세탁소 사장님의", "미친 기억력 비결"], L, C, M("sneaky_snitch"), sfx,
          voices={"boss": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+32%", "pitch": "-10Hz"}}, sources=SRC)

for sid in sys.argv[1:] or sorted(EP, key=lambda s: int(s[6:])):
    EP[sid]()
