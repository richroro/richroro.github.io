#!/usr/bin/env python3
"""구글 드라이브에서 원본 영상(·배경음·레퍼런스)을 받는다.

    python3 fetch_drive.py <드라이브 링크 | 파일/폴더 ID | 로컬 경로> --out inbox/

받는 방법 (위에서부터 되는 것):
  1. 로컬 경로면 그대로 복사
  2. GOOGLE_DRIVE_TOKEN (OAuth 액세스 토큰) → 비공개 파일도 가능
  3. GOOGLE_API_KEY + "링크가 있는 모든 사용자" 공유 → www.googleapis.com/drive/v3 로 받기
  4. 키 없이 공개 다운로드 주소 (drive.usercontent.google.com — 네트워크 정책에 막힐 수 있음)

폴더 링크면: 영상 파일은 전부 받고(최신순), 'bgm'·'음악' 폴더/이름의 오디오는 배경음으로,
'ref'·'레퍼런스' 폴더의 영상은 레퍼런스로 따로 모은다. 결과는 inbox/manifest.json.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://www.googleapis.com/drive/v3"
LATEST_ONLY = False
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi")
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac")


def drive_id(s: str) -> tuple[str, str | None]:
    """(id, 'folder'|'file'|None)"""
    for rx, kind in [(r"/folders/([\w-]{10,})", "folder"), (r"/file/d/([\w-]{10,})", "file"),
                     (r"[?&]id=([\w-]{10,})", None), (r"^([\w-]{20,})$", None)]:
        m = re.search(rx, s)
        if m:
            return m.group(1), kind
    raise SystemExit(f"드라이브 링크/ID 를 알아볼 수 없습니다: {s}")


def _ctx():
    return ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)


def _req(url: str, params: dict | None = None):
    token, key = os.environ.get("GOOGLE_DRIVE_TOKEN"), os.environ.get("GOOGLE_API_KEY")
    params = dict(params or {})
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    elif key:
        params["key"] = key
    params.setdefault("supportsAllDrives", "true")
    full = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    return urllib.request.urlopen(urllib.request.Request(full, headers=headers), timeout=900, context=_ctx())


def meta(fid: str) -> dict:
    with _req(f"{API}/files/{fid}", {"fields": "id,name,mimeType,size,modifiedTime,parents"}) as r:
        return json.load(r)


def children(fid: str) -> list[dict]:
    out, page = [], None
    while True:
        p = {"q": f"'{fid}' in parents and trashed=false", "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
             "pageSize": "200", "includeItemsFromAllDrives": "true", "orderBy": "modifiedTime desc"}
        if page:
            p["pageToken"] = page
        with _req(f"{API}/files", p) as r:
            d = json.load(r)
        out += d.get("files", [])
        page = d.get("nextPageToken")
        if not page:
            return out


def download(f: dict, folder: str) -> str:
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, re.sub(r"[\\/:*?\"<>|]", "_", f["name"]))
    if os.path.exists(path) and f.get("size") and os.path.getsize(path) == int(f["size"]):
        return path
    size = int(f.get("size") or 0)
    print(f"  받는 중: {f['name']} ({size / 1e6:.0f}MB)" if size else f"  받는 중: {f['name']}")
    try:
        r = _req(f"{API}/files/{f['id']}", {"alt": "media"})
    except urllib.error.HTTPError as e:
        if os.environ.get("GOOGLE_DRIVE_TOKEN") or os.environ.get("GOOGLE_API_KEY"):
            raise
        r = urllib.request.urlopen(f"https://drive.usercontent.google.com/download?id={f['id']}&export=download&confirm=t",
                                   timeout=900, context=_ctx())
    with r, open(path + ".part", "wb") as o:
        shutil.copyfileobj(r, o, 1 << 22)
    os.replace(path + ".part", path)
    return path


def kind_of(f: dict) -> str:
    n, m = f["name"].lower(), f.get("mimeType", "")
    if m == "application/vnd.google-apps.folder":
        return "folder"
    if m.startswith("video/") or n.endswith(VIDEO_EXT):
        return "video"
    if m.startswith("audio/") or n.endswith(AUDIO_EXT):
        return "audio"
    return "other"


def fetch(src: str, out: str) -> dict:
    man = {"videos": [], "bgm": [], "references": [], "source": src}
    if os.path.exists(src):
        dst = os.path.join(out, os.path.basename(src))
        os.makedirs(out, exist_ok=True)
        if os.path.abspath(dst) != os.path.abspath(src):
            shutil.copy2(src, dst)
        man["videos"].append(dst)
        return man
    fid, kind = drive_id(src)
    if not (os.environ.get("GOOGLE_DRIVE_TOKEN") or os.environ.get("GOOGLE_API_KEY")):
        print("  (GOOGLE_API_KEY 없음 → 공개 다운로드 주소로 시도)", file=sys.stderr)
        if kind == "folder":
            raise SystemExit("폴더 링크는 GOOGLE_API_KEY 나 GOOGLE_DRIVE_TOKEN 이 있어야 목록을 볼 수 있습니다")
        man["videos"].append(download({"id": fid, "name": f"{fid}.mp4"}, out))
        return man
    m = meta(fid)
    if kind_of(m) != "folder":
        bucket = "videos" if kind_of(m) == "video" else "bgm" if kind_of(m) == "audio" else "videos"
        man[bucket].append(download(m, out))
        return man
    for f in children(fid):
        k, n = kind_of(f), f["name"].lower()
        if k == "folder":
            sub = "references" if re.search(r"ref|레퍼런스|참고", n) else "bgm" if re.search(r"bgm|음악|music", n) else None
            if sub:
                for g in children(f["id"]):
                    if kind_of(g) in ("video", "audio"):
                        man[sub].append(download(g, os.path.join(out, sub)))
        elif k == "video":
            target = "references" if re.search(r"^ref|레퍼런스|참고", n) else "videos"
            if target == "videos" and LATEST_ONLY and man["videos"]:
                continue  # 목록은 최신순이라 첫 영상이 가장 최근
            man[target].append(download(f, os.path.join(out, "references") if target == "references" else out))
        elif k == "audio":
            man["bgm"].append(download(f, os.path.join(out, "bgm")))
    return man


def main():
    p = argparse.ArgumentParser(description="구글 드라이브에서 영상 받기")
    p.add_argument("source", nargs="?", default="inbox",
                   help="드라이브 파일/폴더 링크, ID, 로컬 경로. 생략하면 규칙집에 저장한 영상함 폴더(drive.inbox)")
    p.add_argument("--out", default="inbox")
    p.add_argument("--latest", action="store_true", help="폴더에서 가장 최근 영상 하나만 받기 (영상함 기본)")
    a = p.parse_args()
    if a.source == "inbox":
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from common import load_rules
        a.source = (load_rules().get("drive") or {}).get("inbox")
        a.latest = True
        if not a.source:
            sys.exit("영상함 폴더가 아직 없습니다: rules.json 의 drive.inbox 에 드라이브 폴더 링크를 저장하세요 (SKILL.md 'Google 드라이브 연결')")
    global LATEST_ONLY
    LATEST_ONLY = a.latest
    try:
        man = fetch(a.source, a.out)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        hint = {403: "공유 설정이 '링크가 있는 모든 사용자'인지, API 키에 Google Drive API 가 켜져 있는지 확인",
                404: "파일이 없거나 공유되지 않음 — '링크가 있는 모든 사용자 · 뷰어'로 공유했는지 확인"}.get(e.code, "")
        sys.exit(f"드라이브 오류 {e.code}: {hint}\n{body}")
    except urllib.error.URLError as e:
        sys.exit(f"드라이브 접속 실패: {e} — 이 환경의 네트워크 정책이 www.googleapis.com 을 막고 있는지 확인")
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
    print(json.dumps(man, ensure_ascii=False, indent=2))
    if not man["videos"]:
        sys.exit("영상 파일을 찾지 못했습니다")


if __name__ == "__main__":
    main()
