#!/usr/bin/env python3
"""댓글 기반 쇼츠 자동 생성기 — "SNS 반응/댓글 모음" 뉴스형 쇼츠를 명령 한 줄로.

    python make_comment_short.py --project example/comments.json
    python make_comment_short.py --demo

화면
    ┌──────────────────┐ 0
    │ [라벨] 헤드라인 2줄   │  상단 고정 (흰 줄 + 강조 줄)
    ├──────────────────┤ 400
    │  (게시물 사진)        │  댓글 화면: 인스타그램식 밝은 UI
    │  ● ▒▒▒▒ 댓글 내용…   │  - 닉네임은 기본 블러 처리
    │    1일 좋아요 960개   │  - 지금 읽는 댓글로 카메라가 부드럽게 스크롤
    │  ● ▒▒▒ 댓글 내용…    │  - 나머지는 어둡게, 읽는 댓글만 밝게
    │ "은퇴 축하한다"는 …   │  큰 자막 (*강조* = 민트색)
    ├──────────────────┤ 1600
    │ 출처 표기             │
    └──────────────────┘ 1920

음성·자막 타이밍·BGM 덕킹은 make_short.py 의 것을 그대로 쓴다.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import make_short as ms

W, H, FPS = ms.W, ms.H, ms.FPS
PANEL_Y, PANEL_H = 400, 1200            # 댓글 화면 영역
CAPTION_Y = 1490
EASE = 0.45                             # 다음 댓글로 스크롤하는 시간(초)
DIM = 0.55                              # 읽지 않는 댓글 어둡게 (0~1)
MINT = "&H00C8E05A&"                    # ASS 는 BGR — #5AE0C8
BG = "0x111111"

PAD_X, AVATAR = 44, 92
TEXT_X = PAD_X + AVATAR + 30
TEXT_W = W - TEXT_X - 110               # 오른쪽 하트 자리 비움


# ───────────────────────── 입력 ─────────────────────────

@dataclass
class Comment:
    user: str
    text: str
    likes: int = 0
    time: str = "1일"
    replies: int = 0


@dataclass
class Line:
    text: str
    focus: int | None = None            # 이 문장을 읽는 동안 강조할 댓글 번호 (0부터)


def parse_comments(raw) -> list[Comment]:
    out = []
    for c in raw:
        if isinstance(c, str):          # "닉네임|댓글|좋아요|시간|답글수" 한 줄 형식
            p = (c.split("|") + ["", "", "0", "1일", "0"])[:5]
            c = {"user": p[0], "text": p[1], "likes": p[2], "time": p[3], "replies": p[4]}
        out.append(Comment(user=c.get("user") or "user", text=c["text"],
                           likes=int(c.get("likes") or 0), time=c.get("time") or "1일",
                           replies=int(c.get("replies") or 0)))
    return out


def load_comment_file(path: Path) -> list[Comment]:
    lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines()]
    return parse_comments([l if "|" in l else f"user|{l}" for l in lines if l and not l.startswith("#")])


INTROS = ["한 누리꾼은", "또 다른 댓글에는", "이런 반응도 나왔습니다", "다른 누리꾼은", "이런 댓글도 있었습니다"]


YT_INTROS = ["한 시청자는", "또 다른 댓글에는", "이런 반응도 나왔습니다", "다른 시청자는", "공감을 많이 받은 댓글은"]


def template_lines(headline: list[str], comments: list[Comment], context: str,
                   intros: list[str] = INTROS) -> list[Line]:
    """API 없이: 상황 설명 → 댓글을 좋아요 많은 순으로 소개 → 마무리."""
    lines = [Line(" ".join(headline).strip())]
    if context:
        lines += [Line(s.strip()) for s in context.replace("?", "?.").split(".") if s.strip()][:2]
    order = sorted(range(len(comments)), key=lambda i: -comments[i].likes)[:6]
    for n, i in enumerate(sorted(order)):
        lines.append(Line(intros[n % len(intros)], focus=i))
        lines.append(Line(f'*"{comments[i].text}"*', focus=i))
    lines.append(Line("여러분 생각은 어떠신가요?"))
    return lines


COMMENT_SYSTEM = """너는 '댓글 반응' 뉴스 쇼츠 작가다. 화제가 된 게시물과 그 댓글들을 받아
40~60초짜리 나레이션 대본을 쓴다. 담백한 뉴스 존댓말(~습니다/~네요)을 쓴다.

구조: 상황 요약 1~2문장 → 인상적인 댓글 4~6개를 하나씩 소개(인용은 원문 그대로, 큰따옴표) → 반대 반응이나 맥락 1문장 → 시청자에게 묻는 마무리.
규칙:
- 문장마다 focus 는 그 문장이 다루는 댓글 번호(0부터), 특정 댓글이 아니면 -1.
- 댓글 인용 부분은 *별표*로 감싸 강조. 한 문장 30자 이내로 끊는다.
- 사실로 확인되지 않은 내용을 덧붙이지 말고, 특정인을 모욕하는 표현은 쓰지 않는다.
- title_top 은 상단 제목 첫 줄(16자 이내), title_highlight 는 강조 둘째 줄(14자 이내)."""

COMMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "title_top": {"type": "string"},
        "title_highlight": {"type": "string"},
        "lines": {"type": "array", "items": {
            "type": "object",
            "properties": {"text": {"type": "string"}, "focus": {"type": "integer"}},
            "required": ["text", "focus"], "additionalProperties": False}},
    },
    "required": ["title_top", "title_highlight", "lines"],
    "additionalProperties": False,
}


def claude_lines(headline: list[str], context: str, comments: list[Comment]):
    try:
        import anthropic
    except ImportError:
        return None
    try:
        client = anthropic.Anthropic()
    except Exception:
        return None
    listing = "\n".join(f"[{i}] (좋아요 {c.likes}) {c.text}" for i, c in enumerate(comments))
    try:
        resp = client.beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium",
                           "format": {"type": "json_schema", "schema": COMMENT_SCHEMA}},
            system=COMMENT_SYSTEM,
            messages=[{"role": "user", "content":
                       f"헤드라인: {' '.join(headline)}\n상황: {context or '없음'}\n댓글:\n{listing}"}],
        )
    except (anthropic.AuthenticationError, TypeError):
        return None
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        ms.log(f"Claude 대본 생성 실패 → 템플릿 사용 ({e.__class__.__name__})")
        return None
    if resp.stop_reason in ("refusal", "max_tokens"):
        ms.log(f"Claude 응답 중단({resp.stop_reason}) → 템플릿 사용")
        return None
    try:
        data = json.loads("".join(b.text for b in resp.content if b.type == "text"))
    except json.JSONDecodeError:
        return None
    lines = [Line(l["text"], l["focus"] if 0 <= l["focus"] < len(comments) else None)
             for l in data["lines"] if l["text"].strip()]
    return [data["title_top"], data["title_highlight"]], lines


# ───────────────────────── 댓글 화면 그리기 ─────────────────────────

def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    p = ms.FONT_DIR / f"Pretendard-{weight}.otf"
    if not p.exists():
        p = ms.FONT_DIR / "Pretendard-Black.otf"
    return ImageFont.truetype(str(p), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, f, width: int, first_indent: int = 0) -> list[str]:
    """글자 단위 줄바꿈 (한글은 어절 단위보다 이쪽이 실제 앱과 비슷하다)."""
    lines, cur, limit = [], "", width - first_indent
    for ch in text:
        if draw.textlength(cur + ch, font=f) > limit and cur:
            lines.append(cur)
            cur, limit = ch.lstrip(), width
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines or [""]


def heart(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int, color) -> None:
    t = np.linspace(0, 2 * np.pi, 80)
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    pts = [(cx + s * xi / 17, cy - s * yi / 17) for xi, yi in zip(x, y)]
    draw.line(pts + [pts[0]], fill=color, width=4, joint="curve")


def avatar(size: int, seed: str) -> Image.Image:
    rnd = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rnd.random() < 0.45:             # 기본 프로필 실루엣
        d.ellipse([0, 0, size - 1, size - 1], fill=(219, 219, 219))
        d.ellipse([size * .33, size * .2, size * .67, size * .54], fill=(120, 120, 120))
        d.pieslice([size * .16, size * .58, size * .84, size * 1.25], 180, 360, fill=(120, 120, 120))
    else:                               # 흐린 사진 느낌
        base = tuple(rnd.randint(60, 200) for _ in range(3))
        d.ellipse([0, 0, size - 1, size - 1], fill=base)
        for _ in range(5):
            r = rnd.randint(size // 6, size // 3)
            x, y = rnd.randint(0, size), rnd.randint(0, size)
            d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(min(255, v + rnd.randint(-50, 50)) for v in base))
        img = img.filter(ImageFilter.GaussianBlur(size / 10))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        img.putalpha(mask)
    return img


def render_panel(comments: list[Comment], post: Path | None, blur_names: bool):
    """댓글 목록 전체를 세로로 긴 이미지 한 장으로. 각 댓글의 (y0, y1) 도 반환."""
    f_name, f_text = font("Bold", 40), font("Medium", 40)
    f_meta = font("Bold", 32)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    blocks, y = [], 40
    post_img = None
    if post:
        post_img = Image.open(post).convert("RGB")
        post_img = post_img.resize((W, int(post_img.height * W / post_img.width)))
        y = post_img.height + 40
    for c in comments:
        name_w = probe.textlength(c.user, font=f_name) + 18
        rows = wrap(probe, c.text, f_text, TEXT_W, first_indent=int(name_w))
        h = 30 + len(rows) * 58 + 70 + (70 if c.replies else 0) + 26
        blocks.append((c, rows, name_w, y, y + h))
        y += h
    total_h = max(y + 200, PANEL_H)
    img = Image.new("RGB", (W, total_h), (255, 255, 255))
    if post_img:
        img.paste(post_img, (0, 0))
    d = ImageDraw.Draw(img)
    grey, dark = (142, 142, 142), (38, 38, 38)
    spans = []
    for c, rows, name_w, y0, y1 in blocks:
        top = y0 + 30
        img.paste(av := avatar(AVATAR, c.user + c.text[:4]), (PAD_X, top - 6), av)
        # 닉네임 (블러) + 첫 줄
        d.text((TEXT_X, top), c.user, font=f_name, fill=dark)
        if blur_names:
            box = (TEXT_X - 6, top - 4, int(TEXT_X + name_w), top + 54)
            img.paste(img.crop(box).filter(ImageFilter.GaussianBlur(11)), box[:2])
        for k, row in enumerate(rows):
            d.text((TEXT_X + (name_w if k == 0 else 0), top + k * 58), row, font=f_text, fill=dark)
        my = top + len(rows) * 58 + 18
        meta = [c.time, f"좋아요 {c.likes:,}개" if c.likes else "", "답글 달기"]
        x = TEXT_X
        for m in filter(None, meta):
            d.text((x, my), m, font=f_meta, fill=grey)
            x += probe.textlength(m, font=f_meta) + 40
        heart(d, W - 70, top + 26, 26, grey)
        if c.replies:
            ry = my + 76
            d.line([(TEXT_X, ry + 20), (TEXT_X + 70, ry + 20)], fill=grey, width=3)
            d.text((TEXT_X + 96, ry), f"답글 보기({c.replies}개)", font=f_meta, fill=grey)
        spans.append((y0, y1))
    return np.asarray(img), spans


# ───────────────────────── 유튜브 스타일 ─────────────────────────

YT_BG, YT_TEXT, YT_GREY, YT_BLUE = (15, 15, 15), (241, 241, 241), (170, 170, 170), (62, 166, 255)


def k_num(n: int) -> str:
    """유튜브식 숫자: 1234 → 1.2천, 56789 → 5.7만."""
    if n >= 10000:
        return f"{n / 10000:.1f}".rstrip("0").rstrip(".") + "만"
    if n >= 1000:
        return f"{n / 1000:.1f}".rstrip("0").rstrip(".") + "천"
    return str(n) if n else ""


def thumb_icon(size: int, color, down: bool = False) -> Image.Image:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s, w = size / 40, max(2, size // 14)
    d.rectangle([2 * s, 17 * s, 9 * s, 37 * s], outline=color, width=w)               # 소매
    d.rounded_rectangle([12 * s, 16 * s, 37 * s, 37 * s], 4 * s, outline=color, width=w)  # 손바닥
    d.line([(12 * s, 17 * s), (20 * s, 3 * s), (25 * s, 5 * s), (23 * s, 16 * s)], fill=color, width=w,
           joint="curve")                                                              # 엄지
    return im.transpose(Image.FLIP_TOP_BOTTOM) if down else im


def bubble_icon(size: int, color) -> Image.Image:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s, w = size / 40, max(2, size // 14)
    d.rounded_rectangle([3 * s, 5 * s, 37 * s, 29 * s], 6 * s, outline=color, width=w)
    d.line([(12 * s, 29 * s), (10 * s, 37 * s), (20 * s, 29 * s)], fill=color, width=w)
    return im


def render_panel_youtube(comments: list[Comment], post: Path | None, blur_names: bool,
                         video_title: str = "", channel: str = "", comment_count: int = 0):
    """유튜브 앱(다크 모드) 댓글 화면. 썸네일 → 영상 제목 → '댓글 N개' → 댓글들."""
    f_title, f_head = font("Bold", 44), font("Bold", 42)
    f_handle, f_text, f_meta = font("Medium", 32), font("Medium", 40), font("Medium", 32)
    f_reply = font("Bold", 34)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    x0, av, tx = 40, 80, 40 + 80 + 28
    tw = W - tx - 80

    head_parts, y = [], 0
    thumb = None
    if post:
        thumb = Image.open(post).convert("RGB")
        thumb = thumb.resize((W, int(thumb.height * W / thumb.width)))
        y = thumb.height
    t_rows = wrap(probe, video_title, f_title, W - 80)[:2] if video_title else []
    if t_rows:
        head_parts.append(("title", y + 28))
        y += 28 + len(t_rows) * 60 + (52 if channel else 0)
    head_y = y + 40
    y = head_y + 90

    blocks = []
    for c in comments:
        rows = wrap(probe, c.text, f_text, tw)
        h = 26 + 48 + len(rows) * 56 + 84 + (70 if c.replies else 0) + 20
        blocks.append((c, rows, y, y + h))
        y += h
    img = Image.new("RGB", (W, max(y + 200, PANEL_H)), YT_BG)
    d = ImageDraw.Draw(img)
    if thumb:
        img.paste(thumb, (0, 0))
    if t_rows:
        ty = head_parts[0][1]
        for k, row in enumerate(t_rows):
            d.text((40, ty + k * 60), row, font=f_title, fill=YT_TEXT)
        if channel:
            d.text((40, ty + len(t_rows) * 60 + 6), channel, font=f_meta, fill=YT_GREY)
        d.line([(0, head_y - 14), (W, head_y - 14)], fill=(48, 48, 48), width=2)
    head = f"댓글 {comment_count:,}개" if comment_count else "댓글"
    d.text((40, head_y), head, font=f_head, fill=YT_TEXT)
    hw = probe.textlength(head, font=f_head)
    d.text((40 + hw + 30, head_y + 8), "≡ 정렬", font=f_meta, fill=YT_GREY)

    up, down, bub = thumb_icon(40, YT_TEXT), thumb_icon(40, YT_TEXT, True), bubble_icon(40, YT_TEXT)
    spans = []
    for c, rows, y0, y1 in blocks:
        top = y0 + 26
        img.paste(a := avatar(av, c.user + c.text[:4]), (x0, top), a)
        handle = c.user if c.user.startswith("@") else "@" + c.user
        d.text((tx, top), handle, font=f_handle, fill=YT_GREY)
        hw = probe.textlength(handle, font=f_handle)
        if blur_names:
            box = (tx - 6, top - 4, int(tx + hw + 6), top + 44)
            img.paste(img.crop(box).filter(ImageFilter.GaussianBlur(10)), box[:2])
        d.text((tx + hw + 14, top), f"· {c.time}", font=f_meta, fill=YT_GREY)
        for dx in (0, 1, 2):                                   # ⋮ 메뉴
            d.ellipse([W - 52, top + 4 + dx * 12, W - 45, top + 11 + dx * 12], fill=YT_TEXT)
        ty = top + 48
        for k, row in enumerate(rows):
            d.text((tx, ty + k * 56), row, font=f_text, fill=YT_TEXT)
        ay = ty + len(rows) * 56 + 22
        img.paste(up, (tx, ay), up)
        lk = k_num(c.likes)
        d.text((tx + 52, ay + 4), lk, font=f_meta, fill=YT_GREY)
        bx = tx + 52 + probe.textlength(lk, font=f_meta) + 44
        img.paste(down, (int(bx), ay + 2), down)
        img.paste(bub, (int(bx + 92), ay + 2), bub)
        if c.replies:
            ry = ay + 76
            d.polygon([(tx + 4, ry + 12), (tx + 24, ry + 12), (tx + 14, ry + 24)], fill=YT_BLUE)
            d.text((tx + 40, ry), f"답글 {c.replies:,}개", font=f_reply, fill=YT_BLUE)
        spans.append((y0, y1))
    return np.asarray(img), spans


# ───────────────────────── 카메라 + 프레임 ─────────────────────────

def ease(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2


def render_body(panel: np.ndarray, cspans, lines: list[Line], tspans, total: float, out: Path,
                tint=(255, 244, 200)) -> None:
    """읽는 댓글로 스크롤 + 주변 어둡게. 프레임을 ffmpeg 로 바로 흘려보낸다."""
    ph = panel.shape[0]
    max_y = max(0, ph - PANEL_H)

    def target(focus, prev):
        if focus is None:
            return prev
        a, b = cspans[focus]
        return int(min(max((a + b) / 2 - PANEL_H * 0.42, 0), max_y))

    cams, prev = [], 0
    for ln in lines:                    # 문장별 (출발 y, 도착 y)
        tgt = target(ln.focus, prev)
        cams.append((prev, tgt))
        prev = tgt

    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{PANEL_H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
         "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
    n = int(round(total * FPS))
    li = 0
    for fi in range(n):
        t = fi / FPS
        while li + 1 < len(tspans) and t >= tspans[li + 1][0]:
            li += 1
        start = tspans[li][0]
        y0, y1 = cams[li]
        k = ease((t - start) / EASE)
        y = int(y0 + (y1 - y0) * k)
        frame = panel[y:y + PANEL_H].astype(np.float32)
        focus = lines[li].focus
        if focus is not None:
            a, b = cspans[focus]
            a, b = max(a - y, 0), min(b - y, PANEL_H)
            prev_focus = lines[li - 1].focus if li else None
            dim = DIM * (1 if prev_focus is not None else k)    # 처음 강조될 때만 서서히
            frame *= 1 - dim
            if b > a:
                frame[a:b] = panel[y + a:y + b] * 0.92 + np.array(tint) * 0.08
        proc.stdin.write(frame.clip(0, 255).astype(np.uint8).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("댓글 화면 인코딩 실패")


# ───────────────────────── 자막 ─────────────────────────

def build_ass(title: list[str], label: str, source: str, lines: list[Line], spans, total: float,
              out: Path, font_name: str) -> Path:
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,{font_name},78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-2,0,1,0,0,5,40,40,0,1
Style: Label,{font_name},42,&H00FFFFFF,&H00FFFFFF,&H00908A1E,&H00000000,0,0,0,0,100,100,0,0,3,14,0,5,40,40,0,1
Style: Cap,{font_name},92,&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,0,0,0,0,100,100,-2,0,1,8,3,5,30,30,0,1
Style: Src,{font_name},34,&H00909090,&H00909090,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    end = ms.ass_time(total)
    top, bottom = (title + ["", ""])[:2]
    ev = []
    if label:
        ev.append(f"Dialogue: 1,0:00:00.00,{end},Label,,0,0,0,,{{\\pos({W // 2},90)}}{label}")
    pop = "\\fscx80\\fscy80\\t(0,120,\\fscx103\\fscy103)\\t(120,200,\\fscx100\\fscy100)"
    ev.append(f"Dialogue: 1,0:00:00.00,{end},Title,,0,0,0,,{{\\pos({W // 2},200){pop}}}{ms.ass_text(top, MINT)}")
    ev.append(f"Dialogue: 1,0:00:00.00,{end},Title,,0,0,0,,{{\\pos({W // 2},300)\\c{MINT}{pop}}}{ms.ass_text(bottom, MINT)}")
    if source:
        ev.append(f"Dialogue: 1,0:00:00.00,{end},Src,,0,0,0,,{{\\pos({W // 2},{PANEL_Y + PANEL_H + 60})}}{source}")
    cap_pop = "\\fscx85\\fscy85\\t(0,70,\\fscx106\\fscy106)\\t(70,130,\\fscx100\\fscy100)"
    for ln, (a, b) in zip(lines, spans):
        chunks = ms.chunk_caption(ln.text, 13)
        weights = [max(1, len(ms.plain(c))) for c in chunks]
        t = a
        for j, (c, w) in enumerate(zip(chunks, weights)):
            d = (b - a) * w / sum(weights)
            hold = ms.GAP if j == len(chunks) - 1 else 0
            ev.append(f"Dialogue: 2,{ms.ass_time(t)},{ms.ass_time(t + d + hold)},Cap,,0,0,0,,"
                      f"{{\\pos({W // 2},{CAPTION_Y}){cap_pop}}}{ms.ass_text(c, MINT)}")
            t += d
    out.write_text(head + "\n".join(ev) + "\n", encoding="utf-8")
    return out


# ───────────────────────── 실행 ─────────────────────────

DEMO = {
    "label": "오늘의 반응",
    "headline": ["\"대표팀 안 왔으면\"", "SNS 사진에 달린 댓글"],
    "context": "한 축구 선수의 SNS 사진에 조롱성 댓글이 이어졌습니다.",
    "source": "※ 댓글은 예시입니다",
    "comments": [
        "fan_01|국대서 깽판그만쳐라|960|1일|38",
        "abc_kr|은퇴하신답니다 한국마케팅 안하셔도 될듯|371|1일|0",
        "football_lover|뭐하니 너 거기서? 국대에서는 어깨 뽕이 장난 아닌 놈이. 그 잘난 클럽에서는 마케팅 담당하나?|427|1일|81",
        "kim_s|국대로 다시 뛰기만 해봐라|149|21시간|3",
        "user9|은퇴 축하한다|234|18시간|0",
        "real_fan|그래도 응원합니다 힘내세요|88|15시간|2",
    ],
}


YT_DEMO = {
    "label": "댓글 반응",
    "headline": ["\"이게 무슨 일?\"", "영상에 달린 시청자 댓글"],
    "context": "한 영상에 시청자들의 댓글이 쏟아졌습니다.",
    "source": "※ 댓글은 예시입니다",
    "video_title": "예시 영상 제목이 여기에 들어갑니다 | 오늘의 화제",
    "channel": "예시 채널 · 조회수 12만회",
    "comment_count": 1234,
    "comments": [
        "@viewer01|이거 보고 진짜 소름 돋았어요|12400|2일 전|38",
        "@hello_kr|3분부터 보세요 레전드입니다|5300|1일 전|12",
        "@abc123|댓글 보러 왔다가 영상 또 보고 갑니다|980|20시간 전|0",
        "@mr_kim|이 채널은 왜 이렇게 편집을 잘함?|431|15시간 전|4",
        "@user_x|솔직히 이건 좀 아닌 듯|212|9시간 전|57",
    ],
}


def main() -> None:
    ap = argparse.ArgumentParser(description="댓글 기반 쇼츠 자동 생성")
    ap.add_argument("--project", help="프로젝트 JSON (headline/comments/lines/post …)")
    ap.add_argument("--comments", help="댓글 텍스트 파일 (줄마다 '닉네임|댓글|좋아요|시간|답글수' 또는 댓글만)")
    ap.add_argument("--headline", help="상단 제목, '/' 로 두 줄 구분")
    ap.add_argument("--context", help="상황 설명 한두 문장")
    ap.add_argument("--post", help="댓글 위에 보여줄 게시물 이미지")
    ap.add_argument("--bgm", help="배경음악")
    ap.add_argument("--bgm-volume", type=float, default=0.3)
    ap.add_argument("--tts", choices=["edge", "gtts", "none"], default="edge")
    ap.add_argument("--voice", default=None, help="기본 ko-KR-SunHiNeural (뉴스 톤)")
    ap.add_argument("--rate", default=None)
    ap.add_argument("--style", choices=["insta", "youtube"], default=None, help="댓글 화면 모양 (기본 insta)")
    ap.add_argument("--youtube", help="유튜브 영상 링크 → 제목·썸네일·인기 댓글 자동 수집 (style=youtube)")
    ap.add_argument("--max-comments", type=int, default=6, help="--youtube 로 가져올 댓글 수")
    ap.add_argument("--show-names", action="store_true", help="닉네임 블러 끄기 (기본은 블러)")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--out", default="out/comments.mp4")
    ap.add_argument("--keep", action="store_true")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg 가 필요합니다.")
    cfg: dict = dict(DEMO) if args.demo else {}
    if args.project:
        cfg.update(json.loads(Path(args.project).read_text(encoding="utf-8")))
        base = Path(args.project).resolve().parent
        for k in ("post", "bgm"):
            if cfg.get(k) and not Path(cfg[k]).is_absolute():
                cfg[k] = str(base / cfg[k])
    if args.headline:
        cfg["headline"] = args.headline.split("/")
    for k in ("context", "post", "bgm", "voice", "rate", "style"):
        if getattr(args, k):
            cfg[k] = getattr(args, k)
    if args.demo and cfg.get("style") == "youtube":
        cfg.update(YT_DEMO)
    work = Path(tempfile.mkdtemp(prefix="cmt_"))
    if args.youtube:
        import yt_fetch
        ms.log("유튜브 댓글 가져오는 중")
        yt = yt_fetch.fetch(args.youtube, work, limit=args.max_comments)
        cfg.setdefault("style", "youtube")
        cfg.setdefault("comments", yt["comments"])
        cfg.setdefault("video_title", yt["title"])
        cfg.setdefault("channel", yt["channel"])
        cfg.setdefault("comment_count", yt["comment_count"])
        cfg.setdefault("headline", [yt["title"][:18], "시청자 댓글 반응"])
        cfg.setdefault("source", f"출처: 유튜브 '{yt['channel']}' 댓글")
        if yt.get("thumb"):
            cfg.setdefault("post", yt["thumb"])
        ms.log(f"댓글 {len(yt['comments'])}개 · {yt['title']}")
    youtube = cfg.get("style") == "youtube"
    if args.demo and youtube and not cfg.get("post"):      # 데모용 가짜 썸네일
        th = Image.new("RGB", (1280, 720))
        dd = ImageDraw.Draw(th)
        for yy in range(720):
            dd.line([(0, yy), (1280, yy)], fill=(200 - yy // 6, 40 + yy // 8, 60 + yy // 5))
        dd.text((640, 360), "THUMBNAIL", font=font("Black", 120), fill="white", anchor="mm")
        th.save(work / "thumb.jpg")
        cfg["post"] = str(work / "thumb.jpg")
    comments = load_comment_file(Path(args.comments)) if args.comments else parse_comments(cfg.get("comments", []))
    if not comments:
        sys.exit("댓글이 없습니다. --comments 파일이나 프로젝트의 comments 를 넣어주세요.")
    headline = cfg.get("headline") or ["화제의 게시물", "댓글 반응"]
    if isinstance(headline, str):
        headline = headline.split("/")

    font_name = ms.ensure_fonts()
    title = headline
    if cfg.get("lines"):
        lines = [Line(l) if isinstance(l, str) else Line(l["text"], l.get("focus")) for l in cfg["lines"]]
        ms.log("대본: 프로젝트 파일")
    else:
        got = None if args.no_llm else claude_lines(headline, cfg.get("context", ""), comments)
        if got:
            title, lines = got
            ms.log("대본: Claude 생성")
        else:
            lines = template_lines(headline, comments, cfg.get("context", ""),
                                   YT_INTROS if youtube else INTROS)
            ms.log("대본: 내장 템플릿")
    title = cfg.get("title") or title
    for i, l in enumerate(lines, 1):
        print(f"   {i:2d}. {ms.plain(l.text)}" + (f"   ← 댓글 {l.focus}" if l.focus is not None else ""))

    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        tts = "none" if args.demo and args.tts == "edge" else args.tts   # 데모는 무음
        ms.log("음성 합성")
        script = ms.Script(title=title, lines=[l.text for l in lines])
        voice, spans, total = ms.build_voice(script, work, tts, cfg.get("voice", "ko-KR-SunHiNeural"),
                                             cfg.get("rate", "+10%"))
        ms.log(f"총 길이 {total:.1f}초")

        ms.log("댓글 화면 그리기")
        post = Path(cfg["post"]) if cfg.get("post") else None
        if youtube:
            panel, cspans = render_panel_youtube(comments, post, not args.show_names, cfg.get("video_title", ""),
                                                 cfg.get("channel", ""), int(cfg.get("comment_count") or 0))
        else:
            panel, cspans = render_panel(comments, post, blur_names=not args.show_names)
        body = work / "body.mp4"
        render_body(panel, cspans, lines, spans, total, body, tint=(255, 255, 255) if youtube else (255, 244, 200))

        ass = build_ass(title, cfg.get("label", ""), cfg.get("source", ""), lines, spans, total,
                        work / "subs.ass", font_name)
        ms.log("합성·인코딩")
        bgm = Path(cfg["bgm"]).resolve() if cfg.get("bgm") else None
        cwd = os.getcwd()
        os.chdir(work)
        try:
            ms.compose(body, voice, ass, bgm, total, out, args.bgm_volume, video_y=PANEL_Y,
                       bg="0x0f0f0f" if youtube else BG)
        finally:
            os.chdir(cwd)
        meta = {"title": title, "lines": [{"text": l.text, "focus": l.focus} for l in lines],
                "duration": round(total, 2)}
        out.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        ms.log(f"완료 → {out}  ({total:.1f}초)")
    finally:
        if args.keep:
            ms.log(f"작업 폴더: {work}")
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
