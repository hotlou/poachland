import "server-only";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { OpMap, OpName } from "../shared/ops";
import type { SessionUser } from "./auth";
import { recordAdminAudit } from "./audit";
import { getDb, type Db } from "./db";

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
): Promise<OperationResult> {
  return trace.getTracer("poachland.marketplace").startActiveSpan(`marketplace.${op}`, async (span) => {
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
      const result = await handler(db, user, input);
      if (result.ok && op.startsWith("admin")) {
        const values = input as Record<string, unknown>;
        const targetId = ["userId", "listingId", "reportId", "dealId", "identityId", "id"]
          .map((key) => values[key])
          .find((value): value is string => typeof value === "string");
        await recordAdminAudit(db, user, op, { id: targetId }, values);
      }
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
