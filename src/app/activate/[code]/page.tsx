"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ticket, AlertCircle, Loader2, ShieldCheck, Building2 } from "lucide-react";

// /activate/[code] — fluxo de QR Code
// O usuário escaneia o QR (que aponta para esta URL) e o dispositivo é ativado
// automaticamente, sem digitar código.
export default function ActivatePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  const [info, setInfo] = useState<{
    organizationId: string;
    organizationName: string;
    role: string;
    used: boolean;
    expired: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const activated = useRef(false);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`/api/auth/activate-info?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        if (!res.ok) {
          setError("Código de ativação inválido ou expirado.");
          return;
        }
        const data = await res.json();
        setInfo(data);
      } catch {
        setError("Não foi possível validar o código de ativação.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [code]);

  const handleActivate = async () => {
    if (!info || activated.current) return;
    activated.current = true;
    setIsActivating(true);
    setError("");

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: info.organizationId, code }),
      });
      if (res.ok) {
        router.replace("/dashboard");
        return;
      }
      const data = await res.json().catch(() => null);
      const messages: Record<string, string> = {
        CODE_INVALID: "Código de ativação inválido.",
        CODE_ALREADY_USED: "Este código já foi utilizado.",
        CODE_EXPIRED: "Este código expirou.",
        ORGANIZATION_INVALID: "Organização inválida ou desativada.",
      };
      setError(messages[data?.error] ?? "Não foi possível ativar o dispositivo.");
    } catch {
      setError("Ocorreu um erro ao ativar o dispositivo.");
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Ticket className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Ativar Dispositivo</h1>
          <p className="text-slate-500 mt-2">Valide a ativação para continuar</p>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Validando código...</span>
            </div>
          )}

          {!isLoading && error && !info && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          )}

          {info && (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Organização</p>
                    <p className="font-semibold text-slate-900 break-words">{info.organizationName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Permissão</p>
                    <p className="font-semibold text-slate-900 break-words">{info.role}</p>
                  </div>
                </div>
              </div>

              {info.used || info.expired ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm">
                  <AlertCircle size={18} className="shrink-0" />
                  <p>{info.used ? "Este código já foi utilizado." : "Este código expirou."}</p>
                </div>
              ) : (
                <button
                  onClick={handleActivate}
                  disabled={isActivating}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActivating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Confirmar Ativação"
                  )}
                </button>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="break-words">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6 sm:mt-8 px-2">
          Após ativar, este dispositivo ficará vinculado à sua organização.
        </p>
      </div>
    </main>
  );
}
