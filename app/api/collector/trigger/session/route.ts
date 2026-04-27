import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TRIGGER_SESSION_COOKIE = "collector-trigger-session";
const TRIGGER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

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

function readToken(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const token = (payload as { token?: unknown }).token;
  return typeof token === "string" ? token.trim() : "";
}

function readConfiguredTriggerToken() {
  const dedicatedToken = process.env.COLLECTOR_TRIGGER_TOKEN?.trim() ?? "";
  if (hasNonPlaceholderValue(dedicatedToken)) {
    return dedicatedToken;
  }

  // Keep browser unlock usable with only two env vars:
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

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export async function GET() {
  const triggerToken = readConfiguredTriggerToken();

  if (!triggerToken) {
    return NextResponse.json(
      {
        authenticated: false,
        error: "Collector trigger auth is not configured on the server.",
      },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(TRIGGER_SESSION_COOKIE)?.value;
  const sessionTokenHash = hashToken(triggerToken);

  return NextResponse.json({
    authenticated: secureTokenEquals(sessionToken ?? "", sessionTokenHash),
  });
}

export async function POST(request: Request) {
  const triggerToken = readConfiguredTriggerToken();

  if (!triggerToken) {
    return NextResponse.json(
      {
        error: "Collector trigger auth is not configured on the server.",
      },
      { status: 503 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submittedToken = readToken(payload);

  if (!submittedToken) {
    return NextResponse.json({ error: "Trigger token is required." }, { status: 400 });
  }

  if (!secureTokenEquals(submittedToken, triggerToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: TRIGGER_SESSION_COOKIE,
    value: hashToken(triggerToken),
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureCookie(),
    maxAge: TRIGGER_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(TRIGGER_SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
