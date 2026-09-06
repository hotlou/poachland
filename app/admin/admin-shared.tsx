import { toast } from "sonner";
import { dispatchOp } from "@/app/actions/engine";
import type { AdminData, OpMap, OpName } from "@/lib/shared/ops";
import type { RemotePoachStore } from "@/lib/remote-store";
import type { Report, UserStatus } from "@/lib/types";

export type AdminUser = AdminData["users"][number];

export async function runAdminOp<K extends OpName>(
  store: RemotePoachStore,
  reload: () => Promise<void>,
  op: K,
  payload: OpMap[K],
): Promise<boolean> {
  try {
    const result = await dispatchOp(op, payload);
    if (!result.ok) {
      toast.error(result.error);
      await store.refetch();
      return false;
    }
    await Promise.all([store.refetch(), reload()]);
    return true;
  } catch (error) {
    console.error(`[admin] ${op} failed`, error);
    toast.error("Couldn't reach the server. Try again.");
    return false;
  }
}

export function SectionHeading({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={15} className="text-accent" strokeWidth={2.5} />
      <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      {count !== undefined && count > 0 && <span className="badge-stamp border-accent text-accent">{count}</span>}
    </div>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

/** data: URLs are legacy-only and cannot be opened as top-level navigations. */
export async function openPhoto(src: string) {
  if (!src.startsWith("data:")) {
    window.open(src, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const blob = await (await fetch(src)).blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error("Couldn't open the photo");
  }
}

export const REPORT_STATUS_STAMP: Record<Report["status"], { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "text-amber-700 border-amber-700 dark:text-yellow-400 dark:border-yellow-400" },
  resolved: { label: "Resolved", cls: "text-emerald-700 border-emerald-700 dark:text-emerald-400 dark:border-emerald-400" },
  dismissed: { label: "Dismissed", cls: "text-muted-foreground border-border" },
};

export const USER_STATUS_CHIP: Record<Exclude<UserStatus, "active">, { label: string; cls: string }> = {
  shadowbanned: { label: "Shadowbanned", cls: "text-purple-700 border-purple-700/50 dark:text-purple-400 dark:border-purple-400/50" },
  suspended: { label: "Suspended", cls: "text-amber-700 border-amber-700/50 dark:text-yellow-400 dark:border-yellow-400/50" },
  banned: { label: "Banned", cls: "text-red-700 border-red-700/50 dark:text-red-400 dark:border-red-400/50" },
};
