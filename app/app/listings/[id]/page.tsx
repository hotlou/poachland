import { generateMetadata as publicMetadata } from "@/app/l/[id]/page";
import Detail from "./listing-detail";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  return { ...await publicMetadata(props), robots: { index: false, follow: false } };
}

export default function Page() { return <Detail />; }
