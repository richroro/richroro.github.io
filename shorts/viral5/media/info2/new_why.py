"""Write shorts/why1..why4 (script.json, edit.json): new info v2 shorts, animal + Korea, from the benchmark idea list.

usage: python3 media/info2/new_why.py [why1 ...]
Facts and their sources are in README "정보 쇼츠 v2" and media/info2/why_sources.json. Footage: Pexels (each item page opened,
licence "Free" = Pexels License), NOAA Ocean Exploration (US federal public domain). Fetch with build/pxget.sh or
media/info2/fetch_src.py.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import px

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HOOK = {"edge": "ko-KR-InJoonNeural", "rate": "+50%"}

def L(id, say, cap, voice="nar"):
    return {"id": id, "voice": voice, "gap": 0.05 if voice == "hook" else 0.15, "say": say, "cap": cap}

def C(src, frm, i, crop=None, label="", **k):
    d = {"src": src, "from": frm, "in": i, "label": label, "audio": 0}
    if crop: d["crop"] = crop
    d.update(k); return d

SHORTS = {}

# ── why1 지리산 반달가슴곰 ──
SHORTS["why1"] = dict(
    title=["한반도에 반달곰이", "[다시 돌아온] 진짜 이유"], nar="ko-KR-InJoonNeural", music="Heartwarming.mp3", rate="+30%",
    lines=[
        L("hook", "여섯 마리가 구십육 마리 됐습니다.", ["[6마리]가", "[96마리] 됐습니다"], "hook"),
        L("what", "지리산 반달가슴곰 얘기입니다.", ["지리산 / [반달가슴곰] 얘기"]),
        L("rare", "천연기념물이자,| 멸종위기 일 급인 곰이죠.", ["[천연기념물]이자", "멸종위기 [1급]"]),
        L("start", "이천사 년, 러시아에서 온 여섯 마리를| 지리산에 풀어 준 게 시작이었어요.", ["[2004년] 러시아에서 온 / [6마리]를", "지리산에 [풀어 줌]"]),
        L("goal", "목표는 오십 마리.| 오래 버틸 수 있는 최소한의 무리였죠.", ["목표는 [50마리]", "오래 버틸 / [최소한의 무리]"]),
        L("gen", "곰이 새끼를 낳고,| 그 새끼가 또 새끼를 낳아,| 이천이십이 년엔 사 세대까지 태어났어요.", ["곰이 [새끼]를 낳고", "그 새끼가 / 또 새끼를 낳아", "2022년엔 / [4세대]까지"]),
        L("osam", "어떤 곰은 혼자 김천 수도산까지 걸어갔어요.| 이름은 오삼이.", ["어떤 곰은 / [김천 수도산]까지", "이름은 [오삼이]"]),
        L("now", "국립공원공단 추정은 지금 구십육 마리.| 그런데 탐방로 십 미터 안에 머문 건,| 영 점 사사 퍼센트뿐이었죠.", ["국립공원공단 추정 / [96마리]", "탐방로 [10m] 안에 / 머문 건", "[0.44%]뿐"]),
        L("end", "곰이 사람을 피해 다닌다는 거죠.| 지리산에선 꼭 정해진 길로만 다니세요.", ["곰이 사람을 [피해 다님]", "지리산에선 / [정해진 길]로만"]),
    ],
    sources={
        "bear2": px("https://www.pexels.com/video/asian-black-bears-eating-in-natural-habitat-35012840/", "Magda Ehlers"),
        "bear1": px("https://www.pexels.com/video/asian-black-bears-grazing-in-natural-habitat-35012841/", "Magda Ehlers"),
        "zoo": px("https://www.pexels.com/video/asian-black-bear-exploring-zoo-habitat-39323803/", "Irina Fedotova"),
        "climb": px("https://www.pexels.com/video/black-bear-climbing-trees-in-forest-habitat-39169726/", "Irina Fedotova"),
        "mt": px("https://www.pexels.com/video/aerial-view-of-serene-mountain-landscape-34267124/", "PUWOOK Kwak"),
        "trail": px("https://www.pexels.com/video/hiking-trail-in-the-forest-19022174/", "Simo Herold"),
    },
    clips=[
        C("bear2", "hook", 2.5, [0.68, 0.45, 1.0], "반달가슴곰 얼굴"),
        C("bear2", "hook.구십육", 9.5, [0.62, 0.45, 1.3], "반달가슴곰"),
        C("mt", "what", 2.0, [0.5, 0.5, 1.0], "산줄기"),
        C("bear2", "what.반달가슴곰", 3.0, [0.71, 0.4, 1.5], "반달가슴곰 얼굴과 가슴 무늬"),
        C("bear1", "rare", 3.0, [0.6, 0.5, 1.0], "반달가슴곰 무리"),
        C("climb", "rare.멸종위기", 18.0, [0.5, 0.35, 1.0], "나무 타는 곰"),
        C("mt", "start", 12.0, [0.3, 0.5, 1.0], "산줄기"),
        C("bear1", "start.지리산에", 12.0, [0.55, 0.5, 1.2], "반달가슴곰"),
        C("bear1", "goal", 20.0, [0.6, 0.5, 1.0], "반달가슴곰 무리"),
        C("zoo", "goal.오래", 5.0, [0.3, 0.6, 1.3], "반달가슴곰"),
        C("bear2", "gen", 0.5, [0.35, 0.5, 1.0], "두 마리"),
        C("climb", "gen.그", 28.0, [0.5, 0.3, 1.0], "나무 타는 곰"),
        C("bear2", "gen.이천이십이", 6.0, [0.66, 0.4, 1.3], "반달가슴곰"),
        C("trail", "osam", 3.0, [0.5, 0.5, 1.0], "숲길"),
        C("climb", "osam.이름은", 10.0, [0.4, 0.35, 1.2], "나무 타는 곰"),
        C("mt", "now", 20.0, [0.6, 0.5, 1.0], "산줄기"),
        C("trail", "now.탐방로", 10.0, [0.5, 0.5, 1.0], "탐방로"),
        C("bear1", "now.영", 8.0, [0.6, 0.5, 1.3], "반달가슴곰"),
        C("mt", "end", 25.0, [0.4, 0.5, 1.0], "산줄기"),
        C("bear2", "end.지리산에선", 3.0, [0.71, 0.4, 1.4], "반달가슴곰 얼굴"),
    ],
    tags=[{"text": "자료화면", "from": 0, "to": "end@end+0.6"}],
    cover={"src": "bear2", "in": 3.0, "focus": "70% 45%", "title": ["한반도에 반달곰이", "[다시 돌아온] 진짜 이유"], "arrow": {"x": 730, "y": 930, "rot": -25, "len": 250}},
    sfx=[["hook", "whoosh", 0.4], ["start", "whoosh", 0.35], ["gen.이천이십이", "ding", 0.35], ["now.영", "pop", 0.4]],
)

# ── why2 문어 심장 세 개 ──
SHORTS["why2"] = dict(
    title=["문어 심장이", "[3개]인 진짜 이유"], nar="ko-KR-SunHiNeural", music="monkeys_spinning_monkeys.mp3",
    hook={"edge": "ko-KR-SunHiNeural", "rate": "+40%"},
    lines=[
        L("hook", "문어는 심장이 세 개입니다.", ["문어는 [심장]이", "[세 개]"], "hook"),
        L("two", "두 개는 아가미로 피를 보내고,| 하나는 온몸으로 보내죠.", ["[2개]는 아가미로", "[1개]는 온몸으로"]),
        L("blue", "게다가 피가 파랗습니다.| 구리가 든 헤모시아닌 때문이에요.", ["피가 [파랗다]", "구리가 든 / [헤모시아닌]"]),
        L("why", "이 피는 산소를 덜 싣고 끈적해서,| 더 센 압력으로 돌려야 하거든요.", ["산소를 덜 싣고 / [끈적]해서", "더 센 [압력]으로"]),
        L("swim", "그런데 헤엄칠 땐,| 온몸으로 피를 보내는 심장이 멈춥니다.", ["그런데 [헤엄칠] 땐", "온몸 심장이 / [멈춤]"]),
        L("crawl", "그래서 문어는 헤엄보다,| 바닥을 기어 다닐 때가 많죠.", ["그래서 헤엄보다", "바닥을 [기어 다님]"]),
        L("kr", "우리가 먹는 문어는 대문어와 참문어.| 대문어는 삼 미터, 오십 킬로그램까지 자랍니다.", ["우리가 먹는 / [대문어]·[참문어]", "대문어는 / [3m]·[50kg]까지"]),
        L("end", "오늘 문어숙회 드실 때,| 심장 세 개 떠올려 보세요.", ["문어숙회 드실 때", "[심장 세 개] 기억!"]),
    ],
    sources={
        "o1": px("https://www.pexels.com/video/video-of-an-octopus-underwater-1312397/", "Tom Fisk"),
        "o2": px("https://www.pexels.com/video/underwater-footage-of-an-octopus-swimming-in-the-sea-15623348/", "Jozef Papp"),
        "o3": px("https://www.pexels.com/video/close-up-of-octopus-exploring-coral-reef-34139293/", "JUN HO LEE"),
        "o4": px("https://www.pexels.com/video/octopus-camouflages-in-coral-reef-31496835/", "JUN HO LEE"),
        "o5": px("https://www.pexels.com/video/camouflaged-octopus-on-ocean-floor-39027976/", "JUN HO LEE"),
        "aq": px("https://www.pexels.com/video/pulpa-aquarium-biarritz-17836505/", "Entdecker Fuchs"),
        "noaa": {"file": "noaa_ex2301_octopus.mp4", "credit": "영상: NOAA", "label": "Deep-sea octopus crawling, Astoria Canyon, EX2301 dive 6 (NOAA Ocean Exploration, 2023 Shakedown + EXPRESS West Coast Exploration)",
                 "url": "https://oceanexplorer.noaa.gov/?p=12287", "fileUrl": "https://oceanexplorer.noaa.gov/wp-content/uploads/2023/04/ex2301-dive06-octopus-1280x720-1.mp4",
                 "license": "US federal government work, public domain (NOAA Ocean Exploration media guidelines: credit 'NOAA Ocean Exploration'); logo corner cropped out", "creator": "NOAA Ocean Exploration"},
    },
    clips=[
        C("o3", "hook", 0.5, [0.3, 0.5, 1.0], "문어 얼굴"),
        C("o3", "hook.세", 5.0, [0.35, 0.45, 1.3], "문어"),
        C("o1", "two", 6.0, [0.6, 0.5, 1.0], "문어"),
        C("aq", "two.하나는", 2.0, [0.5, 0.5, 1.0], "수족관 문어"),
        C("o3", "blue", 3.0, [0.22, 0.42, 1.3], "문어 눈"),
        C("noaa", "blue.구리가", 5.0, [0.62, 0.55, 1.0], "심해 문어"),
        C("o4", "why", 2.0, [0.5, 0.6, 1.2], "숨은 문어"),
        C("o5", "why.더", 1.0, [0.4, 0.5, 1.0], "바닥의 문어"),
        C("o2", "swim", 0.5, [0.35, 0.4, 1.0], "헤엄치는 문어"),
        C("o2", "swim.온몸으로", 9.0, [0.45, 0.3, 1.2], "헤엄치는 문어"),
        C("noaa", "crawl", 15.0, [0.62, 0.55, 1.0], "기어가는 심해 문어"),
        C("o1", "crawl.바닥을", 14.0, [0.65, 0.45, 1.0], "바닥을 기는 문어"),
        C("aq", "kr", 9.0, [0.5, 0.5, 1.0], "수족관 문어"),
        C("o3", "kr.대문어는", 7.0, [0.4, 0.5, 1.0], "문어"),
        C("o5", "end", 4.0, [0.45, 0.5, 1.0], "문어"),
        C("o3", "end.심장", 1.0, [0.3, 0.5, 1.2], "문어 얼굴"),
    ],
    tags=[],
    cover={"src": "o3", "in": 0.5, "focus": "44% 50%", "at": "bottom", "title": ["문어 심장이", "[3개]인 진짜 이유"], "ring": {"x": 497, "y": 800, "r": 120}},
    sfx=[["hook", "whoosh", 0.4], ["blue", "ding", 0.35], ["swim.온몸으로", "k_error_003", 0.35], ["kr", "pop", 0.35]],
)

# ── why3 철원 두루미 ──
SHORTS["why3"] = dict(
    title=["철원에 두루미 떼가", "[해마다 오는] 진짜 이유"], nar="ko-KR-SunHiNeural", music="Dreamer.mp3", rate="+32%",
    hook={"edge": "ko-KR-SunHiNeural", "rate": "+40%"},
    lines=[
        L("hook", "두루미 떼, 만 천 마리 왔습니다.", ["두루미 떼", "[1만 1천 마리]"], "hook"),
        L("rec", "작년 십일 월 철원군이 센 역대 최대 기록.| 재두루미가 만 마리,| 두루미가 천오백육십칠 마리였죠.", ["작년 11월 철원 / [역대 최대]", "재두루미 [1만 마리]", "두루미 [1,567마리]"]),
        L("rare", "두루미는 천연기념물이자 멸종위기 일 급.| 전 세계에 몇천 마리뿐인 새예요.", ["[천연기념물]·멸종위기 1급", "전 세계 / [몇천 마리]뿐"]),
        L("r1", "이유 하나,| 민통선 들판엔 사람이 거의 안 들어옵니다.", ["이유 ① [민통선]", "사람이 / [거의 안 옴]"]),
        L("r2", "이유 둘, 먹이.| 볏짚을 논에 남겨 두고,| 곡식도 뿌려 줘요.", ["이유 ② [먹이]", "[볏짚]을 논에 남기고", "곡식도 뿌려 줌"]),
        L("r3", "이유 셋, 잠자리.| 두루미는 얕은 물에 서서 잡니다.| 겨울에도 안 어는 샘통과, 물 댄 논이 있죠.", ["이유 ③ [잠자리]", "[얕은 물]에 서서 잠", "안 어는 [샘통] / 물 댄 논"]),
        L("end", "철원 두루미는,| 사람이 차려 준 겨울 집에 오는 셈이죠.", ["철원 두루미는", "사람이 차린 / [겨울 집]"]),
    ],
    sources={
        "c1": px("https://www.pexels.com/video/majestic-red-crowned-crane-in-winter-forest-29982167/", "Nicky Pe"),
        "c2": px("https://www.pexels.com/video/mandschurenkranich_rotkronenkranich-27182521/", "Nicky Pe"),
        "c3": px("https://www.pexels.com/video/kranich_mandschurenkranich-27021165/", "Nicky Pe"),
        "c4": px("https://www.pexels.com/video/rotkronenkranich-27624545/", "Nicky Pe"),
        "wn": px("https://www.pexels.com/video/elegant-white-naped-crane-in-natural-habitat-35571618/", "Brixiv"),
    },
    clips=[
        C("c1", "hook", 0.5, [0.38, 0.4, 1.4], "눈 덮인 개울의 두루미"),
        C("c3", "hook.만", 2.0, [0.3, 0.5, 1.0], "두루미 한 쌍"),
        C("c1", "rec", 9.3, [0.8, 0.25, 1.3], "날아오르는 두루미"),
        C("wn", "rec.재두루미가", 3.0, [0.45, 0.5, 1.0], "재두루미"),
        C("c2", "rec.두루미가", 1.0, [0.35, 0.5, 1.0], "두루미"),
        C("c4", "rare", 2.0, [0.42, 0.4, 1.0], "두루미 머리"),
        C("c3", "rare.전", 11.0, [0.4, 0.5, 1.0], "날개 펴는 두루미"),
        C("c1", "r1", 2.0, [0.5, 0.45, 1.0], "겨울 개울"),
        C("wn", "r1.사람이", 10.0, [0.35, 0.45, 1.0], "재두루미"),
        C("c2", "r2", 5.0, [0.3, 0.5, 1.0], "두루미"),
        C("wn", "r2.볏짚을", 16.0, [0.4, 0.5, 1.0], "재두루미"),
        C("c3", "r2.곡식도", 6.0, [0.35, 0.5, 1.0], "두루미 한 쌍"),
        C("c1", "r3", 4.0, [0.3, 0.45, 1.2], "물가의 두루미"),
        C("c4", "r3.두루미는", 10.0, [0.42, 0.4, 1.0], "두루미 머리"),
        C("c1", "r3.겨울에도", 11.0, [0.6, 0.4, 1.0], "겨울 개울"),
        C("c3", "end", 14.0, [0.45, 0.5, 1.0], "두루미"),
        C("c4", "end.사람이", 18.0, [0.45, 0.45, 1.0], "두루미 머리"),
    ],
    tags=[{"text": "자료화면", "from": 0, "to": "end@end+0.6"}],
    cover={"src": "c4", "in": 2.0, "focus": "40% 45%", "at": "bottom", "title": ["철원에 두루미 떼가", "[해마다 오는] 진짜 이유"], "ring": {"x": 636, "y": 640, "r": 110}},
    sfx=[["hook", "whoosh", 0.4], ["r1", "pop", 0.35], ["r2", "pop", 0.35], ["r3", "pop", 0.35], ["end", "ding", 0.3]],
)

# ── why4 까치 ──
SHORTS["why4"] = dict(
    title=["까치가 한국에선 길조", "[영국에선 흉조]인 이유"], nar="ko-KR-InJoonNeural", music="sneaky_snitch.mp3", rate="+32%",
    lines=[
        L("hook", "나라새 일 위, 까치입니다.", ["[나라새] 1위", "[까치]입니다"], "hook"),
        L("vote", "천구백육십사 년 한 신문의 나라새 뽑기에서 뽑혔죠.| 정식 국조는 아니지만요.", ["1964년 / [나라새] 뽑기", "정식 국조는 [아님]"]),
        L("guest", "아침에 까치가 울면 반가운 손님이 온다,| 그래서 길조였어요.", ["아침 까치는 / [반가운 손님]", "그래서 [길조]"]),
        L("bridge", "칠월칠석엔,| 견우와 직녀를 잇는 오작교도 놓죠.", ["칠월칠석엔", "견우·직녀의 / [오작교]"]),
        L("europe", "그런데 영국에선,| 까치 한 마리를 보면 슬픔이 온다고 했어요.", ["그런데 [영국]에선", "한 마리면 / [슬픔]이 온다"]),
        L("smart", "사실 까치는 똑똑합니다.| 거울 속 자신을 알아보고,| 사람 얼굴도 기억하죠.", ["까치는 [똑똑하다]", "거울 속 [자신]을 알아봄", "사람 [얼굴]도 기억"]),
        L("twist", "그런데 반전.| 지금 우리나라에선 전기 설비 피해 때문에,| 유해 야생동물로 지정돼 있어요.", ["그런데 [반전]", "전기 설비 [피해]", "[유해 야생동물] 지정"]),
        L("end", "길조일까요, 해조일까요?| 여러분 동네 까치는 어떤가요?", ["[길조]? [해조]?", "우리 동네 까치는?"]),
    ],
    sources={
        "m1": px("https://www.pexels.com/video/magpies-drinking-water-from-puddle-11202600/", "대정 김"),
        "m2": px("https://www.pexels.com/video/close-up-of-magpie-13780153/", "Justin Stretch"),
        "m3": px("https://www.pexels.com/video/close-up-of-a-eurasian-magpie-in-nature-39575836/", "Bil Hinton"),
        "m4": px("https://www.pexels.com/video/eurasian-magpie-foraging-in-forest-34931507/", "Bil Hinton"),
        "m6": px("https://www.pexels.com/video/magpie-foraging-on-mossy-wall-in-early-spring-36480781/", "Scott Precious"),
    },
    clips=[
        C("m3", "hook", 1.0, [0.5, 0.5, 1.0], "까치 얼굴"),
        C("m2", "hook.까치입니다", 3.0, [0.4, 0.5, 1.0], "까치"),
        C("m1", "vote", 2.0, [0.45, 0.55, 1.4], "물웅덩이의 까치들"),
        C("m4", "vote.정식", 14.0, [0.55, 0.5, 1.0], "까치"),
        C("m2", "guest", 14.0, [0.55, 0.5, 1.2], "까치"),
        C("m1", "guest.그래서", 12.0, [0.5, 0.55, 1.6], "까치들"),
        C("m4", "bridge", 12.0, [0.5, 0.5, 1.0], "까치"),
        C("m1", "bridge.견우와", 20.0, [0.5, 0.55, 1.3], "까치들"),
        C("m6", "europe", 5.0, [0.5, 0.7, 1.0], "영국의 까치"),
        C("m6", "europe.까치", 14.0, [0.6, 0.75, 1.4], "까치 한 마리"),
        C("m3", "smart", 8.0, [0.55, 0.5, 1.0], "까치 얼굴"),
        C("m1", "smart.거울", 6.0, [0.35, 0.55, 1.5], "물에 비친 까치"),
        C("m3", "smart.사람", 16.0, [0.6, 0.5, 1.0], "까치 얼굴"),
        C("m4", "twist", 8.0, [0.45, 0.5, 1.0], "까치"),
        C("m2", "twist.전기", 30.0, [0.55, 0.5, 1.0], "까치"),
        C("m1", "twist.유해", 24.0, [0.5, 0.55, 1.2], "까치들"),
        C("m2", "end", 38.0, [0.5, 0.5, 1.0], "까치"),
        C("m3", "end.여러분", 20.0, [0.55, 0.5, 1.0], "까치 얼굴"),
    ],
    tags=[{"text": "영국 까치 (Pexels)", "from": "europe", "to": "smart-0.05"}],
    cover={"src": "m2", "in": 21.3, "focus": "68% 50%", "title": ["까치가 한국에선 길조", "[영국에선 흉조]인 이유"]},
    sfx=[["hook", "whoosh", 0.4], ["europe", "k_error_003", 0.3], ["twist", "riser", 0.3], ["twist.유해", "pop", 0.4]],
)

def write(sid):
    s = SHORTS[sid]
    script = {"title": s["title"], "voices": {"nar": {"edge": s["nar"], "rate": s.get("rate", "+25%")}, "hook": s.get("hook", HOOK)}, "tail": 0.5, "lines": s["lines"]}
    edit = {"credit": "", "titleStyle": "band", "frame": "capTall", "capStyle": "info2", "hideCredit": True, "captionY": 1580,
            "sources": s["sources"], "clips": s["clips"], "marks": [], "stickers": [], "tags": s["tags"], "cover": s["cover"],
            "sfx": s["sfx"], "punches": [], "flashes": [], "music": {"file": f"music/{s['music']}", "gain": 0.14, "start": 0}}
    os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True)
    json.dump(script, open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    print(f"{sid}: written")

if __name__ == "__main__":
    for sid in sys.argv[1:] or SHORTS: write(sid)
