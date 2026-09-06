/**
 * Prepare an uploaded image for storage and return an opaque string reference.
 *
 * The browser downsizes and re-encodes the image, requests a short-lived
 * signed object-storage URL, uploads directly to that URL, and returns only
 * the stable CDN reference. Binary image data never enters an app mutation or
 * primary database row.
 */
export async function prepareImage(file: File, maxEdge = 800): Promise<string> {
  return uploadImage(file, maxEdge);
}

/** Downscale and upload an image directly to object storage. */
export async function uploadImage(file: File, maxEdge = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image encoding failed")), "image/jpeg", 0.82),
  );
  bitmap.close();
  const signed = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: blob.type, byteSize: blob.size }),
  });
  const payload = await signed.json() as { uploadUrl?: string; imageUrl?: string; error?: string };
  if (!signed.ok || !payload.uploadUrl || !payload.imageUrl) throw new Error(payload.error ?? "Upload unavailable");
  const uploaded = await fetch(payload.uploadUrl, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
  if (!uploaded.ok) throw new Error("Object storage rejected the upload");
  return payload.imageUrl;
}
