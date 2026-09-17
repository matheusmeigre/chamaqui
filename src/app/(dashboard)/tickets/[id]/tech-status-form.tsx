"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, CheckCircle, Loader2, Wrench } from "lucide-react";
import type { TicketStatus } from "@prisma/client";
import { updateTicketStatus } from "@/app/actions/tickets";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { STATUS_DOT, STATUS_LABEL, STATUS_ORDER } from "@/components/domain/labels";
import { cn } from "@/lib/ui";

const STATUS_HINT: Partial<Record<TicketStatus, string>> = {
  EM_TRIAGEM: "Classificar e dimensionar",
  EM_ATENDIMENTO: "Assume o chamado para você",
  PENDENTE: "Aguardando retorno do solicitante",
  RESOLVIDO: "Pede a validação do solicitante",
  FECHADO: "Encerra sem validação",
  CANCELADO: "Descarta o chamado",
};

const TRIAGE_DONE_HINT = "Triagem já concluída";

interface Props {
  ticketId: string;
  currentStatus: TicketStatus;
  /** Triagem é etapa única: concluída, deixa de ser um destino possível. */
  triageCompleted: boolean;
}

export function TechStatusForm({ ticketId, currentStatus, triageCompleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>(currentStatus);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Sincroniza quando o servidor revalida e devolve o novo status.
  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        await updateTicketStatus(ticketId, selectedStatus);
        setFeedback({
          type: "success",
          message: `Status alterado para “${STATUS_LABEL[selectedStatus]}”.`,
        });
        setTimeout(() => setFeedback(null), 5000);
      } catch {
        setFeedback({ type: "error", message: "Erro ao alterar status. Tente novamente." });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        icon={<Wrench size={16} />}
        title="Mover no fluxo"
        subtitle="Alterar o status assume o chamado para você"
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div role="radiogroup" aria-label="Novo status" className="grid grid-cols-1 gap-1.5">
            {STATUS_ORDER.map((status) => {
              const active = selectedStatus === status;
              const current = currentStatus === status;
              // A mesma regra que o servidor aplica: sem oferecer uma transição
              // que já se sabe recusada.
              const blocked = status === "EM_TRIAGEM" && triageCompleted;
              return (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={isPending || blocked}
                  onClick={() => setSelectedStatus(status)}
                  title={blocked ? TRIAGE_DONE_HINT : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition disabled:opacity-60",
                    blocked && "cursor-not-allowed",
                    active
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_DOT[status] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", active ? "font-semibold text-ink" : "text-ink-2")}>
                      {STATUS_LABEL[status]}
                    </span>
                    {(blocked || STATUS_HINT[status]) && (
                      <span className="block truncate text-[11px] text-ink-3">
                        {blocked ? TRIAGE_DONE_HINT : STATUS_HINT[status]}
                      </span>
                    )}
                  </span>
                  {current && (
                    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                      Atual
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              role="status"
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium",
                feedback.type === "success"
                  ? "bg-good-soft text-good-ink"
                  : "bg-critical-soft text-critical-ink"
              )}
            >
              {feedback.type === "success" ? (
                <CheckCircle size={15} className="shrink-0" />
              ) : (
                <AlertCircle size={15} className="shrink-0" />
              )}
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || selectedStatus === currentStatus}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Aplicando…
              </>
            ) : selectedStatus === currentStatus ? (
              "Selecione um novo status"
            ) : (
              `Mover para ${STATUS_LABEL[selectedStatus]}`
            )}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
