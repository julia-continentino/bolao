import "server-only";
import PDFDocument from "pdfkit";
import { chartRows, formatNumber, sourceLine } from "../charts";
import type { ChartSpec, Dataset } from "../types";
import { chartOf, citation, datasetOf, formatSource, imageBuffer, pagesFor, sourceNumbering, type ExportInput } from "./common";

const NAVY = "#0f2547";
const GREY = "#6b7280";
const TEXT = "#1f2937";

/** Remove caracteres fora do WinAnsi (fontes padrão do PDF) para evitar glifos inválidos */
function t(s: string) {
  return s.replace(/[‐-‒]/g, "-").replace(/[≤]/g, "<=").replace(/[≥]/g, ">=").replace(/[≈]/g, "~").replace(/[^\u0000-ÿ–—‘’“”•…€]/g, "");
}

export async function buildPdf(input: ExportInput): Promise<Buffer> {
  const { research, report } = input;
  const slides = report.format === "executive_presentation";
  const numbering = sourceNumbering(report);
  const doc = new PDFDocument({ size: "A4", layout: slides ? "landscape" : "portrait", margins: { top: 60, bottom: 60, left: 60, right: 60 }, bufferPages: true, info: { Title: input.title, Creator: "Market Intelligence Pro" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  const H = doc.page.height;
  const left = 60;
  const contentW = W - 120;
  const bottomLimit = () => H - 70;

  // Capa
  doc.rect(0, 0, W, H).fill(NAVY);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(30).text(t(input.title), left, H * 0.32, { width: contentW });
  doc.moveDown(0.5).font("Helvetica").fontSize(14).fillColor("#c9d6ea").text(t(input.subtitle), { width: contentW });
  doc.fontSize(10).fillColor("#8aa9d6").text(t(`Elaborado em ${new Date(report.generatedAt).toLocaleDateString("pt-BR")}`), left, H - 110);

  const ensure = (h: number) => {
    if (doc.y + h > bottomLimit()) {
      doc.addPage();
      doc.y = 60;
    }
  };

  const drawTable = (c: ChartSpec, d: Dataset) => {
    const rows = chartRows(d, c);
    const meta = d.series.filter((s) => c.seriesKeys.includes(s.key));
    const firstW = contentW * 0.34;
    const colW = (contentW - firstW) / Math.max(1, meta.length);
    const rowH = 18;
    const header = () => {
      ensure(rowH * 2);
      const y = doc.y;
      doc.rect(left, y, contentW, rowH + 8).fill(NAVY);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      doc.text(t(d.dimension), left + 4, y + 4, { width: firstW - 8, height: rowH, ellipsis: true });
      meta.forEach((m, i) => doc.text(t(`${m.label} (${m.unit})`), left + firstW + i * colW + 2, y + 4, { width: colW - 6, align: "right", height: rowH + 4, ellipsis: true }));
      doc.y = y + rowH + 8;
    };
    header();
    rows.forEach((r, ri) => {
      if (doc.y + rowH > bottomLimit()) {
        doc.addPage();
        doc.y = 60;
        header();
      }
      const y = doc.y;
      if (ri % 2) doc.rect(left, y, contentW, rowH).fill("#f3f6fb");
      doc.fillColor(TEXT).font("Helvetica").fontSize(8.5);
      doc.text(t(String(r.label)), left + 4, y + 5, { width: firstW - 8, height: rowH, ellipsis: true });
      meta.forEach((m, i) => doc.text(formatNumber(r[m.key] as number | null, m.unit), left + firstW + i * colW + 2, y + 5, { width: colW - 6, align: "right" }));
      doc.y = y + rowH;
    });
  };

  for (const page of pagesFor(report, research, slides)) {
    doc.addPage();
    doc.rect(0, 0, W, 6).fill(NAVY);
    doc.y = 50;
    if (slides || page.blocks[0]?.kind !== "heading") {
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(slides ? 22 : 16).text(t(page.title), left, doc.y, { width: contentW });
      doc.moveDown(0.6);
    }
    for (const b of page.blocks) {
      if (b.kind === "heading") {
        ensure(60);
        doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(16).text(t(b.text), left, doc.y, { width: contentW });
        doc.moveDown(0.5);
      } else if (b.kind === "summary" || b.kind === "paragraph") {
        const cite = b.kind === "paragraph" ? citation(b.sourceIds, numbering) : "";
        doc.font("Helvetica").fontSize(slides ? 12 : 10.5);
        const h = doc.heightOfString(t(b.text), { width: contentW, align: "justify", lineGap: 3 });
        ensure(Math.min(h, 120));
        doc.fillColor(TEXT).text(t(b.text), left, doc.y, { width: contentW, align: "justify", lineGap: 3, continued: !!cite });
        if (cite) doc.fillColor(GREY).fontSize(7.5).text(` ${cite}`);
        doc.moveDown(0.7);
      } else if (b.kind === "visual") {
        const c = chartOf(report, b.chartId);
        const d = c ? datasetOf(research, c.datasetId) : undefined;
        if (!c || !d) continue;
        const img = input.images[c.id];
        const buf = img && c.type !== "table" ? imageBuffer(img.dataUrl) : null;
        const imgW = slides ? Math.min(contentW, 520) : contentW;
        const imgH = buf ? (img!.height / img!.width) * imgW : 0;
        ensure(buf ? imgH + 60 : 90);
        doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10.5).text(t(c.title), left, doc.y, { width: contentW });
        doc.fillColor(GREY).font("Helvetica").fontSize(8.5).text(t(c.subtitle), { width: contentW });
        doc.moveDown(0.3);
        if (buf) {
          doc.image(buf, left + (contentW - imgW) / 2, doc.y, { width: imgW });
          doc.y += imgH + 4;
        } else drawTable(c, d);
        doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(7.5).text(t(sourceLine(d, research.sources)), left, doc.y + 4, { width: contentW });
        doc.moveDown(1);
      } else if (b.kind === "sources") {
        for (const id of b.sourceIds) {
          const s = research.sources.find((x) => x.id === id);
          if (!s) continue;
          ensure(30);
          doc.fillColor(TEXT).font("Helvetica").fontSize(8.5).text(t(`[${numbering.get(id)}] ${formatSource(s)}`), left, doc.y, { width: contentW, link: s.url ?? undefined });
          doc.moveDown(0.4);
        }
      }
    }
  }

  // Rodapé com numeração
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // permite escrever no rodapé sem criar nova página
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(7.5);
    doc.text(t(`${input.title} · Market Intelligence Pro`), left, H - 40, { width: contentW / 2, lineBreak: false });
    doc.text(`${i + 1}`, W - 100, H - 40, { width: 40, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
