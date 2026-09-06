export type PostgresConnectionOptions = {
  connectionString: string;
  ssl?: { rejectUnauthorized: true };
};

/**
 * Enforce verified TLS for remote PostgreSQL without allowing connection-string
 * sslmode parameters to override the driver's explicit certificate policy.
 */
export function postgresConnectionOptions(raw: string): PostgresConnectionOptions {
  const url = new URL(raw);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (local) return { connectionString: url.toString() };
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true } };
}
