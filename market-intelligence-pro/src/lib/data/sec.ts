import "server-only";
import { DataSourceError, fetchJson } from "./http";

/**
 * SEC EDGAR — XBRL Company Facts (demonstrações financeiras protocoladas na SEC).
 * Requer User-Agent identificado: https://www.sec.gov/os/accessing-edgar-data
 */
type Fact = { start?: string; end: string; val: number; fy?: number; fp?: string; form?: string; filed?: string; frame?: string };
type CompanyFacts = { cik: number; entityName: string; facts: Record<string, Record<string, { label?: string; units: Record<string, Fact[]> }>> };

export function secEnabled() {
  return Boolean(process.env.SEC_USER_AGENT && process.env.SEC_USER_AGENT.includes("@"));
}
function headers() {
  if (!secEnabled()) throw new DataSourceError("Integração SEC desativada: defina SEC_USER_AGENT (nome e e-mail de contato).");
  return { "User-Agent": process.env.SEC_USER_AGENT as string };
}

let tickerCache: { at: number; map: Map<string, { cik: number; title: string }> } | null = null;
async function lookupCik(ticker: string) {
  if (!tickerCache || Date.now() - tickerCache.at > 24 * 3600_000) {
    const raw = await fetchJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json", { headers: headers() });
    const map = new Map<string, { cik: number; title: string }>();
    for (const v of Object.values(raw)) map.set(v.ticker.toUpperCase(), { cik: v.cik_str, title: v.title });
    tickerCache = { at: Date.now(), map };
  }
  const hit = tickerCache.map.get(ticker.toUpperCase().trim());
  if (!hit) throw new DataSourceError(`Ticker ${ticker} não encontrado na base da SEC.`);
  return hit;
}

const CONCEPTS = {
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"],
  costOfRevenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfServices"],
  grossProfit: ["GrossProfit"],
  sga: ["SellingGeneralAndAdministrativeExpense"],
  rnd: ["ResearchAndDevelopmentExpense"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  da: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
} as const;
const IFRS: Record<keyof typeof CONCEPTS, string[]> = {
  revenue: ["Revenue", "RevenueFromContractsWithCustomers"],
  costOfRevenue: ["CostOfSales"],
  grossProfit: ["GrossProfit"],
  sga: ["SellingGeneralAndAdministrativeExpense"],
  rnd: ["ResearchAndDevelopmentExpense"],
  operatingIncome: ["ProfitLossFromOperatingActivities"],
  netIncome: ["ProfitLoss"],
  da: ["DepreciationAndAmortisationExpense"],
  capex: ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
};

function annualValues(facts: CompanyFacts, names: readonly string[], ns: string): { byYear: Map<number, number>; unit: string } | null {
  const group = facts.facts[ns];
  if (!group) return null;
  for (const name of names) {
    const concept = group[name];
    if (!concept) continue;
    const unitKey = Object.keys(concept.units)[0];
    if (!unitKey) continue;
    const byYear = new Map<number, number>();
    for (const f of concept.units[unitKey]) {
      if (!f.start || !f.form || !/^(10-K|20-F|40-F)/.test(f.form)) continue;
      const days = (Date.parse(f.end) - Date.parse(f.start)) / 86_400_000;
      if (days < 350 || days > 380) continue;
      // frame "CY2023" identifica o valor anual consolidado do ano-calendário, sem duplicidade
      const year = f.frame && /^CY\d{4}$/.test(f.frame) ? Number(f.frame.slice(2)) : null;
      if (year) byYear.set(year, f.val);
    }
    if (byYear.size) return { byYear, unit: unitKey };
  }
  return null;
}

export async function secCompanyFinancials(ticker: string, startYear: number, endYear: number) {
  const { cik, title } = await lookupCik(ticker);
  const cik10 = String(cik).padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`;
  const facts = await fetchJson<CompanyFacts>(url, { headers: headers(), timeoutMs: 40_000 });
  const ns = facts.facts["us-gaap"] ? "us-gaap" : "ifrs-full";
  const map = ns === "us-gaap" ? CONCEPTS : IFRS;

  const lines: Partial<Record<keyof typeof CONCEPTS, Map<number, number>>> = {};
  let currency = "USD";
  for (const key of Object.keys(map) as (keyof typeof CONCEPTS)[]) {
    const r = annualValues(facts, map[key], ns);
    if (r) {
      lines[key] = r.byYear;
      if (key === "revenue") currency = r.unit;
    }
  }
  if (!lines.revenue) throw new DataSourceError(`Receita anual não localizada nas demonstrações XBRL de ${facts.entityName}.`);

  const years = [...lines.revenue.keys()].filter((y) => y >= startYear && y <= endYear).sort();
  if (!years.length) throw new DataSourceError(`Sem dados anuais de ${facts.entityName} entre ${startYear} e ${endYear}.`);

  const pct = (a: number | undefined, b: number | undefined) => (a == null || b == null || b === 0 ? null : Math.round((a / b) * 10000) / 100);
  const mn = (v: number | undefined) => (v == null ? null : Math.round((v / 1e6) * 10) / 10);
  const rows = years.map((y) => {
    const rev = lines.revenue!.get(y);
    const cogs = lines.costOfRevenue?.get(y);
    const gp = lines.grossProfit?.get(y) ?? (rev != null && cogs != null ? rev - cogs : undefined);
    const ebit = lines.operatingIncome?.get(y);
    const da = lines.da?.get(y);
    const ebitda = ebit != null && da != null ? ebit + da : undefined;
    return {
      year: y,
      revenue_mn: mn(rev),
      gross_margin_pct: pct(gp, rev),
      ebitda_margin_pct: pct(ebitda, rev),
      ebit_margin_pct: pct(ebit, rev),
      net_margin_pct: pct(lines.netIncome?.get(y), rev),
      cost_of_revenue_pct: pct(cogs, rev),
      sga_pct: pct(lines.sga?.get(y), rev),
      rnd_pct: pct(lines.rnd?.get(y), rev),
      capex_pct: pct(lines.capex?.get(y), rev),
    };
  });
  return {
    company: facts.entityName || title,
    ticker: ticker.toUpperCase(),
    cik: cik10,
    currency,
    taxonomy: ns,
    rows,
    source: {
      title: `XBRL Company Facts — ${facts.entityName || title} (CIK ${cik10})`,
      publisher: "U.S. Securities and Exchange Commission (EDGAR)",
      url,
      filingsUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik10}&type=10-K`,
    },
    methodology:
      "Valores anuais (frame CY) de formulários 10-K/20-F extraídos da API XBRL da SEC. Receita em milhões da moeda reportada. " +
      "Margens calculadas pela plataforma: lucro bruto/receita (lucro bruto = receita − custo quando não reportado), EBIT = OperatingIncomeLoss, " +
      "EBITDA = EBIT + depreciação e amortização (quando ambos disponíveis), margem líquida = NetIncomeLoss/receita; custos, SG&A, P&D e Capex como % da receita.",
  };
}
