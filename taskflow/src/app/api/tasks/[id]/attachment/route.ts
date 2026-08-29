import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canEditTask, canViewTask } from "@/lib/permissions";
import { addHistory } from "@/lib/history";
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_SIZE,
  MIME_BY_EXTENSION,
  deleteTaskAttachment,
  isAllowedFile,
  resolveUploadPath,
  saveTaskAttachment,
} from "@/lib/uploads";
import path from "path";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await context.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
  }
  if (!canEditTask(task, user)) {
    return NextResponse.json(
      { error: "Voce nao tem permissao para anexar arquivos a esta tarefa." },
      { status: 403 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "Arquivo maior que 10MB." },
      { status: 400 }
    );
  }
  if (!isAllowedFile(file.name)) {
    return NextResponse.json(
      {
        error: `Tipo de arquivo nao permitido. Extensoes aceitas: ${Array.from(
          ALLOWED_EXTENSIONS
        ).join(", ")}`,
      },
      { status: 400 }
    );
  }

  await deleteTaskAttachment(task.attachmentUrl);
  const { storedName, originalName } = await saveTaskAttachment(id, file);

  await prisma.task.update({
    where: { id },
    data: { attachmentUrl: storedName, attachmentName: originalName },
  });

  await addHistory({
    taskId: id,
    userId: user.id,
    action: "ATTACHMENT_ADDED",
    newValue: originalName,
  });

  return NextResponse.json({ ok: true, attachmentName: originalName });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await context.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || !task.attachmentUrl) {
    return NextResponse.json({ error: "Anexo nao encontrado." }, { status: 404 });
  }
  if (!canViewTask(task, user)) {
    return NextResponse.json(
      { error: "Voce nao tem permissao para ver este anexo." },
      { status: 403 }
    );
  }

  try {
    const filePath = resolveUploadPath(task.attachmentUrl);
    const buffer = await readFile(filePath);
    const ext = path.extname(task.attachmentUrl).toLowerCase();
    const mime = MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          task.attachmentName ?? "anexo"
        )}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel ler o arquivo." },
      { status: 404 }
    );
  }
}
