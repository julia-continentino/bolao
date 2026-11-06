import { DEFAULT_PALETTE, type ChartSpec, type ChartType, type Dataset, type Source } from "./types";

/** Sugestões determinísticas (usadas quando o agente de visualização não está disponível e para tabelas) */
export function suggestChartsFallback(datasets: Dataset[]): ChartSpec[] {
  const out: ChartSpec[] = [];
  for (const d of datasets) {
    if (d.verification.status === "rejected") continue;
    const colors = Object.fromEntries(d.series.map((s, j) => [s.key, DEFAULT_PALETTE[j % DEFAULT_PALETTE.length]]));
    const firstUnit = d.series[0]?.unit;
    const sameUnit = d.series.filter((s) => s.unit === firstUnit).map((s) => s.key);
    let type: ChartType;
    if (d.kind === "time_series") type = /%/.test(firstUnit ?? "") ? "line" : "column";
    else if (d.kind === "composition") type = d.series.length === 1 ? "bar" : "stacked100";
    else type = "bar";
    const base = {
      datasetId: d.id,
      subtitle: `${firstUnit ?? d.unit} · ${d.period} · ${d.region}`,
      rowLabels: null,
      colors,
      sectionId: d.sectionId,
      origin: "ai" as const,
    };
    out.push({
      ...base,
      id: `auto-${d.id}`,
      type,
      title: d.title,
      seriesKeys: sameUnit.slice(0, 6),
      showLegend: sameUnit.length > 1,
      showDataLabels: d.rows.length <= 8,
      rationale: "Sugestão automática baseada no tipo de dado.",
      priority: d.verification.status === "verified" ? 2 : 3,
      recommended: d.verification.status === "verified",
    });
    out.push({
      ...base,
      id: `auto-t-${d.id}`,
      type: "table",
      title: `${d.title} — tabela`,
      subtitle: `${d.unit} · ${d.period} · ${d.region}`,
      seriesKeys: d.series.map((s) => s.key),
      showLegend: false,
      showDataLabels: false,
      rationale: "Tabela com a base numérica completa.",
      priority: 4,
      recommended: d.kind === "comparison" && d.series.length > 2,
    });
  }
  return out;
}

/** Sufixo padrão de mercado para períodos não observados: E = estimativa de terceiros, P = projeção própria */
export function natureSuffix(nature: string) {
  return nature === "third_party_estimate" ? "E" : nature === "own_projection" ? "P" : "";
}
export function rowDisplayLabel(label: string, nature: string) {
  const sfx = natureSuffix(nature);
  if (!sfx) return label;
  return /^\d{4}$/.test(label) ? `${label}${sfx}` : `${label} (${sfx})`;
}

export interface ChartRow {
  label: string;
  nature: string;
  estimate: boolean;
  [key: string]: string | number | boolean | null;
}

/** Converte dataset + especificação em linhas prontas para os gráficos */
export function chartRows(d: Dataset, spec: Pick<ChartSpec, "seriesKeys" | "rowLabels" | "type">): ChartRow[] {
  const rows = spec.rowLabels ? d.rows.filter((r) => spec.rowLabels!.includes(r.label)) : d.rows;
  return rows.map((r) => {
    const row: ChartRow = { label: rowDisplayLabel(r.label, r.nature), nature: r.nature, estimate: r.nature !== "historical" };
    let total = 0;
    for (const k of spec.seriesKeys) total += Math.abs(r.values[k] ?? 0);
    for (const k of spec.seriesKeys) {
      const v = r.values[k] ?? null;
      row[k] = spec.type === "stacked100" && v != null && total ? Math.round((Math.abs(v) / total) * 10000) / 100 : v;
    }
    return row;
  });
}

export function seriesMeta(d: Dataset, spec: Pick<ChartSpec, "seriesKeys" | "colors">) {
  return spec.seriesKeys
    .map((k, i) => {
      const s = d.series.find((x) => x.key === k);
      return s ? { ...s, color: spec.colors[k] ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

export function formatNumber(v: number | null | undefined, unit = "") {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const s = v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  return /%/.test(unit) && !/da receita|força|população/.test(unit) ? `${s}%` : s;
}

/** Texto de fonte para rodapé de gráficos e tabelas */
export function sourceLine(d: Dataset, sources: Source[]) {
  const ids = [...new Set([...d.sourceIds, ...d.rows.flatMap((r) => r.sourceIds)])];
  const names = [...new Set(ids.map((id) => sources.find((s) => s.id === id)).filter(Boolean).map((s) => s!.publisher))];
  const natures = new Set(d.rows.map((r) => r.nature));
  const nat = natures.has("own_projection") ? " Inclui projeções próprias (ver metodologia)." : natures.has("third_party_estimate") ? " Inclui estimativas de terceiros." : "";
  return `Fonte: ${names.length ? names.join("; ") : "não identificada"}.${nat}`;
}

export function datasetHasEstimates(d: Dataset) {
  return d.rows.some((r) => r.nature !== "historical");
}
