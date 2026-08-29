import { requireUser } from "@/lib/auth/guards";
import { getUnreadCount, syncDueDateNotifications } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await syncDueDateNotifications();
  const unreadCount = await getUnreadCount(user.id);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
