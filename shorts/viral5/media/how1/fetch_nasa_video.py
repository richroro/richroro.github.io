"""Download NASA Image and Video Library videos (images.nasa.gov) by nasa_id into public/<id>/src/<key>.mp4 (the
"~large" 1080p rendition unless another is named) and record title, centre, credit, date, description and page in
media/<id>/sources.json. usage: python3 media/how1/fetch_nasa_video.py <id> key=nasa_id[@rendition] ..."""
import json, os, subprocess, sys, time, urllib.request, urllib.parse
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60))
sid = sys.argv[1]; out = []
os.makedirs(f"public/{sid}/src", exist_ok=True); os.makedirs(f"media/{sid}", exist_ok=True)
for kv in sys.argv[2:]:
    key, nid = kv.split("=", 1); rend = "large"
    if "@" in nid: nid, rend = nid.rsplit("@", 1)
    meta = get("https://images-api.nasa.gov/search?nasa_id=" + urllib.parse.quote(nid))["collection"]["items"][0]["data"][0]
    hrefs = [f["href"] for f in get("https://images-api.nasa.gov/asset/" + urllib.parse.quote(nid))["collection"]["items"]]
    pick = next(h for h in hrefs if h.endswith(f"~{rend}.mp4"))
    url = pick.replace("http://", "https://").replace(" ", "%20")
    dst = f"public/{sid}/src/{key}.mp4"
    if not os.path.exists(dst):
        subprocess.run(["curl", "-sSfL", "--retry", "5", "-A", UA, "-o", dst, url], check=True)
    out.append({"key": key, "nasa_id": nid, "file": f"{key}.mp4", "url": url, "page": "https://images.nasa.gov/details/" + urllib.parse.quote(nid),
                "title": meta.get("title"), "center": meta.get("center"), "credit": meta.get("photographer") or meta.get("secondary_creator"),
                "date": meta.get("date_created", "")[:10], "description": meta.get("description") or ""})
    print(key, nid, meta.get("center"), "|", out[-1]["credit"]); time.sleep(1)
json.dump(out, open(f"media/{sid}/sources.json", "w"), ensure_ascii=False, indent=1)
