"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Building2, KeyRound, AlertCircle, Loader2, ChevronDown, QrCode } from "lucide-react";

type Organization = {
  id: string;
  slug: string;
  name: string;
};

type ActivationStep = "code" | "qr";

export default function LoginPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [step, setStep] = useState<ActivationStep>("code");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const checkedSession = useRef(false);

  const loadOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations ?? []);
      }
    } catch {
      // mantém a lista vazia
    }
  }, []);

  // "Próximos acessos": se já existe sessão válida, entra direto (sem código/PIN na fase 1).
  useEffect(() => {
    if (checkedSession.current) return;
    checkedSession.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (res.ok) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // sem sessão, segue para ativação
      } finally {
        setIsLoading(false);
      }
      await loadOrganizations();
    })();
  }, [router, loadOrganizations]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !accessCode) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, code: accessCode }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const messages: Record<string, string> = {
          CODE_INVALID: "Código de ativação inválido. Verifique e tente novamente.",
          CODE_ALREADY_USED: "Este código já foi utilizado. Solicite um novo código.",
          CODE_EXPIRED: "Este código expirou. Solicite um novo código.",
          ORGANIZATION_INVALID: "Organização inválida ou desativada.",
          INVALID_INPUT: "Preencha a organização e o código de ativação.",
        };
        setError(messages[data?.error] ?? "Não foi possível ativar o dispositivo. Tente novamente.");
        setIsLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError("Ocorreu um erro ao tentar ativar o dispositivo.");
      setIsLoading(false);
    }
  };

  if (isLoading && organizations.length === 0) {
    return (
      <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Ticket className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Chamaqui</h1>
          <p className="text-slate-500 mt-2">Ative seu dispositivo para acessar o portal</p>
        </div>

        {/* Card */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Qual organização deseja acessar?
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  required
                  value={organizationId}
                  onChange={(e) => {
                    setOrganizationId(e.target.value);
                    setAccessCode("");
                    setError("");
                  }}
                  className="block w-full appearance-none pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-base text-slate-900 bg-white"
                >
                  <option value="" disabled>Selecione...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Alternância código / QR */}
            <div>
              <div className="flex items-center gap-1 mb-3 border border-slate-200 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => { setStep("code"); setError(""); }}
                  className={`flex flex-1 min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition ${step === "code" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <KeyRound size={16} /> Código curto
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("qr"); setError(""); }}
                  className={`flex flex-1 min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition ${step === "qr" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <QrCode size={16} /> QR Code
                </button>
              </div>

              {step === "code" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Digite seu código de ativação
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={accessCode}
                      onChange={(e) => {
                        setAccessCode(e.target.value.toUpperCase());
                        setError("");
                      }}
                      disabled={!organizationId}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={9}
                      placeholder={organizationId ? "XXXX-XXXX" : "Selecione a organização primeiro"}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-base tracking-[0.2em] text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                  <QrCode className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 mb-1">
                    Escaneie o QR Code fornecido pelo administrador
                  </p>
                  <p className="text-xs text-slate-400">
                    Aponte a câmera do celular para o QR exibido pelo responsável. O restante acontece automaticamente.
                  </p>
                </div>
              )}
            </div>

            {step === "code" && (
              <button
                type="submit"
                disabled={isLoading || !organizationId || !accessCode}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Ativar Dispositivo"
                )}
              </button>
            )}
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-sm text-slate-500 mt-6 sm:mt-8 px-2">
          Não possui um código de ativação? Contate o responsável pela sua organização.
        </p>
      </div>
    </main>
  );
}
