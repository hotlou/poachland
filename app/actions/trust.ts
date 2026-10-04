"use server";

import { readSessionContext } from "@/lib/server/session";
import { getDb } from "@/lib/server/db";
import { confirmInstagramDm, createDmChallenge, getAdminTrust, getTrustStatus, issueVouch, requestTrustReview, reviewTrust, revokeVouch, revokeTrustRecord, type TrustActor } from "@/lib/server/trust";
import type { ConfirmDmInput, ReviewMemberTrustInput } from "@/lib/trust-types";

async function actor(): Promise<TrustActor | null> {
  const ctx = await readSessionContext();
  return ctx ? { userId: ctx.realUser.id, effectiveUserId: ctx.effectiveUser.id } : null;
}
const signedOut = () => ({ ok: false as const, error: "Sign in to continue." });
export async function fetchTrustStatus(targetId?: string) { return getTrustStatus(await getDb(), await actor(), typeof targetId === "string" ? targetId.slice(0, 100) : undefined); }
export async function requestStaffReview() { const a = await actor(); return a ? requestTrustReview(await getDb(), a) : signedOut(); }
export async function issueDmChallenge(handle: string) { const a = await actor(); return a ? createDmChallenge(await getDb(), a, handle) : signedOut(); }
export async function vouchForUser(targetId: string, relationship: string) { const a = await actor(); return a ? issueVouch(await getDb(), a, targetId, relationship) : signedOut(); }
export async function revokeMyVouch(id: string) { const a = await actor(); return a ? revokeVouch(await getDb(), a, id) : signedOut(); }
export async function fetchAdminTrust() { const a = await actor(); return a ? getAdminTrust(await getDb(), a) : signedOut(); }
export async function reviewMemberTrust(input: ReviewMemberTrustInput) { const a = await actor(); return a ? reviewTrust(await getDb(), a, input) : signedOut(); }
export async function confirmDmManually(input: ConfirmDmInput) { const a = await actor(); return a ? confirmInstagramDm(await getDb(), a, input) : signedOut(); }
export async function revokeTrustVouch(input: { id: string; note: string }) { const a = await actor(); return a ? revokeTrustRecord(await getDb(), a, "vouch", input) : signedOut(); }
export async function revokeTrustEvidence(input: { id: string; note: string }) { const a = await actor(); return a ? revokeTrustRecord(await getDb(), a, "evidence", input) : signedOut(); }
