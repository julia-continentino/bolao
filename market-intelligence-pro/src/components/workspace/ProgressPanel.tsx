"use client";
import clsx from "clsx";
import { CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle } from "lucide-react";
import { AGENTS, type AgentKey, type AgentProgress } from "@/lib/types";
import type { FullVersion } from "./Workspace";

export function ProgressPanel({ version }: { version: FullVersion }) {
  const progress: AgentProgress[] = version.progress?.length ? version.progress : (Object.keys(AGENTS) as AgentKey[]).map((agent) => ({ agent, status: "pending" }));
  const done = progress.filter((p) => p.status === "done" || p.status === "skipped").length;
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Análise em andamento — versão {version.number}</span>
        <span className="num text-xs text-ink-500">{done}/{progress.length} etapas</span>
      </div>
      <div className="h-1 bg-ink-100"><div className="h-1 bg-navy-600 transition-all" style={{ width: `${(done / progress.length) * 100}%` }} /></div>
      <ul className="divide-y divide-ink-200">
        {progress.map((p) => (
          <li key={p.agent} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-0.5">
              {p.status === "done" ? <CheckCircle2 size={18} className="text-emerald-600" /> : p.status === "running" ? <Loader2 size={18} className="animate-spin text-navy-600" /> : p.status === "failed" ? <XCircle size={18} className="text-red-600" /> : p.status === "skipped" ? <MinusCircle size={18} className="text-ink-500" /> : <CircleDashed size={18} className="text-ink-300" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={clsx("text-sm font-medium", p.status === "pending" ? "text-ink-500" : "text-ink-900")}>{AGENTS[p.agent].name}</div>
              {p.message && <div className="truncate text-xs text-ink-500">{p.message}</div>}
            </div>
            {(p.searches || p.apiCalls) ? <div className="num whitespace-nowrap text-xs text-ink-500">{p.searches ? `${p.searches} buscas` : ""}{p.apiCalls ? ` · ${p.apiCalls} APIs` : ""}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
