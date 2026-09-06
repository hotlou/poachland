import { describe, expect, it } from "vitest";
import { environmentSchema, parseAppEnvironment } from "../../lib/env";

describe("environment schema", () => {
  it("allows embedded database development defaults", () => {
    expect(environmentSchema.parse({ NODE_ENV: "development" }).NODE_ENV).toBe("development");
  });

  it("surfaces startup validation as an annotatable plain Error", () => {
    expect(() => parseAppEnvironment({ NODE_ENV: "production" })).toThrow(
      /Invalid Poachland environment:.*DATABASE_URL/,
    );
  });

  it("requires the complete production service contract and HTTPS origin", () => {
    expect(() => environmentSchema.parse({ NODE_ENV: "production" })).toThrow();
    const production = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/poachland",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Poachland <hello@poachland.example>",
      AUTH_SECRET: "x".repeat(32),
      CRON_SECRET: "y".repeat(32),
      STORAGE_ENDPOINT: "https://storage.example",
      STORAGE_BUCKET: "poachland",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
      STORAGE_PUBLIC_URL: "https://cdn.poachland.example",
      NEXT_PUBLIC_APP_URL: "https://poachland.example",
    } as const;
    expect(() => environmentSchema.parse(production)).not.toThrow();
    expect(() => environmentSchema.parse({ ...production, NEXT_PUBLIC_APP_URL: "http://poachland.example" })).toThrow();
  });
});
