#!/usr/bin/env bash
# Master → final/lfhorror1.mp4 under 95 MB: H.265 two-pass at the bitrate that fits, audio −14 LUFS (two-pass loudnorm), AAC 160k.
# usage: longform/lfhorror1/encode.sh [master] [target MB]
set -euo pipefail
cd "$(dirname "$0")/../.."
IN=${1:-out/lfhorror1_master.mp4}; MB=${2:-90}; OUT=final/lfhorror1.mp4; T=build/lfhorror1/enc; mkdir -p "$T" final
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
VK=$(python3 -c "print(int(($MB*8*1024*1024/$DUR - 160000)/1000))")
echo "duration $DUR s → video ${VK}k"
M=$(ffmpeg -nostdin -i "$IN" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -vn -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { python3 -c "import json,sys; print(json.loads(sys.argv[1])['$1'])" "$M"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
ffmpeg -nostdin -v error -y -i "$IN" -vn -af "$LN,aresample=48000" -c:a aac -b:a 160k "$T/a.m4a"
X="-c:v libx265 -preset medium -b:v ${VK}k -pix_fmt yuv420p -tag:v hvc1 -x265-params log-level=error"
(cd "$T" && ffmpeg -nostdin -v error -y -i "../../../$IN" -an $X -x265-params pass=1:log-level=error -f mp4 /dev/null)
(cd "$T" && ffmpeg -nostdin -v error -y -i "../../../$IN" -i a.m4a -map 0:v -map 1:a $X -x265-params pass=2:log-level=error -c:a copy -movflags +faststart "../../../$OUT")
ls -la "$OUT"
