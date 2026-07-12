/**
 * Magic-link authentication (server-only, no next-auth).
 *
 * Flow:
 *   1. requestMagicLink(email, origin) — stores sha256(token) in login_tokens,
 *      emails (or console-logs, in dev) a link to /api/auth/verify?token=…
 *   2. verifyMagicLink(token) — single-use atomic consume, find-or-create the
 *      user by email, mint a 30-day session row.
 *   3. getSessionUser(sessionId) — resolves the user, sliding renewal.
 *
 * Framework-free on purpose (no next/headers): cookie plumbing lives in
 * lib/server/session.ts so this module stays testable outside Next.
 */

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { loginTokens, sessions, users, type UserRow } from "./schema";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000; // sliding renewal cadence
const MAX_PENDING_TOKENS_PER_WINDOW = 3;

export type SessionUser = UserRow;

export type RequestMagicLinkResult =
  | { ok: true; devLink?: string }
  | { ok: false; error: string };

export type VerifyMagicLinkResult =
  | { ok: true; sessionId: string; needsOnboarding: boolean }
  | { ok: false; error: string };

/** App-side id generator — same shape the client engine uses ("u_abc123"). */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString("hex")}`;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  // Pragmatic shape check: one @, non-empty local part, dotted domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return null;
  }
  return email;
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// ─── Magic links ─────────────────────────────────────────────────────────────

export async function requestMagicLink(
  rawEmail: string,
  origin: string,
): Promise<RequestMagicLinkResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const db = await getDb();
  const now = new Date();

  // Rate limit: at most 3 unconsumed tokens per email per 15-minute window.
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(loginTokens)
    .where(
      and(
        eq(loginTokens.email, email),
        isNull(loginTokens.consumedAt),
        gt(loginTokens.createdAt, new Date(now.getTime() - TOKEN_TTL_MS)),
      ),
    );
  if (pending >= MAX_PENDING_TOKENS_PER_WINDOW) {
    return {
      ok: false,
      error: "Too many sign-in links requested. Check your inbox or try again in 15 minutes.",
    };
  }

  const token = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({
    tokenHash: sha256(token),
    email,
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
  });

  const link = `${origin.replace(/\/$/, "")}/api/auth/verify?token=${token}`;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Poachland <onboarding@resend.dev>",
        to: email,
        subject: "Your Poachland sign-in link",
        html: magicLinkEmailHtml(link),
        text: `Sign in to Poachland:\n\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, you can ignore this email.`,
      });
      if (error) {
        console.error("[auth] resend send failed:", error);
        return { ok: false, error: "Could not send the sign-in email. Try again." };
      }
    } catch (err) {
      console.error("[auth] resend send threw:", err);
      return { ok: false, error: "Could not send the sign-in email. Try again." };
    }
    return { ok: true };
  }

  // Dev mode (no RESEND_API_KEY): surface the link instead of emailing it.
  console.log(`[auth] magic link for ${email}: ${link}`);
  return { ok: true, devLink: link };
}

function magicLinkEmailHtml(link: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#151515;border:1px solid #2a2a2a;border-radius:12px;padding:36px 32px;">
            <tr>
              <td style="padding-bottom:20px;">
                <span style="color:#fafafa;font-size:20px;font-weight:700;letter-spacing:0.08em;">POACHLAND</span>
              </td>
            </tr>
            <tr>
              <td style="color:#fafafa;font-size:17px;font-weight:600;padding-bottom:8px;">
                Your Poachland sign-in link
              </td>
            </tr>
            <tr>
              <td style="color:#a1a1a1;font-size:14px;line-height:1.6;padding-bottom:28px;">
                Click the button below to sign in. No password needed.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:28px;">
                <a href="${link}" style="display:inline-block;background-color:#fafafa;color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
                  Sign in to Poachland
                </a>
              </td>
            </tr>
            <tr>
              <td style="color:#6b6b6b;font-size:12px;line-height:1.6;border-top:1px solid #2a2a2a;padding-top:20px;">
                This link expires in 15 minutes and can only be used once.
                If you didn't request it, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function verifyMagicLink(
  token: string,
): Promise<VerifyMagicLinkResult> {
  if (!token) return { ok: false, error: "Missing token." };

  const db = await getDb();
  const now = new Date();

  // Atomic single-use consume: only one caller can flip consumed_at.
  const [consumed] = await db
    .update(loginTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(loginTokens.tokenHash, sha256(token)),
        isNull(loginTokens.consumedAt),
      ),
    )
    .returning();

  if (!consumed) return { ok: false, error: "Invalid or already-used link." };
  if (consumed.expiresAt.getTime() < now.getTime()) {
    return { ok: false, error: "This sign-in link has expired." };
  }

  const email = consumed.email;
  const isAdminEmail = adminEmails().has(email);

  let [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        id: uid("u"),
        email,
        username: null, // set during onboarding
        displayName: email.split("@")[0] || "New poacher",
        avatar: "/placeholder-user.jpg",
        isAdmin: isAdminEmail,
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!user) {
      // Lost a concurrent-signup race — the row exists now.
      [user] = await db.select().from(users).where(eq(users.email, email));
    }
  }

  if (!user) return { ok: false, error: "Could not sign you in. Try again." };

  // Promote on every login so adding an email to ADMIN_EMAILS later works.
  if (isAdminEmail && !user.isAdmin) {
    [user] = await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, user.id))
      .returning();
  }

  const sessionId = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    lastSeenAt: now,
  });

  return { ok: true, sessionId, needsOnboarding: !user.username };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getSessionUser(
  sessionId: string,
): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const db = await getDb();
  const now = new Date();

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  if (!row) return null;
  if (row.session.expiresAt.getTime() < now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Sliding renewal: bump expiry at most once a day, not on every request.
  if (now.getTime() - row.session.lastSeenAt.getTime() > SESSION_RENEW_AFTER_MS) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      })
      .where(eq(sessions.id, sessionId));
  }

  return row.user;
}

export async function destroySession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
