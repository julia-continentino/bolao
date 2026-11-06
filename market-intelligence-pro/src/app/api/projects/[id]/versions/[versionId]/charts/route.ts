import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOwnedVersion, HttpError, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { chartSpecSchema } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

/** Salva o conjunto de visualizações (sugeridas pela IA e personalizadas) da versão */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id, versionId } = await ctx.params;
  const { content } = await getOwnedVersion(id, versionId, user.id);
  const { charts } = z.object({ charts: z.array(chartSpecSchema).max(300) }).parse(await req.json());
  const ids = new Set<string>();
  for (const c of charts) {
    if (ids.has(c.id)) throw new HttpError(400, `Identificador duplicado: ${c.id}`);
    ids.add(c.id);
    const d = content.datasets.find((x) => x.id === c.datasetId);
    if (!d) throw new HttpError(400, `Dataset inexistente: ${c.datasetId}`);
    if (d.verification.status === "rejected") throw new HttpError(400, `O dataset "${d.title}" foi rejeitado na verificação e não pode ser visualizado.`);
    const keys = new Set(d.series.map((s) => s.key));
    if (c.seriesKeys.some((k) => !keys.has(k))) throw new HttpError(400, `Indicador inexistente no dataset "${d.title}".`);
  }
  content.charts = charts;
  await prisma.researchVersion.update({ where: { id: versionId }, data: { content: content as never } });
  return NextResponse.json({ charts });
});
