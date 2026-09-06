/** Allow only bundled assets or objects in the project's public Vercel Blob store. */
export function isAllowedImageReference(value: unknown, blobStoreId?: string): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.includes("\\") && !value.includes("..") &&
      (value.startsWith("/images/") || value === "/placeholder.jpg" || value === "/placeholder-user.jpg");
  }
  if (!blobStoreId || !/^store_[A-Za-z0-9]+$/.test(blobStoreId)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === `${blobStoreId}.public.blob.vercel-storage.com` &&
      url.pathname.startsWith("/uploads/") &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
