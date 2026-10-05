#!/usr/bin/env python3
"""국토교통부 아파트 매매 실거래가 API → 신고가 장부용 데이터 파일.

공공데이터포털(data.go.kr)의 "국토교통부_아파트 매매 실거래가 상세 자료"를 시군구·월 단위로
받아 하나의 파일로 저장한다. 기본 출력은 페이지가 바로 읽는 압축 JSON이고, CSV 로도 뽑을 수 있다.

  python fetch_molit.py --key "$KEY" --config regions.json --months 12 -o data/latest.json
  python fetch_molit.py --key "$KEY" --lawd 11680,11650 --months 6 --format csv -o data/latest.csv

브라우저에서 이 API 를 직접 부를 수 없어서(CORS 미허용 + 키 노출) 이 스크립트를 깃허브 액션에서
돌리고 결과 파일만 배포한다. 표준 라이브러리만 쓴다.
"""
import argparse, calendar, csv, json, math, os, statistics, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

DEFAULT_ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
RENT_ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"
KST = timezone(timedelta(hours=9))
CSV_HEAD = ["NO", "시군구", "번지", "본번", "부번", "단지명", "전용면적(㎡)", "계약년월", "계약일",
            "거래금액(만원)", "동", "층", "매수자", "매도자", "건축년도", "도로명", "해제사유발생일",
            "거래유형", "중개사소재지", "등기일자", "주택유형"]


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def clean_key(key, label):
    """시크릿 칸에 붙여넣다 보면 앞뒤에 줄바꿈·공백이 딸려 들어간다. 그대로 쓰면 주소가 만들어지지 않는다."""
    if not key:
        return key
    cleaned = key.strip()
    if cleaned != key:
        log(f"{label} 앞뒤에 붙은 공백·줄바꿈을 지웠습니다 (시크릿에 함께 붙여넣어진 것으로 보입니다).")
    if any(ch.isspace() or ord(ch) < 32 for ch in cleaned):
        log(f"{label} 가운데에 공백이나 제어문자가 있습니다. 시크릿 값을 다시 확인하세요.")
    return cleaned


def month_range(end_ym, count):
    """end_ym('YYYY-MM') 을 포함해 과거로 count 개월치 'YYYYMM' 목록."""
    y, m = int(end_ym[:4]), int(end_ym[5:7])
    out = []
    for _ in range(count):
        out.append(f"{y}{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


def build_url(endpoint, key, lawd, ymd, page, rows):
    # data.go.kr 은 인코딩/디코딩 두 가지 키를 준다. 이미 퍼센트 인코딩된 키는 그대로 붙이고,
    # 디코딩된 키만 여기서 인코딩한다. (이중 인코딩이 가장 흔한 실패 원인)
    service_key = key if "%" in key else urllib.parse.quote(key, safe="")
    q = urllib.parse.urlencode({"LAWD_CD": lawd, "DEAL_YMD": ymd, "pageNo": page, "numOfRows": rows})
    return f"{endpoint}?serviceKey={service_key}&{q}"


def http_get(url, timeout, tries, pause):
    last = None
    for attempt in range(1, tries + 1):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/xml", "User-Agent": "singoga-ledger/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
            last = e
            if attempt < tries:
                time.sleep(pause * attempt)
    raise RuntimeError(f"요청 실패: {last}")


def parse_response(raw):
    """(items, total) 반환. API 오류는 RuntimeError."""
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        head = raw[:200].decode("utf-8", "replace").strip()
        raise RuntimeError(f"XML 이 아닌 응답: {head}")
    # 포털 공통 오류 봉투 (키 미등록·트래픽 초과 등)
    fault = root.findtext(".//returnReasonCode") or root.findtext(".//errMsg")
    code = (root.findtext(".//resultCode") or "").strip()
    if fault and not code:
        msg = root.findtext(".//returnAuthMsg") or root.findtext(".//errMsg") or ""
        raise RuntimeError(f"API 오류 {fault} {msg}".strip())
    norm = code.lstrip("0")
    if norm == "3":  # NODATA_ERROR — 그 달에 거래가 없는 정상 상황
        return [], 0
    if code and norm:  # 00 / 000 만 정상
        raise RuntimeError(f"API 오류 {code} {(root.findtext('.//resultMsg') or '').strip()}")
    items = root.findall(".//item")
    total = int((root.findtext(".//totalCount") or "0").strip() or 0)
    return items, total


def fetch_month(endpoint, key, lawd, ymd, rows, timeout, tries, pause):
    page, out, total = 1, [], None
    while True:
        items, total = parse_response(http_get(build_url(endpoint, key, lawd, ymd, page, rows), timeout, tries, pause))
        out.extend(items)
        if not items or page * rows >= total:
            return out
        page += 1


def txt(item, tag):
    return (item.findtext(tag) or "").strip()


def to_rent(item, region):
    """전월세 item → (그룹키, 보증금, 월세, 계약년월). 전세만 쓰려면 월세가 0인 것만 고른다."""
    apt = txt(item, "aptNm")
    dep = txt(item, "deposit").replace(",", "").replace(" ", "")
    mon = txt(item, "monthlyRent").replace(",", "").replace(" ", "") or "0"
    area = txt(item, "excluUseAr")
    y, m = txt(item, "dealYear"), txt(item, "dealMonth")
    if not (apt and dep and area and y and m):
        return None
    try:
        deposit, monthly, area_f = int(dep), int(mon), float(area)
    except ValueError:
        return None
    if deposit <= 0:
        return None
    key = (region or "", txt(item, "umdNm"), apt, int(round(area_f)))
    return key, deposit, monthly, f"{int(y):04d}-{int(m):02d}"


def to_deal(item, region):
    """API item → 내부 거래 dict. 필수값이 없으면 None."""
    apt = txt(item, "aptNm")
    amount = txt(item, "dealAmount").replace(",", "").replace(" ", "")
    area = txt(item, "excluUseAr")
    y, m, d = txt(item, "dealYear"), txt(item, "dealMonth"), txt(item, "dealDay")
    if not (apt and amount and area and y and m):
        return None
    try:
        price, area_f = int(amount), float(area)
    except ValueError:
        return None
    dong = txt(item, "umdNm")
    return {
        "sgg": region or txt(item, "sggCd"),
        "dong": dong,
        "apt": apt,
        "area": round(area_f, 2),
        "ymd": int(f"{int(y):04d}{int(m):02d}{int(d or 1):02d}"),
        "price": price,
        "floor": int(txt(item, "floor") or 0) or None,
        "built": int(txt(item, "buildYear") or 0) or None,
        "bdong": txt(item, "aptDong"),
        "jibun": txt(item, "jibun"),
        "type": txt(item, "dealingGbn"),
        "cancel": txt(item, "cdealDay"),
    }


def load_regions(args):
    """[(lawd_code, 표시이름)] 목록."""
    if args.config:
        with open(args.config, encoding="utf-8") as f:
            cfg = json.load(f)
        items = cfg["regions"] if isinstance(cfg, dict) else cfg
        out = [(str(r["code"]).strip(), str(r.get("name") or r["code"]).strip()) for r in items]
        if isinstance(cfg, dict) and not args.months_set and cfg.get("months"):
            args.months = int(cfg["months"])
        return out
    codes = [c.strip() for c in args.lawd.split(",") if c.strip()]
    names = [n.strip() for n in args.region.split(",")] if args.region else []
    return [(c, names[i] if i < len(names) and names[i] else c) for i, c in enumerate(codes)]


def rent_summary(records, months):
    """그룹별 전세 요약. months 는 오래된 달부터 정렬된 'YYYY-MM' 목록."""
    last12 = set(months[-12:])
    last6 = set(months[-6:])
    prev6 = set(months[-12:-6])
    out = {}
    for key, rows in records.items():
        j12 = [d for d, ym in rows if ym in last12]
        if not j12:
            continue
        j6 = [d for d, ym in rows if ym in last6]
        p6 = [d for d, ym in rows if ym in prev6]
        out[key] = (int(statistics.median(j12)), len(j12),
                    int(statistics.median(j6)) if j6 else 0,
                    int(statistics.median(p6)) if p6 else 0)
    return out


def pack(deals, meta, rents=None, rent_months=None):
    """사전 압축 JSON. 같은 문자열을 반복해서 싣지 않는다."""
    dicts = {"sgg": {}, "dong": {}, "apt": {}, "bdong": {}, "type": {}}

    def idx(kind, value):
        table = dicts[kind]
        if value not in table:
            table[value] = len(table)
        return table[value]

    rows = [[idx("sgg", d["sgg"]), idx("dong", d["dong"]), idx("apt", d["apt"]), d["area"], d["ymd"],
             d["price"], d["floor"], d["built"], idx("bdong", d["bdong"]), idx("type", d["type"]),
             d["cancel"] or 0] for d in deals]
    rows.sort(key=lambda r: (r[4], r[0], r[1], r[2]))
    rent_rows = []
    for (sgg, dong, apt, ak), (j12, n12, j6, p6) in sorted((rents or {}).items()):
        rent_rows.append([idx("sgg", sgg), idx("dong", dong), idx("apt", apt), ak, j12, n12, j6, p6])
    out = {
        "v": 1,
        "kind": "singoga-packed",
        "cols": ["sgg", "dong", "apt", "area", "ymd", "price", "floor", "built", "bdong", "type", "cancel"],
        "dict": {k: [s for s, _ in sorted(v.items(), key=lambda kv: kv[1])] for k, v in dicts.items()},
        "rows": rows,
        **meta,
    }
    if rent_rows:
        out["rentCols"] = ["sgg", "dong", "apt", "areaKey", "j12", "n12", "j6", "j6p"]
        out["rent"] = rent_rows
        if rent_months:
            out["rentRange"] = {"from": rent_months[0][:4] + "-" + rent_months[0][4:],
                                "to": rent_months[-1][:4] + "-" + rent_months[-1][4:]}
    return out


# ---------------------------------------------------------------------------
# 지역 비교 요약. 페이지의 marketSeries() 와 같은 계산을 여기서 미리 해 둔다.
# 12개 지역 파일(8MB)을 다 내려받지 않고도 '한눈에 보기' 를 그릴 수 있게 하려는 것.
# 숫자가 화면과 어긋나지 않도록 JS 의 반올림·최빈값·중앙값 규칙을 그대로 따른다.
# ---------------------------------------------------------------------------
def _js_round(x):
    return math.floor(x + 0.5)


def _ym_shift(ym, n):
    """'YYYY-MM' 에서 n 개월 앞(과거)으로."""
    y, m = int(ym[:4]), int(ym[5:7]) - n
    while m <= 0:
        m += 12; y -= 1
    while m > 12:
        m -= 12; y += 1
    return f"{y}-{m:02d}"


def _months_ago(date, n):
    """'YYYY-MM-DD' 에서 n 개월 앞, 같은 날(그 달 말일로 자름)."""
    ym = _ym_shift(date[:7], n)
    last = calendar.monthrange(int(ym[:4]), int(ym[5:7]))[1]
    return f"{ym}-{min(int(date[8:10]), last):02d}"


def unpack(packed):
    """압축 JSON → 거래 dict 목록과 전세 맵 (페이지의 packedToDeals 와 같은 결과)."""
    D, C = packed["dict"], {c: i for i, c in enumerate(packed["cols"])}
    g = lambda k, i: D[k][i] if i is not None and i < len(D[k]) else ""
    deals = []
    for r in packed["rows"]:
        ymd = str(r[C["ymd"]])
        if len(ymd) != 8:
            continue
        cancel = r[C["cancel"]] if "cancel" in C else 0
        deals.append({"sgg": g("sgg", r[C["sgg"]]), "dong": g("dong", r[C["dong"]]), "apt": g("apt", r[C["apt"]]),
                      "area": float(r[C["area"]]), "price": float(r[C["price"]]),
                      "date": f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}",
                      "cancel": bool(cancel) and cancel != "-"})
    rent = {}
    if packed.get("rent"):
        RC = {c: i for i, c in enumerate(packed["rentCols"])}
        for q in packed["rent"]:
            key = f'{g("sgg", q[RC["sgg"]])}|{g("dong", q[RC["dong"]])}|{g("apt", q[RC["apt"]])}|{q[RC["areaKey"]]}'
            rent[key] = q[RC["j12"]] or 0
    return deals, rent


def region_summary(packed):
    deals, rent = unpack(packed)
    deals = [d for d in deals if not d["cancel"]]          # 페이지 기본값: 해제 거래 제외
    if not deals:
        return None
    ref = max(d["date"] for d in deals)
    groups = {}
    for d in deals:
        k = f'{d["sgg"]}|{d["dong"]}|{d["apt"]}|{_js_round(d["area"])}'
        groups.setdefault(k, []).append(d)
    p_from = _months_ago(ref, 3)
    per_g, first, jr = [], "", []
    vol = {}
    for k, ds in groups.items():
        ds.sort(key=lambda d: (d["date"], d["price"]))
        cnt, best, bn = {}, ds[0]["area"], 0                 # JS mode(): 처음 만난 최빈값
        for d in ds:
            cnt[d["area"]] = cnt.get(d["area"], 0) + 1
            if cnt[d["area"]] > bn:
                bn, best = cnt[d["area"]], d["area"]
        area = best
        by_m = {}
        for d in ds:
            by_m.setdefault(d["date"][:7], []).append(d["price"] / (area / 3.305785))
            vol[d["date"][:7]] = vol.get(d["date"][:7], 0) + 1
        monthly = {ym: statistics.median(v) for ym, v in by_m.items()}
        base = statistics.median(list(monthly.values()))
        if base:
            per_g.append((monthly, base))
            first = min([first] + list(monthly)) if first else min(monthly)
        recent = [d["price"] for d in ds if d["date"] >= p_from]
        price = statistics.median(recent) if recent else ds[-1]["price"]
        if rent.get(k):
            jr.append(rent[k] / price)
    if not per_g:
        return None
    months, ym, end = [], first, ref[:7]
    while ym <= end:
        months.append(ym); ym = _ym_shift(ym, -1)
    min_g = max(2, min(5, _js_round(len(per_g) * 0.05)))
    raw = []
    for ym in months:
        r = [m[ym] / b for m, b in per_g if ym in m]
        raw.append(statistics.median(r) if len(r) >= min_g else None)
    fi = next((i for i, v in enumerate(raw) if v is not None), -1)
    if fi < 0:
        return None
    idx = [None if v is None else v / raw[fi] * 100 for v in raw]
    peak = max((i for i, v in enumerate(idx) if v is not None), key=lambda i: (idx[i], -i))
    trough, run, worst = -1, -math.inf, 0.0
    for i, v in enumerate(idx):
        if v is None:
            continue
        run = max(run, v)
        dd = v / run - 1
        if dd < worst:
            worst, trough = dd, i
    if worst > -0.02:
        trough = -1
    cur = max(i for i, v in enumerate(idx) if v is not None)
    lim = _ym_shift(months[cur], 3)
    p3 = next((i for i in range(cur - 1, -1, -1) if idx[i] is not None and months[i] <= lim), None)
    vs = lambda a, b: (idx[a] / idx[b] - 1) if a is not None and b is not None and a >= 0 and b >= 0 and idx[b] else None
    v_all = [vol.get(ym, 0) for ym in months]
    return {
        "months": months, "idx": [None if v is None else round(v, 2) for v in idx], "vol": v_all,
        "peak": {"ym": months[peak], "v": round(idx[peak], 2)},
        "trough": {"ym": months[trough], "v": round(idx[trough], 2)} if trough >= 0 else None,
        "cur": {"ym": months[cur], "v": round(idx[cur], 2)},
        "vsPeak": vs(cur, peak), "vsTrough": vs(cur, trough) if trough >= 0 else None,
        "troughVsPeak": vs(trough, peak) if trough >= 0 else None,
        "mom3": vs(cur, p3) if p3 is not None else None,
        "vol12": 0,
        "jr": statistics.median(jr) if jr else None, "jrN": len(jr),
        "groups": len(per_g), "deals": len(deals), "ref": ref,
    }


def write_summary(out_dir, entries):
    """index.json 에 적힌 지역 파일들을 읽어 summary.json 을 만든다."""
    regions = []
    for e in entries:
        try:
            with open(os.path.join(out_dir, e["file"]), encoding="utf-8") as f:
                packed = json.load(f)
        except (OSError, ValueError):
            continue
        sm = region_summary(packed)
        if not sm:
            continue
        name = e["name"]
        parts = name.split()
        regions.append({"code": e["code"], "name": name, "short": parts[-1] if parts else name,
                        "group": parts[0] if parts else "", **sm})
    # 거래량은 완결된 달끼리만 견준다. 신고 기한이 계약 후 30일이라 최근 두 달은 아직 덜 들어와 있고,
    # 지역마다 마지막 달이 달라서 그대로 비교하면 많게는 30%p 넘게 틀어진다.
    if regions:
        latest = max(r["ref"][:7] for r in regions)
        vol_end = _ym_shift(latest, 2)
        for r in regions:
            v = dict(zip(r["months"], r["vol"]))
            r["volLast12"] = sum(v.get(_ym_shift(vol_end, i), 0) for i in range(12))
            r["volPrev12"] = sum(v.get(_ym_shift(vol_end, i), 0) for i in range(12, 24))
            r.pop("vol12", None)
    else:
        vol_end = None
    out = {"v": 1, "kind": "singoga-summary", "volEnd": vol_end, "regions": regions}
    path = os.path.join(out_dir, "summary.json")
    old = None
    try:
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
    except (OSError, ValueError):
        pass
    if old != out:
        write_json(path, out)
    log(f"{out_dir}/summary.json: {len(regions)}개 지역 요약")
    return out


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def split_write(out_dir, by_region, rents, meta_common, rent_months):
    """시군구별 파일 + index.json. 내용이 같은 지역 파일은 다시 쓰지 않는다."""
    os.makedirs(out_dir, exist_ok=True)
    entries, written, kept = [], 0, 0
    for code, name, deals in by_region:
        if not deals:
            log(f"  [건너뜀] {name}: 거래 0건")
            continue
        sub = {k: v for k, v in (rents or {}).items() if k[0] == name}
        meta = dict(meta_common, regions=[name])
        packed = pack(deals, meta, sub, rent_months)
        path = os.path.join(out_dir, f"{code}.json")
        if unchanged(path, packed):
            kept += 1
        else:
            write_json(path, packed)
            written += 1
        dates = [d["ymd"] for d in deals]
        entries.append({"code": code, "name": name, "file": f"{code}.json",
                        "deals": len(deals), "rent": len(sub),
                        "from": f"{str(min(dates))[:4]}-{str(min(dates))[4:6]}",
                        "to": f"{str(max(dates))[:4]}-{str(max(dates))[4:6]}",
                        "bytes": os.path.getsize(path)})
    index = {"v": 1, "kind": "singoga-index", "updated": meta_common["updated"],
             "source": meta_common["source"], "regions": entries}
    old = None
    try:
        with open(os.path.join(out_dir, "index.json"), encoding="utf-8") as f:
            old = json.load(f)
    except (OSError, ValueError):
        pass
    if not old or [{k: v for k, v in e.items() if k != "bytes"} for e in old.get("regions", [])] != \
                  [{k: v for k, v in e.items() if k != "bytes"} for e in entries]:
        write_json(os.path.join(out_dir, "index.json"), index)
    elif written:
        write_json(os.path.join(out_dir, "index.json"), index)
    total = sum(e["deals"] for e in entries)
    log(f"{out_dir}/: {len(entries)}개 지역 · {total:,}건 · 새로 쓴 파일 {written}개, 그대로 둔 파일 {kept}개")
    write_summary(out_dir, entries)
    return 0


def unchanged(path, packed):
    """거래 내용이 이전 파일과 같으면 True. 갱신 시각만 바뀌는 커밋을 막는다."""
    try:
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
    except (OSError, ValueError):
        return False
    return all(old.get(k) == packed.get(k) for k in ("rows", "dict", "cols", "regions", "range", "rent"))


def write_csv(path, deals):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(CSV_HEAD)
        for i, d in enumerate(deals, 1):
            ymd = str(d["ymd"])
            w.writerow([i, f"{d['sgg']} {d['dong']}".strip(), d["jibun"], "", "", d["apt"], f"{d['area']:.2f}",
                        ymd[:6], int(ymd[6:]), f"{d['price']:,}", d["bdong"], d["floor"] or "", "", "",
                        d["built"] or "", "", d["cancel"], d["type"], "", "", "아파트"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--key", default=os.environ.get("DATA_GO_KR_KEY", ""), help="data.go.kr 인증키 (또는 환경변수 DATA_GO_KR_KEY)")
    ap.add_argument("--config", help="지역 목록 JSON (regions.json)")
    ap.add_argument("--lawd", default="", help="시군구 법정동코드 5자리, 쉼표 구분 (--config 없을 때)")
    ap.add_argument("--region", default="", help="시군구 이름, --lawd 순서대로 쉼표 구분")
    ap.add_argument("--months", type=int, default=12, help="최근 몇 개월치 (기본 12)")
    ap.add_argument("--end", default="", help="마지막 달 YYYY-MM (기본: 이번 달)")
    ap.add_argument("--format", choices=["json", "csv"], default="json")
    ap.add_argument("-o", "--out", default="data/latest.json")
    ap.add_argument("--rebuild-summary", default="", metavar="DIR",
                    help="API 를 부르지 않고 DIR 의 지역 파일들로 summary.json 만 다시 만든다")
    ap.add_argument("--split-dir", default="",
                    help="시군구마다 파일을 따로 쓰고 목록(index.json)을 만든다. 지역이 많을 때 페이지가 "
                         "한 번에 한 지역만 읽게 하려는 것. 주면 --out 은 무시한다.")
    ap.add_argument("--endpoint", default=os.environ.get("MOLIT_ENDPOINT", DEFAULT_ENDPOINT))
    ap.add_argument("--rows", type=int, default=1000, help="한 번에 받을 건수")
    ap.add_argument("--sleep", type=float, default=0.15, help="호출 간 대기(초)")
    ap.add_argument("--timeout", type=float, default=60)
    ap.add_argument("--tries", type=int, default=3, help="실패 시 재시도 횟수")
    ap.add_argument("--max-fail", type=int, default=0, help="허용할 실패 (시군구×월) 수. 넘으면 종료코드 1")
    ap.add_argument("--rent-months", type=int, default=12, help="전세가율용 전월세 자료를 몇 개월치 받을지 (0이면 안 받음)")
    ap.add_argument("--rent-endpoint", default=os.environ.get("MOLIT_RENT_ENDPOINT", RENT_ENDPOINT))
    ap.add_argument("--rent-key", default=os.environ.get("DATA_GO_KR_RENT_KEY", ""),
                    help="전월세 자료를 별도 인증키로 받을 때. 비우면 --key 를 그대로 쓴다 "
                         "(환경변수 DATA_GO_KR_RENT_KEY)")
    a = ap.parse_args()
    a.months_set = any(x.startswith("--months") for x in sys.argv)
    a.key = clean_key(a.key, "매매 인증키")
    a.rent_key = clean_key(a.rent_key, "전월세 인증키")

    if a.rebuild_summary:
        with open(os.path.join(a.rebuild_summary, "index.json"), encoding="utf-8") as f:
            write_summary(a.rebuild_summary, json.load(f)["regions"])
        return 0
    if not a.key:
        log("인증키가 없습니다. --key 또는 환경변수 DATA_GO_KR_KEY 를 주세요.")
        return 2
    regions = load_regions(a)
    if not regions:
        log("수집할 지역이 없습니다. --config 또는 --lawd 를 주세요.")
        return 2

    end = a.end or date.today().strftime("%Y-%m")
    months = month_range(end, a.months)
    log(f"{len(regions)}개 지역 × {len(months)}개월 ({months[0]}~{months[-1]}) = {len(regions) * len(months)}회 호출")

    deals, seen, failures = [], set(), []
    by_region = []
    for code, name in regions:
        got = 0
        mine = []
        for ymd in months:
            try:
                items = fetch_month(a.endpoint, a.key, code, ymd, a.rows, a.timeout, a.tries, a.sleep)
            except Exception as e:  # 한 달 실패가 전체를 막지 않게 한다
                failures.append(f"{name}({code}) {ymd}: {e}")
                log(f"  [실패] {name} {ymd}: {e}")
                continue
            for it in items:
                d = to_deal(it, name)
                if not d:
                    continue
                k = (d["sgg"], d["dong"], d["apt"], d["area"], d["ymd"], d["price"], d["floor"], d["bdong"])
                if k in seen:
                    continue
                seen.add(k)
                deals.append(d)
                mine.append(d)
                got += 1
            time.sleep(a.sleep)
        by_region.append((code, name, mine))
        log(f"{name}: {got}건")

    if not deals:
        log("받은 거래가 없습니다. 인증키 승인 상태와 지역 코드를 확인하세요.")
        return 1

    rents, rent_months = None, None
    if a.format == "json" and a.rent_months > 0:
        rent_key = a.rent_key or a.key
        rent_months = months[-a.rent_months:]
        log(f"전월세(전세가율용) {len(regions)}개 지역 × {len(rent_months)}개월 = {len(regions) * len(rent_months)}회 호출"
            + (" · 전용 인증키 사용" if a.rent_key else " · 매매와 같은 인증키 사용"))
        records, seen_rent, got = {}, set(), 0
        rent_failures, rent_calls = [], 0
        for code, name in regions:
            for ymd in rent_months:
                rent_calls += 1
                try:
                    items = fetch_month(a.rent_endpoint, rent_key, code, ymd, a.rows, a.timeout, a.tries, a.sleep)
                except Exception as e:
                    rent_failures.append(f"{name}({code}) {ymd}: {e}")
                    log(f"  [실패·전월세] {name} {ymd}: {e}")
                    continue
                for it in items:
                    parsed = to_rent(it, name)
                    if not parsed:
                        continue
                    key, deposit, monthly, ym = parsed
                    if monthly:  # 월세·반전세는 전세가율 계산에서 뺀다
                        continue
                    sig = (key, deposit, ym, txt(it, "floor"))
                    if sig in seen_rent:
                        continue
                    seen_rent.add(sig)
                    records.setdefault(key, []).append((deposit, ym))
                    got += 1
                time.sleep(a.sleep)
        rents = rent_summary(records, [f"{m[:4]}-{m[4:]}" for m in rent_months])
        log(f"전세 {got:,}건 → 전세가율 낼 수 있는 묶음 {len(rents):,}개"
            + (f" · 전월세 호출 실패 {len(rent_failures)}/{rent_calls}" if rent_failures else ""))
        if rent_failures and len(rent_failures) == rent_calls:
            log("전월세를 한 건도 받지 못했습니다. 매매 자료만으로 계속합니다.")
            log("  → '국토교통부_아파트 전월세 자료' 활용신청이 승인됐는지, 그 자료의 인증키가 매매와 다르다면"
                " DATA_GO_KR_RENT_KEY 시크릿에 넣었는지 확인하세요."
                " 없는 동안에는 전세가율·갭만 비고 나머지는 정상입니다.")
            rents = None

    if a.split_dir:
        meta_common = {
            "updated": datetime.now(KST).isoformat(timespec="seconds"),
            "source": "국토교통부 아파트 매매 실거래가 상세 자료 (data.go.kr)",
            "range": {"from": f"{months[0][:4]}-{months[0][4:]}", "to": f"{months[-1][:4]}-{months[-1][4:]}"},
        }
        split_write(a.split_dir, by_region, rents, meta_common, rent_months)
        if len(failures) > a.max_fail:
            log(f"실패가 허용치({a.max_fail})를 넘었습니다.")
            return 1
        return 0

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    if a.format == "csv":
        deals.sort(key=lambda d: (d["ymd"], d["sgg"], d["dong"], d["apt"]))
        write_csv(a.out, deals)
    else:
        meta = {
            "updated": datetime.now(KST).isoformat(timespec="seconds"),
            "source": "국토교통부 아파트 매매 실거래가 상세 자료 (data.go.kr)",
            "range": {"from": f"{months[0][:4]}-{months[0][4:]}", "to": f"{months[-1][:4]}-{months[-1][4:]}"},
            "regions": [n for _, n in regions],
        }
        packed = pack(deals, meta, rents, rent_months)
        if unchanged(a.out, packed):
            log(f"{a.out}: 내용 동일 — 파일을 그대로 둡니다 ({len(deals):,}건)")
            return 0
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(packed, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(a.out)
    log(f"{a.out}: {len(deals):,}건 · {size / 1048576:.2f}MB" + (f" · 실패 {len(failures)}건" if failures else ""))
    if len(failures) > a.max_fail:
        log(f"실패가 허용치({a.max_fail})를 넘었습니다.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
