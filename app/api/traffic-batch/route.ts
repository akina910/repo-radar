import { type NextRequest, NextResponse } from "next/server";

import {
  fetchCollectorBatchMap,
  isTrafficDay,
  parseCollectorRepoIdsParam,
  parseCollectorReposParam,
} from "@/lib/collector-batch";
import type { TrafficDay } from "@/lib/collector-types";
import { readConfiguredUrlBase } from "@/lib/env";

export async function GET(request: NextRequest) {
  const repoIds = parseCollectorRepoIdsParam(request.nextUrl.searchParams.get("repoIds"));
  const repos = parseCollectorReposParam(request.nextUrl.searchParams.get("repos"));
  const baseUrl = readConfiguredUrlBase(process.env.NEXT_PUBLIC_COLLECTOR_URL);

  if (!baseUrl || (repoIds.length === 0 && repos.length === 0)) {
    return NextResponse.json({} as Record<string, TrafficDay[]>);
  }

  if (repoIds.length > 0) {
    const results = await fetchCollectorBatchMap<TrafficDay>({
      baseUrl,
      repos: repoIds,
      buildPath: (repoId) => `/api/repos/id/${repoId}/traffic?days=90`,
      isItem: isTrafficDay,
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

    const legacyResults = await fetchCollectorBatchMap<TrafficDay>({
      baseUrl,
      repos: unresolvedRepos,
      buildPath: (repo) => `/api/repos/${encodeURIComponent(repo)}/traffic?days=90`,
      isItem: isTrafficDay,
    });
    const mappedResults = { ...results };
    repoIds.forEach((repoId, index) => {
      if ((results[repoId]?.length ?? 0) > 0) {
        return;
      }

      const legacyRepoDays = legacyResults[repos[index]];
      if (legacyRepoDays?.length) {
        mappedResults[repoId] = legacyRepoDays;
      }
    });

    return NextResponse.json(mappedResults);
  }

  const results = await fetchCollectorBatchMap<TrafficDay>({
    baseUrl,
    repos,
    buildPath: (repo) => `/api/repos/${encodeURIComponent(repo)}/traffic?days=90`,
    isItem: isTrafficDay,
  });

  return NextResponse.json(results);
}
