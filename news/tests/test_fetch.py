"""fetch_news.py 단위 테스트 — 네트워크 없이 tests/fixtures 의 피드로 돌린다.

  python -m unittest discover -s news/tests -v
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures")
sys.path.insert(0, os.path.dirname(HERE))

import fetch_news as fn  # noqa: E402

NOW = "2026-10-06T12:00:00+09:00"


def read(name):
    with open(os.path.join(FIX, name), "rb") as f:
        return fn.decode_feed(f.read())


class ParseTest(unittest.TestCase):
    def test_rss_fields(self):
        es = fn.parse_feed(read("rss_yna.xml"))
        self.assertEqual(len(es), 4)
        self.assertEqual(es[0]["title"], "[속보] 한은, 기준금리 연 2.50%로 동결")
        self.assertEqual(es[0]["image"], "http://img.example.co.kr/a.jpg")
        self.assertIn("동결했다", es[0]["desc"])

    def test_atom_links_and_dates(self):
        es = fn.parse_feed(read("atom_hk.xml"))
        self.assertEqual([e["link"] for e in es],
                         ["https://news.example.com/article/1001", "https://news.example.com/article/1002"])
        self.assertEqual(es[0]["image"], "https://img.example.com/t.jpg")
        self.assertEqual(es[1]["date"], "2026-10-06T00:30:00Z")   # updated 로 대신

    def test_euc_kr(self):
        es = fn.parse_feed(read("rss_euckr.xml"))
        self.assertEqual(es[0]["title"], "반도체 수출 석 달 연속 증가")

    def test_broken_xml_is_repaired(self):
        es = fn.parse_feed(read("rss_broken.xml"))
        self.assertEqual(len(es), 1)
        self.assertIn("SK하이닉스", es[0]["title"])
        self.assertEqual(es[0]["link"], "https://broken.example.com/1?a=1&b=2")

    def test_regex_fallback(self):
        es = fn.parse_feed("<rss><item><title>깨진 <b>피드</title><link>https://z.example/1</link></item>")
        self.assertEqual(es[0]["link"], "https://z.example/1")


class HelperTest(unittest.TestCase):
    def test_dates(self):
        kst = fn.KST
        self.assertEqual(fn.parse_date("Tue, 06 Oct 2026 10:05:00 +0900"), datetime(2026, 10, 6, 10, 5, tzinfo=kst))
        self.assertEqual(fn.parse_date("2026-10-06T01:20:00Z").astimezone(kst).hour, 10)
        self.assertEqual(fn.parse_date("2026.10.06 09:30"), datetime(2026, 10, 6, 9, 30, tzinfo=kst))
        self.assertEqual(fn.parse_date("2026-10-06 09:30:00+0900").hour, 9)
        self.assertIsNone(fn.parse_date("어제"))

    def test_classify(self):
        self.assertEqual(fn.classify("한은, 기준금리 동결", ""), "macro")
        self.assertEqual(fn.classify("비트코인 급등에 코인 시장 들썩", ""), "crypto")
        self.assertEqual(fn.classify("서울 아파트 전셋값 상승", ""), "estate")
        self.assertEqual(fn.classify("코스피 2,900선 회복", ""), "market")
        self.assertEqual(fn.classify("오늘의 날씨", "", "industry"), "industry")
        self.assertEqual(fn.classify("오늘의 날씨", "", "엉뚱한값"), "general")

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
        s = "가" * 200
        self.assertTrue(fn.shorten(s).endswith("…"))
        self.assertLessEqual(len(fn.shorten(s)), fn.SUMMARY_LEN + 1)
        self.assertEqual(fn.shorten("짧다"), "짧다")

    BACKGROUND = """코스피, 외국인 매도에 2,850선 후퇴|코스닥 바이오주 강세에 870선 회복|뉴욕증시, 기술주 반등에 나스닥 1% 상승
한은 총재 "물가 안정세 확인되면 금리 인하 검토"|9월 소비자물가 2.1% 상승…석 달 만에 2%대|수출 9월 600억달러 돌파…반도체 역대 최대
서울 아파트값 30주 연속 상승…상승폭은 둔화|LH, 3기 신도시 본청약 일정 공개|삼성전자, 3분기 잠정실적 발표 앞두고 주가 약세
현대차, 미국 조지아 공장 가동률 90% 돌파|LG에너지솔루션, GM과 배터리 합작 확대|비트코인 1억5천만원대 횡보…ETF 자금 유입
업비트, 신규 상장 심사 강화|금융위, 가계대출 관리 강화 방안 발표|국제유가, 중동 긴장에 3% 급등|엔화 약세 지속…엔·달러 150엔 돌파
트럼프, 유럽산 자동차 관세 25% 예고|중국 9월 제조업 PMI 49.8…6개월 연속 위축|SK하이닉스, HBM4 양산 시작|네이버, AI 검색 서비스 출시
카카오뱅크 주담대 금리 인상|공모주 청약에 증거금 10조 몰려|국민연금, 국내 주식 비중 확대|조선 3사 수주 목표 조기 달성
포스코, 철강 감산 검토|대한항공, 아시아나 통합 마무리|쿠팡, 3분기 매출 10조 돌파|전세사기 피해자 지원 특별법 개정안 통과"""

    PAIRS = [
        ("[속보] 한은, 기준금리 연 2.50%로 동결", "한국은행 기준금리 2.50% 동결…환율 부담 고려", True),
        ("트럼프, 중국산 반도체에 100% 관세 부과", "트럼프 \"중국 반도체 관세 100%\"…업계 긴장", True),
        ("원·달러 환율 1,400원 돌파", "환율 1400원 넘어…원화 약세 지속", True),
        ("삼성전자 3분기 영업익 12조…시장 예상 웃돌아", "삼성전자, 3분기 영업이익 12조원 \"어닝 서프라이즈\"", True),
        ("정부, 수도권 공공택지 5만가구 공급 발표", "수도권에 5만가구 공급…정부 주택공급 대책", True),
        ("코스피 2,900선 회복", "코스닥 900선 회복", False),
        ("서울 아파트 전셋값 23주 연속 상승", "서울 아파트 매매가 3주 연속 상승", False),
        ("삼성전자 3분기 영업이익 10조 돌파", "SK하이닉스 3분기 영업이익 7조 돌파", False),
        ("네이버, AI 검색 서비스 출시", "카카오, AI 비서 서비스 출시", False),
    ]

    def test_cluster_pairs(self):
        bg = [{"id": "bg%d" % i, "title": t, "time": i} for i, t in enumerate(self.BACKGROUND.replace("\n", "|").split("|"))]
        for a, b, same in self.PAIRS:
            items = bg + [{"id": "a", "title": a, "time": 100}, {"id": "b", "title": b, "time": 200}]
            fn.cluster(items)
            got = items[-2]["cluster"] == items[-1]["cluster"]
            self.assertEqual(got, same, f"{a} | {b}")
            if same:
                self.assertEqual(items[-1]["cluster"], "a")   # 먼저 나온 기사가 대표

    def test_numbers(self):
        self.assertEqual(fn.numbers("코스피 2,900선 회복…외국인 5천억 순매수"), {"2900선", "5천"})
        self.assertEqual(fn.numbers("기준금리 연 2.50%로 동결"), {"2.50%"})

    def test_keywords_count_stories_not_articles(self):
        now = datetime(2026, 10, 6, 12, tzinfo=fn.KST)
        t = int(now.timestamp())
        items = [
            {"id": "1", "cluster": "x", "title": "반도체 수출 증가", "time": t},
            {"id": "2", "cluster": "x", "title": "반도체 수출이 늘었다", "time": t},
            {"id": "3", "cluster": "y", "title": "반도체 업황 회복", "time": t},
            {"id": "4", "cluster": "z", "title": "금리 동결", "time": t - 3 * 86400},
        ]
        kw = dict((w, c) for w, c in fn.keywords(items, now))
        self.assertEqual(kw.get("반도체"), 2)
        self.assertNotIn("금리", kw)

    def test_market_from_chart(self):
        day = 86400
        res = {
            "meta": {"regularMarketPrice": 110.0, "regularMarketTime": 3 * day + 3600, "gmtoffset": 0},
            "timestamp": [1 * day, 2 * day, 3 * day],
            "indicators": {"quote": [{"close": [90.0, 100.0, None]}]},
        }
        row = fn.market_from_chart({"symbol": "X", "name": "엑스"}, res)
        # 오늘 봉의 종가가 아직 없으면 마지막 종가가 전일 종가
        self.assertEqual(row["change"], 10.0)
        self.assertEqual(row["pct"], 10.0)
        res["indicators"]["quote"][0]["close"] = [90.0, 100.0, 108.0]
        row = fn.market_from_chart({"symbol": "X", "name": "엑스"}, res)
        self.assertEqual(row["change"], 10.0)


class RunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = os.path.join(self.tmp, "feeds.json")
        feeds = [
            {"source": "시험경제", "hint": "general", "url": "u1", "file": "rss_yna.xml"},
            {"source": "아톰일보", "hint": "general", "url": "u2", "file": "atom_hk.xml"},
            {"source": "옛인코딩", "hint": "industry", "url": "u3", "file": "rss_euckr.xml"},
            {"source": "깨진신문", "hint": "general", "url": "u4", "file": "rss_broken.xml"},
            {"source": "모음", "hint": "general", "url": "u5", "file": "gnews.xml", "aggregator": True},
            {"source": "없는피드", "hint": "general", "url": "u6", "file": "missing.xml"},
        ]
        with open(self.cfg, "w", encoding="utf-8") as f:
            json.dump({"feeds": feeds}, f, ensure_ascii=False)
        self.out = os.path.join(self.tmp, "data")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_once(self, now=NOW):
        return fn.main(["--config", self.cfg, "--out", self.out, "--offline-dir", FIX, "--no-markets", "--now", now])

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
        # 최신순
        self.assertEqual([it["time"] for it in today], sorted((it["time"] for it in today), reverse=True))
        # 링크 없는 기사, 매체 없는 모음 기사, 직접 피드와 겹치는 모음 기사는 버린다
        self.assertNotIn("제목만 있고 링크가 없는 기사", titles)
        self.assertNotIn("매체 이름이 없는 기사", titles)
        self.assertEqual(titles.count("코스피, 외국인 순매수에 2,900선 회복"), 1)
        china = next(it for it in today if it["title"].startswith("미국 관세"))
        self.assertEqual((china["source"], china["via"], china["cat"]), ("다른일보", "모음", "global"))
        # 같은 사건(금리 동결)은 매체가 달라도 한 묶음
        rate = [it for it in today if "동결" in it["title"]]
        self.assertEqual(len({it["source"] for it in rate}), 2)
        self.assertEqual(len({it["cluster"] for it in rate}), 1)
        self.assertTrue(all(it["url"].startswith("https://") for it in today))
        yest = self.load("days", "2026-10-05.json")["items"]
        self.assertEqual(yest[0]["cat"], "estate")
        self.assertNotIn("&nbsp;", yest[0]["summary"])

    def test_second_run_is_idempotent(self):
        self.run_once()
        before = {n: os.path.getmtime(os.path.join(self.out, "days", n)) for n in os.listdir(os.path.join(self.out, "days"))}
        idx_before = self.load("index.json")
        self.run_once("2026-10-06T13:00:00+09:00")
        after = {n: os.path.getmtime(os.path.join(self.out, "days", n)) for n in os.listdir(os.path.join(self.out, "days"))}
        self.assertEqual(before, after)
        self.assertEqual(idx_before, self.load("index.json"))

    def test_old_days_are_pruned(self):
        os.makedirs(os.path.join(self.out, "days"))
        with open(os.path.join(self.out, "days", "2026-08-01.json"), "w") as f:
            json.dump({"date": "2026-08-01", "items": []}, f)
        self.run_once()
        self.assertFalse(os.path.exists(os.path.join(self.out, "days", "2026-08-01.json")))

    def test_all_feeds_failing_returns_error(self):
        self.assertEqual(fn.main(["--config", self.cfg, "--out", self.out, "--offline-dir", self.tmp,
                                  "--no-markets", "--now", NOW]), 1)


if __name__ == "__main__":
    unittest.main()
