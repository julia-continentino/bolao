import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LibraryList } from "@/components/LibraryList";
import type { ResearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await requirePageUser();
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { versions: true, reports: true } } } });
  return (
    <>
      <PageHeader eyebrow="Biblioteca" title="Biblioteca de pesquisas" subtitle="Todas as pesquisas permanecem salvas, com histórico de versões e relatórios." />
      <LibraryList items={projects.map((p) => ({ id: p.id, title: p.title, status: p.status, params: p.params as unknown as ResearchParams, versions: p._count.versions, reports: p._count.reports, updatedAt: p.updatedAt.toISOString() }))} />
    </>
  );
}
