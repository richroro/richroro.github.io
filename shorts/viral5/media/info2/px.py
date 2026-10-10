"""helper for the specs: a Pexels source record (page opened, licence "Free" = Pexels License, creator from the page)"""
import re
def px(url, creator, used=""):
    vid = re.search(r"(\d+)/?$", url).group(1)
    return {"file": f"px{vid}.mp4", "credit": "영상: Pexels", "label": f"Pexels video {vid} by {creator} (Pexels License)", "url": url,
            "license": "Pexels License (free to use, no attribution required; checked on the item page 2026-10-10)", "creator": creator,
            "fileUrl": f"https://www.pexels.com/download/video/{vid}/"}
