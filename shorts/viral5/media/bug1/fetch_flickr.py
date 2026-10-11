"""Download photos from the USGS Bee Inventory and Monitoring Lab's Flickr account (flickr.com/photos/usgsbiml) by photo
id, the 2048 px copy, and record title, description and the page's licence (10 = Public Domain Mark, 8 = US Government
Work, 9 = CC0, 4 = CC BY 2.0). usage: python3 media/bug1/fetch_flickr.py <id> key=photo_id ...
writes public/<id>/src/<key>.jpg and media/<id>/sources.json"""
import json, re, subprocess, sys, time, urllib.request
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
LIC = {"4": "CC BY 2.0", "7": "No known copyright restrictions", "8": "United States Government Work", "9": "CC0", "10": "Public Domain Mark"}
def unj(s): return json.loads('"' + s + '"')
sid = sys.argv[1]; out = []
for kv in sys.argv[2:]:
    key, pid = kv.split("=", 1); page = f"https://www.flickr.com/photos/usgsbiml/{pid}/"
    h = urllib.request.urlopen(urllib.request.Request(page, headers={"User-Agent": UA}), timeout=60).read().decode("utf-8", "replace")
    sizes = {m[0]: (m[1], int(m[2])) for m in re.findall(r'"(k|h|o|b)":\{"displayUrl":"([^"]+)","width":(\d+)', h)}
    src = "https:" + unj((sizes.get("k") or sizes.get("h") or sizes.get("o") or sizes["b"])[0])
    lic = re.search(r'"license":(\d+)', h).group(1)
    title = unj(re.search(r'"title":"((?:[^"\\]|\\.)*)"', h).group(1))
    desc = unj(re.search(r'"description":"((?:[^"\\]|\\.)*)"', h).group(1))
    owner = unj(re.search(r'"realname":"((?:[^"\\]|\\.)*)"', h).group(1))
    subprocess.run(["curl", "-sSfL", "--retry", "3", "-A", UA, "-o", f"public/{sid}/src/{key}.jpg", src], check=True)
    out.append({"key": key, "flickr_id": pid, "file": f"{key}.jpg", "url": src, "page": page, "title": title, "owner": owner,
                "credit": "USGS Bee Inventory and Monitoring Lab", "licence": LIC.get(lic, "flickr licence " + lic), "caption": desc[:900]})
    print(key, "|", LIC.get(lic, lic), "|", owner, "|", title[:70], "|", desc[:150].replace("\n", " ")); time.sleep(2.5)
json.dump(out, open(f"media/{sid}/sources.json", "w"), ensure_ascii=False, indent=1)
