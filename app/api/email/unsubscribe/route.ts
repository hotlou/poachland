import { NextResponse } from "next/server";
import { applyUnsubscribe, EMAIL_CATEGORY_LABELS } from "@/lib/server/email";
import type { EmailCategory } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe from a Poachland email footer.
 *   ?token=…            → turn off ALL email categories
 *   ?token=…&cat=deals  → turn off just that category
 * Renders a small confirmation page (no auth needed — the token is the auth).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const cat = url.searchParams.get("cat");
  const result = await applyUnsubscribe(token, cat);

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com").replace(/\/$/, "");
  let heading: string;
  let sub: string;
  if (!result.ok) {
    heading = "Link expired";
    sub = "That unsubscribe link is no longer valid. You can manage every email preference in Settings.";
  } else if (result.category) {
    const label = EMAIL_CATEGORY_LABELS[result.category as EmailCategory].title.toLowerCase();
    heading = "Unsubscribed";
    sub = `You'll no longer get ${label} emails. Turn any of them back on anytime in Settings.`;
  } else {
    heading = "Unsubscribed from all emails";
    sub = "You won't get any more email from Poachland. You can re-enable them anytime in Settings.";
  }

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Poachland — email preferences</title>
<style>
  :root{color-scheme:light}
  body{margin:0;background:#f6f4ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#262420}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:440px;width:100%;background:#fff;border:1px solid #e7e3d6;border-radius:16px;padding:32px}
  .brand{color:#2d6b3f;font-weight:800;font-size:20px;letter-spacing:-.02em;margin-bottom:20px}
  h1{font-size:22px;margin:0 0 8px}
  p{color:#5a564d;font-size:14px;line-height:1.6;margin:0 0 24px}
  a.btn{display:inline-block;background:#2d6b3f;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 24px;border-radius:9999px}
</style></head>
<body><div class="wrap"><div class="card">
  <div class="brand">Poachland</div>
  <h1>${heading}</h1>
  <p>${sub}</p>
  <a class="btn" href="${origin}/app/settings">Manage email settings</a>
</div></div></body></html>`;

  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
