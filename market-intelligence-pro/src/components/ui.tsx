import clsx from "clsx";
import { VERIFICATION_LABEL, DATA_NATURE_LABEL, type DataNature, type VerificationStatus } from "@/lib/types";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  draft: ["Rascunho", "bg-ink-100 text-ink-700"],
  queued: ["Na fila", "bg-ink-100 text-ink-700"],
  running: ["Em análise", "bg-amber-50 text-amber-800 ring-1 ring-amber-200"],
  generating: ["Gerando", "bg-amber-50 text-amber-800 ring-1 ring-amber-200"],
  completed: ["Concluída", "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"],
  ready: ["Pronto", "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"],
  failed: ["Falhou", "bg-red-50 text-red-700 ring-1 ring-red-200"],
};
export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-ink-100 text-ink-700"];
  return <span className={clsx("badge", cls)}>{label}</span>;
}

const VER: Record<VerificationStatus, string> = {
  verified: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  partially_verified: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  unverified: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  rejected: "bg-red-50 text-red-700 ring-1 ring-red-200",
};
const VER_ICON: Record<VerificationStatus, string> = { verified: "✓", partially_verified: "◐", unverified: "!", rejected: "✕" };
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return <span className={clsx("badge", VER[status])}>{VER_ICON[status]} {VERIFICATION_LABEL[status]}</span>;
}
export function NatureBadge({ nature }: { nature: DataNature }) {
  const cls = nature === "historical" ? "bg-navy-50 text-navy-700" : nature === "third_party_estimate" ? "bg-violet-50 text-violet-800" : "bg-orange-50 text-orange-800";
  return <span className={clsx("badge", cls)}>{DATA_NATURE_LABEL[nature]}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-ink-900">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{children}</div>;
}
export function InfoNote({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return <div className={clsx("rounded-md border px-4 py-3 text-sm", tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-navy-100 bg-navy-50 text-navy-800")}>{children}</div>;
}
