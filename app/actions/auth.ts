"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  destroySession,
  requestMagicLink,
  type RequestMagicLinkResult,
} from "@/lib/server/auth";
import { clearSessionCookie, readSessionCookie } from "@/lib/server/session";

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

/**
 * Emails a magic sign-in link (or, in dev without RESEND_API_KEY, returns it
 * as `devLink` so the login UI can show it inline).
 */
export async function sendMagicLink(
  email: string,
): Promise<RequestMagicLinkResult> {
  try {
    const origin = await resolveOrigin();
    return await requestMagicLink(email, origin);
  } catch (error) {
    console.error("[auth] sendMagicLink failed:", error);
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
