import type { Dataset, Paragraph, Section, Source, VerificationIssue } from "./types";

/**
 * Verificações determinísticas executadas antes (e independentemente) do agente de verificação.
 * Elas não dependem de IA e garantem regras mínimas de integridade dos dados.
 */
export function deterministicChecks(datasets: Dataset[], sources: Source[], sections: Section[]) {
  const issues: VerificationIssue[] = [];
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const caps = new Map<string, Dataset["verification"]["status"]>(); // teto de status por dataset

  for (const s of sources) {
    if (s.origin === "web_search" && !s.urlConfirmed) {
      issues.push({ severity: "high", description: `A URL da fonte "${s.title}" não consta entre os resultados efetivamente retornados pela busca nesta pesquisa; a referência não pode ser confirmada.`, relatedIds: [s.id] });
    }
    if (!s.date) issues.push({ severity: "low", description: `Fonte "${s.title}" sem data de publicação identificada.`, relatedIds: [s.id] });
  }

  for (const d of datasets) {
    const notes: string[] = [];
    const rowsWithoutSource = d.rows.filter((r) => !r.sourceIds.length);
    if (rowsWithoutSource.length === d.rows.length) {
      caps.set(d.id, "rejected");
      notes.push("Nenhuma linha possui fonte associada.");
    } else if (rowsWithoutSource.length) {
      caps.set(d.id, "unverified");
      notes.push(`${rowsWithoutSource.length} linha(s) sem fonte: ${rowsWithoutSource.map((r) => r.label).join(", ")}.`);
    }
    const allSrc = new Set([...d.sourceIds, ...d.rows.flatMap((r) => r.sourceIds)]);
    const unconfirmed = [...allSrc].filter((id) => {
      const s = srcById.get(id);
      return !s || !s.urlConfirmed;
    });
    if (allSrc.size && unconfirmed.length === allSrc.size) {
      caps.set(d.id, "unverified");
      notes.push("Nenhuma das fontes citadas teve a URL confirmada pela busca.");
    }
    if (!d.unit?.trim()) notes.push("Unidade não informada.");
    const monetary = /(R\$|US\$|€|USD|BRL|EUR|milh|bilh|trilh|receita|faturamento)/i.test(`${d.unit} ${d.series.map((s) => s.unit).join(" ")}`);
    if (monetary && !d.currency && !/%/.test(d.unit)) notes.push("Dado monetário sem moeda identificada.");
    if (d.rows.some((r) => r.nature === "own_projection") && !d.methodology) {
      caps.set(d.id, "unverified");
      notes.push("Projeção própria sem metodologia descrita.");
    }
    for (const s of d.series) {
      const vals = d.rows.map((r) => r.values[s.key]).filter((v): v is number => typeof v === "number");
      if (!vals.length) notes.push(`Série "${s.label}" sem valores numéricos.`);
      if (/margem|%/i.test(`${s.label} ${s.unit}`) && vals.some((v) => Math.abs(v) > 100) && !/variação|crescimento|growth/i.test(s.label)) {
        notes.push(`Série "${s.label}" contém percentuais fora do intervalo ±100%; verificar unidade.`);
      }
    }
    if (d.kind === "composition" && d.series.length === 1) {
      const sum = d.rows.reduce((acc, r) => acc + (r.values[d.series[0].key] ?? 0), 0);
      if (/%/.test(d.unit) && (sum > 100.5 || sum < 0)) notes.push(`A soma das participações é ${sum.toFixed(1)}%, acima de 100%.`);
    }
    if (notes.length) {
      issues.push({ severity: caps.get(d.id) === "rejected" ? "high" : "medium", description: `${d.title}: ${notes.join(" ")}`, relatedIds: [d.id] });
      d.verification.notes.push(...notes);
    }
  }

  const paragraphFlags: { paragraph: Paragraph; issue: string }[] = [];
  for (const sec of sections) {
    for (const p of sec.paragraphs) {
      const hasNumber = /\d[\d.,]*\s*(%|bilh|milh|trilh|R\$|US\$|p\.p\.)/i.test(p.text);
      if (hasNumber && !p.sourceIds.length && !p.datasetIds.length) {
        paragraphFlags.push({ paragraph: p, issue: "Parágrafo contém dados quantitativos sem fonte associada." });
      }
    }
  }
  return { issues, caps, paragraphFlags };
}

const ORDER = { verified: 3, partially_verified: 2, unverified: 1, rejected: 0 } as const;
/** Aplica o teto de status determinístico ao status sugerido pelo agente */
export function capStatus(agent: Dataset["verification"]["status"], cap?: Dataset["verification"]["status"]) {
  if (!cap) return agent;
  return ORDER[agent] <= ORDER[cap] ? agent : cap;
}
