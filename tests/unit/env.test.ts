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
      BLOB_STORE_ID: "store_abc123",
      BLOB_WEBHOOK_PUBLIC_KEY: "public-key",
      NEXT_PUBLIC_APP_URL: "https://poachland.example",
    } as const;
    expect(() => environmentSchema.parse(production)).not.toThrow();
    expect(() => environmentSchema.parse({ ...production, NEXT_PUBLIC_APP_URL: "http://poachland.example" })).toThrow();
  });

  it("allows the production artifact to use isolated services only in non-Vercel CI E2E", () => {
    const e2e = {
      NODE_ENV: "production",
      CI: "true",
      POACHLAND_E2E_MODE: "1",
      PGLITE_PATH: ".pglite-e2e",
    } as const;

    expect(() => environmentSchema.parse(e2e)).not.toThrow();
    expect(() => environmentSchema.parse({ ...e2e, CI: undefined })).toThrow(/CI=true/);
    expect(() => environmentSchema.parse({ ...e2e, PGLITE_PATH: undefined })).toThrow(/PGLITE_PATH/);
    expect(() => environmentSchema.parse({ ...e2e, VERCEL: "1" })).toThrow(/non-Vercel/);
  });
});
