"""lfsaeyeon1: turn story.py (the beats) into the cut list the stage draws (scenes.json): one cut per beat, with the
speaker's bubble on dialogue lines and the narration left to the bottom caption. A beat whose scene is None keeps the
previous picture and only swaps the bubble (`cont`: the characters don't re-enter).

usage: python3 longform/lfsaeyeon1/build.py      writes longform/lfsaeyeon1/scenes.json
"""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import story

SPEAKER = {"me": "ji", "hus": "do", "mom": "mom", "sis": "sis"}
NAMETAG = {"ji": {"name": "나", "color": "#FF8C7A"}, "do": {"name": "남편", "color": "#2F4B7C"}, "mom": {"name": "어머님", "color": "#9C7BD0"}, "sis": {"name": "형님", "color": "#9AA3AD"}}

def scenes():
    out, prev = [], None
    for i, (voice, text, sc) in enumerate(story.B):
        cont = sc is None
        if cont:
            g = copy.deepcopy(prev)
            for k in ("card", "big", "chat"):
                if k == "chat" and g.get("chat"):
                    for m in g["chat"]["msgs"]:
                        m["at"] = 0  # already on screen
                    continue
                g.pop(k, None)
            g["cont"] = True
            g["zoom"] = None
            for c in g["cast"]:
                if c.get("to"):
                    c["mood"], c["to"] = c["to"], None
        else:
            g = {"bg": sc["bg"], "cast": []}
            for c in sc.get("cast", []):
                who, mood = c[0], c[1]
                to = c[2] if len(c) > 2 else None
                f = c[3] if len(c) > 3 else {}
                g["cast"].append({"who": who, "mood": mood, "to": to, "f": f})
            for k in ("place", "prop", "card", "big", "zoom", "focus", "chat"):
                if sc.get(k) is not None:
                    g[k] = sc[k]
            if sc.get("ch") is not None:
                g["ch"] = sc["ch"]
        g.pop("say", None)
        g.pop("ch", None) if cont else None
        if voice != "nar":
            who = SPEAKER[voice]
            idx = next((k for k, c in enumerate(g["cast"]) if c["who"] == who), -1)
            g["say"] = {"who": idx, "text": text}
            if idx < 0:
                g["say"].update(NAMETAG[who])
        # the same set-up as the cut before (same set, prop, place and people): not a new picture, only new
        # moods and a new bubble, so the camera holds where it was and nobody re-enters
        key = lambda x: (x["bg"], x.get("prop"), tuple(c["who"] for c in x["cast"]))
        if prev is not None and (cont or (key(g) == key(prev) and (not g.get("place") or g.get("place") == prev.get("place")))) and not g.get("card"):
            g["hold"] = True
            if not g.get("zoom"):
                g["zoom"], g["focus"] = prev.get("zoomEnd", 1), prev.get("focus")
                g["zoomFrom"] = g["zoom"]
            else:
                g["zoomFrom"] = prev.get("zoomEnd", 1)
        g["zoomEnd"] = g.get("zoom") or 1
        g["line"] = i
        g["voice"] = voice
        g["text"] = text
        g["quiet"] = bool(sc and sc.get("quiet"))
        out.append(g)
        prev = g
    return out

if __name__ == "__main__":
    S = scenes()
    json.dump(S, open(f"{HERE}/scenes.json", "w"), ensure_ascii=False, indent=1)
    print(len(S), "beats,", sum(1 for g in S if not g.get("hold")), "new pictures")
