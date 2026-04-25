#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_KEYS=(
  "NEXT_PUBLIC_COLLECTOR_URL"
  "COLLECTOR_API_SECRET"
)
OPTIONAL_KEYS=("COLLECTOR_TRIGGER_TOKEN")
TARGETS=("production" "preview" "development")
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI is required. Install it first: npm i -g vercel"
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"
  local value

  value="$(sed -n "s/^${key}=//p" "$file" | head -n 1)"

  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
    printf '%b' "$value"
    return
  fi

  printf '%s' "$value"
}

echo "Checking Vercel collector envs (project: $(basename "$ROOT_DIR"))"

overall_ok=true

for target in "${TARGETS[@]}"; do
  env_file="$TMP_DIR/.env.${target}"

  if ! vercel env pull "$env_file" --environment "$target" >/dev/null 2>&1; then
    echo "[$target] failed to read envs (run 'vercel link' or login again)"
    overall_ok=false
    continue
  fi

  echo "[$target]"
  for key in "${REQUIRED_KEYS[@]}"; do
    value="$(read_env_value "$env_file" "$key")"
    if [[ -n "$value" ]]; then
      echo "  - ${key}: ok"
    else
      echo "  - ${key}: missing"
      overall_ok=false
    fi
  done

  for key in "${OPTIONAL_KEYS[@]}"; do
    value="$(read_env_value "$env_file" "$key")"
    if [[ -n "$value" ]]; then
      echo "  - ${key}: ok"
    else
      echo "  - ${key}: optional (fallback to COLLECTOR_API_SECRET)"
    fi
  done
done

if [[ "$overall_ok" == "true" ]]; then
  echo "Required collector envs are present in Vercel."
  exit 0
fi

echo "Missing collector envs detected. Run: npm run collector:push:vercel-env"
exit 1
