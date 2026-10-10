"""Re-make an info short (life·issue·hanban) in the v2 look, or check a new one (why*).

usage: python3 media/info2/remake.py <id> [<id> ...]
Reads the v1 shorts/<id>/edit.json and script.json from git (commit V1, so the remake can be re-run), applies
media/info2/specs/<id>.json and writes the v2 files back to shorts/<id>/.

The layout change is mechanical:
  - "frame": "tall" — the picture fills everything under the title band (1080x1520) instead of a 1080x1080 box over an
    empty bottom. A crop's zoom is divided by the extra height so the picture keeps its old scale where it can
    (never below a plain cover fit), and the red circles and arrows are moved to where their target now sits.
  - "capStyle": "info2" (two lines at most, yellow the only highlight), "hideCredit": true, captions at y 1580.
  - every sticker comes off the picture (its text goes in the upload description); the spec can keep a short truth
    note as a small corner tag instead ("tags").
The spec says what is new: "title", "lines" (replace a line by id; "after": id inserts a new one), "drop": [line ids],
"cover", "tags", "clips" ({index: fields to set}, "insert": [[index, clip]]), "marks" (replace them, new coordinates),
"voices", "sfx", "punches", "music".
"""
import copy, json, os, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V1 = "1dcdd42"  # the commit with the v1 info shorts
SQ, TALL = 1080, 1520

def v1(sid, name):
    return json.loads(subprocess.run(["git", "show", f"{V1}:shorts/viral5/shorts/{sid}/{name}"], cwd=HERE, capture_output=True, text=True, check=True).stdout)

def dims(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip().split(",")
    return (int(out[0]), int(out[1])) if len(out) == 2 and out[0] else None

def place(c, w, h, H):
    """where the source lands in a box of height H: (left, top, scale), mid Ken Burns zoom, as ClipShort draws it"""
    s = sum(c.get("zoom", [1.04, 1.12])) / 2
    if c.get("crop"):
        cx, cy, z = c["crop"]
        S = max(1080 / w, H / h) * z * s
        dw, dh = w * S, h * S
        return min(0, max(1080 - dw, 540 - cx * dw)), min(0, max(H - dh, H / 2 - cy * dh)), S
    S = max(1080 / w, H / h)
    px, py = [float(v.strip("%")) / 100 for v in c.get("focus", "50% 50%").split()]
    left, top = (1080 - w * S) * px, (H - h * S) * py
    # the Ken Burns scale works around the box centre
    return 540 + (left - 540) * s, H / 2 + (top - H / 2) * s, S * s

def refit(c, w, h):
    """keep a crop's old scale in the taller box where possible (zoom never under 1)"""
    if not c.get("crop"): return
    cx, cy, z = c["crop"]
    S_old = max(1080 / w, SQ / h) * z
    c["crop"] = [cx, cy, round(max(1.0, S_old / max(1080 / w, TALL / h)), 3)]

def main(sid):
    spec = json.load(open(f"{HERE}/media/info2/specs/{sid}.json"))
    edit, script = v1(sid, "edit.json"), v1(sid, "script.json")
    old = copy.deepcopy(edit)
    # ── script ──
    if "title" in spec: script["title"] = spec["title"]
    script["voices"]["nar"]["rate"] = spec.get("rate", "+25%")  # benchmark speech rate 6.3–6.6 syllables/s
    for k, v in spec.get("voices", {}).items(): script["voices"][k] = v
    lines = [L for L in script["lines"] if L["id"] not in spec.get("drop", [])]
    for nl in spec.get("lines", []):
        k = next((i for i, L in enumerate(lines) if L["id"] == nl["id"]), None)
        body = {x: nl[x] for x in nl if x != "after"}
        if k is not None: lines[k] = {**lines[k], **body}
        else:
            j = next(i for i, L in enumerate(lines) if L["id"] == nl["after"]) + 1 if nl.get("after") else 0
            lines.insert(j, {"voice": "nar", "gap": 0.15, **body})
    lines[0]["gap"] = spec.get("firstGap", 0.05)
    script["lines"] = lines
    # ── edit ──
    pub = f"{HERE}/public/{sid}/src"
    for i, c in enumerate(edit["clips"]):
        s = edit["sources"].get(c.get("src", ""), {})
        wh = dims(f"{pub}/{s['file']}") if s.get("file") and os.path.exists(f"{pub}/{s['file']}") else None
        c["_wh"] = wh
        if wh: refit(c, *wh)
    # marks: find the clip each one sits on (by its start anchor's line) and move it with the picture
    if "marks" in spec: edit["marks"] = spec["marks"]
    else:
        for m, mo in zip(edit.get("marks", []), old.get("marks", [])):
            k = mark_clip(edit, m)
            c, co = edit["clips"][k], old["clips"][k]
            if not c["_wh"]: continue
            w, h = c["_wh"]
            l0, t0, S0 = place(co, w, h, SQ); l1, t1, S1 = place(c, w, h, TALL)
            u, v = (m["x"] - l0) / S0, (m["y"] - 400 - t0) / S0
            m["x"], m["y"] = round(l1 + u * S1), round(400 + t1 + v * S1)
            if "r" in m: m["r"] = round(m["r"] * S1 / S0)
    for c in edit["clips"]: c.pop("_wh", None)
    for k, v in spec.get("clips", {}).items():
        if v is None: edit["clips"][int(k)] = None
        else: edit["clips"][int(k)].update(v)
    for k, c in sorted(spec.get("insert", []), key=lambda x: -x[0]): edit["clips"].insert(k, c)
    edit["clips"] = [c for c in edit["clips"] if c]
    edit["frame"] = "tall"
    edit["capStyle"] = "info2"
    edit["hideCredit"] = True
    edit["captionY"] = spec.get("captionY", 1580)
    edit["stickers"] = []
    edit["tags"] = spec.get("tags", [])
    edit["cover"] = spec["cover"]
    for k in ("sfx", "punches", "flashes", "music"):
        if k in spec: edit[k] = spec[k]
    for k, v in spec.get("sources", {}).items(): edit["sources"][k] = v
    json.dump(script, open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    print(f"{sid}: v2 written ({len(lines)} lines, {len(edit['clips'])} clips, {len(edit.get('marks', []))} marks)")

def mark_clip(edit, m):
    """index of the clip that is on screen when the mark appears (same anchor order as prep.py)"""
    a = m["from"].split("@")[0].split("+")[0].split("-")[0]
    lid = a.split(".")[0]
    best = 0
    for i, c in enumerate(edit["clips"]):
        f = c["from"] if isinstance(c["from"], str) else ""
        if f.split(".")[0] == lid and (f == lid or "." in a and f == a or "." not in f): best = i
        if f == a: return i
    return best

if __name__ == "__main__":
    for sid in sys.argv[1:]: main(sid)
