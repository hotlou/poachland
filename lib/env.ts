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
  STORAGE_ENDPOINT: optionalUrl,
  STORAGE_REGION: z.string().min(1).default("auto"),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_PUBLIC_URL: optionalUrl,
  ADMIN_EMAILS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  SEED_DEMO: z.enum(["yes", "no"]).optional(),
  VERCEL: z.enum(["1"]).optional(),
}).superRefine((environment, context) => {
  if (environment.NODE_ENV !== "production") return;
  for (const key of [
    "DATABASE_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "AUTH_SECRET",
    "CRON_SECRET",
    "STORAGE_ENDPOINT",
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
    "STORAGE_PUBLIC_URL",
    "NEXT_PUBLIC_APP_URL",
  ] as const) {
    if (!environment[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
  }
  if (environment.NEXT_PUBLIC_APP_URL && !environment.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
    context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_APP_URL"], message: "NEXT_PUBLIC_APP_URL must use HTTPS in production" });
  }
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

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
