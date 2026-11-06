import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Envolve um handler de rota com tratamento padronizado de erros */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.issues.map((i) => i.message).join(" "), issues: err.issues }, { status: 400 });
      }
      console.error("[api] erro não tratado:", err);
      return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
    }
  };
}
