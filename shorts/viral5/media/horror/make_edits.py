"""Write shorts/horror1-4/edit.json from the compact cut lists below, and media/horror/sources.json (every clip,
its licence and the source seconds each short uses).  usage: python3 media/horror/make_edits.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import source
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SLOW = [1.0, 1.07]
# (anchor, file key, in-point, extra)
CUTS = {
 "horror1": {
  "music": {"file": "music/Gathering Darkness.mp3", "gain": 0.13, "start": 2},
  "cuts": [
   ("a", "pxpb130783", 0.0, {"label": "닫힌 엘리베이터"}),
   ("a.건물엔", "px15201563", 6.0, {"label": "빈 복도"}),
   ("b", "px34779661", 2.0, {"label": "엘리베이터 홀"}),
   ("c", "px15434928", 0.0, {"label": "층 표시"}),
   ("c.사", "px5823578", 0.6, {"label": "4층→1층", "speed": 4.0, "zoom": [1.05, 1.1]}),
   ("d", "pxpb130783", 2.6, {"label": "문이 열림"}),
   ("d.안은", "pxpb131012", 0.5, {"label": "빈 엘리베이터 안"}),
   ("e.삐", "pxpb131012", 9.0, {"label": "엘리베이터 안", "zoom": [1.12, 1.2]}),
   ("f", "px15434928", 8.0, {"label": "표시등", "zoom": [1.15, 1.25]}),
   ("g", "px34779661", 9.0, {"label": "뒷걸음질"}),
   ("g.문이", "px37410328", 0.0, {"label": "문이 닫힘"}),
   ("g.엘리베이터는", "px978049", 0.0, {"label": "위로", "speed": 3.0}),
   ("h", "px19217894", 1.0, {"label": "어두운 복도"}),
   ("end", "pxpb130783", 0.3, {"label": "닫힌 엘리베이터", "zoom": [1.06, 1.14]}),
   ("end.정답은", "px37410328", 9.0, {"label": "닫힌 문"}),
  ],
  "sfx": [["d", "ding", 0.55], ["e.삐", "k_error_003", 0.6], ["h", "heartbeat", 0.7], ["end", "k_glitch_002", 0.35]],
  "flashes": ["e.삐"],
 },
 "horror2": {
  "music": {"file": "music/Ghost Story.mp3", "gain": 0.11, "start": 5},
  "cuts": [
   ("a", "pxpb28237", 14.0, {"label": "어두운 현관"}),
   ("a.현관에서", "px19217899", 0.5, {"label": "어두운 복도"}),
   ("b", "px35999369", 0.0, {"label": "잠금장치", "zoom": [1.1, 1.18], "speed": 0.42}),
   ("b.띠리릭", "pxpb28237", 30.0, {"label": "문이 열림"}),
   ("c", "px35999369", 5.9, {"label": "잠금 풀림", "zoom": [1.1, 1.14], "speed": 0.33}),
   ("c.비밀번호는", "px29038649", 0.0, {"label": "문손잡이"}),
   ("d", "px7598737", 2.0, {"label": "복도"}),
   ("d.띠리릭", "pxpb28237", 38.0, {"label": "문이 닫힘"}),
   ("e", "px5384813", 1.0, {"label": "새벽 방", "zoom": [1.08, 1.14]}),
   ("e.이불", "px19217899", 3.0, {"label": "어둠"}),
   ("f", "px9658661", 2.0, {"label": "아침 복도"}),
   ("f.모든", "px29038649", 2.5, {"label": "현관문", "zoom": [1.1, 1.16]}),
   ("g", "px3512344", 0.5, {"label": "신발"}),
   ("g.신발이", "px8472547", 1.0, {"label": "한 켤레 더"}),
   ("h", "px8472547", 12.0, {"label": "신발", "zoom": [1.15, 1.25]}),
   ("end", "pxpb28237", 20.0, {"label": "문틈"}),
   ("end.정답은", "px19217899", 4.0, {"label": "어둠"}),
  ],
  "sfx": [["b", "click", 0.5], ["b.띠리릭", "k_confirmation_002", 0.4], ["d.띠리릭", "k_confirmation_002", 0.4], ["h", "heartbeat", 0.7], ["end", "k_glitch_002", 0.35]],
  "flashes": ["g.신발이"],
 },
 "horror3": {
  "music": {"file": "music/Gathering Darkness.mp3", "gain": 0.13, "start": 30},
  "cuts": [
   ("a", "px7362808", 0.5, {"label": "문 앞 택배"}),
   ("a.문자가", "px34786856", 1.5, {"label": "문자 알림"}),
   ("b", "px8346903", 2.0, {"label": "점심시간 회사"}),
   ("b.택배를", "px34786878", 1.0, {"label": "문자"}),
   ("c", "px5483080", 8.0, {"label": "점심시간 회사", "zoom": [1.1, 1.18]}),
   ("d", "px7362603", 1.0, {"label": "문 앞 봉투"}),
   ("d.바로", "px9658661", 6.0, {"label": "집 복도"}),
   ("e", "px5483080", 2.0, {"label": "회사"}),
   ("e.그리고", "px15365449", 2.0, {"label": "빈 복도"}),
   ("f", "px9658661", 18.0, {"label": "현관문"}),
   ("g", "px7598737", 3.0, {"label": "퇴근길"}),
   ("g.문", "px9658661", 26.0, {"label": "텅 빈 문 앞", "zoom": [1.08, 1.15]}),
   ("end", "px15365449", 10.0, {"label": "어두운 복도"}),
   ("end.정답은", "px34786856", 4.0, {"label": "휴대폰"}),
  ],
  "stickers": [
   {"text": "📦 택배를 문 앞에 두었습니다", "from": "b", "to": "c", "x": 540, "y": 560, "rot": 0, "bg": "#F2F2F2", "fg": "#111", "size": 44},
   {"text": "안에 계신 분이 바로 받아 가셨어요", "from": "d", "to": "e", "x": 540, "y": 560, "rot": 0, "bg": "#F2F2F2", "fg": "#111", "size": 40},
  ],
  "sfx": [["a", "k_question_001", 0.4], ["c", "k_question_001", 0.4], ["e.혼자", "heartbeat", 0.7], ["end", "k_glitch_002", 0.35]],
  "flashes": ["e.혼자"],
 },
 "horror4": {
  "music": {"file": "music/Ghost Story.mp3", "gain": 0.11, "start": 20},
  "cuts": [
   ("a", "px36778198", 0.5, {"label": "큰 거울"}),
   ("a.커다란", "px32834268", 1.0, {"label": "거울"}),
   ("b", "px27861219", 2.0, {"label": "거울 속"}),
   ("b.거울", "px27861219", 6.0, {"label": "어두운 거울", "zoom": [1.08, 1.15]}),
   ("c", "px5384813", 2.0, {"label": "조명"}),
   ("d", "px4623153", 4.0, {"label": "불 끄기"}),
   ("d.방이", "px19217895", 1.0, {"label": "깜깜한 방"}),
   ("e", "px7598737", 1.0, {"label": "어둠"}),
   ("f", "px36778198", 5.0, {"label": "불 켜진 거울 속 방", "zoom": [1.1, 1.16]}),
   ("f.아직", "px32834268", 8.0, {"label": "불 켜진 방", "zoom": [1.12, 1.2]}),
   ("g", "px36778198", 3.0, {"label": "거울"}),
   ("g.아무도", "px27861219", 9.0, {"label": "아무도 없는 거울", "zoom": [1.1, 1.18]}),
   ("end", "px4623153", 8.0, {"label": "꺼진 방"}),
   ("end.정답은", "px19217895", 6.0, {"label": "어둠"}),
  ],
  "sfx": [["d", "click", 0.6], ["f", "heartbeat", 0.7], ["g.아무도", "k_glitch_002", 0.3], ["end", "k_glitch_002", 0.35]],
  "flashes": ["f"],
 },
}
catalog = {}
for sid, c in CUTS.items():
    keys = []
    clips = []
    for anchor, key, inn, extra in c["cuts"]:
        if key not in keys: keys.append(key)
        clips.append({"src": key, "from": anchor, "in": inn, "zoom": SLOW, "audio": 0, **extra})
        catalog.setdefault(key, {**source(key), "used_in": {}})["used_in"].setdefault(sid, []).append(inn)
    edit = {"titleStyle": "band", "titleKey": "#ff2a2a", "captionY": 1640, "credit": "영상: Pexels",
            "sources": {k: source(k) for k in keys}, "clips": clips, "stickers": c.get("stickers", []),
            "sfx": c["sfx"], "flashes": c.get("flashes", []), "music": c["music"]}
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
out = {"note": "Stock footage for horror1-horror4 (licence pages opened 2026-10-10). Files are not committed; download from file_url, "
               "cut, scale to 1080p, mute and grade as described in media/horror/catalog.py, save as public/<short>/src/<file>. "
               "used_in = source in-points (seconds) per short; each cut runs 1-4.5 s (speed 3-4x for the floor indicators).",
       "sources": [{**v, "used_in": [{"short": s, "source_in_seconds": t} for s, t in v["used_in"].items()]} for v in catalog.values()]}
json.dump(out, open(f"{HERE}/media/horror/sources.json", "w"), ensure_ascii=False, indent=1)
print("wrote", list(CUTS))
