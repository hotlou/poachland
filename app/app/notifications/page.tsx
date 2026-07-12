"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  Award,
  Bell,
  CheckCheck,
  Gift,
  HandCoins,
  Handshake,
  Info,
  MessageSquare,
  Package,
  PartyPopper,
  RefreshCw,
  Star,
  Target,
  X,
} from "lucide-react";
import { Hydrated } from "@/components/hydrated";
import { useStore } from "@/lib/store-context";
import type { Notification, NotificationType } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_ICONS: Record<
  NotificationType,
  { icon: React.ElementType; className: string }
> = {
  trade_proposal: { icon: ArrowRightLeft, className: "text-accent bg-accent/10" },
  buy_offer: {
    icon: HandCoins,
    className: "text-sky-700 bg-sky-600/10 dark:text-sky-400 dark:bg-sky-400/10",
  },
  claim_request: {
    icon: Gift,
    className: "text-pink-700 bg-pink-600/10 dark:text-pink-400 dark:bg-pink-400/10",
  },
  offer_accepted: { icon: Handshake, className: "text-accent bg-accent/10" },
  offer_rejected: {
    icon: X,
    className: "text-red-700 bg-red-600/10 dark:text-red-400 dark:bg-red-400/10",
  },
  offer_withdrawn: { icon: X, className: "text-muted-foreground bg-surface" },
  offer_countered: {
    icon: RefreshCw,
    className: "text-amber-700 bg-amber-600/10 dark:text-yellow-400 dark:bg-yellow-400/10",
  },
  shipped: {
    icon: Package,
    className: "text-sky-700 bg-sky-600/10 dark:text-sky-400 dark:bg-sky-400/10",
  },
  deal_complete: {
    icon: PartyPopper,
    className:
      "text-emerald-700 bg-emerald-600/10 dark:text-emerald-400 dark:bg-emerald-400/10",
  },
  iso_match: {
    icon: Target,
    className:
      "text-purple-700 bg-purple-600/10 dark:text-purple-400 dark:bg-purple-400/10",
  },
  new_message: {
    icon: MessageSquare,
    className: "text-sky-700 bg-sky-600/10 dark:text-sky-400 dark:bg-sky-400/10",
  },
  new_rating: {
    icon: Star,
    className: "text-amber-700 bg-amber-600/10 dark:text-yellow-400 dark:bg-yellow-400/10",
  },
  badge_earned: {
    icon: Award,
    className:
      "text-orange-700 bg-orange-600/10 dark:text-orange-400 dark:bg-orange-400/10",
  },
  deal_cancelled: {
    icon: AlertTriangle,
    className:
      "text-orange-700 bg-orange-600/10 dark:text-orange-400 dark:bg-orange-400/10",
  },
  deal_disputed: {
    icon: AlertTriangle,
    className: "text-red-700 bg-red-600/10 dark:text-red-400 dark:bg-red-400/10",
  },
  listing_removed: { icon: Info, className: "text-muted-foreground bg-surface" },
  system: { icon: Info, className: "text-muted-foreground bg-surface" },
};

type GroupKey = "Today" | "This week" | "Earlier";

function groupNotifications(notifications: Notification[]): [GroupKey, Notification[]][] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekAgoMs = todayMs - 6 * 86_400_000;

  const groups: Record<GroupKey, Notification[]> = {
    Today: [],
    "This week": [],
    Earlier: [],
  };
  for (const n of notifications) {
    const t = new Date(n.createdAt).getTime();
    if (t >= todayMs) groups.Today.push(n);
    else if (t >= weekAgoMs) groups["This week"].push(n);
    else groups.Earlier.push(n);
  }
  return (Object.keys(groups) as GroupKey[])
    .filter((k) => groups[k].length > 0)
    .map((k) => [k, groups[k]]);
}

function NotificationRow({ n }: { n: Notification }) {
  const store = useStore();
  const router = useRouter();
  const { icon: Icon, className } = TYPE_ICONS[n.type] ?? TYPE_ICONS.system;

  const handleClick = () => {
    store.markNotificationRead(n.id);
    if (n.linkTo) router.push(n.linkTo);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 flex gap-3 items-start transition-colors border-l-2 hover:bg-surface/60",
        n.read ? "border-transparent" : "border-accent bg-accent/5",
      )}
    >
      <span
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
          className,
        )}
      >
        <Icon size={15} strokeWidth={2.25} />
      </span>
      <span className="flex-1 min-w-0 block">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-sm font-semibold leading-snug",
              n.read ? "text-foreground/80" : "text-foreground",
            )}
          >
            {n.title}
          </span>
          {!n.read && (
            <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" aria-label="Unread" />
          )}
        </span>
        <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
          {n.body}
        </span>
        <span className="block text-[11px] text-muted-foreground/70 mt-1">
          {timeAgo(n.createdAt)}
        </span>
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-4 md:mx-6 mt-4 bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-3 items-start">
          <div className="w-9 h-9 rounded-full bg-surface animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/5 bg-surface rounded-sm animate-pulse" />
            <div className="h-2.5 w-4/5 bg-surface rounded-sm animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const store = useStore();
  const notifications = store.listNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const groups = groupNotifications(notifications);

  const markAllRead = () => {
    store.markAllNotificationsRead();
    toast.success("All caught up.");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-display font-bold text-xl tracking-tight">
            Notifications
          </h1>
          <Hydrated fallback={null}>
            {unreadCount > 0 && (
              <span className="bg-accent text-accent-foreground text-[11px] font-bold min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </Hydrated>
        </div>
        <Hydrated fallback={null}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors flex-shrink-0"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </Hydrated>
      </header>

      <Hydrated fallback={<ListSkeleton />}>
        {notifications.length === 0 ? (
          <div className="text-center py-20 px-6">
            <Bell size={28} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-display font-bold text-xl text-muted-foreground mb-1">
              All quiet.
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              Go make some noise on the board.
            </p>
            <Link
              href="/app/browse"
              className="inline-block bg-accent text-accent-foreground px-5 py-2 rounded-full text-sm font-semibold"
            >
              Browse the market
            </Link>
          </div>
        ) : (
          <div className="pb-6">
            {groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="px-4 md:px-6 pt-5 pb-2 text-[11px] font-display font-bold uppercase tracking-widest text-muted-foreground">
                  {label}
                </h2>
                <div className="mx-4 md:mx-6 bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {items.map((n) => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Hydrated>
    </div>
  );
}
