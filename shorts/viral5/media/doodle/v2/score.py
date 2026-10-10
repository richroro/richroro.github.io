"""benchmark scorecard (research/benchmark-targets-drawn.json "doodle") for rendered shorts, measured the way the report did:
picture-box changes with ffmpeg scene > 0.04 (merged within 0.3 s, as qa_review), syllables/s = Hangul syllables / sum of
spoken line lengths from build/<id>/timeline.json. usage: python3 media/doodle/v2/score.py doodle1 ...   (from shorts/viral5)
"""
import json, re, statistics, subprocess, sys
SYL = re.compile(r"[가-힣]"); VIS = re.compile(r"[가-힣A-Za-z0-9%]")
T = json.load(open("research/benchmark-targets-drawn.json"))["doodle"]
print("| id | 제목 | 길이 | 훅 끝 | 첫 화면 변화 | 평균/최장 화면 | 음절/초 | 줄 수 | 제목 글자(줄별) |")
print("|---|---|---|---|---|---|---|---|---|")
print(f"| 목표 | 2줄 6~9자 | {T['length_s']}초 (30~38) | ≤{T['hook_end_s']}초 | ≤{T['first_cut_s']}초 | {T['shot_mean_s']} / ≤{T['shot_max_s']}초 | ≥{T['syl_per_s']} | {T['lines']} (12~16) | 6~9 |")
for sid in sys.argv[1:]:
    f = f"final/{sid}.mp4"
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-vf", "crop=1080:1080:0:400,select='gt(scene,0.04)',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    cuts = []
    for x in (float(x) for x in re.findall(r"pts_time:([\d.]+)", err)):
        if x > 0.2 and (not cuts or x - cuts[-1] > 0.3): cuts.append(x)
    shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
    t = json.load(open(f"build/{sid}/timeline.json")); s = json.load(open(f"shorts/{sid}/script.json"))
    say = {L["id"]: L["say"] for L in s["lines"]}
    sps = sum(len(SYL.findall(say[L["id"]])) for L in t["lines"]) / sum(L["dur"] for L in t["lines"])
    L0 = t["lines"][0]
    lens = [len(VIS.findall(x)) for x in s["title"]]
    print(f"| `{sid}` | {' / '.join(s['title'])} | {dur:.1f}초 | {L0['start'] + L0['dur']:.2f}초 | {shots[0]:.2f}초 | {statistics.mean(shots):.2f} / {max(shots):.2f}초 | {sps:.2f} | {len(t['lines'])} | {'+'.join(map(str, lens))} |")
