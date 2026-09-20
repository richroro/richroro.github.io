#!/usr/bin/env python3
"""국토교통부 아파트 매매 실거래가 API → 신고가 장부용 데이터 파일.

공공데이터포털(data.go.kr)의 "국토교통부_아파트 매매 실거래가 상세 자료"를 시군구·월 단위로
받아 하나의 파일로 저장한다. 기본 출력은 페이지가 바로 읽는 압축 JSON이고, CSV 로도 뽑을 수 있다.

  python fetch_molit.py --key "$KEY" --config regions.json --months 12 -o data/latest.json
  python fetch_molit.py --key "$KEY" --lawd 11680,11650 --months 6 --format csv -o data/latest.csv

브라우저에서 이 API 를 직접 부를 수 없어서(CORS 미허용 + 키 노출) 이 스크립트를 깃허브 액션에서
돌리고 결과 파일만 배포한다. 표준 라이브러리만 쓴다.
"""
import argparse, csv, json, os, statistics, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

DEFAULT_ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
KST = timezone(timedelta(hours=9))
HISTORY_HEAD = ["수집일", "시군구", "창(개월)", "거래건수", "중위가(만원)", "평균단가(만원/㎡)",
                "최고가(만원)", "전체거래건수", "전체취소건수", "범위시작", "범위끝"]
CSV_HEAD = ["NO", "시군구", "번지", "본번", "부번", "단지명", "전용면적(㎡)", "계약년월", "계약일",
            "거래금액(만원)", "동", "층", "매수자", "매도자", "건축년도", "도로명", "해제사유발생일",
            "거래유형", "중개사소재지", "등기일자", "주택유형"]


def log(msg):
    print(msg, file=sys.stderr, flush=True)


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


def pack(deals, meta):
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
    return {
        "v": 1,
        "kind": "singoga-packed",
        "cols": ["sgg", "dong", "apt", "area", "ymd", "price", "floor", "built", "bdong", "type", "cancel"],
        "dict": {k: [s for s, _ in sorted(v.items(), key=lambda kv: kv[1])] for k, v in dicts.items()},
        "rows": rows,
        **meta,
    }


def unchanged(path, packed):
    """거래 내용이 이전 파일과 같으면 True. 갱신 시각만 바뀌는 커밋을 막는다."""
    try:
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
    except (OSError, ValueError):
        return False
    return all(old.get(k) == packed.get(k) for k in ("rows", "dict", "cols", "regions", "range"))


def digest(deals, regions, months, today):
    """지역별 하루치 요약 한 줄씩. 이게 30년 시계열의 재료다.

    가격 통계는 '최근 12개월' 처럼 길이가 고정된 창에서 낸다. 수집 범위(months)를 나중에
    늘리거나 줄여도 예전 줄과 그대로 비교되게 하려는 것이다. 실제로 쓴 창 길이는 칸으로 남긴다.
    """
    window = months[-12:]
    yms = {int(m) for m in window}
    rows = []
    for _, name in regions:
        mine = [d for d in deals if d["sgg"] == name]
        if not mine:
            continue
        recent = [d for d in mine if d["ymd"] // 100 in yms]
        prices = [d["price"] for d in recent]
        units = [d["price"] / d["area"] for d in recent if d["area"]]
        rows.append([
            today, name, len(window), len(recent),
            round(statistics.median(prices)) if prices else "",
            round(statistics.fmean(units), 2) if units else "",
            max(prices) if prices else "",
            len(mine),
            sum(1 for d in mine if d["cancel"]),
            f"{months[0][:4]}-{months[0][4:]}", f"{months[-1][:4]}-{months[-1][4:]}",
        ])
    return rows


def append_history(path, rows, today):
    """이력 CSV 에 오늘 줄을 더한다. 과거 줄은 건드리지 않는다.

    같은 날 두 번 돌려도 오늘 줄만 새것으로 바뀌도록 오늘 날짜만 걷어내고 다시 붙인다.
    임시 파일에 다 쓴 뒤 바꿔치기해서, 중간에 죽어도 기존 이력이 날아가지 않게 한다.
    """
    keep = []
    try:
        with open(path, newline="", encoding="utf-8-sig") as f:
            rd = csv.reader(f)
            head = next(rd, None)
            if head and head != HISTORY_HEAD:
                log(f"{path}: 칸 구성이 예전과 다릅니다. 새 줄을 붙이지 않습니다.")
                return 0
            keep = [r for r in rd if r and r[0] != today]
    except FileNotFoundError:
        pass

    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".csv")
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(HISTORY_HEAD)
            w.writerows(keep)
            w.writerows(rows)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise
    return len(keep) + len(rows)


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
    ap.add_argument("--endpoint", default=os.environ.get("MOLIT_ENDPOINT", DEFAULT_ENDPOINT))
    ap.add_argument("--rows", type=int, default=1000, help="한 번에 받을 건수")
    ap.add_argument("--sleep", type=float, default=0.15, help="호출 간 대기(초)")
    ap.add_argument("--timeout", type=float, default=60)
    ap.add_argument("--tries", type=int, default=3, help="실패 시 재시도 횟수")
    ap.add_argument("--history", default="", help="지역별 하루치 요약을 덧붙일 CSV (예: data/history.csv)")
    ap.add_argument("--max-fail", type=int, default=0, help="허용할 실패 (시군구×월) 수. 넘으면 종료코드 1")
    a = ap.parse_args()
    a.months_set = any(x.startswith("--months") for x in sys.argv)

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
    for code, name in regions:
        got = 0
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
                got += 1
            time.sleep(a.sleep)
        log(f"{name}: {got}건")

    if not deals:
        log("받은 거래가 없습니다. 인증키 승인 상태와 지역 코드를 확인하세요.")
        return 1

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)

    # 거래 내용이 어제와 같은 날에도 이력은 남긴다. 아래 unchanged() 가 먼저 빠져나가 버리면
    # 그 하루가 통째로 비고, 지난 날짜는 나중에 다시 만들 수 없다.
    if a.history:
        today = datetime.now(KST).strftime("%Y-%m-%d")
        rows = digest(deals, regions, months, today)
        total = append_history(a.history, rows, today)
        log(f"{a.history}: {today} {len(rows)}개 지역 기록 · 누적 {total:,}줄")

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
        packed = pack(deals, meta)
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
