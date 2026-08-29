import { prisma } from "./prisma";

export async function addHistory(params: {
  taskId: string;
  userId: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  return prisma.taskHistory.create({
    data: {
      taskId: params.taskId,
      userId: params.userId,
      action: params.action,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
    },
  });
}
