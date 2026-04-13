import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TRIGGER_SESSION_COOKIE = "collector-trigger-session";

function readJsonSafely(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function requireCollectorTriggerAuth(request: Request) {
  const triggerToken = process.env.COLLECTOR_TRIGGER_TOKEN?.trim();

  if (!triggerToken) {
    return NextResponse.json(
      {
        error: "Collector trigger auth is not configured on the server.",
      },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(TRIGGER_SESSION_COOKIE)?.value;
  const headerToken = request.headers.get("x-trigger-token");

  if (sessionToken === triggerToken || headerToken === triggerToken) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const authError = await requireCollectorTriggerAuth(request);

  if (authError) {
    return authError;
  }

  const baseUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL?.replace(/\/$/, "");
  const apiSecret = process.env.COLLECTOR_API_SECRET;

  if (!baseUrl || !apiSecret) {
    return NextResponse.json(
      {
        error: "Collector trigger is not configured on the server.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${baseUrl}/api/collect`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-API-Secret": apiSecret,
      },
      cache: "no-store",
    });
    const text = await response.text();
    const payload = readJsonSafely(text);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Collector trigger failed.",
          details: payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload ?? { ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Collector trigger failed.",
      },
      { status: 502 },
    );
  }
}
