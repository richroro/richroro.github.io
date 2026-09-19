#!/usr/bin/env bash
#
# YouTube Data API v3 키를 gcloud CLI 로 만든다.
# 콘솔에서 클릭으로 하는 것과 결과는 같다. 자세한 설명은 docs/youtube-api-setup.md 참고.
#
#   ./scripts/setup-youtube-api.sh
#   PROJECT_ID=my-proj REFERRERS="https://richroro.github.io/*" ./scripts/setup-youtube-api.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-}"
KEY_NAME="${KEY_NAME:-youtube-data-api}"
REFERRERS="${REFERRERS:-}"   # 브라우저에서 쓸 키. 예: "https://richroro.github.io/*,http://localhost:*"
IPS="${IPS:-}"               # 서버/배치에서 쓸 키. 예: "1.2.3.4,5.6.7.0/24"

die() { printf '\n[에러] %s\n' "$*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }

command -v gcloud >/dev/null 2>&1 || die $'gcloud 가 없다. 먼저 설치한다.\n  https://cloud.google.com/sdk/docs/install'

# api-keys 명령은 구버전 gcloud 에서 alpha 에만 있다.
GC=(gcloud services api-keys)
if ! gcloud services api-keys --help >/dev/null 2>&1; then
  gcloud alpha services api-keys --help >/dev/null 2>&1 \
    || die $'이 gcloud 에는 api-keys 명령이 없다. gcloud components update 로 업데이트한다.'
  GC=(gcloud alpha services api-keys)
  echo "[안내] GA 명령이 없어 alpha 를 쓴다."
fi

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1)"
[ -n "$ACCOUNT" ] || die $'로그인이 안 돼 있다. 먼저 실행한다.\n  gcloud auth login'
say "계정: $ACCOUNT"

if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
  [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "(unset)" ] \
    || die $'프로젝트를 못 찾았다. 둘 중 하나로 지정한다.\n  PROJECT_ID=my-proj ./scripts/setup-youtube-api.sh\n  gcloud config set project my-proj'
fi
gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 \
  || die "프로젝트 '$PROJECT_ID' 에 접근할 수 없다. 이름이 맞는지, 권한이 있는지 확인한다."
say "프로젝트: $PROJECT_ID"

say "API 사용 설정 (youtube.googleapis.com, apikeys.googleapis.com)"
gcloud services enable youtube.googleapis.com apikeys.googleapis.com --project="$PROJECT_ID"

# 같은 이름의 키가 이미 있으면 새로 만들지 않는다.
EXISTING="$("${GC[@]}" list --project="$PROJECT_ID" --filter="displayName='$KEY_NAME'" --format='value(name)' 2>/dev/null | head -1)"
if [ -n "$EXISTING" ]; then
  say "'$KEY_NAME' 키가 이미 있다. 새로 만들지 않고 그대로 쓴다."
  KEY_RES="$EXISTING"
else
  ARGS=(--project="$PROJECT_ID" --display-name="$KEY_NAME" --api-target=service=youtube.googleapis.com)
  if [ -n "$REFERRERS" ]; then
    ARGS+=(--allowed-referrers="$REFERRERS")
  elif [ -n "$IPS" ]; then
    ARGS+=(--allowed-ips="$IPS")
  else
    cat <<'WARN'

[경고] REFERRERS / IPS 를 안 줬다. 아무 데서나 쓸 수 있는 키가 만들어진다.
       키가 유출되면 남이 내 할당량을 태운다. 만든 뒤 콘솔에서 반드시 제한을 건다.
WARN
  fi
  say "키 생성: $KEY_NAME"
  "${GC[@]}" create "${ARGS[@]}"
  KEY_RES="$("${GC[@]}" list --project="$PROJECT_ID" --filter="displayName='$KEY_NAME'" --format='value(name)' | head -1)"
  [ -n "$KEY_RES" ] || die "키를 만들었는데 목록에서 못 찾았다. 콘솔에서 확인한다: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
fi

KEY_STRING="$("${GC[@]}" get-key-string "$KEY_RES" --format='value(keyString)')"
[ -n "$KEY_STRING" ] || die "키 문자열을 못 읽었다. 권한(serviceusage.apiKeys.get)을 확인한다."

cat <<EOS

== 완료
키 이름 : $KEY_NAME
리소스  : $KEY_RES
키      : $KEY_STRING

다음:
  echo 'YOUTUBE_API_KEY=$KEY_STRING' >> .env     # .env 는 .gitignore 에 들어 있다
  node scripts/youtube-api-check.mjs             # 키가 실제로 먹는지 확인

키는 절대 커밋하지 않는다. 깃에 올라가면 즉시 폐기하고 새로 만든다.
콘솔: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID
EOS
