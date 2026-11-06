import "server-only";
import type { ChartSpec, Dataset, ReportBlock, ReportContent, ReportPage, ResearchContent, Source } from "../types";
import { layoutReport } from "../layout";

export interface ExportInput {
  title: string;
  subtitle: string;
  research: ResearchContent;
  report: ReportContent;
  /** PNG (data URL) de cada visualização, renderizado no navegador */
  images: Record<string, { dataUrl: string; width: number; height: number }>;
}

export function sourceNumbering(report: ReportContent) {
  const map = new Map<string, number>();
  report.usedSourceIds.forEach((id, i) => map.set(id, i + 1));
  return map;
}

export function citation(ids: string[], numbering: Map<string, number>) {
  const nums = [...new Set(ids.map((id) => numbering.get(id)).filter((n): n is number => !!n))].sort((a, b) => a - b);
  return nums.length ? `[${nums.join(", ")}]` : "";
}

export function formatSource(s: Source) {
  return [s.publisher, s.title, s.date ? `(${s.date})` : null, s.url].filter(Boolean).join(". ");
}

export function chartOf(report: ReportContent, id: string): ChartSpec | undefined {
  return report.visuals.find((v) => v.id === id);
}
export function datasetOf(research: ResearchContent, id: string): Dataset | undefined {
  return research.datasets.find((d) => d.id === id);
}

export function imageBuffer(dataUrl: string) {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  return m ? Buffer.from(m[1], "base64") : null;
}

/** Reorganiza as páginas para outro meio (ex.: relatório em documento exportado como slides) */
export function pagesFor(report: ReportContent, research: ResearchContent, slides: boolean): ReportPage[] {
  const isSlides = report.format === "executive_presentation";
  if (isSlides === slides) return report.pages;
  const visualsBySection = new Map<string, { chart: ChartSpec; afterParagraphId: string | null }[]>();
  let lastPara: string | null = null;
  for (const b of report.pages.flatMap((p) => p.blocks) as ReportBlock[]) {
    if (b.kind === "heading") lastPara = null;
    if (b.kind === "paragraph") lastPara = b.id;
    if (b.kind === "visual") {
      const c = chartOf(report, b.chartId);
      if (!c) continue;
      if (!visualsBySection.has(b.sectionId)) visualsBySection.set(b.sectionId, []);
      visualsBySection.get(b.sectionId)!.push({ chart: c, afterParagraphId: lastPara });
    }
  }
  const hasSources = report.pages.some((p) => p.blocks.some((b) => b.kind === "sources"));
  return layoutReport({
    slides,
    sections: report.sections,
    visualsBySection,
    datasets: research.datasets,
    executiveSummary: report.executiveSummary,
    sourceIds: report.usedSourceIds,
    includeSources: hasSources,
    targetPages: null,
  }).pages;
}

export function safeFileName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "relatorio";
}
