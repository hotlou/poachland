/**
 * Session cookie plumbing (Next-specific).
 *
 * Splits the next/headers dependency away from lib/server/auth.ts so the auth
 * core stays runnable outside Next (e.g. the foundation smoke test).
 */

import "server-only";

import { cookies } from "next/headers";
import { getSessionUser, type SessionUser } from "./auth";

export const SESSION_COOKIE = "poach_session";
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, seconds

export function sessionCookieOptions(maxAge: number = SESSION_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Only callable from Server Actions and Route Handlers (Next restriction). */
export async function setSessionCookie(sessionId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, sessionId, sessionCookieOptions());
}

/** Only callable from Server Actions and Route Handlers (Next restriction). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export async function readSessionCookie(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in user for the current request, or null. Safe anywhere on the server. */
export async function readSessionUser(): Promise<SessionUser | null> {
  const sessionId = await readSessionCookie();
  if (!sessionId) return null;
  return getSessionUser(sessionId);
}

/** Thrown by requireSessionUser when there is no valid session. */
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await readSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
