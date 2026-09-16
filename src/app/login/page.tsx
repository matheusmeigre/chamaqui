"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/ui";

type ActivationMethod = "code" | "qr";

/** Organização revelada pelo código — só quem tem um código válido a vê. */
type ResolvedCode = {
  organizationName: string;
  role: string;
};

const INPUT =
  "block w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-3 text-base text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:shadow-(--ring-brand) disabled:cursor-not-allowed disabled:bg-surface-2";

const HIGHLIGHTS = [
  { icon: Timer, title: "SLA em horas úteis", text: "Prazos de resposta, contorno e correção acompanhados em tempo real." },
  { icon: BarChart3, title: "Consumo × teto", text: "Grade C1–C6 com alertas antes do estouro do contrato." },
  { icon: ShieldCheck, title: "Acesso por dispositivo", text: "Sem senha: ativação por código ou QR, com revogação imediata." },
];

const CODE_LENGTH = 8;

/** "abcd efgh" → "ABCD-EFGH": o hífen entra sozinho enquanto a pessoa digita. */
function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

function roleLabel(role: string): string {
  return role === "ADMINISTRADOR" ? "Administrador" : "Solicitante";
}

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);

  const [method, setMethod] = useState<ActivationMethod>("code");
  const [code, setCode] = useState("");
  const [resolved, setResolved] = useState<ResolvedCode | null>(null);
  const [resolving, setResolving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Fluxo bootstrap (responsável pela organização)
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [bootstrapResult, setBootstrapResult] = useState<{
    code: string;
    role: string;
    organizationName: string;
  } | null>(null);
  const [bootstrapError, setBootstrapError] = useState("");
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  const codeComplete = code.replace("-", "").length === CODE_LENGTH;

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
        setCheckingSession(false);
      }
    })();
  }, [router, checkedSession]);

  /**
   * Passo 1: o código diz a qual organização o dispositivo pertence. A lista de
   * clientes nunca vai para a tela — só a organização do próprio código, e só
   * depois que ele for validado.
   */
  const resolveCode = async (value: string) => {
    setResolving(true);
    setError("");
    setResolved(null);

    try {
      const res = await fetch(`/api/auth/activate-info?code=${encodeURIComponent(value)}`, {
        cache: "no-store",
      });

      if (res.status === 429) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        return;
      }
      if (res.status === 400 || res.status === 404) {
        setError("Código de ativação inválido. Confira os caracteres e tente novamente.");
        return;
      }
      if (!res.ok) {
        setError("Não foi possível validar o código agora. Tente novamente em instantes.");
        return;
      }

      const data = await res.json();
      if (data.used) {
        setError("Este código já foi utilizado. Solicite um novo código.");
        return;
      }
      if (data.expired) {
        setError("Este código expirou. Solicite um novo código.");
        return;
      }

      setResolved({ organizationName: data.organizationName, role: data.role });
    } catch {
      setError("Não foi possível validar o código agora. Verifique sua conexão.");
    } finally {
      setResolving(false);
    }
  };

  // Passo 2: com a organização confirmada na tela, o dispositivo é ativado.
  const activate = async () => {
    setActivating(true);
    setError("");

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        router.replace("/dashboard");
        return;
      }

      const data = await res.json().catch(() => null);
      const messages: Record<string, string> = {
        CODE_INVALID: "Código de ativação inválido. Verifique e tente novamente.",
        CODE_ALREADY_USED: "Este código já foi utilizado. Solicite um novo código.",
        CODE_EXPIRED: "Este código expirou. Solicite um novo código.",
        ORGANIZATION_INVALID: "A organização deste código está desativada.",
        LOGIN_BLOCKED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        INVALID_INPUT: "Informe o código de ativação.",
      };
      setError(messages[data?.error] ?? "Não foi possível ativar o dispositivo. Tente novamente.");
      setResolved(null);
      setActivating(false);
    } catch {
      setError("Ocorreu um erro ao tentar ativar o dispositivo.");
      setActivating(false);
    }
  };

  const startOver = () => {
    setResolved(null);
    setError("");
    setCode("");
    requestAnimationFrame(() => codeInputRef.current?.focus());
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapKey) return;

    setBootstrapLoading(true);
    setBootstrapError("");
    setBootstrapResult(null);

    try {
      const res = await fetch("/api/auth/bootstrap-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey: bootstrapKey }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const messages: Record<string, string> = {
          ACCESS_KEY_INVALID: "Chave de acesso inválida.",
          LOGIN_BLOCKED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
          INVALID_INPUT: "Informe a chave de acesso.",
        };
        setBootstrapError(messages[data?.error] ?? "Não foi possível gerar o código.");
        return;
      }

      setBootstrapResult({
        code: data.code.plainCode,
        role: data.code.role,
        organizationName: data.code.organization?.name ?? "",
      });
      setBootstrapKey("");
    } catch {
      setBootstrapError("Ocorreu um erro ao tentar gerar o código.");
    } finally {
      setBootstrapLoading(false);
    }
  };

  if (checkingSession) {
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
              Informe o código de ativação que você recebeu. A organização é identificada
              automaticamente.
            </p>

            <div className="mt-7 space-y-5">
              <div
                role="tablist"
                aria-label="Forma de ativação"
                className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1"
              >
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
                    aria-selected={method === key}
                    onClick={() => {
                      setMethod(key);
                      setError("");
                    }}
                    className={cn(
                      "flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition",
                      method === key ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
                    )}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>

              {method === "qr" ? (
                <div className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-5 text-center">
                  <QrCode className="mx-auto mb-2 h-8 w-8 text-ink-3" />
                  <p className="text-sm font-medium text-ink">Escaneie o QR Code do administrador</p>
                  <p className="mt-1 text-xs text-ink-3">
                    Aponte a câmera do celular para o QR exibido pelo responsável. O restante
                    acontece automaticamente.
                  </p>
                </div>
              ) : resolved ? (
                /* Passo 2 — confirmar a organização revelada pelo código */
                <div className="animate-fade-up space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <p className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-medium text-ink-3">
                      Você vai ativar este dispositivo em
                    </p>
                    <dl className="divide-y divide-line">
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                          <Building2 size={18} />
                        </span>
                        <div className="min-w-0">
                          <dt className="text-xs text-ink-3">Organização</dt>
                          <dd className="truncate font-semibold text-ink">{resolved.organizationName}</dd>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-good-soft text-good-ink">
                          <ShieldCheck size={18} />
                        </span>
                        <div className="min-w-0">
                          <dt className="text-xs text-ink-3">Permissão</dt>
                          <dd className="font-semibold text-ink">{roleLabel(resolved.role)}</dd>
                        </div>
                        <span className="ml-auto rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs tracking-wider text-ink-2">
                          {code}
                        </span>
                      </div>
                    </dl>
                  </div>

                  {error && (
                    <div role="alert" className="flex items-center gap-3 rounded-xl bg-critical-soft p-3.5 text-sm text-critical-ink">
                      <AlertCircle size={18} className="shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={activate}
                    disabled={activating}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {activating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Ativar dispositivo
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={startOver}
                    disabled={activating}
                    className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-ink-3 transition hover:text-ink disabled:opacity-50"
                  >
                    <ArrowLeft size={14} />
                    Não é esta organização? Usar outro código
                  </button>
                </div>
              ) : (
                /* Passo 1 — informar o código */
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (codeComplete) void resolveCode(code);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label htmlFor="accessCode" className="text-sm font-medium text-ink">
                      Código de ativação
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-3" />
                      <input
                        ref={codeInputRef}
                        id="accessCode"
                        type="text"
                        inputMode="text"
                        required
                        autoFocus
                        value={code}
                        onChange={(e) => {
                          setCode(formatCode(e.target.value));
                          setError("");
                        }}
                        disabled={resolving}
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={CODE_LENGTH + 1}
                        placeholder="XXXX-XXXX"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "code-error" : "code-hint"}
                        className={cn(
                          INPUT,
                          "font-mono text-lg tracking-[0.25em] placeholder:tracking-[0.25em]",
                          error && "border-critical/60"
                        )}
                      />
                    </div>
                    {!error && (
                      <p id="code-hint" className="text-xs text-ink-3">
                        8 caracteres, enviados pelo responsável da sua organização.
                      </p>
                    )}
                  </div>

                  {error && (
                    <div id="code-error" role="alert" className="flex items-center gap-3 rounded-xl bg-critical-soft p-3.5 text-sm text-critical-ink">
                      <AlertCircle size={18} className="shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resolving || !codeComplete}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resolving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Continuar
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Bootstrap: responsável pela organização */}
              <div className="rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  aria-expanded={showBootstrap}
                  onClick={() => {
                    setShowBootstrap(!showBootstrap);
                    setBootstrapError("");
                    setBootstrapResult(null);
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
                      Informe a chave de acesso da sua organização para gerar um código de ativação
                      para este dispositivo. A organização é identificada pela chave.
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
                          setBootstrapResult(null);
                        }}
                        disabled={bootstrapLoading}
                        autoComplete="off"
                        placeholder="Chave de acesso da organização"
                        className={INPUT}
                      />
                    </div>

                    {bootstrapError && (
                      <div role="alert" className="flex items-center gap-2 rounded-xl bg-critical-soft p-3 text-sm text-critical-ink">
                        <AlertCircle size={16} className="shrink-0" />
                        <p>{bootstrapError}</p>
                      </div>
                    )}

                    {bootstrapResult && (
                      <div className="animate-fade-up rounded-xl bg-surface-2 p-4 text-center">
                        <p className="text-xs text-ink-3">
                          Código gerado{bootstrapResult.organizationName && ` para ${bootstrapResult.organizationName}`} ·
                          uso único, expira em 24h
                        </p>
                        <code className="mt-1 block font-mono text-2xl font-bold tracking-[0.2em] text-ink">
                          {bootstrapResult.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            const generated = bootstrapResult.code;
                            setCode(formatCode(generated));
                            setMethod("code");
                            setShowBootstrap(false);
                            setBootstrapResult(null);
                            void resolveCode(generated);
                          }}
                          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-brand-ink transition hover:bg-brand-soft"
                        >
                          Usar este código <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={bootstrapLoading || !bootstrapKey}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bootstrapLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Gerar código de acesso"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <p className="mt-6 flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-ink-3">
              <Lock size={12} className="mt-0.5 shrink-0" />
              <span>
                Por privacidade, nenhuma organização é listada aqui: o seu código identifica a sua.
                Não possui um código? Fale com o responsável pela sua organização.
              </span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
