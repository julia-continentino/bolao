import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { markNotificationRead } from "@/lib/notifications";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await context.params;
  await markNotificationRead(id, user.id);
  return NextResponse.json({ ok: true });
}
