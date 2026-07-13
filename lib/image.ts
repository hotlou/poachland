/**
 * Prepare an uploaded image for storage and return an opaque string reference.
 *
 * Today that reference is an inline JPEG data URL. Photos are treated as
 * opaque strings the whole way through — stored as `text[]`, shipped in the
 * snapshot, rendered via `<img src>`, and inlined by the OG-image loaders
 * (which already accept both `data:` and `http(s):`). So the eventual move to
 * object storage (e.g. Vercel Blob) is a localized swap: change this function
 * to upload the file and return the blob URL; nothing downstream changes, and
 * the server-side per-photo size cap simply stops mattering for short URLs.
 * Call sites should prefer this wrapper over `fileToDataUrl` directly.
 */
export async function prepareImage(file: File, maxEdge = 800): Promise<string> {
  return fileToDataUrl(file, maxEdge);
}

/** Downscale an uploaded image to a small JPEG data URL (storage-friendly). */
export async function fileToDataUrl(file: File, maxEdge = 800): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
