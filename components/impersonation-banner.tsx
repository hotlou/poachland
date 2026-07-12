"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { stopUsingAs } from "@/app/actions/auth";
import { useStore } from "@/lib/store-context";

/**
 * Shown while an admin is viewing the app "as" another user. A loud, full-width
 * bar at the very top of the layout so the moderator always knows whose view
 * they're in — and can bail back to the mod desk in one tap, even from a gated
 * (suspended/banned) screen.
 */
export function ImpersonationBanner() {
  const store = useStore();
  const me = store.sessionMe;
  const [exiting, setExiting] = useState(false);

  if (!me?.impersonatedByAdmin) return null;

  const exit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await stopUsingAs();
    } finally {
      // Full navigation: re-bootstraps the store as the admin again.
      window.location.assign("/admin");
    }
  };

  return (
    <div className="w-full bg-amber-500 text-amber-950">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <AlertTriangle size={16} className="shrink-0" strokeWidth={2.5} />
        <p className="min-w-0 flex-1 font-medium truncate">
          Viewing as{" "}
          <span className="font-bold">@{me.username}</span>
          <span className="font-normal">
            {" "}
            — moderator @{me.impersonatedByAdmin}
          </span>
        </p>
        <button
          type="button"
          onClick={() => void exit()}
          disabled={exiting}
          className="shrink-0 inline-flex items-center rounded-full bg-amber-950 text-amber-50 px-3.5 py-1 text-xs font-bold hover:bg-amber-950/90 transition-colors disabled:opacity-60"
        >
          {exiting ? "Exiting…" : "Exit"}
        </button>
      </div>
    </div>
  );
}
