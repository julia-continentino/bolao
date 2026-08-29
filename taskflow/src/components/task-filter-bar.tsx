"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

const QUICK_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "status:TODO", label: "A fazer" },
  { key: "status:DONE", label: "Feitas" },
  { key: "filter:atrasadas", label: "Atrasadas" },
  { key: "filter:hoje", label: "Hoje" },
  { key: "filter:7dias", label: "Proximos 7 dias" },
  { key: "filter:alta", label: "Alta prioridade" },
];

type Person = { id: string; name: string };

export function TaskFilterBar({
  advanced,
}: {
  advanced?: { assignees: Person[]; requesters: Person[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const currentQuickKey = (() => {
    const status = searchParams.get("status");
    const filter = searchParams.get("filter");
    if (status) return `status:${status}`;
    if (filter) return `filter:${filter}`;
    return "";
  })();

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectQuickFilter(key: string) {
    updateParams((params) => {
      params.delete("status");
      params.delete("filter");
      if (key.startsWith("status:")) params.set("status", key.split(":")[1]);
      if (key.startsWith("filter:")) params.set("filter", key.split(":")[1]);
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams((params) => {
      if (q) params.set("q", q);
      else params.delete("q");
    });
  }

  function updateSelect(name: string, value: string) {
    updateParams((params) => {
      if (value) params.set(name, value);
      else params.delete(name);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => selectQuickFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              currentQuickKey === f.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:border-slate-400"
            }`}
          >
            {f.label}
          </button>
        ))}
        <form onSubmit={submitSearch} className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por titulo, descricao, funcionario..."
              className="w-56 rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 sm:w-72"
            />
          </div>
          {advanced && (
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className={`rounded-md border p-1.5 ${
                showAdvanced
                  ? "border-slate-900 text-slate-900"
                  : "border-slate-300 text-slate-500"
              }`}
              aria-label="Filtros avancados"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      {advanced && showAdvanced && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4">
          <select
            defaultValue={searchParams.get("assigneeId") ?? ""}
            onChange={(e) => updateSelect("assigneeId", e.target.value)}
            className="input"
          >
            <option value="">Responsavel: todos</option>
            {advanced.assignees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            defaultValue={searchParams.get("requesterId") ?? ""}
            onChange={(e) => updateSelect("requesterId", e.target.value)}
            className="input"
          >
            <option value="">Solicitante: todos</option>
            {advanced.requesters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            defaultValue={searchParams.get("priority") ?? ""}
            onChange={(e) => updateSelect("priority", e.target.value)}
            className="input"
          >
            <option value="">Prioridade: todas</option>
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              defaultValue={searchParams.get("from") ?? ""}
              onChange={(e) => updateSelect("from", e.target.value)}
              className="input"
              title="Prazo a partir de"
            />
            <input
              type="date"
              defaultValue={searchParams.get("to") ?? ""}
              onChange={(e) => updateSelect("to", e.target.value)}
              className="input"
              title="Prazo ate"
            />
          </div>
        </div>
      )}
    </div>
  );
}
