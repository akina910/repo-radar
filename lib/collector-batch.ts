import type { ReferrerSummary, TrafficDay } from "@/lib/collector-types";

const MAX_REPOS_PER_BATCH = 60;
const GITHUB_REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const COLLECTOR_FETCH_CONCURRENCY = 8;
const COLLECTOR_FETCH_TIMEOUT_MS = 8_000;

function decodeRepoSegment(repo: string) {
  try {
    return decodeURIComponent(repo);
  } catch {
    return repo;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCollectorReposParam(reposParam: string | null): string[] {
  if (!reposParam) {
    return [];
  }

  const uniqueRepos = Array.from(
    new Set(
      reposParam
        .split(",")
        .filter(Boolean)
        .map((repo) => decodeRepoSegment(repo).trim())
        .filter((repo) => GITHUB_REPO_NAME_PATTERN.test(repo)),
    ),
  );

  return uniqueRepos.slice(0, MAX_REPOS_PER_BATCH);
}

export function parseCollectorRepoIdsParam(repoIdsParam: string | null): string[] {
  if (!repoIdsParam) {
    return [];
  }

  const uniqueRepoIds = Array.from(
    new Set(
      repoIdsParam
        .split(",")
        .filter(Boolean)
        .map((repoId) => repoId.trim())
        .filter((repoId) => /^\d+$/.test(repoId))
        .filter((repoId) => Number.isSafeInteger(Number(repoId)) && Number(repoId) > 0),
    ),
  );

  return uniqueRepoIds.slice(0, MAX_REPOS_PER_BATCH);
}

function createAbortControllerWithTimeout() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COLLECTOR_FETCH_TIMEOUT_MS);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const safeLimit = Math.max(1, Math.floor(limit));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await task(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(safeLimit, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

export async function fetchCollectorBatchMap<T>({
  baseUrl,
  repos,
  buildPath,
  isItem,
}: {
  baseUrl: string;
  repos: string[];
  buildPath: (repo: string) => string;
  isItem: (item: unknown) => item is T;
}): Promise<Record<string, T[]>> {
  const trimmedBaseUrl = baseUrl.replace(/\/$/, "");

  const rows = await runWithConcurrency(
    repos,
    COLLECTOR_FETCH_CONCURRENCY,
    async (repo) => {
      const { signal, clear } = createAbortControllerWithTimeout();

      try {
        const response = await fetch(`${trimmedBaseUrl}${buildPath(repo)}`, {
          next: { revalidate: 3600 },
          signal,
        });

        if (!response.ok) {
          return [repo, [] as T[]] as const;
        }

        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) {
          return [repo, [] as T[]] as const;
        }

        const values = payload.filter(isItem) as T[];
        return [repo, values] as const;
      } catch {
        return [repo, [] as T[]] as const;
      } finally {
        clear();
      }
    },
  );

  return Object.fromEntries(rows);
}

export function isTrafficDay(item: unknown): item is TrafficDay {
  if (!isRecord(item)) {
    return false;
  }

  return (
    typeof item.date === "string" &&
    typeof item.views_count === "number" &&
    typeof item.views_uniques === "number" &&
    typeof item.clones_count === "number" &&
    typeof item.clones_uniques === "number"
  );
}

export function isReferrerSummary(item: unknown): item is ReferrerSummary {
  if (!isRecord(item)) {
    return false;
  }

  return (
    typeof item.referrer === "string" &&
    typeof item.total_count === "number" &&
    typeof item.last_seen === "string"
  );
}
