import { registerOTel } from "@vercel/otel";
import { env } from "@/lib/env";

export function register() {
  // Fail deployment startup before serving traffic when a required production
  // dependency or canonical HTTPS origin is missing.
  env();
  registerOTel({ serviceName: "poachland-marketplace" });
}
