"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Empty, StatusBadge } from "./ui";
import { objectiveLabel, regionLabel, type ResearchParams } from "@/lib/types";

export function LibraryList({ items }: { items: { id: string; title: string; status: string; params: ResearchParams; versions: number; reports: number; updatedAt: string }[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const list = useMemo(() => items.filter((i) => (status === "all" || i.status === status) && `${i.title} ${i.params.sector}`.toLowerCase().includes(q.toLowerCase())), [items, q, status]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-sm" placeholder="Buscar por setor ou título…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos os status</option><option value="completed">Concluídas</option><option value="running">Em análise</option><option value="failed">Falhas</option>
        </select>
      </div>
      {list.length === 0 ? <Empty title="Nenhuma pesquisa encontrada" /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => (
            <Link key={i.id} href={`/projects/${i.id}`} className="card block p-5 transition hover:border-navy-300">
              <div className="mb-2 flex items-start justify-between gap-3"><h3 className="line-clamp-2 font-semibold text-navy-900">{i.title}</h3><StatusBadge status={i.status} /></div>
              <p className="line-clamp-2 text-sm text-ink-500">{i.params.sector}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                <span>{regionLabel(i.params)}</span><span>{i.params.historyStart}–{i.params.historyEnd}{i.params.projectionEnd ? ` → ${i.params.projectionEnd}` : ""}</span><span>{objectiveLabel(i.params.objective)}</span>
                <span>{i.versions} versão(ões)</span><span>{i.reports} relatório(s)</span><span>Atualizada {new Date(i.updatedAt).toLocaleDateString("pt-BR")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
