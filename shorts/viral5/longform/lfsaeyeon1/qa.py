"""lfsaeyeon1 QA (used until the kit's qa_long.py runs on it): PASS/WARN/FAIL lines plus contact sheets.

checks final/lfsaeyeon1.mp4 (size, resolution, length, loudness, true peak, black frames, frozen picture),
src/data/lfsaeyeon1.json (cut rhythm, caption length, chapters) and every on-screen text for banned words.
Sheets: out/review/lfsaeyeon1/sheet_<n>.jpg, one frame every 30 s, 4×4 per sheet.

usage: python3 longform/lfsaeyeon1/qa.py
"""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SID = "lfsaeyeon1"
MP4, THUMB = f"{ROOT}/final/{SID}.mp4", f"{ROOT}/final/{SID}-thumb.jpg"
res = []
def out(level, what, detail):
    res.append(level); print(f"{level:4s} {what}: {detail}")
def check(ok, what, detail, warn=False):
    out("PASS" if ok else ("WARN" if warn else "FAIL"), what, detail)

probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", MP4]))
v = next(s for s in probe["streams"] if s["codec_type"] == "video")
dur, size = float(probe["format"]["duration"]), os.path.getsize(MP4)
check(v["width"] == 1920 and v["height"] == 1080, "resolution", f"{v['width']}x{v['height']}")
check(size <= 95e6, "size", f"{size / 1e6:.1f} MB (≤ 95)")
check(600 <= dur <= 660, "length", f"{dur:.1f} s (10–11 min)")
ebu = subprocess.run(["ffmpeg", "-hide_banner", "-i", MP4, "-af", "ebur128=peak=true", "-f", "null", "-"], stderr=subprocess.PIPE, text=True).stderr
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", ebu)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", ebu)[-1])
check(abs(I + 14) <= 1, "loudness", f"{I} LUFS (−14 ±1)")
check(TP <= -1.0, "true peak", f"{TP} dBTP (≤ −1)")
bd = subprocess.run(["ffmpeg", "-hide_banner", "-i", MP4, "-vf", "blackdetect=d=0.05:pix_th=0.10", "-an", "-f", "null", "-"], stderr=subprocess.PIPE, text=True).stderr
blacks = re.findall(r"black_start:([\d.]+)", bd)
check(not blacks, "black frames", f"{len(blacks)} runs ≥ 0.05 s" + (f" at {blacks[:5]}" if blacks else ""))
fz = subprocess.run(["ffmpeg", "-hide_banner", "-i", MP4, "-vf", "freezedetect=n=0.001:d=12", "-an", "-f", "null", "-"], stderr=subprocess.PIPE, text=True).stderr
freezes = re.findall(r"freeze_start: ([\d.]+)", fz)
check(not freezes, "frozen picture", f"{len(freezes)} stills ≥ 12 s" + (f" at {freezes[:5]}" if freezes else ""))
sil = subprocess.run(["ffmpeg", "-hide_banner", "-i", MP4, "-af", "silencedetect=n=-45dB:d=1.5", "-vn", "-f", "null", "-"], stderr=subprocess.PIPE, text=True).stderr
sils = re.findall(r"silence_start: ([\d.]+)", sil)
check(not sils, "silence > 1.5 s", f"{len(sils)} gaps (below −45 dB)" + (f" at {sils[:5]}" if sils else ""))
last = subprocess.run(["ffmpeg", "-v", "error", "-sseof", "-0.1", "-i", MP4, "-frames:v", "1", "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE).stdout
check(len(last) and sum(last) / len(last) > 40, "last frame", f"mean luma {sum(last) / max(1, len(last)):.0f} (not black)")
tp = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", THUMB]))["streams"][0]
check((tp["width"], tp["height"]) == (1280, 720), "thumbnail", f"{tp['width']}x{tp['height']} final/{SID}-thumb.jpg")

D = json.load(open(f"{ROOT}/src/data/{SID}.json"))
pics, last = [], None
for c in D["cuts"]:
    if not c["g"].get("hold") or last is None:
        pics.append([c["from"], c["dur"]]); last = c
    else:
        pics[-1][1] += c["dur"]
lens = [d for _, d in pics]
check(60 <= len(pics) <= 100, "pictures", f"{len(pics)} new pictures (60–100), one every {D['end'] / len(pics):.1f} s")
longest = max(pics, key=lambda p: p[1])
check(longest[1] <= 16, "longest picture", f"{longest[1]:.1f} s at {longest[0]:.0f} s", warn=True)
caps = [len(c["text"]) for c in D["caps"]]
# the caption is one line, shrunk to fit 1500 px if needed: measured at 66 px Pretendard Black, a Hangul syllable is ~0.95 em
wide = [c for c in D["caps"] if len(c["text"]) * 66 * 0.95 > 1500]
check(max(caps) <= 30, "caption length", f"longest page {max(caps)} chars; {len(wide)} pages shrink below 66 px to stay inside 1500 px, none overflow")
ch = D["chapters"]
secs = [int(a) * 60 + int(b) for a, b in (t.split(":") for t, _ in ch)]
check(ch[0][0] == "0:00" and len(ch) >= 3 and all(b - a >= 10 for a, b in zip(secs, secs[1:])), "chapters", ", ".join(f"{t} {n}" for t, n in ch))
nar = sum(len(re.sub(r"\W", "", l["say"])) for l in json.load(open(f"{HERE}/script.json"))["lines"] if l["voice"] == "nar")
alls = sum(len(re.sub(r"\W", "", l["say"])) for l in json.load(open(f"{HERE}/script.json"))["lines"])
nl = sum(1 for l in D["lines"] if l["voice"] != "nar")
check(True, "dialogue : narration", f"lines {nl}:{len(D['lines']) - nl}, characters {alls - nar}:{nar}")
texts = json.dumps(D, ensure_ascii=False) + open(f"{ROOT}/src/lib/long/{SID}_thumb.tsx").read() + open(f"{ROOT}/src/lib/long/{SID}_set.tsx").read()
bad = [w for w in ("저작권", "퍼블릭 도메인", "공공누리", "썰툰", "야담", "참교육") if w in texts]
check(not bad, "banned words on screen", ", ".join(bad) or "none")

os.makedirs(f"{ROOT}/out/review/{SID}", exist_ok=True)
for n, start in enumerate(range(0, int(dur), 480)):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", "480", "-i", MP4, "-vf", "fps=1/30,scale=480:-1,tile=4x4", "-frames:v", "1",
                    f"{ROOT}/out/review/{SID}/sheet_{n}.jpg"], check=True)
print(f"sheets: out/review/{SID}/sheet_*.jpg")
print(f"\n{res.count('FAIL')} FAIL, {res.count('WARN')} WARN, {res.count('PASS')} PASS")
sys.exit(1 if "FAIL" in res else 0)
