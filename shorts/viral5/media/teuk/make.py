"""Write shorts/<id>/script.json and edit.json for the "○○ 특" v2 shorts (teuk1-teuk14, layout "teuk", src/lib/Teuk.tsx).

usage: python3 media/teuk/make.py [<id> ...]        (default: all fourteen)
The recipe is research/benchmark-drawn.md §3 (targets.teuk in benchmark-targets-drawn.json): a one-line title "○○ 특",
no title read, the first item from frame 0 on the strongest reaction picture, about 8 observational items in two-line
captions, a different picture on every line (mascot close-up, photo, drawn scene), about half as many reaction bubbles
as v1, narration fast enough for about 6.5 syllables a second, about 28 s. Photos come from media/teuk/photos.json
(Wikimedia Commons, CC0 / public domain / CC BY only), fetched by media/teuk/fetch.py into public/<id>/src/.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from episodes import EPISODES
from make_lib import ME

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PHOTOS = json.load(open(f"{HERE}/photos.json"))

def build(sid, ep):
    sdir = f"{ROOT}/shorts/{sid}"; os.makedirs(sdir, exist_ok=True)
    nv, nr = ep["nar"]; mv, mr, mp = ep["me"]
    script = {"title": [ep["title"]], "voices": {"nar": {"edge": nv, "rate": nr}, "me": {"edge": mv, "rate": mr, "pitch": mp}}, "tail": 0.9, "lines": []}
    clips, sfx, sources = [], [], {}
    def pic(frm, g, label):
        g = dict(g); c = {"from": frm, "label": label}
        if g.get("src"):
            k = g.pop("src"); c["src"] = k
            sources[k] = {"file": f"{k}.jpg", **{x: PHOTOS.get(k, {}).get(x, "") for x in ("page", "file_url", "license", "credit")}}
        c["gfx"] = g; clips.append(c)
        if g["type"] == "photo" and g.get("react"): sfx.append([frm, "pop_hi", 0.18])
    for i, (lid, who, say, cap, g, *more) in enumerate(ep["lines"]):
        script["lines"].append({"id": lid, "voice": who, "gap": 0.05 if i == 0 else 0.25 if who == "nar" else 0.08, "say": say, "cap": [cap]})
        pic(lid, g, lid)
        for anchor, g2 in more: pic(anchor, g2, lid + "b")
        sfx.append([lid, "pop" if who == "me" else "whoosh", 0.22 if who == "me" else 0.15])
    for c in clips:
        g = c["gfx"]
        if g.get("big"):
            a = g["steps"][2] if g["type"] in ("face", "photo") else g["steps"][3]
            sfx.append([a if isinstance(a, str) else c["from"] if a < 0.3 else c["from"], "boing", 0.25])
    sfx.append(["z", "ding", 0.25])
    edit = {"credit": "", "layout": "teuk", "teuk": {"bg": ep["bg"], "mascot": ME}, "sources": sources,
            "music": {"file": ep["music"][0], "gain": ep["music"][1], "start": 0}, "sfx": sfx, "clips": clips}
    json.dump(script, open(f"{sdir}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{sdir}/edit.json", "w"), ensure_ascii=False, indent=1)
    print(sid, len(script["lines"]), "lines,", len(clips), "pictures,", len(sources), "photos")

if __name__ == "__main__":
    for sid in sys.argv[1:] or EPISODES:
        build(sid, EPISODES[sid])
