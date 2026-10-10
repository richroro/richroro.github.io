"""Fetch every source file one info short uses into public/<id>/src/ (the footage is not committed).

usage: python3 media/info2/fetch_src.py <id> [<id> ...]
The download address comes from the source's "fileUrl" in shorts/<id>/edit.json, else from the sidecar records under media/
(by file name), else from the page address (Pexels video/photo ids). Videos are re-encoded to 1080p, silent clips keep no
audio; life3's driving clips get the lower 42 % blurred (licence plates), as in the first build. Photos are copied as is.
Requests go out one at a time with a generic user agent; Wikimedia answers 429 when asked too fast, so it is retried slowly.
"""
import glob, json, os, re, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
BLUR = {"px36017323.mp4", "px36108436.mp4", "px35186893.mp4"}  # life3: plates unreadable

def sidecar_urls():
    out = {}
    def walk(x):
        if isinstance(x, dict):
            f = x.get("file"); u = x.get("fileUrl") or x.get("file_url") or x.get("download")
            if isinstance(f, str) and isinstance(u, str) and u.startswith("http"): out.setdefault(os.path.basename(f), u)
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    for p in glob.glob(f"{HERE}/media/**/*.json", recursive=True):
        try: walk(json.load(open(p)))
        except Exception: pass
    return out

def url_for(s, side):
    if s.get("fileUrl", "").startswith("http"): return s["fileUrl"]
    if os.path.basename(s["file"]) in side: return side[os.path.basename(s["file"])]
    page = s.get("url", "")
    m = re.search(r"pexels\.com/video/.*?(\d+)/?$", page)
    if m: return f"https://www.pexels.com/download/video/{m.group(1)}/"
    m = re.search(r"pexels\.com/photo/.*?(\d+)/?$", page)
    if m: return f"https://images.pexels.com/photos/{m.group(1)}/pexels-photo-{m.group(1)}.jpeg?w=1920"
    if "pixabay.com/videos/" in page and "131012" in page: return "https://cdn.pixabay.com/video/2022/09/12/131012-748849022_large.mp4"
    m = re.search(r"commons\.wikimedia\.org/wiki/(File:.+)$", page)
    if m: return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(urllib.parse.unquote(m.group(1))[5:])
    return None

def candidates(url):
    """Wikimedia throttles full-size originals from shared addresses: try its transcodes and standard thumbnails too"""
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w)/(\w\w)/([^/?]+)$", url)
    if not m: return [url]
    a, b, name = m.groups()
    if re.search(r"\.(webm|ogv)$", name, re.I):
        t = f"https://upload.wikimedia.org/wikipedia/commons/transcoded/{a}/{b}/{name}/{name}"
        return [t + ".1080p.vp9.webm", t + ".720p.vp9.webm", url]
    th = f"https://upload.wikimedia.org/wikipedia/commons/thumb/{a}/{b}/{name}/"
    return [url] + [th + f"{w}px-{name}" for w in (3840, 1920, 1280)]

def get(url, dst):
    for k in range(10):
        for u in candidates(url):
            r = subprocess.run(["curl", "-sS", "-L", "-A", UA, "--max-time", "900", "-o", dst, "-w", "%{http_code}", u], capture_output=True, text=True)
            code = r.stdout.strip()
            if code == "200" and os.path.getsize(dst) > 1000: return True
            print(f"  {code}: {u[:110]}"); time.sleep(4)
        time.sleep(10 * (k + 1))
    return False

def fetch(sid):
    e = json.load(open(f"{HERE}/shorts/{sid}/edit.json")); side = sidecar_urls()
    dst_dir = f"{HERE}/public/{sid}/src"; os.makedirs(dst_dir, exist_ok=True); tmp = f"{HERE}/build/dl"; os.makedirs(tmp, exist_ok=True)
    for key, s in e["sources"].items():
        f = s.get("file")
        if not f or (os.path.exists(f"{dst_dir}/{f}") and os.path.getsize(f"{dst_dir}/{f}") > 10000): continue
        url = url_for(s, side)
        if not url or not url.startswith("http"): print(f"{sid} {key}: no download address for {f} ({url})"); continue
        raw = f"{tmp}/{f}.dl"
        if not get(url, raw): print(f"{sid} {key}: FAILED {url}"); continue
        if not f.lower().endswith(".mp4") and not re.search(r"\.(jpe?g|png|webp)$", f, re.I):  # webm/ogv: kept as downloaded (prep.py cuts from it)
            os.replace(raw, f"{dst_dir}/{f}")
        elif re.search(r"\.(jpe?g|png|webp)$", f, re.I):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-vf", "scale='min(2400,iw)':-2", "-q:v", "2", f"{dst_dir}/{f}"], check=True) if f.lower().endswith((".jpg", ".jpeg")) else os.replace(raw, f"{dst_dir}/{f}")
        else:
            vf = "scale=-2:'min(1080,ih)',fps=30"
            if f in BLUR: vf = "[0]scale=-2:1080,fps=30,split[a][b];[b]crop=iw:ih*0.42:0:ih*0.5,gblur=sigma=5[c];[a][c]overlay=0:H*0.5"
            args = ["ffmpeg", "-v", "error", "-y", "-i", raw] + (["-filter_complex", vf] if f in BLUR else ["-vf", vf])
            args += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]
            args += (["-an"] if f.startswith("px") else ["-c:a", "aac", "-b:a", "160k"])
            subprocess.run(args + [f"{dst_dir}/{f}"], check=True)
        if os.path.exists(raw): os.remove(raw)
        print(f"{sid} {key}: {f}")
        time.sleep(1.5)

for sid in sys.argv[1:]: fetch(sid)
