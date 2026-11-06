import "server-only";

export class DataSourceError extends Error {}

export async function fetchJson<T = unknown>(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "MarketIntelligencePro/1.0", ...opts.headers },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new DataSourceError(`HTTP ${res.status} ao consultar ${new URL(url).host}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DataSourceError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new DataSourceError(`Falha ao consultar ${new URL(url).host}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Resultado padronizado das integrações de dados oficiais */
export interface OfficialSeries {
  title: string;
  description: string;
  unit: string;
  currency: string | null;
  region: string;
  points: { year: number; value: number; estimate?: boolean }[];
  source: { title: string; publisher: string; url: string; date: string | null; type: "official_statistics" | "regulator" | "public_api" };
  methodology: string;
}
