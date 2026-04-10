import "server-only";

import { cache } from "react";

import type { RadarRepo } from "@/components/repo-radar";

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

const API_BASE = "https://api.github.com";

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

  // Fetch repo list from GitHub (always needed for full metadata + id)
  const repos = await fetchJson<GitHubRepo[]>(
    `/users/${username}/repos?per_page=100&type=owner&sort=updated&direction=desc`,
  );

  const publicRepos = repos.filter((repo) => !repo.fork);

  // Only use collector data when the requested account matches the configured
  // collector owner — otherwise repo names could collide with another user's data.
  const collectorOwner = process.env.GITHUB_USERNAME;
  const collectorData =
    collectorOwner && collectorOwner.toLowerCase() === username.toLowerCase()
      ? await fetchFromCollector()
      : null;
  const collectorMap = new Map<string, CollectorRepo>(
    collectorData?.map((r) => [r.repo_name, r]) ?? [],
  );

  return Promise.all(
    publicRepos.map(async (repo) => {
      const collected = collectorMap.get(repo.name);

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
          trafficAvailable: true,
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
        trafficAvailable: views !== null || clones !== null,
      } satisfies RadarRepo;
    }),
  );
});
