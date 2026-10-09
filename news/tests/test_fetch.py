"""fetch_news.py · translate.py 단위 테스트 — 네트워크 없이 tests/fixtures 의 피드로 돌린다.

  python -m unittest discover -s news/tests -v
"""
import json
import os
import shutil
import sys
import tempfile
import types
import unittest
from datetime import datetime
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures")
sys.path.insert(0, os.path.dirname(HERE))

import fetch_news as fn  # noqa: E402
import free_translate  # noqa: E402

try:
    import translate  # noqa: E402 — anthropic 패키지가 있어야 한다
except ImportError:  # pragma: no cover
    translate = None

NOW = "2026-10-06T12:00:00+09:00"


def read(name):
    with open(os.path.join(FIX, name), "rb") as f:
        return fn.decode_feed(f.read())


class ParseTest(unittest.TestCase):
    def test_rss_fields(self):
        es = fn.parse_feed(read("rss_cnbc.xml"))
        self.assertEqual(len(es), 4)
        self.assertTrue(es[0]["title"].startswith("BREAKING: Fed holds"))
        self.assertEqual(es[0]["image"], "http://img.example.com/fed.jpg")
        self.assertIn("benchmark rate", es[0]["desc"])

    def test_atom_links_and_dates(self):
        es = fn.parse_feed(read("atom_ft.xml"))
        self.assertEqual([e["link"] for e in es],
                         ["https://news.example.org/content/1001", "https://news.example.org/content/1002"])
        self.assertEqual(es[0]["image"], "https://img.example.org/t.jpg")
        self.assertEqual(es[1]["date"], "2026-10-06T00:30:00Z")   # updated 로 대신

    def test_latin1(self):
        es = fn.parse_feed(read("rss_latin1.xml"))
        self.assertIn("Café", es[0]["desc"])

    def test_broken_xml_is_repaired(self):
        es = fn.parse_feed(read("rss_broken.xml"))
        self.assertEqual(len(es), 1)
        self.assertIn("AT&T", es[0]["title"])
        self.assertEqual(es[0]["link"], "https://broken.example.com/1?a=1&b=2")

    def test_regex_fallback(self):
        es = fn.parse_feed("<rss><item><title>Broken <b>feed</title><link>https://z.example/1</link></item>")
        self.assertEqual(es[0]["link"], "https://z.example/1")


class HelperTest(unittest.TestCase):
    def test_dates(self):
        kst = fn.KST
        self.assertEqual(fn.parse_date("Tue, 06 Oct 2026 01:05:00 GMT").astimezone(kst), datetime(2026, 10, 6, 10, 5, tzinfo=kst))
        self.assertEqual(fn.parse_date("2026-10-06T01:20:00Z").astimezone(kst).hour, 10)
        self.assertEqual(fn.parse_date("2026-10-06 09:30:00-0400").astimezone(kst).hour, 22)
        self.assertIsNone(fn.parse_date("yesterday"))

    def test_classify(self):
        cases = {
            "Fed holds rates steady as inflation cools": "macro",
            "Bitcoin tops $125,000 as crypto rally extends": "crypto",
            "US mortgage rates fall to lowest level in a year": "estate",
            "Oil prices surge after OPEC+ agrees to deeper output cuts": "energy",
            "Trump announces 100% tariff on foreign-made chips": "global",
            "S&P 500 closes at record as Wall Street rallies": "market",
            "Nvidia beats revenue estimates as AI demand soars": "industry",
        }
        for title, cat in cases.items():
            self.assertEqual(fn.classify(title, ""), cat, title)
        self.assertEqual(fn.classify("Weather turns cold", "", "industry"), "industry")
        self.assertEqual(fn.classify("Weather turns cold", "", "nonsense"), "general")
        # 낱말 경계: "Goldman" 은 금(gold)이 아니고, "oilfield" 도 아니다
        self.assertNotEqual(fn.classify("Goldman hires new partner", ""), "energy")

    def test_korea_flag(self):
        self.assertTrue(fn.is_korea("Samsung Electronics profit beats estimates"))
        self.assertTrue(fn.is_korea("South Korea's exports jump"))
        self.assertTrue(fn.is_korea("Kospi hits record"))
        self.assertFalse(fn.is_korea("Fed won't cut rates soon"))

    def test_canonical_url_strips_tracking(self):
        a = fn.make_id("http://m.example.com/a/1/?utm_source=rss&id=3#top")
        b = fn.make_id("https://example.com/a/1?id=3")
        self.assertEqual(a, b)

    def test_safe_url(self):
        self.assertEqual(fn.safe_url("http://x.example/a.jpg"), "https://x.example/a.jpg")
        self.assertEqual(fn.safe_url("//x.example/a.jpg"), "https://x.example/a.jpg")
        self.assertIsNone(fn.safe_url("javascript:alert(1)"))
        self.assertIsNone(fn.safe_url(""))

    def test_shorten(self):
        s = "word " * 100
        self.assertTrue(fn.shorten(s).endswith("…"))
        self.assertLessEqual(len(fn.shorten(s)), fn.SUMMARY_LEN + 1)
        self.assertEqual(fn.shorten("short"), "short")

    def test_numbers(self):
        self.assertEqual(fn.numbers("US adds 254,000 jobs in September 2026"), {"254000"})
        self.assertEqual(fn.numbers("Microsoft to invest $10 billion; shares up 2.5%"), {"10b", "2.5%"})
        self.assertEqual(fn.numbers("3 things to know before Q3 earnings"), set())

    def test_proper_nouns(self):
        self.assertEqual(fn.proper_nouns("Bank of Japan hikes interest rates"), {"boj"})
        self.assertEqual(fn.proper_nouns("Apple shares fall on weak iPhone demand in China"), {"apple", "china"})
        self.assertIsNone(fn.proper_nouns("Fed Holds Rates Steady As Inflation Cools"))   # Title Case 는 판단 보류

    BACKGROUND = """Stocks rise as investors await key inflation data|Oil prices slip as US crude inventories climb
Gold hits record high on safe-haven demand|Microsoft to invest $10 billion in AI data centers in Japan
Amazon plans to cut 14,000 corporate jobs|China's exports rise more than expected in September
ECB holds rates, Lagarde says inflation fight nearly over|Bitcoin falls below $110,000 as ETF outflows mount
US mortgage rates fall to lowest level in a year|Boeing strike ends after workers approve new contract
Japan's Nikkei hits record as yen weakens|Treasury yields climb ahead of Fed meeting
Samsung Electronics profit beats estimates on chip rebound|Meta shares slide after capex forecast raised
UK inflation unexpectedly falls to 3.4%|Home sales in US rise for third straight month
OpenAI valued at $500 billion in share sale|Goldman Sachs profit jumps on trading boom
EU and US reach deal on steel tariffs|Retail sales rise 0.6% in August, beating forecasts"""

    PAIRS = [
        ("Fed holds rates steady, signals two cuts later this year",
         "Federal Reserve keeps interest rates unchanged, still sees two cuts in 2026", True),
        ("Nvidia shares jump 6% after record quarterly revenue", "Nvidia stock rises 6% as data center sales hit record", True),
        ("Oil prices surge after OPEC+ agrees to deeper output cuts", "OPEC+ agrees deeper oil output cuts, crude jumps", True),
        ("US adds 254,000 jobs in September, beating forecasts",
         "US economy added 254,000 jobs last month, far more than expected", True),
        ("Trump announces 100% tariff on foreign-made chips",
         "Trump says US will impose 100% tariffs on imported semiconductors", True),
        ("Tesla deliveries beat estimates as buyers rush ahead of tax credit expiry",
         "Tesla third-quarter deliveries top expectations on EV tax credit rush", True),
        ("Intel shares surge on report of Apple investment talks", "Intel stock jumps after report Apple in talks to invest", True),
        ("Gold hits record high above $4,000 an ounce", "Gold tops $4,000 for first time as investors seek safety", True),
        ("Amazon to cut 14,000 corporate jobs", "Amazon plans 14,000 layoffs in corporate workforce", True),
        ("BOJ raises rates to highest since 2008", "Bank of Japan hikes interest rates to 17-year high", True),
        ("Oracle shares soar 30% on blowout cloud forecast", "Oracle stock surges 30% after huge cloud backlog", True),
        ("Apple shares fall 3% on weak iPhone demand in China", "Tesla shares fall 3% on weak delivery numbers", False),
        ("Fed's Powell says rate cuts not on preset course", "ECB's Lagarde says rate cuts not on preset course", False),
        ("US inflation rises to 2.9% in August", "UK inflation falls to 3.4% in August", False),
        ("Dow rises 300 points as tech rallies", "Nasdaq falls 1% as tech slides", False),
        ("Bitcoin falls below $110,000", "Ether falls below $4,000", False),
        ("China's exports rise more than expected in September", "China's imports fall unexpectedly in September", False),
        ("Microsoft beats earnings estimates on cloud growth", "Alphabet beats earnings estimates on cloud growth", False),
        ("Ford recalls 1.5 million vehicles", "GM recalls 1.5 million vehicles", False),
    ]

    def test_cluster_pairs(self):
        bg = [{"id": "bg%d" % i, "title": t, "time": i}
              for i, t in enumerate(self.BACKGROUND.replace("\n", "|").split("|"))]
        for a, b, same in self.PAIRS:
            items = [dict(x) for x in bg] + [{"id": "a", "title": a, "time": 100}, {"id": "b", "title": b, "time": 200}]
            fn.cluster(items)
            self.assertEqual(items[-2]["cluster"] == items[-1]["cluster"], same, f"{a} | {b}")
        fn.cluster(bg)
        self.assertEqual(len({x["cluster"] for x in bg}), len(bg))   # 서로 다른 배경 기사는 안 묶인다

    def test_cluster_representative_is_earliest(self):
        items = [{"id": "late", "title": "Nvidia stock rises 6% as data center sales hit record", "time": 200},
                 {"id": "early", "title": "Nvidia shares jump 6% after record quarterly revenue", "time": 100}]
        fn.cluster(items)
        self.assertEqual({it["cluster"] for it in items}, {"early"})

    def test_keywords_count_stories_not_articles(self):
        now = datetime(2026, 10, 6, 12, tzinfo=fn.KST)
        t = int(now.timestamp())
        items = [
            {"id": "1", "cluster": "x", "title": "Nvidia shares jump on AI demand", "time": t},
            {"id": "2", "cluster": "x", "title": "Nvidia stock rises as AI demand grows", "time": t},
            {"id": "3", "cluster": "y", "title": "Nvidia's China sales face new limits", "time": t},
            {"id": "4", "cluster": "z", "title": "Tariffs hit retailers", "time": t - 3 * 86400},
        ]
        kw = dict(fn.keywords(items, now))
        self.assertEqual(kw.get("Nvidia"), 2)
        self.assertNotIn("Tariffs", kw)
        self.assertNotIn("shares", kw)

    def test_market_from_chart(self):
        day = 86400
        res = {
            "meta": {"regularMarketPrice": 110.0, "regularMarketTime": 3 * day + 3600, "gmtoffset": 0},
            "timestamp": [1 * day, 2 * day, 3 * day],
            "indicators": {"quote": [{"close": [90.0, 100.0, None]}]},
        }
        row = fn.market_from_chart({"symbol": "X", "name": "엑스"}, res)
        self.assertEqual((row["change"], row["pct"]), (10.0, 10.0))
        res["indicators"]["quote"][0]["close"] = [90.0, 100.0, 108.0]
        self.assertEqual(fn.market_from_chart({"symbol": "X", "name": "엑스"}, res)["change"], 10.0)


class RunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = os.path.join(self.tmp, "feeds.json")
        feeds = [
            {"source": "Test Wire", "hint": "general", "url": "u1", "file": "rss_cnbc.xml"},
            {"source": "Atom Times", "hint": "general", "url": "u2", "file": "atom_ft.xml"},
            {"source": "Latin Post", "hint": "industry", "url": "u3", "file": "rss_latin1.xml"},
            {"source": "Broken Daily", "hint": "general", "url": "u4", "file": "rss_broken.xml"},
            {"source": "Aggregator", "hint": "general", "url": "u5", "file": "gnews.xml", "aggregator": True},
            {"source": "Missing", "hint": "general", "url": "u6", "file": "missing.xml"},
        ]
        with open(self.cfg, "w", encoding="utf-8") as f:
            json.dump({"feeds": feeds}, f, ensure_ascii=False)
        self.out = os.path.join(self.tmp, "data")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_once(self, now=NOW, *extra):
        with mock.patch("builtins.print"):
            return fn.main(["--config", self.cfg, "--out", self.out, "--offline-dir", FIX, "--no-markets",
                            "--no-translate", "--now", now, *extra])

    def load(self, *p):
        with open(os.path.join(self.out, *p), encoding="utf-8") as f:
            return json.load(f)

    def test_end_to_end(self):
        self.assertEqual(self.run_once(), 0)
        idx = self.load("index.json")
        self.assertEqual([d["date"] for d in idx["days"]], ["2026-10-06", "2026-10-05"])
        self.assertEqual([f["ok"] for f in idx["feeds"]], [True, True, True, True, True, False])
        today = self.load("days", "2026-10-06.json")["items"]
        titles = [it["title"] for it in today]
        self.assertEqual([it["time"] for it in today], sorted((it["time"] for it in today), reverse=True))
        # 링크 없는 기사, 매체 없는 모음 기사, 직접 받은 기사와 겹치는 모음 기사는 버린다
        self.assertNotIn("A headline without a link", titles)
        self.assertNotIn("A story with no outlet name", titles)
        self.assertEqual(titles.count("Nvidia shares jump 6% after record quarterly revenue"), 1)
        tariff = next(it for it in today if it["title"].startswith("Trump announces"))
        self.assertEqual((tariff["source"], tariff["via"], tariff["cat"]), ("Reuters", "Aggregator", "global"))
        # 같은 사건(연준 동결)은 매체가 달라도 한 묶음
        fed = [it for it in today if "two cuts" in it["title"]]
        self.assertEqual(len({it["source"] for it in fed}), 2)
        self.assertEqual(len({it["cluster"] for it in fed}), 1)
        samsung = next(it for it in today if it["title"].startswith("Samsung"))
        self.assertEqual(samsung.get("kr"), 1)
        self.assertTrue(all(it["url"].startswith("https://") for it in today))
        # 2026-10-05 14:10Z = 10-05 23:10 KST, 22:00Z = 10-06 07:00 KST
        yest = self.load("days", "2026-10-05.json")["items"]
        self.assertEqual([it["cat"] for it in yest], ["estate"])
        self.assertNotIn("&nbsp;", yest[0]["summary"])
        self.assertTrue(idx["keywords"])

    def test_second_run_is_idempotent(self):
        self.run_once()
        days = os.path.join(self.out, "days")
        before = {n: os.path.getmtime(os.path.join(days, n)) for n in os.listdir(days)}
        idx_before = self.load("index.json")
        self.run_once("2026-10-06T13:00:00+09:00")
        self.assertEqual(before, {n: os.path.getmtime(os.path.join(days, n)) for n in os.listdir(days)})
        self.assertEqual(idx_before, self.load("index.json"))

    def test_old_days_are_pruned(self):
        os.makedirs(os.path.join(self.out, "days"))
        with open(os.path.join(self.out, "days", "2026-08-01.json"), "w") as f:
            json.dump({"date": "2026-08-01", "items": []}, f)
        self.run_once()
        self.assertFalse(os.path.exists(os.path.join(self.out, "days", "2026-08-01.json")))

    def test_all_feeds_failing_returns_error(self):
        with mock.patch("builtins.print"):
            rc = fn.main(["--config", self.cfg, "--out", self.out, "--offline-dir", self.tmp,
                          "--no-markets", "--no-translate", "--now", NOW])
        self.assertEqual(rc, 1)


def fake_response(rows, stop="end_turn"):
    text = types.SimpleNamespace(type="text", text=json.dumps({"items": rows}, ensure_ascii=False))
    return types.SimpleNamespace(stop_reason=stop, content=[text])


class FakeClient:
    """client.beta.messages.create 만 흉내 낸다. 받은 요청을 calls 에 남긴다."""

    def __init__(self, responder):
        self.calls = []
        outer = self

        class _Messages:
            def create(self, **kw):
                outer.calls.append(kw)
                return responder(json.loads(kw["messages"][0]["content"]))

        self.beta = types.SimpleNamespace(messages=_Messages())


@unittest.skipIf(translate is None, "anthropic 패키지가 없다")
class TranslateTest(unittest.TestCase):
    def items(self, n):
        return [{"id": f"i{k}", "title": f"Headline {k}", "summary": f"Summary {k}" if k % 2 else "", "time": k}
                for k in range(n)]

    def test_fills_korean_fields_in_batches(self):
        def respond(batch):
            return fake_response([{"id": b["id"], "title": "제목 " + b["id"], "summary": "요약" if b["summary"] else ""}
                                  for b in batch])
        client = FakeClient(respond)
        items = self.items(30)
        self.assertEqual(translate.translate_items(items, client=client, log=lambda *_: None), 30)
        self.assertEqual(len(client.calls), 2)                      # 25 + 5
        self.assertEqual(items[3]["title_ko"], "제목 i3")
        self.assertEqual(items[3]["summary_ko"], "요약")
        self.assertNotIn("summary_ko", items[2])                     # 요약이 없던 기사
        call = client.calls[0]
        self.assertEqual(call["model"], translate.MODEL)
        self.assertEqual(call["output_config"]["format"]["type"], "json_schema")
        self.assertEqual(call["fallbacks"], "default")

    def test_refusal_and_missing_rows_leave_english(self):
        seq = iter([fake_response([], stop="refusal"),
                    fake_response([{"id": "i25", "title": "번역", "summary": ""}])])
        client = FakeClient(lambda batch: next(seq))
        items = self.items(27)
        done = translate.translate_items(items, client=client, log=lambda *_: None)
        self.assertEqual(done, 1)
        self.assertNotIn("title_ko", items[0])
        self.assertEqual(items[25]["title_ko"], "번역")

    def test_connection_error_stops(self):
        import anthropic

        def boom(batch):
            raise anthropic.APIConnectionError(request=mock.Mock())
        client = FakeClient(boom)
        self.assertEqual(translate.translate_items(self.items(60), client=client, log=lambda *_: None), 0)
        self.assertEqual(len(client.calls), 1)

    def test_run_picks_engine_by_key(self):
        tmp = tempfile.mkdtemp()
        try:
            cfg = os.path.join(tmp, "feeds.json")
            with open(cfg, "w") as f:
                json.dump({"feeds": [{"source": "W", "hint": "general", "url": "u", "file": "rss_cnbc.xml"}]}, f)
            args = ["--config", cfg, "--out", os.path.join(tmp, "d"), "--offline-dir", FIX, "--no-markets", "--now", NOW]
            with mock.patch.object(translate, "translate_items", return_value=0) as tr, \
                    mock.patch.object(free_translate, "translate_titles", return_value=0) as free, \
                    mock.patch("builtins.print"):
                with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
                    fn.main(args)
                tr.assert_not_called()
                free.assert_called_once()
                # 무료 번역은 묶는 범위 전체(어제 기사 포함)를 옮긴다
                self.assertEqual(len(free.call_args[0][0]), 3)
                with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}):
                    fn.main(args)
                tr.assert_called_once()
                self.assertEqual(free.call_count, 1)
        finally:
            shutil.rmtree(tmp)


def gtx_response(text):
    """translate.googleapis.com 응답 모양: 문장 조각마다 [번역, 원문, …]."""
    parts = text.split("\n")
    segs = [[p + ("\n" if i < len(parts) - 1 else ""), "orig", None] for i, p in enumerate(parts)]
    return json.dumps([segs, None, "en"]).encode()


class FreeTranslateTest(unittest.TestCase):
    def items(self, n, size=20):
        return [{"id": f"i{k}", "title": f"Headline number {k} " + "x" * size, "time": k} for k in range(n)]

    def query(self, url):
        import urllib.parse
        return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["q"][0]

    def test_batches_and_fills_title_ko(self):
        calls = []

        def http_get(url):
            q = self.query(url)
            calls.append(q)
            return gtx_response("\n".join("제목 " + line.split()[2] for line in q.split("\n")))
        items = self.items(150, size=40)
        done = free_translate.translate_titles(items, http_get=http_get, log=lambda *_: None, pause=0)
        self.assertEqual(done, 150)
        self.assertGreater(len(calls), 1)                                   # 여러 묶음으로 나눔
        self.assertTrue(all(len(q) <= free_translate.MAX_CHARS for q in calls))
        self.assertEqual(items[7]["title_ko"], "제목 7")
        self.assertNotIn("summary_ko", items[7])                            # 제목만

    def test_line_mismatch_falls_back_to_one_by_one(self):
        def http_get(url):
            q = self.query(url)
            if "\n" in q:
                return gtx_response("한 줄로 합쳐진 번역")                     # 줄 수가 어긋남
            return gtx_response("하나: " + q.split()[2])
        items = self.items(3)
        self.assertEqual(free_translate.translate_titles(items, http_get=http_get, log=lambda *_: None, pause=0), 3)
        self.assertEqual([it["title_ko"] for it in items], ["하나: 0", "하나: 1", "하나: 2"])

    def test_block_stops_and_leaves_english(self):
        calls = []

        def http_get(url):
            calls.append(url)
            raise free_translate.Blocked("HTTP 429")
        items = self.items(200, size=40)
        self.assertEqual(free_translate.translate_titles(items, http_get=http_get, log=lambda *_: None, pause=0), 0)
        self.assertEqual(len(calls), 1)
        self.assertFalse(any("title_ko" in it for it in items))

    def test_bad_response_skips_batch(self):
        seq = iter([b"<html>not json</html>", gtx_response("둘째")])
        items = [{"id": "a", "title": "A" * 1495, "time": 1}, {"id": "b", "title": "Second", "time": 2}]
        done = free_translate.translate_titles(items, http_get=lambda url: next(seq), log=lambda *_: None, pause=0)
        self.assertEqual(done, 1)
        self.assertNotIn("title_ko", items[0])
        self.assertEqual(items[1]["title_ko"], "둘째")

if __name__ == "__main__":
    unittest.main()
