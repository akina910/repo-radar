import { type NextRequest, NextResponse } from "next/server";

import type { TrafficDay } from "@/app/api/traffic/[repo]/route";

export async function GET(request: NextRequest) {
  const reposParam = request.nextUrl.searchParams.get("repos");
  const repos = reposParam ? reposParam.split(",").filter(Boolean) : [];
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
