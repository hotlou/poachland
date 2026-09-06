import type { ShippingCarrier } from "./types";

export const SHIPPING_CARRIERS: readonly ShippingCarrier[] = [
  "usps",
  "ups",
  "fedex",
  "dhl",
  "other",
];

export const SHIPPING_CARRIER_LABELS: Record<ShippingCarrier, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL",
  other: "Other / local handoff",
};

const TRACKING_PATTERNS: Partial<Record<ShippingCarrier, RegExp>> = {
  usps: /^(?:\d{20,22}|[A-Z]{2}\d{9}US)$/,
  ups: /^1Z[A-Z0-9]{16}$/,
  fedex: /^\d{12,22}$/,
  dhl: /^\d{10,14}$/,
};

export type ShipmentTrackingResult =
  | { ok: true; carrier?: ShippingCarrier; tracking?: string }
  | { ok: false; error: string };

/** Normalize and validate tracking before it enters fulfillment history. */
export function normalizeShipmentTracking(
  tracking?: string,
  carrier?: ShippingCarrier,
): ShipmentTrackingResult {
  const raw = tracking?.normalize("NFKC").trim() ?? "";
  if (!raw) return { ok: true };
  if (!carrier || !SHIPPING_CARRIERS.includes(carrier))
    return { ok: false, error: "Choose a carrier for the tracking number" };
  if (raw.length > 100 || !/^[A-Za-z0-9 ._-]+$/.test(raw))
    return { ok: false, error: "Enter a valid tracking number" };

  const compact = raw.replace(/[\s.-]+/g, "").toUpperCase();
  const pattern = TRACKING_PATTERNS[carrier];
  if (pattern && !pattern.test(compact))
    return { ok: false, error: `That tracking number does not look valid for ${SHIPPING_CARRIER_LABELS[carrier]}` };
  return { ok: true, carrier, tracking: compact };
}

export function carrierTrackingUrl(
  carrier: ShippingCarrier | undefined,
  tracking: string,
): string | undefined {
  const code = encodeURIComponent(tracking);
  switch (carrier) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
    case "ups":
      return `https://www.ups.com/track?loc=en_US&tracknum=${code}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
    case "dhl":
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${code}`;
    default:
      return undefined;
  }
}
