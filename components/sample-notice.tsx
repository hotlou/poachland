import { SAMPLE_NOTICE } from "@/lib/sample-content";

export function SampleBadge({ label = "Example" }: { label?: string }) {
  return <span className="badge-stamp border-accent/50 bg-background/95 text-accent">{label}</span>;
}

export function SampleNotice({ label = "Example listing" }: { label?: string }) {
  return <aside className="my-4 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
    <p className="font-semibold text-foreground">{label}</p><p className="mt-1 leading-relaxed text-muted-foreground">{SAMPLE_NOTICE}</p>
  </aside>;
}
