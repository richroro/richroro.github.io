"""Photos for the "○○ 특" v2 shorts (teuk1-teuk14): Wikimedia Commons files under CC0, public domain or CC BY only
(no BY-SA, NC or ND), each licence read from the file's own Commons page (imageinfo extmetadata) on 2026-10-10.

usage: python3 media/teuk/fetch.py resolve          fill page / file_url / license / credit into photos.json from Commons
       python3 media/teuk/fetch.py [<id> ...]       download every photo a short's edit.json uses into public/<id>/src/
Pexels and Pixabay were tried first, but their pages answered with a bot challenge to this environment, so no
Pexels/Pixabay item could be opened and none is used.
"""
import html, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED = re.compile(r"^(cc0|public domain|pd\b|cc by \d)", re.I)

def get(url, binary=False):
    for k in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
            return r if binary else json.loads(r)
        except Exception as e:
            print("  retry", e, file=sys.stderr); time.sleep(6 * (k + 1))
    raise SystemExit(f"could not fetch {url}")

def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", h or ""))).strip()

def resolve():
    """one API call for all titles (Commons rate-limits anonymous clients)"""
    path = f"{HERE}/photos.json"; P = json.load(open(path))
    todo = {p["title"]: k for k, p in P.items() if not p.get("license")}
    titles = list(todo)
    for i in range(0, len(titles), 40):
        r = get(API + "?" + urllib.parse.urlencode({"action": "query", "titles": "|".join(titles[i:i + 40]), "prop": "imageinfo",
                                                    "iiprop": "url|extmetadata", "iiurlwidth": 1600, "format": "json"}))
        norm = {n["to"]: n["from"] for n in r["query"].get("normalized", [])}
        for pg in r["query"]["pages"].values():
            k = todo[norm.get(pg["title"], pg["title"])]; p = P[k]
            ii = pg["imageinfo"][0]; m = ii["extmetadata"]
            lic = m.get("LicenseShortName", {}).get("value", "")
            if not ALLOWED.match(lic) or re.search(r"\b(sa|nc|nd)\b", lic, re.I): raise SystemExit(f"{k}: licence {lic} not allowed")
            artist = re.sub(r"^by\s+", "", text(m.get("Artist", {}).get("value", ""))) or "unknown"
            lurl = m.get("LicenseUrl", {}).get("value", "")
            p.update({"page": ii["descriptionurl"], "file_url": ii["url"], "thumb_url": ii.get("thumburl", ii["url"]), "license": lic,
                      "license_url": lurl, "author": artist,
                      "credit": f"{p['title'][5:]} by {artist} ({lic}{', ' + lurl if lurl else ''}), via Wikimedia Commons"})
            print(k, lic, artist[:60])
        json.dump(P, open(path, "w"), ensure_ascii=False, indent=1); time.sleep(3)

def download(sid):
    P = json.load(open(f"{HERE}/photos.json"))
    edit = json.load(open(f"{ROOT}/shorts/{sid}/edit.json"))
    out = f"{ROOT}/public/{sid}/src"; os.makedirs(out, exist_ok=True)
    for k, s in edit["sources"].items():
        dst = f"{out}/{s['file']}"
        if os.path.exists(dst): continue
        cache = f"{ROOT}/build/teuk_photos/{k}.orig"; os.makedirs(os.path.dirname(cache), exist_ok=True)
        if not os.path.exists(cache):
            url = P[k]["thumb_url"]
            if "/thumb/" not in url:  # an unscaled original (originals are throttled harder): ask for a 1280 px rendering instead
                head, name = P[k]["file_url"].split("?")[0].rsplit("/", 1); url = head.replace("/commons/", "/commons/thumb/") + f"/{name}/1280px-{name}"
            data = get(url, True)  # written only once complete, so a failed fetch leaves no empty cache
            open(cache, "wb").write(data); time.sleep(2)
        # cover the 1080x1160 picture box at its native resolution (the renderer adds the slow push-in)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cache, "-vf", "scale=1296:1392:force_original_aspect_ratio=increase", "-q:v", "3", dst], check=True)
    print(sid, "photos ready")

if __name__ == "__main__":
    if sys.argv[1:2] == ["resolve"]: resolve()
    else:
        for sid in sys.argv[1:]: download(sid)
