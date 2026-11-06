import "server-only";
import { z } from "zod/v4";
import { prisma } from "../db";
import {
  DEPTHS, REPORT_FORMATS, sectionTitle,
  type ChartSpec, type ReportConfig, type ReportContent, type ResearchContent, type SectionId,
} from "../types";
import { AIConfigError, runAgent } from "./runtime";
import { toInputSchema } from "./schemas";
import { layoutReport } from "../layout";

const FORMAT_GUIDE: Record<ReportConfig["format"], string> = {
  valuation: "Relatório de valuation: ênfase em fundamentos financeiros, margens, crescimento, múltiplos e premissas que afetam o valor das empresas do setor.",
  sector: "Pesquisa setorial: visão abrangente e equilibrada do setor, sua estrutura, dinâmica competitiva e perspectivas.",
  consulting: "Relatório de consultoria estratégica: foco em implicações estratégicas, alavancas de valor, oportunidades e recomendações.",
  investment_memo: "Memorando de investimento: tese, fundamentos, riscos e mitigantes, em linguagem direta para comitê de investimentos.",
  executive_presentation: "Apresentação executiva: frases curtas e assertivas, adequadas a slides, cada parágrafo com uma mensagem central.",
  custom: "Relatório personalizado: tom profissional e equilibrado.",
};
const DEPTH_GUIDE: Record<ReportConfig["depth"], string> = {
  executive: "Executivo — linguagem objetiva, focada em conclusões e implicações; números apenas os essenciais.",
  analytical: "Analítico — discute indicadores, tendências e comparações, explicando o porquê dos movimentos.",
  technical: "Técnico — detalha metodologia, cálculos, premissas, definições de indicadores e limitações dos dados.",
};

/** Distribui o total de parágrafos entre seções proporcionalmente ao conteúdo (maiores restos) */
export function allocateParagraphs(total: number, sections: { id: SectionId; weight: number }[]) {
  const n = sections.length;
  const result = new Map<SectionId, number>();
  if (!n) return result;
  // cada seção recebe ao menos 1 parágrafo; o restante é distribuído pelo peso do conteúdo
  sections.forEach((s) => result.set(s.id, 1));
  let remaining = total - n;
  const totalW = sections.reduce((a, s) => a + Math.max(1, s.weight), 0);
  const quotas = sections.map((s) => ({ id: s.id, q: (remaining * Math.max(1, s.weight)) / totalW }));
  quotas.forEach((x) => {
    const f = Math.floor(x.q);
    result.set(x.id, result.get(x.id)! + f);
    remaining -= f;
  });
  quotas.sort((a, b) => (b.q % 1) - (a.q % 1));
  for (let i = 0; remaining > 0; i = (i + 1) % quotas.length, remaining--) result.set(quotas[i].id, result.get(quotas[i].id)! + 1);
  return result;
}

export async function rewriteSection(
  research: ResearchContent,
  config: Pick<ReportConfig, "format" | "depth">,
  sectionId: SectionId,
  n: number,
  instruction?: string,
) {
  const section = research.sections.find((s) => s.id === sectionId)!;
  const dsIds = new Set([...section.datasetIds, ...section.paragraphs.flatMap((p) => p.datasetIds)]);
  const datasets = research.datasets.filter((d) => dsIds.has(d.id) && d.verification.status !== "rejected");
  const srcIds = new Set([...section.paragraphs.flatMap((p) => p.sourceIds), ...datasets.flatMap((d) => d.sourceIds)]);
  const sources = research.sources.filter((s) => srcIds.has(s.id));
  const schema = z.object({
    paragraphs: z.array(z.object({ text: z.string().min(40), sourceIds: z.array(z.string()), datasetIds: z.array(z.string()) })).length(n, `Devem ser exatamente ${n} parágrafos`),
  });

  const res = await runAgent({
    system: "Você é um redator sênior de relatórios de bancos de investimento e consultorias estratégicas. Você reescreve análises com precisão absoluta, sem acrescentar fatos.",
    prompt: `Reescreva a seção "${section.title}" de uma pesquisa de mercado em EXATAMENTE ${n} parágrafo(s).

Formato do documento: ${FORMAT_GUIDE[config.format]}
Profundidade: ${DEPTH_GUIDE[config.depth]}

Regras:
- Exatamente ${n} parágrafo(s), cada um coeso, com uma ideia central, sem títulos nem listas.
- Preserve os dados mais importantes e a coerência da argumentação; ao condensar, priorize números verificados e conclusões.
- NÃO introduza números, empresas, fontes ou fatos que não estejam no material abaixo. Se ${n} parágrafos excederem o conteúdo disponível, aprofunde a interpretação dos dados existentes, sem inventar.
- Mantenha explícito quando um dado for estimativa de terceiros ou projeção própria. Não use dados de datasets com status "unverified" como fatos confirmados.
- Em sourceIds e datasetIds, use apenas ids do material. Não escreva marcadores de citação no texto.
- Português do Brasil.${instruction ? `\n- Orientação adicional do usuário: ${instruction}` : ""}

MATERIAL DA SEÇÃO:
Parágrafos originais: ${JSON.stringify(section.paragraphs.map((p) => ({ text: p.text, sourceIds: p.sourceIds, datasetIds: p.datasetIds, alerta: p.flagged ?? undefined })))}
Principais achados: ${JSON.stringify(section.keyFindings)}
Limitações: ${JSON.stringify(section.limitations)}
Datasets: ${JSON.stringify(datasets.map((d) => ({ id: d.id, title: d.title, unit: d.unit, currency: d.currency, period: d.period, status: d.verification.status, rows: d.rows.map((r) => ({ label: r.label, nature: r.nature, values: r.values })) })))}
Fontes: ${JSON.stringify(sources.map((s) => ({ id: s.id, title: s.title, publisher: s.publisher })))}

Entregue chamando submit_paragraphs.`,
    effort: "medium",
    maxTurns: 6,
    submit: { name: "submit_paragraphs", description: `Entrega exatamente ${n} parágrafos reescritos.`, inputSchema: toInputSchema(schema), zod: schema },
  });
  const validSrc = new Set(research.sources.map((s) => s.id));
  const validDs = new Set(research.datasets.map((d) => d.id));
  return res.output.paragraphs.map((p, i) => ({
    id: `${sectionId}-r${i + 1}`,
    text: p.text.trim(),
    sourceIds: p.sourceIds.filter((x) => validSrc.has(x)),
    datasetIds: p.datasetIds.filter((x) => validDs.has(x)),
  }));
}

async function executiveSummary(config: ReportConfig, sections: ReportContent["sections"]) {
  const schema = z.object({ summary: z.string().min(100) });
  const res = await runAgent({
    system: "Você é um diretor de pesquisa redigindo o sumário executivo de um relatório corporativo.",
    prompt: `Escreva um sumário executivo em um único parágrafo (120 a 200 palavras) para o relatório "${config.title}", com base exclusivamente no conteúdo abaixo. Não acrescente números ou fatos. ${DEPTH_GUIDE[config.depth]}
${JSON.stringify(sections.map((s) => ({ title: s.title, paragraphs: s.paragraphs.map((p) => p.text) })))}
Entregue chamando submit_summary.`,
    effort: "low",
    maxTurns: 4,
    submit: { name: "submit_summary", description: "Entrega o sumário executivo.", inputSchema: toInputSchema(schema), zod: schema },
  });
  return res.output.summary.trim();
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

export function selectVisuals(config: ReportConfig, available: ChartSpec[], includedSections: Set<string>) {
  const inScope = available.filter((c) => includedSections.has(c.sectionId));
  const byPriority = (a: ChartSpec, b: ChartSpec) => a.priority - b.priority;
  const charts = inScope.filter((c) => c.type !== "table");
  const tables = inScope.filter((c) => c.type === "table");
  const pick = (list: ChartSpec[], max: number) => {
    const rec = list.filter((c) => c.recommended).sort(byPriority);
    return (rec.length ? rec : list.sort(byPriority)).slice(0, max);
  };
  switch (config.visualMode) {
    case "text": return [];
    case "text_charts": return pick(charts, 10);
    case "text_tables": return pick(tables, 6);
    case "text_charts_tables": return [...pick(charts, 10), ...pick(tables, 5)];
    case "manual": return available.filter((c) => config.selectedVisualIds.includes(c.id));
  }
}

/** Visualizações disponíveis para um relatório: sugestões da IA e criadas pelo usuário, sem datasets rejeitados */
export function availableVisuals(research: ResearchContent) {
  const rejected = new Set(research.datasets.filter((d) => d.verification.status === "rejected").map((d) => d.id));
  return research.charts.filter((c) => !rejected.has(c.datasetId) && research.datasets.some((d) => d.id === c.datasetId));
}

export async function generateReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return;
  try {
    const version = await prisma.researchVersion.findUnique({ where: { id: report.versionId } });
    const research = version?.content as unknown as ResearchContent | null;
    if (!research) throw new Error("A versão da pesquisa não possui conteúdo concluído.");
    const config = report.config as unknown as ReportConfig;
    const warnings: string[] = [];

    const included = config.sections.filter((s) => s.include);
    const withContent = included.filter((s) => {
      const sec = research.sections.find((x) => x.id === s.id);
      if (!sec || !sec.paragraphs.length) {
        warnings.push(`A seção "${sectionTitle(s.id)}" não possui conteúdo na pesquisa e foi omitida.`);
        return false;
      }
      return true;
    });
    if (!withContent.length) throw new Error("Nenhuma seção com conteúdo foi selecionada.");

    let counts: Map<SectionId, number>;
    if (config.paragraphMode === "global") {
      if (config.totalParagraphs < withContent.length) {
        throw new Error(`O total de ${config.totalParagraphs} parágrafo(s) é menor que o número de seções selecionadas (${withContent.length}). Reduza as seções ou aumente o total.`);
      }
      counts = allocateParagraphs(config.totalParagraphs, withContent.map((s) => ({ id: s.id, weight: research.sections.find((x) => x.id === s.id)!.paragraphs.length })));
    } else counts = new Map(withContent.map((s) => [s.id, s.paragraphs]));

    const sections = await pool(withContent, 3, async (s) => {
      const n = counts.get(s.id)!;
      const paragraphs = await rewriteSection(research, config, s.id, n);
      return { id: s.id, title: sectionTitle(s.id), paragraphs };
    });

    const summary = config.includeExecutiveSummary ? await executiveSummary(config, sections) : null;

    const visuals = selectVisuals(config, availableVisuals(research), new Set(sections.map((s) => s.id)));
    // posiciona cada visual após o parágrafo que discute o respectivo indicador
    const visualsBySection = new Map<string, { chart: ChartSpec; afterParagraphId: string | null }[]>();
    for (const v of visuals) {
      let target = sections.find((s) => s.id === v.sectionId) ?? null;
      let after = target?.paragraphs.find((p) => p.datasetIds.includes(v.datasetId))?.id ?? null;
      if (!after) {
        for (const s of sections) {
          const p = s.paragraphs.find((x) => x.datasetIds.includes(v.datasetId));
          if (p) { target = s; after = p.id; break; }
        }
      }
      if (!target) {
        target = sections[sections.length - 1];
        warnings.push(`A visualização "${v.title}" pertence a uma seção não incluída e foi posicionada ao final.`);
      }
      if (!visualsBySection.has(target.id)) visualsBySection.set(target.id, []);
      visualsBySection.get(target.id)!.push({ chart: v, afterParagraphId: after });
    }

    const used = new Set<string>();
    sections.forEach((s) => s.paragraphs.forEach((p) => p.sourceIds.forEach((id) => used.add(id))));
    for (const v of visuals) {
      const d = research.datasets.find((x) => x.id === v.datasetId);
      d?.sourceIds.forEach((id) => used.add(id));
      d?.rows.forEach((r) => r.sourceIds.forEach((id) => used.add(id)));
    }
    const usedSourceIds = research.sources.filter((s) => used.has(s.id)).map((s) => s.id);

    const slides = REPORT_FORMATS.find((f) => f.value === config.format)?.output === "slides";
    const layout = layoutReport({
      slides,
      sections,
      visualsBySection,
      datasets: research.datasets,
      executiveSummary: summary,
      sourceIds: usedSourceIds,
      includeSources: config.includeSourcesAppendix,
      targetPages: config.targetPages,
    });

    const content: ReportContent = {
      generatedAt: new Date().toISOString(),
      format: config.format,
      depth: config.depth,
      executiveSummary: summary,
      sections,
      visuals,
      pages: layout.pages,
      usedSourceIds,
      warnings: [...warnings, ...layout.warnings],
    };
    if (report.content) await prisma.reportRevision.create({ data: { reportId, config: report.config as never, content: report.content as never } });
    await prisma.report.update({ where: { id: reportId }, data: { status: "ready", content: content as never, error: null } });
  } catch (err) {
    console.error("[report] falha:", err);
    const msg = err instanceof AIConfigError || err instanceof Error ? err.message : String(err);
    await prisma.report.update({ where: { id: reportId }, data: { status: "failed", error: msg } });
  }
}

const running = new Set<string>();
export function isReportRunning(reportId: string) {
  return running.has(reportId);
}
export function startReport(reportId: string) {
  if (running.has(reportId)) return;
  running.add(reportId);
  void generateReport(reportId).finally(() => running.delete(reportId));
}

export const DEPTH_LABEL = Object.fromEntries(DEPTHS.map((d) => [d.value, d.label]));
