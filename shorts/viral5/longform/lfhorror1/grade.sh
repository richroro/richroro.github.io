#!/usr/bin/env bash
# Download (Pexels) and grade lfhorror1's stock into public/lfhorror1/ (git-ignored).
# usage: longform/lfhorror1/grade.sh   (reads longform/lfhorror1/sources.json)
#   videos: first 30 s, cropped to 16:9, 1920x1080, 30 fps, muted, the [괴담] dark grade
#   photos: 1920 px wide-ish jpg, slightly darker and colder
#   fonts: Nanum Pen Script / Nanum Gothic Coding (OFL, google/fonts)
set -euo pipefail
cd "$(dirname "$0")/../.."
DL=build/lfhorror1/dl; P=public/lfhorror1; mkdir -p "$DL/vid" "$DL/photo" "$P/v" "$P/ph" "$P/fonts"
UA="richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
GRADE="eq=gamma=0.8:contrast=1.08:saturation=0.5,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/4.5"
SOFT="eq=saturation=0.6,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/5"
python3 -c "import json; [print(s['kind'], s['id'], s.get('dark', 0)) for s in json.load(open('longform/lfhorror1/sources.json'))['stock']]" |
while read -r kind id dark; do
  if [ "$kind" = video ]; then
    out="$P/v/$id.mp4"; [ -s "$out" ] && continue
    raw="$DL/vid/$id.mp4"; [ -s "$raw" ] || curl -sSfL -A "$UA" -o "$raw" "https://www.pexels.com/download/video/$id/"
    g=$GRADE; [ "$dark" = 1 ] && g=$SOFT
    ffmpeg -nostdin -v error -y -i "$raw" -t 30 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,$g" -an -c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p "$out"
  else
    out="$P/ph/$id.jpg"; [ -s "$out" ] && continue
    raw="$DL/photo/$id.jpg"; [ -s "$raw" ] || curl -sSfL -A "$UA" -o "$raw" "https://images.pexels.com/photos/$id/pexels-photo-$id.jpeg?auto=compress&cs=tinysrgb&w=1920"
    ffmpeg -nostdin -v error -y -i "$raw" -vf "scale='if(gt(iw,ih),-2,1080*iw/ih*1.8)':'if(gt(iw,ih),1080*1.2,-2)',eq=gamma=0.85:contrast=1.06:saturation=0.6,colorbalance=bs=0.05:bm=0.03:rs=-0.03" -q:v 3 "$out"
  fi
  echo "graded $out"
done
for f in ofl/nanumpenscript/NanumPenScript-Regular.ttf ofl/nanumgothiccoding/NanumGothicCoding-Regular.ttf ofl/nanumgothiccoding/NanumGothicCoding-Bold.ttf; do
  [ -s "$P/fonts/$(basename $f)" ] || curl -sSfL -o "$P/fonts/$(basename $f)" "https://raw.githubusercontent.com/google/fonts/main/$f"
done
