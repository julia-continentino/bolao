import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai/runtime";
import { Empty, InfoNote, PageHeader, StatusBadge } from "@/components/ui";
import { objectiveLabel, regionLabel, type ResearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requirePageUser();
  const [projects, counts, reports, sources] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 8, include: { _count: { select: { versions: true, reports: true } } } }),
    prisma.project.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
    prisma.report.count({ where: { project: { userId: user.id } } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COALESCE(SUM(jsonb_array_length(v.content->'sources')),0)::bigint AS n FROM "ResearchVersion" v JOIN "Project" p ON p.id = v."projectId" WHERE p."userId" = ${user.id} AND v.status = 'completed' AND p."currentVersionId" = v.id`,
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((a, c) => a + c._count, 0);
  const kpis = [
    { label: "Pesquisas", value: total },
    { label: "Concluídas", value: count("completed") },
    { label: "Em análise", value: count("running") },
    { label: "Relatórios gerados", value: reports },
    { label: "Fontes catalogadas", value: Number(sources[0]?.n ?? 0) },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`Olá, ${user.name.split(" ")[0]}`}
        subtitle="Acompanhe suas pesquisas de mercado e relatórios."
        actions={<Link href="/research/new" className="btn-primary"><FilePlus2 size={16} /> Nova pesquisa de mercado</Link>}
      />
      {!aiConfigured() && (
        <div className="mb-6"><InfoNote tone="warn"><b>Integração de IA não configurada.</b> Defina <code>ANTHROPIC_API_KEY</code> no servidor para executar pesquisas. Nenhum resultado simulado é exibido.</InfoNote></div>
      )}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{k.label}</div>
            <div className="num mt-1 text-2xl font-semibold text-navy-900">{k.value.toLocaleString("pt-BR")}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Pesquisas recentes</span><Link href="/library" className="text-xs font-medium text-navy-600 hover:underline">Ver biblioteca</Link></div>
        {projects.length === 0 ? (
          <div className="p-5"><Empty title="Nenhuma pesquisa ainda">Clique em “Nova pesquisa de mercado” para começar.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-100/60 text-left text-[11px] uppercase tracking-wide text-ink-500">
                <tr><th className="px-5 py-2.5 font-semibold">Pesquisa</th><th className="px-3 py-2.5 font-semibold">Região</th><th className="px-3 py-2.5 font-semibold">Objetivo</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 text-right font-semibold">Versões</th><th className="px-5 py-2.5 text-right font-semibold">Atualizada</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {projects.map((p) => {
                  const params = p.params as unknown as ResearchParams;
                  return (
                    <tr key={p.id} className="hover:bg-navy-50/50">
                      <td className="max-w-[360px] px-5 py-3"><Link href={`/projects/${p.id}`} className="font-medium text-navy-800 hover:underline">{p.title}</Link></td>
                      <td className="px-3 py-3 text-ink-700">{regionLabel(params)}</td>
                      <td className="px-3 py-3 text-ink-700">{objectiveLabel(params.objective)}</td>
                      <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                      <td className="num px-3 py-3 text-right text-ink-700">{p._count.versions}</td>
                      <td className="num px-5 py-3 text-right text-ink-500">{p.updatedAt.toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
