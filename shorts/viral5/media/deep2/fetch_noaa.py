"""Download NOAA Ocean Exploration media by WordPress media id and record each item's page and credit line.
usage: python3 media/deep2/fetch_noaa.py <id> key=media_id ...   writes public/<id>/src/<key>.<ext> and media/<id>/sources.json"""
import json, re, html, subprocess, sys, time, urllib.request, urllib.parse
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
API = "https://oceanexplorer.noaa.gov/wp-json/wp/v2/"
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read()
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", "", h, flags=re.S))))
sid = sys.argv[1]; out = []
for kv in sys.argv[2:]:
    key, mid = kv.split("="); m = json.loads(get(API + "media/" + mid)); src = m["source_url"]; ext = src.rsplit(".", 1)[1]
    # big files: curl resumes a cut-off transfer
    subprocess.run(["curl", "-sSfL", "--retry", "5", "-C", "-", "-A", UA, "-o", f"public/{sid}/src/{key}.{ext}", src], check=True); time.sleep(0.8)
    cap = text(m["caption"]["rendered"]).strip()
    page, credit = None, None
    if m.get("post"):
        try:
            p = json.loads(get(API + "multimedia/%d" % m["post"])); page = p["link"]
            t = text(get(page).decode("utf-8", "replace")); c = re.search(r"Credit (.+?) (Download|Related)", t)
            credit = c.group(1).strip() if c else None
            i = t.find(" Credit ")
            if i > 0 and (not cap or cap.startswith("http")): cap = re.split(r"Career and Education Resources (?:image|video) ", t[max(0, i - 600):i])[-1]
        except Exception as e: print("  parent lookup failed:", e)
    if not credit:
        c = re.search(r"(?:Image|Video) courtesy of (.+?)\.", cap); credit = c.group(1) if c else None
    out.append({"key": key, "media_id": int(mid), "file": f"{key}.{ext}", "url": src, "page": page or src, "credit": credit, "caption": cap})
    print(key, "|", credit, "|", cap[:140]); time.sleep(0.8)
json.dump(out, open(f"media/{sid}/sources.json", "w"), ensure_ascii=False, indent=1)
