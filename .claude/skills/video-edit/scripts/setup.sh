#!/usr/bin/env bash
# 영상 편집 스킬 준비. 세션마다 한 번 (이미 있으면 건너뛴다).
#   bash .claude/skills/video-edit/scripts/setup.sh
set -euo pipefail

CACHE="${VIDEO_EDIT_CACHE:-$HOME/.cache/video-edit}"
mkdir -p "$CACHE/models" "$CACHE/fonts"
[ -f /root/.ccr/ca-bundle.crt ] && export SSL_CERT_FILE=/root/.ccr/ca-bundle.crt

python3 - <<'EOF' 2>/dev/null || pip install -q sherpa-onnx imageio-ffmpeg soundfile numpy pillow rapidocr-onnxruntime edge-tts 2>&1 | grep -v -i warning || true
import sherpa_onnx, imageio_ffmpeg, soundfile, numpy, PIL, rapidocr_onnxruntime
EOF

REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
fetch_tar() {  # $1=폴더 이름  $2=릴리스 태그
  [ -d "$CACHE/models/$1" ] && return
  echo "  모델 받는 중: $1"
  curl -sSL --fail -m 900 "$REL/$2/$1.tar.bz2" | tar xj -C "$CACHE/models"
}
fetch_tar sherpa-onnx-zipformer-korean-2024-06-24 asr-models          # 한국어 받아쓰기 (낱말 시각 포함)
[ -f "$CACHE/models/silero_vad.onnx" ] || curl -sSL --fail -m 300 -o "$CACHE/models/silero_vad.onnx" "$REL/asr-models/silero_vad.onnx"

if [ ! -f "$CACHE/fonts/Pretendard-Bold.otf" ]; then
  echo "  글꼴 받는 중: Pretendard"
  tmp=$(mktemp -d)
  (cd "$tmp" && npm pack pretendard --silent >/dev/null && tar xzf pretendard-*.tgz)
  cp "$tmp"/package/dist/public/static/Pretendard-{Medium,SemiBold,Bold,ExtraBold,Black}.otf "$CACHE/fonts/"
  rm -rf "$tmp"
fi

echo "준비 완료: $CACHE"
