#!/usr/bin/env bash
# Render the Odyssey documentary to final/odyssey.mp4: pictures from Remotion (composition "odyssey", muted),
# sound from mix.py, then one HEVC 2-pass encode sized to stay under 95 MB, audio at -14 LUFS / -1.5 dBTP.
# usage: longform/odyssey/render_odyssey.sh <voice_dir>     (voice_dir: where voice.py wrote voice/ and voice.json)
#        needs public/odyssey from fetch_media.py; CHROME=<headless shell> overrides the browser
set -euo pipefail
cd "$(dirname "$0")/../.."
V=$1; W=${WORK:-out/odyssey}; OUT=final/odyssey.mp4
BX=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
mkdir -p "$W" final
cp longform/odyssey/edit.json public/odyssey/edit.json
[ -s "$W/video.mp4" ] || npx remotion render src/index.ts odyssey "$W/video.mp4" --browser-executable="$BX" --concurrency="$(nproc)" --crf=17 --muted --log=error
python3 longform/odyssey/mix.py "$V" "$W/mix.wav"
M=$(ffmpeg -hide_banner -nostats -i "$W/mix.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -hide_banner -loglevel error -y -i "$W/mix.wav" -af "$LN,aresample=48000" -c:a aac -b:a 128k "$W/audio.m4a"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$W/video.mp4")
# 93 MB for everything, minus the audio, leaves the video bitrate (kbit/s)
VK=$(python3 -c "print(int((93*8*1024*1024/1000 - 132*$DUR) / $DUR))")
X="-c:v libx265 -preset slow -b:v ${VK}k -tag:v hvc1 -pix_fmt yuv420p -x265-params log-level=error:aq-mode=3:psy-rd=1.0"
(cd "$W" && ffmpeg -hide_banner -loglevel error -y -i video.mp4 $X -x265-params pass=1:log-level=error:aq-mode=3 -an -f null /dev/null)
(cd "$W" && ffmpeg -hide_banner -loglevel error -y -i video.mp4 -i audio.m4a $X -x265-params pass=2:log-level=error:aq-mode=3 -c:a copy -map 0:v -map 1:a -shortest -movflags +faststart ../../$OUT)
echo "video ${VK}k"; ffprobe -v error -show_entries format=duration,size -of compact "$OUT"
