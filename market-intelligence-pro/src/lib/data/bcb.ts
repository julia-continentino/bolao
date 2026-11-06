import "server-only";
import { DataSourceError, fetchJson, type OfficialSeries } from "./http";

/**
 * Banco Central do Brasil — Sistema Gerenciador de Séries Temporais (SGS)
 * Documentação: https://dadosabertos.bcb.gov.br/dataset/sgs
 */
type Agg = "last" | "mean" | "value";
const SERIES: Record<string, { code: number; title: string; unit: string; agg: Agg; currency?: string; note: string }> = {
  gdp_growth: { code: 7326, title: "PIB — variação real anual", unit: "% a.a.", agg: "value", note: "Série anual SGS 7326 (fonte primária: IBGE)." },
  inflation_ipca: { code: 13522, title: "IPCA — inflação acumulada em 12 meses (dezembro)", unit: "% a.a.", agg: "last", note: "Valor de dezembro da série SGS 13522 (fonte primária: IBGE)." },
  policy_rate_selic: { code: 4189, title: "Taxa Selic acumulada no mês anualizada (dezembro)", unit: "% a.a.", agg: "last", note: "Valor de dezembro da série SGS 4189." },
  exchange_rate_usd: { code: 3698, title: "Taxa de câmbio R$/US$ — média anual (venda)", unit: "R$ por US$", agg: "mean", currency: "BRL", note: "Média aritmética dos valores mensais da série SGS 3698." },
  unemployment: { code: 24369, title: "Taxa de desocupação — PNAD Contínua (média anual)", unit: "%", agg: "mean", note: "Média dos trimestres móveis mensais da série SGS 24369 (fonte primária: IBGE)." },
};
export const BCB_INDICATORS = Object.keys(SERIES);

export async function bcbSeries(indicator: string, startYear: number, endYear: number): Promise<OfficialSeries> {
  const def = SERIES[indicator];
  if (!def) throw new DataSourceError(`Indicador BCB desconhecido: ${indicator}`);
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${def.code}/dados?formato=json&dataInicial=01/01/${startYear}&dataFinal=31/12/${endYear}`;
  const raw = await fetchJson<{ data: string; valor: string }[]>(url);
  if (!Array.isArray(raw)) throw new DataSourceError("Resposta inesperada do SGS/BCB.");

  const byYear = new Map<number, { month: number; v: number }[]>();
  for (const r of raw) {
    const [d, m, y] = r.data.split("/").map(Number);
    const v = Number(r.valor);
    if (!Number.isFinite(v) || !y) continue;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push({ month: m * 100 + d, v });
  }
  const points: OfficialSeries["points"] = [];
  for (const [year, vals] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    vals.sort((a, b) => a.month - b.month);
    let value: number;
    if (def.agg === "mean") {
      // só considera ano completo para médias
      if (vals.length < 12) continue;
      value = vals.reduce((s, x) => s + x.v, 0) / vals.length;
    } else if (def.agg === "last") {
      const last = vals[vals.length - 1];
      if (Math.floor(last.month / 100) !== 12) continue; // exige dezembro
      value = last.v;
    } else value = vals[vals.length - 1].v;
    points.push({ year, value: Math.round(value * 100) / 100 });
  }
  if (!points.length) throw new DataSourceError(`Sem observações anuais completas para ${def.title} entre ${startYear} e ${endYear}.`);

  return {
    title: def.title,
    description: `${def.title} — Brasil, ${points[0].year}–${points[points.length - 1].year}.`,
    unit: def.unit,
    currency: def.currency ?? null,
    region: "Brasil",
    points,
    source: {
      title: `SGS ${def.code} — ${def.title}`,
      publisher: "Banco Central do Brasil (SGS)",
      url,
      date: null,
      type: "official_statistics",
    },
    methodology: def.note,
  };
}
