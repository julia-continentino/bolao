"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { DEPTHS, REPORT_FORMATS, VISUAL_MODES, type ReportConfig } from "@/lib/types";
import { Empty } from "./ui";

export function TemplateList({ templates: initial }: { templates: { id: string; name: string; createdAt: string; config: ReportConfig }[] }) {
  const [templates, setTemplates] = useState(initial);
  if (!templates.length) return <Empty title="Nenhum modelo salvo">Ao criar um relatório, use “Salvar” no painel Modelos para registrar o layout como padrão.</Empty>;
  return (
    <div className="card divide-y divide-ink-200">
      {templates.map((t) => {
        const secs = t.config.sections.filter((s) => s.include).length;
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-navy-900">{t.name}</div>
              <div className="text-xs text-ink-500">{REPORT_FORMATS.find((f) => f.value === t.config.format)?.label} · {DEPTHS.find((d) => d.value === t.config.depth)?.label} · {t.config.paragraphMode === "global" ? `${t.config.totalParagraphs} parágrafos` : "parágrafos por seção"} · {secs} seções · {VISUAL_MODES.find((m) => m.value === t.config.visualMode)?.label}{t.config.targetPages ? ` · ${t.config.targetPages} págs./slides` : ""}</div>
            </div>
            <span className="text-xs text-ink-500">{new Date(t.createdAt).toLocaleDateString("pt-BR")}</span>
            <button className="btn-danger btn-sm" onClick={async () => { if (!confirm("Excluir modelo?")) return; await api(`/api/templates/${t.id}`, { method: "DELETE" }); setTemplates(templates.filter((x) => x.id !== t.id)); }}><Trash2 size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
