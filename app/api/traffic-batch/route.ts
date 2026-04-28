import { type NextRequest, NextResponse } from "next/server";

import {
  fetchCollectorBatchMap,
  isTrafficDay,
  parseCollectorReposParam,
} from "@/lib/collector-batch";
import type { TrafficDay } from "@/lib/collector-types";

export async function GET(request: NextRequest) {
  const repos = parseCollectorReposParam(request.nextUrl.searchParams.get("repos"));
  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;

  if (!baseUrl || repos.length === 0) {
    return NextResponse.json({} as Record<string, TrafficDay[]>);
  }

  const results = await fetchCollectorBatchMap<TrafficDay>({
    baseUrl,
    repos,
    buildPath: (repo) => `/api/repos/${encodeURIComponent(repo)}/traffic?days=90`,
    isItem: isTrafficDay,
  });

  return NextResponse.json(results);
}
