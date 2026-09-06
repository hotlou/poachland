import "server-only";

import { del, head } from "@vercel/blob";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { getDb, type Db } from "./db";
import { objectUploads } from "./schema";
import { isAllowedImageReference } from "../image-reference";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const BLOB_PATH_PATTERN = /^uploads\/(upl_[a-f0-9]{32})\.(?:jpg|png|webp|avif)$/;

export function validImageReference(value: unknown): value is string {
  return isAllowedImageReference(value, process.env.BLOB_STORE_ID);
}

export function validateBlobUploadRequest(pathname: string, contentType: unknown, byteSize: unknown) {
  const match = BLOB_PATH_PATTERN.exec(pathname);
  if (!match) throw new Error("Invalid upload path");
  if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number]))
    throw new Error("Unsupported image type");
  if (typeof byteSize !== "number" || !Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_UPLOAD_BYTES)
    throw new Error("Image must be 8 MB or smaller");
  return { id: match[1], contentType: contentType as string, byteSize };
}

export async function recordCompletedBlobUpload(
  ownerUserId: string,
  declared: { id: string; pathname: string; contentType: string; byteSize: number },
  blob: { url: string; pathname: string; contentType?: string },
) {
  if (blob.pathname !== declared.pathname || !isAllowedImageReference(blob.url, process.env.BLOB_STORE_ID))
    throw new Error("Blob completion did not match its upload grant");
  const db = await getDb();
  await db.insert(objectUploads).values({
    id: declared.id,
    ownerUserId,
    objectKey: declared.pathname,
    publicUrl: blob.url,
    contentType: blob.contentType || declared.contentType,
    byteSize: declared.byteSize,
  }).onConflictDoNothing({ target: objectUploads.id });
}

/** Verify a client-reported completion against Blob before making it claimable. */
export async function verifyAndRecordBlobUpload(ownerUserId: string, url: string) {
  if (!isAllowedImageReference(url, process.env.BLOB_STORE_ID)) throw new Error("Invalid Blob URL");
  const blob = await head(url);
  const declared = validateBlobUploadRequest(blob.pathname, blob.contentType, blob.size);
  await recordCompletedBlobUpload(ownerUserId, { ...declared, pathname: blob.pathname }, blob);
  return blob.url;
}

export async function claimImageUploads(db: Db, userId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await db.update(objectUploads).set({ claimedAt: new Date() }).where(and(eq(objectUploads.ownerUserId, userId), inArray(objectUploads.publicUrl, urls), isNull(objectUploads.deletedAt)));
}

export async function cleanupAbandonedUploads(limit = 100): Promise<number> {
  const db = await getDb();
  const stale = await db.select().from(objectUploads).where(and(isNull(objectUploads.claimedAt), isNull(objectUploads.deletedAt), lt(objectUploads.createdAt, new Date(Date.now() - 24 * 60 * 60_000)))).limit(limit);
  if (stale.length === 0) return 0;
  await del(stale.map(({ publicUrl }) => publicUrl));
  await db.update(objectUploads).set({ deletedAt: new Date() }).where(inArray(objectUploads.id, stale.map(({ id }) => id)));
  return stale.length;
}
