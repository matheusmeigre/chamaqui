"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Building2, Loader2, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
          // 400/404 são respostas sobre o código; o resto é o serviço falhando.
          // Tratar os dois igual fazia um convite válido parecer inválido.
          setError(
            res.status === 400 || res.status === 404
              ? "Código de ativação inválido ou expirado."
              : res.status === 429
                ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
                : "Não foi possível validar o código agora. Tente novamente em instantes."
          );
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
        LOGIN_BLOCKED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      };
      setError(messages[data?.error] ?? "Não foi possível ativar o dispositivo.");
      // Sem liberar a trava, uma falha transitória deixava o botão inerte.
      activated.current = false;
    } catch {
      setError("Ocorreu um erro ao ativar o dispositivo.");
      activated.current = false;
    } finally {
      setIsActivating(false);
    }
  };

  const unavailable = info && (info.used || info.expired);

  return (
    <main className="flex min-h-dvh flex-col bg-canvas px-4 py-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-on-brand">
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
          <span className="font-bold tracking-tight text-ink">Chamaqui</span>
        </span>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <div className="animate-fade-up overflow-hidden rounded-3xl border border-line bg-surface shadow-float">
          <div className="border-b border-line bg-surface-2 px-6 py-7 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
              <Smartphone size={26} />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Ativar este dispositivo</h1>
            <p className="mt-1 text-sm text-ink-2">Confira os dados do convite antes de continuar.</p>
          </div>

          <div className="space-y-5 p-6">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-ink-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Validando código…</span>
              </div>
            )}

            {!isLoading && error && !info && (
              <div role="alert" className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl bg-critical-soft p-4 text-sm text-critical-ink">
                  <AlertCircle size={18} className="shrink-0" />
                  <p>{error}</p>
                </div>
                <Link
                  href="/login"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-ink transition hover:bg-surface-2"
                >
                  Ir para o acesso por código <ArrowRight size={15} />
                </Link>
              </div>
            )}

            {info && (
              <>
                <dl className="divide-y divide-line rounded-2xl border border-line">
                  <div className="flex items-center gap-3 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                      <Building2 size={18} />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs text-ink-3">Organização</dt>
                      <dd className="font-semibold text-ink">{info.organizationName}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-good-soft text-good-ink">
                      <ShieldCheck size={18} />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs text-ink-3">Permissão</dt>
                      <dd className="font-semibold text-ink">
                        {info.role === "ADMINISTRADOR" ? "Administrador" : "Solicitante"}
                      </dd>
                    </div>
                  </div>
                </dl>

                {unavailable ? (
                  <div role="alert" className="flex items-center gap-3 rounded-xl bg-critical-soft p-4 text-sm text-critical-ink">
                    <AlertCircle size={18} className="shrink-0" />
                    <p>
                      {info.used ? "Este código já foi utilizado." : "Este código expirou."} Solicite um novo
                      convite ao responsável.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleActivate}
                    disabled={isActivating}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActivating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Confirmar ativação <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}

                {error && (
                  <div role="alert" className="flex items-center gap-3 rounded-xl bg-critical-soft p-4 text-sm text-critical-ink">
                    <AlertCircle size={18} className="shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="mt-6 px-2 text-center text-sm text-ink-3">
          Após ativar, este dispositivo fica vinculado à sua organização e pode ser revogado a
          qualquer momento pelo administrador.
        </p>
      </div>
    </main>
  );
}
