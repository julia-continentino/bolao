import { requirePageUser } from "@/lib/auth";
import { MobileNav, Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
