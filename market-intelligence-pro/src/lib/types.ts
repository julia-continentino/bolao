import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Parâmetros da pesquisa                                              */
/* ------------------------------------------------------------------ */

export const REGIONS = ["Brasil", "América Latina", "Estados Unidos", "Europa", "Global", "Personalizada"] as const;
export const OBJECTIVES = [
  { value: "overview", label: "Visão geral" },
  { value: "benchmarking", label: "Benchmarking financeiro" },
  { value: "growth", label: "Estudo de crescimento" },
  { value: "competitive", label: "Análise competitiva" },
  { value: "valuation", label: "Valuation" },
  { value: "full", label: "Pesquisa completa" },
] as const;

export const researchParamsSchema = z.object({
  sector: z.string().trim().min(5, "Descreva o setor ou mercado (mínimo 5 caracteres).").max(500),
  region: z.enum(REGIONS),
  customRegion: z.string().trim().max(200).optional().default(""),
  historyStart: z.number().int().min(1990).max(2100),
  historyEnd: z.number().int().min(1990).max(2100),
  projectionEnd: z.number().int().min(1990).max(2100).nullable().optional().default(null),
  objective: z.enum(["overview", "benchmarking", "growth", "competitive", "valuation", "full"]),
  questions: z.string().trim().max(4000).optional().default(""),
}).refine((p) => p.historyEnd >= p.historyStart, { message: "O ano final deve ser maior ou igual ao inicial.", path: ["historyEnd"] })
  .refine((p) => p.projectionEnd == null || p.projectionEnd > p.historyEnd, { message: "A projeção deve terminar após o período histórico.", path: ["projectionEnd"] })
  .refine((p) => p.region !== "Personalizada" || (p.customRegion ?? "").length > 1, { message: "Informe a região personalizada.", path: ["customRegion"] });

export type ResearchParams = z.infer<typeof researchParamsSchema>;

export function regionLabel(p: ResearchParams) {
  return p.region === "Personalizada" ? p.customRegion || "Personalizada" : p.region;
}
export function objectiveLabel(v: string) {
  return OBJECTIVES.find((o) => o.value === v)?.label ?? v;
}

/* ------------------------------------------------------------------ */
/* Seções do Research Workspace                                        */
/* ------------------------------------------------------------------ */

export const SECTION_DEFS = [
  { id: "overview", title: "Visão geral do mercado" },
  { id: "sizing", title: "Dimensionamento e evolução histórica" },
  { id: "competition", title: "Principais empresas e concorrência" },
  { id: "cost_structure", title: "Estrutura de receitas, custos e despesas" },
  { id: "financials", title: "Margens e indicadores financeiros" },
  { id: "trends", title: "Tendências e oportunidades" },
  { id: "risks", title: "Riscos setoriais" },
  { id: "outlook", title: "Perspectivas de crescimento" },
  { id: "conclusions", title: "Conclusões" },
  { id: "methodology", title: "Fontes e metodologia" },
] as const;
export type SectionId = (typeof SECTION_DEFS)[number]["id"];
export const SECTION_IDS = SECTION_DEFS.map((s) => s.id) as [SectionId, ...SectionId[]];
export function sectionTitle(id: string) {
  return SECTION_DEFS.find((s) => s.id === id)?.title ?? id;
}

export const AGENTS = {
  market: { name: "Senior Market Research Analyst", short: "Pesquisa de Mercado" },
  financial: { name: "Financial Analyst & Valuation Specialist", short: "Análise Financeira" },
  macro: { name: "Macroeconomic & Industry Economist", short: "Macroeconomia" },
  verification: { name: "Data Research & Verification Specialist", short: "Verificação de Dados" },
  visualization: { name: "Data Visualization & Business Report Designer", short: "Visualização" },
  director: { name: "Research Director & Quality Reviewer", short: "Revisão Final" },
} as const;
export type AgentKey = keyof typeof AGENTS;

/* ------------------------------------------------------------------ */
/* Fontes, dados e verificação                                         */
/* ------------------------------------------------------------------ */

export const SOURCE_TYPES = [
  "official_statistics", // IBGE, BCB, IPEA, Banco Mundial, FMI, OCDE
  "regulator", // CVM, SEC, agências reguladoras
  "company_filing", // demonstrações financeiras, 10-K, ITR/DFP
  "company_publication", // RI, relatórios anuais, releases
  "industry_association",
  "third_party_report", // consultorias e relatórios setoriais
  "news",
  "public_api", // dados obtidos diretamente via API oficial
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  official_statistics: "Estatística oficial",
  regulator: "Órgão regulador",
  company_filing: "Demonstração financeira",
  company_publication: "Publicação da empresa",
  industry_association: "Associação setorial",
  third_party_report: "Relatório de terceiros",
  news: "Imprensa",
  public_api: "API oficial",
  other: "Outra",
};

export interface Source {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  url: string | null;
  type: SourceType;
  /** Como a fonte foi obtida */
  origin: "web_search" | "public_api";
  /** A URL foi efetivamente retornada pelo mecanismo de busca/API nesta pesquisa */
  urlConfirmed: boolean;
  accessedAt: string;
  agent: AgentKey;
}

export const DATA_NATURES = ["historical", "third_party_estimate", "own_projection"] as const;
export type DataNature = (typeof DATA_NATURES)[number];
export const DATA_NATURE_LABEL: Record<DataNature, string> = {
  historical: "Dado histórico",
  third_party_estimate: "Estimativa de terceiros",
  own_projection: "Projeção própria",
};

export type VerificationStatus = "verified" | "partially_verified" | "unverified" | "rejected";
export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "Verificado",
  partially_verified: "Parcialmente verificado",
  unverified: "Não verificado",
  rejected: "Rejeitado",
};

export interface DatasetSeries {
  key: string;
  label: string;
  unit: string;
}
export interface DatasetRow {
  label: string;
  nature: DataNature;
  values: Record<string, number | null>;
  sourceIds: string[];
  note?: string | null;
}
export interface Dataset {
  id: string;
  title: string;
  description: string;
  sectionId: SectionId;
  kind: "time_series" | "comparison" | "composition";
  /** Rótulo da dimensão das linhas (ex.: "Ano", "Empresa") */
  dimension: string;
  unit: string;
  currency: string | null;
  region: string;
  period: string;
  series: DatasetSeries[];
  rows: DatasetRow[];
  sourceIds: string[];
  methodology: string | null;
  agent: AgentKey;
  verification: { status: VerificationStatus; notes: string[] };
}

export interface Paragraph {
  id: string;
  text: string;
  sourceIds: string[];
  datasetIds: string[];
  agent: AgentKey | "user";
  flagged?: string | null;
}

export interface Section {
  id: SectionId;
  title: string;
  paragraphs: Paragraph[];
  keyFindings: string[];
  limitations: string[];
  datasetIds: string[];
  editedAt?: string | null;
}

export interface VerificationIssue {
  severity: "high" | "medium" | "low";
  description: string;
  relatedIds: string[];
}

export interface QualityCheck {
  item: string;
  status: "ok" | "attention" | "problem";
  comment: string;
}

export interface AgentProgress {
  agent: AgentKey;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  searches?: number;
  apiCalls?: number;
}

/* ------------------------------------------------------------------ */
/* Visualizações                                                       */
/* ------------------------------------------------------------------ */

export const CHART_TYPES = [
  { value: "column", label: "Colunas" },
  { value: "bar", label: "Barras horizontais" },
  { value: "line", label: "Linhas" },
  { value: "area", label: "Área" },
  { value: "stacked", label: "Colunas empilhadas" },
  { value: "stacked100", label: "Empilhado 100%" },
  { value: "pie", label: "Composição (pizza)" },
  { value: "table", label: "Tabela" },
] as const;
export type ChartType = (typeof CHART_TYPES)[number]["value"];

// Paleta categórica validada (CVD e separação mínima); usar sempre em ordem fixa
export const DEFAULT_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export interface ChartSpec {
  id: string;
  datasetId: string;
  type: ChartType;
  title: string;
  subtitle: string;
  seriesKeys: string[];
  /** null = todas as linhas */
  rowLabels: string[] | null;
  colors: Record<string, string>;
  showLegend: boolean;
  showDataLabels: boolean;
  sectionId: SectionId;
  rationale: string;
  priority: number; // 1 (maior valor analítico) a 5
  recommended: boolean;
  origin: "ai" | "user";
}

/* ------------------------------------------------------------------ */
/* Conteúdo completo de uma versão da pesquisa                         */
/* ------------------------------------------------------------------ */

export interface ResearchContent {
  schemaVersion: 1;
  generatedAt: string;
  model: string;
  sections: Section[];
  datasets: Dataset[];
  sources: Source[];
  charts: ChartSpec[];
  verification: {
    summary: string;
    issues: VerificationIssue[];
    stats: { datasets: number; verified: number; partially: number; unverified: number; rejected: number; sources: number; confirmedUrls: number };
  };
  review: { summary: string; checks: QualityCheck[]; recommendations: string[] };
  answers: { question: string; answer: string; sourceIds: string[]; status: "answered" | "partial" | "unavailable" }[];
  limitations: string[];
  edits: { at: string; sectionId: string; action: string }[];
}

/* ------------------------------------------------------------------ */
/* Relatórios                                                          */
/* ------------------------------------------------------------------ */

export const REPORT_FORMATS = [
  { value: "valuation", label: "Relatório de valuation", output: "document" },
  { value: "sector", label: "Pesquisa setorial", output: "document" },
  { value: "consulting", label: "Relatório de consultoria estratégica", output: "document" },
  { value: "investment_memo", label: "Memorando de investimento", output: "document" },
  { value: "executive_presentation", label: "Apresentação executiva", output: "slides" },
  { value: "custom", label: "Relatório personalizado", output: "document" },
] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number]["value"];

export const DEPTHS = [
  { value: "executive", label: "Executivo", hint: "Linguagem objetiva, focada em conclusões." },
  { value: "analytical", label: "Analítico", hint: "Maior discussão de indicadores e tendências." },
  { value: "technical", label: "Técnico", hint: "Metodologia, cálculos e fundamentos em detalhe." },
] as const;
export type Depth = (typeof DEPTHS)[number]["value"];

export const VISUAL_MODES = [
  { value: "text", label: "Apenas texto" },
  { value: "text_charts", label: "Texto e gráficos" },
  { value: "text_tables", label: "Texto e tabelas" },
  { value: "text_charts_tables", label: "Texto, gráficos e tabelas" },
  { value: "manual", label: "Escolher manualmente" },
] as const;
export type VisualMode = (typeof VISUAL_MODES)[number]["value"];

export const PARAGRAPH_PRESETS = [
  { value: 2, label: "2 parágrafos", hint: "Análise executiva resumida" },
  { value: 3, label: "3 parágrafos", hint: "Apresentação breve do setor" },
  { value: 5, label: "5 parágrafos", hint: "Análise intermediária" },
  { value: 8, label: "8 parágrafos", hint: "Análise aprofundada" },
];

export const reportConfigSchema = z.object({
  title: z.string().trim().min(3).max(200),
  format: z.enum(["valuation", "sector", "consulting", "investment_memo", "executive_presentation", "custom"]),
  depth: z.enum(["executive", "analytical", "technical"]),
  /** "global": total de parágrafos distribuído entre as seções; "per_section": quantidade por seção */
  paragraphMode: z.enum(["global", "per_section"]),
  totalParagraphs: z.number().int().min(1).max(80),
  sections: z.array(z.object({
    id: z.enum(SECTION_IDS),
    include: z.boolean(),
    paragraphs: z.number().int().min(1).max(20),
  })),
  visualMode: z.enum(["text", "text_charts", "text_tables", "text_charts_tables", "manual"]),
  selectedVisualIds: z.array(z.string()),
  targetPages: z.number().int().min(1).max(200).nullable(),
  includeSourcesAppendix: z.boolean(),
  includeExecutiveSummary: z.boolean(),
});
export type ReportConfig = z.infer<typeof reportConfigSchema>;

export type ReportBlock =
  | { kind: "heading"; text: string; sectionId: SectionId }
  | { kind: "paragraph"; id: string; text: string; sourceIds: string[]; sectionId: SectionId }
  | { kind: "visual"; chartId: string; sectionId: SectionId }
  | { kind: "summary"; text: string }
  | { kind: "sources"; sourceIds: string[] };

export interface ReportPage {
  number: number;
  title: string;
  blocks: ReportBlock[];
}

export interface ReportContent {
  generatedAt: string;
  format: ReportFormat;
  depth: Depth;
  executiveSummary: string | null;
  sections: { id: SectionId; title: string; paragraphs: { id: string; text: string; sourceIds: string[]; datasetIds: string[] }[] }[];
  visuals: ChartSpec[];
  pages: ReportPage[];
  usedSourceIds: string[];
  warnings: string[];
}

export const chartSpecSchema = z.object({
  id: z.string().min(1).max(80),
  datasetId: z.string().min(1),
  type: z.enum(["column", "bar", "line", "area", "stacked", "stacked100", "pie", "table"]),
  title: z.string().max(200),
  subtitle: z.string().max(300),
  seriesKeys: z.array(z.string()).min(1),
  rowLabels: z.array(z.string()).nullable(),
  colors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  showLegend: z.boolean(),
  showDataLabels: z.boolean(),
  sectionId: z.enum(SECTION_IDS),
  rationale: z.string().max(1000),
  priority: z.number().int().min(1).max(5),
  recommended: z.boolean(),
  origin: z.enum(["ai", "user"]),
});
