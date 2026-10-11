#!/usr/bin/env bash
# Export final/<id>-nomusic.mp4: the same short with the music track removed (sound effects and voice stay), so a
# trending sound can be added in the YouTube app at upload. The audio gets the same gain render.sh gave the full mix
# (full mix measured to -14 LUFS), so the remaining sounds sit at the level they have in final/<id>.mp4.
# usage: ./render_nomusic.sh <id>          needs src/data/<id>.json (prep.py) and the shared assets (fetch.sh)
set -euo pipefail
cd "$(dirname "$0")"
ID=$1
BX=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
D=src/data/$ID.json; mkdir -p out final
cp "$D" "out/$ID.data.bak"
trap 'cp "out/$ID.data.bak" "$D"' EXIT
# 1) the full mix's audio only, to measure the gain render.sh applied
npx remotion render src/index.ts "$ID" "out/$ID.full.wav" --browser-executable="$BX" --concurrency="$(nproc)" --codec=wav --log=error
I=$(ffmpeg -hide_banner -nostats -i "out/$ID.full.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' |
  python3 -c "import sys,json; print(json.load(sys.stdin)['input_i'])")
G=$(python3 -c "print(round(-14 - float('$I'), 2))")
# 2) the short without its music
python3 -c "import json,sys; d=json.load(open('$D')); d['music']=None; json.dump(d, open('$D','w'), ensure_ascii=False)"
npx remotion render src/index.ts "$ID" "out/$ID.nomusic.raw.mp4" --browser-executable="$BX" --concurrency="$(nproc)" --crf=18 --log=error
ffmpeg -hide_banner -loglevel error -y -i "out/$ID.nomusic.raw.mp4" -c:v copy -af "volume=${G}dB,alimiter=limit=0.84,aresample=48000" -c:a aac -b:a 192k -shortest -movflags +faststart "final/$ID-nomusic.mp4"
rm -f "out/$ID.full.wav" "out/$ID.nomusic.raw.mp4"
echo "final/$ID-nomusic.mp4 (full mix ${I} LUFS -> gain ${G} dB)"
ffprobe -v error -show_entries format=duration,size -of compact "final/$ID-nomusic.mp4"
