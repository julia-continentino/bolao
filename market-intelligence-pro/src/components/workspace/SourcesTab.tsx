"use client";
import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { AGENTS, SOURCE_TYPE_LABEL, type ResearchContent } from "@/lib/types";
import { NatureBadge, VerificationBadge } from "../ui";

export function SourcesTab({ content }: { content: ResearchContent }) {
  const st = content.verification.stats;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-6">
        {[["Datasets", st.datasets], ["Verificados", st.verified], ["Parciais", st.partially], ["Não verificados", st.unverified], ["Rejeitados", st.rejected], ["URLs confirmadas", `${st.confirmedUrls}/${st.sources}`]].map(([l, v]) => (
          <div key={l as string} className="card px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{l}</div><div className="num text-xl font-semibold text-navy-900">{v}</div></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Parecer de verificação</span><span className="text-xs text-ink-500">{AGENTS.verification.name}</span></div>
          <div className="space-y-3 p-5 text-sm">
            <p className="leading-6 text-ink-700">{content.verification.summary}</p>
            {content.verification.issues.length > 0 && (
              <ul className="space-y-2">
                {content.verification.issues.map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <span className={clsx("badge h-fit shrink-0", i.severity === "high" ? "bg-red-50 text-red-700" : i.severity === "medium" ? "bg-amber-50 text-amber-800" : "bg-ink-100 text-ink-700")}>{i.severity === "high" ? "Alta" : i.severity === "medium" ? "Média" : "Baixa"}</span>
                    <span className="text-ink-700">{i.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Revisão de qualidade</span><span className="text-xs text-ink-500">{AGENTS.director.name}</span></div>
          <div className="space-y-3 p-5 text-sm">
            <p className="leading-6 text-ink-700">{content.review.summary}</p>
            <ul className="space-y-2">
              {content.review.checks.map((c, k) => (
                <li key={k} className="flex gap-2">
                  <span className={clsx("badge h-fit shrink-0", c.status === "ok" ? "bg-emerald-50 text-emerald-800" : c.status === "attention" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700")}>{c.status === "ok" ? "✓ OK" : c.status === "attention" ? "! Atenção" : "✕ Problema"}</span>
                  <span><b className="text-ink-900">{c.item}.</b> <span className="text-ink-700">{c.comment}</span></span>
                </li>
              ))}
            </ul>
            {content.review.recommendations.length > 0 && <><div className="label pt-2">Recomendações</div><ul className="list-disc space-y-1 pl-5 text-ink-700">{content.review.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Conjuntos de dados</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-100/60 text-left text-[11px] uppercase tracking-wide text-ink-500"><tr><th className="px-5 py-2">Dataset</th><th className="px-3 py-2">Unidade · moeda</th><th className="px-3 py-2">Período · região</th><th className="px-3 py-2">Natureza</th><th className="px-3 py-2">Status</th><th className="px-5 py-2">Notas</th></tr></thead>
            <tbody className="divide-y divide-ink-200">
              {content.datasets.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="px-5 py-3"><div className="font-medium text-ink-900">{d.title}</div><div className="text-xs text-ink-500">{AGENTS[d.agent].short}{d.methodology ? " · com metodologia" : ""}</div></td>
                  <td className="px-3 py-3 text-ink-700">{d.unit}{d.currency ? ` · ${d.currency}` : ""}</td>
                  <td className="px-3 py-3 text-ink-700">{d.period} · {d.region}</td>
                  <td className="px-3 py-3"><div className="flex flex-col gap-1">{[...new Set(d.rows.map((r) => r.nature))].map((n) => <NatureBadge key={n} nature={n} />)}</div></td>
                  <td className="px-3 py-3"><VerificationBadge status={d.verification.status} /></td>
                  <td className="max-w-md px-5 py-3 text-xs text-ink-500">{d.verification.notes.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Fontes ({content.sources.length})</span></div>
        <ol className="divide-y divide-ink-200">
          {content.sources.map((s, i) => (
            <li key={s.id} className="flex gap-4 px-5 py-3 text-sm">
              <span className="num w-6 shrink-0 text-right text-ink-500">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink-900">{s.title}</div>
                <div className="text-xs text-ink-500">{s.publisher}{s.date ? ` · ${s.date}` : " · sem data"} · {SOURCE_TYPE_LABEL[s.type]} · {s.origin === "public_api" ? "API oficial" : "Busca web"} · {AGENTS[s.agent].short}</div>
                {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-navy-600 hover:underline"><ExternalLink size={11} className="shrink-0" /><span className="truncate">{s.url}</span></a>}
              </div>
              <span className={clsx("badge h-fit shrink-0", s.urlConfirmed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>{s.urlConfirmed ? "✓ URL confirmada" : "! URL não confirmada"}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
