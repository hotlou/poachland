import type { UserStatus } from "./types";

const UNSAFE_MODERATION_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export type AccountModerationInput =
  | { ok: true; status: UserStatus; note: string; days?: number }
  | { ok: false; error: string };

/** Validate the durable rationale and duration for an account-standing change. */
export function validateAccountModeration(
  status: unknown,
  days: unknown,
  note: unknown,
): AccountModerationInput {
  const validStatuses: UserStatus[] = ["active", "shadowbanned", "suspended", "banned"];
  if (!validStatuses.includes(status as UserStatus)) return { ok: false, error: "Invalid status" };

  const cleanNote = String(note ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (cleanNote.length < 20)
    return { ok: false, error: "Describe the account status change in at least 20 characters" };
  if (cleanNote.length > 2_000)
    return { ok: false, error: "Account moderation notes are capped at 2,000 characters" };
  if (UNSAFE_MODERATION_TEXT.test(cleanNote))
    return { ok: false, error: "Account moderation notes contain unsupported control characters" };

  if (status === "suspended") {
    if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 365)
      return { ok: false, error: "Suspension length must be a whole number from 1 to 365 days" };
    return { ok: true, status, note: cleanNote, days };
  }
  return { ok: true, status: status as UserStatus, note: cleanNote };
}
