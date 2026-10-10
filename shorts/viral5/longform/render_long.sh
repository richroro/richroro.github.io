#!/usr/bin/env bash
# Render one long-form, bring its audio to -14 LUFS, and fit it under the git host's file cap.
# usage: longform/render_long.sh <id>
#   1. picture: rendered in chunks of CHUNK frames (--frames a-b, --muted, x264 CRF 12 "veryfast", near lossless) and joined
#      without re-encoding; a finished chunk is kept, so a crashed or stopped render resumes where it stopped
#   2. sound: one audio-only render of the whole timeline (WAV), two-pass loudnorm to -14 LUFS / -1.5 dBTP, AAC 160k
#   3. size: two-pass encode at the bitrate the duration allows for MAXMB (default 95 MB), with +faststart:
#        >= X264_MIN kb/s (default 3000)  x264 1080p
#        >= X265_MIN kb/s (default 1400)  x265 1080p (hvc1 tag; ~40% smaller than x264 at the same look)
#        below that                       x265 720p (1080p would smear on moving footage)
#      CAP (default 8000 kb/s) keeps short videos from being encoded bigger than they need
# env: CHROME (headless shell), CHUNK (default 2700 = 90 s), CONC (default nproc), MAXMB, X264_MIN, X265_MIN, CAP, KEEP=1 keeps out/long/<id>/
# writes final/<id>.mp4, out/long/<id>/master.mkv (near-lossless picture + normalized sound, for a higher-quality upload),
#        out/long/<id>/render.json (timings, frames per second, codec, bitrate, size)
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$1
BX=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
[ -x "$BX" ] || BX=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)
CHUNK=${CHUNK:-2700} CONC=${CONC:-$(nproc)} MAXMB=${MAXMB:-95} X264_MIN=${X264_MIN:-3000} X265_MIN=${X265_MIN:-1400} CAP=${CAP:-8000} ABR=160
W=out/long/$ID; mkdir -p "$W" final
N=$(python3 -c "import json,math; print(math.ceil(json.load(open('src/longdata/$ID.json'))['end']*30))")
DUR=$(python3 -c "print($N/30)")
echo "render $ID: $N frames ($DUR s) in chunks of $CHUNK"

# 1) picture
T0=$(date +%s); : > "$W/list.txt"; i=0
for ((a = 0; a < N; a += CHUNK)); do
  b=$((a + CHUNK - 1)); ((b >= N)) && b=$((N - 1))
  f=$(printf "v%03d.mp4" $i)
  if [ ! -s "$W/$f" ]; then
    t=$(date +%s)
    npx remotion render src/index.ts "$ID" "$W/tmp.mp4" --frames=$a-$b --muted --codec=h264 --crf=12 --x264-preset=veryfast \
      --browser-executable="$BX" --concurrency="$CONC" --log=error 2>&1 | grep -v -e "memory" -e "Memory" -e "docker" || true
    [ -s "$W/tmp.mp4" ] || { echo "chunk $i failed"; exit 1; }
    mv "$W/tmp.mp4" "$W/$f"
    echo "  chunk $i: frames $a-$b in $(( $(date +%s) - t )) s"
  fi
  echo "file '$f'" >> "$W/list.txt"; i=$((i + 1))
done
T1=$(date +%s)

# 2) sound: the whole timeline at once (no seams), then -14 LUFS
npx remotion render src/index.ts "$ID" "$W/audio.wav" --codec=wav --browser-executable="$BX" --concurrency="$CONC" --log=error 2>&1 | grep -v -e "memory" -e "Memory" -e "docker" || true
T2=$(date +%s)
M=$(ffmpeg -hide_banner -nostats -i "$W/audio.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -hide_banner -loglevel error -y -i "$W/audio.wav" -af "$LN,aresample=48000" -c:a aac -b:a ${ABR}k "$W/audio.m4a"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$W/list.txt" -i "$W/audio.m4a" -map 0:v -map 1:a -c copy -shortest "$W/master.mkv"

# 3) fit the size
KB=$(python3 -c "print(int(min($CAP, ($MAXMB*1e6*8*0.97/$DUR - ${ABR}e3)/1e3)))")
if ((KB >= X264_MIN)); then CODEC=x264 SCALE=1080
elif ((KB >= X265_MIN)); then CODEC=x265 SCALE=1080
else CODEC=x265 SCALE=720; fi
VF=$([ $SCALE = 720 ] && echo "scale=1280:720:flags=lanczos" || echo "null")
enc() {  # $1 = kb/s
  if [ $CODEC = x264 ]; then
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx264 -preset medium -b:v ${1}k -pass 1 -passlogfile "$W/pass" -an -f null /dev/null
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx264 -preset medium -b:v ${1}k -pass 2 -passlogfile "$W/pass" -pix_fmt yuv420p \
      -c:a copy -movflags +faststart "final/$ID.mp4"
  else
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx265 -preset fast -b:v ${1}k -x265-params "pass=1:stats=$W/x265.log:log-level=error" -an -f null /dev/null
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx265 -preset fast -b:v ${1}k -x265-params "pass=2:stats=$W/x265.log:log-level=error" -tag:v hvc1 -pix_fmt yuv420p \
      -c:a copy -movflags +faststart "final/$ID.mp4"
  fi
}
enc $KB
for k in 1 2; do  # a rare overshoot: once or twice more at 94%
  SZ=$(stat -c %s "final/$ID.mp4"); python3 -c "import sys; sys.exit(0 if $SZ > $MAXMB*1e6 else 1)" || break
  KB=$((KB * 94 / 100)); echo "  $((SZ / 1000000)) MB is over $MAXMB MB, again at $KB kb/s"; enc $KB
done
T3=$(date +%s)
SZ=$(stat -c %s "final/$ID.mp4")
python3 - "$W/render.json" <<EOF
import json, sys
d = dict(id="$ID", frames=$N, seconds=$DUR, picture_s=$((T1 - T0)), audio_s=$((T2 - T1)), encode_s=$((T3 - T2)),
         render_fps=round($N / max(1, $((T1 - T0))), 2), codec="$CODEC", height=$SCALE, video_kbps=$KB, audio_kbps=$ABR,
         size_mb=round($SZ / 1e6, 2), mb_per_min=round($SZ / 1e6 / ($DUR / 60), 2))
json.dump(d, open(sys.argv[1], "w"), indent=1); print(json.dumps(d))
EOF
[ "${KEEP:-0}" = 1 ] || rm -f "$W"/v*.mp4 "$W/audio.wav" "$W"/pass* "$W"/x265.log*
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of compact "final/$ID.mp4"
