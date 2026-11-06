import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { ReportBuilder } from "@/components/ReportBuilder";
import { PageHeader } from "@/components/ui";
import type { ReportConfig, ResearchContent } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; template?: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const sp = await searchParams;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) notFound();
  const version = await prisma.researchVersion.findFirst({ where: { projectId: id, id: sp.v ?? project.currentVersionId ?? undefined, status: "completed" } });
  if (!version?.content) notFound();
  const templates = await prisma.template.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow={<Link href={`/projects/${id}`} className="hover:underline">{project.title}</Link>} title="Criar relatório personalizado" subtitle={`Baseado na versão ${version.number} da pesquisa.`} />
      <ReportBuilder
        mode="create"
        projectId={id}
        versionId={version.id}
        projectTitle={project.title}
        content={version.content as unknown as ResearchContent}
        templates={templates.map((t) => ({ id: t.id, name: t.name, config: t.config as unknown as ReportConfig }))}
        initialTemplateId={sp.template}
      />
    </>
  );
}
