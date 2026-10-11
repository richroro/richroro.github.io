"""Generate a short's AI stills from media/aigen/<id>/scenes.json with stable-diffusion.cpp (SDXL-Lightning, CPU).

usage: python3 aigen/gen.py <id> [scene keys...] [--force]
  scenes.json: {"style": "...", "negative": "...", "size": [640, 1152], "chars": {"me": "..."},
                "scenes": [{"key": "s01", "prompt": "{me} holding ...", "seed": 101}, ...]}
  {name} in a prompt is replaced by chars[name]: the same character sheet text (and a per-character seed) in every scene
  keeps the character's look. Output: media/aigen/<id>/img/<key>.jpg (committed: our own generated images) and a timing
  row per image in media/aigen/<id>/timings.csv. Images already there are skipped unless --force.
"""
import csv, json, os, subprocess, sys, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
D = os.environ.get("AIGEN_DIR", "/opt/aigen")
SD = os.path.join(D, "sdcpp/build/bin/sd-cli")
MODEL = os.path.join(D, "models/sdxl_lightning_4step_q8_0.gguf"); TAESD = os.path.join(D, "models/taesdxl.safetensors")

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]; force = "--force" in sys.argv
    sid, only = args[0], set(args[1:])
    base = os.path.join(ROOT, "media/aigen", sid); spec = json.load(open(os.path.join(base, "scenes.json")))
    os.makedirs(os.path.join(base, "img"), exist_ok=True)
    W, H = spec.get("size", [640, 1152])
    tpath = os.path.join(base, "timings.csv"); new = not os.path.exists(tpath)
    with open(tpath, "a", newline="") as tf:
        w = csv.writer(tf)
        if new: w.writerow(["key", "width", "height", "steps", "seconds", "sampling_s", "decode_s"])
        for s in spec["scenes"]:
            if only and s["key"] not in only: continue
            out = os.path.join(base, "img", s["key"] + ".jpg")
            if os.path.exists(out) and not force: continue
            prompt = s["prompt"].format(**spec.get("chars", {}))
            prompt = f'{spec["style"]}, {prompt}' if spec.get("style") else prompt
            neg = ", ".join(x for x in [spec.get("negative", ""), s.get("negative", "")] if x)
            png = f"/tmp/aigen_{sid}_{s['key']}.png"; log = png[:-4] + ".log"
            cmd = [SD, "-m", MODEL, "--taesd", TAESD, "-p", prompt, "-n", neg, "--cfg-scale", "1.0", "--sampling-method", "euler",
                   "--scheduler", "sgm_uniform", "--steps", str(s.get("steps", 4)), "-W", str(s.get("w", W)), "-H", str(s.get("h", H)),
                   "-s", str(s["seed"]), "-t", str(os.cpu_count()), "-o", png]
            t0 = time.time(); subprocess.run(cmd, stdout=open(log, "w"), stderr=subprocess.STDOUT, check=True); dt = time.time() - t0
            txt = open(log, errors="replace").read()
            grab = lambda k: next((l.split("taking")[1].split("s")[0].strip() for l in txt.splitlines() if k in l and "taking" in l), "")
            Image.open(png).convert("RGB").save(out, quality=92)
            w.writerow([s["key"], s.get("w", W), s.get("h", H), s.get("steps", 4), round(dt, 1), grab("sampling completed"), grab("decode_first_stage completed")]); tf.flush()
            print(f"{s['key']}: {dt:.0f}s -> {os.path.relpath(out, ROOT)}", flush=True)

if __name__ == "__main__":
    main()
