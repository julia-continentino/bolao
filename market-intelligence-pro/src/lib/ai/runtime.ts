import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Infraestrutura comum dos agentes: chamada ao Claude com busca web real (server tool),
 * ferramentas próprias (APIs oficiais) e uma ferramenta "submit_*" que recebe o resultado
 * estruturado, validado com Zod.
 */

export class AIConfigError extends Error {}
export class AgentError extends Error {}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!aiConfigured()) {
    throw new AIConfigError("Integração de IA não configurada: defina ANTHROPIC_API_KEY no servidor para executar pesquisas.");
  }
  client ??= new Anthropic({ maxRetries: 4, timeout: 15 * 60_000 });
  return client;
}

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const DEFAULT_EFFORT = (process.env.AI_EFFORT as Effort) || "high";

export interface SafeParser<T> {
  safeParse(x: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

export interface ClientTool {
  name: string;
  description: string;
  input_schema: Anthropic.Beta.BetaTool.InputSchema;
  run: (input: unknown) => Promise<string>;
}

export interface SearchedUrl {
  url: string;
  title: string | null;
  pageAge: string | null;
}

export interface AgentRunOptions<T> {
  system: string;
  prompt: string;
  submit: { name: string; description: string; inputSchema: Anthropic.Beta.BetaTool.InputSchema; zod: SafeParser<T> };
  tools?: ClientTool[];
  webSearch?: { maxUses: number; country?: string } | null;
  effort?: Effort;
  maxTurns?: number;
  onEvent?: (e: { type: "search" | "tool"; detail: string }) => void;
}

export interface AgentRunResult<T> {
  output: T;
  searchedUrls: Map<string, SearchedUrl>;
  searches: number;
  toolCalls: number;
}

/** Normaliza URLs para comparação (ignora protocolo, www, barra final, âncora e parâmetros de rastreamento) */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(k)) url.searchParams.delete(k);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    const q = url.searchParams.toString();
    return `${host}${path}${q ? `?${q}` : ""}`;
  } catch {
    return u.trim().toLowerCase();
  }
}

/** Coleta todas as URLs efetivamente retornadas pelas ferramentas de busca/leitura do servidor */
function collectUrls(blocks: unknown[], into: Map<string, SearchedUrl>) {
  const walk = (node: unknown, inResult: boolean) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, inResult));
    const obj = node as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";
    const isResult = inResult || type.endsWith("_tool_result");
    if (isResult && typeof obj.url === "string" && /^https?:\/\//.test(obj.url)) {
      const key = normalizeUrl(obj.url);
      if (!into.has(key)) {
        into.set(key, {
          url: obj.url,
          title: typeof obj.title === "string" ? obj.title : null,
          pageAge: typeof obj.page_age === "string" ? obj.page_age : null,
        });
      }
    }
    // citações em blocos de texto também carregam a URL da página consultada
    if (type === "text" && Array.isArray(obj.citations)) walk(obj.citations, true);
    for (const [k, v] of Object.entries(obj)) {
      if (k === "encrypted_content" || k === "encrypted_index") continue;
      if (v && typeof v === "object") walk(v, isResult);
    }
  };
  walk(blocks, false);
}

export async function runAgent<T>(opts: AgentRunOptions<T>): Promise<AgentRunResult<T>> {
  const anthropic = getClient();
  const searchedUrls = new Map<string, SearchedUrl>();
  let searches = 0;
  let toolCalls = 0;
  let nudges = 0;

  const tools: Anthropic.Beta.BetaToolUnion[] = [];
  if (opts.webSearch && opts.webSearch.maxUses > 0) {
    tools.push({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: opts.webSearch.maxUses,
      ...(opts.webSearch.country ? { user_location: { type: "approximate" as const, country: opts.webSearch.country } } : {}),
    });
  }
  for (const t of opts.tools ?? []) tools.push({ name: t.name, description: t.description, input_schema: t.input_schema });
  tools.push({ name: opts.submit.name, description: opts.submit.description, input_schema: opts.submit.inputSchema });

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const maxTurns = opts.maxTurns ?? 30;

  for (let turn = 0; turn < maxTurns; turn++) {
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = anthropic.beta.messages.stream({
        model: AI_MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort ?? DEFAULT_EFFORT },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: opts.system,
        tools,
        messages,
      });
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new AIConfigError("Chave da API Anthropic inválida (ANTHROPIC_API_KEY).");
      if (err instanceof Anthropic.RateLimitError) throw new AgentError("Limite de requisições da API de IA atingido. Tente novamente em alguns minutos.");
      if (err instanceof Anthropic.APIError) throw new AgentError(`Falha na API de IA (${err.status ?? "rede"}): ${err.message}`);
      throw err;
    }

    collectUrls(message.content as unknown[], searchedUrls);
    for (const b of message.content) {
      if (b.type === "server_tool_use" && b.name === "web_search") {
        searches++;
        const q = (b.input as { query?: string })?.query;
        if (q) opts.onEvent?.({ type: "search", detail: q });
      }
    }

    if (message.stop_reason === "refusal") throw new AgentError("O modelo de IA recusou a solicitação. Reformule o escopo da pesquisa.");
    if (message.stop_reason === "max_tokens") throw new AgentError("A resposta do agente excedeu o limite de tamanho.");

    messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });

    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) {
      if (nudges++ >= 2) throw new AgentError(`O agente encerrou sem entregar o resultado estruturado (${opts.submit.name}).`);
      messages.push({ role: "user", content: `Entregue agora o resultado chamando a ferramenta ${opts.submit.name}, seguindo exatamente o esquema.` });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let submitted: T | null = null;
    for (const tu of toolUses) {
      if (tu.name === opts.submit.name) {
        const parsed = opts.submit.zod.safeParse(tu.input);
        if (parsed.success) {
          submitted = parsed.data;
          results.push({ type: "tool_result", tool_use_id: tu.id, content: "Recebido." });
        } else {
          const issues = parsed.error.issues.slice(0, 15).map((i) => `${i.path.map(String).join(".")}: ${i.message}`).join("; ");
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Esquema inválido — corrija e envie novamente. Problemas: ${issues}` });
        }
        continue;
      }
      const tool = opts.tools?.find((t) => t.name === tu.name);
      if (!tool) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Ferramenta desconhecida: ${tu.name}` });
        continue;
      }
      toolCalls++;
      opts.onEvent?.({ type: "tool", detail: `${tu.name} ${JSON.stringify(tu.input).slice(0, 120)}` });
      try {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: await tool.run(tu.input) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err instanceof Error ? err.message : String(err) });
      }
    }

    if (submitted) return { output: submitted, searchedUrls, searches, toolCalls };
    messages.push({ role: "user", content: results });
  }
  throw new AgentError("O agente excedeu o número máximo de etapas sem concluir.");
}
