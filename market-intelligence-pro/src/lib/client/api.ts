"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

/** Baixa um arquivo retornado por uma rota POST */
export async function download(url: string, body: unknown, fallbackName: string) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
