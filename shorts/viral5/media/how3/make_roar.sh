#!/usr/bin/env bash
# how3's steady engine roar for the sped-up middle (clip sound at 16-64x would be squeaky): 15.6 s of the NASA source's
# own audio (2018-10-31 RS-25 test, 100-115.6 s, mid-burn; checked for speech with faster-whisper: none), faded in/out,
# as public/sfx/how3_roar.wav. usage: media/how3/make_roar.sh   (after fetch_nasa_video.py how3 ...)
set -euo pipefail
cd "$(dirname "$0")/../.."
ffmpeg -v error -y -ss 100 -t 15.6 -i public/how3/src/rs25.mp4 -vn -ac 2 -ar 48000 -af "afade=t=in:d=0.25,afade=t=out:st=15.2:d=0.4" public/sfx/how3_roar.wav
echo public/sfx/how3_roar.wav
