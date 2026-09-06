/** Allow only bundled assets or objects inside the configured public CDN. */
export function isAllowedImageReference(value: unknown, storagePublicUrl?: string): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.includes("\\") && !value.includes("..") &&
      (value.startsWith("/images/") || value === "/placeholder.jpg" || value === "/placeholder-user.jpg");
  }
  if (!storagePublicUrl) return false;
  try {
    const url = new URL(value);
    const base = new URL(storagePublicUrl.endsWith("/") ? storagePublicUrl : `${storagePublicUrl}/`);
    return url.protocol === "https:" && url.origin === base.origin && url.pathname.startsWith(base.pathname) &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
