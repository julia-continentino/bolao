"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Star } from "lucide-react";
import { api } from "@/lib/client/api";
import {
  DEPTHS, PARAGRAPH_PRESETS, REPORT_FORMATS, SECTION_DEFS, VISUAL_MODES,
  type ReportConfig, type ResearchContent, type SectionId,
} from "@/lib/types";
import { ChartView } from "./ChartView";
import { ErrorNote, InfoNote } from "./ui";

const REJECTED = (c: ResearchContent) => new Set(c.datasets.filter((d) => d.verification.status === "rejected").map((d) => d.id));

export function defaultConfig(content: ResearchContent, title: string): ReportConfig {
  return {
    title,
    format: "sector",
    depth: "analytical",
    paragraphMode: "global",
    totalParagraphs: 12,
    sections: SECTION_DEFS.map((s) => {
      const sec = content.sections.find((x) => x.id === s.id);
      return { id: s.id, include: !!sec?.paragraphs.length && s.id !== "methodology", paragraphs: Math.min(3, Math.max(1, sec?.paragraphs.length ?? 1)) };
    }),
    visualMode: "text_charts_tables",
    selectedVisualIds: content.charts.filter((c) => c.recommended).map((c) => c.id),
    targetPages: null,
    includeSourcesAppendix: true,
    includeExecutiveSummary: true,
  };
}

/** Ajusta uma configuração (ex.: de um modelo) às seções/visualizações desta pesquisa */
function adapt(cfg: ReportConfig, content: ResearchContent, title: string): ReportConfig {
  const base = defaultConfig(content, title);
  return {
    ...base,
    ...cfg,
    title,
    sections: base.sections.map((s) => {
      const t = cfg.sections.find((x) => x.id === s.id);
      const has = !!content.sections.find((x) => x.id === s.id)?.paragraphs.length;
      return t ? { ...t, include: t.include && has } : s;
    }),
    selectedVisualIds: cfg.selectedVisualIds.filter((id) => content.charts.some((c) => c.id === id)),
  };
}

export function ReportBuilder({ mode, projectId, versionId, projectTitle, content, templates, initialTemplateId, initialConfig, reportId }: {
  mode: "create" | "edit"; projectId: string; versionId: string; projectTitle: string; content: ResearchContent;
  templates: { id: string; name: string; config: ReportConfig }[]; initialTemplateId?: string; initialConfig?: ReportConfig; reportId?: string;
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState<ReportConfig>(() => {
    if (initialConfig) return initialConfig;
    const t = templates.find((x) => x.id === initialTemplateId);
    return t ? adapt(t.config, content, `Relatório — ${projectTitle}`) : defaultConfig(content, `Relatório — ${projectTitle}`);
  });
  const [custom, setCustom] = useState(!PARAGRAPH_PRESETS.some((p) => p.value === cfg.totalParagraphs));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplMsg, setTplMsg] = useState<string | null>(null);
  const set = <K extends keyof ReportConfig>(k: K, v: ReportConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const slides = REPORT_FORMATS.find((f) => f.value === cfg.format)?.output === "slides";

  const rejected = REJECTED(content);
  const visuals = content.charts.filter((c) => !rejected.has(c.datasetId));
  const included = cfg.sections.filter((s) => s.include);
  const total = cfg.paragraphMode === "global" ? cfg.totalParagraphs : included.reduce((a, s) => a + s.paragraphs, 0);
  const recommended = useMemo(() => visuals.filter((c) => c.recommended).sort((a, b) => a.priority - b.priority), [visuals]);
  const globalTooFew = cfg.paragraphMode === "global" && cfg.totalParagraphs < included.length;

  function toggleSection(id: SectionId, include: boolean) {
    set("sections", cfg.sections.map((s) => (s.id === id ? { ...s, include } : s)));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "create") {
        const r = await api<{ reportId: string }>("/api/reports", { method: "POST", json: { projectId, versionId, config: cfg } });
        router.push(`/reports/${r.reportId}`);
      } else {
        await api(`/api/reports/${reportId}`, { method: "PATCH", json: { config: cfg } });
        router.refresh();
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar relatório.");
      setBusy(false);
    }
  }
  async function saveTemplate() {
    setTplMsg(null);
    try {
      await api("/api/templates", { method: "POST", json: { name: tplName, config: cfg } });
      setTplMsg("Modelo salvo.");
      setTplName("");
    } catch (e) {
      setTplMsg(e instanceof Error ? e.message : "Falha ao salvar modelo.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* 1. Formato */}
        <div className="card p-6">
          <div className="card-title mb-4">1 · Formato do relatório</div>
          <div className="mb-4"><label className="label">Título</label><input className="input" maxLength={200} value={cfg.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_FORMATS.map((f) => (
              <button key={f.value} type="button" onClick={() => set("format", f.value)} className={clsx("rounded-md border px-3 py-3 text-left text-sm", cfg.format === f.value ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-ink-300 bg-white hover:border-navy-300")}>
                <div className="font-medium text-ink-900">{f.label}</div><div className="text-xs text-ink-500">{f.output === "slides" ? "Slides" : "Documento"}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.targetPages != null} onChange={(e) => set("targetPages", e.target.checked ? (slides ? 12 : 10) : null)} /> Definir quantidade de {slides ? "slides" : "páginas"}</label>
            {cfg.targetPages != null && <input type="number" min={2} max={200} className="input w-24" value={cfg.targetPages} onChange={(e) => set("targetPages", Math.max(1, Number(e.target.value)))} />}
            <span className="hint mt-0">Inclui capa e anexo de fontes. O sistema distribui o conteúdo sem sobrecarregar {slides ? "slides" : "páginas"}.</span>
          </div>
        </div>

        {/* 2. Parágrafos */}
        <div className="card p-6">
          <div className="card-title mb-4">2 · Quantidade de parágrafos</div>
          <div className="mb-4 inline-flex rounded-md border border-ink-300 p-0.5 text-sm">
            <button type="button" className={clsx("rounded px-3 py-1.5", cfg.paragraphMode === "global" && "bg-navy-800 text-white")} onClick={() => set("paragraphMode", "global")}>Relatório completo</button>
            <button type="button" className={clsx("rounded px-3 py-1.5", cfg.paragraphMode === "per_section" && "bg-navy-800 text-white")} onClick={() => set("paragraphMode", "per_section")}>Por seção</button>
          </div>
          {cfg.paragraphMode === "global" && (
            <div className="mb-5">
              <div className="flex flex-wrap gap-2">
                {PARAGRAPH_PRESETS.map((p) => (
                  <button key={p.value} type="button" onClick={() => { setCustom(false); set("totalParagraphs", p.value); }} className={clsx("rounded-md border px-3 py-2 text-left", !custom && cfg.totalParagraphs === p.value ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-ink-300 bg-white")}>
                    <div className="text-sm font-semibold text-ink-900">{p.label}</div><div className="text-xs text-ink-500">{p.hint}</div>
                  </button>
                ))}
                <button type="button" onClick={() => setCustom(true)} className={clsx("rounded-md border px-3 py-2 text-left", custom ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-ink-300 bg-white")}>
                  <div className="text-sm font-semibold text-ink-900">Personalizado</div>
                  {custom ? <input type="number" min={1} max={80} className="input mt-1 w-20 py-1" value={cfg.totalParagraphs} onChange={(e) => set("totalParagraphs", Math.max(1, Math.min(80, Number(e.target.value))))} onClick={(e) => e.stopPropagation()} /> : <div className="text-xs text-ink-500">Quantidade exata</div>}
                </button>
              </div>
              <p className="hint">O total é distribuído entre as seções selecionadas proporcionalmente ao conteúdo de cada uma (mínimo de 1 por seção).</p>
              {globalTooFew && <div className="mt-2"><InfoNote tone="warn">{cfg.totalParagraphs} parágrafo(s) para {included.length} seções: desmarque seções abaixo ou aumente o total. Ex.: para 2 parágrafos, mantenha apenas “Visão geral” e “Conclusões”.</InfoNote></div>}
            </div>
          )}
          <div className="label">Seções incluídas</div>
          <ul className="divide-y divide-ink-200 rounded-md border border-ink-200">
            {cfg.sections.map((s) => {
              const sec = content.sections.find((x) => x.id === s.id);
              const has = !!sec?.paragraphs.length;
              return (
                <li key={s.id} className={clsx("flex items-center gap-3 px-3 py-2 text-sm", !has && "opacity-50")}>
                  <input type="checkbox" disabled={!has} checked={s.include} onChange={(e) => toggleSection(s.id, e.target.checked)} />
                  <span className="flex-1">{sec?.title ?? s.id}<span className="ml-2 text-xs text-ink-500">{has ? `${sec!.paragraphs.length} parágrafo(s) na pesquisa` : "sem conteúdo"}</span></span>
                  {cfg.paragraphMode === "per_section" && s.include && (
                    <input type="number" min={1} max={20} className="input w-20 py-1" value={s.paragraphs} onChange={(e) => set("sections", cfg.sections.map((x) => (x.id === s.id ? { ...x, paragraphs: Math.max(1, Math.min(20, Number(e.target.value))) } : x)))} aria-label={`Parágrafos de ${sec?.title}`} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* 3. Profundidade */}
        <div className="card p-6">
          <div className="card-title mb-4">3 · Profundidade</div>
          <div className="grid gap-2 md:grid-cols-3">
            {DEPTHS.map((d) => (
              <button key={d.value} type="button" onClick={() => set("depth", d.value)} className={clsx("rounded-md border px-3 py-3 text-left", cfg.depth === d.value ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-ink-300 bg-white")}>
                <div className="text-sm font-semibold text-ink-900">{d.label}</div><div className="text-xs text-ink-500">{d.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Gráficos */}
        <div className="card p-6">
          <div className="card-title mb-1">4 · Deseja incluir gráficos e tabelas no relatório?</div>
          <p className="mb-4 text-xs text-ink-500">Visualizações são posicionadas junto aos parágrafos que discutem os respectivos indicadores.</p>
          <div className="flex flex-wrap gap-2">
            {VISUAL_MODES.map((m) => (
              <button key={m.value} type="button" onClick={() => set("visualMode", m.value)} className={clsx("rounded-full border px-3 py-1.5 text-sm", cfg.visualMode === m.value ? "border-navy-800 bg-navy-800 text-white" : "border-ink-300 bg-white text-ink-700")}>{m.label}</button>
            ))}
          </div>
          {cfg.visualMode !== "text" && recommended.length > 0 && cfg.visualMode !== "manual" && (
            <p className="mt-3 text-sm text-ink-700"><b>Recomendação da IA:</b> {recommended.slice(0, 5).map((c) => c.title).join("; ")}{recommended.length > 5 ? "…" : ""}</p>
          )}
          {cfg.visualMode === "manual" && (
            <div className="mt-4">
              <div className="mb-2 flex gap-3 text-xs"><button className="text-navy-600 hover:underline" onClick={() => set("selectedVisualIds", recommended.map((c) => c.id))}>Selecionar recomendadas</button><button className="text-navy-600 hover:underline" onClick={() => set("selectedVisualIds", [])}>Limpar</button><span className="text-ink-500">{cfg.selectedVisualIds.length} selecionada(s)</span></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visuals.map((c) => {
                  const d = content.datasets.find((x) => x.id === c.datasetId)!;
                  const on = cfg.selectedVisualIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => set("selectedVisualIds", on ? cfg.selectedVisualIds.filter((x) => x !== c.id) : [...cfg.selectedVisualIds, c.id])} className={clsx("rounded-md border p-2 text-left", on ? "border-navy-700 ring-2 ring-navy-700" : "border-ink-200 hover:border-navy-300")}>
                      <div className="mb-1 flex items-start gap-2"><input type="checkbox" readOnly checked={on} className="mt-0.5" /><span className="line-clamp-2 flex-1 text-xs font-semibold text-navy-900">{c.title}</span>{c.recommended && <Star size={12} className="shrink-0 fill-amber-400 text-amber-500" />}</div>
                      <div className="pointer-events-none max-h-[130px] overflow-hidden"><ChartView spec={c} dataset={d} height={120} /></div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 5. Opções */}
        <div className="card p-6">
          <div className="card-title mb-3">5 · Elementos adicionais</div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.includeExecutiveSummary} onChange={(e) => set("includeExecutiveSummary", e.target.checked)} /> Sumário executivo (adicional aos parágrafos das seções)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.includeSourcesAppendix} onChange={(e) => set("includeSourcesAppendix", e.target.checked)} /> Anexo de fontes e referências</label>
          </div>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
        <div className="card p-5">
          <div className="card-title mb-3">Resumo</div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
            <dt className="text-ink-500">Formato</dt><dd className="text-right">{REPORT_FORMATS.find((f) => f.value === cfg.format)?.label}</dd>
            <dt className="text-ink-500">Seções</dt><dd className="num text-right">{included.length}</dd>
            <dt className="text-ink-500">Parágrafos</dt><dd className="num text-right font-semibold">{total}{cfg.includeExecutiveSummary ? " + sumário" : ""}</dd>
            <dt className="text-ink-500">Profundidade</dt><dd className="text-right">{DEPTHS.find((d) => d.value === cfg.depth)?.label}</dd>
            <dt className="text-ink-500">Visualizações</dt><dd className="text-right">{VISUAL_MODES.find((m) => m.value === cfg.visualMode)?.label}</dd>
            <dt className="text-ink-500">{slides ? "Slides" : "Páginas"}</dt><dd className="text-right">{cfg.targetPages ?? "automático"}</dd>
          </dl>
          {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
          <button className="btn-primary mt-4 w-full" disabled={busy || !included.length || globalTooFew || cfg.title.trim().length < 3} onClick={submit}>{busy ? "Enviando…" : mode === "create" ? "Gerar relatório" : "Regenerar com esta configuração"}</button>
          <p className="hint">A IA reescreve cada seção com exatamente a quantidade definida, preservando dados e fontes.</p>
        </div>
        <div className="card p-5">
          <div className="card-title mb-3">Modelos</div>
          {templates.length > 0 && (
            <select className="input mb-3" defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setCfg(adapt(t.config, content, cfg.title)); }}>
              <option value="" disabled>Aplicar modelo salvo…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div className="flex gap-2"><input className="input" placeholder="Nome do modelo" value={tplName} onChange={(e) => setTplName(e.target.value)} /><button className="btn-secondary" disabled={tplName.trim().length < 2} onClick={saveTemplate}>Salvar</button></div>
          {tplMsg && <p className="hint">{tplMsg}</p>}
        </div>
      </aside>
    </div>
  );
}
