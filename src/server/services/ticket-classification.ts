// ----------------------------------------------------------------------------
// Classificação de chamados: validações e regras de contagem
//
// Sem estas regras o teto não se sustenta — doze pedidos entram como um chamado
// só e a cota vira ficção (ver documento de contexto, seção 7).
// ----------------------------------------------------------------------------

import type {
  Severity,
  TicketCategoryCode,
  TicketOutcome,
} from "@prisma/client";
import {
  C4_MAX_EFFORT_HOURS,
  CATEGORY_DEFINITIONS,
  REOPEN_WINDOW_DAYS,
} from "@/server/domain/ticket-grid";

export class ClassificationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ClassificationError";
    this.field = field;
  }
}

const MS_PER_DAY = 86_400_000;

/** Desfechos que não consomem teto (seção 7, regras 2 e 3). */
const NON_CONSUMING_OUTCOMES: TicketOutcome[] = [
  "IMPROCEDENTE_NAO_REPRODUZ",
  "IMPROCEDENTE_ERRO_USO",
  "IMPROCEDENTE_TERCEIRO",
  "DUPLICADO",
];

export function isNonConsumingOutcome(outcome: TicketOutcome | null): boolean {
  return outcome !== null && NON_CONSUMING_OUTCOMES.includes(outcome);
}

/** Competência (mês de apuração do teto) no formato YYYY-MM. */
export function competencyOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function shiftCompetency(competency: string, months: number): string {
  const [year, month] = competency.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return competencyOf(date);
}

/**
 * Unidades efetivas de consumo. Categorias contadas por chamado ou por projeto
 * valem sempre 1 — só C2 (itens), C3 (atendimentos) e C6 (eventos) admitem
 * múltiplas unidades no mesmo registro.
 */
export function normalizeUnits(
  categoryCode: TicketCategoryCode,
  requested: number | null | undefined,
): number {
  const definition = CATEGORY_DEFINITIONS[categoryCode];
  if (definition.unit === "CHAMADO" || definition.unit === "PROJETO") return 1;

  const units = Math.floor(Number(requested ?? 1));
  if (!Number.isFinite(units) || units < 1) return 1;
  return units;
}

/**
 * Severidade é preenchida se e somente se a categoria é C1.
 * Lança quando a combinação é inválida; devolve o valor normalizado quando não.
 */
export function validateSeverity(
  categoryCode: TicketCategoryCode,
  severity: Severity | null | undefined,
): Severity | null {
  const requiresSeverity = CATEGORY_DEFINITIONS[categoryCode].requiresSeverity;

  if (requiresSeverity && !severity) {
    throw new ClassificationError(
      "Chamados de C1 (incidente / correção) exigem severidade P1..P4.",
      "severity",
    );
  }

  if (!requiresSeverity && severity) {
    throw new ClassificationError(
      `Severidade é exclusiva de C1 e não se aplica a ${categoryCode} (${CATEGORY_DEFINITIONS[categoryCode].label}).`,
      "severity",
    );
  }

  return requiresSeverity ? (severity as Severity) : null;
}

/**
 * Reabertura do mesmo defeito em até 15 dias corridos é o mesmo chamado: não
 * consome teto novo. Remove o incentivo de fechar chamado cedo demais.
 */
export function isWithinReopenWindow(
  closedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!closedAt) return false;
  const elapsedDays = (now.getTime() - closedAt.getTime()) / MS_PER_DAY;
  return elapsedDays >= 0 && elapsedDays <= REOPEN_WINDOW_DAYS;
}

/**
 * Derivação de `consomeTeto`: falso para todo desfecho improcedente ou
 * duplicado, e para reaberturas dentro da janela.
 */
export function resolveConsumesQuota(params: {
  outcome?: TicketOutcome | null;
  isReopenWithinWindow?: boolean;
  categoryCode?: TicketCategoryCode | null;
}): boolean {
  if (params.isReopenWithinWindow) return false;
  if (isNonConsumingOutcome(params.outcome ?? null)) return false;
  // C1 é garantia e C5 está fora do contrato: nenhum dos dois tem teto, mas
  // continuam marcados como consumidores para aparecerem no relatório de horas.
  if (params.categoryCode === "C5") return false;
  return true;
}

export type ClosureValidationInput = {
  categoryCode: TicketCategoryCode | null;
  actualHours: number | null | undefined;
  correctionClass: string | null | undefined;
  outcome: TicketOutcome | null | undefined;
};

/**
 * Validações de fechamento (seção 12.2). Lança na primeira violação — o
 * fechamento é uma transição única e não faz sentido acumular erros parciais.
 */
export function validateClosure(input: ClosureValidationInput): void {
  if (!input.categoryCode) {
    throw new ClassificationError(
      "O chamado precisa ser classificado em uma categoria C1..C6 antes do fechamento.",
      "categoryCode",
    );
  }

  if (!input.outcome) {
    throw new ClassificationError(
      "Informe o desfecho do chamado para fechá-lo.",
      "outcome",
    );
  }

  // Fechamento de C1 exige a classe de correção: é ela que define se a janela
  // de revisão da loja sai do relógio de SLA.
  if (input.categoryCode === "C1" && input.outcome === "RESOLVIDO" && !input.correctionClass) {
    throw new ClassificationError(
      "Fechamento de C1 exige a classe de correção (servidor ou cliente).",
      "correctionClass",
    );
  }

  // A fronteira C4/C5 é um número de horas, não um adjetivo.
  if (
    input.categoryCode === "C4" &&
    typeof input.actualHours === "number" &&
    input.actualHours > C4_MAX_EFFORT_HOURS
  ) {
    throw new ClassificationError(
      `Chamado de C4 com ${input.actualHours} h de esforço ultrapassa o limite de ${C4_MAX_EFFORT_HOURS} h. ` +
        "Reclassifique como C5 e registre o aceite formal do orçamento antes de fechar.",
      "actualHours",
    );
  }
}

/** Indica se o chamado precisa ser reclassificado de C4 para C5. */
export function requiresReclassificationToC5(
  categoryCode: TicketCategoryCode | null,
  actualHours: number | null | undefined,
): boolean {
  return (
    categoryCode === "C4" &&
    typeof actualHours === "number" &&
    actualHours > C4_MAX_EFFORT_HOURS
  );
}
