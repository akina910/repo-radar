import { type NextRequest, NextResponse } from "next/server";

import {
  fetchCollectorBatchMap,
  isReferrerSummary,
  parseCollectorRepoIdsParam,
  parseCollectorReposParam,
} from "@/lib/collector-batch";
import type { ReferrerSummary } from "@/lib/collector-types";
import { readConfiguredUrlBase } from "@/lib/env";

export async function GET(request: NextRequest) {
  const repoIds = parseCollectorRepoIdsParam(request.nextUrl.searchParams.get("repoIds"));
  const repos = parseCollectorReposParam(request.nextUrl.searchParams.get("repos"));
  const baseUrl = readConfiguredUrlBase(process.env.NEXT_PUBLIC_COLLECTOR_URL);

  if (!baseUrl || (repoIds.length === 0 && repos.length === 0)) {
    return NextResponse.json({} as Record<string, ReferrerSummary[]>);
  }

  if (repoIds.length > 0) {
    const results = await fetchCollectorBatchMap<ReferrerSummary>({
      baseUrl,
      repos: repoIds,
      buildPath: (repoId) => `/api/repos/id/${repoId}/referrers?days=30`,
      isItem: isReferrerSummary,
    });

    if (repos.length !== repoIds.length) {
      return NextResponse.json(results);
    }

    const unresolvedRepos = repos.filter((_, index) => {
      const repoId = repoIds[index];
      return (results[repoId]?.length ?? 0) === 0;
    });
    if (unresolvedRepos.length === 0) {
      return NextResponse.json(results);
    }

    const legacyResults = await fetchCollectorBatchMap<ReferrerSummary>({
      baseUrl,
      repos: unresolvedRepos,
      buildPath: (repo) => `/api/repos/${encodeURIComponent(repo)}/referrers?days=30`,
      isItem: isReferrerSummary,
    });
    const mappedResults = { ...results };
    repoIds.forEach((repoId, index) => {
      if ((results[repoId]?.length ?? 0) > 0) {
        return;
      }

      const legacyRepoReferrers = legacyResults[repos[index]];
      if (legacyRepoReferrers?.length) {
        mappedResults[repoId] = legacyRepoReferrers;
      }
    });

    return NextResponse.json(mappedResults);
  }

  const results = await fetchCollectorBatchMap<ReferrerSummary>({
    baseUrl,
    repos,
    buildPath: (repo) => `/api/repos/${encodeURIComponent(repo)}/referrers?days=30`,
    isItem: isReferrerSummary,
  });

  return NextResponse.json(results);
}
