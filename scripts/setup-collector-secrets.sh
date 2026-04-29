#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT_DIR/worker"
ENV_FILE="$ROOT_DIR/.env.local"
WRANGLER_FILE="$WORKER_DIR/wrangler.toml"

print_usage() {
  cat <<'EOF'
Usage: scripts/setup-collector-secrets.sh [options]

Options:
  --env-file <path>  Path to local env file to update (default: .env.local)
  --worker-url <url> Full deployed Worker URL, e.g.
                     https://repo-radar-collector.<workers-dev-subdomain>.workers.dev
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      if [[ $# -lt 2 ]]; then
        echo "--env-file requires a path argument"
        exit 1
      fi
      ENV_FILE="$2"
      shift 2
      ;;
    --worker-url)
      if [[ $# -lt 2 ]]; then
        echo "--worker-url requires a URL argument"
        exit 1
      fi
      COLLECTOR_WORKER_URL="$2"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_usage
      exit 1
      ;;
  esac
done

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$PWD/$ENV_FILE"
fi

export WRANGLER_LOG_PATH="${WRANGLER_LOG_PATH:-$ROOT_DIR/.wrangler/logs}"
mkdir -p "$WRANGLER_LOG_PATH"

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
worker_github_username="$(sed -n 's/^GITHUB_USERNAME = "\(.*\)"/\1/p' "$WRANGLER_FILE" | head -n 1)"

if [[ -z "$worker_name" ]]; then
  echo "Failed to read worker name from worker/wrangler.toml."
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"
  local value

  if [[ ! -f "$file" ]]; then
    return
  fi

  value="$(sed -n "s/^${key}=//p" "$file" | head -n 1)"

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

normalize_worker_url() {
  local value="$1"

  value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  value="${value%/}"

  printf '%s' "$value"
}

validate_worker_url() {
  local value="$1"
  local host
  local label_count

  if [[ ! "$value" =~ ^https?://[^/?#]+$ ]]; then
    echo "Collector Worker URL must be a bare http(s) origin, not a path, query, or fragment: $value"
    return 1
  fi

  host="${value#http://}"
  host="${host#https://}"

  if [[ "$host" == *.workers.dev ]]; then
    label_count="$(awk -F. '{ print NF }' <<< "$host")"
    if [[ "$label_count" -lt 4 ]]; then
      echo "Collector Worker URL is missing the workers.dev account subdomain: $value"
      echo "Expected: https://${worker_name}.<workers-dev-subdomain>.workers.dev"
      return 1
    fi
  fi
}

worker_url="$(
  normalize_worker_url "${COLLECTOR_WORKER_URL:-${NEXT_PUBLIC_COLLECTOR_URL:-}}"
)"

if ! has_real_value "$worker_url"; then
  worker_url="$(normalize_worker_url "$(read_env_value "$ENV_FILE" NEXT_PUBLIC_COLLECTOR_URL)")"
fi

if ! has_real_value "$worker_url"; then
  echo "Collector Worker URL is required."
  echo "Use the deployed workers.dev origin, for example:"
  echo "  https://${worker_name}.<workers-dev-subdomain>.workers.dev"
  printf "Collector Worker URL: "
  read -r worker_url
  worker_url="$(normalize_worker_url "$worker_url")"
fi

if ! has_real_value "$worker_url"; then
  echo "Collector Worker URL is required."
  echo "You can pass it non-interactively with:"
  echo "  COLLECTOR_WORKER_URL=https://${worker_name}.<workers-dev-subdomain>.workers.dev bash scripts/setup-collector-secrets.sh"
  exit 1
fi

validate_worker_url "$worker_url"

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
  mkdir -p "$(dirname "$file")"
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

GITHUB_TOKEN="${COLLECTOR_GITHUB_TOKEN:-}"
if [[ -z "$GITHUB_TOKEN" ]]; then
  printf "GitHub classic PAT (repo scope): "
  read -r -s GITHUB_TOKEN
  printf "\n"
else
  echo "[using COLLECTOR_GITHUB_TOKEN from environment]"
fi

if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "GITHUB_TOKEN is required."
  exit 1
fi

API_SECRET="${COLLECTOR_API_SECRET:-}"
if [[ -z "$API_SECRET" ]]; then
  printf "API_SECRET (leave blank to auto-generate): "
  read -r -s API_SECRET
  printf "\n"
else
  echo "[using COLLECTOR_API_SECRET from environment]"
fi

if [[ -z "$API_SECRET" ]]; then
  API_SECRET="$(openssl rand -hex 32)"
  echo "Generated API_SECRET."
fi

COLLECTOR_TRIGGER_TOKEN="${COLLECTOR_TRIGGER_TOKEN:-}"
if [[ -z "$COLLECTOR_TRIGGER_TOKEN" ]]; then
  printf "COLLECTOR_TRIGGER_TOKEN (leave blank to auto-generate): "
  read -r -s COLLECTOR_TRIGGER_TOKEN
  printf "\n"
else
  echo "[using COLLECTOR_TRIGGER_TOKEN from environment]"
fi

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

if [[ -n "$worker_github_username" && "$worker_github_username" != "your-github-username" ]]; then
  upsert_env_value "$ENV_FILE" "GITHUB_USERNAME" "$worker_github_username"
fi

echo
echo "Secrets uploaded."
echo "Updated local env file: $ENV_FILE"
echo "Use the following values for Vercel env:"
echo "NEXT_PUBLIC_COLLECTOR_URL=$worker_url"
echo "COLLECTOR_API_SECRET=$API_SECRET"
echo "COLLECTOR_TRIGGER_TOKEN=$COLLECTOR_TRIGGER_TOKEN"
if [[ -n "$worker_github_username" && "$worker_github_username" != "your-github-username" ]]; then
  echo "GITHUB_USERNAME=$worker_github_username (synced from worker/wrangler.toml)"
fi
echo
echo "Recommended next checks:"
echo "1. Add the three env vars above to Vercel and redeploy."
echo "2. Local .env.local is already updated. Run:"
echo "   npm run collector:check:trigger"
