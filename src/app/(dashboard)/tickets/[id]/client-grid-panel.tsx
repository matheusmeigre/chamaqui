"use client";

import { useState } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import type {
  ContestationDecision,
  OverrunDecision,
  TicketCategoryCode,
} from "@prisma/client";
import { CATEGORY_DEFINITIONS, CONTESTATION_WINDOW_BUSINESS_DAYS } from "@/server/domain/ticket-grid";
import { FormattedDate } from "@/components/FormattedDate";
import { openContestation, registerOverrunDecision } from "@/app/actions/ticket-grid";

const field =
  "w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-900";

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
  MANTIDA: "Classificação mantida",
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

  // Nada a mostrar: sem estouro, sem contestação em curso e sem histórico.
  if (!needsOverrunDecision && !contestationOpenedAt && !categoryCode) return null;

  return (
    <div className="space-y-4">
      {/* Excedente: a escolha é do cliente, chamado a chamado. */}
      {needsOverrunDecision && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-6 space-y-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-900">
            <AlertTriangle size={20} className="shrink-0" />
            Teto da categoria atingido
          </h3>
          <p className="text-sm text-amber-900">{quotaMessage}</p>
          <p className="text-sm text-amber-800">
            A execução está suspensa até sua escolha. O atendimento nunca é bloqueado sem esta
            consulta.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <form action={registerOverrunDecision}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="decision" value="EXCEDENTE" />
              <button
                type="submit"
                className="w-full min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
              >
                Executar como excedente
              </button>
            </form>

            <form action={registerOverrunDecision}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="decision" value="FILA_PROXIMO_MES" />
              <button
                type="submit"
                className="w-full min-h-11 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
              >
                Aguardar a fila do mês seguinte
              </button>
            </form>
          </div>
          <p className="text-xs text-amber-700">
            O excedente é cobrado à tabela de hora avulsa. A fila desloca a apuração para a
            competência seguinte.
          </p>
        </div>
      )}

      {/* Contestação da categoria */}
      {categoryCode && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-3 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Scale size={18} className="shrink-0" />
            Classificação: {categoryCode} — {CATEGORY_DEFINITIONS[categoryCode].label}
          </h3>

          {contestationDecision ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {DECISION_LABELS[contestationDecision]}.
            </p>
          ) : contestationOpen ? (
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Contestação em análise. Prazo de decisão até{" "}
              {contestationDeadline ? (
                <FormattedDate date={contestationDeadline} pattern="dd/MM/yyyy HH:mm" />
              ) : (
                "—"
              )}
              . Divergência não resolvida sobe para a reunião mensal.
            </p>
          ) : showForm ? (
            <form action={openContestation} className="space-y-2">
              <input type="hidden" name="ticketId" value={ticketId} />
              <textarea
                name="reason"
                rows={3}
                required
                placeholder="Por que a categoria atribuída não corresponde à demanda..."
                className={`${field} resize-none`}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Enviar contestação
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Você tem {CONTESTATION_WINDOW_BUSINESS_DAYS} dias úteis para contestar a categoria
                atribuída. Sem manifestação, a classificação é mantida.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Contestar categoria
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
