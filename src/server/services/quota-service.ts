// ----------------------------------------------------------------------------
// Tetos por categoria e competência
//
// O teto se aplica ao eixo de natureza e é contado na unidade de cada
// categoria: itens em C2, atendimentos em C3, eventos em C6, chamados em C4.
// C1 é garantia (sem teto, com reserva de capacidade) e C5 está fora do
// contrato. Ver documento de contexto, seções 4, 6 e 8.
// ----------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import type { Prisma, TicketCategoryCode } from "@prisma/client";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  QUOTA_ADVANCE_MAX_RATIO,
  QUOTA_WARNING_THRESHOLD,
  TIER_DEFINITIONS,
  type CategoryDefinition,
} from "@/server/domain/ticket-grid";
import { competencyOf, shiftCompetency } from "./ticket-classification";

export type QuotaState = "SEM_TETO" | "FORA_DO_CONTRATO" | "OK" | "ALERTA" | "ESTOURADO";

export type CategoryQuotaLine = {
  categoryCode: TicketCategoryCode;
  definition: CategoryDefinition;
  /** Teto efetivo da competência: faixa + override do contrato + ajustes. */
  limit: number | null;
  /** Teto antes dos ajustes pontuais da competência. */
  baseLimit: number | null;
  /** Soma dos ajustes (antecipação, zeramento por rajada, manual). */
  adjustments: number;
  consumedUnits: number;
  consumedHours: number;
  /** Fração consumida do teto (0..n). null quando não há teto. */
  ratio: number | null;
  remaining: number | null;
  state: QuotaState;
};

export type QuotaSnapshot = {
  competency: string;
  organizationId: string;
  tier: (typeof TIER_DEFINITIONS)[keyof typeof TIER_DEFINITIONS] | null;
  capacityHours: number | null;
  /** Reserva de C1 e a parcela destinada a P1, contra o consumo real. */
  c1ReserveHours: number | null;
  c1ConsumedHours: number;
  p1ReserveHours: number | null;
  p1ConsumedHours: number;
  totalConsumedHours: number;
  lines: CategoryQuotaLine[];
};

export type ContractWithOverrides = Prisma.SupportContractGetPayload<{
  include: { quotaOverrides: true };
}>;

// ----------------------------------------------------------------------------
// Contrato
// ----------------------------------------------------------------------------

export async function getContractForOrganization(
  organizationId: string,
): Promise<ContractWithOverrides | null> {
  return prisma.supportContract.findFirst({
    where: { organizationId, active: true },
    include: { quotaOverrides: true },
  });
}

/** Resolve a organização de um chamado a partir do solicitante. */
export async function getTicketOrganizationId(ticketId: string): Promise<string | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requester: { select: { organizationId: true } } },
  });
  return ticket?.requester.organizationId ?? null;
}

// ----------------------------------------------------------------------------
// Tetos efetivos
// ----------------------------------------------------------------------------

function baseLimitFor(
  contract: ContractWithOverrides,
  categoryCode: TicketCategoryCode,
): number | null {
  const override = contract.quotaOverrides.find((q) => q.categoryCode === categoryCode);
  if (override) return override.monthlyLimit;
  return TIER_DEFINITIONS[contract.tier].quotas[categoryCode];
}

// ----------------------------------------------------------------------------
// Consumo
// ----------------------------------------------------------------------------

type ConsumptionRow = { units: number; hours: number };

/**
 * Consumo da competência por categoria. Só entram chamados marcados como
 * consumidores de teto — improcedentes, duplicados e reaberturas na janela de
 * 15 dias ficam de fora por construção.
 */
async function getConsumption(
  organizationId: string,
  competency: string,
): Promise<Record<TicketCategoryCode, ConsumptionRow>> {
  const grouped = await prisma.ticket.groupBy({
    by: ["categoryCode"],
    where: {
      competency,
      consumesQuota: true,
      categoryCode: { not: null },
      requester: { organizationId },
    },
    _sum: { units: true, actualHours: true },
  });

  const result = {} as Record<TicketCategoryCode, ConsumptionRow>;
  for (const code of CATEGORY_ORDER) result[code] = { units: 0, hours: 0 };

  for (const row of grouped) {
    if (!row.categoryCode) continue;
    result[row.categoryCode] = {
      units: row._sum.units ?? 0,
      hours: row._sum.actualHours ?? 0,
    };
  }

  return result;
}

/** Horas efetivamente gastas em C1, incluindo o que não consome teto. */
async function getC1Hours(organizationId: string, competency: string) {
  const [all, p1] = await Promise.all([
    prisma.ticket.aggregate({
      where: { competency, categoryCode: "C1", requester: { organizationId } },
      _sum: { actualHours: true },
    }),
    prisma.ticket.aggregate({
      where: {
        competency,
        categoryCode: "C1",
        severity: "P1",
        requester: { organizationId },
      },
      _sum: { actualHours: true },
    }),
  ]);

  return {
    c1Hours: all._sum.actualHours ?? 0,
    p1Hours: p1._sum.actualHours ?? 0,
  };
}

async function getAdjustments(contractId: string, competency: string) {
  const rows = await prisma.quotaAdjustment.groupBy({
    by: ["categoryCode"],
    where: { contractId, competency },
    _sum: { amount: true },
  });

  const map = {} as Record<TicketCategoryCode, number>;
  for (const code of CATEGORY_ORDER) map[code] = 0;
  for (const row of rows) map[row.categoryCode] = row._sum.amount ?? 0;
  return map;
}

function resolveState(limit: number | null, consumed: number, definition: CategoryDefinition): QuotaState {
  if (!definition.inContract) return "FORA_DO_CONTRATO";
  if (limit === null) return "SEM_TETO";
  // Teto zerado (por rajada de P1 ou ajuste manual) não deixa folga alguma:
  // conta como estourado mesmo sem consumo, para que a execução passe pela
  // consulta ao cliente em vez de correr como se houvesse saldo.
  if (limit <= 0) return "ESTOURADO";
  const ratio = consumed / limit;
  if (ratio >= 1) return "ESTOURADO";
  if (ratio >= QUOTA_WARNING_THRESHOLD) return "ALERTA";
  return "OK";
}

/**
 * Retrato completo do consumo de uma organização em uma competência. É a base
 * do painel de consumo, dos alertas e do relatório mensal.
 */
export async function getQuotaSnapshot(
  organizationId: string,
  competency: string = competencyOf(new Date()),
): Promise<QuotaSnapshot> {
  const contract = await getContractForOrganization(organizationId);
  const consumption = await getConsumption(organizationId, competency);
  const { c1Hours, p1Hours } = await getC1Hours(organizationId, competency);
  const adjustments = contract
    ? await getAdjustments(contract.id, competency)
    : (Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<TicketCategoryCode, number>);

  const tier = contract ? TIER_DEFINITIONS[contract.tier] : null;

  const lines: CategoryQuotaLine[] = CATEGORY_ORDER.map((code) => {
    const definition = CATEGORY_DEFINITIONS[code];
    const baseLimit = contract ? baseLimitFor(contract, code) : null;
    const adjustment = adjustments[code] ?? 0;
    const limit = baseLimit === null ? null : Math.max(0, baseLimit + adjustment);
    const consumedUnits = consumption[code].units;

    return {
      categoryCode: code,
      definition,
      limit,
      baseLimit,
      adjustments: adjustment,
      consumedUnits,
      consumedHours: consumption[code].hours,
      ratio: limit === null || limit === 0 ? null : consumedUnits / limit,
      remaining: limit === null ? null : limit - consumedUnits,
      state: resolveState(limit, consumedUnits, definition),
    };
  });

  const totalConsumedHours = Number(
    lines.reduce((acc, line) => acc + line.consumedHours, 0).toFixed(2),
  );

  return {
    competency,
    organizationId,
    tier,
    capacityHours: contract?.capacityHours ?? null,
    c1ReserveHours: tier?.c1ReserveHours ?? null,
    c1ConsumedHours: Number(c1Hours.toFixed(2)),
    p1ReserveHours: tier?.p1ReserveHours ?? null,
    p1ConsumedHours: Number(p1Hours.toFixed(2)),
    totalConsumedHours,
    lines,
  };
}

// ----------------------------------------------------------------------------
// Bloqueio de execução no estouro (seção 8)
// ----------------------------------------------------------------------------

export type ExecutionGate =
  | { allowed: true }
  | {
      allowed: false;
      categoryCode: TicketCategoryCode;
      limit: number;
      consumedUnits: number;
      message: string;
    };

/**
 * No estouro do teto, a execução não começa até o cliente escolher entre
 * excedente e fila do mês seguinte. O atendimento nunca é bloqueado sem essa
 * consulta — por isso o bloqueio é liberado assim que a escolha é registrada.
 */
export async function checkExecutionGate(params: {
  organizationId: string;
  categoryCode: TicketCategoryCode | null;
  competency: string;
  overrunDecisionAlreadyTaken: boolean;
}): Promise<ExecutionGate> {
  const { categoryCode, overrunDecisionAlreadyTaken } = params;

  if (!categoryCode) return { allowed: true };
  if (overrunDecisionAlreadyTaken) return { allowed: true };

  const definition = CATEGORY_DEFINITIONS[categoryCode];
  if (!definition.hasQuota) return { allowed: true };

  const snapshot = await getQuotaSnapshot(params.organizationId, params.competency);
  const line = snapshot.lines.find((l) => l.categoryCode === categoryCode);

  if (!line || line.limit === null || line.state !== "ESTOURADO") {
    return { allowed: true };
  }

  const situation =
    line.limit === 0
      ? `o teto da competência ${params.competency} foi zerado`
      : `foram consumidos ${line.consumedUnits} de ${line.limit} ${definition.unitLabel.many} ` +
        `na competência ${params.competency}`;

  return {
    allowed: false,
    categoryCode,
    limit: line.limit,
    consumedUnits: line.consumedUnits,
    message:
      `Teto de ${categoryCode} (${definition.label}) atingido: ${situation}. ` +
      "A execução fica bloqueada até o cliente escolher entre excedente à tabela de hora avulsa " +
      "ou entrada na fila do mês seguinte.",
  };
}

// ----------------------------------------------------------------------------
// Antecipação de teto (seção 8)
// ----------------------------------------------------------------------------

/** Trimestre civil de uma competência YYYY-MM, no formato YYYY-Tn. */
function quarterOf(competency: string): string {
  const [year, month] = competency.split("-").map(Number);
  return `${year}-T${Math.floor((month - 1) / 3) + 1}`;
}

export type AdvanceResult = {
  categoryCode: TicketCategoryCode;
  amount: number;
  fromCompetency: string;
  toCompetency: string;
};

/**
 * Antecipa até 20% do teto do mês seguinte para a competência corrente, uma vez
 * por trimestre. Saldo não consumido não acumula: banco de horas destruiria a
 * previsibilidade que justifica a mensalidade, então o que entra aqui sai do
 * teto do mês seguinte.
 */
export async function requestQuotaAdvance(params: {
  organizationId: string;
  competency: string;
  categoryCode: TicketCategoryCode;
  amount: number;
  reason?: string;
  createdById?: string;
}): Promise<AdvanceResult> {
  const { organizationId, competency, categoryCode, amount } = params;

  const definition = CATEGORY_DEFINITIONS[categoryCode];
  if (!definition.hasQuota) {
    throw new Error(
      `${categoryCode} (${definition.label}) não tem teto mensal, então não há o que antecipar.`,
    );
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("A quantidade antecipada deve ser um número inteiro positivo.");
  }

  const contract = await getContractForOrganization(organizationId);
  if (!contract) throw new Error("Organização sem contrato de sustentação ativo.");

  const nextCompetency = shiftCompetency(competency, 1);
  const nextBaseLimit = baseLimitFor(contract, categoryCode);
  if (nextBaseLimit === null || nextBaseLimit <= 0) {
    throw new Error("Não há teto no mês seguinte para antecipar.");
  }

  const maxAdvance = Math.floor(nextBaseLimit * QUOTA_ADVANCE_MAX_RATIO);
  if (amount > maxAdvance) {
    throw new Error(
      `A antecipação é limitada a ${QUOTA_ADVANCE_MAX_RATIO * 100}% do teto do mês seguinte ` +
        `(máximo de ${maxAdvance} ${definition.unitLabel.many}).`,
    );
  }

  // Uma vez por trimestre: verifica as antecipações já feitas no mesmo trimestre.
  const quarter = quarterOf(competency);
  const existing = await prisma.quotaAdjustment.findMany({
    where: { contractId: contract.id, type: "ANTECIPACAO", amount: { gt: 0 } },
    select: { competency: true },
  });

  if (existing.some((row) => quarterOf(row.competency) === quarter)) {
    throw new Error(
      `Já houve uma antecipação no trimestre ${quarter}. A regra permite uma por trimestre.`,
    );
  }

  // O crédito no mês corrente e o débito no mês seguinte são uma transação só:
  // uma metade sem a outra viraria banco de horas.
  await prisma.$transaction([
    prisma.quotaAdjustment.create({
      data: {
        contractId: contract.id,
        competency,
        categoryCode,
        type: "ANTECIPACAO",
        amount,
        reason: params.reason ?? `Antecipação de ${nextCompetency}.`,
        createdById: params.createdById ?? null,
      },
    }),
    prisma.quotaAdjustment.create({
      data: {
        contractId: contract.id,
        competency: nextCompetency,
        categoryCode,
        type: "ANTECIPACAO",
        amount: -amount,
        reason: `Débito da antecipação usada em ${competency}.`,
        createdById: params.createdById ?? null,
      },
    }),
  ]);

  return { categoryCode, amount, fromCompetency: nextCompetency, toCompetency: competency };
}
