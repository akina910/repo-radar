import { type NextRequest, NextResponse } from "next/server";

import type { TrafficDay } from "@/lib/collector-types";

const MAX_REPOS_PER_BATCH = 60;
const GITHUB_REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

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

  return Array.from(
    new Set(
      reposParam
        .split(",")
        .filter(Boolean)
        .map((repo) => decodeRepoSegment(repo).trim())
        .filter((repo) => GITHUB_REPO_NAME_PATTERN.test(repo))
        .slice(0, MAX_REPOS_PER_BATCH),
    ),
  );
}

export async function GET(request: NextRequest) {
  const repos = parseReposParam(request.nextUrl.searchParams.get("repos"));
  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;

  if (!baseUrl || repos.length === 0) {
    return NextResponse.json({} as Record<string, TrafficDay[]>);
  }

  const results = await Promise.all(
    repos.map(async (repo) => {
      try {
        const response = await fetch(
          `${baseUrl}/api/repos/${encodeURIComponent(repo)}/traffic?days=90`,
          { next: { revalidate: 3600 } },
        );
        if (!response.ok) return [repo, [] as TrafficDay[]] as const;
        const data = (await response.json()) as unknown;
        return [repo, Array.isArray(data) ? (data as TrafficDay[]) : []] as const;
      } catch {
        return [repo, [] as TrafficDay[]] as const;
      }
    }),
  );

  return NextResponse.json(Object.fromEntries(results) as Record<string, TrafficDay[]>);
}
