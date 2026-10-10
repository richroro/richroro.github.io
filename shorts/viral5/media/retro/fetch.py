"""Fetch the 그 시절 레트로 photos (retro1~retro4) from 공유마당 (gongu.copyright.or.kr) and check each item's licence.

usage: python3 media/retro/fetch.py [retro1 ...]     (run from shorts/viral5)
Reads media/retro/<id>.json (the photo list), opens each item page, keeps it only if the page's licence code is
01 (공공누리 제1유형) or 21 (CC BY), records title / author / source / year / summary / licence back into the JSON,
and saves the full image to public/<id>/src/<sn>.jpg, scaled to at most 1600 px wide ("fix": "bright" also lifts a dark
slide with ImageMagick -auto-gamma). It also fetches the Kevin MacLeod tracks the retro shorts use into public/music/.
"""
import base64, html, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
LIC = {"01": "공공누리 제1유형 (출처표시)", "21": "CC BY (저작자표시)"}

def get(url, out=None):
    for k in range(6):
        cmd = ["curl", "-sS", "--fail", "-A", UA, "--max-time", "90", url] + (["-o", out] if out else [])
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode == 0: return r.stdout.decode("utf-8", "ignore") if not out else out
        time.sleep(3 * (k + 1))
    raise RuntimeError(f"failed: {url}")

def field(s, name):
    i = s.find(name + "</dt>")
    if i < 0: return ""
    m = re.search(r"<dd>(.*?)</dd>", s[i:i + 3000], re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))).strip() if m else ""

def item(sn, dest):
    page = f"https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn={sn}&menuNo=200018"
    s = get(page)
    lic = re.search(r'name="licenseCd" id="licenseCd" value="(\d+)"', s).group(1)
    fp = re.search(r'wrtFileImageView\.do\?wrtSn=%s&amp;filePath=([^&]*)&amp;thumbAt=Y&amp;thumbSe=b_tbumb' % sn, s).group(1)
    assert base64.b64decode(fp + "==").decode("latin1").startswith("/disk"), "image not stored on gongu"
    file_url = f"https://gongu.copyright.or.kr/gongu/wrt/cmmn/wrtFileImageView.do?wrtSn={sn}&filePath={fp}&thumbAt=N&wrtTy=10006"
    if not os.path.exists(dest): get(file_url, dest)
    title = re.search(r'name="orginSj" id="orginSj" value="([^"]*)"', s).group(1)
    return {"sn": sn, "title": html.unescape(title), "page_url": page, "file_url": file_url, "licence_code": lic,
            "licence": LIC.get(lic, f"NOT ALLOWED ({lic})"), "author": field(s, "저작(권)자").split("(저작물")[0].strip(),
            "source": field(s, "출처"), "year": field(s, "창작년도"), "summary": field(s, "요약정보")[:300],
            "checked": time.strftime("%Y-%m-%d")}

for m in ("Gymnopedie No 1", "Gymnopedie No 2"):  # incompetech.com, CC BY 4.0
    f = f"{ROOT}/public/music/{m}.mp3"
    if not os.path.exists(f): get("https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + m.replace(" ", "%20") + ".mp3", f)

for sid in sys.argv[1:] or ["retro1", "retro2", "retro3", "retro4"]:
    path = f"{HERE}/{sid}.json"; d = json.load(open(path))
    os.makedirs(f"{ROOT}/public/{sid}/src", exist_ok=True)
    for p in d["photos"]:
        raw = f"{ROOT}/public/{sid}/src/{p['sn']}.orig.jpg"; out = f"{ROOT}/public/{sid}/src/{p['sn']}.jpg"
        p.update(item(p["sn"], raw))
        subprocess.run(["convert", raw, "-auto-orient", "-resize", "1600x1600>"] + (["-auto-gamma", "-modulate", "105,105"] if p.get("fix") == "bright" else [])
                       + ["-quality", "90", out], check=True)
        os.remove(raw) if os.path.exists(out) else None
        ok = p["licence_code"] in LIC
        print(sid, p["sn"], "OK " if ok else "BAD", p["licence"], "|", p["author"], "|", p["year"], "|", p["title"])
    json.dump(d, open(path, "w"), ensure_ascii=False, indent=1)
