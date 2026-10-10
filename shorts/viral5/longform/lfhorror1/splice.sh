#!/usr/bin/env bash
# Replace frame ranges of the master with re-rendered patches (no full re-render), keeping the master's audio.
# usage: longform/lfhorror1/splice.sh   (patches: build/lfhorror1/patch1.mp4 = frames 10230-10426, patch2.mp4 = 24100-24459)
set -euo pipefail
cd "$(dirname "$0")/../.."
M=out/lfhorror1_master.mp4; T=build/lfhorror1/splice; mkdir -p "$T"
enc="-an -c:v libx264 -crf 14 -preset veryfast -pix_fmt yuv420p -r 30"
seg() { ffmpeg -nostdin -v error -y -ss "$(python3 -c "print($2/30)")" -i "$M" -frames:v "$3" $enc "$T/$1.mp4"; }
seg a 0 10230
ffmpeg -nostdin -v error -y -i build/lfhorror1/patch1.mp4 $enc "$T/b.mp4"
seg c 10427 $((24100 - 10427))
ffmpeg -nostdin -v error -y -i build/lfhorror1/patch2.mp4 $enc "$T/d.mp4"
seg e 24460 100000
printf "file '%s'\n" a.mp4 b.mp4 c.mp4 d.mp4 e.mp4 > "$T/list.txt"
ffmpeg -nostdin -v error -y -f concat -safe 0 -i "$T/list.txt" -i "$M" -map 0:v -map 1:a -c copy out/lfhorror1_master2.mp4
ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 out/lfhorror1_master2.mp4
