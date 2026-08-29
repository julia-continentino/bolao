"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";

export function TaskActions({
  taskId,
  canComplete,
  canReopen,
}: {
  taskId: string;
  canComplete: boolean;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callAction(path: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/${path}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nao foi possivel completar a acao.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setLoading(false);
    }
  }

  if (!canComplete && !canReopen) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {canComplete && (
          <button
            onClick={() => callAction("complete")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Marcar como feito
          </button>
        )}
        {canReopen && (
          <button
            onClick={() => callAction("reopen")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Reabrir tarefa
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
