"use client";
import Link from "next/link";
import { FileText } from "lucide-react";
import { REPORT_FORMATS } from "@/lib/types";
import { Empty, StatusBadge } from "../ui";
import type { ReportSummary, VersionSummary } from "./Workspace";

export function ReportsTab({ projectId, reports, versions, selectedVersionId }: { projectId: string; reports: ReportSummary[]; versions: VersionSummary[]; selectedVersionId: string | null; onChanged: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {selectedVersionId ? <Link className="btn-primary" href={`/projects/${projectId}/reports/new?v=${selectedVersionId}`}><FileText size={16} /> Criar relatório personalizado</Link> : <span className="text-sm text-ink-500">Selecione uma versão concluída para criar relatórios.</span>}
      </div>
      {reports.length === 0 ? <Empty title="Nenhum relatório criado">Crie um relatório personalizado escolhendo parágrafos, gráficos e formato.</Empty> : (
        <div className="card divide-y divide-ink-200">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-navy-50/50">
              <div className="min-w-0 flex-1"><div className="font-medium text-navy-900">{r.title}</div><div className="text-xs text-ink-500">{REPORT_FORMATS.find((f) => f.value === r.config.format)?.label} · baseado na versão {versions.find((v) => v.id === r.versionId)?.number ?? "?"} · atualizado {new Date(r.updatedAt).toLocaleString("pt-BR")}</div></div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
