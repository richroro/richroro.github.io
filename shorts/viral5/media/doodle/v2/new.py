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
    """a rushing man and 도치 argue left-side standing on his first day; the man shouts about a 9 o'clock meeting; he is 도치's new team leader (정체 반전)"""
    L = [("a0", "rush", "저기요, 바빠요!", ""),
         ("a", "nar", "출근 첫날, 에스컬레이터 왼쪽에 섰다가 들은 말.", "출근 첫날 왼쪽에 / 섰다가 [들은 말]"),
         ("b", "rush", "다들 왼쪽은 비워 주잖아요!", ""),
         ("c", "me", "정부가 두 줄 서기 하라던데요?", ""),
         ("d", "rush", "그거 이천십오 년에 접었거든요?", ""),
         ("e", "nar", "실제로 이천칠 년에 시작해서 이천십오 년에 공식 중단.", "2007년 시작 / 2015년 [공식 중단]"),
         ("f", "me", "그래도 걷다가 사고 나요.", ""),
         ("g", "nar", "십 년간 중대 사고 백삼십오 건, 그중 구십 건이 이용자 과실.", "중대 사고 135건 / [90건] 이용자 과실"),
         ("h", "rush", "아홉 시 회의라고요, 아홉 시!", ""),
         ("i", "nar", "올해 정부 설문도 사십구 점 구 대 오십 점 일. 딱 반반.", "올해 설문도 / 49.9 대 50.1 [반반]"),
         ("j", "nar", "결국 아저씨는 계단으로 뛰어감.", "결국 아저씨는 / [계단]으로 뛰어감"),
         ("k", "nar", "그리고 아홉 시, 첫 회의실.", "그리고 [9시] / 첫 회의실"),
         ("l", "rush", "어, 아까 그…", ""),
         ("m", "nar", "그 아저씨가 우리 팀장님이었음.", "그 아저씨가 / 우리 [팀장님]"),
         ("n", "rush", "두 줄 서기, 좋은 문화죠.", ""),
         ("z", "nar", "님은 서는 편임, 걷는 편임?", "님은 [서는] 편? / [걷는] 편?")]
    C = [("a0", {"photo": P(7202628), "chars": [guy("angry", **RUSH, _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(18764954), "chars": [me("shock")], "prop": "🪪", "steps": [9, 0.1, 9, 9], "place": "📍 출근 첫날"}),
         ("b", {"photo": P(7202628), "photoPos": "30% 50%", "chars": [guy("angry", **RUSH)], "steps": ["b", 9, 9, 9], "say": say("왼쪽은 비워 주잖아요!")}),
         ("c", {"bg": "subway", "chars": [me("smug"), guy("angry", **RUSH)], "steps": ["c", 9, 9, 9], "say": say("두 줄 서기 하라던데요?")}),
         ("d", {"bg": "subway", "chars": [guy("smug", **RUSH)], "steps": ["d", 9, 9, 9], "say": say("그거 2015년에 접었거든요?")}),
         ("e", {"bg": "night", "chars": [me("sad")], "prop": "🛑", "big": "2007 → 2015", "steps": [9, 0.1, 9, "e+0.5"]}),
         ("f", {"photo": P(18764954), "chars": [me("angry")], "steps": ["f", 9, 9, 9], "say": say("걷다가 사고 나요")}),
         ("g", {"bg": "#FFE14D", "chars": [me("shock")], "big": "135건 중 90건", "steps": [9, 9, 9, "g.백삼십오"]}),
         ("h", {"bg": "#2b1c1c", "chars": [guy("angry", **RUSH)], "prop": "⏰", "steps": ["h", 0.1, 9, 9], "say": say("9시 회의라고요, 9시!")}),
         ("i", {"bg": "office", "chars": [guy("think", **RUSH), me("think")], "big": "49.9 : 50.1", "steps": [9, 9, 9, "i.반반"]}),
         ("j", {"bg": "street", "chars": [guy("angry", **RUSH)], "prop": "🏃", "steps": [9, 0.1, 9, 9]}),
         ("k", {"bg": "office", "chars": [me("happy")], "place": "📍 9시 회의실", "steps": [9, 9, 9, 9]}),
         ("l", {"bg": "office", "chars": [guy("shock", **RUSH), me("shock")], "steps": ["l", 9, 9, 9], "say": say("어, 아까 그…")}),
         ("m", {"bg": "#2b1c1c", "chars": [me("shock", to="cry")], "big": "팀장님", "steps": [9, 9, "m.팀장님", "m.팀장님"]}),
         ("n", {"bg": "office", "chars": [guy("shy", **RUSH)], "steps": ["n", 9, 9, 9], "say": say("두 줄 서기, 좋은 문화죠")}),
         ("z", {"photo": P(7202628), "chars": [me("think", to="smug")], "steps": [9, 9, "z.걷는", 9]})]
    sfx = [["a", "whoosh", 0.2], ["c", "pop", 0.22], ["d", "pop", 0.22], ["g.백삼십오", "boing", 0.25], ["h", "pop", 0.22], ["i.반반", "pop", 0.22],
           ["k", "whoosh", 0.2], ["m.팀장님", "boing", 0.3], ["n", "pop", 0.22], ["z", "pop", 0.22]]
    build("doodle11", ["현재 논란중인", "에스컬레이터 2줄 서기"], L, C, M("sneaky_snitch"), sfx,
          voices={"rush": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+32%", "pitch": "-8Hz"}}, sources=SRC)

@ep
def doodle12():
    """도치 reports a red car parked at a fire hydrant, explaining the rules to a neighbour who defends it; that evening dad gets the 8만 원 fine (역전)"""
    L = [("a0", "nb", "사진은 왜 찍어요?", ""),
         ("a", "nar", "소화전 앞 불법주차 신고하다 들은 말.", "소화전 앞 불법주차 / 신고하다 [들은 말]"),
         ("b", "nar", "빨간 차. 근데 어디서 많이 본 차.", "빨간 차 / 어디서 [많이 본] 차"),
         ("c", "nb", "잠깐 세운 건데 너무하네.", ""),
         ("d", "me", "소화전 앞은 일 분만 서도 신고돼요.", ""),
         ("e", "nar", "소화전, 횡단보도, 인도 같은 여섯 곳은 일 분이면 주민 신고 대상.", "소화전·횡단보도·인도 / [6곳]은 1분"),
         ("f", "nb", "사진 한 장 찍으면 끝이에요?", ""),
         ("g", "me", "같은 자리, 같은 각도로 일 분 간격 두 장이요.", ""),
         ("h", "nar", "앱으로 보내면 단속 공무원 없이 과태료.", "앱으로 보내면 / 현장 단속 [없이] 과태료"),
         ("i", "nb", "얼만데요?", ""),
         ("j", "me", "소화전 앞은 승용차 팔만 원이요.", ""),
         ("k", "nar", "도치, 뿌듯하게 신고 완료.", "도치, 뿌듯하게 / 신고 [완료]"),
         ("l", "nar", "그리고 며칠 뒤 저녁.", "그리고 / [며칠 뒤] 저녁"),
         ("m", "dad", "아들, 아빠 차에 과태료 팔만 원이 나왔다?", ""),
         ("n", "nar", "그 빨간 차, 아빠 차였음.", "그 빨간 차 / [아빠 차]였음"),
         ("o", "me", "아빠, 그거 사실 내가…", ""),
         ("z", "nar", "님이면 신고함, 안 함?", "님이면 / [신고]함? 안 함?")]
    DAD = dict(hairdo="spiky", hair="#3b3b3b")
    C = [("a0", {"photo": P(5264140), "chars": [guy("angry", **OWNER, _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(5264140), "photoPos": "70% 50%", "chars": [me("smug")], "prop": "📸", "steps": [9, 0.1, 9, 9]}),
         ("b", {"bg": "street", "chars": [me("think")], "prop": "🚗", "steps": [9, 0.1, 9, 9]}),
         ("c", {"bg": "street", "chars": [guy("angry", **OWNER), me("sick")], "steps": ["c", 9, 9, 9], "say": say("잠깐 세운 건데 너무하네")}),
         ("d", {"photo": P(5264140), "photoPos": "40% 50%", "chars": [me("angry")], "steps": ["d", 9, 9, 9], "say": say("1분만 서도 신고돼요")}),
         ("e", {"photo": P(15818611), "chars": [me("think")], "big": "6곳 = 1분", "steps": [9, 9, 9, "e+0.8"]}),
         ("f", {"bg": "#e9e4dc", "chars": [guy("think", **OWNER)], "prop": "📱", "steps": ["f", 0.1, 9, 9], "say": say("한 장 찍으면 끝이에요?")}),
         ("g", {"photo": P(15818611), "photoPos": "60% 50%", "chars": [me("smug")], "prop": "📸", "big": "1분 간격 2장", "steps": ["g", 0.1, 9, "g+0.9"]}),
         ("h", {"bg": "office", "chars": [me("neutral", to="smug")], "prop": "📄", "steps": [9, 0.1, "h.과태료", 9]}),
         ("i", {"bg": "street", "chars": [guy("shock", **OWNER)], "steps": ["i", 9, 9, 9], "say": say("얼만데요?")}),
         ("j", {"bg": "#FFB3C7", "chars": [me("smug")], "prop": "💸", "big": "8만 원", "steps": ["j", 0.1, 9, "j.팔만"], "say": say("승용차 8만 원이요")}),
         ("k", {"bg": "#d8f5c8", "chars": [me("laugh")], "prop": "✅", "steps": [9, 0.1, 9, 9]}),
         ("l", {"bg": "night", "chars": [me("happy")], "steps": [9, 9, 9, 9], "place": "📍 며칠 뒤 저녁"}),
         ("m", {"bg": "home", "chars": [guy("sad", **DAD), me("shock")], "prop": "📄", "steps": ["m", 0.1, 9, 9], "say": say("아빠 차에 과태료가 나왔다?")}),
         ("n", {"bg": "#2b1c1c", "chars": [me("shock", to="cry")], "prop": "🚗", "big": "아빠 차", "steps": [9, 0.1, "n.아빠", "n.아빠"]}),
         ("o", {"bg": "home", "chars": [me("sick"), guy("think", **DAD)], "steps": ["o", 9, 9, 9], "say": say("아빠, 그거 사실 내가…")}),
         ("z", {"photo": P(5264140), "chars": [me("think", to="smug")], "steps": [9, 9, "z.신고", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b", "pop", 0.22], ["c", "pop", 0.22], ["e", "pop", 0.22], ["g", "pop", 0.22], ["j.팔만", "boing", 0.28],
           ["l", "whoosh", 0.2], ["m", "pop", 0.22], ["n.아빠", "boing", 0.3], ["z", "pop", 0.22]]
    build("doodle12", ["불법주차 신고하면", "벌어지는 일"], L, C, M("scheming_weasel"), sfx,
          voices={"nb": {"edge": "ko-KR-SunHiNeural", "rate": "+38%", "pitch": "-6Hz"}, "dad": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+30%", "pitch": "-10Hz"}}, sources=SRC)

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
         ("b2", "nar", "참고로 이 방엔 반장 어머님도 계심.", "참고로 이 방엔 / [반장 어머님]도 계심"),
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
         ("n", "nar", "반장, 나, 그리고 반장 어머님.", "반장, 나, 그리고 / [반장 어머님]"),
         ("z", "nar", "님 단톡에도 이런 반장 있음?", "님 단톡에도 / 이런 [반장] 있음?")]
    ph = {"photo": P(8533741), "photoPos": "50% 40%"}
    C = [("a0", {"bg": "#2b1c1c", "chars": [guy("angry", **FRIEND, _keep=1, size=2.0, x=0.5, y=100)], "prop": "📢", "propX": 0.8, "steps": [9, 0.1, 9, 9]}),
         ("a", {**ph, "chars": [me("shock")], "steps": [9, 9, 9, 9]}),
         ("b", {"bg": "bedroom", "chars": [me("sick")], "chat": {"title": T, "msgs": msgs[:2]}, "steps": [9, 9, 9, 9, 0.1, "b.서른두"]}),
         ("b2", {"bg": "home", "chars": [guy("happy", hairdo="perm", hair="#5a3a2a")], "prop": "👋", "steps": [9, 0.1, 9, 9]}),
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
         ("n", {"bg": "#FFE14D", "chars": [guy("sad", **FRIEND), me("shy"), guy("happy", hairdo="perm", hair="#5a3a2a")], "big": "+ 반장 어머님", "steps": [9, 9, 9, "n.어머님"]}),
         ("z", {"bg": "bedroom", "chars": [me("think", to="smug")], "prop": "📱", "steps": [9, 0.1, "z.반장", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b.서른두", "pop", 0.25], ["d", "pop", 0.22], ["f", "pop", 0.22], ["g", "boing", 0.28], ["h", "pop", 0.22],
           ["i", "whoosh", 0.2], ["k", "pop", 0.22], ["m.세", "pop", 0.25], ["n.어머님", "boing", 0.3], ["z", "pop", 0.22]]
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
         ("o", "nar", "그래서 도치, 배운 말로 인사해 봄.", "그래서 도치 / 배운 말로 [인사]"),
         ("p", "me", "이모님, 오늘 정지에서 욕보셨습니다!", ""),
         ("q", "aunt", "아이고, 서울 아가 다 됐네!", ""),
         ("r", "friend", "근데 그 옷은 진짜 파이다.", ""),
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
         ("o", {"bg": "#d8f5c8", "chars": [me("smug")], "prop": "📒", "steps": [9, 0.1, 9, 9]}),
         ("p", {"bg": "home", "chars": [me("happy", _keep=1, size=1.9, x=0.5, y=80)], "steps": ["p", 9, 9, 9], "say": say("정지에서 욕보셨습니다!")}),
         ("q", {"bg": "home", "chars": [guy("laugh", **AUNT), me("shy")], "steps": ["q", 9, 9, 9], "say": say("서울 아가 다 됐네!")}),
         ("r", {"photo": P(38010001), "chars": [guy("smug", **FRIEND), me("cry")], "steps": ["r", 9, 9, 9], "say": say("근데 그 옷은 진짜 파이다")}),
         ("z", {"photo": P(17967670), "chars": [me("think", to="smug"), guy("laugh", **FRIEND)], "steps": [9, 9, "z+0.6", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b", "pop", 0.22], ["d.부엌", "boing", 0.28], ["e.부추", "pop", 0.25], ["g", "pop", 0.22], ["i.수고", "boing", 0.28],
           ["k", "pop", 0.22], ["m.별로", "k_error_003", 0.28], ["p", "pop", 0.22], ["r", "boing", 0.3], ["z", "pop", 0.22]]
    build("doodle14", ["서울 vs 부산", "같은 말 다른 뜻"], L, C, M("monkeys_spinning_monkeys"), sfx,
          voices={"aunt": {"edge": "ko-KR-SunHiNeural", "rate": "+30%", "pitch": "-4Hz"}, "friend": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+5Hz"}}, sources=SRC)

@ep
def doodle15():
    """도치 reclines fully; the passenger behind reclines too, then the next, a domino down the car; the last row is against the wall (허탈 개그)"""
    B = dict(hairdo="bob", hair="#7a4a2a"); B2 = dict(hairdo="bald"); B3 = dict(hairdo="perm", hair="#c9c9c9")
    L = [("a0", "back", "저기요, 제 무릎이요!", ""),
         ("a", "nar", "기차 의자 끝까지 젖혔다가 들은 말.", "의자 끝까지 젖혔다가 / [들은 말]"),
         ("b", "me", "저도 표 값 다 냈는데요?", ""),
         ("c", "back", "도시락 먹고 있었단 말이에요.", ""),
         ("d", "nar", "젖히는 쪽은 의자에 있는 기능이니까 내 권리라는 쪽.", "젖히는 쪽 / 의자 기능 = [권리]"),
         ("e", "nar", "뒷사람은 끝까지 오면 도시락도 노트북도 못 편다는 쪽.", "뒷사람 / 도시락도 [못 폄]"),
         ("f", "back", "좋아요. 그럼 저도 젖힐게요.", ""),
         ("f2", "me", "네? 그건 좀…", ""),
         ("g", "nar", "뒷사람도 끝까지 젖힘.", "뒷사람도 / [끝까지] 젖힘"),
         ("h", "back2", "저기요, 제 커피요!", ""),
         ("i", "nar", "그 뒷사람도 끝까지 젖힘.", "그 뒷사람도 / [끝까지] 젖힘"),
         ("j", "nar", "도미노처럼 한 칸씩 뒤로 넘어가는 의자.", "[도미노]처럼 / 뒤로 넘어가는 의자"),
         ("k", "nar", "그리고 맨 뒷줄.", "그리고 / [맨 뒷줄]"),
         ("k2", "nar", "맨 뒷자리 손님, 의자 버튼을 꾹 누름.", "맨 뒷자리 손님 / 의자 버튼 [꾹]"),
         ("l", "back3", "저는 뒤가 벽인데요?", ""),
         ("z", "nar", "님은 끝까지 젖힘, 반만 젖힘?", "님은 [끝까지]? / [반만]?")]
    C = [("a0", {"photo": P(19870620), "chars": [guy("angry", **B, _keep=1, size=2.0, x=0.5, y=100)], "steps": [9, 9, 9, 9]}),
         ("a", {"photo": P(14715657), "chars": [me("smug", rot=-14)], "steps": [9, 9, 9, 9], "place": "📍 기차 안"}),
         ("b", {"bg": "subway", "chars": [me("angry")], "prop": "🎫", "steps": ["b", 0.1, 9, 9], "say": say("저도 표 값 다 냈는데요?")}),
         ("c", {"photo": P(14715657), "photoPos": "60% 50%", "chars": [guy("sad", **B)], "prop": "🍱", "steps": ["c", 0.1, 9, 9], "say": say("도시락 먹고 있었어요")}),
         ("d", {"bg": "#FFE14D", "chars": [me("smug")], "prop": "💺", "big": "내 권리", "steps": [9, 0.1, 9, "d.권리"]}),
         ("e", {"bg": "#dff3ff", "chars": [guy("cry", **B)], "prop": "🍱", "big": "못 폄", "steps": [9, 0.1, 9, "e.못"]}),
         ("f", {"photo": P(19870620), "photoPos": "30% 50%", "chars": [guy("smug", **B)], "steps": ["f", 9, 9, 9], "say": say("그럼 저도 젖힐게요")}),
         ("f2", {"photo": P(14715657), "photoPos": "40% 50%", "chars": [me("sick")], "steps": ["f2", 9, 9, 9], "say": say("네? 그건 좀…")}),
         ("g", {"bg": "subway", "chars": [me("shock"), guy("smug", **B, rot=-14)], "steps": [9, 9, 9, 9]}),
         ("h", {"photo": P(14715657), "chars": [guy("angry", **B2)], "prop": "☕", "steps": ["h", 0.1, 9, 9], "say": say("저기요, 제 커피요!")}),
         ("i", {"bg": "subway", "chars": [guy("smug", **B, rot=-14), guy("angry", **B2, rot=-14)], "steps": [9, 9, 9, 9]}),
         ("j", {"bg": "subway", "chars": [me("laugh", rot=-12), guy("sick", **B, rot=-12), guy("sick", **B2, rot=-12)], "big": "도미노", "steps": [9, 9, 9, "j.도미노"]}),
         ("k", {"photo": P(19870620), "photoPos": "50% 50%", "chars": [me("think")], "place": "📍 맨 뒷줄", "steps": [9, 9, 9, 9]}),
         ("k2", {"bg": "subway", "chars": [guy("angry", **B3)], "prop": "🔘", "steps": [9, "k2.꾹", 9, 9]}),
         ("l", {"bg": "#e9e4dc", "chars": [guy("cry", **B3)], "steps": ["l", 9, 9, 9], "say": say("저는 뒤가 벽인데요?")}),
         ("z", {"photo": P(19870620), "photoPos": "40% 50%", "chars": [me("think", to="smug")], "steps": [9, 9, "z.반만", 9]})]
    sfx = [["a", "whoosh", 0.2], ["b", "pop", 0.22], ["d.권리", "pop", 0.22], ["e.못", "pop", 0.22], ["g", "whoosh", 0.2], ["h", "pop", 0.22],
           ["i", "whoosh", 0.2], ["j.도미노", "boing", 0.28], ["k", "whoosh", 0.2], ["l", "boing", 0.3], ["z", "pop", 0.22]]
    build("doodle15", ["현재 논란중인", "KTX 의자 끝까지 젖히기?"], L, C, M("hyperfun"), sfx,
          voices={"back": {"edge": "ko-KR-SunHiNeural", "rate": "+40%", "pitch": "+3Hz"}, "back2": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+32%", "pitch": "-8Hz"},
                  "back3": {"edge": "ko-KR-SunHiNeural", "rate": "+30%", "pitch": "-6Hz"}}, sources=SRC)

@ep
def doodle16():
    BOSS = dict(hairdo="bald")
    L = [("a0", "boss", "김칫국물 총각 왔네!", ""),
         ("a", "nar", "이름도 안 말했는데 사장님이 내 셔츠를 꺼냄.", "이름도 안 말했는데 / 내 셔츠를 [꺼냄]"),
         ("a2", "me", "단추 하나 없는데, 다림질만 해 주세요.", ""),
         ("b", "nar", "동네 세탁소 사장님 기억력, 진짜 미침.", "세탁소 사장님 / 기억력 [미침]"),
         ("c", "nar", "번호표도 없음. 장부도 안 봄.", "번호표 없음 / 장부도 [안 봄]"),
         ("d", "me", "제 거 어떻게 아셨어요?", ""),
         ("e", "boss", "커피 자국 바지는 삼 층 아가씨 거고.", ""),
         ("f", "boss", "단추 하나 없는 코트는 경비 아저씨 거고.", ""),
         ("g", "nar", "사장님은 사람을 얼룩으로 기억함.", "사람을 / [얼룩]으로 기억함"),
         ("h", "me", "그럼 저는 영원히 김칫국물이에요?", ""),
         ("i", "nar", "솔직히 좀 억울함. 그날만 흘린 건데.", "솔직히 좀 억울 / 그날만 [흘린] 건데"),
         ("i2", "me", "응, 다음 주 면접이라 셔츠 맡겼어.", ""),
         ("j", "nar", "근데 다음 주, 맡긴 셔츠를 찾으러 감.", "다음 주 / 셔츠 찾으러 감"),
         ("k", "nar", "떨어졌던 단추가 새로 달려 있었음.", "떨어진 단추가 / [새로] 달려 있음"),
         ("l", "boss", "그거 서비스야. 면접 본다며?", ""),
         ("m", "nar", "지나가듯 한 말까지 기억하고 계심.", "지나가듯 한 말까지 / [기억]하심"),
         ("z", "nar", "님 동네에도 이런 사장님 있음?", "님 동네에도 / 이런 [사장님] 있음?")]
    C = [("a0", {"photo": P(17293343), "chars": [guy("happy", **BOSS, _keep=1, size=2.0, x=0.5, y=100)], "prop": "👔", "propX": 0.82, "steps": [9, 0.1, 9, 9]}),
         ("a", {"photo": P(965632), "chars": [me("shock")], "prop": "👔", "steps": [9, "a.꺼냄", 9, 9], "place": "📍 동네 세탁소"}),
         ("a2", {"photo": P(28576618), "chars": [me("neutral")], "prop": "👔", "steps": ["a2", 0.1, 9, 9], "say": say("다림질만 해 주세요")}),
         ("b", {"photo": P(17293343), "photoPos": "30% 50%", "chars": [guy("smug", **BOSS)], "big": "기억력 미침", "steps": [9, 9, 9, "b.미침"]}),
         ("c", {"bg": "store", "chars": [me("think")], "prop": "🚫", "big": "번호표 없음", "steps": [9, 0.1, 9, "c+0.3"]}),
         ("d", {"photo": P(28576618), "chars": [me("shock")], "steps": ["d", 9, 9, 9], "say": say("제 거 어떻게 아셨어요?")}),
         ("e", {"bg": "store", "chars": [guy("smug", **BOSS)], "prop": "☕", "steps": ["e", 0.1, 9, 9], "say": say("커피 자국은 3층 아가씨")}),
         ("f", {"photo": P(965632), "photoPos": "70% 50%", "chars": [guy("think", **BOSS)], "prop": "🧥", "steps": ["f", 0.1, 9, 9], "say": say("단추 없는 코트는 경비 아저씨")}),
         ("g", {"bg": "#FFE14D", "chars": [me("shock")], "big": "사람 = 얼룩", "steps": [9, 9, 9, "g.얼룩"]}),
         ("h", {"bg": "home", "chars": [me("cry")], "prop": "🍲", "steps": ["h", 0.1, 9, 9], "say": say("저는 영원히 김칫국물이에요?")}),
         ("i", {"bg": "#FFB3C7", "chars": [me("sad")], "big": "그날만…", "steps": [9, 9, 9, "i.흘린"]}),
         ("i2", {"bg": "store", "chars": [me("think"), guy("neutral", **BOSS)], "prop": "📱", "propX": 0.2, "steps": ["i2", 0.1, 9, 9], "say": say("다음 주 면접이라…")}),
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
