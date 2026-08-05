"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

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
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className={`min-h-11 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 px-4 py-2 transition ${className}`}
      >
        Revogar
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-sm text-slate-600">Revogar &quot;{deviceName}&quot;?</span>
      <button
        onClick={() => setConfirmed(false)}
        className="min-h-11 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 px-3 py-2 transition"
      >
        Cancelar
      </button>
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const res = await fetch(`/api/admin/devices/${deviceId}/revoke`, { method: "POST" });
            if (res.ok) {
              window.location.reload();
            } else {
              setConfirmed(false);
            }
          });
        }}
        className="min-h-11 inline-flex items-center gap-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 px-4 py-2 transition disabled:opacity-50"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
        Confirmar
      </button>
    </div>
  );
}
