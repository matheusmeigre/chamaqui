import { AlertTriangle, CheckCircle2, Clock, MinusCircle, Store } from "lucide-react";
import { FormattedDate } from "@/components/FormattedDate";
import type { MilestoneStatus, SlaAssessment } from "@/server/services/sla-service";

/** Horas úteis em formato curto: 2 h, 2h30, 18 h. */
export function formatBusinessHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  const whole = Math.floor(rounded);
  const minutes = Math.round((rounded - whole) * 60);
  if (minutes === 0) return `${whole} h`;
  return `${whole}h${String(minutes).padStart(2, "0")}`;
}

const STATE_STYLES: Record<MilestoneStatus["state"], string> = {
  CUMPRIDO: "bg-green-50 border-green-200 text-green-800",
  ESTOURADO: "bg-red-50 border-red-200 text-red-800",
  EM_CURSO: "bg-amber-50 border-amber-200 text-amber-800",
  NAO_APLICAVEL: "bg-slate-50 border-slate-200 text-slate-500",
};

const STATE_LABELS: Record<MilestoneStatus["state"], string> = {
  CUMPRIDO: "Cumprido",
  ESTOURADO: "Estourado",
  EM_CURSO: "Em curso",
  NAO_APLICAVEL: "Não se aplica",
};

function StateIcon({ state }: { state: MilestoneStatus["state"] }) {
  if (state === "CUMPRIDO") return <CheckCircle2 size={16} className="shrink-0" />;
  if (state === "ESTOURADO") return <AlertTriangle size={16} className="shrink-0" />;
  if (state === "EM_CURSO") return <Clock size={16} className="shrink-0" />;
  return <MinusCircle size={16} className="shrink-0" />;
}

export function SlaPanel({ assessment }: { assessment: SlaAssessment }) {
  if (!assessment.applicable) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">SLA</h3>
        <p className="text-sm text-slate-500">
          SLA por severidade aplica-se somente a chamados de C1 (incidente / correção).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold text-gray-800">
          SLA — Severidade {assessment.severity}
        </h3>
        <span className="text-xs text-slate-400">horas úteis (9h–18h)</span>
      </div>

      <ul className="space-y-3">
        {assessment.milestones.map((milestone) => (
          <li
            key={milestone.key}
            className={`rounded-lg border p-3 text-sm ${STATE_STYLES[milestone.state]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                <StateIcon state={milestone.state} />
                {milestone.label}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {STATE_LABELS[milestone.state]}
              </span>
            </div>

            {milestone.targetHours !== null && (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="opacity-70">Prazo</dt>
                  <dd className="font-medium">{formatBusinessHours(milestone.targetHours)}</dd>
                </div>
                <div>
                  <dt className="opacity-70">Decorrido</dt>
                  <dd className="font-medium">{formatBusinessHours(milestone.elapsedHours)}</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="opacity-70">{milestone.metAt ? "Cumprido em" : "Vence em"}</dt>
                  <dd className="font-medium">
                    {milestone.metAt ? (
                      <FormattedDate date={milestone.metAt} pattern="dd/MM/yyyy HH:mm" />
                    ) : milestone.dueAt ? (
                      <FormattedDate date={milestone.dueAt} pattern="dd/MM/yyyy HH:mm" />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            )}

            {milestone.key === "definitiveFix" && milestone.targetHours === null && (
              <p className="mt-1 text-xs">
                Severidade P4: a correção sai na próxima release.
              </p>
            )}
          </li>
        ))}
      </ul>

      {assessment.storeWindowHours > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p className="flex items-center gap-2 font-medium">
            <Store size={14} className="shrink-0" />
            Janela da Google Play descontada:{" "}
            {formatBusinessHours(assessment.storeWindowHours)}
            {assessment.storeWindowOpen && " (em revisão)"}
          </p>
          <p className="mt-1 text-blue-700">
            O tempo de revisão da loja não é controlável pelo fornecedor e fica fora do prazo de
            correção definitiva. O compromisso controlável é o contorno.
          </p>
        </div>
      )}
    </div>
  );
}
