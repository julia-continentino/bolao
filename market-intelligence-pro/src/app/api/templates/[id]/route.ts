import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const t = await prisma.template.findFirst({ where: { id, userId: user.id } });
  if (!t) throw new HttpError(404, "Modelo não encontrado.");
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
