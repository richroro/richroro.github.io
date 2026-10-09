"""API 키 없이 영어 기사 제목을 한국어로 옮긴다 (무료 기계 번역).

Google 번역 웹이 쓰는 공개 주소(translate.googleapis.com, client=gtx)를 부른다. 공식 API 가 아니라서
요청이 많으면 막히거나(429) 어느 날 바뀔 수 있다. 실패한 제목은 영어로 두고 다음 실행에서 다시 시도한다.
표준 라이브러리만 쓴다. fetch_news.py 가 ANTHROPIC_API_KEY 가 없을 때 부른다.

제목 여러 개를 줄바꿈으로 이어 한 번에 보내고, 돌아온 번역을 다시 줄 단위로 나눈다.
줄 수가 어긋나면 그 묶음만 제목 하나씩 다시 보낸다.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

URL = "https://translate.googleapis.com/translate_a/single"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
MAX_CHARS = 1500     # 한 번에 보낼 글자 수 (주소 길이 한도 안쪽)
PAUSE = 0.4          # 요청 사이 쉬는 시간(초) — 막히지 않게


class Blocked(Exception):
    """요청 한도·차단. 남은 묶음도 똑같이 실패하므로 이번 실행은 멈춘다."""


def _http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except urllib.error.HTTPError as ex:
        if ex.code in (403, 429, 503):
            raise Blocked(f"HTTP {ex.code}") from ex
        raise


def _translate(text: str, http_get) -> str:
    qs = urllib.parse.urlencode({"client": "gtx", "sl": "en", "tl": "ko", "dt": "t", "q": text})
    data = json.loads(http_get(URL + "?" + qs))
    # [[["번역문", "원문", …], …], …] — 문장마다 조각으로 온다
    return "".join(seg[0] for seg in (data[0] or []) if seg and isinstance(seg[0], str))


def _batches(items: list[dict]) -> list[list[dict]]:
    out, cur, size = [], [], 0
    for it in items:
        n = len(it["title"]) + 1
        if cur and size + n > MAX_CHARS:
            out.append(cur)
            cur, size = [], 0
        cur.append(it)
        size += n
    if cur:
        out.append(cur)
    return out


def translate_titles(items: list[dict], http_get=None, log=print, pause: float = PAUSE) -> int:
    """items 의 각 기사에 title_ko 를 넣는다. 옮긴 건수를 돌려준다."""
    http_get = http_get or _http_get
    done = 0
    for n, batch in enumerate(_batches(items)):
        if n and pause:
            time.sleep(pause)
        titles = [" ".join(it["title"].split()) for it in batch]   # 제목 안의 줄바꿈은 없앤다
        try:
            lines = [s.strip() for s in _translate("\n".join(titles), http_get).split("\n")]
            if len(lines) != len(batch):
                # 번역기가 줄을 합치거나 나눴다 — 이 묶음은 하나씩 다시
                lines = []
                for t in titles:
                    if pause:
                        time.sleep(pause)
                    lines.append(_translate(t, http_get).strip())
        except Blocked as ex:
            log(f"  ✗ 무료 번역 중단 ({ex}) — 남은 제목은 다음 실행에서")
            break
        except (OSError, ValueError, IndexError, TypeError) as ex:
            log(f"  ✗ 무료 번역 묶음 실패 {type(ex).__name__}: {ex}"[:200])
            continue
        for it, ko in zip(batch, lines):
            if ko:
                it["title_ko"] = ko
                done += 1
    return done
