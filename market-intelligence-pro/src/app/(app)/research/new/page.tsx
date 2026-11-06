"use client";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ResearchParamsForm } from "@/components/ResearchParamsForm";
import { api } from "@/lib/client/api";
import { AGENTS } from "@/lib/types";

export default function NewResearchPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader eyebrow="Nova pesquisa de mercado" title="Definir escopo da pesquisa" subtitle="Os especialistas virtuais pesquisarão fontes reais, verificarão os dados e prepararão o Research Workspace." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <ResearchParamsForm
            withTitle
            submitLabel="Iniciar análise"
            onSubmit={async ({ params, title }) => {
              const r = await api<{ projectId: string }>("/api/projects", { method: "POST", json: { params, title } });
              router.push(`/projects/${r.projectId}`);
            }}
          />
        </div>
        <aside className="card h-fit p-5">
          <div className="card-title mb-3">Equipe de especialistas</div>
          <ol className="space-y-3 text-sm">
            {Object.values(AGENTS).map((a, i) => (
              <li key={a.name} className="flex gap-3"><span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-800">{i + 1}</span><span className="text-ink-700">{a.name}</span></li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-ink-500">A análise usa busca web real e APIs oficiais (Banco Central, Banco Mundial, FMI e SEC). Uma pesquisa completa costuma levar de 5 a 15 minutos.</p>
        </aside>
      </div>
    </>
  );
}
