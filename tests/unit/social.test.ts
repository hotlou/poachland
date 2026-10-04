import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { socialCaption, socialScore, socialWindow } from "../../lib/social-types";

vi.mock("server-only", () => ({}));
import { instagramConnection, instagramMessages, validInstagramSignature } from "../../lib/server/instagram";

afterEach(() => vi.unstubAllEnvs());

describe("social highlight windows and evidence", () => {
  it("uses stable complete UTC days and the previous complete Monday–Sunday", () => {
    const monday = new Date("2026-10-05T23:59:59Z");
    expect(socialWindow("daily", monday).start.toISOString()).toBe("2026-10-04T00:00:00.000Z");
    expect(socialWindow("weekly", monday).start.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(socialWindow("weekly", monday).end.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(socialWindow("weekly", new Date("2026-10-11T03:00:00Z")).key).toBe(socialWindow("weekly", monday).key);
    expect(socialWindow("custom", monday, 999).start.toISOString()).toBe("2026-09-05T00:00:00.000Z");
  });
  it("caps popularity and does not invent transaction numbers or buyers", () => {
    expect(socialScore("listing", 10000, 10000)).toBeLessThan(socialScore("haul"));
    const caption = socialCaption([{ kind: "listing", id: "l_1", title: "Seattle jersey", photo: "x", url: "https://poachland.com/l/l_1", ownerIds: ["u_1"], listingIds: ["l_1"], occurredAt: "2026-10-01", score: 30 }]);
    expect(caption).toContain("Available: Seattle jersey");
    expect(caption).not.toMatch(/sold|swaps|trades completed|buyers/i);
  });
});

describe("Instagram ingress", () => {
  it("verifies the exact raw bytes with a constant-time SHA256 comparison", () => {
    const body = Buffer.from('{"text":"🥏"}');
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(validInstagramSignature(body, signature, "secret")).toBe(true);
    expect(validInstagramSignature(Buffer.from('{ "text":"🥏"}'), signature, "secret")).toBe(false);
    expect(validInstagramSignature(body, signature, "wrong")).toBe(false);
    expect(validInstagramSignature(body, "sha256=zz", "secret")).toBe(false);
    expect(validInstagramSignature(body, null, "secret")).toBe(false);
  });
  it("accepts only incoming text addressed to the exact configured professional account", () => {
    const good = { sender: { id: "123" }, recipient: { id: "999" }, message: { mid: "m_1", text: "POACH-aabb" } };
    const messages = instagramMessages({ object: "instagram", entry: [{ id: "999", messaging: [good, { ...good, recipient: { id: "888" } }, { ...good, message: { ...good.message, is_echo: true } }, { ...good, message: { ...good.message, is_deleted: true } }] }, { id: "888", messaging: [good] }] }, "999");
    expect(messages).toEqual([{ externalSenderId: "123", messageId: "m_1", text: "POACH-aabb" }]);
    expect(instagramMessages({ object: "page", entry: [] }, "999")).toEqual([]);
    expect(instagramMessages(null, "999")).toEqual([]);
  });
  it("requires an explicit API version and does not return tokens to the UI", () => {
    vi.stubEnv("INSTAGRAM_ACCOUNT_ID", "999"); vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "secret-token"); vi.stubEnv("INSTAGRAM_API_VERSION", "");
    expect(instagramConnection().configured).toBe(false);
    vi.stubEnv("INSTAGRAM_API_VERSION", "v26.0"); vi.stubEnv("INSTAGRAM_HANDLE", "@poachland");
    expect(instagramConnection()).toEqual({ configured: true, missing: [], handle: "poachland" });
    expect(JSON.stringify(instagramConnection())).not.toContain("secret-token");
  });
});
