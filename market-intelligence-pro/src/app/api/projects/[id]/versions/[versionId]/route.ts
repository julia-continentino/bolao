import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnedProject, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { isResearchRunning } from "@/lib/ai/pipeline";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id, versionId } = await ctx.params;
  await getOwnedProject(id, user.id);
  let version = await prisma.researchVersion.findFirst({ where: { id: versionId, projectId: id } });
  if (!version) throw new HttpError(404, "Versão não encontrada.");
  // Execução interrompida (ex.: reinício do servidor)
  if ((version.status === "running" || version.status === "queued") && !isResearchRunning(versionId) && Date.now() - version.updatedAt.getTime() > 3 * 60_000) {
    version = await prisma.researchVersion.update({ where: { id: versionId }, data: { status: "failed", error: "A execução foi interrompida (reinício do servidor). Crie uma nova versão para tentar novamente." } });
    const project = await prisma.project.findUnique({ where: { id } });
    await prisma.project.update({ where: { id }, data: { status: project?.currentVersionId ? "completed" : "failed" } });
  }
  return NextResponse.json({ version });
});
