import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { taskWithRelations } from "@/lib/tasks";
import { canCompleteTask, canEditTask, canViewTask } from "@/lib/permissions";
import { getTaskMeta } from "@/lib/task-meta";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatHistoryEntry } from "@/lib/history-format";
import { getActiveEmployeesForAssignment } from "@/lib/users";
import {
  DueSoonBadge,
  OverdueBadge,
  PriorityBadge,
  StatusBadge,
} from "@/components/badges";
import { TaskActions } from "@/components/task-actions";
import { EditTaskButton } from "@/components/edit-task-modal";
import { AttachmentUploader } from "@/components/attachment-uploader";
import { Paperclip } from "lucide-react";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      ...taskWithRelations,
      history: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) notFound();
  if (!canViewTask(task, user)) notFound();

  const meta = getTaskMeta(task);
  const employees = await getActiveEmployeesForAssignment();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {meta.isOverdue && <OverdueBadge daysOverdue={meta.daysOverdue} />}
            {!meta.isOverdue && meta.isDueToday && (
              <DueSoonBadge label="Vence hoje" />
            )}
            {!meta.isOverdue && meta.isDueTomorrow && (
              <DueSoonBadge label="Vence amanha" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {task.title}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canEditTask(task, user) && (
            <EditTaskButton
              taskId={task.id}
              employees={employees}
              initial={{
                title: task.title,
                description: task.description ?? "",
                assigneeId: task.assigneeId,
                dueDate: new Date(task.dueDate).toISOString().slice(0, 10),
                priority: task.priority,
                notes: task.notes ?? "",
              }}
            />
          )}
          <TaskActions
            taskId={task.id}
            canComplete={canCompleteTask(task, user) && task.status === "TODO"}
            canReopen={canEditTask(task, user) && task.status === "DONE"}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <Meta label="Solicitante" value={task.requester.name} />
        <Meta label="Responsavel" value={task.assignee.name} />
        <Meta label="Data da solicitacao" value={formatDate(task.createdAt)} />
        <Meta label="Prazo" value={formatDate(task.dueDate)} />
        <Meta
          label="Data de conclusao"
          value={task.completedAt ? formatDateTime(task.completedAt) : "-"}
        />
        <Meta
          label={task.status === "DONE" ? "Resultado" : meta.isOverdue ? "Atraso" : "Dias restantes"}
          value={
            task.status === "DONE"
              ? meta.completedOnTime
                ? "Concluida no prazo"
                : "Concluida com atraso"
              : meta.isOverdue
              ? `${meta.daysOverdue} dia${meta.daysOverdue === 1 ? "" : "s"}`
              : `${meta.daysRemaining} dia${meta.daysRemaining === 1 ? "" : "s"}`
          }
        />
      </div>

      {task.description && (
        <Section title="Descricao">
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {task.description}
          </p>
        </Section>
      )}

      {task.notes && (
        <Section title="Observacoes">
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {task.notes}
          </p>
        </Section>
      )}

      <Section
        title="Anexo"
        action={canEditTask(task, user) && <AttachmentUploader taskId={task.id} />}
      >
        {task.attachmentName ? (
          <a
            href={`/api/tasks/${task.id}/attachment`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:underline"
          >
            <Paperclip className="h-4 w-4" />
            {task.attachmentName}
          </a>
        ) : (
          <p className="text-sm text-slate-400">Nenhum anexo.</p>
        )}
      </Section>

      <Section title="Historico">
        <ol className="space-y-3">
          {task.history.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="text-slate-700">{formatHistoryEntry(entry)}</p>
              <p className="text-xs text-slate-400">
                {formatDateTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
