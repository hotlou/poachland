import type { IdentityProvider } from "./types";

export const IDENTITY_PROVIDERS: readonly IdentityProvider[] = [
  "instagram",
  "facebook",
  "usau",
  "other",
];

const PROVIDER_HOSTS: Partial<Record<IdentityProvider, readonly string[]>> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com"],
  usau: ["usaultimate.org", "www.usaultimate.org", "play.usaultimate.org"],
};
const UNSAFE_IDENTITY_TEXT = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export type IdentityValidation =
  | { ok: true; handle: string; url?: string }
  | { ok: false; error: string };

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost") ||
    /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname) || hostname === "::1";
}

export function validateIdentityClaim(
  provider: IdentityProvider,
  handle: unknown,
  url?: unknown,
): IdentityValidation {
  if (!IDENTITY_PROVIDERS.includes(provider)) return { ok: false, error: "Invalid provider" };
  const cleanHandle = String(handle ?? "").normalize("NFKC").trim().replace(/^@+/, "");
  if (!cleanHandle) return { ok: false, error: "Enter a handle" };
  if (cleanHandle.length > 80) return { ok: false, error: "Handle is too long (80 characters max)" };
  if (UNSAFE_IDENTITY_TEXT.test(cleanHandle))
    return { ok: false, error: "Handle contains unsupported control characters" };

  const rawUrl = String(url ?? "").trim();
  if (!rawUrl) return { ok: true, handle: cleanHandle };
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Enter a valid identity link" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "Identity links must use HTTPS" };
  if (parsed.username || parsed.password || isLocalHostname(parsed.hostname))
    return { ok: false, error: "Enter a public identity link" };
  const hosts = PROVIDER_HOSTS[provider];
  if (hosts && !hosts.includes(parsed.hostname.toLowerCase()))
    return { ok: false, error: `Link must use an official ${provider} domain` };
  if ((provider === "instagram" || provider === "facebook") &&
      decodeURIComponent(parsed.pathname.split("/").filter(Boolean)[0] ?? "").replace(/^@+/, "").toLowerCase() !== cleanHandle.toLowerCase())
    return { ok: false, error: "Link profile must match the submitted handle" };
  parsed.hash = "";
  return { ok: true, handle: cleanHandle, url: parsed.toString() };
}

export function validateIdentityReviewNote(note: unknown):
  | { ok: true; note: string }
  | { ok: false; error: string } {
  const cleanNote = String(note ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (cleanNote.length < 20)
    return { ok: false, error: "Describe the identity decision in at least 20 characters" };
  if (cleanNote.length > 2_000)
    return { ok: false, error: "Identity review note is capped at 2,000 characters" };
  if (UNSAFE_IDENTITY_TEXT.test(cleanNote))
    return { ok: false, error: "Identity review note contains unsupported control characters" };
  return { ok: true, note: cleanNote };
}
