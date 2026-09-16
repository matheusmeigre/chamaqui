"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { reopenTicketCustomer, resolveTicketCustomer } from "@/app/actions/tickets";
import { FIELD_CLASS } from "@/components/ui";
import { cn } from "@/lib/ui";

const RATING_LABEL = ["", "Muito insatisfeito", "Insatisfeito", "Neutro", "Satisfeito", "Muito satisfeito"];

export function RequesterActions({ ticketId }: { ticketId: string }) {
  const [view, setView] = useState<"WAITING" | "RESOLVING" | "REOPENING">("WAITING");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <section className="animate-fade-up rounded-2xl border border-good/35 bg-good-soft p-4 sm:p-5">
        <p className="flex items-center gap-2 text-base font-semibold text-good-ink">
          <CheckCircle2 size={18} />
          {view === "REOPENING" ? "Chamado reaberto" : "Obrigado pela avaliação"}
        </p>
        <p className="mt-1 text-sm text-good-ink/90">
          {view === "REOPENING"
            ? "O chamado voltou para atendimento. Acompanhe as novidades na conversa abaixo."
            : "O chamado foi finalizado e sua avaliação foi registrada."}
        </p>
      </section>
    );
  }

  if (view === "WAITING") {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-brand/35 bg-surface p-4 shadow-raised sm:p-5">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-ink">
          Sua validação é necessária
        </p>
        <h3 className="mt-1 text-base font-semibold text-ink">A solução resolveu o seu problema?</h3>
        <p className="mt-1 text-sm text-ink-2">
          O atendimento marcou este chamado como resolvido ou pendente de retorno. Confirme para
          encerrar, ou devolva para atendimento explicando o que ainda falta.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setView("RESOLVING")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-good px-4 text-sm font-semibold text-white shadow-card transition hover:brightness-110"
          >
            <ThumbsUp size={16} />
            Sim, está resolvido
          </button>
          <button
            type="button"
            onClick={() => setView("REOPENING")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:border-critical/50 hover:bg-critical-soft hover:text-critical-ink"
          >
            <ThumbsDown size={16} />
            Não, o problema persiste
          </button>
        </div>
      </section>
    );
  }

  if (view === "RESOLVING") {
    const shown = hover ?? rating;
    return (
      <section className="animate-fade-up rounded-2xl border border-line bg-surface p-4 shadow-raised sm:p-5">
        <h3 className="text-base font-semibold text-ink">Avaliar e encerrar</h3>
        <form
          action={async (data) => {
            setIsLoading(true);
            setError(null);
            try {
              await resolveTicketCustomer(data);
              setDone(true);
            } catch {
              setError("Erro ao finalizar o chamado. Tente novamente.");
            } finally {
              setIsLoading(false);
            }
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="rating" value={rating} />

          <div>
            <p className="text-sm font-medium text-ink">Como foi o atendimento?</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex" onPointerLeave={() => setHover(null)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${star} ${star > 1 ? "estrelas" : "estrela"}`}
                    aria-pressed={star <= rating}
                    onClick={() => setRating(star)}
                    onPointerEnter={() => setHover(star)}
                    className="grid h-11 w-11 place-items-center transition-transform hover:scale-110"
                  >
                    <Star
                      size={26}
                      className={cn(
                        "transition-colors",
                        star <= shown ? "fill-warning text-warning" : "text-line-strong"
                      )}
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium text-ink-2">{RATING_LABEL[shown]}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ratingNotes" className="text-sm font-medium text-ink">
              Comentário <span className="font-normal text-ink-3">(opcional)</span>
            </label>
            <textarea id="ratingNotes" name="ratingNotes" rows={3} className={cn(FIELD_CLASS, "resize-none")} />
          </div>

          {error && (
            <p className="rounded-xl bg-critical-soft px-3 py-2 text-sm font-medium text-critical-ink">{error}</p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setView("WAITING")}
              className="min-h-11 rounded-xl px-4 text-sm font-medium text-ink-3 hover:text-ink"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-good px-4 text-sm font-semibold text-white shadow-card transition hover:brightness-110 disabled:opacity-50"
            >
              {isLoading && <Loader2 size={15} className="animate-spin" />}
              {isLoading ? "Salvando…" : "Confirmar e encerrar"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="animate-fade-up rounded-2xl border border-critical/30 bg-surface p-4 shadow-raised sm:p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
        <RotateCcw size={17} className="text-critical-ink" />
        Devolver para atendimento
      </h3>
      <form
        action={async (data) => {
          setIsLoading(true);
          setError(null);
          try {
            await reopenTicketCustomer(data);
            setDone(true);
          } catch {
            setError("Erro ao reabrir o chamado. Tente novamente.");
          } finally {
            setIsLoading(false);
          }
        }}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="ticketId" value={ticketId} />

        <div className="space-y-1.5">
          <label htmlFor="reopenReason" className="text-sm font-medium text-ink">
            O que ainda não funciona?
          </label>
          <textarea
            id="reopenReason"
            name="reason"
            required
            rows={3}
            className={cn(FIELD_CLASS, "resize-none")}
            placeholder="Explique o comportamento que continua acontecendo…"
          />
          <p className="text-xs text-ink-3">
            Depois de reabrir, você pode anexar novas imagens na conversa.
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-critical-soft px-3 py-2 text-sm font-medium text-critical-ink">{error}</p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setView("WAITING")}
            className="min-h-11 rounded-xl px-4 text-sm font-medium text-ink-3 hover:text-ink"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-critical px-4 text-sm font-semibold text-white shadow-card transition hover:brightness-110 disabled:opacity-50"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            {isLoading ? "Processando…" : "Reabrir chamado"}
          </button>
        </div>
      </form>
    </section>
  );
}
