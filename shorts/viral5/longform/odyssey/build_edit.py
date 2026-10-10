"""Build edit.json for the Odyssey documentary from script.json (narration), voice.json (voice.py's line
lengths and word times), shots.py (the picture plan), sources_images.json (credits) and route.json (map points).

usage: python3 build_edit.py <voice_dir> [out.json]       default out: edit.json next to this file
Times are seconds from the start of the video.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from shots import PLAN  # noqa: E402

LEAD = 0.6          # silence before the first word
TITLE = 3.6         # the title card after the prologue
CH_LEAD = 1.3       # from a chapter's start (dip to black, chapter card) to its first word
TAIL = 6.0          # after the last word: hold, then the end card
MAXCAP = 28         # characters in one caption line
# pictures shown in their own colours; everything else is a print or drawing on paper and gets a warm, dark grade
COLOUR = {"nuijen_storm", "willaerts_wreck", "lairesse_calypso", "lairesse_mercury", "jordaens_nausicaa", "sandrart_nausicaa",
          "rubens_circe", "rubens_episodes", "ducros_coast", "ducros_scilla", "mignard_sirens", "vianen_tazza"}
# the YouTube chapters (and the on-screen chapter cards): scenes grouped so a chapter is about 1-1.5 minutes
GROUPS = [("prologue", "10년 중 8년"), ("map", "트로이에서 이타카까지"), ("lotus", "집을 잊게 하는 열매"),
          ("cyclops", "내 이름은 아무도 아니다"), ("name", "한 번의 외침"), ("wind", "수평선에 보인 고향"),
          ("circe", "1년을 잊은 사람"), ("underworld", "같은 예언"), ("sirens", "알고도 지나가는 법"),
          ("cattle", "두 번째 잠"), ("calypso", "늙지 않는 7년"), ("raft", "열여드레째의 폭풍"), ("ship", "세 번째 잠"),
          ("nobody", "늙은 개 한 마리"), ("reason", "진짜 이유"), ("bed", "움직이지 않는 침대")]

def caption_chunks(text, words, dur):
    """split a line into caption pieces of at most MAXCAP characters and time each from the word boundaries"""
    pieces = []
    for sent in re.findall(r"[^.?!]+[.?!]?[\"”’']?\s*", text):
        sent = sent.strip()
        while len(sent) > MAXCAP:
            cut = -1
            for m in re.finditer(r"[,]\s", sent):        # prefer a comma near the middle
                if 6 <= m.end() <= MAXCAP:
                    cut = m.end()
            if cut < 0:
                sp = [m.start() for m in re.finditer(r"\s", sent) if m.start() <= MAXCAP]
                mid = len(sent) / 2 if len(sent) <= 2 * MAXCAP else MAXCAP
                cut = min(sp, key=lambda p: abs(p - mid)) + 1 if sp else MAXCAP
            pieces.append(sent[:cut].strip()); sent = sent[cut:].strip()
        if sent:
            if pieces and len(sent) <= 5 and len(pieces[-1]) + len(sent) <= MAXCAP + 6:
                pieces[-1] += " " + sent   # no orphan word on its own caption
            else:
                pieces.append(sent)
    # time: count spoken characters; a piece starts at the boundary of the word holding its first character
    clean = lambda s: re.sub(r"[^가-힣A-Za-z0-9]", "", s)
    wstarts, acc = [], 0
    for t0, d, w in words:
        wstarts.append((acc, max(0.0, t0))); acc += len(clean(w))
    total = max(1, acc)
    out, pos = [], 0
    for p in pieces:
        n = len(clean(p))
        t = 0.0
        if wstarts:
            cand = [st for a, st in wstarts if a <= pos]
            t = cand[-1] if cand else 0.0
        else:
            t = dur * pos / total
        out.append([p, t]); pos += n
    res = []
    for i, (p, t) in enumerate(out):
        t1 = out[i + 1][1] if i + 1 < len(out) else dur
        res.append({"text": p, "t0": t, "t1": max(t + 0.3, t1)})
    return res

def main():
    vdir = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else f"{HERE}/edit.json"
    S = json.load(open(f"{HERE}/script.json"))
    V = json.load(open(f"{vdir}/voice.json"))["lines"]
    SRC = json.load(open(f"{HERE}/sources_images.json"))
    gap = S["gap"]
    t = LEAD
    n = 0
    chapters, lines, caps, shots = [], [], [], []
    for ci, ch in enumerate(S["chapters"]):
        if ci == 1:
            shots.append({"kind": "title", "t0": t, "t1": t + TITLE})
            t += TITLE
        cstart = 0.0 if ci == 0 else t
        if ci > 0:
            t += CH_LEAD
        lt = []
        for L in ch["lines"]:
            v = V[n]
            assert v["key"].endswith("|" + L["text"]), (n, L["text"])
            lines.append({"t": round(t, 3), "dur": v["dur"], "file": v["file"], "text": L["text"], "chapter": ch["id"]})
            for c in caption_chunks(L["text"], v["words"], v["dur"]):
                caps.append({"t0": round(t + c["t0"], 3), "t1": round(t + c["t1"], 3), "text": c["text"]})
            lt.append((t, v["dur"]))
            t += v["dur"] + gap
            n += 1
        cend = t - gap + 0.5
        chapters.append({"id": ch["id"], "label": ch["label"], "sub": ch["sub"], "music": ch["music"],
                         "start": round(cstart, 3), "voice": round(lt[0][0], 3), "end": round(cend, 3)})
        # shots of this chapter
        plan = PLAN[ch["id"]]
        for si, sh in enumerate(plan):
            li = sh[0]
            k = int(li); frac = li - k
            st = cstart if si == 0 else lt[k][0] + frac * lt[k][1]
            spec = {"kind": sh[1], "t0": round(st, 3)}
            if sh[1] == "img":
                key, cx, cy, z, mv = sh[2:]
                s = SRC[key]
                spec.update({"img": key, "tone": "colour" if key in COLOUR else "print", "cx": cx, "cy": cy, "z": z, "move": mv,
                             "credit": f"{s['maker'].split(' (')[0]}, {s['date']} · Rijksmuseum"})
            else:
                spec.update(sh[2] if len(sh) > 2 else {})
            shots.append(spec)
        t = cend - 0.5 + 1.2  # chapter gap
    end_voice = lines[-1]["t"] + lines[-1]["dur"]
    total = end_voice + TAIL
    shots.append({"kind": "end", "t0": round(end_voice + 2.0, 3)})
    shots.sort(key=lambda s: s["t0"])
    for i, s in enumerate(shots):
        s["t1"] = round(shots[i + 1]["t0"], 3) if i + 1 < len(shots) else round(total, 3)
    chapters[-1]["end"] = round(total, 3)
    for i in range(len(chapters) - 1):
        chapters[i]["end"] = chapters[i + 1]["start"]
    starts = {g: i for i, (g, _) in enumerate(GROUPS)}
    gi = -1
    for c in chapters:
        if c["id"] in starts:
            gi = starts[c["id"]]; c["card"] = True
        c["group"] = gi + 1; c["groupLabel"] = GROUPS[gi][1]
    yt = [{"t": c["start"] if c["group"] > 1 else 0, "n": c["group"], "label": c["groupLabel"]} for c in chapters if c.get("card")]
    E = {"id": S["id"], "title": S["title"], "fps": 30, "width": 1920, "height": 1080, "duration": round(total, 3),
         "chapters": chapters, "youtube": yt, "lines": lines, "captions": caps, "shots": shots}
    json.dump(E, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"{len(lines)} lines, {len(shots)} shots, {len(caps)} captions, {total:.1f}s = {int(total // 60)}:{total % 60:04.1f}")
    for c in yt:
        print(f"{int(c['t'] // 60)}:{int(c['t'] % 60):02d} {c['label']}")

if __name__ == "__main__":
    main()
