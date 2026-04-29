#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
ASSUME_YES=false
SKIP_VERCEL_ENV=false
SKIP_VERCEL_CHECK=false
SKIP_DEPLOY=false
SKIP_CHECK=false

print_usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-collector.sh [options]

Options:
  --yes               Run non-interactively (deploy/check are auto-run)
  --env-file <path>   Path to env file (default: .env.local)
  --skip-vercel-env   Skip pushing env vars to Vercel
  --skip-vercel-check Skip checking collector env vars on Vercel
  --skip-deploy       Skip production deploy step
  --skip-check        Skip collector check/trigger step
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=true
      shift
      ;;
    --env-file)
      if [[ $# -lt 2 ]]; then
        echo "--env-file requires a path argument"
        exit 1
      fi
      ENV_FILE="$2"
      shift 2
      ;;
    --skip-vercel-env)
      SKIP_VERCEL_ENV=true
      shift
      ;;
    --skip-vercel-check)
      SKIP_VERCEL_CHECK=true
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=true
      shift
      ;;
    --skip-check)
      SKIP_CHECK=true
      shift
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

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler is required. Install it first."
  exit 1
fi

if [[ "$SKIP_VERCEL_ENV" == "false" || "$SKIP_VERCEL_CHECK" == "false" || "$SKIP_DEPLOY" == "false" ]] && ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI is required. Install it first: npm i -g vercel"
  exit 1
fi

echo "Step 1/5: Upload worker secrets and sync local env file"
bash "$ROOT_DIR/scripts/setup-collector-secrets.sh" --env-file "$ENV_FILE"

if [[ "$SKIP_VERCEL_ENV" == "true" ]]; then
  echo
  echo "Step 2/5: Skipped Vercel env sync (--skip-vercel-env)"
else
  echo
  echo "Step 2/5: Push collector env vars to Vercel"
  bash "$ROOT_DIR/scripts/push-vercel-collector-env.sh" "$ENV_FILE"
fi

if [[ "$SKIP_VERCEL_ENV" == "true" || "$SKIP_VERCEL_CHECK" == "true" ]]; then
  echo
  echo "Step 3/5: Skipped Vercel env verification."
elif [[ "$ASSUME_YES" == "true" ]]; then
  echo
  echo "Step 3/5: Verifying collector env vars on Vercel (--yes)"
  bash "$ROOT_DIR/scripts/check-vercel-collector-env.sh"
else
  echo
  read -r -p "Step 3/5: Verify collector env vars on Vercel now? [Y/n] " run_vercel_check
  case "$run_vercel_check" in
    [Nn]|[Nn][Oo])
      echo "Skipped Vercel env verification. Run 'npm run collector:check:vercel-env' when ready."
      ;;
    *)
      bash "$ROOT_DIR/scripts/check-vercel-collector-env.sh"
      ;;
  esac
fi

if [[ "$SKIP_DEPLOY" == "true" ]]; then
  echo
  echo "Step 4/5: Skipped deploy (--skip-deploy)."
  echo "Run 'vercel --prod' when ready."
elif [[ "$ASSUME_YES" == "true" ]]; then
  echo
  echo "Step 4/5: Triggering production deploy (--yes)"
  (cd "$ROOT_DIR" && vercel --prod)
else
  echo
  read -r -p "Step 4/5: Trigger a production deploy now? [Y/n] " deploy_now
  case "$deploy_now" in
    [Nn]|[Nn][Oo])
      echo "Skipped deploy. Run 'vercel --prod' when ready."
      ;;
    *)
      (cd "$ROOT_DIR" && vercel --prod)
      ;;
  esac
fi

if [[ "$SKIP_CHECK" == "true" ]]; then
  echo
  echo "Step 5/5: Skipped check (--skip-check)."
  echo "Run 'npm run collector:check:trigger' when ready."
elif [[ "$ASSUME_YES" == "true" ]]; then
  echo
  echo "Step 5/5: Running collector check + trigger (--yes)"
  (cd "$ROOT_DIR" && npm run collector:check:trigger)
else
  echo
  read -r -p "Step 5/5: Run collector sync check + manual trigger now? [Y/n] " run_check
  case "$run_check" in
    [Nn]|[Nn][Oo])
      echo "Skipped check. Run 'npm run collector:check:trigger' when ready."
      ;;
    *)
      (cd "$ROOT_DIR" && npm run collector:check:trigger)
      ;;
  esac
fi

echo
echo "Collector bootstrap flow completed."
