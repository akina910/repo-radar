import { NextResponse } from "next/server";

export type TrafficDay = {
  date: string;
  views_count: number;
  views_uniques: number;
  clones_count: number;
  clones_uniques: number;
};

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
