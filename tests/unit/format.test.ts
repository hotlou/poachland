import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, money, timeAgo, timeUntil } from "../../lib/format";

describe("format helpers", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-01-15T12:00:00Z")));
  afterEach(() => vi.useRealTimers());

  it("formats relative past and future times", () => {
    expect(timeAgo("2026-01-15T11:59:30Z")).toBe("just now");
    expect(timeAgo("2026-01-15T10:00:00Z")).toBe("2h ago");
    expect(timeUntil("2026-01-17T12:00:00Z")).toBe("2d left");
    expect(timeUntil("2026-01-15T11:00:00Z")).toBe("expired");
  });

  it("handles invalid dates and money precision", () => {
    expect(timeAgo("not-a-date")).toBe("");
    expect(formatDate("not-a-date")).toBe("");
    expect(money(12)).toBe("$12");
    expect(money(12.5)).toBe("$12.50");
  });
});
