import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TemplateList } from "@/components/TemplateList";
import type { ReportConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requirePageUser();
  const templates = await prisma.template.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="Modelos" title="Modelos de relatório" subtitle="Layouts aprovados salvos como padrão: formato, profundidade, parágrafos, seções e visualizações." />
      <TemplateList templates={templates.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt.toISOString(), config: t.config as unknown as ReportConfig }))} />
    </>
  );
}
