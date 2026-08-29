import { Suspense } from "react";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { taskWithRelations } from "@/lib/tasks";
import { applyTaskFilters, parseTaskFilterParams } from "@/lib/task-filters";
import { TaskTable } from "@/components/task-table";
import { TaskFilterBar } from "@/components/task-filter-bar";
import { NewTaskButton } from "@/components/new-task-modal";
import { getActiveEmployeesForAssignment } from "@/lib/users";

export default async function MinhasTarefasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = parseTaskFilterParams(sp);

  const [tasks, employees] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: user.id },
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
            Minhas tarefas
          </h1>
          <p className="text-sm text-slate-500">
            Tarefas atribuidas a voce por outros funcionarios.
          </p>
        </div>
        <NewTaskButton employees={employees} requesterName={user.name} />
      </div>

      <Suspense fallback={null}>
        <TaskFilterBar />
      </Suspense>

      <TaskTable
        tasks={filtered}
        columns={["requester"]}
        emptyMessage="Nenhuma tarefa encontrada com estes filtros."
      />
    </div>
  );
}
