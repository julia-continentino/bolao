import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedReport, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { reportConfigSchema } from "@/lib/types";
import { isReportRunning, startReport } from "@/lib/ai/report";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  let report = await getOwnedReport(id, user.id);
  if (report.status === "generating" && !isReportRunning(id) && Date.now() - report.updatedAt.getTime() > 3 * 60_000) {
    await prisma.report.update({ where: { id }, data: { status: report.content ? "ready" : "failed", error: "A geração foi interrompida. Tente regenerar." } });
    report = await getOwnedReport(id, user.id);
  }
  const revisions = await prisma.reportRevision.findMany({ where: { reportId: id }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true } });
  const version = await prisma.researchVersion.findUnique({ where: { id: report.versionId }, select: { id: true, number: true, content: true } });
  return NextResponse.json({ report, revisions, research: version?.content ?? null, versionNumber: version?.number ?? null });
});

/** Altera a configuração e regenera o relatório (a versão anterior é preservada no histórico) */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const report = await getOwnedReport(id, user.id);
  if (report.status === "generating") throw new HttpError(409, "O relatório já está sendo gerado.");
  const { config } = z.object({ config: reportConfigSchema }).parse(await req.json());
  await prisma.report.update({ where: { id }, data: { config: config as never, title: config.title, status: "generating", error: null } });
  startReport(id);
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await getOwnedReport(id, user.id);
  await prisma.report.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
