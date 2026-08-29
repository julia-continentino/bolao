"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  taskId: string | null;
};

const TYPE_ICON: Record<string, string> = {
  TASK_ASSIGNED: "📌",
  TASK_DUE_TODAY: "⏰",
  TASK_DUE_TOMORROW: "⏳",
  TASK_OVERDUE: "⚠️",
  TASK_COMPLETED: "✅",
  TASK_UPDATED: "✏️",
};

export function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: (NotificationItem & { type: string })[];
  unreadCount: number;
}) {
  const router = useRouter();

  async function handleClick(n: NotificationItem) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    }
    if (n.taskId) {
      router.push(`/tarefas/${n.taskId}`);
    }
    router.refresh();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {unreadCount > 0
            ? `${unreadCount} nao lida${unreadCount > 1 ? "s" : ""}`
            : "Tudo em dia"}
        </p>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:underline"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Nenhuma notificacao ainda.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {notifications.map((n) => (
            <li key={n.id} className="border-b border-slate-100 last:border-0">
              <button
                onClick={() => handleClick(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                  !n.read ? "bg-blue-50/40" : ""
                }`}
              >
                <span className="mt-0.5 text-base">
                  {TYPE_ICON[n.type] ?? "🔔"}
                </span>
                <span className="flex-1">
                  <span className="block text-sm text-slate-800">
                    {n.message}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {formatRelative(n.createdAt)}
                  </span>
                </span>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
