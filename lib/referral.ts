/**
 * Client-only referral capture. An invite link is `<origin>/?ref=<username>`.
 * We stash the ref on the landing/login pages and read it back when the new
 * trader finishes onboarding (it survives the magic-link round trip because
 * it's in localStorage on the same origin).
 */

const KEY = "poach.ref";

const clean = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);

/** If the URL carries `?ref=`, remember it. Safe to call in an effect. */
export function captureReferralFromUrl(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      const c = clean(ref);
      if (c) window.localStorage.setItem(KEY, c);
    }
  } catch {
    // storage blocked — no attribution, no harm
  }
}

/** Read the stored referral without clearing it. */
export function peekReferral(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

/** Read and clear the stored referral (call once at onboarding). */
export function consumeReferral(): string | undefined {
  try {
    const v = window.localStorage.getItem(KEY) || undefined;
    if (v) window.localStorage.removeItem(KEY);
    return v || undefined;
  } catch {
    return undefined;
  }
}
