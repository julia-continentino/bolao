import { prisma } from "./prisma";

export async function getActiveEmployeesForAssignment() {
  return prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, jobTitle: true },
    orderBy: { name: "asc" },
  });
}
