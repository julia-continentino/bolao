import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api";
import { createTask } from "@/lib/tasks";

const createSchema = z.object({
  title: z.string().min(3, "O titulo precisa ter ao menos 3 caracteres."),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Selecione um responsavel."),
  dueDate: z.string().min(1, "Informe o prazo."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos." },
      { status: 400 }
    );
  }

  const dueDate = new Date(parsed.data.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Prazo invalido." }, { status: 400 });
  }

  try {
    const task = await createTask(user, {
      title: parsed.data.title,
      description: parsed.data.description,
      assigneeId: parsed.data.assigneeId,
      dueDate,
      priority: parsed.data.priority,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar tarefa." },
      { status: 400 }
    );
  }
}
