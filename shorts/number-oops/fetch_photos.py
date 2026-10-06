"""Find the short's photos on Wikimedia Commons and the NASA Image Library, with license and author kept.

usage: python3 fetch_photos.py search          candidates -> public/img/cand/<slot>/NN.jpg, listed in public/img/cand/index.json
       python3 fetch_photos.py pick <slot> <NN>  copy a candidate to public/img/<slot>.jpg and record it in credits.json
Only free licenses are kept: public domain, CC0, CC BY, CC BY-SA. Needs network access to
commons.wikimedia.org, upload.wikimedia.org, images-api.nasa.gov and images-assets.nasa.gov.
"""
import html, json, os, re, shutil, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = f"{HERE}/public/img"; CAND = f"{IMG}/cand"
UA = {"User-Agent": "number-oops-short/1.0 (https://github.com/richroro/richroro.github.io)"}
FREE = re.compile(r"^(public domain|pd|cc0|cc[- ]by(-sa)?[- ]?\d)", re.I)

# slot -> searches; Commons first (clear license fields), NASA for mission photos (US government work, public domain)
SLOTS = {
    "psy": [("commons", "PSY singer 2012 filetype:bitmap"), ("commons", "Psy Gangnam Style performance filetype:bitmap")],
    "youtube": [("commons", "YouTube headquarters San Bruno filetype:bitmap")],
    "ariane": [("commons", "Ariane 5 launch filetype:bitmap"), ("nasa", "Ariane 5 launch")],
    "mco": [("nasa", "Mars Climate Orbiter"), ("commons", "Mars Climate Orbiter filetype:bitmap")],
    "mars": [("nasa", "Mars full disk"), ("commons", "Mars Valles Marineris Viking mosaic filetype:bitmap")],
    "lockheed": [("nasa", "Mars Climate Orbiter processing"), ("commons", "Mars Climate Orbiter assembly filetype:bitmap")],
    "jpl": [("nasa", "JPL mission control"), ("commons", "JPL Space Flight Operations Facility filetype:bitmap")],
    "ruler": [("commons", "tape measure close up filetype:bitmap")],
}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()

def text(h):
    return html.unescape(re.sub(r"<[^>]+>", "", h or "")).strip()

def commons(q, n=8):
    api = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrsearch": q, "gsrlimit": 20,
        "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 1920})
    pages = json.loads(get(api)).get("query", {}).get("pages", {})
    out = []
    for p in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        lic = text(md.get("LicenseShortName", {}).get("value"))
        if ii.get("mime") not in ("image/jpeg", "image/png") or ii.get("width", 0) < 1000 or not FREE.match(lic):
            continue
        out.append({"src": "Wikimedia Commons", "title": p["title"], "url": ii.get("thumburl") or ii["url"], "page": ii.get("descriptionurl"),
                    "license": lic, "author": text(md.get("Artist", {}).get("value")) or "unknown", "size": [ii.get("width"), ii.get("height")]})
    return out[:n]

def nasa(q, n=6):
    res = json.loads(get("https://images-api.nasa.gov/search?" + urllib.parse.urlencode({"q": q, "media_type": "image"})))
    out = []
    for it in res.get("collection", {}).get("items", [])[:n * 2]:
        d = it["data"][0]
        assets = json.loads(get(it["href"]))
        pick = next((a for a in assets if a.endswith("~large.jpg")), None) or next((a for a in assets if a.endswith("~orig.jpg")), None)
        if pick:
            out.append({"src": "NASA Image and Video Library", "title": d.get("title"), "url": pick.replace("http://", "https://"),
                        "page": f"https://images.nasa.gov/details/{d['nasa_id']}", "license": "Public domain (NASA)",
                        "author": d.get("photographer") or d.get("secondary_creator") or f"NASA/{d.get('center', '')}".rstrip("/")})
        if len(out) >= n: break
    return out

if sys.argv[1:2] == ["search"]:
    index = {}
    for slot, searches in SLOTS.items():
        os.makedirs(f"{CAND}/{slot}", exist_ok=True); index[slot] = []
        for where, q in searches:
            try:
                found = commons(q) if where == "commons" else nasa(q)
            except Exception as e:  # one dead search should not stop the rest
                print(f"{slot}: {where} '{q}' failed: {e}"); continue
            for c in found:
                k = len(index[slot]); path = f"{CAND}/{slot}/{k:02d}.jpg"
                try:
                    open(path, "wb").write(get(c["url"]))
                except Exception as e:
                    print(f"{slot}: download failed {c['url']}: {e}"); continue
                index[slot].append({**c, "file": path}); print(f"{slot} {k:02d} [{c['license']}] {c['title']}")
    json.dump(index, open(f"{CAND}/index.json", "w"), ensure_ascii=False, indent=1)
elif sys.argv[1:2] == ["pick"]:
    slot, k = sys.argv[2], int(sys.argv[3])
    c = json.load(open(f"{CAND}/index.json"))[slot][k]
    shutil.copy(c["file"], f"{IMG}/{slot}.jpg")
    credits_path = f"{HERE}/credits.json"
    credits = json.load(open(credits_path)) if os.path.exists(credits_path) else {}
    credits[slot] = {key: c[key] for key in ("src", "title", "page", "license", "author")}
    json.dump(credits, open(credits_path, "w"), ensure_ascii=False, indent=1)
    print(f"{slot} <- {c['title']} ({c['license']}, {c['author']})")
else:
    print(__doc__)
