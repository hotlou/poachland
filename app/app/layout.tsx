import { pageMetadata } from "@/lib/metadata";
import AppShell from "./app-shell";

export const metadata = pageMetadata({ title: "Poachland — Your ultimate gear community", description: "Trade jerseys, collect discs, and connect with ultimate players on Poachland.", noIndex: true });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
