#!/usr/bin/env bash
# Fetch what the pipeline needs into shorts/build/ (git-ignored):
#   - Korean TTS (Supertonic 3) and Korean ASR (to check takes) from the sherpa-onnx releases
#   - display fonts from Google Fonts, Pretendard and three.js from npm
#   - Korean fonts installed for the headless browser, so captured pages don't render tofu
set -euo pipefail
cd "$(dirname "$0")/.."
B=build; mkdir -p "$B/models" "$B/fonts" "$B/npm"

REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
model() { [ -d "$B/models/$2" ] || curl -sSL "$REL/$1/$2.tar.bz2" | tar xj -C "$B/models"; }
model tts-models sherpa-onnx-supertonic-3-tts-int8-2026-05-11
model asr-models sherpa-onnx-zipformer-korean-2024-06-24
python3 -m pip install -q sherpa-onnx numpy pillow

# Google Fonts serves whole TTFs to old user agents; save them as Family-Weight.ttf
gfont() {
  curl -s -A "Wget/1.0" "https://fonts.googleapis.com/css2?family=$2" | FAM="$1" OUT="$B/fonts" python3 -c '
import os, re, sys, urllib.request
css, fam = sys.stdin.read(), os.environ["FAM"].replace(" ", "")
for w, u in re.findall(r"font-weight: (\d+);\s*src: url\((https://[^)]+\.ttf)\)", css):
    urllib.request.urlretrieve(u, os.path.join(os.environ["OUT"], fam + "-" + w + ".ttf"))'
}
gfont "Black Han Sans" "Black+Han+Sans"
gfont "Jua" "Jua"
gfont "Gaegu" "Gaegu:wght@700"
gfont "Noto Sans KR" "Noto+Sans+KR:wght@400;700;900"

(cd "$B/npm" && npm pack pretendard@1.3.9 three@0.170.0 three@0.128.0 --silent >/dev/null &&
  for t in *.tgz; do mkdir -p "${t%.tgz}" && tar xzf "$t" -C "${t%.tgz}"; done)
cp "$B"/npm/pretendard-1.3.9/package/dist/public/static/Pretendard-{Black,ExtraBold,Bold,SemiBold,Medium,Regular}.otf "$B/fonts/"

# the site's pages fall back to system fonts when a CDN is unreachable
mkdir -p ~/.local/share/fonts/shorts && cp "$B"/fonts/* ~/.local/share/fonts/shorts/ && fc-cache -f >/dev/null
echo "ready: $B/models, $B/fonts, $B/npm"
