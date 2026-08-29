import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/convite"];

// "/tarefas" (todas as tarefas) is admin-only as a *list*, but
// "/tarefas/[id]" (task detail) is shared — any involved employee can open
// their own task, enforced by canViewTask() inside the page itself.
const ADMIN_ONLY_EXACT = ["/tarefas"];
const ADMIN_ONLY_PREFIXES = ["/equipe", "/configuracoes"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// Optimistic check only (reads the signed cookie, no DB access) — the real
// authorization check runs server-side on every page/route via requireUser()
// / requireAdmin(), which also verifies the account is still ACTIVE.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || pathname === "/") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // "Tarefas" para funcionarios comuns fica em /minhas-tarefas e
  // /tarefas-solicitadas; /tarefas (todas as tarefas) e exclusivo do admin.
  const isAdminOnlyRoute =
    ADMIN_ONLY_EXACT.includes(pathname) ||
    ADMIN_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );

  if (isAdminOnlyRoute && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
