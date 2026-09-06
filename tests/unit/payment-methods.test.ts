import { describe, expect, it } from "vitest";

import { normalizePaymentHandle, PAYMENT_KINDS } from "../../lib/payment-methods";

describe("private payment handles", () => {
  it("normalizes safe values and labels", () => {
    expect(normalizePaymentHandle("  @collector  ", "  jerseys  ")).toEqual({
      ok: true,
      value: "@collector",
      label: "jerseys",
    });
  });

  it("rejects control and bidi characters", () => {
    expect(normalizePaymentHandle("safe\nspoofed")).toMatchObject({ ok: false });
    expect(normalizePaymentHandle("paypal.me/user\u202Eevil")).toMatchObject({ ok: false });
  });

  it("keeps the accepted payment taxonomy explicit", () => {
    expect(PAYMENT_KINDS).toEqual(["venmo", "paypal", "cashapp", "zelle", "crypto", "other"]);
  });
});
