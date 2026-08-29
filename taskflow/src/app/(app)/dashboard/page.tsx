import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getAdminDashboardData, getEmployeeDashboardData } from "@/lib/dashboard";
import { getActiveEmployeesForAssignment } from "@/lib/users";
import { StatCard } from "@/components/stat-card";
import { NewTaskButton } from "@/components/new-task-modal";
import { TaskTable } from "@/components/task-table";

export default async function DashboardPage() {
  const user = await requireUser();
  const employees = await getActiveEmployeesForAssignment();

  if (user.role === "ADMIN") {
    return <AdminDashboard requesterName={user.name} employees={employees} />;
  }

  const { assignedTasks, requestedTasks, counts } =
    await getEmployeeDashboardData(user.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Ola, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500">
            Aqui esta um resumo das suas tarefas.
          </p>
        </div>
        <NewTaskButton employees={employees} requesterName={user.name} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="A fazer" value={counts.todo} href="/minhas-tarefas" />
        <StatCard
          label="Feitas"
          value={counts.done}
          tone="success"
          href="/minhas-tarefas?status=DONE"
        />
        <StatCard
          label="Atrasadas"
          value={counts.overdue}
          tone="danger"
          href="/minhas-tarefas?filter=atrasadas"
        />
        <StatCard
          label="Vencendo hoje"
          value={counts.dueToday}
          tone="warning"
          href="/minhas-tarefas?filter=hoje"
        />
        <StatCard
          label="Proximos 7 dias"
          value={counts.dueNext7Days}
          href="/minhas-tarefas?filter=7dias"
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Minhas tarefas
        </h2>
        <TaskTable
          tasks={assignedTasks.slice(0, 8)}
          columns={["requester"]}
          emptyMessage="Nenhuma tarefa atribuida a voce ainda."
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tarefas que solicitei
        </h2>
        <TaskTable
          tasks={requestedTasks.slice(0, 8)}
          columns={["assignee"]}
          emptyMessage="Voce ainda nao solicitou nenhuma tarefa."
        />
      </section>
    </div>
  );
}

async function AdminDashboard({
  requesterName,
  employees,
}: {
  requesterName: string;
  employees: { id: string; name: string; jobTitle: string | null }[];
}) {
  const { totalEmployees, tasks, counts, byEmployee } =
    await getAdminDashboardData();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Visao geral da equipe
          </h1>
          <p className="text-sm text-slate-500">
            Indicadores consolidados de todos os funcionarios.
          </p>
        </div>
        <NewTaskButton employees={employees} requesterName={requesterName} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Funcionarios" value={totalEmployees} href="/equipe" />
        <StatCard label="Tarefas abertas" value={counts.open} href="/tarefas" />
        <StatCard
          label="Concluidas"
          value={counts.completed}
          tone="success"
          href="/tarefas?status=DONE"
        />
        <StatCard
          label="Atrasadas"
          value={counts.overdue}
          tone="danger"
          href="/tarefas?filter=atrasadas"
        />
        <StatCard
          label="Vencendo em breve"
          value={counts.dueSoon}
          tone="warning"
          href="/tarefas?filter=7dias"
        />
        <StatCard
          label="Criadas (30 dias)"
          value={counts.createdLast30Days}
        />
        <StatCard
          label="Concluidas no prazo"
          value={counts.onTimeRate !== null ? `${counts.onTimeRate}%` : "-"}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tarefas por funcionario
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Funcionario</th>
                <th className="px-4 py-3">A fazer</th>
                <th className="px-4 py-3">Concluidas</th>
                <th className="px-4 py-3">Atrasadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byEmployee.map((row) => (
                <tr key={row.name}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.todo}</td>
                  <td className="px-4 py-3 text-slate-600">{row.done}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      row.overdue > 0 ? "text-red-600" : "text-slate-600"
                    }`}
                  >
                    {row.overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tarefas recentes
          </h2>
          <Link href="/tarefas" className="text-sm font-medium text-slate-700 hover:underline">
            Ver todas
          </Link>
        </div>
        <TaskTable tasks={tasks.slice(0, 8)} columns={["requester", "assignee"]} />
      </section>
    </div>
  );
}
