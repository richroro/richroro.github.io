"""Record every source an info v2 short uses (page, file address, licence, credit, seconds used) in media/info2/sources.json,
and print the README source list. Run after prep.py (it reads src/data/<id>.json for the cut lengths).

usage: python3 media/info2/sources.py <id> [<id> ...]
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = f"{HERE}/media/info2/sources.json"

def sidecars():
    """licence and file address by file name from the series' own records (media/<series>/*.json), for sources whose
    edit.json entry carries only a page and a credit (hanban1-4)"""
    out = {}
    def walk(x):
        if isinstance(x, dict):
            f = x.get("file")
            if isinstance(f, str) and (x.get("licence") or x.get("license")):
                out.setdefault(os.path.basename(f), (x.get("licence") or x.get("license"), x.get("file_url") or x.get("fileUrl")))
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    for p in glob.glob(f"{HERE}/media/**/*.json", recursive=True):
        if p.endswith("info2/sources.json"): continue
        try: walk(json.load(open(p)))
        except Exception: pass
    return out
SIDE = None

def record(sid):
    global SIDE
    SIDE = SIDE or sidecars()
    e = json.load(open(f"{HERE}/shorts/{sid}/edit.json")); d = json.load(open(f"{HERE}/src/data/{sid}.json"))
    used = {}
    for c, dc in zip(e["clips"], d["clips"]):
        k = c.get("src")
        if not k: continue
        if c.get("in") is not None and not e["sources"][k]["file"].lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            a = c["in"]; used.setdefault(k, []).append(f"{a:.1f}-{a + dc['dur'] * c.get('speed', 1.0):.1f}s")
        else:
            used.setdefault(k, []).append(f"still {dc['dur']:.1f}s on screen")
    cv = e.get("cover")
    if cv: used.setdefault(cv["src"], []).append(f"cover still (frame at {cv.get('in', 0)}s)")
    out = {}
    for k, u in used.items():
        s = e["sources"][k]; side = SIDE.get(os.path.basename(s.get("file") or ""), (None, None))
        out[k] = {"file": s.get("file"), "page": s.get("url"), "fileUrl": s.get("fileUrl") or s.get("file_url") or side[1], "license": s.get("license") or side[0],
                  "creator": s.get("creator") or s.get("credit"), "credit": s.get("credit"), "label": s.get("label"), "used": u}
    return out

if __name__ == "__main__":
    allr = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for sid in sys.argv[1:]:
        allr[sid] = record(sid)
        print(f"**{sid}**")
        for k, r in allr[sid].items():
            print(f"- [{r['label'] or r['file']}]({r['page']}) — {r['license']}; {', '.join(r['used'])}")
    json.dump(dict(sorted(allr.items())), open(OUT, "w"), ensure_ascii=False, indent=1)
