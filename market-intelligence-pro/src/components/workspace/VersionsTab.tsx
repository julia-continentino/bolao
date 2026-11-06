"use client";
import { useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { RefreshCw, Settings2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { objectiveLabel, regionLabel, type ResearchParams } from "@/lib/types";
import { ResearchParamsForm } from "../ResearchParamsForm";
import { ErrorNote, StatusBadge } from "../ui";
import type { VersionSummary } from "./Workspace";

export function VersionsTab({ projectId, versions, selectedId, onSelect, onCreated, params, edits, title, onRenamed }: {
  projectId: string; versions: VersionSummary[]; selectedId: string | null; onSelect: (id: string) => void; onCreated: () => Promise<void>;
  params: ResearchParams; edits: { at: string; sectionId: string; action: string }[]; title: string; onRenamed: (t: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "params">("none");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(title);
  const running = versions.some((v) => v.status === "running" || v.status === "queued");
  const latest = versions[0]?.params ?? params;

  async function rerun(p?: ResearchParams, note?: string) {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/versions`, { method: "POST", json: { params: p ?? latest, note: note ?? "Atualização das informações" } });
      setMode("none");
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar versão.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function rename() {
    await api(`/api/projects/${projectId}`, { method: "PATCH", json: { title: name } });
    onRenamed(name);
  }
  async function remove() {
    if (!confirm("Excluir este projeto, todas as versões e relatórios? Esta ação não pode ser desfeita.")) return;
    await api(`/api/projects/${projectId}`, { method: "DELETE" });
    router.replace("/library");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={running || busy} onClick={() => rerun().catch(() => undefined)}><RefreshCw size={15} /> Atualizar informações</button>
          <button className="btn-secondary" disabled={running} onClick={() => setMode(mode === "params" ? "none" : "params")}><Settings2 size={15} /> Modificar parâmetros</button>
          {running && <span className="self-center text-sm text-ink-500">Há uma versão em processamento.</span>}
        </div>
        {mode === "params" && (
          <div className="card p-6"><ResearchParamsForm initial={latest} withNote submitLabel="Criar nova versão com estes parâmetros" onSubmit={async ({ params: p, note }) => rerun(p, note ?? "Parâmetros modificados")} /></div>
        )}
        <div className="card">
          <div className="card-header"><span className="card-title">Histórico de versões</span></div>
          <ul className="divide-y divide-ink-200">
            {versions.map((v) => (
              <li key={v.id} className={clsx("flex flex-wrap items-center gap-4 px-5 py-4", selectedId === v.id && "bg-navy-50")}>
                <div className="num flex h-9 w-9 items-center justify-center rounded bg-navy-100 font-semibold text-navy-800">v{v.number}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900">{v.note ?? (v.number === 1 ? "Pesquisa inicial" : "Nova versão")}</div>
                  <div className="text-xs text-ink-500">{new Date(v.createdAt).toLocaleString("pt-BR")} · {regionLabel(v.params)} · {v.params.historyStart}–{v.params.historyEnd}{v.params.projectionEnd ? `→${v.params.projectionEnd}` : ""} · {objectiveLabel(v.params.objective)}{v.model ? ` · ${v.model}` : ""}</div>
                  {v.error && <div className="mt-1 text-xs text-red-700">{v.error}</div>}
                </div>
                <StatusBadge status={v.status} />
                <button className="btn-secondary btn-sm" disabled={v.status !== "completed" || selectedId === v.id} onClick={() => onSelect(v.id)}>{selectedId === v.id ? "Em exibição" : "Abrir"}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="card-title mb-3">Projeto</div>
          <label className="label">Título</label>
          <div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-secondary" disabled={name.trim().length < 2 || name === title} onClick={rename}>Salvar</button></div>
          <button className="btn-danger btn-sm mt-4" onClick={remove}>Excluir projeto</button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Edições na versão aberta</span></div>
          {edits.length === 0 ? <p className="px-5 py-4 text-sm text-ink-500">Nenhuma edição manual ou regeneração.</p> : (
            <ul className="divide-y divide-ink-200 text-sm">{[...edits].reverse().map((e, i) => <li key={i} className="px-5 py-2.5"><div className="text-ink-900">{e.action} — {e.sectionId}</div><div className="text-xs text-ink-500">{new Date(e.at).toLocaleString("pt-BR")}</div></li>)}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
