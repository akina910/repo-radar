import { NextResponse } from "next/server";

import { isTrafficDay } from "@/lib/collector-batch";
import type { TrafficDay } from "@/lib/collector-types";
import { readConfiguredUrlBase } from "@/lib/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repo: string }> },
) {
  const { repo } = await params;
  const baseUrl = readConfiguredUrlBase(process.env.NEXT_PUBLIC_COLLECTOR_URL);

  if (!baseUrl) {
    return NextResponse.json([] as TrafficDay[]);
  }

  try {
    const response = await fetch(`${baseUrl}/api/repos/${encodeURIComponent(repo)}/traffic?days=90`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json([] as TrafficDay[]);
    }

    const data = (await response.json()) as unknown;
    return NextResponse.json(Array.isArray(data) ? data.filter(isTrafficDay) : []);
  } catch {
    return NextResponse.json([] as TrafficDay[]);
  }
}
