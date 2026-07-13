"use server";

/**
 * The only doorway between the browser and the marketplace engine.
 * Thin by design: session resolution here, all rules and SQL in
 * lib/server/engine.ts / lib/server/snapshot.ts.
 */

import { readSessionContext, readSessionUser } from "@/lib/server/session";
import { executeOp } from "@/lib/server/engine";
import { flushEmailOutbox } from "@/lib/server/email";
import { buildAdminData, buildSnapshot } from "@/lib/server/snapshot";
import type { AdminData, OpMap, OpName, OpResult, WorldSnapshot } from "@/lib/shared/ops";

export async function dispatchOp<K extends OpName>(
  op: K,
  input: OpMap[K],
): Promise<OpResult> {
  const ctx = await readSessionContext();
  if (!ctx) return { ok: false, error: "Sign in to do that" };
  try {
    const result = await executeOp(ctx.effectiveUser, op, input);
    const snapshot = await buildSnapshot(ctx.effectiveUser.id, ctx.impersonatorUsername);
    // Best-effort: send any emails this op queued (never blocks the response
    // on failure). Skip while impersonating so support actions don't email.
    if (result.ok && ctx.effectiveUser.id === ctx.realUser.id) {
      await flushEmailOutbox().catch((e) => console.error("[email] flush failed", e));
    }
    if (!result.ok) return { ok: false, error: result.error, snapshot };
    return { ok: true, snapshot };
  } catch (err) {
    console.error(`dispatchOp(${op}) failed`, err);
    return { ok: false, error: "Something went wrong on our end. Try again." };
  }
}

export async function fetchBootstrap(): Promise<WorldSnapshot> {
  const ctx = await readSessionContext();
  return buildSnapshot(ctx?.effectiveUser.id ?? null, ctx?.impersonatorUsername);
}

export async function fetchAdminData(): Promise<AdminData | { error: string }> {
  // Admin views require the REAL user to be an admin — you can't reach the mod
  // desk while impersonating (effective user is a non-admin then).
  const ctx = await readSessionContext();
  if (!ctx?.realUser.isAdmin || ctx.effectiveUser.id !== ctx.realUser.id) {
    return { error: "Moderators only" };
  }
  return buildAdminData();
}

/** Kept for callers that only need the acting user. */
export async function currentUserId(): Promise<string | null> {
  const user = await readSessionUser();
  return user?.id ?? null;
}
