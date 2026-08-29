import { validateInviteToken } from "@/lib/auth/invite";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validation = await validateInviteToken(token);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-lg font-semibold text-white">
            TF
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Bem-vindo(a) ao TaskFlow
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Defina sua senha para ativar sua conta
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {validation.valid ? (
            <AcceptInviteForm
              token={token}
              name={validation.name}
              email={validation.email}
            />
          ) : (
            <InvalidInvite reason={validation.reason} />
          )}
        </div>
      </div>
    </div>
  );
}

function InvalidInvite({
  reason,
}: {
  reason: "not_found" | "expired" | "used";
}) {
  const messages: Record<typeof reason, string> = {
    not_found: "Este link de convite e invalido.",
    expired:
      "Este link de convite expirou. Peca ao administrador para gerar um novo.",
    used: "Este link de convite ja foi utilizado. Faca login normalmente.",
  };
  return (
    <div className="text-center">
      <p className="text-sm text-slate-600">{messages[reason]}</p>
      <a
        href="/login"
        className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
      >
        Ir para o login
      </a>
    </div>
  );
}
