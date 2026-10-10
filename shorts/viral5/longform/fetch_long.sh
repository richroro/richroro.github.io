#!/usr/bin/env bash
# Extra shared assets for the long-form kit, into public/ (git-ignored). Run after ../fetch.sh.
#   music     more Kevin MacLeod beds (CC BY 4.0) straight from incompetech.com, for long chapters that need variety:
#             documentary (Investigations, Echoes of Time v2, Deep Haze, Lost Frontier, Peaceful Desolation, Clean Soul),
#             괴담 (Unseen Horrors), light 썰 (Wholesome, Carefree). Credit lines are written by prep_long.py.
#   ambience  rain / wind / deep (underwater rumble) / room tone, synthesized here (longform/ambience.py), so no licence
set -euo pipefail
cd "$(dirname "$0")/.."
P=public UA="richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
mkdir -p "$P/music" "$P/amb"
for m in "Investigations" "Echoes of Time v2" "Deep Haze" "Lost Frontier" "Peaceful Desolation" "Clean Soul" "Unseen Horrors" "Wholesome" "Carefree"; do
  [ -s "$P/music/$m.mp3" ] || curl -sSfL -A "$UA" -o "$P/music/$m.mp3" "https://incompetech.com/music/royalty-free/mp3-royaltyfree/${m// /%20}.mp3"
done
[ -s "$P/amb/rain.wav" ] || python3 longform/ambience.py "$P/amb"
echo "long-form assets ready in $P/"
