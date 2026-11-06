import "server-only";
import { DataSourceError, fetchJson, type OfficialSeries } from "./http";

/** FMI — DataMapper API (World Economic Outlook), inclui projeções oficiais do FMI */
const INDICATORS: Record<string, { code: string; title: string; unit: string; currency?: string }> = {
  gdp_growth: { code: "NGDP_RPCH", title: "PIB real — variação anual", unit: "% a.a." },
  inflation: { code: "PCPIPCH", title: "Inflação (média do período)", unit: "% a.a." },
  unemployment: { code: "LUR", title: "Taxa de desemprego", unit: "% da força de trabalho" },
  gdp_usd_billions: { code: "NGDPD", title: "PIB a preços correntes", unit: "US$ bilhões", currency: "USD" },
};
export const IMF_INDICATORS = Object.keys(INDICATORS);

export async function imfSeries(indicator: string, area: string, startYear: number, endYear: number): Promise<OfficialSeries> {
  const def = INDICATORS[indicator];
  if (!def) throw new DataSourceError(`Indicador do FMI desconhecido: ${indicator}`);
  const code = area.toUpperCase().replace(/[^A-Z]/g, "");
  const url = `https://www.imf.org/external/datamapper/api/v1/${def.code}/${code}`;
  const raw = await fetchJson<{ values?: Record<string, Record<string, Record<string, number>>> }>(url);
  const series = raw.values?.[def.code]?.[code];
  if (!series) throw new DataSourceError(`FMI sem dados para ${def.code}/${code}.`);
  const currentYear = new Date().getFullYear();
  const points = Object.entries(series)
    .map(([y, v]) => ({ year: Number(y), value: Math.round(Number(v) * 1000) / 1000, estimate: Number(y) >= currentYear }))
    .filter((p) => p.year >= startYear && p.year <= endYear && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
  if (!points.length) throw new DataSourceError(`FMI sem observações para ${def.code}/${code} no período.`);
  return {
    title: `${def.title} — ${code}`,
    description: `${def.title} (${def.code}), ${code}. Valores a partir de ${currentYear} são projeções do FMI (WEO).`,
    unit: def.unit,
    currency: def.currency ?? null,
    region: code,
    points,
    source: {
      title: `World Economic Outlook (DataMapper) — ${def.code}`,
      publisher: "Fundo Monetário Internacional",
      url,
      date: null,
      type: "official_statistics",
    },
    methodology: `Valores do FMI (WEO via DataMapper). Anos a partir de ${currentYear} são tratados como estimativas/projeções de terceiros (FMI).`,
  };
}
