#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT_DIR/worker"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler is required. Install it first."
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate API_SECRET."
  exit 1
fi

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

cd "$WORKER_DIR"

printf '%s' "$GITHUB_TOKEN" | wrangler secret put GITHUB_TOKEN
printf '%s' "$API_SECRET" | wrangler secret put API_SECRET

echo
echo "Secrets uploaded."
echo "Use the following values for local/Vercel env:"
echo "NEXT_PUBLIC_COLLECTOR_URL=https://repo-radar-collector.kiyo-nomura.workers.dev"
echo "COLLECTOR_API_SECRET=$API_SECRET"
echo
echo "Recommended next checks:"
echo "1. Add the two env vars above to Vercel and redeploy."
echo "2. Optionally set them in .env.local, then run:"
echo "   npm run collector:check:trigger"
