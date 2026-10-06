#!/usr/bin/env python3
"""⑤ 자료화면 만들기.

자료화면 한 장 = 화면 전체 PNG (흐린 배경 + 가운데 자료 + 오른쪽 아래 작은 출처).
자료 이미지는 셋 중 하나:
    image : 이미 있는 그림 (사용자가 준 캡처, 직접 찍은 스크린숏)
    url   : 그 페이지를 헤드리스 크로미움으로 캡처 (막히면 card 로 대신)
    card  : 실제로 확인한 기사 제목·공식 발표 문구를 깔끔한 카드로 (kind: news | site | stat)

카드 내용은 반드시 실제 출처에서 확인한 문구만 쓴다. 지어낸 기사 제목·수치는 금지.

    python3 broll.py --card '{"kind":"news","source":"한국경제","date":"2026.10.05","title":"..."}' --size 1280x720 --out b1.png
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import font_path  # noqa: E402


def F(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(weight), max(8, int(size)))


def wrap(draw: ImageDraw.ImageDraw, text: str, font, width: int, max_lines: int = 4) -> list[str]:
    """한국어는 낱말 단위로, 낱말이 너무 길면 글자 단위로 줄을 바꾼다."""
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=font) <= width:
            cur = trial
            continue
        if cur:
            lines.append(cur)
        cur = ""
        for ch in word:
            if draw.textlength(cur + ch, font=font) > width and cur:
                lines.append(cur)
                cur = ""
            cur += ch
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip() + "…"
    return lines


def card(spec: dict, w: int = 1200, h: int = 675) -> Image.Image:
    kind = spec.get("kind", "news")
    im = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    pad = int(w * 0.07)
    u = w / 1200
    if kind == "news":
        d.rectangle((0, 0, w, int(10 * u)), fill=(20, 60, 160))
        src = spec.get("source", "")
        f_src = F("ExtraBold", 30 * u)
        d.text((pad, int(60 * u)), src, font=f_src, fill=(20, 60, 160))
        if spec.get("section"):
            sx = pad + d.textlength(src, font=f_src) + 24 * u
            d.text((sx, int(66 * u)), "|  " + spec["section"], font=F("Medium", 24 * u), fill=(120, 120, 120))
        f_t = F("Black", 58 * u)
        y = int(140 * u)
        for line in wrap(d, spec.get("title", ""), f_t, w - 2 * pad, 3):
            d.text((pad, y), line, font=f_t, fill=(17, 17, 17))
            y += int(78 * u)
        if spec.get("subtitle"):
            for line in wrap(d, spec["subtitle"], F("SemiBold", 30 * u), w - 2 * pad, 2):
                d.text((pad, y + int(10 * u)), line, font=F("SemiBold", 30 * u), fill=(90, 90, 90))
                y += int(44 * u)
        y += int(26 * u)
        d.line((pad, y, w - pad, y), fill=(225, 225, 225), width=max(1, int(2 * u)))
        meta = " · ".join(x for x in [spec.get("byline"), spec.get("date")] if x)
        d.text((pad, y + int(18 * u)), meta, font=F("Medium", 24 * u), fill=(130, 130, 130))
        y += int(80 * u)
        for k in range(3):  # 본문 자리 표시 (회색 줄)
            if y + 14 * u > h - pad / 2:
                break
            d.rounded_rectangle((pad, y, w - pad - (k == 2) * int(300 * u), y + int(14 * u)), radius=int(7 * u), fill=(236, 236, 236))
            y += int(34 * u)
    elif kind == "site":
        d.rectangle((0, 0, w, int(64 * u)), fill=(243, 244, 246))
        d.rounded_rectangle((pad, int(14 * u), w - pad, int(50 * u)), radius=int(18 * u), fill=(255, 255, 255), outline=(220, 222, 226))
        d.text((pad + int(22 * u), int(20 * u)), spec.get("url", ""), font=F("Medium", 22 * u), fill=(90, 90, 90))
        d.text((pad, int(110 * u)), "공식 자료", font=F("Bold", 24 * u), fill=(16, 120, 80))
        d.text((pad, int(146 * u)), spec.get("source", ""), font=F("ExtraBold", 40 * u), fill=(17, 17, 17))
        y = int(230 * u)
        f_q = F("Bold", 46 * u)
        d.rectangle((pad, y, pad + int(8 * u), y + int(60 * u) * 3), fill=(16, 120, 80))
        for line in wrap(d, spec.get("title", ""), f_q, w - 2 * pad - int(40 * u), 4):
            d.text((pad + int(34 * u), y), line, font=f_q, fill=(30, 30, 30))
            y += int(64 * u)
        if spec.get("date"):
            d.text((pad, h - pad), spec["date"], font=F("Medium", 24 * u), fill=(130, 130, 130))
    elif kind == "stat":
        im = Image.new("RGB", (w, h), (18, 24, 38))
        d = ImageDraw.Draw(im)
        f_n = F("Black", 170 * u)
        num = spec.get("value", "")
        d.text(((w - d.textlength(num, font=f_n)) / 2, h * 0.22), num, font=f_n, fill=(255, 212, 0))
        f_l = F("Bold", 44 * u)
        y = h * 0.6
        for line in wrap(d, spec.get("title", ""), f_l, w - 2 * pad, 2):
            d.text(((w - d.textlength(line, font=f_l)) / 2, y), line, font=f_l, fill=(255, 255, 255))
            y += 60 * u
    else:
        raise ValueError(f"모르는 카드 종류: {kind}")
    return im


def screenshot(url: str, out: str, w: int = 1280, h: int = 800) -> bool:
    """전역 설치된 node playwright 로 페이지를 캡처. 실패하면 False."""
    js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch({{ executablePath: process.env.PW_CHROMIUM || undefined,
    proxy: process.env.HTTPS_PROXY ? {{ server: process.env.HTTPS_PROXY }} : undefined }});
  const p = await b.newPage({{ viewport: {{ width: {w}, height: {h} }}, deviceScaleFactor: 1, locale: 'ko-KR', ignoreHTTPSErrors: false }});
  await p.goto({json.dumps(url)}, {{ waitUntil: 'networkidle', timeout: 25000 }});
  await p.screenshot({{ path: {json.dumps(out)} }});
  await b.close();
}})().catch(e => {{ console.error(e.message); process.exit(1); }});
"""
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(js)
    env = dict(os.environ, NODE_PATH=os.environ.get("NODE_PATH", "/opt/node22/lib/node_modules"))
    if os.path.exists("/opt/pw-browsers/chromium"):
        env.setdefault("PW_CHROMIUM", "/opt/pw-browsers/chromium")
    try:
        p = subprocess.run(["node", f.name], capture_output=True, text=True, timeout=60, env=env)
        return p.returncode == 0 and os.path.exists(out)
    except (OSError, subprocess.TimeoutExpired):
        return False
    finally:
        os.unlink(f.name)


def compose(src: Image.Image, W: int, H: int, credit: str, rules: dict) -> Image.Image:
    """화면 전체 자료화면: 흐린 배경 위에 자료를 가운데 두고 출처를 작게 단다."""
    src = src.convert("RGB")
    sw, sh = src.size
    cover = max(W / sw, H / sh)
    bg = src.resize((int(sw * cover) + 1, int(sh * cover) + 1)).crop((0, 0, W, H))
    bg = bg.filter(ImageFilter.GaussianBlur(max(W, H) / 40))
    bg = Image.blend(bg, Image.new("RGB", (W, H), (0, 0, 0)), rules["broll"].get("dim_background", 0.55))
    fit = min(W * 0.86 / sw, H * 0.80 / sh)
    fw, fh = int(sw * fit), int(sh * fit)
    fg = src.resize((fw, fh), Image.LANCZOS)
    r = int(min(W, H) * 0.02)
    mask = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fw - 1, fh - 1), radius=r, fill=255)
    x, y = (W - fw) // 2, int((H - fh) * 0.42)
    sh_ = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh_).rounded_rectangle((x + r // 2, y + r, x + fw + r // 2, y + fh + r), radius=r, fill=150)
    bg.paste((0, 0, 0), (0, 0), sh_.filter(ImageFilter.GaussianBlur(r)))
    bg.paste(fg, (x, y), mask)
    if credit:
        d = ImageDraw.Draw(bg)
        f = F("Medium", H * rules["broll"].get("credit_size", 0.024))
        tw = d.textlength(credit, font=f)
        m = int(min(W, H) * 0.03)
        d.text((W - m - tw, H - m - f.size * 1.2), credit, font=f, fill=(235, 235, 235),
               stroke_width=max(1, f.size // 12), stroke_fill=(0, 0, 0))
    return bg


def build(item: dict, W: int, H: int, rules: dict, out: str, workdir: str) -> str:
    """편집 계획의 broll 항목 하나를 화면 전체 PNG 로 만든다."""
    src = None
    if item.get("image"):
        src = Image.open(item["image"])
    elif item.get("url"):
        shot = os.path.join(workdir, os.path.basename(out) + ".shot.png")
        if screenshot(item["url"], shot):
            src = Image.open(shot)
        elif not item.get("card"):
            print(f"  ! 캡처 실패, card 정보도 없음: {item['url']}", file=sys.stderr)
    if src is None and item.get("card"):
        src = card(item["card"])
    if src is None:
        raise ValueError(f"자료화면에 image/url/card 중 하나가 필요합니다: {item}")
    # 편집기에서는 출처를 자막 층에 따로 얹는다 (줌에 밀려 잘리지 않게). 단독 실행 때만 그림에 넣는다
    credit = item.get("credit", "") if item.get("bake_credit") else ""
    compose(src, W, H, credit, rules).save(out)
    return out


def main():
    from common import load_rules
    p = argparse.ArgumentParser(description="자료화면 PNG 만들기")
    p.add_argument("--card", help="카드 JSON")
    p.add_argument("--image")
    p.add_argument("--url")
    p.add_argument("--credit", default="")
    p.add_argument("--size", default="1920x1080")
    p.add_argument("--out", required=True)
    a = p.parse_args()
    W, H = map(int, a.size.split("x"))
    item = {"image": a.image, "url": a.url, "credit": a.credit, "bake_credit": True,
            "card": json.loads(a.card) if a.card else None}
    print(build(item, W, H, load_rules(), a.out, os.path.dirname(os.path.abspath(a.out))))


if __name__ == "__main__":
    main()
