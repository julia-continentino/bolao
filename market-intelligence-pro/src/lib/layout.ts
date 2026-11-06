import type { ChartSpec, Dataset, ReportBlock, ReportContent, ReportPage } from "./types";

/**
 * Distribui texto, gráficos e tabelas em páginas (documentos) ou slides (apresentações),
 * evitando páginas sobrecarregadas e respeitando, quando possível, a quantidade alvo.
 */
export function layoutReport(opts: {
  slides: boolean;
  sections: ReportContent["sections"];
  visualsBySection: Map<string, { chart: ChartSpec; afterParagraphId: string | null }[]>;
  datasets: Dataset[];
  executiveSummary: string | null;
  sourceIds: string[];
  includeSources: boolean;
  targetPages: number | null;
}): { pages: ReportPage[]; warnings: string[] } {
  const { slides } = opts;
  const warnings: string[] = [];
  const charsPerPage = slides ? 950 : 3200;
  const weightOf = (b: ReportBlock): number => {
    switch (b.kind) {
      case "heading": return slides ? 0 : 0.07;
      case "summary": return Math.max(0.3, b.text.length / charsPerPage);
      case "paragraph": return b.text.length / charsPerPage + (slides ? 0.05 : 0.02);
      default: return 0;
    }
  };
  const chartById = new Map<string, ChartSpec>();
  opts.visualsBySection.forEach((list) => list.forEach((v) => chartById.set(v.chart.id, v.chart)));
  const visualWeight = (chartId: string) => {
    const c = chartById.get(chartId);
    if (!c) return 0.4;
    if (c.type !== "table") return slides ? 0.62 : 0.42;
    const d = opts.datasets.find((x) => x.id === c.datasetId);
    const rows = c.rowLabels?.length ?? d?.rows.length ?? 6;
    return slides ? Math.min(0.8, 0.2 + rows * 0.055) : Math.min(0.9, 0.08 + rows * 0.032);
  };
  const w = (b: ReportBlock) => (b.kind === "visual" ? visualWeight(b.chartId) : weightOf(b));

  // Monta grupos (seções) de blocos
  const groups: { title: string; blocks: ReportBlock[] }[] = [];
  if (opts.executiveSummary) groups.push({ title: "Sumário executivo", blocks: [{ kind: "summary", text: opts.executiveSummary }] });
  for (const s of opts.sections) {
    const blocks: ReportBlock[] = [{ kind: "heading", text: s.title, sectionId: s.id }];
    const visuals = opts.visualsBySection.get(s.id) ?? [];
    const placed = new Set<string>();
    for (const p of s.paragraphs) {
      blocks.push({ kind: "paragraph", id: p.id, text: p.text, sourceIds: p.sourceIds, sectionId: s.id });
      for (const v of visuals) {
        if (v.afterParagraphId === p.id && !placed.has(v.chart.id)) {
          blocks.push({ kind: "visual", chartId: v.chart.id, sectionId: s.id });
          placed.add(v.chart.id);
        }
      }
    }
    for (const v of visuals) if (!placed.has(v.chart.id)) blocks.push({ kind: "visual", chartId: v.chart.id, sectionId: s.id });
    groups.push({ title: s.title, blocks });
  }

  const contentWeight = groups.reduce((a, g) => a + g.blocks.reduce((x, b) => x + w(b), 0), 0);
  const sourcesPerPage = slides ? 10 : 28;
  const sourcePages = opts.includeSources && opts.sourceIds.length ? Math.ceil(opts.sourceIds.length / sourcesPerPage) : 0;
  const fixed = 1 + sourcePages; // capa + anexos de fontes

  let capacity = 1;
  if (opts.targetPages) {
    const available = opts.targetPages - fixed;
    if (available < 1) {
      warnings.push(`A quantidade solicitada (${opts.targetPages}) não comporta capa, conteúdo e fontes; foi utilizado o mínimo necessário.`);
      capacity = 1.35;
    } else {
      capacity = contentWeight / available;
      if (capacity > 1.35) {
        warnings.push(`O conteúdo selecionado excede ${opts.targetPages} ${slides ? "slides" : "páginas"} sem sobrecarregá-los. Reduza parágrafos ou visualizações para atingir a meta.`);
        capacity = 1.35;
      } else if (capacity < 0.45) {
        warnings.push(`O conteúdo selecionado é insuficiente para ${opts.targetPages} ${slides ? "slides" : "páginas"} sem deixá-los esparsos. Aumente a quantidade de parágrafos ou visualizações.`);
        capacity = 0.45;
      }
    }
  }

  const pages: ReportPage[] = [];
  let current: ReportPage | null = null;
  let load = 0;
  const open = (title: string) => {
    current = { number: pages.length + 2, title, blocks: [] };
    pages.push(current);
    load = 0;
  };
  for (const g of groups) {
    // Slides: cada seção começa em novo slide. Documentos: nova página se a atual estiver muito cheia.
    if (!current || slides || load > capacity * 0.8) open(g.title);
    for (let i = 0; i < g.blocks.length; i++) {
      const b = g.blocks[i];
      const bw = w(b);
      const page = current as unknown as ReportPage;
      const nonEmpty = page.blocks.some((x) => x.kind !== "heading");
      if (nonEmpty && load + bw > capacity) {
        open(slides ? `${g.title} (cont.)` : g.title);
      }
      // evita título órfão no fim da página
      if (b.kind === "heading" && !slides && load + bw + w(g.blocks[i + 1] ?? b) > capacity && (current as unknown as ReportPage).blocks.length) {
        open(g.title);
      }
      if (b.kind === "heading" && slides) continue; // o título do slide já é o da seção
      (current as unknown as ReportPage).blocks.push(b);
      load += bw;
    }
  }
  if (opts.includeSources && opts.sourceIds.length) {
    for (let i = 0; i < opts.sourceIds.length; i += sourcesPerPage) {
      open(i === 0 ? "Fontes e referências" : "Fontes e referências (cont.)");
      (current as unknown as ReportPage).blocks.push({ kind: "sources", sourceIds: opts.sourceIds.slice(i, i + sourcesPerPage) });
    }
  }
  if (opts.targetPages) {
    const total = pages.length + 1; // + capa
    if (total !== opts.targetPages && !warnings.length) {
      warnings.push(`Resultado: ${total} ${slides ? "slides" : "páginas"} (meta: ${opts.targetPages}). ${total > opts.targetPages ? "Reduza parágrafos, seções ou visualizações para se aproximar da meta." : "Aumente parágrafos ou visualizações para se aproximar da meta."}`);
    }
  }
  return { pages, warnings };
}
