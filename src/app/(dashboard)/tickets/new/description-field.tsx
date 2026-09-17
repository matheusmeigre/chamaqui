"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { improveTicketDescription } from "@/app/actions/writing";
import { FIELD_CLASS } from "@/components/ui";
import { cn } from "@/lib/ui";

const PLACEHOLDER =
  "O que você fez, o que esperava e o que aconteceu.\n\nEx.:\n1. Abri o app no atrativo X\n2. Toquei em Capturar\n3. Apareceu “fora do raio” mesmo estando no local";

/**
 * Campo de descrição com auxílio de escrita opcional.
 *
 * O texto do usuário é a fonte de verdade: a sugestão da IA aparece ao lado, e
 * só entra no campo se ele aceitar. Recusa, falha ou demora não mexem no que
 * ele escreveu, e mesmo depois de aplicada a sugestão o texto original continua
 * a um clique de distância.
 */
export function DescriptionField({ assistantEnabled }: { assistantEnabled: boolean }) {
  const [value, setValue] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [replacedText, setReplacedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasContent = value.trim().length > 0;

  function requestSuggestion() {
    // Uma revisão por vez: o botão fica inerte enquanto a anterior não volta.
    if (isPending || !hasContent) return;
    setError(null);
    setSuggestion(null);
    setReplacedText(null);

    startTransition(async () => {
      const result = await improveTicketDescription(value);
      if (result.ok) {
        setSuggestion(result.text);
      } else {
        setError(result.error);
      }
    });
  }

  function applySuggestion() {
    if (!suggestion) return;
    setReplacedText(value);
    setValue(suggestion);
    setSuggestion(null);
  }

  function undoSuggestion() {
    if (replacedText === null) return;
    setValue(replacedText);
    setReplacedText(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="description" className="text-sm font-medium text-ink">
          Descrição detalhada <span className="text-critical">*</span>
        </label>

        {assistantEnabled && (
          <button
            type="button"
            onClick={requestSuggestion}
            disabled={isPending || !hasContent}
            aria-busy={isPending}
            title={
              hasContent
                ? "Revisa a escrita sem mudar o que você contou"
                : "Escreva o que aconteceu para usar o auxílio"
            }
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-brand-ink transition hover:border-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-ink-3"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Revisando…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Melhorar com IA
              </>
            )}
          </button>
        )}
      </div>

      <textarea
        name="description"
        id="description"
        required
        rows={6}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={PLACEHOLDER}
        className={cn(FIELD_CLASS, "resize-y leading-relaxed")}
      />

      {assistantEnabled && (
        <p className="text-xs text-ink-3">
          Opcional: escreva do jeito que preferir e use o auxílio para deixar o relato mais claro.
          Você decide se aplica a sugestão.
        </p>
      )}

      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-critical-soft px-3 py-2.5 text-sm font-medium text-critical-ink">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>
              {error} Seu texto continua exatamente como você escreveu.
            </span>
          </p>
        )}

        {replacedText !== null && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Check size={14} className="shrink-0 text-good" />
            Sugestão aplicada.
            <button
              type="button"
              onClick={undoSuggestion}
              className="inline-flex items-center gap-1 font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              <RotateCcw size={12} />
              Voltar ao texto original
            </button>
          </p>
        )}

        {suggestion && (
          <div className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-ink">
              <Sparkles size={13} />
              Sugestão da IA
            </p>
            <p className="mt-2 whitespace-pre-wrap wrap-break-word rounded-xl bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink-2">
              {suggestion}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applySuggestion}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-semibold text-on-brand shadow-card transition hover:bg-brand-strong"
              >
                <Check size={14} />
                Usar esta versão
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-medium text-ink-2 transition hover:bg-surface-3 hover:text-ink"
              >
                <X size={14} />
                Manter meu texto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
