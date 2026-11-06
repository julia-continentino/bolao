"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const search = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: mode === "login" ? { email: form.email, password: form.password } : form });
      const next = search.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[46%] flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-white/10 text-sm font-bold">MI</div>
          <span className="text-sm font-semibold tracking-wide">MARKET INTELLIGENCE PRO</span>
        </div>
        <div>
          <h1 className="font-serif text-4xl leading-tight">Pesquisa setorial, benchmarking financeiro e relatórios corporativos com fontes verificáveis.</h1>
          <p className="mt-6 max-w-md text-sm leading-6 text-navy-300">
            Seis especialistas virtuais pesquisam, verificam e revisam cada dado. Você decide quantos parágrafos, quais gráficos e qual formato entregar.
          </p>
        </div>
        <p className="text-xs text-navy-300">Dados com fonte, natureza (histórico, estimativa ou projeção) e status de verificação.</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-semibold text-navy-900">{mode === "login" ? "Entrar" : "Criar conta"}</h2>
            <p className="mt-1 text-sm text-ink-500">{mode === "login" ? "Acesse sua biblioteca de pesquisas." : "Comece a criar pesquisas de mercado."}</p>
          </div>
          {mode === "register" && (
            <div>
              <label className="label" htmlFor="name">Nome</label>
              <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" className="input" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" type="password" className="input" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {mode === "register" && <p className="hint">Mínimo de 8 caracteres.</p>}
          </div>
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
          <p className="text-center text-sm text-ink-500">
            {mode === "login" ? <>Não tem conta? <Link className="font-medium text-navy-600 hover:underline" href="/register">Cadastre-se</Link></> : <>Já tem conta? <Link className="font-medium text-navy-600 hover:underline" href="/login">Entrar</Link></>}
          </p>
        </form>
      </div>
    </div>
  );
}
