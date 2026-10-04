import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function instagramConnection() {
  const missing = ["INSTAGRAM_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_API_VERSION"].filter((key) => !process.env[key]?.trim());
  if (process.env.INSTAGRAM_API_VERSION && !/^v\d+\.0$/.test(process.env.INSTAGRAM_API_VERSION)) missing.push("valid INSTAGRAM_API_VERSION");
  if (process.env.INSTAGRAM_ACCOUNT_ID && !/^\d+$/.test(process.env.INSTAGRAM_ACCOUNT_ID)) missing.push("valid INSTAGRAM_ACCOUNT_ID");
  const handle = process.env.INSTAGRAM_HANDLE?.replace(/^@/, "");
  return { configured: missing.length === 0, missing, handle: handle && /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? handle : null };
}

/** Tokens are sent in headers only and remote error bodies never enter logs/UI. */
async function graph(path: string, method: "GET" | "POST", fields: Record<string, string>) {
  if (!instagramConnection().configured) throw new Error("Instagram publishing credentials are not configured.");
  const url = new URL(`https://graph.instagram.com/${process.env.INSTAGRAM_API_VERSION}/${path}`);
  if (method === "GET") for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method, headers: { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(12000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Instagram API request failed (${response.status}). Check the account token and permissions.`); }
  return await response.json() as { id?: string; status_code?: string; permalink?: string };
}

export async function createInstagramContainer(imageUrl: string, caption: string) {
  const result = await graph(`${process.env.INSTAGRAM_ACCOUNT_ID}/media`, "POST", { image_url: imageUrl, caption });
  if (!result.id || !/^\d+$/.test(result.id)) throw new Error("Instagram did not return a container ID.");
  return result.id;
}
export async function instagramContainerStatus(id: string) {
  if (!/^\d+$/.test(id)) throw new Error("Invalid container ID.");
  return (await graph(id, "GET", { fields: "status_code" })).status_code;
}
export async function publishInstagramContainer(id: string) {
  const result = await graph(`${process.env.INSTAGRAM_ACCOUNT_ID}/media_publish`, "POST", { creation_id: id });
  if (!result.id || !/^\d+$/.test(result.id)) throw new Error("Instagram publication outcome is unknown.");
  return result.id;
}
export function validInstagramSignature(raw: Buffer, signature: string | null, secret = process.env.INSTAGRAM_APP_SECRET) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature.slice(7), "hex"));
}

export function instagramMessages(payload: unknown, ownerId = process.env.INSTAGRAM_ACCOUNT_ID) {
  const results: { externalSenderId: string; messageId: string; text: string }[] = [];
  if (!ownerId || !payload || typeof payload !== "object") return results;
  const body = payload as { object?: string; entry?: unknown[] };
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return results;
  for (const entry of body.entry.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { id?: string; messaging?: unknown[] };
    if (row.id !== ownerId || !Array.isArray(row.messaging)) continue;
    for (const event of row.messaging.slice(0, 100)) {
      if (!event || typeof event !== "object") continue;
      const m = event as { sender?: { id?: string }; recipient?: { id?: string }; message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean } };
      if (m.recipient?.id !== ownerId || m.sender?.id === ownerId || m.message?.is_echo || m.message?.is_deleted) continue;
      if (typeof m.sender?.id !== "string" || !/^\d{1,40}$/.test(m.sender.id) || typeof m.message?.mid !== "string" || m.message.mid.length > 500 || typeof m.message.text !== "string" || m.message.text.length > 2000) continue;
      results.push({ externalSenderId: m.sender.id, messageId: m.message.mid, text: m.message.text });
      if (results.length === 100) return results;
    }
  }
  return results;
}
