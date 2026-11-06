"use client";
import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Copy, Download, FileSpreadsheet, ImageDown, Plus, Save, Star, Trash2 } from "lucide-react";
import { api, download } from "@/lib/client/api";
import { chartToPng, copyPng, downloadDataUrl } from "@/lib/client/png";
import { seriesMeta, sourceLine } from "@/lib/charts";
import { CHART_TYPES, DATA_NATURE_LABEL, DEFAULT_PALETTE, SECTION_DEFS, SOURCE_TYPE_LABEL, type ChartSpec, type ChartType, type ResearchContent, type SectionId } from "@/lib/types";
import { ChartView } from "../ChartView";
import { Empty, ErrorNote, InfoNote, NatureBadge, VerificationBadge } from "../ui";

export function StudioTab({ projectId, versionId, content, onChange }: { projectId: string; versionId: string; content: ResearchContent; onChange: (c: ResearchContent) => void }) {
  const [filter, setFilter] = useState<"all" | "recommended" | "charts" | "tables" | "user">("all");
  const [selected, setSelected] = useState<string | null>(content.charts[0]?.id ?? null);
  const [draft, setDraft] = useState<ChartSpec | null>(content.charts[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [newDs, setNewDs] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const usable = content.datasets.filter((d) => d.verification.status !== "rejected");
  const rejected = content.datasets.filter((d) => d.verification.status === "rejected");

  const list = useMemo(() => content.charts.filter((c) =>
    filter === "all" ? true : filter === "recommended" ? c.recommended : filter === "charts" ? c.type !== "table" : filter === "tables" ? c.type === "table" : c.origin === "user",
  ).sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.priority - b.priority), [content.charts, filter]);

  const dataset = draft ? content.datasets.find((d) => d.id === draft.datasetId) : undefined;
  const saved = content.charts.find((c) => c.id === draft?.id);
  const dirty = !!draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const units = dataset && draft ? [...new Set(draft.seriesKeys.map((k) => dataset.series.find((s) => s.key === k)?.unit))] : [];

  function pick(c: ChartSpec) {
    setSelected(c.id);
    setDraft(structuredClone(c));
    setMsg(null);
  }
  async function persist(charts: ChartSpec[], okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ charts: ChartSpec[] }>(`/api/projects/${projectId}/versions/${versionId}/charts`, { method: "PUT", json: { charts } });
      onChange({ ...content, charts: r.charts });
      setMsg({ type: "ok", text: okText });
      return true;
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao salvar." });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const save = () => draft && persist(content.charts.some((c) => c.id === draft.id) ? content.charts.map((c) => (c.id === draft.id ? draft : c)) : [...content.charts, draft], "Visualização salva.");
  const duplicate = async () => {
    if (!draft) return;
    const copy: ChartSpec = { ...structuredClone(draft), id: `user-${Date.now()}`, title: `${draft.title} (cópia)`, origin: "user" };
    if (await persist([...content.charts, copy], "Visualização duplicada.")) pick(copy);
  };
  const remove = async () => {
    if (!draft || !confirm("Excluir esta visualização?")) return;
    const rest = content.charts.filter((c) => c.id !== draft.id);
    if (await persist(rest, "Visualização excluída.")) {
      setSelected(rest[0]?.id ?? null);
      setDraft(rest[0] ? structuredClone(rest[0]) : null);
    }
  };
  async function create() {
    const d = usable.find((x) => x.id === newDs);
    if (!d) return;
    const unit = d.series[0].unit;
    const spec: ChartSpec = {
      id: `user-${Date.now()}`, datasetId: d.id, type: d.kind === "comparison" ? "bar" : d.kind === "composition" ? "pie" : "column",
      title: d.title, subtitle: `${unit} · ${d.period} · ${d.region}`, seriesKeys: d.series.filter((s) => s.unit === unit).map((s) => s.key).slice(0, 4), rowLabels: null,
      colors: Object.fromEntries(d.series.map((s, i) => [s.key, DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]])), showLegend: true, showDataLabels: d.rows.length <= 8,
      sectionId: d.sectionId, rationale: "Criada pelo usuário.", priority: 3, recommended: false, origin: "user",
    };
    if (await persist([...content.charts, spec], "Visualização criada.")) {
      pick(spec);
      setNewDs("");
    }
  }
  async function png(action: "download" | "copy") {
    if (!draft || !dataset || !previewRef.current) return;
    try {
      const img = draft.type === "table" ? null : await chartToPng(previewRef.current, {
        title: draft.title, subtitle: draft.subtitle, footer: sourceLine(dataset, content.sources),
        legend: draft.showLegend && draft.type !== "pie" ? seriesMeta(dataset, draft).map((m) => ({ label: m.label, color: m.color })) : undefined,
      });
      if (!img) return setMsg({ type: "err", text: "Tabelas são exportadas em Excel." });
      if (action === "download") downloadDataUrl(img.dataUrl, `${draft.title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "grafico"}.png`);
      else {
        await copyPng(img.dataUrl);
        setMsg({ type: "ok", text: "Imagem copiada para a área de transferência." });
      }
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao exportar." });
    }
  }
  async function excel(all: boolean) {
    try {
      if (!all && dirty) await save();
      await download(`/api/projects/${projectId}/versions/${versionId}/export`, all ? {} : { chartIds: [draft!.id] }, "dados.xlsx");
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao exportar." });
    }
  }

  const set = <K extends keyof ChartSpec>(k: K, v: ChartSpec[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "recommended", "charts", "tables", "user"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={clsx("rounded-full border px-3 py-1 text-xs font-medium", filter === f ? "border-navy-800 bg-navy-800 text-white" : "border-ink-300 bg-white text-ink-700")}>
            {{ all: "Todas", recommended: "Recomendadas pela IA", charts: "Gráficos", tables: "Tabelas", user: "Criadas por mim" }[f]}
          </button>
        ))}
        <span className="flex-1" />
        <select className="input w-auto max-w-xs" value={newDs} onChange={(e) => setNewDs(e.target.value)}>
          <option value="">Nova visualização a partir de…</option>
          {usable.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <button className="btn-secondary" disabled={!newDs || busy} onClick={create}><Plus size={15} /> Criar</button>
        <button className="btn-secondary" onClick={() => excel(true)}><FileSpreadsheet size={15} /> Base completa (.xlsx)</button>
      </div>
      {rejected.length > 0 && <InfoNote tone="warn">{rejected.length} conjunto(s) de dados rejeitado(s) na verificação não podem ser usados em gráficos: {rejected.map((d) => d.title).join("; ")}.</InfoNote>}
      {content.charts.length === 0 ? <Empty title="Nenhuma visualização disponível">Não há dados verificados suficientes para gerar gráficos nesta versão.</Empty> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            {draft && dataset && (
              <div className="card">
                <div className="card-header">
                  <div className="min-w-0"><div className="truncate font-semibold text-navy-900">{draft.title || "Sem título"}</div><div className="truncate text-xs text-ink-500">{draft.subtitle}</div></div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-ghost btn-sm" title="Baixar PNG" onClick={() => png("download")}><ImageDown size={15} /></button>
                    <button className="btn-ghost btn-sm" title="Copiar imagem" onClick={() => png("copy")}><Copy size={15} /></button>
                    <button className="btn-ghost btn-sm" title="Exportar dados (.xlsx)" onClick={() => excel(false)}><Download size={15} /></button>
                  </div>
                </div>
                <div className="p-5">
                  <ChartView ref={previewRef} spec={draft} dataset={dataset} height={340} />
                  <p className="mt-3 text-[11px] italic text-ink-500">{sourceLine(dataset, content.sources)}</p>
                  {draft.rationale && <p className="mt-2 text-xs text-ink-500"><b>Racional:</b> {draft.rationale}</p>}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {list.map((c) => {
                const d = content.datasets.find((x) => x.id === c.datasetId);
                if (!d) return null;
                return (
                  <button key={c.id} onClick={() => pick(c)} className={clsx("card p-3 text-left transition hover:border-navy-300", selected === c.id && "ring-2 ring-navy-500")}>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-semibold text-navy-900">{c.title}</span>
                      {c.recommended && <Star size={14} className="shrink-0 fill-amber-400 text-amber-500" aria-label="Recomendada" />}
                    </div>
                    <div className="mb-2 text-[11px] text-ink-500">{CHART_TYPES.find((t) => t.value === c.type)?.label} · {SECTION_DEFS.find((s) => s.id === c.sectionId)?.title}</div>
                    <div className="pointer-events-none max-h-[160px] overflow-hidden"><ChartView spec={c} dataset={d} height={150} /></div>
                  </button>
                );
              })}
            </div>
          </div>

          {draft && dataset && (
            <aside className="card h-fit xl:sticky xl:top-6">
              <div className="card-header"><span className="card-title">Personalizar</span>{dirty && <span className="badge bg-amber-50 text-amber-800">Não salvo</span>}</div>
              <div className="max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto p-5">
                {msg && (msg.type === "err" ? <ErrorNote>{msg.text}</ErrorNote> : <p className="text-sm text-emerald-700">{msg.text}</p>)}
                <div><label className="label">Tipo</label>
                  <select className="input" value={draft.type} onChange={(e) => set("type", e.target.value as ChartType)}>{CHART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                </div>
                <div><label className="label">Título</label><input className="input" maxLength={200} value={draft.title} onChange={(e) => set("title", e.target.value)} /></div>
                <div><label className="label">Subtítulo</label><input className="input" maxLength={300} value={draft.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></div>
                <div>
                  <label className="label">Indicadores</label>
                  <div className="space-y-1.5">
                    {dataset.series.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={draft.seriesKeys.includes(s.key)} onChange={(e) => set("seriesKeys", e.target.checked ? [...draft.seriesKeys, s.key] : draft.seriesKeys.filter((k) => k !== s.key).length ? draft.seriesKeys.filter((k) => k !== s.key) : draft.seriesKeys)} />
                        <input type="color" className="h-6 w-6 cursor-pointer rounded border border-ink-300" value={draft.colors[s.key] ?? "#2a78d6"} onChange={(e) => set("colors", { ...draft.colors, [s.key]: e.target.value })} aria-label={`Cor de ${s.label}`} />
                        <span className="flex-1 truncate">{s.label}</span><span className="text-xs text-ink-500">{s.unit}</span>
                      </div>
                    ))}
                  </div>
                  {draft.type !== "table" && units.length > 1 && <p className="mt-2 text-xs text-amber-800">Indicadores com unidades diferentes ({units.join(", ")}) no mesmo gráfico distorcem a leitura. Use gráficos separados ou uma tabela.</p>}
                  {draft.type === "pie" && draft.seriesKeys.length > 1 && <p className="mt-2 text-xs text-amber-800">Gráficos de composição usam apenas o primeiro indicador selecionado.</p>}
                </div>
                <div>
                  <label className="label">{dataset.dimension} ({draft.rowLabels?.length ?? dataset.rows.length}/{dataset.rows.length})</label>
                  <div className="mb-1 flex gap-2 text-xs"><button className="text-navy-600 hover:underline" onClick={() => set("rowLabels", null)}>Todos</button></div>
                  <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-sm">
                    {dataset.rows.map((r) => {
                      const on = !draft.rowLabels || draft.rowLabels.includes(r.label);
                      return (
                        <label key={r.label} className="flex items-center gap-1.5 truncate">
                          <input type="checkbox" checked={on} onChange={(e) => {
                            const cur = draft.rowLabels ?? dataset.rows.map((x) => x.label);
                            const next = e.target.checked ? [...cur, r.label] : cur.filter((x) => x !== r.label);
                            set("rowLabels", next.length === dataset.rows.length ? null : next.length ? dataset.rows.map((x) => x.label).filter((x) => next.includes(x)) : cur);
                          }} />
                          <span className="truncate" title={DATA_NATURE_LABEL[r.nature]}>{r.label}{r.nature !== "historical" ? (r.nature === "own_projection" ? " (P)" : " (E)") : ""}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={draft.showLegend} onChange={(e) => set("showLegend", e.target.checked)} /> Legenda</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={draft.showDataLabels} onChange={(e) => set("showDataLabels", e.target.checked)} /> Rótulos de dados</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={draft.recommended} onChange={(e) => set("recommended", e.target.checked)} /> Recomendado</label>
                </div>
                <div><label className="label">Seção do relatório</label>
                  <select className="input" value={draft.sectionId} onChange={(e) => set("sectionId", e.target.value as SectionId)}>{SECTION_DEFS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-ink-200 pt-4">
                  <button className="btn-primary btn-sm" disabled={!dirty || busy} onClick={save}><Save size={14} /> Salvar</button>
                  <button className="btn-secondary btn-sm" disabled={busy} onClick={duplicate}><Copy size={14} /> Duplicar</button>
                  {saved && <button className="btn-secondary btn-sm" disabled={!dirty} onClick={() => setDraft(structuredClone(saved))}>Desfazer</button>}
                  <button className="btn-danger btn-sm" disabled={busy} onClick={remove}><Trash2 size={14} /></button>
                </div>
                <div className="border-t border-ink-200 pt-4">
                  <div className="label">Fonte dos dados</div>
                  <div className="mb-2 flex flex-wrap gap-1.5"><VerificationBadge status={dataset.verification.status} />{[...new Set(dataset.rows.map((r) => r.nature))].map((n) => <NatureBadge key={n} nature={n} />)}</div>
                  <p className="text-xs text-ink-700">{dataset.description}</p>
                  <dl className="mt-2 grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 text-xs"><dt className="text-ink-500">Unidade</dt><dd>{dataset.unit}</dd><dt className="text-ink-500">Moeda</dt><dd>{dataset.currency ?? "—"}</dd><dt className="text-ink-500">Região</dt><dd>{dataset.region}</dd><dt className="text-ink-500">Período</dt><dd>{dataset.period}</dd></dl>
                  {dataset.methodology && <p className="mt-2 text-xs text-ink-700"><b>Metodologia:</b> {dataset.methodology}</p>}
                  <ul className="mt-2 space-y-1.5">
                    {[...new Set([...dataset.sourceIds, ...dataset.rows.flatMap((r) => r.sourceIds)])].map((id) => {
                      const s = content.sources.find((x) => x.id === id);
                      return s ? <li key={id} className="text-xs"><a href={s.url ?? undefined} target="_blank" rel="noreferrer" className="font-medium text-navy-700 hover:underline">{s.publisher} — {s.title}</a><span className="text-ink-500"> · {SOURCE_TYPE_LABEL[s.type]}{s.date ? ` · ${s.date}` : ""}{s.urlConfirmed ? "" : " · URL não confirmada"}</span></li> : null;
                    })}
                  </ul>
                  {dataset.verification.notes.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-ink-500">{dataset.verification.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
