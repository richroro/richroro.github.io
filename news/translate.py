"""영어 경제뉴스 제목·요약을 한국어로 옮긴다 (Claude API).

fetch_news.py 가 ANTHROPIC_API_KEY 가 있을 때만 부른다. 기사 dict 에 title_ko, summary_ko 를 채운다.
한 번에 BATCH 건씩 JSON 으로 보내고, 구조화 출력(json_schema)으로 같은 모양의 JSON 을 받는다.

  모델   환경 변수 NEWS_TRANSLATE_MODEL (기본 claude-opus-5-5)
  필요   pip install anthropic
"""
from __future__ import annotations

import json
import os

import anthropic

MODEL = os.environ.get("NEWS_TRANSLATE_MODEL") or "claude-opus-5-5"
BATCH = 25

SYSTEM = """You translate English economic and financial news into Korean for Korean readers.

Write each title the way a Korean economic newspaper would headline it: short, natural, no trailing period
(e.g. "연준, 기준금리 동결…연내 두 차례 인하 시사"). Translate the summary as one or two plain Korean sentences.
Use the Korean names Korean media use for companies, people and institutions (Nvidia → 엔비디아, Federal Reserve/Fed → 연준,
ECB → 유럽중앙은행, Treasury yields → 미 국채 금리, S&P 500 → S&P500). Keep tickers and widely used acronyms (GDP, CPI, ETF, AI).
Keep every number, unit and direction exactly as in the source; do not add facts, opinions or context that is not in the text.
If a summary is empty, return an empty string for it. Return exactly one entry per input id."""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["id", "title", "summary"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def _request(client, batch: list[dict]) -> dict[str, dict]:
    payload = [{"id": it["id"], "title": it["title"], "summary": it.get("summary", "")} for it in batch]
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        # 안전 분류기가 거절하면 서버가 알맞은 다른 모델로 다시 돌린다
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        system=SYSTEM,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("번역 요청이 거절됨")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("출력이 잘림 (max_tokens)")
    text = next(b.text for b in response.content if b.type == "text")
    return {row["id"]: row for row in json.loads(text)["items"]}


def translate_items(items: list[dict], client=None, log=print) -> int:
    """items 의 각 기사에 title_ko·summary_ko 를 넣는다. 옮긴 건수를 돌려준다.

    한 묶음이 실패하면 그 묶음은 영어로 두고 다음 묶음으로 넘어간다(다음 실행에서 다시 시도).
    요청 한도·인증·연결 문제는 남은 묶음도 똑같이 실패하므로 바로 멈춘다.
    """
    client = client or anthropic.Anthropic(max_retries=3, timeout=120.0)
    done = 0
    for start in range(0, len(items), BATCH):
        batch = items[start:start + BATCH]
        try:
            rows = _request(client, batch)
        except (anthropic.RateLimitError, anthropic.AuthenticationError, anthropic.PermissionDeniedError,
                anthropic.APIConnectionError) as ex:
            log(f"  ✗ 번역 중단 {type(ex).__name__}: {ex}"[:200])
            break
        except (anthropic.APIStatusError, RuntimeError, ValueError, KeyError, StopIteration) as ex:
            log(f"  ✗ 번역 묶음 실패 {type(ex).__name__}: {ex}"[:200])
            continue
        for it in batch:
            row = rows.get(it["id"])
            if not row or not row.get("title", "").strip():
                continue
            it["title_ko"] = row["title"].strip()
            if it.get("summary") and row.get("summary", "").strip():
                it["summary_ko"] = row["summary"].strip()
            done += 1
    return done
