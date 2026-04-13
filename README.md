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
- `COLLECTOR_API_SECRET` is only needed when you want to manually trigger the collector from the verification script
- this MVP only looks at public repositories owned by one account
- for one-click setup on Vercel, fill in `GITHUB_USERNAME` and `GITHUB_TOKEN` during the Deploy Button flow, and also set `NEXT_PUBLIC_COLLECTOR_URL` + `COLLECTOR_API_SECRET` if you want the collector verification / trigger flow to work

## Collector Setup
The Cloudflare Worker is already wired for `repo-radar-collector`. What remains is secrets + env wiring.

1. Upload Worker secrets in one pass:

```bash
bash scripts/setup-collector-secrets.sh
```

2. Add the printed values to Vercel as:
   - `NEXT_PUBLIC_COLLECTOR_URL`
   - `COLLECTOR_API_SECRET`
3. Redeploy the Vercel app.
4. Verify collector health:

```bash
npm run collector:check
npm run collector:check:trigger
```

`collector:check` reads `.env.local` or shell env, fetches `/api/status`, and prints D1 history coverage.  
`collector:check:trigger` also sends `POST /api/collect` before re-reading status.
