import "server-only";
import type { ClientTool } from "./runtime";
import type { AgentKey, Dataset, SectionId, Source } from "../types";
import { BCB_INDICATORS, bcbSeries } from "../data/bcb";
import { WB_INDICATORS, worldBankSeries } from "../data/worldbank";
import { IMF_INDICATORS, imfSeries } from "../data/imf";
import { secCompanyFinancials, secEnabled } from "../data/sec";
import type { OfficialSeries } from "../data/http";

/**
 * Registro de dados obtidos diretamente de APIs oficiais durante a execução.
 * Os números entram nos datasets sem passar pelo modelo — o agente apenas os referencia.
 */
export class ApiRegistry {
  sources: Source[] = [];
  datasets: Dataset[] = [];
  calls = 0;
  private n = 0;
  private secCache = new Map<string, Awaited<ReturnType<typeof secCompanyFinancials>>>();

  private addSource(agent: AgentKey, s: OfficialSeries["source"]): Source {
    const existing = this.sources.find((x) => x.url === s.url);
    if (existing) return existing;
    const src: Source = {
      id: `api-src-${++this.n}`,
      title: s.title,
      publisher: s.publisher,
      date: s.date,
      url: s.url,
      type: s.type === "official_statistics" ? "official_statistics" : s.type,
      origin: "public_api",
      urlConfirmed: true,
      accessedAt: new Date().toISOString(),
      agent,
    };
    this.sources.push(src);
    return src;
  }

  addOfficialSeries(agent: AgentKey, sectionId: SectionId, s: OfficialSeries): Dataset {
    const src = this.addSource(agent, s.source);
    const ds: Dataset = {
      id: `api-ds-${++this.n}`,
      title: s.title,
      description: s.description,
      sectionId,
      kind: "time_series",
      dimension: "Ano",
      unit: s.unit,
      currency: s.currency,
      region: s.region,
      period: `${s.points[0].year}–${s.points[s.points.length - 1].year}`,
      series: [{ key: "value", label: s.title, unit: s.unit }],
      rows: s.points.map((p) => ({
        label: String(p.year),
        nature: p.estimate ? "third_party_estimate" : "historical",
        values: { value: p.value },
        sourceIds: [src.id],
        note: p.estimate ? "Projeção/estimativa publicada pela fonte" : null,
      })),
      sourceIds: [src.id],
      methodology: s.methodology,
      agent,
      verification: { status: "verified", notes: ["Dado obtido diretamente da API oficial da instituição."] },
    };
    this.datasets.push(ds);
    return ds;
  }

  async sec(ticker: string, startYear: number, endYear: number) {
    const key = `${ticker.toUpperCase()}:${startYear}:${endYear}`;
    if (!this.secCache.has(key)) this.secCache.set(key, await secCompanyFinancials(ticker, startYear, endYear));
    return this.secCache.get(key)!;
  }

  addSecSource(agent: AgentKey, r: Awaited<ReturnType<typeof secCompanyFinancials>>) {
    return this.addSource(agent, { title: r.source.title, publisher: r.source.publisher, url: r.source.url, date: null, type: "company_filing" as never });
  }
}

const fmtSeries = (ds: Dataset) =>
  JSON.stringify({
    datasetId: ds.id,
    sourceId: ds.sourceIds[0],
    title: ds.title,
    unit: ds.unit,
    region: ds.region,
    values: ds.rows.map((r) => ({ period: r.label, value: r.values.value, nature: r.nature })),
  });

export function macroTools(reg: ApiRegistry, agent: AgentKey, defaultStart: number, defaultEnd: number): ClientTool[] {
  return [
    {
      name: "get_official_series",
      description:
        "Obtém uma série anual diretamente de APIs oficiais (Banco Central do Brasil/SGS, Banco Mundial/WDI ou FMI/WEO) e a registra como dataset da pesquisa. " +
        "Retorna datasetId e sourceId que devem ser usados em datasetRefs/sourceRefs. " +
        `Indicadores — bcb (somente Brasil): ${BCB_INDICATORS.join(", ")}; worldbank: ${WB_INDICATORS.join(", ")}; imf: ${IMF_INDICATORS.join(", ")}. ` +
        "area: código ISO3 do país (BRA, USA, MEX, ARG, DEU...) ou agregados do Banco Mundial (LCN = América Latina e Caribe, EUU = União Europeia, WLD = Mundo); para o FMI use ISO3 ou WEOWORLD.",
      input_schema: {
        type: "object",
        properties: {
          provider: { type: "string", enum: ["bcb", "worldbank", "imf"] },
          indicator: { type: "string" },
          area: { type: "string", description: "ISO3 ou código de agregado; ignorado para bcb" },
          startYear: { type: "integer" },
          endYear: { type: "integer" },
          sectionId: { type: "string", enum: ["overview", "sizing", "trends", "risks", "outlook"], description: "Seção onde o dado será discutido" },
        },
        required: ["provider", "indicator", "sectionId"],
      },
      async run(input) {
        const i = input as { provider: string; indicator: string; area?: string; startYear?: number; endYear?: number; sectionId: SectionId };
        const start = i.startYear ?? defaultStart;
        const end = i.endYear ?? defaultEnd;
        reg.calls++;
        let s: OfficialSeries;
        if (i.provider === "bcb") s = await bcbSeries(i.indicator, start, end);
        else if (i.provider === "worldbank") s = await worldBankSeries(i.indicator, i.area || "BRA", start, end);
        else if (i.provider === "imf") s = await imfSeries(i.indicator, i.area || "BRA", start, end);
        else throw new Error("provider inválido");
        return fmtSeries(reg.addOfficialSeries(agent, i.sectionId ?? "outlook", s));
      },
    },
  ];
}

export function secTools(reg: ApiRegistry, agent: AgentKey, defaultStart: number, defaultEnd: number): ClientTool[] {
  if (!secEnabled()) return [];
  return [
    {
      name: "sec_company_financials",
      description:
        "Consulta as demonstrações financeiras anuais (10-K/20-F) de uma companhia listada na SEC (EUA) pelo ticker, via API XBRL oficial. " +
        "Registra um dataset com receita e margens calculadas (bruta, EBITDA, EBIT, líquida, custos, SG&A, P&D e Capex em % da receita). Retorna datasetId e sourceId.",
      input_schema: {
        type: "object",
        properties: { ticker: { type: "string" }, startYear: { type: "integer" }, endYear: { type: "integer" } },
        required: ["ticker"],
      },
      async run(input) {
        const i = input as { ticker: string; startYear?: number; endYear?: number };
        reg.calls++;
        const r = await reg.sec(i.ticker, i.startYear ?? defaultStart, i.endYear ?? defaultEnd);
        const src = reg.addSecSource(agent, r);
        const keys = ["revenue_mn", "gross_margin_pct", "ebitda_margin_pct", "ebit_margin_pct", "net_margin_pct", "cost_of_revenue_pct", "sga_pct", "rnd_pct", "capex_pct"] as const;
        const labels: Record<(typeof keys)[number], [string, string]> = {
          revenue_mn: ["Receita", `${r.currency} milhões`],
          gross_margin_pct: ["Margem bruta", "%"],
          ebitda_margin_pct: ["Margem EBITDA", "%"],
          ebit_margin_pct: ["Margem EBIT", "%"],
          net_margin_pct: ["Margem líquida", "%"],
          cost_of_revenue_pct: ["Custo dos produtos/serviços", "% da receita"],
          sga_pct: ["Despesas comerciais, gerais e administrativas", "% da receita"],
          rnd_pct: ["Pesquisa e desenvolvimento", "% da receita"],
          capex_pct: ["Capex", "% da receita"],
        };
        const used = keys.filter((k) => r.rows.some((row) => row[k] != null));
        const ds: Dataset = {
          id: `sec-${r.ticker}-${reg.datasets.length + 1}`,
          title: `${r.company} — receita e margens anuais`,
          description: `Indicadores anuais de ${r.company} (${r.ticker}) a partir das demonstrações protocoladas na SEC.`,
          sectionId: "financials",
          kind: "time_series",
          dimension: "Ano (calendário — frame CY)",
          unit: "misto (ver séries)",
          currency: r.currency,
          region: "Estados Unidos (SEC)",
          period: `${r.rows[0].year}–${r.rows[r.rows.length - 1].year}`,
          series: used.map((k) => ({ key: k, label: labels[k][0], unit: labels[k][1] })),
          rows: r.rows.map((row) => ({
            label: String(row.year),
            nature: "historical",
            values: Object.fromEntries(used.map((k) => [k, row[k]])),
            sourceIds: [src.id],
          })),
          sourceIds: [src.id],
          methodology: r.methodology,
          agent,
          verification: { status: "verified", notes: ["Valores extraídos da API XBRL da SEC; margens calculadas pela plataforma."] },
        };
        reg.datasets.push(ds);
        return JSON.stringify({ datasetId: ds.id, sourceId: src.id, company: r.company, currency: r.currency, rows: r.rows });
      },
    },
    {
      name: "sec_benchmark",
      description:
        "Cria um dataset comparativo (benchmarking) entre companhias listadas na SEC para um ano fiscal, com receita e margens calculadas a partir das demonstrações oficiais. Retorna datasetId.",
      input_schema: {
        type: "object",
        properties: { tickers: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 }, year: { type: "integer" } },
        required: ["tickers", "year"],
      },
      async run(input) {
        const i = input as { tickers: string[]; year: number };
        const rows: Dataset["rows"] = [];
        const srcIds: string[] = [];
        const errors: string[] = [];
        let currency: string | null = null;
        for (const t of i.tickers.slice(0, 10)) {
          try {
            reg.calls++;
            const r = await reg.sec(t, i.year - 4, i.year);
            const row = r.rows.find((x) => x.year === i.year);
            if (!row) {
              errors.push(`${t}: sem dados para ${i.year}`);
              continue;
            }
            if (currency && currency !== r.currency) {
              errors.push(`${t}: moeda ${r.currency} difere de ${currency}; excluída do comparativo`);
              continue;
            }
            currency = r.currency;
            const src = reg.addSecSource(agent, r);
            srcIds.push(src.id);
            rows.push({
              label: r.company,
              nature: "historical",
              values: { revenue_mn: row.revenue_mn, gross_margin_pct: row.gross_margin_pct, ebitda_margin_pct: row.ebitda_margin_pct, ebit_margin_pct: row.ebit_margin_pct, net_margin_pct: row.net_margin_pct },
              sourceIds: [src.id],
            });
          } catch (e) {
            errors.push(`${t}: ${e instanceof Error ? e.message : e}`);
          }
        }
        if (rows.length < 2) throw new Error(`Dados insuficientes para benchmarking. ${errors.join("; ")}`);
        const ds: Dataset = {
          id: `sec-bench-${i.year}-${reg.datasets.length + 1}`,
          title: `Benchmarking financeiro — ${i.year}`,
          description: "Comparação de receita e margens entre companhias com demonstrações protocoladas na SEC.",
          sectionId: "financials",
          kind: "comparison",
          dimension: "Empresa",
          unit: "misto (ver séries)",
          currency,
          region: "Estados Unidos (SEC)",
          period: `${i.year} (ano-calendário, frame CY da SEC)`,
          series: [
            { key: "revenue_mn", label: "Receita", unit: `${currency} milhões` },
            { key: "gross_margin_pct", label: "Margem bruta", unit: "%" },
            { key: "ebitda_margin_pct", label: "Margem EBITDA", unit: "%" },
            { key: "ebit_margin_pct", label: "Margem EBIT", unit: "%" },
            { key: "net_margin_pct", label: "Margem líquida", unit: "%" },
          ],
          rows,
          sourceIds: srcIds,
          methodology: "Margens calculadas pela plataforma a partir de valores XBRL anuais (frame CY) das demonstrações 10-K/20-F. EBITDA = EBIT + D&A.",
          agent,
          verification: { status: "verified", notes: ["Valores extraídos da API XBRL da SEC.", ...errors] },
        };
        reg.datasets.push(ds);
        return JSON.stringify({ datasetId: ds.id, sourceIds: srcIds, rows: rows.map((r) => ({ company: r.label, ...r.values })), warnings: errors });
      },
    },
  ];
}
