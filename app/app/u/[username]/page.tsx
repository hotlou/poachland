import { generateMetadata as publicMetadata } from "@/app/u/[username]/page";
import Detail from "./trader-detail";

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  return { ...await publicMetadata(props), robots: { index: false, follow: false } };
}

export default function Page() { return <Detail />; }
