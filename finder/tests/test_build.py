"""전 종목 탐색기 데이터 빌드 테스트 — 네트워크 없이 돈다.

  python -m unittest discover -s finder/tests
"""
import datetime as dt
import json
import math
import os
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import build  # noqa: E402
import pages  # noqa: E402
import validate  # noqa: E402


def hist(close, start=dt.date(2025, 9, 1), vol=None):
    close = np.asarray(close, dtype=float)
    dates, d = [], start
    while len(dates) < len(close):
        if d.weekday() < 5:
            dates.append(d)
        d += dt.timedelta(days=1)
    v = np.full(len(close), 1000.0) if vol is None else np.asarray(vol, dtype=float)
    return {"dates": dates, "close": close, "vol": v, "val": close * v}


class KrAdjust(unittest.TestCase):
    def test_split_is_stitched(self):
        # 50:1 액면분할 — 주가가 1/50, 주식 수가 50배
        close = np.array([100000, 101000, 2030, 2050], dtype=float)
        stocks = np.array([1e6, 1e6, 5e7, 5e7])
        adj = build.kr_adjust(close, stocks)
        self.assertAlmostEqual(adj[2] / adj[1], 1.005, places=2)
        self.assertEqual(adj[-1], 2050)

    def test_limit_moves_are_kept(self):
        # 상한가(+30%)는 시장 움직임이라 손대지 않는다
        close = np.array([1000, 1300, 1690], dtype=float)
        adj = build.kr_adjust(close, np.array([1e6] * 3))
        self.assertTrue(np.allclose(adj, close))


class Metrics(unittest.TestCase):
    def test_returns_and_ranges(self):
        c = np.linspace(100, 200, 300)
        m = build.metrics(hist(c))
        self.assertEqual(m["nd"], 300)
        self.assertAlmostEqual(m["r252"], (200 / c[-253] - 1) * 100, places=6)
        self.assertAlmostEqual(m["fh"], 0.0)
        self.assertEqual(m["up"], 1)
        self.assertGreater(m["rsi"], 90)  # 계속 오르기만 했다
        self.assertAlmostEqual(m["mdd"], 0.0)
        self.assertEqual(len(m["sp"]), 53)  # 1년 ≈ 53주

    def test_drawdown_and_rsi_bounds(self):
        c = np.concatenate([np.linspace(100, 150, 150), np.linspace(150, 75, 150)])
        m = build.metrics(hist(c))
        self.assertAlmostEqual(m["mdd"], -50.0, places=3)
        self.assertTrue(0 <= m["rsi"] <= 100)
        self.assertEqual(m["up"], 0)

    def test_golden_cross_detected(self):
        # 평탄 → 하락(50일선이 200일선 아래로: 데드) → 급반등(다시 위로: 골든)
        c = np.concatenate([np.full(220, 100.0), np.linspace(100, 80, 40), np.linspace(80, 130, 40)])
        xs = [build.metrics(hist(c[:n]))["x"] for n in range(221, len(c) + 1)]
        self.assertIn("D", xs[:30])
        self.assertIn("G", xs[-30:])

    def test_short_history(self):
        m = build.metrics(hist([10, 11, 12]))
        self.assertIsNone(m["r252"])
        self.assertNotIn("rsi", m)


class Ranks(unittest.TestCase):
    def test_pct_rank(self):
        pr = build.pct_rank([1, 2, 3, None, 4, 5, 6, 7, 8, 9, 10])
        self.assertEqual(pr[0], 0)
        self.assertEqual(pr[-1], 100)
        self.assertIsNone(pr[3])
        low = build.pct_rank(list(range(20)), higher_better=False)
        self.assertEqual(low[0], 100)


class Quote(unittest.TestCase):
    today = dt.date(2026, 9, 24)

    def test_parse(self):
        q = {"regularMarketPrice": 200.0, "trailingPE": 30.5, "forwardPE": 27.0, "priceToBook": 50.0,
             "bookValue": 4.0, "epsTrailingTwelveMonths": 6.5, "dividendRate": 1.0,
             "earningsTimestampStart": int(dt.datetime(2026, 10, 30, tzinfo=dt.timezone.utc).timestamp()),
             "averageAnalystRating": "2.1 - Buy"}
        f = build.parse_quote(q, self.today)
        self.assertEqual(f["pe"], 30.5)
        self.assertAlmostEqual(f["dy"], 0.5)
        self.assertAlmostEqual(f["roe"], 162.5)
        self.assertEqual(f["ern"], "2026-10-30")
        self.assertEqual(f["ar"], 2.1)

    def test_rejects_inconsistent_book_and_negative_pe(self):
        # ADR: 장부가가 다른 통화면 price/bookValue 가 PBR 과 안 맞는다 → ROE 버림
        q = {"regularMarketPrice": 200.0, "trailingPE": -3, "priceToBook": 8.0, "bookValue": 700.0,
             "epsTrailingTwelveMonths": 9.0, "earningsTimestamp": 1000}
        f = build.parse_quote(q, self.today)
        self.assertIsNone(f["pe"])
        self.assertNotIn("roe", f)
        self.assertIsNone(f["ern"])  # 지난 날짜

    def test_yahoo_symbol(self):
        self.assertEqual(build.yahoo_symbol({"g": "US", "id": "BRK.B", "m": "NYSE"}), "BRK-B")
        self.assertEqual(build.yahoo_symbol({"g": "KR", "id": "005930", "m": "KOSPI"}), "005930.KS")
        self.assertEqual(build.yahoo_symbol({"g": "KR", "id": "035720", "m": "KOSDAQ"}), "035720.KQ")
        self.assertIsNone(build.yahoo_symbol({"g": "KR", "id": "999999", "m": "KONEX"}))


class Rows(unittest.TestCase):
    def test_roundtrip_units(self):
        r = {"g": "KR", "id": "005930", "m": "KOSPI", "n": "삼성전자", "p": 276500.0, "d1": 0.9,
             "mc": 1.6e15, "tv": 4.3e12, "_fx": 1400.0, "pe": 12.34, "pb": 1.234, "dy": 1.5, "eps": 1234.5}
        row = build.to_row(r)
        out = dict(zip(build.COLS, row))
        self.assertEqual(out["mc"], 1_600_000_000)
        self.assertEqual(out["mcu"], round(1.6e15 / 1e6 / 1400))
        self.assertEqual(out["tv"], 4_300_000)
        self.assertEqual(out["pb"], 1.23)
        self.assertEqual(out["eps"], 1234)
        back = build.from_prev(out)
        self.assertAlmostEqual(back["mc"], 1.6e15)

    def test_name_cleanup(self):
        self.assertEqual(build.NAME_TAIL.sub("", "Apple Inc. Common Stock").strip(" ,"), "Apple Inc.")
        self.assertEqual(build.NAME_TAIL.sub("", "Alphabet Inc. Class C Capital Stock").strip(" ,"), "Alphabet Inc. Class C")

    def test_alias_file(self):
        with open(os.path.join(os.path.dirname(HERE), "ko_alias.json"), encoding="utf-8") as f:
            a = json.load(f)
        self.assertGreater(len(a), 200)
        for k, v in a.items():
            self.assertRegex(k, r"^[A-Z][A-Z.]*$")
            self.assertTrue(v.strip())


class Pages(unittest.TestCase):
    def test_page_has_no_daily_numbers(self):
        r = {"id": "AAPL", "m": "NASDAQ", "n": "Apple Inc.", "ko": "애플", "sec": "기술", "ind": "Computer", "p": 337.0}
        h = pages.page_html(r)
        self.assertIn("<title>애플 (AAPL)", h)
        self.assertIn('data-id="AAPL"', h)
        self.assertIn("/finder/s/AAPL/", h)
        self.assertNotIn("337", h)  # 가격이 들어가면 매일 파일이 바뀐다

    def test_escaping(self):
        r = {"id": "X", "m": "NYSE", "n": 'A&B "<Co>"', "ko": "", "sec": "", "ind": ""}
        h = pages.page_html(r)
        self.assertNotIn("<Co>", h)


class Validate(unittest.TestCase):
    def test_catches_bad_file(self):
        cols = build.COLS
        good = [None] * len(cols)
        good[cols.index("id")], good[cols.index("m")], good[cols.index("n")], good[cols.index("p")] = "A", "NYSE", "A", 1.0
        bad = list(good); bad[cols.index("id")] = "B"; bad[cols.index("rsi")] = 140
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"meta": {"cols": cols, "usAsof": "2026-09-23", "krAsof": "2026-09-22"}, "rows": [good, bad]}, f)
        errors, warns = validate.check(f.name, min_rows=1, today=dt.date(2026, 9, 24))
        os.unlink(f.name)
        self.assertTrue(any("RSI" in e for e in errors))
        self.assertTrue(any("KR" in e for e in errors))  # 한국 종목이 없음

    def test_real_file_passes(self):
        path = os.path.join(os.path.dirname(HERE), "data", "stocks.json")
        if not os.path.exists(path):
            self.skipTest("data/stocks.json 없음")
        with open(path, encoding="utf-8") as f:
            cols = json.load(f)["meta"]["cols"]
        if "pe" not in cols:
            self.skipTest("아직 재무 열이 없는 옛 파일")
        errors, _ = validate.check(path, stale_days=10_000)
        self.assertEqual(errors, [])


class Sources(unittest.TestCase):
    today = dt.date(2026, 9, 24)

    def test_sec_totals_not_per_share(self):
        frames = {
            "NetIncomeLoss": [{"cik": 1, "end": "2025-12-31", "val": 100e9}, {"cik": 2, "end": "2025-12-31", "val": -5e9}],
            "StockholdersEquity": [{"cik": 1, "end": "2026-06-30", "val": 400e9}, {"cik": 2, "end": "2026-06-30", "val": 50e9}],
            "PaymentsOfDividendsCommonStock": [{"cik": 1, "end": "2025-12-31", "val": -30e9}],
        }

        def fake(url):
            if url.endswith("company_tickers.json"):
                return {"0": {"cik_str": 1, "ticker": "AAA"}, "1": {"cik_str": 2, "ticker": "BRK-B"}}
            tag = url.split("/us-gaap/")[1].split("/")[0]
            if "CY2025" in url or "Q2I" in url:
                return {"data": frames.get(tag, [])}
            raise Exception("HTTP Error 404")

        orig = build.sec_json
        build.sec_json = fake
        os.environ["SEC_CONTACT"] = "test@example.com"
        try:
            rows = [{"g": "US", "id": "AAA", "mc": 3000e9, "p": 300.0}, {"g": "US", "id": "BRK.B", "mc": 500e9, "p": 10.0},
                    {"g": "KR", "id": "005930", "mc": 1e15}]
            out = build.sec_fund(rows, self.today)
        finally:
            build.sec_json = orig
            del os.environ["SEC_CONTACT"]
        a = out["AAA"]
        self.assertAlmostEqual(a["pe"], 30.0)
        self.assertAlmostEqual(a["pb"], 7.5)
        self.assertAlmostEqual(a["roe"], 25.0)
        self.assertAlmostEqual(a["dy"], 1.0)
        self.assertAlmostEqual(a["eps"], 10.0)
        self.assertEqual(a["fs"], "S")
        b = out["BRK.B"]  # 적자: PER 없음, EPS 음수, 배당 기록 없음 → 0
        self.assertIsNone(b["pe"])
        self.assertLess(b["eps"], 0)
        self.assertEqual(b["dy"], 0.0)
        self.assertNotIn("005930", out)

    def test_sec_skips_without_contact(self):
        os.environ.pop("SEC_CONTACT", None); os.environ.pop("SEC_USER_AGENT", None)
        self.assertEqual(build.sec_fund([{"g": "US", "id": "A", "mc": 1e9}], self.today), {})

    def test_naver_parse(self):
        j = {"totalInfos": [{"code": "per", "key": "PER", "value": "13.21배"}, {"code": "eps", "key": "EPS", "value": "4,950원"},
                            {"code": "cnsPer", "key": "추정PER", "value": "9.80배"}, {"code": "pbr", "key": "PBR", "value": "1.52배"},
                            {"code": "bps", "key": "BPS", "value": "57,951원"}, {"code": "dividendYieldRatio", "key": "배당수익률", "value": "1.51%"},
                            {"code": "marketValue", "key": "시총", "value": "1,616조"}]}
        f = build.parse_naver(j)
        self.assertEqual(f["pe"], 13.21)
        self.assertEqual(f["fpe"], 9.8)
        self.assertEqual(f["pb"], 1.52)
        self.assertEqual(f["dy"], 1.51)
        self.assertAlmostEqual(f["roe"], 4950 / 57951 * 100)
        self.assertIsNone(build.parse_naver({"totalInfos": [{"code": "per", "value": "N/A"}]})["pe"])

    def test_naver_us_probe_and_fill(self):
        calls = []

        def fake(url):
            calls.append(url)
            if "/basic" in url and (url.split("/stock/")[1].split("/")[0] in ("AAA.O", "BBB")):
                return {"stockItemTotalInfos": [{"code": "per", "key": "PER", "value": "20.5배"}]}
            raise Exception("404")

        orig = build._naver_get
        build._naver_get = fake
        try:
            rows = [{"g": "US", "id": "AAA", "m": "NASDAQ", "mcu": 100}, {"g": "US", "id": "BBB", "m": "NYSE", "mcu": 90},
                    {"g": "US", "id": "CCC", "m": "AMEX", "mcu": 1}]
            out = build.naver_us_fund(rows, workers=1)
        finally:
            build._naver_get = orig
        self.assertEqual(out["AAA"]["pe"], 20.5)
        self.assertEqual(out["BBB"]["fs"], "N")
        self.assertNotIn("CCC", out)  # 형식을 못 찾은 거래소는 건너뛴다

    def test_krx_parse(self):
        import io
        payload = {"output": [{"ISU_SRT_CD": "005930", "EPS": "6,564", "PER": "42.12", "BPS": "57,951", "PBR": "4.77",
                               "DPS": "1,446", "DVD_YLD": "0.52"}]
                   + [{"ISU_SRT_CD": f"{i:06d}", "EPS": "-", "PER": "-", "BPS": "1,000", "PBR": "0.5", "DVD_YLD": "0.00"}
                      for i in range(1, 600)]}

        class Resp(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *a): return False

        class Opener:
            def open(self, req, timeout=0):
                return Resp(json.dumps(payload).encode() if req.data else b"<html>")

        orig = build.urllib.request.build_opener
        build.urllib.request.build_opener = lambda *a: Opener()
        try:
            out = build.krx_fund(dt.date(2026, 9, 22))
        finally:
            build.urllib.request.build_opener = orig
        s = out["005930"]
        self.assertEqual(s["pe"], 42.12)
        self.assertEqual(s["eps"], 6564)
        self.assertAlmostEqual(s["roe"], 6564 / 57951 * 100)
        self.assertEqual(s["fs"], "K")
        self.assertIsNone(out["000001"]["pe"])
        self.assertEqual(out["000001"]["dy"], 0.0)

    def test_merge_prefers_exchange_for_korea(self):
        orig = (build.yahoo_fund, build.sec_fund, build.krx_fund)
        build.yahoo_fund = lambda rows, today: {"005930": {"pe": 99.0, "ern": "2026-10-30", "ar": 1.8, "fs": "Y"},
                                               "AAPL": {"pe": 35.0, "ern": "2026-10-29", "fs": "Y"}}
        build.sec_fund = lambda rows, today: {"AAPL": {"pe": 33.0, "pb": 50.0, "fs": "S"}}
        build.krx_fund = lambda asof: {"005930": {"pe": 42.0, "fs": "K"}}
        naver = build.naver_fund
        build.naver_fund = lambda rows: self.fail("KRX 가 되면 네이버는 부르지 않는다")
        try:
            out, n = build.fundamentals([], self.today, dt.date(2026, 9, 22))
        finally:
            build.yahoo_fund, build.sec_fund, build.krx_fund = orig
            build.naver_fund = naver
        self.assertEqual(out["005930"]["pe"], 42.0)       # 거래소 값
        self.assertEqual(out["005930"]["ern"], "2026-10-30")  # 실적일은 Yahoo
        self.assertEqual(out["AAPL"]["pe"], 35.0)          # 미국은 Yahoo(최근 4분기) 우선
        self.assertEqual(out["AAPL"]["pb"], 50.0)          # 빈 값은 SEC 로 채움
        self.assertEqual(n, {"Y": 2, "S": 1, "K": 1, "N": 0})


if __name__ == "__main__":
    unittest.main()
