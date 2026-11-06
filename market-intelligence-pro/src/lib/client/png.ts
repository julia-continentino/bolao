"use client";

/**
 * Converte o SVG de um gráfico Recharts em PNG (data URL). A legenda do Recharts é HTML,
 * por isso é desenhada no canvas a partir dos metadados das séries.
 */
export async function chartToPng(container: HTMLElement, opts: { legend?: { label: string; color: string }[]; title?: string; subtitle?: string; footer?: string; scale?: number } = {}) {
  const svg = container.querySelector("svg.recharts-surface") as SVGSVGElement | null;
  if (!svg) throw new Error("Gráfico não encontrado para exportação.");
  const scale = opts.scale ?? 2;
  const w = svg.width.baseVal.value || svg.clientWidth;
  const h = svg.height.baseVal.value || svg.clientHeight;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("style", "font-family: Arial, Helvetica, sans-serif; font-size: 12px; background: #ffffff");
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Falha ao rasterizar o gráfico."));
    img.src = url;
  });

  const pad = 16;
  const titleH = opts.title ? 26 : 0;
  const subH = opts.subtitle ? 18 : 0;
  const legendItems = opts.legend ?? [];
  const legendH = legendItems.length ? 26 : 0;
  const footH = opts.footer ? 22 : 0;
  const W = w + pad * 2;
  const H = h + pad * 2 + titleH + subH + legendH + footH;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  let y = pad;
  if (opts.title) {
    ctx.fillStyle = "#0a1a33";
    ctx.font = "bold 15px Arial, Helvetica, sans-serif";
    ctx.fillText(opts.title, pad, y + 15);
    y += titleH;
  }
  if (opts.subtitle) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Arial, Helvetica, sans-serif";
    ctx.fillText(opts.subtitle, pad, y + 12);
    y += subH;
  }
  ctx.drawImage(img, pad, y, w, h);
  URL.revokeObjectURL(url);
  y += h;
  if (legendItems.length) {
    let x = pad;
    ctx.font = "12px Arial, Helvetica, sans-serif";
    for (const it of legendItems) {
      ctx.fillStyle = it.color;
      ctx.fillRect(x, y + 9, 10, 10);
      ctx.fillStyle = "#374151";
      ctx.fillText(it.label, x + 15, y + 18);
      x += 15 + ctx.measureText(it.label).width + 18;
    }
    y += legendH;
  }
  if (opts.footer) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "italic 11px Arial, Helvetica, sans-serif";
    ctx.fillText(opts.footer, pad, y + 14);
  }
  return { dataUrl: canvas.toDataURL("image/png"), width: W, height: H };
}

export function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.click();
}

export async function copyPng(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
