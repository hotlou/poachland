import { NextResponse, type NextRequest } from "next/server";
import { verifyMagicLink } from "@/lib/server/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = token ? await verifyMagicLink(token) : null;

  if (!result?.ok) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  const destination = result.needsOnboarding ? "/onboarding" : "/app";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(SESSION_COOKIE, result.sessionId, sessionCookieOptions());
  return response;
}
