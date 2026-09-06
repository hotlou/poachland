"use server";

/**
 * The only doorway between the browser and the marketplace engine.
 * Thin by design: session resolution here, all rules and SQL in
 * lib/server/engine.ts / lib/server/snapshot.ts.
 */

import { readSessionContext, readSessionUser } from "@/lib/server/session";
import { executeOp } from "@/lib/server/engine";
import { buildAdminData, buildSnapshot } from "@/lib/server/snapshot";
import type { AdminData, MutationDomain, OpMap, OpName, OpResult, WorldSnapshot } from "@/lib/shared/ops";

function invalidatedDomains(op: OpName): MutationDomain[] {
  if (op === "completeOnboarding" || op === "updateProfile") return ["session", "profiles", "notifications"];
  if (op === "setEmailPrefs") return ["session"];
  if (op === "addPaymentMethod" || op === "removePaymentMethod" || op === "attachProof") return ["deals"];
  if (["shareHaul", "hideHaul", "reactHaul", "commentHaul", "setHaulComments", "deleteHaulComment"].includes(op)) return ["haul", "reputation"];
  if (["createListing", "updateListing", "removeListing", "markListingViewed"].includes(op)) return ["listings", "notifications", "saved"];
  if (op === "toggleSave" || op === "createSavedSearch" || op === "deleteSavedSearch") return ["saved", "listings", "wanted"];
  if (op === "createISOPost" || op === "updateISOStatus") return ["wanted", "notifications"];
  if (["getOrCreateThread", "sendMessage", "markThreadRead"].includes(op)) return ["messages", "notifications"];
  if (op === "markNotificationRead" || op === "markAllNotificationsRead") return ["notifications"];
  if (["reportTarget", "blockUser", "unblockUser"].includes(op)) return ["moderation", "profiles", "listings", "messages"];
  if (op === "linkIdentity" || op === "removeIdentity") return ["profiles", "reputation"];
  if (op.startsWith("admin")) return ["moderation", "profiles", "listings", "deals", "notifications", "partners"];
  return ["deals", "listings", "messages", "notifications", "reputation"];
}

export async function dispatchOp<K extends OpName>(
  op: K,
  input: OpMap[K],
): Promise<OpResult> {
  const ctx = await readSessionContext();
  if (!ctx) return { ok: false, error: "Sign in to do that" };
  try {
    const result = await executeOp(ctx.effectiveUser, op, input);
    // Email delivery is deliberately absent here: the independently scheduled
    // worker owns all claiming/retry behavior, so request traffic never gates
    // or delays delivery.
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, invalidated: invalidatedDomains(op), committedAt: new Date().toISOString() };
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
