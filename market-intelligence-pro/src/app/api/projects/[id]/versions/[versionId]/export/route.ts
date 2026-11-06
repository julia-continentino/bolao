import { z } from "zod";
import { getOwnedVersion, requireApiUser } from "@/lib/auth";
import { handler } from "@/lib/api";
import { buildWorkbook } from "@/lib/export/xlsx";
import { safeFileName } from "@/lib/export/common";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

/** Exporta a base numérica (todos os datasets ou os de gráficos selecionados) para Excel */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser();
  const { id, versionId } = await ctx.params;
  const { content } = await getOwnedVersion(id, versionId, user.id);
  const body = z.object({ chartIds: z.array(z.string()).optional() }).parse(await req.json().catch(() => ({})));
  const project = await prisma.project.findUniqueOrThrow({ where: { id } });
  const charts = body.chartIds?.length ? content.charts.filter((c) => body.chartIds!.includes(c.id)) : undefined;
  const buf = await buildWorkbook({ title: project.title, research: content, charts });
  const name = charts?.length === 1 ? charts[0].title : project.title;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFileName(name)}.xlsx"`,
    },
  });
});
