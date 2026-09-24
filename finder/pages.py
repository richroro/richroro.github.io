#!/usr/bin/env python3
"""종목별 고정 주소 페이지(/finder/s/<티커>/)와 finder/sitemap.xml 을 만든다.

검색엔진은 /finder/#s=AAPL 같은 해시 주소를 따로 색인하지 않는다. 그래서 시총 상위 종목마다
작은 HTML 을 두고, 본문은 app.js 가 data/stocks.json 에서 그린다.

페이지에는 **매일 바뀌는 숫자를 넣지 않는다**(이름·업종·거래소만). 그래야 매일 갱신해도
파일이 바뀌지 않아 커밋이 커지지 않는다. 내용이 같으면 파일을 다시 쓰지 않는다.

  python finder/pages.py                # data/stocks.json 기준으로 갱신
  python finder/pages.py --us 500 --kr 300
"""
from __future__ import annotations

import argparse
import html
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://richroro.github.io"
EX_KO = {"NASDAQ": "나스닥", "NYSE": "뉴욕증권거래소", "AMEX": "NYSE 아메리칸",
         "KOSPI": "코스피", "KOSDAQ": "코스닥", "KONEX": "코넥스"}

TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="전 종목 탐색기">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{site}/stocks/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14161C">
<link rel="manifest" href="/finder/manifest.webmanifest">
<link rel="icon" href="/finder/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/finder/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&display=swap">
<link rel="stylesheet" href="/m7/assets/m7.css">
<link rel="stylesheet" href="/finder/finder.css">
<script>try{{const t=JSON.parse(localStorage.getItem("m7.theme"));if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<script type="application/ld+json">{ld}</script>
</head>
<body data-page="stock" data-id="{id_attr}">
<header><div class="wrap hbar">
  <a class="brand" href="/finder/"><span class="mk">⌕</span>
    <span><b>전 종목 탐색기</b><small>미국·한국 상장 주식 검색과 분석</small></span></a>
  <div class="hactions"><button class="ghost" id="themeBtn" type="button" aria-label="화면 테마 전환"><span id="themeIco">◐</span><span id="themeTxt">테마</span></button></div>
</div></header>
<main><div class="wrap">
  <nav class="crumbs" aria-label="위치"><a href="/finder/">전 종목 탐색기</a> › <a href="/finder/?m={grp}&amp;x={m}">{ex_ko}</a>{sec_crumb} › <span>{name}</span></nav>
  <div class="sbox mini" id="sbox" role="combobox" aria-haspopup="listbox" aria-owns="sres" aria-expanded="false">
    <label class="sfield"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="다른 종목 찾기" aria-label="종목 검색" aria-controls="sres"></label>
    <div class="sres" id="sres" role="listbox" hidden></div>
  </div>
  <article id="page" class="page-detail">
    <h1 class="page-h1">{name} <small>{m}:{id}</small></h1>
    <p class="hint">{summary}</p>
    <noscript><p>이 페이지의 시세와 분석은 자바스크립트로 그립니다.</p></noscript>
    <div class="loading"><span class="spin"></span>불러오는 중…</div>
  </article>
</div></main>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<footer><div class="wrap"><p class="disc">전 거래일 종가 기준의 참고 자료이며 투자 권유가 아닙니다. 데이터 출처와 갱신 방법은 <a href="/finder/#how">전 종목 탐색기</a>에 있습니다.</p></div></footer>
<script src="/stocks/assets/registry.js"></script>
<script src="/finder/app.js"></script>
</body>
</html>
"""


def page_html(r: dict) -> str:
    kos = [x for x in (r.get("ko") or "").split("|") if x]
    grp = "KR" if r["m"] in ("KOSPI", "KOSDAQ", "KONEX") else "US"
    name = r["n"] if grp == "KR" else (kos[0] if kos else r["n"])
    also = "" if grp == "KR" else (f" · {r['n']}" if kos else "")
    ex_ko = EX_KO.get(r["m"], r["m"])
    bits = [x for x in (r.get("sec"), r.get("ind")) if x]
    desc = (f"{name}({ex_ko} {r['id']}{also}) 주가 흐름, 1년 수익률, 추세·RSI·변동성, PER·PBR·배당, "
            f"같은 업종 비교를 한 화면에서.{' 업종: ' + ' · '.join(bits) + '.' if bits else ''}")
    url = f"{SITE}/finder/s/{r['id']}/"
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": f"{name} 주가 분석", "url": url,
          "about": {"@type": "Corporation", "name": r["n"], "tickerSymbol": f"{r['m']}:{r['id']}"},
          "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "전 종목 탐색기", "item": f"{SITE}/finder/"},
              {"@type": "ListItem", "position": 2, "name": name, "item": url}]}}
    e = html.escape
    sec_crumb = (f' › <a href="/finder/?m={grp}&amp;sec={e(r["sec"], quote=True)}">{e(r["sec"])}</a>'
                 if r.get("sec") else "")
    return TEMPLATE.format(
        title=e(f"{name} ({r['id']}) 주가·차트·분석 | 전 종목 탐색기"), desc=e(desc), url=url, site=SITE,
        og_title=e(f"{name} ({r['id']}) — 전 종목 탐색기"),
        ld=json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c"),  # 이름에 </script> 가 있어도 안전하게
        id_attr=e(r["id"], quote=True), grp=grp, m=r["m"], id=e(r["id"]), ex_ko=e(ex_ko),
        sec_crumb=sec_crumb, name=e(name),
        summary=e(f"{ex_ko} 상장{' · ' + ' · '.join(bits) if bits else ''}{also}"),
    )


def write_if_changed(path: str, text: str) -> bool:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            if f.read() == text:
                return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "data", "stocks.json"))
    ap.add_argument("--us", type=int, default=500, help="미국 시총 상위 몇 곳")
    ap.add_argument("--kr", type=int, default=300, help="한국 시총 상위 몇 곳")
    a = ap.parse_args()

    with open(a.data, encoding="utf-8") as f:
        d = json.load(f)
    cols = d["meta"]["cols"]
    rows = [dict(zip(cols, v)) for v in d["rows"]]
    by_id = {r["id"]: r for r in rows}
    out_dir = os.path.join(HERE, "s")
    existing = set(os.listdir(out_dir)) if os.path.isdir(out_dir) else set()

    # 새로 들이는 기준은 시총 순위, 한 번 생긴 페이지는 상장폐지 전까지 유지한다(순위 경계에서 들락날락하지 않게)
    pick = []
    for grp, n in (("US", a.us), ("KR", a.kr)):
        rs = [r for r in rows if (r["m"] in ("KOSPI", "KOSDAQ", "KONEX")) == (grp == "KR") and r.get("mcu")]
        rs.sort(key=lambda r: -r["mcu"])
        pick += [r["id"] for r in rs[:n]]
    ids = sorted(set(pick) | {i for i in existing if i in by_id})

    changed = 0
    for i in ids:
        changed += write_if_changed(os.path.join(out_dir, i, "index.html"), page_html(by_id[i]))
    removed = [i for i in existing if i not in by_id]
    for i in removed:
        shutil.rmtree(os.path.join(out_dir, i), ignore_errors=True)

    urls = [f"{SITE}/finder/"] + [f"{SITE}/finder/s/{i}/" for i in ids]
    sm = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f"  <url><loc>{html.escape(u)}</loc></url>\n" for u in urls) + "</urlset>\n")
    write_if_changed(os.path.join(HERE, "sitemap.xml"), sm)
    write_if_changed(os.path.join(HERE, "data", "pages.json"), json.dumps(ids, separators=(",", ":")) + "\n")
    print(f"종목 페이지 {len(ids)}개 (새로 쓰거나 바뀐 것 {changed}, 삭제 {len(removed)})")


if __name__ == "__main__":
    main()
