"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Enviando...
        </>
      ) : (
        "Abrir Chamado"
      )}
    </button>
  );
}
