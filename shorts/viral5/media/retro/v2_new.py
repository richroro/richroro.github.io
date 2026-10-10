"""Write script.json and edit.json for the new 그 시절 레트로 v2 episodes (retro9~retro12, 1980~90s photos).

usage: python3 media/retro/v2_new.py        (run from shorts/viral5, after media/retro/fetch_commons.py)
Each episode is a list of lines: (id, say, cap, clips), a clip being (photo key, anchor, crop or None). Photo metadata
(page, file, licence, author, date) comes from the sidecar media/retro/<id>.json that fetch_commons.py filled in.
"""
import json, os

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
YEAR = {"line2open": "1983", "testrun": "1983", "idae": "1984", "guro": "1984", "circle": "1984", "gates": "1987",
        "grandpark": "1984", "bunsik": "1989", "seongbuk": "1981", "yeongdo": "1989", "namsan": "1984",
        "gwanghwa80": "1980", "sungnye": "1984", "market": "1983", "terminal": "1985", "gwanghwa93": "1993", "jagalchi": "1995"}
EP = {
 "retro9": {"title": ["요즘 출근길 반성해라", "80년대 지하철 모습"], "music": "Heartwarming", "lines": [
  ("hook", "1983년.| 지하철 열차에 꽃이 달렸어요.", ["[1983년]", "열차에 [꽃]이?"], [("line2open", "hook", None), ("line2open", "hook+1.4", [0.3, 0.62, 1.7])]),
  ("open", "12월, 2호선 새 구간이| 개통한 날이에요.", ["12월 2호선 새 구간", "[개통]한 날"], [("line2open", "open", [0.62, 0.3, 1.8])]),
  ("test", "개통 전엔| 노선도를 펴 놓고 시운전도 했죠.", ["개통 전 [시운전]", "열차 안 [노선도]"], [("testrun", "test", [0.22, 0.25, 2.0])]),
  ("idae", "1984년 이대역.| 초록 타일 터널이에요.", ["1984년 [이대역]", "초록 [타일 터널]"], [("idae", "idae", None), ("idae", "idae.초록", [0.8, 0.42, 1.8])]),
  ("guro", "구로공단역은| 지금 구로디지털단지역이죠.", ["[구로공단역]", "지금은 [구로디지털단지]"], [("guro", "guro", None)]),
  ("full", "그해 5월,| 2호선 48.8킬로미터가 다 이어졌어요.", ["1984년 5월", "[48.8km] 다 이어져"], [("circle", "full", None)]),
  ("crowd", "하루 230만 명이| 지하철을 탔대요.", ["하루 [230만 명]", "지하철로 출근"], [("circle", "crowd", [0.76, 0.55, 1.7])]),
  ("gates", "1986년부터는| 표를 넣는 자동 개찰구가 생겼고요.", ["1986년부터", "[자동 개찰구]"], [("gates", "gates", [0.62, 0.74, 2.3])]),
  ("now", "지금은 카드 한 번이면 삑!", ["지금은 카드 [삑!]"], [("circle", "now", [0.3, 0.45, 1.8])]),
  ("end", "이 시절 2호선,| 기억나는 분?", ["이 시절 [2호선]", "[기억나는 분]?"], [("line2open", "end", [0.3, 0.62, 1.4])]),
 ]},
 "retro10": {"title": ["요즘 놀이공원 반성해라", "80년대 나들이 모습"], "music": "Heartwarming", "lines": [
  ("hook", "1984년.| 이 인파 좀 보세요.", ["[1984년]", "이 [인파] 좀 봐"], [("grandpark", "hook", None), ("grandpark", "hook+1.4", [0.3, 0.55, 1.5])]),
  ("open", "5월 1일,| 서울대공원이 문 연 날이에요.", ["[5월 1일]", "[서울대공원] 개원"], [("grandpark", "open", [0.36, 0.17, 2.2])]),
  ("build", "공사만| 5년 7개월 걸렸대요.", ["공사만", "[5년 7개월]"], [("grandpark", "build", [0.86, 0.45, 1.8])]),
  ("tram", "코끼리 얼굴 단 열차에| 올라타면 신이 났죠.", ["[코끼리] 열차", "올라타면 [신나고]"], [("grandpark", "tram", [0.68, 0.6, 1.9])]),
  ("kids", "모자 쓴 꼬마도,| 엄마 아빠도 다 나왔어요.", ["모자 쓴 [꼬마]도", "[엄마 아빠]도"], [("grandpark", "kids", [0.22, 0.62, 1.8])]),
  ("queue", "열차 한 번 타려면| 한참 기다렸겠죠?", ["열차 한 번 타려면", "[한참] 기다려야"], [("grandpark", "queue", [0.5, 0.35, 1.7])]),
  ("snack", "돌아오는 길엔 분식집.| 1989년 서울이에요.", ["돌아오는 길 [분식집]", "1989년 서울"], [("bunsik", "snack", [0.5, 0.42, 1.25])]),
  ("food", "튀김, 김밥, 만두가| 수북하게 쌓였죠.", ["[튀김] [김밥] [만두]", "수북하게"], [("bunsik", "food", [0.58, 0.47, 1.9])]),
  ("menu", "국밥에 김치찌개까지.", ["국밥에 [김치찌개]까지"], [("bunsik", "menu", [0.5, 0.12, 1.7])]),
  ("now", "예약도 없이| 그냥 가면 되던 그 시절.", ["[예약]도 없이", "그냥 가면 되던 시절"], [("grandpark", "now", [0.5, 0.5, 1.3])]),
  ("end", "이 시절 나들이,| 기억나는 분?", ["이 시절 [나들이]", "[기억나는 분]?"], [("grandpark", "end", [0.68, 0.6, 1.5])]),
 ]},
 "retro11": {"title": ["엘리베이터 없어도 살았다", "80년대 산동네 실태"], "music": "Gymnopedie No 1", "lines": [
  ("hook", "1981년.| 서울 성북구 산이 집으로 덮였어요.", ["[1981년]", "성북구 산이 [집으로]"], [("seongbuk", "hook", None), ("seongbuk", "hook+1.4", [0.6, 0.45, 1.5])]),
  ("roof", "지붕 위에 지붕,| 집 위에 또 집.", ["지붕 위에 [지붕]", "집 위에 [또 집]"], [("seongbuk", "roof", [0.5, 0.42, 1.8])]),
  ("dense", "빈틈없이| 다닥다닥 붙어 있죠.", ["빈틈없이", "[다닥다닥]"], [("seongbuk", "dense", [0.28, 0.72, 2.0])]),
  ("hill", "꼭대기 집에 가려면| 언덕부터 올라야 했고요.", ["꼭대기 집까지", "[언덕]부터"], [("seongbuk", "hill", [0.42, 0.22, 1.9])]),
  ("busan", "부산도 마찬가지.| 1989년 영도예요.", ["부산도 [마찬가지]", "1989년 영도"], [("yeongdo", "busan", None)]),
  ("slope", "바다 앞| 산비탈까지 집이 빼곡해요.", ["바다 앞 [산비탈]까지", "집이 [빼곡]"], [("yeongdo", "slope", [0.45, 0.42, 1.8])]),
  ("port", "그 아래 항구엔| 배들이 줄지어 섰죠.", ["그 아래 [항구]", "배들이 줄지어"], [("yeongdo", "port", [0.5, 0.85, 1.8])]),
  ("seoul", "같은 시절 서울 도심,| 1984년 남산에서 본 모습이에요.", ["1984년 [남산]에서", "본 서울 도심"], [("namsan", "seoul", None)]),
  ("tower", "빌딩이| 하나둘 솟고 있었죠.", ["빌딩이", "[하나둘] 솟고"], [("namsan", "tower", [0.5, 0.5, 2.0])]),
  ("now", "지금은 엘리베이터로| 집에 올라가지만,", ["지금은 [엘리베이터]로", "집에 올라가지만"], [("seongbuk", "now", [0.7, 0.5, 1.6])]),
  ("end", "이 시절 산동네,| 기억나는 분?", ["이 시절 [산동네]", "[기억나는 분]?"], [("seongbuk", "end", [0.5, 0.5, 1.2])]),
 ]},
 "retro12": {"title": ["빌딩숲 없어도 북적였다", "80년대 시내 모습"], "music": "Gymnopedie No 2", "lines": [
  ("hook", "1980년.| 광화문 뒤로 중앙청이 보이죠.", ["[1980년]", "광화문 뒤 [중앙청]"], [("gwanghwa80", "hook", None), ("gwanghwa80", "hook+1.4", [0.75, 0.4, 1.6])]),
  ("gate", "그 앞 큰길엔| 차들이 오갔고요.", ["그 앞 [큰길]엔", "차들이 오가고"], [("gwanghwa80", "gate", [0.5, 0.75, 1.7])]),
  ("sungnye", "1984년 숭례문 일대,| 빌딩이 쑥쑥 올라가요.", ["1984년 [숭례문]", "빌딩이 [쑥쑥]"], [("sungnye", "sungnye", None)]),
  ("hall", "그 위로| 시청과 호텔이 보이죠.", ["그 위로", "[시청]과 호텔"], [("sungnye", "hall", [0.62, 0.22, 1.8])]),
  ("market", "1983년 연말 남대문시장,| 털옷이 주렁주렁.", ["1983년 [남대문시장]", "털옷이 [주렁주렁]"], [("market", "market", [0.86, 0.5, 2.2])]),
  ("terminal", "1985년엔 상봉터미널이| 새로 지어졌어요.", ["1985년 [상봉터미널]", "새로 [준공]"], [("terminal", "terminal", None)]),
  ("busan", "1995년 부산 자갈치시장,| 물가에 좌판이 쭉.", ["1995년 [자갈치시장]", "물가에 [좌판]"], [("jagalchi", "busan", None)]),
  ("basket", "커다란 통과 소쿠리가| 줄지어 섰죠.", ["커다란 [통]과 [소쿠리]", "줄지어 쭉"], [("jagalchi", "basket", [0.15, 0.62, 1.8])]),
  ("gate93", "1993년 광화문 앞은| 차가 드문드문.", ["1993년 [광화문]", "차가 [드문드문]"], [("gwanghwa93", "gate93", None)]),
  ("now", "지금 보면| 낯설 만큼 한산하죠.", ["지금 보면", "[낯설 만큼] 한산"], [("gwanghwa93", "now", [0.5, 0.75, 1.6])]),
  ("end", "이 시절 시내 풍경,| 기억나는 분?", ["이 시절 [시내 풍경]", "[기억나는 분]?"], [("gwanghwa80", "end", [0.5, 0.5, 1.3])]),
 ]},
}
for sid, ep in EP.items():
    side = json.load(open(f"{HERE}/media/retro/{sid}.json"))
    photos = {p["key"]: p for p in side["photos"]}
    lines = [{"id": lid, "voice": "nar", **({"gap": 0.06} if i else {}), "say": say, "cap": cap} for i, (lid, say, cap, _) in enumerate(ep["lines"])]
    script = {"title": ep["title"], "voices": {"nar": {"edge": "ko-KR-SunHiNeural", "rate": "+25%"}}, "lines": lines, "tail": 0.5}
    clips, used = [], []
    for lid, _, _, cl in ep["lines"]:
        for key, anchor, crop in cl:
            p = photos[key]; used.append(key)
            c = {"src": key, "from": anchor, "label": p["title"][5:].rsplit(".", 1)[0], "year": YEAR[key], "zoom": [1.0, 1.06], "audio": 0}
            if crop: c["crop"] = crop
            clips.append(c)
    sources = {}
    for key in dict.fromkeys(used):
        p = photos[key]; assert p.get("ok"), (sid, key, p.get("licence"))
        sources[key] = {"file": f"{key}.jpg", "label": f"{p['title'][5:]} ({p['author']}, Wikimedia Commons, {p['licence']})", "url": p["page_url"],
                        "file_url": p["file_url"], "creator": p["author"], "source": p["source"], "license": p["licence"], "year": YEAR[key], "seconds": []}
    edit = {"titleStyle": "band", "frame": "retrobox", "look": "retro2", "grain": 0.12, "credit": "", "sources": sources, "clips": clips,
            "stickers": [], "sfx": [["end", "ding", 0.25]], "punches": [], "flashes": [],
            "music": {"file": f"music/{ep['music']}.mp3", "gain": 0.22, "start": 0}}
    os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True)
    json.dump(script, open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    print(sid, len(lines), "lines,", len(clips), "clips,", len(sources), "photos")
