import { NextResponse, type NextRequest } from "next/server";
import { verifyMagicLink } from "@/lib/server/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";
import { canonicalOrigin, isE2ETestRuntime } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = canonicalOrigin(
    process.env.NODE_ENV === "production" && !isE2ETestRuntime()
      ? "https://poachland.com"
      : request.nextUrl.origin,
  );
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = token ? await verifyMagicLink(token) : null;

  if (!result?.ok) {
    return NextResponse.redirect(new URL("/login?error=expired", origin));
  }

  const destination = result.needsOnboarding ? "/onboarding" : "/app";
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(SESSION_COOKIE, result.sessionId, sessionCookieOptions());
  return response;
}
