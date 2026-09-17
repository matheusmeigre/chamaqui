// ----------------------------------------------------------------------------
// Triagem — etapa automatizada e única do fluxo
//
// A entrada em EM_TRIAGEM é o início da análise interna: o sistema comunica o
// solicitante sozinho, sem o suporte digitar nada. A atuação manual começa em
// EM_ATENDIMENTO.
//
// Sair da triagem significa que a análise, a categorização e o dimensionamento
// terminaram — por isso o chamado nunca volta para esse status. A regra olha os
// marcos de transição do chamado, não o status atual.
// ----------------------------------------------------------------------------

import type { Priority, Severity } from "@prisma/client";
import { PRIORITY_TO_SEVERITY } from "@/server/domain/ticket-grid";
import { shortId } from "@/lib/ui";

/** Quem assina as comunicações automáticas do fluxo. */
export const TRIAGE_SIGNATURE = "HDL Soluções";

export const TRIAGE_BLOCKED_MESSAGE =
  "A triagem deste chamado já foi concluída e não pode ser refeita: análise, " +
  "categorização e dimensionamento acontecem uma única vez.";

/** Marcos que a regra da triagem consulta. */
export type TriageMarks = {
  triageEnteredAt: Date | null;
  triageCompletedAt: Date | null;
};

/** A etapa terminou quando o chamado entrou na triagem e depois saiu dela. */
export function hasCompletedTriage(marks: TriageMarks): boolean {
  return marks.triageCompletedAt !== null;
}

/** Só quem ainda não concluiu a etapa pode entrar nela. */
export function canEnterTriage(marks: TriageMarks): boolean {
  return !hasCompletedTriage(marks);
}

/**
 * Nível comunicado na triagem. A severidade P1..P4 só existe em C1; fora dela a
 * prioridade declarada na abertura é traduzida para o mesmo eixo, para que o
 * solicitante leia sempre a mesma escala.
 */
export function triagePriorityLevel(ticket: {
  severity: Severity | null;
  priority: Priority;
}): Severity {
  return ticket.severity ?? PRIORITY_TO_SEVERITY[ticket.priority];
}

/**
 * Mensagem padrão publicada no histórico quando o chamado entra em triagem.
 * O identificador e o nível vêm do próprio chamado — nada é digitado.
 */
export function buildTriageMessage(ticket: {
  id: string;
  severity: Severity | null;
  priority: Priority;
}): string {
  const level = triagePriorityLevel(ticket);
  return [
    `Ticket ${shortId(ticket.id)} em estado de Análise com priorização de nível ${level}. ` +
      "Retornaremos com mais informações para prosseguir com o atendimento.",
    "Atenciosamente,",
    TRIAGE_SIGNATURE,
  ].join("\n\n");
}
