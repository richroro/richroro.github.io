"""편집 스크립트들이 같이 쓰는 도구: ffmpeg, 규칙집, 모델·글꼴 위치, 오디오 읽기."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES_PATH = os.path.join(SKILL_DIR, "rules", "rules.json")
CACHE = os.environ.get("VIDEO_EDIT_CACHE") or os.path.expanduser("~/.cache/video-edit")
MODELS = os.path.join(CACHE, "models")
FONTS = os.path.join(CACHE, "fonts")


def need_setup(what: str):
    sys.exit(f"{what} 이(가) 없습니다. 먼저 실행: bash {os.path.join(SKILL_DIR, 'scripts', 'setup.sh')}")


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    # 시스템 ffmpeg 에 libass 가 없을 수 있어서 imageio-ffmpeg 를 우선한다
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        if exe:
            return exe
        need_setup("ffmpeg")


def run_ff(args: list[str], quiet=True) -> subprocess.CompletedProcess:
    cmd = [ffmpeg(), "-hide_banner", "-nostdin", "-y"] + (["-loglevel", "error"] if quiet else []) + args
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError("ffmpeg 실패:\n" + " ".join(cmd)[:600] + "\n" + p.stderr[-2500:])
    return p


def probe(path: str) -> dict:
    """길이·해상도·fps·오디오 유무·회전. ffprobe 없이 ffmpeg -i 출력에서 읽는다."""
    p = subprocess.run([ffmpeg(), "-hide_banner", "-i", path], capture_output=True, text=True)
    err = p.stderr
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", err)
    if not m:
        raise RuntimeError(f"영상을 읽을 수 없음: {path}\n{err[-600:]}")
    info = {"duration": int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)),
            "has_audio": bool(re.search(r"Stream #\S+.*Audio:", err)), "width": 0, "height": 0, "fps": 30.0, "rotate": 0}
    v = re.search(r"Stream #\S+.*Video:.*?(\d{2,5})x(\d{2,5})", err)
    if v:
        info["width"], info["height"] = int(v.group(1)), int(v.group(2))
    f = re.search(r"Video:.*?(\d+(?:\.\d+)?) fps", err) or re.search(r"Video:.*?(\d+(?:\.\d+)?) tbr", err)
    if f:
        info["fps"] = float(f.group(1))
    r = re.search(r"rotate\s*:\s*(-?\d+)", err) or re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees", err)
    if r:
        info["rotate"] = int(float(r.group(1))) % 360
    if info["rotate"] in (90, 270):  # ffmpeg 가 자동 회전하므로 출력 기준 크기로 바꾼다
        info["width"], info["height"] = info["height"], info["width"]
    return info


def read_audio(path: str, sr: int = 16000, channels: int = 1):
    import numpy as np
    p = subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", str(channels),
                        "-ar", str(sr), "-f", "f32le", "-"], capture_output=True)
    if p.returncode:
        raise RuntimeError("오디오 읽기 실패: " + p.stderr.decode(errors="replace")[-600:])
    a = np.frombuffer(p.stdout, dtype=np.float32).copy()
    return a.reshape(-1, channels) if channels > 1 else a


def load_rules(path: str | None = None) -> dict:
    with open(path or RULES_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o))


def font_path(weight: str = "Bold") -> str:
    p = os.path.join(FONTS, f"Pretendard-{weight}.otf")
    if not os.path.exists(p):
        need_setup(f"글꼴 Pretendard-{weight}")
    return p


def fmt_time(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def make_recognizer():
    import sherpa_onnx
    d = os.path.join(MODELS, "sherpa-onnx-zipformer-korean-2024-06-24")
    if not os.path.isdir(d):
        need_setup("한국어 받아쓰기 모델")
    return sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{d}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{d}/decoder-epoch-99-avg-1.int8.onnx",
        joiner=f"{d}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{d}/tokens.txt",
        num_threads=min(4, os.cpu_count() or 1), decoding_method="modified_beam_search")


def speech_segments(audio, sr: int = 16000, min_silence: float = 0.25):
    """silero VAD 로 말한 구간 [(start, end)] 초 단위."""
    import sherpa_onnx
    model = os.path.join(MODELS, "silero_vad.onnx")
    if not os.path.exists(model):
        need_setup("VAD 모델")
    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = model
    cfg.silero_vad.min_silence_duration = min_silence
    cfg.silero_vad.min_speech_duration = 0.1
    cfg.silero_vad.max_speech_duration = 20
    cfg.silero_vad.threshold = 0.45
    cfg.sample_rate = sr
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=60)
    win = cfg.silero_vad.window_size
    segs = []

    def drain():
        while not vad.empty():
            s = vad.front
            segs.append((s.start / sr, (s.start + len(s.samples)) / sr))
            vad.pop()

    for i in range(0, len(audio), win):
        chunk = audio[i:i + win]
        if len(chunk) < win:
            import numpy as np
            chunk = np.pad(chunk, (0, win - len(chunk)))
        vad.accept_waveform(chunk)
        drain()
    vad.flush()
    drain()
    return segs
