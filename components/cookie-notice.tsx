"use client";

/**
 * A one-time, non-blocking cookie courtesy notice. Poachland only sets an
 * essential sign-in cookie + a theme preference and uses cookieless analytics,
 * so no consent gate is required — this is a quiet heads-up, dismissed for good
 * on the first tap. Sits above the mobile bottom nav inside /app.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "poachland.cookie-notice.v1";

export function CookieNotice() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      // storage blocked — skip the notice rather than nag every load
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  const inApp = pathname?.startsWith("/app");

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className={cn(
        "fixed inset-x-0 z-[60] flex justify-center px-3 pointer-events-none",
        inApp ? "bottom-20 md:bottom-3" : "bottom-3",
      )}
    >
      <div className="pointer-events-auto flex items-center gap-3 max-w-md w-full rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg px-4 py-2.5">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
          We use only essential cookies to keep you signed in — no ad tracking.{" "}
          <Link href="/privacy" className="text-accent font-semibold hover:underline">
            Privacy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-semibold text-accent whitespace-nowrap px-2.5 py-1 rounded-full hover:bg-accent/10 transition-colors"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss cookie notice"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
