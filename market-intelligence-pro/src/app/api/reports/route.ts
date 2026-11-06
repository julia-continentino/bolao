import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedVersion, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { reportConfigSchema } from "@/lib/types";
import { aiConfigured } from "@/lib/ai/runtime";
import { startReport } from "@/lib/ai/report";

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  if (!aiConfigured()) throw new HttpError(503, "Integração de IA não configurada no servidor (ANTHROPIC_API_KEY).");
  const body = z.object({ projectId: z.string(), versionId: z.string(), config: reportConfigSchema }).parse(await req.json());
  await getOwnedVersion(body.projectId, body.versionId, user.id);
  if (!body.config.sections.some((s) => s.include)) throw new HttpError(400, "Selecione ao menos uma seção.");
  const report = await prisma.report.create({
    data: { projectId: body.projectId, versionId: body.versionId, title: body.config.title, config: body.config as never, status: "generating" },
  });
  startReport(report.id);
  return NextResponse.json({ reportId: report.id }, { status: 201 });
});
