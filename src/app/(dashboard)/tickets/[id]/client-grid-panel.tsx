"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, Scale } from "lucide-react";
import type { ContestationDecision, OverrunDecision, TicketCategoryCode } from "@prisma/client";
import { CATEGORY_DEFINITIONS, CONTESTATION_WINDOW_BUSINESS_DAYS } from "@/server/domain/ticket-grid";
import { FormattedDate } from "@/components/FormattedDate";
import { FIELD_CLASS } from "@/components/ui";
import { openContestation, registerOverrunDecision } from "@/app/actions/ticket-grid";
import { cn } from "@/lib/ui";

type Props = {
  ticketId: string;
  categoryCode: TicketCategoryCode | null;
  contestationOpenedAt: Date | null;
  contestationDeadline: Date | null;
  contestationDecision: ContestationDecision | null;
  overrunDecision: OverrunDecision | null;
  /** Estouro do teto detectado para a categoria deste chamado. */
  quotaExceeded: boolean;
  quotaMessage: string | null;
};

const DECISION_LABELS: Record<ContestationDecision, string> = {
  MANTIDA: "Classificação mantida após análise",
  ALTERADA: "Contestação acatada — categoria alterada",
  EXPIRADA: "Prazo expirado sem manifestação — classificação mantida",
};

export function ClientGridPanel({
  ticketId,
  categoryCode,
  contestationOpenedAt,
  contestationDeadline,
  contestationDecision,
  overrunDecision,
  quotaExceeded,
  quotaMessage,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  const contestationOpen = Boolean(contestationOpenedAt) && !contestationDecision;
  const needsOverrunDecision = quotaExceeded && !overrunDecision;

  // Nada a mostrar: sem estouro, sem contestação em curso e sem classificação.
  if (!needsOverrunDecision && !contestationOpenedAt && !categoryCode) return null;

  return (
    <div className="space-y-4">
      {/* Excedente: a escolha é do cliente, chamado a chamado. */}
      {needsOverrunDecision && (
        <section className="relative overflow-hidden rounded-2xl border border-warning/50 bg-warning-soft p-4 sm:p-5">
          <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-warning" />
          <h3 className="flex items-center gap-2 text-base font-semibold text-warning-ink">
            <AlertTriangle size={18} className="shrink-0" />
            Teto da categoria atingido — execução suspensa
          </h3>
          {quotaMessage && <p className="mt-1.5 text-sm text-ink">{quotaMessage}</p>}
          <p className="mt-1 text-sm text-ink-2">
            O atendimento só continua depois da sua escolha. Nenhum chamado é bloqueado sem esta
            consulta.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <form action={registerOverrunDecision}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="decision" value="EXCEDENTE" />
              <button
                type="submit"
                className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl bg-ink px-4 py-2 text-left text-surface transition hover:opacity-90"
              >
                <span className="text-sm font-semibold">Executar como excedente</span>
                <span className="text-[11px] opacity-75">Cobrado à tabela de hora avulsa</span>
              </button>
            </form>

            <form action={registerOverrunDecision}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="decision" value="FILA_PROXIMO_MES" />
              <button
                type="submit"
                className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl border border-line-strong bg-surface px-4 py-2 text-left text-ink transition hover:border-ink-3"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarClock size={14} />
                  Aguardar o próximo mês
                </span>
                <span className="text-[11px] text-ink-3">Apuração desloca para a competência seguinte</span>
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Contestação da categoria */}
      {categoryCode && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Scale size={16} className="shrink-0 text-ink-3" />
                Classificação atribuída
              </h3>
              <p className="mt-1 text-sm text-ink-2">
                <span className="font-semibold text-ink">{categoryCode}</span> ·{" "}
                {CATEGORY_DEFINITIONS[categoryCode].label}
              </p>
            </div>
          </div>

          <div className="mt-3">
            {contestationDecision ? (
              <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
                {DECISION_LABELS[contestationDecision]}.
              </p>
            ) : contestationOpen ? (
              <p className="rounded-xl bg-brand-soft px-3 py-2.5 text-sm text-brand-ink">
                Contestação em análise. Decisão até{" "}
                {contestationDeadline ? (
                  <FormattedDate
                    date={contestationDeadline}
                    pattern="dd/MM/yyyy HH:mm"
                    className="font-semibold"
                  />
                ) : (
                  "—"
                )}
                . Divergência não resolvida sobe para a reunião mensal.
              </p>
            ) : showForm ? (
              <form action={openContestation} className="animate-fade space-y-2">
                <input type="hidden" name="ticketId" value={ticketId} />
                <textarea
                  name="reason"
                  rows={3}
                  required
                  placeholder="Por que a categoria atribuída não corresponde à demanda…"
                  className={cn(FIELD_CLASS, "resize-none")}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="min-h-11 rounded-xl px-4 text-sm font-medium text-ink-3 hover:text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="min-h-11 rounded-xl bg-brand px-4 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
                  >
                    Enviar contestação
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-3">
                  Você tem {CONTESTATION_WINDOW_BUSINESS_DAYS} dias úteis para contestar. Sem
                  manifestação, a classificação é mantida.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="min-h-10 shrink-0 rounded-xl border border-line px-3.5 text-sm font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
                >
                  Contestar categoria
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
