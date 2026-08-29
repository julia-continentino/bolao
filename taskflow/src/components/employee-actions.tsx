"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Link2, Ban, RotateCcw, X } from "lucide-react";
import { CopyField } from "./new-employee-modal";

export function RegenerateInviteButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/invite`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar convite.");
        return;
      }
      setInviteUrl(`${window.location.origin}/convite/${data.inviteToken}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <Link2 className="h-3.5 w-3.5" />
        {loading ? "Gerando..." : "Gerar novo link de convite"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {inviteUrl && <CopyField value={inviteUrl} />}
    </div>
  );
}

export function ToggleStatusButton({
  userId,
  status,
}: {
  userId: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "PENDING") return null;

  const isActive = status === "ACTIVE";

  async function handleClick() {
    if (isActive && !confirm("Desativar este funcionario? Ele nao podera mais acessar o sistema.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isActive ? "INACTIVE" : "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar status.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
          isActive
            ? "border-red-200 text-red-700 hover:bg-red-50"
            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {isActive ? (
          <Ban className="h-3.5 w-3.5" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {isActive ? "Desativar funcionario" : "Reativar funcionario"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function EditEmployeeButton({
  userId,
  initial,
}: {
  userId: string;
  initial: { name: string; jobTitle: string; role: "ADMIN" | "EMPLOYEE" };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </button>
      {open && (
        <EditEmployeeModal
          userId={userId}
          initial={initial}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EditEmployeeModal({
  userId,
  initial,
  onClose,
}: {
  userId: string;
  initial: { name: string; jobTitle: string; role: "ADMIN" | "EMPLOYEE" };
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [role, setRole] = useState(initial.role);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, jobTitle, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar.");
        setLoading(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Erro de conexao.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Editar funcionario
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Nome completo
            </span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Cargo
            </span>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Perfil de acesso
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "EMPLOYEE")}
              className="input"
            >
              <option value="EMPLOYEE">Funcionario</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
