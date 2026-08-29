import type { Task } from "@prisma/client";
import type { CurrentUser } from "./auth/guards";

export function canViewTask(task: Pick<Task, "requesterId" | "assigneeId">, user: CurrentUser) {
  return (
    user.role === "ADMIN" ||
    task.requesterId === user.id ||
    task.assigneeId === user.id
  );
}

export function canEditTask(task: Pick<Task, "requesterId">, user: CurrentUser) {
  return user.role === "ADMIN" || task.requesterId === user.id;
}

export function canCompleteTask(task: Pick<Task, "assigneeId">, user: CurrentUser) {
  return user.role === "ADMIN" || task.assigneeId === user.id;
}
