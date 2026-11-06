import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, HttpError } from "@/lib/auth";
import { handler } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const schema = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido."), password: z.string().min(1, "Informe a senha.") });

// Limitação simples de tentativas por e-mail (memória do processo)
const attempts = new Map<string, { n: number; until: number }>();

export const POST = handler(async (req: Request) => {
  const body = schema.parse(await req.json());
  const a = attempts.get(body.email);
  if (a && a.until > Date.now() && a.n >= 5) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await checkPassword(body.password, user.passwordHash))) {
    attempts.set(body.email, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 10 * 60_000 });
    throw new HttpError(401, "E-mail ou senha incorretos.");
  }
  attempts.delete(body.email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  return res;
});
