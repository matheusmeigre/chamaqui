import { AlertOctagon, CheckCircle2, Clock, MinusCircle, ShieldCheck, Store } from "lucide-react";
import { FormattedDate } from "@/components/FormattedDate";
import { Card, CardBody, CardHeader, Meter } from "@/components/ui";
import type { MilestoneStatus, SlaAssessment } from "@/server/services/sla-service";
import { cn, formatHours } from "@/lib/ui";

/** Horas úteis em formato curto: 2 h, 2h30, 18 h. */
export const formatBusinessHours = (hours: number) => formatHours(hours);

const STATE_LABELS: Record<MilestoneStatus["state"], string> = {
  CUMPRIDO: "Cumprido",
  ESTOURADO: "Estourado",
  EM_CURSO: "Em curso",
  NAO_APLICAVEL: "Não se aplica",
};

const STATE_TEXT: Record<MilestoneStatus["state"], string> = {
  CUMPRIDO: "text-good-ink",
  ESTOURADO: "text-critical-ink",
  EM_CURSO: "text-warning-ink",
  NAO_APLICAVEL: "text-ink-3",
};

function StateIcon({ state }: { state: MilestoneStatus["state"] }) {
  if (state === "CUMPRIDO") return <CheckCircle2 size={14} className="shrink-0" />;
  if (state === "ESTOURADO") return <AlertOctagon size={14} className="shrink-0" />;
  if (state === "EM_CURSO") return <Clock size={14} className="shrink-0" />;
  return <MinusCircle size={14} className="shrink-0" />;
}

export function SlaPanel({ assessment }: { assessment: SlaAssessment }) {
  if (!assessment.applicable) {
    return (
      <Card>
        <CardHeader icon={<ShieldCheck size={16} />} title="SLA" />
        <CardBody>
          <p className="text-sm text-ink-3">
            SLA por severidade aplica-se somente a chamados de C1 (incidente / correção).
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck size={16} />}
        title={`SLA · severidade ${assessment.severity}`}
        subtitle="Horas úteis, 9h–18h"
      />
      <CardBody className="space-y-4">
        <ol className="space-y-4">
          {assessment.milestones.map((milestone) => {
            const ratio =
              milestone.targetHours && milestone.targetHours > 0
                ? milestone.elapsedHours / milestone.targetHours
                : null;
            const tone =
              milestone.state === "CUMPRIDO"
                ? "good"
                : milestone.state === "ESTOURADO"
                  ? "critical"
                  : ratio !== null && ratio >= 0.75
                    ? "warning"
                    : "brand";

            return (
              <li key={milestone.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{milestone.label}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold",
                      STATE_TEXT[milestone.state]
                    )}
                  >
                    <StateIcon state={milestone.state} />
                    {STATE_LABELS[milestone.state]}
                  </span>
                </div>

                {milestone.targetHours !== null ? (
                  <>
                    <Meter
                      ratio={ratio}
                      tone={tone}
                      ariaLabel={`Prazo consumido: ${milestone.label}`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                      <span className="tabular-nums">
                        {formatHours(milestone.elapsedHours)} de {formatHours(milestone.targetHours)}
                      </span>
                      <span>
                        {milestone.metAt ? "Cumprido em " : "Vence em "}
                        {milestone.metAt ? (
                          <FormattedDate date={milestone.metAt} pattern="dd/MM HH:mm" />
                        ) : milestone.dueAt ? (
                          <FormattedDate date={milestone.dueAt} pattern="dd/MM HH:mm" />
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-ink-3">
                    {milestone.key === "definitiveFix"
                      ? "Severidade P4: a correção sai na próxima release."
                      : "Sem compromisso para esta severidade."}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {assessment.storeWindowHours > 0 && (
          <div className="rounded-xl border border-brand/30 bg-brand-soft p-3 text-xs text-brand-ink">
            <p className="flex items-center gap-1.5 font-semibold">
              <Store size={13} className="shrink-0" />
              Janela da Google Play descontada: {formatHours(assessment.storeWindowHours)}
              {assessment.storeWindowOpen && " (em revisão)"}
            </p>
            <p className="mt-1 leading-relaxed opacity-85">
              O tempo de revisão da loja não é controlável pelo fornecedor e fica fora do prazo de
              correção definitiva. O compromisso controlável é o contorno.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
