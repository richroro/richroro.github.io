#!/usr/bin/env python3
"""1인 콘텐츠 공장 — 아이디어 한 개를 블로그·뉴스레터·유튜브·쇼츠·SNS 로 자동 변환한다.

『AI로 1인 콘텐츠 공장 만들기』의 6단계 파이프라인을 이 저장소에 옮긴 것
  ① 아이디어  ideas/*.md 메모 (사람)
  ② 리서치    핵심·보조 키워드, 검색 의도, 경쟁 글과 다른 각도, 제목 후보 (Claude)
  ③ 생성      블로그 · 뉴스레터 · 유튜브 대본 · 쇼츠 3 · SNS 3 (Claude)
  ④ 디자인    OG/썸네일 PNG 자동 생성(Pillow) + 이미지 생성 도구용 프롬프트
  ⑤ 발행      블로그 자동 게시 + RSS(스티비·메일리 RSS 발송용) + 채널별 원고 파일
  ⑥ 분석      채널별 UTM 링크, GA4 측정 ID(FACTORY_GA4_ID) 가 있으면 블로그에 삽입

파일 흐름

  ideas/<slug>.md  ──①생성(Claude)──▶  out/<slug>.json   (채널별 원고 한 벌, 원본 보관)
                                         │
                                         └─②렌더──▶  /blog/<slug>/index.html   블로그 글 (바로 배포)
                                                     /blog/index.html          글 목록
                                                     /blog/feed.xml            RSS (뉴스레터 도구 RSS→메일 연결용)
                                                     out/<slug>/newsletter.html · newsletter.md
                                                     /blog/<slug>/og.png       공유 썸네일
                                                     out/<slug>/youtube.md · shorts.md · social.md · research.md · design.md
                                                     out/index.json            대시보드(/content-factory/)가 읽는 목록

아이디어 파일 형식 (맨 위 --- 사이는 선택)
  ---
  title: 엑셀 반복 업무, 자동화는 어디서부터
  audience: 매주 같은 보고서를 만드는 직장인
  tone: 친근하지만 과장 없이
  ---
  자유 메모. 말하고 싶은 요지, 사례, 숫자, 반드시 넣을 링크 등.

사용 예
  python content-factory/factory.py                 # 아직 원고가 없는 아이디어만 생성 + 전체 렌더
  python content-factory/factory.py --only excel    # 특정 아이디어만 (다시) 생성
  python content-factory/factory.py --render-only   # API 호출 없이 out/*.json 으로 페이지만 다시 만듦
  python content-factory/factory.py --mock          # API 키 없이 가짜 원고로 파이프라인 점검

생성에는 ANTHROPIC_API_KEY 가 필요하다(GitHub Actions 에서는 저장소 Secret).
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import sys
from email.utils import format_datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IDEAS = os.path.join(HERE, "ideas")
OUT = os.path.join(HERE, "out")
BLOG = os.path.join(ROOT, "blog")
SITE = "https://richroro.github.io"
KST = dt.timezone(dt.timedelta(hours=9))
MODEL = os.environ.get("FACTORY_MODEL", "claude-opus-5")
GA4 = os.environ.get("FACTORY_GA4_ID", "").strip()
FONT_CANDIDATES = [
    os.environ.get("FACTORY_FONT", ""),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]

# ── ① 생성 ────────────────────────────────────────────────────────────────

SYSTEM = """당신은 1인 미디어 운영자의 편집장이다. 아이디어 메모 하나를 받아 여러 채널용 원고를 한 번에 만든다.

순서
1) 리서치: 메모의 주제로 검색하는 사람의 의도를 추정하고, 핵심 키워드 1개·보조 키워드 5~8개를 고른다.
   흔한 글이 무엇을 말할지 떠올리고, 이 글만의 각도를 한 문장으로 정한다. 제목 후보를 3개 낸다.
   (실시간 검색량 데이터는 없으므로 수치를 추정해 적지 않는다.)
2) 생성: 그 각도로 채널별 원고를 쓴다. 블로그 제목·첫 문단·소제목 하나에 핵심 키워드를 자연스럽게 넣는다.
3) 디자인: 썸네일·대표 이미지를 이미지 생성 도구(Midjourney·DALL-E 등)로 만들 수 있게 영어 프롬프트를 쓴다.

원칙
- 한 개의 핵심 메시지를 채널마다 다른 형식으로 다시 쓴다. 채널끼리 문장을 복사하지 않는다.
- 블로그: 검색으로 들어온 사람이 끝까지 읽는 글. 소제목(##)으로 나누고, 구체적인 방법·예시·체크리스트를 준다. 1,800~3,000자.
- 뉴스레터: 구독자에게 보내는 편지. 첫 문장에서 왜 지금 읽어야 하는지 말하고, 블로그 글로 이어지는 링크 자리({{BLOG_URL}})를 한 번 넣는다. 800~1,500자.
- 유튜브: 8~10분 분량 대본. 처음 15초 훅, 장면마다 화면에 무엇을 보여줄지(visual) 함께 적는다.
- 쇼츠: 30~50초 대본 3개. 각각 첫 2초 안에 멈추게 하는 한 줄로 시작.
- SNS: 스레드/인스타/링크드인에 올릴 짧은 글.
- 메모에 없는 통계·고유명사·인용을 지어내지 않는다. 숫자가 필요하면 '예를 들어' 형태의 가정 예시로 쓴다.
- 과장된 수익 약속, 낚시성 제목을 쓰지 않는다. 한국어로 쓴다.
"""

SCHEMA_HINT = """출력은 반드시 아래 JSON 한 개. 다른 말은 쓰지 않는다.
{
  "slug": "영문 소문자-하이픈 URL 조각",
  "research": {"primary_keyword": "", "secondary_keywords": ["", ""], "search_intent": "", "angle": "이 글만의 각도 한 문장", "title_options": ["", "", ""]},
  "design": {"og_headline": "공유 썸네일에 크게 들어갈 문구 22자 이내", "thumbnail_prompt": "영어 이미지 프롬프트", "image_prompts": [""]},
  "blog": {"title": "", "description": "검색 결과용 120자 이내 요약", "tags": ["", ""], "body_md": "마크다운 본문(## 소제목, - 목록, **굵게**, [링크](url) 만 사용)"},
  "newsletter": {"subject": "", "preheader": "", "body_md": ""},
  "youtube": {"title": "", "description": "", "thumbnail_text": "썸네일 문구 12자 이내", "chapters": [{"time": "0:00", "title": ""}],
              "script": [{"section": "", "narration": "", "visual": ""}]},
  "shorts": [{"hook": "", "script": "", "caption": ""}],
  "social": [{"channel": "threads|instagram|linkedin", "text": ""}]
}"""


def parse_idea(path: str) -> dict:
    text = open(path, encoding="utf-8").read()
    meta: dict = {}
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    meta["notes"] = text.strip()
    meta["id"] = os.path.splitext(os.path.basename(path))[0]
    return meta


def generate(idea: dict) -> dict:
    import anthropic

    client = anthropic.Anthropic()
    brief = "\n".join(f"{k}: {v}" for k, v in idea.items() if k not in ("notes", "id") and v)
    user = f"[아이디어]\n{brief}\n\n[메모]\n{idea['notes']}\n\n{SCHEMA_HINT}"
    with client.messages.stream(
        model=MODEL,
        max_tokens=64000,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"모델이 요청을 거절했습니다: {getattr(msg, 'stop_details', None)}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("출력이 max_tokens 에서 잘렸습니다.")
    text = "".join(b.text for b in msg.content if b.type == "text").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    data = json.loads(text)
    validate(data)
    return data


def mock(idea: dict) -> dict:
    t = idea.get("title") or idea["id"]
    return {
        "slug": idea["id"],
        "research": {"primary_keyword": t, "secondary_keywords": ["테스트"], "search_intent": "점검", "angle": "점검", "title_options": [t]},
        "design": {"og_headline": t[:22], "thumbnail_prompt": "test", "image_prompts": []},
        "blog": {"title": t, "description": f"{t} — 점검용 가짜 원고", "tags": ["테스트"],
                 "body_md": f"## 요지\n\n{idea['notes'] or '메모 없음'}\n\n## 체크리스트\n\n- 하나\n- **둘**\n"},
        "newsletter": {"subject": t, "preheader": "점검용", "body_md": "안녕하세요.\n\n[전문 읽기]({{BLOG_URL}})"},
        "youtube": {"title": t, "description": "점검용", "thumbnail_text": "점검",
                    "chapters": [{"time": "0:00", "title": "인트로"}],
                    "script": [{"section": "인트로", "narration": "안녕하세요.", "visual": "제목 카드"}]},
        "shorts": [{"hook": "잠깐!", "script": "점검용 쇼츠", "caption": "#테스트"}],
        "social": [{"channel": "threads", "text": "점검용 글"}],
    }


def validate(d: dict) -> None:
    need = {"blog": ["title", "description", "body_md"], "newsletter": ["subject", "body_md"],
            "youtube": ["title", "script"]}
    for k, fields in need.items():
        for f in fields:
            if not d.get(k, {}).get(f):
                raise ValueError(f"원고에 {k}.{f} 가 없습니다")
    for k in ("shorts", "social"):
        if not isinstance(d.get(k), list):
            raise ValueError(f"원고에 {k} 목록이 없습니다")


# ── ② 렌더 ────────────────────────────────────────────────────────────────

def md_inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\[([^\]]+)\]\(((?:https?://|/)[^)\s]+)\)", r'<a href="\2">\1</a>', s)
    return s


def md_to_html(md: str) -> str:
    """블로그 원고에 쓰는 작은 마크다운(##, ###, -, 1., >, 문단)만 처리한다."""
    out, para, lst = [], [], None

    def flush():
        nonlocal para, lst
        if para:
            out.append("<p>" + "<br>".join(md_inline(x) for x in para) + "</p>")
            para = []
        if lst:
            out.append(f"</{lst}>")
            lst = None

    for raw in md.splitlines():
        line = raw.rstrip()
        m_h = re.match(r"^(#{2,4})\s+(.*)", line)
        m_ul = re.match(r"^\s*[-*]\s+(.*)", line)
        m_ol = re.match(r"^\s*\d+[.)]\s+(.*)", line)
        if not line.strip():
            flush()
        elif m_h:
            flush()
            n = len(m_h.group(1))
            out.append(f"<h{n}>{md_inline(m_h.group(2))}</h{n}>")
        elif m_ul or m_ol:
            tag = "ul" if m_ul else "ol"
            if para:
                out.append("<p>" + "<br>".join(md_inline(x) for x in para) + "</p>")
                para = []
            if lst != tag:
                if lst:
                    out.append(f"</{lst}>")
                out.append(f"<{tag}>")
                lst = tag
            out.append(f"<li>{md_inline((m_ul or m_ol).group(1))}</li>")
        elif line.startswith(">"):
            flush()
            out.append(f"<blockquote>{md_inline(line.lstrip('> '))}</blockquote>")
        else:
            if lst:
                out.append(f"</{lst}>")
                lst = None
            para.append(line.strip())
    flush()
    return "\n".join(out)


CSS = """
:root{--ink:#16161d;--sub:#5b6472;--line:#e7e9ee;--bg:#fff;--soft:#f6f7f9;--acc:#FC1C49}
@media (prefers-color-scheme:dark){:root{--ink:#eceef3;--sub:#a3abb8;--line:#2a2e38;--bg:#111318;--soft:#1a1d24}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;line-height:1.75;letter-spacing:-.2px}
a{color:var(--acc)}.wrap{max-width:720px;margin:0 auto;padding:0 16px}
header.top{border-bottom:1px solid var(--line)}header.top .wrap{display:flex;justify-content:space-between;align-items:center;height:56px}
header.top a{color:var(--ink);text-decoration:none;font-weight:800}header.top nav a{font-weight:600;color:var(--sub);margin-left:16px;font-size:14px}
article h1{font-size:clamp(26px,5vw,36px);line-height:1.3;margin:40px 0 8px}
.meta{color:var(--sub);font-size:14px}.tags span{display:inline-block;background:var(--soft);border-radius:99px;padding:2px 10px;margin:0 6px 6px 0;font-size:13px;color:var(--sub)}
article h2{margin:40px 0 8px;font-size:22px}article h3{margin:28px 0 6px;font-size:18px}
blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid var(--acc);background:var(--soft)}
code{background:var(--soft);padding:1px 5px;border-radius:4px}
.cta{margin:48px 0;padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--soft)}
.list a{display:block;padding:20px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink)}
.list h2{margin:0 0 4px;font-size:20px}.list p{margin:0;color:var(--sub)}
footer{color:var(--sub);font-size:13px;padding:40px 0}
"""


def page(title: str, desc: str, url: str, body: str, og_type: str = "article", og_image: str = f"{SITE}/og.png?v=1") -> str:
    t, d = html.escape(title), html.escape(desc)
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{t}</title>
<meta name="description" content="{d}" />
<meta property="og:type" content="{og_type}" />
<meta property="og:title" content="{t}" />
<meta property="og:description" content="{d}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{og_image}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="{url}" />
<link rel="alternate" type="application/rss+xml" title="Cadence 블로그" href="{SITE}/blog/feed.xml" />
<style>{CSS}</style>
{ga4_tag()}
</head>
<body>
<header class="top"><div class="wrap"><a href="/">Cadence</a><nav><a href="/blog/">블로그</a><a href="/blog/feed.xml">RSS</a></nav></div></header>
<main class="wrap">
{body}
</main>
<footer class="wrap"><strong>AI 활용 표시</strong> · 이 글은 사람이 쓴 아이디어 메모를 생성형 AI 파이프라인(<a href="/content-factory/">콘텐츠 공장</a>)에 넣어 작성했습니다.</footer>
</body>
</html>
"""


def utm(url: str, source: str, slug: str) -> str:
    return f"{url}?utm_source={source}&utm_medium=content-factory&utm_campaign={slug}"


def ga4_tag() -> str:
    if not re.fullmatch(r"G-[A-Z0-9]+", GA4):
        return ""
    return (f'<script async src="https://www.googletagmanager.com/gtag/js?id={GA4}"></script>'
            f"<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}"
            f"gtag('js',new Date());gtag('config','{GA4}');</script>")


def make_og(headline: str, sub: str, path: str) -> bool:
    """④ 디자인 — 1200×630 공유 썸네일. Pillow·한글 글꼴이 없으면 건너뛰고 사이트 기본 og.png 를 쓴다."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    font = next((f for f in FONT_CANDIDATES if f and os.path.exists(f)), None)
    if not font:
        return False
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#1d1233")
    g = ImageDraw.Draw(img)
    g.rectangle([0, 0, 18, H], fill="#FC1C49")
    big, small = ImageFont.truetype(font, 68), ImageFont.truetype(font, 30)
    lines, cur = [], ""
    for ch in headline:
        if g.textlength(cur + ch, font=big) > W - 160:
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    lines.append(cur)
    y = (H - len(lines[:3]) * 90) // 2 - 30
    for ln in lines[:3]:
        g.text((80, y), ln, font=big, fill="#ffffff")
        y += 90
    g.text((80, H - 90), sub, font=small, fill="#9fb4ff")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return True


def write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def render_item(d: dict) -> None:
    slug, b = d["slug"], d["blog"]
    url = f"{SITE}/blog/{slug}/"
    tags = "".join(f"<span>#{html.escape(x)}</span>" for x in b.get("tags", []))
    date = d["created"][:10]
    og = f"{SITE}/og.png?v=1"
    headline = d.get("design", {}).get("og_headline") or b["title"]
    if make_og(headline, "Cadence · richroro.github.io/blog", os.path.join(BLOG, slug, "og.png")):
        og = f"{url}og.png"
    body = f"""<article>
<h1>{html.escape(b['title'])}</h1>
<p class="meta">{date}</p>
<div class="tags">{tags}</div>
{md_to_html(b['body_md'])}
<div class="cta"><strong>이 일, 매주 손으로 하고 계신가요?</strong><br>반복 업무를 코드와 AI에게 넘기는 일을 합니다. 진단·견적은 무료입니다. <a href="/#contact">상담 신청 &rarr;</a></div>
</article>"""
    write(os.path.join(BLOG, slug, "index.html"), page(b["title"], b["description"], url, body, og_image=og))

    n = d["newsletter"]
    nl_md = n["body_md"].replace("{{BLOG_URL}}", utm(url, "newsletter", slug))
    write(os.path.join(OUT, slug, "newsletter.md"), f"# {n['subject']}\n\n> {n.get('preheader','')}\n\n{nl_md}\n")
    write(os.path.join(OUT, slug, "newsletter.html"),
          f"""<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>{html.escape(n['subject'])}</title></head>
<body style="margin:0;background:#f6f7f9"><div style="display:none">{html.escape(n.get('preheader',''))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" style="max-width:600px;background:#fff;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;line-height:1.7;color:#16161d">
<tr><td style="padding:32px 28px">{md_to_html(nl_md)}</td></tr></table></td></tr></table></body></html>
""")

    y = d["youtube"]
    ydesc = y.get("description", "").replace(url, utm(url, "youtube", slug))
    lines = [f"# {y['title']}", "", f"**썸네일 문구:** {y.get('thumbnail_text','')}", "", "## 설명란", "", ydesc, "",
             "> 업로드 시 YouTube '변경되거나 합성된 콘텐츠' 공개 항목을 확인하세요(AI 음성·영상 사용 시).", ""]
    if y.get("chapters"):
        lines += ["## 챕터", ""] + [f"{c['time']} {c['title']}" for c in y["chapters"]] + [""]
    lines += ["## 대본", ""]
    for s in y["script"]:
        lines += [f"### {s.get('section','')}", "", f"🎬 화면: {s.get('visual','')}", "", s.get("narration", ""), ""]
    write(os.path.join(OUT, slug, "youtube.md"), "\n".join(lines))

    sh = []
    for i, s in enumerate(d["shorts"], 1):
        sh += [f"## 쇼츠 {i}", "", f"**훅:** {s.get('hook','')}", "", s.get("script", ""), "", f"캡션: {s.get('caption','')}", ""]
    write(os.path.join(OUT, slug, "shorts.md"), "# 쇼츠 대본\n\n" + "\n".join(sh))
    so = []
    for s in d["social"]:
        ch = s.get("channel", "")
        so += [f"## {ch}", "", s.get("text", "").replace(url, utm(url, ch or "social", slug)), ""]
    write(os.path.join(OUT, slug, "social.md"), "# SNS 글\n\n" + "\n".join(so))

    r = d.get("research", {})
    write(os.path.join(OUT, slug, "research.md"), "\n".join([
        "# 리서치", "", f"**핵심 키워드:** {r.get('primary_keyword','')}", "",
        f"**보조 키워드:** {', '.join(r.get('secondary_keywords', []))}", "",
        f"**검색 의도:** {r.get('search_intent','')}", "", f"**이 글의 각도:** {r.get('angle','')}", "",
        "## 제목 후보", ""] + [f"- {t}" for t in r.get("title_options", [])] + [
        "", "> 검색량은 네이버 데이터랩·블랙키위 등에서 직접 확인하세요. 모델은 수치를 추정하지 않도록 되어 있습니다.", ""]))
    ds = d.get("design", {})
    write(os.path.join(OUT, slug, "design.md"), "\n".join([
        "# 디자인", "", f"**공유 썸네일 문구:** {ds.get('og_headline','')}", "",
        f"공유 썸네일(자동 생성): {og}", "", "## 유튜브 썸네일 프롬프트", "", ds.get("thumbnail_prompt", ""), "",
        "## 본문 이미지 프롬프트", ""] + [f"- {p}" for p in ds.get("image_prompts", [])] + [""]))


def render_all() -> list[dict]:
    items = []
    for f in sorted(os.listdir(OUT)) if os.path.isdir(OUT) else []:
        if f.endswith(".json") and f != "index.json":
            items.append(json.load(open(os.path.join(OUT, f), encoding="utf-8")))
    items.sort(key=lambda d: d["created"], reverse=True)
    for d in items:
        render_item(d)

    lst = "".join(
        f'<a href="/blog/{d["slug"]}/"><h2>{html.escape(d["blog"]["title"])}</h2>'
        f'<p>{html.escape(d["blog"]["description"])}</p><p class="meta">{d["created"][:10]}</p></a>'
        for d in items) or "<p>아직 글이 없습니다.</p>"
    write(os.path.join(BLOG, "index.html"),
          page("Cadence 블로그 · 업무 자동화 노트", "반복 업무를 코드와 AI에게 넘기는 방법을 기록합니다.",
               f"{SITE}/blog/", f'<h1 style="margin:40px 0 8px">블로그</h1><div class="list">{lst}</div>', "website"))

    rss_items = "".join(f"""
  <item>
    <title>{html.escape(d['blog']['title'])}</title>
    <link>{SITE}/blog/{d['slug']}/</link>
    <guid>{SITE}/blog/{d['slug']}/</guid>
    <pubDate>{format_datetime(dt.datetime.fromisoformat(d['created']))}</pubDate>
    <description>{html.escape(d['blog']['description'])}</description>
  </item>""" for d in items)
    write(os.path.join(BLOG, "feed.xml"), f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Cadence 블로그</title>
  <link>{SITE}/blog/</link>
  <description>반복 업무를 코드와 AI에게 넘기는 방법</description>
  <language>ko</language>{rss_items}
</channel>
</rss>
""")

    index = [{"slug": d["slug"], "idea": d.get("idea"), "created": d["created"], "model": d.get("model"),
              "title": d["blog"]["title"], "description": d["blog"]["description"],
              "keyword": d.get("research", {}).get("primary_keyword", ""),
              "newsletter": d["newsletter"]["subject"], "youtube": d["youtube"]["title"],
              "shorts": len(d["shorts"]), "social": len(d["social"])} for d in items]
    write(os.path.join(OUT, "index.json"), json.dumps({"items": index}, ensure_ascii=False, indent=1) + "\n")
    update_sitemap([d["slug"] for d in items])
    return items


def update_sitemap(slugs: list[str]) -> None:
    path = os.path.join(ROOT, "sitemap.xml")
    if not os.path.exists(path):
        return
    xml = open(path, encoding="utf-8").read()
    today = dt.datetime.now(KST).strftime("%Y-%m-%d")
    urls = [f"{SITE}/blog/", f"{SITE}/content-factory/"] + [f"{SITE}/blog/{s}/" for s in slugs]
    add = "".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod><priority>0.6</priority></url>\n"
                  for u in urls if f"<loc>{u}</loc>" not in xml)
    if add:
        write(path, xml.replace("</urlset>", add + "</urlset>"))


# ── 실행 ──────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="이 아이디어 파일(확장자 뺀 이름)만 다시 생성")
    ap.add_argument("--render-only", action="store_true", help="API 호출 없이 렌더만")
    ap.add_argument("--mock", action="store_true", help="API 없이 가짜 원고로 점검")
    a = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    done = {json.load(open(os.path.join(OUT, f), encoding="utf-8")).get("idea")
            for f in os.listdir(OUT) if f.endswith(".json") and f != "index.json"}
    ideas = [parse_idea(os.path.join(IDEAS, f)) for f in sorted(os.listdir(IDEAS)) if f.endswith(".md")]
    if a.only:
        todo = [i for i in ideas if i["id"] == a.only]
    else:
        todo = [i for i in ideas if i["id"] not in done]
    if a.only and not todo:
        print(f"아이디어 '{a.only}' 를 찾지 못했습니다.", file=sys.stderr)
        return 1

    made = 0
    if not a.render_only:
        if todo and not a.mock and not os.environ.get("ANTHROPIC_API_KEY"):
            print("ANTHROPIC_API_KEY 가 없어 생성을 건너뜁니다. 렌더만 합니다.")
            todo = []
        for idea in todo:
            print(f"생성: {idea['id']} …", flush=True)
            d = mock(idea) if a.mock else generate(idea)
            d["slug"] = re.sub(r"[^a-z0-9-]+", "-", (d.get("slug") or idea["id"]).lower()).strip("-") or idea["id"]
            d["idea"] = idea["id"]
            d["created"] = dt.datetime.now(KST).isoformat(timespec="seconds")
            d["model"] = "mock" if a.mock else MODEL
            write(os.path.join(OUT, f"{d['slug']}.json"), json.dumps(d, ensure_ascii=False, indent=1) + "\n")
            made += 1

    items = render_all()
    print(f"새로 생성 {made}건 · 전체 {len(items)}건 렌더 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
