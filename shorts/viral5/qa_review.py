"""Review a finished short against what 100k+ view Korean Shorts do (REVIEW.md, from research/research-*.md): the
measurable checks run here, and the stills a person needs for the rest are written next to the report.

usage: python3 qa_review.py <id> [<id> ...]      reads final/<id>.mp4 and shorts/<id>/ or politics/<id>/
writes out/review/<id>/first.png, last.png, sheet.png (16 frames) and report.md; prints one table per short
"""
import json, os, re, statistics, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SYL = re.compile(r"[가-힣A-Za-z0-9%]")
# title patterns of 100k+ shorts (research-fun.md §5, research-info.md §1): "~하는 이유", "~썰", "정체", "생긴 일", "역대급",
# "TOP N", "소름", "~에 대한 몇가지", "~의 필살기", "~ 특", "~의 최후/결말", X vs Y, second person, ㅋㅋ/ㄷㄷ/?, numbers
HOOKS = ["이유", "썰", "정체", "생긴 일", "생기는 일", "하는 일", "최후", "결말", "역대급", "TOP", "소름", "실화", "레전드", "현실", "충격", "차이",
         "vs", "몇가지", "몇 가지", "필살기", " 특", "당신", "반응", "?", "ㅋㅋ", "ㄷㄷ", "!!",
         # research-formats2.md §5-7: 낙서 짤툰 noun phrases ("~의 수명", "~ 근황", "~의 말투 특징", "~하면 벌어지는 일"),
         # 그 시절 레트로 ("그 시절 ~", "MZ는 모르는"), 2D 운전 애니 ("~ 빌런 참교육", "30초 만에 이해하기"), [괴담]
         "벌어지는 일", "근황", "특징", "수명", "모르는", "단계", "진화", "비결", "민폐", "시절", "참교육", "빌런", "이해하기",
         "괴담", "무서운"]
# a subscribe/like ask; "좋아요" alone is ordinary speech ("그 나무가 좋아요?"), so it counts only with 눌러·부탁·구독
ASKS = re.compile(r"구독|알림\s*설정|좋아요\s*(눌|부탁|와|랑|및)")
PICTURE = "crop=1080:1080:0:400"  # the frame box under the title band, where cuts and black frames count

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)
def visible(s): return len(SYL.findall(s.replace("[", "").replace("]", "")))

def measure(f, thr):
    """duration, integrated loudness, black spans and scene-change times of the picture box (changes closer than 0.3 s merged)"""
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout)
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=framelog=quiet", "-f", "null", "-"]).stderr
    lufs = [float(x) for x in re.findall(r"I:\s+(-?[\d.]+) LUFS", err)]
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-vf", f"{PICTURE},blackdetect=d=0.05:pix_th=0.06", "-an", "-f", "null", "-"]).stderr
    black = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", err)
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-vf", f"{PICTURE},select='gt(scene,{thr})',showinfo", "-an", "-f", "null", "-"]).stderr
    cuts = []
    for x in (float(x) for x in re.findall(r"pts_time:([\d.]+)", err)):
        if x > 0.2 and (not cuts or x - cuts[-1] > 0.3): cuts.append(x)
    return dur, (lufs[-1] if lufs else None), black, cuts

def stills(f, dur, out):
    run(["ffmpeg", "-v", "error", "-y", "-ss", "0.03", "-i", f, "-frames:v", "1", f"{out}/first.png"])
    # from the end of the file, so the frame exists even when the audio runs a little longer than the video
    run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.25", "-i", f, "-update", "1", "-frames:v", "8", f"{out}/last.png"])
    for k in range(16):
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{0.05 + (dur - 0.3) * k / 15:.2f}", "-i", f, "-frames:v", "1", "-vf", "scale=270:480", f"{out}/f{k:02d}.png"])
    run(["ffmpeg", "-v", "error", "-y", "-i", f"{out}/f%02d.png", "-vf", "tile=8x2", f"{out}/sheet.png"])
    for k in range(16): os.remove(f"{out}/f{k:02d}.png")

def texts(sid):
    """title lines, caption pages (Korean), translated lines (ko, en), the first and last spoken lines, and the edit"""
    if os.path.exists(f"{HERE}/shorts/{sid}/script.json"):
        s, e = json.load(open(f"{HERE}/shorts/{sid}/script.json")), json.load(open(f"{HERE}/shorts/{sid}/edit.json"))
        pages = [p.strip() for L in s["lines"] for c in L["cap"] for p in c.split("/") if p.strip()]
        say = [L["say"].replace("|", "").replace("\u2060", "") for L in s["lines"]]
        return s["title"], pages, [], say, e
    e = json.load(open(f"{HERE}/politics/{sid}/edit.json"))
    found = []
    def walk(x):
        if isinstance(x, dict):
            if "ko" in x: found.append((x.get("ko", ""), x.get("en", "")))
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(e)
    return e.get("title", ["", ""]), [], found, [en or ko for ko, en in found], e

def review(sid):
    f = f"{HERE}/final/{sid}.mp4"
    out = f"{HERE}/out/review/{sid}"; os.makedirs(out, exist_ok=True)
    title, pages, trans, say, edit = texts(sid)
    # drawn story scenes (and the planned top-down road cartoons) differ by a character or a bubble, so they need a finer threshold than footage cuts
    drawn = bool(edit.get("clips")) and all(c.get("gfx", {}).get("type") in ("scene", "post", "road") for c in edit["clips"])
    dur, lufs, black, cuts = measure(f, 0.04 if drawn else 0.12)
    if edit.get("segments"):  # translated-clip shorts: segment joins are cuts too, even when the picture barely changes
        t = 0.0
        for sg in edit["segments"][:-1]:
            t += (sg["out"] - sg["in"]) / sg.get("speed", 1.0)
            if all(abs(t - c) > 0.3 for c in cuts): cuts.append(t)
        cuts.sort()
    stills(f, dur, out)
    rows = []
    def row(name, ok, warn, value):
        rows.append((name, "PASS" if ok else "WARN" if warn else "FAIL", value))
    row("길이", 25 <= dur <= 45, 20 <= dur <= 50, f"{dur:.1f}초" + (" (31~45초 최적)" if 31 <= dur <= 45 else ""))
    row("제목 띠", edit.get("titleStyle") == "band", True, edit.get("titleStyle", "없음"))
    lens = [visible(t) for t in title]
    row("제목 길이", max(lens) <= 13, max(lens) <= 15, " / ".join(title) + f" ({'+'.join(map(str, lens))}자)")
    hits = [h for h in HOOKS if any(h in t for t in title)] + (["숫자"] if any(re.search(r"\d", t) for t in title) else [])
    row("제목 호기심", bool(hits), False, ", ".join(hits) or "패턴 없음")
    shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
    row("첫 장면", shots[0] <= 3.5, shots[0] <= 5, f"{shots[0]:.1f}초 뒤 첫 전환")
    # one person talking (interviews, speeches) may hold a little longer, with punch-in cuts at sentence breaks
    talk = bool(trans)
    lim = (6, 8) if talk else (4.5, 6)
    row("장면 길이", max(shots) <= lim[0], max(shots) <= lim[1], f"최장 {max(shots):.1f}초, 평균 {statistics.mean(shots):.1f}초, 전환 {len(cuts)}번" + (" (인터뷰 기준 6초)" if talk else ""))
    if pages:
        worst = max(pages, key=visible)
        row("자막 한 장", visible(worst) <= 12, visible(worst) <= 15, f"최장 {visible(worst)}자: {worst}")
    if trans:
        ko = max((k for k, _ in trans), key=len, default=""); en = max((e for _, e in trans), key=len, default="")
        row("번역 자막", len(ko) <= 30 and len(en) <= 70, len(ko) <= 36 and len(en) <= 84, f"한 {len(ko)}자, 영 {len(en)}자")
    asked = sorted({m.group(0) for s in say + pages for m in [ASKS.search(s)] if m})
    row("구독·좋아요 요청", not asked, False, ", ".join(asked) or "없음")
    row("소리", lufs is not None and abs(lufs + 14) <= 1, lufs is not None and abs(lufs + 14) <= 2, f"{lufs} LUFS")
    row("검은 화면", not black, False, ", ".join(f"{a}~{b}초" for a, b in black) or "없음")
    size = os.path.getsize(f) / 1e6
    row("용량", size <= 30, False, f"{size:.1f}MB")
    lines = [f"# {sid} 검토", "", "| 항목 | 결과 | 값 |", "|---|---|---|"] + [f"| {n} | {r} | {v} |" for n, r, v in rows]
    lines += ["", "**사람이 볼 것** (REVIEW.md 2절): first.png(썸네일), last.png(끝), sheet.png(16칸)", "",
              f"- 첫 문장(훅): {say[0] if say else ''}", f"- 마지막 문장(반전): {say[-1] if say else ''}"]
    open(f"{out}/report.md", "w").write("\n".join(lines) + "\n")
    print("\n".join(lines) + "\n")
    return rows

if __name__ == "__main__":
    bad = 0
    for sid in sys.argv[1:]:
        bad += sum(r == "FAIL" for _, r, _ in review(sid))
    sys.exit(1 if bad else 0)
