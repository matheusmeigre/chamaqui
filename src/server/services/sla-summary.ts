// ----------------------------------------------------------------------------
// Resumo de SLA para listas
//
// Uma linha de tabela não comporta os três marcos. Ela mostra o marco que
// importa agora: o próximo pendente, ou o já estourado, ou "cumprido".
// ----------------------------------------------------------------------------

import type { SlaAssessment } from "./sla-service";

export type SlaSummary =
  | { state: "NA" }
  | { state: "MET" }
  | { state: "BREACHED"; label: string; overHours: number }
  | { state: "RISK" | "RUNNING"; label: string; remainingHours: number; ratio: number };

/** Fração do prazo a partir da qual o marco é tratado como em risco. */
export const SLA_RISK_RATIO = 0.75;

export function summarizeSla(assessment: SlaAssessment): SlaSummary {
  if (!assessment.applicable) return { state: "NA" };

  const pending = assessment.milestones.filter(
    (milestone) => milestone.targetHours !== null && !milestone.metAt
  );

  const breached = pending.find((milestone) => milestone.state === "ESTOURADO");
  if (breached) {
    return {
      state: "BREACHED",
      label: breached.label,
      overHours: Math.abs(breached.remainingHours ?? 0),
    };
  }

  const running = pending.find((milestone) => milestone.state === "EM_CURSO");
  if (running && running.targetHours) {
    const ratio = running.elapsedHours / running.targetHours;
    return {
      state: ratio >= SLA_RISK_RATIO ? "RISK" : "RUNNING",
      label: running.label,
      remainingHours: running.remainingHours ?? 0,
      ratio,
    };
  }

  const anyBreachedHistorically = assessment.milestones.some((m) => m.state === "ESTOURADO");
  if (anyBreachedHistorically) {
    const first = assessment.milestones.find((m) => m.state === "ESTOURADO")!;
    return { state: "BREACHED", label: first.label, overHours: Math.abs(first.remainingHours ?? 0) };
  }

  return { state: "MET" };
}
