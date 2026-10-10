"""lfsaeyeon1 — the script as beats: (voice, line, scene). Original fiction (창작).

voice: nar (지은's narration), me (지은 speaking), hus (도윤), mom (어머님), sis (형님 도희)
scene: None keeps the previous picture (a new line over the same cut); a dict starts a new cut.
Scene keys (turned into the kit's edit.json by build.py):
  bg      backdrop: kitchen | fridge | living | bedroom | inlaw | dawn | door | bedroom2 | flash (a soft memory tint)
  place   the "📍" tag
  cast    [[who, mood, to?, {flags}]]  who: ji (지은) do (도윤) mom (어머님) sis (형님)
          flags: apron, gloves, baby, bandage, redears, phone, tears
  prop    a drawn prop: jjorim (neat star carrots) | jjorim_bad (crooked, salty) | perilla | box_empty | box_ji |
          box_mom | hands | lockapp | photo | suitcase | notebook | gloves_off | label_one | ketchup
  card    a full-frame time card, big  a slam word, zoom/focus a push-in
  ch      a chapter starts on this beat
"""

CHAPTERS = ["콜드 오픈", "발단: 이름표", "고조 1: 깻잎과 각방", "고조 2: 시어머니 생신", "단서: 도어록 기록", "반전: 새벽 4시 반", "여운", "여러분이라면?", "사이다: 일요일 시댁"]

B = [
 # ── 0:00 cold open ─────────────────────────────────────────────
 ("hus", "이건 엄마 거야. 당신은 손대지 마.", dict(ch=0, bg="fridge", prop="box_mom", cast=[["do", "neutral"], ["ji", "neutral", "shock"]], zoom=1.06, focus=0)),
 ("me",  "아니 근데… 여기 우리 집 냉장고거든?", dict(bg="fridge", prop="box_mom", cast=[["do", "think"], ["ji", "angry"]])),
 ("nar", "결혼 2년 차. 남편이 반찬통에 이름을 써 붙이기 시작했어요.", dict(bg="fridge", prop="label_many", cast=[["ji", "shock"]])),
 ("nar", "그리고 저희는… 각방을 썼습니다.", dict(bg="bedroom2", cast=[["ji", "sad"], ["do", "sad"]], big="각방")),

 # ── 0:20 setup ────────────────────────────────────────────────
 ("nar", "제 낙은 일요일 반찬 만들기예요.", dict(ch=1, bg="kitchen", place="📍 우리 집 부엌", cast=[["ji", "happy", None, {"apron": 1}]])),
 ("nar", "일주일 치를 한 번에 만들어서 통에 착착 넣어 두면, 그렇게 뿌듯할 수가 없어요.", dict(bg="kitchen", prop="boxes_row", cast=[["ji", "laugh", None, {"apron": 1}]])),
 ("nar", "제일 자신 있는 건 장조림. 메추리알은 반으로 가르고,", dict(bg="kitchen", prop="jjorim", cast=[["ji", "smug", None, {"apron": 1}]])),
 ("nar", "당근은 꼭, 별 모양으로 깎아요.", dict(bg="table", prop="jjorim", zoom=1.12, cast=[])),
 ("hus", "와, 별 들어간 장조림이다!", dict(bg="flash", place="📍 6년 전, 연애할 때", cast=[["do", "love"], ["ji", "shy"]])),
 ("nar", "연애 때 남편이 한 이 말 한마디에, 6년째 별을 깎고 있죠.", None),

 ("me",  "자기야, 장조림 했다! 별 넣었어.", dict(bg="living", cast=[["ji", "happy", None, {"apron": 1}], ["do", "sleep", None, {"sofa": 1}]])),
 ("hus", "오, 별. 최고.", dict(bg="living", cast=[["ji", "happy", None, {"apron": 1}], ["do", "happy", None, {"sofa": 1}]])),
 ("me",  "최고면 일어나서 통 좀 닦아 줄래?", dict(bg="living", cast=[["ji", "smug", None, {"apron": 1}], ["do", "neutral", None, {"sofa": 1}]])),
 ("hus", "그냥… 5분만.", dict(bg="living", cast=[["ji", "angry", None, {"apron": 1}], ["do", "sleep", None, {"sofa": 1}]])),
 ("nar", "남편은 주말엔 소파랑 한 몸이에요. 라면 물도 못 맞추는 사람이고요.", dict(bg="living", prop="ramen", cast=[["do", "sleep", None, {"sofa": 1}]], big="라면 물?")),
 ("nar", "말수도 적어요. 대신 거짓말을 하면… 귀부터 빨개져요.", dict(bg="living", cast=[["do", "shy", None, {"redears": 1}]], zoom=1.1, focus=0)),
 ("nar", "싫어하는 건 딱 하나. 깻잎이요.", dict(bg="table", prop="perilla", cast=[["do", "sick"], ["ji", "neutral"]])),
 ("hus", "이건 사람이 먹는 풀이 아니야.", None),
 ("me",  "그 풀, 내가 이틀 절인 거거든?", dict(bg="table", prop="perilla", cast=[["do", "sick"], ["ji", "angry"]])),
 ("nar", "생각해 보면 몇 주 전부터, 반찬이 유난히 빨리 줄긴 했어요. 남편이 잘 먹는 줄만 알았죠.", dict(bg="fridge", prop="boxes_half", cast=[["ji", "think"]])),
 ("nar", "그런데 그 깻잎이… 사라졌어요.", dict(bg="fridge", prop="box_empty", cast=[["ji", "shock"]], big="텅")),
 ("me",  "자기야, 깻잎 어디 갔어? 월요일에 한 통 꽉 차 있었는데.", dict(bg="living", cast=[["ji", "think"], ["do", "neutral", "shock"]])),
 ("hus", "어? 아… 내가 먹었어.", dict(bg="living", cast=[["ji", "think"], ["do", "shy", None, {"redears": 1}]], zoom=1.12, focus=1)),
 ("me",  "당신이? 깻잎을? 한 통을?", dict(bg="living", cast=[["ji", "shock"], ["do", "shy", None, {"redears": 1}]])),
 ("hus", "그냥… 갑자기 땡겼어.", None),
 ("nar", "귀가 새빨갰어요.", dict(bg="ear", cast=[["do", "shy", None, {"redears": 1}]], zoom=1.25, focus=0)),
 ("nar", "그리고 다음 날 아침. 냉장고를 열었는데,", dict(bg="kitchen", place="📍 다음 날 아침", cast=[["ji", "sleep", "shock"]])),
 ("nar", "반찬통마다 하얀 스티커가 붙어 있었어요. 남편 글씨로.", dict(bg="fridge", prop="label_many", big="이름표?!", cast=[])),
 ("nar", "장조림엔 '지은'. 김치엔 '도윤'. 그리고 맨 안쪽 은색 통 두 개엔, '엄마'.", dict(bg="fridge", prop="label_many", zoom=1.15, cast=[])),
 ("me",  "이게 다 뭐야?", dict(bg="kitchen", cast=[["ji", "shock"], ["do", "neutral"]])),
 ("hus", "그냥… 헷갈리지 말라고.", None),
 ("me",  "우리 둘이 사는데 뭐가 헷갈려?", dict(bg="kitchen", cast=[["ji", "angry"], ["do", "think"]])),
 ("hus", "엄마가 준 통은 돌려드려야 되잖아. 그건 손대지 마.", dict(bg="kitchen", prop="box_mom", cast=[["ji", "angry"], ["do", "neutral"]])),

 ("me",  "그럼 '엄마' 통엔 뭐가 들었는데?", dict(bg="kitchen", prop="box_mom", cast=[["ji", "think"], ["do", "neutral"]])),
 ("hus", "…빈 통이야. 돌려드릴 거.", dict(bg="kitchen", prop="box_mom", cast=[["ji", "think"], ["do", "shy", None, {"redears": 1}]])),
 ("nar", "말이 되는 것 같기도 했어요. 그땐요.", dict(bg="kitchen", cast=[["ji", "think"]])),

 # ── 2:00 escalation 1 ─────────────────────────────────────────
 ("nar", "이름표는 매일 늘어났어요.", dict(ch=2, bg="fridge", prop="label_more", cast=[["ji", "shock"]])),
 ("me",  "계란에도, 두부에도… 케첩에도?! 케첩은 왜!", dict(bg="fridge", prop="ketchup", cast=[["ji", "angry"], ["do", "neutral"]])),
 ("hus", "…그건 우리 거.", dict(bg="fridge", prop="ketchup", cast=[["ji", "angry"], ["do", "smug"]])),
 ("nar", "이상한 건 이름표만이 아니었어요. 남편 손가락에 밴드가 하나, 둘, 세 개.", dict(bg="hands", prop="hands", cast=[])),
 ("me",  "손 왜 그래?", dict(bg="living", cast=[["ji", "think"], ["do", "neutral", None, {"bandage": 1}]])),
 ("hus", "헬스장에서… 덤벨에.", dict(bg="living", cast=[["ji", "think"], ["do", "shy", None, {"bandage": 1, "redears": 1}]])),
 ("me",  "헬스장? 등록하고 딱 세 번 간 사람이?", dict(bg="living", cast=[["ji", "smug"], ["do", "shy", None, {"bandage": 1, "redears": 1}]])),
 ("nar", "그리고 새벽마다, 주방에서 간장 냄새가 났어요.", dict(bg="dawn", place="📍 새벽", cast=[["ji", "think"]])),
 ("nar", "아침에 보면 후드는 미지근하고, 개수대엔 물기가 남아 있고. 분리수거함엔 메추리알 껍데기가 수북하고.", dict(bg="kitchen", prop="sink_wet", cast=[["ji", "think"]])),
 ("me",  "새벽에 뭐 했어?", dict(bg="kitchen", cast=[["ji", "think"], ["do", "neutral"]])),
 ("hus", "운동. 새벽 운동.", dict(bg="kitchen", cast=[["ji", "think"], ["do", "shy", None, {"redears": 1}]])),
 ("nar", "또, 귀가 빨갰어요.", None),

 ("nar", "친구 수진이한테 털어놨더니, 이런 답이 왔어요.", dict(bg="bedroom", cast=[["ji", "sad", None, {"phone": 1}]], chat={"title": "수진", "msgs": [
     {"name": "나", "text": "새벽에 나가, 거짓말해, 손은 다쳐 와…", "me": True}, {"name": "수진", "text": "야 그거 혹시…"}, {"name": "수진", "text": "[딴 집] 반찬 챙겨 주는 거 아냐?"}]})),
 ("me",  "딴 집 반찬…? 설마.", None),
 ("nar", "그 '엄마' 통이 정말 어머님 거 맞는지. 처음으로 의심이 들었어요.", dict(bg="fridge", prop="box_mom", zoom=1.12, cast=[["ji", "think"]])),
 ("nar", "그날 밤, 결국 터졌죠.", dict(bg="living", place="📍 그날 밤", cast=[["ji", "angry"], ["do", "sad"]])),
 ("me",  "아니 근데, 내가 뭘 훔쳐 먹을까 봐 이름을 써 놔? 내 냉장고에?", dict(bg="living", cast=[["ji", "angry"], ["do", "sad"]], zoom=1.08, focus=0)),
 ("hus", "그런 거 아니야.", None),

 ("me",  "그 '엄마' 통, 진짜 어머님 거 맞아?", dict(bg="living", cast=[["ji", "angry"], ["do", "neutral"]])),
 ("hus", "…맞아. 엄마 거.", dict(bg="living", cast=[["ji", "angry"], ["do", "sad"]], zoom=1.1, focus=1)),
 ("me",  "그럼 뭔데! 말을 해!", dict(bg="living", cast=[["ji", "angry"], ["do", "sad"]])),
 ("hus", "…지금은, 말 못 해.", dict(bg="living", cast=[["ji", "angry", "cry"], ["do", "sad"]])),
 ("me",  "그럼 당분간 따로 자. 이런 기분으로 옆에서 못 자.", dict(bg="living", cast=[["ji", "cry"], ["do", "sad"]])),
 ("nar", "홧김에 한 말이었어요. 붙잡아 주길 바랐죠.", dict(bg="living", cast=[["ji", "sad"]], zoom=1.1)),
 ("hus", "…그래. 당분간 따로 자자. 나 어차피 일찍 일어나니까.", dict(bg="living", cast=[["ji", "sad", "shock"], ["do", "neutral"]])),
 ("nar", "1초도 안 걸렸어요.", dict(bg="living", cast=[["ji", "shock"]], big="1초")),
 ("nar", "그렇게 저는 안방에, 남편은 작은방에. 이름표 때문에, 각방을 쓰게 됐어요.", dict(bg="bedroom2", cast=[["ji", "cry"], ["do", "sleep"]])),

 # ── 4:00 escalation 2: the in-laws ────────────────────────────
 ("nar", "그 주 토요일은 어머님 생신이었어요.", dict(ch=3, bg="inlaw", place="📍 시댁", card="토요일, 어머님 생신", cast=[])),
 ("nar", "어머님은 반찬 솜씨로 동네에서 유명하신 분이에요.", dict(bg="inlaw", place="📍 시댁", cast=[["mom", "happy"]])),

 ("mom", "지은이 왔냐. 아이고, 얼굴이 왜 이리 핼쑥하냐.", dict(bg="inlaw", cast=[["mom", "happy", None, {"gloves": 1}], ["ji", "neutral"]])),
 ("me",  "아니에요, 어머님. 생신 축하드려요.", dict(bg="inlaw", cast=[["mom", "happy", None, {"gloves": 1}], ["ji", "happy"]])),
 ("nar", "그런데 그날, 한여름인데 면장갑을 끼고 계셨어요. 파스 냄새도 났고요.", dict(bg="inlaw", cast=[["mom", "neutral", None, {"gloves": 1}]], zoom=1.15, focus=0)),
 ("me",  "어머님, 손 괜찮으세요?", dict(bg="inlaw", cast=[["ji", "think"], ["mom", "neutral", None, {"gloves": 1}]])),
 ("mom", "아이고, 됐다 됐어. 손이 좀 시려서 그래.", dict(bg="inlaw", cast=[["ji", "think"], ["mom", "happy", None, {"gloves": 1}]])),
 ("nar", "그리고 형님. 남편의 누나예요. 백 일 된 아기를 안고 오셨죠.", dict(bg="inlaw", cast=[["sis", "sleep", None, {"baby": 1}]])),
 ("sis", "아 진짜~ 엄마 반찬 없었으면 나 산후조리 못 했어.", dict(bg="inlaw", cast=[["sis", "happy", None, {"baby": 1}], ["mom", "neutral", None, {"gloves": 1}]])),
 ("sis", "올케, 이거 봐 봐. 엄마 장조림! 별 당근 들어간 거.", dict(bg="inlaw", prop="photo", cast=[["sis", "laugh", None, {"baby": 1, "phone": 1}], ["ji", "neutral", "shock"]])),
 ("nar", "심장이 쿵, 내려앉았어요.", dict(bg="photo", prop="photo", zoom=1.15, cast=[], big="쿵")),
 ("nar", "반으로 가른 메추리알. 별 모양 당근. 그건… 제 장조림이었어요.", None),
 ("sis", "올케도 엄마한테 좀 배워. 엄마 손맛은 진짜 달라.", dict(bg="inlaw", cast=[["sis", "smug", None, {"baby": 1}], ["ji", "sad"]])),
 ("nar", "어머님은 제 눈을 피하셨어요. 남편은 수저를 탁, 내려놨고요.", dict(bg="inlaw", cast=[["mom", "sad", None, {"gloves": 1}], ["ji", "sad"], ["do", "angry"]])),
 ("hus", "누나, 그만해.", dict(bg="inlaw", cast=[["sis", "neutral", None, {"baby": 1}], ["do", "angry"]])),
 ("sis", "왜~ 칭찬인데. 아, 근데 엄마. 요즘 건 별이 좀 찌그러졌더라?", dict(bg="inlaw", cast=[["sis", "think", None, {"baby": 1}], ["mom", "sad", None, {"gloves": 1}], ["do", "neutral", "shock"]])),
 ("sis", "그리고 좀 짜. 엄마 손맛 변했어?", dict(bg="inlaw", cast=[["sis", "laugh", None, {"baby": 1}], ["mom", "sad", None, {"gloves": 1}], ["do", "shy", None, {"redears": 1}]])),
 ("mom", "…그랬냐.", dict(bg="inlaw", cast=[["mom", "sad", None, {"gloves": 1}]], zoom=1.12, focus=0)),
 ("nar", "그날 저녁을 어떻게 먹었는지, 기억도 안 나요.", dict(bg="night_car", place="📍 돌아오는 길", cast=[["ji", "sad"], ["do", "sad"]])),

 ("hus", "지은아. 조금만… 기다려 주면 안 돼?", dict(bg="night_car", cast=[["ji", "sad"], ["do", "sad"]])),
 ("me",  "뭘 기다려? 내 반찬이 형님 집에 가 있는데?", dict(bg="night_car", cast=[["ji", "angry"], ["do", "sad"]])),
 ("me",  "당신, 알고 있었지. 어머님이 내 반찬 가져가신 거.", dict(bg="living", place="📍 집", cast=[["ji", "angry"], ["do", "sad"]])),
 ("hus", "…미안해.", dict(bg="living", cast=[["ji", "angry"], ["do", "sad"]], zoom=1.1, focus=1)),
 ("me",  "이름표도 그래서 붙였어? 어머님 편하게 가져가시라고?", dict(bg="living", cast=[["ji", "cry"], ["do", "shock"]])),
 ("hus", "아니야. 그건 진짜 아니야. 근데… 지금은 말 못 해.", dict(bg="living", cast=[["ji", "cry"], ["do", "sad"]])),
 ("nar", "그 말이 제일 아팠어요. 그날 밤, 저는 친정 갈 짐을 쌌어요.", dict(bg="bedroom", prop="suitcase", cast=[["ji", "cry"]])),

 # ── 6:00 the clues lock together ──────────────────────────────
 ("nar", "짐을 싸다가, 문득 하나가 떠올랐어요. 도어록 앱이요.", dict(ch=4, bg="bedroom", prop="lockapp", cast=[["ji", "think", None, {"phone": 1}]])),
 ("nar", "열림 기록을 봤더니, 화요일 오후 2시 10분. 목요일 오후 2시 10분. 매주요.", dict(bg="lockapp", prop="lockapp", zoom=1.12, cast=[])),
 ("me",  "이 시간엔… 우리 둘 다 회사에 있는데?", dict(bg="bedroom", cast=[["ji", "shock", None, {"phone": 1}]])),
 ("nar", "그래서 그 주 목요일. 반차를 내고, 작은방에 숨어 있었어요.", dict(bg="door", place="📍 목요일 오후", cast=[["ji", "think"]], zoom=1.06)),
 ("nar", "2시 9분. 제 숨소리가 그렇게 크게 들린 건 처음이었어요.", dict(bg="door", cast=[["ji", "shock"]], big="2:09", zoom=1.12, focus=0)),
 ("nar", "삐, 삐, 삐. 문이 열리고, 어머님이 들어오셨어요.", dict(bg="door", cast=[["mom", "neutral", None, {"gloves": 1}]], big="삐삐삐")),
 ("me",  "…어머님?", dict(bg="door", cast=[["ji", "shock"]], zoom=1.15, focus=0, whisper=1)),
 ("nar", "장갑 낀 손으로 냉장고를 여시더니, '엄마'라고 쓴 은색 통 두 개만 꺼내셨어요.", dict(bg="fridge", prop="box_mom", cast=[["mom", "neutral", None, {"gloves": 1}]])),
 ("nar", "그리고 '지은'이라고 쓴 제 장조림 앞에서, 한참을 서 계셨어요.", dict(bg="fridge", prop="box_ji", cast=[["mom", "sad", None, {"gloves": 1}]], zoom=1.1, focus=0)),
 ("mom", "아이고… 미안하다, 지은아.", None),
 ("nar", "어머님은 제 반찬엔 손도 안 대고, 가셨어요.", dict(bg="door", cast=[["ji", "shock"]])),
 ("nar", "냉장고에 남은 '엄마' 통 하나를, 처음으로 열어 봤어요.", dict(bg="fridge", prop="box_mom", cast=[["ji", "think"]])),
 ("nar", "장조림이었어요. 그런데 메추리알은 삐뚤빼뚤, 당근 별은… 다 찌그러져 있었어요.", dict(bg="table", prop="jjorim_bad", zoom=1.12, cast=[])),
 ("me",  "이거… 별이야? 별이라고 깎은 거야?", dict(bg="table", prop="jjorim_bad", zoom=1.2, cast=[])),
 ("me",  "…짜. 엄청 짜.", dict(bg="kitchen", prop="jjorim_bad", cast=[["ji", "sick"]])),
 ("nar", "그 순간, 머릿속에서 뭔가가 하나씩 맞춰졌어요.", dict(bg="kitchen", prop="jjorim_bad", cast=[["ji", "think"]], zoom=1.08, focus=0)),
 ("me",  "새벽 간장 냄새… 분리수거함의 메추리알 껍데기… 손가락 밴드 세 개…", dict(bg="kitchen", prop="sink_wet", cast=[["ji", "shock"]])),
 ("nar", "제 것도 아니고, 어머님 것도 아니었어요.", dict(bg="kitchen", cast=[["ji", "think"]])),
 ("nar", "그럼 이건, 누가 만든 걸까요?", dict(bg="kitchen", cast=[["ji", "think"]], zoom=1.15, focus=0, quiet=1)),
 ("nar", "다음 날 새벽 4시 반. 간장 냄새에 잠이 깼어요.", dict(bg="dawn", card="새벽 4시 30분", cast=[])),

 # ── 7:30 the twist ────────────────────────────────────────────
 ("nar", "주방 불빛 아래, 남편이 앞치마를 두르고 서 있었어요.", dict(ch=5, bg="dawn", cast=[["do", "think", None, {"apron": 1, "bandage": 1}]], zoom=1.08, focus=0)),
 ("nar", "제 레시피 노트를 휴대폰으로 찍어 놓고, 밴드 붙인 손으로… 당근을 별 모양으로 깎고 있었어요.", dict(bg="dawn", prop="notebook", cast=[["do", "think", None, {"apron": 1, "bandage": 1}]])),
 ("me",  "…당신, 뭐 해?", dict(bg="dawn", cast=[["ji", "shock"], ["do", "shock", None, {"apron": 1, "bandage": 1}]])),
 ("hus", "…들켰네.", dict(bg="dawn", cast=[["ji", "shock"], ["do", "shy", None, {"apron": 1, "bandage": 1, "redears": 1}]])),
 ("hus", "엄마 손이, 1년 전부터 안 좋아. 관절이래. 이제 칼을 못 쥐셔.", dict(bg="dawn", cast=[["ji", "sad"], ["do", "sad", None, {"apron": 1, "bandage": 1}]])),
 ("hus", "근데 누나가 애 낳고 엄마 반찬만 찾잖아. 엄마는 못 한다는 말을 못 하셨대.", dict(bg="flash", place="📍 몇 달 전", cast=[["mom", "sad", None, {"gloves": 1}], ["sis", "happy", None, {"baby": 1}]])),
 ("hus", "그래서 우리 집에 와서… 당신 반찬을 가져가셨어. 엄마가 한 것처럼.", dict(bg="flash", prop="box_ji", cast=[["mom", "cry", None, {"gloves": 1}]])),

 ("hus", "석 달 전에 도어록 알림이 와서, 점심시간에 와 봤어. 엄마가 부엌에서 울고 계시더라.", dict(bg="flash", place="📍 석 달 전, 우리 집", cast=[["mom", "cry", None, {"gloves": 1}], ["do", "shock"]])),
 ("mom", "도윤아… 도희한텐 말하지 마라. 엄마가 해 준다고 했는데, 손이 이래서…", dict(bg="flash", cast=[["mom", "cry", None, {"gloves": 1}], ["do", "sad"]])),
 ("hus", "알았어, 엄마. 그럼… 내가 할게.", dict(bg="flash", cast=[["mom", "sad", None, {"gloves": 1}], ["do", "neutral"]], zoom=1.1, focus=1)),
 ("me",  "그럼… 이름표는?", dict(bg="dawn", cast=[["ji", "think"], ["do", "sad", None, {"apron": 1, "bandage": 1}]])),
 ("hus", "엄마한테 하는 말이었어. '지은'이라고 쓴 건, 손대지 마시라고.", dict(bg="fridge", prop="box_ji", cast=[])),
 ("hus", "'엄마'라고 쓴 건… 이거 가져가시라고. 내가 만든 거니까.", dict(bg="fridge", prop="box_mom", zoom=1.12, cast=[])),
 ("hus", "엄마 체면도, 당신 반찬도. 둘 다 지키고 싶었어. 엄마가 아무한테도 말하지 말라고 하셔서.", dict(bg="dawn", cast=[["ji", "sad"], ["do", "cry", None, {"apron": 1, "bandage": 1}]], zoom=1.1, focus=1)),
 ("me",  "그럼 각방은? 그렇게 바로 좋다고 한 건?", dict(bg="dawn", cast=[["ji", "cry"], ["do", "sad", None, {"apron": 1, "bandage": 1}]])),
 ("hus", "…새벽에 이거 하려면. 당신 깨우면 안 되니까.", dict(bg="dawn", cast=[["ji", "cry"], ["do", "shy", None, {"apron": 1, "bandage": 1}]])),

 ("me",  "그럼 깻잎은? 당신이 다 먹었다며.", dict(bg="dawn", cast=[["ji", "think"], ["do", "shy", None, {"apron": 1, "bandage": 1}]])),
 ("hus", "그건… 엄마가 실수로 가져가신 거. 나 깻잎은 진짜 못 먹어.", dict(bg="dawn", prop="perilla", cast=[["ji", "laugh"], ["do", "sick", None, {"apron": 1, "bandage": 1}]])),
 ("me",  "손가락은? 덤벨?", None),
 ("hus", "…별 깎다가.", dict(bg="hands", prop="hands", cast=[])),
 ("nar", "웃음이 나는데, 눈물도 같이 났어요.", dict(bg="dawn", cast=[["ji", "cry", "laugh"], ["do", "shy", None, {"apron": 1, "bandage": 1}]], zoom=1.1, focus=0)),
 ("me",  "바보야. 간장을 이렇게 들이부으니까 짜지.", dict(bg="dawn", cast=[["ji", "laugh", None, {"apron": 1}], ["do", "happy", None, {"apron": 1, "bandage": 1}]])),
 ("nar", "그날 새벽, 처음으로 둘이 같이 장조림을 만들었어요.", dict(bg="dawn", prop="jjorim", cast=[["ji", "happy", None, {"apron": 1}], ["do", "love", None, {"apron": 1, "bandage": 1}]])),
 ("nar", "그리고 그 주 일요일. 제 장조림을 들고 시댁에 갔어요.", dict(ch=8, bg="inlaw", card="일요일, 시댁", cast=[])),
 ("sis", "와, 엄마 장조림! 이번 건 별이 예쁘다~ 역시 엄마야.", dict(bg="inlaw", prop="jjorim", cast=[["sis", "laugh", None, {"baby": 1}], ["mom", "neutral", None, {"gloves": 1}], ["ji", "neutral"]])),
 ("nar", "제가 뭐라고 하기도 전에, 어머님이 장갑을 벗으셨어요.", dict(bg="inlaw", prop="gloves_off", cast=[["mom", "sad"]], zoom=1.1, focus=0)),
 ("mom", "도희야. 그거, 지은이가 한 거다.", dict(bg="inlaw", cast=[["mom", "neutral"], ["sis", "shock", None, {"baby": 1}]])),
 ("mom", "엄마 손, 이제 이래. 그동안 네가 먹은 거, 거의 다 지은이 거야.", dict(bg="inlaw", prop="hands_mom", cast=[["mom", "sad"], ["sis", "shock", None, {"baby": 1}]])),
 ("sis", "…진짜? 올케 거였어?", dict(bg="inlaw", cast=[["sis", "shock", None, {"baby": 1}], ["ji", "shy"]])),
 ("sis", "아 진짜… 올케, 미안해. 올케 반찬 먹으면서, 올케한테 배우라고 했네.", dict(bg="inlaw", cast=[["sis", "cry", None, {"baby": 1}], ["ji", "happy"]])),
 ("sis", "다음엔 나도 별 깎는 거 가르쳐 줘. 애 이유식에 넣게.", dict(bg="inlaw", cast=[["sis", "shy", None, {"baby": 1}], ["ji", "laugh"]])),
 ("mom", "지은아, 고맙다. 그리고 미안하다.", dict(bg="inlaw", cast=[["mom", "cry"], ["ji", "cry", "happy"]])),
 ("sis", "잠깐. 그럼 요즘 짰던 건, 누가 했는데?", dict(bg="inlaw", cast=[["sis", "think", None, {"baby": 1}], ["mom", "neutral"], ["ji", "smug"]])),
 ("nar", "남편이 조용히 손을 들었어요. 밴드 세 개 붙은 손을.", dict(bg="inlaw", cast=[["do", "shy", None, {"bandage": 1, "redears": 1, "hand": 1}]], big="🙋‍♂️")),

 # ── 9:00 aftertaste ───────────────────────────────────────────
 ("nar", "요즘 저희 냉장고엔, 이름표가 딱 하나 붙어 있어요.", dict(ch=6, bg="fridge", prop="label_one", cast=[["ji", "happy"]])),
 ("nar", "'어머님 거. 화요일.'", dict(bg="fridge", prop="label_one", zoom=1.3, focus=None, cast=[["ji", "happy"]])),
 ("nar", "화요일마다 어머님이 오세요. 이제는 몰래가 아니라, 초인종을 누르고요.", dict(bg="door", cast=[["mom", "happy"], ["ji", "happy", None, {"apron": 1}]])),
 ("mom", "별은 내가 깎으마. 칼질은 못 해도, 모양 내는 건 아직 된다.", dict(bg="kitchen", prop="jjorim", cast=[["mom", "smug"], ["ji", "laugh", None, {"apron": 1}]])),
 ("nar", "각방이요? 그건 끝났어요. 남편이 새벽 4시 반에 일어날 일이 없어졌거든요.", dict(bg="bedroom", cast=[["ji", "happy"], ["do", "love"]])),
 ("hus", "근데 장조림은 이제 내가 할래. 안 짜게.", dict(bg="kitchen", cast=[["do", "smug", None, {"apron": 1, "bandage": 1}], ["ji", "think"]])),
 ("me",  "그 말, 믿는다?", None),
 ("nar", "귀가… 빨갰어요.", dict(bg="ear", cast=[["do", "shy", None, {"apron": 1, "redears": 1}]], zoom=1.25, focus=0)),

 # ── 9:40 question ─────────────────────────────────────────────
 ("nar", "여러분이라면, 이름표 붙인 남편. 바로 용서하셨을까요, 아니면 각방 한 달 더?", dict(ch=7, bg="fridge", prop="label_many", cast=[["ji", "think"], ["do", "shy", None, {"redears": 1}]])),
 ("nar", "댓글로 알려 주세요.", dict(bg="fridge", prop="label_one", cast=[["ji", "laugh"], ["do", "happy"], ["mom", "happy"]])),
]
