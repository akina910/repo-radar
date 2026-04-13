import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const TRIGGER_SESSION_COOKIE = "collector-trigger-session";
const TRIGGER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function readToken(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const token = (payload as { token?: unknown }).token;
  return typeof token === "string" ? token.trim() : "";
}

function readConfiguredTriggerToken() {
  return process.env.COLLECTOR_TRIGGER_TOKEN?.trim() ?? "";
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

  return NextResponse.json({
    authenticated: sessionToken === triggerToken,
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

  if (submittedToken !== triggerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: TRIGGER_SESSION_COOKIE,
    value: triggerToken,
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
