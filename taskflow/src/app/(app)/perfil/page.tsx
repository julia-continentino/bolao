import { requireUser } from "@/lib/auth/guards";
import { initials } from "@/lib/utils";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-700">
          {initials(user.name)}
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {user.name}
          </h1>
          <p className="text-sm text-slate-500">
            {user.jobTitle ?? "Sem cargo definido"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Informacoes da conta
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">E-mail</dt>
            <dd className="text-slate-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Perfil de acesso</dt>
            <dd className="text-slate-800">
              {user.role === "ADMIN" ? "Administrador" : "Funcionario"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Alterar senha
        </h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
