import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { ReportViewer } from "@/components/ReportViewer";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const report = await prisma.report.findFirst({ where: { id, project: { userId: user.id } }, include: { project: { select: { id: true, title: true } } } });
  if (!report) notFound();
  return <ReportViewer reportId={id} projectId={report.project.id} projectTitle={report.project.title} />;
}
