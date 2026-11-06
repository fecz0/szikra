#!/usr/bin/env bash
# Szikra CI deploy: csak ezt futtathatja a CI kulcsa (authorized_keys forced command).
# Hívás: ssh host "<main|preview> <40 hex commit sha> [report]" < csomag.tgz
#   (nincs 3. argumentum) a build kicsomagolása + szolgáltatás újraindítása
#   report                a Playwright HTML riport kicsomagolása (/report/ alatt látszik)
set -euo pipefail
read -r ENVNAME SHA MODE EXTRA <<<"${SSH_ORIGINAL_COMMAND:-}"
if [[ ! "${ENVNAME:-}" =~ ^(main|preview)$ ]] || [[ ! "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] \
   || [[ -n "${MODE:-}" && "$MODE" != "report" ]] || [[ -n "${EXTRA:-}" ]]; then
  echo "hibás argumentumok" >&2; exit 2
fi
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
BASE="$HOME/szikra"
REPORTS="/var/www/szikra-reports"
exec 9>"$BASE/.deploy.lock"; flock -w 120 9

if [[ "${MODE:-}" == "report" ]]; then
  STAGE="$(mktemp -d "$REPORTS/.stage.XXXXXX")"
  trap 'rm -rf "$STAGE"' EXIT
  head -c 200M | tar -xzf - -C "$STAGE" --no-same-owner --no-same-permissions
  [[ -f "$STAGE/index.html" ]] || { echo "érvénytelen riport" >&2; exit 3; }
  chmod -R a+rX "$STAGE"
  rm -rf "$REPORTS/$ENVNAME.prev"
  [[ -d "$REPORTS/$ENVNAME" ]] && mv "$REPORTS/$ENVNAME" "$REPORTS/$ENVNAME.prev"
  mv "$STAGE" "$REPORTS/$ENVNAME"
  rm -rf "$REPORTS/$ENVNAME.prev"
  echo "report ok: $ENVNAME $SHA"; exit 0
fi

STAGE="$(mktemp -d "$BASE/.stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
head -c 200M | tar -xzf - -C "$STAGE" --no-same-owner --no-same-permissions
[[ -f "$STAGE/server/index.mjs" ]] || { echo "érvénytelen csomag" >&2; exit 3; }
rm -rf "$BASE/$ENVNAME/.output.prev"
[[ -d "$BASE/$ENVNAME/.output" ]] && mv "$BASE/$ENVNAME/.output" "$BASE/$ENVNAME/.output.prev"
mv "$STAGE" "$BASE/$ENVNAME/.output"
sed -i '/^NUXT_BUILD_SHA=/d' "$BASE/$ENVNAME.env"
echo "NUXT_BUILD_SHA=$SHA" >> "$BASE/$ENVNAME.env"
systemctl --user restart "szikra@$ENVNAME"
echo "deploy ok: $ENVNAME $SHA"
