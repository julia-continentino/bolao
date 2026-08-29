import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getUnreadCount } from "@/lib/notifications";
import { NotificationList } from "@/components/notification-list";

export default async function NotificacoesPage() {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getUnreadCount(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Central de notificacoes
        </h1>
        <p className="text-sm text-slate-500">
          Avisos sobre tarefas atribuidas, prazos e conclusoes.
        </p>
      </div>

      <NotificationList
        unreadCount={unreadCount}
        notifications={notifications.map((n) => ({
          id: n.id,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
          taskId: n.taskId,
          type: n.type,
        }))}
      />
    </div>
  );
}
