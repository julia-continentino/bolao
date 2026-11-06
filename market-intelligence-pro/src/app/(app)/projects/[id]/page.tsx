import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { Workspace } from "@/components/workspace/Workspace";
import type { ResearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; v?: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const sp = await searchParams;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) notFound();
  return (
    <Workspace
      project={{ id: project.id, title: project.title, status: project.status, params: project.params as unknown as ResearchParams, currentVersionId: project.currentVersionId }}
      initialTab={sp.tab}
      initialVersionId={sp.v}
    />
  );
}
