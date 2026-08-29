import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getTaskMeta } from "@/lib/task-meta";
import { formatDate } from "@/lib/utils";
import { DueSoonBadge, OverdueBadge, PriorityBadge, StatusBadge } from "./badges";
import { taskWithRelations } from "@/lib/tasks";

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskWithRelations;
}>;

type Column = "requester" | "assignee";

export function TaskTable({
  tasks,
  columns,
  emptyMessage = "Nenhuma tarefa encontrada.",
}: {
  tasks: TaskWithRelations[];
  columns: Column[];
  emptyMessage?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Desktop table */}
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Tarefa</th>
            {columns.includes("requester") && (
              <th className="px-4 py-3">Solicitante</th>
            )}
            {columns.includes("assignee") && (
              <th className="px-4 py-3">Responsavel</th>
            )}
            <th className="px-4 py-3">Prioridade</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Prazo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} columns={columns} />
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {tasks.map((task) => {
          const meta = getTaskMeta(task);
          return (
            <li key={task.id}>
              <Link
                href={`/tarefas/${task.id}`}
                className="block px-4 py-4 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{task.title}</p>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  {meta.isOverdue && (
                    <OverdueBadge daysOverdue={meta.daysOverdue} />
                  )}
                  {!meta.isOverdue && meta.isDueToday && (
                    <DueSoonBadge label="Vence hoje" />
                  )}
                  {!meta.isOverdue && meta.isDueTomorrow && (
                    <DueSoonBadge label="Vence amanha" />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {columns.includes("requester") && (
                    <span>Solicitante: {task.requester.name}</span>
                  )}
                  {columns.includes("assignee") && (
                    <span>Responsavel: {task.assignee.name}</span>
                  )}
                  <span>Prazo: {formatDate(task.dueDate)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  columns,
}: {
  task: TaskWithRelations;
  columns: Column[];
}) {
  const meta = getTaskMeta(task);
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link
          href={`/tarefas/${task.id}`}
          className="font-medium text-slate-900 hover:underline"
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {meta.isOverdue && <OverdueBadge daysOverdue={meta.daysOverdue} />}
          {!meta.isOverdue && meta.isDueToday && (
            <DueSoonBadge label="Vence hoje" />
          )}
          {!meta.isOverdue && meta.isDueTomorrow && (
            <DueSoonBadge label="Vence amanha" />
          )}
        </div>
      </td>
      {columns.includes("requester") && (
        <td className="px-4 py-3 text-slate-600">{task.requester.name}</td>
      )}
      {columns.includes("assignee") && (
        <td className="px-4 py-3 text-slate-600">{task.assignee.name}</td>
      )}
      <td className="px-4 py-3">
        <PriorityBadge priority={task.priority} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-4 py-3 text-slate-600">{formatDate(task.dueDate)}</td>
    </tr>
  );
}
