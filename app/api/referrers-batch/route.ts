import { type NextRequest, NextResponse } from "next/server";

import type { ReferrerSummary } from "@/lib/collector-types";

function decodeRepoSegment(repo: string) {
  try {
    return decodeURIComponent(repo);
  } catch {
    return repo;
  }
}

function parseReposParam(reposParam: string | null) {
  if (!reposParam) {
    return [];
  }

  return reposParam
    .split(",")
    .filter(Boolean)
    .map((repo) => decodeRepoSegment(repo));
}

export async function GET(request: NextRequest) {
  const repos = parseReposParam(request.nextUrl.searchParams.get("repos"));
  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;

  if (!baseUrl || repos.length === 0) {
    return NextResponse.json({} as Record<string, ReferrerSummary[]>);
  }

  const results = await Promise.all(
    repos.map(async (repo) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/repos/${encodeURIComponent(repo)}/referrers?days=30`,
          { next: { revalidate: 3600 } },
        );
        if (!response.ok) return [repo, [] as ReferrerSummary[]] as const;
        const data = (await response.json()) as unknown;
        return [repo, Array.isArray(data) ? (data as ReferrerSummary[]) : []] as const;
      } catch {
        return [repo, [] as ReferrerSummary[]] as const;
      }
    }),
  );

  return NextResponse.json(Object.fromEntries(results) as Record<string, ReferrerSummary[]>);
}
