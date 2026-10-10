#!/usr/bin/env bash
# lfsaeyeon1's music beds, Kevin MacLeod (incompetech.com), CC BY 4.0, into public/music/ (git-ignored)
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p public/music
for m in "Carefree" "Sneaky Snitch" "Investigations" "Heartwarming"; do
  [ -s "public/music/$m.mp3" ] || curl -sSfL -A "richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)" \
    -o "public/music/$m.mp3" "https://incompetech.com/music/royalty-free/mp3-royaltyfree/${m// /%20}.mp3"
done
ls -la public/music | grep -E "Carefree|Sneaky Snitch|Investigations|Heartwarming"
