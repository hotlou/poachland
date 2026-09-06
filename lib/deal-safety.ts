import type { FulfillmentState } from "./types";

export type CancellationCheck =
  | { ok: true; reason: string }
  | { ok: false; error: string };

export function validateAcceptedDealCancellation(
  fulfillment: Record<string, FulfillmentState>,
  reason: unknown,
): CancellationCheck {
  if (Object.values(fulfillment).some((side) => side.shippedAt || side.receivedAt)) {
    return {
      ok: false,
      error: "Shipping or handoff has started — open a dispute so the evidence stays available",
    };
  }
  const cleanReason = String(reason ?? "").normalize("NFKC").trim();
  if (cleanReason.length < 10) return { ok: false, error: "Give a cancellation reason (at least 10 characters)" };
  if (cleanReason.length > 500) return { ok: false, error: "Cancellation reason is capped at 500 characters" };
  return { ok: true, reason: cleanReason };
}

export type DisputeReasonCheck =
  | { ok: true; reason: string }
  | { ok: false; error: string };

const UNSAFE_EVIDENCE_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export function validateDisputeReason(reason: unknown): DisputeReasonCheck {
  const cleanReason = String(reason ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (cleanReason.length < 20)
    return { ok: false, error: "Describe the problem in at least 20 characters" };
  if (cleanReason.length > 2_000)
    return { ok: false, error: "Dispute details are capped at 2,000 characters" };
  if (UNSAFE_EVIDENCE_TEXT.test(cleanReason))
    return { ok: false, error: "Dispute details contain unsupported control characters" };
  return { ok: true, reason: cleanReason };
}

export function validateModerationResolution(note: unknown): DisputeReasonCheck {
  const checked = validateDisputeReason(note);
  if (!checked.ok) {
    return {
      ok: false,
      error: checked.error.replace("problem", "resolution").replace("Dispute details", "Resolution note"),
    };
  }
  return checked;
}
