import { REPORT_REASONS } from "./constants";

const UNSAFE_MODERATION_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export type ModerationReportInput =
  | { ok: true; reason: (typeof REPORT_REASONS)[number]; details?: string }
  | { ok: false; error: string };

export function validateModerationReport(reason: unknown, details?: unknown): ModerationReportInput {
  const cleanReason = String(reason ?? "").normalize("NFKC").trim();
  if (!REPORT_REASONS.includes(cleanReason as (typeof REPORT_REASONS)[number]))
    return { ok: false, error: "Pick a valid report reason" };
  const cleanDetails = String(details ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (cleanDetails.length > 2_000) return { ok: false, error: "Report details are capped at 2,000 characters" };
  if (UNSAFE_MODERATION_TEXT.test(cleanDetails))
    return { ok: false, error: "Report details contain unsupported control characters" };
  if (cleanReason === "Other" && cleanDetails.length < 20)
    return { ok: false, error: "Describe the issue in at least 20 characters" };
  return {
    ok: true,
    reason: cleanReason as (typeof REPORT_REASONS)[number],
    details: cleanDetails || undefined,
  };
}
