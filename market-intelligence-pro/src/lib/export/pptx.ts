import "server-only";
import PptxGenJS from "pptxgenjs";
import { chartRows, formatNumber, seriesMeta, sourceLine } from "../charts";
import { DEFAULT_PALETTE, type ChartSpec, type Dataset, type ReportBlock } from "../types";
import { chartOf, citation, datasetOf, formatSource, pagesFor, sourceNumbering, type ExportInput } from "./common";

const NAVY = "0F2547";
const GREY = "6B7280";
const W = 13.333;
const H = 7.5;

function hex(c: string) {
  return c.replace("#", "").toUpperCase();
}

function addNativeChart(pptx: PptxGenJS, slide: PptxGenJS.Slide, c: ChartSpec, d: Dataset, box: { x: number; y: number; w: number; h: number }) {
  const rows = chartRows(d, c);
  const meta = seriesMeta(d, c);
  const labels = rows.map((r) => String(r.label));
  const base: PptxGenJS.IChartOpts = {
    ...box,
    showLegend: c.showLegend,
    legendPos: "b",
    legendFontSize: 9,
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
    showValue: c.showDataLabels,
    dataLabelFontSize: 8,
    dataLabelFormatCode: "#,##0.0",
    valAxisLabelFormatCode: "#,##0",
    chartColors: meta.map((m) => hex(m.color)),
    showTitle: false,
    valGridLine: { color: "E5E7EB", size: 0.5 },
    catGridLine: { style: "none" },
  };
  if (c.type === "pie") {
    const m = meta[0];
    slide.addChart(pptx.ChartType.doughnut, [{ name: m.label, labels, values: rows.map((r) => Number(r[m.key] ?? 0)) }], {
      ...base,
      showLegend: true,
      showPercent: true,
      showValue: false,
      holeSize: 55,
      chartColors: labels.map((_, i) => hex(DEFAULT_PALETTE[i % DEFAULT_PALETTE.length])),
    });
    return;
  }
  const data = meta.map((m) => ({ name: m.label, labels, values: rows.map((r) => (r[m.key] == null ? 0 : Number(r[m.key]))) }));
  if (c.type === "line" || c.type === "area") {
    slide.addChart(c.type === "line" ? pptx.ChartType.line : pptx.ChartType.area, data, { ...base, lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 5 });
    return;
  }
  slide.addChart(pptx.ChartType.bar, data, {
    ...base,
    barDir: c.type === "bar" ? "bar" : "col",
    barGrouping: c.type === "stacked" ? "stacked" : c.type === "stacked100" ? "percentStacked" : "clustered",
    barGapWidthPct: 60,
    ...(c.type === "bar" ? ({ catAxisOrientation: "maxMin" } as unknown as PptxGenJS.IChartOpts) : {}),
  });
}

function addTable(slide: PptxGenJS.Slide, c: ChartSpec, d: Dataset, box: { x: number; y: number; w: number; h: number }) {
  const rows = chartRows(d, c);
  const meta = d.series.filter((s) => c.seriesKeys.includes(s.key));
  const fontSize = rows.length > 12 ? 8 : 9.5;
  const header: PptxGenJS.TableRow = [d.dimension, ...meta.map((m) => `${m.label}\n(${m.unit})`)].map((t) => ({
    text: t,
    options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize, valign: "middle" as const },
  }));
  const body: PptxGenJS.TableRow[] = rows.map((r, i) => [
    { text: String(r.label), options: { fontSize, fill: { color: i % 2 ? "F3F6FB" : "FFFFFF" } } },
    ...meta.map((m) => ({ text: formatNumber(r[m.key] as number | null, m.unit), options: { fontSize, align: "right" as const, fill: { color: i % 2 ? "F3F6FB" : "FFFFFF" } } })),
  ]);
  // altura definida pelas linhas (sem esticar a tabela até o fim da área)
  slide.addTable([header, ...body], { x: box.x, y: box.y, w: box.w, rowH: rows.length > 12 ? 0.24 : 0.3, border: { type: "solid", color: "E5E7EB", pt: 0.5 }, autoPage: false, colW: [box.w * 0.34, ...meta.map(() => (box.w * 0.66) / Math.max(1, meta.length))] });
}

export async function buildPptx(input: ExportInput) {
  const { research, report } = input;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = input.title;
  pptx.company = "Market Intelligence Pro";
  const numbering = sourceNumbering(report);

  pptx.defineSlideMaster({
    title: "MIP",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.12, fill: { color: NAVY } } },
      { text: { text: "Market Intelligence Pro", options: { x: 0.5, y: H - 0.4, w: 4, h: 0.3, fontSize: 8, color: GREY } } },
    ],
    slideNumber: { x: W - 1, y: H - 0.4, w: 0.6, h: 0.3, fontSize: 8, color: GREY },
  });

  // Capa
  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  cover.addText(input.title, { x: 0.8, y: 2.3, w: W - 1.6, h: 1.4, fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Calibri" });
  cover.addText(input.subtitle, { x: 0.8, y: 3.8, w: W - 1.6, h: 0.8, fontSize: 16, color: "C9D6EA" });
  cover.addText(`Elaborado em ${new Date(report.generatedAt).toLocaleDateString("pt-BR")} · Pesquisa de ${new Date(research.generatedAt).toLocaleDateString("pt-BR")}`, { x: 0.8, y: 6.4, w: W - 1.6, h: 0.4, fontSize: 11, color: "8AA9D6" });

  for (const page of pagesFor(report, research, true)) {
    const slide = pptx.addSlide({ masterName: "MIP" });
    slide.addText(page.title, { x: 0.5, y: 0.3, w: W - 1, h: 0.7, fontSize: 24, bold: true, color: NAVY, fontFace: "Calibri" });

    const texts = page.blocks.filter((b): b is Extract<ReportBlock, { kind: "paragraph" | "summary" }> => b.kind === "paragraph" || b.kind === "summary");
    const visuals = page.blocks.filter((b): b is Extract<ReportBlock, { kind: "visual" }> => b.kind === "visual");
    const sourcesBlock = page.blocks.find((b): b is Extract<ReportBlock, { kind: "sources" }> => b.kind === "sources");
    const footSources = new Set<string>();

    if (sourcesBlock) {
      const lines = sourcesBlock.sourceIds.map((id) => {
        const s = research.sources.find((x) => x.id === id);
        return s ? { text: `[${numbering.get(id)}] ${formatSource(s)}`, options: { breakLine: true, fontSize: 10, color: "374151", hyperlink: s.url ? { url: s.url } : undefined } } : null;
      }).filter((x): x is NonNullable<typeof x> => !!x);
      slide.addText(lines, { x: 0.5, y: 1.15, w: W - 1, h: H - 1.8, valign: "top", paraSpaceAfter: 6 });
      continue;
    }

    const top = 1.15;
    const bottom = H - 0.85;
    const textW = visuals.length ? 5.6 : W - 1;
    if (texts.length) {
      const runs = texts.flatMap((t) => {
        const cite = t.kind === "paragraph" ? citation(t.sourceIds, numbering) : "";
        if (t.kind === "paragraph") t.sourceIds.forEach((id) => footSources.add(id));
        return [
          { text: t.text, options: { fontSize: 13, color: "1F2937" } },
          ...(cite ? [{ text: ` ${cite}`, options: { fontSize: 9, color: GREY, superscript: false } }] : []),
          { text: "", options: { breakLine: true } },
        ];
      });
      slide.addText(runs as PptxGenJS.TextProps[], { x: 0.5, y: top, w: textW, h: bottom - top, valign: "top", paraSpaceAfter: 10, fit: "shrink", lineSpacingMultiple: 1.1 });
    }
    if (visuals.length) {
      const vx = texts.length ? 6.4 : 0.5;
      const vw = texts.length ? W - vx - 0.5 : W - 1;
      const each = (bottom - top) / visuals.length;
      visuals.forEach((v, i) => {
        const c = chartOf(report, v.chartId);
        const d = c ? datasetOf(research, c.datasetId) : undefined;
        if (!c || !d) return;
        const y = top + i * each;
        slide.addText(c.title, { x: vx, y, w: vw, h: 0.35, fontSize: 12, bold: true, color: NAVY });
        slide.addText(c.subtitle, { x: vx, y: y + 0.32, w: vw, h: 0.28, fontSize: 9, color: GREY });
        const box = { x: vx, y: y + 0.62, w: vw, h: each - 1.0 };
        if (c.type === "table") addTable(slide, c, d, box);
        else addNativeChart(pptx, slide, c, d, box);
        slide.addText(sourceLine(d, research.sources), { x: vx, y: y + each - 0.36, w: vw, h: 0.3, fontSize: 8, color: GREY, italic: true });
        d.sourceIds.forEach((id) => footSources.add(id));
      });
    }
    const cites = citation([...footSources], numbering);
    if (cites && !visuals.length) slide.addText(`Referências: ${cites}`, { x: 0.5, y: H - 0.75, w: W - 1, h: 0.3, fontSize: 8, color: GREY });
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

