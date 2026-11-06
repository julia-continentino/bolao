"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { AGENTS, DEPTHS, type Depth, type Paragraph, type ResearchContent, type Section } from "@/lib/types";
import { ErrorNote, VerificationBadge } from "../ui";
import { ChartView } from "../ChartView";
import { sourceLine } from "@/lib/charts";

export function SourceRefs({ ids, content }: { ids: string[]; content: ResearchContent }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
      {ids.map((id) => {
        const idx = content.sources.findIndex((s) => s.id === id);
        const s = content.sources[idx];
        if (!s) return null;
        return (
          <a key={id} href={s.url ?? undefined} target="_blank" rel="noreferrer" title={`${s.publisher} — ${s.title}${s.date ? ` (${s.date})` : ""}${s.urlConfirmed ? "" : " · URL não confirmada"}`}
            className={clsx("num rounded px-1 text-[10px] font-semibold leading-4", s.urlConfirmed ? "bg-navy-100 text-navy-700 hover:bg-navy-300/50" : "bg-amber-100 text-amber-800")}>
            {idx + 1}
          </a>
        );
      })}
    </span>
  );
}

function sectionText(s: Section) {
  return `${s.title}\n\n${s.paragraphs.map((p) => p.text).join("\n\n")}`;
}

export function ResearchTab({ projectId, versionId, content, onChange }: { projectId: string; versionId: string; content: ResearchContent; onChange: (c: ResearchContent) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(content.sections.map((s) => [s.id, true])));
  const totals = useMemo(() => ({ paragraphs: content.sections.reduce((a, s) => a + s.paragraphs.length, 0), flagged: content.sections.reduce((a, s) => a + s.paragraphs.filter((p) => p.flagged).length, 0) }), [content]);

  const replaceSection = (s: Section) => onChange({ ...content, sections: content.sections.map((x) => (x.id === s.id ? s : x)) });

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
      <nav className="hidden xl:block">
        <div className="sticky top-6 space-y-0.5">
          {content.sections.map((s, i) => (
            <a key={s.id} href={`#sec-${s.id}`} className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-ink-700 hover:bg-white hover:text-navy-800">
              <span className="truncate"><span className="num mr-2 text-ink-500">{i + 1}.</span>{s.title}</span>
              <span className="num text-xs text-ink-500">{s.paragraphs.length}</span>
            </a>
          ))}
        </div>
      </nav>
      <div className="min-w-0 space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Parágrafos", totals.paragraphs],
            ["Datasets", content.datasets.length],
            ["Fontes", content.sources.length],
            ["Alertas de revisão", totals.flagged],
          ].map(([l, v]) => (
            <div key={l as string} className="card px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{l}</div><div className="num text-xl font-semibold text-navy-900">{v as number}</div></div>
          ))}
        </div>

        {content.answers.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Respostas às questões prioritárias</span></div>
            <ul className="divide-y divide-ink-200">
              {content.answers.map((a, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-navy-900">{a.question}</p>
                    <span className={clsx("badge shrink-0", a.status === "answered" ? "bg-emerald-50 text-emerald-800" : a.status === "partial" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800")}>{a.status === "answered" ? "Respondida" : a.status === "partial" ? "Parcial" : "Dados indisponíveis"}</span>
                  </div>
                  <p className="text-sm leading-6 text-ink-700">{a.answer}<SourceRefs ids={a.sourceIds} content={content} /></p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.limitations.length > 0 && (
          <details className="card px-5 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-amber-800">Limitações declaradas da pesquisa ({content.limitations.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-700">{content.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </details>
        )}

        {content.sections.map((s, i) => (
          <SectionCard key={s.id} index={i + 1} section={s} content={content} open={open[s.id] ?? true} onToggle={() => setOpen({ ...open, [s.id]: !open[s.id] })} projectId={projectId} versionId={versionId} onSaved={replaceSection} />
        ))}
      </div>
    </div>
  );
}

function SectionCard({ index, section, content, open, onToggle, projectId, versionId, onSaved }: { index: number; section: Section; content: ResearchContent; open: boolean; onToggle: () => void; projectId: string; versionId: string; onSaved: (s: Section) => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "regen">("view");
  const [draft, setDraft] = useState<Paragraph[]>(section.paragraphs);
  const [regen, setRegen] = useState<{ paragraphs: number; depth: Depth; instruction: string }>({ paragraphs: Math.max(1, section.paragraphs.length), depth: "analytical", instruction: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const datasets = content.datasets.filter((d) => section.datasetIds.includes(d.id));
  const charts = content.charts.filter((c) => c.sectionId === section.id && c.recommended && c.type !== "table").slice(0, 2);
  const agents = [...new Set(section.paragraphs.map((p) => p.agent))];
  const base = `/api/projects/${projectId}/versions/${versionId}/sections/${section.id}`;

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ section: Section }>(base, { method: "PATCH", json: { paragraphs: draft.filter((p) => p.text.trim()) } });
      onSaved(r.section);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ section: Section }>(`${base}/regenerate`, { method: "POST", json: { ...regen, instruction: regen.instruction || undefined } });
      onSaved(r.section);
      setDraft(r.section.paragraphs);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao regenerar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id={`sec-${section.id}`} className="card scroll-mt-6">
      <div className="card-header">
        <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
          {open ? <ChevronDown size={16} className="text-ink-500" /> : <ChevronRight size={16} className="text-ink-500" />}
          <span className="num text-sm text-ink-500">{index}.</span>
          <h2 className="truncate text-base font-semibold text-navy-900">{section.title}</h2>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-2 hidden text-xs text-ink-500 lg:inline">{agents.map((a) => (a === "user" ? "Editado pelo usuário" : AGENTS[a].short)).join(" · ")}</span>
          {mode === "view" && section.paragraphs.length > 0 && (
            <>
              <button className="btn-ghost btn-sm" title="Copiar seção" onClick={() => copy(sectionText(section), "all")}>{copied === "all" ? <Check size={14} /> : <Copy size={14} />}</button>
              <button className="btn-ghost btn-sm" title="Editar" onClick={() => { setDraft(section.paragraphs); setMode("edit"); }}><Pencil size={14} /></button>
              {section.id !== "methodology" && <button className="btn-ghost btn-sm" title="Regenerar texto" onClick={() => setMode("regen")}><RefreshCw size={14} /></button>}
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="px-5 py-4">
          {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
          {mode === "regen" && (
            <div className="mb-4 rounded-md border border-navy-100 bg-navy-50 p-4">
              <div className="mb-3 text-sm font-semibold text-navy-900">Regenerar texto da seção</div>
              <div className="grid gap-3 md:grid-cols-[140px_200px_1fr]">
                <div><label className="label">Parágrafos</label><input type="number" min={1} max={20} className="input" value={regen.paragraphs} onChange={(e) => setRegen({ ...regen, paragraphs: Number(e.target.value) })} /></div>
                <div><label className="label">Profundidade</label><select className="input" value={regen.depth} onChange={(e) => setRegen({ ...regen, depth: e.target.value as Depth })}>{DEPTHS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                <div><label className="label">Orientação (opcional)</label><input className="input" maxLength={1000} value={regen.instruction} onChange={(e) => setRegen({ ...regen, instruction: e.target.value })} placeholder="Ex.: enfatizar margens das líderes" /></div>
              </div>
              <p className="hint">O texto é reescrito apenas com o material verificado desta seção; nenhum dado novo é acrescentado.</p>
              <div className="mt-3 flex gap-2"><button className="btn-primary btn-sm" disabled={busy} onClick={regenerate}>{busy ? "Regenerando…" : "Regenerar"}</button><button className="btn-secondary btn-sm" onClick={() => setMode("view")}>Cancelar</button></div>
            </div>
          )}

          {mode === "edit" ? (
            <div className="space-y-3">
              {draft.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <textarea className="input min-h-[110px] font-serif text-[15px] leading-7" value={p.text} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  <button className="btn-ghost btn-sm h-fit" title="Remover parágrafo" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary btn-sm" onClick={() => setDraft([...draft, { id: "", text: "", sourceIds: [], datasetIds: [], agent: "user" }])}><Plus size={14} /> Parágrafo</button>
                <span className="flex-1" />
                <button className="btn-secondary btn-sm" onClick={() => setMode("view")}><X size={14} /> Cancelar</button>
                <button className="btn-primary btn-sm" disabled={busy} onClick={save}><Check size={14} /> {busy ? "Salvando…" : "Salvar seção"}</button>
              </div>
              <p className="hint">Fontes associadas a parágrafos existentes são preservadas; parágrafos novos ficam sem fonte e são identificados como edição do usuário.</p>
            </div>
          ) : section.paragraphs.length === 0 ? (
            <p className="text-sm text-ink-500">Sem conteúdo fundamentado para esta seção.</p>
          ) : (
            <div className="space-y-3">
              {section.paragraphs.map((p) => (
                <div key={p.id} className="group relative">
                  <p className="pr-8 font-serif text-[15px] leading-7 text-ink-900">{p.text}<SourceRefs ids={p.sourceIds} content={content} /></p>
                  {p.flagged && <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{p.flagged}</p>}
                  <button className="absolute right-0 top-0 hidden rounded p-1 text-ink-500 hover:bg-ink-100 group-hover:block" title="Copiar parágrafo" onClick={() => copy(p.text, p.id)}>{copied === p.id ? <Check size={13} /> : <Copy size={13} />}</button>
                </div>
              ))}
            </div>
          )}

          {(section.keyFindings.length > 0 || section.limitations.length > 0) && mode === "view" && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {section.keyFindings.length > 0 && (
                <div><div className="label">Principais achados</div><ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">{section.keyFindings.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
              )}
              {section.limitations.length > 0 && (
                <div><div className="label">Limitações</div><ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{section.limitations.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
              )}
            </div>
          )}

          {mode === "view" && charts.length > 0 && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {charts.map((c) => {
                const d = content.datasets.find((x) => x.id === c.datasetId)!;
                return (
                  <figure key={c.id} className="rounded-md border border-ink-200 p-3">
                    <figcaption className="mb-2"><div className="text-sm font-semibold text-navy-900">{c.title}</div><div className="text-xs text-ink-500">{c.subtitle}</div></figcaption>
                    <ChartView spec={c} dataset={d} height={220} />
                    <p className="mt-2 text-[11px] italic text-ink-500">{sourceLine(d, content.sources)}</p>
                  </figure>
                );
              })}
            </div>
          )}

          {mode === "view" && datasets.length > 0 && (
            <div className="mt-5">
              <div className="label">Dados estruturados desta seção</div>
              <ul className="divide-y divide-ink-200 rounded-md border border-ink-200">
                {datasets.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink-900">{d.title} <span className="text-xs text-ink-500">· {d.unit} · {d.period} · {d.region}</span></span>
                    <VerificationBadge status={d.verification.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
