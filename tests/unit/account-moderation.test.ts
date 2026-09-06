import { describe, expect, it } from "vitest";
import { validateAccountModeration } from "../../lib/account-moderation";

describe("validateAccountModeration", () => {
  const rationale = "Documented policy violation with supporting evidence.";

  it("accepts a bounded suspension and normalizes its rationale", () => {
    expect(validateAccountModeration("suspended", 14, `  ${rationale}\r\n  `)).toEqual({
      ok: true,
      status: "suspended",
      days: 14,
      note: rationale,
    });
  });

  it.each([0, 366, 1.5, "7", undefined])("rejects invalid suspension duration %j", (days) => {
    expect(validateAccountModeration("suspended", days, rationale)).toMatchObject({ ok: false });
  });

  it("requires a useful rationale for sanctions and restoration", () => {
    expect(validateAccountModeration("banned", undefined, "Too short")).toEqual({
      ok: false,
      error: "Describe the account status change in at least 20 characters",
    });
    expect(validateAccountModeration("active", undefined, rationale)).toEqual({
      ok: true,
      status: "active",
      note: rationale,
    });
  });

  it("rejects unsupported statuses and unsafe text", () => {
    expect(validateAccountModeration("deleted", undefined, rationale)).toMatchObject({ ok: false });
    expect(validateAccountModeration("banned", undefined, `${rationale}\u202E`)).toMatchObject({ ok: false });
  });
});
