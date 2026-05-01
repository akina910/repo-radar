import { type NextRequest, NextResponse } from "next/server";

import {
  fetchCollectorBatchMap,
  isReferrerSummary,
  parseCollectorReposParam,
} from "@/lib/collector-batch";
import type { ReferrerSummary } from "@/lib/collector-types";
import { readConfiguredUrlBase } from "@/lib/env";

export async function GET(request: NextRequest) {
  const repos = parseCollectorReposParam(request.nextUrl.searchParams.get("repos"));
  const baseUrl = readConfiguredUrlBase(process.env.NEXT_PUBLIC_COLLECTOR_URL);

  if (!baseUrl || repos.length === 0) {
    return NextResponse.json({} as Record<string, ReferrerSummary[]>);
  }

  const results = await fetchCollectorBatchMap<ReferrerSummary>({
    baseUrl,
    repos,
    buildPath: (repo) => `/api/repos/${encodeURIComponent(repo)}/referrers?days=30`,
    isItem: isReferrerSummary,
  });

  return NextResponse.json(results);
}
