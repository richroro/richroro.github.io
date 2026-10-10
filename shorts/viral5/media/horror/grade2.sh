#!/usr/bin/env bash
# Download and grade the stock clips of horror5-horror8 into public/<short>/src/<key>.mp4 (git-ignored).
# usage: media/horror/grade2.sh [download dir]     (needs shorts/horror5-8/edit.json from make_edits.py)
#   every clip: first 40 s, 1080 px on the short side, 30 fps, muted, then the series' dark grade
#   (gamma 0.78, contrast 1.08, saturation 0.5, blue tint, vignette); already-dark clips only lose colour;
#   NIGHTVISION clips (catalog.py) become grey, grainy home-cam footage instead.
set -euo pipefail
cd "$(dirname "$0")/../.."
DL=${1:-build/horror-dl}; mkdir -p "$DL"
UA="richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
DARK="5994915 9591436 9976082 5391986 34405948 12096163 6028858 6028882 19193293 6114429 3134591"
NV=$(python3 -c "import sys; sys.path.insert(0,'media/horror'); import catalog; print(' '.join(catalog.NIGHTVISION))")
GRADE="eq=gamma=0.78:contrast=1.08:saturation=0.5,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/4.5"
SOFT="eq=saturation=0.6,colorbalance=bs=0.06:bm=0.04:rs=-0.03,vignette=PI/5"
NIGHT="format=gray,eq=gamma=1.15:contrast=1.25,noise=alls=18:allf=t,vignette=PI/4,format=yuv420p"
for id in horror5 horror6 horror7 horror8; do
  mkdir -p "public/$id/src"
  python3 -c "import json; [print(v['file'], v['file_url']) for v in json.load(open('shorts/$id/edit.json'))['sources'].values()]" |
  while read -r file url; do
    out="public/$id/src/$file"; [ -s "$out" ] && continue
    raw="$DL/$file"; [ -s "$raw" ] || curl -sSfL -A "$UA" -o "$raw" "$url"
    n=${file#px}; n=${n%.mp4}; g=$GRADE
    [[ " $DARK " == *" $n "* ]] && g=$SOFT
    [[ " $NV " == *" $n "* ]] && g=$NIGHT
    ffmpeg -nostdin -v error -y -i "$raw" -t 40 -vf "scale='if(gt(iw,ih),-2,1080)':'if(gt(iw,ih),1080,-2)',fps=30,$g" -an -c:v libx264 -crf 18 -preset veryfast "$out"
    echo "graded $out"
  done
done
