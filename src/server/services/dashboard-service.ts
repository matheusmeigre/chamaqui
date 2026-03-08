import { TicketStatus } from "@prisma/client";
import { getRecentNotifications } from "@/server/repositories/notification-repository";
import { getRecentTickets, getTicketStatusCounts } from "@/server/repositories/ticket-repository";

type DashboardContext = {
  userId: string;
  role?: string | null;
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
const attendedStatuses: TicketStatus[] = ["EM_ATENDIMENTO", "RESOLVIDO", "FECHADO"];

export async function getDashboardMetrics() {
  const counts = await getTicketStatusCounts();
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

export async function getDashboardActivity({ userId, role }: DashboardContext) {
  const ticketsWhere = role === "SOLICITANTE" ? { requesterId: userId } : undefined;

  const [recentTickets, recentNotifications] = await Promise.all([
    getRecentTickets({ take: 6, where: ticketsWhere }),
    getRecentNotifications({ userId, take: 6 }),
  ]);

  return { recentTickets, recentNotifications };
}
