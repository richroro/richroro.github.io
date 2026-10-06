"""영상 편집 스킬 점검. 받아쓰기 모델 없이도 도는 부분은 항상, 글꼴·글자 인식이 필요한 부분은 준비됐을 때만.

    python3 .claude/skills/video-edit/scripts/test_video_edit.py
"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import edit  # noqa: E402
import review  # noqa: E402
import transcribe  # noqa: E402
from common import FONTS, load_rules, probe, run_ff  # noqa: E402
from fetch_drive import drive_id  # noqa: E402

RULES = load_rules()
HAS_FONTS = os.path.exists(os.path.join(FONTS, "Pretendard-Bold.otf"))
try:
    import rapidocr_onnxruntime  # noqa: F401
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def words(spec):
    """[(text, start, end), ...] → transcript.json 모양"""
    return {"duration": max(e for _, _, e in spec) + 1.0, "source": "x",
            "words": [{"id": i, "text": t, "start": s, "end": e, "seg": 0} for i, (t, s, e) in enumerate(spec)]}


class CutTest(unittest.TestCase):
    def test_parse_ids(self):
        self.assertEqual(edit.parse_ids([1, "3-5", " 9 "]), {1, 3, 4, 5, 9})

    def test_delete_and_long_pause_make_jump_cuts(self):
        tr = words([("안녕하세요", 1.0, 1.6), ("어", 2.0, 2.2), ("오늘은", 2.6, 3.0), ("공모주", 3.05, 3.5),
                    ("얘기", 5.0, 5.4), ("할게요", 5.45, 5.9)])
        segs = edit.plan_segments(tr, {"delete": [1]}, RULES, 30)
        self.assertEqual([s["words"] for s in segs], [[0], [2, 3], [4, 5]])  # 군말 삭제 + 1.5초 쉼에서 컷
        for s in segs:
            self.assertLess(s["f0"], s["f1"])
        # 지운 '어'(2.0~2.2) 소리가 앞뒤 조각에 섞이지 않는다
        self.assertLessEqual(segs[0]["f1"] / 30, 2.0)
        self.assertGreaterEqual(segs[1]["f0"] / 30, 2.2)

    def test_timeline_maps_into_output(self):
        tr = words([("가", 1.0, 1.5), ("나", 4.0, 4.5)])
        segs = edit.plan_segments(tr, {}, RULES, 30)
        edit.assign_zoom(segs, RULES, 30)
        tl = edit.Timeline(segs, 30)
        self.assertLess(tl.total, 3.6)  # 2.5초 쉼이 사라짐
        self.assertAlmostEqual(tl.map(4.0) - tl.map(1.5), RULES["cut"]["pad_after"] + RULES["cut"]["pad_before"], delta=0.08)
        self.assertEqual(len(tl.joins()), 1)

    def test_zoom_alternates_and_emphasis_returns(self):
        tr = words([(f"w{i}", i * 2.0, i * 2.0 + 1.6) for i in range(4)])
        segs = edit.plan_segments(tr, {}, RULES, 30)
        edit.split_for_emphasis(segs, tr, {"emphasis": []}, RULES, 30)
        edit.assign_zoom(segs, RULES, 30)
        self.assertEqual([s["zoom"] for s in segs][:2], RULES["zoom"]["levels"][:2])
        tr2 = words([("가나다라", 0.5, 1.0)] + [(f"w{i}", 1.05 + i * 0.4, 1.4 + i * 0.4) for i in range(12)])
        segs2 = edit.plan_segments(tr2, {}, RULES, 30)
        edit.split_for_emphasis(segs2, tr2, {"emphasis": [{"words": [3]}]}, RULES, 30)
        edit.assign_zoom(segs2, RULES, 30)
        zooms = [s["zoom"] for s in segs2]
        self.assertIn(RULES["zoom"]["emphasis"], zooms)
        self.assertNotEqual(zooms[-1], RULES["zoom"]["emphasis"])  # 강조가 끝나면 돌아온다


class SubtitleTest(unittest.TestCase):
    def test_balance_lines(self):
        items = [{"text": t, "s": 0, "e": 0} for t in "신규 계좌는 20영업일 제한이 있어서 한 달 전에 미리".split()]
        lines = edit.balance(items, 17)
        self.assertTrue(all(edit._len(l) <= 17 for l in lines))
        self.assertFalse(any(len(l[-1]["text"]) == 1 for l in lines[:-1]))  # '한' 이 줄 끝에 홀로 남지 않음

    def test_lines_drop_periods_and_apply_fix(self):
        tr = words([("안녕하세요.", 0.5, 1.2), ("공모주청약", 1.3, 1.9), ("시작합니다.", 1.95, 2.6)])
        segs = edit.plan_segments(tr, {}, RULES, 30)
        edit.assign_zoom(segs, RULES, 30)
        lines = edit.build_lines(tr, {"fix": {"1": "공모주 청약"}}, edit.Timeline(segs, 30), RULES, False)
        self.assertEqual([l["text"] for l in lines], ["안녕하세요", "공모주 청약 시작합니다"])


class CorrectionTest(unittest.TestCase):
    def test_suggestions(self):
        ws = [{"text": t, "start": i, "end": i + 0.5} for i, t in
              enumerate(["어", "먼저", "계좌를", "먼저", "계좌를", "만들어요", "계", "계좌는", "진짜"])]
        s = transcribe.suggest_deletions(ws, RULES)
        self.assertEqual(s[0], "군말")
        self.assertEqual((s[1], s[2]), ("반복", "반복"))
        self.assertNotIn(3, s)
        self.assertEqual(s[6], "말 끊김")
        self.assertNotIn(8, s)


class ReviewTest(unittest.TestCase):
    def test_mask_and_patterns(self):
        self.assertEqual(review.mask("010-2345-6789"), "010-****-****")
        hits = {k for k, rx in review.PII if rx.search("연락 010-2345-6789 / a.b@mail.com / 900101-1234567")}
        self.assertTrue({"휴대전화", "이메일", "주민등록번호"} <= hits)

    def test_cer(self):
        self.assertEqual(review.cer("공모주 청약", "공모주청약."), 0.0)
        self.assertGreater(review.cer("공모주 청약", "공무주 청야"), 0.3)

    def test_drive_id(self):
        self.assertEqual(drive_id("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view?usp=sharing"),
                         ("1AbCdEfGhIjKlMnOpQrSt", "file"))
        self.assertEqual(drive_id("https://drive.google.com/drive/folders/1ZyXwVuTsRqPoNmLkJi?usp=drive_link")[1], "folder")


@unittest.skipUnless(HAS_FONTS, "글꼴 없음 — setup.sh 를 먼저 실행")
class RenderTest(unittest.TestCase):
    def test_full_render_with_broll_blur_and_review(self):
        from PIL import Image, ImageDraw, ImageFont
        d = tempfile.mkdtemp()
        # 전화번호 알림이 보이는 6초짜리 원본
        n = Image.new("RGBA", (640, 360), (0, 0, 0, 0))
        dr = ImageDraw.Draw(n)
        dr.rounded_rectangle((380, 20, 630, 80), radius=10, fill=(255, 255, 255, 255))
        dr.text((395, 35), "010-2345-6789", font=ImageFont.truetype(os.path.join(FONTS, "Pretendard-Bold.otf"), 26), fill="black")
        n.save(os.path.join(d, "n.png"))
        src = os.path.join(d, "src.mp4")
        run_ff(["-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=6", "-f", "lavfi", "-i", "sine=f=300:d=6", "-i", os.path.join(d, "n.png"),
                "-filter_complex", "[0:v][2:v]overlay=0:0[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-shortest", src])
        tr = words([("첫", 0.3, 0.8), ("어", 1.0, 1.3), ("두번째", 1.5, 2.2), ("말입니다", 2.25, 2.9), ("마지막", 4.0, 4.8)])
        tr["duration"] = 6.0
        plan = {"delete": [1], "title": "테스트", "emphasis": [{"words": [2], "text": "강조!"}],
                "broll": [{"from": 4, "dur": 1.0, "card": {"kind": "stat", "value": "50%", "title": "테스트 카드"}, "credit": "출처: 테스트"}]}
        out = os.path.join(d, "out.mp4")
        rules = json.loads(json.dumps(RULES))
        rules["broll"]["min_dur"] = 0.8
        rep = edit.edit(src, tr, plan, rules, out, os.path.join(d, "w"), fast=True)
        info = probe(out)
        self.assertAlmostEqual(info["duration"], rep["output_duration"], delta=0.15)
        self.assertTrue(info["has_audio"])
        self.assertLess(rep["output_duration"], 6.0)
        self.assertEqual(len(rep["broll"]), 1)
        self.assertTrue(os.path.exists(out[:-4] + ".srt"))
        self.assertEqual({e["name"] for e in rep["sfx"]}, {"ding", "pop", "whoosh"})
        if HAS_OCR:
            pii, _ = review.check_pii(out, os.path.join(d, "w"), rep)
            self.assertTrue(any(p["kind"] == "휴대전화" for p in pii), pii)
            plan["blur"] = []
            self.assertEqual(review.add_blur(plan, pii), len(pii))
            rep2 = edit.edit(src, tr, plan, rules, out, os.path.join(d, "w"), fast=True)
            pii2, _ = review.check_pii(out, os.path.join(d, "w"), rep2)
            self.assertFalse(any(p["kind"] == "휴대전화" for p in pii2), pii2)


if __name__ == "__main__":
    unittest.main()
