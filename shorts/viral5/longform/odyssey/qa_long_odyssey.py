"""Run the shared long-form QA (longform/qa_long.py) on the Odyssey documentary.

The Odyssey was built on its own composition (src/lib/long/f1_Odyssey.tsx) before the long-form kit landed, so it has
no src/longdata/odyssey.json, and writing one there would make the kit register a second "odyssey" composition. This
script translates edit.json into the kit's LongData fields that qa_long.py reads (end, voice, chapters, caption pages)
inside a scratch root whose final/, public/, upload/ and out/ point at the real ones, then runs qa_long.review on it.
usage: python3 longform/odyssey/qa_long_odyssey.py        exit status 1 if any check FAILs
"""
import importlib.util, json, os, sys, tempfile

V = os.path.normpath(os.path.dirname(os.path.abspath(__file__)) + "/../..")
E = json.load(open(f"{V}/longform/odyssey/edit.json"))
root = tempfile.mkdtemp(prefix="qa_odyssey_")
for d in ("final", "public", "upload", "out"):
    os.symlink(f"{V}/{d}", f"{root}/{d}")
os.makedirs(f"{root}/src/longdata")
data = {
    "end": E["duration"],
    "voice": [{"start": L["t"], "dur": L["dur"]} for L in E["lines"]],
    "media": [],
    "pauses": [],
    "coldOpen": {"end": 0.0},
    # a chapter's narration runs from its first line to the next scene's start (the scene gaps carry music only)
    "chapters": [{"body": c["voice"], "end": c["end"]} for c in E["chapters"]],
    "captionSize": 48,  # f1_Odyssey.tsx caption: Pretendard 800, 48 px, one line
    "pages": [{"startMs": round(c["t0"] * 1000), "lines": [[{"text": w} for w in c["text"].split()]]} for c in E["captions"]],
}
json.dump(data, open(f"{root}/src/longdata/odyssey.json", "w"), ensure_ascii=False)
spec = importlib.util.spec_from_file_location("qa_long", f"{V}/longform/qa_long.py")
qa = importlib.util.module_from_spec(spec); spec.loader.exec_module(qa)
qa.V = root
sys.exit(qa.review("odyssey"))
