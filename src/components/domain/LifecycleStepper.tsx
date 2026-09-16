import { Check, PauseCircle, XCircle } from "lucide-react";
import type { TicketStatus } from "@prisma/client";
import { cn } from "@/lib/ui";

const STEPS: Array<{ status: TicketStatus; label: string; hint: string }> = [
  { status: "ABERTO", label: "Aberto", hint: "Registrado no portal" },
  { status: "EM_TRIAGEM", label: "Triagem", hint: "Classificação na grade" },
  { status: "EM_ATENDIMENTO", label: "Atendimento", hint: "Execução técnica" },
  { status: "RESOLVIDO", label: "Resolvido", hint: "Aguardando validação" },
  { status: "FECHADO", label: "Fechado", hint: "Validado e encerrado" },
];

/**
 * O ciclo de vida como trilho. Pendente e cancelado não são etapas do fluxo
 * feliz: aparecem como desvio sobre a etapa em que o chamado parou.
 */
export function LifecycleStepper({ status }: { status: TicketStatus }) {
  // Pendente é uma pausa dentro do atendimento.
  const anchor: TicketStatus = status === "PENDENTE" ? "EM_ATENDIMENTO" : status;
  const currentIndex =
    status === "CANCELADO" ? -1 : STEPS.findIndex((step) => step.status === anchor);

  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Ciclo de vida do chamado">
        {STEPS.map((step, index) => {
          const done = currentIndex > index || (status === "FECHADO" && index === currentIndex);
          const current = index === currentIndex && status !== "FECHADO";

          return (
            <li key={step.status} className="min-w-0" aria-current={current ? "step" : undefined}>
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done ? "bg-brand" : current ? "bg-brand/55" : "bg-surface-3"
                )}
              />
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                    done
                      ? "bg-brand text-on-brand"
                      : current
                        ? "border-2 border-brand bg-surface"
                        : "border border-line-strong bg-surface"
                  )}
                  aria-hidden
                >
                  {done && <Check size={10} strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "truncate text-xs",
                    current ? "font-semibold text-ink" : done ? "font-medium text-ink-2" : "text-ink-3"
                  )}
                >
                  {step.label}
                </span>
              </div>
              <p className="mt-0.5 hidden truncate pl-5.5 text-[11px] text-ink-3 sm:block">
                {step.hint}
              </p>
            </li>
          );
        })}
      </ol>

      {status === "PENDENTE" && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-warning-ink">
          <PauseCircle size={13} />
          Pausado: aguardando retorno do solicitante
        </p>
      )}
      {status === "CANCELADO" && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-critical-ink">
          <XCircle size={13} />
          Chamado cancelado — fora do fluxo de atendimento
        </p>
      )}
    </div>
  );
}
