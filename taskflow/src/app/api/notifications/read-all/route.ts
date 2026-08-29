import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function POST() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
