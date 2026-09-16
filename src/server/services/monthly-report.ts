// ----------------------------------------------------------------------------
// Relatório mensal — saída obrigatória por contrato (seção 12.6)
//
// Chamados por categoria com consumo × teto, SLA cumprido por severidade (com e
// sem a janela de loja descontada), improcedentes com motivo, reincidências,
// taxa de P1 contra a reserva da faixa e ranking de causa raiz.
// ----------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import type { Severity, TicketOutcome } from "@prisma/client";
import { SEVERITY_ORDER } from "@/server/domain/ticket-grid";
import { loadBusinessCalendar } from "./business-hours";
import { assessSla, type MilestoneKey } from "./sla-service";
import { getQuotaSnapshot, type QuotaSnapshot } from "./quota-service";
import { competencyOf } from "./ticket-classification";

export type SlaComplianceLine = {
  severity: Severity;
  total: number;
  milestones: Record<
    MilestoneKey,
    {
      applicable: number;
      /** Cumpridos com a janela de loja descontada — o compromisso contratual. */
      metAdjusted: number;
      /** Cumpridos sem o desconto — o número bruto, para transparência. */
      metRaw: number;
    }
  >;
};

export type ImproperLine = { outcome: TicketOutcome; count: number };

export type RootCauseLine = { category: string; total: number; p1: number };

export type RecurrenceLine = {
  id: string;
  title: string;
  parentTicketId: string;
  consumesQuota: boolean;
  openedAt: Date;
};

export type MonthlyReport = {
  competency: string;
  organizationId: string;
  quota: QuotaSnapshot;
  sla: SlaComplianceLine[];
  improper: ImproperLine[];
  improperTotal: number;
  recurrences: RecurrenceLine[];
  p1: {
    count: number;
    hours: number;
    reserveHours: number | null;
    /** Fração da reserva de P1 consumida. null quando não há contrato. */
    ratio: number | null;
  };
  rootCauses: RootCauseLine[];
  totalTickets: number;
};

const EMPTY_MILESTONES = (): SlaComplianceLine["milestones"] => ({
  firstResponse: { applicable: 0, metAdjusted: 0, metRaw: 0 },
  workaround: { applicable: 0, metAdjusted: 0, metRaw: 0 },
  definitiveFix: { applicable: 0, metAdjusted: 0, metRaw: 0 },
});

export async function buildMonthlyReport(
  organizationId: string,
  competency: string = competencyOf(new Date()),
): Promise<MonthlyReport> {
  const [quota, calendar, tickets] = await Promise.all([
    getQuotaSnapshot(organizationId, competency),
    loadBusinessCalendar(),
    prisma.ticket.findMany({
      where: { competency, requester: { organizationId } },
      select: {
        id: true,
        title: true,
        severity: true,
        categoryCode: true,
        outcome: true,
        actualHours: true,
        parentTicketId: true,
        consumesQuota: true,
        openedAt: true,
        firstResponseAt: true,
        workaroundAt: true,
        definitiveFixAt: true,
        correctionClass: true,
        sentToStoreAt: true,
        storeApprovedAt: true,
        category: { select: { name: true } },
      },
      orderBy: { openedAt: "asc" },
    }),
  ]);

  // --- SLA por severidade ---------------------------------------------------
  const slaMap = new Map<Severity, SlaComplianceLine>();
  for (const severity of SEVERITY_ORDER) {
    slaMap.set(severity, { severity, total: 0, milestones: EMPTY_MILESTONES() });
  }

  for (const ticket of tickets) {
    if (!ticket.severity) continue;
    const line = slaMap.get(ticket.severity)!;
    line.total += 1;

    const assessment = assessSla(ticket, calendar);
    for (const milestone of assessment.milestones) {
      if (milestone.targetHours === null) continue;
      const bucket = line.milestones[milestone.key];
      bucket.applicable += 1;
      // Só conta como cumprido o marco que de fato aconteceu: um prazo ainda em
      // curso não é sucesso, e um estourado em aberto não vira cumprido depois.
      if (milestone.metAt) {
        if (milestone.elapsedHours <= milestone.targetHours) bucket.metAdjusted += 1;
        if (milestone.elapsedHoursRaw <= milestone.targetHours) bucket.metRaw += 1;
      }
    }
  }

  // --- Improcedentes --------------------------------------------------------
  const improperMap = new Map<TicketOutcome, number>();
  for (const ticket of tickets) {
    if (!ticket.outcome) continue;
    if (!ticket.outcome.startsWith("IMPROCEDENTE") && ticket.outcome !== "DUPLICADO") continue;
    improperMap.set(ticket.outcome, (improperMap.get(ticket.outcome) ?? 0) + 1);
  }

  const improper: ImproperLine[] = [...improperMap.entries()]
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count);

  // --- Reincidências --------------------------------------------------------
  const recurrences: RecurrenceLine[] = tickets
    .filter((t) => t.parentTicketId !== null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      parentTicketId: t.parentTicketId!,
      consumesQuota: t.consumesQuota,
      openedAt: t.openedAt,
    }));

  // --- Taxa de P1 contra a reserva da faixa ---------------------------------
  const p1Tickets = tickets.filter((t) => t.severity === "P1");
  const p1Hours = p1Tickets.reduce((acc, t) => acc + (t.actualHours ?? 0), 0);
  const reserveHours = quota.p1ReserveHours;

  // --- Ranking de causa raiz ------------------------------------------------
  // A categoria técnica é o melhor indicador de causa raiz disponível hoje: o
  // histórico já mostrou autenticação como origem dominante de P1.
  const rootMap = new Map<string, RootCauseLine>();
  for (const ticket of tickets) {
    const name = ticket.category?.name ?? "Não classificado";
    const line = rootMap.get(name) ?? { category: name, total: 0, p1: 0 };
    line.total += 1;
    if (ticket.severity === "P1") line.p1 += 1;
    rootMap.set(name, line);
  }

  const rootCauses = [...rootMap.values()].sort(
    (a, b) => b.p1 - a.p1 || b.total - a.total,
  );

  return {
    competency,
    organizationId,
    quota,
    sla: SEVERITY_ORDER.map((s) => slaMap.get(s)!).filter((line) => line.total > 0),
    improper,
    improperTotal: improper.reduce((acc, line) => acc + line.count, 0),
    recurrences,
    p1: {
      count: p1Tickets.length,
      hours: Number(p1Hours.toFixed(2)),
      reserveHours,
      ratio: reserveHours && reserveHours > 0 ? p1Hours / reserveHours : null,
    },
    rootCauses,
    totalTickets: tickets.length,
  };
}

/** Competências com movimento, da mais recente para a mais antiga. */
export async function listCompetencies(organizationId: string): Promise<string[]> {
  const rows = await prisma.ticket.findMany({
    where: { requester: { organizationId }, competency: { not: null } },
    select: { competency: true },
    distinct: ["competency"],
    orderBy: { competency: "desc" },
    take: 24,
  });

  const current = competencyOf(new Date());
  const found = rows.map((r) => r.competency!).filter(Boolean);
  return found.includes(current) ? found : [current, ...found];
}
