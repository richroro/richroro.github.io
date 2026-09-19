#!/usr/bin/env python3
"""국토교통부 아파트 매매 실거래가 API → 신고가 장부용 CSV.

공공데이터포털(data.go.kr)에서 "국토교통부_아파트 매매 실거래가 자료" 활용신청 후 받은
인증키(serviceKey)로 시군구·월별 자료를 받아, rt.molit.go.kr 다운로드 CSV와 같은 열 구조로 저장한다.
저장한 파일을 data/latest.csv 로 두고 함께 배포하면 페이지가 열릴 때 자동으로 읽는다.

사용 예:
  python fetch_molit.py --key "발급받은키" --lawd 11680 --from 2025-10 --to 2026-09 \
      --region "서울특별시 강남구" -o data/latest.csv

  --lawd   법정동코드 앞 5자리(시군구). 여러 개는 쉼표로. 예: 11680,11650
  --region 시군구 이름(선택). 코드 순서대로 쉼표로 나열. 없으면 코드가 그대로 들어간다.

표준 라이브러리만 사용한다. 실패한 달은 건너뛰고 표준오류에 알린다.
"""
import argparse, csv, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

API = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
HEAD = ["NO","시군구","번지","본번","부번","단지명","전용면적(㎡)","계약년월","계약일","거래금액(만원)",
        "동","층","매수자","매도자","건축년도","도로명","해제사유발생일","거래유형","중개사소재지","등기일자","주택유형"]

def months(a, b):
    y, m = map(int, a.split("-")); y2, m2 = map(int, b.split("-"))
    while (y, m) <= (y2, m2):
        yield f"{y}{m:02d}"
        m += 1
        if m > 12: y, m = y + 1, 1

def fetch_month(key, lawd, ymd, rows=1000):
    page, out = 1, []
    while True:
        q = urllib.parse.urlencode({"serviceKey": key, "LAWD_CD": lawd, "DEAL_YMD": ymd, "pageNo": page, "numOfRows": rows},
                                   quote_via=urllib.parse.quote)
        with urllib.request.urlopen(f"{API}?{q}", timeout=60) as r:
            root = ET.fromstring(r.read())
        code = (root.findtext(".//resultCode") or "").strip()
        if code not in ("00", "000"):
            raise RuntimeError(f"{ymd} {lawd}: {code} {root.findtext('.//resultMsg')}")
        items = root.findall(".//item")
        out.extend(items)
        total = int(root.findtext(".//totalCount") or 0)
        if page * rows >= total or not items: break
        page += 1
    return out

def t(item, tag):
    return (item.findtext(tag) or "").strip()

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--key", required=True, help="data.go.kr 인증키 (디코딩된 값)")
    ap.add_argument("--lawd", required=True, help="시군구 법정동코드 5자리, 쉼표 구분")
    ap.add_argument("--from", dest="start", required=True, help="시작 월 YYYY-MM")
    ap.add_argument("--to", dest="end", required=True, help="끝 월 YYYY-MM")
    ap.add_argument("--region", default="", help="시군구 이름, --lawd 순서대로 쉼표 구분")
    ap.add_argument("-o", "--out", default="data/latest.csv")
    ap.add_argument("--sleep", type=float, default=0.2, help="호출 간 대기(초)")
    a = ap.parse_args()
    lawds = [x.strip() for x in a.lawd.split(",") if x.strip()]
    names = [x.strip() for x in a.region.split(",")] if a.region else []
    rows, n = [], 0
    for i, lawd in enumerate(lawds):
        region = names[i] if i < len(names) and names[i] else lawd
        for ymd in months(a.start, a.end):
            try:
                items = fetch_month(a.key, lawd, ymd)
            except Exception as e:
                print(f"[skip] {e}", file=sys.stderr); continue
            for it in items:
                n += 1
                rows.append([n, f"{region} {t(it,'umdNm')}", t(it,"jibun"), "", "", t(it,"aptNm"), t(it,"excluUseAr"),
                             f"{t(it,'dealYear')}{int(t(it,'dealMonth') or 0):02d}", t(it,"dealDay"),
                             t(it,"dealAmount").replace(" ", ""), t(it,"aptDong"), t(it,"floor"), t(it,"buyerGbn"), t(it,"slerGbn"),
                             t(it,"buildYear"), "", t(it,"cdealDay"), t(it,"dealingGbn"), t(it,"estateAgentSggNm"), t(it,"rgstDate"), "아파트"])
            print(f"{region} {ymd}: {len(items)}건", file=sys.stderr)
            time.sleep(a.sleep)
    import os; os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f); w.writerow(HEAD); w.writerows(rows)
    print(f"{a.out}: {len(rows)}건 저장", file=sys.stderr)

if __name__ == "__main__":
    main()
