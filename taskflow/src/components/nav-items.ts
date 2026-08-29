import type { Role } from "@prisma/client";

export type NavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "inbox" | "send" | "list" | "team" | "bell" | "user" | "settings";
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/minhas-tarefas", label: "Minhas tarefas", icon: "inbox" },
  { href: "/tarefas-solicitadas", label: "Tarefas solicitadas", icon: "send" },
  { href: "/tarefas", label: "Todas as tarefas", icon: "list", adminOnly: true },
  { href: "/equipe", label: "Equipe", icon: "team", adminOnly: true },
  { href: "/notificacoes", label: "Notificacoes", icon: "bell" },
  { href: "/perfil", label: "Perfil", icon: "user" },
  { href: "/configuracoes", label: "Configuracoes", icon: "settings", adminOnly: true },
];

export function visibleNavItems(role: Role) {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN");
}
