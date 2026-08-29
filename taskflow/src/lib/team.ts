import { prisma } from "./prisma";
import { getTaskMeta } from "./task-meta";

export async function getTeamOverview() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: {
      tasksAssigned: {
        select: { status: true, dueDate: true, completedAt: true },
      },
    },
  });

  return users.map((user) => {
    let todo = 0;
    let done = 0;
    let overdue = 0;
    for (const task of user.tasksAssigned) {
      const meta = getTaskMeta(task);
      if (task.status === "DONE") done++;
      else {
        todo++;
        if (meta.isOverdue) overdue++;
      }
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      jobTitle: user.jobTitle,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      todo,
      done,
      overdue,
    };
  });
}
