"""Cut stretches of NASA Image and Video Library videos (images.nasa.gov) into media/<id>/<key>.mp4 for the
"역대급 ○○ 모먼트" shorts, reading only the seconds needed (ffmpeg seeks over HTTP), and write media/<id>/<key>.json
in the media/top*/ format: page, file url, licence, credit, date, the item's own description and the cut range.

usage: python3 media/moment/nasa_cut.py <id> key=nasa_id[@rendition]:start-end ...      (seconds in the original;
       rendition defaults to "large", e.g. @orig for items that have no large file)
The shot times in politics/<id>/spec.json are then seconds inside the cut file.
"""
import json, os, subprocess, sys, urllib.parse, urllib.request

UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
V = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60))

sid = sys.argv[1]
os.makedirs(f"{V}/media/{sid}", exist_ok=True)
for arg in sys.argv[2:]:
    key, rest = arg.split("=", 1)
    nid, span = rest.rsplit(":", 1)
    rend = "large"
    if "@" in nid: nid, rend = nid.rsplit("@", 1)
    a, b = (float(x) for x in span.split("-"))
    meta = get("https://images-api.nasa.gov/search?nasa_id=" + urllib.parse.quote(nid))["collection"]["items"][0]["data"][0]
    hrefs = [h["href"] for h in get("https://images-api.nasa.gov/asset/" + urllib.parse.quote(nid))["collection"]["items"]]
    url = next(h for h in hrefs if h.endswith(f"~{rend}.mp4")).replace("http://", "https://").replace(" ", "%20")
    dst = f"{V}/media/{sid}/{key}.mp4"
    if not os.path.exists(dst):
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-user_agent", UA, "-ss", str(a), "-i", url, "-t", str(b - a),
                        "-vf", "scale=-2:'min(1080,ih)'", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst], check=True)
    info = {"file": f"{key}.mp4", "nasa_id": nid, "page_url": "https://images.nasa.gov/details/" + urllib.parse.quote(nid),
            "file_url": url, "license": "Public domain (17 U.S.C. §105), NASA media usage guidelines",
            "license_url": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
            "credit": meta.get("photographer") or meta.get("secondary_creator") or "NASA", "center": meta.get("center"),
            "title": meta.get("title"), "date": (meta.get("date_created") or "")[:10], "description": meta.get("description") or "",
            "cut_from_original_seconds": [a, b]}
    old = f"{V}/media/{sid}/{key}.json"
    if os.path.exists(old):  # keep hand-written notes, facts and used_in
        info = {**info, **{k: v for k, v in json.load(open(old)).items() if k not in info}}
    json.dump(info, open(old, "w"), ensure_ascii=False, indent=1)
    print(key, nid, rend, a, b, "|", info["credit"])
