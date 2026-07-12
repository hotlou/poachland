/**
 * Foundation smoke test implementation. Do not run directly — use
 * `node scripts/foundation-smoke.mjs`, which launches this through tsx.
 *
 * Exercises the PGlite path end to end against a throwaway data dir:
 * migrations, magic-link request/verify (single-use), user + session
 * creation, session round-trip, rate limiting, and the identities table.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ── Environment: force the PGlite path, dev (no-Resend) mode, no admins ─────
delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;
delete process.env.ADMIN_EMAILS;

const dataDir = path.join(process.cwd(), ".pglite-smoke");
fs.rmSync(dataDir, { recursive: true, force: true });
process.env.PGLITE_PATH = dataDir;

// Imported dynamically so the env setup above happens first.
const { getDb } = await import("../lib/server/db.ts");
const schema = await import("../lib/server/schema.ts");
const { requestMagicLink, verifyMagicLink, getSessionUser, destroySession, uid } =
  await import("../lib/server/auth.ts");
const { eq } = await import("drizzle-orm");

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

let step = 0;
const pass = (msg) => console.log(`  ok ${++step}. ${msg}`);

try {
  // 1. Migrations apply cleanly on first use (ensureMigrated via getDb).
  const db = await getDb();
  assert.deepEqual(await db.select().from(schema.users), []);
  assert.deepEqual(await db.select().from(schema.identities), []);
  pass("migrations applied cleanly; tables queryable and empty");

  // 2. requestMagicLink — normalizes email, stores hashed token, returns devLink.
  const req = await requestMagicLink("  Test@Example.COM ", "http://localhost:3000");
  assert.equal(req.ok, true, "requestMagicLink should succeed");
  assert.ok(req.devLink, "dev mode (no RESEND_API_KEY) must return devLink");
  assert.ok(
    req.devLink.startsWith("http://localhost:3000/api/auth/verify?token="),
    "devLink points at the verify route",
  );
  const rawToken = new URL(req.devLink).searchParams.get("token");
  assert.ok(rawToken && rawToken.length >= 40, "token is a long base64url string");

  const tokenRows = await db
    .select()
    .from(schema.loginTokens)
    .where(eq(schema.loginTokens.email, "test@example.com"));
  assert.equal(tokenRows.length, 1, "one token row stored under lowercased email");
  assert.equal(tokenRows[0].tokenHash, sha256(rawToken), "row stores sha256(token), not the token");
  assert.equal(tokenRows[0].consumedAt, null);
  const ttlMs = tokenRows[0].expiresAt.getTime() - Date.now();
  assert.ok(ttlMs > 13 * 60_000 && ttlMs <= 15 * 60_000, "expiry is ~15 minutes out");
  pass("requestMagicLink stores hashed 15-min token and returns devLink");

  // 2b. Invalid email is rejected.
  const bad = await requestMagicLink("not-an-email", "http://localhost:3000");
  assert.equal(bad.ok, false);
  pass("invalid email rejected");

  // 3. verifyMagicLink — consumes token, creates user + session.
  const verified = await verifyMagicLink(rawToken);
  assert.equal(verified.ok, true, "verify should succeed");
  assert.equal(verified.needsOnboarding, true, "new user has no username yet");
  assert.ok(verified.sessionId.length >= 40, "sessionId is a long random id");

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "test@example.com"));
  assert.ok(user, "user auto-created on first verify");
  assert.match(user.id, /^u_[a-z0-9]+$/, "user id follows the uid('u') pattern");
  assert.equal(user.username, null, "username stays NULL until onboarding");
  assert.equal(user.displayName, "test", "displayName from email local-part");
  assert.equal(user.avatar, "/placeholder-user.jpg");
  assert.equal(user.isAdmin, false, "not in ADMIN_EMAILS -> is_admin false");
  assert.equal(user.isVerified, false);
  assert.deepEqual(user.favoriteTeams, []);
  assert.deepEqual(user.badges, []);

  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, verified.sessionId));
  assert.ok(session, "session row created");
  assert.equal(session.userId, user.id);
  const sessionTtlDays = (session.expiresAt.getTime() - Date.now()) / 86_400_000;
  assert.ok(sessionTtlDays > 29 && sessionTtlDays <= 30, "session expires in ~30 days");
  pass("verifyMagicLink created user (is_admin false) + 30-day session");

  // 4. getSessionUser round-trip.
  const sessionUser = await getSessionUser(verified.sessionId);
  assert.ok(sessionUser, "getSessionUser resolves the session");
  assert.equal(sessionUser.id, user.id);
  assert.equal(sessionUser.email, "test@example.com");
  assert.equal(await getSessionUser("nonexistent-session"), null);
  pass("getSessionUser round-trip works; unknown session -> null");

  // 5. Token is single-use: second verify of the same token fails.
  const replay = await verifyMagicLink(rawToken);
  assert.equal(replay.ok, false, "second verify of same token must fail");
  pass("token is single-use (replay rejected)");

  // 6. Expired tokens are rejected even if unconsumed.
  const expReq = await requestMagicLink("test@example.com", "http://localhost:3000");
  assert.equal(expReq.ok, true);
  const expToken = new URL(expReq.devLink).searchParams.get("token");
  await db
    .update(schema.loginTokens)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(schema.loginTokens.tokenHash, sha256(expToken)));
  const expired = await verifyMagicLink(expToken);
  assert.equal(expired.ok, false, "expired token must fail");
  pass("expired token rejected");

  // 7. Rate limit: max 3 unconsumed tokens per email per 15 minutes.
  //    (all earlier tokens are consumed by now — verify consumes atomically
  //    before the expiry check, so even the expired one no longer counts)
  const r2 = await requestMagicLink("test@example.com", "http://localhost:3000");
  const r3 = await requestMagicLink("test@example.com", "http://localhost:3000");
  const r4 = await requestMagicLink("test@example.com", "http://localhost:3000");
  assert.equal(r2.ok && r3.ok && r4.ok, true, "up to 3 unconsumed tokens allowed");
  const r5 = await requestMagicLink("test@example.com", "http://localhost:3000");
  assert.equal(r5.ok, false, "4th unconsumed token within 15 min is rate-limited");
  pass("rate limit enforced (3 unconsumed tokens / 15 min)");

  // 8. Returning user: verify a fresh token for the same email — no new user.
  const again = await verifyMagicLink(new URL(r2.devLink).searchParams.get("token"));
  assert.equal(again.ok, true);
  assert.equal(again.needsOnboarding, true, "still no username -> still onboarding");
  const allUsers = await db.select().from(schema.users);
  assert.equal(allUsers.length, 1, "same email logs into the same user");
  pass("returning login reuses the existing user");

  // 9. identities scaffolding: insert works, defaults apply, uniqueness holds.
  const identityId = uid("idn");
  await db.insert(schema.identities).values({
    id: identityId,
    userId: user.id,
    provider: "instagram",
    handle: "@testuser",
    url: "https://instagram.com/testuser",
  });
  const [identity] = await db
    .select()
    .from(schema.identities)
    .where(eq(schema.identities.id, identityId));
  assert.ok(identity, "identity row inserted");
  assert.equal(identity.status, "unverified", "status defaults to 'unverified'");
  assert.ok(identity.submittedAt instanceof Date, "submitted_at defaults to now()");
  assert.equal(identity.verifiedAt, null);
  await assert.rejects(
    db.insert(schema.identities).values({
      id: uid("idn"),
      userId: user.id,
      provider: "instagram",
      handle: "@testuser",
    }),
    "duplicate (user, provider, handle) must violate the unique constraint",
  );
  pass("identities insert works; defaults + unique(user,provider,handle) hold");

  // 10. destroySession invalidates the session.
  await destroySession(verified.sessionId);
  assert.equal(await getSessionUser(verified.sessionId), null);
  pass("destroySession invalidates the session");

  // 11. Migrations are idempotent (second migrator run is a no-op).
  const { ensureMigrated } = await import("../lib/server/db.ts");
  await ensureMigrated(await getDb());
  pass("re-running migrations is a no-op");

  console.log(`\nFOUNDATION SMOKE: all ${step} checks passed.`);
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
