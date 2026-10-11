"""Write a white-card short (src/lib/Card.tsx) from one compact spec: shorts/<id>/script.json, shorts/<id>/edit.json
and the empty voice timeline build/<id>/timeline.json, so `python3 prep.py <id> && ./render.sh <id>` renders it.
usage: python3 media/cards/make_card.py media/<id>/card.json
spec: {"id", "title": [2 lines], "step": seconds per item, "music", "sfx": "pop"|"whoosh", "credit", "items": [
       {"src": key in media/<id>/sources.json, "ko", "en", "focus": "x% y%", "zoom": [a, b], "ring": {...}, "in": s,
        "dur": s (this item only), "doodle": name (drawn first, no src)}]}"""
import json, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = json.load(open(sys.argv[1])); sid = spec["id"]
srcs = {s["key"]: s for s in json.load(open(f"{HERE}/media/{sid}/sources.json"))}
t, items, clips, sfx, used = 0.0, [], [], [], {}
for k, it in enumerate(spec["items"]):
    item = {"at": round(t, 2), "ko": it["ko"]}
    for f in ("en", "ring", "doodle"):
        if f in it: item[f] = it[f]
    items.append(item)
    if it.get("src"):
        c = {"src": it["src"], "from": round(t, 2), "zoom": it.get("zoom", [1.0, 1.08]), "focus": it.get("focus", "50% 50%")}
        if "in" in it: c["in"] = it["in"]
        clips.append(c); used[it["src"]] = srcs[it["src"]]
    if k: sfx.append([round(t, 2), spec.get("sfx", "pop"), spec.get("sfx_gain", 0.4)])
    t += it.get("dur", spec["step"])
end = round(t, 2)
for e in spec.get("extra_sfx", []): sfx.append(e)
edit = {"credit": spec["credit"], "layout": "card",
        "card": {"items": items, "credit": spec["credit"], "badge": {"name": "세상 신기한 도감", "icon": "도", "color": "#1d4e89"}},
        "sources": {k: {"file": s["file"], "label": (s.get("title") or s.get("caption") or k)[:160], "url": s["page"], "credit": spec["credit"]} for k, s in used.items()},
        "clips": clips, "music": {"file": f"music/{spec['music']}.mp3", "gain": spec.get("music_gain", 0.6), "start": 0.0}, "sfx": sorted(sfx)}
os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True); os.makedirs(f"{HERE}/build/{sid}", exist_ok=True)
json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
json.dump({"title": spec["title"], "voices": {}, "tail": end, "lines": [], "note": "wordless white-card short (src/lib/Card.tsx); built from media/%s/card.json by media/cards/make_card.py" % sid},
          open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
json.dump({"lines": [], "end": end}, open(f"{HERE}/build/{sid}/timeline.json", "w"))
print(sid, "end", end, "items", len(items))
