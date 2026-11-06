"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, FilePlus2, LayoutDashboard, Library, LayoutTemplate, LogOut } from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/research/new", label: "Nova pesquisa", icon: FilePlus2 },
  { href: "/library", label: "Biblioteca", icon: Library },
  { href: "/templates", label: "Modelos de relatório", icon: LayoutTemplate },
];

export function Sidebar({ user }: { user: { name: string; email: string } }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy-900 text-white md:flex">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10"><BarChart3 size={16} /></div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-wide">Market Intelligence</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-300">Pro</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={clsx("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition", active ? "bg-white/10 text-white" : "text-navy-300 hover:bg-white/5 hover:text-white")}>
              <n.icon size={16} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-navy-300">{user.email}</div>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-xs text-navy-300 hover:text-white"><LogOut size={13} /> Sair</button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-ink-200 bg-navy-900 px-3 py-2 md:hidden">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={clsx("whitespace-nowrap rounded px-2.5 py-1.5 text-xs", (n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "bg-white/15 text-white" : "text-navy-300")}>{n.label}</Link>
      ))}
    </div>
  );
}
