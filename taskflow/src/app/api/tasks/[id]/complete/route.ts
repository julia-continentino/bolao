import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { PermissionError, completeTask } from "@/lib/tasks";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await context.params;
  try {
    const task = await completeTask(user, id);
    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao concluir tarefa." },
      { status: 400 }
    );
  }
}
