import type { Priority, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { addHistory } from "./history";
import { createNotification } from "./notifications";
import { formatDate } from "./utils";
import type { CurrentUser } from "./auth/guards";
import { canCompleteTask, canEditTask } from "./permissions";

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const taskWithRelations = {
  requester: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskInclude;

export class PermissionError extends Error {
  constructor(message = "Voce nao tem permissao para esta acao.") {
    super(message);
    this.name = "PermissionError";
  }
}

export type CreateTaskInput = {
  title: string;
  description?: string;
  assigneeId: string;
  dueDate: Date;
  priority: Priority;
  notes?: string;
};

export async function createTask(actor: CurrentUser, input: CreateTaskInput) {
  const assignee = await prisma.user.findUnique({
    where: { id: input.assigneeId },
  });
  if (!assignee || assignee.status !== "ACTIVE") {
    throw new Error("Funcionario responsavel invalido.");
  }

  const task = await prisma.task.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      requesterId: actor.id,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      priority: input.priority,
      notes: input.notes?.trim() || null,
      status: "TODO",
    },
    include: taskWithRelations,
  });

  await addHistory({
    taskId: task.id,
    userId: actor.id,
    action: "CREATED",
    newValue: `Solicitada por ${actor.name} para ${assignee.name}, prazo ${formatDate(
      task.dueDate
    )}.`,
  });

  await createNotification({
    userId: assignee.id,
    taskId: task.id,
    type: "TASK_ASSIGNED",
    message: `${actor.name} atribuiu a voce a tarefa "${task.title}".`,
  });

  return task;
}

export type UpdateTaskInput = Partial<{
  title: string;
  description: string | null;
  assigneeId: string;
  dueDate: Date;
  priority: Priority;
  notes: string | null;
}>;

export async function updateTask(
  actor: CurrentUser,
  taskId: string,
  patch: UpdateTaskInput
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: taskWithRelations,
  });
  if (!task) throw new Error("Tarefa nao encontrada.");
  if (!canEditTask(task, actor)) throw new PermissionError();

  const data: Prisma.TaskUpdateInput = {};
  const historyEntries: Parameters<typeof addHistory>[0][] = [];

  if (patch.title !== undefined && patch.title.trim() !== task.title) {
    data.title = patch.title.trim();
    historyEntries.push({
      taskId,
      userId: actor.id,
      action: "TITLE_CHANGED",
      oldValue: task.title,
      newValue: patch.title.trim(),
    });
  }

  if (
    patch.description !== undefined &&
    (patch.description?.trim() || null) !== task.description
  ) {
    data.description = patch.description?.trim() || null;
    historyEntries.push({
      taskId,
      userId: actor.id,
      action: "DESCRIPTION_CHANGED",
      oldValue: task.description,
      newValue: data.description as string | null,
    });
  }

  if (
    patch.notes !== undefined &&
    (patch.notes?.trim() || null) !== task.notes
  ) {
    data.notes = patch.notes?.trim() || null;
    historyEntries.push({
      taskId,
      userId: actor.id,
      action: "NOTES_CHANGED",
      oldValue: task.notes,
      newValue: data.notes as string | null,
    });
  }

  if (patch.priority !== undefined && patch.priority !== task.priority) {
    data.priority = patch.priority;
    historyEntries.push({
      taskId,
      userId: actor.id,
      action: "PRIORITY_CHANGED",
      oldValue: PRIORITY_LABEL[task.priority],
      newValue: PRIORITY_LABEL[patch.priority],
    });
  }

  if (
    patch.dueDate !== undefined &&
    new Date(patch.dueDate).getTime() !== new Date(task.dueDate).getTime()
  ) {
    data.dueDate = patch.dueDate;
    historyEntries.push({
      taskId,
      userId: actor.id,
      action: "DUE_DATE_CHANGED",
      oldValue: formatDate(task.dueDate),
      newValue: formatDate(patch.dueDate),
    });
  }

  let newAssignee: { id: string; name: string } | null = null;
  if (patch.assigneeId !== undefined && patch.assigneeId !== task.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: patch.assigneeId },
    });
    if (!assignee || assignee.status !== "ACTIVE") {
      throw new Error("Funcionario responsavel invalido.");
    }
    data.assignee = { connect: { id: patch.assigneeId } };
    newAssignee = assignee;
    historyEntries.push({
      taskId,
      userId: actor.id,
      action: "ASSIGNEE_CHANGED",
      oldValue: task.assignee.name,
      newValue: assignee.name,
    });
  }

  if (Object.keys(data).length === 0) {
    return task;
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data,
    include: taskWithRelations,
  });

  for (const entry of historyEntries) {
    await addHistory(entry);
  }

  if (newAssignee) {
    await createNotification({
      userId: newAssignee.id,
      taskId,
      type: "TASK_ASSIGNED",
      message: `${actor.name} atribuiu a voce a tarefa "${updated.title}".`,
    });
  }

  return updated;
}

export async function completeTask(actor: CurrentUser, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: taskWithRelations,
  });
  if (!task) throw new Error("Tarefa nao encontrada.");
  if (!canCompleteTask(task, actor)) throw new PermissionError();
  if (task.status === "DONE") return task;

  const completedAt = new Date();
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt },
    include: taskWithRelations,
  });

  const onTime = completedAt.getTime() <= new Date(task.dueDate).getTime();

  await addHistory({
    taskId,
    userId: actor.id,
    action: "COMPLETED",
    newValue: onTime ? "Concluida no prazo" : "Concluida com atraso",
  });

  await createNotification({
    userId: task.requesterId,
    taskId,
    type: "TASK_COMPLETED",
    message: `${task.assignee.name} concluiu a tarefa "${task.title}" (${
      onTime ? "no prazo" : "com atraso"
    }).`,
  });

  return updated;
}

export async function reopenTask(actor: CurrentUser, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Tarefa nao encontrada.");
  if (!canEditTask(task, actor)) throw new PermissionError();
  if (task.status === "TODO") return task;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: "TODO", completedAt: null },
    include: taskWithRelations,
  });

  await addHistory({
    taskId,
    userId: actor.id,
    action: "REOPENED",
  });

  return updated;
}
