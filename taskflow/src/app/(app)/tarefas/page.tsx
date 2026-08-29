import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { taskWithRelations } from "@/lib/tasks";
import { applyTaskFilters, parseTaskFilterParams } from "@/lib/task-filters";
import { TaskTable } from "@/components/task-table";
import { TaskFilterBar } from "@/components/task-filter-bar";
import { NewTaskButton } from "@/components/new-task-modal";
import { getActiveEmployeesForAssignment } from "@/lib/users";

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const filters = parseTaskFilterParams(sp);

  const [tasks, employees] = await Promise.all([
    prisma.task.findMany({
      include: taskWithRelations,
      orderBy: { dueDate: "asc" },
    }),
    getActiveEmployeesForAssignment(),
  ]);

  const filtered = applyTaskFilters(tasks, filters);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Todas as tarefas
          </h1>
          <p className="text-sm text-slate-500">
            Visao consolidada de todas as solicitacoes da equipe.
          </p>
        </div>
        <NewTaskButton employees={employees} requesterName={admin.name} />
      </div>

      <Suspense fallback={null}>
        <TaskFilterBar
          advanced={{ assignees: employees, requesters: employees }}
        />
      </Suspense>

      <p className="text-xs text-slate-500">
        {filtered.length} tarefa{filtered.length === 1 ? "" : "s"} encontrada
        {filtered.length === 1 ? "" : "s"}.
      </p>

      <TaskTable
        tasks={filtered}
        columns={["requester", "assignee"]}
        emptyMessage="Nenhuma tarefa encontrada com estes filtros."
      />
    </div>
  );
}
