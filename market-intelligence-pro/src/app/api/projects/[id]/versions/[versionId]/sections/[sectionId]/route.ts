import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedVersion, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; versionId: string; sectionId: string }> };

const schema = z.object({
  paragraphs: z.array(z.object({
    id: z.string().optional(),
    text: z.string().trim().min(1).max(8000),
    sourceIds: z.array(z.string()).default([]),
    datasetIds: z.array(z.string()).default([]),
  })).max(40),
  keyFindings: z.array(z.string().max(1000)).max(30).optional(),
});

/** Edição manual de uma seção do Research Workspace */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id, versionId, sectionId } = await ctx.params;
  const { content } = await getOwnedVersion(id, versionId, user.id);
  const body = schema.parse(await req.json());
  const section = content.sections.find((s) => s.id === sectionId);
  if (!section) throw new HttpError(404, "Seção não encontrada.");
  const srcIds = new Set(content.sources.map((s) => s.id));
  const dsIds = new Set(content.datasets.map((d) => d.id));
  const prev = new Map(section.paragraphs.map((p) => [p.id, p]));
  section.paragraphs = body.paragraphs.map((p, i) => {
    const old = p.id ? prev.get(p.id) : undefined;
    const changed = !old || old.text !== p.text;
    return {
      id: `${sectionId}-${i + 1}`,
      text: p.text,
      sourceIds: p.sourceIds.filter((x) => srcIds.has(x)),
      datasetIds: p.datasetIds.filter((x) => dsIds.has(x)),
      agent: changed ? "user" : old!.agent,
      flagged: changed ? null : old!.flagged ?? null,
    };
  });
  if (body.keyFindings) section.keyFindings = body.keyFindings;
  section.editedAt = new Date().toISOString();
  content.edits.push({ at: section.editedAt, sectionId, action: "Edição manual" });
  await prisma.researchVersion.update({ where: { id: versionId }, data: { content: content as never } });
  return NextResponse.json({ section });
});
