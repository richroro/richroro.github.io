"""Download the photos a quote short uses into public/<id>/src/ (git-ignored), cropped as media/<id>/quote.json says,
and write media/<id>/sources.json with each picture's page, author and licence (the description's credit line).
Only public-domain / CC0 / CC BY pictures go in quote.json; each one's licence was read on its own page first.
usage: python3 media/quote/fetch_pics.py <id>

source entry: {"file": "x.jpg", "download": <image url>, "url": <licence page>, "label", "author", "licence",
               "crop"?: [l, t, r, b] as fractions of the image (cut away frames, mounts, captions and logos)}
"""
import io, json, os, sys, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
sid = sys.argv[1]
spec = json.load(open(f"{HERE}/media/{sid}/quote.json"))
os.makedirs(f"{HERE}/public/{sid}/src", exist_ok=True)
out = {}
for key, s in spec["sources"].items():
    dst = f"{HERE}/public/{sid}/src/{s['file']}"
    if not os.path.exists(dst):
        raw = urllib.request.urlopen(urllib.request.Request(s["download"], headers={"User-Agent": UA}), timeout=60).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if s.get("crop"):
            l, t, r, b = s["crop"]; W, H = im.size
            im = im.crop((round(l * W), round(t * H), round(r * W), round(b * H)))
        im.save(dst, quality=93)
        time.sleep(2.5)  # be gentle with the archives
    out[key] = {k: s[k] for k in ("label", "author", "licence", "url") if k in s}
    print(key, Image.open(dst).size, s["licence"])
json.dump(out, open(f"{HERE}/media/{sid}/sources.json", "w"), ensure_ascii=False, indent=1)
