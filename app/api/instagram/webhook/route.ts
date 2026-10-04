import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { instagramMessages, validInstagramSignature } from "@/lib/server/instagram";
import { receiveInstagramDm } from "@/lib/server/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const LIMIT = 256 * 1024;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  const received = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";
  if (!expected || params.get("hub.mode") !== "subscribe" || !challenge || challenge.length > 200 || Buffer.byteLength(expected) !== Buffer.byteLength(received) || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!process.env.INSTAGRAM_APP_SECRET || !process.env.INSTAGRAM_ACCOUNT_ID) return new Response("Not configured", { status: 503 });
  if (Number(request.headers.get("content-length")) > LIMIT || !request.body) return new Response("Payload too large", { status: 413 });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMIT) { await reader.cancel(); return new Response("Payload too large", { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  if (!validInstagramSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("Forbidden", { status: 403 });
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); } catch { return new Response("Invalid JSON", { status: 400 }); }
  try {
    const messages = instagramMessages(body);
    if (messages.length) {
      const db = await getDb();
      // receiveInstagramDm atomically consumes each message ID and challenge once.
      for (const message of messages) await receiveInstagramDm(db, message);
    }
    return new Response("EVENT_RECEIVED", { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Retry a failed transaction; do not acknowledge work that was not persisted.
    return new Response("Temporarily unavailable", { status: 503 });
  }
}
