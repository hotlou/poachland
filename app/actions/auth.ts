"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  destroySession,
  requestMagicLink,
  setPassword,
  signInWithPassword,
  startImpersonation,
  stopImpersonation,
  type RequestMagicLinkResult,
  type SetPasswordResult,
} from "@/lib/server/auth";
import {
  clearSessionCookie,
  readSessionCookie,
  readSessionContext,
  setSessionCookie,
} from "@/lib/server/session";
import { canonicalOrigin, isE2ETestRuntime } from "@/lib/env";

function resolveOrigin(): string {
  return canonicalOrigin(
    process.env.NODE_ENV === "production" && !isE2ETestRuntime()
      ? "https://poachland.com"
      : "http://localhost:3000",
  );
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
async function resolveIp(): Promise<string | undefined> {
  if (process.env.VERCEL !== "1") return undefined;
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

/**
 * Emails a magic sign-in link (or, in dev without RESEND_API_KEY, returns it
 * as `devLink` so the login UI can show it inline).
 */
export async function sendMagicLink(
  email: string,
): Promise<RequestMagicLinkResult> {
  try {
    const [origin, ip] = await Promise.all([Promise.resolve(resolveOrigin()), resolveIp()]);
    return await requestMagicLink(email, origin, ip);
  } catch (error) {
    console.error("[auth] sendMagicLink failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Password sign-in. On success the session cookie is set. */
export async function logInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; needsOnboarding: boolean } | { ok: false; error: string }> {
  try {
    const result = await signInWithPassword(email, password);
    if (!result.ok) return result;
    await setSessionCookie(result.sessionId);
    return { ok: true, needsOnboarding: result.needsOnboarding };
  } catch (error) {
    console.error("[auth] logInWithPassword failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Set or change the signed-in user's password (current password required
 * only when one is already set).
 */
export async function updatePassword(
  newPassword: string,
  currentPassword?: string,
): Promise<SetPasswordResult> {
  try {
    const ctx = await readSessionContext();
    if (!ctx) return { ok: false, error: "Sign in first." };
    if (ctx.realUser.id !== ctx.effectiveUser.id) return { ok: false, error: "Exit Act as before changing credentials or deleting an account. Use Admin for account removal." };
    const user = ctx.effectiveUser;
    return await setPassword(user.id, newPassword, currentPassword);
  } catch (error) {
    console.error("[auth] updatePassword failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Admin "use as": begin viewing the app as another (non-admin) user. */
export async function useAsUser(
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionId = await readSessionCookie();
    if (!sessionId) return { ok: false, error: "Not signed in" };
    return await startImpersonation(sessionId, targetUserId);
  } catch (error) {
    console.error("[auth] useAsUser failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Exit "use as" and return to the admin's own account. */
export async function stopUsingAs(): Promise<{ ok: boolean }> {
  try {
    const sessionId = await readSessionCookie();
    if (sessionId) await stopImpersonation(sessionId);
    return { ok: true };
  } catch (error) {
    console.error("[auth] stopUsingAs failed:", error);
    return { ok: false };
  }
}

/**
 * Permanently delete the signed-in user's account (scrub + tombstone). Refused
 * while deals are in flight or if the typed username doesn't match; clears the
 * session cookie on success so the client can bounce to the goodbye page.
 */
export async function deleteMyAccount(
  confirmUsername: string,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  try {
    const { deleteAccount } = await import("@/lib/server/account");
    const ctx = await readSessionContext();
    if (!ctx) return { ok: false, error: "Sign in first." };
    if (ctx.realUser.id !== ctx.effectiveUser.id) return { ok: false, error: "Exit Act as before changing credentials or deleting an account. Use Admin for account removal." };
    const user = ctx.effectiveUser;
    const res = await deleteAccount(user.id, confirmUsername ?? "");
    if (res.ok) await clearSessionCookie();
    return res;
  } catch (error) {
    console.error("[account] deleteMyAccount failed:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function logOut(): Promise<never> {
  const sessionId = await readSessionCookie();
  if (sessionId) {
    await destroySession(sessionId);
  }
  await clearSessionCookie();
  redirect("/login");
}
