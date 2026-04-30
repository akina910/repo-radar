# Repo Radar

A small dashboard for tracking how your public GitHub repositories are doing.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fakina910%2Frepo-radar&project-name=repo-radar&env=GITHUB_USERNAME,GITHUB_TOKEN,NEXT_PUBLIC_COLLECTOR_URL,COLLECTOR_API_SECRET,COLLECTOR_TRIGGER_TOKEN)

## What it does
- loads your public GitHub repositories
- paginates GitHub repo listing so accounts with 100+ repos are fully covered (up to 2,000 repos)
- shows stars, forks, open issues, last update time
- optionally shows views, peak daily views, and clones from GitHub traffic endpoints
- surfaces top referrers when the Cloudflare collector is enabled
- batches collector traffic/referrer fetches in chunks to stay stable even with large repo lists
- limits batch proxy concurrency and applies request timeouts so collector hiccups degrade gracefully
- lets you sort the list to spot what is moving

## Why it exists
GitHub traffic is repo-by-repo and awkward to scan. This app puts public repos into one visual pass so you can decide what to touch next.

## Stack
- Next.js 16
- React 19
- Tailwind CSS 4

## Setup
1. Copy `.env.example` to `.env.local`
2. Set:
   - `GITHUB_USERNAME`
   - `GITHUB_TOKEN` if you want traffic metrics
3. Run:

```bash
npm install
npm run dev
```

## Environment
```bash
GITHUB_USERNAME=your-github-username
GITHUB_TOKEN=your-github-token
```

## Notes
- `GITHUB_USERNAME` is required unless you pass `?username=...` in the URL
- `GITHUB_TOKEN` is optional for basic repo metadata
- views / clones depend on GitHub traffic endpoints and may be unavailable without a token
- `NEXT_PUBLIC_COLLECTOR_URL` enables 90-day traffic history, collector sync status, and referrer badges
- `COLLECTOR_API_SECRET` is needed when the Next.js app or the verification script should trigger the collector
- `COLLECTOR_TRIGGER_TOKEN` is optional (if omitted, browser unlock falls back to `COLLECTOR_API_SECRET`)
- this MVP only looks at public repositories owned by one account
- for one-click setup on Vercel, fill in `GITHUB_USERNAME` and `GITHUB_TOKEN` during the Deploy Button flow, and also set `NEXT_PUBLIC_COLLECTOR_URL` + `COLLECTOR_API_SECRET` (optionally `COLLECTOR_TRIGGER_TOKEN`) if you want the collector verification / trigger flow to work

## Collector Setup
The Cloudflare Worker is already wired for `repo-radar-collector`. What remains is secrets + env wiring.

### Fast path (recommended)
Run the full bootstrap flow:

```bash
npm run collector:bootstrap
```

This runs:
- `scripts/setup-collector-secrets.sh` (uploads Worker secrets + writes local `.env.local`)
- `scripts/push-vercel-collector-env.sh` (syncs collector env vars to Vercel)
- `scripts/check-vercel-collector-env.sh` (verifies required collector env vars on Vercel; `COLLECTOR_TRIGGER_TOKEN` is optional)
- optional `vercel --prod`
- optional `npm run collector:check:trigger`

Semi non-interactive execution (`deploy/check` prompts are auto-approved; Step 1 secret input is still interactive):

```bash
npm run collector:bootstrap -- --yes
```

Fully non-interactive secret upload is also supported by exporting values first:

```bash
COLLECTOR_GITHUB_TOKEN=ghp_xxx \
COLLECTOR_API_SECRET="$(openssl rand -hex 32)" \
COLLECTOR_TRIGGER_TOKEN="$(openssl rand -hex 32)" \
bash scripts/setup-collector-secrets.sh
```

Skip specific steps when needed:

```bash
npm run collector:bootstrap -- --skip-deploy --skip-check
```

Use a non-default local env file when staging values:

```bash
npm run collector:bootstrap -- --env-file .env.production.local --skip-deploy
```

### Manual path
1. Upload Worker secrets in one pass:

```bash
bash scripts/setup-collector-secrets.sh
```

This uploads `GITHUB_TOKEN` / `API_SECRET` to the Worker and also updates local `.env.local` with:
- `GITHUB_USERNAME` (synced from `worker/wrangler.toml` when configured)
- `NEXT_PUBLIC_COLLECTOR_URL`
- `COLLECTOR_API_SECRET`
- `COLLECTOR_TRIGGER_TOKEN` (optional)

To update a different env file, pass `--env-file <path>`.

2. Push collector env values to Vercel from `.env.local`:

```bash
npm run collector:push:vercel-env
```

For a custom env file, pass it through to the script:

```bash
npm run collector:push:vercel-env -- .env.production.local
```

2.5. Verify Vercel env wiring before redeploy:

```bash
npm run collector:check:vercel-env
```

3. Redeploy the Vercel app.
4. Open the app and use the `Sync collector` button once to force the first collection.
5. Verify collector health:

```bash
npm run collector:check
npm run collector:check:offline
npm run collector:check:trigger
```

`collector:check` reads `.env.local` or shell env, fetches `/api/status`, and prints D1 history coverage together with a local env checklist.
`collector:check:offline` skips network calls and validates only local `.env.local` + `worker/wrangler.toml` wiring (good for preflight before secrets/env are fully connected).
`collector:check:trigger` also sends `POST /api/collect` before re-reading status.
The check script also flags stale collector history when the latest snapshot is more than 2 days old, which usually means the first manual sync has not run or the Worker cron needs attention.
`/api/status` always returns runtime configuration booleans (no secret values). `X-API-Secret` is only needed for protected actions like `POST /api/collect`.
If Worker secrets are missing, `collector:check` prints concrete `wrangler secret put ...` commands.
If you prefer to avoid local scripts after deployment, the app exposes a server-side `Sync collector` action that uses `COLLECTOR_API_SECRET` from Vercel env. Browser unlock uses `COLLECTOR_TRIGGER_TOKEN` when present, and falls back to `COLLECTOR_API_SECRET` when omitted.
