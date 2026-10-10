"""Mix the Odyssey soundtrack: the narration lines at their edit times over one Kevin MacLeod bed per scene.

usage: python3 mix.py <voice_dir> <out.wav>
- each bed is brought to the same loudness first (ffmpeg ebur128), then ducked to about -13 dB under the voice
  and -6 dB between lines; a scene that keeps the previous scene's track carries on without a restart, and a new
  track crossfades in over 2.5 s at the scene's start (looping if the track is shorter than the scene);
- the whole mix is then brought to -14 LUFS / -1.5 dBTP by render_odyssey.sh (two-pass loudnorm).
"""
import json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.normpath(f"{HERE}/../../public")
SR = 48000
BED_LUFS = -20.0
DUCK, FREE, XF = 10 ** (-11 / 20), 10 ** (-6 / 20), 2.5

def load(path, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()

def lufs(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], stderr=subprocess.PIPE, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])

def main():
    vdir, out = sys.argv[1], sys.argv[2]
    E = json.load(open(f"{HERE}/edit.json"))
    n = int(np.ceil(E["duration"] * SR)) + SR
    voice = np.zeros(n, np.float32)
    act = np.zeros(n, np.float32)
    for L in E["lines"]:
        x = load(f"{vdir}/voice/{L['file']}", 1)[:, 0]
        a = int(L["t"] * SR)
        voice[a:a + len(x)] += x
        act[a:a + len(x)] = 1
    # duck envelope: attack 0.25 s before speech, release 0.8 s after
    def box(x, w):  # moving sum over the last w samples (cumulative sums: fast on 18 minutes of audio)
        c = np.concatenate([[0.0], np.cumsum(x, dtype=np.float64)])
        i = np.arange(len(x))
        return c[i + 1] - c[np.maximum(0, i + 1 - w)]
    pre = box(act[::-1], int(0.25 * SR))[::-1] > 0
    post = box(act, int(0.8 * SR)) > 0
    env = (pre | post).astype(np.float64)
    w = int(0.25 * SR)
    env = (box(np.concatenate([env, np.zeros(w // 2)]), w) / w)[w // 2:].astype(np.float32)
    gain = FREE + (DUCK - FREE) * env
    # beds
    bed = np.zeros((n, 2), np.float32)
    segs = []  # (track, start, end)
    for c in E["chapters"]:
        if segs and segs[-1][0] == c["music"]:
            segs[-1][2] = c["end"]
        else:
            segs.append([c["music"], c["start"], c["end"]])
    cache = {}
    for i, (trk, t0, t1) in enumerate(segs):
        path = f"{PUB}/music/{trk}.mp3"
        if trk not in cache:
            m = load(path, 2)
            m *= 10 ** ((BED_LUFS - lufs(path)) / 20)
            cache[trk] = m
        m = cache[trk]
        a = int(max(0, t0 - (XF if i else 0)) * SR)
        b = min(n, int((t1 + (XF if i + 1 < len(segs) else 0)) * SR))
        L = b - a
        reps = int(np.ceil(L / len(m)))
        seg = np.concatenate([m] * reps)[:L].copy()
        f = int(XF * SR)
        if i:
            seg[:f] *= np.linspace(0, 1, f)[:, None]
        if i + 1 < len(segs):
            seg[-f:] *= np.linspace(1, 0, f)[:, None]
        else:
            fo = int(4.0 * SR)
            seg[-fo:] *= np.linspace(1, 0, fo)[:, None]
        bed[a:b] += seg
    mix = bed * gain[:, None] + voice[:, None]
    mix = mix[: int(E["duration"] * SR)]
    peak = np.abs(mix).max()
    if peak > 0.99:
        mix *= 0.99 / peak
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    print(out, f"{len(mix) / SR:.1f}s", len(segs), "music segments")

if __name__ == "__main__":
    main()
