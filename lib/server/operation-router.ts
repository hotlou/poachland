import "server-only";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { OpMap, OpName } from "../shared/ops";
import type { SessionUser } from "./auth";
import { recordAdminAudit } from "./audit";
import { getDb, type Db } from "./db";
import { referencesHiddenListing, referencesSampleContent } from "./sample-guard";

export type OperationResult = { ok: true; value?: unknown } | { ok: false; error: string };
export type OperationHandlers = {
  [K in OpName]: (db: Db, user: SessionUser, input: OpMap[K]) => Promise<OperationResult>;
};

/** Central authorization, tracing, dispatch, and immutable admin auditing. */
export async function routeOperation<K extends OpName>(
  handlers: OperationHandlers,
  user: SessionUser,
  op: K,
  input: OpMap[K],
  actingAdmin?: SessionUser,
): Promise<OperationResult> {
  return trace.getTracer("poachland.marketplace").startActiveSpan(`marketplace.${op}`, async (span): Promise<OperationResult> => {
    span.setAttributes({
      "app.operation": op,
      "app.actor_id": user.id,
      "app.is_admin_operation": op.startsWith("admin"),
    });
    try {
      const handler = handlers[op] as
        | ((db: Db, actor: SessionUser, payload: OpMap[K]) => Promise<OperationResult>)
        | undefined;
      if (!handler) return { ok: false, error: "Unknown operation" };
      if (op.startsWith("admin") && !user.isAdmin) return { ok: false, error: "Moderators only" };
      if (op !== "completeOnboarding" && !user.username) return { ok: false, error: "Complete onboarding first" };
      if (user.status === "banned") return { ok: false, error: "Your account has been banned." };
      if (user.status === "suspended" && (!user.suspendedUntil || user.suspendedUntil.getTime() > Date.now())) {
        return { ok: false, error: "Your account is suspended." };
      }

      const db = await getDb();
      if (actingAdmin && (!actingAdmin.isAdmin || actingAdmin.status !== "active" || actingAdmin.deletedAt || actingAdmin.sampleBatchId || user.isAdmin || actingAdmin.id === user.id)) {
        return { ok: false, error: "An active moderator session is required to act as another account." };
      }
      if (user.managedByUserId && !actingAdmin) return { ok: false, error: "Managed inventory requires an active moderator session." };
      const editingSample = !!actingAdmin && !!(user.sampleBatchId || user.managedByUserId) && ["createListing", "updateListing", "removeListing", "updateProfile"].includes(op);
      if (op === "markListingViewed" && actingAdmin) return { ok: true };
      if (user.sampleBatchId && !editingSample) return { ok: false, error: "Example accounts support moderator profile and listing edits only. Example trades and ratings cannot become real activity." };
      if (!op.startsWith("admin") && !editingSample && await referencesSampleContent(db, input)) {
        if (op === "markListingViewed") return { ok: true };
        return { ok: false, error: "This is example content. You can browse and share it, but cannot contact, save, react, or make an offer on it." };
      }
      if (["proposeTrade", "makeBuyOffer", "claimListing", "getOrCreateThread"].includes(op) && await referencesHiddenListing(db, input)) {
        return { ok: false, error: "This listing is not available." };
      }
      const result = op.startsWith("admin") || actingAdmin ? await db.transaction(async (tx) => {
        const result = await handler(tx, user, input);
        if (!result.ok) return result;
        if (actingAdmin) {
          const values = input as Record<string, unknown>;
          const targetId = [values.id, values.listingId, values.dealId, values.threadId].find((v): v is string => typeof v === "string") ?? user.id;
          await recordAdminAudit(tx, actingAdmin, `actAs.${op}`, { id: targetId }, {
            actingAsUserId: user.id, actingAsUsername: user.username,
            note: `Moderator @${actingAdmin.username} performed ${op} as @${user.username}.`,
          });
          return result;
        }
        if (["adminModerateContent", "adminCloseAccount", "adminSampleBatch"].includes(op)) return result;
        const values = input as Record<string, unknown>;
        const targetId = ["batchId", "userId", "listingId", "reportId", "dealId", "identityId", "id"]
          .map((key) => values[key])
          .find((value): value is string => typeof value === "string");
        await recordAdminAudit(tx, user, op, { id: targetId }, values);
        return result;
      }) : await handler(db, user, input);
      span.setStatus({ code: result.ok ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      span.setAttribute("app.operation_ok", result.ok);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
