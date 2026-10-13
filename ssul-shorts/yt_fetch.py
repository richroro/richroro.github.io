"""유튜브 영상 링크 → 제목·썸네일·인기 댓글.

YOUTUBE_API_KEY 가 있으면 YouTube Data API v3, 없으면 yt-dlp 로 가져온다.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://www.googleapis.com/youtube/v3/"


def video_id(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([\w-]{11})", url)
    if m:
        return m.group(1)
    if re.fullmatch(r"[\w-]{11}", url):
        return url
    raise ValueError(f"유튜브 영상 ID 를 찾을 수 없습니다: {url}")


def ago(ts: float | str | None) -> str:
    """'3일 전' 같은 유튜브식 상대 시간."""
    if ts is None:
        return ""
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    s = max(0, datetime.now(timezone.utc).timestamp() - float(ts))
    for unit, sec in (("년", 31536000), ("개월", 2592000), ("주", 604800), ("일", 86400),
                      ("시간", 3600), ("분", 60)):
        if s >= sec:
            return f"{int(s // sec)}{unit} 전"
    return "방금 전"


def _get(endpoint: str, **params) -> dict:
    params["key"] = os.environ["YOUTUBE_API_KEY"]
    url = API + endpoint + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.load(r)


def _via_api(vid: str, limit: int) -> dict:
    v = _get("videos", part="snippet,statistics", id=vid)["items"][0]
    data = _get("commentThreads", part="snippet", videoId=vid, order="relevance",
                maxResults=min(100, limit), textFormat="plainText")
    comments = []
    for it in data.get("items", []):
        top = it["snippet"]["topLevelComment"]["snippet"]
        comments.append({"user": top["authorDisplayName"], "text": top["textDisplay"],
                         "likes": int(top.get("likeCount", 0)), "time": ago(top.get("publishedAt")),
                         "replies": int(it["snippet"].get("totalReplyCount", 0))})
    return {"title": v["snippet"]["title"], "channel": v["snippet"]["channelTitle"],
            "comment_count": int(v.get("statistics", {}).get("commentCount", 0) or 0),
            "comments": comments}


def _via_ytdlp(vid: str, limit: int) -> dict:
    exe = shutil.which("yt-dlp")
    cmd = [exe] if exe else ["python3", "-m", "yt_dlp"]
    r = subprocess.run(cmd + ["--skip-download", "--write-comments", "-J", "--no-warnings",
                              "--extractor-args", f"youtube:comment_sort=top;max_comments={limit * 2},all,0",
                              f"https://www.youtube.com/watch?v={vid}"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("yt-dlp 실패: " + r.stderr.strip()[-400:])
    info = json.loads(r.stdout)
    replies: dict[str, int] = {}
    for c in info.get("comments") or []:
        if c.get("parent", "root") != "root":
            replies[c["parent"]] = replies.get(c["parent"], 0) + 1
    comments = [{"user": c.get("author", "user"), "text": c.get("text", ""),
                 "likes": int(c.get("like_count") or 0),
                 "time": c.get("_time_text") or ago(c.get("timestamp")),
                 "replies": replies.get(c.get("id"), 0)}
                for c in info.get("comments") or [] if c.get("parent", "root") == "root"]
    return {"title": info.get("title", ""), "channel": info.get("channel", ""),
            "comment_count": int(info.get("comment_count") or len(comments)), "comments": comments}


def fetch(url: str, work: Path, limit: int = 8, max_len: int = 90) -> dict:
    """인기 댓글 limit 개(너무 긴 댓글 제외) + 썸네일 경로."""
    vid = video_id(url)
    data = _via_api(vid, 100) if os.environ.get("YOUTUBE_API_KEY") else _via_ytdlp(vid, 60)
    pool = [c for c in data["comments"] if 2 <= len(c["text"].strip()) <= max_len]
    pool.sort(key=lambda c: -c["likes"])
    for c in pool:
        c["text"] = " ".join(c["text"].split())     # 줄바꿈 정리
    data["comments"] = pool[:limit]
    thumb = work / "thumb.jpg"
    for name in ("maxresdefault", "hqdefault"):
        try:
            urllib.request.urlretrieve(f"https://i.ytimg.com/vi/{vid}/{name}.jpg", thumb)
            data["thumb"] = str(thumb)
            break
        except Exception:
            continue
    return data
