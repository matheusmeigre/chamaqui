// ----------------------------------------------------------------------------
// SLA por severidade (aplicável somente a C1)
//
// Regra do prazo de loja: quando a correção definitiva exige publicação de nova
// versão, o tempo de revisão da Google Play fica fora do SLA — não é
// controlável pelo fornecedor. O compromisso controlável é o contorno.
// Correção resolvida inteiramente no servidor não depende de release.
// ----------------------------------------------------------------------------

import type { CorrectionClass, Severity } from "@prisma/client";
import { SEVERITY_DEFINITIONS } from "@/server/domain/ticket-grid";
import {
  addBusinessHours,
  businessHoursBetween,
  EMPTY_CALENDAR,
  type BusinessCalendar,
} from "./business-hours";

/** Campos mínimos de um chamado para o cálculo de SLA. */
export type SlaTicketInput = {
  severity: Severity | null;
  openedAt: Date;
  firstResponseAt: Date | null;
  workaroundAt: Date | null;
  definitiveFixAt: Date | null;
  correctionClass: CorrectionClass | null;
  sentToStoreAt: Date | null;
  storeApprovedAt: Date | null;
};

export type MilestoneKey = "firstResponse" | "workaround" | "definitiveFix";

export type MilestoneStatus = {
  key: MilestoneKey;
  label: string;
  /** Prazo contratado em horas úteis. null = não se aplica a esta severidade. */
  targetHours: number | null;
  /** Prazo final já ajustado pela janela de loja, quando aplicável. */
  dueAt: Date | null;
  /** Instante em que o marco foi cumprido, se já foi. */
  metAt: Date | null;
  /** Horas úteis decorridas, já descontada a janela de loja quando aplicável. */
  elapsedHours: number;
  /** Horas úteis decorridas sem o desconto — o número bruto, para o relatório. */
  elapsedHoursRaw: number;
  /** Aplicável, cumprido no prazo, estourado ou ainda em curso. */
  state: "NAO_APLICAVEL" | "CUMPRIDO" | "ESTOURADO" | "EM_CURSO";
  /** Horas úteis restantes quando em curso; negativo quando estourado. */
  remainingHours: number | null;
};

export type SlaAssessment = {
  applicable: boolean;
  severity: Severity | null;
  /** Horas úteis que a revisão da loja consumiu (0 quando não se aplica). */
  storeWindowHours: number;
  storeWindowOpen: boolean;
  milestones: MilestoneStatus[];
};

const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  firstResponse: "1ª resposta",
  workaround: "Contorno",
  definitiveFix: "Correção definitiva",
};

/**
 * Horas úteis consumidas pela revisão da Google Play. Conta somente quando a
 * correção é de cliente (exige publicação). Enquanto a aprovação não chega, o
 * relógio da janela corre até agora — o prazo do fornecedor fica congelado.
 */
export function storeWindowBusinessHours(
  ticket: SlaTicketInput,
  calendar: BusinessCalendar = EMPTY_CALENDAR,
  now: Date = new Date(),
): number {
  if (ticket.correctionClass !== "CLIENTE") return 0;
  if (!ticket.sentToStoreAt) return 0;

  const end = ticket.storeApprovedAt ?? now;
  return businessHoursBetween(ticket.sentToStoreAt, end, calendar);
}

function buildMilestone(
  key: MilestoneKey,
  targetHours: number | null,
  metAt: Date | null,
  ticket: SlaTicketInput,
  calendar: BusinessCalendar,
  now: Date,
  discountHours: number,
): MilestoneStatus {
  const reference = metAt ?? now;
  const elapsedHoursRaw = businessHoursBetween(ticket.openedAt, reference, calendar);
  const elapsedHours = Math.max(0, Number((elapsedHoursRaw - discountHours).toFixed(4)));

  if (targetHours === null) {
    return {
      key,
      label: MILESTONE_LABELS[key],
      targetHours: null,
      dueAt: null,
      metAt,
      elapsedHours,
      elapsedHoursRaw,
      state: "NAO_APLICAVEL",
      remainingHours: null,
    };
  }

  // O prazo é empurrado pelo tempo que a loja consumiu, e não pelo contrário:
  // o compromisso do fornecedor permanece o mesmo em horas de trabalho.
  const dueAt = addBusinessHours(ticket.openedAt, targetHours + discountHours, calendar);
  const remainingHours = Number((targetHours - elapsedHours).toFixed(4));

  let state: MilestoneStatus["state"];
  if (metAt) {
    state = elapsedHours <= targetHours ? "CUMPRIDO" : "ESTOURADO";
  } else {
    state = elapsedHours > targetHours ? "ESTOURADO" : "EM_CURSO";
  }

  return {
    key,
    label: MILESTONE_LABELS[key],
    targetHours,
    dueAt,
    metAt,
    elapsedHours,
    elapsedHoursRaw,
    state,
    remainingHours,
  };
}

/**
 * Avalia os três marcos de SLA de um chamado C1. Chamados de outras categorias
 * não têm severidade e, portanto, não têm SLA de severidade.
 */
export function assessSla(
  ticket: SlaTicketInput,
  calendar: BusinessCalendar = EMPTY_CALENDAR,
  now: Date = new Date(),
): SlaAssessment {
  if (!ticket.severity) {
    return {
      applicable: false,
      severity: null,
      storeWindowHours: 0,
      storeWindowOpen: false,
      milestones: [],
    };
  }

  const definition = SEVERITY_DEFINITIONS[ticket.severity];
  const storeWindowHours = storeWindowBusinessHours(ticket, calendar, now);
  const storeWindowOpen = Boolean(ticket.sentToStoreAt && !ticket.storeApprovedAt);

  return {
    applicable: true,
    severity: ticket.severity,
    storeWindowHours,
    storeWindowOpen,
    milestones: [
      // A janela de loja só desconta o prazo da correção definitiva: a 1ª
      // resposta e o contorno acontecem antes de qualquer publicação.
      buildMilestone(
        "firstResponse",
        definition.firstResponseHours,
        ticket.firstResponseAt,
        ticket,
        calendar,
        now,
        0,
      ),
      buildMilestone(
        "workaround",
        definition.workaroundHours,
        ticket.workaroundAt,
        ticket,
        calendar,
        now,
        0,
      ),
      buildMilestone(
        "definitiveFix",
        definition.definitiveFixHours,
        ticket.definitiveFixAt,
        ticket,
        calendar,
        now,
        storeWindowHours,
      ),
    ],
  };
}

/** Resumo booleano por marco, para o relatório mensal. */
export function summarizeCompliance(assessment: SlaAssessment) {
  const met = assessment.milestones.filter((m) => m.state === "CUMPRIDO").length;
  const breached = assessment.milestones.filter((m) => m.state === "ESTOURADO").length;
  const applicable = assessment.milestones.filter((m) => m.state !== "NAO_APLICAVEL").length;

  return { met, breached, applicable };
}
