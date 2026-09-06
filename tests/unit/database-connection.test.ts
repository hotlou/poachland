import { describe, expect, it } from "vitest";
import { postgresConnectionOptions } from "../../lib/database-connection";

describe("PostgreSQL connection policy", () => {
  it("requires verified TLS remotely and strips ambiguous libpq flags", () => {
    const result = postgresConnectionOptions(
      "postgresql://user:pass@example.neon.tech/db?sslmode=require&uselibpqcompat=true&channel_binding=require",
    );
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
    expect(result.connectionString).not.toContain("sslmode");
    expect(result.connectionString).not.toContain("uselibpqcompat");
    expect(result.connectionString).toContain("channel_binding=require");
  });

  it("does not force TLS for a local database", () => {
    expect(postgresConnectionOptions("postgresql://localhost/poachland")).toEqual({
      connectionString: "postgresql://localhost/poachland",
    });
  });
});
