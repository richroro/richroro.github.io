"""Re-make retro1~retro8 in the 그 시절 레트로 v2 layout (benchmark-footage.md §2): one-off script, kept for the record.

usage: python3 media/retro/v2_remake.py          (run from shorts/viral5; rewrites shorts/retroN/script.json and edit.json)
- edit.json: "frame": "retrobox", "look": "retro2" (src/lib/RetroV2.tsx), no on-screen footnote stickers, no captionY
- script.json: the provocative two-line title, Edge TTS rate +25%, 0.06 s gaps, a shorter first phrase, and the lines
  below dropped to bring each short toward 28~32 s (their clips go with them; the remaining clips keep their photos)
"""
import json, os
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V2 = {
 "retro1": {"title": ["요즘 키즈카페 반성해라", "그 시절 골목 놀이 모습"], "drop": [],
            "say": {"gone": ("산업화로| 이런 놀이는 하나둘 사라졌어요.", ["산업화로", "하나둘 [사라진 놀이]"])}},
 "retro2": {"title": ["세탁기 없어도 끄떡없던", "그 시절 빨래터 모습"], "drop": ["under", "still"]},
 "retro3": {"title": ["트럭 없어도 다 날랐다", "그 시절 지게꾼 모습"], "drop": ["big", "rest"]},
 "retro4": {"title": ["요즘 정류장 반성해라", "그 시절 버스 정류장"], "drop": [],
            "say": {"hook": ("1968년 종로.| 한복에 양산 쓰고 버스를 기다려요.", ["1968년 [종로]", "[한복에 양산] 쓰고"])}},
 "retro5": {"title": ["요즘 대형마트 반성해라", "그 시절 시장 구경 모습"], "drop": ["veg", "night"],
            "say": {"hook": ("1966년 부산.| 엄마 손 잡고 장 보러 가면 딱 이랬죠.", ["1966년 [부산]", "엄마 손 잡고 [장 보러]"])}},
 "retro6": {"title": ["편의점 없어도 행복했다", "그 시절 길거리 간식"], "drop": ["donut", "bun2"]},
 "retro7": {"title": ["고속열차보다 낭만 있던", "그 시절 기차역 모습"], "drop": ["seoul2", "window"]},
 "retro8": {"title": ["의자 없이 땅바닥 입학식", "그 시절 국민학교 실태"], "drop": ["girls", "stone"],
            "say": {"hook": ("의자도 없이 땅바닥에.| 1952년 입학식이에요.", ["의자도 없이 [땅바닥]", "1952년 [입학식]"])}},
}
for sid, v in V2.items():
    sp, ep = f"{HERE}/shorts/{sid}/script.json", f"{HERE}/shorts/{sid}/edit.json"
    s, e = json.load(open(sp)), json.load(open(ep))
    if e.get("look") == "retro2": print(sid, "already v2"); continue
    s["title"] = v["title"]; s["voices"]["nar"]["rate"] = "+25%"
    s["lines"] = [L for L in s["lines"] if L["id"] not in v["drop"]]
    for L in s["lines"][1:]: L["gap"] = 0.06
    for lid, (say, cap) in v.get("say", {}).items():
        L = next(L for L in s["lines"] if L["id"] == lid); L["say"], L["cap"] = say, cap
    lid = lambda a: a.split(".")[0].split("@")[0].split("+")[0].split("-")[0]
    e["clips"] = [c for c in e["clips"] if lid(c["from"]) not in v["drop"]]
    used = {c["src"] for c in e["clips"]}
    e["sources"] = {k: x for k, x in e["sources"].items() if k in used}
    e["frame"], e["look"], e["stickers"] = "retrobox", "retro2", []
    e.pop("captionY", None)
    e["sfx"] = [x for x in e["sfx"] if lid(x[0]) not in v["drop"]]
    json.dump(s, open(sp, "w"), ensure_ascii=False, indent=1); json.dump(e, open(ep, "w"), ensure_ascii=False, indent=1)
    print(sid, len(s["lines"]), "lines,", len(e["clips"]), "clips,", len(e["sources"]), "photos")
