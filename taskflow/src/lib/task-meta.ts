import type { Task } from "@prisma/client";
import { daysBetween } from "./utils";

export type TaskMeta = {
  isOverdue: boolean;
  daysOverdue: number;
  isDueToday: boolean;
  isDueTomorrow: boolean;
  daysRemaining: number;
  completedOnTime: boolean | null;
};

/**
 * Overdue is computed on the fly (never stored): TODO + dueDate in the past.
 */
export function getTaskMeta(
  task: Pick<Task, "status" | "dueDate" | "completedAt">
): TaskMeta {
  const now = new Date();
  const due = new Date(task.dueDate);
  const isTodo = task.status === "TODO";

  // due - now, in whole calendar days (negative once the due date has passed)
  const daysRemaining = isTodo ? daysBetween(due, now) : 0;
  const isOverdue = isTodo && now.getTime() > due.getTime();
  const daysOverdue = isOverdue ? Math.max(0, -daysRemaining) : 0;
  const isDueToday = isTodo && daysRemaining === 0 && !isOverdue;
  const isDueTomorrow = isTodo && daysRemaining === 1;

  const completedOnTime =
    task.status === "DONE" && task.completedAt
      ? new Date(task.completedAt).getTime() <= due.getTime()
      : null;

  return {
    isOverdue,
    daysOverdue,
    isDueToday,
    isDueTomorrow,
    daysRemaining,
    completedOnTime,
  };
}
