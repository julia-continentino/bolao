import { prisma } from "./prisma";
import { taskWithRelations } from "./tasks";
import { getTaskMeta } from "./task-meta";

export async function getEmployeeDashboardData(userId: string) {
  const [assignedTasks, requestedTasks] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId },
      include: taskWithRelations,
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: { requesterId: userId },
      include: taskWithRelations,
      orderBy: { dueDate: "asc" },
    }),
  ]);

  let todo = 0;
  let done = 0;
  let overdue = 0;
  let dueToday = 0;
  let dueNext7Days = 0;

  for (const task of assignedTasks) {
    const meta = getTaskMeta(task);
    if (task.status === "DONE") {
      done++;
      continue;
    }
    todo++;
    if (meta.isOverdue) overdue++;
    else if (meta.isDueToday) dueToday++;
    else if (meta.daysRemaining >= 0 && meta.daysRemaining <= 7) dueNext7Days++;
  }

  return {
    assignedTasks,
    requestedTasks,
    counts: { todo, done, overdue, dueToday, dueNext7Days },
  };
}

export async function getAdminDashboardData() {
  const [totalEmployees, allTasks, employees] = await Promise.all([
    prisma.user.count({ where: { status: { not: "INACTIVE" } } }),
    prisma.task.findMany({
      include: taskWithRelations,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { status: { not: "INACTIVE" } },
      select: { id: true, name: true },
    }),
  ]);

  let open = 0;
  let completed = 0;
  let overdue = 0;
  let dueSoon = 0;
  let completedOnTime = 0;
  let completedTotal = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let createdLast30Days = 0;

  const byEmployee = new Map<
    string,
    { name: string; todo: number; done: number; overdue: number }
  >();
  for (const emp of employees) {
    byEmployee.set(emp.id, { name: emp.name, todo: 0, done: 0, overdue: 0 });
  }

  for (const task of allTasks) {
    const meta = getTaskMeta(task);
    if (task.createdAt >= thirtyDaysAgo) createdLast30Days++;

    const bucket = byEmployee.get(task.assigneeId);

    if (task.status === "DONE") {
      completed++;
      completedTotal++;
      if (meta.completedOnTime) completedOnTime++;
      if (bucket) bucket.done++;
    } else {
      open++;
      if (bucket) bucket.todo++;
      if (meta.isOverdue) {
        overdue++;
        if (bucket) bucket.overdue++;
      } else if (meta.isDueToday || (meta.daysRemaining >= 0 && meta.daysRemaining <= 7)) {
        dueSoon++;
      }
    }
  }

  const onTimeRate =
    completedTotal > 0 ? Math.round((completedOnTime / completedTotal) * 100) : null;

  return {
    totalEmployees,
    tasks: allTasks,
    counts: {
      open,
      completed,
      overdue,
      dueSoon,
      createdLast30Days,
      onTimeRate,
    },
    byEmployee: Array.from(byEmployee.values()),
  };
}
