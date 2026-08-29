import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { taskWithRelations } from "@/lib/tasks";
import { formatDate } from "@/lib/utils";
import { TaskTable } from "@/components/task-table";
import {
  EditEmployeeButton,
  RegenerateInviteButton,
  ToggleStatusButton,
} from "@/components/employee-actions";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PENDING: "Convite pendente",
  INACTIVE: "Inativo",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const [assignedTasks, requestedTasks] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: id },
      include: taskWithRelations,
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: { requesterId: id },
      include: taskWithRelations,
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const done = assignedTasks.filter((t) => t.status === "DONE").length;
  const todo = assignedTasks.length - done;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {user.name}
          </h1>
          <p className="text-sm text-slate-500">
            {user.jobTitle ?? "Sem cargo definido"} - {user.email}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Membro desde {formatDate(user.createdAt)} -{" "}
            {STATUS_LABEL[user.status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditEmployeeButton
            userId={user.id}
            initial={{
              name: user.name,
              jobTitle: user.jobTitle ?? "",
              role: user.role,
            }}
          />
          <ToggleStatusButton userId={user.id} status={user.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            A fazer
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{todo}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Concluidas
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {done}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Solicitadas por ele(a)
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {requestedTasks.length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Acesso
        </h2>
        <p className="mb-2 text-sm text-slate-500">
          {user.status === "ACTIVE"
            ? "Conta ja ativada. Gere um novo link caso o funcionario precise redefinir a senha."
            : "Compartilhe o link de convite para que o funcionario defina a senha e ative a conta."}
        </p>
        <RegenerateInviteButton userId={user.id} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tarefas recebidas
        </h2>
        <TaskTable tasks={assignedTasks} columns={["requester"]} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tarefas solicitadas
        </h2>
        <TaskTable tasks={requestedTasks} columns={["assignee"]} />
      </section>
    </div>
  );
}
