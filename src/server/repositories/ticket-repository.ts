import prisma from "@/lib/prisma";
import { Prisma, TicketStatus } from "@prisma/client";

type RecentTicketsParams = {
  take: number;
  where?: Prisma.TicketWhereInput;
};

const statusSeed: Record<TicketStatus, number> = {
  ABERTO: 0,
  EM_TRIAGEM: 0,
  EM_ATENDIMENTO: 0,
  PENDENTE: 0,
  RESOLVIDO: 0,
  FECHADO: 0,
  CANCELADO: 0,
};

export async function getTicketStatusCounts() {
  const grouped = await prisma.ticket.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts = { ...statusSeed };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }

  return counts;
}

export async function getRecentTickets({ take, where }: RecentTicketsParams) {
  return prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      requester: { select: { name: true } },
      assignee: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
}
