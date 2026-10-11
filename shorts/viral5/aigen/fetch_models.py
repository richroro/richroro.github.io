"""Download the image-model weights for aigen/gen.py and build stable-diffusion.cpp (nothing here is committed).

usage: python3 aigen/fetch_models.py            # weights into $AIGEN_DIR (default /opt/aigen) + build sd-cli + q8_0 convert
       python3 aigen/fetch_models.py --no-build

| file                               | what                                          | from (Hugging Face)                            | licence           | size    |
|------------------------------------|-----------------------------------------------|------------------------------------------------|-------------------|---------|
| sdxl_lightning_4step.safetensors   | SDXL base 1.0 + SDXL-Lightning 4-step, merged | ByteDance/SDXL-Lightning                       | CreativeML OpenRAIL++-M | 6.9 GB |
| taesdxl.safetensors                | tiny SDXL VAE decoder (fast decode on CPU)    | madebyollin/taesdxl                            | MIT               | 10 MB   |
| sdxl_lightning_4step_q8_0.gguf     | the checkpoint above re-saved as q8_0 (local) | made here by `sd-cli -M convert`               | same as source    | 4.2 GB  |

stable-diffusion.cpp (MIT) is cloned from github.com/leejet/stable-diffusion.cpp and built with cmake (Release, native).
FLUX.1-schnell (Apache-2.0) was tried first and dropped: 858 s per sampling step at 768x1344 on 4 CPUs (README).
"""
import os, subprocess, sys, urllib.request

D = os.environ.get("AIGEN_DIR", "/opt/aigen")
M = os.path.join(D, "models")
FILES = {
    "sdxl_lightning_4step.safetensors": "https://huggingface.co/ByteDance/SDXL-Lightning/resolve/main/sdxl_lightning_4step.safetensors",
    "taesdxl.safetensors": "https://huggingface.co/madebyollin/taesdxl/resolve/main/diffusion_pytorch_model.safetensors",
}

def run(cmd, **kw):
    print("+", " ".join(cmd)); subprocess.run(cmd, check=True, **kw)

os.makedirs(M, exist_ok=True)
if "--no-build" not in sys.argv:
    src = os.path.join(D, "sdcpp")
    if not os.path.isdir(src):
        run(["git", "clone", "--recursive", "--depth", "1", "https://github.com/leejet/stable-diffusion.cpp", src])
    run(["cmake", "-B", "build", "-DCMAKE_BUILD_TYPE=Release", "-DGGML_NATIVE=ON"], cwd=src)
    run(["cmake", "--build", "build", "-j", str(os.cpu_count()), "--config", "Release"], cwd=src)
for name, url in FILES.items():
    p = os.path.join(M, name)
    if not os.path.exists(p):
        print("downloading", name); urllib.request.urlretrieve(url, p + ".part"); os.replace(p + ".part", p)
q8 = os.path.join(M, "sdxl_lightning_4step_q8_0.gguf")
if not os.path.exists(q8):
    run([os.path.join(D, "sdcpp/build/bin/sd-cli"), "-M", "convert", "-m", os.path.join(M, "sdxl_lightning_4step.safetensors"), "-o", q8, "--type", "q8_0"])
print("ready:", M)
