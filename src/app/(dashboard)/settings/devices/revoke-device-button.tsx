"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldOff } from "lucide-react";
import { cn } from "@/lib/ui";

export function RevokeDeviceButton({
  deviceId,
  deviceName,
  className = "",
}: {
  deviceId: string;
  deviceName: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(false);
          setConfirming(true);
        }}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-medium text-ink-2 transition hover:border-critical/50 hover:bg-critical-soft hover:text-critical-ink",
          className
        )}
      >
        <ShieldOff size={13} />
        Revogar
        {error && <span className="text-critical-ink">· falhou</span>}
      </button>
    );
  }

  return (
    <div className={cn("inline-flex flex-wrap items-center justify-end gap-1.5", className)}>
      <span className="text-xs text-ink-2">Revogar “{deviceName}”?</span>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-9 rounded-xl px-3 text-xs font-medium text-ink-3 transition hover:text-ink"
      >
        Cancelar
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch(`/api/admin/devices/${deviceId}/revoke`, { method: "POST" });
            if (response.ok) {
              window.location.reload();
            } else {
              setError(true);
              setConfirming(false);
            }
          });
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-critical px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {isPending && <Loader2 size={13} className="animate-spin" />}
        Confirmar
      </button>
    </div>
  );
}
