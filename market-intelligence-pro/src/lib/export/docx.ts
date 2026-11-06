import "server-only";
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { chartRows, formatNumber, sourceLine } from "../charts";
import type { ChartSpec, Dataset } from "../types";
import { chartOf, citation, datasetOf, imageBuffer, pagesFor, sourceNumbering, type ExportInput } from "./common";

const NAVY = "0F2547";
const FONT = "Calibri";

function dataTable(c: ChartSpec, d: Dataset) {
  const rows = chartRows(d, c);
  const meta = d.series.filter((s) => c.seriesKeys.includes(s.key));
  const cell = (text: string, opts: { header?: boolean; right?: boolean; shade?: boolean } = {}) =>
    new TableCell({
      shading: opts.header ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : opts.shade ? { type: ShadingType.CLEAR, fill: "F3F6FB", color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({ alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: opts.header, color: opts.header ? "FFFFFF" : "1F2937", size: 18, font: FONT })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({ tableHeader: true, children: [cell(d.dimension, { header: true }), ...meta.map((m) => cell(`${m.label} (${m.unit})`, { header: true, right: true }))] }),
      ...rows.map((r, i) => new TableRow({ children: [cell(String(r.label), { shade: i % 2 === 1 }), ...meta.map((m) => cell(formatNumber(r[m.key] as number | null, m.unit), { right: true, shade: i % 2 === 1 }))] })),
    ],
  });
}

export async function buildDocx(input: ExportInput) {
  const { research, report } = input;
  const numbering = sourceNumbering(report);
  const children: (Paragraph | Table)[] = [];
  let figure = 0;
  let table = 0;

  // Capa
  children.push(
    new Paragraph({ spacing: { before: 3000 }, children: [new TextRun({ text: input.title, bold: true, size: 56, color: NAVY, font: FONT })] }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: input.subtitle, size: 28, color: "4B5563", font: FONT })] }),
    new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: `Elaborado em ${new Date(report.generatedAt).toLocaleDateString("pt-BR")}`, size: 20, color: "6B7280", font: FONT })] }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  const pages = pagesFor(report, research, false);
  pages.forEach((page, pi) => {
    for (const b of page.blocks) {
      if (b.kind === "heading") children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: b.text, color: NAVY, font: FONT, bold: true, size: 30 })] }));
      else if (b.kind === "summary") {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Sumário executivo", color: NAVY, font: FONT, bold: true, size: 30 })] }));
        children.push(new Paragraph({ spacing: { after: 160, line: 300 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: b.text, size: 22, font: FONT })] }));
      } else if (b.kind === "paragraph") {
        const cite = citation(b.sourceIds, numbering);
        children.push(new Paragraph({
          spacing: { after: 160, line: 300 },
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: b.text, size: 22, font: FONT }), ...(cite ? [new TextRun({ text: ` ${cite}`, size: 16, color: "6B7280", font: FONT, superScript: true })] : [])],
        }));
      } else if (b.kind === "visual") {
        const c = chartOf(report, b.chartId);
        const d = c ? datasetOf(research, c.datasetId) : undefined;
        if (!c || !d) continue;
        const img = input.images[c.id];
        const buf = img ? imageBuffer(img.dataUrl) : null;
        const isTable = c.type === "table" || !buf;
        const label = isTable ? `Tabela ${++table}` : `Figura ${++figure}`;
        children.push(new Paragraph({ spacing: { before: 200, after: 40 }, keepNext: true, children: [new TextRun({ text: `${label} — ${c.title}`, bold: true, size: 20, color: NAVY, font: FONT })] }));
        children.push(new Paragraph({ spacing: { after: 80 }, keepNext: true, children: [new TextRun({ text: c.subtitle, size: 17, color: "6B7280", font: FONT })] }));
        if (!isTable && buf) {
          const width = 600;
          const height = Math.round((img!.height / img!.width) * width);
          children.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [new ImageRun({ type: "png", data: buf, transformation: { width, height } })] }));
        } else children.push(dataTable(c, d));
        children.push(new Paragraph({ spacing: { before: 60, after: 240 }, children: [new TextRun({ text: sourceLine(d, research.sources), italics: true, size: 16, color: "6B7280", font: FONT })] }));
      } else if (b.kind === "sources") {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: page.title, color: NAVY, font: FONT, bold: true, size: 30 })] }));
        for (const id of b.sourceIds) {
          const s = research.sources.find((x) => x.id === id);
          if (!s) continue;
          const parts = [s.publisher, s.title, s.date ? `(${s.date})` : null].filter(Boolean).join(". ");
          children.push(new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `[${numbering.get(id)}] ${parts}. `, size: 18, font: FONT }),
              ...(s.url ? [new ExternalHyperlink({ link: s.url, children: [new TextRun({ text: s.url, style: "Hyperlink", size: 18, font: FONT })] })] : []),
            ],
          }));
        }
      }
    }
    if (pi < pages.length - 1 && pages[pi + 1].blocks[0]?.kind === "heading") children.push(new Paragraph({ children: [new PageBreak()] }));
  });

  const doc = new Document({
    creator: "Market Intelligence Pro",
    title: input.title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: input.title, size: 16, color: "9CA3AF", font: FONT })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ["Página ", PageNumber.CURRENT], size: 16, color: "9CA3AF", font: FONT })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

