import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-lg font-semibold text-white">
            TF
          </div>
          <h1 className="text-xl font-semibold text-slate-900">TaskFlow</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestao de equipe e controle de tarefas
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Acesso restrito a funcionarios convidados pelo administrador.
        </p>
      </div>
    </div>
  );
}
