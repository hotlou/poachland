/**
 * Data-portability download: GET /api/account/export streams a JSON file with
 * everything Poachland holds about the signed-in user. Auth-gated; no caching.
 */

import { NextResponse } from "next/server";
import { exportUserData } from "@/lib/server/account";
import { readSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await readSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    const data = await exportUserData(user.id);
    const body = JSON.stringify(data, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="poachland-data-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[account] export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
