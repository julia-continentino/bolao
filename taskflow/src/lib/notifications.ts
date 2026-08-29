import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { startOfToday } from "./utils";

export async function createNotification(params: {
  userId: string;
  taskId?: string | null;
  type: NotificationType;
  message: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      taskId: params.taskId ?? null,
      type: params.type,
      message: params.message,
    },
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

/**
 * Lazily generates due-date related notifications. Called on every
 * authenticated page load so the system stays up to date without a
 * dedicated worker process; also exposed at /api/cron/sync-notifications
 * for a real scheduler (Vercel Cron, GitHub Actions, etc.) in production.
 */
export async function syncDueDateNotifications() {
  const today = startOfToday();
  const tasks = await prisma.task.findMany({
    where: { status: "TODO" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      requesterId: true,
      assignee: { select: { name: true } },
      notifications: {
        where: { createdAt: { gte: today } },
        select: { type: true, userId: true },
      },
    },
  });

  const now = new Date();
  const toCreate: {
    userId: string;
    taskId: string;
    type: NotificationType;
    message: string;
  }[] = [];

  for (const task of tasks) {
    const due = new Date(task.dueDate);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    const alreadyNotified = (type: NotificationType, userId: string) =>
      task.notifications.some((n) => n.type === type && n.userId === userId);

    if (now.getTime() > due.getTime()) {
      if (!alreadyNotified("TASK_OVERDUE", task.requesterId)) {
        toCreate.push({
          userId: task.requesterId,
          taskId: task.id,
          type: "TASK_OVERDUE",
          message: `A tarefa "${task.title}" atribuida a ${task.assignee.name} esta atrasada.`,
        });
      }
      if (!alreadyNotified("TASK_OVERDUE", task.assigneeId)) {
        toCreate.push({
          userId: task.assigneeId,
          taskId: task.id,
          type: "TASK_OVERDUE",
          message: `A tarefa "${task.title}" esta atrasada.`,
        });
      }
    } else if (diffDays === 0) {
      if (!alreadyNotified("TASK_DUE_TODAY", task.assigneeId)) {
        toCreate.push({
          userId: task.assigneeId,
          taskId: task.id,
          type: "TASK_DUE_TODAY",
          message: `A tarefa "${task.title}" vence hoje.`,
        });
      }
    } else if (diffDays === 1) {
      if (!alreadyNotified("TASK_DUE_TOMORROW", task.assigneeId)) {
        toCreate.push({
          userId: task.assigneeId,
          taskId: task.id,
          type: "TASK_DUE_TOMORROW",
          message: `A tarefa "${task.title}" vence amanha.`,
        });
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.notification.createMany({ data: toCreate });
  }

  return toCreate.length;
}
