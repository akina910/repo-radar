import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TRIGGER_SESSION_COOKIE = "collector-trigger-session";

function hasNonPlaceholderValue(value: string | undefined) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !trimmed.startsWith("your-") && !trimmed.includes("your-collector-worker");
}

function readConfiguredTriggerToken() {
  const dedicatedToken = process.env.COLLECTOR_TRIGGER_TOKEN?.trim() ?? "";
  if (hasNonPlaceholderValue(dedicatedToken)) {
    return dedicatedToken;
  }

  // Keep manual sync workable with only two env vars:
  // NEXT_PUBLIC_COLLECTOR_URL + COLLECTOR_API_SECRET.
  const fallbackToken = process.env.COLLECTOR_API_SECRET?.trim() ?? "";
  return hasNonPlaceholderValue(fallbackToken) ? fallbackToken : "";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function secureTokenEquals(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

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
  const triggerToken = readConfiguredTriggerToken();

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
  const expectedSessionToken = hashToken(triggerToken);

  if (
    secureTokenEquals(sessionToken ?? "", expectedSessionToken) ||
    secureTokenEquals(headerToken ?? "", triggerToken)
  ) {
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
