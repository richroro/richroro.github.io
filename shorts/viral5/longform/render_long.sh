#!/usr/bin/env bash
# Render one long-form, bring its audio to -14 LUFS, and fit it under the git host's file cap.
# usage: longform/render_long.sh <id>
#   1. render in chunks of CHUNK frames (--frames a-b): picture as x264 CRF 12 "veryfast" (near lossless), sound as 16-bit PCM,
#      in MKV; the chunks are joined without re-encoding (PCM joins sample-exact, so there is no seam), and a finished
#      chunk is kept, so a crashed or stopped render resumes where it stopped. (A separate audio-only render would cost
#      almost a second full pass: Remotion evaluates every frame to find the sounds.)
#   2. sound: two-pass loudnorm of the joined PCM to -14 LUFS / -1.5 dBTP, AAC 160k
#   3. size: two-pass encode at the bitrate the duration allows for MAXMB (default 95 MB), with +faststart. The thresholds
#      depend on what is on screen (edit.json "encode": {"content": "drawn" | "mixed" | "footage"}, default mixed), from
#      constant-quality test encodes of the demo (README "롱폼 제작 키트"):
#                    x264 1080p if >=   x265 1080p if >=   else x265 720p
#        drawn            900 kb/s           450 kb/s
#        mixed           3000 kb/s          1400 kb/s
#        footage         5000 kb/s          2000 kb/s
#      (x265 gets the hvc1 tag; X264_MIN / X265_MIN override.) CAP (default 8000 kb/s) keeps short videos from being
#      encoded bigger than they need. Sound is AAC 160k up to 10 minutes, 128k up to 20, 96k beyond (speech and a bed).
# env: CHROME (headless shell), CHUNK (default 2700 = 90 s), CONC (default nproc), MAXMB, X264_MIN, X265_MIN, CAP, PRESET, KEEP=1 keeps out/long/<id>/
# writes final/<id>.mp4, out/long/<id>/master.mkv (near-lossless picture + normalized sound, for a higher-quality upload),
#        out/long/<id>/render.json (timings, frames per second, codec, bitrate, size)
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$1
BX=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}
[ -x "$BX" ] || BX=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)
CONTENT=$(python3 -c "import json; print(json.load(open('longform/$ID/edit.json')).get('encode', {}).get('content', 'mixed'))")
case $CONTENT in drawn) D264=900 D265=450;; footage) D264=5000 D265=2000;; *) D264=3000 D265=1400;; esac
CHUNK=${CHUNK:-2700} CONC=${CONC:-$(nproc)} MAXMB=${MAXMB:-95} X264_MIN=${X264_MIN:-$D264} X265_MIN=${X265_MIN:-$D265} CAP=${CAP:-8000}
PRESET=${PRESET:-fast}  # x265 preset (x264 always "medium"); "faster" roughly halves a 25-minute encode for a little more blur
W=out/long/$ID; mkdir -p "$W" final
N=$(python3 -c "import json,math; print(math.ceil(json.load(open('src/longdata/$ID.json'))['end']*30))")
DUR=$(python3 -c "print($N/30)")
ABR=$(python3 -c "print(160 if $DUR <= 600 else 128 if $DUR <= 1200 else 96)")
echo "render $ID: $N frames ($DUR s) in chunks of $CHUNK"

# 1) picture
T0=$(date +%s); : > "$W/list.txt"; : > "$W/alist.txt"; i=0; RESUMED=False; NR=0  # NR: frames rendered in this run
ls "$W"/v*.mkv >/dev/null 2>&1 && RESUMED=True
for ((a = 0; a < N; a += CHUNK)); do
  b=$((a + CHUNK - 1)); ((b >= N)) && b=$((N - 1))
  f=$(printf "v%03d.mkv" $i)
  if [ ! -s "$W/$f" ]; then
    t=$(date +%s)
    npx remotion render src/index.ts "$ID" "$W/tmp.mkv" --frames=$a-$b --codec=h264-mkv --audio-codec=pcm-16 --crf=12 --x264-preset=veryfast \
      --browser-executable="$BX" --concurrency="$CONC" --log=error 2>&1 | grep -v -e "memory" -e "Memory" -e "docker" || true
    [ -s "$W/tmp.mkv" ] || { echo "chunk $i failed"; exit 1; }
    mv "$W/tmp.mkv" "$W/$f"; NR=$((NR + b - a + 1))
    echo "  chunk $i: frames $a-$b in $(( $(date +%s) - t )) s"
  fi
  # each chunk's sound cut to exactly its frames (Remotion adds a few samples), so the joined track never drifts or clicks
  [ -s "$W/${f%.mkv}.wav" ] || ffmpeg -hide_banner -loglevel error -y -i "$W/$f" -map 0:a -af "atrim=end_sample=$(((b - a + 1) * 1600))" -c:a pcm_s16le "$W/${f%.mkv}.wav"
  echo "file '$f'" >> "$W/list.txt"; echo "file '${f%.mkv}.wav'" >> "$W/alist.txt"; i=$((i + 1))
done
T1=$(date +%s)

# 2) sound: the joined PCM, to -14 LUFS
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$W/alist.txt" -c:a pcm_s16le "$W/audio.wav"
T2=$(date +%s)
M=$(ffmpeg -hide_banner -nostats -i "$W/audio.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -hide_banner -loglevel error -y -i "$W/audio.wav" -af "$LN,aresample=48000" -c:a aac -b:a ${ABR}k "$W/audio.m4a"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$W/list.txt" -i "$W/audio.m4a" -map 0:v -map 1:a -c copy "$W/master.mkv"

# 3) fit the size
KB=$(python3 -c "print(int(min($CAP, ($MAXMB*1e6*8*0.97/$DUR - ${ABR}e3)/1e3)))")
if ((KB >= X264_MIN)); then CODEC=x264 SCALE=1080
elif ((KB >= X265_MIN)); then CODEC=x265 SCALE=1080
else CODEC=x265 SCALE=720; fi
VF=$([ $SCALE = 720 ] && echo "scale=1280:720:flags=lanczos" || echo "null")  # both passes see the same frames: -pix_fmt yuv420p in each (Remotion's chunks are yuvj420p)
enc() {  # $1 = kb/s
  if [ $CODEC = x264 ]; then
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx264 -preset medium -b:v ${1}k -pass 1 -passlogfile "$W/pass" -pix_fmt yuv420p -an -f null /dev/null
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx264 -preset medium -b:v ${1}k -pass 2 -passlogfile "$W/pass" -pix_fmt yuv420p \
      -c:a copy -movflags +faststart "final/$ID.mp4"
  else
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx265 -preset $PRESET -b:v ${1}k -x265-params "pass=1:stats=$W/x265.log:log-level=error" -pix_fmt yuv420p -an -f null /dev/null
    # pass 2 goes to MKV and is then remuxed: writing MP4 straight away turns on global headers, which changes the encoder
    # settings from pass 1 and x265 stops with "Incomplete CU-tree stats file"
    ffmpeg -hide_banner -loglevel error -y -i "$W/master.mkv" -vf "$VF" -c:v libx265 -preset $PRESET -b:v ${1}k -x265-params "pass=2:stats=$W/x265.log:log-level=error" -pix_fmt yuv420p \
      -c:a copy "$W/enc.mkv"
    ffmpeg -hide_banner -loglevel error -y -i "$W/enc.mkv" -c copy -tag:v hvc1 -movflags +faststart "final/$ID.mp4"; rm -f "$W/enc.mkv"
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
         frames_rendered=$NR, render_fps=round($NR / $((T1 - T0)), 2) if $NR else None, resumed=$RESUMED, content="$CONTENT", codec="$CODEC", height=$SCALE, video_kbps=$KB, audio_kbps=$ABR,
         size_mb=round($SZ / 1e6, 2), mb_per_min=round($SZ / 1e6 / ($DUR / 60), 2))
json.dump(d, open(sys.argv[1], "w"), indent=1); print(json.dumps(d))
EOF
[ "${KEEP:-0}" = 1 ] || rm -f "$W"/v*.mkv "$W"/v*.wav "$W/audio.wav" "$W"/pass* "$W"/x265.log*
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of compact "final/$ID.mp4"
