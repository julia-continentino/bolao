import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "./session";
import type { Role, UserStatus } from "@prisma/client";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  jobTitle: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      jobTitle: true,
    },
  });

  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
