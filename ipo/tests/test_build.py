"""공모주 캘린더 데이터 빌드 테스트 — 네트워크 없이 돈다.

  python -m unittest discover -s ipo/tests

HTML 조각은 38커뮤니케이션 표 모양(표 안의 표, EUC-KR, 링크 달린 종목명)을 흉내 낸 것이다.
"""
import datetime as dt
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import build  # noqa: E402
import validate  # noqa: E402

TODAY = dt.date(2026, 9, 24)


def page(inner: str) -> str:
    # 바깥 레이아웃 표 안에 데이터 표를 넣는다 — 38 처럼
    return f"""<html><head><meta http-equiv="Content-Type" content="text/html; charset=euc-kr"></head><body>
    <table><tr><td>메뉴</td><td><table><tr><td>광고</td></tr></table></td></tr>
    <tr><td colspan=2>{inner}</td></tr></table></body></html>"""


SCHEDULE = page("""
<table summary="공모주 청약일정">
<tr><td>종목명</td><td>공모주일정</td><td>확정공모가</td><td>희망공모가</td><td>청약경쟁률</td><td>주간사</td><td>분석</td></tr>
<tr><td><a href="/html/fund/?o=v&no=2201&l=&page=1">가나바이오</a></td><td>2026.09.24~09.25</td><td>-</td>
    <td>18,000~21,000</td><td></td><td>NH투자증권,삼성증권</td><td><a href="#">분석</a></td></tr>
<tr><td><a href="/html/fund/?o=v&no=2199&l=&page=1">다라테크(코스닥)</a></td><td>2026.09.17~09.18</td><td>15,000</td>
    <td>12,000~14,000</td><td>1,234.56:1</td><td>한국투자증권</td><td></td></tr>
<tr><td><a href="/html/fund/?o=v&no=2190&l=&page=1">마바스팩7호</a></td><td>2026.12.30~01.02</td><td>2,000</td>
    <td>2,000</td><td></td><td>KB증권</td><td></td></tr>
<tr><td colspan=7>[1] [2] [3]</td></tr>
</table>""")

FORECAST = page("""
<table>
<tr><th>기업명</th><th>예측일</th><th>공모희망가(원)</th><th>공모가(원)</th><th>공모금액(백만원)</th><th>기관경쟁률</th><th>의무보유확약</th><th>주간사</th></tr>
<tr><td><a href="/html/fund/?o=v&no=2199&l=&page=1">다라테크</a></td><td>2026.09.10~09.16</td><td>12,000~14,000</td>
    <td>15,000</td><td>18,000</td><td>1,021.4:1</td><td>35.52%</td><td>한국투자</td></tr>
</table>""")

LISTING = page("""
<table>
<tr><td>기업명</td><td>신규상장일</td><td>현재가(원)</td><td>전일비(%)</td><td>공모가(원)</td><td>공모가대비등락률(%)</td>
    <td>시초가(원)</td><td>시초/공모(%)</td><td>첫날종가(원)</td></tr>
<tr><td><a href="/html/forum/board/?code=123450">사아로보틱스</a></td><td>2026/09/22</td><td>31,500</td><td>+3.1%</td>
    <td>20,000</td><td>57.5%</td><td>40,000</td><td>100%</td><td>33,200</td></tr>
</table>""")

DETAIL = page("""
<table>
<tr><td>종목명</td><td>가나바이오</td><td>진행상황</td><td>공모청약</td></tr>
<tr><td>시장구분</td><td>코스닥</td><td>종목코드</td><td>456780</td></tr>
<tr><td>업종</td><td>의약품 제조업</td><td>대표자</td><td>홍길동</td></tr>
<tr><td>총공모주식수</td><td>1,500,000 주</td><td>액면가</td><td>500 원</td></tr>
<tr><td>환불일</td><td>2026.09.30</td><td>상장일</td><td>2026.10.06</td></tr>
<tr><td>수요예측일</td><td>2026.09.15 ~ 2026.09.19</td><td>기관경쟁률</td><td>1,234.50:1</td></tr>
<tr><td>의무보유확약</td><td>32.10%</td><td>확정공모가</td><td>23,000 원</td></tr>
<tr><td>희망공모가액</td><td>18,000 ~ 21,000 원</td><td>공모금액</td><td>345억원</td></tr>
<tr><td>상장공모</td><td colspan=3>신주모집 : 1,200,000 주 (80%)<br>구주매출 : 300,000 주 (20%)</td></tr>
<tr><td>상장후주식수</td><td>6,000,000 주</td><td>유통가능물량</td><td>1,650,000주 (27.5%)</td></tr>
<tr><td>주간사</td><td colspan=3>NH투자증권 : 1,050,000 주<br>삼성증권 : 450,000 주</td></tr>
</table>""")


class Values(unittest.TestCase):
    def test_ratio(self):
        self.assertEqual(build.ratio("1,234.56:1"), 1234.56)
        self.assertEqual(build.ratio("987.1 대 1"), 987.1)
        self.assertIsNone(build.ratio("-"))
        self.assertIsNone(build.ratio(""))

    def test_band(self):
        self.assertEqual(build.band("18,000~21,000"), (18000, 21000))
        self.assertEqual(build.band("2,000"), (2000, 2000))
        self.assertEqual(build.band("-"), (None, None))

    def test_dates(self):
        self.assertEqual(build.date_range("2026.09.24~09.25", TODAY), ("2026-09-24", "2026-09-25"))
        # 해를 넘기는 청약
        self.assertEqual(build.date_range("2026.12.30~01.02", TODAY), ("2026-12-30", "2027-01-02"))
        self.assertEqual(build.date_range("2026.12.30 ~ 2027.01.02", TODAY), ("2026-12-30", "2027-01-02"))
        self.assertEqual(build.one_date("2026/09/22", TODAY), "2026-09-22")
        self.assertEqual(build.date_range("미정", TODAY), (None, None))

    def test_names(self):
        self.assertEqual(build.clean_name("다라테크(코스닥)"), "다라테크")
        self.assertEqual(build.norm_name("다라 테크(코스닥)"), build.norm_name("다라테크"))
        self.assertEqual(build.underwriters("NH투자증권,삼성증권"), ["NH투자증권", "삼성증권"])

    def test_decode_euc_kr(self):
        raw = '<meta charset="euc-kr"><td>똠방각하</td>'.encode("cp949")
        self.assertIn("똠방각하", build.decode(raw))


class Tables(unittest.TestCase):
    def test_schedule(self):
        rows = build.parse_schedule(SCHEDULE, TODAY)
        self.assertEqual([r["name"] for r in rows], ["가나바이오", "다라테크", "마바스팩7호"])
        a, b, c = rows
        self.assertEqual(a["no"], "2201")
        self.assertEqual((a["sub_start"], a["sub_end"]), ("2026-09-24", "2026-09-25"))
        self.assertEqual((a["band_lo"], a["band_hi"], a["price"]), (18000, 21000, None))
        self.assertEqual(a["uw"], ["NH투자증권", "삼성증권"])
        self.assertEqual((b["price"], b["sub_comp"]), (15000, 1234.56))
        self.assertEqual(c["sub_end"], "2027-01-02")

    def test_forecast(self):
        (r,) = build.parse_forecast(FORECAST, TODAY)
        self.assertEqual((r["fc_start"], r["fc_end"]), ("2026-09-10", "2026-09-16"))
        self.assertEqual((r["price"], r["amount"], r["inst_comp"], r["lockup"]), (15000, 180.0, 1021.4, 35.52))

    def test_listing_price_is_not_the_return_column(self):
        (r,) = build.parse_listing(LISTING, TODAY)
        self.assertEqual(r["list_date"], "2026-09-22")
        self.assertEqual((r["price"], r["open"], r["close1"], r["cur"]), (20000, 40000, 33200, 31500))

    def test_detail(self):
        d = build.parse_detail(DETAIL, TODAY)
        self.assertEqual(d, {"market": "KOSDAQ", "code": "456780", "sector": "의약품 제조업", "shares": 1500000,
                             "refund": "2026-09-30", "list": "2026-10-06", "post_shares": 6000000,
                             "fc_start": "2026-09-15", "fc_end": "2026-09-19", "inst_comp": 1234.5, "lockup": 32.1,
                             "price": 23000, "band_lo": 18000, "band_hi": 21000, "amount": 345.0,
                             "old_shares": 300000, "float_pct": 27.5,
                             "uw_alloc": [["NH투자증권", 1050000], ["삼성증권", 450000]]})

    def test_detail_drops_nonsense(self):
        # 배정 합이 총공모주식수보다 훨씬 크면(다른 표의 숫자) 버린다
        t = page("<table><tr><td>총공모주식수</td><td>100,000 주</td></tr>"
                 "<tr><td>기타</td><td>KB증권 : 9,000,000 주 유통가능 물량 250%</td></tr></table>")
        d = build.parse_detail(t, TODAY)
        self.assertNotIn("uw_alloc", d)
        self.assertNotIn("float_pct", d)

    def test_header_needs_most_columns(self):
        # '종목명' 한 칸만 있는 레이아웃 행은 머리글이 아니다
        rows = build.html_rows("<table><tr><td>종목명</td><td>가나</td></tr></table>")
        self.assertIsNone(build.header_map(rows[0], build.SCHEDULE_COLS))


class DetailFill(unittest.TestCase):
    def test_amount_units(self):
        self.assertEqual(build.eok_of("345억원"), 345.0)
        self.assertEqual(build.eok_of("34,500 (백만원)"), 345.0)
        self.assertEqual(build.eok_of("34,500,000,000 원"), 345.0)
        self.assertIsNone(build.eok_of("-"))

    def test_detail_only_fills_blanks(self):
        # 수요예측 표의 기관경쟁률이 있으면 상세 값으로 덮지 않는다. 없던 수요예측일은 채운다
        prev = [{"id": "2201", "no": "2201", "name": "가나바이오", "inst_comp": 999.0, "sub_start": "2026-09-24"}]
        items = build.merge(prev, [], [], [], {"2201": build.parse_detail(DETAIL, TODAY)}, TODAY)
        g = items[0]
        self.assertEqual(g["inst_comp"], 999.0)
        self.assertEqual((g["fc_start"], g["fc_end"], g["lockup"]), ("2026-09-15", "2026-09-19", 32.1))

    def test_placeholders_before_forecast_ends_are_ignored(self):
        t = page("""<table><tr><td>수요예측일</td><td>2026.09.23 ~ 2026.10.01</td></tr>
          <tr><td>기관경쟁률</td><td>0:1</td></tr><tr><td>의무보유확약</td><td>0.00%</td></tr></table>""")
        d = build.parse_detail(t, TODAY)
        self.assertEqual(d["fc_end"], "2026-10-01")
        self.assertNotIn("lockup", d)
        self.assertNotIn("inst_comp", d)
        # 이미 저장된 자리 표시도 지운다
        items = build.merge([{"id": "1", "no": "1", "name": "가", "lockup": 0.0, "sub_start": "2026-10-07"}], [], [], [], {}, TODAY)
        self.assertNotIn("lockup", items[0])

    def test_need_detail_waits_for_forecast_result(self):
        # 수요예측이 끝났는데 결과가 없으면 다시 읽는다
        full = {"market": "KOSDAQ", "list_date": "x", "refund": "y", "float_pct": 20.0, "fc_start": "2026-09-20", "fc_end": "2026-09-21"}
        it = {"no": "9", "sub_end": "2026-09-30", "fc_end": "2026-09-21"}
        self.assertEqual(build.need_detail(it, TODAY, {"9": full}), 1)
        self.assertEqual(build.need_detail(it, TODAY, {"9": {**full, "inst_comp": 800.0}}), 0)


class ReviewFixes(unittest.TestCase):
    """데이터 검토에서 나온 문제들 — 고친 뒤 다시 생기지 않게"""

    def test_name_variants_match(self):
        for v in ("(주)가나", "㈜가나", "가나(코스닥)", "가나（코스닥）", "가나[코스닥]", "주식회사 가나"):
            self.assertEqual(build.norm_name(v), build.norm_name("가나"), v)

    def test_day_only_range_end(self):
        self.assertEqual(build.date_range("2026.09.24~25", TODAY), ("2026-09-24", "2026-09-25"))

    def test_kospi_written_as_exchange(self):
        t = page("<table><tr><td>시장구분</td><td>거래소</td></tr><tr><td>업종</td><td>2025-08-07</td></tr></table>")
        d = build.parse_detail(t, TODAY)
        self.assertEqual(d.get("market"), "KOSPI")
        self.assertNotIn("sector", d)  # 날짜는 업종이 아니다

    def test_zero_ratio_after_forecast_is_placeholder(self):
        t = page("""<table><tr><td>수요예측일</td><td>2026.09.10 ~ 2026.09.11</td></tr>
          <tr><td>기관경쟁률</td><td>0:1</td></tr><tr><td>의무보유확약</td><td>0.00%</td></tr></table>""")
        d = build.parse_detail(t, TODAY)
        self.assertNotIn("inst_comp", d)
        self.assertNotIn("lockup", d)
        items = build.merge([{"id": "1", "no": "1", "name": "가", "inst_comp": 0.0, "sub_start": "2026-09-20"}], [], [], [], {}, TODAY)
        self.assertNotIn("inst_comp", items[0])

    def test_future_list_date_can_change(self):
        prev = [{"id": "7", "no": "7", "name": "가", "sub_start": "2026-09-24", "list_date": "2026-09-30"}]
        t = page("<table><tr><td>상장일</td><td>2026.10.07</td></tr></table>")
        items = build.merge(prev, [], [], [], {"7": build.parse_detail(t, TODAY)}, TODAY)
        self.assertEqual(items[0]["list_date"], "2026-10-07")
        # 이미 상장한 날짜는 지킨다
        prev[0]["list_date"] = "2026-09-20"
        items = build.merge(prev, [], [], [], {"7": build.parse_detail(t, TODAY)}, TODAY)
        self.assertEqual(items[0]["list_date"], "2026-09-20")

    def test_refiled_company_does_not_inherit_old_numbers(self):
        prev = [{"id": "100", "no": "100", "name": "가나", "sub_start": "2025-11-01", "sub_end": "2025-11-02",
                 "inst_comp": 50.0, "refund": "2025-11-04"}]
        new = [{"name": "가나", "no": "200", "sub_start": "2026-10-01", "sub_end": "2026-10-02"}]
        items = build.merge(prev, new, [], [], {}, TODAY)
        by = {i["id"]: i for i in items}
        self.assertEqual(set(by), {"100", "200"})
        self.assertNotIn("inst_comp", by["200"])
        self.assertNotIn("refund", by["200"])

    def test_amount_follows_final_price_and_no_prices_before_listing(self):
        prev = [{"id": "3", "no": "3", "name": "다", "price": 20000, "shares": 1_000_000, "amount": 150.0,
                 "sub_start": "2026-09-20", "list_date": "2026-09-30", "cur": 23000}]
        it = build.merge(prev, [], [], [], {}, TODAY)[0]
        self.assertEqual(it["amount"], 200.0)
        self.assertNotIn("cur", it)

    def test_forecast_table_keeps_range_start(self):
        prev = [{"id": "4", "no": "4", "name": "라", "fc_start": "2026-09-10", "fc_end": "2026-09-16", "sub_start": "2026-09-22"}]
        fc = [{"name": "라", "no": "4", "fc_start": "2026-09-16", "fc_end": "2026-09-16", "inst_comp": 800.0}]
        it = build.merge(prev, [], fc, [], {}, TODAY)[0]
        self.assertEqual((it["fc_start"], it["fc_end"]), ("2026-09-10", "2026-09-16"))

    def test_withdrawn_row_marks_status(self):
        t = page("""<table><tr><td>종목명</td><td>공모주일정</td><td>확정공모가</td><td>희망공모가</td><td>청약경쟁률</td><td>주간사</td></tr>
          <tr><td><a href="/html/fund/?o=v&no=55">마바</a></td><td>공모철회</td><td>-</td><td>10,000~12,000</td><td></td><td>KB증권</td></tr></table>""")
        rows = build.parse_schedule(t, TODAY)
        self.assertEqual(rows, [{"name": "마바", "no": "55", "status": "철회"}])
        prev = [{"id": "55", "no": "55", "name": "마바", "sub_start": "2026-10-05"}]
        self.assertEqual(build.merge(prev, rows, [], [], {}, TODAY)[0]["status"], "철회")


class Merge(unittest.TestCase):
    def test_merge_joins_by_name_and_keeps_history(self):
        prev = [{"id": "1500", "no": "1500", "name": "옛날상장", "list_date": "2026-03-02", "price": 10000},
                {"id": "1000", "no": "1000", "name": "아주옛날", "list_date": "2024-01-02"}]
        items = build.merge(prev, build.parse_schedule(SCHEDULE, TODAY), build.parse_forecast(FORECAST, TODAY),
                            build.parse_listing(LISTING, TODAY),
                            {"2201": build.parse_detail(DETAIL, TODAY)}, TODAY)
        by = {i["name"]: i for i in items}
        self.assertNotIn("아주옛날", by)          # 400일 넘은 것은 버린다
        self.assertIn("옛날상장", by)
        d = by["다라테크"]
        self.assertEqual((d["inst_comp"], d["lockup"], d["sub_comp"]), (1021.4, 35.52, 1234.56))
        self.assertEqual(d["uw"], ["한국투자증권"])  # 짧은 '한국투자' 대신 청약 표 이름
        g = by["가나바이오"]
        self.assertEqual((g["market"], g["list_date"], g["refund"], g["code"]), ("KOSDAQ", "2026-10-06", "2026-09-30", "456780"))
        self.assertEqual((g["float_pct"], g["old_shares"], g["post_shares"]), (27.5, 300000, 6000000))
        self.assertTrue(by["마바스팩7호"]["spac"])
        self.assertFalse(g["spac"])
        self.assertEqual(items[0]["name"], "마바스팩7호")  # 최근 청약이 앞

    def test_need_detail(self):
        it = {"no": "9", "sub_end": "2026-09-25"}
        full = {"market": "KOSDAQ", "list_date": "x", "refund": "y", "float_pct": 20.0, "fc_start": "2026-09-10"}
        self.assertEqual(build.need_detail(it, TODAY, {}), 1)
        self.assertEqual(build.need_detail(it, TODAY, {"9": full}), 0)
        # 400일 안 지난 종목은 한 번도 못 읽었으면 여유 있을 때 채운다
        self.assertEqual(build.need_detail({"no": "9", "sub_end": "2026-06-01"}, TODAY, {}), 2)
        self.assertEqual(build.need_detail({"no": "9", "sub_end": "2026-06-01"}, TODAY, {"9": full}), 0)
        self.assertEqual(build.need_detail({"no": "9", "sub_end": "2025-12-01"}, TODAY, {}), 2)
        self.assertEqual(build.need_detail({"no": "9", "sub_end": "2025-06-01"}, TODAY, {}), 0)


class Fetch(unittest.TestCase):
    def test_falls_back_to_legacy_tls_then_remembers(self):
        import ssl
        from unittest import mock

        class Resp:
            headers = {"Content-Type": "text/html; charset=euc-kr"}
            def read(self): return "<td>가나</td>".encode("cp949")
            def __enter__(self): return self
            def __exit__(self, *a): return False

        calls = []
        def fake(req, timeout, context=None):
            calls.append((req.full_url[:5], context is not None))
            if context is None and req.full_url.startswith("https"):
                raise urllib.error.URLError(ssl.SSLError("sslv3 alert handshake failure"))
            return Resp()

        import urllib.error
        build._WAYS.clear()
        with mock.patch.object(build.urllib.request, "urlopen", fake):
            self.assertIn("가나", build.fetch("https://www.38.co.kr/x"))
            self.assertEqual(calls, [("https", False), ("https", True)])
            calls.clear()
            build.fetch("https://www.38.co.kr/y")
            self.assertEqual(calls, [("https", True)])  # 통한 방법을 바로 쓴다
        build._WAYS.clear()


class EndToEnd(unittest.TestCase):
    def test_main_writes_valid_file(self):
        with tempfile.TemporaryDirectory() as d:
            for name, text in (("k", SCHEDULE), ("r1", FORECAST), ("nw", LISTING), ("v-2201", DETAIL)):
                with open(os.path.join(d, f"{name}.html"), "wb") as f:
                    f.write(text.encode("cp949"))
            out = os.path.join(d, "ipo.json")
            rc = build.main(["--html-dir", d, "--out", out, "--today", TODAY.isoformat(), "--min-schedule", "3"])
            self.assertEqual(rc, 0)
            with open(out, encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(len(data["items"]), 4)
            errors, _ = validate.check(out, min_items=3, today=TODAY)
            self.assertEqual(errors, [])

    def test_too_few_rows_fails_and_keeps_file(self):
        with tempfile.TemporaryDirectory() as d:
            for name in ("k", "r1", "nw"):
                with open(os.path.join(d, f"{name}.html"), "w", encoding="utf-8") as f:
                    f.write("<html>점검 중</html>")
            out = os.path.join(d, "ipo.json")
            rc = build.main(["--html-dir", d, "--out", out, "--today", TODAY.isoformat()])
            self.assertEqual(rc, 1)
            self.assertFalse(os.path.exists(out))


class Validate(unittest.TestCase):
    def test_catches_bad_rows(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "ipo.json")
            with open(p, "w", encoding="utf-8") as f:
                json.dump({"updated": "2026-09-24T07:00+09:00", "items": [
                    {"id": "1", "name": "가", "sub_start": "2026-09-25", "sub_end": "2026-09-24"},
                    {"id": "1", "name": "나", "band_lo": 30000, "band_hi": 20000},
                ]}, f)
            errors, _ = validate.check(p, min_items=1, today=TODAY)
            self.assertTrue(any("중복" in e for e in errors))
            self.assertTrue(any("청약 끝" in e for e in errors))
            self.assertTrue(any("밴드" in e for e in errors))

    def test_catches_order_types_and_shrink(self):
        with tempfile.TemporaryDirectory() as d:
            p, q = os.path.join(d, "ipo.json"), os.path.join(d, "prev.json")
            bad = [
                {"id": "1", "name": "가", "sub_start": "2026-09-20", "sub_end": "2026-09-21", "list_date": "2026-09-19", "refund": "2026-09-18"},
                {"id": "2", "name": "나", "fc_end": "2026-09-25", "sub_start": "2026-09-20", "sub_end": "2026-09-21"},
                {"id": "3", "name": "다", "price": 10000, "open": 45000, "market": "???", "sector": "2025-08-07"},
                {"id": "4", "name": "라", "inst_comp": -1, "sub_comp": "12", "spac": "yes"},
            ]
            with open(p, "w", encoding="utf-8") as f:
                json.dump({"updated": None, "items": bad}, f)
            with open(q, "w", encoding="utf-8") as f:
                json.dump({"items": [{"id": str(i), "name": "x"} for i in range(50)]}, f)
            errors, _ = validate.check(p, min_items=1, today=TODAY, prev_path=q)
            text = " ".join(errors)
            for needle in ("상장이 청약 끝보다 앞", "환불이 청약 끝보다 앞", "수요예측이 청약보다 늦음", "공모가의 4.50배",
                           "시장 값 이상", "업종 값 이상", "inst_comp 숫자가 아님", "sub_comp 숫자가 아님",
                           "spac 가 참/거짓이 아님", "updated 가 없음", "20% 넘게 줄었음"):
                self.assertIn(needle, text)

    def test_real_file_passes(self):
        errors, _ = validate.check(os.path.join(os.path.dirname(HERE), "data", "ipo.json"), min_items=0, today=TODAY)
        self.assertEqual(errors, [])

    def test_empty_placeholder_is_allowed(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "ipo.json")
            with open(p, "w", encoding="utf-8") as f:
                json.dump({"updated": None, "items": []}, f)
            errors, warns = validate.check(p, min_items=0, today=TODAY)
            self.assertEqual(errors, [])
            self.assertTrue(warns)


if __name__ == "__main__":
    unittest.main()
