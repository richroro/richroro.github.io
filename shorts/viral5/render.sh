#!/usr/bin/env bash
# Render one short with Remotion, then bring its audio to -14 LUFS (YouTube's playback loudness).
# usage: ./render.sh <id> [out.mp4]      CHROME=<headless shell> overrides the browser
set -euo pipefail
cd "$(dirname "$0")"
ID=$1; OUT=${2:-out/$ID.mp4}
BX=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
mkdir -p out
npx remotion render src/index.ts "$ID" "out/$ID.raw.mp4" --browser-executable="$BX" --concurrency="$(nproc)" --crf=18 --log=error
M=$(ffmpeg -hide_banner -nostats -i "out/$ID.raw.mp4" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -hide_banner -loglevel error -y -i "out/$ID.raw.mp4" -c:v copy -af "$LN,aresample=48000" -c:a aac -b:a 192k -movflags +faststart "$OUT"
rm -f "out/$ID.raw.mp4"
ffprobe -v error -show_entries format=duration,size -of compact "$OUT"
