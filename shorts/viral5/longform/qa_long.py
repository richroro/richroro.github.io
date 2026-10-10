"""Check a finished long-form before upload: the measurable checks run here, the stills a person needs are written
next to the report.

usage: python3 longform/qa_long.py <id> [<id> ...]
reads  final/<id>.mp4, final/<id>-thumb.jpg, src/longdata/<id>.json, upload/specs/<id>.json (chapters)
writes out/review/<id>/sheet.jpg (a frame every 30 s), first15.jpg (the first 15 s at 1 s steps), thumb.jpg, report.md
exit status 1 if any check FAILs (WARN does not fail)

checks: duration (matches the timeline; 10-25 min is the long-form target, outside it is a WARN), loudness (-14 LUFS ±1),
size (<= MAXMB, default 95 MB), black frames (0.05 s or longer, and a black last frame), silences longer than 1.5 s inside
the narration (from the timeline, and measured in the mix), caption overflow (a line wider than 1600 px at the caption
size, or more than 2 lines), the chapter list (0:00 first, at least 3, each at least 10 s, in order), the thumbnail (there,
1280x720, <= 2 MB), and a picture frozen for more than 20 s (WARN).
"""
import json, math, os, re, subprocess, sys

V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXMB = float(os.environ.get("MAXMB", 95))


def sh(cmd):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True).stdout


def ts(s):
    return f"{int(s) // 60}:{s % 60:04.1f}"


def review(lid):
    rows, fails = [], 0
    def row(name, ok, value, note=""):
        nonlocal fails
        st = "PASS" if ok is True else "WARN" if ok == "warn" else "FAIL"
        fails += st == "FAIL"; rows.append((name, st, value, note))
    mp4, thumb = f"{V}/final/{lid}.mp4", f"{V}/final/{lid}-thumb.jpg"
    d = json.load(open(f"{V}/src/longdata/{lid}.json"))
    out = f"{V}/out/review/{lid}"; os.makedirs(out, exist_ok=True)
    if not os.path.exists(mp4):
        print(f"{lid}: no final/{lid}.mp4 (run longform/render_long.sh {lid})"); return 1
    fmt = json.loads(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,codec_type", "-of", "json", mp4]))
    dur, size = float(fmt["format"]["duration"]), int(fmt["format"]["size"])
    vs = next(s for s in fmt["streams"] if s["codec_type"] == "video")

    # duration
    row("길이", abs(dur - d["end"]) <= 0.2, f"{ts(dur)} ({dur:.1f} s)", f"timeline {d['end']:.1f} s")
    row("롱폼 길이 (10~25분)", True if 600 <= dur <= 1500 else "warn", f"{dur / 60:.1f}분", "" if 600 <= dur <= 1500 else "outside the 10-25 min target")
    # loudness
    m = re.search(r"I:\s+(-?[\d.]+) LUFS", sh(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-af", "ebur128", "-f", "null", "-"]).split("Summary:")[-1])
    lufs = float(m.group(1)) if m else -99
    row("소리", abs(lufs + 14) <= 1, f"{lufs:.1f} LUFS")
    # size
    row("용량", size <= MAXMB * 1e6, f"{size / 1e6:.1f} MB", f"{vs['codec_name']} {vs['width']}x{vs['height']}, {size / 1e6 / (dur / 60):.1f} MB/min, cap {MAXMB:.0f} MB")
    # black frames
    bl = re.findall(r"black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)",
                    sh(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-vf", "blackdetect=d=0.05:pic_th=0.98:pix_th=0.10", "-an", "-f", "null", "-"]))
    row("검은 화면", not bl, f"{len(bl)}곳", ", ".join(f"{ts(float(a))}+{float(c):.2f}s" for a, b, c in bl[:6]))
    last = f"{out}/last.png"
    sh(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.2", "-i", mp4, "-update", "1", "-q:v", "2", last])
    from PIL import Image, ImageFont, ImageStat
    luma = ImageStat.Stat(Image.open(last).convert("L")).mean[0] if os.path.exists(last) else 0
    row("마지막 프레임", luma > 16, f"밝기 {luma:.0f}/255")
    # silences inside the narration, from the timeline
    # (a "pause" line is a silence on purpose, so it counts as sound here)
    sounds = sorted([(v["start"], v["start"] + v["dur"]) for v in d["voice"]] + [(m_["start"], m_["start"] + m_["dur"]) for m_ in d["media"]]
                    + [(p_["start"], p_["start"] + p_["dur"]) for p_ in d.get("pauses", [])])
    spans = [(0.0, d["coldOpen"]["end"])] + [(c["body"], c["end"]) for c in d["chapters"]]
    gaps = []
    for a, b in spans:
        inside = [s for s in sounds if a - 0.01 <= s[0] < b]
        for (s0, e0), (s1, e1) in zip(inside, inside[1:]):
            if s1 - e0 > 1.5: gaps.append((e0, s1 - e0))
    row("내레이션 공백 (대본)", not gaps, f"{len(gaps)}곳", ", ".join(f"{ts(a)} {g:.1f}s" for a, g in gaps[:6]))
    # and in the mix (dead air: below -50 dB for 1.5 s while narration should run)
    sil = re.findall(r"silence_start: ([\d.]+)\n.*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)",
                     sh(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-af", "silencedetect=n=-50dB:d=1.5", "-vn", "-f", "null", "-"]), re.S)
    planned = [(p_["start"] - 0.3, p_["start"] + p_["dur"] + 0.3) for p_ in d.get("pauses", [])]
    dead = [(float(a), float(c)) for a, b, c in sil if any(x <= float(a) < y for x, y in spans) and not any(x <= float(a) < y for x, y in planned)]
    row("무음 (믹스)", not dead, f"{len(dead)}곳", ", ".join(f"{ts(a)} {c:.1f}s" for a, c in dead[:6]))
    # captions
    font = ImageFont.truetype(f"{V}/public/fonts/Pretendard-ExtraBold.otf", d["captionSize"])
    stroke = round(d["captionSize"] * 0.17)
    wide, tall, longest = [], [], 0
    for p in d["pages"]:
        if len(p["lines"]) > 2: tall.append(p)
        for line in p["lines"]:
            text = " ".join(w["text"] for w in line)
            wpx = font.getlength(text) + 2 * stroke; longest = max(longest, wpx)
            if wpx > 1600: wide.append((p["startMs"] / 1000, text, wpx))
    row("자막 넘침", not wide and not tall, f"가장 긴 줄 {longest:.0f}px", "; ".join(f"{ts(a)} '{t}' {w:.0f}px" for a, t, w in wide[:4]) + (f"; {len(tall)} pages over 2 lines" if tall else ""))
    # chapter list
    spath = f"{V}/upload/specs/{lid}.json"  # prep_long.py writes the chapters there
    stamps = []
    for t, name in (json.load(open(spath)).get("chapters", []) if os.path.exists(spath) else []):
        parts = [int(x) for x in t.split(":")]
        stamps.append((sum(v * 60 ** k for k, v in enumerate(reversed(parts))), name))
    errs = []
    if not stamps or stamps[0][0] != 0: errs.append("first is not 0:00")
    if len(stamps) < 3: errs.append(f"{len(stamps)} chapters (need 3)")
    for (a, _), (b, _) in zip(stamps, stamps[1:] + [(dur, "")]):
        if b - a < 10: errs.append(f"{a // 60}:{a % 60:02d} lasts {b - a:.0f} s")
    if any(b[0] <= a[0] for a, b in zip(stamps, stamps[1:])): errs.append("not in order")
    row("챕터", not errs, f"{len(stamps)}개", "; ".join(errs) or " · ".join(f"{a // 60}:{a % 60:02d} {t}" for a, t in stamps))
    # thumbnail
    if os.path.exists(thumb):
        im = Image.open(thumb); ts_ = os.path.getsize(thumb)
        row("썸네일", im.size == (1280, 720) and ts_ <= 2e6, f"{im.size[0]}x{im.size[1]}, {ts_ / 1e6:.2f} MB")
        im.convert("RGB").save(f"{out}/thumb.jpg", quality=90)
    else:
        row("썸네일", False, "없음", f"npx remotion still src/index.ts {lid}-thumb final/{lid}-thumb.jpg")
    # frozen picture
    fz = re.findall(r"freeze_start: ([\d.]+).*?freeze_duration: ([\d.]+)", sh(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-vf", "freezedetect=n=-60dB:d=20", "-an", "-f", "null", "-"]), re.S)
    row("멈춘 화면 (20초+)", True if not fz else "warn", f"{len(fz)}곳", ", ".join(f"{ts(float(a))} {float(b):.0f}s" for a, b in fz[:4]))

    # stills for a person
    n = max(1, math.ceil(dur / 30)); cols = 4
    sh(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"fps=1/30,scale=480:-1,drawtext=fontfile={V}/public/fonts/Pretendard-Bold.otf:text='%{{pts\\:hms}}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,tile={cols}x{math.ceil(n / cols)}",
        "-frames:v", "1", "-q:v", "3", f"{out}/sheet.jpg"])
    sh(["ffmpeg", "-v", "error", "-y", "-t", "15", "-i", mp4, "-vf", f"fps=1,scale=384:-1,drawtext=fontfile={V}/public/fonts/Pretendard-Bold.otf:text='%{{pts\\:hms}}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=5x3",
        "-frames:v", "1", "-q:v", "3", f"{out}/first15.jpg"])
    rep = [f"# {lid} 롱폼 검토", "", "| 항목 | 결과 | 값 | 비고 |", "|---|---|---|---|"] + [f"| {a} | {b} | {c} | {e} |" for a, b, c, e in rows]
    rep += ["", f"- 30초마다 한 장: `out/review/{lid}/sheet.jpg`", f"- 첫 15초 1초 간격: `out/review/{lid}/first15.jpg`", f"- 썸네일: `out/review/{lid}/thumb.jpg`"]
    open(f"{out}/report.md", "w").write("\n".join(rep) + "\n")
    print(f"\n{lid}")
    for a, b, c, e in rows: print(f"  {b:4s} {a:16s} {c:22s} {e}")
    print(f"  -> out/review/{lid}/report.md")
    return 1 if fails else 0


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    sys.exit(max(review(i) for i in sys.argv[1:]))
