import "server-only";
import { z } from "zod/v4";
import type Anthropic from "@anthropic-ai/sdk";

/** Converte um esquema Zod em JSON Schema para a definição da ferramenta */
export function toInputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Beta.BetaTool.InputSchema;
}

export const sourceTypeEnum = z.enum([
  "official_statistics", "regulator", "company_filing", "company_publication",
  "industry_association", "third_party_report", "news", "other",
]);

export const sourceOut = z.object({
  ref: z.string().describe("Identificador local, ex.: S1, S2"),
  title: z.string().describe("Título da publicação/página"),
  publisher: z.string().describe("Instituição responsável"),
  date: z.string().nullable().describe("Data de publicação (AAAA-MM-DD, AAAA-MM ou AAAA) ou null se desconhecida"),
  url: z.string().describe("URL exata retornada pela busca web. Nunca construa ou adivinhe URLs."),
  type: sourceTypeEnum,
});

export const datasetOut = z.object({
  ref: z.string().describe("Identificador local, ex.: D1"),
  title: z.string(),
  description: z.string(),
  sectionId: z.enum(["overview", "sizing", "competition", "cost_structure", "financials", "trends", "risks", "outlook"]),
  kind: z.enum(["time_series", "comparison", "composition"]).describe("time_series: linhas são períodos; comparison: linhas são empresas/categorias; composition: partes de um todo (participações)"),
  dimension: z.string().describe("Rótulo das linhas, ex.: Ano, Empresa, Segmento"),
  unit: z.string().describe("Unidade explícita, ex.: R$ bilhões, US$ milhões, %, % da receita"),
  currency: z.string().nullable().describe("Moeda ISO (BRL, USD, EUR) quando monetário; null caso contrário"),
  region: z.string(),
  period: z.string().describe("Período coberto, ex.: 2019–2024, ano fiscal 2023"),
  series: z.array(z.object({ key: z.string().describe("chave curta sem espaços"), label: z.string(), unit: z.string() })).min(1),
  rows: z.array(z.object({
    label: z.string(),
    nature: z.enum(["historical", "third_party_estimate", "own_projection"]),
    values: z.record(z.string(), z.number().nullable()).describe("Valor por chave de série; null quando indisponível"),
    sourceRefs: z.array(z.string()).describe("Fontes que sustentam os valores desta linha"),
    note: z.string().nullable().optional(),
  })).min(1),
  methodology: z.string().nullable().describe("Obrigatório para cálculos próprios e projeções: fórmula, premissas e dados de origem"),
});

export const paragraphOut = z.object({
  text: z.string().describe("Parágrafo analítico em português, sem marcações de citação no texto"),
  sourceRefs: z.array(z.string()),
  datasetRefs: z.array(z.string()).describe("Datasets discutidos neste parágrafo"),
});

export const sectionOut = (ids: readonly [string, ...string[]]) =>
  z.object({
    sectionId: z.enum(ids),
    paragraphs: z.array(paragraphOut).min(1),
    keyFindings: z.array(z.string()),
    limitations: z.array(z.string()).describe("Dados não encontrados ou limitações desta seção"),
  });

export const researchOut = (ids: readonly [string, ...string[]]) =>
  z.object({
    sources: z.array(sourceOut),
    sections: z.array(sectionOut(ids)).min(1),
    datasets: z.array(datasetOut),
    limitations: z.array(z.string()),
  });
export type ResearchOut = z.infer<ReturnType<typeof researchOut>>;

export const verificationOut = z.object({
  summary: z.string(),
  datasets: z.array(z.object({
    datasetId: z.string(),
    status: z.enum(["verified", "partially_verified", "unverified", "rejected"]),
    notes: z.array(z.string()),
  })),
  paragraphFlags: z.array(z.object({ paragraphId: z.string(), issue: z.string() })),
  issues: z.array(z.object({ severity: z.enum(["high", "medium", "low"]), description: z.string(), relatedIds: z.array(z.string()) })),
  confirmingSources: z.array(sourceOut.extend({ supportsDatasetIds: z.array(z.string()) })).describe("Fontes adicionais encontradas na verificação que confirmam datasets"),
});
export type VerificationOut = z.infer<typeof verificationOut>;

export const vizOut = z.object({
  charts: z.array(z.object({
    datasetId: z.string(),
    type: z.enum(["column", "bar", "line", "area", "stacked", "stacked100", "pie", "table"]),
    title: z.string(),
    subtitle: z.string(),
    seriesKeys: z.array(z.string()).min(1),
    rowLabels: z.array(z.string()).nullable(),
    sectionId: z.enum(["overview", "sizing", "competition", "cost_structure", "financials", "trends", "risks", "outlook", "conclusions"]),
    rationale: z.string(),
    priority: z.number().int().min(1).max(5),
    recommended: z.boolean(),
  })),
});
export type VizOut = z.infer<typeof vizOut>;

export const directorOut = z.object({
  summary: z.string().describe("Avaliação geral da qualidade da pesquisa"),
  conclusions: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()), datasetIds: z.array(z.string()) })).min(2),
  conclusionKeyFindings: z.array(z.string()),
  answers: z.array(z.object({ question: z.string(), answer: z.string(), sourceIds: z.array(z.string()), status: z.enum(["answered", "partial", "unavailable"]) })),
  checks: z.array(z.object({ item: z.string(), status: z.enum(["ok", "attention", "problem"]), comment: z.string() })),
  recommendations: z.array(z.string()),
  methodologyNotes: z.array(z.string()).describe("Parágrafos sobre metodologia, critérios e limitações gerais"),
  paragraphFlags: z.array(z.object({ paragraphId: z.string(), issue: z.string() })),
});
export type DirectorOut = z.infer<typeof directorOut>;

export const rewriteOut = z.object({
  paragraphs: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()), datasetIds: z.array(z.string()) })),
});
export type RewriteOut = z.infer<typeof rewriteOut>;
