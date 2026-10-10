#!/usr/bin/env bash
# 음성 v2 A/B: re-voice shorts (and the first minute of lfsaeyeon1) with a bake-off candidate, render, check captions.
# usage: voicelab/ab.sh <candidate> <id>...    -> final/voice_ab/<id>-<candidate>.mp4 (A is the current final/<id>.mp4)
#   cast per short: voicelab/ab/<candidate>/<id>.json (python3 voicelab/make_ab.py writes it if missing)
#   afterwards rebuild a short's own voice with: python3 voice_edge.py <id> && python3 prep.py <id>
set -euo pipefail
cd "$(dirname "$0")/.."
C=$1; shift
mkdir -p final/voice_ab
for ID in "$@"; do
  [ -f "voicelab/ab/$C/$ID.json" ] || python3 voicelab/make_ab.py "$C" "$ID"
  if [ "$ID" = lfsaeyeon1 ]; then
    O=out/ab-$ID; mkdir -p "$O"
    ./longform/$ID/fetch_music.sh >/dev/null
    python3 longform/$ID/voice.py --voices "voicelab/ab/$C/$ID.json" && python3 longform/$ID/build.py && python3 longform/$ID/prep.py
    [ -f src/data/index.ts ] || python3 prep.py
    npx remotion bundle src/index.ts --out-dir "$O/bundle" --log=error
    npx remotion render "$O/bundle" $ID "$O/raw.mp4" --frames=0-1799 --concurrency="$(nproc)" --crf=20 --log=error
    M=$(ffmpeg -hide_banner -i "$O/raw.mp4" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
    mi() { python3 -c "import json,sys; print(json.loads(sys.stdin.read())['$1'])" <<<"$M"; }
    LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(mi input_i):measured_TP=$(mi input_tp):measured_LRA=$(mi input_lra):measured_thresh=$(mi input_thresh):offset=$(mi target_offset):linear=true"
    ffmpeg -v error -y -i "$O/raw.mp4" -vf scale=-2:720 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -af "$LN,aresample=48000" -c:a aac -b:a 128k -movflags +faststart "final/voice_ab/$ID-1min-$C.mp4"
    python3 voicelab/capcheck.py $ID "$C" --until 60
    git checkout -- longform/$ID/video.json longform/$ID/chapters.json longform/$ID/scenes.json longform/$ID/script.json 2>/dev/null || true
    rm -rf "$O"
  else
    python3 voice_edge.py "$ID" --voices "voicelab/ab/$C/$ID.json"
    python3 prep.py "$ID"
    ./render.sh "$ID" "final/voice_ab/$ID-$C.mp4"
    if [ "$(stat -c %s "final/voice_ab/$ID-$C.mp4")" -gt 30000000 ]; then  # the app's 30 MB limit (issue4's NASA footage is busy)
      ffmpeg -v error -y -i "final/voice_ab/$ID-$C.mp4" -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart "out/$ID-$C.mp4"
      mv "out/$ID-$C.mp4" "final/voice_ab/$ID-$C.mp4"
    fi
    python3 voicelab/capcheck.py "$ID" "$C"
  fi
  ls -la final/voice_ab/"$ID"*"$C".mp4
done
