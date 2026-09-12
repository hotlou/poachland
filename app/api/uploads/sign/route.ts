import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { readSessionContext } from "@/lib/server/session";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  recordCompletedBlobUpload,
  validateBlobUploadRequest,
  verifyAndRecordBlobUpload,
} from "@/lib/server/storage";
import { logError } from "@/lib/server/logger";
import { hasTrustedMutationOrigin } from "@/lib/server/request-security";

type UploadMetadata = { userId: string; id: string; pathname: string; contentType: string; byteSize: number };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HandleUploadPresignedBody | { type: "poachland.upload-completed"; url?: unknown };
    if (body.type === "poachland.upload-completed") {
      if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
      const context = await readSessionContext();
      if (!context || context.effectiveUser.status !== "active" || (context.realUser.id !== context.effectiveUser.id && (!context.realUser.isAdmin || context.realUser.status !== "active"))) return NextResponse.json({ error: "Sign in to upload" }, { status: 401 });
      const imageUrl = await verifyAndRecordBlobUpload(context.effectiveUser.id, String(body.url ?? ""));
      return NextResponse.json({ imageUrl }, { headers: { "Cache-Control": "no-store" } });
    }

    const result = await handleUploadPresigned({
      request,
      body,
      getSignedToken: async (pathname, clientPayload) => {
        if (!hasTrustedMutationOrigin(request)) throw new Error("Untrusted request origin");
        const context = await readSessionContext();
        if (!context || context.effectiveUser.status !== "active" || (context.realUser.id !== context.effectiveUser.id && (!context.realUser.isAdmin || context.realUser.status !== "active"))) throw new Error("Sign in to upload");
        const input = JSON.parse(clientPayload ?? "null") as { contentType?: unknown; byteSize?: unknown } | null;
        if (!input) throw new Error("Upload metadata required");
        const declared = validateBlobUploadRequest(pathname, input.contentType, input.byteSize);
        const metadata: UploadMetadata = { userId: context.effectiveUser.id, pathname, ...declared };
        return {
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            validUntil: Date.now() + 5 * 60_000,
          }),
          urlOptions: {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: false,
            cacheControlMaxAge: 31_536_000,
            tokenPayload: JSON.stringify(metadata),
          },
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const metadata = JSON.parse(tokenPayload ?? "null") as UploadMetadata | null;
        if (!metadata) throw new Error("Upload completion metadata missing");
        await recordCompletedBlobUpload(metadata.userId, metadata, blob);
      },
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("upload.blob.failed", error);
    const message = error instanceof Error ? error.message : "Upload unavailable";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
