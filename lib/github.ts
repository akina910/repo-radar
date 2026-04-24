import "server-only";

import { cache } from "react";

import type { RadarRepo } from "@/components/repo-radar";
import type {
  CollectorSyncConfig,
  CollectorStatus,
  CollectorStatusPayload,
} from "@/lib/collector-types";

type GitHubRepo = {
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
  updated_at: string;
  pushed_at: string;
  fork: boolean;
};

type TrafficPayload = {
  count: number;
};

// Shape returned by the Cloudflare collector /api/repos
type CollectorRepo = {
  github_repo_id?: number;
  repo_name: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  last_pushed_at: string | null;
  description: string | null;
  language: string | null;
  homepage: string | null;
  html_url: string | null;
  total_views: number;
  total_clones: number;
  peak_views: number;
  days_with_data: number;
};

type JsonRecord = Record<string, unknown>;

const API_BASE = "https://api.github.com";
const GITHUB_REPOS_PAGE_SIZE = 100;
const GITHUB_REPOS_MAX_PAGES = 20;

function getHeaders() {
  const token = process.env.GITHUB_TOKEN;

  return {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function fetchGitHubOwnerRepos(owner: string): Promise<GitHubRepo[]> {
  const allRepos: GitHubRepo[] = [];

  for (let page = 1; page <= GITHUB_REPOS_MAX_PAGES; page += 1) {
    const pageRepos = await fetchJson<GitHubRepo[]>(
      `/users/${owner}/repos?per_page=${GITHUB_REPOS_PAGE_SIZE}&type=owner&sort=updated&direction=desc&page=${page}`,
    );

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

async function fetchTraffic(owner: string, repo: string, kind: "views" | "clones") {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return null;
  }

  const response = await fetch(`${API_BASE}/repos/${owner}/${repo}/traffic/${kind}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as TrafficPayload;
}

/**
 * Try to fetch aggregated traffic from the Cloudflare collector.
 * Returns null if NEXT_PUBLIC_COLLECTOR_URL is not set or the request fails.
 */
async function fetchFromCollector(): Promise<CollectorRepo[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/api/repos?days=90`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as CollectorRepo[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function readNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function hasCollectorStatusShape(value: unknown) {
  if (!isJsonRecord(value)) {
    return false;
  }

  return (
    "status" in value ||
    "owner" in value ||
    "last_collection" in value ||
    "db_stats" in value ||
    "runtime_config" in value
  );
}

function readCollectorStatus(data: unknown): Omit<CollectorStatus, "configured" | "reachable"> {
  const payload = isJsonRecord(data) ? data : {};
  const lastCollection = isJsonRecord(payload.last_collection) ? payload.last_collection : null;
  const dbStats = isJsonRecord(payload.db_stats) ? payload.db_stats : null;
  const runtimeConfig = isJsonRecord(payload.runtime_config) ? payload.runtime_config : null;

  return {
    configuredOwner: readNullableString(payload.owner),
    lastCollectionAt: readNullableString(lastCollection?.collected_at),
    repoCount: readNullableNumber(lastCollection?.repo_count),
    dbReady: typeof dbStats?.ready === "boolean" ? dbStats.ready : false,
    latestSnapshotDate: readNullableString(dbStats?.latest_snapshot_date),
    snapshotsCount: readNullableNumber(dbStats?.snapshots_count),
    referrerRows: readNullableNumber(dbStats?.referrer_rows),
    reposWithHistory: readNullableNumber(dbStats?.repos_with_history),
    dbError: readNullableBoolean(dbStats?.db_error),
    runtimeGithubUsernameConfigured: readNullableBoolean(runtimeConfig?.github_username_configured),
    runtimeGithubTokenConfigured: readNullableBoolean(runtimeConfig?.github_token_configured),
    runtimeApiSecretConfigured: readNullableBoolean(runtimeConfig?.api_secret_configured),
    runtimeD1BindingConfigured: readNullableBoolean(runtimeConfig?.d1_binding_configured),
    runtimeKvBindingConfigured: readNullableBoolean(runtimeConfig?.kv_binding_configured),
  };
}

function hasNonPlaceholderValue(value: string | undefined) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !trimmed.startsWith("your-") && !trimmed.includes("your-collector-worker");
}

export const getCollectorStatus = cache(async (): Promise<CollectorStatus> => {
  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;

  if (!baseUrl) {
    return {
      configured: false,
      reachable: false,
      configuredOwner: null,
      lastCollectionAt: null,
      repoCount: null,
      dbReady: false,
      latestSnapshotDate: null,
      snapshotsCount: null,
      referrerRows: null,
      reposWithHistory: null,
      dbError: null,
      runtimeGithubUsernameConfigured: null,
      runtimeGithubTokenConfigured: null,
      runtimeApiSecretConfigured: null,
      runtimeD1BindingConfigured: null,
      runtimeKvBindingConfigured: null,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/status`, {
      next: { revalidate: 3600 },
    });
    const data = (await response.json()) as CollectorStatusPayload;

    if (hasCollectorStatusShape(data)) {
      return {
        configured: true,
        reachable: true,
        ...readCollectorStatus(data),
      };
    }

    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        configuredOwner: null,
        lastCollectionAt: null,
        repoCount: null,
        dbReady: false,
        latestSnapshotDate: null,
        snapshotsCount: null,
        referrerRows: null,
        reposWithHistory: null,
        dbError: null,
        runtimeGithubUsernameConfigured: null,
        runtimeGithubTokenConfigured: null,
        runtimeApiSecretConfigured: null,
        runtimeD1BindingConfigured: null,
        runtimeKvBindingConfigured: null,
      };
    }

    return {
      configured: true,
      reachable: true,
      ...readCollectorStatus(data),
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      configuredOwner: null,
      lastCollectionAt: null,
      repoCount: null,
      dbReady: false,
      latestSnapshotDate: null,
      snapshotsCount: null,
      referrerRows: null,
      reposWithHistory: null,
      dbError: null,
      runtimeGithubUsernameConfigured: null,
      runtimeGithubTokenConfigured: null,
      runtimeApiSecretConfigured: null,
      runtimeD1BindingConfigured: null,
      runtimeKvBindingConfigured: null,
    };
  }
});

export const getCollectorSyncConfig = cache(async (): Promise<CollectorSyncConfig> => {
  const workerUrlConfigured = hasNonPlaceholderValue(process.env.NEXT_PUBLIC_COLLECTOR_URL);
  const apiSecretConfigured = hasNonPlaceholderValue(process.env.COLLECTOR_API_SECRET);
  const triggerTokenConfigured = hasNonPlaceholderValue(process.env.COLLECTOR_TRIGGER_TOKEN);

  return {
    workerUrlConfigured,
    apiSecretConfigured,
    triggerTokenConfigured,
    manualSyncReady: workerUrlConfigured && apiSecretConfigured && triggerTokenConfigured,
  };
});

export const getRadarRepos = cache(async (usernameOverride?: string): Promise<RadarRepo[]> => {
  const rawUsername =
    usernameOverride && usernameOverride !== "your-github-username"
      ? usernameOverride
      : process.env.GITHUB_USERNAME;
  const username =
    !rawUsername || rawUsername === "your-github-username" ? null : rawUsername;

  if (!username) {
    return [];
  }

  // Fetch the full owner repo list (paginated, up to max page guard).
  const repos = await fetchGitHubOwnerRepos(username);

  const publicRepos = repos.filter((repo) => !repo.fork);

  // Only use collector data when the requested account matches the configured
  // collector owner — otherwise repo names could collide with another user's data.
  const collectorOwner = process.env.GITHUB_USERNAME;
  const collectorData =
    collectorOwner && collectorOwner.toLowerCase() === username.toLowerCase()
      ? await fetchFromCollector()
      : null;
  const collectorMapById = new Map<number, CollectorRepo>(
    collectorData?.flatMap((r) => r.github_repo_id != null ? [[r.github_repo_id, r]] : []) ?? [],
  );
  const collectorMapByName = new Map<string, CollectorRepo>(
    collectorData?.map((r) => [r.repo_name, r]) ?? [],
  );

  return Promise.all(
    publicRepos.map(async (repo) => {
      const collected = collectorMapById.get(repo.id) ?? collectorMapByName.get(repo.name);

      if (collected && collected.days_with_data > 0) {
        // Use collector data (90-day history)
        return {
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          htmlUrl: repo.html_url,
          homepage: repo.homepage,
          language: repo.language,
          stargazersCount: repo.stargazers_count,
          forksCount: repo.forks_count,
          openIssuesCount: repo.open_issues_count,
          updatedAt: repo.updated_at,
          pushedAt: repo.pushed_at,
          viewsCount: collected.total_views,
          clonesCount: collected.total_clones,
          peakViews: collected.peak_views,
          trafficAvailable: true,
          collectorBacked: true,
        } satisfies RadarRepo;
      }

      // Fall back to direct GitHub API (14-day window)
      const [views, clones] = await Promise.all([
        fetchTraffic(username, repo.name, "views"),
        fetchTraffic(username, repo.name, "clones"),
      ]);

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        htmlUrl: repo.html_url,
        homepage: repo.homepage,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        openIssuesCount: repo.open_issues_count,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        viewsCount: views?.count ?? null,
        clonesCount: clones?.count ?? null,
        peakViews: null,
        trafficAvailable: views !== null || clones !== null,
        collectorBacked: false,
      } satisfies RadarRepo;
    }),
  );
});
