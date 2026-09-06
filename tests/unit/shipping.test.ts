import { describe, expect, it } from "vitest";

import { carrierTrackingUrl, normalizeShipmentTracking } from "../../lib/shipping";

describe("shipment tracking", () => {
  it("normalizes carrier-specific tracking numbers", () => {
    expect(normalizeShipmentTracking("1z 999 aa1 01 2345 6784", "ups")).toEqual({
      ok: true,
      carrier: "ups",
      tracking: "1Z999AA10123456784",
    });
    expect(normalizeShipmentTracking("9400 1108 8422 5510 3391 07", "usps")).toMatchObject({
      ok: true,
      tracking: "9400110884225510339107",
    });
  });

  it("rejects mismatched and unsafe tracking input", () => {
    expect(normalizeShipmentTracking("not-a-ups-number", "ups")).toMatchObject({ ok: false });
    expect(normalizeShipmentTracking("ABC?redirect=https://evil.test", "other")).toMatchObject({ ok: false });
    expect(normalizeShipmentTracking("123456789012", undefined)).toMatchObject({ ok: false });
  });

  it("permits untracked handoff and only links known carriers", () => {
    expect(normalizeShipmentTracking("", "other")).toEqual({ ok: true });
    expect(carrierTrackingUrl("fedex", "123456789012")).toContain("fedex.com");
    expect(carrierTrackingUrl("other", "LOCAL-42")).toBeUndefined();
  });
});
