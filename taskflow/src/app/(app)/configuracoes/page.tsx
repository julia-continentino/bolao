import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { SyncNotificationsButton } from "@/components/sync-notifications-button";

export default async function ConfiguracoesPage() {
  await requireAdmin();

  const [userCount, taskCount, notificationCount] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.notification.count(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Configuracoes
        </h1>
        <p className="text-sm text-slate-500">
          Informacoes gerais do sistema e manutencao.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Visao geral
        </h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Usuarios cadastrados</dt>
            <dd className="text-lg font-semibold text-slate-900">{userCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Tarefas totais</dt>
            <dd className="text-lg font-semibold text-slate-900">{taskCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Notificacoes geradas</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {notificationCount}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Notificacoes de prazo
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          O sistema verifica tarefas atrasadas ou proximas do prazo a cada
          acesso. Em producao, configure um agendador externo (Vercel Cron,
          GitHub Actions, etc.) para chamar{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            POST /api/cron/sync-notifications
          </code>{" "}
          periodicamente.
        </p>
        <SyncNotificationsButton />
      </div>
    </div>
  );
}
