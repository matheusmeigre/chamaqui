"use client";

import { useState, useTransition, useEffect } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { updateTicketStatus } from "@/app/actions/tickets";

const STATUS_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  EM_TRIAGEM: "Em Triagem",
  EM_ATENDIMENTO: "Em Atendimento",
  PENDENTE: "Pendente (Aguardando Retorno)",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado",
  CANCELADO: "Cancelado",
};

interface Props {
  ticketId: string;
  currentStatus: string;
}

export function TechStatusForm({ ticketId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Sync quando o servidor revalida e passa o novo currentStatus
  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        await updateTicketStatus(ticketId, selectedStatus);
        setFeedback({
          type: "success",
          message: `Status alterado para "${STATUS_LABELS[selectedStatus]}" com sucesso!`,
        });
        setTimeout(() => setFeedback(null), 5000);
      } catch {
        setFeedback({
          type: "error",
          message: "Erro ao alterar status. Tente novamente.",
        });
      }
    });
  }

  return (
    <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-200 pb-2">
        Ações Técnicas
      </h3>

      {feedback && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 font-medium ${
            feedback.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-blue-800">
          Alterar Status e Assumir
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isPending}
          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white outline-none text-slate-900 disabled:opacity-60"
        >
          <option value="ABERTO">Aberto</option>
          <option value="EM_TRIAGEM">Em Triagem</option>
          <option value="EM_ATENDIMENTO">Em Atendimento</option>
          <option value="PENDENTE">Pendente (Aguardando Retorno)</option>
          <option value="RESOLVIDO">Resolvido</option>
          <option value="FECHADO">Fechado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <button
          type="submit"
          disabled={isPending || selectedStatus === currentStatus}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Aplicando...
            </>
          ) : (
            "Confirmar Ação"
          )}
        </button>
      </form>
    </div>
  );
}
