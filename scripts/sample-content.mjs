#!/usr/bin/env node
// Defaults to a read-only manifest. Production writes need explicit flags.
import { parseArgs } from "node:util";
import { samplePlan, manageSampleBatch } from "../lib/server/sample-batches.ts";
import { SAMPLE_BATCH_ID } from "../lib/sample-content.ts";

const { values } = parseArgs({ options: {
  action: { type: "string", default: "preview" }, apply: { type: "boolean", default: false }, production: { type: "boolean", default: false },
  actor: { type: "string" }, confirm: { type: "string" }, days: { type: "string", default: "30" }, note: { type: "string" },
} });
if (values.action === "preview" || !values.apply) {
  console.log(JSON.stringify({ mode: "DRY RUN — no database changes", ...samplePlan() }, null, 2));
  process.exit(0);
}
if (!values.actor || !values.note || !["publish", "hide", "delete"].includes(values.action)) {
  console.error("Apply requires --action publish|hide|delete, --actor USERNAME, --note REASON, and --confirm 'ACTION samples_202609_v1'.");
  process.exit(1);
}
if (process.env.DATABASE_URL && !values.production) {
  console.error("Remote database writes require --production. Use PGLITE_PATH with no DATABASE_URL for local testing.");
  process.exit(1);
}
if (values.production && (!process.env.DATABASE_URL || new URL(process.env.NEXT_PUBLIC_APP_URL || "http://invalid").origin !== "https://poachland.com")) {
  console.error("Production requires DATABASE_URL and the canonical NEXT_PUBLIC_APP_URL=https://poachland.com from the authoritative Vercel project.");
  process.exit(1);
}
if (values.confirm !== `${values.action.toUpperCase()} ${SAMPLE_BATCH_ID}`) {
  console.error("Confirmation does not match the action and fixed batch version.");
  process.exit(1);
}
const { getDb } = await import("../lib/server/db.ts");
const { users } = await import("../lib/server/schema.ts");
const { eq } = await import("drizzle-orm");
const db = await getDb();
const [actor] = await db.select().from(users).where(eq(users.username, values.actor));
if (!actor?.isAdmin || actor.deletedAt || actor.status !== "active" || actor.sampleBatchId) {
  console.error("The named actor must be an active, real moderator.");
  process.exit(1);
}
const result = await manageSampleBatch(db, actor, { action: values.action, batchId: SAMPLE_BATCH_ID, confirm: values.confirm, days: Number(values.days), note: values.note });
console.log(JSON.stringify({ environment: values.production ? "production" : "local", batchId: SAMPLE_BATCH_ID, action: values.action, ...result }));
process.exit(result.ok ? 0 : 1);
