"""Record every source an info v2 short uses (page, file address, licence, credit, seconds used) in media/info2/sources.json,
and print the README source list. Run after prep.py (it reads src/data/<id>.json for the cut lengths).

usage: python3 media/info2/sources.py <id> [<id> ...]
"""
import json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = f"{HERE}/media/info2/sources.json"

def record(sid):
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
        s = e["sources"][k]
        out[k] = {"file": s.get("file"), "page": s.get("url"), "fileUrl": s.get("fileUrl") or s.get("file_url"), "license": s.get("license"),
                  "creator": s.get("creator") or s.get("credit"), "label": s.get("label"), "used": u}
    return out

if __name__ == "__main__":
    allr = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for sid in sys.argv[1:]:
        allr[sid] = record(sid)
        print(f"**{sid}**")
        for k, r in allr[sid].items():
            print(f"- [{r['label'] or r['file']}]({r['page']}) — {r['license']}; {', '.join(r['used'])}")
    json.dump(dict(sorted(allr.items())), open(OUT, "w"), ensure_ascii=False, indent=1)
