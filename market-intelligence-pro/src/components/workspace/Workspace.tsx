"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { FileText } from "lucide-react";
import { api } from "@/lib/client/api";
import { objectiveLabel, regionLabel, type AgentProgress, type ResearchContent, type ResearchParams } from "@/lib/types";
import { ErrorNote, PageHeader, StatusBadge } from "../ui";
import { ProgressPanel } from "./ProgressPanel";
import { ResearchTab } from "./ResearchTab";
import { StudioTab } from "./StudioTab";
import { SourcesTab } from "./SourcesTab";
import { ReportsTab } from "./ReportsTab";
import { VersionsTab } from "./VersionsTab";

export interface VersionSummary { id: string; number: number; status: string; params: ResearchParams; note: string | null; model: string | null; createdAt: string; completedAt: string | null; error: string | null }
export interface FullVersion extends VersionSummary { progress: AgentProgress[]; content: ResearchContent | null }
export interface ReportSummary { id: string; title: string; status: string; versionId: string; updatedAt: string; config: { format: string } }

const TABS = [
  { id: "research", label: "Research Workspace" },
  { id: "studio", label: "Data Visualization Studio" },
  { id: "sources", label: "Fontes e verificação" },
  { id: "reports", label: "Relatórios" },
  { id: "versions", label: "Versões e parâmetros" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Workspace({ project, initialTab, initialVersionId }: { project: { id: string; title: string; status: string; params: ResearchParams; currentVersionId: string | null }; initialTab?: string; initialVersionId?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.id === initialTab)?.id ?? "research") as Tab);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [title, setTitle] = useState(project.title);
  const [selectedId, setSelectedId] = useState<string | null>(initialVersionId ?? project.currentVersionId);
  const [version, setVersion] = useState<FullVersion | null>(null);
  const [running, setRunning] = useState<FullVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    const r = await api<{ project: { title: string; currentVersionId: string | null }; versions: VersionSummary[]; reports: ReportSummary[] }>(`/api/projects/${project.id}`);
    setVersions(r.versions);
    setReports(r.reports);
    setTitle(r.project.title);
    setSelectedId((cur) => cur ?? r.project.currentVersionId ?? r.versions[0]?.id ?? null);
    return r;
  }, [project.id]);

  useEffect(() => {
    loadProject().catch((e) => setError(e.message));
  }, [loadProject]);

  // versão em execução (mais recente em fila/execução) — acompanhada por polling
  const runningId = versions.find((v) => v.status === "running" || v.status === "queued")?.id ?? null;
  useEffect(() => {
    if (!runningId) {
      setRunning(null);
      return;
    }
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<{ version: FullVersion }>(`/api/projects/${project.id}/versions/${runningId}`);
        if (stop) return;
        setRunning(r.version);
        if (r.version.status === "completed" || r.version.status === "failed") {
          await loadProject();
          if (r.version.status === "completed") setSelectedId(r.version.id);
          return;
        }
      } catch {}
      if (!stop) setTimeout(tick, 4000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [runningId, project.id, loadProject]);

  const loadVersion = useCallback(async (id: string) => {
    const r = await api<{ version: FullVersion }>(`/api/projects/${project.id}/versions/${id}`);
    setVersion(r.version);
  }, [project.id]);
  useEffect(() => {
    if (selectedId) loadVersion(selectedId).catch((e) => setError(e.message));
  }, [selectedId, loadVersion]);

  const content = version?.status === "completed" ? version.content : null;
  const params = version?.params ?? project.params;
  const updateContent = useCallback((c: ResearchContent) => setVersion((v) => (v ? { ...v, content: c } : v)), []);

  const header = useMemo(() => (
    <PageHeader
      eyebrow={<Link href="/library" className="hover:underline">Biblioteca</Link>}
      title={title}
      subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{regionLabel(params)} · {params.historyStart}–{params.historyEnd}{params.projectionEnd ? ` (projeção até ${params.projectionEnd})` : ""} · {objectiveLabel(params.objective)}{version && <> · Versão {version.number} <StatusBadge status={version.status} /></>}</span>}
      actions={content ? <Link href={`/projects/${project.id}/reports/new?v=${version!.id}`} className="btn-primary"><FileText size={16} /> Criar relatório personalizado</Link> : undefined}
    />
  ), [title, params, version, content, project.id]);

  return (
    <>
      {header}
      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      {running && <div className="mb-6"><ProgressPanel version={running} /></div>}
      {!running && version?.status === "failed" && (
        <div className="mb-6"><ErrorNote><b>A versão {version.number} não foi concluída.</b> {version.error} {versions.some((v) => v.status === "completed") ? "Selecione uma versão concluída na aba Versões." : "Use a aba Versões para tentar novamente."}</ErrorNote></div>
      )}
      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-ink-200">
        {TABS.map((t) => (
          <button key={t.id} className={clsx("tab whitespace-nowrap", tab === t.id && "tab-active")} onClick={() => { setTab(t.id); router.replace(`/projects/${project.id}?tab=${t.id}${selectedId ? `&v=${selectedId}` : ""}`, { scroll: false }); }}>{t.label}</button>
        ))}
      </div>
      {tab === "versions" ? (
        <VersionsTab projectId={project.id} versions={versions} selectedId={selectedId} onSelect={setSelectedId} onCreated={async () => { await loadProject(); }} params={project.params} edits={content?.edits ?? []} onRenamed={setTitle} title={title} />
      ) : tab === "reports" ? (
        <ReportsTab projectId={project.id} reports={reports} versions={versions} selectedVersionId={content ? version!.id : null} onChanged={loadProject} />
      ) : !content ? (
        <div className="card p-10 text-center text-sm text-ink-500">{running ? "A pesquisa está em andamento. O conteúdo aparecerá aqui ao final da análise." : version ? "Esta versão não possui conteúdo concluído." : "Carregando…"}</div>
      ) : tab === "research" ? (
        <ResearchTab projectId={project.id} versionId={version!.id} content={content} onChange={updateContent} />
      ) : tab === "studio" ? (
        <StudioTab projectId={project.id} versionId={version!.id} content={content} onChange={updateContent} />
      ) : (
        <SourcesTab content={content} />
      )}
    </>
  );
}
