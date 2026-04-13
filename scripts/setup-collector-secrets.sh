#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT_DIR/worker"
ENV_FILE="$ROOT_DIR/.env.local"
WRANGLER_FILE="$WORKER_DIR/wrangler.toml"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler is required. Install it first."
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate API_SECRET."
  exit 1
fi

if [[ ! -r "$WRANGLER_FILE" ]]; then
  echo "worker/wrangler.toml is missing or unreadable."
  exit 1
fi

worker_name="$(sed -n 's/^name = "\(.*\)"/\1/p' "$WRANGLER_FILE" | head -n 1)"
worker_url="https://${worker_name}.workers.dev"

if [[ -z "$worker_name" ]]; then
  echo "Failed to read worker name from worker/wrangler.toml."
  exit 1
fi

escape_env_value() {
  local value="$1"

  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"

  printf '"%s"' "$value"
}

upsert_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local rendered
  local tmp
  local updated=0

  rendered="${key}=$(escape_env_value "$value")"
  tmp="$(mktemp)"

  if [[ -f "$file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" == "$key="* ]]; then
        printf '%s\n' "$rendered" >> "$tmp"
        updated=1
      else
        printf '%s\n' "$line" >> "$tmp"
      fi
    done < "$file"

    if [[ "$updated" -eq 0 ]]; then
      printf '%s\n' "$rendered" >> "$tmp"
    fi
  else
    printf '%s\n' "$rendered" > "$tmp"
  fi

  mv "$tmp" "$file"
}

printf "GitHub classic PAT (repo scope): "
read -r -s GITHUB_TOKEN
printf "\n"

if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "GITHUB_TOKEN is required."
  exit 1
fi

printf "API_SECRET (leave blank to auto-generate): "
read -r -s API_SECRET
printf "\n"

if [[ -z "$API_SECRET" ]]; then
  API_SECRET="$(openssl rand -hex 32)"
  echo "Generated API_SECRET."
fi

printf "COLLECTOR_TRIGGER_TOKEN (leave blank to auto-generate): "
read -r -s COLLECTOR_TRIGGER_TOKEN
printf "\n"

if [[ -z "$COLLECTOR_TRIGGER_TOKEN" ]]; then
  COLLECTOR_TRIGGER_TOKEN="$(openssl rand -hex 32)"
  echo "Generated COLLECTOR_TRIGGER_TOKEN."
fi

cd "$WORKER_DIR"

printf '%s' "$GITHUB_TOKEN" | wrangler secret put GITHUB_TOKEN
printf '%s' "$API_SECRET" | wrangler secret put API_SECRET

upsert_env_value "$ENV_FILE" "NEXT_PUBLIC_COLLECTOR_URL" "$worker_url"
upsert_env_value "$ENV_FILE" "COLLECTOR_API_SECRET" "$API_SECRET"
upsert_env_value "$ENV_FILE" "COLLECTOR_TRIGGER_TOKEN" "$COLLECTOR_TRIGGER_TOKEN"

echo
echo "Secrets uploaded."
echo "Updated local env file: $ENV_FILE"
echo "Use the following values for Vercel env:"
echo "NEXT_PUBLIC_COLLECTOR_URL=$worker_url"
echo "COLLECTOR_API_SECRET=$API_SECRET"
echo "COLLECTOR_TRIGGER_TOKEN=$COLLECTOR_TRIGGER_TOKEN"
echo
echo "Recommended next checks:"
echo "1. Add the three env vars above to Vercel and redeploy."
echo "2. Local .env.local is already updated. Run:"
echo "   npm run collector:check:trigger"
