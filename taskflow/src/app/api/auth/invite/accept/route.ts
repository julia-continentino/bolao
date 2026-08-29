import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPasswordStrong } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { consumeInviteToken, validateInviteToken } from "@/lib/auth/invite";

const acceptSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos. A senha precisa ter ao menos 8 caracteres." },
      { status: 400 }
    );
  }

  const { token, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "As senhas informadas nao coincidem." },
      { status: 400 }
    );
  }

  if (!isPasswordStrong(password)) {
    return NextResponse.json(
      { error: "A senha precisa ter ao menos 8 caracteres." },
      { status: 400 }
    );
  }

  const validation = await validateInviteToken(token);
  if (!validation.valid) {
    const messages: Record<string, string> = {
      not_found: "Link de convite invalido.",
      expired: "Este link de convite expirou. Peca um novo ao administrador.",
      used: "Este link de convite ja foi utilizado.",
    };
    return NextResponse.json(
      { error: messages[validation.reason] },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.update({
    where: { id: validation.userId },
    data: { passwordHash, status: "ACTIVE" },
  });

  await consumeInviteToken(token);

  await setSessionCookie({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  return NextResponse.json({ ok: true });
}
