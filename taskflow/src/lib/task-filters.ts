import type { Priority, TaskStatus } from "@prisma/client";
import { getTaskMeta } from "./task-meta";
import type { TaskWithRelations } from "@/components/task-table";

export type TaskFilterParams = {
  q?: string;
  status?: TaskStatus;
  priority?: Priority;
  filter?: "atrasadas" | "hoje" | "7dias" | "alta";
  assigneeId?: string;
  requesterId?: string;
  from?: string;
  to?: string;
};

export function parseTaskFilterParams(
  sp: Record<string, string | string[] | undefined>
): TaskFilterParams {
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    q: get("q"),
    status: get("status") as TaskStatus | undefined,
    priority: get("priority") as Priority | undefined,
    filter: get("filter") as TaskFilterParams["filter"],
    assigneeId: get("assigneeId"),
    requesterId: get("requesterId"),
    from: get("from"),
    to: get("to"),
  };
}

export function applyTaskFilters(
  tasks: TaskWithRelations[],
  params: TaskFilterParams
): TaskWithRelations[] {
  return tasks.filter((task) => {
    const meta = getTaskMeta(task);

    if (params.status && task.status !== params.status) return false;
    if (params.priority && task.priority !== params.priority) return false;
    if (params.assigneeId && task.assigneeId !== params.assigneeId) return false;
    if (params.requesterId && task.requesterId !== params.requesterId)
      return false;
    if (params.from && new Date(task.dueDate) < new Date(params.from))
      return false;
    if (params.to && new Date(task.dueDate) > new Date(`${params.to}T23:59:59`))
      return false;

    if (params.filter === "atrasadas" && !meta.isOverdue) return false;
    if (params.filter === "hoje" && !meta.isDueToday) return false;
    if (
      params.filter === "7dias" &&
      !(task.status === "TODO" && meta.daysRemaining >= 0 && meta.daysRemaining <= 7)
    )
      return false;
    if (
      params.filter === "alta" &&
      !(task.priority === "HIGH" || task.priority === "URGENT")
    )
      return false;

    if (params.q) {
      const q = params.q.toLowerCase();
      const haystack = `${task.title} ${task.description ?? ""} ${
        task.requester.name
      } ${task.assignee.name}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}
