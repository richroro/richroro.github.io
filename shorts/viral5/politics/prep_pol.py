"""Build one political clip short from a 국회방송 (NATV) clip: real audio, captions from the transcript,
face-centred close-ups, a two-line title and the source credit.

usage: python3 prep_pol.py <id>        e.g. pol1
Reads   politics/<id>/edit.json, politics/<id>/transcript.json (from transcribe.py), $MEDIA/<src>
Writes  public/<id>/clips/*.mp4 and src/data/<id>.json, then refreshes src/data/index.ts

edit.json:
  src            clip path inside $MEDIA (default ../media, the helper's media/ folder)
  title          [line 1, line 2]
  segments       [{"in": s, "out": s, "label": "speaker", "zoom": 1.6, "face": [cx, cy] (optional, else detected)}]
  keys           words to show in yellow
  fix            [[wrong, right], ...] text fixes applied to caption words (ASR slips)
  captions       "vtt" or "asr" (default: vtt when the transcript has it)
  stickers, music, sfx, punches, flashes   as in ../shorts/<id>/edit.json, but times are output seconds
"""
import json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(HERE)
MEDIA = os.environ.get("MEDIA", f"{V}/media")
FPS = 30
SYL = re.compile(r"[가-힣A-Za-z0-9]")

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                         stdout=subprocess.PIPE, text=True, check=True).stdout.strip().split(",")
    return int(out[0]), int(out[1])

def face_center(path, t0, t1):
    """median centre and height of the largest frontal face over the segment, in 0..1 units"""
    import cv2
    det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(path); pts = []
    for t in np.arange(t0, t1, 0.4):
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000); ok, fr = cap.read()
        if not ok: continue
        h, w = fr.shape[:2]; g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
        faces = det.detectMultiScale(g, 1.15, 5, minSize=(int(h * 0.08), int(h * 0.08)))
        if len(faces):
            x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            pts.append(((x + fw / 2) / w, (y + fh / 2) / h, fh / h))
    cap.release()
    if not pts: return None
    a = np.array(pts); return [float(np.median(a[:, 0])), float(np.median(a[:, 1])), float(np.median(a[:, 2]))]

def speech_env(path, n_frames, offset_frames):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], stdout=subprocess.PIPE, check=True).stdout
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768; hop = 16000 // FPS
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    out = np.zeros(n_frames); k = min(len(e), n_frames - offset_frames)
    if k > 0: out[offset_frames:offset_frames + k] = e[:k]
    return out

def main(sid):
    ed = json.load(open(f"{HERE}/{sid}/edit.json")); tr = json.load(open(f"{HERE}/{sid}/transcript.json"))
    src = f"{MEDIA}/{ed['src']}"; W, H = probe(src)
    pub = f"{V}/public/{sid}"; os.makedirs(f"{pub}/clips", exist_ok=True)
    mode = ed.get("captions") or ("vtt" if tr.get("vtt") else "asr")
    words = [dict(w) for w in tr[mode]]
    for w in words:
        for a, b in ed.get("fix", []): w["w"] = w["w"].replace(a, b)

    clips, pages, at, stickers = [], [], 0.0, []
    total = sum(s["out"] - s["in"] for s in ed["segments"])
    n_frames = int(np.ceil((total + ed.get("tail", 0.6)) * FPS)) + 1; env = np.zeros(n_frames)
    for k, s in enumerate(ed["segments"]):
        dur = s["out"] - s["in"]; out = f"{pub}/clips/c{k:02d}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["in"]), "-t", f"{dur:.3f}", "-i", src, "-vf", "fps=30",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out], check=True)
        f = s.get("face") or face_center(src, s["in"], s["out"])
        cx, cy = (f[0], f[1]) if f else (0.5, 0.4)
        zoom = s.get("zoom") or (min(2.2, max(1.2, 0.36 / f[2])) if f and len(f) > 2 else 1.4)
        clips.append({"file": f"{sid}/clips/c{k:02d}.mp4", "label": s.get("label", ""), "at": round(at, 3), "dur": round(dur, 3), "speed": 1.0,
                      "frame": ed.get("frame", "square"), "zoom": [1.0, 1.05], "focus": "50% 50%", "audio": 1.0,
                      "crop": {"cx": round(cx, 3), "cy": round(cy, 3), "zoom": round(zoom, 2), "w": W, "h": H}})
        env = np.maximum(env, speech_env(out, n_frames, int(round(at * FPS))))
        if s.get("label"):
            stickers.append({"text": s["label"], "from": round(at + 0.05, 3), "to": round(at + min(2.0, dur - 0.1), 3), "x": 540, "y": 1236,
                             "rot": -2, "bg": "#FFFFFF", "fg": "#111"})
        # caption words inside this segment, moved onto the output timeline
        seg = [w for w in words if s["in"] - 0.05 <= w["t0"] < s["out"] - 0.15]
        cur, last_t = [], None
        def flush():
            if cur: pages.append({"tokens": list(cur)})
            cur.clear()
        for w in seg:
            t = at + (w["t0"] - s["in"]); n = len(SYL.findall(w["w"]))
            if cur and (len(cur) >= 4 or sum(len(SYL.findall(c["text"])) for c in cur) + n > 11 or t - last_t > 0.45):
                flush()
            key = any(kw in w["w"] for kw in ed.get("keys", []))
            cur.append({"text": w["w"], "key": key, "fromMs": round(t * 1000)}); last_t = t
        flush()
        at += dur
    for i, p in enumerate(pages):
        nxt = pages[i + 1]["tokens"][0]["fromMs"] if i + 1 < len(pages) else round(at * 1000)
        p["startMs"] = p["tokens"][0]["fromMs"]; p["endMs"] = min(nxt, p["tokens"][-1]["fromMs"] + 900)
        for j, tk in enumerate(p["tokens"]):
            tk["toMs"] = p["tokens"][j + 1]["fromMs"] if j + 1 < len(p["tokens"]) else p["endMs"]
    env = np.clip(env / (np.percentile(env[env > 0], 90) + 1e-9), 0, 1)
    end = round(at + ed.get("tail", 0.6), 3)
    data = {"id": sid, "end": end, "title": ed["title"], "credit": ed.get("credit", "출처: 국회방송(NATV)"), "lines": [], "origVoice": True,
            "pages": pages, "env": [round(float(v), 3) for v in env], "clips": clips, "moments": [],
            "stickers": stickers + ed.get("stickers", []), "sfx": [{"t": a, "name": n, "gain": g} for a, n, g in ed.get("sfx", [])],
            "music": ed.get("music"), "flashes": ed.get("flashes", []), "punches": ed.get("punches", [])}
    os.makedirs(f"{V}/src/data", exist_ok=True)
    json.dump(data, open(f"{V}/src/data/{sid}.json", "w"), ensure_ascii=False)
    print(f"prep {sid}: {len(clips)} segments, {len(pages)} caption pages ({mode}), {end}s")
    for p in pages: print(f"  {p['startMs'] / 1000:6.2f}  " + " ".join(t["text"] for t in p["tokens"]))

main(sys.argv[1])
ids = sorted(f[:-5] for f in os.listdir(f"{V}/src/data") if f.endswith(".json"))
with open(f"{V}/src/data/index.ts", "w") as f:
    f.write("// generated by prep.py / politics/prep_pol.py\nimport type { ShortData } from \"../ClipShort\";\n")
    for i in ids: f.write(f"import {i} from \"./{i}.json\";\n")
    f.write("export const SHORTS = [" + ", ".join(ids) + "] as unknown as ShortData[];\n")
