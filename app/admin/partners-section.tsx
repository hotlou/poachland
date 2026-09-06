"use client";

import { useRef, useState } from "react";
import { ExternalLink, Handshake, ImagePlus, Megaphone, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { uploadImage } from "@/lib/image";
import type { Partner, PartnerCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyRow, SectionHeading } from "./admin-shared";

/* ── 7. Partners (sponsors & vendors) ────────────────────────────────────── */

const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  jerseys: "Jerseys",
  discs: "Discs",
  apparel: "Apparel",
  cleats: "Cleats",
  accessories: "Accessories",
  media: "Media",
  other: "Other",
};

const PARTNER_CATEGORIES = Object.keys(PARTNER_CATEGORY_LABELS) as PartnerCategory[];

const PARTNER_KIND_META: Record<Partner["kind"], { label: string; icon: React.ElementType }> = {
  sponsor: { label: "Sponsor", icon: Megaphone },
  vendor: { label: "Vendor", icon: Store },
};

type PartnerForm = {
  id?: string;
  kind: Partner["kind"];
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logo: string;
  url: string;
  category: PartnerCategory;
  featured: boolean;
  active: boolean;
};

const EMPTY_PARTNER_FORM: PartnerForm = {
  kind: "sponsor",
  name: "",
  slug: "",
  tagline: "",
  description: "",
  logo: "",
  url: "",
  category: "other",
  featured: false,
  active: true,
};

/** Square logo tile — the partner's mark, or an initial fallback when none. */
function PartnerLogo({ logo, name, size = 40 }: { logo: string; name: string; size?: number }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={`${name || "Partner"} logo`}
        className="rounded-lg object-contain bg-surface border border-border shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 font-display font-bold text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function PartnerKindBadge({ kind }: { kind: Partner["kind"] }) {
  const meta = PARTNER_KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className="badge-stamp shrink-0 inline-flex items-center gap-1 text-accent border-accent">
      <Icon size={10} strokeWidth={2.5} /> {meta.label}
    </span>
  );
}

export function PartnersSection({
  partners,
  onChanged,
}: {
  partners: Partner[];
  onChanged: () => Promise<void>;
}) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PartnerForm | null>(null); // null → form closed
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Partner | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const editing = !!form?.id;

  const openAdd = () => setForm({ ...EMPTY_PARTNER_FORM });
  const openEdit = (p: Partner) =>
    setForm({
      id: p.id,
      kind: p.kind,
      name: p.name,
      slug: p.slug,
      tagline: p.tagline,
      description: p.description,
      logo: p.logo,
      url: p.url,
      category: p.category,
      featured: p.featured,
      active: p.active,
    });

  const patch = (v: Partial<PartnerForm>) => setForm((f) => (f ? { ...f, ...v } : f));

  const pickLogo = async (file: File) => {
    try {
      patch({ logo: await uploadImage(file, 400) });
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  const submit = async () => {
    if (!form || busy) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Give the partner a name");
      return;
    }
    setBusy(true);
    const res = store.upsertPartner({
      id: form.id,
      kind: form.kind,
      name,
      slug: form.slug.trim() || undefined,
      tagline: form.tagline.trim() || undefined,
      description: form.description.trim() || undefined,
      logo: form.logo || undefined,
      url: form.url.trim() || undefined,
      category: form.category,
      featured: form.featured,
      active: form.active,
    });
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    await onChanged();
    setBusy(false);
    toast.success(editing ? `${res.value.name} updated` : `${res.value.name} added`);
    setForm(null);
  };

  const confirmRemove = async () => {
    if (!removeTarget || removeBusy) return;
    setRemoveBusy(true);
    const res = store.removePartner(removeTarget.id);
    if (!res.ok) {
      setRemoveBusy(false);
      toast.error(res.error);
      return;
    }
    await onChanged();
    setRemoveBusy(false);
    toast.success(`${removeTarget.name} removed`);
    setRemoveTarget(null);
  };

  const fieldLabel = "text-xs font-medium text-muted-foreground";

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <SectionHeading icon={Handshake} title="Partners" count={partners.length} />
        <Button
          size="sm"
          variant={form ? "outline" : "default"}
          className={cn(
            "rounded-full mb-3 shrink-0",
            !form && "bg-accent text-accent-foreground hover:bg-accent/90",
          )}
          onClick={() => (form ? setForm(null) : openAdd())}
        >
          {form ? "Close" : (
            <>
              <Plus size={15} /> Add partner
            </>
          )}
        </Button>
      </div>

      {/* Add / edit form */}
      {form && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3.5 mb-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold tracking-tight text-sm text-foreground">
              {editing ? "Edit partner" : "New partner"}
            </p>
            {/* Kind — segmented sponsor / vendor toggle */}
            <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
              {(Object.keys(PARTNER_KIND_META) as Partner["kind"][]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ kind: k })}
                  className={cn(
                    "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                    form.kind === k
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PARTNER_KIND_META[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <PartnerLogo logo={form.logo} name={form.name} size={56} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={14} /> {form.logo ? "Replace logo" : "Upload logo"}
              </Button>
              {form.logo && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                  onClick={() => patch({ logo: "" })}
                >
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pickLogo(file);
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Name</span>
              <Input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. VC Ultimate"
                className="mt-1 bg-surface"
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Slug</span>
              <Input
                value={form.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder="Auto-derived from name if blank"
                className="mt-1 bg-surface"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Used at /vendors/&lt;slug&gt;. Leave blank to auto-generate.
              </span>
            </label>
          </div>

          <label className="block">
            <span className={fieldLabel}>Tagline</span>
            <Input
              value={form.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Short one-liner shown under the name"
              className="mt-1 bg-surface"
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>Description</span>
            <Textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="A sentence or two about the partner."
              rows={3}
              className="mt-1 bg-surface resize-none"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>External URL</span>
              <Input
                type="url"
                value={form.url}
                onChange={(e) => patch({ url: e.target.value })}
                placeholder="https://…"
                className="mt-1 bg-surface"
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Category</span>
              <select
                value={form.category}
                onChange={(e) => patch({ category: e.target.value as PartnerCategory })}
                className="mt-1 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {PARTNER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PARTNER_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => patch({ featured: v })}
                className="data-[state=checked]:bg-accent"
                aria-label="Featured"
              />
              <span className="text-sm text-foreground">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => patch({ active: v })}
                className="data-[state=checked]:bg-accent"
                aria-label="Active"
              />
              <span className="text-sm text-foreground">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setForm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Add partner"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {partners.length === 0 ? (
        <EmptyRow>No partners yet. Add a sponsor or vendor to fill the shop.</EmptyRow>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {partners.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <PartnerLogo logo={p.logo} name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="truncate">{p.name}</span>
                  <PartnerKindBadge kind={p.kind} />
                  {p.featured && (
                    <span className="badge-stamp shrink-0 text-amber-700 border-amber-700 dark:text-yellow-400 dark:border-yellow-400">
                      Featured
                    </span>
                  )}
                  {!p.active && (
                    <span className="badge-stamp shrink-0 text-muted-foreground border-border">
                      Inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {PARTNER_CATEGORY_LABELS[p.category]} · /{p.slug}
                  {p.tagline ? ` · ${p.tagline}` : ""}
                </p>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-0.5"
                  >
                    <ExternalLink size={11} /> {p.url}
                  </a>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Edit ${p.name}`}
                onClick={() => openEdit(p)}
              >
                <Pencil size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                aria-label={`Remove ${p.name}`}
                onClick={() => setRemoveTarget(p)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="max-w-sm bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">
              Remove &quot;{removeTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This partner is pulled from the shop directory and support strips. You can always add
              them back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              disabled={removeBusy}
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the server answers
                void confirmRemove();
              }}
            >
              {removeBusy ? "Removing…" : "Remove partner"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}


