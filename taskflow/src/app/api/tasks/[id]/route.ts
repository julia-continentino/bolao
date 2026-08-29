import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api";
import { PermissionError, updateTask } from "@/lib/tasks";

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  assigneeId: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos." },
      { status: 400 }
    );
  }

  const { dueDate, ...rest } = parsed.data;

  try {
    const task = await updateTask(user, id, {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao atualizar tarefa.",
      },
      { status: 400 }
    );
  }
}
