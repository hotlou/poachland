import { NextRequest, NextResponse } from "next/server";
import { readSessionContext } from "@/lib/server/session";
import { createSignedImageUpload } from "@/lib/server/storage";
import { logError } from "@/lib/server/logger";
import { hasTrustedMutationOrigin } from "@/lib/server/request-security";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "JSON required" }, { status: 415 });
  }
  const context = await readSessionContext();
  if (!context || context.realUser.id !== context.effectiveUser.id) return NextResponse.json({ error: "Sign in to upload" }, { status: 401 });
  try {
    const body = await request.json() as { contentType?: unknown; byteSize?: unknown };
    const result = await createSignedImageUpload(context.realUser.id, String(body.contentType ?? ""), Number(body.byteSize));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("upload.sign.failed", error, { userId: context.realUser.id });
    const message = error instanceof Error ? error.message : "Upload unavailable";
    return NextResponse.json({ error: message }, { status: message === "Object storage is not configured" ? 503 : 400 });
  }
}
