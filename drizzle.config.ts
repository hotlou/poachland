import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/server/schema.ts",
  out: "./drizzle",
});
