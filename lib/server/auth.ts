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

import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { getDb, type Db } from "./db";
import { underRateLimit } from "./rate-limit";
import { loginTokens, sessions, users, type UserRow } from "./schema";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

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
  ip?: string,
): Promise<RequestMagicLinkResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const db = await getDb();
  const now = new Date();

  // Per-IP cap (defends against email-bombing many addresses from one source).
  if (ip && !(await underRateLimit(db, `ip:${ip}:magiclink`, 15, 3600))) {
    return {
      ok: false,
      error: "Too many sign-in links requested. Try again in a little while.",
    };
  }

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

// ─── Passwords (optional, set after first magic-link sign-in) ───────────────

const PASSWORD_MIN_LENGTH = 8;
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPasswordHash(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64url");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type PasswordSignInResult =
  | { ok: true; sessionId: string; needsOnboarding: boolean }
  | { ok: false; error: string };

export async function signInWithPassword(
  rawEmail: string,
  password: string,
): Promise<PasswordSignInResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  const db = await getDb();
  const now = new Date();
  const [user] = await db.select().from(users).where(eq(users.email, email));

  // Identical error for unknown email / no password / wrong password —
  // don't leak which accounts exist or how they authenticate.
  const genericError =
    "That email + password combo didn't work. No password set yet? Sign in with a magic link, then add one in Settings.";

  if (!user || !user.passwordHash) return { ok: false, error: genericError };

  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again in a few minutes, or use a magic link.",
    };
  }

  const valid = await verifyPasswordHash(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await db
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null,
      })
      .where(eq(users.id, user.id));
    return { ok: false, error: genericError };
  }

  const patch: Partial<typeof users.$inferInsert> = {
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  // Promote on every login so adding an email to ADMIN_EMAILS later works.
  if (adminEmails().has(email) && !user.isAdmin) patch.isAdmin = true;
  await db.update(users).set(patch).where(eq(users.id, user.id));

  const sessionId = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    lastSeenAt: now,
  });

  return { ok: true, sessionId, needsOnboarding: !user.username };
}

export type SetPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Set or change the signed-in user's password. Changing an existing password
 * requires the current one; setting the first password doesn't (the session
 * itself came from a verified magic link).
 */
export async function setPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
): Promise<SetPasswordResult> {
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (newPassword.length > 128) {
    return { ok: false, error: "Password is too long (128 characters max)." };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { ok: false, error: "Account not found." };

  if (user.passwordHash) {
    if (!currentPassword) {
      return { ok: false, error: "Enter your current password." };
    }
    const valid = await verifyPasswordHash(currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect." };
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, userId));

  return { ok: true };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export interface SessionContext {
  /** The account the session actually belongs to. */
  realUser: SessionUser;
  /** The account requests act as — differs from realUser only under "use as". */
  effectiveUser: SessionUser;
  /** When impersonating, the admin's username (for the banner). */
  impersonatorUsername?: string;
}

/**
 * Lazily lift a suspension whose deadline has passed. Returns the possibly
 * updated user row.
 */
async function liftExpiredSuspension(db: Db, user: SessionUser): Promise<SessionUser> {
  if (
    user.status === "suspended" &&
    user.suspendedUntil &&
    user.suspendedUntil.getTime() <= Date.now()
  ) {
    const [updated] = await db
      .update(users)
      .set({ status: "active", suspendedUntil: null })
      .where(eq(users.id, user.id))
      .returning();
    return updated ?? user;
  }
  return user;
}

/**
 * Resolve the session to its real + effective users (honoring admin "use as").
 * Impersonation is only respected when the session's real user is currently an
 * admin and the target is a non-admin — a demoted admin's impersonation dies
 * automatically.
 */
export async function getSessionContext(
  sessionId: string,
): Promise<SessionContext | null> {
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

  const realUser = await liftExpiredSuspension(db, row.user);

  // Honor "use as" only for a live admin impersonating a non-admin.
  const impersonateId = row.session.impersonatingUserId;
  if (impersonateId && realUser.isAdmin && impersonateId !== realUser.id) {
    const [target] = await db.select().from(users).where(eq(users.id, impersonateId));
    if (target && !target.isAdmin) {
      return {
        realUser,
        effectiveUser: await liftExpiredSuspension(db, target),
        impersonatorUsername: realUser.username ?? undefined,
      };
    }
    // Stale/invalid impersonation target — clear it.
    await db.update(sessions).set({ impersonatingUserId: null }).where(eq(sessions.id, sessionId));
  }

  return { realUser, effectiveUser: realUser };
}

export async function getSessionUser(
  sessionId: string,
): Promise<SessionUser | null> {
  const ctx = await getSessionContext(sessionId);
  return ctx?.effectiveUser ?? null;
}

/** Admin "use as": point the session at another (non-admin) user. */
export async function startImpersonation(
  sessionId: string,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));
  if (!row) return { ok: false, error: "Not signed in" };
  if (!row.user.isAdmin) return { ok: false, error: "Moderators only" };
  if (targetUserId === row.user.id) return { ok: false, error: "That's you" };
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) return { ok: false, error: "User not found" };
  if (target.isAdmin) return { ok: false, error: "Can't use as another moderator" };
  await db
    .update(sessions)
    .set({ impersonatingUserId: targetUserId })
    .where(eq(sessions.id, sessionId));
  console.log(`[audit] admin ${row.user.username} started using-as @${target.username}`);
  return { ok: true };
}

export async function stopImpersonation(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.update(sessions).set({ impersonatingUserId: null }).where(eq(sessions.id, sessionId));
}

export async function destroySession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
