import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Busca da paleta de comandos. O recorte é o mesmo do resto do portal:
 * solicitante encontra apenas os próprios chamados.
 */
export async function GET(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const term = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (term.length < 2) {
    return NextResponse.json({ tickets: [] });
  }

  const scope: Prisma.TicketWhereInput =
    session.role === "SOLICITANTE" ? { requesterId: session.id } : {};

  const tickets = await prisma.ticket.findMany({
    where: {
      ...scope,
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        // O usuário copia o identificador curto que a interface mostra.
        { id: { startsWith: term.toLowerCase().replace(/^#/, "") } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
      severity: true,
      categoryCode: true,
    },
  });

  return NextResponse.json({ tickets });
}
