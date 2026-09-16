"use server";

// ----------------------------------------------------------------------------
// Ações operacionais da Grade de Chamados
//
// Classificação, registro de esforço, janela de publicação na loja, contestação
// de categoria e decisão de excedente.
// ----------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type {
  CorrectionClass,
  OverrunDecision,
  Severity,
  TicketCategoryCode,
  TicketOutcome,
} from "@prisma/client";
import {
  CATEGORY_DEFINITIONS,
  CONTESTATION_WINDOW_BUSINESS_DAYS,
  SEVERITY_TO_PRIORITY,
} from "@/server/domain/ticket-grid";
import {
  competencyOf,
  isWithinReopenWindow,
  normalizeUnits,
  resolveConsumesQuota,
  shiftCompetency,
  validateClosure,
  validateSeverity,
} from "@/server/services/ticket-classification";
import { addBusinessDays, loadBusinessCalendar } from "@/server/services/business-hours";
import { evaluateQuotaAlerts } from "@/server/services/quota-alerts";
import { requestQuotaAdvance } from "@/server/services/quota-service";

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.role !== "ADMINISTRADOR") throw new Error("Não autorizado");
  return session;
}

async function logSystemComment(ticketId: string, authorId: string, content: string) {
  await prisma.comment.create({
    data: { ticketId, authorId, content, isSystem: true },
  });
}

function refresh(ticketId: string) {
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/reports/consumption");
}

// ----------------------------------------------------------------------------
// Classificação
// ----------------------------------------------------------------------------

/**
 * Classificação inicial ou reclassificação pela equipe técnica. A categoria e a
 * severidade ficam visíveis ao cliente, que tem 5 dias úteis para contestar.
 */
export async function reclassifyTicket(formData: FormData) {
  const session = await requireAdmin();

  const ticketId = formData.get("ticketId") as string;
  const categoryCode = formData.get("categoryCode") as TicketCategoryCode;
  const rawSeverity = (formData.get("severity") as Severity) || null;
  const rawUnits = Number(formData.get("units"));

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { categoryCode: true, severity: true, units: true, competency: true },
  });
  if (!ticket) throw new Error("Chamado não encontrado");

  const severity = validateSeverity(categoryCode, rawSeverity);
  const units = normalizeUnits(categoryCode, rawUnits);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      categoryCode,
      severity,
      units,
      ...(severity ? { priority: SEVERITY_TO_PRIORITY[severity] } : {}),
      // Uma reclassificação reabre o direito de contestar.
      contestationOpenedAt: null,
      contestationDeadline: null,
      contestationReason: null,
      contestationDecision: null,
      contestationDecidedAt: null,
    },
  });

  const before = ticket.categoryCode
    ? `${ticket.categoryCode}${ticket.severity ? `/${ticket.severity}` : ""}`
    : "sem classificação";
  const after = `${categoryCode}${severity ? `/${severity}` : ""}`;

  await logSystemComment(
    ticketId,
    session.id,
    `Classificação alterada de ${before} para ${after} (${CATEGORY_DEFINITIONS[categoryCode].label}), ${units} ${units === 1 ? CATEGORY_DEFINITIONS[categoryCode].unitLabel.one : CATEGORY_DEFINITIONS[categoryCode].unitLabel.many}.`,
  );

  refresh(ticketId);
}

/**
 * Reclassificação de C4 para C5 quando o esforço ultrapassa 8 h. Exige o
 * registro do aceite formal antes da execução: a fronteira C4/C5 é um número
 * de horas, e o que passa dela vai a orçamento.
 */
export async function reclassifyToC5(formData: FormData) {
  const session = await requireAdmin();

  const ticketId = formData.get("ticketId") as string;
  const acceptanceNote = (formData.get("acceptanceNote") as string)?.trim();

  if (!acceptanceNote) {
    throw new Error("Registre o aceite formal do orçamento para reclassificar como C5.");
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      categoryCode: "C5",
      severity: null,
      units: 1,
      outcome: "RECLASSIFICADO",
      // C5 está fora do contrato de sustentação: não consome teto mensal.
      consumesQuota: false,
    },
  });

  await logSystemComment(
    ticketId,
    session.id,
    `Chamado reclassificado para C5 (evolutivo estruturante), fora do contrato de sustentação.\nAceite formal: ${acceptanceNote}`,
  );

  refresh(ticketId);
}

// ----------------------------------------------------------------------------
// Marcos de SLA e esforço
// ----------------------------------------------------------------------------

/** Registra o contorno aplicado — o compromisso controlável em P1 e P2. */
export async function registerWorkaround(formData: FormData) {
  const session = await requireAdmin();
  const ticketId = formData.get("ticketId") as string;
  const note = (formData.get("note") as string)?.trim();

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { workaroundAt: new Date(), status: "EM_ATENDIMENTO" },
  });

  await logSystemComment(
    ticketId,
    session.id,
    `Contorno aplicado.${note ? `\n${note}` : ""}`,
  );

  refresh(ticketId);
}

/**
 * Janela de publicação na Google Play. O tempo entre o envio e a aprovação sai
 * do relógio de SLA da correção definitiva — não é controlável pelo fornecedor.
 */
export async function registerStoreWindow(formData: FormData) {
  const session = await requireAdmin();

  const ticketId = formData.get("ticketId") as string;
  const event = formData.get("event") as "ENVIO" | "APROVACAO";

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { sentToStoreAt: true },
  });
  if (!ticket) throw new Error("Chamado não encontrado");

  if (event === "ENVIO") {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        sentToStoreAt: new Date(),
        storeApprovedAt: null,
        // Enviar à loja implica que a correção é de cliente.
        correctionClass: "CLIENTE",
      },
    });
    await logSystemComment(ticketId, session.id, "Versão enviada para revisão na Google Play.");
  } else {
    if (!ticket.sentToStoreAt) {
      throw new Error("Registre primeiro o envio da versão para a loja.");
    }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { storeApprovedAt: new Date() },
    });
    await logSystemComment(ticketId, session.id, "Versão aprovada e publicada na Google Play.");
  }

  refresh(ticketId);
}

/**
 * Fechamento técnico: registra esforço, classe de correção e desfecho, com as
 * validações da grade. Chamado improcedente e duplicado não consomem teto.
 */
export async function registerTechnicalClosure(formData: FormData) {
  const session = await requireAdmin();

  const ticketId = formData.get("ticketId") as string;
  const outcome = formData.get("outcome") as TicketOutcome;
  const correctionClass = (formData.get("correctionClass") as CorrectionClass) || null;
  const rawHours = formData.get("actualHours");
  const actualHours = rawHours === null || rawHours === "" ? null : Number(rawHours);

  if (actualHours !== null && (!Number.isFinite(actualHours) || actualHours < 0)) {
    throw new Error("Esforço real inválido.");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      categoryCode: true,
      parentTicketId: true,
      competency: true,
      requester: { select: { organizationId: true } },
    },
  });
  if (!ticket) throw new Error("Chamado não encontrado");

  // Bloqueia o fechamento de C4 acima de 8 h: precisa virar C5 com aceite.
  validateClosure({
    categoryCode: ticket.categoryCode,
    actualHours,
    correctionClass,
    outcome,
  });

  const now = new Date();
  const resolved = outcome === "RESOLVIDO";

  const consumesQuota = resolveConsumesQuota({
    outcome,
    isReopenWithinWindow: ticket.parentTicketId !== null,
    categoryCode: ticket.categoryCode,
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      outcome,
      actualHours,
      correctionClass,
      consumesQuota,
      status: "RESOLVIDO",
      resolvedAt: now,
      ...(resolved ? { definitiveFixAt: now } : {}),
    },
  });

  await logSystemComment(
    ticketId,
    session.id,
    `Fechamento técnico: ${outcome.replaceAll("_", " ").toLowerCase()}.` +
      (actualHours !== null ? ` Esforço real: ${actualHours} h.` : "") +
      (correctionClass ? ` Correção: ${correctionClass.toLowerCase()}.` : "") +
      (consumesQuota ? "" : " Não consome teto."),
  );

  if (ticket.requester.organizationId) {
    try {
      await evaluateQuotaAlerts(
        ticket.requester.organizationId,
        ticket.competency ?? competencyOf(now),
      );
    } catch (error) {
      console.error("Falha ao avaliar tetos após fechamento:", error);
    }
  }

  refresh(ticketId);
}

// ----------------------------------------------------------------------------
// Contestação de categoria (5 dias úteis)
// ----------------------------------------------------------------------------

export async function openContestation(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const reason = (formData.get("reason") as string)?.trim();
  if (!reason) throw new Error("Informe o motivo da contestação.");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true, contestationOpenedAt: true, contestationDecision: true },
  });
  if (!ticket) throw new Error("Chamado não encontrado");
  if (ticket.requesterId !== session.id && session.role !== "ADMINISTRADOR") {
    throw new Error("Não autorizado");
  }
  if (ticket.contestationOpenedAt && !ticket.contestationDecision) {
    throw new Error("Já existe uma contestação em aberto para este chamado.");
  }

  const now = new Date();
  const calendar = await loadBusinessCalendar();
  const deadline = addBusinessDays(now, CONTESTATION_WINDOW_BUSINESS_DAYS, calendar);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      contestationOpenedAt: now,
      contestationDeadline: deadline,
      contestationReason: reason,
      contestationDecision: null,
      contestationDecidedAt: null,
    },
  });

  await logSystemComment(
    ticketId,
    session.id,
    `Categoria contestada pelo cliente.\nMotivo: ${reason}`,
  );

  // Divergência não resolvida sobe para a reunião mensal — o gestor precisa ver.
  const admins = await prisma.user.findMany({
    where: { role: "ADMINISTRADOR" },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: `Categoria contestada (#${ticketId.split("-")[0]})`,
        message: `O cliente contestou a classificação do chamado. Prazo de decisão: ${CONTESTATION_WINDOW_BUSINESS_DAYS} dias úteis.`,
        link: `/tickets/${ticketId}`,
      })),
    });
  }

  refresh(ticketId);
}

export async function decideContestation(formData: FormData) {
  const session = await requireAdmin();

  const ticketId = formData.get("ticketId") as string;
  const decision = formData.get("decision") as "MANTIDA" | "ALTERADA";
  const newCategory = (formData.get("newCategoryCode") as TicketCategoryCode) || null;
  const newSeverity = (formData.get("newSeverity") as Severity) || null;

  if (decision === "ALTERADA" && !newCategory) {
    throw new Error("Informe a nova categoria ao acatar a contestação.");
  }

  const severity = newCategory ? validateSeverity(newCategory, newSeverity) : undefined;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      contestationDecision: decision,
      contestationDecidedAt: new Date(),
      ...(decision === "ALTERADA" && newCategory
        ? {
            categoryCode: newCategory,
            severity: severity ?? null,
            ...(severity ? { priority: SEVERITY_TO_PRIORITY[severity] } : {}),
          }
        : {}),
    },
  });

  await logSystemComment(
    ticketId,
    session.id,
    decision === "MANTIDA"
      ? "Contestação analisada: classificação mantida."
      : `Contestação acatada: categoria alterada para ${newCategory}${severity ? `/${severity}` : ""}.`,
  );

  refresh(ticketId);
}

// ----------------------------------------------------------------------------
// Excedente (seção 8)
// ----------------------------------------------------------------------------

/**
 * No estouro, a escolha é do cliente, chamado a chamado: executar como
 * excedente à tabela de hora avulsa, ou entrar na fila do mês seguinte.
 */
export async function registerOverrunDecision(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const decision = formData.get("decision") as OverrunDecision;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true, competency: true },
  });
  if (!ticket) throw new Error("Chamado não encontrado");
  if (ticket.requesterId !== session.id && session.role !== "ADMINISTRADOR") {
    throw new Error("Não autorizado");
  }

  const now = new Date();
  const queued = decision === "FILA_PROXIMO_MES";

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      overrunDecision: decision,
      overrunDecidedAt: now,
      executionBlocked: false,
      // Entrar na fila move a apuração para a competência seguinte.
      ...(queued && ticket.competency
        ? { competency: shiftCompetency(ticket.competency, 1) }
        : {}),
    },
  });

  await logSystemComment(
    ticketId,
    session.id,
    queued
      ? "Cliente optou por aguardar a fila do mês seguinte. A competência de apuração foi deslocada."
      : "Cliente autorizou a execução como excedente à tabela de hora avulsa.",
  );

  refresh(ticketId);
}

// ----------------------------------------------------------------------------
// Reincidência
// ----------------------------------------------------------------------------

/**
 * Abre um chamado vinculado ao original. Reincidência do mesmo defeito em até
 * 15 dias corridos do fechamento não consome teto novo — evita cobrar duas
 * vezes por uma correção incompleta.
 */
export async function openLinkedReopen(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const parentId = formData.get("parentTicketId") as string;
  const description = (formData.get("description") as string)?.trim();
  if (!description) throw new Error("Descreva a reincidência.");

  const parent = await prisma.ticket.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      categoryCode: true,
      severity: true,
      priority: true,
      units: true,
      channel: true,
      requesterId: true,
      resolvedAt: true,
    },
  });
  if (!parent) throw new Error("Chamado original não encontrado");
  if (parent.requesterId !== session.id && session.role !== "ADMINISTRADOR") {
    throw new Error("Não autorizado");
  }

  const now = new Date();
  const withinWindow = isWithinReopenWindow(parent.resolvedAt, now);

  const child = await prisma.ticket.create({
    data: {
      title: `[Reincidência] ${parent.title}`,
      description,
      categoryId: parent.categoryId,
      categoryCode: parent.categoryCode,
      severity: parent.severity,
      priority: parent.priority,
      units: parent.units,
      channel: parent.channel,
      requesterId: parent.requesterId,
      status: "ABERTO",
      openedAt: now,
      competency: competencyOf(now),
      parentTicketId: parent.id,
      attachmentUrls: [],
      // Dentro da janela de 15 dias é o mesmo chamado: não consome teto novo.
      consumesQuota: !withinWindow,
    },
  });

  await logSystemComment(
    child.id,
    session.id,
    withinWindow
      ? `Reincidência aberta dentro da janela de 15 dias do chamado ${parent.id.split("-")[0].toUpperCase()}. Não consome teto novo.`
      : `Reincidência aberta fora da janela de 15 dias do chamado ${parent.id.split("-")[0].toUpperCase()}. Consome teto normalmente.`,
  );

  refresh(child.id);
  return child.id;
}

// ----------------------------------------------------------------------------
// Antecipação de teto
// ----------------------------------------------------------------------------

/**
 * Antecipa parte do teto do mês seguinte para a competência corrente. As regras
 * (limite de 20% e uma vez por trimestre) são aplicadas no serviço de tetos.
 */
export async function requestAdvance(formData: FormData) {
  const session = await requireAdmin();

  const organizationId = formData.get("organizationId") as string;
  const competency = formData.get("competency") as string;
  const categoryCode = formData.get("categoryCode") as TicketCategoryCode;
  const amount = Number(formData.get("amount"));
  const reason = ((formData.get("reason") as string) || "").trim() || undefined;

  await requestQuotaAdvance({
    organizationId,
    competency,
    categoryCode,
    amount,
    reason,
    createdById: session.id,
  });

  revalidatePath("/reports/consumption");
}
