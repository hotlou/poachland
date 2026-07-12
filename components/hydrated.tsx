"use client";

import { useHydrated } from "@/lib/store-context";

/**
 * Renders children only after client mount. Store-driven pages wrap their
 * dynamic content in this so server HTML (seed data) never mismatches the
 * browser's persisted state.
 */
export function Hydrated({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const hydrated = useHydrated();
  return <>{hydrated ? children : fallback}</>;
}
