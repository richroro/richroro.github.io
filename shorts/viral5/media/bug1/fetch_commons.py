"""Download Wikimedia Commons files (a 2400 px wide copy) and record licence, author, description and the original
source link (for USGS Bee Lab files: the lab's Flickr page). usage: python3 media/bug1/fetch_commons.py <id> key="File:..." ...
writes public/<id>/src/<key>.jpg and media/<id>/sources.json"""
import json, re, html, subprocess, sys, time, urllib.request, urllib.parse
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
API = "https://commons.wikimedia.org/w/api.php?"
def get(params):
    u = API + urllib.parse.urlencode(params)
    for k in range(6):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(20 * (k + 1))
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", " ", h or ""))).strip()
sid = sys.argv[1]; out = []
for kv in sys.argv[2:]:
    key, title = kv.split("=", 1)
    p = next(iter(get({"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 2400, "format": "json"})["query"]["pages"].values()))
    ii = p["imageinfo"][0]; m = ii["extmetadata"]; g = lambda k: text(m.get(k, {}).get("value", ""))
    src = ii.get("thumburl") or ii["url"]
    wt = next(iter(get({"action": "query", "titles": title, "prop": "revisions", "rvprop": "content", "rvslots": "main", "format": "json"})["query"]["pages"].values()))
    wt = wt["revisions"][0]["slots"]["main"]["*"]
    flickr = re.search(r"https?://(?:www\.)?flickr\.com/photos/[^\s|\]}]+", wt)
    for k in range(5):
        r = subprocess.run(["curl", "-sSfL", "-A", UA, "-o", f"public/{sid}/src/{key}.jpg", src])
        if r.returncode == 0: break
        time.sleep(20 * (k + 1))
    out.append({"key": key, "file": f"{key}.jpg", "url": src, "page": ii["descriptionurl"], "original": flickr.group(0) if flickr else None,
                "credit": g("Artist"), "licence": g("LicenseShortName"), "size": [ii["width"], ii["height"]], "caption": g("ImageDescription")[:600]})
    print(key, "|", g("LicenseShortName"), "|", g("Artist"), "|", out[-1]["original"]); time.sleep(4)
json.dump(out, open(f"media/{sid}/sources.json", "w"), ensure_ascii=False, indent=1)
