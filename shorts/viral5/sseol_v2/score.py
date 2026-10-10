"""Benchmark scorecard for 썰 v2 shorts against research/benchmark-targets-drawn.json ("sseol").

usage: python3 sseol_v2/score.py <id> [<id> ...]     reads final/<id>.mp4, build/<id>/timeline.json, shorts/<id>/script.json
Measured the same way as the benchmark report's "ours_*" values: picture changes are ffmpeg scene > 0.04 in the 1080x1080
box under the top 400 px (changes closer than 0.3 s merged, as qa_review.py does); syllables per second are Hangul
syllables over the summed line durations (pauses between lines left out). Prints a markdown table.
"""
import json, os, re, statistics, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(f"{HERE}/research/benchmark-targets-drawn.json"))["sseol"]

def cuts(f):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-vf", "crop=1080:1080:0:400,select='gt(scene,0.04)',showinfo", "-an", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    out = []
    for x in (float(x) for x in re.findall(r"pts_time:([\d.]+)", err)):
        if x > 0.2 and (not out or x - out[-1] > 0.3): out.append(x)
    return out

def score(sid):
    f = f"{HERE}/final/{sid}.mp4"
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)
    tl = json.load(open(f"{HERE}/build/{sid}/timeline.json"))
    title = " ".join(json.load(open(f"{HERE}/shorts/{sid}/script.json"))["title"])
    c = cuts(f); shots = [b - a for a, b in zip([0.0] + c, c + [dur])]
    syl = sum(len(re.findall(r"[가-힣]", L["chars"])) for L in tl["lines"]); spoken = sum(L["dur"] for L in tl["lines"])
    L0 = tl["lines"][0]
    return {"id": sid, "title": title, "title_chars": len(re.findall(r"[가-힣A-Za-z0-9%]", title)), "length_s": round(dur, 1),
            "hook_end_s": round(L0["start"] + L0["dur"], 2), "first_cut_s": round(shots[0], 2), "shot_mean_s": round(statistics.mean(shots), 2),
            "shot_max_s": round(max(shots), 2), "syl_per_s": round(syl / spoken, 2), "lines": len(tl["lines"])}

if __name__ == "__main__":
    rows = [score(s) for s in sys.argv[1:]]
    print("| id | 제목 (글자) | 길이 | 훅 끝 | 첫 전환 | 평균/최장 화면 | 초당 음절 | 줄 |")
    print("|---|---|---|---|---|---|---|---|")
    print(f"| 목표 | 8~12자, \"이유\" 없음 | {T['length_s']}초 (35~55) | ≤{T['hook_end_s']}초 | ≤{T['first_cut_s']}초 | {T['shot_mean_s']} / ≤{T['shot_max_s']}초 | ≥{T['syl_per_s']} | {T['lines']} (14~20) |")
    for r in rows:
        print(f"| `{r['id']}` | {r['title']} ({r['title_chars']}) | {r['length_s']}초 | {r['hook_end_s']}초 | {r['first_cut_s']}초 | {r['shot_mean_s']} / {r['shot_max_s']}초 | {r['syl_per_s']} | {r['lines']} |")
    json.dump(rows, open(f"{HERE}/out/sseol_v2_score.json", "w"), ensure_ascii=False, indent=1)
