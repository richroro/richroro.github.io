#!/usr/bin/env bash
# Download the short's third-party assets into public/ (git-ignored). Every source is a public GitHub repo.
#   music  Kevin MacLeod "Sneaky Snitch" (CC BY), from a Minecraft resource pack that mirrors his tracks
#   sfx    Kenney "Interface Sounds" (CC0), from the Godot add-on mirror
#   fonts  Black Han Sans (google/fonts, OFL) and Pretendard (npm, OFL)
set -euo pipefail
cd "$(dirname "$0")"
P=public RAW=https://raw.githubusercontent.com
mkdir -p "$P/music" "$P/sfx" "$P/fonts" "$P/img"

[ -s "$P/music/sneaky_snitch.mp3" ] ||
  curl -sSfL -o "$P/music/sneaky_snitch.mp3" "$RAW/cjthomas-opensource/mcmusic-kevin-macleod/master/music/sneaky_snitch.mp3"

K=$RAW/Calinou/kenney-interface-sounds/master/addons/kenney_interface_sounds
for s in glitch_001 glitch_002 glitch_003 glitch_004 error_003 confirmation_002 drop_002 tick_002 maximize_003 switch_002; do
  [ -s "$P/sfx/k_$s.wav" ] || curl -sSfL -o "$P/sfx/k_$s.wav" "$K/$s.wav"
done

[ -s "$P/fonts/BlackHanSans-Regular.ttf" ] ||
  curl -sSfL -o "$P/fonts/BlackHanSans-Regular.ttf" "$RAW/google/fonts/main/ofl/blackhansans/BlackHanSans-Regular.ttf"
if [ ! -s "$P/fonts/Pretendard-Black.otf" ]; then
  T=$(mktemp -d); (cd "$T" && npm pack pretendard@1.3.9 --silent >/dev/null && tar xzf pretendard-1.3.9.tgz)
  cp "$T"/package/dist/public/static/Pretendard-{Black,ExtraBold,Bold}.otf "$P/fonts/"; rm -rf "$T"
fi
echo "assets ready in $P/"
