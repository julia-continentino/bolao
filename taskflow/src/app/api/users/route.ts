import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createInviteForUser } from "@/lib/auth/invite";

const createUserSchema = z.object({
  name: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("E-mail invalido."),
  jobTitle: z.string().optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
});

export async function POST(request: Request) {
  const admin = await requireApiAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Ja existe um funcionario com este e-mail." },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      jobTitle: parsed.data.jobTitle?.trim() || null,
      role: parsed.data.role,
      status: "PENDING",
    },
  });

  const invite = await createInviteForUser(user.id);

  return NextResponse.json(
    { user, inviteToken: invite.token },
    { status: 201 }
  );
}
