#!/usr/bin/env bash
# Download the doodle1-doodle4 photos listed in sources.json into public/doodle/ (git-ignored).
# usage: media/doodle/fetch.sh      (from shorts/viral5)
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p public/doodle
UA="richroro-shorts/1.0 (+https://github.com/richroro/richroro.github.io)"
python3 -c "import json; [print(s['file'], s['file_url']) for s in json.load(open('media/doodle/sources.json'))['sources']]" |
while read -r f url; do
  [ -s "public/doodle/$f" ] || curl -sSfL -A "$UA" -o "public/doodle/$f" "$url"
done
ls public/doodle | wc -l
