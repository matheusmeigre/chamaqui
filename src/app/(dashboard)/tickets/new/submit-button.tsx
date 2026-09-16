"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Send } from "lucide-react";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:opacity-60 sm:w-auto"
    >
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Registrando…
        </>
      ) : (
        <>
          <Send size={16} />
          Abrir chamado
        </>
      )}
    </button>
  );
}
