import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedProject, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { researchParamsSchema } from "@/lib/types";
import { aiConfigured } from "@/lib/ai/runtime";
import { startResearch } from "@/lib/ai/pipeline";

type Ctx = { params: Promise<{ id: string }> };

/** Cria uma nova versão da pesquisa (atualização de dados ou parâmetros modificados) */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const project = await getOwnedProject(id, user.id);
  if (!aiConfigured()) throw new HttpError(503, "Integração de IA não configurada no servidor (ANTHROPIC_API_KEY).");
  const body = z.object({ params: z.unknown().optional(), note: z.string().max(300).optional() }).parse(await req.json());
  const params = researchParamsSchema.parse(body.params ?? project.params);
  const running = await prisma.researchVersion.findFirst({ where: { projectId: id, status: { in: ["queued", "running"] } } });
  if (running) throw new HttpError(409, "Já existe uma versão em processamento para este projeto.");
  const last = await prisma.researchVersion.findFirst({ where: { projectId: id }, orderBy: { number: "desc" } });
  const version = await prisma.researchVersion.create({ data: { projectId: id, number: (last?.number ?? 0) + 1, params: params as never, status: "queued", note: body.note ?? null } });
  await prisma.project.update({ where: { id }, data: { params: params as never, status: "running" } });
  startResearch(version.id);
  return NextResponse.json({ versionId: version.id }, { status: 201 });
});
