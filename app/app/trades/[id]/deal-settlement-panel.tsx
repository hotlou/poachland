"use client";

import Link from "next/link";
import {
  Bitcoin,
  CircleDollarSign,
  Copy,
  DollarSign,
  Landmark,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store-context";
import type { PaymentKind, User } from "@/lib/types";

const PAYMENT_KIND_META: Record<PaymentKind, { label: string; icon: React.ElementType }> = {
  venmo: { label: "Venmo", icon: Smartphone },
  paypal: { label: "PayPal", icon: CircleDollarSign },
  cashapp: { label: "Cash App", icon: DollarSign },
  zelle: { label: "Zelle", icon: Landmark },
  crypto: { label: "Crypto", icon: Bitcoin },
  other: { label: "Other", icon: Wallet },
};

function truncateMiddle(value: string, max = 24): string {
  if (value.length <= max) return value;
  return `${value.slice(0, 12)}…${value.slice(-9)}`;
}

export function SettleUpBlock({ other }: { other: User }) {
  const store = useStore();
  const theirs = store.paymentMethodsFor(other.id);
  const mine = store.myPaymentMethods();

  const copy = (value: string) => {
    if (!navigator.clipboard) {
      toast.error("Couldn't copy — grab it by hand");
      return;
    }
    navigator.clipboard.writeText(value).then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy — grab it by hand"),
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={16} className="text-accent" />
        <h3 className="font-display font-bold text-sm text-foreground">Settle up</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Cash is part of this deal — here&apos;s how @{other.username} gets paid.
      </p>

      {theirs.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-surface border border-border rounded-lg px-3 py-2.5">
          @{other.username} hasn&apos;t added payment handles yet — ask in the chat.
        </p>
      ) : (
        <div className="space-y-1.5">
          {theirs.map((method) => {
            const meta = PAYMENT_KIND_META[method.kind];
            const Icon = meta.icon;
            return (
              <div
                key={method.id}
                className="flex items-center gap-2 bg-surface border border-border rounded-lg pl-2 pr-1 py-1.5"
              >
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground flex-shrink-0">
                  <Icon size={11} /> {meta.label}
                  {method.label ? ` · ${method.label}` : ""}
                </span>
                <span className="flex-1 min-w-0 font-mono text-[13px] text-foreground truncate" title={method.value}>
                  {truncateMiddle(method.value)}
                </span>
                <button
                  type="button"
                  onClick={() => copy(method.value)}
                  aria-label={`Copy ${meta.label} handle`}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-accent transition-colors"
                >
                  <Copy size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-2.5">
        {mine.length > 0 ? (
          <>Your {mine.length === 1 ? "handle is" : "handles are"} visible to @{other.username} for this deal too.</>
        ) : (
          <>
            @{other.username} can&apos;t see any handles for you yet —{" "}
            <Link href="/app/settings" className="text-accent font-semibold hover:underline">Add yours</Link>.
          </>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground/70 mt-1">
        Settle directly. Poachland does not process payments, hold escrow, or guarantee refunds.{" "}
        <Link href="/buyer-protection" className="underline underline-offset-2 hover:text-accent">
          Review deal safety
        </Link>.
      </p>
    </div>
  );
}
