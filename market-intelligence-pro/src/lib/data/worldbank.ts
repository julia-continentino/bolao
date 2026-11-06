import "server-only";
import { DataSourceError, fetchJson, type OfficialSeries } from "./http";

/** Banco Mundial — World Development Indicators API v2 */
const INDICATORS: Record<string, { code: string; title: string; unit: string; currency?: string }> = {
  gdp_growth: { code: "NY.GDP.MKTP.KD.ZG", title: "PIB — crescimento real anual", unit: "% a.a." },
  gdp_usd: { code: "NY.GDP.MKTP.CD", title: "PIB a preços correntes", unit: "US$ correntes", currency: "USD" },
  gdp_per_capita_usd: { code: "NY.GDP.PCAP.CD", title: "PIB per capita", unit: "US$ correntes", currency: "USD" },
  inflation_cpi: { code: "FP.CPI.TOTL.ZG", title: "Inflação ao consumidor", unit: "% a.a." },
  unemployment: { code: "SL.UEM.TOTL.ZS", title: "Desemprego (estimativa modelada OIT)", unit: "% da força de trabalho" },
  household_consumption_growth: { code: "NE.CON.PRVT.KD.ZG", title: "Consumo das famílias — crescimento real", unit: "% a.a." },
  lending_rate: { code: "FR.INR.LEND", title: "Taxa de juros de empréstimos", unit: "% a.a." },
  exchange_rate_lcu_usd: { code: "PA.NUS.FCRF", title: "Taxa de câmbio oficial (moeda local por US$, média)", unit: "moeda local por US$" },
  internet_users: { code: "IT.NET.USER.ZS", title: "Usuários de internet", unit: "% da população" },
  population: { code: "SP.POP.TOTL", title: "População total", unit: "habitantes" },
};
export const WB_INDICATORS = Object.keys(INDICATORS);

/** Códigos aceitos: ISO3 de país (BRA, USA, ARG...) ou agregados (LCN, EUU, WLD) */
export async function worldBankSeries(indicator: string, area: string, startYear: number, endYear: number): Promise<OfficialSeries> {
  const def = INDICATORS[indicator];
  if (!def) throw new DataSourceError(`Indicador do Banco Mundial desconhecido: ${indicator}`);
  const code = area.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  if (code.length !== 3) throw new DataSourceError("Código de área inválido (use ISO3, ex.: BRA, USA, LCN, EUU, WLD).");
  const url = `https://api.worldbank.org/v2/country/${code}/indicator/${def.code}?format=json&date=${startYear}:${endYear}&per_page=200`;
  const raw = await fetchJson<unknown>(url);
  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) {
    const msg = Array.isArray(raw) && raw[0] && typeof raw[0] === "object" && "message" in raw[0] ? JSON.stringify((raw[0] as { message: unknown }).message) : "";
    throw new DataSourceError(`Banco Mundial sem dados para ${def.code}/${code}. ${msg}`);
  }
  const rows = raw[1] as { date: string; value: number | null; country: { value: string }; lastupdated?: string }[];
  const points = rows
    .filter((r) => r.value != null)
    .map((r) => ({ year: Number(r.date), value: Math.round((r.value as number) * 1000) / 1000 }))
    .sort((a, b) => a.year - b.year);
  if (!points.length) throw new DataSourceError(`Banco Mundial sem observações para ${def.code}/${code} no período.`);
  const areaName = rows[0]?.country?.value ?? code;
  const meta = raw[0] as { lastupdated?: string };
  return {
    title: `${def.title} — ${areaName}`,
    description: `${def.title} (${def.code}), ${areaName}, ${points[0].year}–${points[points.length - 1].year}.`,
    unit: def.unit,
    currency: def.currency ?? null,
    region: areaName,
    points,
    source: {
      title: `World Development Indicators — ${def.code}`,
      publisher: "Banco Mundial",
      url,
      date: meta?.lastupdated ?? null,
      type: "official_statistics",
    },
    methodology: `Valores anuais do indicador ${def.code} conforme publicados pelo Banco Mundial (WDI), sem transformação.`,
  };
}
