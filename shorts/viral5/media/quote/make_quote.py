"""Build a voiceless "famous person's real words" card short (quote1~) from media/<id>/quote.json: beats of a photo
(PD/CC0/CC BY only, fetched by fetch_commons.py), our own typographic panel, or the verified quote, each with one
caption line under the picture. Writes shorts/<id>/edit.json, script.json and the empty voice timeline
build/<id>/timeline.json, so `python3 prep.py <id> && ./render.sh <id>` renders it with src/lib/Quote.tsx.
usage: python3 media/quote/make_quote.py <id>

quote.json: {"title": [l1, l2], "music", "gain"?, "musicStart"?, "badge"?, "box"?, "sources": {key: {file, label, url, licence, author}},
             "beats": [{"dur", "src"? | "panel"? | "quote"?, "zoom"?, "focus"?, "ko", "en"?, "sfx"?: [[dt, name, gain]]}]}
"""
import json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BADGE = {"name": "오늘의 한마디", "icon": "말", "color": "#c2410c"}  # temporary channel name (UPLOAD_PLAN.md)
sid = sys.argv[1]
spec = json.load(open(f"{HERE}/media/{sid}/quote.json"))
items, clips, sfx, t = [], [], [], 0.0
for b in spec["beats"]:
    it = {"at": round(t, 3), "ko": b["ko"]}
    for k in ("en", "panel", "quote"):
        if b.get(k): it[k] = b[k]
    items.append(it)
    c = {"from": round(t, 3), "zoom": b.get("zoom", [1.0, 1.07]), "focus": b.get("focus", "50% 40%")}
    if b.get("src"): c.update(src=b["src"], **{"in": 0})
    clips.append(c)
    # a soft pop on every cut, a brighter one when the quote comes in
    sfx += [[round(t + dt, 3), n, g] for dt, n, g in b.get("sfx", [[0.0, "pop_hi" if b.get("quote") else "pop", 0.25]] if t else [])]
    t += b["dur"]
end = round(t, 3)
card = {"items": items, "badge": spec.get("badge", BADGE), "box": spec.get("box", {"height": 900}), "clipAudio": 0}
edit = {"credit": "", "layout": "card", "card": card, "sources": spec["sources"], "clips": clips,
        "music": {"file": f"music/{spec['music']}.mp3", "gain": spec.get("gain", 0.6), "start": spec.get("musicStart", 0.0)}, "sfx": sfx}
os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True); os.makedirs(f"{HERE}/build/{sid}", exist_ok=True)
json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
json.dump({"title": spec["title"], "voices": {}, "tail": end, "lines": [],
           "note": "voiceless famous-person story card with a verified quote (src/lib/Quote.tsx); built from media/%s/quote.json by media/quote/make_quote.py" % sid},
          open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
json.dump({"lines": [], "end": end}, open(f"{HERE}/build/{sid}/timeline.json", "w"))
print(f"{sid}: {len(items)} beats, {end}s")
