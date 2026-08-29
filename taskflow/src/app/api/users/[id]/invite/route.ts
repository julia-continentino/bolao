import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createInviteForUser } from "@/lib/auth/invite";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireApiAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json(
      { error: "Funcionario nao encontrado." },
      { status: 404 }
    );
  }

  const invite = await createInviteForUser(id);
  return NextResponse.json({ inviteToken: invite.token });
}
