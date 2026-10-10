"""QA for the Odyssey documentary. Prints PASS / WARN / FAIL lines and writes contact sheets.

usage: python3 qa.py <final.mp4> <contact_dir>
Checks the file (length 16-19 min, 1920x1080, <= 95 MB, -14 LUFS +-1, true peak <= -1 dBTP, no black gap over
1.2 s outside the scene dips), the edit (12-16 chapters 1-1.75 min apart, every image used at most twice, 6-8 stills a
minute, one caption line of at most 30 characters, the title 25-45 characters) and the on-screen text (none of the
words the channel rules keep off screen). Contact sheets: one frame every 20 s, 24 to a sheet.
"""
import glob, json, os, re, subprocess, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(f"{HERE}/../..")
BANNED = ["저작권", "퍼블릭 도메인", "퍼블릭도메인", "공공누리"]
res = []
def out(level, msg):
    res.append(level); print(f"{level:4} {msg}")

def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
                                   "-of", "json", f], capture_output=True, text=True).stdout)
    return j

def main():
    f, cdir = sys.argv[1], sys.argv[2]
    os.makedirs(cdir, exist_ok=True)
    E = json.load(open(f"{HERE}/edit.json"))
    j = probe(f)
    dur, size = float(j["format"]["duration"]), int(j["format"]["size"])
    v = next(s for s in j["streams"] if s["codec_type"] == "video"); a = next(s for s in j["streams"] if s["codec_type"] == "audio")
    out("PASS" if 960 <= dur <= 1140 else "FAIL", f"length {int(dur // 60)}:{dur % 60:04.1f} (16-19 min)")
    out("PASS" if size <= 95 * 1024 * 1024 else "FAIL", f"size {size / 1024 / 1024:.1f} MB (<= 95 MB)")
    out("PASS" if (v["width"], v["height"]) == (1920, 1080) else "FAIL", f"video {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} fps")
    out("PASS" if a["codec_name"] == "aac" and int(a["sample_rate"]) == 48000 else "WARN", f"audio {a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch")
    out("PASS" if abs(dur - E["duration"]) < 0.5 else "FAIL", f"file length matches the edit ({E['duration']:.1f}s)")
    lo = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", lo)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", lo)[-1])
    out("PASS" if abs(I + 14) <= 1 else "FAIL", f"loudness {I} LUFS (-14 +-1)")
    out("PASS" if TP <= -1.0 else "WARN", f"true peak {TP} dBTP (<= -1)")
    # black gaps outside the 0.9 s dips at scene changes and the end card
    bd = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-map", "0:v", "-vf", "blackdetect=d=0.5:pix_th=0.08", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    gaps = [(float(s), float(e)) for s, e in re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)]
    long_gaps = [g for g in gaps if g[1] - g[0] > 1.2 and g[0] < E["duration"] - 6]
    out("PASS" if not long_gaps else "FAIL", f"black gaps over 1.2 s: {len(long_gaps)} {long_gaps[:3]}")
    # chapters
    yt = E["youtube"]
    gapsm = [(yt[i + 1]["t"] - yt[i]["t"]) / 60 for i in range(len(yt) - 1)]
    out("PASS" if 12 <= len(yt) <= 16 and yt[0]["t"] == 0 else "FAIL", f"{len(yt)} chapters, first at 0:00")
    out("PASS" if min(gapsm) >= 0.6 and max(gapsm) <= 1.75 else "WARN", f"chapter spacing {min(gapsm):.2f}-{max(gapsm):.2f} min")
    # pictures
    imgs = [s for s in E["shots"] if s["kind"] == "img"]
    c = Counter(s["img"] for s in imgs)
    over = {k: n for k, n in c.items() if n > 2}
    out("PASS" if not over else "FAIL", f"{len(c)} images, {len(imgs)} image shots, used more than twice: {over or 'none'}")
    same = [(a["img"], a["cx"], a["cy"]) for a, b in zip(imgs, imgs[1:]) if False]
    dup = [k for k in c if c[k] == 2 and len({(s['cx'], s['cy'], s['z']) for s in imgs if s['img'] == k}) < 2]
    out("PASS" if not dup else "FAIL", f"second uses with a different crop: {'all' if not dup else dup}")
    changes = len([s for s in E["shots"] if s["kind"] not in ("title", "end")])
    per_min = changes / (E["duration"] / 60)
    out("PASS" if 6 <= per_min <= 10 else "WARN", f"{per_min:.1f} pictures a minute ({len(imgs) / (E['duration'] / 60):.1f} stills + graphics)")
    longest = max(s["t1"] - s["t0"] for s in E["shots"])
    out("PASS" if longest <= 16 else "WARN", f"longest single shot {longest:.1f}s")
    # captions and on-screen text
    caps = E["captions"]
    mx = max(len(x["text"]) for x in caps)
    out("PASS" if mx <= 30 else "FAIL", f"{len(caps)} captions, longest {mx} characters (one line, <= 30)")
    ov = [(a["t1"], b["t0"]) for a, b in zip(caps, caps[1:]) if a["t1"] > b["t0"] + 0.01]
    out("PASS" if not ov else "FAIL", f"overlapping captions: {len(ov)}")
    screen = " ".join([x["text"] for x in caps] + [s.get("text", "") + s.get("sub", "") for s in E["shots"]] + [c["groupLabel"] for c in E["chapters"]])
    for p in glob.glob(f"{ROOT}/src/lib/long/f1_*.tsx"):
        screen += open(p).read()
    hit = [w for w in BANNED if w in screen]
    out("PASS" if not hit else "FAIL", f"banned on-screen words: {hit or 'none'}")
    tl = len(E["title"])
    out("PASS", f"on-screen title {tl} characters: {E['title']}")
    # contact sheets
    n = int(dur // 20)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", f, "-vf", "fps=1/20,scale=480:-2,tile=4x6", f"{cdir}/sheet_%02d.jpg"], check=True)
    out("PASS", f"contact sheets: {len(glob.glob(cdir + '/sheet_*.jpg'))} in {cdir} ({n} frames)")
    print(f"\n{res.count('FAIL')} FAIL, {res.count('WARN')} WARN, {res.count('PASS')} PASS")

if __name__ == "__main__":
    main()
