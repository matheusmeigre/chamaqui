import {
  BarChart3,
  Bell,
  LayoutDashboard,
  Monitor,
  QrCode,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marca ativo também nas rotas filhas. */
  prefix?: boolean;
  adminOnly?: boolean;
  /** Descrição usada na paleta de comandos. */
  hint?: string;
};

export type NavSection = {
  title: string | null;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      {
        href: "/dashboard",
        label: "Visão geral",
        icon: LayoutDashboard,
        hint: "Indicadores, SLA e fila do período",
      },
      {
        href: "/tickets",
        label: "Chamados",
        icon: Ticket,
        prefix: true,
        hint: "Lista completa, filtros e quadro",
      },
      {
        href: "/reports/consumption",
        label: "Relatório mensal",
        icon: BarChart3,
        prefix: true,
        hint: "Consumo × teto, SLA e causa raiz",
      },
      {
        href: "/notifications",
        label: "Notificações",
        icon: Bell,
        hint: "Alertas de SLA, teto e atualizações",
      },
    ],
  },
  {
    title: "Administração",
    items: [
      {
        href: "/users",
        label: "Usuários",
        icon: Users,
        prefix: true,
        adminOnly: true,
        hint: "Pessoas e perfis de acesso",
      },
      {
        href: "/settings/devices",
        label: "Dispositivos",
        icon: Monitor,
        prefix: true,
        adminOnly: true,
        hint: "Sessões ativas e revogação",
      },
      {
        href: "/settings/activation-codes",
        label: "Códigos de ativação",
        icon: QrCode,
        prefix: true,
        adminOnly: true,
        hint: "Gerar acesso por código ou QR",
      },
      {
        href: "/settings",
        label: "Configurações",
        icon: Settings,
        adminOnly: true,
        hint: "Preferências da plataforma",
      },
    ],
  },
];

/** Título mostrado na barra superior, por rota. */
export const ROUTE_TITLES: Array<{ match: RegExp; title: string }> = [
  { match: /^\/dashboard/, title: "Visão geral" },
  { match: /^\/tickets\/new/, title: "Abrir chamado" },
  { match: /^\/tickets\/[^/]+$/, title: "Detalhe do chamado" },
  { match: /^\/tickets/, title: "Chamados" },
  { match: /^\/reports\/consumption/, title: "Relatório mensal" },
  { match: /^\/notifications/, title: "Notificações" },
  { match: /^\/users/, title: "Usuários" },
  { match: /^\/settings\/devices/, title: "Dispositivos" },
  { match: /^\/settings\/activation-codes/, title: "Códigos de ativação" },
  { match: /^\/settings/, title: "Configurações" },
];

export function titleForPath(pathname: string): string {
  return ROUTE_TITLES.find((entry) => entry.match.test(pathname))?.title ?? "Chamaqui";
}

export function isActive(pathname: string, item: NavItem): boolean {
  return item.prefix ? pathname.startsWith(item.href) : pathname === item.href;
}

export function visibleSections(role: string | null | undefined): NavSection[] {
  const isAdmin = role === "ADMINISTRADOR";
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((section) => section.items.length > 0);
}
