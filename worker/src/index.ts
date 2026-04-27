/**
 * repo-radar-collector
 * Cloudflare Worker that collects GitHub Traffic data daily and exposes a REST API.
 *
 * Cron: runs at 02:00 UTC every day
 * API:
 *   GET /api/repos                       – repo list with 14-day + 90-day aggregated traffic
 *   GET /api/repos/:name/traffic?days=90 – daily traffic snapshots for one repo
 *   GET /api/repos/:name/referrers?days=30 – top referrers aggregated over recent days
 *   POST /api/collect                    – manual trigger (requires API_SECRET header)
 */

export interface Env {
  repo_radar_db: D1Database;
  repo_radar_kv: KVNamespace;
  GITHUB_USERNAME: string;
  GITHUB_TOKEN: string;
  API_SECRET: string;
}

const GH_BASE = "https://api.github.com";
const GITHUB_REPOS_PAGE_SIZE = 100;
const GITHUB_REPOS_MAX_PAGES = 20;

function ghHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "repo-radar-collector/1.0",
  };
}

async function ghFetch<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${GH_BASE}${path}`, { headers: ghHeaders(token) });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function ghFetchOwnerRepos(owner: string, token: string): Promise<GHRepo[] | null> {
  const allRepos: GHRepo[] = [];

  for (let page = 1; page <= GITHUB_REPOS_MAX_PAGES; page += 1) {
    const pageRepos = await ghFetch<GHRepo[]>(
      `/users/${owner}/repos?per_page=${GITHUB_REPOS_PAGE_SIZE}&type=owner&sort=updated&page=${page}`,
      token,
    );

    if (!pageRepos) {
      return null;
    }

    if (pageRepos.length === 0) {
      break;
    }

    allRepos.push(...pageRepos);

    if (pageRepos.length < GITHUB_REPOS_PAGE_SIZE) {
      break;
    }
  }

  return allRepos;
}

type GHRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  updated_at: string;
  fork: boolean;
};

type GHTrafficViews = {
  count: number;
  uniques: number;
  views: Array<{ timestamp: string; count: number; uniques: number }>;
};

type GHTrafficClones = {
  count: number;
  uniques: number;
  clones: Array<{ timestamp: string; count: number; uniques: number }>;
};

type GHReferrer = { referrer: string; count: number; uniques: number };

type CollectorDbStats = {
  ready: boolean;
  latest_snapshot_date: string | null;
  snapshots_count: number;
  referrer_rows: number;
  repos_with_history: number;
  db_error: boolean;
};

type RuntimeConfig = {
  github_username_configured: boolean;
  github_token_configured: boolean;
  api_secret_configured: boolean;
  d1_binding_configured: boolean;
  kv_binding_configured: boolean;
};

function hasConfiguredValue(value: string | undefined | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function readRuntimeConfig(env: Env): RuntimeConfig {
  return {
    github_username_configured: hasConfiguredValue(env.GITHUB_USERNAME),
    github_token_configured: hasConfiguredValue(env.GITHUB_TOKEN),
    api_secret_configured: hasConfiguredValue(env.API_SECRET),
    d1_binding_configured:
      typeof env.repo_radar_db === "object" &&
      env.repo_radar_db !== null &&
      typeof env.repo_radar_db.prepare === "function",
    kv_binding_configured:
      typeof env.repo_radar_kv === "object" &&
      env.repo_radar_kv !== null &&
      typeof env.repo_radar_kv.get === "function",
  };
}

async function collectAll(env: Env) {
  const username = env.GITHUB_USERNAME;
  const token = env.GITHUB_TOKEN;

  if (!hasConfiguredValue(username)) {
    throw new Error("Missing GITHUB_USERNAME");
  }

  if (!hasConfiguredValue(token)) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const repos = await ghFetchOwnerRepos(username, token);
  if (!repos) throw new Error("Failed to fetch repo list");

  const publicRepos = repos.filter((r) => !r.fork);
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  for (const repo of publicRepos) {
    // upsert repo_metadata (keyed by immutable github_repo_id)
    await env.repo_radar_db
      .prepare(
        `INSERT INTO repo_metadata
           (github_repo_id, repo_name, stars_count, forks_count, open_issues_count,
            last_pushed_at, updated_at, description, language, homepage, html_url, snapshot_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(github_repo_id) DO UPDATE SET
           repo_name=excluded.repo_name,
           stars_count=excluded.stars_count,
           forks_count=excluded.forks_count,
           open_issues_count=excluded.open_issues_count,
           last_pushed_at=excluded.last_pushed_at,
           updated_at=excluded.updated_at,
           description=excluded.description,
           language=excluded.language,
           homepage=excluded.homepage,
           html_url=excluded.html_url,
           snapshot_at=excluded.snapshot_at`,
      )
      .bind(
        repo.id,
        repo.name,
        repo.stargazers_count,
        repo.forks_count,
        repo.open_issues_count,
        repo.pushed_at,
        repo.updated_at,
        repo.description,
        repo.language,
        repo.homepage,
        repo.html_url,
        nowIso,
      )
      .run();

    // fetch + store daily views
    const views = await ghFetch<GHTrafficViews>(
      `/repos/${username}/${repo.name}/traffic/views`,
      token,
    );
    if (views) {
      for (const day of views.views) {
        const date = day.timestamp.slice(0, 10);
        await env.repo_radar_db
          .prepare(
            `INSERT INTO traffic_snapshots
               (github_repo_id, repo_name, date, views_count, views_uniques, clones_count, clones_uniques, collected_at)
             VALUES (?,?,?,?,?,0,0,?)
             ON CONFLICT(github_repo_id, date) DO UPDATE SET
               repo_name=excluded.repo_name,
               views_count=MAX(excluded.views_count, views_count),
               views_uniques=MAX(excluded.views_uniques, views_uniques),
               collected_at=excluded.collected_at`,
          )
          .bind(repo.id, repo.name, date, day.count, day.uniques, nowIso)
          .run();
      }
    }

    // fetch + store daily clones
    const clones = await ghFetch<GHTrafficClones>(
      `/repos/${username}/${repo.name}/traffic/clones`,
      token,
    );
    if (clones) {
      for (const day of clones.clones) {
        const date = day.timestamp.slice(0, 10);
        await env.repo_radar_db
          .prepare(
            `INSERT INTO traffic_snapshots
               (github_repo_id, repo_name, date, views_count, views_uniques, clones_count, clones_uniques, collected_at)
             VALUES (?,?,?,0,0,?,?,?)
             ON CONFLICT(github_repo_id, date) DO UPDATE SET
               repo_name=excluded.repo_name,
               clones_count=MAX(excluded.clones_count, clones_count),
               clones_uniques=MAX(excluded.clones_uniques, clones_uniques),
               collected_at=excluded.collected_at`,
          )
          .bind(repo.id, repo.name, date, day.count, day.uniques, nowIso)
          .run();
      }
    }

    // fetch + store referrers
    const refs = await ghFetch<GHReferrer[]>(
      `/repos/${username}/${repo.name}/traffic/popular/referrers`,
      token,
    );
    if (refs) {
      for (const ref of refs) {
        await env.repo_radar_db
          .prepare(
            `INSERT INTO referrers (github_repo_id, repo_name, referrer, count, uniques, date)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(github_repo_id, referrer, date) DO UPDATE SET
               repo_name=excluded.repo_name,
               count=MAX(excluded.count, count),
               uniques=MAX(excluded.uniques, uniques)`,
          )
          .bind(repo.id, repo.name, ref.referrer, ref.count, ref.uniques, today)
          .run();
      }
    }
  }

  // cache summary in KV for fast reads
  const summary = { collected_at: nowIso, repo_count: publicRepos.length };
  await env.repo_radar_kv.put("last_collection", JSON.stringify(summary), {
    expirationTtl: 86400 * 2,
  });

  return { ok: true, repos: publicRepos.length, collected_at: nowIso };
}

async function handleApiRepos(env: Env, days = 90): Promise<Response> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const rows = await env.repo_radar_db
    .prepare(
      `SELECT
         m.github_repo_id,
         m.repo_name,
         m.stars_count,
         m.forks_count,
         m.open_issues_count,
         m.last_pushed_at,
         m.description,
         m.language,
         m.homepage,
         m.html_url,
         COALESCE(SUM(t.views_count),0)  AS total_views,
         COALESCE(SUM(t.clones_count),0) AS total_clones,
         MAX(t.views_count)              AS peak_views,
         COUNT(t.date)                   AS days_with_data
       FROM repo_metadata m
       LEFT JOIN traffic_snapshots t ON t.github_repo_id = m.github_repo_id AND t.date >= ?
       GROUP BY m.github_repo_id
       ORDER BY total_views DESC`,
    )
    .bind(cutoff)
    .all();

  return json(rows.results);
}

async function handleApiTraffic(env: Env, repoName: string, days = 90): Promise<Response> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  // Join through repo_metadata so the lookup is by immutable ID, not mutable name
  const rows = await env.repo_radar_db
    .prepare(
      `SELECT t.date, t.views_count, t.views_uniques, t.clones_count, t.clones_uniques
       FROM traffic_snapshots t
       JOIN repo_metadata m ON m.github_repo_id = t.github_repo_id
       WHERE m.repo_name = ? AND t.date >= ?
       ORDER BY t.date ASC`,
    )
    .bind(repoName, cutoff)
    .all();
  return json(rows.results);
}

async function handleApiReferrers(env: Env, repoName: string, days = 30): Promise<Response> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const rows = await env.repo_radar_db
    .prepare(
      `SELECT
         r.referrer,
         COALESCE(SUM(r.count), 0) AS total_count,
         MAX(r.date)               AS last_seen
       FROM referrers r
       JOIN repo_metadata m ON m.github_repo_id = r.github_repo_id
       WHERE m.repo_name = ? AND r.date >= ?
       GROUP BY r.referrer
       ORDER BY total_count DESC, last_seen DESC
       LIMIT 5`,
    )
    .bind(repoName, cutoff)
    .all();

  return json(rows.results);
}

async function getDbStats(env: Env): Promise<CollectorDbStats> {
  try {
    const [trafficRows, referrerRows] = await Promise.all([
      env.repo_radar_db
        .prepare(
          `SELECT
             COUNT(*) AS snapshots_count,
             COUNT(DISTINCT github_repo_id) AS repos_with_history,
             MAX(date) AS latest_snapshot_date
           FROM traffic_snapshots`,
        )
        .first<{
          snapshots_count: number;
          repos_with_history: number;
          latest_snapshot_date: string | null;
        }>(),
      env.repo_radar_db
        .prepare(`SELECT COUNT(*) AS referrer_rows FROM referrers`)
        .first<{ referrer_rows: number }>(),
    ]);

    return {
      ready: true,
      latest_snapshot_date: trafficRows?.latest_snapshot_date ?? null,
      snapshots_count: trafficRows?.snapshots_count ?? 0,
      referrer_rows: referrerRows?.referrer_rows ?? 0,
      repos_with_history: trafficRows?.repos_with_history ?? 0,
      db_error: false,
    };
  } catch (error) {
    console.error("Failed to read D1 status", error);

    return {
      ready: false,
      latest_snapshot_date: null,
      snapshots_count: 0,
      referrer_rows: 0,
      repos_with_history: 0,
      db_error: true,
    };
  }
}

function parsePositiveDays(value: string | null, fallback: number) {
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function corsHeaders() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Secret",
    },
  });
}

function decodeRepoName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const worker = {
  // cron trigger
  async scheduled(_event: ScheduledEvent, env: Env) {
    const runtimeConfig = readRuntimeConfig(env);

    if (!runtimeConfig.github_username_configured || !runtimeConfig.github_token_configured) {
      console.warn("scheduled collect skipped: missing GitHub credentials", runtimeConfig);
      return;
    }

    try {
      await collectAll(env);
    } catch (error) {
      console.error("scheduled collect failed", error);
      throw error;
    }
  },

  // HTTP handler
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return corsHeaders();

    const url = new URL(request.url);
    const path = url.pathname;

    // POST /api/collect (manual trigger, requires X-API-Secret)
    if (request.method === "POST" && path === "/api/collect") {
      const runtimeConfig = readRuntimeConfig(env);

      if (!runtimeConfig.api_secret_configured) {
        return json({ error: "Collector API secret is not configured." }, 503);
      }

      if (request.headers.get("X-API-Secret") !== env.API_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }

      if (!runtimeConfig.github_username_configured || !runtimeConfig.github_token_configured) {
        return json(
          {
            error: "Collector runtime is missing GitHub credentials.",
            runtime_config: runtimeConfig,
          },
          503,
        );
      }

      const result = await collectAll(env);
      return json(result);
    }

    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    // GET /api/repos
    if (path === "/api/repos") {
      const days = parsePositiveDays(url.searchParams.get("days"), 90);
      return handleApiRepos(env, days);
    }

    // GET /api/repos/:name/traffic
    const trafficMatch = path.match(/^\/api\/repos\/([^/]+)\/traffic$/);
    if (trafficMatch) {
      const days = parsePositiveDays(url.searchParams.get("days"), 90);
      return handleApiTraffic(env, decodeRepoName(trafficMatch[1]), days);
    }

    // GET /api/repos/:name/referrers
    const referrersMatch = path.match(/^\/api\/repos\/([^/]+)\/referrers$/);
    if (referrersMatch) {
      const days = parsePositiveDays(url.searchParams.get("days"), 30);
      return handleApiReferrers(env, decodeRepoName(referrersMatch[1]), days);
    }

    // GET /api/status
    if (path === "/api/status") {
      const runtimeConfig = readRuntimeConfig(env);
      const [last, dbStats] = await Promise.all([
        env.repo_radar_kv.get("last_collection"),
        getDbStats(env),
      ]);
      const providedApiSecret = request.headers.get("X-API-Secret");
      const runtimeConfigVisible =
        runtimeConfig.api_secret_configured && providedApiSecret === env.API_SECRET;
      let parsedLastCollection: unknown = null;

      if (last) {
        try {
          parsedLastCollection = JSON.parse(last);
        } catch {
          parsedLastCollection = {
            parse_error: true,
            raw: last,
          };
        }
      }

      const status =
        dbStats.ready &&
        runtimeConfig.github_username_configured &&
        runtimeConfig.github_token_configured &&
        runtimeConfig.api_secret_configured &&
        runtimeConfig.d1_binding_configured &&
        runtimeConfig.kv_binding_configured
          ? "ok"
          : "degraded";
      return json({
        status,
        owner: env.GITHUB_USERNAME ?? null,
        last_collection: parsedLastCollection,
        db_stats: dbStats,
        runtime_config_visible: runtimeConfigVisible,
        runtime_config: runtimeConfigVisible ? runtimeConfig : null,
      }, status === "ok" ? 200 : 503);
    }

    return json({ error: "Not found" }, 404);
  },
};

export default worker;
