"""Fill politics/<id>/spec.json "sources" from the media/<id>/<key>.json files of the clips the spec uses
(written by media/moment/nasa_cut.py or by hand), so the edit's source list and the clip notes never drift apart.
usage: python3 media/moment/sources.py <id> [<id> ...]   then  python3 politics/top_v2.py <id>"""
import json, os, sys
V = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEEP = ("title", "page_url", "file_url", "license", "license_url", "credit", "center", "date", "cut_from_original_seconds", "nasa_id")
for sid in sys.argv[1:]:
    sp_path = f"{V}/politics/{sid}/spec.json"; sp = json.load(open(sp_path))
    used = sorted({sh["src"] for pl in sp["places"] for sh in pl["shots"]})
    out = []
    for src in used:
        m = json.load(open(f"{V}/media/{src[:-4]}.json"))
        e = {"file": src, **{k: m[k] for k in KEEP if k in m}}
        if "page_url" in e: e["page"] = e.pop("page_url")
        out.append(e)
    sp["sources"] = out
    json.dump(sp, open(sp_path, "w"), ensure_ascii=False, indent=1)
    print(sid, len(out), "sources")
