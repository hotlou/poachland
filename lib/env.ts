import { z } from "zod";

const optionalUrl = z.string().url().optional();

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalUrl,
  PGLITE_PATH: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(32).optional(),
  BLOB_STORE_ID: z.string().regex(/^store_[A-Za-z0-9]+$/).optional(),
  BLOB_WEBHOOK_PUBLIC_KEY: z.string().min(1).optional(),
  ADMIN_EMAILS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  SEED_DEMO: z.enum(["yes", "no"]).optional(),
  CI: z.enum(["true"]).optional(),
  POACHLAND_E2E_MODE: z.enum(["1"]).optional(),
  VERCEL: z.enum(["1"]).optional(),
}).superRefine((environment, context) => {
  const e2eRequested = environment.POACHLAND_E2E_MODE === "1";
  const isolatedE2E = isE2ETestRuntime(environment);
  if (e2eRequested && !isolatedE2E) {
    context.addIssue({
      code: "custom",
      path: ["POACHLAND_E2E_MODE"],
      message: "POACHLAND_E2E_MODE requires CI=true, PGLITE_PATH, and a non-Vercel runtime",
    });
  }
  if (environment.NODE_ENV !== "production") return;
  // Playwright exercises the built production artifact in GitHub Actions, but
  // against an isolated embedded database with local-only magic links. This
  // escape hatch is deliberately impossible on Vercel.
  if (isolatedE2E) return;
  for (const key of [
    "DATABASE_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "AUTH_SECRET",
    "CRON_SECRET",
    "BLOB_STORE_ID",
    "BLOB_WEBHOOK_PUBLIC_KEY",
    "NEXT_PUBLIC_APP_URL",
  ] as const) {
    if (!environment[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
  }
  if (environment.NEXT_PUBLIC_APP_URL && !environment.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
    context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_APP_URL"], message: "NEXT_PUBLIC_APP_URL must use HTTPS in production" });
  }
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function isE2ETestRuntime(input: Record<string, unknown> = process.env): boolean {
  return input.POACHLAND_E2E_MODE === "1"
    && input.CI === "true"
    && typeof input.PGLITE_PATH === "string"
    && input.PGLITE_PATH.length > 0
    && input.VERCEL !== "1";
}

let cached: AppEnvironment | undefined;

export function parseAppEnvironment(input: Record<string, unknown>): AppEnvironment {
  const parsed = environmentSchema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    // Some production runtimes annotate thrown errors. ZodError.message is a
    // getter-only property, so throw a plain Error to keep startup failures
    // observable instead of masking them with a secondary TypeError.
    throw new Error(`Invalid Poachland environment: ${detail}`);
  }
  return parsed.data;
}

export function env(): AppEnvironment {
  if (!cached) cached = parseAppEnvironment(process.env);
  return cached;
}

export function canonicalOrigin(fallback = "https://poachland.com"): string {
  return (env().NEXT_PUBLIC_APP_URL ?? fallback).replace(/\/$/, "");
}
