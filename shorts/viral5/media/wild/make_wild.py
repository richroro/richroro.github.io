"""Build a voiceless white-card animal story short (wild1~) from media/<id>/wild.json: one real clip (one source's
continuous footage) cut into beats, each beat a clip window plus one story caption under the picture and an optional
corner counter ("tag"). Writes shorts/<id>/edit.json, script.json and the empty voice timeline build/<id>/timeline.json,
so `python3 prep.py <id> && ./render.sh <id>` renders it with src/lib/Card.tsx.
usage: python3 media/wild/make_wild.py <id>

wild.json: {"title": [l1, l2], "credit", "music", "gain", "clipAudio", "box", "sources": {key: {file, label, url}},
            "beats": [{"dur", "src", "in", "speed"?, "zoom"?, "focus"?, "audio"?, "ko", "en"?, "tag"?, "sfx"?: [[dt, name, gain]]}]}
"""
import json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BADGE = {"name": "오늘의 동물 일기", "icon": "동", "color": "#2e7d32"}  # temporary channel name (UPLOAD_PLAN.md)
sid = sys.argv[1]
spec = json.load(open(f"{HERE}/media/{sid}/wild.json"))
items, clips, sfx, t = [], [], [], 0.0
for b in spec["beats"]:
    it = {"at": round(t, 3), "ko": b["ko"]}
    for k in ("en", "tag"):
        if b.get(k): it[k] = b[k]
    items.append(it)
    c = {"src": b.get("src", next(iter(spec["sources"]))), "from": round(t, 3), "in": b["in"], "zoom": b.get("zoom", [1.0, 1.06]), "focus": b.get("focus", "50% 50%")}
    for k in ("speed", "audio"):
        if b.get(k) is not None: c[k] = b[k]
    clips.append(c)
    sfx += [[round(t + dt, 3), n, g] for dt, n, g in b.get("sfx", [[0.0, "pop", 0.3]] if t else [])]
    t += b["dur"]
end = round(t, 3)
card = {"items": items, "credit": spec["credit"], "badge": spec.get("badge", BADGE), "box": spec.get("box", {"height": 1000}), "clipAudio": spec.get("clipAudio", 0)}
edit = {"credit": spec["credit"], "layout": "card", "card": card, "sources": spec["sources"], "clips": clips,
        "music": {"file": f"music/{spec['music']}.mp3", "gain": spec.get("gain", 0.6), "start": spec.get("musicStart", 0.0)}, "sfx": sfx}
os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True); os.makedirs(f"{HERE}/build/{sid}", exist_ok=True)
json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
json.dump({"title": spec["title"], "voices": {}, "tail": end, "lines": [],
           "note": spec.get("note", "voiceless white-card animal story (src/lib/Card.tsx, one clip, story captions)") + "; built from media/%s/wild.json by media/wild/make_wild.py" % sid},
          open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
json.dump({"lines": [], "end": end}, open(f"{HERE}/build/{sid}/timeline.json", "w"))
print(f"{sid}: {len(items)} beats, {end}s")
