import { NextResponse } from "next/server";

import type { TrafficDay } from "@/lib/collector-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repo: string }> },
) {
  const { repo } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;

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

    const data = (await response.json()) as TrafficDay[];
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([] as TrafficDay[]);
  }
}
