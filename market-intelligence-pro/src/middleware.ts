import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/status"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"] };
