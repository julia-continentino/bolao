import { NextResponse } from "next/server";
import { syncDueDateNotifications } from "@/lib/notifications";

/**
 * Endpoint for an external scheduler (Vercel Cron, GitHub Actions, etc.)
 * to keep due-date notifications fresh even without page traffic.
 * The same sync also runs opportunistically on every authenticated
 * page load (see lib/notifications.ts), so this is a best-effort extra.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }
  }

  const created = await syncDueDateNotifications();
  return NextResponse.json({ ok: true, created });
}

export async function GET(request: Request) {
  return POST(request);
}
