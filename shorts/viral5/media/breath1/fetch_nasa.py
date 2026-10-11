"""Download NASA Image and Video Library items (images.nasa.gov) by nasa_id, largest JPEG, and record title,
description, centre, photographer and page. usage: python3 media/breath1/fetch_nasa.py <id> key=nasa_id ..."""
import json, subprocess, sys, time, urllib.request, urllib.parse
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60))
sid = sys.argv[1]; out = []
for kv in sys.argv[2:]:
    key, nid = kv.split("=", 1)
    meta = get("https://images-api.nasa.gov/search?nasa_id=" + urllib.parse.quote(nid))["collection"]["items"][0]["data"][0]
    files = get("https://images-api.nasa.gov/asset/" + urllib.parse.quote(nid))["collection"]["items"]
    hrefs = [f["href"] for f in files if f["href"].lower().endswith((".jpg", ".jpeg", ".png", ".tif"))]
    pick = next((h for h in hrefs if "~orig" in h and h.lower().endswith((".jpg", ".jpeg"))), None) or next((h for h in hrefs if "~large" in h), hrefs[0])
    ext = pick.rsplit(".", 1)[1].lower().replace("jpeg", "jpg")
    subprocess.run(["curl", "-sSfL", "--retry", "5", "-A", UA, "-o", f"public/{sid}/src/{key}.{ext}", pick.replace(" ", "%20").replace("http://", "https://")], check=True)
    out.append({"key": key, "nasa_id": nid, "file": f"{key}.{ext}", "url": pick, "page": "https://images.nasa.gov/details/" + urllib.parse.quote(nid),
                "title": meta.get("title"), "center": meta.get("center"), "photographer": meta.get("photographer") or meta.get("secondary_creator"),
                "date": meta.get("date_created", "")[:10], "description": (meta.get("description") or "")[:700]})
    print(key, nid, meta.get("center"), "|", (meta.get("photographer") or ""), "|", (meta.get("description") or "")[:200].replace("\n", " ")); time.sleep(1)
json.dump(out, open(f"media/{sid}/sources.json", "w"), ensure_ascii=False, indent=1)
