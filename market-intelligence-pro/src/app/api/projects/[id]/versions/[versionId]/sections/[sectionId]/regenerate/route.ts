import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedVersion, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { rewriteSection } from "@/lib/ai/report";
import { AIConfigError, AgentError, aiConfigured } from "@/lib/ai/runtime";
import { SECTION_IDS, type SectionId } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; versionId: string; sectionId: string }> };
export const maxDuration = 300;

const schema = z.object({
  paragraphs: z.number().int().min(1).max(20),
  depth: z.enum(["executive", "analytical", "technical"]).default("analytical"),
  instruction: z.string().trim().max(1000).optional(),
});

/** Regenera o texto de uma seção a partir do material verificado da própria pesquisa */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id, versionId, sectionId } = await ctx.params;
  if (!aiConfigured()) throw new HttpError(503, "Integração de IA não configurada no servidor.");
  if (!(SECTION_IDS as readonly string[]).includes(sectionId)) throw new HttpError(404, "Seção não encontrada.");
  const { content } = await getOwnedVersion(id, versionId, user.id);
  const body = schema.parse(await req.json());
  const section = content.sections.find((s) => s.id === sectionId);
  if (!section || !section.paragraphs.length) throw new HttpError(409, "A seção não possui conteúdo para regenerar.");
  let paragraphs;
  try {
    paragraphs = await rewriteSection(content, { format: "sector", depth: body.depth }, sectionId as SectionId, body.paragraphs, body.instruction);
  } catch (err) {
    if (err instanceof AIConfigError || err instanceof AgentError) throw new HttpError(502, err.message);
    throw err;
  }
  section.paragraphs = paragraphs.map((p, i) => ({ ...p, id: `${sectionId}-${i + 1}`, agent: "director" as const, flagged: null }));
  section.editedAt = new Date().toISOString();
  content.edits.push({ at: section.editedAt, sectionId, action: `Texto regenerado (${body.paragraphs} parágrafos, ${body.depth})` });
  await prisma.researchVersion.update({ where: { id: versionId }, data: { content: content as never } });
  return NextResponse.json({ section });
});
