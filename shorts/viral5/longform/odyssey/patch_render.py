"""Re-render only some frame windows of the Odyssey intermediate (out/odyssey/video.mp4) and splice them in.

Used once, after the scene-change dip stopped going fully black and the end card stopped fading to black: those
frames are the ~1 s around every scene start and the end card, so only they are rendered again.
usage: python3 longform/odyssey/patch_render.py           (then longform/odyssey/render_odyssey.sh <voice_dir>)
Keeps the old intermediate as out/odyssey/video_orig.mp4.
"""
import json, math, os, subprocess

V = os.path.normpath(os.path.dirname(os.path.abspath(__file__)) + "/../..")
W = f"{V}/out/odyssey"
BX = os.environ.get("CHROME", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
E = json.load(open(f"{V}/public/odyssey/edit.json"))
FR = math.ceil(E["duration"] * 30)
win = [(max(0, math.floor((c["start"] - 0.5) * 30)), min(FR - 1, math.ceil((c["start"] + 0.5) * 30))) for c in E["chapters"] if c["start"] > 0]
end = next(s for s in E["shots"] if s["kind"] == "end")
win.append((math.floor(end["t0"] * 30) - 15, FR - 1))
win.sort()
merged = []
for a, b in win:
    if merged and a <= merged[-1][1] + 1:
        merged[-1] = (merged[-1][0], max(b, merged[-1][1]))
    else:
        merged.append((a, b))
orig = f"{W}/video_orig.mp4"
if not os.path.exists(orig):
    os.replace(f"{W}/video.mp4", orig)
bundle = f"{W}/bundle"
if not os.path.exists(f"{bundle}/index.html"):
    subprocess.run(["npx", "remotion", "bundle", "src/index.ts", f"--out-dir={bundle}", "--log=error"], cwd=V, check=True)
for a, b in merged:
    p = f"{W}/patch_{a:05d}.mp4"
    if not os.path.exists(p):
        subprocess.run(["npx", "remotion", "render", bundle, "odyssey", p + ".tmp.mp4", f"--frames={a}-{b}", f"--browser-executable={BX}",
                        "--concurrency=3", "--crf=17", "--muted", "--log=error"], cwd=V, check=True)
        os.replace(p + ".tmp.mp4", p)
# splice: each kept stretch of the original is its own seeked input, so the concat filter reads them one after another
# (trimming one input 20 times buffers the whole film and runs out of memory)
inputs, labels, cur = [], [], 0
def keep(a, b):
    inputs.extend(["-ss", f"{a / 30:.6f}", "-t", f"{(b - a) / 30:.6f}", "-i", orig])
for a, b in merged:
    if a > cur:
        keep(cur, a)
    inputs.extend(["-i", f"{W}/patch_{a:05d}.mp4"])
    cur = b + 1
if cur < FR:
    keep(cur, FR)
n_in = inputs.count("-i")
fc = "".join(f"[{i}:v]setpts=PTS-STARTPTS,fps=30[v{i}];" for i in range(n_in)) + "".join(f"[v{i}]" for i in range(n_in)) + f"concat=n={n_in}:v=1:a=0[out]"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[out]",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", f"{W}/video.mp4"], check=True)
n = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0",
                        f"{W}/video.mp4"], capture_output=True, text=True).stdout.strip())
print(f"{len(merged)} windows re-rendered, {n} frames (edit: {FR})")
