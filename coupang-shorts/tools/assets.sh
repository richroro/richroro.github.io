#!/usr/bin/env bash
# 글꼴·음악을 .assets/ 에 받는다 (git 에는 안 올라감). GitHub·npm 에서만 받는다.
#   글꼴  Pretendard 1.3.9 (OFL, npm)
#   음악  Kevin MacLeod (CC BY 4.0) — 설명란에 출처를 넣는다 (make_desc.py)
set -euo pipefail
cd "$(dirname "$0")/.."
A=${CS_ASSETS:-.assets}
mkdir -p "$A/fonts" "$A/music"
if [ ! -s "$A/fonts/Pretendard-Black.otf" ]; then
  T=$(mktemp -d); (cd "$T" && npm pack pretendard@1.3.9 --silent >/dev/null && tar xzf pretendard-1.3.9.tgz)
  cp "$T"/package/dist/public/static/Pretendard-{Black,ExtraBold,Bold}.otf "$A/fonts/"; rm -rf "$T"
fi
M=https://raw.githubusercontent.com/cjthomas-opensource/mcmusic-kevin-macleod/master/music
for m in monkeys_spinning_monkeys hyperfun sneaky_snitch scheming_weasel hustle; do
  [ -s "$A/music/$m.mp3" ] || curl -sSfL -o "$A/music/$m.mp3" "$M/$m.mp3"
done
echo "assets ready in $A/"
