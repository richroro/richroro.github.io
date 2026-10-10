"""[괴담] v2 (research/benchmark-footage.md §1): write shorts/horror1-12/edit.json in the benchmark frame, and
media/horror/sources_v2.json (every clip, its licence and the source seconds each short uses).
usage: python3 media/horror/make_edits_v2.py      then media/horror/grade3.sh, voice_edge.py, prep.py, render.sh

The v2 frame: full-screen 9:16 footage (sources pre-cropped to 1080x1920 by grade3.sh, crop centre CX in catalog.py),
"titleStyle": "riddle" (small white modifier over one big red word on the picture), "capLook": "plain" (white-only
captions at 62.5 % of the height, the first one already on screen at 0 s), no source badge (credits go in the upload
description), an anonymous hand or silhouette in the first shot, and the closing twist line as the last frame (no
"이해하셨나요?" line; the answer prompt is the pinned comment).
This replaces the v1 edits written by make_edits.py (do not re-run that one for horror1-8)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import source
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SLOW = [1.0, 1.07]
GD, GS = {"file": "music/Gathering Darkness.mp3", "gain": 0.13}, {"file": "music/Ghost Story.mp3", "gain": 0.11}
Z = lambda a, b: {"zoom": [a, b]}
NOTE = lambda text, frm, to, size=46: {"text": text, "from": frm, "to": to, "x": 540, "y": 860, "rot": 0, "bg": "#F2F2F2", "fg": "#111", "size": size}
# (anchor, file key, in-point, extra)
CUTS = {
 "horror1": {"music": {**GD, "start": 2}, "cuts": [
   ("a", "px7701962", 3.6, {"label": "버튼을 누르는 손"}),
   ("a.건물엔", "px15201563", 6.0, {"label": "빈 복도"}),
   ("b", "px34779661", 2.0, {"label": "엘리베이터 홀"}),
   ("b.엘리베이터를", "px15434928", 0.0, {"label": "층 표시"}),
   ("c", "px5823578", 0.6, {"label": "4층→1층", "speed": 4.0, **Z(1.05, 1.1)}),
   ("c.띵", "px15434928", 8.0, {"label": "표시등", **Z(1.15, 1.25)}),
   ("d", "pxpb130783", 2.6, {"label": "문이 열림"}),
   ("d.안은", "pxpb131012", 0.5, {"label": "빈 엘리베이터 안"}),
   ("e", "pxpb131012", 9.0, {"label": "엘리베이터 안", **Z(1.12, 1.2)}),
   ("e.삐", "px978049", 0.0, {"label": "표시판", **Z(1.1, 1.18)}),
   ("f", "pxpb131012", 5.0, {"label": "빈 엘리베이터", **Z(1.15, 1.22)}),
   ("g", "px34779661", 9.0, {"label": "뒷걸음질"}),
   ("g.엘리베이터는", "px978049", 0.0, {"label": "위로", "speed": 3.0}),
   ("h", "pxpb130783", 0.3, {"label": "닫힌 엘리베이터", **Z(1.06, 1.14)}),
  ], "sfx": [["c.띵", "ding", 0.55], ["e.삐", "k_error_003", 0.6], ["g", "heartbeat", 0.6], ["h", "k_glitch_002", 0.3]], "flashes": ["e.삐"]},
 "horror2": {"music": {**GS, "start": 5}, "cuts": [
   ("a", "px2108274", 1.15, {"label": "문손잡이를 잡은 손"}),
   ("a.삑", "px35999369", 0.0, {"label": "잠금장치", "speed": 0.42, **Z(1.1, 1.18)}),
   ("a.삑+1.6", "px9658661", 10.0, {"label": "어두운 복도", **Z(1.1, 1.16)}),
   ("b", "pxpb28237", 30.0, {"label": "문이 열림"}),
   ("b.도어락이", "px35999369", 5.9, {"label": "잠금 풀림", "speed": 0.33, **Z(1.1, 1.14)}),
   ("c", "px29038649", 0.0, {"label": "문손잡이"}),
   ("d", "px7598737", 2.0, {"label": "복도"}),
   ("d.띠리릭", "pxpb28237", 38.0, {"label": "문이 닫힘"}),
   ("d.다시", "px19217899", 0.5, {"label": "어둠"}),
   ("e", "px5384813", 1.0, {"label": "새벽 방", **Z(1.08, 1.14)}),
   ("e.이불", "px19217899", 3.0, {"label": "어둠"}),
   ("f", "px9658661", 2.0, {"label": "아침 복도"}),
   ("f.그대로였다", "px29038649", 2.5, {"label": "현관문", **Z(1.1, 1.16)}),
   ("g", "px3512344", 0.5, {"label": "신발"}),
   ("g.한", "px8533759", 3.6, {"label": "내려놓이는 신발"}),
   ("h", "px8533759", 0.3, {"label": "신발", **Z(1.12, 1.2)}),
  ], "sfx": [["a.삑", "click", 0.45], ["b", "k_confirmation_002", 0.4], ["d.띠리릭", "k_confirmation_002", 0.4], ["g.한", "heartbeat", 0.6], ["h", "k_glitch_002", 0.3]], "flashes": ["g.한"]},
 "horror3": {"music": {**GD, "start": 30}, "cuts": [
   ("a", "px6611938", 4.0, {"label": "휴대폰을 든 손"}),
   ("a.택배", "px6611938", 10.0, {"label": "휴대폰", **Z(1.15, 1.22)}),
   ("b", "px8346903", 2.0, {"label": "점심시간 회사"}),
   ("b.택배를", "px7362603", 4.0, {"label": "문 앞 택배", **Z(1.1, 1.16)}),
   ("c", "px13358555", 6.0, {"label": "어둠 속 휴대폰"}),
   ("d", "px7362603", 1.0, {"label": "문 앞 봉투"}),
   ("d.바로", "px9658661", 6.0, {"label": "집 복도"}),
   ("e", "px5483080", 8.0, {"label": "회사", **Z(1.1, 1.18)}),
   ("e.그리고", "px15365449", 2.0, {"label": "빈 복도"}),
   ("e.혼자", "px7598737", 3.0, {"label": "어두운 복도"}),
   ("f", "px9658661", 18.0, {"label": "현관문"}),
   ("g", "px15365449", 10.0, {"label": "퇴근길"}),
   ("g.문", "px9658661", 26.0, {"label": "텅 빈 문 앞", **Z(1.08, 1.15)}),
  ], "stickers": [NOTE("📦 택배를 문 앞에 두었습니다", "b", "c", 44), NOTE("안에 계신 분이 바로 받아 가셨어요", "d", "e", 40)],
  "sfx": [["a.택배", "k_question_001", 0.4], ["c", "k_question_001", 0.4], ["e.혼자", "heartbeat", 0.6], ["g.문", "k_glitch_002", 0.3]], "flashes": ["e.혼자"]},
 "horror4": {"music": {**GS, "start": 20}, "cuts": [
   ("a", "px7646797", 1.0, {"label": "열쇠를 든 손"}),
   ("a+1.2", "px32834268", 4.0, {"label": "욕실 거울"}),
   ("a.원룸", "px36778198", 0.5, {"label": "큰 거울"}),
   ("a.커다란", "px32834268", 1.0, {"label": "거울"}),
   ("b", "px27861219", 2.0, {"label": "거울 속"}),
   ("b.늘", "px27861219", 6.0, {"label": "어두운 거울", **Z(1.08, 1.15)}),
   ("c", "px5384813", 2.0, {"label": "조명"}),
   ("d", "px4623153", 4.0, {"label": "불 끄기"}),
   ("d.불을", "px19217895", 1.0, {"label": "깜깜한 방"}),
   ("e", "px19217895", 6.0, {"label": "어둠", **Z(1.1, 1.16)}),
   ("e.고개를", "px36778198", 3.0, {"label": "거울"}),
   ("f", "px36778198", 5.0, {"label": "불 켜진 거울 속 방", **Z(1.1, 1.16)}),
   ("f.아직", "px32834268", 8.0, {"label": "불 켜진 방", **Z(1.12, 1.2)}),
   ("g", "px4623153", 8.0, {"label": "꺼진 방"}),
   ("g.아무도", "px27861219", 9.0, {"label": "아무도 없는 거울", **Z(1.1, 1.18)}),
  ], "sfx": [["d", "click", 0.6], ["f", "heartbeat", 0.6], ["g.아무도", "k_glitch_002", 0.3]], "flashes": ["f"]},
 "horror5": {"music": {**GD, "start": 60}, "cuts": [
   ("a", "px4354915", 1.0, {"label": "버튼을 누르는 손"}),
   ("a.엘리베이터", "px5843879", 0.0, {"label": "비상계단"}),
   ("b", "px3134591", 1.0, {"label": "비상구 표시"}),
   ("b.사람이", "px9152640", 4.0, {"label": "계단"}),
   ("c", "px12096163", 1.0, {"label": "어두운 계단"}),
   ("c.아래층", "px39024320", 1.0, {"label": "켜진 불"}),
   ("d", "px9152640", 8.0, {"label": "아래층"}),
   ("d.아홉", "px5986347", 3.0, {"label": "나선 계단"}),
   ("d.꼭", "px6010700", 2.0, {"label": "어두운 계단"}),
   ("e", "px4990438", 1.0, {"label": "1층"}),
   ("e.잡는", "px7644222", 5.0, {"label": "비상구"}),
   ("f", "px12096163", 6.0, {"label": "등 뒤", **Z(1.08, 1.15)}),
   ("f.이", "px39024320", 5.0, {"label": "2층 불", **Z(1.12, 1.2)}),
   ("g", "px6010700", 10.0, {"label": "위층 어둠", **Z(1.15, 1.25)}),
  ], "sfx": [["c.아래층", "click", 0.45], ["f.딸깍", "click", 0.6], ["f.이", "heartbeat", 0.6], ["g", "k_glitch_002", 0.3]], "flashes": ["f.이"]},
 "horror6": {"music": {**GS, "start": 40}, "cuts": [
   ("a", "px6302990", 1.0, {"label": "젖은 유리를 짚은 손"}),
   ("a.몇", "px27890130", 0.5, {"label": "세워 둔 차"}),
   ("b", "px6028858", 0.5, {"label": "지하주차장"}),
   ("b.주인을", "px19217892", 1.0, {"label": "빈 주차장"}),
   ("c", "px6028882", 2.0, {"label": "지나가는 길"}),
   ("c.창문", "px38433795", 1.0, {"label": "차 안"}),
   ("d", "px5192033", 2.0, {"label": "김 서린 유리"}),
   ("d.김이", "px38433795", 8.0, {"label": "김 서린 창", **Z(1.1, 1.18)}),
   ("e", "px5227362", 3.0, {"label": "유리"}),
   ("e.또", "px5192033", 10.0, {"label": "글씨", **Z(1.1, 1.2)}),
   ("f", "px6028882", 14.0, {"label": "주차장", **Z(1.1, 1.18)}),
   ("f.그런데", "px38433795", 12.0, {"label": "창"}),
   ("f.좌우로", "px5227362", 15.0, {"label": "뒤집힌 글씨", **Z(1.12, 1.22)}),
   ("g", "px32078487", 4.0, {"label": "닫힌 문"}),
  ], "stickers": [{**NOTE("또 봤네?", "e.또", "f", 64), "bg": "#E8ECEF", "fg": "#222"}],
  "sfx": [["e.또", "k_question_001", 0.4], ["f.좌우로", "heartbeat", 0.6], ["g", "k_glitch_002", 0.3]], "flashes": ["f.좌우로"]},
 "horror7": {"music": {**GD, "start": 90}, "cuts": [
   ("a", "px13358555", 2.0, {"label": "휴대폰을 든 손"}),
   ("a.현관을", "px19228170", 0.5, {"label": "현관"}),
   ("a.홈캠을", "px34106136", 1.0, {"label": "카메라"}),
   ("b", "px6028175", 1.0, {"label": "렌즈"}),
   ("b.출퇴근하는", "px19193293", 1.0, {"label": "거실"}),
   ("c", "px6114429", 3.0, {"label": "아침 불"}),
   ("c.어젯밤", "px5245970", 10.0, {"label": "렌즈", **Z(1.1, 1.18)}),
   ("d", "px6443851", 1.0, {"label": "녹화 화면 침대"}),
   ("d.자고", "px15887293", 2.0, {"label": "녹화 화면 침대"}),
   ("e", "px6443851", 8.0, {"label": "침대 옆", **Z(1.15, 1.25)}),
   ("e.나를", "px15887293", 7.0, {"label": "내려다보는 각도", **Z(1.12, 1.2)}),
   ("f", "px19228170", 12.0, {"label": "현관문"}),
   ("f.한", "px19193293", 6.0, {"label": "거실", **Z(1.08, 1.15)}),
   ("g", "px34106136", 6.0, {"label": "카메라", **Z(1.1, 1.2)}),
  ], "stickers": [{"text": "● REC  02:13", "from": "d", "to": "f", "x": 540, "y": 600, "rot": 0, "bg": "#111", "fg": "#ff2a2a", "size": 44}],
  "sfx": [["d", "k_glitch_002", 0.3], ["e", "heartbeat", 0.6], ["g", "k_glitch_002", 0.3]], "flashes": ["d.자고"]},
 "horror8": {"music": {**GS, "start": 60}, "cuts": [
   ("a", "px5994916", 2.0, {"label": "텐트 안 손 그림자"}),
   ("a+1.0", "px5994907", 4.0, {"label": "텐트 안 그림자", **Z(1.1, 1.16)}),
   ("a.밤새", "px9976082", 2.0, {"label": "밤비"}),
   ("b", "px34405948", 1.0, {"label": "밤 숲"}),
   ("b.철벅", "px7714908", 1.0, {"label": "진흙"}),
   ("c", "px9591436", 1.0, {"label": "텐트"}),
   ("c.천천히", "px5994915", 20.0, {"label": "텐트 주위", **Z(1.1, 1.18)}),
   ("d", "px5391986", 2.0, {"label": "흔들리는 나뭇잎"}),
   ("d.아침을", "px4162882", 1.0, {"label": "새벽 텐트"}),
   ("e", "px39485457", 1.0, {"label": "젖은 텐트"}),
   ("e.젖은", "px39619866", 1.0, {"label": "젖은 흙"}),
   ("f", "px5419248", 2.0, {"label": "텐트 입구"}),
   ("f.한", "px39619866", 6.0, {"label": "발자국", **Z(1.1, 1.18)}),
   ("f.다시", "px5419248", 12.0, {"label": "텐트", **Z(1.12, 1.2)}),
   ("g", "px5994907", 2.0, {"label": "텐트 안 그림자"}),
  ], "sfx": [["b.철벅", "k_drop_002", 0.25], ["f.다시", "heartbeat", 0.6], ["g", "k_glitch_002", 0.3]], "flashes": ["f.다시"]},
 "horror9": {"music": {**GD, "start": 120}, "cuts": [
   ("a", "px6611941", 2.0, {"label": "휴대폰을 든 손"}),
   ("a.휴대폰", "px13358555", 4.0, {"label": "어둠 속 휴대폰", **Z(1.12, 1.2)}),
   ("b", "px5384813", 4.0, {"label": "새벽 방"}),
   ("b.단톡방에", "px6611941", 5.0, {"label": "휴대폰", **Z(1.1, 1.16)}),
   ("c", "px8342690", 1.0, {"label": "빈 교실"}),
   ("c.나", "px6935499", 2.0, {"label": "책상들"}),
   ("d", "px19193293", 1.0, {"label": "어두운 거실"}),
   ("e", "px7822022", 0.2, {"label": "어두운 휴대폰 화면"}),
   ("e.메시지를", "px13358555", 9.0, {"label": "휴대폰", **Z(1.15, 1.22)}),
   ("f", "px6611941", 8.0, {"label": "휴대폰", **Z(1.1, 1.18)}),
   ("g", "px8342695", 1.0, {"label": "빈 교실"}),
   ("g.서른", "px6611941", 12.0, {"label": "참여 인원", **Z(1.15, 1.22)}),
   ("h", "px8342690", 12.0, {"label": "빈 교실", **Z(1.08, 1.16)}),
  ], "stickers": [NOTE("우리 반 단톡방에 초대되었습니다", "b.단톡방에", "c", 40), NOTE("이제야 다 모였네", "f", "g"), NOTE("참여 인원 30", "g.서른", "h", 54)],
  "sfx": [["a.휴대폰", "k_question_001", 0.4], ["f", "k_question_001", 0.4], ["g.서른", "heartbeat", 0.6], ["h", "k_glitch_002", 0.3]], "flashes": ["g.서른"]},
 "horror10": {"music": {**GS, "start": 80}, "cuts": [
   ("a", "px7055339", 11.0, {"label": "공책을 든 손"}),
   ("b", "px5897634", 1.0, {"label": "교실 책상"}),
   ("b.알림장을", "px7055339", 2.0, {"label": "넘어가는 공책"}),
   ("c", "px6326847", 1.0, {"label": "사인하는 손"}),
   ("c.엄마", "px6326847", 6.0, {"label": "사인", **Z(1.1, 1.18)}),
   ("d", "px8342690", 3.0, {"label": "교실"}),
   ("d.칭찬", "px6863499", 3.0, {"label": "도장"}),
   ("e", "px7598737", 1.0, {"label": "어두운 복도"}),
   ("f", "px19193293", 1.0, {"label": "빈 거실"}),
   ("g", "px5384813", 1.0, {"label": "밤 조명"}),
   ("g.혼자뿐이었다", "px19217899", 1.0, {"label": "어둠"}),
   ("h", "px39425735", 1.0, {"label": "밤에 글씨 쓰는 손"}),
   ("h.책가방", "px7055339", 14.0, {"label": "공책", **Z(1.08, 1.15)}),
  ], "sfx": [["d.칭찬", "click", 0.5], ["f", "heartbeat", 0.55], ["h", "k_glitch_002", 0.3]], "flashes": ["h"]},
 "horror11": {"music": {**GD, "start": 150}, "cuts": [
   ("a", "px9479751", 3.0, {"label": "할머니 손과 내 손"}),
   ("a.깜깜한", "px19585708", 1.0, {"label": "시골집"}),
   ("b", "px35889601", 5.0, {"label": "밤의 집"}),
   ("b.손바닥을", "px10210122", 2.0, {"label": "펴는 손"}),
   ("c", "px7234023", 1.0, {"label": "손금"}),
   ("c.오래", "px5271483", 1.0, {"label": "할머니 손"}),
   ("d", "px7234023", 7.0, {"label": "손금", **Z(1.12, 1.2)}),
   ("d.이어져", "px10210122", 20.0, {"label": "손"}),
   ("e", "px7546178", 2.0, {"label": "맞잡은 손"}),
   ("e.잡고", "px9479751", 10.0, {"label": "할머니 손", **Z(1.1, 1.18)}),
   ("f", "px5271483", 4.0, {"label": "할머니 손", **Z(1.12, 1.2)}),
   ("f.얼음처럼", "px19585708", 5.0, {"label": "시골집"}),
   ("g", "px35889601", 20.0, {"label": "어두운 집"}),
   ("g.손금이", "px4547598", 6.0, {"label": "어두운 문"}),
  ], "sfx": [["c", "k_question_001", 0.3], ["f", "heartbeat", 0.55], ["g.손금이", "k_glitch_002", 0.3]], "flashes": ["g.손금이"]},
 "horror12": {"music": {**GS, "start": 100}, "cuts": [
   ("a", "px9594994", 2.5, {"label": "옷걸이를 잡은 손"}),
   ("a+1.1", "px8322393", 2.0, {"label": "걸린 옷", **Z(1.1, 1.16)}),
   ("a.하나", "px7598737", 1.0, {"label": "어두운 복도"}),
   ("a.셋", "px2108274", 2.0, {"label": "문손잡이"}),
   ("b", "px9594994", 0.5, {"label": "옷걸이"}),
   ("b.숨었다", "px8322393", 5.0, {"label": "걸린 옷"}),
   ("c", "px4547598", 6.0, {"label": "문틈 빛"}),
   ("c.문틈으로", "px19217899", 1.0, {"label": "어둠"}),
   ("d", "px7598737", 5.0, {"label": "복도", **Z(1.08, 1.14)}),
   ("d.동생", "px9658661", 2.0, {"label": "멀어지는 복도"}),
   ("e", "px9594994", 4.0, {"label": "옷장 안", **Z(1.15, 1.22)}),
   ("e.내", "px37554583", 1.5, {"label": "유리 너머 손"}),
   ("f", "px37554583", 3.0, {"label": "두 손", **Z(1.1, 1.16)}),
   ("g", "px19217899", 4.0, {"label": "어둠"}),
   ("g.딱", "px4547598", 12.0, {"label": "문틈", **Z(1.08, 1.14)}),
  ], "sfx": [["c", "click", 0.35], ["e.내", "heartbeat", 0.6], ["f", "k_glitch_002", 0.3]], "flashes": ["f"]},
}
if __name__ == "__main__":
    catalog = {}
    for sid, c in CUTS.items():
        keys, clips = [], []
        for anchor, key, inn, extra in c["cuts"]:
            if key not in keys: keys.append(key)
            clips.append({"src": key, "from": anchor, "in": inn, "zoom": SLOW, "audio": 0, "credit": "", **extra})
            catalog.setdefault(key, {**source(key), "used_in": {}})["used_in"].setdefault(sid, []).append(inn)
        srcs = {}
        for k in keys:
            s = source(k); s.pop("credit", None); srcs[k] = s
        edit = {"frame": "full", "titleStyle": "riddle", "titleKey": "#E8141B", "capLook": "plain", "captionY": 1200, "credit": "",
                "sources": srcs, "clips": clips, "stickers": c.get("stickers", []), "sfx": c["sfx"], "flashes": c.get("flashes", []), "music": c["music"]}
        json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    out = {"note": "Stock footage for the [괴담] v2 shorts horror1-horror12 (licence pages opened 2026-10-10). Files are not committed; "
                   "media/horror/grade3.sh downloads file_url, crops to 9:16 at catalog.CX, scales to 1080x1920, mutes and grades into "
                   "public/<short>/src/<file>. used_in = source in-points (seconds) per short; each cut runs about 0.6-3 s. "
                   "No credit is drawn on screen; every creator is credited in the upload description (README).",
           "sources": [{**{k: v for k, v in v.items() if k != "credit"}, "used_in": [{"short": s, "source_in_seconds": t} for s, t in v["used_in"].items()]}
                       for v in catalog.values()]}
    json.dump(out, open(f"{HERE}/media/horror/sources_v2.json", "w"), ensure_ascii=False, indent=1)
    print("wrote", list(CUTS))
