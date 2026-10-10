#!/usr/bin/env python3
"""Rebuild the git-ignored clip files of the top1..top8 shorts from their sidecar JSONs.

    python3 media/fetch_top.py                 # build every missing media/top1..top8/<name>.mp4
    python3 media/fetch_top.py top4 top7       # only these shorts
    python3 media/fetch_top.py --force top2/cake_slice
    python3 media/fetch_top.py --verify        # only check politics/topN/edit.json "out" against the files
Existing files are skipped (use --force to rebuild). Other topN folders work too when named explicitly.

Each media/topN/<name>.json describes one file (media/topN/<basename of "file">.mp4):
  * "cut_from_original_seconds": [a, b] or [[a, b], [c, d]]  -> download file_url, cut, 1920x1080,
    30 fps, H.264 CRF 18, AAC audio unless the JSON says the audio was removed/dropped.
  * no cut (Pexels/Pixabay, top1/top2)                        -> whole file, 30 fps, size from "resolution".
  * top4 ISS time-lapses                                       -> rebuilt from the ISS frames named in file_url.
  * top4 earthset                                              -> 7 s slow zoom (1.0 -> 1.08) on the NASA photo.
Per-clip special treatment described in the JSON notes is in SPECIAL below.
Needs python3, curl, ffmpeg, ffprobe. Temp files go to /tmp/claude-0/topfetch/ (removed at the end).
"""
import concurrent.futures as cf
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse

DEFAULT = [f"top{n}" for n in range(1, 9)]                  # the shorts this script covers by default
HERE = os.path.dirname(os.path.abspath(__file__))           # .../viral5/media
ROOT = os.path.dirname(HERE)                                 # .../viral5
TMP = os.environ.get("TOPFETCH_TMP", "/tmp/claude-0/topfetch")
UA = "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
FPS = 30
X264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]

# Per-file treatment that the JSON notes describe in prose.
SPECIAL = {
    # 3840x2160 Commons transcode; 2880x1620 window at x=173,y=270 (1.33x zoom) so the fall sits at x~0.5
    "yosemite_falls": {"crop": "2880:1620:173:270"},
    # 640x480 source with the ROV data line at the top: 640x360 band at y=56, then 3x up
    "eruption_brimstone_pit": {"crop": "640:360:0:56"},
    # letterboxed 1420x1080: two pieces joined, cropped 1420x798 (y=150), slowed to 0.771x with blended frames
    "supercell_mothership": {"crop": "1420:798:0:150", "speed": 0.771, "blend": True},
}


def log(*a):
    print(*a, flush=True)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        raise RuntimeError(f"{cmd[0]} failed ({r.returncode}): {' '.join(map(str, cmd))[:300]}\n{r.stderr[-1500:]}")
    return r.stdout


def curl(url, out, ua=UA, tries=6):
    """Download url to out; retries with backoff on 429/5xx/network errors. Returns final URL."""
    delay = 5
    for i in range(tries):
        r = subprocess.run(["curl", "-sS", "-L", "--fail", "-A", ua, "--connect-timeout", "30", "--speed-time", "60", "--speed-limit", "1000",
                            "-o", out, "-w", "%{http_code} %{url_effective}", url], capture_output=True, text=True)
        if r.returncode == 0 and os.path.getsize(out) > 0:
            return r.stdout.split(" ", 1)[1]
        code = r.stdout.split(" ", 1)[0] if r.stdout else "?"
        if code in ("404", "410", "403") and i >= 1:
            break
        log(f"    retry {i + 1} ({code}) {url[:100]}")
        time.sleep(delay)
        delay = min(delay * 2, 60)
    if os.path.exists(out):
        os.remove(out)
    raise RuntimeError(f"download failed: {url}")


def fetch_text(url, ua=UA):
    tmp = os.path.join(TMP, "page.html")
    curl(url, tmp, ua)
    with open(tmp, encoding="utf-8", errors="replace") as f:
        s = f.read()
    os.remove(tmp)
    return s


def probe(path):
    d = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
                        "-of", "json", path]))
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), {})
    return {"duration": float(d["format"].get("duration", 0)), "w": v.get("width"), "h": v.get("height"),
            "fps": v.get("r_frame_rate"), "audio": any(s["codec_type"] == "audio" for s in d["streams"])}


def first_url(s):
    m = re.search(r"https?://\S+", s)
    return m.group(0) if m else None


def commons_file_url(text):
    """Original-file URL of the Wikimedia Commons file named in text (a File: page URL), via the API."""
    name = re.search(r"File:(.+?\.(?:webm|ogv|mp4|mov|jpe?g|png|tiff?))", text, re.I).group(1)
    name = urllib.parse.unquote(name).replace("_", " ")
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles="
           + urllib.parse.quote("File:" + name))
    for p in json.loads(fetch_text(api))["query"]["pages"].values():
        return p["imageinfo"][0]["url"]
    raise RuntimeError("commons lookup failed: " + name)


def commons_transcode_url(name):
    """URL of the Commons transcode of File:name whose height equals the original's (else the largest)."""
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=videoinfo"
           "&viprop=url%7Csize%7Cderivatives&titles=" + urllib.parse.quote("File:" + name.replace("_", " ")))
    for p in json.loads(fetch_text(api))["query"]["pages"].values():
        vi = p["videoinfo"][0]
        der = [d for d in vi["derivatives"] if "/transcoded/" in d["src"] and d.get("height")]
        der = [d for d in der if d["height"] == vi["height"]]
        der.sort(key=lambda d: "vp9" in d["src"])
        return der[-1]["src"] if der else None
    raise RuntimeError("commons transcode lookup failed: " + name)


def download_source(meta, dest):
    """Download the source video named in the JSON to dest. Returns the URL actually used."""
    fu = meta["file_url"]
    url = first_url(fu)
    if "flickr.com/photos/" in url and "/play/" in url:
        # Flickr play URLs need the photo's secret: /play/<size>/<secret>/
        m = re.match(r"(https://www\.flickr\.com/photos/[^/]+/\d+)/play/([^/]+)/?", url)
        base, size = m.group(1), m.group(2)
        try:
            page = fetch_text(meta.get("page_url") or base + "/")
            secret = re.search(r'"secret":"([0-9a-f]+)"', page).group(1)
            u = f"{base}/play/{size}/{secret}/"
            return curl(u, dest)
        except Exception as e:  # fall back to the Commons copy named in file_url
            log(f"    flickr failed ({str(e).splitlines()[0]})")
            if "commons.wikimedia.org/wiki/File:" not in fu:
                raise
            u = commons_file_url(fu.split("commons.wikimedia.org/wiki/", 1)[1])
            return curl_patient(u, dest)
    if "pexels.com/download/" in url:
        try:
            return curl(url, dest)
        except RuntimeError:
            return curl(url, dest, ua=BROWSER_UA)
    if "upload.wikimedia.org" in url and "/transcoded/" not in url:
        # originals on upload.wikimedia.org are often rate-limited (HTTP 429, Retry-After 600) for cache misses;
        # then use Commons' own transcode of the same file at the original resolution (same timeline)
        try:
            return curl(url, dest, tries=3)
        except RuntimeError:
            alt = commons_transcode_url(urllib.parse.unquote(url.rsplit("/", 1)[1]))
            if alt:
                log(f"    original rate-limited, using Commons transcode {alt.rsplit('.', 3)[-3]}")
                url = alt
    if "upload.wikimedia.org" in url:
        return curl_patient(url, dest)
    return curl(url, dest)


def curl_patient(url, dest, rounds=12, wait=150):
    """upload.wikimedia.org answers 429 (Retry-After 600) to bursts of cache misses: wait it out."""
    for i in range(rounds):
        try:
            return curl(url, dest, tries=2)
        except RuntimeError:
            log(f"    rate-limited by upload.wikimedia.org; waiting {wait} s ({i + 1}/{rounds})")
            time.sleep(wait)
    raise RuntimeError("upload.wikimedia.org kept answering 429: " + url)


def parse_res(s, src_w, src_h):
    m = re.search(r"(\d+)\s*x\s*(\d+)", s or "")
    if m:
        return int(m.group(1)), int(m.group(2))
    return (1080, 1920) if src_h > src_w else (1920, 1080)


def drop_audio(meta):
    a = (meta.get("audio") or "").lower()
    return a.strip() == "none" or "removed" in a or "dropped" in a


def cover(w, h):
    return f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},setsar=1"


def build_video(name, meta, out, work):
    src = os.path.join(work, name + ".src")
    used = download_source(meta, src)
    info = probe(src)
    log(f"    source {info['w']}x{info['h']} {info['fps']} {info['duration']:.2f}s audio={info['audio']}  <- {used[:110]}")
    sp = SPECIAL.get(name, {})
    keep_audio = info["audio"] and not drop_audio(meta)
    cut = meta.get("cut_from_original_seconds")
    if cut is None:                                    # whole file (Pexels / Pixabay)
        w, h = parse_res(meta.get("resolution"), info["w"], info["h"])
        vf = f"fps={FPS},{cover(w, h)}"
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf, *X264]
        cmd += ["-c:a", "aac", "-b:a", "192k"] if keep_audio else ["-an"]
        run(cmd + [out])
    else:
        pieces = cut if isinstance(cut[0], list) else [cut]
        pre = f"crop={sp['crop']}," if "crop" in sp else ""
        parts, n = [], len(pieces)
        for i, (a, b) in enumerate(pieces):
            parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
            if keep_audio:
                parts.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[a{i}]")
        if keep_audio:
            parts.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vc][ac]")
        else:
            parts.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[vc]")
        speed = sp.get("speed", 1.0)
        chain = f"[vc]{pre}"
        if speed != 1.0:
            chain += f"setpts=PTS/{speed},"
        chain += (f"framerate=fps={FPS}" if sp.get("blend") else f"fps={FPS}") + f",{cover(1920, 1080)}[vo]"
        parts.append(chain)
        maps = ["-map", "[vo]"]
        if keep_audio:
            atempo = f"atempo={speed}," if speed != 1.0 else ""
            parts.append(f"[ac]{atempo}aresample=48000[ao]")
            maps += ["-map", "[ao]", "-c:a", "aac", "-b:a", "192k"]
        total = sum(b - a for a, b in pieces) / speed
        run(["ffmpeg", "-y", "-v", "error", "-i", src, "-filter_complex", ";".join(parts), *maps, *X264,
             "-t", f"{total:.3f}", out])
    os.remove(src)


def build_iss(name, meta, out, work):
    fu = meta["file_url"]
    m = re.search(r"(https://\S+/)(ISS\d+)-E-(\d+)\.JPG\s*…\s*ISS\d+-E-(\d+)\.JPG.*?(\d+)\s*fps", fu)
    base, mission, a, b, fps = m.group(1), m.group(2), int(m.group(3)), int(m.group(4)), int(m.group(5))
    fdir = os.path.join(work, name + "_frames")
    os.makedirs(fdir, exist_ok=True)

    def get(num):
        dest = os.path.join(fdir, f"{num}.jpg")
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            return num, dest
        for variant in ("large", "highres", "lores"):
            u = re.sub(r"/ESC/[^/]+/", f"/ESC/{variant}/", base) + f"{mission}-E-{num}.JPG"
            try:
                curl(u, dest, tries=3)
                return num, dest
            except RuntimeError:
                continue
        return num, None

    with cf.ThreadPoolExecutor(6) as ex:
        got = sorted(ex.map(get, range(a, b + 1)))
    frames = [p for _, p in got if p]
    missing = [n for n, p in got if not p]
    if missing:
        log(f"    WARNING missing frames: {missing}")
    seq = os.path.join(fdir, "seq")
    os.makedirs(seq, exist_ok=True)
    for i, p in enumerate(frames):
        os.link(p, os.path.join(seq, f"{i:05d}.jpg"))
    log(f"    {len(frames)} frames ({mission}-E-{a}..{b}) at {fps} fps -> {len(frames) / fps:.2f}s")
    vf = f"{cover(1920, 1080)},fps={FPS},format=yuv420p"
    run(["ffmpeg", "-y", "-v", "error", "-framerate", str(fps), "-i", os.path.join(seq, "%05d.jpg"), "-vf", vf, *X264,
         "-an", out])
    shutil.rmtree(fdir)


def build_zoom(name, meta, out, work, seconds=7.0, z1=1.08):
    src = os.path.join(work, name + ".jpg")
    curl(first_url(meta["file_url"]), src)
    n = int(round(seconds * FPS))
    # 16:9 centre crop of the photo, slow centred zoom 1.0 -> z1 rendered at 4K then downscaled (smooth)
    vf = (f"crop=iw:iw*9/16,scale=5760:3240:flags=lanczos,"
          f"zoompan=z='1+{z1 - 1}*on/{n - 1}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={n}:s=3840x2160:fps={FPS},"
          f"scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p")
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf, "-frames:v", str(n), *X264, "-an", out])
    os.remove(src)


def build(jpath, force=False):
    meta = json.load(open(jpath, encoding="utf-8"))
    name = os.path.splitext(os.path.basename(meta["file"]))[0]
    out = os.path.join(os.path.dirname(jpath), name + ".mp4")
    if os.path.exists(out) and not force:
        return out, "exists"
    work = os.path.join(TMP, os.path.basename(os.path.dirname(jpath)))
    os.makedirs(work, exist_ok=True)
    part = out + ".part.mp4"
    log(f"[{os.path.relpath(out, HERE)}]")
    fu = meta.get("file_url", "")
    if re.search(r"ISS\d+-E-\d+\.JPG", fu):
        build_iss(name, meta, part, work)
    elif re.search(r"\.jpe?g", fu, re.I) and "slow zoom" in fu:
        build_zoom(name, meta, part, work)
    else:
        build_video(name, meta, part, work)
    os.replace(part, out)
    return out, "built"


def edit_needs(shorts):
    """{"topN/name.mp4": [(edit.json, in, out), ...]} from politics/topN/edit.json segments."""
    need = {}
    for e in [os.path.join(ROOT, "politics", t, "edit.json") for t in shorts]:
        if not os.path.exists(e):
            continue
        for s in json.load(open(e, encoding="utf-8")).get("segments", []):
            if "out" in s:
                need.setdefault(s["src"], []).append((os.path.relpath(e, ROOT), s["in"], s["out"]))
    return need


def verify(shorts):
    bad = 0
    for src, segs in sorted(edit_needs(shorts).items()):
        p = os.path.join(HERE, src)
        if not os.path.exists(p):
            log(f"MISSING {src}")
            bad += 1
            continue
        i = probe(p)
        mx = max(o for _, _, o in segs)
        ok = mx <= i["duration"] + 1e-3
        bad += not ok
        log(f"{'ok ' if ok else 'BAD'} {src:45s} {i['w']}x{i['h']} {i['fps']:>6s} {i['duration']:6.2f}s  max out {mx:5.2f}"
            f"  audio={'y' if i['audio'] else 'n'}")
    return bad


def main(argv):
    force = "--force" in argv
    sel = [a.strip("/") for a in argv if not a.startswith("--")] or DEFAULT
    if "--verify" not in argv:
        os.makedirs(TMP, exist_ok=True)
        jsons = sorted(glob.glob(os.path.join(HERE, "top[0-9]*", "*.json")))
        # "top4" selects media/top4/*.json, "top2/cake" selects media/top2/cake*.json
        jsons = [j for j in jsons
                 if any(os.path.relpath(j, HERE).startswith(s if "/" in s else s + "/") for s in sel)]
        failed = []
        for j in jsons:
            try:
                out, st = build(j, force)
                if st == "built":
                    i = probe(out)
                    log(f"    -> {i['w']}x{i['h']} {i['fps']} {i['duration']:.2f}s audio={i['audio']}")
            except Exception as e:
                failed.append(os.path.relpath(j, HERE))
                log(f"    FAILED {os.path.relpath(j, HERE)}: {e}")
        shutil.rmtree(TMP, ignore_errors=True)
        if failed:
            log("failed: " + ", ".join(failed))
    bad = verify(sorted({s.split("/")[0] for s in sel}))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
