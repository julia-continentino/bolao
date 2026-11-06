import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, HttpError } from "@/lib/auth";
import { handler } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(200),
});

export const POST = handler(async (req: Request) => {
  const body = schema.parse(await req.json());
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw new HttpError(409, "Já existe uma conta com este e-mail.");
  const user = await prisma.user.create({ data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password) } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  return res;
});
