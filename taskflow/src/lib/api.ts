import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./auth/guards";

export async function requireApiUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  return user;
}

export async function requireApiAdmin(): Promise<CurrentUser | NextResponse> {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito ao administrador." },
      { status: 403 }
    );
  }
  return user;
}
