"""Fetch the 그 시절 레트로 v2 photos (retro9~retro12) from Wikimedia Commons and check each file's licence on its own page.

usage: python3 media/retro/fetch_commons.py retro9 [...]      (run from shorts/viral5)
Reads media/retro/<id>.json ("photos": [{"key", "title"}]), opens each Commons file page, keeps the file only if the
page's licence template is KOGL Type 1, CC BY (any version, not BY-SA/NC/ND), CC0 or public domain, records licence /
author / source / date / description back into the JSON, and saves the picture to public/<id>/src/<key>.jpg (2000 px
from the Commons thumbnailer, converted to sRGB because several 서울역사아카이브 scans are CMYK, at most 1600 px wide).
upload.wikimedia.org answers 429 to this container, so the image comes through commons.wikimedia.org/w/thumb.php.
"""
import html, json, os, re, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
OK = re.compile(r"^(KOGL Type 1|CC BY \d\.\d|CC BY \d\.\d [a-z]+|CC0|Public domain)$")

def get(url, out=None):
    for k in range(8):
        r = subprocess.run(["curl", "-sS", "--fail", "-A", UA, "--max-time", "180", url] + (["-o", out] if out else []), capture_output=True)
        if r.returncode == 0: return r.stdout.decode("utf-8", "ignore") if not out else out
        time.sleep(min(240, 15 * 2 ** k))
    raise RuntimeError(f"failed: {url}")

def page(title):
    url = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
    s = get(url)
    lic = sorted({x.strip() for x in re.findall(r'class="licensetpl&#95;short"[^>]*>([^<]*)', s)})
    t = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S))))
    i = t.find("Description "); j = t.find(" Licensing", i)
    desc = t[i + 12:j].strip() if i >= 0 else ""
    m = re.search(r"Source (.*?) Author (.*?)$", desc)
    orig = re.search(r'"(https://upload\.wikimedia\.org/wikipedia/commons/[0-9a-f]/[0-9a-f]{2}/[^"?]+)', s)
    return {"page_url": url, "file_url": orig.group(1) if orig else "", "licence": " / ".join(lic),
            "source": m.group(1).strip() if m else "", "author": m.group(2).strip() if m else "", "description": desc[:700],
            "checked": time.strftime("%Y-%m-%d")}

for sid in sys.argv[1:]:
    path = f"{HERE}/{sid}.json"; d = json.load(open(path))
    os.makedirs(f"{ROOT}/public/{sid}/src", exist_ok=True)
    for p in d["photos"]:
        p.update(page(p["title"])); time.sleep(1)
        ok = bool(p["licence"]) and all(OK.match(x.strip()) for x in p["licence"].split(" / "))
        p["ok"] = ok
        out = f"{ROOT}/public/{sid}/src/{p['key']}.jpg"
        if ok and not os.path.exists(out):
            raw = out[:-4] + ".dl.jpg"
            get("https://commons.wikimedia.org/w/thumb.php?" + urllib.parse.urlencode({"f": p["title"][5:].replace(" ", "_"), "w": "2000"}), raw)
            subprocess.run(["convert", raw, "-auto-orient", "-colorspace", "sRGB", "-resize", "1600x1600>", "-quality", "90", out], check=True)
            os.remove(raw); time.sleep(2)
        print(sid, p["key"], "OK " if ok else "BAD", p["licence"], "|", p["author"][:30], "|", p["title"], flush=True)
        json.dump(d, open(path, "w"), ensure_ascii=False, indent=1)
