import type { PaymentKind } from "./types";

export const PAYMENT_KINDS: readonly PaymentKind[] = [
  "venmo",
  "paypal",
  "cashapp",
  "zelle",
  "crypto",
  "other",
];

const UNSAFE_PRIVATE_TEXT = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export type PaymentHandleResult =
  | { ok: true; value: string; label?: string }
  | { ok: false; error: string };

/** Validate private settlement identifiers without making provider-ownership claims. */
export function normalizePaymentHandle(value: unknown, label?: unknown): PaymentHandleResult {
  const cleanValue = String(value ?? "").normalize("NFKC").trim();
  if (!cleanValue) return { ok: false, error: "Enter the handle or address" };
  if (cleanValue.length > 120) return { ok: false, error: "Handle is too long (120 characters max)" };
  if (UNSAFE_PRIVATE_TEXT.test(cleanValue))
    return { ok: false, error: "Handle contains unsupported control characters" };

  const cleanLabel = String(label ?? "").normalize("NFKC").trim();
  if (cleanLabel.length > 40) return { ok: false, error: "Label is too long (40 characters max)" };
  if (UNSAFE_PRIVATE_TEXT.test(cleanLabel))
    return { ok: false, error: "Label contains unsupported control characters" };
  return { ok: true, value: cleanValue, label: cleanLabel || undefined };
}
