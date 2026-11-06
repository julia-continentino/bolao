import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedProject, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const project = await getOwnedProject(id, user.id);
  const versions = await prisma.researchVersion.findMany({
    where: { projectId: id },
    orderBy: { number: "desc" },
    select: { id: true, number: true, status: true, params: true, note: true, model: true, createdAt: true, completedAt: true, error: true },
  });
  const reports = await prisma.report.findMany({ where: { projectId: id }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, versionId: true, config: true, updatedAt: true } });
  return NextResponse.json({ project, versions, reports });
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await getOwnedProject(id, user.id);
  const body = z.object({ title: z.string().trim().min(2).max(200) }).parse(await req.json());
  const project = await prisma.project.update({ where: { id }, data: { title: body.title } });
  return NextResponse.json({ project });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await getOwnedProject(id, user.id);
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
