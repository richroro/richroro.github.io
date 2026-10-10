"""lfsaeyeon1: put the cuts on the voice timeline and write what the stage renders.

reads  longform/lfsaeyeon1/scenes.json (build.py), build/lfsaeyeon1/timeline.json (voice.py), edit.json (music, sfx)
writes src/data/lfsaeyeon1.json (git-ignored) and its committed copy longform/lfsaeyeon1/video.json, and public/lfsaeyeon1/voice/*.wav, and longform/lfsaeyeon1/chapters.json

Each beat's cut starts a little before its line (inside the pause before it) and lasts until the next cut. Narration
lines become bottom-caption pages; dialogue is in the bubbles. A mood change (cast[].to) lands 45% into the line.

usage: python3 longform/lfsaeyeon1/prep.py
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import story

SID = "lfsaeyeon1"

def fmt(t):
    t = int(t)
    return f"{t // 60}:{t % 60:02d}"

def main():
    S = json.load(open(f"{HERE}/scenes.json"))
    T = json.load(open(f"{ROOT}/build/{SID}/timeline.json"))
    E = json.load(open(f"{HERE}/edit.json"))
    L = T["lines"]
    assert len(S) == len(L), (len(S), len(L))
    starts = []
    for i, l in enumerate(L):
        if i == 0:
            starts.append(0.0); continue
        prev_end = L[i - 1]["start"] + L[i - 1]["dur"]
        lead = min(0.25, (l["start"] - prev_end) * 0.6)
        starts.append(round(l["start"] - lead, 3))
    end = T["end"]
    cuts, caps = [], []
    for i, (g, l) in enumerate(zip(S, L)):
        t0 = starts[i]; t1 = starts[i + 1] if i + 1 < len(S) else end
        into = l["start"] - t0  # the line begins this far into the cut
        g = dict(g)
        if any(c.get("to") for c in g["cast"]):
            g["swAt"] = round(into + 0.45 * l["dur"], 3)
        if g.get("say"):
            g["say"] = dict(g["say"], at=round(max(0.0, into - 0.05), 3))
        if g.get("chat"):
            ms = g["chat"]["msgs"]
            for k, m in enumerate(ms):
                if m.get("at") != 0:
                    m["at"] = round(into + (k + 0.3) * l["dur"] / (len(ms) + 0.3), 3)
        if g.get("big"):
            g["bigAt"] = round(into + 0.15, 3)
        cuts.append({"from": t0, "dur": round(t1 - t0, 3), "g": g})
        if l["voice"] == "nar":
            for k, c in enumerate(l["chunks"]):
                a = l["start"] + c["t0"]
                b = l["start"] + c["t1"] if k + 1 < len(l["chunks"]) else l["start"] + l["dur"] + 0.15
                caps.append({"from": round(a, 3), "to": round(b, 3), "text": c["text"]})
    # chapters: the first beat of each
    chapters = []
    for i, (v, t, sc) in enumerate(story.B):
        if sc and sc.get("ch") is not None:
            chapters.append([fmt(starts[i]), story.CHAPTERS[sc["ch"]]])
    chapters.sort(key=lambda c: int(c[0].split(":")[0]) * 60 + int(c[0].split(":")[1]))
    chapters[0][0] = "0:00"
    # the title card in the pause before the story proper
    ch1 = next(i for i, b in enumerate(story.B) if b[2] and b[2].get("ch") == 1)
    title = {"from": round(L[ch1 - 1]["start"] + L[ch1 - 1]["dur"] + 0.15, 3), "to": round(L[ch1]["start"] - 0.2, 3), "text": T["title"]}
    # music: each bed runs from its chapter to the next bed's chapter (looping), fading in and out
    ch_t = {k: next(starts[i] for i, b in enumerate(story.B) if b[2] and b[2].get("ch") == k) for k in range(len(story.CHAPTERS))}
    quiet = next(i for i, b in enumerate(story.B) if b[2] and b[2].get("quiet"))
    music = []
    for m in E["music"]:
        a = ch_t[m["fromCh"]] if "fromCh" in m else 0.0
        b = end if m.get("toCh") is None else ch_t[m["toCh"]]
        if m.get("toQuiet"):
            b = L[quiet]["start"] + L[quiet]["dur"] + 0.1
        if m.get("fromQuiet"):
            a = L[quiet + 1]["start"] - 0.2
        music.append({"file": m["file"], "from": round(a, 3), "to": round(b, 3), "gain": m["gain"], "offset": m.get("offset", 0)})
    sfx = []
    for s in E["sfx"]:
        i = s["line"] if "line" in s else next(k for k, b in enumerate(story.B) if s["find"] in b[1])
        t = starts[i] + (s.get("dt", 0.0) if not s.get("atLine") else L[i]["start"] - starts[i] + s.get("dt", 0.0))
        sfx.append({"t": round(t, 3), "name": s["name"], "gain": s["gain"]})
    os.makedirs(f"{ROOT}/public/{SID}/voice", exist_ok=True)
    for l in L:
        shutil.copyfile(f"{ROOT}/build/{SID}/{l['wav']}", f"{ROOT}/public/{SID}/{l['wav']}")
    data = {"id": SID, "end": end, "cuts": cuts, "caps": caps, "title": title,
            "lines": [{"id": l["id"], "start": l["start"], "dur": l["dur"], "voice": l["voice"]} for l in L],
            "music": music, "sfx": sfx, "chapters": chapters}
    os.makedirs(f"{ROOT}/src/data", exist_ok=True)
    json.dump(data, open(f"{ROOT}/src/data/{SID}.json", "w"), ensure_ascii=False)
    # a committed copy, so Root.tsx can import the episode without running prep first
    json.dump(data, open(f"{HERE}/video.json", "w"), ensure_ascii=False)
    json.dump(chapters, open(f"{HERE}/chapters.json", "w"), ensure_ascii=False, indent=1)
    print(f"{len(cuts)} beats, {sum(1 for c in cuts if not c['g'].get('hold'))} pictures, {len(caps)} caption pages, end {end:.1f} s")
    for t, n in chapters:
        print(" ", t, n)

if __name__ == "__main__":
    main()
