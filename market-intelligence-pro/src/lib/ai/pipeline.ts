import "server-only";
import { prisma } from "../db";
import {
  AGENTS, DEFAULT_PALETTE, SECTION_DEFS, objectiveLabel, regionLabel,
  type AgentKey, type AgentProgress, type ChartSpec, type ChartType, type Dataset, type Paragraph,
  type ResearchContent, type ResearchParams, type Section, type SectionId, type Source,
} from "../types";
import { AI_MODEL, AgentError, AIConfigError, normalizeUrl, runAgent, type SearchedUrl } from "./runtime";
import { ApiRegistry, macroTools, secTools } from "./datatools";
import {
  directorOut, researchOut, toInputSchema, verificationOut, vizOut,
  type DirectorOut, type ResearchOut, type VerificationOut,
} from "./schemas";
import { capStatus, deterministicChecks } from "../verification";
import { suggestChartsFallback } from "../charts";
import { secEnabled } from "../data/sec";

const MAX_SEARCHES = Math.max(1, Math.min(30, Number(process.env.AI_MAX_SEARCHES_PER_AGENT) || 10));

/* ------------------------------------------------------------------ */
/* Instruções comuns                                                   */
/* ------------------------------------------------------------------ */

const COMMON_RULES = `
REGRAS OBRIGATÓRIAS DE INTEGRIDADE (aplicam-se a todo o trabalho):
1. Use a ferramenta web_search para pesquisar. Todo dado quantitativo relevante deve vir de uma fonte efetivamente encontrada.
2. Em "sources", informe apenas URLs exatamente como retornadas pela busca. Nunca construa, complete ou adivinhe URLs, títulos ou datas.
3. Nunca invente números, estatísticas, participações de mercado ou referências. Se um dado não for encontrado, registre a limitação explicitamente em "limitations" e não preencha o valor.
4. Diferencie a natureza de cada dado: "historical" (observado/publicado), "third_party_estimate" (estimativa ou projeção publicada por terceiros) e "own_projection" (cálculo ou projeção sua — exige "methodology" com fórmula, premissas e dados de origem).
5. Todo dado financeiro deve identificar moeda, unidade, período e região. Não misture moedas ou unidades na mesma série.
6. Priorize fontes primárias e oficiais: IBGE, Banco Central do Brasil, IPEA, CVM, B3, SEC, Banco Mundial, FMI, OCDE, demonstrações financeiras e relatórios anuais, associações setoriais e publicações oficiais das empresas. Use imprensa e consultorias apenas quando não houver fonte primária, e identifique-as como tal.
7. Quando duas fontes divergirem, registre ambas e explique a divergência.
8. Escreva em português do Brasil, em tom profissional de relatório de consultoria/banco de investimento. Os parágrafos não devem conter marcadores de citação no texto: associe as fontes pelos campos sourceRefs/datasetRefs.
9. Datasets devem conter apenas números estruturados que você encontrou (ou calculou, com metodologia). Cada linha deve apontar suas fontes em sourceRefs.
10. Ao final, entregue o resultado chamando a ferramenta de submissão indicada. Não escreva o relatório fora da ferramenta.`;

function scope(p: ResearchParams) {
  return `ESCOPO DA PESQUISA
- Setor/mercado: ${p.sector}
- Região geográfica: ${regionLabel(p)}
- Período histórico: ${p.historyStart}–${p.historyEnd}${p.projectionEnd ? `\n- Horizonte de projeção: até ${p.projectionEnd} (use projeções publicadas por terceiros sempre que possível; projeções próprias exigem metodologia)` : ""}
- Objetivo: ${objectiveLabel(p.objective)}
- Questões prioritárias do cliente: ${p.questions?.trim() ? `\n${p.questions.trim()}` : "nenhuma específica"}
- Data de hoje: ${new Date().toISOString().slice(0, 10)}`;
}

function countryCode(p: ResearchParams) {
  const map: Record<string, string> = { Brasil: "BR", "Estados Unidos": "US" };
  return map[p.region];
}

/* ------------------------------------------------------------------ */
/* Progresso                                                           */
/* ------------------------------------------------------------------ */

class Progress {
  state: AgentProgress[] = (Object.keys(AGENTS) as AgentKey[]).map((agent) => ({ agent, status: "pending" }));
  private timer: NodeJS.Timeout | null = null;
  constructor(private versionId: string) {}
  set(agent: AgentKey, patch: Partial<AgentProgress>) {
    const s = this.state.find((x) => x.agent === agent)!;
    Object.assign(s, patch);
    if (patch.status === "running") s.startedAt = new Date().toISOString();
    if (patch.status === "done" || patch.status === "failed" || patch.status === "skipped") s.finishedAt = new Date().toISOString();
    this.schedule();
  }
  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 1500);
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await prisma.researchVersion.update({ where: { id: this.versionId }, data: { progress: this.state as never } }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Agentes de pesquisa (1, 2 e 3)                                      */
/* ------------------------------------------------------------------ */

type SpecialistKey = "market" | "financial" | "macro";
interface SpecialistResult {
  agent: SpecialistKey;
  out: ResearchOut;
  urls: Map<string, SearchedUrl>;
}

async function runSpecialist(agent: SpecialistKey, p: ResearchParams, reg: ApiRegistry, progress: Progress): Promise<SpecialistResult> {
  const start = p.historyStart;
  const end = p.projectionEnd ?? p.historyEnd;
  let sections: [SectionId, ...SectionId[]];
  let role: string;
  let tools = [] as ReturnType<typeof macroTools>;
  let maxUses = MAX_SEARCHES;

  if (agent === "market") {
    sections = ["overview", "sizing", "competition", "trends", "risks", "outlook"];
    role = `Você é o ${AGENTS.market.name}, analista sênior de pesquisa de mercado de uma consultoria de primeira linha.
Sua responsabilidade: dimensionamento e evolução histórica do mercado; principais empresas e concorrentes; participação de mercado; segmentação de produtos e serviços; tendências de consumo; perspectivas de crescimento; riscos e oportunidades.
Produza as seções: overview (visão geral), sizing (tamanho e evolução histórica, com série temporal sempre que houver dados), competition (principais empresas, participações e posicionamento), trends (tendências e oportunidades), risks (riscos setoriais) e outlook (perspectivas de crescimento, incluindo projeções de terceiros).
Datasets esperados quando houver dados publicados: tamanho do mercado por ano; participação de mercado por empresa (composition, em %); segmentação (composition); projeções de terceiros (time_series com nature third_party_estimate).`;
  } else if (agent === "financial") {
    sections = ["cost_structure", "financials", "competition"];
    role = `Você é o ${AGENTS.financial.name}, especialista em análise econômico-financeira, valuation e benchmarking de empresas.
Sua responsabilidade: receita e crescimento do faturamento; margem bruta, EBITDA, EBIT e líquida; custos operacionais e despesas administrativas/comerciais como percentual da receita; estrutura de capital; capex e capital de giro; indicadores de rentabilidade (ROE, ROIC quando possível); comparação entre empresas do setor; múltiplos de mercado (EV/EBITDA, P/L) quando aplicáveis e publicados.
Identifique as empresas de capital aberto relevantes do setor e pesquise suas demonstrações financeiras (DFP/ITR na CVM, releases de RI, relatórios 10-K/20-F).
Produza as seções: cost_structure (estrutura de receitas, custos e despesas em % da receita), financials (margens, rentabilidade, estrutura de capital e múltiplos) e, se agregar valor, competition (posicionamento financeiro dos concorrentes).
Datasets esperados: benchmarking por empresa (comparison) com receita, margens e crescimento; estrutura de custos (composition ou comparison em % da receita); evolução de receita/margens (time_series).
Ao calcular médias setoriais ou margens, use nature "own_projection" apenas para projeções; cálculos sobre dados históricos permanecem "historical", mas descreva o cálculo em "methodology".`;
    if (secEnabled()) {
      tools = secTools(reg, "financial", start, p.historyEnd);
      role += `\nVocê dispõe das ferramentas sec_company_financials e sec_benchmark (API oficial XBRL da SEC) para companhias listadas nos EUA (inclusive empresas estrangeiras com 20-F/ADRs). Prefira-as à transcrição manual de números quando a empresa for registrada na SEC; cite o datasetId e sourceId retornados.`;
    }
  } else {
    sections = ["outlook", "risks", "trends"];
    maxUses = Math.max(3, Math.round(MAX_SEARCHES / 2));
    tools = macroTools(reg, "macro", start, end);
    role = `Você é o ${AGENTS.macro.name}, economista especializado em macroeconomia e economia industrial.
Sua responsabilidade: PIB e crescimento econômico; inflação e taxas de juros; câmbio; emprego e consumo; aspectos regulatórios; tendências macroeconômicas; e, principalmente, os impactos desses fatores sobre o setor analisado.
Use a ferramenta get_official_series para obter dados oficiais (Banco Central/SGS, Banco Mundial, FMI) — esses dados entram automaticamente na pesquisa e você deve referenciá-los pelos datasetId/sourceId retornados. Não recrie datasets com esses mesmos números.
Use web_search para regulação setorial, políticas públicas e projeções oficiais (ex.: Boletim Focus, relatórios do BCB, OCDE).
Produza as seções: outlook (contexto macroeconômico e impacto nas perspectivas do setor), risks (riscos macroeconômicos e regulatórios) e, se pertinente, trends (tendências macro e regulatórias). Explique a transmissão de cada variável macro para receita, custos e demanda do setor.`;
  }

  const schema = researchOut(sections);
  const prompt = `${scope(p)}

Seções sob sua responsabilidade: ${sections.join(", ")}.
Cada seção deve ter parágrafos analíticos densos (tipicamente 3 a 6), fundamentados em dados, e as limitações encontradas.
Use identificadores locais S1, S2… para fontes e D1, D2… para datasets. Se usar ferramentas de dados oficiais, referencie os ids que elas retornarem.
${COMMON_RULES}

Ferramenta de submissão: submit_research.`;

  progress.set(agent, { status: "running", message: "Iniciando pesquisa" });
  const res = await runAgent({
    system: role,
    prompt,
    tools,
    webSearch: { maxUses, country: countryCode(p) },
    submit: { name: "submit_research", description: "Entrega o resultado estruturado da pesquisa deste especialista.", inputSchema: toInputSchema(schema), zod: schema },
    onEvent: (e) => progress.set(agent, { message: e.type === "search" ? `Buscando: ${e.detail}` : `Consultando API oficial: ${e.detail}` }),
  });
  progress.set(agent, { status: "done", message: `${res.output.sections.length} seções, ${res.output.datasets.length} datasets, ${res.output.sources.length} fontes`, searches: res.searches, apiCalls: res.toolCalls });
  return { agent, out: res.output, urls: res.searchedUrls };
}

/* ------------------------------------------------------------------ */
/* Consolidação                                                        */
/* ------------------------------------------------------------------ */

function isConfirmed(url: string, searched: Map<string, SearchedUrl>) {
  const n = normalizeUrl(url);
  if (searched.has(n)) return true;
  const noQuery = n.split("?")[0];
  for (const k of searched.keys()) if (k.split("?")[0] === noQuery) return true;
  return false;
}

const PREFIX: Record<SpecialistKey, string> = { market: "mkt", financial: "fin", macro: "eco" };

function merge(results: SpecialistResult[], reg: ApiRegistry, searched: Map<string, SearchedUrl>) {
  const sources: Source[] = [...reg.sources];
  const datasets: Dataset[] = [...reg.datasets];
  const byUrl = new Map<string, Source>(sources.filter((s) => s.url).map((s) => [normalizeUrl(s.url!), s]));
  const sectionParas = new Map<SectionId, Paragraph[]>();
  const findings = new Map<SectionId, string[]>();
  const limits = new Map<SectionId, string[]>();
  const sectionDatasets = new Map<SectionId, Set<string>>();
  const globalLimitations: string[] = [];

  for (const r of results) {
    const pre = PREFIX[r.agent];
    const srcMap = new Map<string, string>();
    for (const s of r.out.sources) {
      if (!s.url || !/^https?:\/\//.test(s.url)) continue;
      const key = normalizeUrl(s.url);
      const existing = byUrl.get(key);
      if (existing) {
        srcMap.set(s.ref, existing.id);
        continue;
      }
      const src: Source = {
        id: `${pre}-${s.ref}`.replace(/[^\w-]/g, ""),
        title: s.title,
        publisher: s.publisher,
        date: s.date,
        url: s.url,
        type: s.type,
        origin: "web_search",
        urlConfirmed: isConfirmed(s.url, searched),
        accessedAt: new Date().toISOString(),
        agent: r.agent,
      };
      sources.push(src);
      byUrl.set(key, src);
      srcMap.set(s.ref, src.id);
    }
    const knownSrc = new Set(sources.map((s) => s.id));
    const mapSrc = (refs: string[]) => [...new Set(refs.map((x) => srcMap.get(x) ?? (knownSrc.has(x) ? x : null)).filter((x): x is string => !!x))];

    const dsMap = new Map<string, string>();
    for (const d of r.out.datasets) {
      const keys = new Set(d.series.map((s) => s.key));
      const rows = d.rows.map((row) => ({
        label: row.label,
        nature: row.nature,
        values: Object.fromEntries(Object.entries(row.values).filter(([k, v]) => keys.has(k) && (v === null || Number.isFinite(v)))),
        sourceIds: mapSrc(row.sourceRefs),
        note: row.note ?? null,
      }));
      const ds: Dataset = {
        id: `${pre}-${d.ref}`.replace(/[^\w-]/g, ""),
        title: d.title,
        description: d.description,
        sectionId: d.sectionId,
        kind: d.kind,
        dimension: d.dimension,
        unit: d.unit,
        currency: d.currency,
        region: d.region,
        period: d.period,
        series: d.series,
        rows,
        sourceIds: [...new Set(rows.flatMap((x) => x.sourceIds))],
        methodology: d.methodology,
        agent: r.agent,
        verification: { status: "unverified", notes: [] },
      };
      datasets.push(ds);
      dsMap.set(d.ref, ds.id);
    }
    const knownDs = new Set(datasets.map((d) => d.id));
    const mapDs = (refs: string[]) => [...new Set(refs.map((x) => dsMap.get(x) ?? (knownDs.has(x) ? x : null)).filter((x): x is string => !!x))];

    for (const sec of r.out.sections) {
      const id = sec.sectionId as SectionId;
      const list = sectionParas.get(id) ?? [];
      for (const para of sec.paragraphs) {
        list.push({ id: "", text: para.text.trim(), sourceIds: mapSrc(para.sourceRefs), datasetIds: mapDs(para.datasetRefs), agent: r.agent });
      }
      sectionParas.set(id, list);
      findings.set(id, [...(findings.get(id) ?? []), ...sec.keyFindings]);
      limits.set(id, [...(limits.get(id) ?? []), ...sec.limitations]);
    }
    globalLimitations.push(...r.out.limitations);
  }

  for (const d of datasets) {
    if (!sectionDatasets.has(d.sectionId)) sectionDatasets.set(d.sectionId, new Set());
    sectionDatasets.get(d.sectionId)!.add(d.id);
  }

  const sections: Section[] = SECTION_DEFS.filter((s) => s.id !== "conclusions" && s.id !== "methodology").map((def) => {
    const paragraphs = (sectionParas.get(def.id) ?? []).map((p, i) => ({ ...p, id: `${def.id}-${i + 1}` }));
    const dsIds = new Set(sectionDatasets.get(def.id) ?? []);
    paragraphs.forEach((p) => p.datasetIds.forEach((d) => dsIds.add(d)));
    return {
      id: def.id,
      title: def.title,
      paragraphs,
      keyFindings: findings.get(def.id) ?? [],
      limitations: limits.get(def.id) ?? [],
      datasetIds: [...dsIds],
    };
  });
  for (const s of sections) {
    if (!s.paragraphs.length) s.limitations.push("Nenhum conteúdo fundamentado foi produzido para esta seção.");
  }
  return { sources, datasets, sections, globalLimitations };
}

/* ------------------------------------------------------------------ */
/* Agente 4 — Verificação                                              */
/* ------------------------------------------------------------------ */

async function runVerification(p: ResearchParams, data: ReturnType<typeof merge>, detIssues: string[], progress: Progress, searched: Map<string, SearchedUrl>) {
  progress.set("verification", { status: "running", message: "Cruzando dados e fontes" });
  const payload = {
    sources: data.sources.map((s) => ({ id: s.id, title: s.title, publisher: s.publisher, date: s.date, url: s.url, type: s.type, origin: s.origin, urlConfirmedBySearch: s.urlConfirmed })),
    datasets: data.datasets.map((d) => ({
      id: d.id, title: d.title, unit: d.unit, currency: d.currency, region: d.region, period: d.period, kind: d.kind, methodology: d.methodology,
      fromOfficialApi: d.id.startsWith("api-") || d.id.startsWith("sec-"),
      series: d.series, rows: d.rows, automatedNotes: d.verification.notes,
    })),
    paragraphs: data.sections.flatMap((s) => s.paragraphs.map((x) => ({ id: x.id, section: s.id, text: x.text, sourceIds: x.sourceIds, datasetIds: x.datasetIds }))),
  };
  const res = await runAgent<VerificationOut>({
    system: `Você é o ${AGENTS.verification.name}. Sua função é garantir a confiabilidade dos dados: identificar fontes originais, verificar números, comparar referências, detectar inconsistências e impedir que informações sem comprovação sejam tratadas como dados confirmados. Você é cético e rigoroso.`,
    prompt: `${scope(p)}

Abaixo está o material produzido pelos especialistas (JSON). Verifique-o:
- Para cada dataset, atribua status: "verified" (fonte primária/oficial confirmada e números coerentes), "partially_verified" (fonte confiável porém secundária, ou apenas parte dos números confirmada), "unverified" (não foi possível confirmar) ou "rejected" (números inconsistentes, contraditos por fonte melhor, ou sem base). Datasets com fromOfficialApi=true vêm de APIs oficiais; rejeite-os apenas se houver erro evidente de uso.
- Use web_search para checar os números mais importantes (tamanho de mercado, participações, margens) na fonte original quando possível. Se encontrar fontes que confirmem um dataset, informe-as em confirmingSources (somente URLs retornadas pela busca).
- Aponte em paragraphFlags os parágrafos com afirmações quantitativas sem respaldo, conclusões não suportadas pelos dados, ou que tratem estimativa como dado histórico.
- Liste inconsistências entre fontes, unidades, moedas, períodos e regiões em issues.
- Fontes com urlConfirmedBySearch=false não puderam ser confirmadas automaticamente: trate-as com cautela.

Verificações automáticas já realizadas:
${detIssues.length ? detIssues.map((x) => `- ${x}`).join("\n") : "- nenhuma pendência automática"}

MATERIAL:
${JSON.stringify(payload)}

Regras: não invente fontes nem URLs; escreva em português. Entregue chamando submit_verification.`,
    webSearch: { maxUses: Math.max(3, Math.round(MAX_SEARCHES * 0.6)), country: countryCode(p) },
    submit: { name: "submit_verification", description: "Entrega o parecer de verificação.", inputSchema: toInputSchema(verificationOut), zod: verificationOut },
    onEvent: (e) => progress.set("verification", { message: `Verificando: ${e.detail}` }),
  });
  for (const [k, v] of res.searchedUrls) searched.set(k, v);
  progress.set("verification", { status: "done", searches: res.searches, message: res.output.summary.slice(0, 160) });
  return res.output;
}

/* ------------------------------------------------------------------ */
/* Agente 5 — Visualização                                             */
/* ------------------------------------------------------------------ */

function sanitizeCharts(raw: { datasetId: string; type: ChartType; title: string; subtitle: string; seriesKeys: string[]; rowLabels: string[] | null; sectionId: SectionId; rationale: string; priority: number; recommended: boolean }[], datasets: Dataset[]): ChartSpec[] {
  const byId = new Map(datasets.map((d) => [d.id, d]));
  const out: ChartSpec[] = [];
  raw.forEach((c, i) => {
    const d = byId.get(c.datasetId);
    if (!d || d.verification.status === "rejected") return;
    const valid = d.series.map((s) => s.key);
    let keys = c.seriesKeys.filter((k) => valid.includes(k));
    if (!keys.length) keys = [valid[0]];
    // não misturar unidades no mesmo gráfico
    if (c.type !== "table") {
      const unit = d.series.find((s) => s.key === keys[0])!.unit;
      keys = keys.filter((k) => d.series.find((s) => s.key === k)!.unit === unit);
    }
    const labels = c.rowLabels?.filter((l) => d.rows.some((r) => r.label === l)) ?? null;
    out.push({
      id: `viz-${i + 1}`,
      datasetId: d.id,
      type: c.type,
      title: c.title,
      subtitle: c.subtitle,
      seriesKeys: keys,
      rowLabels: labels && labels.length ? labels : null,
      colors: Object.fromEntries(d.series.map((s, j) => [s.key, DEFAULT_PALETTE[j % DEFAULT_PALETTE.length]])),
      showLegend: keys.length > 1 || c.type === "pie",
      showDataLabels: d.rows.length <= 8,
      sectionId: c.sectionId,
      rationale: c.rationale,
      priority: c.priority,
      recommended: c.recommended,
      origin: "ai",
    });
  });
  // garante uma tabela para cada dataset utilizável
  for (const d of datasets) {
    if (d.verification.status === "rejected") continue;
    if (!out.some((c) => c.datasetId === d.id && c.type === "table")) {
      out.push({ ...suggestChartsFallback([d]).find((c) => c.type === "table")!, id: `viz-t-${out.length + 1}` });
    }
  }
  return out;
}

async function runVisualization(datasets: Dataset[], progress: Progress): Promise<ChartSpec[]> {
  const usable = datasets.filter((d) => d.verification.status !== "rejected");
  if (!usable.length) {
    progress.set("visualization", { status: "skipped", message: "Nenhum dataset verificado disponível para visualização." });
    return [];
  }
  progress.set("visualization", { status: "running", message: "Selecionando representações visuais" });
  try {
    const res = await runAgent({
      system: `Você é o ${AGENTS.visualization.name}. Você transforma dados técnicos em gráficos e tabelas adequados a relatórios corporativos de bancos de investimento e consultorias. Escolha a representação que melhor comunica cada indicador.`,
      prompt: `Datasets disponíveis (verificados ou parcialmente verificados):
${JSON.stringify(usable.map((d) => ({ id: d.id, title: d.title, section: d.sectionId, kind: d.kind, dimension: d.dimension, unit: d.unit, series: d.series, rowLabels: d.rows.map((r) => r.label), natures: [...new Set(d.rows.map((r) => r.nature))], status: d.verification.status })))}

Proponha visualizações seguindo as diretrizes:
- Crescimento do mercado: line ou column. Participação de mercado: bar ou pie (composição). Margens por empresa: bar (barras horizontais). Estrutura de custos: stacked ou stacked100. Benchmarking com vários indicadores: table.
- Séries com dados históricos e projetados devem usar line ou column (a plataforma diferencia visualmente estimativas automaticamente).
- Nunca combine séries com unidades diferentes no mesmo gráfico; crie gráficos separados.
- priority: 1 = maior valor analítico. recommended = true para as visualizações essenciais ao relatório (normalmente 3 a 8).
- Títulos e subtítulos em português, objetivos, com unidade e período no subtítulo.
Use somente datasetIds e seriesKeys existentes. Entregue chamando submit_visualizations.`,
      effort: "medium",
      submit: { name: "submit_visualizations", description: "Entrega as visualizações sugeridas.", inputSchema: toInputSchema(vizOut), zod: vizOut },
    });
    const charts = sanitizeCharts(res.output.charts, datasets);
    progress.set("visualization", { status: "done", message: `${charts.length} visualizações sugeridas` });
    return charts;
  } catch (err) {
    if (err instanceof AIConfigError) throw err;
    const charts = suggestChartsFallback(usable);
    progress.set("visualization", { status: "done", message: `Sugestões automáticas por regra (${charts.length}); agente indisponível: ${err instanceof Error ? err.message : err}` });
    return charts;
  }
}

/* ------------------------------------------------------------------ */
/* Agente 6 — Diretor de pesquisa                                      */
/* ------------------------------------------------------------------ */

async function runDirector(p: ResearchParams, sections: Section[], datasets: Dataset[], sources: Source[], verification: VerificationOut | null, charts: ChartSpec[], progress: Progress) {
  progress.set("director", { status: "running", message: "Revisão crítica final" });
  const res = await runAgent<DirectorOut>({
    system: `Você é o ${AGENTS.director.name}, diretor de pesquisa responsável pela revisão crítica final antes da entrega ao cliente. Avalie a consistência dos cálculos, a qualidade das fontes, a coerência das conclusões, a clareza da redação e a correspondência entre gráficos e dados. Você não acrescenta números novos: trabalha apenas com o material verificado.`,
    prompt: `${scope(p)}

MATERIAL CONSOLIDADO:
Seções: ${JSON.stringify(sections.map((s) => ({ id: s.id, paragraphs: s.paragraphs.map((x) => ({ id: x.id, text: x.text, sourceIds: x.sourceIds, datasetIds: x.datasetIds, flagged: x.flagged ?? null })), keyFindings: s.keyFindings, limitations: s.limitations })))}
Datasets: ${JSON.stringify(datasets.map((d) => ({ id: d.id, title: d.title, unit: d.unit, currency: d.currency, period: d.period, status: d.verification.status, notes: d.verification.notes, series: d.series.map((s) => s.key), rows: d.rows.map((r) => ({ label: r.label, nature: r.nature, values: r.values })) })))}
Fontes: ${JSON.stringify(sources.map((s) => ({ id: s.id, title: s.title, publisher: s.publisher, type: s.type, urlConfirmed: s.urlConfirmed })))}
Parecer de verificação: ${verification ? JSON.stringify({ summary: verification.summary, issues: verification.issues }) : "verificação indisponível"}
Visualizações: ${JSON.stringify(charts.map((c) => ({ id: c.id, datasetId: c.datasetId, type: c.type, title: c.title, seriesKeys: c.seriesKeys })))}

TAREFAS:
1. Redija a seção de Conclusões (3 a 6 parágrafos) sintetizando as implicações estratégicas e financeiras. Use apenas dados verificados ou parcialmente verificados, citando sourceIds/datasetIds existentes. Deixe explícito quando uma conclusão depende de estimativas.
2. Responda cada questão prioritária do cliente (se houver) em "answers", indicando status "unavailable" quando os dados não foram encontrados — nunca preencha lacunas com suposições.
3. Em "checks", avalie: consistência dos cálculos; qualidade e diversidade das fontes; distinção entre histórico/estimativas/projeções; coerência das conclusões; clareza da redação; correspondência entre gráficos e dados; cobertura do escopo.
4. Liste recomendações de aprofundamento e notas metodológicas (methodologyNotes).
5. Sinalize em paragraphFlags parágrafos com problemas de coerência ou sustentação.
Entregue chamando submit_review.`,
    submit: { name: "submit_review", description: "Entrega a revisão final, conclusões e respostas.", inputSchema: toInputSchema(directorOut), zod: directorOut },
  });
  progress.set("director", { status: "done", message: res.output.summary.slice(0, 160) });
  return res.output;
}

/* ------------------------------------------------------------------ */
/* Orquestração                                                        */
/* ------------------------------------------------------------------ */

export async function runResearch(versionId: string) {
  const version = await prisma.researchVersion.findUnique({ where: { id: versionId } });
  if (!version) return;
  const p = version.params as unknown as ResearchParams;
  const progress = new Progress(versionId);
  await prisma.researchVersion.update({ where: { id: versionId }, data: { status: "running", model: AI_MODEL, progress: progress.state as never, error: null } });
  await prisma.project.update({ where: { id: version.projectId }, data: { status: "running" } });

  try {
    const reg = new ApiRegistry();
    const settled = await Promise.allSettled((["market", "financial", "macro"] as const).map((a) => runSpecialist(a, p, reg, progress)));
    const results: SpecialistResult[] = [];
    const failures: string[] = [];
    settled.forEach((s, i) => {
      const agent = (["market", "financial", "macro"] as const)[i];
      if (s.status === "fulfilled") results.push(s.value);
      else {
        if (s.reason instanceof AIConfigError) throw s.reason;
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        failures.push(`${AGENTS[agent].name}: ${msg}`);
        progress.set(agent, { status: "failed", message: msg });
      }
    });
    if (!results.length) throw new AgentError(`Nenhum especialista concluiu a pesquisa. ${failures.join(" | ")}`);

    const searched = new Map<string, SearchedUrl>();
    for (const r of results) for (const [k, v] of r.urls) searched.set(k, v);
    const data = merge(results, reg, searched);

    // Verificação determinística + agente verificador
    const det = deterministicChecks(data.datasets, data.sources, data.sections);
    let verification: VerificationOut | null = null;
    try {
      verification = await runVerification(p, data, det.issues.map((i) => i.description), progress, searched);
    } catch (err) {
      if (err instanceof AIConfigError) throw err;
      progress.set("verification", { status: "failed", message: err instanceof Error ? err.message : String(err) });
    }

    // Fontes adicionais confirmadas na verificação
    if (verification) {
      verification.confirmingSources.forEach((s, i) => {
        if (!s.url || !isConfirmed(s.url, searched)) return;
        let src = data.sources.find((x) => x.url && normalizeUrl(x.url) === normalizeUrl(s.url));
        if (!src) {
          src = { id: `ver-S${i + 1}`, title: s.title, publisher: s.publisher, date: s.date, url: s.url, type: s.type, origin: "web_search", urlConfirmed: true, accessedAt: new Date().toISOString(), agent: "verification" };
          data.sources.push(src);
        }
        for (const dsId of s.supportsDatasetIds) {
          const d = data.datasets.find((x) => x.id === dsId);
          if (d && !d.sourceIds.includes(src.id)) {
            d.sourceIds.push(src.id);
            d.verification.notes.push(`Confirmado por fonte adicional: ${src.title}.`);
          }
        }
      });
    }
    // re-avalia confirmação de URLs após buscas da verificação
    for (const s of data.sources) if (s.origin === "web_search" && !s.urlConfirmed && s.url) s.urlConfirmed = isConfirmed(s.url, searched);

    for (const d of data.datasets) {
      const official = d.id.startsWith("api-") || d.id.startsWith("sec-");
      const v = verification?.datasets.find((x) => x.datasetId === d.id);
      const suggested = v?.status ?? (official ? "verified" : "unverified");
      d.verification.status = capStatus(suggested, official ? undefined : det.caps.get(d.id));
      if (v?.notes.length) d.verification.notes.push(...v.notes);
    }
    const flagMap = new Map<string, string>();
    det.paragraphFlags.forEach((f) => flagMap.set(f.paragraph.id, f.issue));
    verification?.paragraphFlags.forEach((f) => flagMap.set(f.paragraphId, [flagMap.get(f.paragraphId), f.issue].filter(Boolean).join(" ")));
    for (const s of data.sections) for (const para of s.paragraphs) para.flagged = flagMap.get(para.id) ?? null;

    // Visualização
    const charts = await runVisualization(data.datasets, progress);

    // Revisão final
    let director: DirectorOut | null = null;
    try {
      director = await runDirector(p, data.sections, data.datasets, data.sources, verification, charts, progress);
    } catch (err) {
      if (err instanceof AIConfigError) throw err;
      progress.set("director", { status: "failed", message: err instanceof Error ? err.message : String(err) });
    }

    const srcIds = new Set(data.sources.map((s) => s.id));
    const dsIds = new Set(data.datasets.map((d) => d.id));
    if (director) {
      for (const f of director.paragraphFlags) {
        for (const s of data.sections) for (const para of s.paragraphs) if (para.id === f.paragraphId) para.flagged = [para.flagged, `Revisão: ${f.issue}`].filter(Boolean).join(" ");
      }
    }
    const conclusions: Section = {
      id: "conclusions",
      title: "Conclusões",
      paragraphs: (director?.conclusions ?? []).map((c, i) => ({ id: `conclusions-${i + 1}`, text: c.text, sourceIds: c.sourceIds.filter((x) => srcIds.has(x)), datasetIds: c.datasetIds.filter((x) => dsIds.has(x)), agent: "director" as const })),
      keyFindings: director?.conclusionKeyFindings ?? [],
      limitations: director ? [] : ["A revisão final não foi concluída; conclusões indisponíveis."],
      datasetIds: [],
    };

    const stats = {
      datasets: data.datasets.length,
      verified: data.datasets.filter((d) => d.verification.status === "verified").length,
      partially: data.datasets.filter((d) => d.verification.status === "partially_verified").length,
      unverified: data.datasets.filter((d) => d.verification.status === "unverified").length,
      rejected: data.datasets.filter((d) => d.verification.status === "rejected").length,
      sources: data.sources.length,
      confirmedUrls: data.sources.filter((s) => s.urlConfirmed).length,
    };
    const totalSearches = progress.state.reduce((a, s) => a + (s.searches ?? 0), 0);
    const methodology: Section = {
      id: "methodology",
      title: "Fontes e metodologia",
      paragraphs: [
        `Esta pesquisa foi elaborada em ${new Date().toLocaleDateString("pt-BR")} por uma equipe de seis agentes especializados (pesquisa de mercado, análise financeira, macroeconomia, verificação de dados, visualização e revisão final), utilizando o modelo ${AI_MODEL}, ${totalSearches} consultas a mecanismo de busca web e ${reg.calls} consultas diretas a APIs oficiais (Banco Central do Brasil, Banco Mundial, FMI e SEC, conforme aplicável).`,
        "Cada dado quantitativo foi classificado quanto à natureza — dado histórico, estimativa de terceiros ou projeção própria — e associado às respectivas fontes. Dados obtidos via APIs oficiais foram incorporados diretamente, sem transcrição manual. Cálculos próprios trazem a metodologia descrita no respectivo conjunto de dados.",
        `Verificação: ${stats.datasets} conjuntos de dados avaliados — ${stats.verified} verificados, ${stats.partially} parcialmente verificados, ${stats.unverified} não verificados e ${stats.rejected} rejeitados (excluídos das visualizações). Das ${stats.sources} fontes, ${stats.confirmedUrls} tiveram a URL confirmada entre os resultados efetivamente retornados pela busca ou pelas APIs.`,
        ...(director?.methodologyNotes ?? []),
      ].map((text, i) => ({ id: `methodology-${i + 1}`, text, sourceIds: [], datasetIds: [], agent: "director" as const })),
      keyFindings: [],
      limitations: [],
      datasetIds: [],
    };

    const content: ResearchContent = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      model: AI_MODEL,
      sections: [...data.sections, conclusions, methodology],
      datasets: data.datasets,
      sources: data.sources,
      charts,
      verification: {
        summary: verification?.summary ?? "O agente de verificação não concluiu; apenas verificações automáticas foram aplicadas.",
        issues: [...det.issues, ...(verification?.issues ?? [])],
        stats,
      },
      review: director ? { summary: director.summary, checks: director.checks, recommendations: director.recommendations } : { summary: "Revisão final indisponível.", checks: [], recommendations: [] },
      answers: (director?.answers ?? []).map((a) => ({ ...a, sourceIds: a.sourceIds.filter((x) => srcIds.has(x)) })),
      limitations: [...failures.map((f) => `Agente não concluído — ${f}`), ...data.globalLimitations],
      edits: [],
    };

    await progress.flush();
    await prisma.researchVersion.update({ where: { id: versionId }, data: { status: "completed", content: content as never, completedAt: new Date(), progress: progress.state as never } });
    await prisma.project.update({ where: { id: version.projectId }, data: { status: "completed", currentVersionId: versionId } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pipeline] falha:", err);
    await progress.flush();
    await prisma.researchVersion.update({ where: { id: versionId }, data: { status: "failed", error: msg } });
    const project = await prisma.project.findUnique({ where: { id: version.projectId } });
    await prisma.project.update({ where: { id: version.projectId }, data: { status: project?.currentVersionId ? "completed" : "failed" } });
  }
}

/** Dispara a pesquisa em segundo plano no processo Node.js do servidor */
const running = new Set<string>();
export function isResearchRunning(versionId: string) {
  return running.has(versionId);
}
export function startResearch(versionId: string) {
  if (running.has(versionId)) return;
  running.add(versionId);
  void runResearch(versionId).finally(() => running.delete(versionId));
}
