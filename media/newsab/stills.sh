#!/usr/bin/env bash
# Turn each still (photo or card) into a 10 s, 30 fps mp4 for the Remotion template, upscaled with lanczos
# so the short side is at least 1440 px (the template crops and zooms into these).
# usage: media/newsab/stills.sh <id> name.jpg ...   -> shorts/viral5/public/<id>/src/<name>.mp4
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); ID=$1; shift
OUT="$HERE/../../shorts/viral5/public/$ID/src"; mkdir -p "$OUT"
for f in "$@"; do
  n="${f%.*}"
  ffmpeg -v error -y -loop 1 -i "$HERE/$f" -t 10 -r 30 \
    -vf "scale='if(lt(iw,ih),max(1440,iw),-2)':'if(lt(iw,ih),-2,max(1440,ih))':flags=lanczos,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 14 -an "$OUT/$n.mp4"
  echo "$OUT/$n.mp4 $(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$OUT/$n.mp4")"
done
