#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env.local}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI is required. Install it first: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  echo "Run scripts/setup-collector-secrets.sh first."
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1)"

  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
    printf '%b' "$value"
    return
  fi

  printf '%s' "$value"
}

has_real_value() {
  local value="$1"
  [[ -n "$value" && "$value" != your-* && "$value" != *your-collector-worker* ]]
}

NEXT_PUBLIC_COLLECTOR_URL="$(read_env_value NEXT_PUBLIC_COLLECTOR_URL)"
COLLECTOR_API_SECRET="$(read_env_value COLLECTOR_API_SECRET)"
COLLECTOR_TRIGGER_TOKEN="$(read_env_value COLLECTOR_TRIGGER_TOKEN)"

if ! has_real_value "$NEXT_PUBLIC_COLLECTOR_URL"; then
  echo "NEXT_PUBLIC_COLLECTOR_URL is missing or placeholder in $ENV_FILE"
  exit 1
fi

if ! has_real_value "$COLLECTOR_API_SECRET"; then
  echo "COLLECTOR_API_SECRET is missing or placeholder in $ENV_FILE"
  exit 1
fi

if ! has_real_value "$COLLECTOR_TRIGGER_TOKEN"; then
  echo "COLLECTOR_TRIGGER_TOKEN is missing or placeholder in $ENV_FILE"
  exit 1
fi

set_vercel_env() {
  local key="$1"
  local value="$2"
  local target_env="$3"

  # Remove existing value if present; ignore when not found.
  vercel env rm "$key" "$target_env" --yes >/dev/null 2>&1 || true
  printf '%s\n' "$value" | vercel env add "$key" "$target_env" >/dev/null
  echo "set ${key} (${target_env})"
}

echo "Applying collector env vars to Vercel (production / preview / development)..."

for target in production preview development; do
  set_vercel_env "NEXT_PUBLIC_COLLECTOR_URL" "$NEXT_PUBLIC_COLLECTOR_URL" "$target"
  set_vercel_env "COLLECTOR_API_SECRET" "$COLLECTOR_API_SECRET" "$target"
  set_vercel_env "COLLECTOR_TRIGGER_TOKEN" "$COLLECTOR_TRIGGER_TOKEN" "$target"
done

echo
echo "Done. Next step:"
echo "  vercel --prod"
