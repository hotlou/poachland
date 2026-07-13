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
  readSessionUser,
  setSessionCookie,
} from "@/lib/server/session";

async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (/^(localhost|127\.|0\.0\.0\.0)/.test(host) ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
async function resolveIp(): Promise<string | undefined> {
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
    const [origin, ip] = await Promise.all([resolveOrigin(), resolveIp()]);
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
    const user = await readSessionUser();
    if (!user) return { ok: false, error: "Sign in first." };
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

export async function logOut(): Promise<never> {
  const sessionId = await readSessionCookie();
  if (sessionId) {
    await destroySession(sessionId);
  }
  await clearSessionCookie();
  redirect("/login");
}
