"use server";

/**
 * The only doorway between the browser and the marketplace engine.
 * Thin by design: session resolution here, all rules and SQL in
 * lib/server/engine.ts / lib/server/snapshot.ts.
 */

import { readSessionUser } from "@/lib/server/session";
import { executeOp } from "@/lib/server/engine";
import { buildAdminData, buildSnapshot } from "@/lib/server/snapshot";
import type { AdminData, OpMap, OpName, OpResult, WorldSnapshot } from "@/lib/shared/ops";

export async function dispatchOp<K extends OpName>(
  op: K,
  input: OpMap[K],
): Promise<OpResult> {
  const user = await readSessionUser();
  if (!user) return { ok: false, error: "Sign in to do that" };
  try {
    const result = await executeOp(user, op, input);
    const snapshot = await buildSnapshot(user.id);
    if (!result.ok) return { ok: false, error: result.error, snapshot };
    return { ok: true, snapshot };
  } catch (err) {
    console.error(`dispatchOp(${op}) failed`, err);
    return { ok: false, error: "Something went wrong on our end. Try again." };
  }
}

export async function fetchBootstrap(): Promise<WorldSnapshot> {
  const user = await readSessionUser();
  return buildSnapshot(user?.id ?? null);
}

export async function fetchAdminData(): Promise<AdminData | { error: string }> {
  const user = await readSessionUser();
  if (!user?.isAdmin) return { error: "Moderators only" };
  return buildAdminData();
}
