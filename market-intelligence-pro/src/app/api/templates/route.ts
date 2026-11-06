import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { reportConfigSchema } from "@/lib/types";

export const GET = handler(async () => {
  const user = await requireApiUser();
  const templates = await prisma.template.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ templates });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const body = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), config: reportConfigSchema }).parse(await req.json());
  const template = await prisma.template.create({ data: { userId: user.id, name: body.name, description: body.description ?? null, config: body.config as never } });
  return NextResponse.json({ template }, { status: 201 });
});
