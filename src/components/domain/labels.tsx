import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDot, Info } from "lucide-react";
import type { Priority, Severity, TicketCategoryCode, TicketOutcome, TicketStatus } from "@prisma/client";
import { CATEGORY_DEFINITIONS, SEVERITY_DEFINITIONS } from "@/server/domain/ticket-grid";
import { Badge, type Tone } from "@/components/ui";
import { cn } from "@/lib/ui";

/* ---------------------------------------------------------------------------
   Status do ciclo de vida
   O rótulo carrega a identidade; o ponto colorido só reforça. Nenhuma
   informação depende de distinguir matizes.
--------------------------------------------------------------------------- */

export const STATUS_LABEL: Record<TicketStatus, string> = {
  ABERTO: "Aberto",
  EM_TRIAGEM: "Em triagem",
  EM_ATENDIMENTO: "Em atendimento",
  PENDENTE: "Pendente",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado",
  CANCELADO: "Cancelado",
};

export const STATUS_DOT: Record<TicketStatus, string> = {
  ABERTO: "var(--series-1)",
  EM_TRIAGEM: "var(--series-7)",
  EM_ATENDIMENTO: "var(--series-4)",
  PENDENTE: "var(--series-2)",
  RESOLVIDO: "var(--good)",
  FECHADO: "var(--chart-muted)",
  CANCELADO: "var(--critical)",
};

/** Ordem do ciclo de vida — usada em gráficos e filtros. */
export const STATUS_ORDER: TicketStatus[] = [
  "ABERTO",
  "EM_TRIAGEM",
  "EM_ATENDIMENTO",
  "PENDENTE",
  "RESOLVIDO",
  "FECHADO",
  "CANCELADO",
];

/** Estados que ainda ocupam a fila. */
export const ACTIVE_STATUSES: TicketStatus[] = [
  "ABERTO",
  "EM_TRIAGEM",
  "EM_ATENDIMENTO",
  "PENDENTE",
];

export function StatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold leading-none text-ink-2",
        className
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: STATUS_DOT[status] }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Severidade (P1..P4) — só existe em C1
--------------------------------------------------------------------------- */

export const SEVERITY_TONE: Record<Severity, Tone> = {
  P1: "critical",
  P2: "serious",
  P3: "warning",
  P4: "neutral",
};

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  P1: <AlertOctagon size={11} />,
  P2: <AlertTriangle size={11} />,
  P3: <Info size={11} />,
  P4: <CircleDot size={11} />,
};

export function SeverityBadge({
  severity,
  withLabel = true,
}: {
  severity: Severity;
  withLabel?: boolean;
}) {
  const definition = SEVERITY_DEFINITIONS[severity];
  return (
    <Badge
      tone={SEVERITY_TONE[severity]}
      icon={SEVERITY_ICON[severity]}
      title={definition.description}
    >
      {severity}
      {withLabel && ` · ${definition.label}`}
    </Badge>
  );
}

/* ---------------------------------------------------------------------------
   Prioridade legada — derivada da severidade quando há classificação
--------------------------------------------------------------------------- */

export const PRIORITY_LABEL: Record<Priority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const PRIORITY_TONE: Record<Priority, Tone> = {
  BAIXA: "neutral",
  MEDIA: "brand",
  ALTA: "warning",
  CRITICA: "critical",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

/* ---------------------------------------------------------------------------
   Natureza (C1..C6)
--------------------------------------------------------------------------- */

export function CategoryBadge({
  code,
  withLabel = true,
}: {
  code: TicketCategoryCode;
  withLabel?: boolean;
}) {
  const definition = CATEGORY_DEFINITIONS[code];
  return (
    <Badge
      tone={definition.inContract ? "brand" : "warning"}
      title={definition.description}
    >
      {code}
      {withLabel && ` · ${definition.label}`}
    </Badge>
  );
}

/* ---------------------------------------------------------------------------
   Desfecho
--------------------------------------------------------------------------- */

export const OUTCOME_LABEL: Record<TicketOutcome, string> = {
  RESOLVIDO: "Resolvido",
  IMPROCEDENTE_NAO_REPRODUZ: "Não reproduz",
  IMPROCEDENTE_ERRO_USO: "Erro de uso",
  IMPROCEDENTE_TERCEIRO: "Indisponibilidade de terceiro",
  DUPLICADO: "Duplicado",
  RECLASSIFICADO: "Reclassificado",
};

export function OutcomeBadge({ outcome }: { outcome: TicketOutcome }) {
  const tone: Tone = outcome === "RESOLVIDO" ? "good" : "neutral";
  return (
    <Badge tone={tone} icon={outcome === "RESOLVIDO" ? <CheckCircle2 size={11} /> : undefined}>
      {OUTCOME_LABEL[outcome]}
    </Badge>
  );
}

/* ---------------------------------------------------------------------------
   Estado do teto
--------------------------------------------------------------------------- */

export const QUOTA_STATE_LABEL = {
  OK: "Dentro do teto",
  ALERTA: "80% do teto",
  ESTOURADO: "Teto atingido",
  SEM_TETO: "Sem teto (garantia)",
  FORA_DO_CONTRATO: "Fora do contrato",
} as const;

export const QUOTA_STATE_TONE = {
  OK: "good",
  ALERTA: "warning",
  ESTOURADO: "critical",
  SEM_TETO: "brand",
  FORA_DO_CONTRATO: "neutral",
} as const satisfies Record<keyof typeof QUOTA_STATE_LABEL, Tone>;

export const QUOTA_STATE_COLOR = {
  OK: "var(--good)",
  ALERTA: "var(--warning)",
  ESTOURADO: "var(--critical)",
  SEM_TETO: "var(--brand)",
  FORA_DO_CONTRATO: "var(--chart-muted)",
} as const;
