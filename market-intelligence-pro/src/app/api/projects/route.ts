import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { researchParamsSchema } from "@/lib/types";
import { aiConfigured } from "@/lib/ai/runtime";
import { startResearch } from "@/lib/ai/pipeline";

export const GET = handler(async () => {
  const user = await requireApiUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, params: true, status: true, createdAt: true, updatedAt: true, _count: { select: { versions: true, reports: true } } },
  });
  return NextResponse.json({ projects });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  if (!aiConfigured()) throw new HttpError(503, "Integração de IA não configurada no servidor (ANTHROPIC_API_KEY). Não é possível executar pesquisas.");
  const body = await req.json();
  const params = researchParamsSchema.parse(body.params);
  const title = (typeof body.title === "string" && body.title.trim()) || params.sector.slice(0, 120);
  const project = await prisma.project.create({ data: { userId: user.id, title, params: params as never, status: "running" } });
  const version = await prisma.researchVersion.create({ data: { projectId: project.id, number: 1, params: params as never, status: "queued" } });
  startResearch(version.id);
  return NextResponse.json({ projectId: project.id, versionId: version.id }, { status: 201 });
});
