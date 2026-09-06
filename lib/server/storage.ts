import "server-only";

import { randomBytes } from "node:crypto";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { getDb, type Db } from "./db";
import { objectUploads } from "./schema";
import { isAllowedImageReference } from "../image-reference";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function config() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  const publicUrl = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, "");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error("Object storage is not configured");
  }
  return { endpoint, bucket, publicUrl, client: new S3Client({ endpoint, region: process.env.STORAGE_REGION ?? "auto", credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true }) };
}

export function validImageReference(value: unknown): value is string {
  return isAllowedImageReference(value, process.env.STORAGE_PUBLIC_URL);
}

export async function createSignedImageUpload(userId: string, contentType: string, byteSize: number) {
  if (!ALLOWED_TYPES.has(contentType)) throw new Error("Unsupported image type");
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_UPLOAD_BYTES) throw new Error("Image must be 8 MB or smaller");
  const { client, bucket, publicUrl } = config();
  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const id = `upl_${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
  const objectKey = `users/${userId}/${new Date().toISOString().slice(0, 10)}/${id}.${ext}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType, ContentLength: byteSize, CacheControl: "public, max-age=31536000, immutable" });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const imageUrl = `${publicUrl}/${objectKey}`;
  const db = await getDb();
  await db.insert(objectUploads).values({ id, ownerUserId: userId, objectKey, publicUrl: imageUrl, contentType, byteSize });
  return { uploadUrl, imageUrl, expiresIn: 300 };
}

export async function claimImageUploads(db: Db, userId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await db.update(objectUploads).set({ claimedAt: new Date() }).where(and(eq(objectUploads.ownerUserId, userId), inArray(objectUploads.publicUrl, urls), isNull(objectUploads.deletedAt)));
}

export async function cleanupAbandonedUploads(limit = 100): Promise<number> {
  const db = await getDb();
  const stale = await db.select().from(objectUploads).where(and(isNull(objectUploads.claimedAt), isNull(objectUploads.deletedAt), lt(objectUploads.createdAt, new Date(Date.now() - 24 * 60 * 60_000)))).limit(limit);
  if (stale.length === 0) return 0;
  const { client, bucket } = config();
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: stale.map(({ objectKey }) => ({ Key: objectKey })), Quiet: true } }));
  await db.update(objectUploads).set({ deletedAt: new Date() }).where(inArray(objectUploads.id, stale.map(({ id }) => id)));
  return stale.length;
}
