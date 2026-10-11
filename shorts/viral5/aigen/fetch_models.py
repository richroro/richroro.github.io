"""Download the open image-model weights aigen/gen.py uses, and build stable-diffusion.cpp. Nothing here is committed.

usage: python3 aigen/fetch_models.py            weights → ~/.cache/aigen (about 7.3 GB), sd-cli → ~/.cache/aigen/sdcpp/build/bin/sd-cli
       python3 aigen/fetch_models.py --no-build  weights only

| file                                  | what                                      | from (Hugging Face)                     | licence                 |
|---------------------------------------|-------------------------------------------|-----------------------------------------|-------------------------|
| sd_xl_base_1.0.safetensors            | SDXL base 1.0 (UNet, both text encoders, VAE) | stabilityai/stable-diffusion-xl-base-1.0 | CreativeML OpenRAIL++-M |
| sdxl_lightning_4step_lora.safetensors | SDXL-Lightning 4-step LoRA                | ByteDance/SDXL-Lightning                | CreativeML OpenRAIL++-M |
| taesdxl.safetensors                   | tiny SDXL VAE decoder (fast decode)       | madebyollin/taesdxl                     | MIT                     |

OpenRAIL++-M lets us use and sell the outputs (§ "Output": the licensor claims no rights in them) as long as we keep to its
use restrictions (Attachment A: no deceiving people, no impersonation, no content that harms minors, …) and do not pass the
output off as made by a person where that matters: our descriptions say "이미지: AI 생성(…)".
FLUX.1-schnell (Apache-2.0) was tried first and dropped: 190 s per denoising step at 512x512 on 4 CPU cores (README).
"""
import os, subprocess, sys, urllib.request

CACHE = os.path.expanduser("~/.cache/aigen")
FILES = {
    "sd_xl_base_1.0.safetensors": "stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors",
    "lora/sdxl_lightning_4step_lora.safetensors": "ByteDance/SDXL-Lightning/resolve/main/sdxl_lightning_4step_lora.safetensors",
    "taesdxl.safetensors": "madebyollin/taesdxl/resolve/main/diffusion_pytorch_model.safetensors",
}
SDCPP = "https://github.com/leejet/stable-diffusion.cpp"
SDCPP_REV = "2988060a4338a5dcd94721c964a8e87003c1ac8b"  # the build the timings in aigen/README.md were measured with


def fetch():
    for name, path in FILES.items():
        dst = os.path.join(CACHE, name)
        if os.path.exists(dst):
            print("have", dst); continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        print("get ", name)
        urllib.request.urlretrieve(f"https://huggingface.co/{path}", dst + ".part")
        os.replace(dst + ".part", dst)


def build():
    src = os.path.join(CACHE, "sdcpp")
    if not os.path.exists(src):
        subprocess.run(["git", "clone", SDCPP, src], check=True)
    subprocess.run(["git", "-C", src, "checkout", SDCPP_REV], check=True)
    subprocess.run(["git", "-C", src, "submodule", "update", "--init", "--recursive"], check=True)
    subprocess.run(["cmake", "-B", "build", "-DCMAKE_BUILD_TYPE=Release", "-DGGML_NATIVE=ON"], cwd=src, check=True)
    subprocess.run(["cmake", "--build", "build", "-j", str(os.cpu_count() or 4), "--config", "Release", "--target", "sd-cli"], cwd=src, check=True)
    print(os.path.join(src, "build/bin/sd-cli"))


fetch()
if "--no-build" not in sys.argv:
    build()
