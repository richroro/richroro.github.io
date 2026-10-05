"""narrate.py 점검. 네트워크 없이 가짜 엔진(길이만 흉내 내는 톤)으로 배치·믹싱까지 돌린다.

    python3 -m pytest -q .claude/skills/video-narration/scripts/test_narrate.py
"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import narrate as N  # noqa: E402


class FakeEngine(N.Engine):
    """대본 길이 추정치만큼 톤을 만든다. 속도는 절반만 직접 반영해 atempo 경로도 거친다."""
    name = "fake"
    default_voice = "tone"
    calls = []

    def synth(self, text, rate, out):
        applied = 1 + (rate - 1) / 2
        d = N.estimate_seconds(text, applied)
        FakeEngine.calls.append(rate)
        N.run_ff(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-f", "lavfi", "-i", f"sine=f=440:d={d:.3f}:r=24000",
                  "-filter_complex", "[0]atrim=0:0.3[s0];[0]atrim=0:0.5[s1];[s0][1][s1]concat=n=3:v=0:a=1", out])
        return None, applied


N.ENGINES["fake"] = FakeEngine


def write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


class ParseTest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def test_ranges_and_directions(self):
        p = write(os.path.join(self.d, "s.txt"), """
[00:00-00:05] 공모주 청약, 처음이라면 이것부터 보세요
(화면: 캘린더 확대)
[00:05~00:12]
화면: 증권사 로고
내레이션: 계좌는 청약 한 달 전에 만들어 두는 게 좋아요
내레이션: 20영업일 제한이 있거든요
""")
        sc = N.parse_script(p)
        self.assertEqual(len(sc), 2)
        self.assertEqual((sc[0].start, sc[0].end), (0, 5))
        self.assertNotIn("화면", sc[0].text)
        self.assertEqual((sc[1].start, sc[1].end), (5, 12))
        self.assertNotIn("증권사 로고", sc[1].text)
        self.assertIn("20영업일", sc[1].text)

    def test_scene_labels_with_durations(self):
        p = write(os.path.join(self.d, "s.md"), """## 장면 1 (4초)
첫 문장입니다
**장면 2** (6초): 두 번째 장면이에요
장면 3 (0:10-0:15)
세 번째
""")
        sc = N.parse_script(p)
        N.assign_times(sc, 15.0)
        self.assertEqual([(s.start, s.end) for s in sc], [(0, 4), (4, 10), (10, 15)])
        self.assertIn("두 번째", sc[1].text)

    def test_number_start_is_not_time(self):
        p = write(os.path.join(self.d, "s.txt"), "3가지 이유가 있습니다.\n\n2026년에는 달라집니다.\n")
        sc = N.parse_script(p)
        self.assertEqual(len(sc), 2)
        self.assertIsNone(sc[0].start)
        N.assign_times(sc, 10.0)
        self.assertAlmostEqual(sc[-1].end, 10.0)

    def test_json(self):
        p = write(os.path.join(self.d, "s.json"), json.dumps({"scenes": [{"duration": 3, "text": "하나"}, {"duration": "4초", "text": "둘"}]}))
        sc = N.parse_script(p)
        N.assign_times(sc, None)
        self.assertEqual([(s.start, s.end) for s in sc], [(0, 3), (3, 7)])

    def test_normalize(self):
        t = N.normalize_for_speech("**꿀팁** 🔥 3~5개만 기억하세요\n[BGM] 이게 핵심이다")
        self.assertEqual(t, "꿀팁 3에서 5개만 기억하세요. 이게 핵심이다.")


class EndToEndTest(unittest.TestCase):
    def test_video_fit_and_mix(self):
        d = tempfile.mkdtemp()
        video = os.path.join(d, "in.mp4")
        N.run_ff(["-f", "lavfi", "-i", "testsrc2=s=320x568:r=30:d=12", "-f", "lavfi", "-i", "sine=f=220:d=12",
                  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video])
        music = os.path.join(d, "bgm.mp3")
        N.run_ff(["-f", "lavfi", "-i", "sine=f=330:d=3", music])
        script = write(os.path.join(d, "s.txt"), """[0:00-0:04] 짧은 첫 장면입니다.
[0:04-0:08.5] 이 장면은 창보다 조금 긴 문장이라서 속도를 살짝 올려야 들어갑니다.
[0:08.5-0:12] 마지막 장면은 대본이 너무 길어서 최대 속도로도 다 들어가지 않고, 영상 끝을 넘겨버리는 경우를 흉내 냅니다. 그러면 마지막 프레임을 늘려서 끝까지 들려줘야 합니다.
""")
        out = os.path.join(d, "out")
        FakeEngine.calls.clear()
        self.assertEqual(N.main([script, "--video", video, "--out", out, "--engine", "fake", "--music", music]), 0)
        with open(os.path.join(out, "report.json"), encoding="utf-8") as f:
            rep = json.load(f)
        s1, s2, s3 = rep["scenes"]
        self.assertAlmostEqual(s1["speed"], 1.0)
        self.assertAlmostEqual(s1["narration_at"], 0.2, places=2)
        self.assertGreater(s2["speed"], 1.0)
        self.assertLessEqual(s2["speed"], 1.2 + 1e-6)
        self.assertLess(s2["overflow"], 0.1)
        self.assertAlmostEqual(s3["speed"], 1.2, places=3)
        self.assertGreater(s3["overflow"], 0)
        self.assertGreater(rep["output_duration"], 12.0)
        dur, has_audio = N.probe(os.path.join(out, "narrated.mp4"))
        self.assertTrue(has_audio)
        self.assertAlmostEqual(dur, rep["output_duration"], delta=0.15)
        with open(os.path.join(out, "subtitles.srt"), encoding="utf-8") as f:
            srt = f.read()
        self.assertIn("00:00:00,200 -->", srt)
        for f in ("narration.wav", "clips/scene_01.mp3", "clips/scene_03.mp3"):
            self.assertTrue(os.path.getsize(os.path.join(out, f)) > 1000, f)

    def test_check_mode(self):
        d = tempfile.mkdtemp()
        script = write(os.path.join(d, "s.txt"), "[0-2] 이 문장은 이초 안에 절대로 다 읽을 수가 없는 아주 긴 문장입니다.\n")
        self.assertEqual(N.main([script, "--check"]), 1)


class EngineChoiceTest(unittest.TestCase):
    def test_voice_owner(self):
        self.assertEqual(N.voice_owner("6"), "supertonic")
        self.assertEqual(N.voice_owner("ko-KR-InJoonNeural"), "edge")
        self.assertEqual(N.voice_owner("ko-KR-Chirp3-HD-Kore"), "google")
        self.assertEqual(N.voice_owner("nova"), "openai")
        self.assertIsNone(N.voice_owner(None))


@unittest.skipUnless(
    os.path.exists(os.path.expanduser("~/.cache/video-narration/" + N.SupertonicEngine.MODEL + "/voice.bin")),
    "supertonic 모델이 캐시에 없음 (한 번 실행하면 받아진다)")
class SupertonicTest(unittest.TestCase):
    def test_real_voice_fits_scene(self):
        d = tempfile.mkdtemp()
        script = write(os.path.join(d, "s.txt"), "[0:00-0:04] 공모주 청약, 처음이라면 딱 세 가지만 기억하세요.\n")
        out = os.path.join(d, "out")
        self.assertEqual(N.main([script, "--engine", "supertonic", "--voice", "6", "--out", out]), 0)
        with open(os.path.join(out, "report.json"), encoding="utf-8") as f:
            sc = json.load(f)["scenes"][0]
        self.assertTrue(1.5 < sc["speech"] <= 3.5, sc)
        self.assertTrue(os.path.getsize(os.path.join(out, "clips", "scene_01.wav")) > 50000)


if __name__ == "__main__":
    unittest.main()
