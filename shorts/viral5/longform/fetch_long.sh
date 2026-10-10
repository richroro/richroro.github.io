#!/usr/bin/env bash
# Extra shared assets for the long-form kit, into public/ (git-ignored). Run after ../fetch.sh.
#   music     more Kevin MacLeod beds (CC BY 4.0) straight from incompetech.com, for long chapters that need variety:
#             documentary (Investigations, Echoes of Time v2, Deep Haze, Lost Frontier, Peaceful Desolation, Clean Soul),
#             story-history docs (Long Note Three, Dark Walk), list explainers (Carefree, Fluffing a Duck),
#             괴담 (Unseen Horrors, Darkest Child), light 썰 (Wholesome). The last four groups follow the long-form research
#             (research-longform-docu.md 2, research-longform-story.md 5). Credit lines are written by prep_long.py.
#   ambience  rain / wind / deep (underwater rumble) / room tone / hum (fluorescent light and fridge motor, for 괴담 at night),
#             synthesized here (longform/ambience.py), so no licence
set -euo pipefail
cd "$(dirname "$0")/.."
P=public UA="richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
mkdir -p "$P/music" "$P/amb"
for m in "Investigations" "Echoes of Time v2" "Deep Haze" "Lost Frontier" "Peaceful Desolation" "Clean Soul" "Unseen Horrors" "Wholesome" "Carefree" "Long Note Three" "Dark Walk" "Fluffing a Duck" "Darkest Child"; do
  [ -s "$P/music/$m.mp3" ] || curl -sSfL -A "$UA" -o "$P/music/$m.mp3" "https://incompetech.com/music/royalty-free/mp3-royaltyfree/${m// /%20}.mp3"
done
[ -s "$P/amb/hum.wav" ] || python3 longform/ambience.py "$P/amb"
echo "long-form assets ready in $P/"
