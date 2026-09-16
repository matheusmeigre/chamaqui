import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Gauge,
  KeyRound,
  Layers,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const FEATURES = [
  {
    icon: Layers,
    title: "Abertura guiada",
    text: "O solicitante classifica a demanda na grade C1–C6 e já vê o prazo que vale para ela.",
  },
  {
    icon: AlarmClock,
    title: "SLA em horas úteis",
    text: "Primeira resposta, contorno e correção medidos com feriados e janela de loja descontada.",
  },
  {
    icon: Gauge,
    title: "Consumo × teto",
    text: "Alerta em 80%, bloqueio em 100% e a decisão de excedente registrada chamado a chamado.",
  },
  {
    icon: BarChart3,
    title: "BI da operação",
    text: "Entrada × saída da fila, envelhecimento, causa raiz e relatório mensal pronto para imprimir.",
  },
  {
    icon: MessagesSquare,
    title: "Conversa com histórico",
    text: "Mensagens, anexos e eventos do sistema numa linha do tempo única por chamado.",
  },
  {
    icon: KeyRound,
    title: "Acesso sem senha",
    text: "Ativação por código ou QR, vinculada ao dispositivo e revogável na hora.",
  },
];

/** Prévia ilustrativa do painel — números fictícios, só para ambientar. */
function PanelPreview() {
  const bars = [38, 52, 44, 61, 57, 72, 66, 80, 74, 88, 79, 92];
  return (
    <div aria-hidden className="relative rounded-2xl border border-line bg-surface p-3 shadow-float sm:p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 h-5 flex-1 rounded-md bg-surface-2" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Fila ativa", value: "24", tone: "bg-brand" },
          { label: "SLA cumprido", value: "96%", tone: "bg-good" },
          { label: "Em risco", value: "3", tone: "bg-warning" },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-line bg-surface-2 p-2.5">
            <p className="text-[10px] text-ink-3">{tile.label}</p>
            <p className="mt-0.5 text-lg font-bold leading-none text-ink">{tile.value}</p>
            <span className={`mt-2 block h-1 w-2/3 rounded-full ${tile.tone}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        <div className="col-span-3 rounded-xl border border-line bg-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Entrada × saída</p>
          <div className="mt-2 flex h-20 items-end gap-1">
            {bars.map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-[3px] bg-brand/80"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="col-span-2 space-y-1.5 rounded-xl border border-line bg-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Consumo do teto</p>
          {[62, 84, 35].map((width, index) => (
            <div key={index} className="h-1.5 rounded-full bg-surface-3">
              <span
                className={`block h-full rounded-full ${width >= 80 ? "bg-warning" : "bg-brand"}`}
                style={{ width: `${width}%` }}
              />
            </div>
          ))}
          <p className="pt-1 text-[10px] text-ink-3">C2 · C3 · C4</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-on-brand">
              <Sparkles size={16} strokeWidth={2.4} />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">Chamaqui</span>
          </span>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-144 bg-[radial-gradient(55%_60%_at_50%_0%,color-mix(in_srgb,var(--brand)_18%,transparent),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-card">
                <ShieldCheck size={13} className="text-good" />
                Sustentação com SLA contratual
              </span>
              <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Chamados sob controle, <span className="text-brand">do registro à validação.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
                Abra, acompanhe e valide incidentes com prazos em horas úteis, consumo de teto
                transparente e indicadores que mostram onde agir primeiro.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-on-brand shadow-raised transition hover:bg-brand-strong"
                >
                  Acessar a plataforma
                  <ArrowRight size={18} />
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-3">
                {["Sem senha para lembrar", "Modo claro e escuro", "Funciona no celular"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-good" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-fade-up [animation-delay:120ms]">
              <PanelPreview />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Tudo o que a gestão de chamados precisa, num só lugar
            </h2>
            <p className="mt-2 text-ink-2">
              Da primeira mensagem ao relatório do mês, cada etapa deixa rastro e vira indicador.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                  <feature.icon size={19} />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center text-sm text-ink-3">
        &copy; {new Date().getFullYear()} Plataforma Chamaqui. Todos os direitos reservados.
      </footer>
    </div>
  );
}
