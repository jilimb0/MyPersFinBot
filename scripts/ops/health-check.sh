#!/usr/bin/env bash
set -euo pipefail

URL="${HEALTHCHECK_URL:-http://127.0.0.1:3005/healthz}"
TIMEOUT="${HEALTHCHECK_TIMEOUT:-5}"
AUTH_USER="${HEALTH_BASIC_AUTH_USER:-}"
AUTH_PASS="${HEALTH_BASIC_AUTH_PASS:-}"

CURL_ARGS=(--silent --show-error --location --max-time "$TIMEOUT" --write-out "%{http_code}" --output /tmp/my-pers-fin-health.out)

if [[ -n "$AUTH_USER" && -n "$AUTH_PASS" ]]; then
  CURL_ARGS+=(--user "$AUTH_USER:$AUTH_PASS")
fi

HTTP_CODE="$(curl "${CURL_ARGS[@]}" "$URL")"

if [[ "$HTTP_CODE" == "200" ]]; then
  printf '[OK] %s -> %s\n' "$URL" "$HTTP_CODE"
  exit 0
fi

BODY="$(cat /tmp/my-pers-fin-health.out 2>/dev/null || true)"
printf '[ERROR] %s -> %s\n' "$URL" "$HTTP_CODE"
if [[ -n "$BODY" ]]; then
  printf 'Body: %s\n' "$BODY"
fi
exit 1
