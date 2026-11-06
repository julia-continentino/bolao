import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedReport, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { objectiveLabel, regionLabel, type ReportContent, type ResearchContent, type ResearchParams } from "@/lib/types";
import { safeFileName, type ExportInput } from "@/lib/export/common";
import { buildPptx } from "@/lib/export/pptx";
import { buildDocx } from "@/lib/export/docx";
import { buildPdf } from "@/lib/export/pdf";
import { buildWorkbook } from "@/lib/export/xlsx";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 120;

const MIME = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

const schema = z.object({
  format: z.enum(["pptx", "docx", "pdf", "xlsx"]),
  images: z.record(z.string(), z.object({ dataUrl: z.string().max(6_000_000).regex(/^data:image\/png;base64,/), width: z.number().positive(), height: z.number().positive() })).default({}),
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const report = await getOwnedReport(id, user.id);
  const content = report.content as unknown as ReportContent | null;
  if (!content) throw new HttpError(409, "O relatório ainda não foi gerado.");
  const version = await prisma.researchVersion.findUnique({ where: { id: report.versionId } });
  const research = version?.content as unknown as ResearchContent | null;
  if (!research) throw new HttpError(409, "Pesquisa de origem indisponível.");
  const body = schema.parse(await req.json());
  const p = report.project.params as unknown as ResearchParams;
  const input: ExportInput = {
    title: report.title,
    subtitle: `${p.sector} · ${regionLabel(p)} · ${objectiveLabel(p.objective)}`,
    research,
    report: content,
    images: body.images,
  };
  let buf: Buffer;
  if (body.format === "pptx") buf = await buildPptx(input);
  else if (body.format === "docx") buf = await buildDocx(input);
  else if (body.format === "pdf") buf = await buildPdf(input);
  else buf = await buildWorkbook({ title: report.title, research, charts: content.visuals.length ? content.visuals : undefined });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": MIME[body.format], "Content-Disposition": `attachment; filename="${safeFileName(report.title)}.${body.format}"` },
  });
});
