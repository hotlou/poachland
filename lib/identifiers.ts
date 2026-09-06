export function sanitizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9_.-]/g, "");
}

export function sanitizeSlug(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
