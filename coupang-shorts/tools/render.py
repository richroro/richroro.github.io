"""specs/<id>.json + data/<id>.json → out/<id>.mp4  (1080×1920, 30fps, 음성 없는 흰 카드 쇼츠)

shorts/viral5 의 50만+ "흰 카드" 형식(src/lib/Card.tsx)을 상품용으로 옮긴 것.
흰 바탕, 위에 굵은 두 줄 제목, 가운데 둥근 상품 사진(천천히 확대), 아래 두 줄 설명, 비트마다 '뽁' 효과음 + 배경음악.
Remotion·크롬 없이 Pillow 로 프레임을 그려 ffmpeg 에 바로 넘긴다 (GitHub Actions 에서 1~2분).

spec 형식
{
  "title": ["첫 줄", "둘째 줄"],          # 영상 내내 위에 고정
  "badge": "채널명",                      # 선택. 제목 위 작은 채널 표시
  "music": "monkeys_spinning_monkeys",    # assets/music/<이름>.mp3, "musicStart": 초
  "beats": [                              # 순서대로 이어 붙는 장면
    {"p": "9024123826",                   # data 의 productId (또는 "#0" 처럼 data 안 순번)
     "ko": "큰 글씨 한 줄", "sub": "작은 글씨 한 줄",
     "dur": 2.7,                          # 초 (기본 2.7)
     "zoom": [1.0, 1.15], "focus": [0.5, 0.5],   # 사진 확대 시작→끝, 확대 중심(0~1)
     "ring": [0.5, 0.4, 0.18],            # 선택. 사진 위 빨간 동그라미 (x, y, 반지름: 사진 폭 기준 비율)
     "tag": "1위",                        # 선택. 사진 왼쪽 위 검은 말풍선
     "price": true}                       # 선택. 사진 오른쪽 아래 가격표 (+ 로켓배송)
  ]
}
"""
import io
import json
import math
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
import platforms  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ASSETS = Path(os.environ.get("CS_ASSETS", ROOT / ".assets"))
CACHE = Path(os.environ.get("CS_CACHE", ROOT / ".cache"))
W, H, FPS, SR = 1080, 1920, 30, 48000
INK, GREY, RED, BLUE = (17, 17, 17), (68, 68, 68), (255, 45, 45), (0, 116, 233)
BOX = (90, 450, 900, 900)  # x, y, w, h — 정사각형 (쿠팡 상품 사진은 1:1)
RADIUS = 34


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ASSETS / "fonts" / f"Pretendard-{weight}.otf"), size)


def e_out(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def fit(text: str, weight: str, size: int, width: int, minimum: int = 30) -> ImageFont.FreeTypeFont:
    while size > minimum:
        f = font(weight, size)
        if f.getlength(text) <= width:
            return f
        size -= 2
    return font(weight, minimum)


def text_layer(lines: list[tuple[str, ImageFont.FreeTypeFont, tuple]], width: int, gap: int = 8) -> Image.Image:
    """가운데 정렬 여러 줄을 투명 레이어 하나로"""
    hs = [f.getbbox("가Ag")[3] - f.getbbox("가Ag")[1] for _, f, _ in lines]
    img = Image.new("RGBA", (width, sum(hs) + gap * (len(lines) - 1) + 16), (0, 0, 0, 0))
    d, y = ImageDraw.Draw(img), 4
    for (t, f, c), h in zip(lines, hs):
        d.text(((width - f.getlength(t)) / 2, y - f.getbbox("가Ag")[1]), t, font=f, fill=c)
        y += h + gap
    return img


def rounded_mask(w: int, h: int, r: int) -> Image.Image:
    m = Image.new("L", (w * 2, h * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), r * 2, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def load_image(p: dict) -> Image.Image:
    """상품 사진: 로컬 파일(imageFile) → 캐시 → 내려받기. 흰 바탕 정사각형으로 맞춘다."""
    if p.get("imageFile"):
        im = Image.open(ROOT / p["imageFile"])
    else:
        CACHE.mkdir(parents=True, exist_ok=True)
        c = CACHE / f"img_{p['productId']}.bin"
        if not c.exists():
            req = urllib.request.Request(p["image"], headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                c.write_bytes(r.read())
        im = Image.open(io.BytesIO(c.read_bytes()))
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(bg, im).convert("RGB")
    s = max(im.size)
    sq = Image.new("RGB", (s, s), (255, 255, 255))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return sq.resize((1200, 1200), Image.LANCZOS) if s < 1200 else sq


def won(n) -> str:
    try:
        return f"{int(n):,}원"
    except (TypeError, ValueError):
        return ""


class Short:
    def __init__(self, spec: dict, data: dict):
        self.spec = spec
        self.byid = {str(p["productId"]): p for p in data.get("products", [])}
        self.list = data.get("products", [])
        self.beats = []
        t = 0.0
        for b in spec["beats"]:
            b = dict(b)
            b["at"], b["dur"] = t, float(b.get("dur", 2.7))
            b["prod"] = self.product(b.get("p"))
            t += b["dur"]
            self.beats.append(b)
        self.end = float(spec.get("end", t))
        # 이 편에 나오는 상품들의 링크로 광고 표시 문구를 고른다 (spec "platforms" 로 직접 정할 수도 있다)
        self.platforms = spec.get("platforms") or platforms.used([b["prod"] for b in self.beats if b["prod"]])
        self.images = {}
        self.mask = rounded_mask(BOX[2], BOX[3], RADIUS)
        self.base = self.draw_base()
        self.labels = [self.draw_label(b) for b in self.beats]
        self.overlays = [self.draw_overlay(b) for b in self.beats]

    def product(self, ref) -> dict | None:
        if ref is None:
            return None
        ref = str(ref)
        if ref.startswith("#"):
            return self.list[int(ref[1:])]
        if ref not in self.byid:
            raise SystemExit(f"spec 의 상품 {ref} 이(가) data 에 없습니다")
        return self.byid[ref]

    def image(self, p: dict) -> Image.Image:
        k = str(p["productId"])
        if k not in self.images:
            self.images[k] = load_image(p)
        return self.images[k]

    def draw_base(self) -> Image.Image:
        """모든 프레임 공통: 흰 바탕, 채널 표시, 광고 표시, 제목, 사진 테두리 그림자, 하단 고지"""
        im = Image.new("RGB", (W, H), (255, 255, 255))
        d = ImageDraw.Draw(im)
        if self.spec.get("badge"):
            name = self.spec["badge"]
            d.ellipse((70, 120, 130, 180), fill=tuple(self.spec.get("badgeColor", (232, 76, 61))))
            f = font("ExtraBold", 30)
            ic = name[:1]
            d.text((100 - f.getlength(ic) / 2, 133), ic, font=f, fill=(255, 255, 255))
            d.text((146, 132), name, font=font("ExtraBold", 32), fill=(34, 34, 34))
        # 광고 표시 (공정위 추천·보증 심사지침: 소비자가 바로 알 수 있게)
        f = font("Bold", 28)
        tag = platforms.chip(self.platforms)
        tw = f.getlength(tag)
        d.rounded_rectangle((W - 70 - tw - 36, 124, W - 70, 176), 26, fill=(242, 242, 242))
        d.text((W - 70 - tw - 18, 133), tag, font=f, fill=(110, 110, 110))
        title = [l for l in self.spec["title"] if l]
        size = min(fit(l, "ExtraBold", 76, 960).size for l in title)
        f = font("ExtraBold", size)
        lh = int(size * 1.22)
        y = 420 - lh * len(title)
        for l in title:
            d.text(((W - f.getlength(l)) / 2, y), l, font=f, fill=INK)
            y += lh
        x, y0, w, h = BOX
        d.rounded_rectangle((x - 3, y0 - 3, x + w + 2, y0 + h + 2), RADIUS + 3, fill=(232, 232, 232))
        lines = platforms.screen_lines(self.platforms)
        f = font("Bold", min(fit(l, "Bold", 26, 1000).size for l in lines))
        for i, l in enumerate(lines):
            d.text(((W - f.getlength(l)) / 2, 1560 + i * 36), l, font=f, fill=(150, 150, 150))
        return im

    def draw_label(self, b: dict) -> Image.Image:
        lines = []
        if b.get("ko"):
            lines.append((b["ko"], fit(b["ko"], "ExtraBold", 58, 1000), INK))
        if b.get("sub"):
            lines.append((b["sub"], fit(b["sub"], "Bold", 42, 1000), GREY))
        return text_layer(lines, 1040) if lines else None

    def draw_overlay(self, b: dict) -> Image.Image:
        """사진 위에 얹는 것: 순위 말풍선, 가격표"""
        ov = Image.new("RGBA", (BOX[2], BOX[3]), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        if b.get("tag"):
            f = font("ExtraBold", 44)
            tw = f.getlength(b["tag"])
            d.rounded_rectangle((28, 28, 28 + tw + 52, 28 + 76), 38, fill=(0, 0, 0, 200))
            d.text((54, 38), b["tag"], font=f, fill=(255, 255, 255))
        p = b.get("prod")
        if b.get("price") and p and p.get("price"):
            f = font("Black", 56)
            t = won(p["price"])
            tw = f.getlength(t)
            x1, y1 = BOX[2] - 28, BOX[3] - 28
            d.rounded_rectangle((x1 - tw - 56, y1 - 92, x1, y1), 24, fill=RED + (255,))
            d.text((x1 - tw - 28, y1 - 82), t, font=f, fill=(255, 255, 255))
            if p.get("rocket"):
                f2 = font("ExtraBold", 34)
                r = "로켓배송"
                rw = f2.getlength(r)
                d.rounded_rectangle((x1 - rw - 40, y1 - 160, x1, y1 - 104), 20, fill=BLUE + (255,))
                d.text((x1 - rw - 20, y1 - 154), r, font=f2, fill=(255, 255, 255))
        return ov

    def beat_at(self, t: float) -> int:
        k = 0
        for i, b in enumerate(self.beats):
            if t >= b["at"]:
                k = i
        return k

    def frame(self, n: int) -> Image.Image:
        t = n / FPS
        k = self.beat_at(t)
        b = self.beats[k]
        im = self.base.copy()
        x, y, w, h = BOX
        p = b["prod"]
        local = (t - b["at"]) / max(b["dur"], 1e-6)
        if p:
            src = self.image(p)
            z0, z1 = b.get("zoom", [1.0, 1.08])
            z = (z0 + (z1 - z0) * min(1.0, local)) * (1 + 0.05 * (1 - e_out((t - b["at"]) / 0.18)))
            fx, fy = b.get("focus", [0.5, 0.5])
            S = src.width
            cw = S / z
            cx = min(max(fx * S, cw / 2), S - cw / 2)
            cy = min(max(fy * S, cw / 2), S - cw / 2)
            pic = src.resize((w, h), Image.BILINEAR, box=(cx - cw / 2, cy - cw / 2, cx + cw / 2, cy + cw / 2))
        else:
            pic = Image.new("RGB", (w, h), (255, 255, 255))
        pic = pic.convert("RGBA")
        pic.alpha_composite(self.overlays[k])
        if b.get("ring"):
            rx, ry, rr = b["ring"]
            prog = e_out((t - b["at"] - 0.35) / 0.45)
            if prog > 0:
                d = ImageDraw.Draw(pic)
                R = rr * w
                d.arc((rx * w - R, ry * h - R, rx * w + R, ry * h + R), -90, -90 + 360 * prog, fill=RED + (255,), width=11)
        im.paste(pic.convert("RGB"), (x, y), self.mask)
        lab = self.labels[k]
        if lab is not None:
            s = 1 + 0.06 * (1 - e_out((t - b["at"]) / 0.2))
            if s > 1.001:
                lab = lab.resize((int(lab.width * s), int(lab.height * s)), Image.BILINEAR)
            im.paste(lab, ((W - lab.width) // 2, 1395 - (lab.height - self.labels[k].height) // 2), lab)
        return im

    # ---- 소리 ----
    def audio(self, path: Path):
        n = int(self.end * SR)
        mix = np.zeros((n, 2), np.float32)
        m = self.spec.get("music")
        if m:
            f = ASSETS / "music" / f"{m}.mp3"
            raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(self.spec.get("musicStart", 0)), "-i", str(f), "-t", str(self.end),
                                  "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
            mu = np.frombuffer(raw, np.float32).reshape(-1, 2)[:n]
            env = np.ones(len(mu), np.float32)
            fo = int(0.8 * SR)
            env[-fo:] = np.linspace(1, 0, fo) if len(env) > fo else env[-fo:]
            mix[: len(mu)] += mu * env[:, None] * float(self.spec.get("musicGain", 0.55))
        pop = pop_sound()
        for b in self.beats:
            i = int(b["at"] * SR)
            j = min(n, i + len(pop))
            mix[i:j] += pop[: j - i, None] * 0.5
        mix = np.clip(mix, -1, 1)
        with open(path, "wb") as fh:
            write_wav(fh, mix)


def pop_sound() -> np.ndarray:
    """짧은 '뽁' (사인파 피치 하강 + 빠른 감쇠) — 효과음 파일 없이"""
    t = np.arange(int(0.12 * SR)) / SR
    fr = 900 * np.exp(-t * 18) + 250
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return (np.sin(ph) * np.exp(-t * 35)).astype(np.float32)


def write_wav(fh, x: np.ndarray):
    import wave
    pcm = (x * 32767).astype("<i2")
    w = wave.open(fh, "wb")
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
    w.close()


def render(sid: str, out: Path | None = None) -> Path:
    spec = json.loads((ROOT / "specs" / f"{sid}.json").read_text())
    data = json.loads((ROOT / "data" / f"{spec.get('data', sid)}.json").read_text())
    s = Short(spec, data)
    out = out or ROOT / "out" / f"{sid}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    frames = int(round(s.end * FPS))
    with tempfile.TemporaryDirectory() as td:
        v, a = Path(td) / "v.mp4", Path(td) / "a.wav"
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                                "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", str(v)],
                               stdin=subprocess.PIPE)
        for n in range(frames):
            enc.stdin.write(s.frame(n).tobytes())
        enc.stdin.close()
        if enc.wait():
            raise SystemExit("ffmpeg 영상 인코딩 실패")
        s.audio(a)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(v), "-i", str(a), "-c:v", "copy",
                        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", str(SR),
                        "-shortest", "-movflags", "+faststart", str(out)], check=True)
    return out


def first_frame(sid: str, out: Path):
    spec = json.loads((ROOT / "specs" / f"{sid}.json").read_text())
    data = json.loads((ROOT / "data" / f"{spec.get('data', sid)}.json").read_text())
    s = Short(spec, data)
    sheet = Image.new("RGB", (W // 4 * 4, H // 4 * math.ceil(len(s.beats) / 4)), (255, 255, 255))
    for i, b in enumerate(s.beats):
        f = s.frame(int((b["at"] + b["dur"] * 0.6) * FPS)).resize((W // 4, H // 4))
        sheet.paste(f, ((i % 4) * W // 4, (i // 4) * H // 4))
    sheet.save(out)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--sheet":
        first_frame(sys.argv[2], Path(sys.argv[3]))
    else:
        for sid in sys.argv[1:]:
            print("렌더:", render(sid))
