import { TicketStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getRecentNotifications } from "@/server/repositories/notification-repository";
import { getRecentTickets, getTicketStatusCounts } from "@/server/repositories/ticket-repository";

type DashboardContext = {
  userId: string;
  role?: string | null;
  organizationId?: string | null;
};

const statusOrder: TicketStatus[] = [
  "ABERTO",
  "EM_TRIAGEM",
  "EM_ATENDIMENTO",
  "PENDENTE",
  "RESOLVIDO",
  "FECHADO",
  "CANCELADO",
];

const openStatuses: TicketStatus[] = ["ABERTO", "EM_TRIAGEM"];
const attendedStatuses: TicketStatus[] = ["EM_ATENDIMENTO", "RESOLVIDO", "FECHADO", "CANCELADO"];

/**
 * Recorte de visibilidade compartilhado com o analítico: solicitante vê os
 * próprios chamados, administrador vê a organização em foco.
 */
export function dashboardScopeWhere({
  userId,
  role,
  organizationId,
}: DashboardContext): Prisma.TicketWhereInput | undefined {
  if (role === "SOLICITANTE") return { requesterId: userId };
  if (organizationId) return { requester: { organizationId } };
  return undefined;
}

export async function getDashboardMetrics(context?: DashboardContext) {
  const counts = await getTicketStatusCounts(context ? dashboardScopeWhere(context) : undefined);
  const totalTickets = Object.values(counts).reduce((acc, value) => acc + value, 0);
  const openTickets = openStatuses.reduce((acc, status) => acc + counts[status], 0);
  const attendedTickets = attendedStatuses.reduce((acc, status) => acc + counts[status], 0);
  const pendingTickets = counts.PENDENTE;

  const statusDistribution = statusOrder.map((status) => ({
    status,
    count: counts[status],
  }));

  return {
    totalTickets,
    openTickets,
    attendedTickets,
    pendingTickets,
    statusDistribution,
  };
}

export async function getDashboardActivity({
  userId,
  role,
  organizationId,
}: DashboardContext) {
  const ticketsWhere = dashboardScopeWhere({ userId, role, organizationId });

  const [recentTickets, recentNotifications] = await Promise.all([
    getRecentTickets({ take: 6, where: ticketsWhere }),
    getRecentNotifications({ userId, take: 5 }),
  ]);

  return { recentTickets, recentNotifications };
}
