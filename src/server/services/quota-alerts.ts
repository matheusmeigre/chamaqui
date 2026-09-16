// ----------------------------------------------------------------------------
// Automações e alertas da grade (documento de contexto, seção 12.4)
//
//   80% do teto  → notifica gestor e cliente
//   100% do teto → bloqueia início de execução até a escolha do cliente
//   2 P1 simultâneos        → alerta de rajada ao gestor
//   3º P1 na mesma semana   → alerta crítico e zeramento de C2/C3/C4 no mês
//   Contestação de categoria → expira sozinha em 5 dias úteis
// ----------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import type { TicketCategoryCode } from "@prisma/client";
import {
  BURST_ZEROED_CATEGORIES,
  CATEGORY_DEFINITIONS,
  P1_BURST_ALERT_THRESHOLD,
  P1_BURST_CRITICAL_THRESHOLD,
  QUOTA_WARNING_THRESHOLD,
} from "@/server/domain/ticket-grid";
import { getQuotaSnapshot } from "./quota-service";
import { competencyOf } from "./ticket-classification";

const MS_PER_DAY = 86_400_000;

/** Status que caracterizam um P1 ainda em curso, para a contagem de rajada. */
const ACTIVE_STATUSES = ["ABERTO", "EM_TRIAGEM", "EM_ATENDIMENTO", "PENDENTE"] as const;

// ----------------------------------------------------------------------------
// Destinatários
// ----------------------------------------------------------------------------

async function notifyMany(
  userIds: string[],
  payload: { title: string; message: string; link?: string },
) {
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
    })),
  });
}

/** Gestores do fornecedor: todos os administradores. */
async function getManagerIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMINISTRADOR" },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** Interlocutores do cliente: usuários da organização contratante. */
async function getClientIds(organizationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ----------------------------------------------------------------------------
// Alertas de teto (80% e 100%)
// ----------------------------------------------------------------------------

export type QuotaAlertResult = {
  categoryCode: TicketCategoryCode;
  threshold: 80 | 100;
};

/**
 * Avalia os tetos da competência e emite os avisos de 80% e 100% que ainda não
 * foram emitidos. A tabela QuotaAlert garante a idempotência: reavaliar a
 * mesma competência não gera notificação repetida.
 */
export async function evaluateQuotaAlerts(
  organizationId: string,
  competency: string = competencyOf(new Date()),
): Promise<QuotaAlertResult[]> {
  const contract = await prisma.supportContract.findFirst({
    where: { organizationId, active: true },
    select: { id: true },
  });
  if (!contract) return [];

  const snapshot = await getQuotaSnapshot(organizationId, competency);
  const emitted: QuotaAlertResult[] = [];

  // Os destinatários não mudam entre limiares: resolve uma vez só.
  let recipients: string[] | null = null;
  const resolveRecipients = async () => {
    if (!recipients) {
      const [managers, clients] = await Promise.all([
        getManagerIds(),
        getClientIds(organizationId),
      ]);
      recipients = [...new Set([...managers, ...clients])];
    }
    return recipients;
  };

  for (const line of snapshot.lines) {
    if (line.limit === null || line.limit <= 0 || line.ratio === null) continue;

    const thresholds: Array<80 | 100> = [];
    if (line.ratio >= QUOTA_WARNING_THRESHOLD) thresholds.push(80);
    if (line.ratio >= 1) thresholds.push(100);

    for (const threshold of thresholds) {
      // createMany + skipDuplicates apoia-se na unique (contrato, competência,
      // categoria, limiar) para não notificar duas vezes o mesmo limiar.
      const created = await prisma.quotaAlert.createMany({
        data: [
          {
            contractId: contract.id,
            competency,
            categoryCode: line.categoryCode,
            threshold,
          },
        ],
        skipDuplicates: true,
      });

      if (created.count === 0) continue;

      const definition = CATEGORY_DEFINITIONS[line.categoryCode];
      const isCeiling = threshold === 100;

      await notifyMany(await resolveRecipients(), {
        title: isCeiling
          ? `Teto atingido: ${line.categoryCode} — ${definition.label}`
          : `Consumo em 80%: ${line.categoryCode} — ${definition.label}`,
        message: isCeiling
          ? `O teto de ${line.limit} ${definition.unitLabel.many} da competência ${competency} foi atingido ` +
            `(${line.consumedUnits} consumidos). Novos chamados desta categoria ficam com a execução bloqueada ` +
            "até a escolha entre excedente à tabela de hora avulsa ou fila do mês seguinte."
          : `Já foram consumidos ${line.consumedUnits} de ${line.limit} ${definition.unitLabel.many} ` +
            `do teto da competência ${competency}.`,
        link: "/reports/consumption",
      });

      emitted.push({ categoryCode: line.categoryCode, threshold });
    }
  }

  return emitted;
}

// ----------------------------------------------------------------------------
// Rajada de P1 (seção 10)
// ----------------------------------------------------------------------------

export type BurstEvaluation = {
  activeP1: number;
  p1ThisWeek: number;
  level: "NORMAL" | "ALERTA" | "CRITICO";
  zeroedCategories: TicketCategoryCode[];
};

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  // Semana começando na segunda-feira.
  const diff = (day + 6) % 7;
  const start = new Date(date.getTime() - diff * MS_PER_DAY);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
}

/**
 * Avalia a rajada de P1: dois simultâneos comprometem o mês planejado; um
 * terceiro na mesma semana zera os tetos de C2/C3/C4 e é comunicado ao cliente
 * no mesmo dia.
 */
export async function evaluateP1Burst(
  organizationId: string,
  now: Date = new Date(),
): Promise<BurstEvaluation> {
  const weekStart = startOfWeek(now);
  const competency = competencyOf(now);

  const [activeP1, p1ThisWeek] = await Promise.all([
    prisma.ticket.count({
      where: {
        categoryCode: "C1",
        severity: "P1",
        status: { in: [...ACTIVE_STATUSES] },
        requester: { organizationId },
      },
    }),
    prisma.ticket.count({
      where: {
        categoryCode: "C1",
        severity: "P1",
        openedAt: { gte: weekStart },
        requester: { organizationId },
      },
    }),
  ]);

  let level: BurstEvaluation["level"] = "NORMAL";
  const zeroedCategories: TicketCategoryCode[] = [];

  if (p1ThisWeek >= P1_BURST_CRITICAL_THRESHOLD) {
    level = "CRITICO";
  } else if (
    activeP1 >= P1_BURST_ALERT_THRESHOLD ||
    p1ThisWeek >= P1_BURST_ALERT_THRESHOLD
  ) {
    level = "ALERTA";
  }

  if (level === "ALERTA") {
    await notifyMany(await getManagerIds(), {
      title: "Alerta de rajada: 2 P1 em curso",
      message:
        `Há ${activeP1} incidente(s) P1 em atendimento e ${p1ThisWeek} aberto(s) nesta semana. ` +
        "Dois em rajada comprometem o mês planejado — reveja a escala de sobreaviso.",
      link: "/reports/consumption",
    });
  }

  if (level === "CRITICO") {
    const contract = await prisma.supportContract.findFirst({
      where: { organizationId, active: true },
      select: { id: true, tier: true },
    });

    if (contract) {
      const snapshot = await getQuotaSnapshot(organizationId, competency);

      for (const code of BURST_ZEROED_CATEGORIES) {
        const line = snapshot.lines.find((l) => l.categoryCode === code);
        if (!line || line.limit === null || line.limit <= 0) continue;

        // Zeramento idempotente: o ajuste anula exatamente o teto restante, e
        // reavaliar a mesma competência não empilha novos ajustes.
        const already = await prisma.quotaAdjustment.findFirst({
          where: {
            contractId: contract.id,
            competency,
            categoryCode: code,
            type: "ZERAMENTO_RAJADA",
          },
          select: { id: true },
        });
        if (already) continue;

        await prisma.quotaAdjustment.create({
          data: {
            contractId: contract.id,
            competency,
            categoryCode: code,
            type: "ZERAMENTO_RAJADA",
            amount: -line.limit,
            reason: `Terceiro P1 aberto na semana de ${weekStart.toISOString().slice(0, 10)}.`,
          },
        });
        zeroedCategories.push(code);
      }
    }

    const recipients = [
      ...(await getManagerIds()),
      ...(await getClientIds(organizationId)),
    ];

    await notifyMany([...new Set(recipients)], {
      title: "Alerta crítico: 3º P1 na mesma semana",
      message:
        `Foram abertos ${p1ThisWeek} incidentes P1 nesta semana. Três P1 simultâneos não são atendidos ` +
        "com qualidade — não resta quem valide e publique. Os tetos de C2, C3 e C4 da competência " +
        `${competency} foram zerados e a causa raiz será apurada em conjunto.`,
      link: "/reports/consumption",
    });
  }

  return { activeP1, p1ThisWeek, level, zeroedCategories };
}

// ----------------------------------------------------------------------------
// Expiração de contestação de categoria (seção 9)
// ----------------------------------------------------------------------------

/**
 * Sem manifestação no prazo de 5 dias úteis, a categoria atribuída é mantida.
 * Executado sob demanda ao abrir as telas que dependem da classificação.
 */
export async function expireOverdueContestations(now: Date = new Date()): Promise<number> {
  const result = await prisma.ticket.updateMany({
    where: {
      contestationOpenedAt: { not: null },
      contestationDecision: null,
      contestationDeadline: { lt: now },
    },
    data: {
      contestationDecision: "EXPIRADA",
      contestationDecidedAt: now,
    },
  });

  return result.count;
}
