"""QA for final/lfhorror1.mp4 (stand-in for the kit's qa_long.py): size, resolution, length, loudness, black frames,
frozen stretches, shot lengths from edit.json, and contact sheets (out/review/lfhorror1/sheet_*.jpg, one frame every 10 s).
usage: python3 longform/lfhorror1/qa.py
"""
import json, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(f"{HERE}/../..")
F = f"{ROOT}/final/lfhorror1.mp4"; R = f"{ROOT}/out/review/lfhorror1"; os.makedirs(R, exist_ok=True)
res = []
def rep(ok, name, val): res.append(("PASS" if ok else "FAIL", name, val)); print(f"{'PASS' if ok else 'FAIL'}  {name}: {val}")
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", F], capture_output=True, text=True).stdout)
v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]; a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
size = os.path.getsize(F) / 1024 / 1024; dur = float(pr["format"]["duration"])
rep(size <= 95, "size ≤ 95 MB", f"{size:.1f} MB")
rep(v["width"] == 1920 and v["height"] == 1080, "1920x1080", f"{v['width']}x{v['height']} {v['codec_name']} {a['codec_name']} {a.get('sample_rate')}Hz")
rep(780 <= dur <= 870, "length 13~14.5 min", f"{int(dur // 60)}:{dur % 60:04.1f}")
e = subprocess.run(["ffmpeg", "-nostdin", "-i", F, "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]); tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])
rep(abs(I + 14) <= 1, "loudness −14 LUFS ±1", f"{I} LUFS, true peak {tp} dBFS")
bd = subprocess.run(["ffmpeg", "-nostdin", "-i", F, "-vf", "blackdetect=d=0.05:pix_th=0.06", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)
rep(not blacks, "no black stretch ≥ 0.05 s", blacks[:5] or "none")
fz = subprocess.run(["ffmpeg", "-nostdin", "-i", F, "-vf", "freezedetect=n=0.001:d=6", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
frz = re.findall(r"freeze_start: ([\d.]+)", fz)
rep(len(frz) == 0, "no frozen picture ≥ 6 s", frz[:6] or "none")
ed = json.load(open(f"{HERE}/edit.json")); ds = [s["t1"] - s["t0"] for s in ed["shots"]]
rep(max(ds) <= 13, "new picture every ≤ 13 s", f"{len(ds)} shots, mean {sum(ds) / len(ds):.1f}s, longest {max(ds):.1f}s")
live = sum(s["t1"] - s["t0"] for s in ed["shots"] if s["k"] in ("v", "static")) / ed["end"]
rep(0.2 <= live <= 0.3, "live clips 20~30 %", f"{live:.0%}")
sl = subprocess.run(["ffmpeg", "-nostdin", "-i", F, "-af", "silencedetect=n=-50dB:d=1.5", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr
sil = re.findall(r"silence_start: ([\d.]+)", sl)
rep(not sil, "no silence > 1.5 s (−50 dB)", sil[:6] or "none")
# caption width: Pretendard ExtraBold 56 px ≈ 56 px per Hangul syllable, 0.55 em for Latin/digits/space; plus a speaker label
def cap_w(c):
    import re as _r
    t = _r.sub(r"[\[\]]", "", c["text"]); w = sum(56 if "가" <= ch <= "힣" else 31 for ch in t)
    return w + (0 if c["who"] in ("nar", "doc") else 4 * 40 + 14) + 52
wmax = max(ed["caps"], key=cap_w)
rep(cap_w(wmax) <= 1800, "captions fit one line (≤ 1800 px)", f"widest ≈ {cap_w(wmax)} px: {wmax['text']}")
words = " ".join(c["text"] for c in ed["caps"])
bad = [w for w in ("저작권", "퍼블릭 도메인", "공공누리", "실화", "레딧") if w in words]
rep(not bad, "no banned words on screen", bad or "none")
rep(len(ed["chapters"]) >= 3 and ed["chapters"][0][0] == "0:00", "chapters from 0:00", " / ".join(f"{a} {b}" for a, b in ed["chapters"]))
for k in range(0, int(dur), 480):  # one frame every 30 s, 16 per sheet
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(k), "-t", "480", "-i", F, "-vf", "fps=1/30,scale=480:270,tile=4x4", "-frames:v", "1", f"{R}/sheet30_{k // 480}.jpg"])
for k in range(0, int(dur), 160):  # one frame every 10 s
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(k), "-t", "160", "-i", F, "-vf", "fps=1/10,scale=384:216,tile=4x4", "-frames:v", "1", f"{R}/sheet_{k // 160}.jpg"])
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", F, "-frames:v", "1", f"{R}/first.jpg"])
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-sseof", "-0.2", "-i", F, "-update", "1", f"{R}/last.jpg"])
import PIL.Image as _I
lm = sum(_I.open(f"{R}/last.jpg").convert("L").getdata()) / (1920 * 1080)
rep(lm > 8, "last frame not black", f"mean luma {lm:.0f}")
n = sum(r[0] == "FAIL" for r in res); print(f"\n{n} FAIL, {len(res) - n} PASS")
