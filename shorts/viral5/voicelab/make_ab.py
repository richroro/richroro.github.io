"""Write the A/B cast files (voicelab/ab/<candidate>/<id>.json) that voice_edge.py --voices / lfsaeyeon1/voice.py --voices read.

usage: python3 voicelab/make_ab.py <candidate> <id> [...]
CASTING maps each script role to a role of the bake-off cast (candidates.json) and a format (bakeoff.TARGET_SPS).
Each role's speed is calibrated on that role's own lines in the script: takes at the cast's base speed, measured in
syllables per second (long pauses left out), then the Edge rate / Supertonic speed / tempo that brings it to the
format's target, within 0.85-1.3 of the voice's own pace.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(HERE)
sys.path.insert(0, V); sys.path.insert(0, HERE)
import voice_engine as ve, score, bakeoff

# script role -> (cast role, format). The narrator who is also "me" in a story gets the same voice as "me".
CASTING = {
    "sseol16": {"nar": ("nar_f", "sseol"), "me": ("nar_f", "sseol"), "gma": ("elder_f", "sseol"), "gpa": ("elder_m", "sseol")},
    "issue4": {"nar": ("nar_m", "info"), "hook": ("nar_m", "hook")},
    "horror6": {"nar": ("horror", "horror")},
    "lfsaeyeon1": {"nar": ("nar_f", "story"), "me": ("nar_f", "story_talk"), "hus": ("husband", "story"), "mom": ("elder_f", "story"),
                   "sis": ("mid_f", "story_talk")},
}
EXTRA = {"hook": 7.8, "story_talk": 6.0}  # an info hook line is a touch faster; dialogue in a story long-form a touch quicker than its narration


def script_lines(sid):
    if os.path.exists(f"{V}/shorts/{sid}/script.json"):
        return json.load(open(f"{V}/shorts/{sid}/script.json"))["lines"]
    return json.load(open(f"{V}/longform/{sid}/script.json"))["lines"]


def calibrate(v, texts, target):
    """rate factor from up to 6 of the role's lines. Pauses of 0.25 s or more inside a take (the "…" of a hesitant
    line) are left out of the measured time, and the factor stays within 0.85-1.3 of the voice's own pace, so a
    halting character is not rushed into a gabble."""
    syl = dur = 0.0
    for t in texts[:6]:
        x, _ = ve.synth(t if ve.engine_of(v) == "edge" else ve.ko_text(t), v)
        syl += len(score.hangul(t)); dur += len(x) / ve.SR - sum(p for p in score.pauses(x) if p >= 0.25)
    return bakeoff.retime(v, min(1.3, max(0.85, target / (syl / dur))))


def main(cand, sid):
    c = bakeoff.CANDS[cand]; lines = script_lines(sid); out = {}
    for role, (crole, fmt) in CASTING[sid].items():
        base = dict(c.get("roles", {}).get(crole) or c["cast"][crole])
        texts = [L["say"].replace("|", "") for L in lines if L.get("voice", "nar") == role]
        if not texts: continue
        target = EXTRA.get(fmt) or bakeoff.TARGET_SPS[fmt]
        out[role] = calibrate(base, texts, target)
        print(sid, role, out[role])
    pz = c.get("pauses", {}).get(sid.rstrip("0123456789"))
    if pz: out["pauses"] = pz
    os.makedirs(f"{HERE}/ab/{cand}", exist_ok=True)
    json.dump(out, open(f"{HERE}/ab/{cand}/{sid}.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    for s in sys.argv[2:]: main(sys.argv[1], s)
