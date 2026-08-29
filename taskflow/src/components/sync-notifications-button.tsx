"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncNotificationsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/cron/sync-notifications", {
        method: "POST",
      });
      const data = await res.json();
      setResult(
        data.created > 0
          ? `${data.created} nova(s) notificacao(oes) gerada(s).`
          : "Nenhuma notificacao nova no momento."
      );
      router.refresh();
    } catch {
      setResult("Erro ao sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        Sincronizar notificacoes agora
      </button>
      {result && <p className="mt-2 text-xs text-slate-500">{result}</p>}
    </div>
  );
}
