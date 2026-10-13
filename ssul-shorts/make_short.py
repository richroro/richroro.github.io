#!/usr/bin/env python3
"""썰쇼핑 쇼츠 자동 생성기 — 대본 → 음성 → 컷 편집 → 자막 → MP4 를 한 번에.

편집 툴 없이 명령 한 줄로 완성본이 나온다.

    # 제품명만 주면 대본까지 알아서 (ANTHROPIC_API_KEY 있으면 Claude, 없으면 내장 템플릿)
    python make_short.py --product "자동 각도 조절 휴대폰 거치대" --media ./clips

    # 대본을 직접 쓴 프로젝트 파일로
    python make_short.py --project example/project.json

    # 소재 없이 파이프라인만 확인 (가짜 소재 + 무음)
    python make_short.py --demo

파이프라인
    1) 대본      title(상단 훅 2줄) + lines(나레이션 문장들)
    2) 음성      문장마다 TTS → 길이 측정 → 이 길이가 곧 타임라인
    3) 컷 나누기  원본 영상을 장면 전환 감지로 샷 단위로 자르고, 사진은 켄번즈 샷으로
    4) 배치      문장 길이만큼 샷을 최대 MAX_CUT 초씩 잘라 이어 붙임 (쇼츠 템포)
    5) 자막      문장을 짧은 덩어리로 쪼개 팝업 자막(ASS), *강조* 는 노란색
    6) 합성      1080x1920 검은 캔버스 / 상단 훅 제목 / 가운데 1:1 영상 / 자막 / BGM 덕킹
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FONT_DIR = ROOT / "fonts"
FONT_URL = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/{}.otf"
FONT_FILES = ["Pretendard-Black", "Pretendard-ExtraBold", "Pretendard-Bold", "Pretendard-Medium"]

W, H, FPS = 1080, 1920, 30
VIDEO_Y, VIDEO_SIZE = 560, 1080        # 가운데 1:1 영상 영역 (y=560~1640)
CAPTION_Y = 1470                       # 자막 기준선 (영상 아래쪽 위에 얹힘)
MAX_CUT = 2.2                          # 한 컷 최대 길이(초) — 짧을수록 빠른 템포
MIN_SHOT = 0.6                         # 이보다 짧은 장면은 버림
GAP = 0.12                             # 문장 사이 숨 고르기
CAPTION_CHARS = 11                     # 자막 한 덩어리 최대 글자 수
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}


# ───────────────────────── 공통 ─────────────────────────

def run(cmd: list[str], quiet: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise RuntimeError(f"명령 실패: {' '.join(cmd[:6])} …")
    if not quiet:
        print(r.stdout)
    return r


def ffprobe_duration(path: Path) -> float:
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def log(msg: str) -> None:
    print(f"• {msg}", flush=True)


# ───────────────────────── 1) 대본 ─────────────────────────

@dataclass
class Script:
    title: list[str]                    # [흰 줄, 노란 줄]
    lines: list[str]                    # 나레이션 문장 (*강조* 가능)
    hashtags: list[str] = field(default_factory=list)


HOOKS = [
    "솔직히 이거 처음 보고 소름 돋았음",
    "이거 모르면 진짜 손해임",
    "와 이걸 왜 이제 알았지",
    "친구 집 갔다가 이거 보고 바로 주문함",
]
TITLE_TOPS = ["귀찮음에서 탄생한", "이거 만든 사람 상 줘야됨", "자취생들 난리난", "써본 사람만 아는"]
TITLE_BOTTOMS = ["천재의 발명품", "역대급 꿀템", "삶의 질 수직상승템", "인생템 등극"]


def template_script(product: str, pain: str | None, features: list[str], benefit: str | None,
                    seed: int | None = None) -> Script:
    """API 없이 쓰는 기본 썰 구조: 훅 → 고통 썰 → 반전 → 제품 → 기능 → 결말 → CTA."""
    rnd = random.Random(seed if seed is not None else product)
    pain = pain or "이것 때문에 매일 스트레스였거든"
    benefit = benefit or "이제 그 스트레스가 완전히 사라짐"
    lines = [
        rnd.choice(HOOKS),
        f"나 자취 3년차인데 {pain}",
        "근데 친구가 이거 써보라고 던져주더라",
        f"바로 이 *{product}*",
    ]
    for f in features[:3] or ["처음엔 반신반의했는데", "써보니까 *진짜 신세계*임"]:
        lines.append(f)
    lines += [benefit, "진작 살 걸 그랬음", "정보는 *프로필 링크*에 있어"]
    return Script(title=[rnd.choice(TITLE_TOPS), rnd.choice(TITLE_BOTTOMS)], lines=lines,
                  hashtags=["#쇼핑", "#꿀템", "#살림템", "#추천템"])


SCRIPT_SYSTEM = """너는 유튜브 쇼츠 '썰쇼핑' 전문 작가다. 썰쇼핑은 실제 겪은 일처럼 짧은 썰을 풀다가
자연스럽게 제품이 해결책으로 등장하는 30~40초짜리 반말 나레이션 영상이다.

구조: 1문장 훅(스크롤을 멈추게) → 2~3문장 고통/상황 썰 → 반전(제품 등장) → 기능·효과 2~4문장 → 결말 한마디 → CTA(프로필 링크).
규칙:
- 총 9~13문장, 각 문장 25자 이내, 구어체 반말, 과장된 의학·효능 주장 금지.
- 제품 이름이나 핵심 단어 1~2개는 *별표*로 감싸 강조.
- title 은 상단 고정 제목 2줄: top 은 상황(12자 이내), highlight 는 노란색으로 강조될 결론(10자 이내).
- hashtags 는 5개."""

SCRIPT_SCHEMA = {
    "type": "object",
    "properties": {
        "title_top": {"type": "string"},
        "title_highlight": {"type": "string"},
        "lines": {"type": "array", "items": {"type": "string"}},
        "hashtags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title_top", "title_highlight", "lines", "hashtags"],
    "additionalProperties": False,
}


def claude_script(product: str, info: str) -> Script | None:
    """ANTHROPIC_API_KEY(또는 ant auth login) 가 있으면 Claude 로 대본 생성. 실패하면 None."""
    try:
        import anthropic
    except ImportError:
        return None
    try:
        client = anthropic.Anthropic()
    except Exception:                   # 자격 증명 없음
        return None
    try:
        resp = client.beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium",
                           "format": {"type": "json_schema", "schema": SCRIPT_SCHEMA}},
            system=SCRIPT_SYSTEM,
            messages=[{"role": "user",
                       "content": f"제품: {product}\n참고 정보: {info or '없음'}\n썰쇼핑 대본을 써줘."}],
        )
    except (anthropic.AuthenticationError, TypeError):   # 키 없음/잘못됨 → 조용히 템플릿으로
        return None
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        log(f"Claude 대본 생성 실패 → 템플릿 사용 ({e.__class__.__name__})")
        return None
    if resp.stop_reason in ("refusal", "max_tokens"):
        log(f"Claude 응답 중단({resp.stop_reason}) → 템플릿 사용")
        return None
    text = "".join(b.text for b in resp.content if b.type == "text")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    return Script(title=[data["title_top"], data["title_highlight"]],
                  lines=[l.strip() for l in data["lines"] if l.strip()],
                  hashtags=data["hashtags"])


# ───────────────────────── 2) 음성 ─────────────────────────

def plain(text: str) -> str:
    return text.replace("*", "")


def estimate_seconds(text: str) -> float:
    # 쇼츠 나레이션 ≈ 초당 7~8자
    return max(1.2, len(plain(text).replace(" ", "")) / 7.5 + 0.25)


def tts_line(text: str, out: Path, backend: str, voice: str, rate: str) -> float:
    """문장 하나를 음성 파일로. 반환값은 길이(초). backend=none 이면 무음."""
    if backend == "edge":
        import edge_tts

        async def go():
            await edge_tts.Communicate(plain(text), voice, rate=rate,
                                       proxy=os.environ.get("HTTPS_PROXY")).save(str(out))
        asyncio.run(go())
    elif backend == "gtts":
        from gtts import gTTS
        gTTS(plain(text), lang="ko").save(str(out))
        if rate not in ("+0%", "0%"):          # gTTS 는 속도 조절이 없어서 ffmpeg 로
            pct = int(rate.strip("%").replace("+", ""))
            sped = out.with_suffix(".fast.mp3")
            run(["ffmpeg", "-y", "-i", str(out), "-filter:a", f"atempo={1 + pct / 100:.2f}", str(sped)])
            sped.replace(out)
    else:
        dur = estimate_seconds(text)
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", f"{dur:.2f}", str(out)])
    return ffprobe_duration(out)


def build_voice(script: Script, work: Path, backend: str, voice: str, rate: str):
    """문장별 음성 → 하나로 이어 붙인 voice.wav, 문장별 (시작, 끝) 반환."""
    if backend == "edge":
        try:
            import edge_tts  # noqa: F401
        except ImportError:
            log("edge-tts 미설치 → 무음 모드 (pip install edge-tts)")
            backend = "none"
    parts, spans, t = [], [], 0.0
    for i, line in enumerate(script.lines):
        f = work / f"v{i:02d}.mp3"
        try:
            d = tts_line(line, f, backend, voice, rate)
        except Exception as e:  # 네트워크 막힘 등 → 그 문장만 무음 처리
            log(f"TTS 실패({e.__class__.__name__}) → 문장 {i + 1} 무음")
            d = tts_line(line, f, "none", voice, rate)
        spans.append((t, t + d))
        parts.append((f, d))
        t += d + GAP
    total = t
    # concat: 문장 + 짧은 무음
    inputs, chains = [], []
    for i, (f, _) in enumerate(parts):
        inputs += ["-i", str(f)]
        chains.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur={GAP}[a{i}]")
    cat = "".join(f"[a{i}]" for i in range(len(parts)))
    fc = ";".join(chains) + f";{cat}concat=n={len(parts)}:v=0:a=1[out]"
    voice_wav = work / "voice.wav"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", fc, "-map", "[out]", str(voice_wav)])
    return voice_wav, spans, total


# ───────────────────────── 3) 컷 나누기 ─────────────────────────

@dataclass
class Shot:
    src: Path
    start: float
    end: float          # 사진은 inf
    is_image: bool = False

    @property
    def length(self) -> float:
        return self.end - self.start


def detect_scenes(video: Path, threshold: float) -> list[Shot]:
    """ffmpeg 장면 전환 점수로 원본 영상을 샷 단위로 자른다."""
    dur = ffprobe_duration(video)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(video), "-an",
                        "-vf", f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
                       capture_output=True, text=True)
    cuts = [float(m) for m in re.findall(r"pts_time:([\d.]+)", r.stderr)]
    bounds = [0.0] + [c for c in cuts if 0 < c < dur] + [dur]
    shots = []
    for a, b in zip(bounds, bounds[1:]):
        # 장면 경계 직후/직전 몇 프레임은 전환 잔상이 있어 살짝 깎는다
        a2, b2 = a + 0.05, b - 0.05
        if b2 - a2 >= MIN_SHOT:
            shots.append(Shot(video, a2, b2))
    return shots or [Shot(video, 0, max(dur, MIN_SHOT))]


def placeholder_image(text: str, out: Path, idx: int) -> Path:
    """소재가 없을 때 쓰는 빈칸 카드."""
    from PIL import Image, ImageDraw, ImageFont
    palette = [(255, 94, 98), (255, 179, 71), (72, 199, 142), (64, 156, 255), (171, 107, 255)]
    c1 = palette[idx % len(palette)]
    c2 = tuple(int(v * 0.45) for v in c1)
    img = Image.new("RGB", (VIDEO_SIZE, VIDEO_SIZE))
    d = ImageDraw.Draw(img)
    for y in range(VIDEO_SIZE):
        k = y / VIDEO_SIZE
        d.line([(0, y), (VIDEO_SIZE, y)], fill=tuple(int(a * (1 - k) + b * k) for a, b in zip(c1, c2)))
    font_path = FONT_DIR / "Pretendard-Black.otf"
    font = ImageFont.truetype(str(font_path), 84) if font_path.exists() else ImageFont.load_default()
    label = f"#{idx + 1}\n{text}"
    box = d.multiline_textbbox((0, 0), label, font=font, align="center", spacing=20)
    d.multiline_text(((VIDEO_SIZE - box[2]) / 2, (VIDEO_SIZE - box[3]) / 2), label, font=font,
                     fill="white", align="center", spacing=20)
    img.save(out)
    return out


def collect_shots(media: Path | None, product: str, work: Path, threshold: float) -> list[Shot]:
    files = sorted(p for p in media.iterdir() if p.is_file()) if media and media.is_dir() else []
    if media and media.is_file():
        files = [media]
    shots: list[Shot] = []
    for f in files:
        ext = f.suffix.lower()
        if ext in VIDEO_EXT:
            s = detect_scenes(f, threshold)
            log(f"컷 나누기: {f.name} → {len(s)}컷")
            shots += s
        elif ext in IMAGE_EXT:
            shots.append(Shot(f, 0, float("inf"), is_image=True))
    if not shots:
        log("소재 없음 → 빈칸 카드로 대체")
        for i in range(4):
            p = placeholder_image(product, work / f"blank{i}.png", i)
            shots.append(Shot(p, 0, float("inf"), is_image=True))
    return shots


# ───────────────────────── 4) 배치 ─────────────────────────

@dataclass
class Cut:
    shot: Shot
    offset: float       # shot.start 기준 오프셋
    dur: float
    zoom_in: bool = True


def plan_cuts(shots: list[Shot], spans: list[tuple[float, float]], total: float) -> list[Cut]:
    """문장 경계에서 컷이 바뀌도록, 문장 하나를 MAX_CUT 이하 조각으로 채운다.
    매 컷마다 다음 소재로 넘어가고, 다 쓴 샷은 처음부터 다시 쓴다."""
    cuts: list[Cut] = []
    pos = [0.0] * len(shots)        # 샷마다 이미 쓴 길이
    si = 0
    bounds = [s for s, _ in spans] + [total]
    for a, b in zip(bounds, bounds[1:]):
        remain = b - a
        while remain > 0.01:
            k = si % len(shots)
            shot = shots[k]
            if shot.length - pos[k] < MIN_SHOT:
                pos[k] = 0.0
            left = shot.length - pos[k]
            piece = min(MAX_CUT, left, remain)
            if 0 < remain - piece < 0.4:               # 0.4초 미만 자투리는 이 컷에 흡수
                piece = min(remain, left)
            cuts.append(Cut(shot, pos[k], piece, zoom_in=len(cuts) % 2 == 0))
            pos[k] += piece
            remain -= piece
            si += 1
    return cuts


def render_cut(cut: Cut, out: Path) -> None:
    S = VIDEO_SIZE
    frames = max(1, round(cut.dur * FPS))
    if cut.shot.is_image:
        z = "min(1+0.12*on/{n},1.12)" if cut.zoom_in else "max(1.12-0.12*on/{n},1)"
        vf = (f"scale={S * 2}:{S * 2}:force_original_aspect_ratio=increase,crop={S * 2}:{S * 2},"
              f"zoompan=z='{z.format(n=frames)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
              f":d={frames}:s={S}x{S}:fps={FPS},setsar=1,format=yuv420p")
        cmd = ["ffmpeg", "-y", "-i", str(cut.shot.src), "-vf", vf, "-frames:v", str(frames)]
    else:
        # 살짝 줌인(1.06배)해서 원본 워터마크·테두리를 덜어내고 움직임감 추가
        vf = (f"scale={S}:{S}:force_original_aspect_ratio=increase,crop={S}:{S},"
              f"scale={int(S * 1.06)}:-2,crop={S}:{S},fps={FPS},setsar=1,format=yuv420p")
        cmd = ["ffmpeg", "-y", "-ss", f"{cut.shot.start + cut.offset:.3f}", "-t", f"{cut.dur:.3f}",
               "-i", str(cut.shot.src), "-vf", vf, "-frames:v", str(frames)]
    run(cmd + ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(out)])


def build_body(cuts: list[Cut], work: Path) -> Path:
    lst = work / "cuts.txt"
    with lst.open("w") as fp:
        for i, c in enumerate(cuts):
            p = work / f"c{i:03d}.mp4"
            render_cut(c, p)
            fp.write(f"file '{p.name}'\n")
    body = work / "body.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(body)])
    return body


# ───────────────────────── 5) 자막 ─────────────────────────

def chunk_caption(text: str, limit: int = CAPTION_CHARS) -> list[str]:
    """어절 단위로 limit 글자 이하 덩어리로. *강조* 표시는 유지."""
    words, chunks, cur = text.split(), [], ""
    for w in words:
        cand = f"{cur} {w}".strip()
        if cur and len(plain(cand)) > limit:
            chunks.append(cur)
            cur = w
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    # 마지막 덩어리가 한 단어(3자 이하)로 남으면 앞 덩어리에 붙인다
    if len(chunks) > 1 and len(plain(chunks[-1]).strip('"')) <= 3:
        chunks[-2:] = [f"{chunks[-2]} {chunks[-1]}"]
    # 별표가 덩어리 사이에서 끊기면 양쪽을 각각 닫아준다
    fixed, open_ = [], False
    for c in chunks:
        if open_:
            c = "*" + c
        open_ = c.count("*") % 2 == 1
        if open_:
            c = c + "*"
        fixed.append(c)
    return fixed


def ass_time(t: float) -> str:
    t = max(0.0, t)
    h, m = int(t // 3600), int(t % 3600 // 60)
    return f"{h}:{m:02d}:{t % 60:05.2f}"


def ass_text(text: str, hi: str = "&H0000E5FF&") -> str:
    out, on = "", False
    for part in re.split(r"(\*)", text.replace("{", "(").replace("}", ")")):
        if part == "*":
            on = not on
            out += f"{{\\c{hi}}}" if on else "{\\c&H00FFFFFF&}"
        else:
            out += part
    return out


def build_ass(script: Script, spans, total: float, out: Path, font: str, cta: str) -> Path:
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,{font},96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-2,0,1,0,0,5,40,40,0,1
Style: Cap,{font},100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,-2,0,1,9,4,5,40,40,0,1
Style: Band,{font},46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    end = ass_time(total)
    top, bottom = (script.title + ["", ""])[:2]
    # 상단 고정 훅 제목: 흰 줄 + 노란 줄, 시작 때 살짝 튀어나옴
    pop = "\\fscx70\\fscy70\\t(0,120,\\fscx104\\fscy104)\\t(120,200,\\fscx100\\fscy100)"
    ev.append(f"Dialogue: 1,0:00:00.00,{end},Title,,0,0,0,,{{\\pos({W // 2},300)\\fad(0,0){pop}}}{ass_text(top)}")
    ev.append(f"Dialogue: 1,0:00:00.00,{end},Title,,0,0,0,,{{\\pos({W // 2},420)\\c&H0000E5FF&{pop}}}{ass_text(bottom)}")
    # 영상 아래 띠: CTA
    ev.append(f"Dialogue: 1,0:00:00.00,{end},Band,,0,0,0,,{{\\pos({W // 2},{VIDEO_Y + VIDEO_SIZE + 70})\\c&H00B4B4B4&}}{ass_text(cta)}")
    # 나레이션 팝업 자막
    cap_pop = "\\fscx82\\fscy82\\t(0,70,\\fscx108\\fscy108)\\t(70,130,\\fscx100\\fscy100)"
    for line, (a, b) in zip(script.lines, spans):
        chunks = chunk_caption(line)
        weights = [max(1, len(plain(c))) for c in chunks]
        t = a
        for j, (c, w) in enumerate(zip(chunks, weights)):
            d = (b - a) * w / sum(weights)
            hold = GAP if j == len(chunks) - 1 else 0    # 문장 사이 빈틈에도 자막 유지
            ev.append(f"Dialogue: 2,{ass_time(t)},{ass_time(t + d + hold)},Cap,,0,0,0,,"
                      f"{{\\pos({W // 2},{CAPTION_Y}){cap_pop}}}{ass_text(c)}")
            t += d
    out.write_text(head + "\n".join(ev) + "\n", encoding="utf-8")
    return out


# ───────────────────────── 6) 합성 ─────────────────────────

def ensure_fonts() -> str:
    """Pretendard(OFL) 를 fonts/ 에 준비. 실패하면 시스템 폰트에 맡김."""
    FONT_DIR.mkdir(exist_ok=True)
    for name in FONT_FILES:
        p = FONT_DIR / f"{name}.otf"
        if p.exists():
            continue
        try:
            log(f"폰트 내려받는 중: {name}")
            urllib.request.urlretrieve(FONT_URL.format(name), p)
        except Exception as e:
            log(f"폰트 다운로드 실패({e.__class__.__name__}) — fonts/ 에 한글 폰트를 직접 넣어주세요")
            p.unlink(missing_ok=True)
    return "Pretendard Black"


def compose(body: Path, voice: Path, ass: Path, bgm: Path | None, total: float, out: Path,
            bgm_volume: float, video_y: int = VIDEO_Y, bg: str = "black") -> None:
    inputs = ["-i", str(body), "-i", str(voice)]
    vf = (f"[0:v]pad={W}:{H}:0:{video_y}:{bg},"
          f"ass={ass.name}:fontsdir={FONT_DIR.as_posix()},format=yuv420p[v]")
    if bgm:
        inputs += ["-stream_loop", "-1", "-i", str(bgm)]
        # 나레이션이 나올 때 BGM 을 자동으로 줄이는 사이드체인 덕킹
        af = (f"[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.6,asplit=2[vo][sc];"
              f"[2:a]aresample=44100,aformat=channel_layouts=stereo,volume={bgm_volume}[bg];"
              f"[bg][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[duck];"
              f"[vo][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]")
    else:
        af = "[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.6,alimiter=limit=0.95[a]"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", f"{vf};{af}", "-map", "[v]", "-map", "[a]",
         "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)])


# ───────────────────────── 실행 ─────────────────────────

def make_demo_media(work: Path) -> Path:
    """--demo: 장면 전환이 들어 있는 가짜 원본 영상 2개를 만든다."""
    d = work / "demo_media"
    d.mkdir()
    for i, srcs in enumerate([["testsrc2", "mandelbrot", "rgbtestsrc"], ["smptebars", "life=s=320x240:mold=10:r=30:ratio=0.1", "cellauto"]]):
        parts = []
        for j, s in enumerate(srcs):
            p = d / f"p{i}{j}.mp4"
            src = s if "=" in s else f"{s}=s=640x480:r=30"
            run(["ffmpeg", "-y", "-f", "lavfi", "-i", src, "-t", "3", "-pix_fmt", "yuv420p",
                 "-vf", "scale=640:480,setsar=1", "-c:v", "libx264", "-preset", "ultrafast", str(p)])
            parts.append(p)
        lst = d / f"l{i}.txt"
        lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(d / f"source{i}.mp4")])
        for p in parts:
            p.unlink()
        lst.unlink()
    return d


def load_project(args) -> tuple[Script, dict]:
    cfg: dict = {}
    if args.project:
        cfg = json.loads(Path(args.project).read_text(encoding="utf-8"))
        base = Path(args.project).resolve().parent
        for k in ("media", "bgm"):
            if cfg.get(k) and not Path(cfg[k]).is_absolute():
                cfg[k] = str(base / cfg[k])
    for k in ("product", "media", "bgm", "voice", "rate", "cta", "info"):
        v = getattr(args, k, None)
        if v:
            cfg[k] = v
    product = cfg.get("product") or ("자동 각도 조절 휴대폰 거치대" if args.demo else None)
    if not product and not cfg.get("lines"):
        sys.exit("--product 또는 --project(lines 포함) 중 하나는 필요합니다.")
    cfg["product"] = product or ""

    if cfg.get("lines"):
        script = Script(title=cfg.get("title") or [cfg["product"], "역대급 꿀템"], lines=cfg["lines"],
                        hashtags=cfg.get("hashtags", []))
        log("대본: 프로젝트 파일")
    else:
        script = None if args.no_llm else claude_script(product, cfg.get("info", ""))
        if script:
            log("대본: Claude 생성")
        else:
            script = template_script(product, cfg.get("pain"), cfg.get("features", []), cfg.get("benefit"))
            log("대본: 내장 템플릿")
    return script, cfg


def main() -> None:
    ap = argparse.ArgumentParser(description="썰쇼핑 쇼츠 자동 생성")
    ap.add_argument("--project", help="프로젝트 JSON (title/lines/media/bgm …)")
    ap.add_argument("--product", help="제품명 — 대본 자동 생성")
    ap.add_argument("--info", help="제품 특징·상세페이지 요약 (대본 생성 참고)")
    ap.add_argument("--media", help="원본 영상·사진 폴더 (또는 파일 하나)")
    ap.add_argument("--bgm", help="배경음악 파일")
    ap.add_argument("--bgm-volume", type=float, default=0.35)
    ap.add_argument("--tts", choices=["edge", "gtts", "none"], default="edge")
    ap.add_argument("--voice", help="edge-tts 목소리 (기본 ko-KR-InJoonNeural / 여성 ko-KR-SunHiNeural)")
    ap.add_argument("--rate", help="말 속도, 예: +20%%")
    ap.add_argument("--cta", help="영상 아래 띠 문구")
    ap.add_argument("--scene-threshold", type=float, default=0.3, help="장면 전환 감도 (낮을수록 잘게)")
    ap.add_argument("--out", default="out/short.mp4")
    ap.add_argument("--no-llm", action="store_true", help="Claude 를 쓰지 않고 템플릿 대본")
    ap.add_argument("--demo", action="store_true", help="가짜 소재로 전체 파이프라인 시험")
    ap.add_argument("--keep", action="store_true", help="작업 폴더 남기기")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg 가 필요합니다.")
    font = ensure_fonts()
    work = Path(tempfile.mkdtemp(prefix="ssul_"))
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        script, cfg = load_project(args)
        if args.demo and not cfg.get("media"):
            cfg["media"] = str(make_demo_media(work))
            if args.tts == "edge":
                args.tts = "none"
        for i, l in enumerate(script.lines, 1):
            print(f"   {i:2d}. {plain(l)}")

        log("음성 합성")
        voice, spans, total = build_voice(script, work, args.tts, cfg.get("voice", "ko-KR-InJoonNeural"),
                                          cfg.get("rate", "+20%"))
        log(f"총 길이 {total:.1f}초")

        shots = collect_shots(Path(cfg["media"]) if cfg.get("media") else None, cfg["product"], work,
                              args.scene_threshold)
        cuts = plan_cuts(shots, spans, total)
        log(f"컷 배치: 샷 {len(shots)}개 → {len(cuts)}컷")
        body = build_body(cuts, work)

        ass = build_ass(script, spans, total, work / "subs.ass", font,
                        cfg.get("cta", "▶ 제품 정보는 프로필 링크"))
        log("합성·인코딩")
        bgm = Path(cfg["bgm"]).resolve() if cfg.get("bgm") else None
        cwd = os.getcwd()
        os.chdir(work)                  # ass 필터 경로 이스케이프를 피하려고 작업 폴더에서 실행
        try:
            compose(body, voice, ass, bgm, total, out, args.bgm_volume)
        finally:
            os.chdir(cwd)

        meta = {"title": script.title, "lines": script.lines, "hashtags": script.hashtags,
                "duration": round(total, 2), "cuts": len(cuts)}
        out.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        log(f"완료 → {out}  ({total:.1f}초, {len(cuts)}컷)")
    finally:
        if args.keep:
            log(f"작업 폴더: {work}")
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
