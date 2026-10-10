#!/usr/bin/env bash
# [괴담] v2: download and grade every stock clip of horror1-horror12 into public/<short>/src/<key>.mp4 (git-ignored),
# already in the full-screen 9:16 frame so prep.py keeps them at 1080x1920.
# usage: [IDS="horror3 horror4"] media/horror/grade3.sh [download dir]     (needs shorts/horror*/edit.json from make_edits_v2.py)
#   every clip: from 0 s to 10 s past the latest in-point any cut uses, cropped to 9:16 around catalog.CX (0..1 across the frame, default 0.5), 1080x1920, 30 fps, muted,
#   then the series' dark grade (gamma 0.78, contrast 1.08, saturation 0.5, blue tint, vignette); catalog.DARK clips only
#   lose colour; catalog.BRIGHT daylight clips get a deeper grade; NIGHTVISION clips become grey home-cam footage.
set -euo pipefail
cd "$(dirname "$0")/../.."
DL=${1:-build/horror-dl}; mkdir -p "$DL"
UA="richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
eval "$(python3 -c "
import sys; sys.path.insert(0,'media/horror'); import catalog as c
print('DARK=\"%s\"; BRIGHT=\"%s\"; NV=\"%s\"' % (' '.join(c.DARK), ' '.join(c.BRIGHT), ' '.join(c.NIGHTVISION)))")"
GRADE="eq=gamma=0.78:contrast=1.08:saturation=0.5,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/4.5"
DEEP="eq=gamma=0.62:contrast=1.12:brightness=-0.03:saturation=0.38,colorbalance=bs=0.08:bm=0.05:rs=-0.04,vignette=PI/4"
SOFT="eq=saturation=0.6,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/5"
NIGHT="format=gray,eq=gamma=1.15:contrast=1.25,noise=alls=18:allf=t,vignette=PI/4,format=yuv420p"
for id in ${IDS:-$(seq -f "horror%g" 1 12)}; do
  mkdir -p "public/$id/src"
  python3 -c "
import json; e = json.load(open('shorts/$id/edit.json'))
for k, v in e['sources'].items(): print(v['file'], v['file_url'], max(c['in'] for c in e['clips'] if c['src'] == k) + 10)" |
  while read -r file url len; do
    out="public/$id/src/$file"; [ -s "$out" ] && continue
    raw="$DL/$file"; n=${file#px}; n=${n#pb}; n=${n%.mp4}
    [ -s "$raw" ] || { [ -s "build/cand/$n.mp4" ] && cp "build/cand/$n.mp4" "$raw"; } || true
    [ -s "$raw" ] || curl -sSfL -A "$UA" -o "$raw" "$url"
    cx=$(python3 -c "import sys; sys.path.insert(0,'media/horror'); import catalog; print(catalog.CX.get('$n', 0.5))")
    g=$GRADE
    [[ " $DARK " == *" $n "* ]] && g=$SOFT
    [[ " $BRIGHT " == *" $n "* ]] && g=$DEEP
    [[ " $NV " == *" $n "* ]] && g=$NIGHT
    [ "$n" = 28237 ] && g="eq=gamma=1.6:saturation=0.6,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/5"
    ffmpeg -nostdin -v error -y -i "$raw" -t "$len" -vf "crop='if(gt(iw/ih,9/16),ih*9/16,iw)':'if(gt(iw/ih,9/16),ih,iw*16/9)':'(iw-ow)*$cx':'(ih-oh)/2',scale=1080:1920,setsar=1,fps=30,$g" \
      -an -c:v libx264 -crf 18 -preset veryfast "$out"
    echo "graded $out"
  done
done
