import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedReport, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import type { ReportContent } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Edição manual de um parágrafo do relatório final */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const report = await getOwnedReport(id, user.id);
  const content = report.content as unknown as ReportContent | null;
  if (!content) throw new HttpError(409, "Relatório ainda não gerado.");
  const body = z.object({ paragraphId: z.string(), text: z.string().trim().min(1).max(8000) }).parse(await req.json());
  let found = false;
  for (const s of content.sections) for (const p of s.paragraphs) if (p.id === body.paragraphId) { p.text = body.text; found = true; }
  for (const pg of content.pages) for (const b of pg.blocks) if (b.kind === "paragraph" && b.id === body.paragraphId) b.text = body.text;
  if (body.paragraphId === "summary" && content.executiveSummary != null) {
    content.executiveSummary = body.text;
    for (const pg of content.pages) for (const b of pg.blocks) if (b.kind === "summary") b.text = body.text;
    found = true;
  }
  if (!found) throw new HttpError(404, "Parágrafo não encontrado.");
  await prisma.reportRevision.create({ data: { reportId: id, config: report.config as never, content: report.content as never } });
  await prisma.report.update({ where: { id }, data: { content: content as never } });
  return NextResponse.json({ ok: true });
});
