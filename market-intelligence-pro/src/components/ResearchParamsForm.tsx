"use client";
import { useState } from "react";
import { OBJECTIVES, REGIONS, type ResearchParams } from "@/lib/types";
import { ErrorNote } from "./ui";

const EXAMPLES = [
  "Qual é a margem EBITDA média das empresas do setor?",
  "Qual o percentual médio de custos e despesas em relação à receita?",
  "Qual é o tamanho do mercado brasileiro?",
  "Quais são os principais concorrentes e suas participações?",
];

export function ResearchParamsForm({ initial, submitLabel, onSubmit, withTitle, withNote }: {
  initial?: Partial<ResearchParams> & { title?: string };
  submitLabel: string;
  onSubmit: (v: { params: ResearchParams; title?: string; note?: string }) => Promise<void>;
  withTitle?: boolean;
  withNote?: boolean;
}) {
  const year = new Date().getFullYear();
  const [p, setP] = useState<ResearchParams>({
    sector: initial?.sector ?? "",
    region: initial?.region ?? "Brasil",
    customRegion: initial?.customRegion ?? "",
    historyStart: initial?.historyStart ?? year - 6,
    historyEnd: initial?.historyEnd ?? year - 1,
    projectionEnd: initial?.projectionEnd ?? null,
    objective: initial?.objective ?? "full",
    questions: initial?.questions ?? "",
  });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState("");
  const [withProjection, setWithProjection] = useState(initial?.projectionEnd != null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ResearchParams>(k: K, v: ResearchParams[K]) => setP((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ params: { ...p, projectionEnd: withProjection ? p.projectionEnd ?? p.historyEnd + 5 : null }, title: title.trim() || undefined, note: note.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="label" htmlFor="sector">Setor ou mercado</label>
        <textarea id="sector" className="input min-h-[84px]" required minLength={5} maxLength={500} value={p.sector} onChange={(e) => set("sector", e.target.value)} placeholder="Ex.: Mercado brasileiro de transmissão esportiva e plataformas digitais de conteúdo esportivo" />
      </div>
      {withTitle && (
        <div>
          <label className="label" htmlFor="title">Título do projeto (opcional)</label>
          <input id="title" className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Padrão: descrição do setor" />
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="region">Região geográfica</label>
          <select id="region" className="input" value={p.region} onChange={(e) => set("region", e.target.value as ResearchParams["region"])}>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          {p.region === "Personalizada" && <input className="input mt-2" placeholder="Ex.: Brasil, México e Colômbia" value={p.customRegion} onChange={(e) => set("customRegion", e.target.value)} />}
        </div>
        <div>
          <label className="label" htmlFor="objective">Objetivo</label>
          <select id="objective" className="input" value={p.objective} onChange={(e) => set("objective", e.target.value as ResearchParams["objective"])}>
            {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <span className="label">Período</span>
        <div className="flex flex-wrap items-center gap-3">
          <input type="number" className="input w-28" min={1990} max={year} value={p.historyStart} onChange={(e) => set("historyStart", Number(e.target.value))} aria-label="Ano inicial" />
          <span className="text-sm text-ink-500">até</span>
          <input type="number" className="input w-28" min={1990} max={year} value={p.historyEnd} onChange={(e) => set("historyEnd", Number(e.target.value))} aria-label="Ano final" />
          <label className="ml-2 flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={withProjection} onChange={(e) => setWithProjection(e.target.checked)} /> Incluir projeção até
          </label>
          <input type="number" className="input w-28" disabled={!withProjection} min={p.historyEnd + 1} max={2100} value={p.projectionEnd ?? p.historyEnd + 5} onChange={(e) => set("projectionEnd", Number(e.target.value))} aria-label="Ano final da projeção" />
        </div>
        <p className="hint">Projeções priorizam estimativas publicadas por terceiros; projeções próprias são identificadas e trazem metodologia.</p>
      </div>
      <div>
        <label className="label" htmlFor="questions">Questões específicas</label>
        <textarea id="questions" className="input min-h-[110px]" maxLength={4000} value={p.questions} onChange={(e) => set("questions", e.target.value)} placeholder="Uma questão por linha" />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <button type="button" key={q} className="rounded-full border border-ink-300 bg-white px-3 py-1 text-xs text-ink-700 hover:border-navy-400" onClick={() => set("questions", p.questions ? `${p.questions}\n${q}` : q)}>+ {q}</button>
          ))}
        </div>
      </div>
      {withNote && (
        <div>
          <label className="label" htmlFor="note">Observação da versão (opcional)</label>
          <input id="note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: atualização com dados do último trimestre" />
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button className="btn-primary" disabled={busy}>{busy ? "Enviando…" : submitLabel}</button>
    </form>
  );
}
