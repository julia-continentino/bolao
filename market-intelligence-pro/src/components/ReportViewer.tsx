"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, Copy, Download, Loader2, Pencil, RefreshCw, Settings2, X } from "lucide-react";
import { api, download } from "@/lib/client/api";
import { chartToPng } from "@/lib/client/png";
import { seriesMeta, sourceLine } from "@/lib/charts";
import { DEPTHS, REPORT_FORMATS, type ReportBlock, type ReportConfig, type ReportContent, type ResearchContent } from "@/lib/types";
import { ChartView } from "./ChartView";
import { ReportBuilder } from "./ReportBuilder";
import { ErrorNote, InfoNote, PageHeader, StatusBadge } from "./ui";

interface ReportData { id: string; title: string; status: string; error: string | null; config: ReportConfig; content: ReportContent | null; versionId: string; updatedAt: string }

export function ReportViewer({ reportId, projectId, projectTitle }: { reportId: string; projectId: string; projectTitle: string }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [research, setResearch] = useState<ResearchContent | null>(null);
  const [revisions, setRevisions] = useState<{ id: string; createdAt: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; config: ReportConfig }[]>([]);
  const offscreen = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    const r = await api<{ report: ReportData; research: ResearchContent | null; revisions: { id: string; createdAt: string }[] }>(`/api/reports/${reportId}`);
    setReport(r.report);
    setResearch(r.research);
    setRevisions(r.revisions);
    return r.report;
  }, [reportId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await load();
        if (!stop && r.status === "generating") setTimeout(tick, 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar.");
      }
    };
    tick();
    return () => { stop = true; };
  }, [load]);

  async function exportAs(format: "pptx" | "docx" | "pdf" | "xlsx") {
    if (!report?.content || !research) return;
    setExporting(format);
    setError(null);
    try {
      const images: Record<string, { dataUrl: string; width: number; height: number }> = {};
      if (format === "docx" || format === "pdf") {
        for (const v of report.content.visuals) {
          const el = offscreen.current[v.id];
          const d = research.datasets.find((x) => x.id === v.datasetId);
          if (!el || !d || v.type === "table") continue;
          images[v.id] = await chartToPng(el, { legend: v.showLegend && v.type !== "pie" && v.seriesKeys.length > 1 ? seriesMeta(d, v).map((m) => ({ label: m.label, color: m.color })) : undefined });
        }
      }
      await download(`/api/reports/${reportId}/export`, { format, images }, `relatorio.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na exportação.");
    } finally {
      setExporting(null);
    }
  }
  async function regenerate() {
    await api(`/api/reports/${reportId}/regenerate`, { method: "POST" });
    window.location.reload();
  }
  async function openEditor() {
    if (!templates.length) setTemplates((await api<{ templates: { id: string; name: string; config: ReportConfig }[] }>("/api/templates")).templates);
    setEditing(true);
  }

  if (!report) return <div className="text-sm text-ink-500">{error ?? "Carregando…"}</div>;
  const content = report.content;
  const slides = REPORT_FORMATS.find((f) => f.value === report.config.format)?.output === "slides";

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/projects/${projectId}?tab=reports`} className="hover:underline">{projectTitle}</Link>}
        title={report.title}
        subtitle={<span className="flex flex-wrap items-center gap-2">{REPORT_FORMATS.find((f) => f.value === report.config.format)?.label} · {DEPTHS.find((d) => d.value === report.config.depth)?.label} · {content ? `${content.sections.reduce((a, s) => a + s.paragraphs.length, 0)} parágrafos · ${content.visuals.length} visualizações · ${content.pages.length + 1} ${slides ? "slides" : "páginas"}` : ""} <StatusBadge status={report.status} /></span>}
        actions={content && report.status !== "generating" ? (
          <>
            <button className="btn-secondary" onClick={openEditor}><Settings2 size={15} /> Personalizar</button>
            <button className="btn-secondary" onClick={regenerate}><RefreshCw size={15} /> Regenerar</button>
            {(["pptx", "docx", "pdf", "xlsx"] as const).map((f) => (
              <button key={f} className="btn-primary" disabled={!!exporting} onClick={() => exportAs(f)}>{exporting === f ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {f.toUpperCase()}</button>
            ))}
          </>
        ) : undefined}
      />
      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      {report.status === "generating" && <div className="card mb-6 flex items-center gap-3 p-5 text-sm text-ink-700"><Loader2 className="animate-spin text-navy-600" size={18} /> Reescrevendo as seções na quantidade de parágrafos definida e montando o layout…</div>}
      {report.status === "failed" && <div className="mb-6"><ErrorNote><b>Falha na geração.</b> {report.error}</ErrorNote></div>}
      {content?.warnings.length ? <div className="mb-6"><InfoNote tone="warn"><ul className="list-disc pl-4">{content.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></InfoNote></div> : null}

      {editing && research && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-navy-900">Personalizar relatório</h2><button className="btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={14} /> Fechar</button></div>
          <ReportBuilder mode="edit" reportId={reportId} projectId={projectId} versionId={report.versionId} projectTitle={projectTitle} content={research} templates={templates} initialConfig={report.config} />
        </div>
      )}

      {content && research && (
        <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
          <div className={clsx("mx-auto w-full space-y-6", slides ? "max-w-[1000px]" : "max-w-[820px]")}>
            <div className={clsx("flex flex-col justify-center bg-navy-900 p-12 text-white shadow-card", slides ? "aspect-video" : "aspect-[1/1.414]")}>
              <div className="text-xs uppercase tracking-[0.25em] text-navy-300">Market Intelligence Pro</div>
              <h2 className="mt-4 font-serif text-4xl leading-tight">{report.title}</h2>
              <p className="mt-4 text-navy-300">Elaborado em {new Date(content.generatedAt).toLocaleDateString("pt-BR")}</p>
            </div>
            {content.pages.map((page) => (
              <Page key={page.number} page={page} slides={slides} content={content} research={research} reportId={reportId} onEdited={load} />
            ))}
          </div>
          <aside className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
            <div className="card p-4 text-sm">
              <div className="card-title mb-2">Histórico</div>
              <p className="text-ink-700">Versão atual: {new Date(content.generatedAt).toLocaleString("pt-BR")}</p>
              {revisions.length > 0 ? <ul className="mt-2 space-y-1 text-xs text-ink-500">{revisions.map((r) => <li key={r.id}>Revisão anterior · {new Date(r.createdAt).toLocaleString("pt-BR")}</li>)}</ul> : <p className="mt-1 text-xs text-ink-500">Sem revisões anteriores.</p>}
            </div>
            <div className="card p-4 text-xs text-ink-500">Exportação: PowerPoint com gráficos e tabelas nativos editáveis; Word e PDF com gráficos em imagem e tabelas; Excel com a base numérica e as fontes.</div>
          </aside>
        </div>
      )}

      {/* Renderização fora da tela, em tamanho fixo, para exportar gráficos como imagem */}
      {content && research && (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 760 }}>
          {content.visuals.filter((v) => v.type !== "table").map((v) => {
            const d = research.datasets.find((x) => x.id === v.datasetId);
            return d ? <div key={v.id} ref={(el) => { offscreen.current[v.id] = el; }}><ChartView spec={{ ...v, showLegend: false }} dataset={d} width={720} height={340} /></div> : null;
          })}
        </div>
      )}
    </>
  );
}

function Page({ page, slides, content, research, reportId, onEdited }: { page: ReportContent["pages"][number]; slides: boolean; content: ReportContent; research: ResearchContent; reportId: string; onEdited: () => Promise<unknown> }) {
  const numbering = new Map(content.usedSourceIds.map((id, i) => [id, i + 1]));
  const visuals = page.blocks.filter((b) => b.kind === "visual");
  const texts = page.blocks.filter((b) => b.kind !== "visual");
  const body = (blocks: ReportBlock[]) => blocks.map((b, i) => <Block key={i} block={b} content={content} research={research} numbering={numbering} reportId={reportId} onEdited={onEdited} slides={slides} />);
  return (
    <div className={clsx("relative bg-white shadow-card", slides ? "aspect-video overflow-hidden p-8" : "min-h-[400px] px-14 py-12")}>
      <div className="absolute left-0 right-0 top-0 h-1.5 bg-navy-800" />
      {(slides || page.blocks[0]?.kind !== "heading") && <h2 className={clsx("mb-4 font-semibold text-navy-900", slides ? "text-2xl" : "text-xl")}>{page.title}</h2>}
      {slides && visuals.length && texts.length ? (
        <div className="grid h-[calc(100%-3rem)] grid-cols-[45%_1fr] gap-6 overflow-hidden"><div className="overflow-hidden text-[13px]">{body(texts)}</div><div className="overflow-hidden">{body(visuals)}</div></div>
      ) : body(page.blocks)}
      <div className="absolute bottom-3 right-5 text-[10px] text-ink-500">{page.number}</div>
    </div>
  );
}

function Block({ block, content, research, numbering, reportId, onEdited, slides }: { block: ReportBlock; content: ReportContent; research: ResearchContent; numbering: Map<string, number>; reportId: string; onEdited: () => Promise<unknown>; slides: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/reports/${reportId}/paragraph`, { method: "PATCH", json: { paragraphId: id, text: edit } });
      await onEdited();
      setEdit(null);
    } finally {
      setBusy(false);
    }
  };
  if (block.kind === "heading") return <h2 className="mb-3 mt-2 text-xl font-semibold text-navy-900">{block.text}</h2>;
  if (block.kind === "paragraph" || block.kind === "summary") {
    const id = block.kind === "paragraph" ? block.id : "summary";
    const cites = block.kind === "paragraph" ? [...new Set(block.sourceIds.map((s) => numbering.get(s)).filter(Boolean))].sort((a, b) => a! - b!) : [];
    if (edit !== null) {
      return (
        <div className="mb-3">
          <textarea className="input min-h-[140px] font-serif text-[15px] leading-7" value={edit} onChange={(e) => setEdit(e.target.value)} />
          <div className="mt-2 flex gap-2"><button className="btn-primary btn-sm" disabled={busy} onClick={() => save(id)}><Check size={13} /> Salvar</button><button className="btn-secondary btn-sm" onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      );
    }
    return (
      <div className={clsx("group relative", block.kind === "summary" && "mb-4 border-l-4 border-navy-700 bg-navy-50 px-4 py-3")}>
        <p className={clsx("pr-12 font-serif text-ink-900", slides ? "mb-2 text-[13px] leading-6" : "mb-3 text-justify text-[15px] leading-7")}>
          {block.text}
          {cites.length > 0 && <sup className="ml-0.5 text-[10px] text-ink-500">[{cites.join(", ")}]</sup>}
        </p>
        <div className="absolute right-0 top-0 hidden gap-0.5 group-hover:flex">
          <button className="rounded p-1 text-ink-500 hover:bg-ink-100" title="Copiar" onClick={async () => { await navigator.clipboard.writeText(block.text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
          <button className="rounded p-1 text-ink-500 hover:bg-ink-100" title="Editar" onClick={() => setEdit(block.text)}><Pencil size={13} /></button>
        </div>
      </div>
    );
  }
  if (block.kind === "visual") {
    const c = content.visuals.find((v) => v.id === block.chartId);
    const d = c ? research.datasets.find((x) => x.id === c.datasetId) : undefined;
    if (!c || !d) return null;
    return (
      <figure className="my-4">
        <figcaption className="mb-2"><div className="text-sm font-semibold text-navy-900">{c.title}</div><div className="text-xs text-ink-500">{c.subtitle}</div></figcaption>
        <ChartView spec={c} dataset={d} height={slides ? 240 : 280} />
        <p className="mt-1.5 text-[11px] italic text-ink-500">{sourceLine(d, research.sources)}</p>
      </figure>
    );
  }
  return (
    <ol className="space-y-1.5 text-xs text-ink-700">
      {block.sourceIds.map((id) => {
        const s = research.sources.find((x) => x.id === id);
        return s ? <li key={id}><span className="num font-semibold">[{numbering.get(id)}]</span> {s.publisher}. {s.title}.{s.date ? ` (${s.date}).` : ""} {s.url && <a className="break-all text-navy-600 hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>}</li> : null;
      })}
    </ol>
  );
}
