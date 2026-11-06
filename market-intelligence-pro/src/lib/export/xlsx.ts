import "server-only";
import ExcelJS from "exceljs";
import { DATA_NATURE_LABEL, SOURCE_TYPE_LABEL, VERIFICATION_LABEL, type ChartSpec, type Dataset, type ResearchContent } from "../types";
import { rowDisplayLabel } from "../charts";

const NAVY = "FF0F2547";

function sheetName(base: string, used: Set<string>) {
  let name = base.replace(/[\[\]:*?/\\]/g, " ").slice(0, 28).trim() || "Dados";
  let i = 2;
  const orig = name;
  while (used.has(name.toLowerCase())) name = `${orig.slice(0, 25)} ${i++}`;
  used.add(name.toLowerCase());
  return name;
}

function addDatasetSheet(wb: ExcelJS.Workbook, d: Dataset, research: ResearchContent, used: Set<string>, keys?: string[], rowLabels?: string[] | null) {
  const ws = wb.addWorksheet(sheetName(d.title, used));
  const series = keys ? d.series.filter((s) => keys.includes(s.key)) : d.series;
  const rows = rowLabels ? d.rows.filter((r) => rowLabels.includes(r.label)) : d.rows;
  ws.addRow([d.title]).font = { bold: true, size: 13, color: { argb: NAVY } };
  ws.addRow([d.description]);
  const meta: [string, string][] = [
    ["Unidade", d.unit],
    ["Moeda", d.currency ?? "—"],
    ["Região", d.region],
    ["Período", d.period],
    ["Status de verificação", VERIFICATION_LABEL[d.verification.status]],
    ["Metodologia", d.methodology ?? "—"],
  ];
  for (const [k, v] of meta) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }
  ws.addRow([]);
  const header = ws.addRow([d.dimension, ...series.map((s) => `${s.label} (${s.unit})`), "Natureza do dado", "Fontes"]);
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  for (const r of rows) {
    const srcs = r.sourceIds.map((id) => research.sources.find((s) => s.id === id)?.publisher).filter(Boolean).join("; ");
    const row = ws.addRow([rowDisplayLabel(r.label, r.nature), ...series.map((s) => r.values[s.key] ?? null), DATA_NATURE_LABEL[r.nature], srcs]);
    series.forEach((_, i) => (row.getCell(i + 2).numFmt = "#,##0.00"));
  }
  ws.addRow([]);
  ws.addRow(["Legenda: sufixo E = estimativa de terceiros; P = projeção própria."]).font = { italic: true, size: 9 };
  ws.columns.forEach((c, i) => (c.width = i === 0 ? 34 : 20));
  ws.getColumn(series.length + 3).width = 50;
  return ws;
}

export async function buildWorkbook(opts: { title: string; research: ResearchContent; charts?: ChartSpec[] }) {
  const { research } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Market Intelligence Pro";
  wb.created = new Date();
  const used = new Set<string>();

  const summary = wb.addWorksheet(sheetName("Resumo", used));
  summary.addRow([opts.title]).font = { bold: true, size: 14, color: { argb: NAVY } };
  summary.addRow([`Gerado em ${new Date().toLocaleString("pt-BR")} · Pesquisa de ${new Date(research.generatedAt).toLocaleDateString("pt-BR")} · Modelo ${research.model}`]);
  summary.addRow([]);
  const st = research.verification.stats;
  for (const [k, v] of [["Datasets", st.datasets], ["Verificados", st.verified], ["Parcialmente verificados", st.partially], ["Não verificados", st.unverified], ["Rejeitados", st.rejected], ["Fontes", st.sources], ["URLs confirmadas", st.confirmedUrls]] as const) {
    const r = summary.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }
  summary.addRow([]);
  summary.addRow(["Conjuntos de dados"]).font = { bold: true };
  const list = opts.charts?.length ? opts.charts : null;
  const ds = list ? research.datasets.filter((d) => list.some((c) => c.datasetId === d.id)) : research.datasets;
  for (const d of ds) summary.addRow([d.title, d.unit, d.period, VERIFICATION_LABEL[d.verification.status]]);
  summary.columns.forEach((c, i) => (c.width = i === 0 ? 60 : 22));

  if (list) {
    for (const c of list) {
      const d = research.datasets.find((x) => x.id === c.datasetId);
      if (d) addDatasetSheet(wb, { ...d, title: c.title || d.title }, research, used, c.seriesKeys, c.rowLabels);
    }
  } else {
    for (const d of research.datasets) addDatasetSheet(wb, d, research, used);
  }

  const src = wb.addWorksheet(sheetName("Fontes", used));
  const h = src.addRow(["ID", "Título", "Instituição", "Data", "Tipo", "URL", "Origem", "URL confirmada"]);
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  });
  for (const s of research.sources) {
    const r = src.addRow([s.id, s.title, s.publisher, s.date ?? "—", SOURCE_TYPE_LABEL[s.type] ?? s.type, s.url ?? "—", s.origin === "public_api" ? "API oficial" : "Busca web", s.urlConfirmed ? "Sim" : "Não"]);
    if (s.url) r.getCell(6).value = { text: s.url, hyperlink: s.url };
  }
  src.columns = [{ width: 14 }, { width: 50 }, { width: 30 }, { width: 12 }, { width: 22 }, { width: 60 }, { width: 14 }, { width: 14 }];

  const ver = wb.addWorksheet(sheetName("Verificação", used));
  ver.addRow(["Severidade", "Descrição", "Itens relacionados"]).font = { bold: true };
  for (const i of research.verification.issues) ver.addRow([i.severity === "high" ? "Alta" : i.severity === "medium" ? "Média" : "Baixa", i.description, i.relatedIds.join(", ")]);
  ver.columns = [{ width: 12 }, { width: 100 }, { width: 30 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
