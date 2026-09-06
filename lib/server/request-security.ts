import type { NextRequest } from "next/server";
import { canonicalOrigin } from "../env";

export function isTrustedMutationOrigin(
  originHeader: string | null,
  secFetchSite: string | null,
  expectedOrigin: string,
): boolean {
  if (secFetchSite === "cross-site") return false;
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

/** Explicit CSRF boundary for cookie-authenticated Route Handler mutations. */
export function hasTrustedMutationOrigin(request: NextRequest): boolean {
  const expected = canonicalOrigin(
    process.env.NODE_ENV === "production" ? "https://poachland.com" : request.nextUrl.origin,
  );
  return isTrustedMutationOrigin(
    request.headers.get("origin"),
    request.headers.get("sec-fetch-site"),
    expected,
  );
}
