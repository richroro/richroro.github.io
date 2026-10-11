"""Generate a short's AI scene pictures with SDXL base 1.0 + SDXL-Lightning (4 steps) through stable-diffusion.cpp on CPU.

usage: python3 aigen/gen.py <id> [<line> ...]   pictures for aigen/eps/<id>.py (only the named lines; existing ones are kept)
       python3 aigen/gen.py --test               the character-consistency test (cast.TEST) → aigen/img/test/
       python3 aigen/gen.py <id> --redo <line>   generate a line again (with "seed" in its pic dict changed, usually)
Writes aigen/img/<id>/<line>.jpg (832x832, the square slot of the post frame is 900 px) and appends the seconds to
aigen/img/<id>/timings.csv. Weights and sd-cli: python3 aigen/fetch_models.py.
"""
import csv, importlib.util, os, subprocess, sys, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cast import CAST, STYLE, TEST  # noqa: E402

M = os.path.expanduser("~/.cache/aigen")
SDCLI = os.environ.get("SD_CLI", f"{M}/sdcpp/build/bin/sd-cli")
SIZE = 832
LORA = "<lora:sdxl_lightning_4step_lora:1>"


def prompt(text):
    return f"{LORA}{STYLE}, {text.format(**CAST)}"


def make(out_jpg, text, seed):
    tmp = out_jpg[:-4] + ".png"
    t0 = time.time()
    cmd = [SDCLI, "-m", f"{M}/sd_xl_base_1.0.safetensors", "--lora-model-dir", f"{M}/lora", "--lora-apply-mode", "immediately",
           "--taesd", f"{M}/taesdxl.safetensors", "--diffusion-fa", "--cfg-scale", "1.0", "--sampling-method", "euler",
           "--scheduler", "sgm_uniform", "--steps", "4", "-W", str(SIZE), "-H", str(SIZE), "-s", str(seed), "-t", str(os.cpu_count() or 4),
           "-p", prompt(text), "-o", tmp]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode or not os.path.exists(tmp):
        sys.exit(f"sd-cli failed for {out_jpg}:\n{r.stdout[-2000:]}{r.stderr[-2000:]}")
    Image.open(tmp).convert("RGB").save(out_jpg, quality=90)
    os.remove(tmp)
    return time.time() - t0


def run(sid, items):
    d = os.path.join(HERE, "img", sid)
    os.makedirs(d, exist_ok=True)
    for name, text, seed, redo in items:
        out = os.path.join(d, f"{name}.jpg")
        if os.path.exists(out) and not redo:
            continue
        sec = make(out, text, seed)
        with open(os.path.join(d, "timings.csv"), "a", newline="") as f:
            csv.writer(f).writerow([name, seed, SIZE, round(sec, 1)])
        print(f"{sid}/{name}: {sec:.0f}s", flush=True)


def load(sid):
    spec = importlib.util.spec_from_file_location(sid, os.path.join(HERE, "eps", f"{sid}.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod.EP


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--test":
        run("test", [(n, t, 1234, False) for n, t in TEST])
    elif a:
        sid, rest = a[0], a[1:]
        redo = set(rest[rest.index("--redo") + 1:]) if "--redo" in rest else set()
        only = set(x for x in rest if x != "--redo") | redo
        ep = load(sid)
        items = []
        for lid, _voice, _say, _cap, pic in ep["beats"]:
            if not pic or (only and lid not in only):
                continue
            items.append((lid, pic["p"], pic.get("seed", ep["seed"]), lid in redo))
        run(sid, items)
    else:
        sys.exit(__doc__)
