import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function getCurrentUser() {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
}

/** Para páginas: redireciona ao login quando não autenticado */
export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Para rotas de API */
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sessão expirada. Faça login novamente.");
  return user;
}

export async function getOwnedProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new HttpError(404, "Projeto não encontrado.");
  return project;
}

export async function getOwnedVersion(projectId: string, versionId: string, userId: string) {
  await getOwnedProject(projectId, userId);
  const version = await prisma.researchVersion.findFirst({ where: { id: versionId, projectId } });
  if (!version) throw new HttpError(404, "Versão não encontrada.");
  if (version.status !== "completed" || !version.content) throw new HttpError(409, "Esta versão da pesquisa ainda não foi concluída.");
  return { version, content: version.content as unknown as import("./types").ResearchContent };
}

export async function getOwnedReport(reportId: string, userId: string) {
  const report = await prisma.report.findFirst({ where: { id: reportId, project: { userId } }, include: { project: true } });
  if (!report) throw new HttpError(404, "Relatório não encontrado.");
  return report;
}
