#!/usr/bin/env bash
# lfsaeyeon1: voice → cuts → render → loudness (-14 LUFS) and size (≤ 95 MB) → final/lfsaeyeon1.mp4 and the thumbnail.
#   voice.py (Edge TTS, cached) → build.py (cuts) → prep.py (timeline, src/data) → Remotion (src/lib/long/lfsaeyeon1_entry.tsx)
#   → ffmpeg: H.264 1080p30, 2-pass at a bitrate that fits 95 MB, AAC 192k with a two-pass loudnorm to -14 LUFS / -1.5 dBTP
set -euo pipefail
cd "$(dirname "$0")/../.."
ID=lfsaeyeon1 OUT=out/$ID; mkdir -p "$OUT" final
./longform/$ID/fetch_music.sh >/dev/null
python3 longform/$ID/voice.py && python3 longform/$ID/build.py && python3 longform/$ID/prep.py
npx remotion bundle src/lib/long/${ID}_entry.tsx --out-dir "$OUT/bundle" --log=error
npx remotion render "$OUT/bundle" $ID "$OUT/raw.mp4" --concurrency=4 --crf=16 --log=error
npx remotion still "$OUT/bundle" $ID-thumb "final/$ID-thumb.jpg" --jpeg-quality=92 --log=error
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/raw.mp4")
# video bitrate so that video + 192k audio stay under 95 MB (with 3% container headroom)
VB=$(python3 -c "print(min(4500, int((95e6*8*0.97/$DUR - 192e3)/1000)))")
M=$(ffmpeg -hide_banner -i "$OUT/raw.mp4" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi() { python3 -c "import json,sys; print(json.loads(sys.stdin.read())['$1'])" <<<"$M"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(mi input_i):measured_TP=$(mi input_tp):measured_LRA=$(mi input_lra):measured_thresh=$(mi input_thresh):offset=$(mi target_offset):linear=true"
ffmpeg -v error -y -i "$OUT/raw.mp4" -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile "$OUT/x264" -an -f mp4 /dev/null
ffmpeg -v error -y -i "$OUT/raw.mp4" -c:v libx264 -preset slow -b:v ${VB}k -pass 2 -passlogfile "$OUT/x264" -pix_fmt yuv420p -movflags +faststart \
  -af "$LN,aresample=48000" -c:a aac -b:a 192k "final/$ID.mp4"
ls -la "final/$ID.mp4" "final/$ID-thumb.jpg"; echo "video ${VB}k"
