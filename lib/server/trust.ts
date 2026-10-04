import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import type { AdminTrustData, ConfirmDmInput, DmChallenge, ReviewMemberTrustInput, TrustEvidence, TrustResult, TrustStatus, TrustVouch } from "../trust-types";
import type { Db } from "./db";
import { recordAdminAudit } from "./audit";
import { users, type UserRow } from "./schema";
import { trustDmChallenges, trustDmReceipts, trustEvidence, trustPolicyLock, trustVouches } from "./trust-schema";

export type TrustActor = { userId: string; effectiveUserId: string };
const DAY = 86_400_000;
export const TRUST_POLICY = { requiredVouches: 2, waitingDays: 7, vouchesPer30Days: 3, challengeMinutes: 60 } as const;
const success = <T>(value: T): TrustResult<T> => ({ ok: true, value });
const failure = (error: string): { ok: false; error: string } => ({ ok: false, error });
const id = (prefix: string) => `${prefix}_${randomBytes(12).toString("hex")}`;
const hash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
const human = (u: UserRow) => !u.deletedAt && !u.sampleBatchId && !u.managedByUserId && u.status === "active" && !!u.username && !!u.onboardedAt;
const normalizeHandle = (value: unknown) => typeof value === "string" && /^@?[a-zA-Z0-9._]{1,30}$/.test(value.trim()) ? value.trim().replace(/^@/, "").toLowerCase() : null;
const codeFrom = (value: unknown) => typeof value === "string" ? value.toUpperCase().match(/\bPOACH-[A-F0-9]{24}\b/)?.[0] ?? null : null;
const validNote = (note: unknown): note is string => typeof note === "string" && note.trim().length >= 20 && note.trim().length <= 2000;
const cleanNote = (note: string) => note.trim().replace(/\bPOACH-[A-F0-9]{24}\b/gi, "[one-time code redacted]");
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
export const instagramTrustHandle = () => normalizeHandle(process.env.INSTAGRAM_HANDLE ?? process.env.POACHLAND_INSTAGRAM_HANDLE) ?? null;

/** Call first inside transactions that change trust or account standing, before any member/challenge locks. */
export async function acquireTrustLock(db: Db) {
  await db.insert(trustPolicyLock).values({ id: "trust-v1" }).onConflictDoNothing();
  await db.select().from(trustPolicyLock).where(eq(trustPolicyLock.id, "trust-v1")).for("update");
}
const lock = acquireTrustLock;

async function actorUser(db: Db, actor: TrustActor | null, admin = false) {
  if (!actor || actor.userId !== actor.effectiveUserId) return null;
  const [u] = await db.select().from(users).where(eq(users.id, actor.userId));
  return u && human(u) && (!admin || u.isAdmin) ? u : null;
}

type Graph = { members: UserRow[]; byId: Map<string, UserRow>; vouches: typeof trustVouches.$inferSelect[]; verified: Set<string>; eligible: Set<string>; since: Map<string, Date>; now: Date };

/** Rebuild only from explicit staff roots. Cycles cannot introduce trust. Call inside a transaction holding the policy lock. */
async function rebuild(db: Db, now = new Date()): Promise<Graph> {
  const members = await db.select().from(users);
  const vouches = await db.select().from(trustVouches);
  const byId = new Map(members.map((u) => [u.id, u]));
  const verified = new Set<string>();
  const eligible = new Set<string>();
  const since = new Map<string, Date>();
  for (const u of members) if (human(u) && u.trustOverride === "granted") {
    verified.add(u.id); eligible.add(u.id);
    since.set(u.id, u.isVerified && u.trustSource === "staff" && u.trustVerifiedAt ? u.trustVerifiedAt : now);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const u of members) {
      if (!human(u) || u.trustOverride === "blocked" || verified.has(u.id)) continue;
      const issuers = new Set(vouches.filter((v) => !v.revokedAt && v.targetId === u.id && v.issuerId !== u.id && eligible.has(v.issuerId)).map((v) => v.issuerId));
      if (issuers.size < TRUST_POLICY.requiredVouches) continue;
      const started = u.isVerified && u.trustSource === "community" && u.trustVerifiedAt ? u.trustVerifiedAt : now;
      verified.add(u.id); since.set(u.id, started);
      if (started.getTime() + TRUST_POLICY.waitingDays * DAY <= now.getTime()) eligible.add(u.id);
      changed = true;
    }
  }
  for (const u of members) {
    const isVerified = verified.has(u.id);
    const source = isVerified ? u.trustOverride === "granted" ? "staff" as const : "community" as const : "none" as const;
    const started = since.get(u.id) ?? null;
    const badges = u.badges.filter((badge) => badge.type !== "verified");
    if (u.isVerified !== isVerified || u.trustSource !== source || u.trustVerifiedAt?.getTime() !== started?.getTime() || badges.length !== u.badges.length) {
      await db.update(users).set({ isVerified, trustSource: source, trustVerifiedAt: started, badges }).where(eq(users.id, u.id));
      u.isVerified = isVerified; u.trustSource = source; u.trustVerifiedAt = started; u.badges = badges;
    }
  }
  return { members, byId, vouches, verified, eligible, since, now };
}

/** Use after account-standing changes; never set the blue-check cache directly. */
export async function recomputeTrust(db: Db) {
  return db.transaction(async (tx) => { await lock(tx); await rebuild(tx); });
}

function vouchDto(v: typeof trustVouches.$inferSelect, graph: Graph): TrustVouch {
  const target = graph.byId.get(v.targetId);
  return { id: v.id, issuerId: v.issuerId, issuerUsername: graph.byId.get(v.issuerId)?.username ?? "deleted", targetId: v.targetId, targetUsername: target?.username ?? "deleted", relationship: v.relationship, createdAt: v.createdAt.toISOString(), revokedAt: v.revokedAt?.toISOString() ?? null, valid: !v.revokedAt && graph.eligible.has(v.issuerId) && !!target && human(target) && target.trustOverride !== "blocked" };
}
function evidenceDto(e: typeof trustEvidence.$inferSelect, graph: Graph): TrustEvidence {
  return { id: e.id, userId: e.userId, username: graph.byId.get(e.userId)?.username ?? "deleted", provider: e.provider, handle: e.handle, status: e.status, source: e.source, createdAt: e.createdAt.toISOString(), confirmedAt: e.confirmedAt?.toISOString() ?? null, note: e.note };
}
function statusDto(u: UserRow, graph: Graph): TrustStatus {
  const issued = graph.vouches.filter((v) => v.issuerId === u.id && v.createdAt.getTime() > graph.now.getTime() - 30 * DAY).length;
  return { userId: u.id, username: u.username ?? "", verified: graph.verified.has(u.id), source: u.trustSource, verifiedAt: graph.since.get(u.id)?.toISOString() ?? null,
    eligibleToVouch: graph.eligible.has(u.id), eligibleAt: graph.verified.has(u.id) ? new Date(graph.since.get(u.id)!.getTime() + (u.trustSource === "staff" ? 0 : TRUST_POLICY.waitingDays * DAY)).toISOString() : null,
    validVouchCount: graph.vouches.filter((v) => v.targetId === u.id && vouchDto(v, graph).valid).length, vouchesRequired: TRUST_POLICY.requiredVouches, remainingVouches: Math.max(0, TRUST_POLICY.vouchesPer30Days - issued) };
}

export async function getTrustStatus(db: Db, actor: TrustActor | null, targetId?: string): Promise<TrustResult<TrustStatus>> {
  return db.transaction(async (tx) => {
    await lock(tx); const graph = await rebuild(tx);
    const target = graph.byId.get(targetId ?? actor?.effectiveUserId ?? "");
    const own = !!actor && target?.id === actor.effectiveUserId;
    if (!target || (!own && !human(target))) return failure("Member not available.");
    const result = statusDto(target, graph);
    const viewer = actor ? graph.byId.get(actor.userId) : undefined;
    const authentic = actor && actor.userId === actor.effectiveUserId && viewer && human(viewer);
    if (own) {
      const evidence = await tx.select().from(trustEvidence).where(eq(trustEvidence.userId, target.id));
      result.own = { override: target.trustOverride, reviewRequestedAt: target.trustReviewRequestedAt?.toISOString() ?? null, evidence: evidence.map((e) => evidenceDto(e, graph)), outgoingVouches: graph.vouches.filter((v) => v.issuerId === target.id).map((v) => vouchDto(v, graph)), instagramHandle: instagramTrustHandle(), ...(!authentic ? { unavailableReason: "Verification and vouching require your own active, human-owned account. Exit Act as first." } : {}) };
    }
    if (authentic) result.viewer = { eligibleToVouch: graph.eligible.has(viewer.id), remainingVouches: statusDto(viewer, graph).remainingVouches, vouch: graph.vouches.find((v) => v.issuerId === viewer.id && v.targetId === target.id) ? vouchDto(graph.vouches.find((v) => v.issuerId === viewer.id && v.targetId === target.id)!, graph) : null };
    return success(result);
  });
}

export async function requestTrustReview(db: Db, actor: TrustActor): Promise<TrustResult<null>> {
  return db.transaction(async (tx) => {
    await lock(tx); const u = await actorUser(tx, actor);
    if (!u) return failure("Use your own active member account to request verification.");
    if (!u.trustReviewRequestedAt) await tx.update(users).set({ trustReviewRequestedAt: new Date() }).where(eq(users.id, u.id));
    return success(null);
  });
}

export async function issueVouch(db: Db, actor: TrustActor, targetId: string, relationship: string): Promise<TrustResult<null>> {
  if (!validId(targetId)) return failure("Choose a member.");
  if (!["played_together", "met_in_person", "traded"].includes(relationship)) return failure("Choose how you personally know this member.");
  return db.transaction(async (tx) => {
    await lock(tx); const issuer = await actorUser(tx, actor);
    if (!issuer) return failure("Vouching requires your own active member account.");
    const graph = await rebuild(tx); const target = graph.byId.get(targetId);
    if (!target || !human(target) || target.trustOverride === "blocked") return failure("This member is not eligible to receive vouches.");
    if (issuer.id === targetId) return failure("You cannot vouch for yourself.");
    if (!graph.eligible.has(issuer.id)) return failure("Only confirmed members eligible to vouch can do this. Community-confirmed members wait seven days.");
    if (graph.vouches.some((v) => v.issuerId === issuer.id && v.targetId === targetId)) return failure("You have already vouched for this member. Withdrawn vouches cannot be reissued.");
    if (statusDto(issuer, graph).remainingVouches === 0) return failure("You can issue three vouches in a rolling 30-day period.");
    await tx.insert(trustVouches).values({ id: id("vouch"), issuerId: issuer.id, targetId, relationship });
    await rebuild(tx); return success(null);
  });
}

export async function revokeVouch(db: Db, actor: TrustActor, vouchId: string): Promise<TrustResult<null>> {
  if (!validId(vouchId)) return failure("Vouch not found.");
  return db.transaction(async (tx) => {
    await lock(tx); const u = await actorUser(tx, actor);
    if (!u) return failure("Use your own active member account.");
    const [vouch] = await tx.select().from(trustVouches).where(eq(trustVouches.id, vouchId));
    if (!vouch || vouch.issuerId !== u.id) return failure("Vouch not found.");
    if (!vouch.revokedAt) await tx.update(trustVouches).set({ revokedAt: new Date() }).where(eq(trustVouches.id, vouchId));
    await rebuild(tx); return success(null);
  });
}

export async function reviewTrust(db: Db, actor: TrustActor, input: ReviewMemberTrustInput): Promise<TrustResult<null>> {
  if (!input || !validId(input.userId) || !["grant", "revoke", "block", "clear"].includes(input.action) || !validNote(input.note)) return failure("Choose a valid review action and give a reason of 20–2,000 characters.");
  return db.transaction(async (tx) => {
    await lock(tx); const admin = await actorUser(tx, actor, true);
    if (!admin) return failure("Use your own active moderator account.");
    const [target] = await tx.select().from(users).where(eq(users.id, input.userId));
    if (!target || target.deletedAt || target.sampleBatchId || target.managedByUserId) return failure("Only human-owned member accounts can receive verification decisions.");
    if (input.action === "grant" && !human(target)) return failure("Restore the member's active standing before granting verification.");
    await tx.update(users).set({ trustOverride: input.action === "grant" ? "granted" : input.action === "clear" ? "none" : "blocked", trustReviewRequestedAt: null }).where(eq(users.id, target.id));
    await rebuild(tx);
    await recordAdminAudit(tx, admin, `trust.${input.action}`, { type: "user", id: target.id }, { note: cleanNote(input.note), policy: 1 });
    return success(null);
  });
}

export async function getAdminTrust(db: Db, actor: TrustActor): Promise<TrustResult<AdminTrustData>> {
  return db.transaction(async (tx) => {
    await lock(tx); if (!await actorUser(tx, actor, true)) return failure("Moderators only.");
    const graph = await rebuild(tx); const evidence = await tx.select().from(trustEvidence);
    return success({ members: graph.members.filter((u) => !u.deletedAt && !u.sampleBatchId && !u.managedByUserId && !!u.username).map((u) => ({ ...statusDto(u, graph), displayName: u.displayName, status: u.status, override: u.trustOverride, reviewRequestedAt: u.trustReviewRequestedAt?.toISOString() ?? null, evidence: evidence.filter((e) => e.userId === u.id).map((e) => evidenceDto(e, graph)) })), pendingEvidence: evidence.filter((e) => e.status === "pending").map((e) => evidenceDto(e, graph)), vouches: graph.vouches.map((v) => vouchDto(v, graph)) });
  });
}

export async function createDmChallenge(db: Db, actor: TrustActor, rawHandle: string): Promise<TrustResult<DmChallenge>> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return failure("Enter a valid Instagram username.");
  if (!instagramTrustHandle()) return failure("Instagram verification is not configured yet. Request staff review instead.");
  return db.transaction(async (tx) => {
    await lock(tx); const u = await actorUser(tx, actor);
    if (!u) return failure("Use your own active member account to confirm Instagram ownership.");
    const [claimed] = await tx.select().from(trustEvidence).where(and(eq(trustEvidence.handle, handle), ne(trustEvidence.status, "revoked")));
    if (claimed) return failure(claimed.userId === u.id ? "This Instagram ownership evidence is already recorded. Request staff review." : "That Instagram account is already attached to another member. Ask staff to review it.");
    const recent = await tx.select({ id: trustDmChallenges.id }).from(trustDmChallenges).where(and(eq(trustDmChallenges.userId, u.id), gt(trustDmChallenges.createdAt, new Date(Date.now() - DAY))));
    if (recent.length >= 3) return failure("You can request three Instagram codes per day. Try again tomorrow.");
    await tx.update(trustDmChallenges).set({ cancelledAt: new Date() }).where(and(eq(trustDmChallenges.userId, u.id), isNull(trustDmChallenges.consumedAt), isNull(trustDmChallenges.cancelledAt)));
    const challengeId = id("tdm"); const code = `POACH-${randomBytes(12).toString("hex").toUpperCase()}`; const expiresAt = new Date(Date.now() + TRUST_POLICY.challengeMinutes * 60_000);
    await tx.insert(trustDmChallenges).values({ id: challengeId, userId: u.id, handle, codeHash: hash(code), expiresAt });
    return success({ id: challengeId, code, handle, expiresAt: expiresAt.toISOString() });
  });
}

async function recordDm(db: Db, code: string, senderHandle: string | null, externalSenderId: string | null, manualNote?: string) {
  const [challenge] = await db.select().from(trustDmChallenges).where(eq(trustDmChallenges.codeHash, hash(code))).for("update");
  if (!challenge || challenge.cancelledAt) return failure("This code is invalid or has been replaced.");
  const [existing] = await db.select().from(trustEvidence).where(eq(trustEvidence.challengeId, challenge.id));
  const manualPendingReview = !!manualNote && existing?.status === "pending";
  if ((!manualPendingReview && challenge.consumedAt) || (!manualPendingReview && challenge.expiresAt.getTime() <= Date.now())) return failure("This code has expired or has already been used.");
  if (senderHandle && senderHandle !== challenge.handle) return failure("The Instagram sender does not match the username declared for this code.");
  const [owner] = await db.select().from(users).where(eq(users.id, challenge.userId));
  if (!owner || !human(owner)) return failure("The requesting account is no longer eligible.");
  const conflicts = await db.select().from(trustEvidence).where(and(ne(trustEvidence.status, "revoked"), or(eq(trustEvidence.handle, challenge.handle), externalSenderId ? eq(trustEvidence.externalSenderId, externalSenderId) : undefined)));
  if (conflicts.some((e) => e.id !== existing?.id)) return failure("That Instagram account already has ownership evidence. Staff must resolve the duplicate.");
  const confirmed = !!senderHandle;
  if (existing) {
    if (!manualPendingReview) return failure("Ownership evidence was already recorded.");
    await db.update(trustEvidence).set({ status: "confirmed", confirmedAt: new Date(), note: cleanNote(manualNote!) }).where(eq(trustEvidence.id, existing.id));
  } else await db.insert(trustEvidence).values({ id: id("tev"), userId: owner.id, handle: challenge.handle, externalSenderId, challengeId: challenge.id, status: confirmed ? "confirmed" : "pending", source: manualNote ? "manual_dm" : "webhook_dm", confirmedAt: confirmed ? new Date() : null, note: manualNote ? cleanNote(manualNote) : null });
  await db.update(trustDmChallenges).set({ consumedAt: new Date() }).where(eq(trustDmChallenges.id, challenge.id));
  if (!owner.trustReviewRequestedAt) await db.update(users).set({ trustReviewRequestedAt: new Date() }).where(eq(users.id, owner.id));
  return success({ userId: owner.id, status: confirmed ? "confirmed" as const : "pending_review" as const });
}

/** The webhook caller must authenticate Meta's signature and destination before calling this function. */
export async function receiveInstagramDm(db: Db, input: { externalSenderId: string; username?: string; text: string; messageId: string }): Promise<{ ok: boolean; error?: string; status?: "confirmed" | "pending_review" | "ignored" | "duplicate" }> {
  if (!input || typeof input.messageId !== "string" || !input.messageId || input.messageId.length > 500 || typeof input.externalSenderId !== "string" || !input.externalSenderId || input.externalSenderId.length > 200 || typeof input.text !== "string" || input.text.length > 20_000) return { ok: false, error: "Invalid message." };
  const code = codeFrom(input.text);
  if (!code) return { ok: true, status: "ignored" };
  return db.transaction(async (tx) => {
    await lock(tx);
    const receipt = await tx.insert(trustDmReceipts).values({ messageId: input.messageId }).onConflictDoNothing().returning();
    if (!receipt.length) return { ok: true, status: "duplicate" as const };
    const result = await recordDm(tx, code, normalizeHandle(input.username), input.externalSenderId);
    return result.ok ? { ok: true, status: result.value.status } : { ok: false, error: result.error };
  });
}

export async function confirmInstagramDm(db: Db, actor: TrustActor, input: ConfirmDmInput): Promise<TrustResult<null>> {
  const code = codeFrom(input?.code); const sender = normalizeHandle(input?.senderHandle);
  if (!code || !sender || !validNote(input?.note)) return failure("Enter the actual DM code, sender username, and a review note of 20–2,000 characters.");
  return db.transaction(async (tx) => {
    await lock(tx); const admin = await actorUser(tx, actor, true);
    if (!admin) return failure("Use your own active moderator account.");
    const result = await recordDm(tx, code, sender, null, input.note);
    if (!result.ok) return result;
    await recordAdminAudit(tx, admin, "trust.confirmInstagramDm", { type: "user", id: result.value.userId }, { senderHandle: sender, note: cleanNote(input.note), method: "actual_inbox_dm", policy: 1 });
    return success(null);
  });
}

export async function revokeTrustRecord(db: Db, actor: TrustActor, kind: "vouch" | "evidence", input: { id: string; note: string }): Promise<TrustResult<null>> {
  if (!input || !validId(input.id) || !validNote(input.note)) return failure("Give a reason of 20–2,000 characters.");
  return db.transaction(async (tx) => {
    await lock(tx); const admin = await actorUser(tx, actor, true);
    if (!admin) return failure("Use your own active moderator account.");
    if (kind === "vouch") {
      const [record] = await tx.select().from(trustVouches).where(eq(trustVouches.id, input.id));
      if (!record) return failure("Vouch not found.");
      if (!record.revokedAt) await tx.update(trustVouches).set({ revokedAt: new Date() }).where(eq(trustVouches.id, record.id));
      await rebuild(tx);
    } else {
      const [record] = await tx.select().from(trustEvidence).where(eq(trustEvidence.id, input.id));
      if (!record) return failure("Ownership evidence not found.");
      await tx.update(trustEvidence).set({ status: "revoked", note: cleanNote(input.note) }).where(eq(trustEvidence.id, record.id));
    }
    await recordAdminAudit(tx, admin, `trust.revoke${kind === "vouch" ? "Vouch" : "Evidence"}`, { type: kind, id: input.id }, { note: cleanNote(input.note), policy: 1 });
    return success(null);
  });
}
