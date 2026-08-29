import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  jobTitle: z.string().nullable().optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireApiAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos." },
      { status: 400 }
    );
  }

  if (id === admin.id && parsed.data.status === "INACTIVE") {
    return NextResponse.json(
      { error: "Voce nao pode desativar sua propria conta." },
      { status: 400 }
    );
  }
  if (id === admin.id && parsed.data.role === "EMPLOYEE") {
    return NextResponse.json(
      { error: "Voce nao pode remover seu proprio acesso de administrador." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json(
      { error: "Funcionario nao encontrado." },
      { status: 404 }
    );
  }

  // A conta PENDING (convite ainda nao aceito) so pode ser ativada pelo
  // proprio fluxo de convite, nunca diretamente pelo admin.
  const data: {
    name?: string;
    jobTitle?: string | null;
    role?: "ADMIN" | "EMPLOYEE";
    status?: "ACTIVE" | "INACTIVE";
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.jobTitle !== undefined)
    data.jobTitle = parsed.data.jobTitle?.trim() || null;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.status !== undefined && target.status !== "PENDING") {
    data.status = parsed.data.status;
  }

  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ user });
}
