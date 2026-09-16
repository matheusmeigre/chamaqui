"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  KeyRound,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/ui";

type Organization = {
  id: string;
  slug: string;
  name: string;
};

type ActivationStep = "code" | "qr";

const INPUT =
  "block w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-3 text-base text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:shadow-(--ring-brand) disabled:cursor-not-allowed disabled:bg-surface-2";

const HIGHLIGHTS = [
  { icon: Timer, title: "SLA em horas úteis", text: "Prazos de resposta, contorno e correção acompanhados em tempo real." },
  { icon: BarChart3, title: "Consumo × teto", text: "Grade C1–C6 com alertas antes do estouro do contrato." },
  { icon: ShieldCheck, title: "Acesso por dispositivo", text: "Sem senha: ativação por código ou QR, com revogação imediata." },
];

export default function LoginPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [step, setStep] = useState<ActivationStep>("code");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);

  // Fluxo bootstrap (responsável pela organização)
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [bootstrapCode, setBootstrapCode] = useState("");
  const [bootstrapRole, setBootstrapRole] = useState("");
  const [bootstrapError, setBootstrapError] = useState("");
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

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
    if (checkedSession) return;

    (async () => {
      setCheckedSession(true);
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
  }, [router, loadOrganizations, checkedSession]);

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

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !bootstrapKey) return;

    setBootstrapLoading(true);
    setBootstrapError("");
    setBootstrapCode("");

    try {
      const res = await fetch("/api/auth/bootstrap-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, accessKey: bootstrapKey }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const messages: Record<string, string> = {
          ACCESS_KEY_INVALID: "Chave de acesso inválida para esta organização.",
          LOGIN_BLOCKED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
          ORGANIZATION_INVALID: "Organização inválida ou desativada.",
          INVALID_INPUT: "Informe a organização e a chave de acesso.",
        };
        setBootstrapError(messages[data?.error] ?? "Não foi possível gerar o código.");
        return;
      }

      setBootstrapRole(data.code.role);
      setBootstrapCode(data.code.plainCode);
      setBootstrapKey("");
    } catch {
      setBootstrapError("Ocorreu um erro ao tentar gerar o código.");
    } finally {
      setBootstrapLoading(false);
    }
  };

  if (isLoading && organizations.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-3 py-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 text-ink-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Verificando sessão…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Painel de marca */}
      <section className="relative hidden overflow-hidden bg-[#0a1020] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(57,135,229,0.35),transparent_70%),radial-gradient(50%_45%_at_90%_90%,rgba(144,133,233,0.22),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:44px_44px]"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#3987e5]">
            <Sparkles size={18} strokeWidth={2.4} />
          </span>
          <span className="text-lg font-bold tracking-tight">Chamaqui</span>
        </div>

        <div className="relative mt-auto max-w-lg space-y-8">
          <div>
            <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
              Cada chamado, do registro à validação.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Gestão de incidentes e solicitações com SLA contratual, consumo de teto e indicadores
              para decidir rápido.
            </p>
          </div>

          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <item.icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-sm text-white/60">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-xs text-white/40">
          © {new Date().getFullYear()} Plataforma Chamaqui
        </p>
      </section>

      {/* Autenticação */}
      <section className="flex flex-col px-4 py-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 lg:invisible">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-on-brand">
              <Sparkles size={16} strokeWidth={2.4} />
            </span>
            <span className="font-bold tracking-tight text-ink">Chamaqui</span>
          </span>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div className="animate-fade-up">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Acessar o portal</h2>
            <p className="mt-1.5 text-sm text-ink-2">
              Ative este dispositivo com o código fornecido pela sua organização.
            </p>

            <div className="mt-7 space-y-5">
              {error && (
                <div role="alert" className="flex items-center gap-3 rounded-xl bg-critical-soft p-3.5 text-sm text-critical-ink">
                  <AlertCircle size={18} className="shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleActivate} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="organization" className="text-sm font-medium text-ink">
                    Organização
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-3" />
                    <select
                      id="organization"
                      required
                      value={organizationId}
                      onChange={(e) => {
                        setOrganizationId(e.target.value);
                        setAccessCode("");
                        setError("");
                      }}
                      className={cn(INPUT, "appearance-none pr-10")}
                    >
                      <option value="" disabled>
                        Selecione…
                      </option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-3" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div role="tablist" aria-label="Forma de ativação" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1">
                    {(
                      [
                        { key: "code", label: "Código curto", Icon: KeyRound },
                        { key: "qr", label: "QR Code", Icon: QrCode },
                      ] as const
                    ).map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={step === key}
                        onClick={() => {
                          setStep(key);
                          setError("");
                        }}
                        className={cn(
                          "flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition",
                          step === key ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
                        )}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {step === "code" ? (
                    <div className="space-y-1.5">
                      <label htmlFor="accessCode" className="text-sm font-medium text-ink">
                        Código de ativação
                      </label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-3" />
                        <input
                          id="accessCode"
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
                          className={cn(INPUT, "font-mono tracking-[0.2em] placeholder:font-sans placeholder:tracking-normal")}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-5 text-center">
                      <QrCode className="mx-auto mb-2 h-8 w-8 text-ink-3" />
                      <p className="text-sm font-medium text-ink">Escaneie o QR Code do administrador</p>
                      <p className="mt-1 text-xs text-ink-3">
                        Aponte a câmera do celular para o QR exibido pelo responsável. O restante
                        acontece automaticamente.
                      </p>
                    </div>
                  )}
                </div>

                {step === "code" && (
                  <button
                    type="submit"
                    disabled={isLoading || !organizationId || !accessCode}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Ativar dispositivo
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </form>

              {/* Bootstrap: responsável pela organização */}
              <div className="rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  aria-expanded={showBootstrap}
                  onClick={() => {
                    setShowBootstrap(!showBootstrap);
                    setBootstrapError("");
                    setBootstrapCode("");
                  }}
                  className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-sm font-medium text-ink-2 transition hover:text-ink"
                >
                  <ShieldCheck size={16} className="shrink-0 text-ink-3" />
                  <span className="flex-1">Sou responsável pela organização</span>
                  <ChevronDown size={16} className={cn("shrink-0 text-ink-3 transition", showBootstrap && "rotate-180")} />
                </button>

                {showBootstrap && (
                  <form onSubmit={handleBootstrap} className="animate-fade space-y-3 border-t border-line p-4">
                    <p className="text-xs leading-relaxed text-ink-3">
                      Use a chave de acesso da organização para gerar um código de ativação
                      {bootstrapRole ? ` (${bootstrapRole.toLowerCase()})` : " de administrador"} para
                      este dispositivo.
                    </p>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-3" />
                      <input
                        type="password"
                        required
                        aria-label="Chave de acesso da organização"
                        value={bootstrapKey}
                        onChange={(e) => {
                          setBootstrapKey(e.target.value);
                          setBootstrapError("");
                          setBootstrapCode("");
                        }}
                        disabled={!organizationId || bootstrapLoading}
                        autoComplete="off"
                        placeholder={organizationId ? "Chave de acesso da organização" : "Selecione a organização primeiro"}
                        className={INPUT}
                      />
                    </div>

                    {bootstrapError && (
                      <div role="alert" className="flex items-center gap-2 rounded-xl bg-critical-soft p-3 text-sm text-critical-ink">
                        <AlertCircle size={16} className="shrink-0" />
                        <p>{bootstrapError}</p>
                      </div>
                    )}

                    {bootstrapCode && (
                      <div className="animate-fade-up rounded-xl bg-surface-2 p-4 text-center">
                        <p className="text-xs text-ink-3">Código gerado · uso único, expira em 24h</p>
                        <code className="mt-1 block font-mono text-2xl font-bold tracking-[0.2em] text-ink">
                          {bootstrapCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            setAccessCode(bootstrapCode);
                            setStep("code");
                            setShowBootstrap(false);
                          }}
                          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-brand-ink transition hover:bg-brand-soft"
                        >
                          Usar este código <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={bootstrapLoading || !organizationId || !bootstrapKey}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bootstrapLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Gerar código de acesso"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-ink-3">
              Não possui um código? Fale com o responsável pela sua organização.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
