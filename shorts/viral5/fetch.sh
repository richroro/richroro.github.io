#!/usr/bin/env bash
# Shared assets for every short, into public/ (git-ignored). All from public GitHub repos or generated here.
#   fonts  Black Han Sans (google/fonts, OFL), Pretendard (npm, OFL)
#   sfx    Kenney "Interface Sounds" (CC0) + the numpy-synthesized set from ../tools/sfx.py
#   music  Kevin MacLeod (CC BY), mirrored in a Minecraft resource pack
set -euo pipefail
cd "$(dirname "$0")"
P=public RAW=https://raw.githubusercontent.com
mkdir -p "$P/fonts" "$P/sfx" "$P/music"

[ -s "$P/fonts/BlackHanSans-Regular.ttf" ] ||
  curl -sSfL -o "$P/fonts/BlackHanSans-Regular.ttf" "$RAW/google/fonts/main/ofl/blackhansans/BlackHanSans-Regular.ttf"
if [ ! -s "$P/fonts/Pretendard-Black.otf" ]; then
  T=$(mktemp -d); (cd "$T" && npm pack pretendard@1.3.9 --silent >/dev/null && tar xzf pretendard-1.3.9.tgz)
  cp "$T"/package/dist/public/static/Pretendard-{Black,ExtraBold,Bold}.otf "$P/fonts/"; rm -rf "$T"
fi

K=$RAW/Calinou/kenney-interface-sounds/master/addons/kenney_interface_sounds
for s in drop_002 maximize_003 question_001 confirmation_002 error_003 glitch_002; do
  [ -s "$P/sfx/k_$s.wav" ] || curl -sSfL -o "$P/sfx/k_$s.wav" "$K/$s.wav"
done
[ -s "$P/sfx/whoosh.wav" ] || python3 ../tools/sfx.py "$P/sfx" >/dev/null
[ -s "$P/sfx/horn.wav" ] || python3 road_sfx.py "$P/sfx" >/dev/null  # road cartoons: horn, siren
[ -s "$P/sfx/dundun.wav" ] || python3 drive_sfx.py "$P/sfx" >/dev/null  # wordless road cartoons: engine, tyre squeal, dun-dun

M=$RAW/cjthomas-opensource/mcmusic-kevin-macleod/master/music
for m in monkeys_spinning_monkeys scheming_weasel hyperfun hustle sneaky_snitch; do
  [ -s "$P/music/$m.mp3" ] || curl -sSfL -o "$P/music/$m.mp3" "$M/$m.mp3"
done
# tracks used by the Artemis/Apollo, home, rank2, top1 and horror shorts, straight from incompetech.com (same CC BY 4.0 licence)
for m in "Floating Cities" "Lightless Dawn" "Exhilarate" "Movement Proposition" "Heartwarming" "Touching Moments Two - Higher" "Dreamer" "Heroic Age" "Dark Fog" "Gathering Darkness" "Ghost Story"; do
  [ -s "$P/music/$m.mp3" ] || curl -sSfL -o "$P/music/$m.mp3" "https://incompetech.com/music/royalty-free/mp3-royaltyfree/${m// /%20}.mp3"
done
echo "shared assets ready in $P/"
