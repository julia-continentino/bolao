import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnedReport, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { startReport } from "@/lib/ai/report";
import { aiConfigured } from "@/lib/ai/runtime";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!aiConfigured()) throw new HttpError(503, "Integração de IA não configurada no servidor.");
  const report = await getOwnedReport(id, user.id);
  if (report.status === "generating") throw new HttpError(409, "O relatório já está sendo gerado.");
  await prisma.report.update({ where: { id }, data: { status: "generating", error: null } });
  startReport(id);
  return NextResponse.json({ ok: true });
});
