"""Replace frame ranges of a master with re-rendered patches (no full re-render); keeps the master's audio.
usage: python3 longform/lfhorror1/splice.py <master in> <master out> <a-b> [<a-b> ...]   (frames, inclusive; renders the patches itself)
"""
import os, subprocess, sys
ROOT = os.path.abspath(os.path.dirname(__file__) + "/../.."); os.chdir(ROOT)
src, dst, ranges = sys.argv[1], sys.argv[2], sorted(tuple(map(int, r.split("-"))) for r in sys.argv[3:])
T = "build/lfhorror1/splice"; os.makedirs(T, exist_ok=True)
enc = ["-an", "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30"]
nfr = int(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip().strip(","))
parts, pos = [], 0
def keep(a, b, name):
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{a / 30:.6f}", "-i", src, "-frames:v", str(b - a), *enc, f"{T}/{name}.mp4"], check=True); parts.append(f"{name}.mp4")
for k, (a, b) in enumerate(ranges):
    if a > pos: keep(pos, a, f"k{k}")
    subprocess.run(["npx", "remotion", "render", "src/lib/long/lfhorror1_entry.tsx", "lfhorror1", f"{T}/raw{k}.mp4", f"--frames={a}-{b}", "--crf=16", "--muted", "--log=error"], check=True)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", f"{T}/raw{k}.mp4", *enc, f"{T}/p{k}.mp4"], check=True); parts.append(f"p{k}.mp4")
    pos = b + 1
if pos < nfr: keep(pos, nfr, "kend")
open(f"{T}/list.txt", "w").write("".join(f"file '{p}'\n" for p in parts))
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{T}/list.txt", "-i", src, "-map", "0:v", "-map", "1:a", "-c", "copy", dst], check=True)
print(subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", dst], capture_output=True, text=True).stdout, "frames (was", nfr, ")")
