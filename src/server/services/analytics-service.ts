// ----------------------------------------------------------------------------
// Analítico do painel
//
// A dashboard antiga contava chamados globalmente e mostrava o resultado a
// qualquer perfil. Aqui todo recorte passa pelo mesmo `scopeFor`: o solicitante
// vê os próprios chamados, o administrador vê a organização selecionada.
//
// Os números que alimentam o BI já existem no domínio (grade, SLA em horas
// úteis, tetos por competência) — este módulo só os agrega.
// ----------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import type { Prisma, Severity, TicketCategoryCode, TicketStatus } from "@prisma/client";
import { CATEGORY_ORDER, SEVERITY_ORDER } from "@/server/domain/ticket-grid";
import { businessHoursBetween, loadBusinessCalendar } from "./business-hours";
import { assessSla, type MilestoneKey } from "./sla-service";
import { competencyOf } from "./ticket-classification";

export type DashboardScope = {
  userId: string;
  role?: string | null;
  /** Organização em foco. Solicitante sempre usa a própria. */
  organizationId?: string | null;
  /** Janela de análise em dias corridos. */
  days: number;
};

export const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
] as const;

export function parsePeriod(raw: string | undefined): number {
  const parsed = Number(raw);
  return PERIOD_OPTIONS.some((option) => option.value === parsed) ? parsed : 30;
}

const ACTIVE_STATUSES: TicketStatus[] = ["ABERTO", "EM_TRIAGEM", "EM_ATENDIMENTO", "PENDENTE"];
const CLOSED_STATUSES: TicketStatus[] = ["RESOLVIDO", "FECHADO"];

const STATUS_SEED: Record<TicketStatus, number> = {
  ABERTO: 0,
  EM_TRIAGEM: 0,
  EM_ATENDIMENTO: 0,
  PENDENTE: 0,
  RESOLVIDO: 0,
  FECHADO: 0,
  CANCELADO: 0,
};

/** Recorte de visibilidade. É a única porta: nenhuma consulta escapa dele. */
function scopeFor(scope: DashboardScope): Prisma.TicketWhereInput {
  if (scope.role === "SOLICITANTE") return { requesterId: scope.userId };
  if (scope.organizationId) return { requester: { organizationId: scope.organizationId } };
  return {};
}

const MS_PER_DAY = 86_400_000;

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/* ---------------------------------------------------------------------------
   Tipos de saída
--------------------------------------------------------------------------- */

export type TrendPoint = { label: string; fullLabel: string; opened: number; resolved: number };

export type AgingBucket = { key: string; label: string; hint: string; maxDays: number | null };

export const AGING_BUCKETS: AgingBucket[] = [
  { key: "d0", label: "< 1 d", hint: "Aberto há menos de um dia", maxDays: 1 },
  { key: "d1", label: "1–3 d", hint: "Entre um e três dias", maxDays: 3 },
  { key: "d3", label: "3–7 d", hint: "Entre três e sete dias", maxDays: 7 },
  { key: "d7", label: "7–15 d", hint: "Entre uma e duas semanas", maxDays: 15 },
  { key: "d15", label: "> 15 d", hint: "Mais de quinze dias em aberto", maxDays: null },
];

export type SlaRiskItem = {
  id: string;
  title: string;
  status: TicketStatus;
  severity: Severity;
  categoryCode: TicketCategoryCode | null;
  requesterName: string;
  assigneeName: string | null;
  milestone: MilestoneKey;
  milestoneLabel: string;
  /** Horas úteis restantes; negativo quando já estourou. */
  remainingHours: number;
  targetHours: number;
  dueAt: Date | null;
  breached: boolean;
  openedAt: Date;
};

export type DecisionItem = {
  id: string;
  title: string;
  kind: "EXCEDENTE" | "CONTESTACAO";
  deadline: Date | null;
  categoryCode: TicketCategoryCode | null;
};

export type SlaMilestoneTally = {
  severity: Severity;
  total: number;
  met: number;
  breached: number;
  running: number;
};

export type DashboardAnalytics = {
  period: { days: number; start: Date; end: Date };
  competency: string;

  kpi: {
    backlog: number;
    backlogDelta: number;
    opened: number;
    openedDelta: number;
    resolved: number;
    resolvedDelta: number;
    atRisk: number;
    breached: number;
    slaCompliance: number | null;
    slaComplianceDelta: number | null;
    avgFirstResponseHours: number | null;
    avgFirstResponseDelta: number | null;
    avgResolutionHours: number | null;
    reopenRate: number | null;
    backlogTrend: number[];
    openedTrend: number[];
    resolvedTrend: number[];
  };

  trend: TrendPoint[];
  statusDistribution: Array<{ status: TicketStatus; count: number }>;
  categoryMix: Array<{ code: TicketCategoryCode; label: string; count: number; hours: number }>;
  severityTally: SlaMilestoneTally[];
  aging: { rows: Array<{ key: string; label: string }>; values: number[][] };
  rootCauses: Array<{ category: string; total: number; p1: number }>;
  slaRisk: SlaRiskItem[];
  decisions: DecisionItem[];
  unclassified: number;
};

/* ---------------------------------------------------------------------------
   Agregação
--------------------------------------------------------------------------- */

const TICKET_SELECT = {
  id: true,
  title: true,
  status: true,
  severity: true,
  categoryCode: true,
  openedAt: true,
  createdAt: true,
  resolvedAt: true,
  firstResponseAt: true,
  workaroundAt: true,
  definitiveFixAt: true,
  correctionClass: true,
  sentToStoreAt: true,
  storeApprovedAt: true,
  actualHours: true,
  parentTicketId: true,
  executionBlocked: true,
  overrunDecision: true,
  contestationOpenedAt: true,
  contestationDeadline: true,
  contestationDecision: true,
  requester: { select: { name: true } },
  assignee: { select: { name: true } },
  category: { select: { name: true } },
} satisfies Prisma.TicketSelect;

type TicketRow = Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>;

export async function getDashboardAnalytics(scope: DashboardScope): Promise<DashboardAnalytics> {
  const where = scopeFor(scope);
  const now = new Date();
  const windowStart = new Date(now.getTime() - scope.days * MS_PER_DAY);
  const previousStart = new Date(now.getTime() - scope.days * 2 * MS_PER_DAY);

  const [calendar, statusGroups, windowTickets, backlogTickets] = await Promise.all([
    loadBusinessCalendar(),
    prisma.ticket.groupBy({ by: ["status"], where, _count: { _all: true } }),
    // Duas janelas de uma vez: a atual e a anterior, para os deltas.
    prisma.ticket.findMany({
      where: { ...where, openedAt: { gte: previousStart } },
      select: TICKET_SELECT,
      orderBy: { openedAt: "asc" },
    }),
    // A fila viva independe da janela: um chamado de 60 dias ainda pesa hoje.
    prisma.ticket.findMany({
      where: { ...where, status: { in: ACTIVE_STATUSES } },
      select: TICKET_SELECT,
      orderBy: { openedAt: "asc" },
    }),
  ]);

  const statusCounts = { ...STATUS_SEED };
  for (const group of statusGroups) statusCounts[group.status] = group._count._all;

  const current = windowTickets.filter((ticket) => ticket.openedAt >= windowStart);
  const previous = windowTickets.filter((ticket) => ticket.openedAt < windowStart);

  const resolvedIn = (from: Date, to: Date) =>
    windowTickets.filter((ticket) => {
      const at = closedAtOf(ticket);
      return at !== null && at >= from && at < to;
    });

  const resolvedCurrent = resolvedIn(windowStart, new Date(now.getTime() + MS_PER_DAY));
  const resolvedPrevious = resolvedIn(previousStart, windowStart);

  /* --- Série temporal: abertos × resolvidos ------------------------------- */
  const buckets = buildBuckets(windowStart, now, scope.days);
  for (const ticket of current) {
    const index = bucketIndex(buckets, ticket.openedAt);
    if (index >= 0) buckets[index].opened += 1;
  }
  for (const ticket of resolvedCurrent) {
    const at = closedAtOf(ticket);
    if (!at) continue;
    const index = bucketIndex(buckets, at);
    if (index >= 0) buckets[index].resolved += 1;
  }

  const trend: TrendPoint[] = buckets.map((bucket) => ({
    label: bucket.label,
    fullLabel: bucket.fullLabel,
    opened: bucket.opened,
    resolved: bucket.resolved,
  }));

  /* --- SLA na janela ------------------------------------------------------ */
  const slaCurrent = tallySla(current, calendar);
  const slaPrevious = tallySla(previous, calendar);

  const complianceOf = (tally: { met: number; applicable: number }) =>
    tally.applicable === 0 ? null : tally.met / tally.applicable;

  const compliance = complianceOf(slaCurrent.totals);
  const compliancePrevious = complianceOf(slaPrevious.totals);

  /* --- Tempos médios em horas úteis --------------------------------------- */
  const avgFirstResponse = averageBusinessHours(
    current.filter((t) => t.firstResponseAt),
    (t) => [t.openedAt, t.firstResponseAt!],
    calendar
  );
  const avgFirstResponsePrevious = averageBusinessHours(
    previous.filter((t) => t.firstResponseAt),
    (t) => [t.openedAt, t.firstResponseAt!],
    calendar
  );
  const avgResolution = averageBusinessHours(
    resolvedCurrent,
    (t) => [t.openedAt, closedAtOf(t)!],
    calendar
  );

  /* --- Risco de SLA na fila viva ------------------------------------------ */
  const slaRisk = buildSlaRisk(backlogTickets, calendar, now);

  /* --- Envelhecimento da fila --------------------------------------------- */
  const aging = buildAging(backlogTickets, now);

  /* --- Mix por natureza --------------------------------------------------- */
  const categoryMix = CATEGORY_ORDER.map((code) => {
    const rows = current.filter((ticket) => ticket.categoryCode === code);
    return {
      code,
      label: code,
      count: rows.length,
      hours: Number(rows.reduce((acc, row) => acc + (row.actualHours ?? 0), 0).toFixed(2)),
    };
  });

  /* --- Causa raiz --------------------------------------------------------- */
  const rootMap = new Map<string, { category: string; total: number; p1: number }>();
  for (const ticket of current) {
    const name = ticket.category?.name ?? "Não classificado";
    const line = rootMap.get(name) ?? { category: name, total: 0, p1: 0 };
    line.total += 1;
    if (ticket.severity === "P1") line.p1 += 1;
    rootMap.set(name, line);
  }
  const rootCauses = [...rootMap.values()].sort((a, b) => b.p1 - a.p1 || b.total - a.total);

  /* --- Fila de decisão do cliente ----------------------------------------- */
  const decisions: DecisionItem[] = [
    ...backlogTickets
      .filter((ticket) => ticket.executionBlocked && ticket.overrunDecision === null)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        kind: "EXCEDENTE" as const,
        deadline: null,
        categoryCode: ticket.categoryCode,
      })),
    ...backlogTickets
      .filter((ticket) => ticket.contestationOpenedAt && !ticket.contestationDecision)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        kind: "CONTESTACAO" as const,
        deadline: ticket.contestationDeadline,
        categoryCode: ticket.categoryCode,
      })),
  ];

  /* --- Reincidência ------------------------------------------------------- */
  const reopened = current.filter((ticket) => ticket.parentTicketId !== null).length;

  const backlog = ACTIVE_STATUSES.reduce((acc, status) => acc + statusCounts[status], 0);
  // Backlog de uma janela atrás = fila de hoje − abertos no período + fechados no período.
  const backlogBefore = backlog - current.length + resolvedCurrent.length;

  return {
    period: { days: scope.days, start: windowStart, end: now },
    competency: competencyOf(now),

    kpi: {
      backlog,
      backlogDelta: backlog - backlogBefore,
      opened: current.length,
      openedDelta: current.length - previous.length,
      resolved: resolvedCurrent.length,
      resolvedDelta: resolvedCurrent.length - resolvedPrevious.length,
      atRisk: slaRisk.filter((item) => !item.breached).length,
      breached: slaRisk.filter((item) => item.breached).length,
      slaCompliance: compliance,
      slaComplianceDelta:
        compliance !== null && compliancePrevious !== null
          ? Number(((compliance - compliancePrevious) * 100).toFixed(1))
          : null,
      avgFirstResponseHours: avgFirstResponse,
      avgFirstResponseDelta:
        avgFirstResponse !== null && avgFirstResponsePrevious !== null
          ? Number((avgFirstResponse - avgFirstResponsePrevious).toFixed(1))
          : null,
      avgResolutionHours: avgResolution,
      reopenRate: current.length === 0 ? null : reopened / current.length,
      backlogTrend: runningBacklog(buckets, backlogBefore),
      openedTrend: buckets.map((bucket) => bucket.opened),
      resolvedTrend: buckets.map((bucket) => bucket.resolved),
    },

    trend,
    statusDistribution: (Object.keys(statusCounts) as TicketStatus[]).map((status) => ({
      status,
      count: statusCounts[status],
    })),
    categoryMix,
    severityTally: slaCurrent.bySeverity,
    aging,
    rootCauses,
    slaRisk,
    decisions,
    unclassified: backlogTickets.filter((ticket) => ticket.categoryCode === null).length,
  };
}

/* ---------------------------------------------------------------------------
   Auxiliares
--------------------------------------------------------------------------- */

/** Instante em que o chamado saiu da fila. */
function closedAtOf(ticket: TicketRow): Date | null {
  if (!CLOSED_STATUSES.includes(ticket.status)) return null;
  return ticket.resolvedAt ?? ticket.definitiveFixAt ?? null;
}

type Bucket = { start: Date; end: Date; label: string; fullLabel: string; opened: number; resolved: number };

/** Dias para janelas curtas, semanas para 90 dias — 90 colunas viram serrilha. */
function buildBuckets(start: Date, end: Date, days: number): Bucket[] {
  const groupDays = days > 45 ? 7 : 1;
  const buckets: Bucket[] = [];
  let cursor = startOfDayUTC(start);
  const limit = startOfDayUTC(end);

  while (cursor <= limit) {
    const next = new Date(cursor.getTime() + groupDays * MS_PER_DAY);
    buckets.push({
      start: cursor,
      end: next,
      label: formatBucketLabel(cursor, groupDays),
      fullLabel: formatBucketFullLabel(cursor, next, groupDays),
      opened: 0,
      resolved: 0,
    });
    cursor = next;
  }

  return buckets;
}

function bucketIndex(buckets: Bucket[], at: Date): number {
  return buckets.findIndex((bucket) => at >= bucket.start && at < bucket.end);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatBucketLabel(date: Date, groupDays: number): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  if (groupDays === 1) return `${day}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${day} ${MONTHS[date.getUTCMonth()]}`;
}

function formatBucketFullLabel(start: Date, end: Date, groupDays: number): string {
  const d = (date: Date) =>
    `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]}`;
  if (groupDays === 1) return `${d(start)}`;
  const last = new Date(end.getTime() - MS_PER_DAY);
  return `${d(start)} – ${d(last)}`;
}

/** Fila reconstruída passo a passo, para a minissérie do indicador. */
function runningBacklog(buckets: Bucket[], startingBacklog: number): number[] {
  let running = startingBacklog;
  return buckets.map((bucket) => {
    running = Math.max(0, running + bucket.opened - bucket.resolved);
    return running;
  });
}

function averageBusinessHours(
  tickets: TicketRow[],
  range: (ticket: TicketRow) => [Date, Date],
  calendar: Awaited<ReturnType<typeof loadBusinessCalendar>>
): number | null {
  const values = tickets
    .map((ticket) => {
      const [from, to] = range(ticket);
      if (!from || !to) return null;
      return businessHoursBetween(from, to, calendar);
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length === 0) return null;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2));
}

function tallySla(
  tickets: TicketRow[],
  calendar: Awaited<ReturnType<typeof loadBusinessCalendar>>
) {
  const bySeverity = new Map<Severity, SlaMilestoneTally>(
    SEVERITY_ORDER.map((severity) => [
      severity,
      { severity, total: 0, met: 0, breached: 0, running: 0 },
    ])
  );
  const totals = { met: 0, breached: 0, applicable: 0 };

  for (const ticket of tickets) {
    if (!ticket.severity) continue;
    const line = bySeverity.get(ticket.severity)!;
    line.total += 1;

    const assessment = assessSla(ticket, calendar);
    for (const milestone of assessment.milestones) {
      if (milestone.state === "NAO_APLICAVEL") continue;
      totals.applicable += 1;
      if (milestone.state === "CUMPRIDO") {
        line.met += 1;
        totals.met += 1;
      } else if (milestone.state === "ESTOURADO") {
        line.breached += 1;
        totals.breached += 1;
      } else {
        line.running += 1;
      }
    }
  }

  return {
    totals,
    bySeverity: SEVERITY_ORDER.map((severity) => bySeverity.get(severity)!).filter(
      (line) => line.total > 0
    ),
  };
}

/** Um marco entra na lista de risco a partir de 75% do prazo consumido. */
const RISK_THRESHOLD = 0.25;

function buildSlaRisk(
  tickets: TicketRow[],
  calendar: Awaited<ReturnType<typeof loadBusinessCalendar>>,
  now: Date
): SlaRiskItem[] {
  const items: SlaRiskItem[] = [];

  for (const ticket of tickets) {
    if (!ticket.severity) continue;
    const assessment = assessSla(ticket, calendar, now);

    for (const milestone of assessment.milestones) {
      if (milestone.targetHours === null || milestone.metAt) continue;
      if (milestone.state !== "EM_CURSO" && milestone.state !== "ESTOURADO") continue;

      const remaining = milestone.remainingHours ?? 0;
      const breached = milestone.state === "ESTOURADO";
      if (!breached && remaining > milestone.targetHours * RISK_THRESHOLD) continue;

      items.push({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        severity: ticket.severity,
        categoryCode: ticket.categoryCode,
        requesterName: ticket.requester?.name ?? "—",
        assigneeName: ticket.assignee?.name ?? null,
        milestone: milestone.key,
        milestoneLabel: milestone.label,
        remainingHours: remaining,
        targetHours: milestone.targetHours,
        dueAt: milestone.dueAt,
        breached,
        openedAt: ticket.openedAt,
      });
      // Um chamado entra uma vez, pelo marco mais apertado.
      break;
    }
  }

  return items.sort((a, b) => a.remainingHours - b.remainingHours);
}

function buildAging(tickets: TicketRow[], now: Date) {
  const rows = [
    ...SEVERITY_ORDER.map((severity) => ({ key: severity, label: severity })),
    { key: "SEM_SEVERIDADE", label: "Sem sev." },
  ];

  const values = rows.map(() => AGING_BUCKETS.map(() => 0));

  for (const ticket of tickets) {
    const rowIndex = ticket.severity
      ? SEVERITY_ORDER.indexOf(ticket.severity)
      : rows.length - 1;
    const ageDays = (now.getTime() - ticket.openedAt.getTime()) / MS_PER_DAY;
    const columnIndex = AGING_BUCKETS.findIndex(
      (bucket) => bucket.maxDays === null || ageDays < bucket.maxDays
    );
    if (rowIndex >= 0 && columnIndex >= 0) values[rowIndex][columnIndex] += 1;
  }

  return { rows, values };
}
