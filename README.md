# Repo Radar

A small dashboard for tracking how your public GitHub repositories are doing.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fakina910%2Frepo-radar&project-name=repo-radar&env=GITHUB_USERNAME,GITHUB_TOKEN,NEXT_PUBLIC_COLLECTOR_URL,COLLECTOR_API_SECRET)

## What it does
- loads your public GitHub repositories
- shows stars, forks, open issues, last update time
- optionally shows views, peak daily views, and clones from GitHub traffic endpoints
- surfaces top referrers when the Cloudflare collector is enabled
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
- `COLLECTOR_TRIGGER_TOKEN` is needed when you want to unlock the browser-side `Sync collector` button safely
- this MVP only looks at public repositories owned by one account
- for one-click setup on Vercel, fill in `GITHUB_USERNAME` and `GITHUB_TOKEN` during the Deploy Button flow, and also set `NEXT_PUBLIC_COLLECTOR_URL` + `COLLECTOR_API_SECRET` + `COLLECTOR_TRIGGER_TOKEN` if you want the collector verification / trigger flow to work

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
- optional `vercel --prod`
- optional `npm run collector:check:trigger`

Semi non-interactive execution (`deploy/check` prompts are auto-approved; Step 1 secret input is still interactive):

```bash
npm run collector:bootstrap -- --yes
```

Skip specific steps when needed:

```bash
npm run collector:bootstrap -- --skip-deploy --skip-check
```

### Manual path
1. Upload Worker secrets in one pass:

```bash
bash scripts/setup-collector-secrets.sh
```

This uploads `GITHUB_TOKEN` / `API_SECRET` to the Worker and also updates local `.env.local` with:
- `NEXT_PUBLIC_COLLECTOR_URL`
- `COLLECTOR_API_SECRET`
- `COLLECTOR_TRIGGER_TOKEN`

2. Push collector env values to Vercel from `.env.local`:

```bash
npm run collector:push:vercel-env
```

3. Redeploy the Vercel app.
4. Open the app and use the `Sync collector` button once to force the first collection.
5. Verify collector health:

```bash
npm run collector:check
npm run collector:check:trigger
```

`collector:check` reads `.env.local` or shell env, fetches `/api/status`, and prints D1 history coverage together with a local env checklist.
`collector:check:trigger` also sends `POST /api/collect` before re-reading status.
If Worker secrets are missing, `collector:check` prints concrete `wrangler secret put ...` commands.
If you prefer to avoid local scripts after deployment, the app exposes a server-side `Sync collector` action that uses `COLLECTOR_API_SECRET` from Vercel env and requires `COLLECTOR_TRIGGER_TOKEN` to unlock it in the browser.
