#!/usr/bin/env bash
# Encode frames + mix into the final MP4 (H.264 + AAC, loudness-normalised to -14 LUFS).
# usage: encode.sh <build_dir> <out.mp4>
set -euo pipefail
B="$1"; OUT="$2"
M=$(ffmpeg -hide_banner -nostats -i "$B/mix.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$B/frames/f_%05d.jpg" -i "$B/mix.wav" \
  -af "$LN,aresample=48000" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -r 30 -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
