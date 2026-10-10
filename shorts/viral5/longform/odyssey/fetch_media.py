"""Download what the Odyssey documentary needs into public/odyssey/ (git-ignored):
the Rijksmuseum CC0 images listed in sources_images.json (IIIF, longest side 2600 px), the Kevin MacLeod
tracks named in script.json (incompetech.com, CC BY 4.0), and the Natural Earth land polygons for the maps.

usage: python3 fetch_media.py            then: python3 make_maps.py ... (fetch_media runs it for you)
"""
import json, os, subprocess, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.normpath(f"{HERE}/../../public")
OUT = f"{PUB}/odyssey"
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    for i in range(4):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120).read()
            open(path + ".part", "wb").write(data); os.replace(path + ".part", path); return
        except Exception as e:
            err = e; time.sleep(3 * (i + 1))
    raise RuntimeError(f"{url}: {err}")

def main():
    os.makedirs(f"{OUT}/img", exist_ok=True); os.makedirs(f"{PUB}/music", exist_ok=True); os.makedirs(f"{OUT}/ne", exist_ok=True)
    src = json.load(open(f"{HERE}/sources_images.json"))
    jobs = [(v["image"].replace("/full/max/", "/full/!2600,2600/"), f"{OUT}/img/{k}.jpg") for k, v in src.items()]
    S = json.load(open(f"{HERE}/script.json"))
    for m in sorted({c["music"] for c in S["chapters"]}):
        jobs.append(("https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + urllib.parse.quote(m) + ".mp3", f"{PUB}/music/{m}.mp3"))
    ne = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
    for f in ["ne_10m_land", "ne_50m_land"]:
        jobs.append((ne + f + ".geojson", f"{OUT}/ne/{f}.geojson"))
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda j: get(*j), jobs))
    if not os.path.exists(f"{OUT}/route.json"):
        subprocess.run([sys.executable, f"{HERE}/make_maps.py", f"{OUT}/ne/ne_50m_land.geojson", f"{OUT}/ne/ne_10m_land.geojson", OUT], check=True)
    print(len(jobs), "files ready in", OUT)

if __name__ == "__main__":
    main()
