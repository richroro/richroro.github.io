"""Record which seconds of the finished short each photo is on screen, after prep.py.

usage: python3 media/retro/v2_seconds.py retro1 [...]       (run from shorts/viral5, after python3 prep.py <id>)
Reads src/data/<id>.json (clip times) and shorts/<id>/edit.json (which source each clip shows); writes "seconds" into
each edit.json source and "used_seconds" into the matching item of the sidecar media/retro/<id>.json ("photos", by "sn" or "key"),
[] for a downloaded photo the short no longer uses.
"""
import json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for sid in sys.argv[1:]:
    data = json.load(open(f"{HERE}/src/data/{sid}.json"))
    ep = f"{HERE}/shorts/{sid}/edit.json"; edit = json.load(open(ep))
    secs = {}
    for c, d in zip(edit["clips"], data["clips"]):
        secs.setdefault(c["src"], []).append([round(d["at"], 2), round(d["at"] + d["dur"], 2)])
    for k, s in edit["sources"].items(): s["seconds"] = secs.get(k, [])
    json.dump(edit, open(ep, "w"), ensure_ascii=False, indent=1)
    side = f"{HERE}/media/retro/{sid}.json"
    if os.path.exists(side):
        d = json.load(open(side))
        for p in d["photos"]: p["used_seconds"] = secs.get(str(p.get("sn", p.get("key"))), [])
        json.dump(d, open(side, "w"), ensure_ascii=False, indent=1)
    print(sid, {k: len(v) for k, v in secs.items()})
