"""Print the README section "정보 쇼츠 v2 (벤치마크: life·issue·hanban·why)": options, scorecards (out/review/<id>/scorecard.json),
sources (media/info2/sources.json), facts and upload texts. usage: python3 media/info2/readme_v2.py > /tmp/section.md"""
import json, os, re

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IDS = ["issue1", "issue2", "issue3", "issue4", "life1", "life2", "life3", "life4", "life5", "life6", "life7", "life8",
       "hanban1", "hanban2", "hanban3", "hanban4", "why1", "why2", "why3", "why4"]
T = json.load(open(f"{HERE}/research/benchmark-targets-footage.json"))["info_reason"]
SRC = json.load(open(f"{HERE}/media/info2/sources.json"))
MUSIC = lambda m: f'음악: "{m}" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/'
MNAME = {"Heroic Age.mp3": "Heroic Age", "Movement Proposition.mp3": "Movement Proposition", "Heartwarming.mp3": "Heartwarming",
         "Floating Cities.mp3": "Floating Cities", "sneaky_snitch.mp3": "Sneaky Snitch", "Exhilarate.mp3": "Exhilarate", "hustle.mp3": "Hustle",
         "Lightless Dawn.mp3": "Lightless Dawn", "scheming_weasel.mp3": "Scheming Weasel (faster version)", "Dreamer.mp3": "Dreamer",
         "monkeys_spinning_monkeys.mp3": "Monkeys Spinning Monkeys"}

# upload title, description (facts, "2026년 10월 기준"), hashtags, pinned comment
UP = {
 "issue1": ("누리호 위성 15기 중 1기만 못 나온 진짜 이유 ㄷㄷ", "10월 7일 누리호 5차 발사 성공! 주탑재 초소형 군집위성 5기는 모두 궤도에 올라 당일 교신까지 성공했지만, 큐브위성 10기 중 1기는 분리 신호를 받고도 위성을 내보내는 덮개가 열리지 않아 분리되지 못했습니다. 누리호는 5번 중 4번 성공(80%), 6차 발사는 내년 하반기 목표. (2026년 10월 기준) ※ 영상은 지난 발사(2021~2023) 자료화면입니다.\n출처: 우주항공청·정책브리핑, 파이낸셜뉴스, 전자신문, 머니투데이방송, 아이뉴스24", "#누리호 #우주항공청 #군집위성 #나로우주센터 #shorts", "다음 6차 발사, 몇 번째 성공일까요? 🚀"),
 "issue2": ("기름값 상한제 있는데 경유 20% 오른 진짜 이유", "2026년 9월 소비자물가에서 경유는 1년 전보다 20.0%, 휘발유는 11.8% 올랐습니다. 3월 13일 시작된 석유 최고가격제는 주유소 판매가가 아니라 정유사가 주유소에 공급하는 가격에 상한을 두고, 상한선도 국제유가에 따라 다시 정해집니다(경유 1차 1,713원 → 10차 1,773원). 정부는 상한제가 없었다면 9월 물가 상승률이 2.9%가 아니라 3.5%였을 것으로 추정합니다. 10차 상한은 9월 19일부터 4주간. (2026년 10월 기준) ※ 주유·정유 장면은 참고 영상입니다.\n출처: 국가데이터처 9월 소비자물가동향(정책브리핑), 재정경제부·산업통상부 자료, KDI 경제정보센터, 이투데이, 머니투데이", "#기름값 #경유 #석유최고가격제 #소비자물가 #shorts", "요즘 주유소 가면 경유 리터당 얼마인가요? ⛽"),
 "issue3": ("한글날이 22년 동안 쉬는 날이 아니었던 진짜 이유?", "한글날은 1991년부터 \"공휴일이 너무 많다\", \"어려운 경제 여건\" 등을 이유로 국군의 날과 함께 공휴일에서 빠졌습니다. 2006년 국경일이 됐지만 쉬지는 않았고, 2012년 12월 24일 국무회의 의결로 2013년부터 다시 공휴일이 됐습니다.\n출처: 문화체육관광부 보도자료(2012), 국가기록원 '기록으로 보는 국경일'", "#한글날 #공휴일 #훈민정음 #한국사 #shorts", "여러분은 한글날에 학교 간 기억, 있나요? 📅"),
 "issue4": ("올해 노벨물리학상 받은 남극 얼음 덩어리의 정체 ㄷㄷ", "2026년 노벨물리학상은 남극 얼음 1km³를 통째로 검출기로 만든 '아이스큐브 중성미자 관측소'를 이끈 프랜시스 할젠 교수에게 돌아갔습니다(10월 6일 발표, 단독 수상). 얼음 속 1,450~2,450m에 심은 센서 5,160개가 중성미자가 부딪힐 때 나는 빛을 잡아, 2013년 우주에서 온 고에너지 중성미자를 처음 확인했습니다. 중성미자는 1초에 약 100조 개씩 우리 몸을 통과합니다. (2026년 10월 기준)\n출처: 노벨위원회 발표(서울신문·한국일보 보도), IceCube 공식 자료, NASA", "#노벨물리학상 #중성미자 #아이스큐브 #남극 #shorts", "1초에 100조 개가 지나간다니, 믿어지시나요? 🧊"),
 "life1": ("비행기 창문이 네모가 아닌 진짜 이유 ✈️", "1954년, 세계 첫 제트 여객기 '코멧' 두 대가 석 달 사이 하늘에서 부서졌습니다. 동체를 통째로 물탱크에 넣고 압력을 수천 번 넣었다 빼는 시험 끝에 찾은 원인은 네모난 창(지붕 안테나 창·비상구 창) 모서리의 금속 피로. 그래서 지금 비행기 창문은 모서리를 둥글게 만듭니다.\n출처: FAA Lessons Learned – de Havilland Comet", "#비행기 #비행기창문 #항공상식 #생활상식 #shorts", "창가 자리파? 통로 자리파? 🪟"),
 "life2": ("엘리베이터 거울이 셀카용이 아닌 진짜 이유 ㄷㄷ", "엘리베이터 거울, 기다림이 덜 지루하라고 달았다는 얘기 들어 보셨죠? 우리 법에는 다른 이유가 적혀 있습니다. 「장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙」 [별표 1]: 휠체어가 안에서 180도 돌 수 없는 장애인용 승강기는, 후진하며 문이 열렸는지 확인할 수 있도록 뒷벽 0.6m 이상 높이에 견고한 거울을 달아야 합니다. (2026년 10월 기준, law.go.kr)", "#엘리베이터 #엘베거울 #생활상식 #휠체어 #shorts", "엘베 거울, 셀카 말고 이렇게 쓰는 거 알고 계셨나요? 🪞"),
 "life3": ("제한속도 지켜도 1차로에서 단속되는 진짜 이유 🚗", "편도 3차로 이상 고속도로의 1차로는 앞지르기할 때만 쓰는 차로입니다(도로교통법 시행규칙 별표 9). 계속 달리면 고속도로 지정차로 위반 — 승용차 범칙금 4만 원, 승합차 5만 원, 벌점 10점. 단, 정체로 시속 80km 미만일 땐 예외입니다. (2026년 10월 기준, law.go.kr)", "#고속도로 #1차로 #지정차로 #운전상식 #shorts", "여러분은 고속도로에서 몇 차로로 달리시나요? 🛣️"),
 "life4": ("이착륙 때 창문 덮개 열라는 진짜 이유 ✈️", "이착륙 때 창문 덮개를 열어 두면 창밖 상황을 빨리 발견할 수 있고, 정전 때 바깥 빛으로 비상구를 찾을 수 있고, 밖에서도 기내를 확인할 수 있습니다. 조명을 낮추는 것도 눈이 어둠에 적응하도록 하는 것. 다만 국내 한 항공사는 2021년부터 의무가 아닌 권고로 운영하고, 날개 위·비상구 창문은 여는 게 원칙입니다. 항공사마다 규정은 다를 수 있어요.\n출처: 대한항공 뉴스룸 「항공상식 Q&A」(2023.9.6)", "#비행기 #항공상식 #창문덮개 #비상구 #shorts", "이착륙 때 창문, 열어 두시나요? 🛫"),
 "life5": ("노란불 3초, 밟으라는 시간이 아닌 진짜 이유 🚦", "대부분의 교차로 노란불은 3초(법정 시간은 아님). 시속 50km면 멈추는 데 2.46초라 충분하지만, 시속 70km면 5.9초가 필요해 '딜레마존'이 생깁니다(한국교통연구원 2025). 노란불은 '정지선 앞에서 멈추라'는 신호이고(도로교통법 시행규칙 별표 2), 2024년 대법원은 못 멈출 거리였어도 정지선 앞에서 안 멈췄다면 신호위반이라고 봤습니다(세계일보·문화일보 보도). (2026년 10월 기준)", "#신호등 #노란불 #딜레마존 #운전상식 #shorts", "노란불 보면 밟는다 vs 멈춘다, 솔직히? 🚥"),
 "life6": ("비상구 표시가 초록색인 진짜 이유 🟩", "비상구 표시가 초록인 건 연기 속에서 더 잘 보여서가 아니라 국제 약속 때문입니다. 국제표준(ISO 3864·7010)에서 초록은 '안전', 빨강은 '금지·소방 장비'. 소방청 고시 「유도등의 형식승인 및 제품검사의 기술기준」 제9조도 피난구유도등은 녹색 바탕에 흰 문자로 정해 뒀어요. 달리는 사람 그림은 1970년대 일본 공모전에서 나와 1980년대 국제표준이 됐습니다. (2026년 10월 기준)", "#비상구 #생활상식 #소방 #픽토그램 #shorts", "빨간 EXIT 표시, 해외에서 본 적 있나요? 🏃"),
 "life7": ("볼펜 뚜껑에 구멍이 뚫린 진짜 이유 ㄷㄷ", "볼펜 뚜껑 끝 구멍은 잉크 때문이 아니라 아이 안전 때문입니다. 국제표준 ISO 11540:2021은 14세 이하 아이가 쓸 만한 펜의 뚜껑을 충분히 크게 만들거나, 분당 8리터 이상 공기가 통하게 하라고 정합니다(구멍 약 3.4mm², 지름 약 2mm). 질식을 완전히 막진 못해도 병원에 갈 시간을 벌어 줘요. 우리 학용품 안전기준에도 마킹펜 뚜껑 질식 기준이 있습니다. ※ 뚜껑 그림은 직접 그린 것입니다.", "#볼펜 #생활상식 #어린이안전 #ISO #shorts", "볼펜 뚜껑 씹는 버릇, 있으신가요? 🖊️"),
 "life8": ("지하철 임산부 배려석이 분홍색인 진짜 이유 🩷", "서울 지하철 임산부 배려석은 2013년 12월 1~8호선 칸당 2석으로 시작했지만, 처음엔 작은 엠블럼뿐이라 눈에 잘 띄지 않았습니다. 그래서 서울시는 2015년 좌석·등받이·바닥까지 분홍으로 바꾼 '핑크카펫'을 도입했어요. 새 생명을 품은 임산부를 환영한다는 뜻이고, 티가 나지 않는 임신 초기 임산부를 배려하려는 것. 2016년엔 1~8호선 7,140석으로 늘었습니다(서울시 발표).", "#임산부배려석 #핑크카펫 #지하철 #서울지하철 #shorts", "분홍 자리, 비워 두시나요? 🚇"),
 "hanban1": ("백두산 폭발하면 화산재는 어디로 갈까? ㄷㄷ", "서기 946년 말, 백두산은 지난 2천 년 사이 가장 큰 분화 중 하나를 일으켰고, 그 화산재는 바다 건너 일본까지 날아가 쌓였습니다(Oppenheimer et al. 2017). 2002~2005년 무렵 백두산 아래 미소지진이 급증하고 땅이 부풀었고, 지금은 기상청이 Landsat·Sentinel-1 위성으로 지표 온도와 변위를 정기적으로 분석합니다. 언제 분화할지는 아직 아무도 예측하지 못합니다. ※ 분화 장면은 다른 화산(세인트헬렌스·킬라우에아·피나투보·통가)의 참고 영상입니다.\n출처: 기상청 화산 분석, Oppenheimer et al. 2017 Quaternary Science Reviews, NASA Earth Observatory, Liu et al. 2020 Frontiers in Earth Science", "#백두산 #화산 #천지 #지구과학 #shorts", "백두산 천지, 직접 가 보신 분 있나요? 🌋"),
 "hanban2": ("태풍이 한국 앞에서 휙 꺾이는 진짜 이유?", "태풍은 북태평양고기압을 뚫지 못하고 가장자리를 따라 돌다가, 편서풍을 만나면 북동쪽으로 꺾입니다(전향). 2022년 힌남노는 오키나와 남쪽에서 이틀간 거의 멈췄다가(시속 2~5km) 전향 뒤 빨라져, 동해로 빠질 땐 시속 98km였습니다. 2026년 6월 태풍 장미도 오키나와 부근에서 전향해 우리나라 육상에는 영향이 없었습니다. ※ 우주에서 본 허리케인 장면은 참고 영상입니다.\n출처: 기상청 2022 태풍 분석보고서, 2011 태풍분석보고서, 기상청 보도자료(2026.6.2), NOAA AOML Hurricane FAQ, NASA Earth Observatory", "#태풍 #힌남노 #날씨 #기상청 #shorts", "힌남노 때 우리 동네는 어땠나요? 🌀"),
 "hanban3": ("가을 하늘이 유독 높고 파란 진짜 이유", "하늘이 파란 건 파란빛이 공기에 더 잘 흩어지기 때문(레일리 산란). 먼지와 수증기가 많으면 하늘이 희뿌예지는데, 가을엔 건조한 이동성 고기압이 자주 찾아와 공기가 맑아집니다. 2025년 서울 초미세먼지 평균은 봄 24㎍/㎥, 가을 13㎍/㎥. 위성사진: 2023년 4월 12일 황사 날 vs 2025년 10월 28일.\n출처: 기상청 보도자료(2010.10.1)·3개월 전망, 서울시 대기환경정보 계절별 평균, NASA Space Place, 미국 기상청 구름 분류", "#가을하늘 #미세먼지 #날씨 #과학 #shorts", "오늘 여러분 동네 하늘은 몇 점인가요? ☁️"),
 "hanban4": ("한국에서 오로라가 찍힌 날 생긴 일 ㄷㄷ", "2024년 5월, 2003년 이후 처음으로 최고 등급(G5) 지자기 폭풍이 지구를 덮쳤습니다. 이때 경북 영천 보현산천문대의 전천카메라에 붉은 오로라가 잡혔고(한국천문연구원), 5월 12일 새벽 강원 화천에서도 아마추어 천문가들이 촬영에 성공했습니다. 다만 눈으로는 거의 보이지 않았고 장노출 카메라에만 찍혔습니다. ※ 영상 속 오로라는 같은 폭풍 때 미국 유타·아이다호에서 NASA가 촬영한 것입니다.\n출처: 한국천문연구원 참고자료(2024.5.13), NOAA SWPC, USGS 지자기 프로그램, NASA", "#오로라 #태양폭풍 #보현산천문대 #우주 #shorts", "한국에서 오로라, 직접 보고 싶나요? 🌌"),
 "why1": ("한반도에 반달곰이 다시 돌아온 진짜 이유 🐻", "2004년 러시아에서 들여온 반달가슴곰 6마리를 지리산에 풀어 준 복원사업이 시작이었습니다(환경부·국립공원공단). 목표는 오래 버틸 수 있는 최소 무리인 50마리. 2022년엔 4세대 새끼까지 태어났고, 국립공원공단은 지금 야생 반달가슴곰을 약 96마리로 추정합니다(2026.7). 김천 수도산까지 간 'KM-53 오삼이'도 있었죠. 2015~2025년 위치 기록 약 3만 건 중 곰이 탐방로 10m 안에 머문 건 0.44%. 지리산에선 꼭 정해진 탐방로로만 다니세요. ※ 곰 영상은 동물원의 반달가슴곰, 산 영상은 참고 영상입니다.\n출처: 국립공원공단 발표(한국경제·경기일보 2026.7.2, 세계일보 2026.5), 환경부 발표(데일리벳 2022.6.2), 서울신문·경기일보(KM-53)", "#반달가슴곰 #지리산 #국립공원 #멸종위기 #shorts", "지리산 갔다가 반달곰 흔적 본 적 있나요? 🐾"),
 "why2": ("문어 심장이 3개인 진짜 이유 ㄷㄷ", "문어는 아가미로 피를 보내는 심장 2개와 온몸으로 보내는 심장 1개, 모두 3개의 심장이 있습니다. 피는 구리가 든 헤모시아닌 때문에 파랗고, 산소를 덜 실어 나르기 때문에 더 센 압력으로 돌려야 하죠. 헤엄칠 땐 온몸 심장이 멈춘다는 연구도 있어서(Wells et al. 1987), 문어는 주로 바닥을 기어 다닙니다. 우리가 먹는 문어는 대문어(최대 약 3m·50kg 이상)와 참문어(돌문어).\n출처: Wells et al. 1987 J. Exp. Biol. 131:175, BBC Science Focus, Live Science, 국립수산과학원 연구자 칼럼(뉴스토마토 2016)", "#문어 #문어심장 #바다생물 #과학상식 #shorts", "문어 숙회 vs 문어 라면, 여러분 픽은? 🐙"),
 "why3": ("철원에 두루미 떼가 해마다 오는 진짜 이유 ㄷㄷ", "2025년 11월 29일 철원군 조사에서 두루미류 11,640마리(재두루미 10,002, 두루미 1,567 등 5종)가 확인됐습니다. 역대 최대 기록이에요. 두루미는 천연기념물이자 멸종위기 야생생물 Ⅰ급, 전 세계에 수천 마리뿐인 새입니다. 철원에 오는 이유는 사람이 거의 안 들어오는 민통선 들판, 논에 남겨 둔 볏짚과 뿌려 주는 곡식, 그리고 겨울에도 얼지 않는 샘통과 물 댄 논이라는 잠자리. ※ 두루미 영상은 참고 영상(국외 촬영)입니다.\n출처: 강원도민일보 2025.12.14(철원군 조사), 뉴스펭귄(철원 두루미 운영협의체), International Crane Foundation, BirdLife International", "#두루미 #철원 #철새 #멸종위기 #shorts", "겨울 철원 두루미, 직접 보신 분 있나요? 🕊️"),
 "why4": ("까치가 한국에선 길조, 영국에선 흉조인 진짜 이유?", "까치는 1964년 한 신문의 '나라새 뽑기'에서 나라새로 뽑혔습니다(정식 국조로 지정된 적은 없음). 아침에 까치가 울면 반가운 손님이 온다고 했고, 칠월칠석엔 견우와 직녀를 잇는 오작교를 놓는 새였죠. 반면 영국 동요 'One for sorrow'처럼 까치 한 마리를 불길하게 보는 미신도 있습니다. 까치는 거울 속 자신을 알아보고(2008) 사람 얼굴도 기억하지만(2011, 서울대 연구), 전기 설비 피해 때문에 2000년부터 유해 야생동물로 지정돼 있습니다.\n출처: 한국민족문화대백과사전 '까치', Prior et al. 2008 PLoS Biology, Lee et al. 2011 Animal Cognition, 환경부 자료(KED Global 2023, 전북일보 2025)", "#까치 #길조 #새 #동물상식 #shorts", "여러분 동네 까치는 길조인가요, 해조인가요? 🐦"),
}

def credits(sid):
    """credit line for the description, from the sources the short really uses"""
    px, other = [], []
    for k, r in SRC[sid].items():
        lic = (r.get("license") or "")
        if lic.startswith("Pexels"): px.append(r["label"].split(" by ")[1].replace(" (Pexels License)", ""))
        elif lic == "our own drawing": other.append("그림: 직접 그림")
        else: other.append(f"{r['label']} — {lic.split(';')[0]}")
    out = []
    if px: out.append("영상·사진: Pexels (" + ", ".join(dict.fromkeys(px)) + ")")
    if other: out.append("자료: " + " / ".join(dict.fromkeys(other)))
    return " · ".join(out)

def main():
    p = print
    sc = {i: json.load(open(f"{HERE}/out/review/{i}/scorecard.json")) for i in IDS if os.path.exists(f"{HERE}/out/review/{i}/scorecard.json")}
    scripts = {i: json.load(open(f"{HERE}/shorts/{i}/script.json")) for i in IDS}
    edits = {i: json.load(open(f"{HERE}/shorts/{i}/edit.json")) for i in IDS}
    p(open(f"{HERE}/media/info2/README_head.md").read().rstrip("\n"))
    for i in IDS:
        title = " / ".join(t.replace("[", "").replace("]", "") for t in scripts[i]["title"])
        p(f"| `{i}` | {title} | {scripts[i]['lines'][0]['say'].replace('|', '')} | {MNAME.get(os.path.basename(edits[i]['music']['file']))} |")
    p("")
    p("### 벤치마크 점수표\n")
    p(f"목표(`research/benchmark-targets-footage.json` → `info_reason`): 길이 {T['length_s']}초(레시피 28–40), 훅 끝 ≤{T['hook_end_s']}초, 첫 컷 {T['first_cut_s']}초, "
      f"평균 샷 {T['shot_mean_s']}초(레시피 2.0–2.5), 최장 샷 ≤{T['shot_max_s']}초, {T['syl_per_s']}음절/초, {T['lines']}문장(레시피 12–15), 제목 줄당 {T['title_chars_per_line']}자(레시피 9–13).\n")
    p("우리 값은 `final/<id>.mp4`(ffprobe, qa_review.py 장면 감지)와 `build/<id>/timeline.json`(voice_edge.py)에서 `python3 media/info2/scorecard.py <id>`로 쟀습니다. "
      "음절/초는 '전체'(음절 ÷ 영상 길이)와 '발화'(음절 ÷ 줄들의 소리 길이, 줄 안 쉼 포함). 문장 수는 대본의 마침표·물음표 수.\n")
    p("| id | 화면 제목 | 길이 | 훅 끝 | 첫 컷 | 평균 샷 | 최장 샷 | 음절/초 전체 · 발화 | 문장 | 제목 글자/줄 | 벗어난 점 |")
    p("|---|---|---|---|---|---|---|---|---|---|---|")
    for i in IDS:
        c = sc.get(i)
        if not c: p(f"| {i} | – | (아직 없음) |||||||||"); continue
        miss = []
        if not 28 <= c["len"] <= 40: miss.append(f"길이 {c['len']}초")
        if c["hook"] > 2.0: miss.append(f"훅 {c['hook']}초")
        if c["max"] > 3.5: miss.append(f"최장 샷 {c['max']}초")
        if c["lines"] < 12: miss.append(f"문장 {c['lines']}개")
        if max(c["title"]) > 13: miss.append("제목 줄 13자 초과")
        title = " / ".join(t.replace("[", "").replace("]", "") for t in scripts[i]["title"])
        p(f"| `{i}` | {title} | {c['len']} | {c['hook']} | {c['cut']} | {c['mean']} | {c['max']} | {c['sps']} · {c['speech']} | {c['lines']} | {'+'.join(map(str, c['title']))} | {', '.join(miss) or '없음'} |")
    p("\n" + open(f"{HERE}/media/info2/README_misses.md").read())
    p("### 영상·사진 출처와 라이선스\n")
    p("파일마다 페이지·파일 주소·라이선스·제작자·쓴 구간은 `media/info2/sources.json`(이 표의 원본)과 각 `edit.json`의 `sources`에 있습니다. "
      "Pexels 항목은 하나씩 페이지를 열어 License \"Free\"(Pexels License)를 확인했습니다(2026-10-10). 화면에는 출처 배지를 두지 않고, 아래 업로드 문구의 설명란에 모두 적습니다.\n")
    for i in IDS:
        p(f"**{i}**")
        for k, r in SRC[i].items():
            p(f"- [{r['label'] or r['file']}]({r['page']}) — {r['license']}; {', '.join(r['used'])}")
        p("")
    p(open(f"{HERE}/media/info2/README_facts.md").read())
    p("### 업로드 문구\n")
    p("화면 글자에는 저작권·라이선스 표시가 없고, 모든 크레딧은 설명란에 있습니다. 창작(허구) 에피소드는 없습니다(모두 사실 해설).\n")
    for i in IDS:
        t, desc, tags, pin = UP[i]
        p(f"**{i}** — {t}")
        for ln in desc.split("\n"): p(f"> {ln}")
        p(f"> {credits(i)}")
        if any(r.get('license', '').startswith(('Public domain', 'PD', 'US federal', 'Public Domain')) or 'NASA' in (r.get('label') or '') for r in SRC[i].values()):
            p("> NASA·NOAA·USGS 등 미국 정부 기관은 이 영상을 보증하지 않습니다.")
        p(f"> {MUSIC(MNAME.get(os.path.basename(edits[i]['music']['file']), edits[i]['music']['file']))}")
        p(f"> {tags}")
        p(f">\n> 고정 댓글: {pin}\n")

if __name__ == "__main__":
    main()
